import { Metadata } from "next";
import Link from "next/link";
import { DeliveryChannel, PaymentMethod } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
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
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const error = firstValue(resolvedSearch.error);
  const success = firstValue(resolvedSearch.success);

  let result: Awaited<ReturnType<typeof getInvoiceDetail>>;
  try {
    result = await getInvoiceDetail(id);
  } catch {
    return (
      <div>
        <PageBreadcrumb pageTitle="Invoice detail" />
        <BillingSchemaNotice />
      </div>
    );
  }
  if (result.status !== 200) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Invoice detail" />
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          Invoice not found.
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
      <PageBreadcrumb pageTitle="Invoice detail" />

      {error ? (
        <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">Error: {error}</div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">Success: {success}</div>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{invoice.invoiceNumber}</h2>
        <Link href="/admin/billing/invoices" className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">Back</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-6">
          <ComponentCard title="Invoice summary" desc="Customer, meter and billing period.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Customer" value={customer} />
              <Field label="Phone" value={invoice.customer.phone} />
              <Field label="Meter" value={invoice.meter.serialNumber} />
              <Field label="Location" value={`${invoice.meter.city || "-"} / ${invoice.meter.zone || "-"}`} />
              <Field label="Status" value={invoice.status} />
              <Field label="Campaign" value={invoice.campaign?.code || "N/A"} />
              <Field label="Period" value={`${invoice.periodStart.toISOString().slice(0, 10)} → ${invoice.periodEnd.toISOString().slice(0, 10)}`} />
              <Field label="Due date" value={invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "N/A"} />
              <Field label="From index (N-1)" value={invoice.fromPrimaryIndex?.toString() || "N/A"} />
              <Field label="To index (N)" value={invoice.toPrimaryIndex?.toString() || "N/A"} />
              <Field label="Total" value={`${invoice.totalAmount.toString()} ${invoice.currency}`} />
              <Field label="Paid" value={`${invoice.paidAmount.toString()} ${invoice.currency}`} />
            </div>
          </ComponentCard>

          <ComponentCard title="Invoice lines" desc="Computed pricing lines.">
            <div className="space-y-2">
              {invoice.lines.map((line: any) => (
                <div key={line.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white/90">{line.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{line.type} | QTY {line.quantity.toString()} × {line.unitPrice.toString()}</p>
                  </div>
                  <p className="font-semibold text-gray-800 dark:text-white/90">{line.amount.toString()}</p>
                </div>
              ))}
            </div>
          </ComponentCard>

          <ComponentCard title="Timeline" desc="Invoice events, payments and deliveries.">
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
          <ComponentCard title="Register payment" desc="Add a payment record.">
            <form action={registerInvoicePaymentAction} className="space-y-3">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <Input name="amount" type="number" step="0.01" placeholder="Amount" required />
              <select name="method" className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                {Object.values(PaymentMethod).map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              <Input name="reference" placeholder="Reference" />
              <Input name="paidAt" type="datetime-local" />
              <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">Add payment</button>
            </form>
          </ComponentCard>

          <ComponentCard title="Record delivery" desc="Track invoice distribution.">
            <form action={triggerInvoiceDeliveryAction} className="space-y-3">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <select name="channel" className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                {Object.values(DeliveryChannel).map((channel) => (
                  <option key={channel} value={channel}>{channel}</option>
                ))}
              </select>
              <Input name="recipient" placeholder="Recipient (phone/email)" />
              <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">Record delivery</button>
            </form>
          </ComponentCard>

          <ComponentCard title="Quick stats" desc="Instant operational values.">
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>Payments: {invoice.payments.length}</p>
              <p>Deliveries: {invoice.deliveries.length}</p>
              <p>Events: {invoice.events.length}</p>
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
