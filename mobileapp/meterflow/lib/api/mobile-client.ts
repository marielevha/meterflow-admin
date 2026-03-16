import { refreshWithBackend } from '@/lib/auth/mobile-auth-api';
import {
  clearCurrentMobileSession,
  getCurrentMobileSession,
  setCurrentMobileSession,
} from '@/lib/auth/mobile-session-store';
import { API_BASE_URL } from '@/lib/api/config';

type RequestOptions = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
};

export async function fetchMobileJson<T>({ path, method = 'GET', body }: RequestOptions): Promise<T> {
  const session = getCurrentMobileSession();
  if (!session?.accessToken) {
    throw new Error('Session invalide. Reconnectez-vous.');
  }

  const response = await requestWithToken(path, session.accessToken, method, body);
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (response.ok) {
    if (!payload) {
      throw new Error('Réponse API vide.');
    }

    return payload as T;
  }

  const errorCode = payload && typeof payload === 'object' && 'error' in payload ? payload.error : undefined;
  const shouldRefresh =
    response.status === 401 &&
    ['unauthorized', 'invalid_token', 'session_not_found_or_revoked'].includes(errorCode ?? '');

  if (shouldRefresh && session.refreshToken) {
    try {
      const refreshed = await refreshWithBackend(session.refreshToken);
      await setCurrentMobileSession(refreshed);

      const retryResponse = await requestWithToken(path, refreshed.accessToken, method, body);
      const retryPayload = (await retryResponse.json().catch(() => null)) as { error?: string } | T | null;

      if (!retryResponse.ok) {
        const retryCode =
          retryPayload && typeof retryPayload === 'object' && 'error' in retryPayload
            ? retryPayload.error
            : undefined;
        throw new Error(mapMobileApiError(retryCode));
      }

      if (!retryPayload) {
        throw new Error('Réponse API vide.');
      }

      return retryPayload as T;
    } catch (refreshError) {
      await clearCurrentMobileSession();
      throw refreshError instanceof Error
        ? refreshError
        : new Error('Session invalide. Reconnectez-vous.');
    }
  }

  throw new Error(mapMobileApiError(errorCode));
}

async function requestWithToken(
  path: string,
  accessToken: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: unknown
) {
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
}

function mapMobileApiError(code?: string) {
  switch (code) {
    case 'unauthorized':
    case 'invalid_token':
    case 'session_not_found_or_revoked':
      return 'Session invalide. Reconnectez-vous.';
    case 'meter_not_found':
      return 'Compteur introuvable.';
    case 'reading_not_found':
      return 'Relevé introuvable.';
    default:
      return 'Impossible de charger les données.';
  }
}
