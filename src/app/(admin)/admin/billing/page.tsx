import { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { prisma } from "@/lib/prisma";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";

export const metadata: Metadata = {
  title: "Billing",
  description: "Billing operations overview",
};

export default async function BillingPage() {
  const { t } = await getAdminTranslator();
  let cityCount = 0;
  let zoneCount = 0;
  let campaignCount = 0;
  let activeCampaignCount = 0;
  let tariffCount = 0;
  let invoiceCount = 0;
  let issuedCount = 0;
  let paidCount = 0;
  let overdueCount = 0;

  try {
    [
      cityCount,
      zoneCount,
      campaignCount,
      activeCampaignCount,
      tariffCount,
      invoiceCount,
      issuedCount,
      paidCount,
      overdueCount,
    ] = await prisma.$transaction([
      prisma.city.count({ where: { deletedAt: null, isActive: true } }),
      prisma.zone.count({ where: { deletedAt: null, isActive: true } }),
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
  } catch (error) {
    const errorState = getBillingPageErrorState(error, "billing.overview");
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.pageTitle")} />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={t("billing.pageTitle")} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t("billing.statCities")} value={cityCount} hint={t("billing.statCitiesHint")} />
        <StatCard label={t("billing.statZones")} value={zoneCount} hint={t("billing.statZonesHint")} />
        <StatCard
          label={t("billing.statCampaigns")}
          value={campaignCount}
          hint={t("billing.statCampaignsHint", { count: activeCampaignCount })}
        />
        <StatCard label={t("billing.statActiveTariffs")} value={tariffCount} hint={t("billing.statActiveTariffsHint")} />
        <StatCard
          label={t("billing.statInvoices")}
          value={invoiceCount}
          hint={t("billing.statInvoicesHint", { issued: issuedCount, paid: paidCount, overdue: overdueCount })}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <QuickLink
          title={t("billing.statCities")}
          description={t("billing.citiesCardDescription")}
          href="/admin/billing/cities"
          actionLabel={t("billing.manageCities")}
        />
        <QuickLink
          title={t("billing.statZones")}
          description={t("billing.zonesCardDescription")}
          href="/admin/billing/zones"
          actionLabel={t("billing.manageZones")}
        />
        <QuickLink
          title={t("billing.tariffsCardTitle")}
          description={t("billing.tariffsCardDescription")}
          href="/admin/billing/tariffs"
          actionLabel={t("billing.manageTariffs")}
        />
        <QuickLink
          title={t("billing.campaignsPageTitle")}
          description={t("billing.campaignsCardDescription")}
          href="/admin/billing/campaigns"
          actionLabel={t("billing.manageCampaigns")}
        />
        <QuickLink
          title={t("billing.statInvoices")}
          description={t("billing.invoicesCardDescription")}
          href="/admin/billing/invoices"
          actionLabel={t("billing.manageInvoices")}
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
