/* eslint-disable no-console */
const { PrismaClient, UserRole, UserStatus } = require("@prisma/client");

const prisma = new PrismaClient();

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
  { phone: "+221700000001", email: "admin@meterflow.local", firstName: "Awa", lastName: "Diallo", role: UserRole.ADMIN, status: UserStatus.ACTIVE, region: "Dakar", city: "Dakar", zone: "Plateau" },
  { phone: "+221700000002", email: "supervisor1@meterflow.local", firstName: "Mamadou", lastName: "Ndiaye", role: UserRole.SUPERVISOR, status: UserStatus.ACTIVE, region: "Dakar", city: "Dakar", zone: "Medina" },
  { phone: "+221700000003", email: "supervisor2@meterflow.local", firstName: "Fatou", lastName: "Sow", role: UserRole.SUPERVISOR, status: UserStatus.ACTIVE, region: "Thies", city: "Thies", zone: "Ouest" },
  { phone: "+221700000004", email: "agent1@meterflow.local", firstName: "Ibrahima", lastName: "Ba", role: UserRole.AGENT, status: UserStatus.ACTIVE, region: "Dakar", city: "Pikine", zone: "Nord" },
  { phone: "+221700000005", email: "agent2@meterflow.local", firstName: "Moussa", lastName: "Gueye", role: UserRole.AGENT, status: UserStatus.ACTIVE, region: "Dakar", city: "Guediawaye", zone: "Centre" },
  { phone: "+221700000006", email: "agent3@meterflow.local", firstName: "Khadija", lastName: "Mbaye", role: UserRole.AGENT, status: UserStatus.ACTIVE, region: "Thies", city: "Mbour", zone: "Sud" },
  { phone: "+221700000007", email: "client1@meterflow.local", firstName: "Cheikh", lastName: "Fall", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Dakar", city: "Dakar", zone: "Almadies" },
  { phone: "+221700000008", email: "client2@meterflow.local", firstName: "Rokhaya", lastName: "Diop", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Dakar", city: "Dakar", zone: "Mermoz" },
  { phone: "+221700000009", email: "client3@meterflow.local", firstName: "Abdou", lastName: "Sarr", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Saint-Louis", city: "Saint-Louis", zone: "Nord" },
  { phone: "+221700000010", email: "client4@meterflow.local", firstName: "Mariama", lastName: "Faye", role: UserRole.CLIENT, status: UserStatus.ACTIVE, region: "Kaolack", city: "Kaolack", zone: "Centre" },
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
  for (const user of users) {
    const saved = await prisma.user.upsert({
      where: { phone: user.phone },
      update: { ...user, deletedAt: null },
      create: user,
    });
    createdUsers.push(saved);
  }

  const admin = createdUsers.find((u) => u.role === UserRole.ADMIN) || createdUsers[0];

  for (const user of createdUsers) {
    const roleCode = user.role;
    const role = roleByCode[roleCode];
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: { assignedById: admin.id, deletedAt: null },
      create: { userId: user.id, roleId: role.id, assignedById: admin.id },
    });
  }

  console.log("Seed complete: roles, permissions, and 10 users inserted.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
