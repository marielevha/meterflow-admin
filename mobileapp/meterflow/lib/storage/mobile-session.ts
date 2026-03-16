import AsyncStorage from '@react-native-async-storage/async-storage';

const MOBILE_SESSION_KEY = 'meterflow.mobile.session';
let memorySessionValue: string | null = null;

export async function readStoredMobileSession() {
  try {
    const value = await AsyncStorage.getItem(MOBILE_SESSION_KEY);
    memorySessionValue = value;
    return value;
  } catch {
    return memorySessionValue;
  }
}

export async function writeStoredMobileSession(value: string) {
  memorySessionValue = value;

  try {
    await AsyncStorage.setItem(MOBILE_SESSION_KEY, value);
  } catch {
    // Fallback in memory when native storage is not available yet.
  }
}

export async function clearStoredMobileSession() {
  memorySessionValue = null;

  try {
    await AsyncStorage.removeItem(MOBILE_SESSION_KEY);
  } catch {
    // Fallback in memory when native storage is not available yet.
  }
}
