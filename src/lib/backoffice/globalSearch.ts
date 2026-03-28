import { InvoiceStatus, MeterStatus, MeterType, ReadingStatus, TaskPriority, TaskStatus, UserRole, UserStatus } from "@prisma/client";
import { ADMIN_PERMISSION_GROUPS, hasAnyPermissionCode } from "@/lib/auth/adminPermissionGroups";
import { prisma } from "@/lib/prisma";
import {
  translateInvoiceStatus,
  translateMeterStatus,
  translateReadingStatus,
  translateTaskPriority,
  translateTaskStatus,
  translateUserRole,
  translateUserStatus,
} from "@/lib/admin-i18n/labels";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export type GlobalSearchResource = "users" | "meters" | "readings" | "tasks" | "invoices";

export type GlobalSearchItem = {
  id: string;
  resource: GlobalSearchResource;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
};

export type GlobalSearchGroup = {
  resource: GlobalSearchResource;
  items: GlobalSearchItem[];
};

type SearchParams = {
  query: string;
  permissionCodes: string[];
  t: Translator;
  limitPerGroup?: number;
};

const GROUP_ORDER: GlobalSearchResource[] = [
  "meters",
  "readings",
  "tasks",
  "users",
  "invoices",
];

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function buildSummary(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ");
}

function displayUserName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email?: string | null;
  phone: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.username || user.email || user.phone;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function asUuid(value: string) {
  const trimmedValue = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmedValue)
    ? trimmedValue
    : null;
}

function rankMatch(query: string, candidates: Array<string | null | undefined>) {
  const normalizedQuery = normalizeText(query);
  let score = 0;

  for (const candidate of candidates) {
    const value = normalizeText(candidate);
    if (!value) continue;

    if (value === normalizedQuery) {
      score = Math.max(score, 500);
      continue;
    }

    if (value.startsWith(normalizedQuery)) {
      score = Math.max(score, 350);
      continue;
    }

    if (value.split(/\s+/).some((token) => token.startsWith(normalizedQuery))) {
      score = Math.max(score, 250);
      continue;
    }

    if (value.includes(normalizedQuery)) {
      score = Math.max(score, 120);
    }
  }

  return score;
}

export async function searchAdminResources({
  query,
  permissionCodes,
  t,
  limitPerGroup = 5,
}: SearchParams): Promise<{ query: string; groups: GlobalSearchGroup[] }> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return { query: trimmedQuery, groups: [] };
  }
  const exactUuid = asUuid(trimmedQuery);
  const queryTokens = trimmedQuery.split(/\s+/).map((token) => token.trim()).filter(Boolean);

  const canSearchUsers = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.usersView);
  const canSearchMeters = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.metersView);
  const canSearchReadings = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsView);
  const canSearchTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksView);
  const canSearchInvoices = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.billingInvoicesView);

  const queryMultiplier = Math.max(limitPerGroup * 2, 8);

  const [
    users,
    meters,
    readings,
    tasks,
    invoices,
  ] = await Promise.all([
    canSearchUsers
      ? prisma.user.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(exactUuid ? [{ id: exactUuid }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { phone: { contains: token } },
                    { username: { contains: token, mode: "insensitive" } },
                    { email: { contains: token, mode: "insensitive" } },
                    { firstName: { contains: token, mode: "insensitive" } },
                    { lastName: { contains: token, mode: "insensitive" } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    canSearchMeters
      ? prisma.meter.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(exactUuid ? [{ id: exactUuid }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { serialNumber: { contains: token, mode: "insensitive" } },
                    { meterReference: { contains: token, mode: "insensitive" } },
                    { city: { contains: token, mode: "insensitive" } },
                    { zone: { contains: token, mode: "insensitive" } },
                    {
                      assignments: {
                        some: {
                          deletedAt: null,
                          endedAt: null,
                          customer: {
                            deletedAt: null,
                            OR: [
                              { phone: { contains: token } },
                              { username: { contains: token, mode: "insensitive" } },
                              { firstName: { contains: token, mode: "insensitive" } },
                              { lastName: { contains: token, mode: "insensitive" } },
                            ],
                          },
                        },
                      },
                    },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            serialNumber: true,
            meterReference: true,
            city: true,
            zone: true,
            status: true,
            type: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    canSearchReadings
      ? prisma.reading.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(exactUuid ? [{ id: exactUuid }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { meter: { serialNumber: { contains: token, mode: "insensitive" } } },
                    { meter: { meterReference: { contains: token, mode: "insensitive" } } },
                    { submittedBy: { phone: { contains: token } } },
                    { submittedBy: { username: { contains: token, mode: "insensitive" } } },
                    { submittedBy: { firstName: { contains: token, mode: "insensitive" } } },
                    { submittedBy: { lastName: { contains: token, mode: "insensitive" } } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            status: true,
            readingAt: true,
            createdAt: true,
            meter: {
              select: {
                serialNumber: true,
                meterReference: true,
              },
            },
            submittedBy: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                phone: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSearchTasks
      ? prisma.task.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(exactUuid ? [{ id: exactUuid }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { title: { contains: token, mode: "insensitive" } },
                    { description: { contains: token, mode: "insensitive" } },
                    { meter: { serialNumber: { contains: token, mode: "insensitive" } } },
                    { meter: { meterReference: { contains: token, mode: "insensitive" } } },
                    { assignedTo: { firstName: { contains: token, mode: "insensitive" } } },
                    { assignedTo: { lastName: { contains: token, mode: "insensitive" } } },
                    { assignedTo: { username: { contains: token, mode: "insensitive" } } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
            meter: {
              select: {
                serialNumber: true,
                meterReference: true,
              },
            },
            assignedTo: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSearchInvoices
      ? prisma.invoice.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(exactUuid ? [{ id: exactUuid }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { invoiceNumber: { contains: token, mode: "insensitive" } },
                    { meter: { serialNumber: { contains: token, mode: "insensitive" } } },
                    { meter: { meterReference: { contains: token, mode: "insensitive" } } },
                    { customer: { phone: { contains: token } } },
                    { customer: { username: { contains: token, mode: "insensitive" } } },
                    { customer: { firstName: { contains: token, mode: "insensitive" } } },
                    { customer: { lastName: { contains: token, mode: "insensitive" } } },
                    { campaign: { code: { contains: token, mode: "insensitive" } } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            createdAt: true,
            meter: {
              select: {
                serialNumber: true,
                meterReference: true,
              },
            },
            customer: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                phone: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const groups: GlobalSearchGroup[] = [];

  if (canSearchMeters) {
    const meterItems = meters
      .map((meter) => ({
        item: {
          id: meter.id,
          resource: "meters" as const,
          title: meter.serialNumber,
          subtitle: buildSummary([
            meter.meterReference || t("common.notAvailable"),
            [meter.city, meter.zone].filter(Boolean).join(" / ") || null,
          ]),
          meta: buildSummary([
            translateMeterStatus(meter.status as MeterStatus, t),
            meter.type === MeterType.DUAL_INDEX ? t("meters.typeDualIndex") : t("meters.typeSingleIndex"),
          ]),
          href: `/admin/meters/${meter.id}`,
        },
        rank: rankMatch(trimmedQuery, [
          meter.serialNumber,
          meter.meterReference,
          meter.city,
          meter.zone,
          meter.id,
        ]),
        createdAt: meter.createdAt.getTime(),
      }))
      .sort((a, b) => b.rank - a.rank || b.createdAt - a.createdAt)
      .slice(0, limitPerGroup)
      .map((entry) => entry.item);

    if (meterItems.length > 0) groups.push({ resource: "meters", items: meterItems });
  }

  if (canSearchReadings) {
    const readingItems = readings
      .map((reading) => ({
        item: {
          id: reading.id,
          resource: "readings" as const,
          title: reading.meter.serialNumber || shortId(reading.id),
          subtitle: buildSummary([
            shortId(reading.id),
            reading.meter.meterReference,
            reading.readingAt.toISOString().slice(0, 10),
          ]),
          meta: buildSummary([
            translateReadingStatus(reading.status as ReadingStatus, t),
            displayUserName(reading.submittedBy),
          ]),
          href: `/admin/readings/${reading.id}`,
        },
        rank: rankMatch(trimmedQuery, [
          reading.id,
          reading.meter.serialNumber,
          reading.meter.meterReference,
          reading.submittedBy.phone,
          reading.submittedBy.username,
          reading.submittedBy.firstName,
          reading.submittedBy.lastName,
        ]),
        createdAt: reading.createdAt.getTime(),
      }))
      .sort((a, b) => b.rank - a.rank || b.createdAt - a.createdAt)
      .slice(0, limitPerGroup)
      .map((entry) => entry.item);

    if (readingItems.length > 0) groups.push({ resource: "readings", items: readingItems });
  }

  if (canSearchTasks) {
    const taskItems = tasks
      .map((task) => ({
        item: {
          id: task.id,
          resource: "tasks" as const,
          title: task.title,
          subtitle: buildSummary([
            shortId(task.id),
            task.meter?.serialNumber,
            task.meter?.meterReference,
          ]),
          meta: buildSummary([
            translateTaskStatus(task.status as TaskStatus, t),
            translateTaskPriority(task.priority as TaskPriority, t),
            task.assignedTo ? displayUserName({ ...task.assignedTo, phone: "" }) : null,
          ]),
          href: `/admin/tasks/${task.id}`,
        },
        rank: rankMatch(trimmedQuery, [
          task.id,
          task.title,
          task.meter?.serialNumber,
          task.meter?.meterReference,
          task.assignedTo?.firstName,
          task.assignedTo?.lastName,
          task.assignedTo?.username,
        ]),
        createdAt: task.createdAt.getTime(),
      }))
      .sort((a, b) => b.rank - a.rank || b.createdAt - a.createdAt)
      .slice(0, limitPerGroup)
      .map((entry) => entry.item);

    if (taskItems.length > 0) groups.push({ resource: "tasks", items: taskItems });
  }

  if (canSearchUsers) {
    const userItems = users
      .map((user) => ({
        item: {
          id: user.id,
          resource: "users" as const,
          title: displayUserName(user),
          subtitle: buildSummary([user.phone, user.username, user.email]),
          meta: buildSummary([
            translateUserRole(user.role as UserRole, t),
            translateUserStatus(user.status as UserStatus, t),
          ]),
          href: `/admin/users/${user.id}`,
        },
        rank: rankMatch(trimmedQuery, [
          user.id,
          user.phone,
          user.username,
          user.email,
          user.firstName,
          user.lastName,
          displayUserName(user),
        ]),
        createdAt: user.createdAt.getTime(),
      }))
      .sort((a, b) => b.rank - a.rank || b.createdAt - a.createdAt)
      .slice(0, limitPerGroup)
      .map((entry) => entry.item);

    if (userItems.length > 0) groups.push({ resource: "users", items: userItems });
  }

  if (canSearchInvoices) {
    const invoiceItems = invoices
      .map((invoice) => ({
        item: {
          id: invoice.id,
          resource: "invoices" as const,
          title: invoice.invoiceNumber,
          subtitle: buildSummary([
            displayUserName(invoice.customer),
            invoice.meter.serialNumber,
            invoice.meter.meterReference,
          ]),
          meta: translateInvoiceStatus(invoice.status as InvoiceStatus, t),
          href: `/admin/billing/invoices/${invoice.id}`,
        },
        rank: rankMatch(trimmedQuery, [
          invoice.id,
          invoice.invoiceNumber,
          invoice.customer.phone,
          invoice.customer.username,
          invoice.customer.firstName,
          invoice.customer.lastName,
          invoice.meter.serialNumber,
          invoice.meter.meterReference,
        ]),
        createdAt: invoice.createdAt.getTime(),
      }))
      .sort((a, b) => b.rank - a.rank || b.createdAt - a.createdAt)
      .slice(0, limitPerGroup)
      .map((entry) => entry.item);

    if (invoiceItems.length > 0) groups.push({ resource: "invoices", items: invoiceItems });
  }

  groups.sort((a, b) => GROUP_ORDER.indexOf(a.resource) - GROUP_ORDER.indexOf(b.resource));

  return {
    query: trimmedQuery,
    groups,
  };
}
