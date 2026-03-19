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

type AuthResponseOptions = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: BodyInit;
  headers?: Record<string, string>;
};

export async function fetchMobileJson<T>({ path, method = 'GET', body }: RequestOptions): Promise<T> {
  const response = await fetchMobileAuthResponse({
    path,
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!payload) {
    throw new Error('Réponse API vide.');
  }

  return payload;
}

export async function fetchMobileAuthResponse({
  path,
  method = 'GET',
  body,
  headers = {},
}: AuthResponseOptions): Promise<Response> {
  const session = getCurrentMobileSession();
  if (!session?.accessToken) {
    throw new Error('Session invalide. Reconnectez-vous.');
  }

  const response = await requestWithToken(path, session.accessToken, method, body, headers);
  if (response.ok) {
    return response;
  }

  const errorCode = await extractErrorCode(response.clone());
  const shouldRefresh =
    response.status === 401 &&
    ['unauthorized', 'invalid_token', 'session_not_found_or_revoked'].includes(errorCode ?? '');

  if (shouldRefresh && session.refreshToken) {
    try {
      const refreshed = await refreshWithBackend(session.refreshToken);
      await setCurrentMobileSession(refreshed);

      const retryResponse = await requestWithToken(
        path,
        refreshed.accessToken,
        method,
        body,
        headers
      );
      if (!retryResponse.ok) {
        const retryCode = await extractErrorCode(retryResponse.clone());
        throw new Error(mapMobileApiError(retryCode));
      }

      return retryResponse;
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
  body?: BodyInit,
  headers?: Record<string, string>
) {
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(headers ?? {}),
    },
    body: method === 'GET' ? undefined : body,
  });
}

async function extractErrorCode(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error;
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
