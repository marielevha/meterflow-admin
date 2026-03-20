import { fetchAgentJson } from '@/lib/api/agent-client';

export type AgentProfileUser = {
  id: string;
  phone: string | null;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  region: string | null;
  city: string | null;
  zone: string | null;
  role: string;
  status: string;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentProfileSummary = {
  meterCount: number;
  readingCount: number;
};

export async function getAgentProfile() {
  return fetchAgentJson<{
    user: AgentProfileUser;
    summary: AgentProfileSummary;
  }>({
    path: '/api/v1/agent-mobile/me',
  });
}

export async function updateAgentProfile(payload: {
  firstName?: string | null;
  lastName?: string | null;
  region?: string | null;
  city?: string | null;
  zone?: string | null;
}) {
  return fetchAgentJson<{
    message: string;
    user: AgentProfileUser;
  }>({
    path: '/api/v1/agent-mobile/me',
    method: 'PATCH',
    body: payload,
  });
}

export async function changeAgentPassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  return fetchAgentJson<{
    message: string;
  }>({
    path: '/api/v1/agent-mobile/me/password',
    method: 'PATCH',
    body: payload,
  });
}
