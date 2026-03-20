const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

if (!rawBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
}

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
