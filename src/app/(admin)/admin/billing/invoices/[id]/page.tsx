import { Metadata } from "next";
import Link from "next/link";
import { DeliveryChannel, PaymentMethod } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import {
  translateContractPhaseType,
  translateContractPowerUnit,
  translateContractUsageCategory,
  translateDeliveryChannel,
  translateInvoiceStatus,
  translatePaymentMethod,
  translateTariffBillingMode,
} from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";
import { getInvoiceDetail } from "@/lib/backoffice/billing";
import {
  registerInvoicePaymentAction,
  triggerInvoiceDeliveryAction,
} from "@/app/(admin)/admin/billing/actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Invoice Detail",
  description: "Invoice details and operations",
};

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

export default async function BillingInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const staff = await requireAdminPermissions(
    "/admin/billing/invoices",
    ADMIN_PERMISSION_GROUPS.billingInvoicesView
  );
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canRegisterInvoicePayments = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.billingInvoicePaymentCreate
  );
  const canRegisterInvoiceDeliveries = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.billingInvoiceDeliveryCreate
  );
  const { t } = await getAdminTranslator();
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const error = firstValue(resolvedSearch.error);
  const success = firstValue(resolvedSearch.success);

  let result: Awaited<ReturnType<typeof getInvoiceDetail>>;
  try {
    result = await getInvoiceDetail(id);
  } catch (error) {
    const errorState = getBillingPageErrorState(error, "billing.invoice_detail");
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.invoiceDetailPageTitle")} />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }
  if (result.status !== 200) {
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.invoiceDetailPageTitle")} />
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          {t("billing.invoiceNotFound")}
        </div>
      </div>
    );
  }

  const invoice = (result.body as { invoice: any }).invoice;
  const customer =
    [invoice.customer.firstName, invoice.customer.lastName].filter(Boolean).join(" ").trim() ||
    invoice.customer.username ||
    invoice.customer.phone;

  return (
    <div>
      <PageBreadcrumb pageTitle={t("billing.invoiceDetailPageTitle")} />

      {error ? (
        <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">{t("common.error")}: {error}</div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">{t("common.success")}: {success}</div>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{invoice.invoiceNumber}</h2>
        <Link href="/admin/billing/invoices" className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">{t("billing.backToInvoices")}</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-6">
          <ComponentCard title={t("billing.invoiceSummaryTitle")} desc={t("billing.invoiceSummaryDesc")}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t("billing.customerColumn")} value={customer} />
              <Field label={t("billing.phoneLabel")} value={invoice.customer.phone} />
              <Field label={t("billing.meterColumn")} value={invoice.meter.serialNumber} />
              <Field label={t("billing.locationLabel")} value={`${invoice.meter.city || "-"} / ${invoice.meter.zone || "-"}`} />
              <Field label={t("common.status")} value={translateInvoiceStatus(invoice.status, t)} />
              <Field label={t("billing.campaignLabel")} value={invoice.campaign?.code || t("billing.notAvailableShort")} />
              <Field label={t("billing.contractNumberLabel")} value={invoice.contractNumberSnapshot || t("billing.noContractNumber")} />
              <Field label={t("billing.policeNumberLabel")} value={invoice.policeNumberSnapshot || t("billing.noPoliceNumber")} />
              <Field
                label={t("billing.usageCategoryLabel")}
                value={
                  invoice.usageCategorySnapshot
                    ? translateContractUsageCategory(invoice.usageCategorySnapshot, t)
                    : t("billing.notAvailableShort")
                }
              />
              <Field
                label={t("billing.billingMode")}
                value={
                  invoice.billingModeSnapshot
                    ? translateTariffBillingMode(invoice.billingModeSnapshot, t)
                    : t("billing.notAvailableShort")
                }
              />
              <Field
                label={t("billing.subscribedPowerLabel")}
                value={
                  invoice.subscribedPowerValueSnapshot && invoice.subscribedPowerUnitSnapshot
                    ? `${invoice.subscribedPowerValueSnapshot.toString()} ${translateContractPowerUnit(invoice.subscribedPowerUnitSnapshot, t)}`
                    : t("billing.notAvailableShort")
                }
              />
              <Field
                label={t("billing.phaseTypeLabel")}
                value={
                  invoice.phaseTypeSnapshot
                    ? translateContractPhaseType(invoice.phaseTypeSnapshot, t)
                    : t("billing.notAvailableShort")
                }
              />
              <Field
                label={t("billing.tariffPlan")}
                value={invoice.tariffPlan ? `${invoice.tariffPlan.code} · ${invoice.tariffPlan.name}` : t("billing.notAvailableShort")}
              />
              <Field label={t("billing.periodColumnShort")} value={`${invoice.periodStart.toISOString().slice(0, 10)} → ${invoice.periodEnd.toISOString().slice(0, 10)}`} />
              <Field label={t("billing.dueLabel")} value={invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : t("billing.notAvailableShort")} />
              <Field label={t("billing.fromIndex")} value={invoice.fromPrimaryIndex?.toString() || t("billing.notAvailableShort")} />
              <Field label={t("billing.toIndex")} value={invoice.toPrimaryIndex?.toString() || t("billing.notAvailableShort")} />
              <Field label={t("billing.totalLabel")} value={`${invoice.totalAmount.toString()} ${invoice.currency}`} />
              <Field label={t("billing.paidLabel")} value={`${invoice.paidAmount.toString()} ${invoice.currency}`} />
            </div>
          </ComponentCard>

          <ComponentCard title={t("billing.invoiceLinesTitle")} desc={t("billing.invoiceLinesDesc")}>
            <div className="space-y-2">
              {invoice.lines.map((line: any) => (
                <div key={line.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white/90">{line.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("billing.quantityTimesUnitPrice", {
                        type: line.label,
                        quantity: line.quantity.toString(),
                        unitPrice: line.unitPrice.toString(),
                      })}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-800 dark:text-white/90">{line.amount.toString()}</p>
                </div>
              ))}
            </div>
          </ComponentCard>

          <ComponentCard title={t("billing.timelineTitle")} desc={t("billing.timelineDesc")}>
            <div className="space-y-2">
              {invoice.events.map((event: any) => (
                <div key={event.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
                  <p className="font-medium text-gray-800 dark:text-white/90">{event.type}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(event.createdAt).toISOString().slice(0, 19).replace("T", " ")}</p>
                </div>
              ))}
            </div>
          </ComponentCard>
        </div>

        <div className="xl:col-span-4 space-y-6">
          {canRegisterInvoicePayments ? (
            <ComponentCard title={t("billing.registerPaymentTitle")} desc={t("billing.registerPaymentDesc")}>
              <form action={registerInvoicePaymentAction} className="space-y-3">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <Input name="amount" type="number" step="0.01" placeholder={t("billing.amountPlaceholder")} required />
                <select name="method" className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                  {Object.values(PaymentMethod).map((method) => (
                    <option key={method} value={method}>{translatePaymentMethod(method, t)}</option>
                  ))}
                </select>
                <Input name="reference" placeholder={t("billing.referencePlaceholder")} />
                <Input name="paidAt" type="datetime-local" />
                <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">{t("billing.addPayment")}</button>
              </form>
            </ComponentCard>
          ) : null}

          {canRegisterInvoiceDeliveries ? (
            <ComponentCard title={t("billing.recordDeliveryTitle")} desc={t("billing.recordDeliveryDesc")}>
              <form action={triggerInvoiceDeliveryAction} className="space-y-3">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <select name="channel" className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                  {Object.values(DeliveryChannel).map((channel) => (
                    <option key={channel} value={channel}>{translateDeliveryChannel(channel, t)}</option>
                  ))}
                </select>
                <Input name="recipient" placeholder={t("billing.recipientPlaceholder")} />
                <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">{t("billing.recordDelivery")}</button>
              </form>
            </ComponentCard>
          ) : null}

          <ComponentCard title={t("billing.quickStatsTitle")} desc={t("billing.quickStatsDesc")}>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>{t("billing.paymentCount", { count: invoice.payments.length })}</p>
              <p>{t("billing.deliveryCount", { count: invoice.deliveries.length })}</p>
              <p>{t("billing.eventCount", { count: invoice.events.length })}</p>
            </div>
          </ComponentCard>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
    />
  );
}
