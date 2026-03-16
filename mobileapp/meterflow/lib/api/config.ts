const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000';

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
