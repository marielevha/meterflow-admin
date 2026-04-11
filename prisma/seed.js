const { createHash, randomBytes, scryptSync } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const {
  PrismaClient,
  BillingCampaignStatus,
  DeliveryChannel,
  DeliveryStatus,
  InvoiceLineType,
  InvoiceStatus,
  MeterAssignmentSource,
  MeterStatus,
  MeterType,
  PaymentMethod,
  ReadingEventType,
  ReadingSource,
  ReadingStatus,
  ServicePhaseType,
  ServicePowerUnit,
  ServiceUsageCategory,
  TariffBillingMode,
  TaskEventType,
  TaskItemStatus,
  TaskPriority,
  TaskResolutionCode,
  TaskStatus,
  TaskType,
  TaxApplicationScope,
  TaxRuleType,
  UserRole,
  UserStatus,
} = require("@prisma/client");

const prisma = new PrismaClient();
const DEMO_PASSWORD = "ChangeMe@123";

const HISTORY_SNAPSHOTS = [
  "2025-10-01T07:00:00.000Z",
  "2025-11-01T07:00:00.000Z",
  "2025-12-01T07:00:00.000Z",
  "2026-01-01T07:00:00.000Z",
  "2026-02-01T07:00:00.000Z",
  "2026-03-01T07:00:00.000Z",
];

const LEGACY_DEMO_TASK_TITLES = [
  "DEMO: Controle terrain urgent MF-CG-BZV-0002",
  "DEMO: Verification compteur MF-CG-BZV-0001",
  "DEMO: Passage client MF-CG-BZV-0001",
  "DEMO: Mission terminee MF-CG-BZV-0001",
  "DEMO: Fraude suspectee MF-CG-BZV-0002",
  "DEMO: Verification terrain MF-CG-PNR-0005",
  "DEMO: Verification terrain MF-SN-DKR-0003",
];

const LEGACY_DEMO_METER_SERIALS = [
  "MF-CG-PNR-0005",
  "MF-SN-DKR-0003",
  "MF-SN-DKR-0004",
  "MF-SN-DKR-0006",
];

const roles = [
  { code: "CLIENT", name: "Client", description: "Abonne qui soumet ses releves." },
  { code: "AGENT", name: "Agent", description: "Agent terrain qui traite les releves." },
  { code: "SUPERVISOR", name: "Supervisor", description: "Superviseur operationnel." },
  { code: "ADMIN", name: "Admin", description: "Administrateur plateforme." },
];

const permissions = [
  { code: "reading:create", name: "Create reading", resource: "reading", action: "create" },
  { code: "reading:view", name: "View reading", resource: "reading", action: "view" },
  { code: "reading:image:view", name: "View reading image", resource: "reading_image", action: "view" },
  { code: "reading-event:view", name: "View reading event audit trail", resource: "reading_event", action: "view" },
  { code: "reading:update", name: "Update reading data", resource: "reading", action: "update" },
  { code: "reading:validate", name: "Validate reading", resource: "reading", action: "validate" },
  { code: "reading:flag", name: "Flag reading", resource: "reading", action: "flag" },
  { code: "reading:reject", name: "Reject reading", resource: "reading", action: "reject" },
  { code: "reading:task:create", name: "Create task from reading", resource: "reading_task", action: "create" },
  { code: "task:view", name: "View tasks", resource: "task", action: "view" },
  { code: "task:create", name: "Create task", resource: "task", action: "create" },
  { code: "task:assign", name: "Assign task", resource: "task", action: "assign" },
  { code: "task:update", name: "Update task", resource: "task", action: "update" },
  { code: "task:comment", name: "Comment task", resource: "task_comment", action: "create" },
  { code: "task:attachment:manage", name: "Manage task attachments", resource: "task_attachment", action: "manage" },
  { code: "task:item:manage", name: "Manage task checklist items", resource: "task_item", action: "manage" },
  { code: "user:view", name: "View users", resource: "user", action: "view" },
  { code: "user:edit", name: "Edit users", resource: "user", action: "edit" },
  { code: "user:role:manage", name: "Manage user roles", resource: "user_role", action: "manage" },
  { code: "user:import", name: "Import users", resource: "user_import", action: "create" },
  { code: "rbac:view", name: "View roles and permissions", resource: "rbac", action: "view" },
  { code: "rbac:manage", name: "Manage roles and permissions", resource: "rbac", action: "manage" },
  { code: "meter:view", name: "View meters", resource: "meter", action: "view" },
  { code: "meter:create", name: "Create meters", resource: "meter", action: "create" },
  { code: "meter:edit", name: "Edit meters", resource: "meter", action: "edit" },
  { code: "meter:import", name: "Import meters", resource: "meter", action: "import" },
  { code: "dashboard:view", name: "View dashboard", resource: "dashboard", action: "view" },
  { code: "calendar:view", name: "View admin calendar", resource: "calendar", action: "view" },
  { code: "profile:view", name: "View admin profile page", resource: "profile", action: "view" },
  { code: "showcase:view", name: "View showcase pages", resource: "showcase", action: "view" },
  { code: "history:view", name: "View history", resource: "history", action: "view" },
  { code: "consumption:view", name: "View consumption", resource: "consumption", action: "view" },
  { code: "settings:view", name: "View settings", resource: "settings", action: "view" },
  { code: "settings:manage", name: "Manage settings", resource: "settings", action: "manage" },
  { code: "billing:view", name: "View billing module", resource: "billing", action: "view" },
  { code: "billing:city:view", name: "View billing cities", resource: "billing_city", action: "view" },
  { code: "billing:city:manage", name: "Manage billing cities", resource: "billing_city", action: "manage" },
  { code: "billing:zone:view", name: "View billing zones", resource: "billing_zone", action: "view" },
  { code: "billing:zone:manage", name: "Manage billing zones", resource: "billing_zone", action: "manage" },
  { code: "billing:tariff:view", name: "View billing tariffs", resource: "billing_tariff", action: "view" },
  { code: "billing:tariff:manage", name: "Manage billing tariffs", resource: "billing_tariff", action: "manage" },
  { code: "billing:contract:view", name: "View billing contracts", resource: "billing_contract", action: "view" },
  { code: "billing:contract:manage", name: "Manage billing contracts", resource: "billing_contract", action: "manage" },
  { code: "billing:campaign:view", name: "View billing campaigns", resource: "billing_campaign", action: "view" },
  { code: "billing:campaign:manage", name: "Manage billing campaigns", resource: "billing_campaign", action: "manage" },
  { code: "billing:campaign:generate", name: "Generate campaign invoices", resource: "billing_campaign", action: "generate" },
  { code: "billing:campaign:issue", name: "Issue campaign invoices", resource: "billing_campaign", action: "issue" },
  { code: "billing:invoice:view", name: "View billing invoices", resource: "billing_invoice", action: "view" },
  { code: "billing:invoice:issue", name: "Issue invoices", resource: "billing_invoice", action: "issue" },
  { code: "billing:invoice:cancel", name: "Cancel invoices", resource: "billing_invoice", action: "cancel" },
  { code: "billing:invoice:payment:create", name: "Register invoice payments", resource: "billing_payment", action: "create" },
  { code: "billing:invoice:delivery:create", name: "Register invoice deliveries", resource: "billing_delivery", action: "create" },
  { code: "audit:view", name: "View audit", resource: "audit", action: "view" },
];

const rolePermissionCodes = {
  CLIENT: ["reading:create", "reading:view"],
  AGENT: [
    "dashboard:view",
    "calendar:view",
    "profile:view",
    "reading:view",
    "reading:image:view",
    "reading:update",
    "reading:flag",
    "reading:reject",
    "task:view",
    "task:update",
    "task:comment",
    "task:attachment:manage",
    "task:item:manage",
    "meter:view",
  ],
  SUPERVISOR: [
    "dashboard:view",
    "calendar:view",
    "profile:view",
    "user:view",
    "reading:view",
    "reading:image:view",
    "reading-event:view",
    "reading:update",
    "reading:validate",
    "reading:flag",
    "reading:reject",
    "reading:task:create",
    "task:view",
    "task:create",
    "task:assign",
    "task:update",
    "task:comment",
    "task:attachment:manage",
    "task:item:manage",
    "meter:view",
    "history:view",
    "consumption:view",
    "settings:view",
    "billing:view",
    "billing:city:view",
    "billing:zone:view",
    "billing:tariff:view",
    "billing:contract:view",
    "billing:campaign:view",
    "billing:campaign:generate",
    "billing:campaign:issue",
    "billing:invoice:view",
    "billing:invoice:issue",
    "billing:invoice:cancel",
    "billing:invoice:payment:create",
    "billing:invoice:delivery:create",
    "audit:view",
  ],
  ADMIN: permissions.map((permission) => permission.code),
};

const users = [
  {
    phone: "+242060000001",
    username: "admin001",
    email: "helene.ngoma@meterflow.local",
    firstName: "Helene",
    lastName: "Ngoma",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Brazzaville",
    zone: "Centre-ville",
    activatedAt: "2025-09-01T08:00:00.000Z",
  },
  {
    phone: "+242060000002",
    username: "supervisor001",
    email: "armel.mabiala@meterflow.local",
    firstName: "Armel",
    lastName: "Mabiala",
    role: UserRole.SUPERVISOR,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Brazzaville",
    zone: "Makelele",
    activatedAt: "2025-09-03T08:00:00.000Z",
  },
  {
    phone: "+242060000003",
    username: "supervisor002",
    email: "sandrine.nzila@meterflow.local",
    firstName: "Sandrine",
    lastName: "Nzila",
    role: UserRole.SUPERVISOR,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Pointe-Noire",
    zone: "Lumumba",
    activatedAt: "2025-09-04T08:00:00.000Z",
  },
  {
    phone: "+242060000004",
    username: "agent001",
    email: "junior.nkouka@meterflow.local",
    firstName: "Junior",
    lastName: "Nkouka",
    role: UserRole.AGENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Brazzaville",
    zone: "Bacongo",
    activatedAt: "2025-09-05T08:00:00.000Z",
  },
  {
    phone: "+242060000005",
    username: "agent002",
    email: "merveille.itsoua@meterflow.local",
    firstName: "Merveille",
    lastName: "Itsoua",
    role: UserRole.AGENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Pointe-Noire",
    zone: "Tie-Tie",
    activatedAt: "2025-09-05T08:30:00.000Z",
  },
  {
    phone: "+242060000006",
    username: "agent003",
    email: "rodin.mboungou@meterflow.local",
    firstName: "Rodin",
    lastName: "Mboungou",
    role: UserRole.AGENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Dolisie",
    zone: "Centre",
    activatedAt: "2025-09-06T08:00:00.000Z",
  },
  {
    phone: "+242060100001",
    username: "client001",
    email: "prince.tati@meterflow.local",
    firstName: "Prince",
    lastName: "Tati",
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Brazzaville",
    zone: "Makelele",
    activatedAt: "2025-09-10T09:00:00.000Z",
  },
  {
    phone: "+242060100002",
    username: "client002",
    email: "sandrine.malonga@meterflow.local",
    firstName: "Sandrine",
    lastName: "Malonga",
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Brazzaville",
    zone: "Bacongo",
    activatedAt: "2025-09-10T09:15:00.000Z",
  },
  {
    phone: "+242060100003",
    username: "client003",
    email: "nadine.mboungou@meterflow.local",
    firstName: "Nadine",
    lastName: "Mboungou",
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Pointe-Noire",
    zone: "Tie-Tie",
    activatedAt: "2025-09-10T09:30:00.000Z",
  },
  {
    phone: "+242060100004",
    username: "client004",
    email: "brice.louzolo@meterflow.local",
    firstName: "Brice",
    lastName: "Louzolo",
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Pointe-Noire",
    zone: "Lumumba",
    activatedAt: "2025-09-10T09:45:00.000Z",
  },
  {
    phone: "+242060100005",
    username: "client005",
    email: "clarisse.ndzi@meterflow.local",
    firstName: "Clarisse",
    lastName: "Ndzi",
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Dolisie",
    zone: "Centre",
    activatedAt: "2025-09-10T10:00:00.000Z",
  },
  {
    phone: "+242060100006",
    username: "client006",
    email: "freddy.mampouya@meterflow.local",
    firstName: "Freddy",
    lastName: "Mampouya",
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    region: "Congo-Brazzaville",
    city: "Brazzaville",
    zone: "Talangai",
    activatedAt: "2025-09-10T10:15:00.000Z",
  },
];

const managedCities = [
  { code: "CG-CITY-BZV", name: "Brazzaville", region: "Brazzaville" },
  { code: "CG-CITY-PNR", name: "Pointe-Noire", region: "Pointe-Noire" },
  { code: "CG-CITY-DLS", name: "Dolisie", region: "Niari" },
];

const managedZones = [
  { code: "CG-BZV-MKL", name: "Makelele", cityCode: "CG-CITY-BZV" },
  { code: "CG-BZV-BCG", name: "Bacongo", cityCode: "CG-CITY-BZV" },
  { code: "CG-BZV-TLG", name: "Talangai", cityCode: "CG-CITY-BZV" },
  { code: "CG-PNR-TIE", name: "Tie-Tie", cityCode: "CG-CITY-PNR" },
  { code: "CG-PNR-LMB", name: "Lumumba", cityCode: "CG-CITY-PNR" },
  { code: "CG-DLS-CNT", name: "Centre", cityCode: "CG-CITY-DLS" },
];

const meters = [
  {
    serialNumber: "MF-CG-BZV-0001",
    meterReference: "CG-BZV-0001",
    customerUsername: "client001",
    assignedAgentUsername: "agent001",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Avenue Matsoua, Makelele",
    city: "Brazzaville",
    zone: "Makelele",
    zoneCode: "CG-BZV-MKL",
    latitude: -4.283,
    longitude: 15.2756,
    contractNumber: "CTR-CG-MKL-0001",
    policeNumber: "PLC-CG-MKL-0001",
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    contractBillingMode: TariffBillingMode.SINGLE_RATE,
    subscribedPowerValue: 10,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    contractEffectiveFrom: "2024-07-18T09:00:00.000Z",
    installedAt: "2024-07-18T09:00:00.000Z",
    lastInspectionAt: "2026-02-10T10:30:00.000Z",
  },
  {
    serialNumber: "MF-CG-BZV-0002",
    meterReference: "CG-BZV-0002",
    customerUsername: "client002",
    assignedAgentUsername: "agent001",
    type: MeterType.DUAL_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Rue Mbaka, Bacongo",
    city: "Brazzaville",
    zone: "Bacongo",
    zoneCode: "CG-BZV-BCG",
    latitude: -4.2894,
    longitude: 15.2673,
    contractNumber: "CTR-CG-BCG-0002",
    policeNumber: "PLC-CG-BCG-0002",
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    contractBillingMode: TariffBillingMode.TIME_OF_USE,
    subscribedPowerValue: 20,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    contractEffectiveFrom: "2024-09-02T09:00:00.000Z",
    installedAt: "2024-09-02T09:00:00.000Z",
    lastInspectionAt: "2026-01-22T11:15:00.000Z",
  },
  {
    serialNumber: "MF-CG-PNR-0003",
    meterReference: "CG-PNR-0003",
    customerUsername: "client003",
    assignedAgentUsername: "agent002",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Avenue Tchicaya U Tamsi, Tie-Tie",
    city: "Pointe-Noire",
    zone: "Tie-Tie",
    zoneCode: "CG-PNR-TIE",
    latitude: -4.7872,
    longitude: 11.8521,
    contractNumber: "CTR-CG-TIE-0003",
    policeNumber: "PLC-CG-TIE-0003",
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    contractBillingMode: TariffBillingMode.SINGLE_RATE,
    subscribedPowerValue: 15,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    contractEffectiveFrom: "2023-12-14T09:00:00.000Z",
    installedAt: "2023-12-14T09:00:00.000Z",
    lastInspectionAt: "2026-02-05T14:00:00.000Z",
  },
  {
    serialNumber: "MF-CG-PNR-0004",
    meterReference: "CG-PNR-0004",
    customerUsername: "client004",
    assignedAgentUsername: "agent002",
    type: MeterType.DUAL_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Avenue Marien Ngouabi, Lumumba",
    city: "Pointe-Noire",
    zone: "Lumumba",
    zoneCode: "CG-PNR-LMB",
    latitude: -4.7885,
    longitude: 11.8502,
    contractNumber: "CTR-CG-LMB-0004",
    policeNumber: "PLC-CG-LMB-0004",
    usageCategory: ServiceUsageCategory.PROFESSIONAL,
    contractBillingMode: TariffBillingMode.TIME_OF_USE,
    subscribedPowerValue: 30,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    phaseType: ServicePhaseType.THREE_PHASE,
    contractEffectiveFrom: "2024-03-09T09:00:00.000Z",
    installedAt: "2024-03-09T09:00:00.000Z",
    lastInspectionAt: "2026-02-12T09:45:00.000Z",
  },
  {
    serialNumber: "MF-CG-DLS-0005",
    meterReference: "CG-DLS-0005",
    customerUsername: "client005",
    assignedAgentUsername: "agent003",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Avenue de l Independance, Centre",
    city: "Dolisie",
    zone: "Centre",
    zoneCode: "CG-DLS-CNT",
    latitude: -4.1989,
    longitude: 12.6664,
    contractNumber: "CTR-CG-CNT-0005",
    policeNumber: "PLC-CG-CNT-0005",
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    contractBillingMode: TariffBillingMode.SINGLE_RATE,
    subscribedPowerValue: 10,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    contractEffectiveFrom: "2024-11-04T09:00:00.000Z",
    installedAt: "2024-11-04T09:00:00.000Z",
    lastInspectionAt: "2026-01-30T13:30:00.000Z",
  },
  {
    serialNumber: "MF-CG-BZV-0006",
    meterReference: "CG-BZV-0006",
    customerUsername: "client006",
    assignedAgentUsername: "agent001",
    type: MeterType.SINGLE_INDEX,
    status: MeterStatus.ACTIVE,
    addressLine1: "Rue de l OUA, Talangai",
    city: "Brazzaville",
    zone: "Talangai",
    zoneCode: "CG-BZV-TLG",
    latitude: -4.2338,
    longitude: 15.2708,
    contractNumber: "CTR-CG-TLG-0006",
    policeNumber: "PLC-CG-TLG-0006",
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    contractBillingMode: TariffBillingMode.SINGLE_RATE,
    subscribedPowerValue: 15,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    contractEffectiveFrom: "2024-05-12T09:00:00.000Z",
    installedAt: "2024-05-12T09:00:00.000Z",
    lastInspectionAt: "2026-02-15T08:50:00.000Z",
  },
];

const meterHistoryDefinitions = [
  {
    serialNumber: "MF-CG-BZV-0001",
    primary: [1258, 1314, 1376, 1442, 1498, 1568],
  },
  {
    serialNumber: "MF-CG-BZV-0002",
    primary: [779, 812, 845, 873, 903, 941],
    secondary: [315, 332, 349, 365, 392, 408],
  },
  {
    serialNumber: "MF-CG-PNR-0003",
    primary: [2156, 2205, 2248, 2297, 2341, 2386],
  },
  {
    serialNumber: "MF-CG-PNR-0004",
    primary: [4402, 4520, 4638, 4754, 4876, 5008],
    secondary: [1152, 1184, 1216, 1249, 1282, 1318],
  },
  {
    serialNumber: "MF-CG-DLS-0005",
    primary: [870, 905, 941, 972, 1007, 1046],
  },
  {
    serialNumber: "MF-CG-BZV-0006",
    primary: [1625, 1670, 1717, 1761, 1805, 1848],
  },
];

const demoReadings = [
  {
    key: "bzv-client-valid-mar",
    idempotencyKey: "seed-demo:reading:bzv-client-valid-mar",
    meterSerialNumber: "MF-CG-BZV-0001",
    submittedByUsername: "client001",
    reviewedByUsername: "supervisor001",
    source: ReadingSource.CLIENT,
    status: ReadingStatus.VALIDATED,
    readingAt: "2026-03-21T07:32:00.000Z",
    primaryIndex: 1606,
    gpsLatitude: -4.28294,
    gpsLongitude: 15.2757,
    gpsAccuracyMeters: 8.5,
    reviewedAt: "2026-03-21T09:10:00.000Z",
    confidenceScore: 91.2,
    anomalyScore: 11.4,
    ocrText: "INDEX 1606",
    assetSlug: "reading-bzv-client-valid",
  },
  {
    key: "bzv-dual-flagged-mar",
    idempotencyKey: "seed-demo:reading:bzv-dual-flagged-mar",
    meterSerialNumber: "MF-CG-BZV-0002",
    submittedByUsername: "client002",
    reviewedByUsername: "supervisor001",
    source: ReadingSource.CLIENT,
    status: ReadingStatus.FLAGGED,
    readingAt: "2026-03-20T08:14:00.000Z",
    primaryIndex: 918,
    secondaryIndex: 401,
    gpsLatitude: -4.2512,
    gpsLongitude: 15.281,
    gpsAccuracyMeters: 18.3,
    reviewedAt: "2026-03-20T10:05:00.000Z",
    flagReason: "INDEX_INCONSISTENT",
    confidenceScore: 73.4,
    anomalyScore: 79.1,
    ocrText: "PEAK 918 / OFF PEAK 401",
    assetSlug: "reading-bzv-dual-flagged",
  },
  {
    key: "pnr-client-rejected-mar",
    idempotencyKey: "seed-demo:reading:pnr-client-rejected-mar",
    meterSerialNumber: "MF-CG-PNR-0003",
    submittedByUsername: "client003",
    reviewedByUsername: "supervisor002",
    source: ReadingSource.CLIENT,
    status: ReadingStatus.REJECTED,
    readingAt: "2026-03-19T06:55:00.000Z",
    primaryIndex: 2407,
    gpsLatitude: -4.78728,
    gpsLongitude: 11.85206,
    gpsAccuracyMeters: 10.1,
    reviewedAt: "2026-03-19T08:11:00.000Z",
    rejectionReason: "blurry_image",
    confidenceScore: 42.8,
    anomalyScore: 34.0,
    ocrText: "2407",
    assetSlug: "reading-pnr-client-rejected",
  },
  {
    key: "pnr-agent-confirmed-mar",
    idempotencyKey: "seed-demo:reading:pnr-agent-confirmed-mar",
    meterSerialNumber: "MF-CG-PNR-0003",
    submittedByUsername: "agent002",
    reviewedByUsername: "supervisor002",
    source: ReadingSource.AGENT,
    status: ReadingStatus.VALIDATED,
    readingAt: "2026-03-20T09:48:00.000Z",
    primaryIndex: 2413,
    gpsLatitude: -4.78723,
    gpsLongitude: 11.85211,
    gpsAccuracyMeters: 5.6,
    reviewedAt: "2026-03-20T10:12:00.000Z",
    confidenceScore: 95.1,
    anomalyScore: 8.4,
    ocrText: "2413",
    assetSlug: "reading-pnr-agent-confirmed",
  },
  {
    key: "dls-client-pending-mar",
    idempotencyKey: "seed-demo:reading:dls-client-pending-mar",
    meterSerialNumber: "MF-CG-DLS-0005",
    submittedByUsername: "client005",
    source: ReadingSource.CLIENT,
    status: ReadingStatus.PENDING,
    readingAt: "2026-03-21T11:05:00.000Z",
    primaryIndex: 1058,
    gpsLatitude: -4.19894,
    gpsLongitude: 12.66639,
    gpsAccuracyMeters: 16.4,
    confidenceScore: 80.2,
    anomalyScore: 18.3,
    ocrText: "1058",
    assetSlug: "reading-dls-client-pending",
  },
];

const managedTaskDefinitions = [
  {
    key: "bzv-dual-gps-recheck",
    title: "Controle terrain index incoherent compteur CG-BZV-0002",
    description:
      "Le releve client presente un ecart avec la derniere reference connue et un GPS eloigne. Reprendre la verification sur site.",
    meterSerialNumber: "MF-CG-BZV-0002",
    readingKey: "bzv-dual-flagged-mar",
    assignedToUsername: "agent001",
    createdByUsername: "supervisor001",
    type: TaskType.FIELD_RECHECK,
    status: TaskStatus.OPEN,
    priority: TaskPriority.HIGH,
    dueAt: "2026-03-21T14:00:00.000Z",
    createdAt: "2026-03-20T10:17:00.000Z",
  },
  {
    key: "pnr-reading-confirmed",
    title: "Confirmation terrain releve CG-PNR-0003",
    description: "Le client a soumis une photo inexploitable. Un passage terrain a permis de confirmer l index reel.",
    meterSerialNumber: "MF-CG-PNR-0003",
    readingKey: "pnr-client-rejected-mar",
    reportedReadingKey: "pnr-agent-confirmed-mar",
    assignedToUsername: "agent002",
    createdByUsername: "supervisor002",
    startedByUsername: "agent002",
    closedByUsername: "agent002",
    type: TaskType.FIELD_RECHECK,
    status: TaskStatus.DONE,
    priority: TaskPriority.HIGH,
    dueAt: "2026-03-20T12:00:00.000Z",
    startedAt: "2026-03-20T08:40:00.000Z",
    fieldSubmittedAt: "2026-03-20T09:48:00.000Z",
    closedAt: "2026-03-20T10:15:00.000Z",
    createdAt: "2026-03-19T08:45:00.000Z",
    resolutionCode: TaskResolutionCode.READING_CONFIRMED,
    resolutionComment: "Photo nette prise sur site et index confirme avec la cliente.",
    fieldPrimaryIndex: 2413,
    fieldGpsLatitude: -4.78723,
    fieldGpsLongitude: 11.85211,
    fieldGpsAccuracyMeters: 5.6,
    assetSlug: "task-pnr-reading-confirmed",
  },
  {
    key: "pnr-fraud-escalation",
    title: "Investigation fraude compteur CG-PNR-0004",
    description: "Controle terrain ouvert apres signalement d une consommation incoherente sur le compteur du client professionnel.",
    meterSerialNumber: "MF-CG-PNR-0004",
    assignedToUsername: "agent002",
    createdByUsername: "supervisor002",
    startedByUsername: "agent002",
    type: TaskType.FRAUD_INVESTIGATION,
    status: TaskStatus.BLOCKED,
    priority: TaskPriority.CRITICAL,
    dueAt: "2026-03-22T10:00:00.000Z",
    startedAt: "2026-03-22T07:30:00.000Z",
    fieldSubmittedAt: "2026-03-22T08:05:00.000Z",
    createdAt: "2026-03-21T16:10:00.000Z",
    resolutionCode: TaskResolutionCode.ESCALATION_REQUIRED,
    resolutionComment: "Boitier ouvert et scelle absent. Escalade immediate demandee au superviseur.",
    fieldPrimaryIndex: 5034,
    fieldSecondaryIndex: 1325,
    fieldGpsLatitude: -4.78841,
    fieldGpsLongitude: 11.85015,
    fieldGpsAccuracyMeters: 6.2,
    assetSlug: "task-pnr-fraud-blocked",
  },
  {
    key: "dls-access-check",
    title: "Verification accessibilite compteur CG-DLS-0005",
    description: "Le client n a pas finalise son auto-releve. Verification terrain enclenchee pour fiabiliser la releve du mois.",
    meterSerialNumber: "MF-CG-DLS-0005",
    assignedToUsername: "agent003",
    createdByUsername: "supervisor002",
    startedByUsername: "agent003",
    type: TaskType.METER_VERIFICATION,
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.MEDIUM,
    dueAt: "2026-03-22T17:00:00.000Z",
    startedAt: "2026-03-22T09:20:00.000Z",
    createdAt: "2026-03-21T14:20:00.000Z",
  },
  {
    key: "bzv-follow-up-reminder",
    title: "Passage de rappel client CG-BZV-0006",
    description: "Le client n a pas encore transmis son index de mars. Effectuer un passage de rappel si aucun releve n est recu en fin de journee.",
    meterSerialNumber: "MF-CG-BZV-0006",
    assignedToUsername: "agent001",
    createdByUsername: "supervisor001",
    type: TaskType.GENERAL,
    status: TaskStatus.OPEN,
    priority: TaskPriority.LOW,
    dueAt: "2026-03-22T16:30:00.000Z",
    createdAt: "2026-03-22T07:10:00.000Z",
  },
];

const managedTariffPlans = [
  {
    code: "CG-MKL-RES-STD-2026",
    name: "Tarif residentiel Makelele 0-15A 2026",
    description: "Tarif simple pour les abonnes residentiels monophasés de Makelele jusqu a 15A.",
    zoneCode: "CG-BZV-MKL",
    billingMode: TariffBillingMode.SINGLE_RATE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 0,
    subscribedPowerMax: 15,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: 96,
    hpUnitPrice: null,
    hcUnitPrice: null,
    fixedCharge: 1500,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: true,
    isActive: true,
    taxes: [
      {
        code: "CG-MKL-AV-2026",
        name: "Taxe audiovisuelle Makelele",
        type: TaxRuleType.FIXED,
        applicationScope: TaxApplicationScope.SUBTOTAL,
        value: 300,
      },
    ],
  },
  {
    code: "CG-MKL-RES-PLUS-2026",
    name: "Tarif residentiel Makelele 16-30A 2026",
    description: "Tarif simple pour les abonnes residentiels monophasés de Makelele de 16A a 30A.",
    zoneCode: "CG-BZV-MKL",
    billingMode: TariffBillingMode.SINGLE_RATE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 16,
    subscribedPowerMax: 30,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: 103,
    hpUnitPrice: null,
    hcUnitPrice: null,
    fixedCharge: 2200,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: false,
    isActive: true,
    taxes: [],
  },
  {
    code: "CG-BCG-RES-TOU-2026",
    name: "Tarif HP/HC Bacongo 0-20A 2026",
    description: "Tarif heures pleines / heures creuses pour les doubles index residentiels de Bacongo jusqu a 20A.",
    zoneCode: "CG-BZV-BCG",
    billingMode: TariffBillingMode.TIME_OF_USE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 0,
    subscribedPowerMax: 20,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: null,
    hpUnitPrice: 118,
    hcUnitPrice: 74,
    fixedCharge: 1800,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: false,
    isActive: true,
    taxes: [
      {
        code: "CG-BCG-AV-2026",
        name: "Taxe audiovisuelle Bacongo",
        type: TaxRuleType.PERCENT,
        applicationScope: TaxApplicationScope.SUBTOTAL,
        value: 2.5,
      },
    ],
  },
  {
    code: "CG-BCG-RES-TOU-PLUS-2026",
    name: "Tarif HP/HC Bacongo 21-40A 2026",
    description: "Tarif heures pleines / heures creuses pour les doubles index residentiels de Bacongo au dela de 20A.",
    zoneCode: "CG-BZV-BCG",
    billingMode: TariffBillingMode.TIME_OF_USE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 21,
    subscribedPowerMax: 40,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: null,
    hpUnitPrice: 126,
    hcUnitPrice: 79,
    fixedCharge: 2600,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: false,
    isActive: true,
    taxes: [],
  },
  {
    code: "CG-TIE-RES-STD-2026",
    name: "Tarif residentiel Tie-Tie 0-20A 2026",
    description: "Tarif simple pour les menages de Tie-Tie jusqu a 20A.",
    zoneCode: "CG-PNR-TIE",
    billingMode: TariffBillingMode.SINGLE_RATE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 0,
    subscribedPowerMax: 20,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: 102,
    hpUnitPrice: null,
    hcUnitPrice: null,
    fixedCharge: 1700,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: false,
    isActive: true,
    taxes: [],
  },
  {
    code: "CG-LMB-PRO-TOU-2026",
    name: "Tarif professionnel Lumumba 0-30A 2026",
    description: "Tarif HP/HC applique aux professionnels triphasés de Lumumba jusqu a 30A.",
    zoneCode: "CG-PNR-LMB",
    billingMode: TariffBillingMode.TIME_OF_USE,
    usageCategory: ServiceUsageCategory.PROFESSIONAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 0,
    subscribedPowerMax: 30,
    phaseType: ServicePhaseType.THREE_PHASE,
    currency: "XAF",
    singleUnitPrice: null,
    hpUnitPrice: 126,
    hcUnitPrice: 82,
    fixedCharge: 3200,
    taxPercent: 18,
    lateFeePercent: 7,
    isDefault: false,
    isActive: true,
    taxes: [
      {
        code: "CG-LMB-COM-2026",
        name: "Redevance communale Lumumba",
        type: TaxRuleType.FIXED,
        applicationScope: TaxApplicationScope.SUBTOTAL,
        value: 500,
      },
    ],
  },
  {
    code: "CG-LMB-PRO-TOU-PLUS-2026",
    name: "Tarif professionnel Lumumba 31-60A 2026",
    description: "Tarif HP/HC applique aux professionnels triphasés de Lumumba entre 31A et 60A.",
    zoneCode: "CG-PNR-LMB",
    billingMode: TariffBillingMode.TIME_OF_USE,
    usageCategory: ServiceUsageCategory.PROFESSIONAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 31,
    subscribedPowerMax: 60,
    phaseType: ServicePhaseType.THREE_PHASE,
    currency: "XAF",
    singleUnitPrice: null,
    hpUnitPrice: 134,
    hcUnitPrice: 88,
    fixedCharge: 4200,
    taxPercent: 18,
    lateFeePercent: 7,
    isDefault: false,
    isActive: true,
    taxes: [],
  },
  {
    code: "CG-CNT-RES-STD-2026",
    name: "Tarif residentiel Dolisie Centre 0-20A 2026",
    description: "Tarif simple pour le centre de Dolisie jusqu a 20A.",
    zoneCode: "CG-DLS-CNT",
    billingMode: TariffBillingMode.SINGLE_RATE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 0,
    subscribedPowerMax: 20,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: 93,
    hpUnitPrice: null,
    hcUnitPrice: null,
    fixedCharge: 1400,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: false,
    isActive: true,
    taxes: [
      {
        code: "CG-CNT-RLV-2026",
        name: "Redevance service local",
        type: TaxRuleType.FIXED,
        applicationScope: TaxApplicationScope.SUBTOTAL,
        value: 250,
      },
    ],
  },
  {
    code: "CG-TLG-RES-STD-2026",
    name: "Tarif residentiel Talangai 0-20A 2026",
    description: "Tarif simple applique au secteur de Talangai jusqu a 20A.",
    zoneCode: "CG-BZV-TLG",
    billingMode: TariffBillingMode.SINGLE_RATE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 0,
    subscribedPowerMax: 20,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: 98,
    hpUnitPrice: null,
    hcUnitPrice: null,
    fixedCharge: 1500,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: false,
    isActive: true,
    taxes: [],
  },
  {
    code: "CG-GLOBAL-STD-2026",
    name: "Tarif general de secours 0-20A 2026",
    description: "Tarif global conserve comme fallback pour les contrats residentiels simples jusqu a 20A.",
    zoneCode: null,
    billingMode: TariffBillingMode.SINGLE_RATE,
    usageCategory: ServiceUsageCategory.RESIDENTIAL,
    subscribedPowerUnit: ServicePowerUnit.AMPERE,
    subscribedPowerMin: 0,
    subscribedPowerMax: 20,
    phaseType: ServicePhaseType.SINGLE_PHASE,
    currency: "XAF",
    singleUnitPrice: 100,
    hpUnitPrice: null,
    hcUnitPrice: null,
    fixedCharge: 1600,
    taxPercent: 18,
    lateFeePercent: 5,
    isDefault: false,
    isActive: true,
    taxes: [],
  },
];

const managedBillingCampaigns = [
  {
    code: "CG-BILL-2026-02-MKL",
    name: "Campagne fevrier 2026 - Makelele",
    zoneCodes: ["CG-BZV-MKL"],
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T23:59:59.000Z",
    submissionStartAt: "2026-02-20T00:00:00.000Z",
    submissionEndAt: "2026-03-05T23:59:59.000Z",
    cutoffAt: "2026-03-06T08:00:00.000Z",
    frequency: "MONTHLY",
    status: BillingCampaignStatus.ISSUED,
    tariffPlanCode: "CG-MKL-RES-STD-2026",
    createdByUsername: "admin001",
    launchedAt: "2026-02-20T08:00:00.000Z",
    generatedAt: "2026-03-06T09:00:00.000Z",
    issuedAt: "2026-03-07T10:00:00.000Z",
    finalizedAt: "2026-03-10T12:00:00.000Z",
    notes: "Cycle fevrier cloture pour la zone de Makelele.",
  },
  {
    code: "CG-BILL-2026-02-BCG",
    name: "Campagne fevrier 2026 - Bacongo",
    zoneCodes: ["CG-BZV-BCG"],
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T23:59:59.000Z",
    submissionStartAt: "2026-02-20T00:00:00.000Z",
    submissionEndAt: "2026-03-05T23:59:59.000Z",
    cutoffAt: "2026-03-06T08:00:00.000Z",
    frequency: "MONTHLY",
    status: BillingCampaignStatus.ISSUED,
    tariffPlanCode: "CG-BCG-RES-TOU-2026",
    createdByUsername: "admin001",
    launchedAt: "2026-02-20T08:10:00.000Z",
    generatedAt: "2026-03-06T09:05:00.000Z",
    issuedAt: "2026-03-07T10:05:00.000Z",
    finalizedAt: "2026-03-10T12:05:00.000Z",
    notes: "Cycle fevrier des compteurs doubles index de Bacongo.",
  },
  {
    code: "CG-BILL-2026-02-TIE",
    name: "Campagne fevrier 2026 - Tie-Tie",
    zoneCodes: ["CG-PNR-TIE"],
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T23:59:59.000Z",
    submissionStartAt: "2026-02-20T00:00:00.000Z",
    submissionEndAt: "2026-03-05T23:59:59.000Z",
    cutoffAt: "2026-03-06T08:00:00.000Z",
    frequency: "MONTHLY",
    status: BillingCampaignStatus.ISSUED,
    tariffPlanCode: "CG-TIE-RES-STD-2026",
    createdByUsername: "admin001",
    launchedAt: "2026-02-20T08:20:00.000Z",
    generatedAt: "2026-03-06T09:10:00.000Z",
    issuedAt: "2026-03-07T10:10:00.000Z",
    finalizedAt: "2026-03-10T12:10:00.000Z",
    notes: "Cycle fevrier cloture pour la zone de Tie-Tie.",
  },
  {
    code: "CG-BILL-2026-02-LMB",
    name: "Campagne fevrier 2026 - Lumumba",
    zoneCodes: ["CG-PNR-LMB"],
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T23:59:59.000Z",
    submissionStartAt: "2026-02-20T00:00:00.000Z",
    submissionEndAt: "2026-03-05T23:59:59.000Z",
    cutoffAt: "2026-03-06T08:00:00.000Z",
    frequency: "MONTHLY",
    status: BillingCampaignStatus.ISSUED,
    tariffPlanCode: "CG-LMB-PRO-TOU-2026",
    createdByUsername: "admin001",
    launchedAt: "2026-02-20T08:30:00.000Z",
    generatedAt: "2026-03-06T09:20:00.000Z",
    issuedAt: "2026-03-07T10:20:00.000Z",
    finalizedAt: "2026-03-10T12:20:00.000Z",
    notes: "Campagne professionnelle fermee pour Lumumba.",
  },
  {
    code: "CG-BILL-2026-02-TLG",
    name: "Campagne fevrier 2026 - Talangai",
    zoneCodes: ["CG-BZV-TLG"],
    periodStart: "2026-02-01T00:00:00.000Z",
    periodEnd: "2026-02-28T23:59:59.000Z",
    submissionStartAt: "2026-02-20T00:00:00.000Z",
    submissionEndAt: "2026-03-05T23:59:59.000Z",
    cutoffAt: "2026-03-06T08:00:00.000Z",
    frequency: "MONTHLY",
    status: BillingCampaignStatus.ISSUED,
    tariffPlanCode: "CG-TLG-RES-STD-2026",
    createdByUsername: "admin001",
    launchedAt: "2026-02-20T08:40:00.000Z",
    generatedAt: "2026-03-06T09:25:00.000Z",
    issuedAt: "2026-03-07T10:30:00.000Z",
    finalizedAt: "2026-03-10T12:30:00.000Z",
    notes: "Cycle fevrier cloture pour Talangai.",
  },
  {
    code: "CG-BILL-2026-03-URBAN",
    name: "Campagne mars 2026 - Reseau urbain prioritaire",
    zoneCodes: ["CG-BZV-MKL", "CG-BZV-TLG", "CG-DLS-CNT"],
    periodStart: "2026-03-01T00:00:00.000Z",
    periodEnd: "2026-03-31T23:59:59.000Z",
    submissionStartAt: "2026-03-20T00:00:00.000Z",
    submissionEndAt: "2026-04-05T23:59:59.000Z",
    cutoffAt: "2026-04-06T08:00:00.000Z",
    frequency: "MONTHLY",
    status: BillingCampaignStatus.RUNNING,
    tariffPlanCode: "CG-GLOBAL-STD-2026",
    createdByUsername: "admin001",
    launchedAt: "2026-03-20T08:00:00.000Z",
    notes: "Campagne multi-zones ouverte pour illustrer la collecte et la generation mutualisee sur un tarif global.",
  },
];

const demoAppSettings = {
  companyName: "Societe Energie Congo",
  defaultCountryCode: "CG",
  timezone: "Africa/Brazzaville",
  locale: "fr-FR",
  requireGpsForReading: true,
  maxGpsDistanceMeters: 200,
  allowClientResubmission: true,
  reviewSlaHours: 24,
  readingReminderEnabled: true,
  readingWindowStartDay: 20,
  readingWindowEndDay: 5,
  readingReminderHour: 9,
  readingReminderTimezone: "Africa/Brazzaville",
  readingReminderCadence: "DAILY",
  readingReminderMinIntervalHours: 24,
  readingReminderMaxPerWindow: 3,
  readingReminderUseWhatsapp: true,
  readingReminderUseEmail: true,
  readingReminderUsePush: false,
  enableAnomalyScoring: true,
  anomalyThreshold: 65,
  strictMonotonicIndex: true,
  requirePhotoHash: true,
  emailApiProvider: "RESEND",
  emailNotificationsEnabled: true,
  whatsappNotificationsEnabled: false,
  pushNotificationsEnabled: true,
  dailyDigestHour: 8,
  maxImageSizeMb: 8,
  retentionDays: 365,
  allowedMimeTypes: "image/jpeg,image/png,image/webp,image/svg+xml",
  accessTokenTtlMinutes: 30,
  refreshTokenTtlDays: 14,
  otpTtlMinutes: 10,
  maxLoginAttempts: 5,
  showOverviewValidationRate: true,
  showOverviewActivityTrend: true,
  showOverviewStatusMix: true,
  showOverviewTasksByStatus: true,
  showOverviewTopAgents: true,
  showOverviewRiskiestZones: true,
  showOverviewUserDistribution: true,
  showOverviewOpsDelay: true,
  showOverviewOpsBacklog: true,
  showOverviewOpsAnomaly: true,
  showOverviewOpsVolume: true,
};

const demoImageSpecs = {
  "reading-bzv-client-valid": {
    title: "Auto-releve valide",
    subtitle: "Client Makelele / compteur CG-BZV-0001 / mars 2026",
    detail: "Index confirme : 1606",
    accent: "#22c55e",
  },
  "reading-bzv-dual-flagged": {
    title: "Auto-releve a verifier",
    subtitle: "Client Bacongo / compteur CG-BZV-0002 / mars 2026",
    detail: "Indexes saisis : 918 / 401",
    accent: "#f59e0b",
  },
  "reading-pnr-client-rejected": {
    title: "Auto-releve rejete",
    subtitle: "Client Tie-Tie / compteur CG-PNR-0003 / photo floue",
    detail: "Index saisi : 2407",
    accent: "#ef4444",
  },
  "reading-pnr-agent-confirmed": {
    title: "Releve terrain confirme",
    subtitle: "Agent Pointe-Noire / compteur CG-PNR-0003",
    detail: "Index confirme : 2413",
    accent: "#0ea5e9",
  },
  "reading-dls-client-pending": {
    title: "Auto-releve en attente",
    subtitle: "Client Dolisie / compteur CG-DLS-0005",
    detail: "Index saisi : 1058",
    accent: "#8b5cf6",
  },
  "task-pnr-reading-confirmed": {
    title: "Preuve terrain releve",
    subtitle: "Mission cloturee / Pointe-Noire / CG-PNR-0003",
    detail: "Photo terrain agent / index 2413",
    accent: "#0ea5e9",
  },
  "task-pnr-fraud-blocked": {
    title: "Constat terrain",
    subtitle: "Investigation fraude / CG-PNR-0004",
    detail: "Boitier ouvert - escalade superviseur",
    accent: "#dc2626",
  },
};

const LOCAL_DEMO_ASSET_PREFIX = "/seed/demo-assets";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function quantity(value) {
  return roundTo(value, 3).toFixed(3);
}

function money(value) {
  return roundTo(value, 2).toFixed(2);
}

function toIsoDate(date) {
  return new Date(date).toISOString();
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return roundTo(earthRadius * c, 2);
}

function buildMeterStatesFromHistory() {
  const states = [];

  for (const history of meterHistoryDefinitions) {
    for (let index = 1; index < HISTORY_SNAPSHOTS.length; index += 1) {
      states.push({
        serialNumber: history.serialNumber,
        effectiveAt: HISTORY_SNAPSHOTS[index],
        previousPrimary: history.primary[index - 1],
        currentPrimary: history.primary[index],
        previousSecondary: history.secondary ? history.secondary[index - 1] : null,
        currentSecondary: history.secondary ? history.secondary[index] : null,
      });
    }
  }

  return states;
}

function env(name) {
  return process.env[name] || "";
}

function canUploadDemoAssets() {
  return [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ].every((name) => Boolean(env(name)));
}

function publicStorageBaseUrl() {
  const explicit = env("S3_PUBLIC_ENDPOINT") || env("STORAGE_PUBLIC_BASE_URL") || env("S3_ENDPOINT");
  return explicit.replace(/\/$/, "");
}

function createDemoSvg(spec) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">`,
    `<defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#111827"/></linearGradient></defs>`,
    `<rect width="1200" height="900" rx="42" fill="url(#bg)"/>`,
    `<rect x="68" y="68" width="1064" height="764" rx="28" fill="#172033" stroke="${spec.accent}" stroke-width="6"/>`,
    `<rect x="104" y="118" width="240" height="12" rx="6" fill="${spec.accent}" opacity="0.85"/>`,
    `<text x="104" y="220" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="700">${spec.title}</text>`,
    `<text x="104" y="290" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="30">${spec.subtitle}</text>`,
    `<text x="104" y="382" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">${spec.detail}</text>`,
    `<rect x="104" y="454" width="992" height="1" fill="#334155"/>`,
    `<text x="104" y="540" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="26">Demonstration MeterFlow - Electricite Congo Brazzaville</text>`,
    `<text x="104" y="585" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="26">Document genere pour une demo metier coherente</text>`,
    `<text x="104" y="760" fill="${spec.accent}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">Photo de demonstration</text>`,
    `</svg>`,
  ].join("");
}

async function uploadDemoAsset(slug, spec) {
  const body = Buffer.from(createDemoSvg(spec), "utf8");
  const fileHash = createHash("sha256").update(body).digest("hex");
  const key = `seed/demo-assets/${slug}.svg`;
  const localFileUrl = `${LOCAL_DEMO_ASSET_PREFIX}/${slug}.svg`;
  const localDirectory = path.join(process.cwd(), "public", "seed", "demo-assets");
  const localFilePath = path.join(localDirectory, `${slug}.svg`);

  await fs.mkdir(localDirectory, { recursive: true });
  await fs.writeFile(localFilePath, body);

  if (!canUploadDemoAssets()) {
    return {
      fileUrl: localFileUrl,
      fileHash,
      fileSizeBytes: body.byteLength,
      mimeType: "image/svg+xml",
    };
  }

  const fileUrl = `${publicStorageBaseUrl()}/${env("S3_BUCKET")}/${key}`;

  try {
    const s3 = new S3Client({
      region: env("S3_REGION"),
      endpoint: env("S3_ENDPOINT"),
      forcePathStyle: !env("S3_FORCE_PATH_STYLE") || env("S3_FORCE_PATH_STYLE").toLowerCase() === "true",
      credentials: {
        accessKeyId: env("S3_ACCESS_KEY_ID"),
        secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
      },
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: env("S3_BUCKET"),
        Key: key,
        Body: body,
        ContentType: "image/svg+xml",
        Metadata: {
          sha256: fileHash,
          purpose: "seed-demo",
        },
      })
    );
  } catch {
    return {
      fileUrl: localFileUrl,
      fileHash,
      fileSizeBytes: body.byteLength,
      mimeType: "image/svg+xml",
    };
  }

  return {
    fileUrl,
    fileHash,
    fileSizeBytes: body.byteLength,
    mimeType: "image/svg+xml",
  };
}

async function buildDemoAssetMap() {
  const entries = await Promise.all(
    Object.entries(demoImageSpecs).map(async ([slug, spec]) => [
      slug,
      await uploadDemoAsset(slug, spec),
    ])
  );

  return Object.fromEntries(entries);
}

async function cleanupManagedTasks() {
  const managedTaskTitles = managedTaskDefinitions.map((task) => task.title);
  const tasksToDelete = await prisma.task.findMany({
    where: {
      deletedAt: null,
      OR: [
        { title: { in: [...managedTaskTitles, ...LEGACY_DEMO_TASK_TITLES] } },
        { title: { startsWith: "DEMO:" } },
        { description: { contains: "[seed-demo]" } },
      ],
    },
    select: { id: true },
  });

  const taskIds = tasksToDelete.map((task) => task.id);
  if (taskIds.length === 0) return;

  const eventIds = (
    await prisma.taskEvent.findMany({
      where: { taskId: { in: taskIds } },
      select: { id: true },
    })
  ).map((event) => event.id);

  if (eventIds.length > 0) {
    await prisma.agentNotificationRead.deleteMany({
      where: { taskEventId: { in: eventIds } },
    });
  }

  await prisma.taskEvent.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.taskAttachment.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.taskItem.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
}

async function cleanupManagedReadings() {
  const readingKeys = demoReadings.map((reading) => reading.idempotencyKey);
  const readingsToDelete = await prisma.reading.findMany({
    where: {
      deletedAt: null,
      OR: [
        { idempotencyKey: { in: readingKeys } },
        { idempotencyKey: { startsWith: "seed-demo:" } },
        { imageUrl: { contains: "demo.meterflow.local/readings/" } },
        { meter: { serialNumber: { in: LEGACY_DEMO_METER_SERIALS } } },
      ],
    },
    select: { id: true },
  });

  const readingIds = readingsToDelete.map((reading) => reading.id);
  if (readingIds.length === 0) return;

  const eventIds = (
    await prisma.readingEvent.findMany({
      where: { readingId: { in: readingIds } },
      select: { id: true },
    })
  ).map((event) => event.id);

  if (eventIds.length > 0) {
    await prisma.mobileNotificationRead.deleteMany({
      where: { readingEventId: { in: eventIds } },
    });
  }

  await prisma.readingEvent.deleteMany({ where: { readingId: { in: readingIds } } });
  await prisma.meterState.deleteMany({ where: { sourceReadingId: { in: readingIds } } });
  await prisma.reading.deleteMany({ where: { id: { in: readingIds } } });
}

async function cleanupLegacyMeters(userByUsername) {
  const legacyMeters = await prisma.meter.findMany({
    where: {
      serialNumber: { in: LEGACY_DEMO_METER_SERIALS },
    },
    select: { id: true },
  });

  const legacyMeterIds = legacyMeters.map((meter) => meter.id);
  if (legacyMeterIds.length === 0) return;

  await prisma.meterAssignment.deleteMany({ where: { meterId: { in: legacyMeterIds } } });
  await prisma.meterState.deleteMany({ where: { meterId: { in: legacyMeterIds } } });
  await prisma.meter.deleteMany({ where: { id: { in: legacyMeterIds } } });
}

function buildReadingPayload(definition, meter, submittedBy, reviewedBy, asset) {
  const gpsDistanceMeters =
    definition.gpsLatitude !== undefined &&
    definition.gpsLongitude !== undefined &&
    meter.latitude !== null &&
    meter.longitude !== null
      ? haversineDistanceMeters(
          Number(meter.latitude),
          Number(meter.longitude),
          definition.gpsLatitude,
          definition.gpsLongitude
        )
      : null;

  return {
    key: definition.key,
    data: {
      meterId: meter.id,
      submittedById: submittedBy.id,
      reviewedById: reviewedBy?.id ?? null,
      source: definition.source,
      status: definition.status,
      readingAt: new Date(definition.readingAt),
      primaryIndex: definition.primaryIndex,
      secondaryIndex: definition.secondaryIndex ?? null,
      imageUrl: asset.fileUrl,
      imageHash: asset.fileHash,
      imageMimeType: asset.mimeType,
      imageSizeBytes: asset.fileSizeBytes,
      gpsLatitude: definition.gpsLatitude ?? null,
      gpsLongitude: definition.gpsLongitude ?? null,
      gpsAccuracyMeters: definition.gpsAccuracyMeters ?? null,
      gpsDistanceMeters,
      idempotencyKey: definition.idempotencyKey,
      rejectionReason: definition.rejectionReason ?? null,
      flagReason: definition.flagReason ?? null,
      confidenceScore: definition.confidenceScore ?? null,
      anomalyScore: definition.anomalyScore ?? null,
      ocrText: definition.ocrText ?? null,
      reviewedAt: definition.reviewedAt ? new Date(definition.reviewedAt) : null,
    },
  };
}

function readingEventsByKey() {
  return {
    "bzv-client-valid-mar": [
      {
        type: ReadingEventType.CREATED,
        actorUsername: "client001",
        createdAt: "2026-03-21T07:32:00.000Z",
        payload: { source: "seed", nextStatus: ReadingStatus.DRAFT },
      },
      {
        type: ReadingEventType.SUBMITTED,
        actorUsername: "client001",
        createdAt: "2026-03-21T07:33:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.DRAFT, nextStatus: ReadingStatus.PENDING },
      },
      {
        type: ReadingEventType.VALIDATED,
        actorUsername: "supervisor001",
        createdAt: "2026-03-21T09:10:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.PENDING, nextStatus: ReadingStatus.VALIDATED },
      },
    ],
    "bzv-dual-flagged-mar": [
      {
        type: ReadingEventType.CREATED,
        actorUsername: "client002",
        createdAt: "2026-03-20T08:14:00.000Z",
        payload: { source: "seed", nextStatus: ReadingStatus.DRAFT },
      },
      {
        type: ReadingEventType.SUBMITTED,
        actorUsername: "client002",
        createdAt: "2026-03-20T08:15:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.DRAFT, nextStatus: ReadingStatus.PENDING },
      },
      {
        type: ReadingEventType.ANOMALY_DETECTED,
        actorUsername: null,
        createdAt: "2026-03-20T09:22:00.000Z",
        payload: {
          source: "seed",
          suspicious: true,
          preferredReasonCode: "INDEX_INCONSISTENT",
          failedChecks: ["primary_index_monotonic", "secondary_index_monotonic", "gps_distance"],
          referenceState: {
            sourceReadingId: null,
            previousPrimary: 903,
            previousSecondary: 392,
            currentPrimary: 941,
            currentSecondary: 408,
            effectiveAt: "2026-03-01T07:00:00.000Z",
          },
          checks: [
            {
              check: "primary_index_monotonic",
              passed: false,
              details: {
                previous: 941,
                current: 918,
                referenceEffectiveAt: "2026-03-01T07:00:00.000Z",
              },
            },
            {
              check: "secondary_index_monotonic",
              passed: false,
              details: {
                previous: 408,
                current: 401,
                referenceEffectiveAt: "2026-03-01T07:00:00.000Z",
              },
            },
            {
              check: "gps_distance",
              passed: false,
              details: {
                distanceMeters: 4511.13,
                thresholdMeters: 200,
                meterLatitude: -4.2894,
                meterLongitude: 15.2673,
                readingLatitude: -4.2512,
                readingLongitude: 15.281,
              },
            },
          ],
          anomalyScore: 79.1,
        },
      },
      {
        type: ReadingEventType.FLAGGED,
        actorUsername: "supervisor001",
        createdAt: "2026-03-20T10:05:00.000Z",
        payload: {
          source: "seed",
          previousStatus: ReadingStatus.PENDING,
          nextStatus: ReadingStatus.FLAGGED,
          reason: "INDEX_INCONSISTENT",
        },
      },
      {
        type: ReadingEventType.TASK_CREATED,
        actorUsername: "supervisor001",
        createdAt: "2026-03-20T10:17:00.000Z",
        payload: {
          source: "seed",
          taskTitle: "Controle terrain index incoherent compteur CG-BZV-0002",
        },
      },
    ],
    "pnr-client-rejected-mar": [
      {
        type: ReadingEventType.CREATED,
        actorUsername: "client003",
        createdAt: "2026-03-19T06:55:00.000Z",
        payload: { source: "seed", nextStatus: ReadingStatus.DRAFT },
      },
      {
        type: ReadingEventType.SUBMITTED,
        actorUsername: "client003",
        createdAt: "2026-03-19T06:56:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.DRAFT, nextStatus: ReadingStatus.PENDING },
      },
      {
        type: ReadingEventType.REJECTED,
        actorUsername: "supervisor002",
        createdAt: "2026-03-19T08:11:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.PENDING, nextStatus: ReadingStatus.REJECTED, reason: "blurry_image" },
      },
      {
        type: ReadingEventType.TASK_CREATED,
        actorUsername: "supervisor002",
        createdAt: "2026-03-19T08:45:00.000Z",
        payload: { source: "seed", taskTitle: "Confirmation terrain releve CG-PNR-0003" },
      },
    ],
    "pnr-agent-confirmed-mar": [
      {
        type: ReadingEventType.CREATED,
        actorUsername: "agent002",
        createdAt: "2026-03-20T09:48:00.000Z",
        payload: { source: "seed", nextStatus: ReadingStatus.DRAFT },
      },
      {
        type: ReadingEventType.SUBMITTED,
        actorUsername: "agent002",
        createdAt: "2026-03-20T09:49:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.DRAFT, nextStatus: ReadingStatus.PENDING },
      },
      {
        type: ReadingEventType.VALIDATED,
        actorUsername: "supervisor002",
        createdAt: "2026-03-20T10:12:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.PENDING, nextStatus: ReadingStatus.VALIDATED },
      },
    ],
    "dls-client-pending-mar": [
      {
        type: ReadingEventType.CREATED,
        actorUsername: "client005",
        createdAt: "2026-03-21T11:05:00.000Z",
        payload: { source: "seed", nextStatus: ReadingStatus.DRAFT },
      },
      {
        type: ReadingEventType.SUBMITTED,
        actorUsername: "client005",
        createdAt: "2026-03-21T11:06:00.000Z",
        payload: { source: "seed", previousStatus: ReadingStatus.DRAFT, nextStatus: ReadingStatus.PENDING },
      },
    ],
  };
}

function buildTaskItems(taskByKey, meterBySerial, userByUsername) {
  return [
    {
      taskId: taskByKey["bzv-dual-gps-recheck"].id,
      meterId: meterBySerial["MF-CG-BZV-0002"].id,
      title: "Verifier la position GPS du releve client",
      details: "Comparer les coordonnees du releve avec l emplacement enregistre du compteur.",
      status: TaskItemStatus.TODO,
      sortOrder: 1,
    },
    {
      taskId: taskByKey["bzv-dual-gps-recheck"].id,
      meterId: meterBySerial["MF-CG-BZV-0002"].id,
      title: "Prendre une nouvelle photo terrain",
      details: "Documenter les deux index du compteur double tarification.",
      status: TaskItemStatus.TODO,
      sortOrder: 2,
    },
    {
      taskId: taskByKey["pnr-reading-confirmed"].id,
      meterId: meterBySerial["MF-CG-PNR-0003"].id,
      completedById: userByUsername.agent002.id,
      title: "Contacter la cliente",
      details: "Presence confirmee sur site avant la verification du compteur.",
      status: TaskItemStatus.DONE,
      sortOrder: 1,
      completedAt: new Date("2026-03-20T08:42:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-reading-confirmed"].id,
      meterId: meterBySerial["MF-CG-PNR-0003"].id,
      completedById: userByUsername.agent002.id,
      title: "Confirmer le nouvel index",
      details: "Nouvelle photo terrain archivee et releve agent valide.",
      status: TaskItemStatus.DONE,
      sortOrder: 2,
      completedAt: new Date("2026-03-20T09:48:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-fraud-escalation"].id,
      meterId: meterBySerial["MF-CG-PNR-0004"].id,
      completedById: userByUsername.agent002.id,
      title: "Inspecter les scelles",
      details: "Anomalie constatee sur le boitier du compteur.",
      status: TaskItemStatus.DONE,
      sortOrder: 1,
      completedAt: new Date("2026-03-22T07:44:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-fraud-escalation"].id,
      meterId: meterBySerial["MF-CG-PNR-0004"].id,
      completedById: userByUsername.agent002.id,
      title: "Constituer la preuve terrain",
      details: "Photo terrain et commentaire d escalation enregistres.",
      status: TaskItemStatus.DONE,
      sortOrder: 2,
      completedAt: new Date("2026-03-22T08:05:00.000Z"),
    },
    {
      taskId: taskByKey["dls-access-check"].id,
      meterId: meterBySerial["MF-CG-DLS-0005"].id,
      completedById: userByUsername.agent003.id,
      title: "Appeler le client",
      details: "Client joint une premiere fois avant depart terrain.",
      status: TaskItemStatus.DONE,
      sortOrder: 1,
      completedAt: new Date("2026-03-22T09:22:00.000Z"),
    },
    {
      taskId: taskByKey["dls-access-check"].id,
      meterId: meterBySerial["MF-CG-DLS-0005"].id,
      title: "Verifier l acces au compteur",
      details: "Confirmer si le compteur est accessible dans la journee.",
      status: TaskItemStatus.TODO,
      sortOrder: 2,
    },
    {
      taskId: taskByKey["bzv-follow-up-reminder"].id,
      meterId: meterBySerial["MF-CG-BZV-0006"].id,
      title: "Relancer le client avant 16h30",
      details: "Encourager la soumission depuis le mobile avant passage terrain.",
      status: TaskItemStatus.TODO,
      sortOrder: 1,
    },
  ];
}

function buildTaskComments(taskByKey, userByUsername) {
  return [
    {
      taskId: taskByKey["bzv-dual-gps-recheck"].id,
      userId: userByUsername.supervisor001.id,
      comment: "Ecart GPS eleve detecte. Priorite a un controle terrain rapide.",
      isInternal: true,
      createdAt: new Date("2026-03-20T10:18:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-reading-confirmed"].id,
      userId: userByUsername.agent002.id,
      comment: "Compteur accessible, photo reprise correctement et index confirme sur place.",
      isInternal: true,
      createdAt: new Date("2026-03-20T10:05:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-fraud-escalation"].id,
      userId: userByUsername.agent002.id,
      comment: "Scelle absent et boitier ouvert. Escalade demandee au superviseur regional.",
      isInternal: true,
      createdAt: new Date("2026-03-22T08:06:00.000Z"),
    },
    {
      taskId: taskByKey["dls-access-check"].id,
      userId: userByUsername.agent003.id,
      comment: "Premiere tentative de passage planifiee avant midi.",
      isInternal: true,
      createdAt: new Date("2026-03-22T09:24:00.000Z"),
    },
    {
      taskId: taskByKey["bzv-follow-up-reminder"].id,
      userId: userByUsername.supervisor001.id,
      comment: "Aucune soumission recue ce matin. Passage uniquement si le client ne repond pas a la relance.",
      isInternal: true,
      createdAt: new Date("2026-03-22T07:15:00.000Z"),
    },
  ];
}

function buildTaskEventDefinitions(taskByKey, userByUsername) {
  return [
    {
      taskId: taskByKey["bzv-dual-gps-recheck"].id,
      actorUserId: userByUsername.supervisor001.id,
      recipientUserId: userByUsername.agent001.id,
      type: TaskEventType.ASSIGNED,
      payload: { source: "seed", nextStatus: TaskStatus.OPEN },
      createdAt: new Date("2026-03-20T10:17:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-reading-confirmed"].id,
      actorUserId: userByUsername.supervisor002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.ASSIGNED,
      payload: { source: "seed", nextStatus: TaskStatus.OPEN },
      createdAt: new Date("2026-03-19T08:45:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-reading-confirmed"].id,
      actorUserId: userByUsername.agent002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.STARTED,
      payload: { source: "seed", previousStatus: TaskStatus.OPEN, nextStatus: TaskStatus.IN_PROGRESS },
      createdAt: new Date("2026-03-20T08:40:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-reading-confirmed"].id,
      actorUserId: userByUsername.agent002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.FIELD_RESULT_SUBMITTED,
      payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.DONE, resolutionCode: TaskResolutionCode.READING_CONFIRMED },
      createdAt: new Date("2026-03-20T09:48:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-reading-confirmed"].id,
      actorUserId: userByUsername.agent002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.COMPLETED,
      payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.DONE },
      createdAt: new Date("2026-03-20T10:15:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-fraud-escalation"].id,
      actorUserId: userByUsername.supervisor002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.ASSIGNED,
      payload: { source: "seed", nextStatus: TaskStatus.OPEN },
      createdAt: new Date("2026-03-21T16:10:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-fraud-escalation"].id,
      actorUserId: userByUsername.agent002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.STARTED,
      payload: { source: "seed", previousStatus: TaskStatus.OPEN, nextStatus: TaskStatus.IN_PROGRESS },
      createdAt: new Date("2026-03-22T07:30:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-fraud-escalation"].id,
      actorUserId: userByUsername.agent002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.FIELD_RESULT_SUBMITTED,
      payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.BLOCKED, resolutionCode: TaskResolutionCode.ESCALATION_REQUIRED },
      createdAt: new Date("2026-03-22T08:05:00.000Z"),
    },
    {
      taskId: taskByKey["pnr-fraud-escalation"].id,
      actorUserId: userByUsername.agent002.id,
      recipientUserId: userByUsername.agent002.id,
      type: TaskEventType.BLOCKED,
      payload: { source: "seed", previousStatus: TaskStatus.IN_PROGRESS, nextStatus: TaskStatus.BLOCKED, resolutionCode: TaskResolutionCode.ESCALATION_REQUIRED },
      createdAt: new Date("2026-03-22T08:08:00.000Z"),
    },
    {
      taskId: taskByKey["dls-access-check"].id,
      actorUserId: userByUsername.supervisor002.id,
      recipientUserId: userByUsername.agent003.id,
      type: TaskEventType.ASSIGNED,
      payload: { source: "seed", nextStatus: TaskStatus.OPEN },
      createdAt: new Date("2026-03-21T14:20:00.000Z"),
    },
    {
      taskId: taskByKey["dls-access-check"].id,
      actorUserId: userByUsername.agent003.id,
      recipientUserId: userByUsername.agent003.id,
      type: TaskEventType.STARTED,
      payload: { source: "seed", previousStatus: TaskStatus.OPEN, nextStatus: TaskStatus.IN_PROGRESS },
      createdAt: new Date("2026-03-22T09:20:00.000Z"),
    },
    {
      taskId: taskByKey["bzv-follow-up-reminder"].id,
      actorUserId: userByUsername.supervisor001.id,
      recipientUserId: userByUsername.agent001.id,
      type: TaskEventType.ASSIGNED,
      payload: { source: "seed", nextStatus: TaskStatus.OPEN },
      createdAt: new Date("2026-03-22T07:10:00.000Z"),
    },
  ];
}

function planByCodeMap(plans) {
  return Object.fromEntries(plans.map((plan) => [plan.code, plan]));
}

function sumMoney(lines) {
  return roundTo(
    lines.reduce((total, line) => total + Number(line.amount), 0),
    2
  );
}

function buildConsumptionLines(consumptionPrimary, consumptionSecondary, plan) {
  if (plan.billingMode === TariffBillingMode.TIME_OF_USE) {
    return [
      {
        type: InvoiceLineType.CONSUMPTION,
        label: "Energie HP",
        quantity: quantity(consumptionPrimary || 0),
        unitPrice: quantity(plan.hpUnitPrice || 0),
        amount: money((consumptionPrimary || 0) * (plan.hpUnitPrice || 0)),
        meta: { indexType: "PRIMARY" },
      },
      {
        type: InvoiceLineType.CONSUMPTION,
        label: "Energie HC",
        quantity: quantity(consumptionSecondary || 0),
        unitPrice: quantity(plan.hcUnitPrice || 0),
        amount: money((consumptionSecondary || 0) * (plan.hcUnitPrice || 0)),
        meta: { indexType: "SECONDARY" },
      },
    ].filter((line) => Number(line.quantity) > 0 || Number(line.amount) > 0);
  }

  const totalConsumption = roundTo((consumptionPrimary || 0) + (consumptionSecondary || 0), 3);
  return [
    {
      type: InvoiceLineType.CONSUMPTION,
      label: "Energie facturee",
      quantity: quantity(totalConsumption),
      unitPrice: quantity(plan.singleUnitPrice || 0),
      amount: money(totalConsumption * (plan.singleUnitPrice || 0)),
      meta: { billingMode: TariffBillingMode.SINGLE_RATE },
    },
  ].filter((line) => Number(line.quantity) > 0 || Number(line.amount) > 0);
}

function buildAdditionalTaxLines(plan, subtotal, fixedAmount) {
  return (plan.taxes || []).map((tax) => {
    const baseAmount =
      tax.applicationScope === TaxApplicationScope.CONSUMPTION
        ? subtotal
        : tax.applicationScope === TaxApplicationScope.FIXED_CHARGE
          ? fixedAmount
          : subtotal + fixedAmount;

    const amount =
      tax.type === TaxRuleType.PERCENT
        ? roundTo((baseAmount * tax.value) / 100, 2)
        : roundTo(tax.value, 2);

    return {
      type: InvoiceLineType.TAX,
      label: tax.type === TaxRuleType.PERCENT ? `${tax.name} ${tax.value}%` : tax.name,
      quantity: quantity(1),
      unitPrice: quantity(amount),
      amount: money(amount),
      meta: {
        taxRuleCode: tax.code,
        taxType: tax.type,
        applicationScope: tax.applicationScope,
        baseAmount: money(baseAmount),
        value: tax.value,
      },
    };
  });
}

function buildInvoiceScenario(params) {
  const consumptionLines = buildConsumptionLines(
    params.consumptionPrimary || 0,
    params.consumptionSecondary || 0,
    params.tariffPlan
  );
  const subtotal = sumMoney(consumptionLines);
  const fixedAmount = params.tariffPlan.fixedCharge;
  const baseTaxAmount = roundTo((subtotal + fixedAmount) * (params.tariffPlan.taxPercent / 100), 2);
  const additionalTaxLines = buildAdditionalTaxLines(params.tariffPlan, subtotal, fixedAmount);
  const additionalTaxAmount = sumMoney(additionalTaxLines);
  const taxAmount = roundTo(baseTaxAmount + additionalTaxAmount, 2);
  const totalAmount = roundTo(subtotal + fixedAmount + taxAmount, 2);
  const paidAmount = roundTo(
    params.paidAmount !== undefined && params.paidAmount !== null
      ? params.paidAmount
      : params.status === InvoiceStatus.PAID
        ? totalAmount
        : 0,
    2
  );

  const lines = [
    ...consumptionLines,
    {
      type: InvoiceLineType.FIXED_FEE,
      label: "Abonnement mensuel",
      quantity: quantity(1),
      unitPrice: quantity(params.tariffPlan.fixedCharge),
      amount: money(fixedAmount),
      meta: { fixedCharge: params.tariffPlan.fixedCharge },
    },
    {
      type: InvoiceLineType.TAX,
      label: `TVA ${params.tariffPlan.taxPercent}%`,
      quantity: quantity(1),
      unitPrice: quantity(baseTaxAmount),
      amount: money(baseTaxAmount),
      meta: { taxPercent: params.tariffPlan.taxPercent, taxKind: "BASE" },
    },
    ...additionalTaxLines,
  ];

  return {
    ...params,
    subtotal: money(subtotal),
    fixedAmount: money(fixedAmount),
    taxAmount: money(taxAmount),
    totalAmount: money(totalAmount),
    paidAmount: money(paidAmount),
    lines,
  };
}

function invoiceScenarios(planLookup) {
  return [
    buildInvoiceScenario({
      invoiceNumber: "FAC-CG-2026-02-0001",
      tariffPlan: planLookup["CG-MKL-RES-STD-2026"],
      tariffPlanCode: "CG-MKL-RES-STD-2026",
      campaignCode: "CG-BILL-2026-02-MKL",
      customerUsername: "client001",
      meterSerialNumber: "MF-CG-BZV-0001",
      status: InvoiceStatus.PAID,
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T23:59:59.000Z",
      dueDate: "2026-03-18T00:00:00.000Z",
      fromPrimaryIndex: 1498,
      toPrimaryIndex: 1568,
      consumptionPrimary: 70,
      issuedAt: "2026-03-07T10:05:00.000Z",
      deliveredAt: "2026-03-07T10:22:00.000Z",
      paidAt: "2026-03-13T12:15:00.000Z",
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      paymentReference: "AIRTEL-CG-784512",
      deliveryChannel: DeliveryChannel.SMS,
    }),
    buildInvoiceScenario({
      invoiceNumber: "FAC-CG-2026-02-0002",
      tariffPlan: planLookup["CG-BCG-RES-TOU-2026"],
      tariffPlanCode: "CG-BCG-RES-TOU-2026",
      campaignCode: "CG-BILL-2026-02-BCG",
      customerUsername: "client002",
      meterSerialNumber: "MF-CG-BZV-0002",
      status: InvoiceStatus.DELIVERED,
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T23:59:59.000Z",
      dueDate: "2026-03-18T00:00:00.000Z",
      fromPrimaryIndex: 903,
      toPrimaryIndex: 941,
      fromSecondaryIndex: 392,
      toSecondaryIndex: 408,
      consumptionPrimary: 38,
      consumptionSecondary: 16,
      issuedAt: "2026-03-07T10:12:00.000Z",
      deliveredAt: "2026-03-07T10:34:00.000Z",
      deliveryChannel: DeliveryChannel.EMAIL,
    }),
    buildInvoiceScenario({
      invoiceNumber: "FAC-CG-2026-02-0003",
      tariffPlan: planLookup["CG-TIE-RES-STD-2026"],
      tariffPlanCode: "CG-TIE-RES-STD-2026",
      campaignCode: "CG-BILL-2026-02-TIE",
      customerUsername: "client003",
      meterSerialNumber: "MF-CG-PNR-0003",
      status: InvoiceStatus.OVERDUE,
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T23:59:59.000Z",
      dueDate: "2026-03-16T00:00:00.000Z",
      fromPrimaryIndex: 2341,
      toPrimaryIndex: 2386,
      consumptionPrimary: 45,
      issuedAt: "2026-03-07T10:20:00.000Z",
      deliveredAt: "2026-03-07T10:48:00.000Z",
      deliveryChannel: DeliveryChannel.SMS,
    }),
    buildInvoiceScenario({
      invoiceNumber: "FAC-CG-2026-02-0004",
      tariffPlan: planLookup["CG-LMB-PRO-TOU-2026"],
      tariffPlanCode: "CG-LMB-PRO-TOU-2026",
      campaignCode: "CG-BILL-2026-02-LMB",
      customerUsername: "client004",
      meterSerialNumber: "MF-CG-PNR-0004",
      status: InvoiceStatus.PARTIALLY_PAID,
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T23:59:59.000Z",
      dueDate: "2026-03-18T00:00:00.000Z",
      fromPrimaryIndex: 4876,
      toPrimaryIndex: 5008,
      fromSecondaryIndex: 1282,
      toSecondaryIndex: 1318,
      consumptionPrimary: 132,
      consumptionSecondary: 36,
      issuedAt: "2026-03-07T10:27:00.000Z",
      deliveredAt: "2026-03-07T11:02:00.000Z",
      paidAmount: 12000,
      paidAt: "2026-03-15T09:10:00.000Z",
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentReference: "BGFI-PNR-20260315-104",
      deliveryChannel: DeliveryChannel.EMAIL,
    }),
    buildInvoiceScenario({
      invoiceNumber: "FAC-CG-2026-02-0005",
      tariffPlan: planLookup["CG-TLG-RES-STD-2026"],
      tariffPlanCode: "CG-TLG-RES-STD-2026",
      campaignCode: "CG-BILL-2026-02-TLG",
      customerUsername: "client006",
      meterSerialNumber: "MF-CG-BZV-0006",
      status: InvoiceStatus.ISSUED,
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T23:59:59.000Z",
      dueDate: "2026-03-23T00:00:00.000Z",
      fromPrimaryIndex: 1805,
      toPrimaryIndex: 1848,
      consumptionPrimary: 43,
      issuedAt: "2026-03-07T10:40:00.000Z",
      deliveryChannel: DeliveryChannel.PORTAL,
    }),
  ];
}

async function cleanupManagedBilling() {
  const campaignCodes = managedBillingCampaigns.map((campaign) => campaign.code);
  const tariffCodes = managedTariffPlans.map((plan) => plan.code);
  const taxCodes = managedTariffPlans.flatMap((plan) => (plan.taxes || []).map((tax) => tax.code));
  const invoiceNumbers = invoiceScenarios(planByCodeMap(managedTariffPlans)).map((invoice) => invoice.invoiceNumber);
  const meterSerialNumbers = meters.map((meter) => meter.serialNumber);
  const contractNumbers = meters.map((meter) => meter.contractNumber).filter(Boolean);
  const policeNumbers = meters.map((meter) => meter.policeNumber).filter(Boolean);

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { invoiceNumber: { in: invoiceNumbers } },
        { campaign: { code: { in: campaignCodes } } },
        { tariffPlan: { code: { in: tariffCodes } } },
      ],
    },
    select: { id: true },
  });

  const invoiceIds = invoices.map((invoice) => invoice.id);
  if (invoiceIds.length > 0) {
    await prisma.invoiceDelivery.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoiceEvent.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  }

  await prisma.serviceContract.deleteMany({
    where: {
      OR: [
        contractNumbers.length > 0 ? { contractNumber: { in: contractNumbers } } : undefined,
        policeNumbers.length > 0 ? { policeNumber: { in: policeNumbers } } : undefined,
        meterSerialNumbers.length > 0 ? { meter: { serialNumber: { in: meterSerialNumbers } } } : undefined,
      ].filter(Boolean),
    },
  });

  const campaignIds = (
    await prisma.billingCampaign.findMany({
      where: { code: { in: campaignCodes } },
      select: { id: true },
    })
  ).map((campaign) => campaign.id);

  if (campaignIds.length > 0) {
    await prisma.billingCampaignZone.deleteMany({ where: { campaignId: { in: campaignIds } } });
    await prisma.billingCampaign.deleteMany({ where: { id: { in: campaignIds } } });
  }

  const tariffPlans = await prisma.tariffPlan.findMany({
    where: { code: { in: tariffCodes } },
    select: { id: true },
  });
  const tariffPlanIds = tariffPlans.map((plan) => plan.id);
  if (tariffPlanIds.length > 0) {
    await prisma.tariffPlanTax.deleteMany({ where: { tariffPlanId: { in: tariffPlanIds } } });
    await prisma.tariffTier.deleteMany({ where: { tariffPlanId: { in: tariffPlanIds } } });
  }
  if (taxCodes.length > 0) {
    await prisma.taxRule.deleteMany({ where: { code: { in: taxCodes } } });
  }
}

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
    (await prisma.role.findMany({ where: { deletedAt: null } })).map((role) => [role.code, role])
  );
  const permissionByCode = Object.fromEntries(
    (await prisma.permission.findMany({ where: { deletedAt: null } })).map((permission) => [permission.code, permission])
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

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const createdUsers = [];
  for (const user of users) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ phone: user.phone }, { email: user.email }, { username: user.username }],
      },
      select: { id: true },
    });

    const data = {
      phone: user.phone,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      region: user.region,
      city: user.city,
      zone: user.zone,
      passwordHash,
      activatedAt: user.status === UserStatus.ACTIVE ? new Date(user.activatedAt) : null,
      deletedAt: null,
    };

    const saved = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.user.create({
          data,
        });

    createdUsers.push(saved);
  }

  const admin = createdUsers.find((user) => user.role === UserRole.ADMIN) || createdUsers[0];
  const userByUsername = Object.fromEntries(createdUsers.map((user) => [user.username, user]));

  for (const user of createdUsers) {
    const role = roleByCode[user.role];
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: { assignedById: admin.id, deletedAt: null },
      create: { userId: user.id, roleId: role.id, assignedById: admin.id },
    });
  }

  for (const city of managedCities) {
    await prisma.city.upsert({
      where: { code: city.code },
      update: {
        name: city.name,
        region: city.region,
        isActive: true,
        deletedAt: null,
      },
      create: city,
    });
  }

  const createdCities = await prisma.city.findMany({
    where: { code: { in: managedCities.map((city) => city.code) } },
  });
  const cityByCode = Object.fromEntries(createdCities.map((city) => [city.code, city]));

  for (const zone of managedZones) {
    const city = cityByCode[zone.cityCode];
    if (!city) {
      throw new Error(`Missing city for zone ${zone.code}`);
    }

    await prisma.zone.upsert({
      where: { code: zone.code },
      update: {
        name: zone.name,
        cityId: city.id,
        isActive: true,
        deletedAt: null,
      },
      create: {
        code: zone.code,
        name: zone.name,
        cityId: city.id,
      },
    });
  }

  const createdZones = await prisma.zone.findMany({
    where: { code: { in: managedZones.map((zone) => zone.code) } },
    include: { city: true },
  });
  const zoneByCode = Object.fromEntries(createdZones.map((zone) => [zone.code, zone]));

  for (const meter of meters) {
    const customer = userByUsername[meter.customerUsername];
    const agent = userByUsername[meter.assignedAgentUsername];
    const zone = zoneByCode[meter.zoneCode];

    if (!customer) {
      throw new Error(`Missing customer for meter ${meter.serialNumber}`);
    }

    await prisma.meter.upsert({
      where: { serialNumber: meter.serialNumber },
      update: {
        meterReference: meter.meterReference,
        assignedAgentId: agent?.id ?? null,
        zoneId: zone?.id ?? null,
        type: meter.type,
        status: meter.status,
        addressLine1: meter.addressLine1,
        city: meter.city,
        zone: meter.zone,
        latitude: meter.latitude,
        longitude: meter.longitude,
        installedAt: new Date(meter.installedAt),
        lastInspectionAt: new Date(meter.lastInspectionAt),
        deletedAt: null,
      },
      create: {
        serialNumber: meter.serialNumber,
        meterReference: meter.meterReference,
        assignedAgentId: agent?.id ?? null,
        zoneId: zone?.id ?? null,
        type: meter.type,
        status: meter.status,
        addressLine1: meter.addressLine1,
        city: meter.city,
        zone: meter.zone,
        latitude: meter.latitude,
        longitude: meter.longitude,
        installedAt: new Date(meter.installedAt),
        lastInspectionAt: new Date(meter.lastInspectionAt),
      },
    });
  }

  const createdMeters = await prisma.meter.findMany({
    where: { serialNumber: { in: meters.map((meter) => meter.serialNumber) } },
  });
  const meterBySerial = Object.fromEntries(createdMeters.map((meter) => [meter.serialNumber, meter]));
  const serviceContractByMeterSerial = {};

  await prisma.meterAssignment.deleteMany({
    where: { meterId: { in: createdMeters.map((meter) => meter.id) } },
  });

  for (const meter of meters) {
    const customer = userByUsername[meter.customerUsername];
    const createdMeter = meterBySerial[meter.serialNumber];

    if (!customer || !createdMeter) {
      throw new Error(`Missing assignment data for meter ${meter.serialNumber}`);
    }

    await prisma.meterAssignment.create({
      data: {
        meterId: createdMeter.id,
        customerId: customer.id,
        assignedById: admin.id,
        source: MeterAssignmentSource.SYSTEM,
        assignedAt: new Date(meter.installedAt),
      },
    });
  }

  await cleanupManagedTasks();
  await cleanupManagedReadings();
  await cleanupManagedBilling();
  await cleanupLegacyMeters(userByUsername);

  for (const meter of meters) {
    const customer = userByUsername[meter.customerUsername];
    const createdMeter = meterBySerial[meter.serialNumber];

    if (!customer || !createdMeter) {
      throw new Error(`Missing service contract data for meter ${meter.serialNumber}`);
    }

    const savedContract = await prisma.serviceContract.create({
      data: {
        meterId: createdMeter.id,
        customerId: customer.id,
        createdById: admin.id,
        contractNumber: meter.contractNumber,
        policeNumber: meter.policeNumber,
        usageCategory: meter.usageCategory,
        billingMode: meter.contractBillingMode,
        subscribedPowerValue: meter.subscribedPowerValue,
        subscribedPowerUnit: meter.subscribedPowerUnit,
        phaseType: meter.phaseType,
        effectiveFrom: new Date(meter.contractEffectiveFrom || meter.installedAt),
      },
    });

    serviceContractByMeterSerial[meter.serialNumber] = savedContract;
  }

  await prisma.meterState.deleteMany({
    where: { meterId: { in: createdMeters.map((meter) => meter.id) } },
  });

  const baseMeterStates = buildMeterStatesFromHistory();
  for (const state of baseMeterStates) {
    const meter = meterBySerial[state.serialNumber];
    await prisma.meterState.create({
      data: {
        meterId: meter.id,
        previousPrimary: state.previousPrimary,
        previousSecondary: state.previousSecondary,
        currentPrimary: state.currentPrimary,
        currentSecondary: state.currentSecondary,
        effectiveAt: new Date(state.effectiveAt),
      },
    });
  }

  const demoAssets = await buildDemoAssetMap();

  const readingByKey = {};
  for (const readingDefinition of demoReadings) {
    const meter = meterBySerial[readingDefinition.meterSerialNumber];
    const submittedBy = userByUsername[readingDefinition.submittedByUsername];
    const reviewedBy = readingDefinition.reviewedByUsername
      ? userByUsername[readingDefinition.reviewedByUsername]
      : null;
    const asset = demoAssets[readingDefinition.assetSlug];

    if (!meter || !submittedBy || !asset) {
      throw new Error(`Incomplete seed references for reading ${readingDefinition.key}`);
    }

    const payload = buildReadingPayload(readingDefinition, meter, submittedBy, reviewedBy, asset);
    const savedReading = await prisma.reading.create({ data: payload.data });
    readingByKey[payload.key] = savedReading;
  }

  await prisma.meterState.create({
    data: {
      meterId: meterBySerial["MF-CG-BZV-0001"].id,
      sourceReadingId: readingByKey["bzv-client-valid-mar"].id,
      previousPrimary: 1568,
      currentPrimary: 1606,
      effectiveAt: new Date("2026-03-21T07:32:00.000Z"),
    },
  });

  await prisma.meterState.create({
    data: {
      meterId: meterBySerial["MF-CG-PNR-0003"].id,
      sourceReadingId: readingByKey["pnr-agent-confirmed-mar"].id,
      previousPrimary: 2386,
      currentPrimary: 2413,
      effectiveAt: new Date("2026-03-20T09:48:00.000Z"),
    },
  });

  const createdReadingEvents = [];
  const readingEventDefinitions = readingEventsByKey();
  for (const [readingKey, events] of Object.entries(readingEventDefinitions)) {
    for (const event of events) {
      const createdEvent = await prisma.readingEvent.create({
        data: {
          readingId: readingByKey[readingKey].id,
          userId: event.actorUsername ? userByUsername[event.actorUsername].id : null,
          type: event.type,
          payload: event.payload,
          createdAt: new Date(event.createdAt),
        },
      });
      createdReadingEvents.push({ readingKey, ...event, id: createdEvent.id });
    }
  }

  const readingEventId = Object.fromEntries(
    createdReadingEvents.map((event) => [`${event.readingKey}:${event.type}:${toIsoDate(event.createdAt)}`, event.id])
  );

  await prisma.mobileNotificationRead.createMany({
    data: [
      {
        userId: userByUsername.client001.id,
        readingEventId: readingEventId["bzv-client-valid-mar:SUBMITTED:2026-03-21T07:33:00.000Z"],
        readAt: new Date("2026-03-21T07:40:00.000Z"),
      },
      {
        userId: userByUsername.client002.id,
        readingEventId: readingEventId["bzv-dual-flagged-mar:SUBMITTED:2026-03-20T08:15:00.000Z"],
        readAt: new Date("2026-03-20T08:21:00.000Z"),
      },
      {
        userId: userByUsername.client003.id,
        readingEventId: readingEventId["pnr-client-rejected-mar:REJECTED:2026-03-19T08:11:00.000Z"],
        readAt: new Date("2026-03-19T09:05:00.000Z"),
      },
    ].filter((item) => item.readingEventId)
  });

  const taskByKey = {};
  for (const task of managedTaskDefinitions) {
    const meter = meterBySerial[task.meterSerialNumber];
    const assignedTo = userByUsername[task.assignedToUsername];
    const createdBy = userByUsername[task.createdByUsername];
    const startedBy = task.startedByUsername ? userByUsername[task.startedByUsername] : null;
    const closedBy = task.closedByUsername ? userByUsername[task.closedByUsername] : null;
    const reading = task.readingKey ? readingByKey[task.readingKey] : null;
    const reportedReading = task.reportedReadingKey ? readingByKey[task.reportedReadingKey] : null;
    const asset = task.assetSlug ? demoAssets[task.assetSlug] : null;

    const savedTask = await prisma.task.create({
      data: {
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
        fieldImageUrl: asset?.fileUrl ?? null,
        fieldImageHash: asset?.fileHash ?? null,
        fieldImageMimeType: asset?.mimeType ?? null,
        fieldImageSizeBytes: asset?.fileSizeBytes ?? null,
        fieldGpsLatitude: task.fieldGpsLatitude ?? null,
        fieldGpsLongitude: task.fieldGpsLongitude ?? null,
        fieldGpsAccuracyMeters: task.fieldGpsAccuracyMeters ?? null,
        createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
      },
    });

    taskByKey[task.key] = savedTask;
  }

  await prisma.taskItem.createMany({
    data: buildTaskItems(taskByKey, meterBySerial, userByUsername),
  });

  await prisma.taskComment.createMany({
    data: buildTaskComments(taskByKey, userByUsername),
  });

  await prisma.taskAttachment.createMany({
    data: [
      {
        taskId: taskByKey["pnr-reading-confirmed"].id,
        uploadedById: userByUsername.agent002.id,
        fileUrl: demoAssets["task-pnr-reading-confirmed"].fileUrl,
        fileName: "pnr-reading-confirmed.svg",
        mimeType: demoAssets["task-pnr-reading-confirmed"].mimeType,
        fileHash: demoAssets["task-pnr-reading-confirmed"].fileHash,
        fileSizeBytes: demoAssets["task-pnr-reading-confirmed"].fileSizeBytes,
        createdAt: new Date("2026-03-20T09:48:00.000Z"),
      },
      {
        taskId: taskByKey["pnr-fraud-escalation"].id,
        uploadedById: userByUsername.agent002.id,
        fileUrl: demoAssets["task-pnr-fraud-blocked"].fileUrl,
        fileName: "pnr-fraud-escalation.svg",
        mimeType: demoAssets["task-pnr-fraud-blocked"].mimeType,
        fileHash: demoAssets["task-pnr-fraud-blocked"].fileHash,
        fileSizeBytes: demoAssets["task-pnr-fraud-blocked"].fileSizeBytes,
        createdAt: new Date("2026-03-22T08:05:00.000Z"),
      },
    ],
  });

  const createdTaskEvents = [];
  for (const event of buildTaskEventDefinitions(taskByKey, userByUsername)) {
    const created = await prisma.taskEvent.create({ data: event });
    createdTaskEvents.push(created);
  }

  const taskEventIdByKey = Object.fromEntries(
    createdTaskEvents.map((event) => [`${event.taskId}:${event.type}:${event.createdAt.toISOString()}`, event.id])
  );

  await prisma.agentNotificationRead.createMany({
    data: [
      {
        userId: userByUsername.agent002.id,
        taskEventId:
          taskEventIdByKey[
            `${taskByKey["pnr-reading-confirmed"].id}:${TaskEventType.ASSIGNED}:2026-03-19T08:45:00.000Z`
          ],
        readAt: new Date("2026-03-19T08:55:00.000Z"),
      },
      {
        userId: userByUsername.agent002.id,
        taskEventId:
          taskEventIdByKey[
            `${taskByKey["pnr-reading-confirmed"].id}:${TaskEventType.COMPLETED}:2026-03-20T10:15:00.000Z`
          ],
        readAt: new Date("2026-03-20T10:20:00.000Z"),
      },
      {
        userId: userByUsername.agent003.id,
        taskEventId:
          taskEventIdByKey[
            `${taskByKey["dls-access-check"].id}:${TaskEventType.ASSIGNED}:2026-03-21T14:20:00.000Z`
          ],
        readAt: new Date("2026-03-21T14:35:00.000Z"),
      },
    ].filter((entry) => entry.taskEventId)
  });

  const managedTariffPlanIds = {};
  for (const plan of managedTariffPlans) {
    const zone = plan.zoneCode ? zoneByCode[plan.zoneCode] : null;
    const savedPlan = await prisma.tariffPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        zoneId: zone?.id ?? null,
        billingMode: plan.billingMode,
        usageCategory: plan.usageCategory,
        subscribedPowerUnit: plan.subscribedPowerUnit,
        subscribedPowerMin: plan.subscribedPowerMin,
        subscribedPowerMax: plan.subscribedPowerMax,
        phaseType: plan.phaseType,
        currency: plan.currency,
        singleUnitPrice: plan.singleUnitPrice,
        hpUnitPrice: plan.hpUnitPrice,
        hcUnitPrice: plan.hcUnitPrice,
        fixedCharge: plan.fixedCharge,
        taxPercent: plan.taxPercent,
        lateFeePercent: plan.lateFeePercent,
        isDefault: plan.isDefault,
        isActive: plan.isActive,
        deletedAt: null,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        zoneId: zone?.id ?? null,
        billingMode: plan.billingMode,
        usageCategory: plan.usageCategory,
        subscribedPowerUnit: plan.subscribedPowerUnit,
        subscribedPowerMin: plan.subscribedPowerMin,
        subscribedPowerMax: plan.subscribedPowerMax,
        phaseType: plan.phaseType,
        currency: plan.currency,
        singleUnitPrice: plan.singleUnitPrice,
        hpUnitPrice: plan.hpUnitPrice,
        hcUnitPrice: plan.hcUnitPrice,
        fixedCharge: plan.fixedCharge,
        taxPercent: plan.taxPercent,
        lateFeePercent: plan.lateFeePercent,
        isDefault: plan.isDefault,
        isActive: plan.isActive,
      },
    });

    managedTariffPlanIds[plan.code] = savedPlan.id;
    await prisma.tariffPlanTax.deleteMany({ where: { tariffPlanId: savedPlan.id } });
    await prisma.tariffTier.deleteMany({ where: { tariffPlanId: savedPlan.id } });
    for (const [index, tax] of (plan.taxes || []).entries()) {
      const savedTax = await prisma.taxRule.upsert({
        where: { code: tax.code },
        update: {
          name: tax.name,
          description: tax.description ?? null,
          zoneId: zone?.id ?? null,
          type: tax.type,
          applicationScope: tax.applicationScope,
          value: tax.value,
          isActive: true,
          deletedAt: null,
        },
        create: {
          code: tax.code,
          name: tax.name,
          description: tax.description ?? null,
          zoneId: zone?.id ?? null,
          type: tax.type,
          applicationScope: tax.applicationScope,
          value: tax.value,
          isActive: true,
        },
      });

      await prisma.tariffPlanTax.create({
        data: {
          tariffPlanId: savedPlan.id,
          taxRuleId: savedTax.id,
          sortOrder: index,
        },
      });
    }
  }

  const campaignByCode = {};
  for (const campaign of managedBillingCampaigns) {
    const selectedZones = (campaign.zoneCodes || []).map((zoneCode) => zoneByCode[zoneCode]).filter(Boolean);
    const savedCampaign = await prisma.billingCampaign.create({
      data: {
        code: campaign.code,
        name: campaign.name,
        periodStart: new Date(campaign.periodStart),
        periodEnd: new Date(campaign.periodEnd),
        submissionStartAt: campaign.submissionStartAt ? new Date(campaign.submissionStartAt) : null,
        submissionEndAt: campaign.submissionEndAt ? new Date(campaign.submissionEndAt) : null,
        cutoffAt: campaign.cutoffAt ? new Date(campaign.cutoffAt) : null,
        frequency: campaign.frequency,
        cityNameSnapshot:
          selectedZones.length === 1
            ? selectedZones[0].city.name
            : selectedZones.length > 1
              ? "MULTI_ZONE"
              : null,
        zoneNameSnapshot:
          selectedZones.length === 1
            ? selectedZones[0].name
            : selectedZones.length > 1
              ? `${selectedZones.length} zones`
              : null,
        status: campaign.status,
        tariffPlanId: managedTariffPlanIds[campaign.tariffPlanCode] ?? null,
        createdById: userByUsername[campaign.createdByUsername].id,
        launchedAt: campaign.launchedAt ? new Date(campaign.launchedAt) : null,
        generatedAt: campaign.generatedAt ? new Date(campaign.generatedAt) : null,
        issuedAt: campaign.issuedAt ? new Date(campaign.issuedAt) : null,
        finalizedAt: campaign.finalizedAt ? new Date(campaign.finalizedAt) : null,
        notes: campaign.notes,
        settingsSnapshot: {
          timezone: demoAppSettings.timezone,
          locale: demoAppSettings.locale,
          maxGpsDistanceMeters: demoAppSettings.maxGpsDistanceMeters,
        },
        zones: {
          create: selectedZones.map((zone) => ({
            zoneId: zone.id,
            cityNameSnapshot: zone.city.name,
            zoneNameSnapshot: zone.name,
          })),
        },
      },
    });
    campaignByCode[campaign.code] = savedCampaign;
  }

  const invoiceDefinitions = invoiceScenarios(planByCodeMap(managedTariffPlans));
  for (const invoice of invoiceDefinitions) {
    const customer = userByUsername[invoice.customerUsername];
    const meter = meterBySerial[invoice.meterSerialNumber];
    const campaign = campaignByCode[invoice.campaignCode];
    const serviceContract = serviceContractByMeterSerial[invoice.meterSerialNumber];
    const invoiceRecord = await prisma.invoice.create({
      data: {
        invoiceNumber: invoice.invoiceNumber,
        campaignId: campaign?.id ?? null,
        tariffPlanId: managedTariffPlanIds[invoice.tariffPlanCode] ?? null,
        serviceContractId: serviceContract?.id ?? null,
        customerId: customer.id,
        meterId: meter.id,
        generatedById: admin.id,
        approvedById: admin.id,
        status: invoice.status,
        currency: "XAF",
        periodStart: new Date(invoice.periodStart),
        periodEnd: new Date(invoice.periodEnd),
        dueDate: new Date(invoice.dueDate),
        fromPrimaryIndex: invoice.fromPrimaryIndex,
        toPrimaryIndex: invoice.toPrimaryIndex,
        fromSecondaryIndex: invoice.fromSecondaryIndex ?? null,
        toSecondaryIndex: invoice.toSecondaryIndex ?? null,
        previousPrimary: invoice.fromPrimaryIndex,
        currentPrimary: invoice.toPrimaryIndex,
        previousSecondary: invoice.fromSecondaryIndex ?? null,
        currentSecondary: invoice.toSecondaryIndex ?? null,
        consumptionPrimary: invoice.consumptionPrimary,
        consumptionSecondary: invoice.consumptionSecondary ?? 0,
        isEstimated: false,
        hasException: false,
        contractNumberSnapshot: serviceContract?.contractNumber ?? null,
        policeNumberSnapshot: serviceContract?.policeNumber ?? null,
        usageCategorySnapshot: serviceContract?.usageCategory ?? null,
        billingModeSnapshot: serviceContract?.billingMode ?? null,
        subscribedPowerValueSnapshot: serviceContract?.subscribedPowerValue ?? null,
        subscribedPowerUnitSnapshot: serviceContract?.subscribedPowerUnit ?? null,
        phaseTypeSnapshot: serviceContract?.phaseType ?? null,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        fixedAmount: invoice.fixedAmount,
        adjustmentAmount: "0.00",
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        issuedAt: invoice.issuedAt ? new Date(invoice.issuedAt) : null,
        deliveredAt: invoice.deliveredAt ? new Date(invoice.deliveredAt) : null,
        metadata: {
          source: "seed-demo",
          city: meter.city,
          zone: meter.zone,
          contractNumber: serviceContract?.contractNumber ?? null,
          policeNumber: serviceContract?.policeNumber ?? null,
        },
      },
    });

    await prisma.invoiceLine.createMany({
      data: invoice.lines.map((line) => ({
        invoiceId: invoiceRecord.id,
        type: line.type,
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        meta: line.meta,
      })),
    });

    const invoiceEvents = [
      {
        type: "GENERATED",
        createdAt: new Date("2026-03-06T09:00:00.000Z"),
        payload: { source: "seed-demo" },
      },
      {
        type: "ISSUED",
        createdAt: new Date(invoice.issuedAt),
        payload: { source: "seed-demo" },
      },
      ...(invoice.deliveredAt
        ? [
            {
              type: "DELIVERED",
              createdAt: new Date(invoice.deliveredAt),
              payload: { source: "seed-demo", channel: invoice.deliveryChannel },
            },
          ]
        : []),
      ...(Number(invoice.paidAmount) > 0
        ? [
            {
              type: "PAYMENT_RECORDED",
              createdAt: new Date(invoice.paidAt),
              payload: {
                source: "seed-demo",
                amount: invoice.paidAmount,
                method: invoice.paymentMethod,
              },
            },
          ]
        : []),
      ...(invoice.status === InvoiceStatus.OVERDUE
        ? [
            {
              type: "MARKED_OVERDUE",
              createdAt: new Date("2026-03-20T08:00:00.000Z"),
              payload: { source: "seed-demo" },
            },
          ]
        : []),
    ];

    for (const event of invoiceEvents) {
      await prisma.invoiceEvent.create({
        data: {
          invoiceId: invoiceRecord.id,
          userId: admin.id,
          type: event.type,
          payload: event.payload,
          createdAt: event.createdAt,
        },
      });
    }

    if (Number(invoice.paidAmount) > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: invoiceRecord.id,
          amount: invoice.paidAmount,
          method: invoice.paymentMethod,
          reference: invoice.paymentReference,
          paidAt: new Date(invoice.paidAt),
          receivedById: admin.id,
          metadata: {
            source: "seed-demo",
          },
        },
      });
    }

    await prisma.invoiceDelivery.create({
      data: {
        invoiceId: invoiceRecord.id,
        channel: invoice.deliveryChannel,
        recipient: customer.phone,
        status: invoice.deliveredAt ? DeliveryStatus.SENT : DeliveryStatus.PENDING,
        sentAt: invoice.deliveredAt ? new Date(invoice.deliveredAt) : null,
        triggeredById: admin.id,
        metadata: {
          source: "seed-demo",
        },
      },
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "global" },
    update: {
      value: demoAppSettings,
      deletedAt: null,
    },
    create: {
      key: "global",
      value: demoAppSettings,
    },
  });

  console.log("Seed complete: Congo demo dataset refreshed with coherent users, meters, readings, tasks and billing.");
  console.log(`Demo password for all seeded users: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
