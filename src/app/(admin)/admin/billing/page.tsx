import { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Billing",
  description: "Billing operations overview",
};

export default async function BillingPage() {
  let campaignCount = 0;
  let activeCampaignCount = 0;
  let tariffCount = 0;
  let invoiceCount = 0;
  let issuedCount = 0;
  let paidCount = 0;
  let overdueCount = 0;

  try {
    [
      campaignCount,
      activeCampaignCount,
      tariffCount,
      invoiceCount,
      issuedCount,
      paidCount,
      overdueCount,
    ] = await prisma.$transaction([
      prisma.billingCampaign.count({ where: { deletedAt: null } }),
      prisma.billingCampaign.count({
        where: {
          deletedAt: null,
          status: { in: ["READY", "RUNNING", "GENERATED"] },
        },
      }),
      prisma.tariffPlan.count({ where: { deletedAt: null, isActive: true } }),
      prisma.invoice.count({ where: { deletedAt: null } }),
      prisma.invoice.count({ where: { deletedAt: null, status: InvoiceStatus.ISSUED } }),
      prisma.invoice.count({ where: { deletedAt: null, status: InvoiceStatus.PAID } }),
      prisma.invoice.count({ where: { deletedAt: null, status: InvoiceStatus.OVERDUE } }),
    ]);
  } catch {
    return (
      <div>
        <PageBreadcrumb pageTitle="Billing" />
        <BillingSchemaNotice />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Billing" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaigns" value={campaignCount} hint={`${activeCampaignCount} in progress`} />
        <StatCard label="Active tariffs" value={tariffCount} hint="Pricing plans available" />
        <StatCard label="Invoices" value={invoiceCount} hint={`${issuedCount} issued`} />
        <StatCard label="Collections" value={paidCount} hint={`${overdueCount} overdue`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <QuickLink
          title="Tariff plans"
          description="Create and maintain tariff plans with pricing tiers."
          href="/admin/billing/tariffs"
          actionLabel="Manage tariffs"
        />
        <QuickLink
          title="Billing campaigns"
          description="Plan billing windows and generate invoices in batch."
          href="/admin/billing/campaigns"
          actionLabel="Manage campaigns"
        />
        <QuickLink
          title="Invoices"
          description="Review, issue, collect payments and track delivery."
          href="/admin/billing/invoices"
          actionLabel="Manage invoices"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}

function QuickLink({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
