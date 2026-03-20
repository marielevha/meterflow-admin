import { getAppSettings } from "@/lib/settings/serverSettings";
import { prisma } from "@/lib/prisma";
import { logInfo, logWarn } from "@/lib/observability/logger";

type ExpoPushData = Record<string, string | number | boolean | null>;

type SendPushPayload = {
  userId: string;
  title: string;
  body: string;
  data?: ExpoPushData;
};

type ExpoPushResponse = {
  data?: Array<{
    status?: "ok" | "error";
    id?: string;
    message?: string;
    details?: {
      error?: string;
      expoPushToken?: string;
    };
  }>;
};

function chunk<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function disableInvalidToken(token: string) {
  try {
    await prisma.mobilePushDevice.updateMany({
      where: { expoPushToken: token, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  } catch (error) {
    logWarn({
      event: "expo_push_disable_token_failed",
      expoPushToken: token,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

export async function sendPushNotificationToUser({
  userId,
  title,
  body,
  data = {},
}: SendPushPayload) {
  try {
    const settings = await getAppSettings();
    if (!settings.pushNotificationsEnabled) {
      return { sent: false, reason: "push_notifications_disabled" };
    }

    const devices = await prisma.mobilePushDevice.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        expoPushToken: true,
      },
    });

    if (devices.length === 0) {
      return { sent: false, reason: "no_registered_push_device" };
    }

    const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
    const messages = devices.map((device) => ({
      to: device.expoPushToken,
      sound: "default",
      title,
      body,
      data,
    }));

    for (const batch of chunk(messages, 100)) {
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(batch),
        });

        const payload = (await response.json().catch(() => null)) as ExpoPushResponse | null;

        if (!response.ok) {
          logWarn({
            event: "expo_push_batch_failed",
            userId,
            status: response.status,
            title,
          });
          continue;
        }

        payload?.data?.forEach((ticket, index) => {
          const token = batch[index]?.to;
          if (ticket.status === "ok") {
            logInfo({
              event: "expo_push_sent",
              userId,
              expoPushToken: token,
              title,
              providerMessageId: ticket.id,
            });
            return;
          }

          logWarn({
            event: "expo_push_rejected",
            userId,
            expoPushToken: token,
            error: ticket.details?.error || ticket.message || "unknown_push_error",
          });

          if (token && ticket.details?.error === "DeviceNotRegistered") {
            void disableInvalidToken(token);
          }
        });
      } catch (error) {
        logWarn({
          event: "expo_push_request_failed",
          userId,
          title,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    return { sent: true, reason: null };
  } catch (error) {
    logWarn({
      event: "expo_push_unavailable",
      userId,
      title,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return { sent: false, reason: "push_service_unavailable" };
  }
}
