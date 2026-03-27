import { API_BASE_URL } from '@/lib/api/config';
import type { MobileSession } from '@/lib/auth/mobile-session-store';
import { translateCurrentApp } from '@/lib/i18n/runtime';

export type MobileLoginResponse = MobileSession;

export type MobileSignupResponse = {
  message: string;
  otp: {
    code: string;
    expiresInSeconds: number;
    purpose: string;
  };
  user: {
    id: string;
    phone: string;
    username: string | null;
    email: string | null;
    role: string;
    status: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type LoginPayload = {
  identifier: string;
  password: string;
};

type SignupPayload = {
  phone: string;
  username?: string;
  email?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  region?: string;
  city?: string;
  zone?: string;
};

export type UsernameCheckResponse = {
  username: string;
  available: boolean;
  suggestion?: string | null;
};

export type UsernameGenerateResponse = {
  username: string;
  base: string;
};

export async function loginWithBackend(payload: LoginPayload): Promise<MobileLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | (Partial<MobileLoginResponse> & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(mapLoginError(data?.error));
  }

  if (
    !data ||
    typeof data.accessToken !== 'string' ||
    typeof data.refreshToken !== 'string' ||
    typeof data.accessTokenExpiresIn !== 'number' ||
    typeof data.refreshTokenExpiresIn !== 'number' ||
    !data.user
  ) {
    throw new Error(translateCurrentApp('auth.api.invalidLoginResponse'));
  }

  return data as MobileLoginResponse;
}

export async function refreshWithBackend(refreshToken: string): Promise<MobileLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = (await response.json().catch(() => null)) as
    | (Partial<MobileLoginResponse> & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(mapRefreshError(data?.error));
  }

  if (
    !data ||
    typeof data.accessToken !== 'string' ||
    typeof data.refreshToken !== 'string' ||
    typeof data.accessTokenExpiresIn !== 'number' ||
    typeof data.refreshTokenExpiresIn !== 'number' ||
    !data.user
  ) {
    throw new Error(translateCurrentApp('auth.api.invalidRefreshResponse'));
  }

  return data as MobileLoginResponse;
}

export async function registerWithBackend(payload: SignupPayload) {
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | (MobileSignupResponse & { error?: string })
    | null;

  if (!response.ok || !data) {
    throw new Error(mapSignupError(data?.error));
  }

  return data;
}

export async function activateClientAccount(payload: { phone: string; code: string }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

  if (!response.ok) {
    throw new Error(mapOtpError(data?.error));
  }

  return data;
}

export async function resendClientSignupOtp(payload: { phone: string }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/resend-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | ({ otp?: MobileSignupResponse['otp']; error?: string })
    | null;

  if (!response.ok || !data) {
    throw new Error(mapOtpError(data?.error));
  }

  return data;
}

export async function checkUsernameWithBackend(payload: { username: string }): Promise<UsernameCheckResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/username/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | ({ username?: string; available?: boolean; suggestion?: string | null; error?: string })
    | null;

  if (response.status === 409 && data && typeof data.username === 'string') {
    return {
      username: data.username,
      available: false,
      suggestion: data.suggestion ?? null,
    };
  }

  if (!response.ok || !data || typeof data.username !== 'string') {
    throw new Error(mapUsernameError(data?.error));
  }

  return {
    username: data.username,
    available: !!data.available,
    suggestion: data.suggestion ?? null,
  };
}

export async function generateUsernameWithBackend(payload: {
  firstName: string;
  lastName: string;
}): Promise<UsernameGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/username/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | ({ username?: string; base?: string; error?: string })
    | null;

  if (!response.ok || !data || typeof data.username !== 'string' || typeof data.base !== 'string') {
    throw new Error(mapUsernameError(data?.error));
  }

  return {
    username: data.username,
    base: data.base,
  };
}

function mapLoginError(code?: string) {
  switch (code) {
    case 'identifier_and_password_required':
      return translateCurrentApp('auth.api.login.identifierPasswordRequired');
    case 'invalid_credentials':
      return translateCurrentApp('auth.api.login.invalidCredentials');
    case 'user_not_active':
      return translateCurrentApp('auth.api.login.userNotActive');
    case 'role_not_allowed_for_mobile':
      return translateCurrentApp('auth.api.login.roleNotAllowedForMobile');
    case 'role_not_allowed_for_web':
      return translateCurrentApp('auth.api.login.roleNotAllowedForWeb');
    case 'invalid_request':
      return translateCurrentApp('auth.api.invalidRequest');
    default:
      return translateCurrentApp('auth.api.login.fallback');
  }
}

function mapRefreshError(code?: string) {
  switch (code) {
    case 'refresh_token_required':
      return translateCurrentApp('auth.api.refresh.tokenRequired');
    case 'invalid_refresh_token':
    case 'session_not_found_or_revoked':
      return translateCurrentApp('auth.api.refresh.invalidSession');
    case 'user_not_active':
      return translateCurrentApp('auth.api.refresh.userNotActive');
    case 'role_not_allowed_for_mobile':
      return translateCurrentApp('auth.api.login.roleNotAllowedForMobile');
    default:
      return translateCurrentApp('auth.api.refresh.fallback');
  }
}

function mapSignupError(code?: string) {
  switch (code) {
    case 'phone_and_password_required':
      return translateCurrentApp('auth.api.signup.phonePasswordRequired');
    case 'invalid_phone_format':
      return translateCurrentApp('auth.api.signup.invalidPhone');
    case 'password_too_short':
      return translateCurrentApp('auth.api.signup.passwordTooShort');
    case 'invalid_username_length':
    case 'invalid_username_format':
      return translateCurrentApp('auth.api.username.invalidFormat');
    case 'account_pending_activation':
      return translateCurrentApp('auth.api.signup.accountPendingActivation');
    case 'phone_already_exists':
      return translateCurrentApp('auth.api.signup.phoneAlreadyExists');
    case 'email_already_exists':
      return translateCurrentApp('auth.api.signup.emailAlreadyExists');
    case 'username_already_exists':
      return translateCurrentApp('auth.api.username.alreadyExists');
    case 'client_role_not_configured':
      return translateCurrentApp('auth.api.signup.clientRoleNotConfigured');
    default:
      return translateCurrentApp('auth.api.signup.fallback');
  }
}

function mapOtpError(code?: string) {
  switch (code) {
    case 'phone_required':
      return translateCurrentApp('auth.api.otp.phoneRequired');
    case 'phone_and_code_required':
      return translateCurrentApp('auth.api.otp.phoneCodeRequired');
    case 'user_not_found':
      return translateCurrentApp('auth.api.otp.userNotFound');
    case 'account_already_active':
      return translateCurrentApp('auth.api.otp.accountAlreadyActive');
    case 'account_not_eligible_for_activation':
      return translateCurrentApp('auth.api.otp.accountNotEligible');
    case 'otp_not_found':
      return translateCurrentApp('auth.api.otp.notFound');
    case 'otp_expired':
      return translateCurrentApp('auth.api.otp.expired');
    case 'otp_max_attempts_exceeded':
      return translateCurrentApp('auth.api.otp.maxAttempts');
    case 'invalid_otp':
      return translateCurrentApp('auth.api.otp.invalid');
    default:
      return translateCurrentApp('auth.api.otp.fallback');
  }
}

function mapUsernameError(code?: string) {
  switch (code) {
    case 'username_required':
      return translateCurrentApp('auth.api.username.required');
    case 'name_seed_required':
      return translateCurrentApp('auth.api.username.nameSeedRequired');
    case 'invalid_username_length':
      return translateCurrentApp('auth.api.username.invalidLength');
    case 'invalid_username_format':
      return translateCurrentApp('auth.api.username.invalidFormat');
    case 'username_already_exists':
      return translateCurrentApp('auth.api.username.alreadyExists');
    default:
      return translateCurrentApp('auth.api.username.fallback');
  }
}
