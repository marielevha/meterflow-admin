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

type MobileErrorPayload = {
  error?: string;
  message?: string;
};

const AUTH_ERROR_CODES = new Set([
  'unauthorized',
  'invalid_token',
  'session_not_found_or_revoked',
  'invalid_refresh_token',
  'refresh_token_required',
]);

export class MobileApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'MobileApiError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

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
    throw new MobileApiError('Réponse API vide.', {
      code: 'empty_response',
      status: response.status,
    });
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
    throw createMobileApiError('session_not_found_or_revoked', 401);
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
      await setCurrentMobileSession(refreshed);

      const retryResponse = await requestWithToken(
        path,
        refreshed.accessToken,
        method,
        body,
        headers
      );
      if (!retryResponse.ok) {
        const retryPayload = await extractErrorPayload(retryResponse.clone());
        throw createMobileApiError(retryPayload?.error, retryResponse.status);
      }

      return retryResponse;
    } catch {
      await clearCurrentMobileSession();
      throw createMobileApiError('session_not_found_or_revoked', 401);
    }
  }

  throw createMobileApiError(errorCode, response.status, errorPayload?.message);
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
  return (await response.json().catch(() => null)) as MobileErrorPayload | null;
}

function mapMobileApiError(code?: string, status?: number) {
  switch (code) {
    case 'unauthorized':
    case 'invalid_token':
    case 'session_not_found_or_revoked':
    case 'invalid_refresh_token':
    case 'refresh_token_required':
      return 'Session invalide. Reconnectez-vous.';
    case 'meter_id_image_url_primary_index_required':
      return 'Choisissez un compteur, ajoutez une photo et renseignez l’index principal.';
    case 'image_url_and_primary_index_required':
      return 'Ajoutez une photo et renseignez l’index principal pour renvoyer le relevé.';
    case 'primary_index_must_be_positive':
      return "L'index principal doit être un nombre positif.";
    case 'secondary_index_must_be_positive':
      return "L'index secondaire doit être un nombre positif.";
    case 'secondary_index_required_for_dual_meter':
      return 'Ce compteur nécessite aussi un index secondaire.';
    case 'gps_required_for_reading':
      return 'La localisation est requise pour transmettre ce relevé.';
    case 'reading_submission_window_closed':
      return "La période d'auto-relevé est actuellement fermée.";
    case 'reading_already_submitted_for_current_window':
      return 'Un relevé a déjà été transmis pour ce compteur sur la période en cours.';
    case 'reading_resubmission_required_for_current_window':
      return "Un relevé existe déjà pour cette période. Utilisez le renvoi du relevé demandé au lieu d'en créer un nouveau.";
    case 'current_and_new_password_required':
      return 'Renseignez le mot de passe actuel et le nouveau mot de passe.';
    case 'password_too_short':
      return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
    case 'invalid_current_password':
      return 'Le mot de passe actuel est incorrect.';
    case 'new_password_must_be_different':
      return 'Le nouveau mot de passe doit être différent de l’ancien.';
    case 'no_updatable_fields':
      return 'Aucune modification à enregistrer.';
    case 'reading_not_eligible_for_resubmission':
      return "Ce relevé ne peut plus être renvoyé. Vérifiez son statut avant de recommencer.";
    case 'idempotency_key_conflict':
      return 'Une autre soumission utilise déjà cette photo. Reprenez le relevé pour continuer.';
    case 'meter_not_found':
      return 'Compteur introuvable.';
    case 'reading_not_found':
      return 'Relevé introuvable.';
    case 'reading_image_not_found':
      return "L'image du relevé est introuvable.";
    case 'file_required':
      return 'Ajoutez une photo du compteur avant envoi.';
    case 'invalid_file_type':
      return 'Le format de la photo n’est pas pris en charge.';
    case 'invalid_file_size':
      return 'La photo est trop lourde. Reprenez une image plus légère.';
    case 'invalid_request':
      return 'La demande envoyée est invalide. Merci de réessayer.';
    case 'invalid_status_filter':
      return 'Le filtre demandé est invalide.';
    case 'invalid_date_from':
    case 'invalid_date_to':
      return 'La période demandée est invalide.';
    case 'empty_response':
      return 'Réponse API vide.';
    default:
      return status && status >= 500
        ? 'Le service est momentanément indisponible. Réessayez dans un instant.'
        : 'Impossible de charger les données.';
  }
}

function normalizeRuntimeErrorMessage(message: string) {
  const trimmed = message.trim();

  switch (trimmed) {
    case 'Network request failed':
    case 'Load failed':
    case 'Failed to fetch':
      return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
    default:
      return trimmed;
  }
}

function createMobileApiError(code?: string, status?: number, messageOverride?: string) {
  return new MobileApiError(messageOverride || mapMobileApiError(code, status), {
    code,
    status,
  });
}

export function isMobileApiError(error: unknown): error is MobileApiError {
  return error instanceof MobileApiError;
}

export function isMobileAuthError(error: unknown) {
  return (
    isMobileApiError(error) &&
    (AUTH_ERROR_CODES.has(error.code ?? '') || error.status === 401)
  );
}

export function toMobileErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return normalizeRuntimeErrorMessage(error.message);
  }

  return fallback;
}
