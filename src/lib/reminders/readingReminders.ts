import {
  MeterStatus,
  Prisma,
  ReadingStatus,
  ReminderChannel,
  ReminderStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings/serverSettings";
import type { EmailApiProvider } from "@/lib/settings/appSettings";
import {
  getReminderWindowBounds,
  shouldTriggerReadingReminder,
} from "@/lib/settings/readingReminderWindow";

type TriggerChannelResult = {
  channel: ReminderChannel;
  status: ReminderStatus;
  reason: string | null;
  providerMessageId: string | null;
};

type ExecuteReminderJobOptions = {
  runAt?: Date;
  force?: boolean;
};

type ReminderJobResult = {
  triggerAt: string;
  forced: boolean;
  executed: boolean;
  reminderWindowKey: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  clientsEvaluated: number;
  eligibleClients: number;
  sent: number;
  failed: number;
  skipped: number;
  byChannel: Record<ReminderChannel, { sent: number; failed: number; skipped: number }>;
  message: string;
};

type EligibleClient = {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  pendingMeters: number;
  totalMeters: number;
};

function clampPositiveInt(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function formatWindowDate(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(date);
}

function buildReminderMessage(
  client: EligibleClient,
  windowStart: Date,
  windowEnd: Date,
  timeZone: string,
  companyName: string,
) {
  const customerName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
  const start = formatWindowDate(windowStart, timeZone);
  const end = formatWindowDate(windowEnd, timeZone);

  const body = [
    `Bonjour ${customerName},`,
    `il vous reste ${client.pendingMeters} compteur(s) a relever sur ${client.totalMeters}.`,
    `Fenetre de releve: ${start} au ${end}.`,
    `Merci de soumettre votre auto-releve dans l'application ${companyName}.`,
  ].join(" ");

  return {
    smsText: body,
    emailSubject: `Rappel auto-releve (${client.pendingMeters} compteur(s) restant(s))`,
    emailText: body,
    emailHtml: `<p>${body}</p>`,
    pushTitle: "Rappel auto-releve",
    pushBody: body,
  };
}

function toTwilioWhatsappAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

async function sendWhatsApp(to: string, text: string) {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase();
  if (provider !== "twilio") {
    return {
      status: ReminderStatus.SKIPPED,
      reason: provider
        ? `whatsapp_provider_not_supported:${provider}`
        : "whatsapp_provider_missing",
      providerMessageId: null,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const rawFrom = process.env.TWILIO_WHATSAPP_FROM?.trim() || process.env.TWILIO_FROM_PHONE?.trim();
  const fromPhone = rawFrom ? toTwilioWhatsappAddress(rawFrom) : "";
  const toPhone = toTwilioWhatsappAddress(to);

  if (!accountSid || !authToken || !fromPhone || !toPhone) {
    return {
      status: ReminderStatus.SKIPPED,
      reason: "twilio_whatsapp_not_configured",
      providerMessageId: null,
    };
  }

  try {
    const body = new URLSearchParams({
      To: toPhone,
      From: fromPhone,
      Body: text,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    const payload = (await response.json().catch(() => null)) as { sid?: string; message?: string } | null;

    if (!response.ok) {
      return {
        status: ReminderStatus.FAILED,
        reason: payload?.message || `twilio_whatsapp_http_${response.status}`,
        providerMessageId: null,
      };
    }

    return {
      status: ReminderStatus.SENT,
      reason: null,
      providerMessageId: payload?.sid || null,
    };
  } catch {
    return {
      status: ReminderStatus.FAILED,
      reason: "twilio_whatsapp_request_failed",
      providerMessageId: null,
    };
  }
}

function extractEmailAddress(fromValue: string) {
  const trimmed = fromValue.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim();
}

async function sendEmailViaResend(to: string, subject: string, text: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      status: ReminderStatus.SKIPPED,
      reason: "email_provider_not_configured",
      providerMessageId: null,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; message?: string; error?: { message?: string } }
      | null;

    if (!response.ok) {
      return {
        status: ReminderStatus.FAILED,
        reason: payload?.error?.message || payload?.message || `resend_http_${response.status}`,
        providerMessageId: null,
      };
    }

    return {
      status: ReminderStatus.SENT,
      reason: null,
      providerMessageId: payload?.id || null,
    };
  } catch {
    return {
      status: ReminderStatus.FAILED,
      reason: "resend_request_failed",
      providerMessageId: null,
    };
  }
}

async function sendEmailViaMailtrap(
  to: string,
  subject: string,
  text: string,
  html: string,
  companyName: string,
) {
  const apiKey = process.env.MAILTRAP_API_KEY?.trim();
  const from = process.env.REMINDER_EMAIL_FROM?.trim();
  const fromEmail = from ? extractEmailAddress(from) : "";

  if (!apiKey || !fromEmail) {
    return {
      status: ReminderStatus.SKIPPED,
      reason: "email_provider_not_configured",
      providerMessageId: null,
    };
  }

  try {
    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: fromEmail,
          name: companyName,
        },
        to: [{ email: to }],
        subject,
        text,
        html,
        category: "reading_reminder",
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { message_ids?: string[]; errors?: unknown; message?: string }
      | null;

    if (!response.ok) {
      return {
        status: ReminderStatus.FAILED,
        reason: payload?.message || `mailtrap_http_${response.status}`,
        providerMessageId: null,
      };
    }

    return {
      status: ReminderStatus.SENT,
      reason: null,
      providerMessageId: payload?.message_ids?.[0] || null,
    };
  } catch {
    return {
      status: ReminderStatus.FAILED,
      reason: "mailtrap_request_failed",
      providerMessageId: null,
    };
  }
}

async function sendEmail(
  provider: EmailApiProvider,
  to: string,
  subject: string,
  text: string,
  html: string,
  companyName: string,
) {
  if (provider === "MAILTRAP") {
    return sendEmailViaMailtrap(to, subject, text, html, companyName);
  }
  return sendEmailViaResend(to, subject, text, html);
}

async function sendPush(userId: string, title: string, body: string) {
  const webhookUrl = process.env.REMINDER_PUSH_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      status: ReminderStatus.SKIPPED,
      reason: "push_webhook_not_configured",
      providerMessageId: null,
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title,
        body,
        source: "reading_reminder",
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; messageId?: string; message?: string }
      | null;

    if (!response.ok) {
      return {
        status: ReminderStatus.FAILED,
        reason: payload?.message || `push_http_${response.status}`,
        providerMessageId: null,
      };
    }

    return {
      status: ReminderStatus.SENT,
      reason: null,
      providerMessageId: payload?.id || payload?.messageId || null,
    };
  } catch {
    return {
      status: ReminderStatus.FAILED,
      reason: "push_request_failed",
      providerMessageId: null,
    };
  }
}

async function countLogsForWindow(userId: string, channel: ReminderChannel, reminderWindowKey: string) {
  return prisma.readingReminderLog.count({
    where: {
      userId,
      channel,
      reminderWindowKey,
      deletedAt: null,
    },
  });
}

async function getLastLog(userId: string, channel: ReminderChannel) {
  return prisma.readingReminderLog.findFirst({
    where: {
      userId,
      channel,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
}

async function createLog(
  userId: string,
  result: TriggerChannelResult,
  windowStart: Date,
  windowEnd: Date,
  reminderWindowKey: string,
  pendingMeters: number,
  payload: Prisma.InputJsonObject,
) {
  await prisma.readingReminderLog.create({
    data: {
      userId,
      channel: result.channel,
      status: result.status,
      reason: result.reason,
      providerMessageId: result.providerMessageId,
      reminderWindowKey,
      windowStart,
      windowEnd,
      pendingMeters,
      payload,
    },
  });
}

export async function executeReadingRemindersJob(
  options: ExecuteReminderJobOptions = {},
): Promise<ReminderJobResult> {
  const settings = await getAppSettings();
  const runAt = options.runAt ?? new Date();
  const force = Boolean(options.force);

  const byChannel = {
    [ReminderChannel.SMS]: { sent: 0, failed: 0, skipped: 0 },
    [ReminderChannel.EMAIL]: { sent: 0, failed: 0, skipped: 0 },
    [ReminderChannel.PUSH]: { sent: 0, failed: 0, skipped: 0 },
  };

  if (!settings.readingReminderEnabled) {
    return {
      triggerAt: runAt.toISOString(),
      forced: force,
      executed: false,
      reminderWindowKey: null,
      windowStart: null,
      windowEnd: null,
      clientsEvaluated: 0,
      eligibleClients: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      byChannel,
      message: "reading_reminders_disabled",
    };
  }

  if (!force && !shouldTriggerReadingReminder(runAt, settings)) {
    return {
      triggerAt: runAt.toISOString(),
      forced: force,
      executed: false,
      reminderWindowKey: null,
      windowStart: null,
      windowEnd: null,
      clientsEvaluated: 0,
      eligibleClients: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      byChannel,
      message: "outside_trigger_slot",
    };
  }

  const { windowStart, windowEnd, reminderWindowKey } = getReminderWindowBounds(runAt, settings);

  const clients = await prisma.user.findMany({
    where: {
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      customerMeters: {
        some: {
          deletedAt: null,
          status: MeterStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
      customerMeters: {
        where: {
          deletedAt: null,
          status: MeterStatus.ACTIVE,
        },
        select: {
          id: true,
          readings: {
            where: {
              deletedAt: null,
              readingAt: {
                gte: windowStart,
                lte: windowEnd,
              },
              status: {
                not: ReadingStatus.DRAFT,
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  const eligibleClients: EligibleClient[] = clients
    .map((client) => {
      const totalMeters = client.customerMeters.length;
      const pendingMeters = client.customerMeters.filter((meter) => meter.readings.length === 0).length;
      return {
        id: client.id,
        phone: client.phone,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        pendingMeters,
        totalMeters,
      };
    })
    .filter((client) => client.totalMeters > 0 && client.pendingMeters > 0);

  const minIntervalHours = clampPositiveInt(settings.readingReminderMinIntervalHours, 24);
  const maxPerWindow = clampPositiveInt(settings.readingReminderMaxPerWindow, 3);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const client of eligibleClients) {
    const channels: ReminderChannel[] = [];

    if (settings.readingReminderUseWhatsapp && settings.whatsappNotificationsEnabled && client.phone) {
      channels.push(ReminderChannel.SMS);
    }
    if (settings.readingReminderUseEmail && settings.emailNotificationsEnabled && client.email) {
      channels.push(ReminderChannel.EMAIL);
    }
    if (settings.readingReminderUsePush && settings.pushNotificationsEnabled) {
      channels.push(ReminderChannel.PUSH);
    }

    const message = buildReminderMessage(
      client,
      windowStart,
      windowEnd,
      settings.readingReminderTimezone || "UTC",
      settings.companyName || "MeterFlow",
    );

    for (const channel of channels) {
      const countInWindow = await countLogsForWindow(client.id, channel, reminderWindowKey);
      if (countInWindow >= maxPerWindow) {
        const result: TriggerChannelResult = {
          channel,
          status: ReminderStatus.SKIPPED,
          reason: "max_per_window_reached",
          providerMessageId: null,
        };
        await createLog(client.id, result, windowStart, windowEnd, reminderWindowKey, client.pendingMeters, {
          runAt: runAt.toISOString(),
          totalMeters: client.totalMeters,
          pendingMeters: client.pendingMeters,
          minIntervalHours,
          maxPerWindow,
        });
        skipped += 1;
        byChannel[channel].skipped += 1;
        continue;
      }

      const lastLog = await getLastLog(client.id, channel);
      if (lastLog) {
        const elapsedMs = runAt.getTime() - lastLog.createdAt.getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        if (elapsedHours < minIntervalHours) {
          const result: TriggerChannelResult = {
            channel,
            status: ReminderStatus.SKIPPED,
            reason: "min_interval_not_elapsed",
            providerMessageId: null,
          };
          await createLog(client.id, result, windowStart, windowEnd, reminderWindowKey, client.pendingMeters, {
            runAt: runAt.toISOString(),
            totalMeters: client.totalMeters,
            pendingMeters: client.pendingMeters,
            minIntervalHours,
            elapsedHours,
          });
          skipped += 1;
          byChannel[channel].skipped += 1;
          continue;
        }
      }

      let sendResult: { status: ReminderStatus; reason: string | null; providerMessageId: string | null };

      if (channel === ReminderChannel.SMS) {
        sendResult = await sendWhatsApp(client.phone, message.smsText);
      } else if (channel === ReminderChannel.EMAIL) {
        if (!client.email) {
          sendResult = {
            status: ReminderStatus.SKIPPED,
            reason: "missing_email",
            providerMessageId: null,
          };
        } else {
          sendResult = await sendEmail(
            settings.emailApiProvider,
            client.email,
            message.emailSubject,
            message.emailText,
            message.emailHtml,
            settings.companyName || "MeterFlow",
          );
        }
      } else {
        sendResult = await sendPush(client.id, message.pushTitle, message.pushBody);
      }

      const result: TriggerChannelResult = {
        channel,
        status: sendResult.status,
        reason: sendResult.reason,
        providerMessageId: sendResult.providerMessageId,
      };

      await createLog(client.id, result, windowStart, windowEnd, reminderWindowKey, client.pendingMeters, {
        runAt: runAt.toISOString(),
        totalMeters: client.totalMeters,
        pendingMeters: client.pendingMeters,
      });

      if (sendResult.status === ReminderStatus.SENT) {
        sent += 1;
        byChannel[channel].sent += 1;
      } else if (sendResult.status === ReminderStatus.FAILED) {
        failed += 1;
        byChannel[channel].failed += 1;
      } else {
        skipped += 1;
        byChannel[channel].skipped += 1;
      }
    }
  }

  return {
    triggerAt: runAt.toISOString(),
    forced: force,
    executed: true,
    reminderWindowKey,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    clientsEvaluated: clients.length,
    eligibleClients: eligibleClients.length,
    sent,
    failed,
    skipped,
    byChannel,
    message: "reading_reminders_executed",
  };
}
