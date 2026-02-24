"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DeliveryChannel, PaymentMethod } from "@prisma/client";
import {
  cancelInvoice,
  createBillingCampaign,
  createTariffPlan,
  generateCampaignInvoices,
  issueCampaignInvoices,
  issueInvoice,
  registerInvoicePayment,
  triggerInvoiceDelivery,
  updateTariffPlan,
} from "@/lib/backoffice/billing";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireStaff(pathOnFail: string) {
  const user = await getCurrentStaffFromServerAction();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(pathOnFail)}`);
  }
  return user;
}

export async function createTariffPlanAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/tariffs");

  const tiersRaw = asString(formData.get("tiers"));
  const parsedTiers = tiersRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [min, max, price] = line.split(",").map((x) => x.trim());
      return {
        minConsumption: Number(min),
        maxConsumption: max ? Number(max) : null,
        unitPrice: Number(price),
      };
    });

  const result = await createTariffPlan(
    { id: user.id, role: user.role },
    {
      code: asString(formData.get("code")),
      name: asString(formData.get("name")),
      description: asString(formData.get("description")),
      currency: asString(formData.get("currency")),
      fixedCharge: asNumber(formData.get("fixedCharge")),
      taxPercent: asNumber(formData.get("taxPercent")),
      lateFeePercent: asNumber(formData.get("lateFeePercent")),
      isDefault: asString(formData.get("isDefault")) === "on",
      tiers: parsedTiers,
    }
  );

  revalidatePath("/admin/billing/tariffs");
  if (result.status >= 400) {
    redirect(`/admin/billing/tariffs?error=${encodeURIComponent((result.body as { error?: string }).error || "create_failed")}`);
  }
  redirect("/admin/billing/tariffs?success=plan_created");
}

export async function toggleTariffPlanAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/tariffs");
  const planId = asString(formData.get("planId"));
  const nextActive = asString(formData.get("nextActive")) === "true";
  if (!planId) redirect("/admin/billing/tariffs?error=missing_plan_id");

  const result = await updateTariffPlan(
    { id: user.id, role: user.role },
    planId,
    { isActive: nextActive }
  );

  revalidatePath("/admin/billing/tariffs");
  if (result.status >= 400) {
    redirect(`/admin/billing/tariffs?error=${encodeURIComponent((result.body as { error?: string }).error || "update_failed")}`);
  }
  redirect("/admin/billing/tariffs?success=plan_updated");
}

export async function createBillingCampaignAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/campaigns");
  const result = await createBillingCampaign(
    { id: user.id, role: user.role },
    {
      code: asString(formData.get("code")),
      name: asString(formData.get("name")),
      periodStart: asString(formData.get("periodStart")),
      periodEnd: asString(formData.get("periodEnd")),
      submissionStartAt: asString(formData.get("submissionStartAt")),
      submissionEndAt: asString(formData.get("submissionEndAt")),
      cutoffAt: asString(formData.get("cutoffAt")),
      frequency: asString(formData.get("frequency")),
      city: asString(formData.get("city")),
      zone: asString(formData.get("zone")),
      tariffPlanId: asString(formData.get("tariffPlanId")),
      notes: asString(formData.get("notes")),
    }
  );

  revalidatePath("/admin/billing/campaigns");
  if (result.status >= 400) {
    redirect(`/admin/billing/campaigns?error=${encodeURIComponent((result.body as { error?: string }).error || "create_failed")}`);
  }
  redirect("/admin/billing/campaigns?success=campaign_created");
}

export async function generateCampaignInvoicesAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/campaigns");
  const campaignId = asString(formData.get("campaignId"));
  if (!campaignId) redirect("/admin/billing/campaigns?error=missing_campaign_id");

  const result = await generateCampaignInvoices({ id: user.id, role: user.role }, campaignId);
  revalidatePath("/admin/billing/campaigns");
  revalidatePath("/admin/billing/invoices");
  if (result.status >= 400) {
    redirect(`/admin/billing/campaigns?error=${encodeURIComponent((result.body as { error?: string }).error || "generate_failed")}`);
  }
  redirect("/admin/billing/campaigns?success=invoices_generated");
}

export async function issueCampaignInvoicesAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/campaigns");
  const campaignId = asString(formData.get("campaignId"));
  if (!campaignId) redirect("/admin/billing/campaigns?error=missing_campaign_id");

  const result = await issueCampaignInvoices({ id: user.id, role: user.role }, campaignId);
  revalidatePath("/admin/billing/campaigns");
  revalidatePath("/admin/billing/invoices");
  if (result.status >= 400) {
    redirect(`/admin/billing/campaigns?error=${encodeURIComponent((result.body as { error?: string }).error || "issue_failed")}`);
  }
  redirect("/admin/billing/campaigns?success=invoices_issued");
}

export async function issueInvoiceAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/invoices");
  const invoiceId = asString(formData.get("invoiceId"));
  if (!invoiceId) redirect("/admin/billing/invoices?error=missing_invoice_id");

  const result = await issueInvoice({ id: user.id, role: user.role }, invoiceId);
  revalidatePath("/admin/billing/invoices");
  revalidatePath(`/admin/billing/invoices/${invoiceId}`);
  if (result.status >= 400) {
    redirect(`/admin/billing/invoices?error=${encodeURIComponent((result.body as { error?: string }).error || "issue_failed")}`);
  }
  redirect("/admin/billing/invoices?success=invoice_issued");
}

export async function cancelInvoiceAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/invoices");
  const invoiceId = asString(formData.get("invoiceId"));
  const reason = asString(formData.get("reason"));
  if (!invoiceId) redirect("/admin/billing/invoices?error=missing_invoice_id");

  const result = await cancelInvoice({ id: user.id, role: user.role }, invoiceId, reason);
  revalidatePath("/admin/billing/invoices");
  revalidatePath(`/admin/billing/invoices/${invoiceId}`);
  if (result.status >= 400) {
    redirect(`/admin/billing/invoices?error=${encodeURIComponent((result.body as { error?: string }).error || "cancel_failed")}`);
  }
  redirect("/admin/billing/invoices?success=invoice_canceled");
}

export async function registerInvoicePaymentAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/invoices");
  const invoiceId = asString(formData.get("invoiceId"));
  if (!invoiceId) redirect("/admin/billing/invoices?error=missing_invoice_id");

  const methodCandidate = asString(formData.get("method"));
  const method = Object.values(PaymentMethod).includes(methodCandidate as PaymentMethod)
    ? (methodCandidate as PaymentMethod)
    : PaymentMethod.CASH;

  const result = await registerInvoicePayment(
    { id: user.id, role: user.role },
    invoiceId,
    {
      amount: asNumber(formData.get("amount")),
      method,
      reference: asString(formData.get("reference")),
      paidAt: asString(formData.get("paidAt")),
    }
  );

  revalidatePath("/admin/billing/invoices");
  revalidatePath(`/admin/billing/invoices/${invoiceId}`);
  if (result.status >= 400) {
    redirect(`/admin/billing/invoices/${invoiceId}?error=${encodeURIComponent((result.body as { error?: string }).error || "payment_failed")}`);
  }
  redirect(`/admin/billing/invoices/${invoiceId}?success=payment_registered`);
}

export async function triggerInvoiceDeliveryAction(formData: FormData) {
  const user = await requireStaff("/admin/billing/invoices");
  const invoiceId = asString(formData.get("invoiceId"));
  if (!invoiceId) redirect("/admin/billing/invoices?error=missing_invoice_id");

  const channelCandidate = asString(formData.get("channel"));
  const channel = Object.values(DeliveryChannel).includes(channelCandidate as DeliveryChannel)
    ? (channelCandidate as DeliveryChannel)
    : DeliveryChannel.PORTAL;

  const result = await triggerInvoiceDelivery(
    { id: user.id, role: user.role },
    invoiceId,
    {
      channel,
      recipient: asString(formData.get("recipient")),
    }
  );

  revalidatePath("/admin/billing/invoices");
  revalidatePath(`/admin/billing/invoices/${invoiceId}`);
  if (result.status >= 400) {
    redirect(`/admin/billing/invoices/${invoiceId}?error=${encodeURIComponent((result.body as { error?: string }).error || "delivery_failed")}`);
  }
  redirect(`/admin/billing/invoices/${invoiceId}?success=delivery_recorded`);
}
