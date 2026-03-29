import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'meterflow.agent.push-token';
let memoryPushToken: string | null = null;

export async function readStoredPushToken() {
  try {
    const value = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    memoryPushToken = value;
    return value;
  } catch {
    return memoryPushToken;
  }
}

export async function writeStoredPushToken(value: string) {
  memoryPushToken = value;

  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, value);
  } catch {
    // fallback in memory
  }
}

export async function clearStoredPushToken() {
  memoryPushToken = null;

  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // fallback in memory
  }
}
