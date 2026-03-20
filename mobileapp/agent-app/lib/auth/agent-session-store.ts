import {
  clearStoredAgentSession,
  readStoredAgentSession,
  writeStoredAgentSession,
} from '@/lib/storage/agent-session';

export type AgentAuthUser = {
  id: string;
  phone: string | null;
  username: string | null;
  email: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
  region?: string | null;
  city?: string | null;
  zone?: string | null;
  status?: string | null;
  activatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AgentSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: AgentAuthUser;
};

type SessionListener = (session: AgentSession | null) => void;

let currentSession: AgentSession | null = null;
const listeners = new Set<SessionListener>();

export function getCurrentAgentSession() {
  return currentSession;
}

export async function hydrateAgentSessionStore() {
  const raw = await readStoredAgentSession();

  if (!raw) {
    currentSession = null;
    notify();
    return null;
  }

  try {
    currentSession = JSON.parse(raw) as AgentSession;
  } catch {
    currentSession = null;
    await clearStoredAgentSession();
  }

  notify();
  return currentSession;
}

export async function setCurrentAgentSession(session: AgentSession) {
  currentSession = session;
  await writeStoredAgentSession(JSON.stringify(session));
  notify();
}

export async function updateCurrentAgentSessionUser(
  nextUser: Partial<AgentAuthUser> & { id?: string }
) {
  if (!currentSession) {
    return;
  }

  const mergedUser = {
    ...currentSession.user,
    ...nextUser,
  };

  if (JSON.stringify(mergedUser) === JSON.stringify(currentSession.user)) {
    return;
  }

  currentSession = {
    ...currentSession,
    user: mergedUser,
  };

  await writeStoredAgentSession(JSON.stringify(currentSession));
  notify();
}

export async function clearCurrentAgentSession() {
  currentSession = null;
  await clearStoredAgentSession();
  notify();
}

export function subscribeToAgentSession(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener(currentSession));
}
