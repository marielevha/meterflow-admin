import * as FileSystem from 'expo-file-system/legacy';
import { sha256 } from 'js-sha256';

import { fetchMobileJson } from '@/lib/api/mobile-client';

type PresignResponse = {
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  objectKey: string;
  fileUrl: string;
  expiresInSeconds: number;
  uploadToken: string;
};

type CompleteResponse = {
  message: string;
  file: {
    key: string;
    url: string;
    sha256: string;
    mimeType: string;
    sizeBytes: number;
    purpose: string;
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
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const sha256Hash = sha256(base64);

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `reading-${Date.now()}.${extension}`;

  try {
    const presigned = await fetchMobileJson<PresignResponse>({
      path: '/api/v1/mobile/uploads/presign',
      method: 'POST',
      body: {
        fileName,
        mimeType,
        sha256: sha256Hash,
        purpose: 'reading_photo',
        sizeBytes,
      },
    });

    console.log('[uploadReadingPhoto] presign_success', {
      fileName,
      mimeType,
      sizeBytes,
      uploadUrl: presigned.uploadUrl,
      fileUrl: presigned.fileUrl,
      objectKey: presigned.objectKey,
    });

    const uploadResponse = await FileSystem.uploadAsync(presigned.uploadUrl, uri, {
      httpMethod: presigned.method,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: presigned.requiredHeaders,
    });

    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      console.log('[uploadReadingPhoto] upload_failed', {
        status: uploadResponse.status,
        uploadUrl: presigned.uploadUrl,
        responseBody: uploadResponse.body,
      });
      throw new Error('Impossible de téléverser la photo du compteur.');
    }

    console.log('[uploadReadingPhoto] upload_success', {
      status: uploadResponse.status,
      uploadUrl: presigned.uploadUrl,
    });

    const completed = await fetchMobileJson<CompleteResponse>({
      path: '/api/v1/mobile/uploads/complete',
      method: 'POST',
      body: {
        uploadToken: presigned.uploadToken,
        sha256: sha256Hash,
        mimeType,
        sizeBytes,
      },
    });

    console.log('[uploadReadingPhoto] complete_success', {
      file: completed.file,
    });

    return completed.file;
  } catch (error) {
    console.log('[uploadReadingPhoto] unexpected_error', {
      message: error instanceof Error ? error.message : 'unknown_error',
      fileName,
      mimeType,
      sizeBytes,
      uri,
    });
    throw error;
  }
}
