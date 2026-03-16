import {
  clearStoredMobileSession,
  readStoredMobileSession,
  writeStoredMobileSession,
} from '@/lib/storage/mobile-session';
import { readStoredAppPreferences } from '@/lib/storage/app-preferences';

export type MobileAuthUser = {
  id: string;
  phone: string | null;
  username: string | null;
  email: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
};

export type MobileSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: MobileAuthUser;
};

type SessionListener = (session: MobileSession | null) => void;

let currentSession: MobileSession | null = null;
const listeners = new Set<SessionListener>();

export function getCurrentMobileSession() {
  return currentSession;
}

export async function hydrateMobileSessionStore() {
  const preferences = await readStoredAppPreferences();
  if (!preferences.keepSession) {
    currentSession = null;
    await clearStoredMobileSession();
    notify();
    return null;
  }

  const raw = await readStoredMobileSession();

  if (!raw) {
    currentSession = null;
    notify();
    return null;
  }

  try {
    currentSession = JSON.parse(raw) as MobileSession;
  } catch {
    currentSession = null;
    await clearStoredMobileSession();
  }

  notify();
  return currentSession;
}

export async function setCurrentMobileSession(session: MobileSession) {
  currentSession = session;
  const preferences = await readStoredAppPreferences();
  if (preferences.keepSession) {
    await writeStoredMobileSession(JSON.stringify(session));
  } else {
    await clearStoredMobileSession();
  }
  notify();
}

export async function clearCurrentMobileSession() {
  currentSession = null;
  await clearStoredMobileSession();
  notify();
}

export async function syncStoredMobileSession() {
  const preferences = await readStoredAppPreferences();

  if (preferences.keepSession && currentSession) {
    await writeStoredMobileSession(JSON.stringify(currentSession));
    return;
  }

  await clearStoredMobileSession();
}

export function subscribeToMobileSession(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener(currentSession));
}
