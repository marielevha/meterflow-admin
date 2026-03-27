import { refreshWithBackend } from '@/lib/auth/mobile-auth-api';
import {
  clearCurrentMobileSession,
  getCurrentMobileSession,
  setCurrentMobileSession,
} from '@/lib/auth/mobile-session-store';
import { API_BASE_URL } from '@/lib/api/config';
import { translateCurrentApp } from '@/lib/i18n/runtime';

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
    throw new MobileApiError(translateCurrentApp('api.error.emptyResponse'), {
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
      return translateCurrentApp('api.error.invalidSession');
    case 'meter_id_image_url_primary_index_required':
      return translateCurrentApp('api.error.readingMeterPhotoIndexRequired');
    case 'image_url_and_primary_index_required':
      return translateCurrentApp('api.error.readingPhotoIndexRequired');
    case 'primary_index_must_be_positive':
      return translateCurrentApp('api.error.primaryIndexPositive');
    case 'secondary_index_must_be_positive':
      return translateCurrentApp('api.error.secondaryIndexPositive');
    case 'secondary_index_required_for_dual_meter':
      return translateCurrentApp('api.error.secondaryIndexRequired');
    case 'gps_required_for_reading':
      return translateCurrentApp('api.error.gpsRequired');
    case 'reading_submission_window_closed':
      return translateCurrentApp('api.error.readingSubmissionWindowClosed');
    case 'reading_already_submitted_for_current_window':
      return translateCurrentApp('api.error.readingAlreadySubmittedForCurrentWindow');
    case 'reading_resubmission_required_for_current_window':
      return translateCurrentApp('api.error.readingResubmissionRequiredForCurrentWindow');
    case 'current_and_new_password_required':
      return translateCurrentApp('api.error.passwordBothRequired');
    case 'password_too_short':
      return translateCurrentApp('api.error.passwordTooShort');
    case 'invalid_current_password':
      return translateCurrentApp('api.error.currentPasswordInvalid');
    case 'new_password_must_be_different':
      return translateCurrentApp('api.error.newPasswordDifferent');
    case 'no_updatable_fields':
      return translateCurrentApp('api.error.noUpdatableFields');
    case 'reading_not_eligible_for_resubmission':
      return translateCurrentApp('api.error.readingResubmissionLocked');
    case 'idempotency_key_conflict':
      return translateCurrentApp('api.error.idempotencyConflict');
    case 'meter_not_found':
      return translateCurrentApp('api.error.meterNotFound');
    case 'reading_not_found':
      return translateCurrentApp('api.error.readingNotFound');
    case 'reading_image_not_found':
      return translateCurrentApp('api.error.readingImageNotFound');
    case 'file_required':
      return translateCurrentApp('api.error.fileRequired');
    case 'invalid_file_type':
      return translateCurrentApp('api.error.invalidFileType');
    case 'invalid_file_size':
      return translateCurrentApp('api.error.invalidFileSize');
    case 'invalid_request':
      return translateCurrentApp('api.error.invalidRequest');
    case 'invalid_status_filter':
      return translateCurrentApp('api.error.invalidStatusFilter');
    case 'invalid_date_from':
    case 'invalid_date_to':
      return translateCurrentApp('api.error.invalidDateRange');
    case 'empty_response':
      return translateCurrentApp('api.error.emptyResponse');
    default:
      return status && status >= 500
        ? translateCurrentApp('api.error.serviceUnavailable')
        : translateCurrentApp('api.error.loadFailed');
  }
}

function normalizeRuntimeErrorMessage(message: string) {
  const trimmed = message.trim();

  switch (trimmed) {
    case 'Network request failed':
    case 'Load failed':
    case 'Failed to fetch':
      return translateCurrentApp('api.error.networkFailed');
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
