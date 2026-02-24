/* eslint-disable no-console */
const { randomBytes, scryptSync } = require("node:crypto");
const { PrismaClient, MeterStatus, MeterType, UserRole, UserStatus } = require("@prisma/client");

const prisma = new PrismaClient();
const DEMO_PASSWORD = "ChangeMe@123";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

const roles = [
  { code: "CLIENT", name: "Client", description: "Abonne qui soumet ses releves." },
  { code: "AGENT", name: "Agent", description: "Agent terrain qui traite les releves." },
  { code: "SUPERVISOR", name: "Supervisor", description: "Superviseur operationnel." },
  { code: "ADMIN", name: "Admin", description: "Administrateur plateforme." },
];

const permissions = [
  { code: "reading:create", name: "Create reading", resource: "reading", action: "create" },
  { code: "reading:view", name: "View reading", resource: "reading", action: "view" },
  { code: "reading:review", name: "Review reading", resource: "reading", action: "review" },
  { code: "reading:flag", name: "Flag reading", resource: "reading", action: "flag" },
  { code: "reading:reject", name: "Reject reading", resource: "reading", action: "reject" },
  { code: "task:create", name: "Create task", resource: "task", action: "create" },
  { code: "task:assign", name: "Assign task", resource: "task", action: "assign" },
  { code: "task:update", name: "Update task", resource: "task", action: "update" },
  { code: "user:manage", name: "Manage users", resource: "user", action: "manage" },
  { code: "meter:manage", name: "Manage meters", resource: "meter", action: "manage" },
  { code: "dashboard:view", name: "View dashboard", resource: "dashboard", action: "view" },
  { code: "audit:view", name: "View audit", resource: "audit", action: "view" },
];

const rolePermissionCodes = {
  CLIENT: ["reading:create", "reading:view"],
  AGENT: ["reading:view", "reading:review", "reading:flag", "reading:reject", "task:update", "dashboard:view"],
  SUPERVISOR: [
    "reading:view",
    "reading:review",
    "reading:flag",
    "reading:reject",
    "task:create",
    "task:assign",
    "task:update",
    "dashboard:view",
    "audit:view",
  ],
  ADMIN: [
    "reading:create",
    "reading:view",
    "reading:review",
    "reading:flag",
    "reading:reject",
    "task:create",
    "task:assign",
    "task:update",
    "user:manage",
    "meter:manage",
    "dashboard:view",
    "audit:view",
  ],
};

const users = [
  { phone: "+242060000001", username: "admin001", email: "admin@meterflow.local", firstName: "Helene", lastName: "Ngoma", role: UserRole.ADMIN, status: UserStatus.ACTIVE, region: "Congo-Brazzaville", city: "Brazzaville", zone: "Plateaux" },
  { phone: "+242060000002", username: "supervisor001", email: "supervisor1@meterflow.local", firstName: "Armel", lastName: "Mabiala", role: UserRole.SUPERVISOR, status: UserStatus.ACTIVE, region: "Congo-Brazzaville", city: "Pointe-Noire", zone: "Lumumba" },
  { phone: "+221700000003", username: "supervisor002", email: "supervisor2@meterflow.local", firstName: "Fatou", lastName: "Sow", role: UserRole.SUPERVISOR, status: UserStatus.ACTIVE, region: "Senegal", city: "Dakar", zone: "Plateau" },
  { phone: "+242060000004", username: "agent001", email: "agent1@meterflow.local", firstName: "Junior", lastName: "Nkouka", role: UserRole.AGENT, status: UserStatus.ACTIVE, region: "Congo-Brazzaville", city: "Brazzaville", zone: "Bacongo" },
  { phone: "+242060000005", username: "agent002", email: "agent2@meterflow.local", firstName: "Merveille", lastName: "Itsoua", role: UserRole.AGENT, status: UserStatus.ACTIVE, region: "Congo-Brazzaville", city: "Dolisie", zone: "Centre" },
  { phone: "+221700000006", username: "agent003", email: "agent3@meterflow.local", firstName: "Khadija", lastName: "Mbaye", role: UserRole.AGENT, status: UserStatus.ACTIVE, region: "Senegal", city: "Dakar", zone: "Parcelles" },
  { phone: "+242060000007", username: "client001", email: "client1@meterflow.local", firstName: "Prince", lastName: "Tati", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Congo-Brazzaville", city: "Brazzaville", zone: "Makélékélé" },
  { phone: "+221700000008", username: "client002", email: "client2@meterflow.local", firstName: "Rokhaya", lastName: "Diop", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Senegal", city: "Dakar", zone: "Mermoz" },
  { phone: "+242060000009", username: "client003", email: "client3@meterflow.local", firstName: "Brice", lastName: "Louzolo", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Congo-Brazzaville", city: "Pointe-Noire", zone: "Tié-Tié" },
  { phone: "+221700000010", username: "client004", email: "client4@meterflow.local", firstName: "Mariama", lastName: "Faye", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Senegal", city: "Dakar", zone: "Almadies" },
];

const meters = [
  {
    serialNumber: "MF-CG-BZV-0001",
    meterReference: "CG-BZV-0001",
    customerUsername: "client001",
    assignedAgentUsername: "agent001",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Avenue de la Paix, Makélékélé",
    city: "Brazzaville",
    zone: "Makélékélé",
    latitude: -4.2721,
    longitude: 15.2807,
  },
  {
    serialNumber: "MF-CG-BZV-0002",
    meterReference: "CG-BZV-0002",
    customerUsername: "client001",
    assignedAgentUsername: "agent001",
    type: MeterType.DUAL_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Rue Mikalou, Bacongo",
    city: "Brazzaville",
    zone: "Bacongo",
    latitude: -4.2824,
    longitude: 15.2669,
  },
  {
    serialNumber: "MF-SN-DKR-0003",
    meterReference: "SN-DKR-0003",
    customerUsername: "client002",
    assignedAgentUsername: "agent003",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Zone B, Mermoz",
    city: "Dakar",
    zone: "Mermoz",
    latitude: 14.7076,
    longitude: -17.4698,
  },
  {
    serialNumber: "MF-SN-DKR-0004",
    meterReference: "SN-DKR-0004",
    customerUsername: "client002",
    assignedAgentUsername: "agent003",
    type: MeterType.DUAL_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Cite Mixta, Parcelles",
    city: "Dakar",
    zone: "Parcelles",
    latitude: 14.7703,
    longitude: -17.4239,
  },
  {
    serialNumber: "MF-CG-PNR-0005",
    meterReference: "CG-PNR-0005",
    customerUsername: "client003",
    assignedAgentUsername: "agent002",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Avenue Tchicaya, Tié-Tié",
    city: "Pointe-Noire",
    zone: "Tié-Tié",
    latitude: -4.7835,
    longitude: 11.8635,
  },
  {
    serialNumber: "MF-SN-DKR-0006",
    meterReference: "SN-DKR-0006",
    customerUsername: "client004",
    assignedAgentUsername: "agent003",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Route des Almadies",
    city: "Dakar",
    zone: "Almadies",
    latitude: 14.7436,
    longitude: -17.5221,
  },
];

const meterStates = [
  { serialNumber: "MF-CG-BZV-0001", effectiveAt: "2026-01-01T08:00:00.000Z", previousPrimary: 1200, currentPrimary: 1260 },
  { serialNumber: "MF-CG-BZV-0001", effectiveAt: "2026-02-01T08:00:00.000Z", previousPrimary: 1260, currentPrimary: 1328 },

  { serialNumber: "MF-CG-BZV-0002", effectiveAt: "2026-01-01T08:15:00.000Z", previousPrimary: 540, previousSecondary: 240, currentPrimary: 586, currentSecondary: 265 },
  { serialNumber: "MF-CG-BZV-0002", effectiveAt: "2026-02-01T08:15:00.000Z", previousPrimary: 586, previousSecondary: 265, currentPrimary: 631, currentSecondary: 292 },

  { serialNumber: "MF-SN-DKR-0003", effectiveAt: "2026-01-03T09:00:00.000Z", previousPrimary: 890, currentPrimary: 955 },
  { serialNumber: "MF-SN-DKR-0003", effectiveAt: "2026-02-03T09:00:00.000Z", previousPrimary: 955, currentPrimary: 1019 },

  { serialNumber: "MF-SN-DKR-0004", effectiveAt: "2026-01-03T09:20:00.000Z", previousPrimary: 340, previousSecondary: 110, currentPrimary: 378, currentSecondary: 128 },
  { serialNumber: "MF-SN-DKR-0004", effectiveAt: "2026-02-03T09:20:00.000Z", previousPrimary: 378, previousSecondary: 128, currentPrimary: 417, currentSecondary: 149 },

  { serialNumber: "MF-CG-PNR-0005", effectiveAt: "2026-01-05T10:00:00.000Z", previousPrimary: 620, currentPrimary: 671 },
  { serialNumber: "MF-CG-PNR-0005", effectiveAt: "2026-02-05T10:00:00.000Z", previousPrimary: 671, currentPrimary: 727 },

  { serialNumber: "MF-SN-DKR-0006", effectiveAt: "2026-01-07T10:10:00.000Z", previousPrimary: 410, currentPrimary: 455 },
  { serialNumber: "MF-SN-DKR-0006", effectiveAt: "2026-02-07T10:10:00.000Z", previousPrimary: 455, currentPrimary: 501 },
];

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, deletedAt: null },
      create: role,
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { ...permission, deletedAt: null },
      create: permission,
    });
  }

  const roleByCode = Object.fromEntries(
    (await prisma.role.findMany({ where: { deletedAt: null } })).map((r) => [r.code, r])
  );
  const permissionByCode = Object.fromEntries(
    (await prisma.permission.findMany({ where: { deletedAt: null } })).map((p) => [p.code, p])
  );

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionCodes)) {
    const role = roleByCode[roleCode];
    for (const permissionCode of permissionCodes) {
      const permission = permissionByCode[permissionCode];
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { deletedAt: null },
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const createdUsers = [];
  const passwordHash = hashPassword(DEMO_PASSWORD);
  for (const user of users) {
    const activatedAt = user.status === UserStatus.ACTIVE ? new Date() : null;
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: user.phone },
          { email: user.email },
          { username: user.username },
        ],
      },
      select: { id: true },
    });

    const saved = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { ...user, passwordHash, activatedAt, deletedAt: null },
        })
      : await prisma.user.create({
          data: { ...user, passwordHash, activatedAt },
        });
    createdUsers.push(saved);
  }

  const admin = createdUsers.find((u) => u.role === UserRole.ADMIN) || createdUsers[0];
  const userByUsername = Object.fromEntries(createdUsers.map((u) => [u.username, u]));

  for (const user of createdUsers) {
    const roleCode = user.role;
    const role = roleByCode[roleCode];
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: { assignedById: admin.id, deletedAt: null },
      create: { userId: user.id, roleId: role.id, assignedById: admin.id },
    });
  }

  const createdMeters = [];
  for (const meter of meters) {
    const customer = userByUsername[meter.customerUsername];
    const agent = userByUsername[meter.assignedAgentUsername];

    if (!customer) {
      throw new Error(`Missing customer user for meter ${meter.serialNumber}: ${meter.customerUsername}`);
    }

    const savedMeter = await prisma.meter.upsert({
      where: { serialNumber: meter.serialNumber },
      update: {
        meterReference: meter.meterReference,
        customerId: customer.id,
        assignedAgentId: agent?.id ?? null,
        type: meter.type,
        status: meter.status,
        addressLine1: meter.addressLine1,
        city: meter.city,
        zone: meter.zone,
        latitude: meter.latitude,
        longitude: meter.longitude,
        installedAt: new Date("2025-06-01T09:00:00.000Z"),
        lastInspectionAt: new Date("2026-02-10T11:00:00.000Z"),
        deletedAt: null,
      },
      create: {
        serialNumber: meter.serialNumber,
        meterReference: meter.meterReference,
        customerId: customer.id,
        assignedAgentId: agent?.id ?? null,
        type: meter.type,
        status: meter.status,
        addressLine1: meter.addressLine1,
        city: meter.city,
        zone: meter.zone,
        latitude: meter.latitude,
        longitude: meter.longitude,
        installedAt: new Date("2025-06-01T09:00:00.000Z"),
        lastInspectionAt: new Date("2026-02-10T11:00:00.000Z"),
      },
    });

    createdMeters.push(savedMeter);
  }

  const meterBySerial = Object.fromEntries(createdMeters.map((m) => [m.serialNumber, m]));

  for (const state of meterStates) {
    const meter = meterBySerial[state.serialNumber];
    if (!meter) {
      throw new Error(`Missing meter for meter state seed: ${state.serialNumber}`);
    }

    const effectiveAt = new Date(state.effectiveAt);
    const existingState = await prisma.meterState.findFirst({
      where: {
        meterId: meter.id,
        effectiveAt,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingState) {
      await prisma.meterState.update({
        where: { id: existingState.id },
        data: {
          previousPrimary: state.previousPrimary,
          previousSecondary: state.previousSecondary ?? null,
          currentPrimary: state.currentPrimary,
          currentSecondary: state.currentSecondary ?? null,
          deletedAt: null,
        },
      });
    } else {
      await prisma.meterState.create({
        data: {
          meterId: meter.id,
          previousPrimary: state.previousPrimary,
          previousSecondary: state.previousSecondary ?? null,
          currentPrimary: state.currentPrimary,
          currentSecondary: state.currentSecondary ?? null,
          effectiveAt,
        },
      });
    }
  }

  console.log("Seed complete: roles, permissions, users, meters and meter states inserted.");
  console.log(`Demo password for all seeded users: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
