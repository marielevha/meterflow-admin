import * as FileSystem from 'expo-file-system/legacy';

import { fetchAgentAuthResponse } from '@/lib/api/agent-client';

type DirectUploadResponse = {
  message: string;
  file: {
    key: string;
    url: string;
    sha256: string;
    mimeType: string;
    sizeBytes: number;
    purpose: string;
    fileName: string;
  };
};

type UploadTaskEvidenceOptions = {
  maxSizeBytes?: number;
};

type ReactNativeFilePart = {
  uri: string;
  name: string;
  type: string;
};

function guessMimeType(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function uploadTaskEvidence(
  uri: string,
  options?: UploadTaskEvidenceOptions
): Promise<DirectUploadResponse['file']> {
  const fileInfo = await FileSystem.getInfoAsync(uri);

  if (!fileInfo.exists) {
    throw new Error('Photo introuvable sur l appareil.');
  }

  const mimeType = guessMimeType(uri);
  const sizeBytes = typeof fileInfo.size === 'number' && Number.isFinite(fileInfo.size) ? fileInfo.size : 0;

  if (typeof options?.maxSizeBytes === 'number' && sizeBytes > options.maxSizeBytes) {
    throw new Error('La photo est trop volumineuse. Reprenez une image plus legere.');
  }

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `task-evidence-${Date.now()}.${extension}`;
  const filePart: ReactNativeFilePart = {
    uri,
    name: fileName,
    type: mimeType,
  };

  const formData = new FormData();
  formData.append('purpose', 'task_evidence');
  formData.append('file', filePart as unknown as Blob);

  const response = await fetchAgentAuthResponse({
    path: '/api/v1/agent-mobile/uploads',
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as DirectUploadResponse | null;
  if (!payload?.file) {
    throw new Error('Reponse upload invalide.');
  }

  return payload.file;
}
