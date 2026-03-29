import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { fetchAgentJson } from '@/lib/api/agent-client';
import {
  clearStoredPushToken,
  readStoredPushToken,
  writeStoredPushToken,
} from '@/lib/storage/push-token';

type RegisterPayload = {
  expoPushToken: string;
  platform: string;
  appVersion?: string | null;
};

function getProjectId() {
  const easProjectId =
    Constants.easConfig?.projectId ??
    ((Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? null) ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    null;

  return typeof easProjectId === 'string' && easProjectId.trim() ? easProjectId.trim() : null;
}

export async function requestExpoPushToken() {
  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[agent-push] notification_permission_denied');
    return { token: null, granted: false, status: finalStatus };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = getProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  console.log('[agent-push] expo_push_token_obtained', {
    projectId: projectId ?? null,
    tokenPreview: `${tokenResponse.data.slice(0, 18)}...`,
  });

  return { token: tokenResponse.data, granted: true, status: finalStatus };
}

export async function registerAgentPushToken(payload: RegisterPayload) {
  console.log('[agent-push] register_request', {
    platform: payload.platform,
    appVersion: payload.appVersion ?? null,
    tokenPreview: `${payload.expoPushToken.slice(0, 18)}...`,
  });

  await fetchAgentJson<{ message: string }>({
    path: '/api/v1/agent-mobile/push/register',
    method: 'POST',
    body: payload,
  });

  console.log('[agent-push] register_success');
  await writeStoredPushToken(payload.expoPushToken);
}

export async function unregisterStoredAgentPushToken() {
  const token = await readStoredPushToken();
  if (!token) return;

  try {
    await fetchAgentJson<{ message: string }>({
      path: '/api/v1/agent-mobile/push/unregister',
      method: 'POST',
      body: { expoPushToken: token },
    });
  } finally {
    await clearStoredPushToken();
  }
}

export function getAgentAppVersion() {
  return Constants.expoConfig?.version ?? null;
}
