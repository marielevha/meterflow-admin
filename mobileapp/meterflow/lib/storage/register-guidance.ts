import AsyncStorage from '@react-native-async-storage/async-storage';

const REGISTER_GUIDANCE_SEEN_KEY = 'meterflow.register.guidance.seen';
let memoryRegisterGuidanceSeen = false;

export async function shouldShowRegisterGuidance() {
  try {
    const value = await AsyncStorage.getItem(REGISTER_GUIDANCE_SEEN_KEY);
    if (value === 'true') {
      memoryRegisterGuidanceSeen = true;
      return false;
    }

    return !memoryRegisterGuidanceSeen;
  } catch {
    return !memoryRegisterGuidanceSeen;
  }
}

export async function markRegisterGuidanceSeen() {
  memoryRegisterGuidanceSeen = true;

  try {
    await AsyncStorage.setItem(REGISTER_GUIDANCE_SEEN_KEY, 'true');
  } catch {
    // Keep memory fallback when native storage is unavailable.
  }
}
