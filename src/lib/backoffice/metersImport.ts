import { MeterAssignmentSource, MeterStatus, MeterType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ImportMeterRow = {
  serialNumber: string;
  meterReference: string;
  type: MeterType;
  status: MeterStatus;
  customerPhone: string;
  customerId: string;
  customerLabel: string;
  assignedAgentUsername: string;
  assignedAgentId: string | null;
  assignedAgentLabel: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  zone: string;
  latitude: number | null;
  longitude: number | null;
  installedAt: string | null;
  lastInspectionAt: string | null;
};

type ParsedCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

const REQUIRED_HEADERS = ["serial_number", "type"];
const CSV_HEADERS = [
  "serial_number",
  "meter_reference",
  "type",
  "status",
  "customer_phone",
  "assigned_agent_username",
  "address_line_1",
  "address_line_2",
  "city",
  "zone",
  "latitude",
  "longitude",
  "installed_at",
  "last_inspection_at",
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

function normalizeString(value: string) {
  return value.trim();
}

function normalizeType(value: string) {
  if (!value) return MeterType.SINGLE_INDEX;
  const upper = value.toUpperCase();
  if (upper === MeterType.SINGLE_INDEX) return MeterType.SINGLE_INDEX;
  if (upper === MeterType.DUAL_INDEX) return MeterType.DUAL_INDEX;
  return null;
}

function normalizeStatus(value: string) {
  if (!value) return MeterStatus.ACTIVE;
  const upper = value.toUpperCase();
  if (upper === MeterStatus.ACTIVE) return MeterStatus.ACTIVE;
  if (upper === MeterStatus.MAINTENANCE) return MeterStatus.MAINTENANCE;
  if (upper === MeterStatus.REPLACED) return MeterStatus.REPLACED;
  return null;
}

function normalizeDecimal(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return trimmed;
}

function serializeCsvValue(value: string | number | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function serializeCsvRow(values: Array<string | number | null | undefined>) {
  return values.map(serializeCsvValue).join(",");
}

export async function previewMetersImportFromCsv(csvContent: string) {
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

  const customerPhones = rows
    .map((row) => normalizeString(row.values.customer_phone || ""))
    .filter(Boolean);
  const agentUsernames = rows
    .map((row) => normalizeString(row.values.assigned_agent_username || ""))
    .filter(Boolean);

  const [customers, agents] = await prisma.$transaction([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: UserRole.CLIENT,
        phone: { in: customerPhones },
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
      },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { in: [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN] },
        username: { in: agentUsernames },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    }),
  ]);

  const customerByPhone = new Map(customers.map((customer) => [customer.phone, customer]));
  const agentByUsername = new Map(
    agents
      .filter((agent) => agent.username)
      .map((agent) => [agent.username as string, agent])
  );

  const seenSerial = new Set<string>();
  const seenReference = new Set<string>();

  const previewRows = rows.map((row) => {
    const errors: string[] = [];
    const serialNumber = normalizeString(row.values.serial_number || "");
    const meterReference = normalizeString(row.values.meter_reference || "");
    const type = normalizeType(normalizeString(row.values.type || ""));
    const status = normalizeStatus(normalizeString(row.values.status || ""));
    const customerPhone = normalizeString(row.values.customer_phone || "");
    const assignedAgentUsername = normalizeString(row.values.assigned_agent_username || "");
    const addressLine1 = normalizeString(row.values.address_line_1 || "");
    const addressLine2 = normalizeString(row.values.address_line_2 || "");
    const city = normalizeString(row.values.city || "");
    const zone = normalizeString(row.values.zone || "");
    const latitude = normalizeDecimal(normalizeString(row.values.latitude || ""));
    const longitude = normalizeDecimal(normalizeString(row.values.longitude || ""));
    const installedAt = normalizeDate(normalizeString(row.values.installed_at || ""));
    const lastInspectionAt = normalizeDate(normalizeString(row.values.last_inspection_at || ""));

    if (!serialNumber) errors.push("serial_number_required");
    if (!type) errors.push("invalid_type");
    if (!status) errors.push("invalid_status");
    if (serialNumber) {
      if (seenSerial.has(serialNumber)) errors.push("duplicate_serial_in_file");
      seenSerial.add(serialNumber);
    }

    if (meterReference) {
      if (seenReference.has(meterReference)) errors.push("duplicate_reference_in_file");
      seenReference.add(meterReference);
    }

    if (normalizeString(row.values.latitude || "") && latitude === null) errors.push("invalid_latitude");
    if (normalizeString(row.values.longitude || "") && longitude === null) errors.push("invalid_longitude");
    if (normalizeString(row.values.installed_at || "") && installedAt === null) errors.push("invalid_installed_at");
    if (normalizeString(row.values.last_inspection_at || "") && lastInspectionAt === null) {
      errors.push("invalid_last_inspection_at");
    }

    const customer = customerByPhone.get(customerPhone);
    if (!customer && customerPhone) errors.push("customer_not_found");

    const agent = assignedAgentUsername ? agentByUsername.get(assignedAgentUsername) : null;
    if (assignedAgentUsername && !agent) errors.push("assigned_agent_not_found");

    const normalized: ImportMeterRow = {
      serialNumber,
      meterReference,
      type: type ?? MeterType.SINGLE_INDEX,
      status: status ?? MeterStatus.ACTIVE,
      customerPhone,
      customerId: customer?.id || "",
      customerLabel:
        customer
          ? [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.phone
          : "",
      assignedAgentUsername,
      assignedAgentId: agent?.id || null,
      assignedAgentLabel:
        agent
          ? [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() || agent.username || ""
          : "",
      addressLine1,
      addressLine2,
      city,
      zone,
      latitude,
      longitude,
      installedAt,
      lastInspectionAt,
    };

    return {
      rowNumber: row.rowNumber,
      errors,
      normalized,
    };
  });

  const serials = previewRows.map((row) => row.normalized.serialNumber).filter(Boolean);
  const references = previewRows.map((row) => row.normalized.meterReference).filter(Boolean);

  if (serials.length || references.length) {
    const existingMeters = await prisma.meter.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(serials.length ? [{ serialNumber: { in: serials } }] : []),
          ...(references.length ? [{ meterReference: { in: references } }] : []),
        ],
      },
      select: { serialNumber: true, meterReference: true },
    });

    const existingSerials = new Set(existingMeters.map((meter) => meter.serialNumber));
    const existingReferences = new Set(
      existingMeters.map((meter) => meter.meterReference).filter(Boolean) as string[]
    );

    for (const row of previewRows) {
      if (existingSerials.has(row.normalized.serialNumber)) row.errors.push("serial_already_exists");
      if (row.normalized.meterReference && existingReferences.has(row.normalized.meterReference)) {
        row.errors.push("reference_already_exists");
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

export async function importMetersRows(rows: ImportMeterRow[]) {
  try {
    const createdMeters = await prisma.$transaction(async (tx) => {
      const created: { id: string; serialNumber: string }[] = [];
      for (const row of rows) {
        const meter = await tx.meter.create({
          data: {
            serialNumber: row.serialNumber,
            meterReference: row.meterReference || null,
            type: row.type,
            status: row.status,
            assignedAgentId: row.assignedAgentId,
            addressLine1: row.addressLine1 || null,
            addressLine2: row.addressLine2 || null,
            city: row.city || null,
            zone: row.zone || null,
            latitude: row.latitude,
            longitude: row.longitude,
            installedAt: row.installedAt ? new Date(row.installedAt) : null,
            lastInspectionAt: row.lastInspectionAt ? new Date(row.lastInspectionAt) : null,
          },
          select: { id: true, serialNumber: true },
        });

        if (row.customerId) {
          await tx.meterAssignment.create({
            data: {
              meterId: meter.id,
              customerId: row.customerId,
              source: MeterAssignmentSource.IMPORT,
              assignedAt: row.installedAt ? new Date(row.installedAt) : new Date(),
              notes: row.customerPhone
                ? `Imported with initial customer phone ${row.customerPhone}.`
                : "Imported with initial customer assignment.",
            },
          });
        }

        created.push(meter);
      }
      return created;
    });

    return {
      ok: true as const,
      status: 201,
      data: {
        importedCount: createdMeters.length,
        meters: createdMeters,
      },
    };
  } catch {
    return {
      ok: false as const,
      status: 400,
      error: "import_failed",
    };
  }
}

export function buildMetersImportTemplateCsv() {
  const sample = [
    "MF-CG-BZV-0100",
    "CG-BZV-0100",
    "SINGLE_INDEX",
    "ACTIVE",
    "+242060000007",
    "agent001",
    "Avenue de la Paix",
    "",
    "Brazzaville",
    "Makélékélé",
    "-4.2721",
    "15.2807",
    "2026-03-01",
    "2026-03-15",
  ];

  return `${serializeCsvRow(CSV_HEADERS)}\n${serializeCsvRow(sample)}\n`;
}

export async function buildMetersImportDemoCsv() {
  const [customers, agents] = await prisma.$transaction([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: UserRole.CLIENT,
      },
      orderBy: [{ createdAt: "asc" }, { firstName: "asc" }],
      take: 5,
      select: {
        phone: true,
        city: true,
        zone: true,
      },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { in: [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN] },
      },
      orderBy: [{ createdAt: "asc" }, { firstName: "asc" }],
      take: 5,
      select: {
        username: true,
      },
    }),
  ]);

  if (customers.length === 0) {
    return {
      ok: false as const,
      status: 409,
      error: "demo_customers_not_found",
    };
  }

  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const rows = Array.from({ length: 5 }, (_, index) => {
    const customer = customers[index % customers.length];
    const agent = agents.length > 0 ? agents[index % agents.length] : null;
    const suffix = `${stamp}${String(index + 1).padStart(2, "0")}`;
    const meterType = index % 2 === 0 ? MeterType.SINGLE_INDEX : MeterType.DUAL_INDEX;
    const city = customer.city || (index % 2 === 0 ? "Brazzaville" : "Dakar");
    const zone = customer.zone || (index % 2 === 0 ? "Makélékélé" : "Mermoz");

    return [
      `MF-DEMO-${suffix}`,
      `DEMO-${suffix}`,
      meterType,
      MeterStatus.ACTIVE,
      customer.phone,
      agent?.username || "",
      `Demo meter import ${index + 1}`,
      "",
      city,
      zone,
      "",
      "",
      `2026-03-${String(10 + index).padStart(2, "0")}`,
      `2026-03-${String(15 + index).padStart(2, "0")}`,
    ];
  });

  return {
    ok: true as const,
    status: 200,
    data: `${serializeCsvRow(CSV_HEADERS)}\n${rows.map((row) => serializeCsvRow(row)).join("\n")}\n`,
  };
}
