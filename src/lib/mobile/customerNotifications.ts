import { InvoiceStatus, MeterAssignmentSource, Prisma, ReadingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getClientReadingDecisionMessage,
  getClientReadingDecisionTitle,
  getReadingStatusLabel,
  getReviewReasonLabel,
} from "@/lib/readings/reviewReasons";
import { sendPushNotificationToUser } from "@/lib/notifications/expoPush";

type NotificationDbClient = Prisma.TransactionClient | typeof prisma;

type CustomerNotificationRecord = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  actionPath: string | null;
  metadata: Prisma.JsonValue | null;
};

type CreateCustomerNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionPath?: string | null;
  metadata?: Prisma.InputJsonValue;
  readAt?: Date | null;
  createdAt?: Date;
};

type ReadingDecisionInput = {
  userId: string;
  readingId: string;
  meterId?: string | null;
  meterSerialNumber: string;
  status: ReadingStatus;
  reasonCode?: string | null;
  createdAt?: Date;
};

type InvoiceNotificationInput = {
  userId: string;
  invoiceId: string;
  invoiceNumber: string;
  meterId?: string | null;
  meterSerialNumber?: string | null;
  amount?: number | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  dueDate?: Date | null;
  channel?: string | null;
  paymentMethod?: string | null;
  cancelReason?: string | null;
  nextStatus?: InvoiceStatus | null;
  createdAt?: Date;
};

type MeterAssignmentNotificationInput = {
  userId: string;
  meterId: string;
  meterSerialNumber: string;
  source: MeterAssignmentSource | string;
  createdAt?: Date;
};

type ReadingReminderNotificationInput = {
  userId: string;
  title: string;
  body: string;
  pendingMeters: number;
  windowStart: Date;
  windowEnd: Date;
  channel?: string | null;
  createdAt?: Date;
  readAt?: Date | null;
};

function toDecimalNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function toJsonObject<T extends Record<string, unknown>>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createCustomerNotification(
  db: NotificationDbClient,
  input: CreateCustomerNotificationInput
) {
  return db.customerNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionPath: input.actionPath ?? null,
      metadata: input.metadata ?? {},
      readAt: input.readAt ?? null,
      ...(input.createdAt
        ? {
            createdAt: input.createdAt,
          }
        : {}),
    },
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      body: true,
      actionPath: true,
      metadata: true,
    },
  });
}

export async function pushCustomerNotification(notification: CustomerNotificationRecord) {
  try {
    const metadata =
      notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
        ? (notification.metadata as Record<string, unknown>)
        : {};

    const data = Object.fromEntries(
      Object.entries({
        notificationId: notification.id,
        type: notification.type,
        actionPath: notification.actionPath ?? null,
        ...metadata,
      }).filter(([, value]) =>
        value === null ||
        ["string", "number", "boolean"].includes(typeof value)
      )
    ) as Record<string, string | number | boolean | null>;

    return await sendPushNotificationToUser({
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      data,
    });
  } catch {
    // best effort: the in-app notification remains available even if push delivery fails
    return { sent: false, reason: "push_service_unavailable" };
  }
}

export async function createAndPushCustomerNotification(input: CreateCustomerNotificationInput) {
  const notification = await createCustomerNotification(prisma, input);
  await pushCustomerNotification(notification);
  return notification;
}

export function buildReadingDecisionNotification(input: ReadingDecisionInput): CreateCustomerNotificationInput {
  const reasonCode = input.reasonCode ?? null;
  const title =
    getClientReadingDecisionTitle(input.status, reasonCode) ||
    getReadingStatusLabel(input.status) ||
    "Mise à jour de relevé";
  const body =
    getClientReadingDecisionMessage(input.status, reasonCode, input.meterSerialNumber) ||
    "Une mise à jour est disponible pour votre relevé.";

  return {
    userId: input.userId,
    type: `READING_${input.status}`,
    title,
    body,
    actionPath: `/readings/${input.readingId}`,
    createdAt: input.createdAt,
    metadata: toJsonObject({
      category: "READING",
      readingId: input.readingId,
      meterId: input.meterId ?? null,
      meterSerialNumber: input.meterSerialNumber,
      status: input.status,
      statusLabel: getReadingStatusLabel(input.status),
      reasonCode,
      reasonLabel: getReviewReasonLabel(reasonCode),
    }),
  };
}

export function buildInvoiceIssuedNotification(input: InvoiceNotificationInput): CreateCustomerNotificationInput {
  const formattedAmount = formatCurrency(input.amount ?? input.totalAmount ?? null);
  const formattedDueDate = formatDate(input.dueDate);
  const amountPart = formattedAmount ? ` Montant: ${formattedAmount}.` : "";
  const duePart = formattedDueDate ? ` Échéance: ${formattedDueDate}.` : "";

  return {
    userId: input.userId,
    type: "INVOICE_ISSUED",
    title: "Nouvelle facture disponible",
    body:
      `Votre facture ${input.invoiceNumber}` +
      (input.meterSerialNumber ? ` pour le compteur ${input.meterSerialNumber}` : "") +
      ` est disponible.${amountPart}${duePart}`,
    actionPath: "/notifications",
    createdAt: input.createdAt,
    metadata: toJsonObject({
      category: "BILLING",
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      meterId: input.meterId ?? null,
      meterSerialNumber: input.meterSerialNumber ?? null,
      status: InvoiceStatus.ISSUED,
      statusLabel: "Émise",
      amount: input.amount ?? input.totalAmount ?? null,
      totalAmount: input.totalAmount ?? input.amount ?? null,
      dueDate: input.dueDate?.toISOString() ?? null,
    }),
  };
}

export function buildInvoiceDeliveryNotification(input: InvoiceNotificationInput): CreateCustomerNotificationInput {
  const channelPart = input.channel ? ` via ${input.channel.toLowerCase()}` : "";

  return {
    userId: input.userId,
    type: "INVOICE_DELIVERED",
    title: "Facture envoyée",
    body: `Votre facture ${input.invoiceNumber} a été envoyée${channelPart}.`,
    actionPath: "/notifications",
    createdAt: input.createdAt,
    metadata: toJsonObject({
      category: "BILLING",
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      meterId: input.meterId ?? null,
      meterSerialNumber: input.meterSerialNumber ?? null,
      status: input.nextStatus ?? InvoiceStatus.DELIVERED,
      statusLabel: "Diffusée",
      channel: input.channel ?? null,
    }),
  };
}

export function buildInvoicePaymentNotification(input: InvoiceNotificationInput): CreateCustomerNotificationInput {
  const amount = input.amount ?? null;
  const totalAmount = input.totalAmount ?? null;
  const paidAmount = input.paidAmount ?? null;
  const remainingAmount =
    totalAmount !== null && paidAmount !== null ? Math.max(0, totalAmount - paidAmount) : null;
  const formattedAmount = formatCurrency(amount);
  const formattedRemaining = formatCurrency(remainingAmount);
  const isPaid = input.nextStatus === InvoiceStatus.PAID;

  return {
    userId: input.userId,
    type: isPaid ? "INVOICE_PAID" : "INVOICE_PAYMENT_REGISTERED",
    title: isPaid ? "Facture soldée" : "Paiement enregistré",
    body:
      `Un paiement${formattedAmount ? ` de ${formattedAmount}` : ""} a été enregistré sur votre facture ${input.invoiceNumber}.` +
      (isPaid
        ? " Votre facture est entièrement réglée."
        : formattedRemaining
          ? ` Reste à payer: ${formattedRemaining}.`
          : ""),
    actionPath: "/notifications",
    createdAt: input.createdAt,
    metadata: toJsonObject({
      category: "BILLING",
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      meterId: input.meterId ?? null,
      meterSerialNumber: input.meterSerialNumber ?? null,
      status: input.nextStatus ?? null,
      statusLabel:
        input.nextStatus === InvoiceStatus.PAID
          ? "Payée"
          : input.nextStatus === InvoiceStatus.PARTIALLY_PAID
            ? "Partiellement payée"
            : "Paiement enregistré",
      amount,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentMethod: input.paymentMethod ?? null,
    }),
  };
}

export function buildInvoiceCanceledNotification(input: InvoiceNotificationInput): CreateCustomerNotificationInput {
  return {
    userId: input.userId,
    type: "INVOICE_CANCELED",
    title: "Facture annulée",
    body:
      `Votre facture ${input.invoiceNumber} a été annulée.` +
      (input.cancelReason ? ` Motif: ${input.cancelReason}.` : ""),
    actionPath: "/notifications",
    createdAt: input.createdAt,
    metadata: toJsonObject({
      category: "BILLING",
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      meterId: input.meterId ?? null,
      meterSerialNumber: input.meterSerialNumber ?? null,
      status: InvoiceStatus.CANCELED,
      statusLabel: "Annulée",
      cancelReason: input.cancelReason ?? null,
    }),
  };
}

export function buildMeterAssignedNotification(
  input: MeterAssignmentNotificationInput
): CreateCustomerNotificationInput {
  return {
    userId: input.userId,
    type: "METER_ASSIGNED",
    title: "Compteur ajouté à votre espace",
    body:
      `Le compteur ${input.meterSerialNumber} est maintenant lié à votre compte.` +
      (input.source === MeterAssignmentSource.IMPORT ? " Il a été importé dans votre espace client." : ""),
    actionPath: "/meters",
    createdAt: input.createdAt,
    metadata: toJsonObject({
      category: "METER",
      meterId: input.meterId,
      meterSerialNumber: input.meterSerialNumber,
      assignmentSource: input.source,
      statusLabel: "Compteur lié",
    }),
  };
}

export function buildMeterUnassignedNotification(
  input: MeterAssignmentNotificationInput
): CreateCustomerNotificationInput {
  return {
    userId: input.userId,
    type: "METER_UNASSIGNED",
    title: "Compteur retiré de votre espace",
    body: `Le compteur ${input.meterSerialNumber} n'est plus rattaché à votre espace client.`,
    actionPath: "/meters",
    createdAt: input.createdAt,
    metadata: toJsonObject({
      category: "METER",
      meterId: input.meterId,
      meterSerialNumber: input.meterSerialNumber,
      assignmentSource: input.source,
      statusLabel: "Compteur retiré",
    }),
  };
}

export function buildReadingReminderNotification(
  input: ReadingReminderNotificationInput
): CreateCustomerNotificationInput {
  return {
    userId: input.userId,
    type: "READING_REMINDER",
    title: input.title,
    body: input.body,
    actionPath: "/readings",
    createdAt: input.createdAt,
    readAt: input.readAt ?? null,
    metadata: toJsonObject({
      category: "REMINDER",
      pendingMeters: input.pendingMeters,
      windowStart: input.windowStart.toISOString(),
      windowEnd: input.windowEnd.toISOString(),
      channel: input.channel ?? null,
      statusLabel: "Rappel",
    }),
  };
}

export function decimalLikeToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return toDecimalNumber(value);
}
