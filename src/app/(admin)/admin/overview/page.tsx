import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ReadingStatus, TaskStatus, UserRole, UserStatus } from "@prisma/client";
import { BoxCubeIcon, PieChartIcon, TaskIcon, UserCircleIcon } from "@/icons";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import OverviewActivityCharts from "@/components/overview/OverviewActivityCharts";
import ValidationRateTrendChart from "@/components/overview/ValidationRateTrendChart";
import OperationsKpisSection from "@/components/overview/OperationsKpisSection";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Overview | MeterFlow Dashboard",
  description: "Operational activity dashboard",
};

function formatDate(value: Date | null) {
  if (!value) return "N/A";
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function readingStatusColor(status: ReadingStatus) {
  if (status === ReadingStatus.VALIDATED) return "success" as const;
  if (status === ReadingStatus.FLAGGED) return "warning" as const;
  if (status === ReadingStatus.REJECTED) return "error" as const;
  if (status === ReadingStatus.PENDING) return "info" as const;
  return "light" as const;
}

type BucketRow = {
  submitted: number;
  pending: number;
  reviewedCount: number;
  reviewedDelayHours: number;
  suspicious: number;
};

export default async function OverviewPage() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prev30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    activeCustomers,
    totalMeters,
    activeMeters,
    totalReadings,
    todayReadings,
    yesterdayReadings,
    prev30DaysReadings,
    usersByRole,
    readings30d,
    taskCountsByStatus,
    topAgentsRaw,
    recentReadings,
    recentTasks,
    reviewedReadingsOneYear,
    readingsOneYearForKpis,
  ] = await prisma.$transaction([
    prisma.user.aggregate({
      where: { deletedAt: null, role: UserRole.CLIENT },
      _count: { id: true },
    }),
    prisma.user.aggregate({
      where: { deletedAt: null, role: UserRole.CLIENT, status: UserStatus.ACTIVE },
      _count: { id: true },
    }),
    prisma.meter.aggregate({
      where: { deletedAt: null },
      _count: { id: true },
    }),
    prisma.meter.aggregate({
      where: { deletedAt: null, status: "ACTIVE" },
      _count: { id: true },
    }),
    prisma.reading.aggregate({
      where: { deletedAt: null },
      _count: { id: true },
    }),
    prisma.reading.aggregate({
      where: { deletedAt: null, createdAt: { gte: startOfToday } },
      _count: { id: true },
    }),
    prisma.reading.aggregate({
      where: {
        deletedAt: null,
        createdAt: {
          gte: startOfYesterday,
          lt: startOfToday,
        },
      },
      _count: { id: true },
    }),
    prisma.reading.aggregate({
      where: {
        deletedAt: null,
        createdAt: {
          gte: prev30Days,
          lt: last30Days,
        },
      },
      _count: { id: true },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { role: true },
    }),
    prisma.reading.findMany({
      where: { deletedAt: null, createdAt: { gte: last30Days } },
      select: {
        status: true,
        createdAt: true,
        meter: { select: { city: true, zone: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { status: true },
    }),
    prisma.reading.groupBy({
      by: ["reviewedById"],
      where: {
        deletedAt: null,
        reviewedById: { not: null },
        reviewedAt: { gte: last7Days },
      },
      _count: { reviewedById: true },
      orderBy: { _count: { reviewedById: "desc" } },
      take: 6,
    }),
    prisma.reading.findMany({
      where: { deletedAt: null },
      include: {
        meter: { select: { serialNumber: true, city: true, zone: true } },
        submittedBy: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.task.findMany({
      where: { deletedAt: null },
      include: {
        meter: { select: { serialNumber: true } },
        assignedTo: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.reading.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: oneYearAgo },
        status: { in: [ReadingStatus.VALIDATED, ReadingStatus.FLAGGED, ReadingStatus.REJECTED] },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.reading.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: oneYearAgo },
      },
      select: {
        createdAt: true,
        readingAt: true,
        reviewedAt: true,
        status: true,
        gpsDistanceMeters: true,
        meter: {
          select: {
            city: true,
            zone: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalCustomersCount = totalCustomers._count.id;
  const activeCustomersCount = activeCustomers._count.id;
  const totalMetersCount = totalMeters._count.id;
  const activeMetersCount = activeMeters._count.id;
  const totalReadingsCount = totalReadings._count.id;
  const todayReadingsCount = todayReadings._count.id;
  const yesterdayReadingsCount = yesterdayReadings._count.id;
  const prev30DaysReadingsCount = prev30DaysReadings._count.id;

  const dateList: Date[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dateList.push(day);
  }
  const dayKey = (date: Date) => date.toISOString().slice(0, 10);

  const dailyMap = new Map<
    string,
    { total: number; pending: number; validated: number; flagged: number; rejected: number }
  >(
    dateList.map((d) => [
      dayKey(d),
      { total: 0, pending: 0, validated: 0, flagged: 0, rejected: 0 },
    ]),
  );

  const statusMix = {
    pending: 0,
    validated: 0,
    flagged: 0,
    rejected: 0,
    other: 0,
  };

  const riskByZone = new Map<string, { total: number; suspicious: number }>();

  readingsOneYearForKpis.forEach((reading) => {
    const key = dayKey(reading.createdAt);
    const day = dailyMap.get(key);
    if (day) {
      day.total += 1;
      if (reading.status === ReadingStatus.PENDING) day.pending += 1;
      else if (reading.status === ReadingStatus.VALIDATED) day.validated += 1;
      else if (reading.status === ReadingStatus.FLAGGED) day.flagged += 1;
      else if (reading.status === ReadingStatus.REJECTED) day.rejected += 1;
    }

    if (reading.status === ReadingStatus.PENDING) statusMix.pending += 1;
    else if (reading.status === ReadingStatus.VALIDATED) statusMix.validated += 1;
    else if (reading.status === ReadingStatus.FLAGGED) statusMix.flagged += 1;
    else if (reading.status === ReadingStatus.REJECTED) statusMix.rejected += 1;
    else statusMix.other += 1;

    const zoneKey = `${reading.meter?.city || "-"} / ${reading.meter?.zone || "-"}`;
    const zone = riskByZone.get(zoneKey) || { total: 0, suspicious: 0 };
    zone.total += 1;
    if ([ReadingStatus.FLAGGED, ReadingStatus.REJECTED].includes(reading.status)) zone.suspicious += 1;
    riskByZone.set(zoneKey, zone);
  });

  const dailyLabels = dateList.map((d) => d.toISOString().slice(5, 10));
  const dailyTotal = dateList.map((d) => dailyMap.get(dayKey(d))?.total || 0);
  const dailyPending = dateList.map((d) => dailyMap.get(dayKey(d))?.pending || 0);
  const dailyValidated = dateList.map((d) => dailyMap.get(dayKey(d))?.validated || 0);
  const dailyFlagged = dateList.map((d) => dailyMap.get(dayKey(d))?.flagged || 0);
  const dailyRejected = dateList.map((d) => dailyMap.get(dayKey(d))?.rejected || 0);

  const statusLabels = ["Pending", "Validated", "Flagged", "Rejected", "Other"];
  const statusValues = [
    statusMix.pending,
    statusMix.validated,
    statusMix.flagged,
    statusMix.rejected,
    statusMix.other,
  ];

  const taskStatusOrder = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE, TaskStatus.CANCELED];
  const taskCountMap = new Map(taskCountsByStatus.map((row) => [row.status, row._count.status]));
  const taskStatusLabels = taskStatusOrder.map((status) => status.replace("_", " "));
  const taskStatusValues = taskStatusOrder.map((status) => taskCountMap.get(status) || 0);

  const roleOrder = [UserRole.CLIENT, UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN];
  const userRoleMap = new Map(usersByRole.map((row) => [row.role, row._count.role]));
  const userRoleLabels = roleOrder.map((role) => role);
  const userRoleValues = roleOrder.map((role) => userRoleMap.get(role) || 0);

  const topAgentIds = topAgentsRaw
    .map((item) => item.reviewedById)
    .filter((id): id is string => Boolean(id));
  const topAgentUsers = topAgentIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topAgentIds }, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const topAgentMap = new Map(topAgentUsers.map((agent) => [agent.id, agent]));
  const topAgentLabels = topAgentsRaw.map((item) => {
    const user = item.reviewedById ? topAgentMap.get(item.reviewedById) : null;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return fullName || user?.phone || "Unknown";
  });
  const topAgentValues = topAgentsRaw.map((item) => item._count.reviewedById);

  const riskyZones = Array.from(riskByZone.entries())
    .map(([zone, values]) => ({
      zone,
      ratio: values.total > 0 ? (values.suspicious / values.total) * 100 : 0,
      total: values.total,
    }))
    .filter((item) => item.total >= 3)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 6);
  const riskyZoneLabels = riskyZones.map((item) => item.zone);
  const riskyZoneValues = riskyZones.map((item) => Number(item.ratio.toFixed(1)));
  const customersCoverage = totalCustomersCount > 0 ? (activeCustomersCount / totalCustomersCount) * 100 : 0;
  const metersCoverage = totalMetersCount > 0 ? (activeMetersCount / totalMetersCount) * 100 : 0;
  const todayTrend =
    yesterdayReadingsCount > 0
      ? ((todayReadingsCount - yesterdayReadingsCount) / yesterdayReadingsCount) * 100
      : todayReadingsCount > 0
        ? 100
        : 0;
  const volume30Days = readings30d.length;
  const volumeTrend =
    prev30DaysReadingsCount > 0
      ? ((volume30Days - prev30DaysReadingsCount) / prev30DaysReadingsCount) * 100
      : volume30Days > 0
        ? 100
        : 0;

  const buildMonthlyRows = () => {
    const rows = new Map<string, BucketRow>();
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      rows.set(d.toISOString().slice(0, 10), {
        submitted: 0,
        pending: 0,
        reviewedCount: 0,
        reviewedDelayHours: 0,
        suspicious: 0,
      });
    }
    return rows;
  };

  const buildQuarterlyRows = () => {
    const rows = new Map<string, BucketRow>();
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const ws = weekStart(date);
      rows.set(ws.toISOString().slice(0, 10), {
        submitted: 0,
        pending: 0,
        reviewedCount: 0,
        reviewedDelayHours: 0,
        suspicious: 0,
      });
    }
    return rows;
  };

  const buildAnnualRows = () => {
    const rows = new Map<string, BucketRow>();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      rows.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, {
        submitted: 0,
        pending: 0,
        reviewedCount: 0,
        reviewedDelayHours: 0,
        suspicious: 0,
      });
    }
    return rows;
  };

  const weekStart = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    return copy;
  };

  const monthlyRows = buildMonthlyRows();
  const quarterlyRows = buildQuarterlyRows();
  const annualRows = buildAnnualRows();

  readings30d.forEach((reading) => {
    const submittedAt = reading.createdAt;
    const reviewedAt = reading.reviewedAt;
    const isReviewed =
      reviewedAt &&
      [ReadingStatus.VALIDATED, ReadingStatus.FLAGGED, ReadingStatus.REJECTED].includes(reading.status);
    const isPending = reading.status === ReadingStatus.PENDING;
    const gpsDistance =
      reading.gpsDistanceMeters !== null && reading.gpsDistanceMeters !== undefined
        ? Number(reading.gpsDistanceMeters.toString())
        : null;
    const isSuspicious =
      reading.status === ReadingStatus.FLAGGED ||
      reading.status === ReadingStatus.REJECTED ||
      (gpsDistance !== null && Number.isFinite(gpsDistance) && gpsDistance > 200);

    const mKey = submittedAt.toISOString().slice(0, 10);
    const qKey = weekStart(submittedAt).toISOString().slice(0, 10);
    const aKey = `${submittedAt.getUTCFullYear()}-${String(submittedAt.getUTCMonth() + 1).padStart(2, "0")}`;

    const apply = (row?: BucketRow) => {
      if (!row) return;
      row.submitted += 1;
      if (isPending) row.pending += 1;
      if (isSuspicious) row.suspicious += 1;
      if (isReviewed) {
        const delay = (reviewedAt!.getTime() - reading.readingAt.getTime()) / (1000 * 60 * 60);
        row.reviewedCount += 1;
        row.reviewedDelayHours += Math.max(0, delay);
      }
    };

    apply(monthlyRows.get(mKey));
    apply(quarterlyRows.get(qKey));
    apply(annualRows.get(aKey));
  });

  const formatMonthShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const formatMonthYear = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  const monthlyDates: Date[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    monthlyDates.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  }
  const quarterlyDates: Date[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    quarterlyDates.push(weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7)));
  }
  const annualDates: Date[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    annualDates.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  const monthlyDelay = {
    labels: monthlyDates.map((d) => formatMonthShort(d)),
    values: monthlyDates.map((d) => {
      const row = monthlyRows.get(d.toISOString().slice(0, 10));
      if (!row || row.reviewedCount === 0) return 0;
      return Number((row.reviewedDelayHours / row.reviewedCount).toFixed(2));
    }),
  };
  const quarterlyDelay = {
    labels: quarterlyDates.map((d) => {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${formatMonthShort(d)}-${formatMonthShort(end)}`;
    }),
    values: quarterlyDates.map((d) => {
      const row = quarterlyRows.get(d.toISOString().slice(0, 10));
      if (!row || row.reviewedCount === 0) return 0;
      return Number((row.reviewedDelayHours / row.reviewedCount).toFixed(2));
    }),
  };
  const annualDelay = {
    labels: annualDates.map((d) => formatMonthYear(d)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const row = annualRows.get(key);
      if (!row || row.reviewedCount === 0) return 0;
      return Number((row.reviewedDelayHours / row.reviewedCount).toFixed(2));
    }),
  };

  const monthlyBacklog = {
    labels: monthlyDates.map((d) => formatMonthShort(d)),
    values: monthlyDates.map((d) => monthlyRows.get(d.toISOString().slice(0, 10))?.pending || 0),
  };
  const quarterlyBacklog = {
    labels: quarterlyDates.map((d) => {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${formatMonthShort(d)}-${formatMonthShort(end)}`;
    }),
    values: quarterlyDates.map((d) => quarterlyRows.get(d.toISOString().slice(0, 10))?.pending || 0),
  };
  const annualBacklog = {
    labels: annualDates.map((d) => formatMonthYear(d)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return annualRows.get(key)?.pending || 0;
    }),
  };

  const monthlyAnomaly = {
    labels: monthlyDates.map((d) => formatMonthShort(d)),
    values: monthlyDates.map((d) => {
      const row = monthlyRows.get(d.toISOString().slice(0, 10));
      if (!row || row.submitted === 0) return 0;
      return Number(((row.suspicious / row.submitted) * 100).toFixed(2));
    }),
  };
  const quarterlyAnomaly = {
    labels: quarterlyDates.map((d) => {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${formatMonthShort(d)}-${formatMonthShort(end)}`;
    }),
    values: quarterlyDates.map((d) => {
      const row = quarterlyRows.get(d.toISOString().slice(0, 10));
      if (!row || row.submitted === 0) return 0;
      return Number(((row.suspicious / row.submitted) * 100).toFixed(2));
    }),
  };
  const annualAnomaly = {
    labels: annualDates.map((d) => formatMonthYear(d)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const row = annualRows.get(key);
      if (!row || row.submitted === 0) return 0;
      return Number(((row.suspicious / row.submitted) * 100).toFixed(2));
    }),
  };

  const monthlyVolume = {
    labels: monthlyDates.map((d) => formatMonthShort(d)),
    values: monthlyDates.map((d) => monthlyRows.get(d.toISOString().slice(0, 10))?.submitted || 0),
  };
  const quarterlyVolume = {
    labels: quarterlyDates.map((d) => {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${formatMonthShort(d)}-${formatMonthShort(end)}`;
    }),
    values: quarterlyDates.map((d) => quarterlyRows.get(d.toISOString().slice(0, 10))?.submitted || 0),
  };
  const annualVolume = {
    labels: annualDates.map((d) => formatMonthYear(d)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return annualRows.get(key)?.submitted || 0;
    }),
  };

  const validationMonthlyDates = monthlyDates;
  const validationMonthlyKey = (d: Date) => d.toISOString().slice(0, 10);
  const validationMonthlyMap = new Map(
    validationMonthlyDates.map((d) => [validationMonthlyKey(d), { decisions: 0, validated: 0 }]),
  );

  const validationQuarterlyDates = quarterlyDates;
  const validationQuarterlyKey = (d: Date) => weekStart(d).toISOString().slice(0, 10);
  const validationQuarterlyMap = new Map(
    validationQuarterlyDates.map((d) => [validationQuarterlyKey(d), { decisions: 0, validated: 0 }]),
  );

  const validationAnnualDates = annualDates;
  const validationMonthKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const validationAnnualMap = new Map(
    validationAnnualDates.map((d) => [validationMonthKey(d), { decisions: 0, validated: 0 }]),
  );

  reviewedReadingsOneYear.forEach((reading) => {
    const createdAt = reading.createdAt;
    const status = reading.status;
    const isValidated = status === ReadingStatus.VALIDATED;

    const mKey = validationMonthlyKey(createdAt);
    const mRow = validationMonthlyMap.get(mKey);
    if (mRow) {
      mRow.decisions += 1;
      if (isValidated) mRow.validated += 1;
    }

    const qKey = validationQuarterlyKey(createdAt);
    const qRow = validationQuarterlyMap.get(qKey);
    if (qRow) {
      qRow.decisions += 1;
      if (isValidated) qRow.validated += 1;
    }

    const aKey = validationMonthKey(createdAt);
    const aRow = validationAnnualMap.get(aKey);
    if (aRow) {
      aRow.decisions += 1;
      if (isValidated) aRow.validated += 1;
    }
  });

  const toRate = (decisions: number, validated: number) =>
    decisions > 0 ? Number(((validated / decisions) * 100).toFixed(2)) : 0;
  const monthShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const monthLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  const validationRateMonthly = {
    labels: validationMonthlyDates.map((d) => monthShort(d)),
    values: validationMonthlyDates.map((d) => {
      const row = validationMonthlyMap.get(validationMonthlyKey(d))!;
      return toRate(row.decisions, row.validated);
    }),
  };

  const validationRateQuarterly = {
    labels: validationQuarterlyDates.map((d) => {
      const ws = weekStart(d);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return `${monthShort(ws)}-${monthShort(we)}`;
    }),
    values: validationQuarterlyDates.map((d) => {
      const row = validationQuarterlyMap.get(validationQuarterlyKey(d))!;
      return toRate(row.decisions, row.validated);
    }),
  };

  const validationRateAnnual = {
    labels: validationAnnualDates.map((d) => monthLabel(d)),
    values: validationAnnualDates.map((d) => {
      const row = validationAnnualMap.get(validationMonthKey(d))!;
      return toRate(row.decisions, row.validated);
    }),
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Overview" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Customers actifs"
          value={activeCustomersCount}
          hint={`Total clients: ${totalCustomersCount}`}
          icon={<UserCircleIcon />}
          trend={customersCoverage}
          trendLabel="actifs / total"
          trendPositive
        />
        <MetricCard
          label="Compteurs actifs"
          value={activeMetersCount}
          hint={`Total compteurs: ${totalMetersCount}`}
          icon={<BoxCubeIcon />}
          trend={metersCoverage}
          trendLabel="actifs / total"
          trendPositive
        />
        <MetricCard
          label="Releves aujourd'hui"
          value={todayReadingsCount}
          hint={`Hier: ${yesterdayReadingsCount} | Total: ${totalReadingsCount}`}
          icon={<TaskIcon />}
          trend={todayTrend}
          trendLabel="vs hier"
          trendPositive={todayTrend >= 0}
        />
        <MetricCard
          label="Volume 30 jours"
          value={volume30Days}
          hint={`30j précédents: ${prev30DaysReadingsCount}`}
          icon={<PieChartIcon />}
          trend={volumeTrend}
          trendLabel="vs 30j préc."
          trendPositive={volumeTrend >= 0}
        />
      </div>

      <div className="mb-6">
        <ValidationRateTrendChart
          monthly={validationRateMonthly}
          quarterly={validationRateQuarterly}
          annual={validationRateAnnual}
        />
      </div>

      <OverviewActivityCharts
        dailyLabels={dailyLabels}
        dailyTotal={dailyTotal}
        dailyPending={dailyPending}
        dailyValidated={dailyValidated}
        dailyFlagged={dailyFlagged}
        dailyRejected={dailyRejected}
        statusLabels={statusLabels}
        statusValues={statusValues}
        taskStatusLabels={taskStatusLabels}
        taskStatusValues={taskStatusValues}
        topAgentLabels={topAgentLabels}
        topAgentValues={topAgentValues}
        riskyZoneLabels={riskyZoneLabels}
        riskyZoneValues={riskyZoneValues}
        userRoleLabels={userRoleLabels}
        userRoleValues={userRoleValues}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ComponentCard title="Recent readings" desc="Derniers releves a superviser.">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[920px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Date</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Client</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Index</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentReadings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No readings found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentReadings.map((reading) => {
                      const customer =
                        [reading.submittedBy.firstName, reading.submittedBy.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || reading.submittedBy.phone;
                      return (
                        <TableRow key={reading.id}>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(reading.createdAt)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-medium">{reading.meter.serialNumber}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {reading.meter.city || "-"} / {reading.meter.zone || "-"}
                            </p>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{customer}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {reading.primaryIndex.toString()}
                            {reading.secondaryIndex ? ` | ${reading.secondaryIndex.toString()}` : ""}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm">
                            <Badge size="sm" color={readingStatusColor(reading.status)}>
                              {reading.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Recent tasks" desc="Dernieres actions terrain.">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[920px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Title</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Assigned</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Date</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No tasks found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTasks.map((task) => {
                      const assignee =
                        [task.assignedTo?.firstName, task.assignedTo?.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || task.assignedTo?.phone || "Unassigned";
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{task.title}</TableCell>
                          <TableCell className="px-4 py-3 text-sm">
                            <Badge
                              size="sm"
                              color={
                                task.status === TaskStatus.DONE
                                  ? "success"
                                  : task.status === TaskStatus.BLOCKED
                                    ? "error"
                                    : task.status === TaskStatus.IN_PROGRESS
                                      ? "info"
                                      : "warning"
                              }
                            >
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {task.meter?.serialNumber || "N/A"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{assignee}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(task.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ComponentCard>
      </div>

      <div className="mt-6">
        <OperationsKpisSection
          processingDelay={{
            monthly: monthlyDelay,
            quarterly: quarterlyDelay,
            annual: annualDelay,
          }}
          pendingBacklog={{
            monthly: monthlyBacklog,
            quarterly: quarterlyBacklog,
            annual: annualBacklog,
          }}
          anomalyRate={{
            monthly: monthlyAnomaly,
            quarterly: quarterlyAnomaly,
            annual: annualAnomaly,
          }}
          submittedVolume={{
            monthly: monthlyVolume,
            quarterly: quarterlyVolume,
            annual: annualVolume,
          }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  trendPositive,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  trend: number;
  trendLabel: string;
  trendPositive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">
        {icon}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h3 className="text-4xl font-semibold tracking-tight text-gray-800 dark:text-white/90">{value}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            trendPositive
              ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
              : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
          }`}
        >
          {trendPositive ? "↑" : "↓"} {Math.abs(trend).toFixed(2)}%
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {hint} · {trendLabel}
      </p>
    </div>
  );
}
