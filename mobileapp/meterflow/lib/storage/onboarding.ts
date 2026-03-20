import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_DONE_KEY = 'meterflow.onboarding.done';
let memoryOnboardingCompleted = false;

export async function getOnboardingCompleted() {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
    if (value === 'true') {
      memoryOnboardingCompleted = true;
      return true;
    }

    return memoryOnboardingCompleted;
  } catch {
    return memoryOnboardingCompleted;
  }
}

export async function setOnboardingCompleted() {
  memoryOnboardingCompleted = true;

  try {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
  } catch {
    // Fallback in memory when the native module is not available yet.
  }
}

export async function resetOnboardingCompleted() {
  memoryOnboardingCompleted = false;

  try {
    await AsyncStorage.removeItem(ONBOARDING_DONE_KEY);
  } catch {
    // Fallback in memory when the native module is not available yet.
  }
}
