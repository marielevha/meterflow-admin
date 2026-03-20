import { API_BASE_URL } from '@/lib/api/config';
import type { MobileSession } from '@/lib/auth/mobile-session-store';

export type MobileLoginResponse = MobileSession;

type LoginPayload = {
  identifier: string;
  password: string;
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
    throw new Error("La reponse d'authentification est invalide.");
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
    throw new Error('La reponse de rafraichissement est invalide.');
  }

  return data as MobileLoginResponse;
}

function mapLoginError(code?: string) {
  switch (code) {
    case 'identifier_and_password_required':
      return "Identifiant et mot de passe requis.";
    case 'invalid_credentials':
      return 'Identifiants invalides.';
    case 'user_not_active':
      return "Votre compte n'est pas encore active.";
    case 'role_not_allowed_for_mobile':
      return 'Cette application est reservee aux clients.';
    case 'role_not_allowed_for_web':
      return 'Ce profil ne peut pas utiliser cette connexion.';
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
    case 'role_not_allowed_for_mobile':
      return 'Cette application est reservee aux clients.';
    default:
      return 'Impossible de rafraichir la session.';
  }
}
