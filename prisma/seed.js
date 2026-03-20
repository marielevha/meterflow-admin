const { randomBytes, scryptSync } = require("node:crypto");
const {
  PrismaClient,
  MeterStatus,
  MeterType,
  ReadingSource,
  ReadingStatus,
  TaskEventType,
  TaskItemStatus,
  TaskPriority,
  TaskResolutionCode,
  TaskStatus,
  TaskType,
  UserRole,
  UserStatus,
} = require("@prisma/client");

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
  { code: "reading-event:view", name: "View reading event audit trail", resource: "reading_event", action: "view" },
  { code: "reading:review", name: "Review reading", resource: "reading", action: "review" },
  { code: "reading:flag", name: "Flag reading", resource: "reading", action: "flag" },
  { code: "reading:reject", name: "Reject reading", resource: "reading", action: "reject" },
  { code: "task:create", name: "Create task", resource: "task", action: "create" },
  { code: "task:assign", name: "Assign task", resource: "task", action: "assign" },
  { code: "task:update", name: "Update task", resource: "task", action: "update" },
  { code: "user:manage", name: "Manage users", resource: "user", action: "manage" },
  { code: "meter:manage", name: "Manage meters", resource: "meter", action: "manage" },
  { code: "meter:import", name: "Import meters", resource: "meter", action: "import" },
  { code: "dashboard:view", name: "View dashboard", resource: "dashboard", action: "view" },
  { code: "audit:view", name: "View audit", resource: "audit", action: "view" },
];

const rolePermissionCodes = {
  CLIENT: ["reading:create", "reading:view"],
  AGENT: ["reading:view", "reading:review", "reading:flag", "reading:reject", "task:update", "dashboard:view"],
  SUPERVISOR: [
    "reading:view",
    "reading-event:view",
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
    "reading-event:view",
    "reading:review",
    "reading:flag",
    "reading:reject",
    "task:create",
    "task:assign",
    "task:update",
    "user:manage",
    "meter:manage",
    "meter:import",
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

const demoReadings = [
  {
    key: "client001-flagged-dual",
    meterSerialNumber: "MF-CG-BZV-0002",
    submittedByUsername: "client001",
    source: ReadingSource.CLIENT,
    status: ReadingStatus.FLAGGED,
    readingAt: "2026-03-18T08:20:00.000Z",
    primaryIndex: 648,
    secondaryIndex: 307,
    imageUrl: "https://demo.meterflow.local/readings/client001-flagged-dual.jpg",
    imageMimeType: "image/jpeg",
    imageSizeBytes: 228114,
    gpsLatitude: -4.2822,
    gpsLongitude: 15.2671,
    gpsAccuracyMeters: 12.5,
    flagReason: "gps_distance_exceeded",
  },
  {
    key: "client001-rejected-single",
    meterSerialNumber: "MF-CG-BZV-0001",
    submittedByUsername: "client001",
    source: ReadingSource.CLIENT,
    status: ReadingStatus.REJECTED,
    readingAt: "2026-03-19T09:05:00.000Z",
    primaryIndex: 1347,
    imageUrl: "https://demo.meterflow.local/readings/client001-rejected-single.jpg",
    imageMimeType: "image/jpeg",
    imageSizeBytes: 201442,
    gpsLatitude: -4.2718,
    gpsLongitude: 15.281,
    gpsAccuracyMeters: 9.2,
    rejectionReason: "blurry_image",
  },
  {
    key: "agent001-confirmed-single",
    meterSerialNumber: "MF-CG-BZV-0001",
    submittedByUsername: "agent001",
    reviewedByUsername: "agent001",
    source: ReadingSource.AGENT,
    status: ReadingStatus.VALIDATED,
    readingAt: "2026-03-18T10:45:00.000Z",
    primaryIndex: 1359,
    imageUrl: "https://demo.meterflow.local/readings/agent001-confirmed-single.jpg",
    imageMimeType: "image/jpeg",
    imageSizeBytes: 244910,
    gpsLatitude: -4.2721,
    gpsLongitude: 15.2808,
    gpsAccuracyMeters: 6.8,
    reviewedAt: "2026-03-18T10:52:00.000Z",
  },
];

const demoTasks = [
  {
    key: "agent001-overdue-recheck",
    title: "DEMO: Controle terrain urgent MF-CG-BZV-0002",
    description: "[seed-demo] Reprendre le releve client et verifier la coherence GPS sur site.",
    meterSerialNumber: "MF-CG-BZV-0002",
    readingKey: "client001-flagged-dual",
    assignedToUsername: "agent001",
    createdByUsername: "supervisor001",
    type: TaskType.FIELD_RECHECK,
    status: TaskStatus.OPEN,
    priority: TaskPriority.CRITICAL,
    dueAt: "2026-03-19T09:00:00.000Z",
  },
  {
    key: "agent001-in-progress-verification",
    title: "DEMO: Verification compteur MF-CG-BZV-0001",
    description: "[seed-demo] Confirmer l etat du compteur et preparer un nouveau releve terrain.",
    meterSerialNumber: "MF-CG-BZV-0001",
    readingKey: "client001-rejected-single",
    assignedToUsername: "agent001",
    createdByUsername: "supervisor001",
    startedByUsername: "agent001",
    type: TaskType.METER_VERIFICATION,
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    dueAt: "2026-03-20T14:00:00.000Z",
    startedAt: "2026-03-20T08:00:00.000Z",
  },
  {
    key: "agent001-open-today",
    title: "DEMO: Passage client MF-CG-BZV-0001",
    description: "[seed-demo] Mission terrain simple a planifier avec le client.",
    meterSerialNumber: "MF-CG-BZV-0001",
    assignedToUsername: "agent001",
    createdByUsername: "supervisor001",
    type: TaskType.GENERAL,
    status: TaskStatus.OPEN,
    priority: TaskPriority.MEDIUM,
    dueAt: "2026-03-20T16:30:00.000Z",
  },
  {
    key: "agent001-done-confirmed",
    title: "DEMO: Mission terminee MF-CG-BZV-0001",
    description: "[seed-demo] Mission cloturee avec releve terrain confirme.",
    meterSerialNumber: "MF-CG-BZV-0001",
    readingKey: "client001-rejected-single",
    reportedReadingKey: "agent001-confirmed-single",
    assignedToUsername: "agent001",
    createdByUsername: "supervisor001",
    startedByUsername: "agent001",
    closedByUsername: "agent001",
    type: TaskType.FIELD_RECHECK,
    status: TaskStatus.DONE,
    priority: TaskPriority.HIGH,
    dueAt: "2026-03-18T11:00:00.000Z",
    startedAt: "2026-03-18T10:20:00.000Z",
    fieldSubmittedAt: "2026-03-18T10:50:00.000Z",
    closedAt: "2026-03-18T10:55:00.000Z",
    resolutionCode: TaskResolutionCode.READING_CONFIRMED,
    resolutionComment: "Releve terrain confirme apres passage chez le client.",
    fieldPrimaryIndex: 1359,
    fieldImageUrl: "https://demo.meterflow.local/tasks/agent001-done-proof.jpg",
    fieldImageHash: "seed-demo-agent001-done-proof",
    fieldImageMimeType: "image/jpeg",
    fieldImageSizeBytes: 244910,
    fieldGpsLatitude: -4.2721,
    fieldGpsLongitude: 15.2808,
    fieldGpsAccuracyMeters: 6.8,
  },
  {
    key: "agent001-blocked-fraud",
    title: "DEMO: Fraude suspectee MF-CG-BZV-0002",
    description: "[seed-demo] Le terrain a remonte un besoin d escalade immediate.",
    meterSerialNumber: "MF-CG-BZV-0002",
    readingKey: "client001-flagged-dual",
    assignedToUsername: "agent001",
    createdByUsername: "supervisor001",
    startedByUsername: "agent001",
    type: TaskType.FRAUD_INVESTIGATION,
    status: TaskStatus.BLOCKED,
    priority: TaskPriority.CRITICAL,
    dueAt: "2026-03-20T11:30:00.000Z",
    startedAt: "2026-03-20T09:10:00.000Z",
    fieldSubmittedAt: "2026-03-20T09:45:00.000Z",
    resolutionCode: TaskResolutionCode.ESCALATION_REQUIRED,
    resolutionComment: "Compteur ouvert et incoherence visible. Escalade demandee.",
    fieldPrimaryIndex: 651,
    fieldSecondaryIndex: 309,
    fieldImageUrl: "https://demo.meterflow.local/tasks/agent001-blocked-proof.jpg",
    fieldImageHash: "seed-demo-agent001-blocked-proof",
    fieldImageMimeType: "image/jpeg",
    fieldImageSizeBytes: 251004,
    fieldGpsLatitude: -4.2823,
    fieldGpsLongitude: 15.2672,
    fieldGpsAccuracyMeters: 7.4,
  },
  {
    key: "agent002-open-check",
    title: "DEMO: Verification terrain MF-CG-PNR-0005",
    description: "[seed-demo] Mission de verification pour agent secondaire.",
    meterSerialNumber: "MF-CG-PNR-0005",
    assignedToUsername: "agent002",
    createdByUsername: "supervisor001",
    type: TaskType.METER_VERIFICATION,
    status: TaskStatus.OPEN,
    priority: TaskPriority.MEDIUM,
    dueAt: "2026-03-21T10:00:00.000Z",
  },
  {
    key: "agent003-open-check",
    title: "DEMO: Verification terrain MF-SN-DKR-0003",
    description: "[seed-demo] Mission de verification pour l equipe Dakar.",
    meterSerialNumber: "MF-SN-DKR-0003",
    assignedToUsername: "agent003",
    createdByUsername: "supervisor002",
    type: TaskType.METER_VERIFICATION,
    status: TaskStatus.OPEN,
    priority: TaskPriority.MEDIUM,
    dueAt: "2026-03-21T15:00:00.000Z",
  },
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

  const readingByKey = {};
  for (const reading of demoReadings) {
    const meter = meterBySerial[reading.meterSerialNumber];
    const submittedBy = userByUsername[reading.submittedByUsername];
    const reviewedBy = reading.reviewedByUsername ? userByUsername[reading.reviewedByUsername] : null;

    if (!meter) {
      throw new Error(`Missing meter for demo reading ${reading.key}: ${reading.meterSerialNumber}`);
    }

    if (!submittedBy) {
      throw new Error(`Missing submittedBy user for demo reading ${reading.key}: ${reading.submittedByUsername}`);
    }

    const readingAt = new Date(reading.readingAt);
    const existingReading = await prisma.reading.findFirst({
      where: {
        meterId: meter.id,
        submittedById: submittedBy.id,
        source: reading.source,
        readingAt,
        deletedAt: null,
      },
      select: { id: true },
    });

    const data = {
      meterId: meter.id,
      submittedById: submittedBy.id,
      reviewedById: reviewedBy?.id ?? null,
      source: reading.source,
      status: reading.status,
      readingAt,
      primaryIndex: reading.primaryIndex,
      secondaryIndex: reading.secondaryIndex ?? null,
      imageUrl: reading.imageUrl,
      imageMimeType: reading.imageMimeType,
      imageSizeBytes: reading.imageSizeBytes,
      gpsLatitude: reading.gpsLatitude,
      gpsLongitude: reading.gpsLongitude,
      gpsAccuracyMeters: reading.gpsAccuracyMeters,
      reviewedAt: reading.reviewedAt ? new Date(reading.reviewedAt) : null,
      flagReason: reading.flagReason ?? null,
      rejectionReason: reading.rejectionReason ?? null,
      deletedAt: null,
    };

    const savedReading = existingReading
      ? await prisma.reading.update({
          where: { id: existingReading.id },
          data,
        })
      : await prisma.reading.create({
          data,
        });

    readingByKey[reading.key] = savedReading;
  }

  const demoTaskTitles = demoTasks.map((task) => task.title);
  const existingDemoTasks = await prisma.task.findMany({
    where: {
      title: { in: demoTaskTitles },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
    },
  });

  const existingDemoTaskIds = existingDemoTasks.map((task) => task.id);
  if (existingDemoTaskIds.length > 0) {
    const existingEventIds = (
      await prisma.taskEvent.findMany({
        where: { taskId: { in: existingDemoTaskIds } },
        select: { id: true },
      })
    ).map((event) => event.id);

    if (existingEventIds.length > 0) {
      await prisma.agentNotificationRead.deleteMany({
        where: {
          taskEventId: { in: existingEventIds },
        },
      });
    }

    await prisma.taskEvent.deleteMany({
      where: { taskId: { in: existingDemoTaskIds } },
    });
    await prisma.taskAttachment.deleteMany({
      where: { taskId: { in: existingDemoTaskIds } },
    });
    await prisma.taskComment.deleteMany({
      where: { taskId: { in: existingDemoTaskIds } },
    });
    await prisma.taskItem.deleteMany({
      where: { taskId: { in: existingDemoTaskIds } },
    });
  }

  const taskByKey = {};
  for (const task of demoTasks) {
    const meter = meterBySerial[task.meterSerialNumber];
    const assignedTo = userByUsername[task.assignedToUsername];
    const createdBy = userByUsername[task.createdByUsername];
    const startedBy = task.startedByUsername ? userByUsername[task.startedByUsername] : null;
    const closedBy = task.closedByUsername ? userByUsername[task.closedByUsername] : null;
    const reading = task.readingKey ? readingByKey[task.readingKey] : null;
    const reportedReading = task.reportedReadingKey ? readingByKey[task.reportedReadingKey] : null;

    if (!meter) {
      throw new Error(`Missing meter for demo task ${task.key}: ${task.meterSerialNumber}`);
    }

    if (!assignedTo || !createdBy) {
      throw new Error(`Missing users for demo task ${task.key}`);
    }

    const existingTask = await prisma.task.findFirst({
      where: {
        title: task.title,
        assignedToId: assignedTo.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    const data = {
      meterId: meter.id,
      readingId: reading?.id ?? null,
      reportedReadingId: reportedReading?.id ?? null,
      assignedToId: assignedTo.id,
      createdById: createdBy.id,
      closedById: closedBy?.id ?? null,
      startedById: startedBy?.id ?? null,
      type: task.type,
      status: task.status,
      priority: task.priority,
      resolutionCode: task.resolutionCode ?? null,
      title: task.title,
      description: task.description,
      resolutionComment: task.resolutionComment ?? null,
      dueAt: task.dueAt ? new Date(task.dueAt) : null,
      startedAt: task.startedAt ? new Date(task.startedAt) : null,
      fieldSubmittedAt: task.fieldSubmittedAt ? new Date(task.fieldSubmittedAt) : null,
      closedAt: task.closedAt ? new Date(task.closedAt) : null,
      fieldPrimaryIndex: task.fieldPrimaryIndex ?? null,
      fieldSecondaryIndex: task.fieldSecondaryIndex ?? null,
      fieldImageUrl: task.fieldImageUrl ?? null,
      fieldImageHash: task.fieldImageHash ?? null,
      fieldImageMimeType: task.fieldImageMimeType ?? null,
      fieldImageSizeBytes: task.fieldImageSizeBytes ?? null,
      fieldGpsLatitude: task.fieldGpsLatitude ?? null,
      fieldGpsLongitude: task.fieldGpsLongitude ?? null,
      fieldGpsAccuracyMeters: task.fieldGpsAccuracyMeters ?? null,
      deletedAt: null,
    };

    const savedTask = existingTask
      ? await prisma.task.update({
          where: { id: existingTask.id },
          data,
        })
      : await prisma.task.create({
          data,
        });

    taskByKey[task.key] = savedTask;
  }

  await prisma.taskItem.createMany({
    data: [
      {
        taskId: taskByKey["agent001-overdue-recheck"].id,
        meterId: meterBySerial["MF-CG-BZV-0002"].id,
        title: "Verifier la photo du client",
        details: "Comparer la photo soumise et l etat reel du compteur.",
        status: TaskItemStatus.TODO,
        sortOrder: 1,
      },
      {
        taskId: taskByKey["agent001-overdue-recheck"].id,
        meterId: meterBySerial["MF-CG-BZV-0002"].id,
        title: "Confirmer la position GPS sur site",
        details: "Verifier la correspondance entre le compteur et les coordonnees.",
        status: TaskItemStatus.TODO,
        sortOrder: 2,
      },
      {
        taskId: taskByKey["agent001-in-progress-verification"].id,
        meterId: meterBySerial["MF-CG-BZV-0001"].id,
        completedById: userByUsername.agent001.id,
        title: "Prendre contact avec le client",
        details: "Contact etabli pour le passage terrain.",
        status: TaskItemStatus.DONE,
        sortOrder: 1,
        completedAt: new Date("2026-03-20T08:05:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-in-progress-verification"].id,
        meterId: meterBySerial["MF-CG-BZV-0001"].id,
        title: "Confirmer l index sur site",
        details: "Comparer le releve saisi et la valeur observee.",
        status: TaskItemStatus.TODO,
        sortOrder: 2,
      },
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        meterId: meterBySerial["MF-CG-BZV-0001"].id,
        completedById: userByUsername.agent001.id,
        title: "Reprendre une photo nette",
        details: "Photo terrain capturee et archivee.",
        status: TaskItemStatus.DONE,
        sortOrder: 1,
        completedAt: new Date("2026-03-18T10:32:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        meterId: meterBySerial["MF-CG-BZV-0001"].id,
        completedById: userByUsername.agent001.id,
        title: "Confirmer le nouvel index",
        details: "Releve agent valide et transmis.",
        status: TaskItemStatus.DONE,
        sortOrder: 2,
        completedAt: new Date("2026-03-18T10:50:00.000Z"),
      },
    ],
  });

  await prisma.taskComment.createMany({
    data: [
      {
        taskId: taskByKey["agent001-overdue-recheck"].id,
        userId: userByUsername.supervisor001.id,
        comment: "Priorite haute. Le client a deja soumis un relevé incoherent.",
        isInternal: true,
        createdAt: new Date("2026-03-19T08:45:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-in-progress-verification"].id,
        userId: userByUsername.agent001.id,
        comment: "Passage planifie ce matin. Verification compteur en cours.",
        isInternal: true,
        createdAt: new Date("2026-03-20T08:10:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        userId: userByUsername.agent001.id,
        comment: "Le compteur etait accessible. Nouvel index confirme sur site.",
        isInternal: true,
        createdAt: new Date("2026-03-18T10:54:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-blocked-fraud"].id,
        userId: userByUsername.agent001.id,
        comment: "Compteur ouvert. Besoin d une reprise superviseur.",
        isInternal: true,
        createdAt: new Date("2026-03-20T09:46:00.000Z"),
      },
    ],
  });

  await prisma.taskAttachment.createMany({
    data: [
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        uploadedById: userByUsername.agent001.id,
        fileUrl: "https://demo.meterflow.local/tasks/agent001-done-proof.jpg",
        fileName: "agent001-done-proof.jpg",
        mimeType: "image/jpeg",
        fileHash: "seed-demo-agent001-done-proof",
        fileSizeBytes: 244910,
        createdAt: new Date("2026-03-18T10:50:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-blocked-fraud"].id,
        uploadedById: userByUsername.agent001.id,
        fileUrl: "https://demo.meterflow.local/tasks/agent001-blocked-proof.jpg",
        fileName: "agent001-blocked-proof.jpg",
        mimeType: "image/jpeg",
        fileHash: "seed-demo-agent001-blocked-proof",
        fileSizeBytes: 251004,
        createdAt: new Date("2026-03-20T09:45:00.000Z"),
      },
    ],
  });

  const createdTaskEvents = [];
  for (const event of [
      {
        taskId: taskByKey["agent001-overdue-recheck"].id,
        actorUserId: userByUsername.supervisor001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.ASSIGNED,
        payload: { source: "seed", nextStatus: TaskStatus.OPEN },
        createdAt: new Date("2026-03-19T08:46:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-in-progress-verification"].id,
        actorUserId: userByUsername.supervisor001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.ASSIGNED,
        payload: { source: "seed", nextStatus: TaskStatus.OPEN },
        createdAt: new Date("2026-03-19T17:20:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-in-progress-verification"].id,
        actorUserId: userByUsername.agent001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.STARTED,
        payload: { source: "seed", previousStatus: TaskStatus.OPEN, nextStatus: TaskStatus.IN_PROGRESS },
        createdAt: new Date("2026-03-20T08:00:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-open-today"].id,
        actorUserId: userByUsername.supervisor001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.ASSIGNED,
        payload: { source: "seed", nextStatus: TaskStatus.OPEN },
        createdAt: new Date("2026-03-20T07:15:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        actorUserId: userByUsername.supervisor001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.ASSIGNED,
        payload: { source: "seed", nextStatus: TaskStatus.OPEN },
        createdAt: new Date("2026-03-18T09:10:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        actorUserId: userByUsername.agent001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.STARTED,
        payload: { source: "seed", previousStatus: TaskStatus.OPEN, nextStatus: TaskStatus.IN_PROGRESS },
        createdAt: new Date("2026-03-18T10:20:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        actorUserId: userByUsername.agent001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.FIELD_RESULT_SUBMITTED,
        payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.DONE, resolutionCode: TaskResolutionCode.READING_CONFIRMED },
        createdAt: new Date("2026-03-18T10:50:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-done-confirmed"].id,
        actorUserId: userByUsername.agent001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.COMPLETED,
        payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.DONE },
        createdAt: new Date("2026-03-18T10:55:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-blocked-fraud"].id,
        actorUserId: userByUsername.supervisor001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.ASSIGNED,
        payload: { source: "seed", nextStatus: TaskStatus.OPEN },
        createdAt: new Date("2026-03-20T08:30:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-blocked-fraud"].id,
        actorUserId: userByUsername.agent001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.STARTED,
        payload: { source: "seed", previousStatus: TaskStatus.OPEN, nextStatus: TaskStatus.IN_PROGRESS },
        createdAt: new Date("2026-03-20T09:10:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-blocked-fraud"].id,
        actorUserId: userByUsername.agent001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.FIELD_RESULT_SUBMITTED,
        payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.BLOCKED, resolutionCode: TaskResolutionCode.ESCALATION_REQUIRED },
        createdAt: new Date("2026-03-20T09:45:00.000Z"),
      },
      {
        taskId: taskByKey["agent001-blocked-fraud"].id,
        actorUserId: userByUsername.agent001.id,
        recipientUserId: userByUsername.agent001.id,
        type: TaskEventType.BLOCKED,
        payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.BLOCKED, resolutionCode: TaskResolutionCode.ESCALATION_REQUIRED },
        createdAt: new Date("2026-03-20T09:47:00.000Z"),
      },
      {
        taskId: taskByKey["agent002-open-check"].id,
        actorUserId: userByUsername.supervisor001.id,
        recipientUserId: userByUsername.agent002.id,
        type: TaskEventType.ASSIGNED,
        payload: { source: "seed", nextStatus: TaskStatus.OPEN },
        createdAt: new Date("2026-03-20T11:15:00.000Z"),
      },
      {
        taskId: taskByKey["agent003-open-check"].id,
        actorUserId: userByUsername.supervisor002.id,
        recipientUserId: userByUsername.agent003.id,
        type: TaskEventType.ASSIGNED,
        payload: { source: "seed", nextStatus: TaskStatus.OPEN },
        createdAt: new Date("2026-03-20T11:40:00.000Z"),
      },
    ]) {
    const createdEvent = await prisma.taskEvent.create({ data: event });
    createdTaskEvents.push(createdEvent);
  }

  const eventIdByTaskAndType = Object.fromEntries(
    createdTaskEvents.map((event) => [`${event.taskId}:${event.type}:${event.createdAt.toISOString()}`, event.id])
  );

  await prisma.agentNotificationRead.createMany({
    data: [
      {
        userId: userByUsername.agent001.id,
        taskEventId: eventIdByTaskAndType[`${taskByKey["agent001-done-confirmed"].id}:${TaskEventType.ASSIGNED}:2026-03-18T09:10:00.000Z`],
        readAt: new Date("2026-03-18T09:20:00.000Z"),
      },
      {
        userId: userByUsername.agent001.id,
        taskEventId: eventIdByTaskAndType[`${taskByKey["agent001-done-confirmed"].id}:${TaskEventType.STARTED}:2026-03-18T10:20:00.000Z`],
        readAt: new Date("2026-03-18T10:25:00.000Z"),
      },
      {
        userId: userByUsername.agent001.id,
        taskEventId: eventIdByTaskAndType[`${taskByKey["agent001-done-confirmed"].id}:${TaskEventType.FIELD_RESULT_SUBMITTED}:2026-03-18T10:50:00.000Z`],
        readAt: new Date("2026-03-18T10:56:00.000Z"),
      },
      {
        userId: userByUsername.agent001.id,
        taskEventId: eventIdByTaskAndType[`${taskByKey["agent001-done-confirmed"].id}:${TaskEventType.COMPLETED}:2026-03-18T10:55:00.000Z`],
        readAt: new Date("2026-03-18T10:57:00.000Z"),
      },
    ].filter((entry) => entry.taskEventId)
  });

  console.log("Seed complete: roles, permissions, users, meters, meter states, demo readings and demo tasks inserted.");
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
