"use client";

export type AuthUser = {
  id: string;
  phone: string;
  username?: string | null;
  email?: string | null;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
};

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_ROLE_KEY = "user_role";
const AUTH_USER_KEY = "auth_user";

function hasWindow() {
  return typeof window !== "undefined";
}

export function saveSession(params: {
  accessToken: string;
  refreshToken: string;
  role: string;
  user: AuthUser;
}) {
  if (!hasWindow()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, params.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, params.refreshToken);
  localStorage.setItem(USER_ROLE_KEY, params.role);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(params.user));
}

export function getRefreshToken() {
  if (!hasWindow()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  if (!hasWindow()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  if (!hasWindow()) return null;
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (!hasWindow()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}
