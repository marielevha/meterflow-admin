import { refreshWithBackend } from '@/lib/auth/agent-auth-api';
import {
  clearCurrentAgentSession,
  getCurrentAgentSession,
  setCurrentAgentSession,
} from '@/lib/auth/agent-session-store';
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

type AgentErrorPayload = {
  error?: string;
  message?: string;
};

const AUTH_ERROR_CODES = new Set([
  'unauthorized',
  'invalid_token',
  'session_not_found_or_revoked',
  'invalid_refresh_token',
  'refresh_token_required',
  'agent_mobile_only_endpoint',
]);

export class AgentApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'AgentApiError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

export async function fetchAgentJson<T>({ path, method = 'GET', body }: RequestOptions): Promise<T> {
  const response = await fetchAgentAuthResponse({
    path,
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!payload) {
    throw new AgentApiError('Reponse API vide.', {
      code: 'empty_response',
      status: response.status,
    });
  }

  return payload;
}

export async function fetchAgentAuthResponse({
  path,
  method = 'GET',
  body,
  headers = {},
}: AuthResponseOptions): Promise<Response> {
  const session = getCurrentAgentSession();
  if (!session?.accessToken) {
    throw createAgentApiError('session_not_found_or_revoked', 401);
  }

  const response = await requestWithToken(path, session.accessToken, method, body, headers);
  if (response.ok) {
    return response;
  }

  const errorPayload = await extractErrorPayload(response.clone());
  const errorCode = errorPayload?.error;
  const shouldRefresh =
    response.status === 401 &&
    ['unauthorized', 'invalid_token', 'session_not_found_or_revoked'].includes(errorCode ?? '');

  if (shouldRefresh && session.refreshToken) {
    try {
      const refreshed = await refreshWithBackend(session.refreshToken);
      await setCurrentAgentSession(refreshed);

      const retryResponse = await requestWithToken(path, refreshed.accessToken, method, body, headers);
      if (!retryResponse.ok) {
        const retryPayload = await extractErrorPayload(retryResponse.clone());
        throw createAgentApiError(retryPayload?.error, retryResponse.status);
      }

      return retryResponse;
    } catch {
      await clearCurrentAgentSession();
      throw createAgentApiError('session_not_found_or_revoked', 401);
    }
  }

  throw createAgentApiError(errorCode, response.status, errorPayload?.message);
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

async function extractErrorPayload(response: Response) {
  return (await response.json().catch(() => null)) as AgentErrorPayload | null;
}

function mapAgentApiError(code?: string, status?: number) {
  switch (code) {
    case 'unauthorized':
    case 'invalid_token':
    case 'session_not_found_or_revoked':
    case 'invalid_refresh_token':
    case 'refresh_token_required':
    case 'agent_mobile_only_endpoint':
      return 'Session invalide. Reconnectez-vous.';
    case 'current_and_new_password_required':
      return 'Renseignez le mot de passe actuel et le nouveau mot de passe.';
    case 'password_too_short':
      return 'Le nouveau mot de passe doit contenir au moins 8 caracteres.';
    case 'invalid_current_password':
      return 'Le mot de passe actuel est incorrect.';
    case 'new_password_must_be_different':
      return 'Le nouveau mot de passe doit etre different de l ancien.';
    case 'no_updatable_fields':
      return 'Aucune modification a enregistrer.';
    case 'task_not_found':
      return 'Mission introuvable.';
    case 'task_already_closed':
      return 'Cette mission est deja terminee.';
    case 'field_photo_required':
      return 'Une photo de preuve est requise.';
    case 'field_gps_required':
      return 'La position GPS est requise pour envoyer ce resultat.';
    case 'resolution_code_required':
      return 'Choisissez une issue terrain avant de continuer.';
    case 'primary_index_required':
      return 'Saisissez un index valide.';
    case 'secondary_index_required_for_dual_meter':
      return 'Ce compteur demande aussi un index HC.';
    case 'primary_index_not_monotonic':
      return 'L index saisi est inferieur au dernier releve connu.';
    case 'secondary_index_not_monotonic':
      return 'L index HC est inferieur au dernier releve connu.';
    case 'expo_push_token_required':
      return 'Le token push appareil est requis.';
    case 'invalid_expo_push_token':
      return 'Le token push genere est invalide.';
    case 'invalid_status_transition':
      return 'Cette action n est pas autorisee pour l etat actuel de la mission.';
    case 'invalid_request':
      return 'La demande envoyee est invalide. Merci de reessayer.';
    case 'empty_response':
      return 'Reponse API vide.';
    default:
      return status && status >= 500
        ? 'Le service est momentanement indisponible. Reessayez dans un instant.'
        : 'Impossible de charger les donnees.';
  }
}

function normalizeRuntimeErrorMessage(message: string) {
  const trimmed = message.trim();

  switch (trimmed) {
    case 'Network request failed':
    case 'Load failed':
    case 'Failed to fetch':
      return 'Connexion impossible. Verifiez votre reseau puis reessayez.';
    default:
      return trimmed;
  }
}

function createAgentApiError(code?: string, status?: number, messageOverride?: string) {
  return new AgentApiError(messageOverride || mapAgentApiError(code, status), {
    code,
    status,
  });
}

export function isAgentApiError(error: unknown): error is AgentApiError {
  return error instanceof AgentApiError;
}

export function isAgentAuthError(error: unknown) {
  return isAgentApiError(error) && (AUTH_ERROR_CODES.has(error.code ?? '') || error.status === 401);
}

export function toAgentErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return normalizeRuntimeErrorMessage(error.message);
  }

  return fallback;
}
