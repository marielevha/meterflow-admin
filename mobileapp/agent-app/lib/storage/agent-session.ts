import AsyncStorage from '@react-native-async-storage/async-storage';

const AGENT_SESSION_KEY = 'agentflow.mobile.session';
let memorySessionValue: string | null = null;

export async function readStoredAgentSession() {
  try {
    const value = await AsyncStorage.getItem(AGENT_SESSION_KEY);
    memorySessionValue = value;
    return value;
  } catch {
    return memorySessionValue;
  }
}

export async function writeStoredAgentSession(value: string) {
  memorySessionValue = value;

  try {
    await AsyncStorage.setItem(AGENT_SESSION_KEY, value);
  } catch {
    // Fallback to memory when native storage is not available yet.
  }
}

export async function clearStoredAgentSession() {
  memorySessionValue = null;

  try {
    await AsyncStorage.removeItem(AGENT_SESSION_KEY);
  } catch {
    // Fallback to memory when native storage is not available yet.
  }
}
