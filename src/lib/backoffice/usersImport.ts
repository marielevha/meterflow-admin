import { UserRole, UserStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { syncUserRoles } from "@/lib/backoffice/rbac";

export type ImportUserRow = {
  phone: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  region: string;
  city: string;
  zone: string;
  status: UserStatus;
  roleCodes: string[];
  password: string;
};

type ParsedCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

const REQUIRED_HEADERS = [
  "phone",
  "username",
  "email",
  "first_name",
  "last_name",
  "region",
  "city",
  "zone",
  "status",
  "roles",
  "password",
];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeStatus(value: string) {
  if (!value) return UserStatus.ACTIVE;
  const upper = value.toUpperCase();
  if (upper === UserStatus.ACTIVE) return UserStatus.ACTIVE;
  if (upper === UserStatus.PENDING) return UserStatus.PENDING;
  if (upper === UserStatus.SUSPENDED) return UserStatus.SUSPENDED;
  return null;
}

function normalizeRoleCodes(raw: string) {
  if (!raw.trim()) return ["CLIENT"];
  return raw
    .split("|")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeString(value: string) {
  return value.trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function pickPrimaryRole(roleCodes: string[]) {
  const order: UserRole[] = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT, UserRole.CLIENT];
  const set = new Set(roleCodes);
  for (const role of order) {
    if (set.has(role)) return role;
  }
  return UserRole.CLIENT;
}

function parseCsv(content: string) {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as ParsedCsvRow[] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    rows.push({ rowNumber: i + 1, values: record });
  }

  return { headers, rows };
}

export async function previewUsersImportFromCsv(csvContent: string) {
  const { headers, rows } = parseCsv(csvContent);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    return {
      ok: false as const,
      status: 400,
      error: "missing_headers",
      missingHeaders,
    };
  }

  const roleRows = await prisma.role.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  const roleIdByCode = new Map(roleRows.map((role) => [role.code, role.id]));

  const seenPhone = new Set<string>();
  const seenUsername = new Set<string>();
  const seenEmail = new Set<string>();

  const previewRows = rows.map((row) => {
    const errors: string[] = [];
    const phone = normalizeString(row.values.phone || "");
    const username = normalizeString(row.values.username || "");
    const email = normalizeEmail(row.values.email || "");
    const firstName = normalizeString(row.values.first_name || "");
    const lastName = normalizeString(row.values.last_name || "");
    const region = normalizeString(row.values.region || "");
    const city = normalizeString(row.values.city || "");
    const zone = normalizeString(row.values.zone || "");
    const status = normalizeStatus(normalizeString(row.values.status || ""));
    const roleCodes = normalizeRoleCodes(normalizeString(row.values.roles || ""));
    const password = normalizeString(row.values.password || "") || "ChangeMe@123";

    if (!phone) errors.push("phone_required");
    if (email && !isValidEmail(email)) errors.push("invalid_email");
    if (!status) errors.push("invalid_status");
    if (roleCodes.length === 0) errors.push("at_least_one_role_required");

    for (const roleCode of roleCodes) {
      if (!roleIdByCode.has(roleCode)) {
        errors.push(`invalid_role:${roleCode}`);
      }
    }

    if (phone) {
      if (seenPhone.has(phone)) errors.push("duplicate_phone_in_file");
      seenPhone.add(phone);
    }
    if (username) {
      if (seenUsername.has(username)) errors.push("duplicate_username_in_file");
      seenUsername.add(username);
    }
    if (email) {
      if (seenEmail.has(email)) errors.push("duplicate_email_in_file");
      seenEmail.add(email);
    }

    const normalized: ImportUserRow = {
      phone,
      username,
      email,
      firstName,
      lastName,
      region,
      city,
      zone,
      status: status ?? UserStatus.ACTIVE,
      roleCodes,
      password,
    };

    return {
      rowNumber: row.rowNumber,
      errors,
      normalized,
    };
  });

  const phones = previewRows.map((row) => row.normalized.phone).filter(Boolean);
  const usernames = previewRows.map((row) => row.normalized.username).filter(Boolean);
  const emails = previewRows.map((row) => row.normalized.email).filter(Boolean);

  if (phones.length || usernames.length || emails.length) {
    const existingUsers = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(phones.length ? [{ phone: { in: phones } }] : []),
          ...(usernames.length ? [{ username: { in: usernames } }] : []),
          ...(emails.length ? [{ email: { in: emails } }] : []),
        ],
      },
      select: { phone: true, username: true, email: true },
    });

    const existingPhone = new Set(existingUsers.map((u) => u.phone).filter(Boolean));
    const existingUsername = new Set(existingUsers.map((u) => u.username).filter(Boolean) as string[]);
    const existingEmail = new Set(existingUsers.map((u) => u.email).filter(Boolean) as string[]);

    for (const row of previewRows) {
      if (existingPhone.has(row.normalized.phone)) row.errors.push("phone_already_exists");
      if (row.normalized.username && existingUsername.has(row.normalized.username)) {
        row.errors.push("username_already_exists");
      }
      if (row.normalized.email && existingEmail.has(row.normalized.email)) {
        row.errors.push("email_already_exists");
      }
    }
  }

  const validRows = previewRows.filter((row) => row.errors.length === 0).map((row) => row.normalized);

  return {
    ok: true as const,
    status: 200,
    data: {
      summary: {
        totalRows: previewRows.length,
        validRows: validRows.length,
        invalidRows: previewRows.length - validRows.length,
      },
      rows: previewRows,
      validRows,
    },
  };
}

export async function importUsersRows(rows: ImportUserRow[]) {
  if (!rows.length) {
    return { ok: false as const, status: 400, error: "no_rows_to_import" };
  }

  const roleRows = await prisma.role.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  const roleIdByCode = new Map(roleRows.map((role) => [role.code, role.id]));

  const createdUserIds: string[] = [];

  for (const row of rows) {
    const roleIds = row.roleCodes.map((code) => roleIdByCode.get(code)).filter(Boolean) as string[];
    if (!roleIds.length) {
      return { ok: false as const, status: 400, error: `invalid_roles_for_phone:${row.phone}` };
    }

    const existing = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { phone: row.phone },
          ...(row.username ? [{ username: row.username }] : []),
          ...(row.email ? [{ email: row.email }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: false as const, status: 409, error: `user_already_exists:${row.phone}` };
    }

    const primaryRole = pickPrimaryRole(row.roleCodes);
    const passwordHash = hashPassword(row.password || "ChangeMe@123");
    const activatedAt = row.status === UserStatus.ACTIVE ? new Date() : null;

    const createdUser = await prisma.user.create({
      data: {
        phone: row.phone,
        username: row.username || null,
        email: row.email || null,
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        region: row.region || null,
        city: row.city || null,
        zone: row.zone || null,
        status: row.status,
        role: primaryRole,
        passwordHash,
        activatedAt,
      },
      select: { id: true },
    });

    const syncResult = await syncUserRoles({
      userId: createdUser.id,
      roleIds,
      assignedById: null,
    });
    if (!syncResult.ok) {
      return { ok: false as const, status: syncResult.status, error: syncResult.error };
    }

    createdUserIds.push(createdUser.id);
  }

  return {
    ok: true as const,
    status: 201,
    data: {
      importedCount: createdUserIds.length,
      userIds: createdUserIds,
    },
  };
}

export function buildUsersImportTemplateCsv() {
  const header = REQUIRED_HEADERS.join(",");
  const samples = [
    [
      "+221700001111",
      "client_new_001",
      "client.new.001@meterflow.local",
      "Awa",
      "Ndiaye",
      "Senegal",
      "Dakar",
      "Mermoz",
      "ACTIVE",
      "CLIENT",
      "ChangeMe@123",
    ],
    [
      "+242060001112",
      "agent_new_001",
      "agent.new.001@meterflow.local",
      "Junior",
      "Mboungou",
      "Congo-Brazzaville",
      "Brazzaville",
      "Bacongo",
      "ACTIVE",
      "AGENT|SUPERVISOR",
      "ChangeMe@123",
    ],
  ];

  const lines = [header, ...samples.map((row) => row.join(","))];
  return `\uFEFF${lines.join("\n")}`;
}
