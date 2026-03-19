import * as FileSystem from 'expo-file-system/legacy';

import { fetchMobileAuthResponse } from '@/lib/api/mobile-client';

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

function guessMimeType(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function uploadReadingPhoto(uri: string) {
  const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });

  if (!fileInfo.exists) {
    throw new Error('Photo introuvable sur l’appareil.');
  }

  const mimeType = guessMimeType(uri);
  const sizeBytes = typeof fileInfo.size === 'number' && Number.isFinite(fileInfo.size) ? fileInfo.size : 0;
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `reading-${Date.now()}.${extension}`;

  try {
    const formData = new FormData();
    formData.append('purpose', 'reading_photo');
    formData.append(
      'file',
      {
        uri,
        name: fileName,
        type: mimeType,
      } as never
    );

    const response = await fetchMobileAuthResponse({
      path: '/api/v1/mobile/uploads',
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as DirectUploadResponse | null;
    if (!payload?.file) {
      throw new Error('Réponse upload invalide.');
    }

    console.log('[uploadReadingPhoto] backend_upload_success', {
      fileName,
      mimeType,
      sizeBytes,
      file: payload.file,
    });

    return payload.file;
  } catch (error) {
    console.log('[uploadReadingPhoto] backend_upload_error', {
      message: error instanceof Error ? error.message : 'unknown_error',
      fileName,
      mimeType,
      sizeBytes,
      uri,
    });
    throw error;
  }
}
