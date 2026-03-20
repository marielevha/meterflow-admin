import { ReadingStatus, TaskStatus, UserRole, UserStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings/serverSettings";

type BucketRow = {
  submitted: number;
  pending: number;
  reviewedCount: number;
  reviewedDelayHours: number;
  suspicious: number;
};

function weekStart(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function formatMonthShort(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { month: "short", day: "2-digit" });
}

function formatMonthYear(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

async function computeOverviewDashboardData(locale = "en-US") {
  const appSettingsPromise = getAppSettings();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
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
    openTasksCount,
    overdueTasksCount,
    dueTodayTasksCount,
    tasksGroupedByAssignee,
    activeAgents,
  ] = await prisma.$transaction([
    prisma.user.aggregate({ where: { deletedAt: null, role: UserRole.CLIENT }, _count: { id: true } }),
    prisma.user.aggregate({ where: { deletedAt: null, role: UserRole.CLIENT, status: UserStatus.ACTIVE }, _count: { id: true } }),
    prisma.meter.aggregate({ where: { deletedAt: null }, _count: { id: true } }),
    prisma.meter.aggregate({ where: { deletedAt: null, status: "ACTIVE" }, _count: { id: true } }),
    prisma.reading.aggregate({ where: { deletedAt: null }, _count: { id: true } }),
    prisma.reading.aggregate({ where: { deletedAt: null, createdAt: { gte: startOfToday } }, _count: { id: true } }),
    prisma.reading.aggregate({ where: { deletedAt: null, createdAt: { gte: startOfYesterday, lt: startOfToday } }, _count: { id: true } }),
    prisma.reading.aggregate({ where: { deletedAt: null, createdAt: { gte: prev30Days, lt: last30Days } }, _count: { id: true } }),
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { role: true }, orderBy: { role: "asc" } }),
    prisma.reading.findMany({
      where: { deletedAt: null, createdAt: { gte: last30Days } },
      select: {
        status: true,
        createdAt: true,
        reviewedAt: true,
        readingAt: true,
        gpsDistanceMeters: true,
        meter: { select: { city: true, zone: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.task.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { status: true }, orderBy: { status: "asc" } }),
    prisma.reading.groupBy({
      by: ["reviewedById"],
      where: { deletedAt: null, reviewedById: { not: null }, reviewedAt: { gte: last7Days } },
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
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.reading.findMany({
      where: { deletedAt: null, createdAt: { gte: oneYearAgo } },
      select: {
        createdAt: true,
        readingAt: true,
        reviewedAt: true,
        status: true,
        gpsDistanceMeters: true,
        meter: { select: { city: true, zone: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        status: TaskStatus.OPEN,
      },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        dueAt: { lt: startOfToday },
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
      },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        dueAt: { gte: startOfToday, lt: startOfTomorrow },
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
      },
    }),
    prisma.task.groupBy({
      by: ["assignedToId", "status"],
      where: {
        deletedAt: null,
        assignedToId: { not: null },
      },
      orderBy: [{ assignedToId: "asc" }, { status: "asc" }],
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const appSettings = await appSettingsPromise;

  const totalCustomersCount = totalCustomers._count.id;
  const activeCustomersCount = activeCustomers._count.id;
  const totalMetersCount = totalMeters._count.id;
  const activeMetersCount = activeMeters._count.id;
  const totalReadingsCount = totalReadings._count.id;
  const todayReadingsCount = todayReadings._count.id;
  const yesterdayReadingsCount = yesterdayReadings._count.id;
  const prev30DaysReadingsCount = prev30DaysReadings._count.id;

  const dateList: Date[] = [];
  for (let i = 29; i >= 0; i -= 1) dateList.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  const dayKey = (date: Date) => date.toISOString().slice(0, 10);

  const dailyMap = new Map<string, { total: number; pending: number; validated: number; flagged: number; rejected: number }>(
    dateList.map((d) => [dayKey(d), { total: 0, pending: 0, validated: 0, flagged: 0, rejected: 0 }]),
  );

  const statusMix = { pending: 0, validated: 0, flagged: 0, rejected: 0, other: 0 };
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
    if (reading.status === ReadingStatus.FLAGGED || reading.status === ReadingStatus.REJECTED) zone.suspicious += 1;
    riskByZone.set(zoneKey, zone);
  });

  const dailyLabels = dateList.map((d) => d.toISOString().slice(5, 10));
  const dailyTotal = dateList.map((d) => dailyMap.get(dayKey(d))?.total || 0);
  const dailyPending = dateList.map((d) => dailyMap.get(dayKey(d))?.pending || 0);
  const dailyValidated = dateList.map((d) => dailyMap.get(dayKey(d))?.validated || 0);
  const dailyFlagged = dateList.map((d) => dailyMap.get(dayKey(d))?.flagged || 0);
  const dailyRejected = dateList.map((d) => dailyMap.get(dayKey(d))?.rejected || 0);

  const statusLabels = ["Pending", "Validated", "Flagged", "Rejected", "Other"];
  const statusValues = [statusMix.pending, statusMix.validated, statusMix.flagged, statusMix.rejected, statusMix.other];

  const taskStatusOrder = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE, TaskStatus.CANCELED];
  const taskStatusRows = taskCountsByStatus as Array<{ status: TaskStatus; _count: { status: number } }>;
  const taskCountMap = new Map(taskStatusRows.map((row) => [row.status, row._count.status]));
  const taskStatusLabels = taskStatusOrder.map((status) => status.replace("_", " "));
  const taskStatusValues = taskStatusOrder.map((status) => taskCountMap.get(status) || 0);

  const roleOrder = [UserRole.CLIENT, UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN];
  const userRoleRows = usersByRole as Array<{ role: UserRole; _count: { role: number } }>;
  const userRoleMap = new Map(userRoleRows.map((row) => [row.role, row._count.role]));
  const userRoleLabels = roleOrder.map((role) => role);
  const userRoleValues = roleOrder.map((role) => userRoleMap.get(role) || 0);

  const topAgentRows = topAgentsRaw as Array<{ reviewedById: string | null; _count: { reviewedById: number } }>;
  const topAgentIds = topAgentRows.map((item) => item.reviewedById).filter((id): id is string => Boolean(id));
  const topAgentUsers = topAgentIds.length
    ? await prisma.user.findMany({ where: { id: { in: topAgentIds }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, phone: true } })
    : [];
  const topAgentMap = new Map(topAgentUsers.map((agent) => [agent.id, agent]));
  const topAgentLabels = topAgentRows.map((item) => {
    const user = item.reviewedById ? topAgentMap.get(item.reviewedById) : null;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return fullName || user?.phone || "Unknown";
  });
  const topAgentValues = topAgentRows.map((item) => item._count.reviewedById);

  const riskyZones = Array.from(riskByZone.entries())
    .map(([zone, values]) => ({ zone, ratio: values.total > 0 ? (values.suspicious / values.total) * 100 : 0, total: values.total }))
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
      rows.set(d.toISOString().slice(0, 10), { submitted: 0, pending: 0, reviewedCount: 0, reviewedDelayHours: 0, suspicious: 0 });
    }
    return rows;
  };

  const buildQuarterlyRows = () => {
    const rows = new Map<string, BucketRow>();
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const ws = weekStart(date);
      rows.set(ws.toISOString().slice(0, 10), { submitted: 0, pending: 0, reviewedCount: 0, reviewedDelayHours: 0, suspicious: 0 });
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

  const monthlyRows = buildMonthlyRows();
  const quarterlyRows = buildQuarterlyRows();
  const annualRows = buildAnnualRows();

  readings30d.forEach((reading) => {
    const submittedAt = reading.createdAt;
    const reviewedAt = reading.reviewedAt;
    const isReviewed =
      Boolean(reviewedAt) &&
      (reading.status === ReadingStatus.VALIDATED ||
        reading.status === ReadingStatus.FLAGGED ||
        reading.status === ReadingStatus.REJECTED);
    const isPending = reading.status === ReadingStatus.PENDING;
    const gpsDistance = reading.gpsDistanceMeters !== null && reading.gpsDistanceMeters !== undefined ? Number(reading.gpsDistanceMeters.toString()) : null;
    const isSuspicious =
      reading.status === ReadingStatus.FLAGGED ||
      reading.status === ReadingStatus.REJECTED ||
      (gpsDistance !== null && Number.isFinite(gpsDistance) && gpsDistance > appSettings.maxGpsDistanceMeters);

    const mKey = submittedAt.toISOString().slice(0, 10);
    const qKey = weekStart(submittedAt).toISOString().slice(0, 10);
    const aKey = `${submittedAt.getUTCFullYear()}-${String(submittedAt.getUTCMonth() + 1).padStart(2, "0")}`;

    const apply = (row?: BucketRow) => {
      if (!row) return;
      row.submitted += 1;
      if (isPending) row.pending += 1;
      if (isSuspicious) row.suspicious += 1;
      if (isReviewed && reviewedAt) {
        const delay = (reviewedAt.getTime() - reading.readingAt.getTime()) / (1000 * 60 * 60);
        row.reviewedCount += 1;
        row.reviewedDelayHours += Math.max(0, delay);
      }
    };

    apply(monthlyRows.get(mKey));
    apply(quarterlyRows.get(qKey));
    apply(annualRows.get(aKey));
  });

  const monthlyDates: Date[] = [];
  for (let i = 29; i >= 0; i -= 1) monthlyDates.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  const quarterlyDates: Date[] = [];
  for (let i = 11; i >= 0; i -= 1) quarterlyDates.push(weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7)));
  const annualDates: Date[] = [];
  for (let i = 11; i >= 0; i -= 1) annualDates.push(new Date(now.getFullYear(), now.getMonth() - i, 1));

  const monthlyDelay = {
    labels: monthlyDates.map((d) => formatMonthShort(d, locale)),
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
      return `${formatMonthShort(d, locale)}-${formatMonthShort(end, locale)}`;
    }),
    values: quarterlyDates.map((d) => {
      const row = quarterlyRows.get(d.toISOString().slice(0, 10));
      if (!row || row.reviewedCount === 0) return 0;
      return Number((row.reviewedDelayHours / row.reviewedCount).toFixed(2));
    }),
  };
  const annualDelay = {
    labels: annualDates.map((d) => formatMonthYear(d, locale)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const row = annualRows.get(key);
      if (!row || row.reviewedCount === 0) return 0;
      return Number((row.reviewedDelayHours / row.reviewedCount).toFixed(2));
    }),
  };

  const monthlyBacklog = {
    labels: monthlyDates.map((d) => formatMonthShort(d, locale)),
    values: monthlyDates.map((d) => monthlyRows.get(d.toISOString().slice(0, 10))?.pending || 0),
  };
  const quarterlyBacklog = {
    labels: quarterlyDates.map((d) => {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${formatMonthShort(d, locale)}-${formatMonthShort(end, locale)}`;
    }),
    values: quarterlyDates.map((d) => quarterlyRows.get(d.toISOString().slice(0, 10))?.pending || 0),
  };
  const annualBacklog = {
    labels: annualDates.map((d) => formatMonthYear(d, locale)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return annualRows.get(key)?.pending || 0;
    }),
  };

  const monthlyAnomaly = {
    labels: monthlyDates.map((d) => formatMonthShort(d, locale)),
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
      return `${formatMonthShort(d, locale)}-${formatMonthShort(end, locale)}`;
    }),
    values: quarterlyDates.map((d) => {
      const row = quarterlyRows.get(d.toISOString().slice(0, 10));
      if (!row || row.submitted === 0) return 0;
      return Number(((row.suspicious / row.submitted) * 100).toFixed(2));
    }),
  };
  const annualAnomaly = {
    labels: annualDates.map((d) => formatMonthYear(d, locale)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const row = annualRows.get(key);
      if (!row || row.submitted === 0) return 0;
      return Number(((row.suspicious / row.submitted) * 100).toFixed(2));
    }),
  };

  const monthlyVolume = {
    labels: monthlyDates.map((d) => formatMonthShort(d, locale)),
    values: monthlyDates.map((d) => monthlyRows.get(d.toISOString().slice(0, 10))?.submitted || 0),
  };
  const quarterlyVolume = {
    labels: quarterlyDates.map((d) => {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${formatMonthShort(d, locale)}-${formatMonthShort(end, locale)}`;
    }),
    values: quarterlyDates.map((d) => quarterlyRows.get(d.toISOString().slice(0, 10))?.submitted || 0),
  };
  const annualVolume = {
    labels: annualDates.map((d) => formatMonthYear(d, locale)),
    values: annualDates.map((d) => {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return annualRows.get(key)?.submitted || 0;
    }),
  };

  const validationMonthlyDates = monthlyDates;
  const validationMonthlyKey = (d: Date) => d.toISOString().slice(0, 10);
  const validationMonthlyMap = new Map(validationMonthlyDates.map((d) => [validationMonthlyKey(d), { decisions: 0, validated: 0 }]));

  const validationQuarterlyDates = quarterlyDates;
  const validationQuarterlyKey = (d: Date) => weekStart(d).toISOString().slice(0, 10);
  const validationQuarterlyMap = new Map(validationQuarterlyDates.map((d) => [validationQuarterlyKey(d), { decisions: 0, validated: 0 }]));

  const validationAnnualDates = annualDates;
  const validationMonthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const validationAnnualMap = new Map(validationAnnualDates.map((d) => [validationMonthKey(d), { decisions: 0, validated: 0 }]));

  reviewedReadingsOneYear.forEach((reading) => {
    const createdAt = reading.createdAt;
    const isValidated = reading.status === ReadingStatus.VALIDATED;

    const mRow = validationMonthlyMap.get(validationMonthlyKey(createdAt));
    if (mRow) {
      mRow.decisions += 1;
      if (isValidated) mRow.validated += 1;
    }

    const qRow = validationQuarterlyMap.get(validationQuarterlyKey(createdAt));
    if (qRow) {
      qRow.decisions += 1;
      if (isValidated) qRow.validated += 1;
    }

    const aRow = validationAnnualMap.get(validationMonthKey(createdAt));
    if (aRow) {
      aRow.decisions += 1;
      if (isValidated) aRow.validated += 1;
    }
  });

  const toRate = (decisions: number, validated: number) => (decisions > 0 ? Number(((validated / decisions) * 100).toFixed(2)) : 0);
  const monthShort = (d: Date) => d.toLocaleDateString(locale, { month: "short", day: "2-digit" });
  const monthLabel = (d: Date) => d.toLocaleDateString(locale, { month: "short", year: "2-digit" });

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

  const groupedTaskRows = tasksGroupedByAssignee as Array<{
    assignedToId: string | null;
    status: TaskStatus;
    _count: { _all: number };
  }>;

  const supervisionByAgent = activeAgents
    .map((agent) => {
      const rows = groupedTaskRows.filter((item) => item.assignedToId === agent.id);
      const statusCount = (status: TaskStatus) =>
        rows.find((row) => row.status === status)?._count._all || 0;
      const open = statusCount(TaskStatus.OPEN);
      const inProgress = statusCount(TaskStatus.IN_PROGRESS);
      const blocked = statusCount(TaskStatus.BLOCKED);
      const done = statusCount(TaskStatus.DONE);
      const totalActive = open + inProgress + blocked;

      return {
        id: agent.id,
        label:
          [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() || agent.username || "Agent",
        open,
        inProgress,
        blocked,
        done,
        totalActive,
      };
    })
    .sort((a, b) => b.totalActive - a.totalActive || b.blocked - a.blocked || a.label.localeCompare(b.label));

  return {
    appSettings,
    recentReadings,
    recentTasks,
    metrics: {
      totalCustomersCount,
      activeCustomersCount,
      totalMetersCount,
      activeMetersCount,
      totalReadingsCount,
      todayReadingsCount,
      yesterdayReadingsCount,
      prev30DaysReadingsCount,
      volume30Days,
      customersCoverage,
      metersCoverage,
      todayTrend,
      volumeTrend,
    },
    supervision: {
      openTasksCount,
      overdueTasksCount,
      dueTodayTasksCount,
      agentLoad: supervisionByAgent,
    },
    charts: {
      dailyLabels,
      dailyTotal,
      dailyPending,
      dailyValidated,
      dailyFlagged,
      dailyRejected,
      statusLabels,
      statusValues,
      taskStatusLabels,
      taskStatusValues,
      topAgentLabels,
      topAgentValues,
      riskyZoneLabels,
      riskyZoneValues,
      userRoleLabels,
      userRoleValues,
      validationRateMonthly,
      validationRateQuarterly,
      validationRateAnnual,
      monthlyDelay,
      quarterlyDelay,
      annualDelay,
      monthlyBacklog,
      quarterlyBacklog,
      annualBacklog,
      monthlyAnomaly,
      quarterlyAnomaly,
      annualAnomaly,
      monthlyVolume,
      quarterlyVolume,
      annualVolume,
    },
  };
}

export const getOverviewDashboardData = unstable_cache(
  computeOverviewDashboardData,
  ["overview-dashboard-v3"],
  { revalidate: 60, tags: ["overview-dashboard"] },
);
