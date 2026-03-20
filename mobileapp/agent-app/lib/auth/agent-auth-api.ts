import { API_BASE_URL } from '@/lib/api/config';
import type { AgentSession } from '@/lib/auth/agent-session-store';

export type AgentLoginResponse = AgentSession;

export type AgentSignupResponse = {
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

export async function loginWithBackend(payload: LoginPayload): Promise<AgentLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent-mobile/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | (Partial<AgentLoginResponse> & { error?: string })
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
    throw new Error("La reponse d'authentification est invalide.");
  }

  return data as AgentLoginResponse;
}

export async function refreshWithBackend(refreshToken: string): Promise<AgentLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent-mobile/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = (await response.json().catch(() => null)) as
    | (Partial<AgentLoginResponse> & { error?: string })
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
    throw new Error('La reponse de rafraichissement est invalide.');
  }

  return data as AgentLoginResponse;
}

export async function registerWithBackend(payload: SignupPayload) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent-mobile/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | (AgentSignupResponse & { error?: string })
    | null;

  if (!response.ok || !data) {
    throw new Error(mapSignupError(data?.error));
  }

  return data;
}

export async function activateAgentAccount(payload: { phone: string; code: string }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent-mobile/auth/activate`, {
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

export async function resendAgentSignupOtp(payload: { phone: string }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent-mobile/auth/resend-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | ({ otp?: AgentSignupResponse['otp']; error?: string })
    | null;

  if (!response.ok || !data) {
    throw new Error(mapOtpError(data?.error));
  }

  return data;
}

export async function requestPasswordReset(payload: { phone: string }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent-mobile/auth/forgot-password/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | ({ otp?: AgentSignupResponse['otp']; error?: string })
    | null;

  if (!response.ok || !data) {
    throw new Error(mapForgotPasswordError(data?.error));
  }

  return data;
}

export async function confirmPasswordReset(payload: {
  phone: string;
  code: string;
  newPassword: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/v1/agent-mobile/auth/forgot-password/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

  if (!response.ok) {
    throw new Error(mapForgotPasswordError(data?.error));
  }

  return data;
}

function mapLoginError(code?: string) {
  switch (code) {
    case 'identifier_and_password_required':
      return 'Identifiant et mot de passe requis.';
    case 'invalid_credentials':
      return 'Identifiants invalides.';
    case 'user_not_active':
      return "Votre compte n'est pas encore actif.";
    case 'role_not_allowed_for_agent_mobile':
      return 'Cette application est reservee au personnel terrain.';
    case 'role_not_allowed_for_mobile':
      return 'Ce profil ne peut pas utiliser cette application.';
    case 'invalid_request':
      return 'Requete invalide.';
    default:
      return 'Connexion impossible pour le moment.';
  }
}

function mapRefreshError(code?: string) {
  switch (code) {
    case 'refresh_token_required':
      return 'Refresh token manquant.';
    case 'invalid_refresh_token':
    case 'session_not_found_or_revoked':
      return 'Session invalide. Reconnectez-vous.';
    case 'user_not_active':
      return "Votre compte n'est pas actif.";
    case 'role_not_allowed_for_agent_mobile':
      return 'Cette application est reservee au personnel terrain.';
    default:
      return 'Impossible de rafraichir la session.';
  }
}

function mapSignupError(code?: string) {
  switch (code) {
    case 'phone_and_password_required':
      return 'Telephone et mot de passe requis.';
    case 'invalid_phone_format':
      return 'Numero de telephone invalide.';
    case 'password_too_short':
      return 'Le mot de passe doit contenir au moins 8 caracteres.';
    case 'account_pending_activation':
      return 'Ce compte attend deja son activation.';
    case 'phone_already_exists':
      return 'Ce numero est deja utilise.';
    case 'email_already_exists':
      return 'Cet email est deja utilise.';
    case 'username_already_exists':
      return "Ce nom d'utilisateur est deja utilise.";
    case 'agent_role_not_configured':
      return 'Le role agent nest pas configure.';
    default:
      return 'Inscription impossible pour le moment.';
  }
}

function mapOtpError(code?: string) {
  switch (code) {
    case 'phone_required':
      return 'Telephone requis.';
    case 'phone_and_code_required':
      return 'Telephone et code requis.';
    case 'user_not_found':
      return 'Compte introuvable.';
    case 'account_already_active':
      return 'Le compte est deja active.';
    case 'account_not_eligible_for_activation':
      return "Ce compte ne peut pas etre active.";
    case 'otp_not_found':
      return 'Aucun code OTP en attente.';
    case 'otp_expired':
      return 'Le code OTP a expire.';
    case 'otp_max_attempts_exceeded':
      return 'Trop de tentatives. Demandez un nouveau code.';
    case 'invalid_otp':
      return 'Code OTP invalide.';
    default:
      return 'Verification impossible pour le moment.';
  }
}

function mapForgotPasswordError(code?: string) {
  switch (code) {
    case 'phone_required':
      return 'Telephone requis.';
    case 'user_not_found':
      return 'Compte introuvable.';
    case 'user_not_active':
      return "Votre compte n'est pas actif.";
    case 'phone_code_new_password_required':
      return 'Telephone, code et nouveau mot de passe requis.';
    case 'password_too_short':
      return 'Le mot de passe doit contenir au moins 8 caracteres.';
    case 'otp_not_found':
      return 'Aucun code OTP en attente.';
    case 'otp_expired':
      return 'Le code OTP a expire.';
    case 'otp_max_attempts_exceeded':
      return 'Trop de tentatives. Demandez un nouveau code.';
    case 'invalid_otp':
      return 'Code OTP invalide.';
    default:
      return 'Impossible de reinitialiser le mot de passe.';
  }
}
