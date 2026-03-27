import { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { translateInvoiceStatus } from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";
import { listInvoices } from "@/lib/backoffice/billing";
import { cancelInvoiceAction, issueInvoiceAction } from "@/app/(admin)/admin/billing/actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Billing Invoices",
  description: "Manage billing invoices",
};

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

export default async function BillingInvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireAdminPermissions(
    "/admin/billing/invoices",
    ADMIN_PERMISSION_GROUPS.billingInvoicesView
  );
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canManageInvoices = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.billingInvoicesManage
  );
  const { t } = await getAdminTranslator();
  const resolved = await searchParams;
  const status = firstValue(resolved.status);
  const search = firstValue(resolved.search);
  const city = firstValue(resolved.city);
  const zone = firstValue(resolved.zone);
  const error = firstValue(resolved.error);
  const success = firstValue(resolved.success);
  const page = Number(firstValue(resolved.page) || "1");
  const perPage = Number(firstValue(resolved.perPage) || "20");
  const issuableStatuses = new Set<InvoiceStatus>([
    InvoiceStatus.DRAFT,
    InvoiceStatus.PENDING_REVIEW,
  ]);

  let result: Awaited<ReturnType<typeof listInvoices>>;
  try {
    result = await listInvoices({ status, search, city, zone, page, perPage });
  } catch (error) {
    const errorState = getBillingPageErrorState(error, "billing.invoices");
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.invoicesPageTitle")} />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }
  const data = result.body as {
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      status: InvoiceStatus;
      totalAmount: { toString(): string };
      paidAmount: { toString(): string };
      periodStart: Date;
      periodEnd: Date;
      dueDate: Date | null;
      meter: { serialNumber: string; city: string | null; zone: string | null };
      customer: { firstName: string | null; lastName: string | null; username: string | null; phone: string };
      campaign: { code: string } | null;
      createdAt: Date;
    }>;
    total: number;
    totalPages: number;
    page: number;
    perPage: number;
  };

  return (
    <div>
      <PageBreadcrumb pageTitle={t("billing.invoicesPageTitle")} />

      {error ? (
        <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          {t("common.error")}: {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
          {t("common.success")}: {success}
        </div>
      ) : null}

      <ComponentCard title={t("billing.invoicesCardTitle")} desc={t("billing.invoicesCardDesc")}>
        <form method="GET" className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <input type="hidden" name="perPage" value={perPage} />
          <input
            name="search"
            defaultValue={search}
            placeholder={t("billing.invoiceSearchPlaceholder")}
            className="h-11 lg:col-span-4 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <input
            name="city"
            defaultValue={city}
            placeholder={t("billing.cityPlaceholder")}
            className="h-11 lg:col-span-2 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <input
            name="zone"
            defaultValue={zone}
            placeholder={t("billing.zonePlaceholder")}
            className="h-11 lg:col-span-2 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <select
            name="status"
            defaultValue={status}
            className="h-11 lg:col-span-2 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">{t("billing.allStatuses")}</option>
            {Object.values(InvoiceStatus).map((item) => (
              <option key={item} value={item}>{translateInvoiceStatus(item, t)}</option>
            ))}
          </select>
          <button type="submit" className="h-11 lg:col-span-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">{t("billing.filterAction")}</button>
        </form>

        <div className="max-w-full overflow-x-auto">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table className="table-fixed">
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.invoiceColumn")}</TableCell>
                  <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.customerColumn")}</TableCell>
                  <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.meterColumn")}</TableCell>
                  <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.periodColumnShort")}</TableCell>
                  <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.amountsColumn")}</TableCell>
                  <TableCell isHeader className="w-[9%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.statusColumn")}</TableCell>
                  <TableCell isHeader className="w-[9%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.actions")}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {data.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t("billing.noInvoicesFound")}</TableCell>
                  </TableRow>
                ) : (
                  data.invoices.map((invoice) => {
                    const customer = [invoice.customer.firstName, invoice.customer.lastName].filter(Boolean).join(" ").trim() || invoice.customer.username || invoice.customer.phone;
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words font-medium">{invoice.invoiceNumber}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{invoice.campaign?.code || t("billing.manualCampaign")}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 break-words">{customer}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words">{invoice.meter.serialNumber}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{invoice.meter.city || "-"} / {invoice.meter.zone || "-"}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words">{invoice.periodStart.toISOString().slice(0, 10)} → {invoice.periodEnd.toISOString().slice(0, 10)}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{t("billing.dueLabel")}: {invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : t("billing.notAvailableShort")}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p>{t("billing.totalLabel")}: {invoice.totalAmount.toString()}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t("billing.paidLabel")}: {invoice.paidAmount.toString()}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{translateInvoiceStatus(invoice.status, t)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/billing/invoices/${invoice.id}`}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              {t("billing.viewInvoice")}
                            </Link>
                            {canManageInvoices ? (
                              <>
                                <form action={issueInvoiceAction}>
                                  <input type="hidden" name="invoiceId" value={invoice.id} />
                                  <button
                                    type="submit"
                                    disabled={!issuableStatuses.has(invoice.status)}
                                    className="inline-flex h-8 items-center justify-center rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {t("billing.issueInvoice")}
                                  </button>
                                </form>
                                <form action={cancelInvoiceAction} className="flex items-center gap-2">
                                  <input type="hidden" name="invoiceId" value={invoice.id} />
                                  <input name="reason" placeholder={t("billing.cancelReasonPlaceholder")} className="h-8 w-28 rounded border border-gray-300 px-2 text-xs dark:border-gray-700 dark:bg-gray-900" />
                                  <button
                                    type="submit"
                                    disabled={invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELED}
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-error-300 px-3 text-xs font-medium text-error-700 hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-error-500/40 dark:text-error-300 dark:hover:bg-error-500/10"
                                  >
                                    {t("billing.cancelInvoice")}
                                  </button>
                                </form>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <p>{t("billing.showingInvoices", { count: data.total })}</p>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/billing/invoices?page=${Math.max(1, data.page - 1)}&perPage=${data.perPage}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&city=${encodeURIComponent(city)}&zone=${encodeURIComponent(zone)}`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.03]"
            >{t("common.previous")}</Link>
            <span>{t("billing.pageIndicator", { page: data.page, totalPages: data.totalPages })}</span>
            <Link
              href={`/admin/billing/invoices?page=${Math.min(data.totalPages, data.page + 1)}&perPage=${data.perPage}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&city=${encodeURIComponent(city)}&zone=${encodeURIComponent(zone)}`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.03]"
            >{t("common.next")}</Link>
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}
