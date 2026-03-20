import AsyncStorage from '@react-native-async-storage/async-storage';

export type AgentProfile = {
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISABLED';
  team: string;
  zone: string;
  region: string;
  city: string;
  email: string;
  phone: string;
  badgeId: string;
  joinedAt: string;
  activatedAt: string;
  updatedAt: string;
  assignedCount: number;
  closedCount: number;
};

const AGENT_PROFILE_KEY = 'agentapp.profile';

const DEFAULT_AGENT_PROFILE: AgentProfile = {
  firstName: 'Merveille',
  lastName: 'Ngoma',
  username: 'agent.ngoma',
  role: 'Agent terrain',
  status: 'ACTIVE',
  team: 'Equipe Centre',
  zone: 'Bacongo',
  region: 'Brazzaville',
  city: 'Brazzaville',
  email: 'agent@agentflow.local',
  phone: '+242 06 000 00 12',
  badgeId: 'AGT-204',
  joinedAt: '2025-11-12T09:00:00.000Z',
  activatedAt: '2025-11-12T09:00:00.000Z',
  updatedAt: '2026-03-20T09:00:00.000Z',
  assignedCount: 12,
  closedCount: 8,
};

let memoryProfile: AgentProfile = { ...DEFAULT_AGENT_PROFILE };

export async function readStoredAgentProfile() {
  try {
    const raw = await AsyncStorage.getItem(AGENT_PROFILE_KEY);
    if (!raw) {
      memoryProfile = { ...DEFAULT_AGENT_PROFILE };
      return memoryProfile;
    }

    const parsed = JSON.parse(raw) as Partial<AgentProfile>;
    memoryProfile = { ...DEFAULT_AGENT_PROFILE, ...parsed };
    return memoryProfile;
  } catch {
    return memoryProfile;
  }
}

export async function writeStoredAgentProfile(profile: AgentProfile) {
  memoryProfile = profile;

  try {
    await AsyncStorage.setItem(AGENT_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Fallback in memory.
  }
}
