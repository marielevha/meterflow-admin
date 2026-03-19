import { prisma } from "@/lib/prisma";
import { logInfo, logWarn } from "@/lib/observability/logger";

type RegisterPushDevicePayload = {
  expoPushToken?: string;
  platform?: string;
  appVersion?: string | null;
};

function toTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isValidExpoPushToken(value: string) {
  return /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(value);
}

export async function registerMobilePushDevice(
  userId: string,
  payload: RegisterPushDevicePayload
) {
  const expoPushToken = toTrimmedString(payload.expoPushToken);
  const platform = toTrimmedString(payload.platform) || "unknown";
  const appVersion = toTrimmedString(payload.appVersion);

  if (!expoPushToken) {
    logWarn({ event: "mobile_push_register_rejected", userId, error: "expo_push_token_required" });
    return { status: 400, body: { error: "expo_push_token_required" } };
  }

  if (!isValidExpoPushToken(expoPushToken)) {
    logWarn({ event: "mobile_push_register_rejected", userId, error: "invalid_expo_push_token" });
    return { status: 400, body: { error: "invalid_expo_push_token" } };
  }

  await prisma.mobilePushDevice.upsert({
    where: { expoPushToken },
    create: {
      userId,
      expoPushToken,
      platform,
      appVersion,
      lastSeenAt: new Date(),
    },
    update: {
      userId,
      platform,
      appVersion,
      lastSeenAt: new Date(),
      deletedAt: null,
    },
  });

  logInfo({
    event: "mobile_push_device_registered",
    userId,
    expoPushToken,
    platform,
    appVersion: appVersion ?? null,
  });

  return { status: 200, body: { message: "push_device_registered" } };
}

export async function unregisterMobilePushDevice(
  userId: string,
  payload: RegisterPushDevicePayload
) {
  const expoPushToken = toTrimmedString(payload.expoPushToken);

  if (!expoPushToken) {
    logWarn({ event: "mobile_push_unregister_rejected", userId, error: "expo_push_token_required" });
    return { status: 400, body: { error: "expo_push_token_required" } };
  }

  await prisma.mobilePushDevice.updateMany({
    where: {
      userId,
      expoPushToken,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  logInfo({
    event: "mobile_push_device_unregistered",
    userId,
    expoPushToken,
  });

  return { status: 200, body: { message: "push_device_unregistered" } };
}
