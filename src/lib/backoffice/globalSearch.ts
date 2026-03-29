import {
  BillingCampaignStatus,
  InvoiceStatus,
  MeterStatus,
  MeterType,
  ReadingStatus,
  Role,
  TaskPriority,
  TaskStatus,
  TariffBillingMode,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { ADMIN_PERMISSION_GROUPS, hasAnyPermissionCode } from "@/lib/auth/adminPermissionGroups";
import { prisma } from "@/lib/prisma";
import {
  translateBillingCampaignStatus,
  translateInvoiceStatus,
  translateMeterStatus,
  translateReadingStatus,
  translateTariffBillingMode,
  translateTaskPriority,
  translateTaskStatus,
  translateUserRole,
  translateUserStatus,
} from "@/lib/admin-i18n/labels";
import {
  buildSearchQueryProfile,
  rankWeightedFields,
  type SearchQueryProfile,
  type WeightedSearchField,
} from "@/lib/search/globalSearchUtils";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export type GlobalSearchResource =
  | "users"
  | "meters"
  | "readings"
  | "tasks"
  | "invoices"
  | "campaigns"
  | "tariffs"
  | "zones"
  | "cities"
  | "roles";

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

type RankedSearchItem = {
  item: GlobalSearchItem;
  score: number;
  createdAt: number;
};

const RESOURCE_TIE_BREAKER: GlobalSearchResource[] = [
  "users",
  "meters",
  "readings",
  "tasks",
  "invoices",
  "campaigns",
  "tariffs",
  "zones",
  "cities",
  "roles",
];

const ID_PREFIX_TABLES: Record<GlobalSearchResource, string> = {
  users: "users",
  meters: "meters",
  readings: "readings",
  tasks: "tasks",
  invoices: "invoices",
  campaigns: "billing_campaigns",
  tariffs: "tariff_plans",
  zones: "zones",
  cities: "cities",
  roles: "roles",
};

function buildSummary(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ");
}

function displayUserName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.username || user.email || user.phone || "";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function buildBillingListHref(path: string, query: string) {
  const params = new URLSearchParams({ q: query });
  return `${path}?${params.toString()}`;
}

function compareRankedItems(left: RankedSearchItem, right: RankedSearchItem) {
  return (
    right.score - left.score ||
    right.createdAt - left.createdAt ||
    RESOURCE_TIE_BREAKER.indexOf(left.item.resource) - RESOURCE_TIE_BREAKER.indexOf(right.item.resource)
  );
}

function rankItem(
  resource: GlobalSearchResource,
  item: GlobalSearchItem,
  profile: SearchQueryProfile,
  fields: WeightedSearchField[],
  createdAt: Date
): RankedSearchItem {
  return {
    item,
    score: rankWeightedFields(profile, fields),
    createdAt: createdAt.getTime(),
  };
}

async function findIdPrefixMatches(
  resource: GlobalSearchResource,
  uuidPrefix: string | null,
  limit: number
) {
  if (!uuidPrefix) return [];

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id::text AS id
     FROM "${ID_PREFIX_TABLES[resource]}"
     WHERE "deleted_at" IS NULL
       AND CAST("id" AS text) ILIKE $1
     ORDER BY "created_at" DESC
     LIMIT ${Math.max(limit, 1)}`,
    `${uuidPrefix}%`
  );

  return rows.map((row) => row.id);
}

async function findCompactMatches(
  resource: GlobalSearchResource,
  compactQuery: string,
  limit: number
) {
  if (compactQuery.length < 4) return [];

  const pattern = `${compactQuery}%`;

  switch (resource) {
    case "meters": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT m.id::text AS id
         FROM "meters" m
         WHERE m."deleted_at" IS NULL
           AND (
             regexp_replace(lower(coalesce(m."serial_number", '')), '[^a-z0-9]+', '', 'g') LIKE $1
             OR regexp_replace(lower(coalesce(m."meter_reference", '')), '[^a-z0-9]+', '', 'g') LIKE $1
           )
         ORDER BY m."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    case "readings": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT r.id::text AS id
         FROM "readings" r
         JOIN "meters" m ON m.id = r."meter_id"
         WHERE r."deleted_at" IS NULL
           AND m."deleted_at" IS NULL
           AND (
             regexp_replace(lower(coalesce(m."serial_number", '')), '[^a-z0-9]+', '', 'g') LIKE $1
             OR regexp_replace(lower(coalesce(m."meter_reference", '')), '[^a-z0-9]+', '', 'g') LIKE $1
           )
         ORDER BY r."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    case "tasks": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT t.id::text AS id
         FROM "tasks" t
         JOIN "meters" m ON m.id = t."meter_id"
         WHERE t."deleted_at" IS NULL
           AND m."deleted_at" IS NULL
           AND (
             regexp_replace(lower(coalesce(m."serial_number", '')), '[^a-z0-9]+', '', 'g') LIKE $1
             OR regexp_replace(lower(coalesce(m."meter_reference", '')), '[^a-z0-9]+', '', 'g') LIKE $1
           )
         ORDER BY t."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    case "invoices": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT i.id::text AS id
         FROM "invoices" i
         JOIN "meters" m ON m.id = i."meter_id"
         WHERE i."deleted_at" IS NULL
           AND m."deleted_at" IS NULL
           AND (
             regexp_replace(lower(coalesce(i."invoice_number", '')), '[^a-z0-9]+', '', 'g') LIKE $1
             OR regexp_replace(lower(coalesce(m."serial_number", '')), '[^a-z0-9]+', '', 'g') LIKE $1
             OR regexp_replace(lower(coalesce(m."meter_reference", '')), '[^a-z0-9]+', '', 'g') LIKE $1
           )
         ORDER BY i."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    case "campaigns": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT c.id::text AS id
         FROM "billing_campaigns" c
         WHERE c."deleted_at" IS NULL
           AND regexp_replace(lower(coalesce(c."code", '')), '[^a-z0-9]+', '', 'g') LIKE $1
         ORDER BY c."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    case "tariffs": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT t.id::text AS id
         FROM "tariff_plans" t
         WHERE t."deleted_at" IS NULL
           AND regexp_replace(lower(coalesce(t."code", '')), '[^a-z0-9]+', '', 'g') LIKE $1
         ORDER BY t."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    case "zones": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT z.id::text AS id
         FROM "zones" z
         WHERE z."deleted_at" IS NULL
           AND regexp_replace(lower(coalesce(z."code", '')), '[^a-z0-9]+', '', 'g') LIKE $1
         ORDER BY z."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    case "cities": {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT c.id::text AS id
         FROM "cities" c
         WHERE c."deleted_at" IS NULL
           AND regexp_replace(lower(coalesce(c."code", '')), '[^a-z0-9]+', '', 'g') LIKE $1
         ORDER BY c."created_at" DESC
         LIMIT ${Math.max(limit, 1)}`,
        pattern
      );
      return rows.map((row) => row.id);
    }
    default:
      return [];
  }
}

function groupRankedItems(entries: RankedSearchItem[], limitPerGroup: number) {
  const grouped = new Map<GlobalSearchResource, RankedSearchItem[]>();

  for (const entry of entries.sort(compareRankedItems)) {
    const current = grouped.get(entry.item.resource) ?? [];
    if (current.length >= limitPerGroup) continue;
    current.push(entry);
    grouped.set(entry.item.resource, current);
  }

  return [...grouped.entries()]
    .map(([resource, items]) => ({
      resource,
      topScore: items[0]?.score ?? 0,
      items: items.map((item) => item.item),
    }))
    .sort(
      (left, right) =>
        right.topScore - left.topScore ||
        RESOURCE_TIE_BREAKER.indexOf(left.resource) - RESOURCE_TIE_BREAKER.indexOf(right.resource)
    )
    .map(({ resource, items }) => ({ resource, items }));
}

export async function searchAdminResources({
  query,
  permissionCodes,
  t,
  limitPerGroup = 5,
}: SearchParams): Promise<{ query: string; topResults: GlobalSearchItem[]; groups: GlobalSearchGroup[] }> {
  const profile = buildSearchQueryProfile(query);
  if (profile.normalizedQuery.length < 2) {
    return { query: profile.rawQuery, topResults: [], groups: [] };
  }

  const canSearchUsers = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.usersView);
  const canSearchMeters = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.metersView);
  const canSearchReadings = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsView);
  const canSearchTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksView);
  const canSearchInvoices = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.billingInvoicesView);
  const canSearchCampaigns = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.billingCampaignsView);
  const canSearchTariffs = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.billingTariffsView);
  const canSearchZones = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.billingZonesView);
  const canSearchCities = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.billingCitiesView);
  const canSearchRoles = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.rbacView);

  const queryMultiplier = Math.max(limitPerGroup * 3, 12);

  const [
    userPrefixIds,
    meterPrefixIds,
    readingPrefixIds,
    taskPrefixIds,
    invoicePrefixIds,
    campaignPrefixIds,
    tariffPrefixIds,
    zonePrefixIds,
    cityPrefixIds,
    rolePrefixIds,
  ] = await Promise.all([
    canSearchUsers ? findIdPrefixMatches("users", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchMeters ? findIdPrefixMatches("meters", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchReadings ? findIdPrefixMatches("readings", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchTasks ? findIdPrefixMatches("tasks", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchInvoices ? findIdPrefixMatches("invoices", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchCampaigns ? findIdPrefixMatches("campaigns", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchTariffs ? findIdPrefixMatches("tariffs", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchZones ? findIdPrefixMatches("zones", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchCities ? findIdPrefixMatches("cities", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
    canSearchRoles ? findIdPrefixMatches("roles", profile.uuidPrefix, queryMultiplier) : Promise.resolve([]),
  ]);

  const [
    meterCompactIds,
    readingCompactIds,
    taskCompactIds,
    invoiceCompactIds,
    campaignCompactIds,
    tariffCompactIds,
    zoneCompactIds,
    cityCompactIds,
  ] = await Promise.all([
    canSearchMeters ? findCompactMatches("meters", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
    canSearchReadings ? findCompactMatches("readings", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
    canSearchTasks ? findCompactMatches("tasks", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
    canSearchInvoices ? findCompactMatches("invoices", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
    canSearchCampaigns ? findCompactMatches("campaigns", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
    canSearchTariffs ? findCompactMatches("tariffs", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
    canSearchZones ? findCompactMatches("zones", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
    canSearchCities ? findCompactMatches("cities", profile.compactQuery, queryMultiplier) : Promise.resolve([]),
  ]);

  const queryTokens = profile.tokens;
  const digitQuery = profile.digitQuery;

  const [
    users,
    meters,
    readings,
    tasks,
    invoices,
    campaigns,
    tariffs,
    zones,
    cities,
    roles,
  ] = await Promise.all([
    canSearchUsers
      ? prisma.user.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(userPrefixIds.length ? [{ id: { in: userPrefixIds } }] : []),
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
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(meterPrefixIds.length ? [{ id: { in: meterPrefixIds } }] : []),
              ...(meterCompactIds.length ? [{ id: { in: meterCompactIds } }] : []),
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
            assignments: {
              where: { deletedAt: null, endedAt: null, customer: { deletedAt: null } },
              orderBy: { assignedAt: "desc" },
              take: 1,
              select: {
                customer: {
                  select: {
                    firstName: true,
                    lastName: true,
                    username: true,
                    phone: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    canSearchReadings
      ? prisma.reading.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(readingPrefixIds.length ? [{ id: { in: readingPrefixIds } }] : []),
              ...(readingCompactIds.length ? [{ id: { in: readingCompactIds } }] : []),
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
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(taskPrefixIds.length ? [{ id: { in: taskPrefixIds } }] : []),
              ...(taskCompactIds.length ? [{ id: { in: taskCompactIds } }] : []),
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
            description: true,
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
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(invoicePrefixIds.length ? [{ id: { in: invoicePrefixIds } }] : []),
              ...(invoiceCompactIds.length ? [{ id: { in: invoiceCompactIds } }] : []),
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
    canSearchCampaigns
      ? prisma.billingCampaign.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(campaignPrefixIds.length ? [{ id: { in: campaignPrefixIds } }] : []),
              ...(campaignCompactIds.length ? [{ id: { in: campaignCompactIds } }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { code: { contains: token, mode: "insensitive" } },
                    { name: { contains: token, mode: "insensitive" } },
                    { cityNameSnapshot: { contains: token, mode: "insensitive" } },
                    { zoneNameSnapshot: { contains: token, mode: "insensitive" } },
                    { tariffPlan: { code: { contains: token, mode: "insensitive" } } },
                    { tariffPlan: { name: { contains: token, mode: "insensitive" } } },
                    {
                      zones: {
                        some: {
                          deletedAt: null,
                          OR: [
                            { cityNameSnapshot: { contains: token, mode: "insensitive" } },
                            { zoneNameSnapshot: { contains: token, mode: "insensitive" } },
                            { zone: { name: { contains: token, mode: "insensitive" } } },
                            { zone: { code: { contains: token, mode: "insensitive" } } },
                            { zone: { city: { name: { contains: token, mode: "insensitive" } } } },
                          ],
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
            code: true,
            name: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            createdAt: true,
            tariffPlan: { select: { code: true, name: true, billingMode: true } },
            zones: {
              where: { deletedAt: null, zone: { deletedAt: null } },
              take: 2,
              select: {
                cityNameSnapshot: true,
                zoneNameSnapshot: true,
                zone: {
                  select: {
                    code: true,
                    name: true,
                    city: { select: { name: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    canSearchTariffs
      ? prisma.tariffPlan.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(tariffPrefixIds.length ? [{ id: { in: tariffPrefixIds } }] : []),
              ...(tariffCompactIds.length ? [{ id: { in: tariffCompactIds } }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { code: { contains: token, mode: "insensitive" } },
                    { name: { contains: token, mode: "insensitive" } },
                    { description: { contains: token, mode: "insensitive" } },
                    { serviceZone: { code: { contains: token, mode: "insensitive" } } },
                    { serviceZone: { name: { contains: token, mode: "insensitive" } } },
                    { serviceZone: { city: { name: { contains: token, mode: "insensitive" } } } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            code: true,
            name: true,
            billingMode: true,
            isActive: true,
            createdAt: true,
            serviceZone: {
              select: {
                code: true,
                name: true,
                city: { select: { name: true, region: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    canSearchZones
      ? prisma.zone.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(zonePrefixIds.length ? [{ id: { in: zonePrefixIds } }] : []),
              ...(zoneCompactIds.length ? [{ id: { in: zoneCompactIds } }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { code: { contains: token, mode: "insensitive" } },
                    { name: { contains: token, mode: "insensitive" } },
                    { city: { code: { contains: token, mode: "insensitive" } } },
                    { city: { name: { contains: token, mode: "insensitive" } } },
                    { city: { region: { contains: token, mode: "insensitive" } } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            createdAt: true,
            city: {
              select: {
                code: true,
                name: true,
                region: true,
              },
            },
            _count: {
              select: {
                meters: true,
                tariffPlans: true,
                campaignAssignments: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSearchCities
      ? prisma.city.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(cityPrefixIds.length ? [{ id: { in: cityPrefixIds } }] : []),
              ...(cityCompactIds.length ? [{ id: { in: cityCompactIds } }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { code: { contains: token, mode: "insensitive" } },
                    { name: { contains: token, mode: "insensitive" } },
                    { region: { contains: token, mode: "insensitive" } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          select: {
            id: true,
            code: true,
            name: true,
            region: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                zones: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSearchRoles
      ? prisma.role.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(profile.exactUuid ? [{ id: profile.exactUuid }] : []),
              ...(rolePrefixIds.length ? [{ id: { in: rolePrefixIds } }] : []),
              {
                AND: queryTokens.map((token) => ({
                  OR: [
                    { code: { contains: token, mode: "insensitive" } },
                    { name: { contains: token, mode: "insensitive" } },
                    { description: { contains: token, mode: "insensitive" } },
                  ],
                })),
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: queryMultiplier,
          include: {
            _count: {
              select: {
                permissions: { where: { deletedAt: null } },
                userAssignments: { where: { deletedAt: null } },
              },
            },
          },
        })
      : Promise.resolve([] as Array<Role & { _count: { permissions: number; userAssignments: number } }>),
  ]);

  const rankedItems: RankedSearchItem[] = [];

  if (canSearchUsers) {
    rankedItems.push(
      ...users.map((user) => {
        const title = displayUserName(user);
        return rankItem(
          "users",
          {
            id: user.id,
            resource: "users",
            title,
            subtitle: buildSummary([user.phone, user.username, user.email]),
            meta: buildSummary([
              translateUserRole(user.role as UserRole, t),
              translateUserStatus(user.status as UserStatus, t),
            ]),
            href: `/admin/users/${user.id}`,
          },
          profile,
          [
            { value: title, weight: 3.2 },
            { value: user.firstName, weight: 2.3 },
            { value: user.lastName, weight: 2.3 },
            { value: user.username, weight: 2 },
            { value: user.email, weight: 1.9 },
            { value: user.phone, weight: digitQuery.length >= 4 ? 2 : 1.2 },
            { value: user.id, weight: profile.uuidPrefix ? 2.2 : 0.4 },
          ],
          user.createdAt
        );
      })
    );
  }

  if (canSearchMeters) {
    rankedItems.push(
      ...meters.map((meter) => {
        const activeCustomer = meter.assignments[0]?.customer;
        return rankItem(
          "meters",
          {
            id: meter.id,
            resource: "meters",
            title: meter.serialNumber,
            subtitle: buildSummary([
              meter.meterReference || t("common.notAvailable"),
              [meter.city, meter.zone].filter(Boolean).join(" / ") || null,
              activeCustomer ? displayUserName(activeCustomer) : null,
            ]),
            meta: buildSummary([
              translateMeterStatus(meter.status as MeterStatus, t),
              meter.type === MeterType.DUAL_INDEX ? t("meters.typeDualIndex") : t("meters.typeSingleIndex"),
            ]),
            href: `/admin/meters/${meter.id}`,
          },
          profile,
          [
            { value: meter.serialNumber, weight: 3.1 },
            { value: meter.meterReference, weight: 2.8 },
            { value: meter.city, weight: 1.2 },
            { value: meter.zone, weight: 1.2 },
            { value: activeCustomer ? displayUserName(activeCustomer) : null, weight: 0.9 },
            { value: activeCustomer?.phone, weight: digitQuery.length >= 4 ? 1 : 0.6 },
            { value: meter.id, weight: profile.uuidPrefix ? 2.1 : 0.4 },
          ],
          meter.createdAt
        );
      })
    );
  }

  if (canSearchReadings) {
    rankedItems.push(
      ...readings.map((reading) =>
        rankItem(
          "readings",
          {
            id: reading.id,
            resource: "readings",
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
          profile,
          [
            { value: reading.meter.serialNumber, weight: 2.5 },
            { value: reading.meter.meterReference, weight: 2.2 },
            { value: displayUserName(reading.submittedBy), weight: 1.4 },
            { value: reading.submittedBy.username, weight: 1.2 },
            { value: reading.submittedBy.phone, weight: digitQuery.length >= 4 ? 1 : 0.6 },
            { value: reading.id, weight: profile.uuidPrefix ? 2.3 : 0.5 },
          ],
          reading.createdAt
        )
      )
    );
  }

  if (canSearchTasks) {
    rankedItems.push(
      ...tasks.map((task) =>
        rankItem(
          "tasks",
          {
            id: task.id,
            resource: "tasks",
            title: task.title,
            subtitle: buildSummary([
              shortId(task.id),
              task.meter?.serialNumber,
              task.meter?.meterReference,
            ]),
            meta: buildSummary([
              translateTaskStatus(task.status as TaskStatus, t),
              translateTaskPriority(task.priority as TaskPriority, t),
              task.assignedTo ? displayUserName(task.assignedTo) : null,
            ]),
            href: `/admin/tasks/${task.id}`,
          },
          profile,
          [
            { value: task.title, weight: 2.8 },
            { value: task.description, weight: 1.4 },
            { value: task.meter?.serialNumber, weight: 1.8 },
            { value: task.meter?.meterReference, weight: 1.6 },
            { value: task.assignedTo ? displayUserName(task.assignedTo) : null, weight: 1.1 },
            { value: task.id, weight: profile.uuidPrefix ? 2.2 : 0.5 },
          ],
          task.createdAt
        )
      )
    );
  }

  if (canSearchInvoices) {
    rankedItems.push(
      ...invoices.map((invoice) =>
        rankItem(
          "invoices",
          {
            id: invoice.id,
            resource: "invoices",
            title: invoice.invoiceNumber,
            subtitle: buildSummary([
              displayUserName(invoice.customer),
              invoice.meter.serialNumber,
              invoice.meter.meterReference,
            ]),
            meta: translateInvoiceStatus(invoice.status as InvoiceStatus, t),
            href: `/admin/billing/invoices/${invoice.id}`,
          },
          profile,
          [
            { value: invoice.invoiceNumber, weight: 3 },
            { value: displayUserName(invoice.customer), weight: 1.5 },
            { value: invoice.customer.phone, weight: digitQuery.length >= 4 ? 1 : 0.5 },
            { value: invoice.meter.serialNumber, weight: 1.8 },
            { value: invoice.meter.meterReference, weight: 1.6 },
            { value: invoice.id, weight: profile.uuidPrefix ? 2.3 : 0.5 },
          ],
          invoice.createdAt
        )
      )
    );
  }

  if (canSearchCampaigns) {
    rankedItems.push(
      ...campaigns.map((campaign) => {
        const zoneSummary =
          campaign.zones.length > 0
            ? campaign.zones
                .map((zone) => zone.zoneNameSnapshot || zone.zone.name || zone.zone.code || zone.cityNameSnapshot)
                .filter(Boolean)
                .join(", ")
            : null;

        return rankItem(
          "campaigns",
          {
            id: campaign.id,
            resource: "campaigns",
            title: campaign.code,
            subtitle: buildSummary([
              campaign.name,
              zoneSummary,
              `${campaign.periodStart.toISOString().slice(0, 10)} → ${campaign.periodEnd.toISOString().slice(0, 10)}`,
            ]),
            meta: buildSummary([
              translateBillingCampaignStatus(campaign.status as BillingCampaignStatus, t),
              campaign.tariffPlan?.code,
            ]),
            href: buildBillingListHref("/admin/billing/campaigns", campaign.code),
          },
          profile,
          [
            { value: campaign.code, weight: 3.1 },
            { value: campaign.name, weight: 2.2 },
            { value: campaign.tariffPlan?.code, weight: 1.4 },
            { value: campaign.tariffPlan?.name, weight: 1.3 },
            { value: zoneSummary, weight: 1.2 },
            { value: campaign.id, weight: profile.uuidPrefix ? 2.2 : 0.4 },
          ],
          campaign.createdAt
        );
      })
    );
  }

  if (canSearchTariffs) {
    rankedItems.push(
      ...tariffs.map((tariff) => {
        const zoneLabel = tariff.serviceZone
          ? buildSummary([
              tariff.serviceZone.city.name,
              tariff.serviceZone.name,
            ])
          : t("billing.globalOption");

        return rankItem(
          "tariffs",
          {
            id: tariff.id,
            resource: "tariffs",
            title: tariff.code,
            subtitle: buildSummary([tariff.name, zoneLabel]),
            meta: buildSummary([
              translateTariffBillingMode(tariff.billingMode as TariffBillingMode, t),
              tariff.isActive ? t("billing.active") : t("billing.inactive"),
            ]),
            href: buildBillingListHref("/admin/billing/tariffs", tariff.code),
          },
          profile,
          [
            { value: tariff.code, weight: 3.1 },
            { value: tariff.name, weight: 2.3 },
            { value: zoneLabel, weight: 1.4 },
            { value: tariff.id, weight: profile.uuidPrefix ? 2.2 : 0.4 },
          ],
          tariff.createdAt
        );
      })
    );
  }

  if (canSearchZones) {
    rankedItems.push(
      ...zones.map((zone) =>
        rankItem(
          "zones",
          {
            id: zone.id,
            resource: "zones",
            title: zone.code,
            subtitle: buildSummary([
              zone.name,
              zone.city.name,
              zone.city.region,
            ]),
            meta: buildSummary([
              zone.isActive ? t("billing.active") : t("billing.inactive"),
              `${zone._count.meters} ${t("billing.metersCount").toLowerCase()}`,
            ]),
            href: buildBillingListHref("/admin/billing/zones", zone.code),
          },
          profile,
          [
            { value: zone.code, weight: 3 },
            { value: zone.name, weight: 2.2 },
            { value: zone.city.name, weight: 1.4 },
            { value: zone.city.region, weight: 1.1 },
            { value: zone.id, weight: profile.uuidPrefix ? 2.2 : 0.4 },
          ],
          zone.createdAt
        )
      )
    );
  }

  if (canSearchCities) {
    rankedItems.push(
      ...cities.map((city) =>
        rankItem(
          "cities",
          {
            id: city.id,
            resource: "cities",
            title: city.name,
            subtitle: buildSummary([city.code, city.region]),
            meta: buildSummary([
              city.isActive ? t("billing.active") : t("billing.inactive"),
              `${city._count.zones} ${t("billing.zonesPageTitle").toLowerCase()}`,
            ]),
            href: buildBillingListHref("/admin/billing/cities", city.code),
          },
          profile,
          [
            { value: city.code, weight: 2.4 },
            { value: city.name, weight: 3 },
            { value: city.region, weight: 1.5 },
            { value: city.id, weight: profile.uuidPrefix ? 2.2 : 0.4 },
          ],
          city.createdAt
        )
      )
    );
  }

  if (canSearchRoles) {
    rankedItems.push(
      ...roles.map((role) =>
        rankItem(
          "roles",
          {
            id: role.id,
            resource: "roles",
            title: role.code,
            subtitle: buildSummary([role.name, role.description]),
            meta: buildSummary([
              `${role._count.permissions} ${t("rbac.permissionsCount").toLowerCase()}`,
              `${role._count.userAssignments} ${t("nav.users").toLowerCase()}`,
            ]),
            href: `/admin/rules-permissions/roles/${role.id}`,
          },
          profile,
          [
            { value: role.code, weight: 3.2 },
            { value: role.name, weight: 2.3 },
            { value: role.description, weight: 1.2 },
            { value: role.id, weight: profile.uuidPrefix ? 2.2 : 0.4 },
          ],
          role.createdAt
        )
      )
    );
  }

  const filteredRankedItems = rankedItems.filter((entry) => entry.score > 0);
  const topResults = [...filteredRankedItems]
    .sort(compareRankedItems)
    .slice(0, Math.max(Math.min(limitPerGroup + 2, 8), 5))
    .map((entry) => entry.item);

  return {
    query: profile.rawQuery,
    topResults,
    groups: groupRankedItems(filteredRankedItems, limitPerGroup),
  };
}
