import { Metadata } from "next";
import Link from "next/link";
import { Prisma, ReadingStatus } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import ReadingsFilters from "@/components/readings/ReadingsFilters";
import { EyeIcon, PencilIcon } from "@/icons";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { formatAdminMeterIndexSummary } from "@/lib/meters/indexLabels";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Readings",
  description: "Readings supervision",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function normalizeStatus(value: string): ReadingStatus | "" {
  return (Object.values(ReadingStatus) as string[]).includes(value) ? (value as ReadingStatus) : "";
}

function statusBadge(status: ReadingStatus) {
  if (status === ReadingStatus.VALIDATED) return "success" as const;
  if (status === ReadingStatus.FLAGGED) return "warning" as const;
  if (status === ReadingStatus.REJECTED) return "error" as const;
  if (status === ReadingStatus.PENDING) return "info" as const;
  return "light" as const;
}

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function readingStatusLabel(
  status: ReadingStatus,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (status === ReadingStatus.PENDING) return t("overview.pending");
  if (status === ReadingStatus.VALIDATED) return t("overview.validated");
  if (status === ReadingStatus.FLAGGED) return t("overview.flagged");
  if (status === ReadingStatus.REJECTED) return t("overview.rejected");
  return status;
}

export default async function ReadingsPage({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireAdminPermissions("/admin/readings", ADMIN_PERMISSION_GROUPS.readingsView);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canEditReadings = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsEditPage);
  const { locale, t } = await getAdminTranslator();
  const localeCode = locale === "fr" ? "fr-FR" : locale === "ln" ? "ln-CG" : "en-US";
  const resolved = await searchParams;
  const q = firstValue(resolved.q).trim();
  const status = normalizeStatus(firstValue(resolved.status).trim());
  const dateFrom = firstValue(resolved.dateFrom).trim();
  const dateTo = firstValue(resolved.dateTo).trim();
  const pageSizeRaw = Number(firstValue(resolved.pageSize) || "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : 10;
  const requestedPage = Math.max(1, Number(firstValue(resolved.page) || "1"));

  const where: Prisma.ReadingWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          readingAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { meter: { serialNumber: { contains: q, mode: "insensitive" } } },
            { meter: { meterReference: { contains: q, mode: "insensitive" } } },
            { submittedBy: { phone: { contains: q } } },
            { submittedBy: { firstName: { contains: q, mode: "insensitive" } } },
            { submittedBy: { lastName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, pending, validated, flagged, rejected, totalFiltered] = await prisma.$transaction([
    prisma.reading.count({ where: { deletedAt: null } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.PENDING } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.VALIDATED } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.FLAGGED } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.REJECTED } }),
    prisma.reading.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const readings = await prisma.reading.findMany({
    where,
    orderBy: { readingAt: "desc" },
    skip,
    take: pageSize,
    include: {
      meter: { select: { serialNumber: true, meterReference: true, type: true } },
      submittedBy: { select: { firstName: true, lastName: true, phone: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
  });

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const nextQ = overrides.q ?? q;
    const nextStatus = overrides.status ?? status;
    const nextDateFrom = overrides.dateFrom ?? dateFrom;
    const nextDateTo = overrides.dateTo ?? dateTo;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextPage = overrides.page ?? page;

    if (nextQ) params.set("q", String(nextQ));
    if (nextStatus) params.set("status", String(nextStatus));
    if (nextDateFrom) params.set("dateFrom", String(nextDateFrom));
    if (nextDateTo) params.set("dateTo", String(nextDateTo));
    params.set("pageSize", String(nextPageSize));
    if (Number(nextPage) > 1) params.set("page", String(nextPage));

    const query = params.toString();
    return query ? `/admin/readings?${query}` : "/admin/readings";
  };

  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div>
      <PageBreadcrumb pageTitle={t("readings.pageTitle")} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t("readings.totalReadings")} value={total} />
        <StatCard label={t("overview.pending")} value={pending} />
        <StatCard label={t("overview.validated")} value={validated} />
        <StatCard label={t("overview.flagged")} value={flagged} />
        <StatCard label={t("overview.rejected")} value={rejected} />
      </div>

      <ComponentCard title={t("readings.queueTitle")} desc={t("readings.queueDesc")}>
        <ReadingsFilters
          initialQ={q}
          initialStatus={status}
          initialDateFrom={dateFrom}
          initialDateTo={dateTo}
          initialPageSize={pageSize}
          statusOptions={Object.values(ReadingStatus)}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />

        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1280px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("readings.readingDate")}</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.meter")}</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.index")}</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.status")}</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("readings.submittedBy")}</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("readings.reviewedBy")}</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("readings.gpsDistance")}</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.actions")}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {readings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t("readings.noReadingsFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  readings.map((reading) => {
                    const submittedBy =
                      [reading.submittedBy.firstName, reading.submittedBy.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || reading.submittedBy.phone;
                    const reviewedBy =
                      [reading.reviewedBy?.firstName, reading.reviewedBy?.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || t("readings.noReviewer");

                    return (
                      <TableRow key={reading.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(reading.readingAt, localeCode)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{reading.meter.serialNumber}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{reading.meter.meterReference || t("common.notAvailable")}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {formatAdminMeterIndexSummary({
                            meterType: reading.meter.type,
                            primary: reading.primaryIndex,
                            secondary: reading.secondaryIndex,
                            t,
                          })}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <Badge size="sm" color={statusBadge(reading.status)}>
                            {readingStatusLabel(reading.status, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{submittedBy}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{reviewedBy}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {reading.gpsDistanceMeters !== null && reading.gpsDistanceMeters !== undefined
                            ? t("readings.distanceMeters", { value: reading.gpsDistanceMeters.toString() })
                            : t("common.notAvailable")}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/readings/${reading.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]" title={t("readings.viewReading")} aria-label={t("readings.viewReading")}>
                              <EyeIcon className="h-4 w-4" />
                            </Link>
                            {canEditReadings ? (
                              <Link href={`/admin/readings/${reading.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]" title={t("readings.editReading")} aria-label={t("readings.editReading")}>
                                <PencilIcon className="h-4 w-4" />
                              </Link>
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

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("readings.showingSummary", {
              start: readings.length === 0 ? 0 : skip + 1,
              end: Math.min(skip + readings.length, totalFiltered),
              total: totalFiltered,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildHref({ page: page - 1 })}
              aria-disabled={page <= 1}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                page <= 1
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              {t("common.previous")}
            </Link>

            {visiblePages.map((pageNumber) => (
              <Link
                key={pageNumber}
                href={buildHref({ page: pageNumber })}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                  pageNumber === page
                    ? "bg-brand-500 text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                }`}
              >
                {pageNumber}
              </Link>
            ))}

            <Link
              href={buildHref({ page: page + 1 })}
              aria-disabled={page >= totalPages}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                page >= totalPages
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              {t("common.next")}
            </Link>
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</h3>
    </div>
  );
}
