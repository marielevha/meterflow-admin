import { MeterStatus, MeterType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { ImportMeterRow, importMetersRows } from "@/lib/backoffice/metersImport";

function isImportMeterRow(value: unknown): value is ImportMeterRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ImportMeterRow;
  return (
    typeof row.serialNumber === "string" &&
    typeof row.meterReference === "string" &&
    Object.values(MeterType).includes(row.type) &&
    Object.values(MeterStatus).includes(row.status) &&
    typeof row.customerPhone === "string" &&
    typeof row.customerId === "string" &&
    typeof row.customerLabel === "string" &&
    typeof row.assignedAgentUsername === "string" &&
    (typeof row.assignedAgentId === "string" || row.assignedAgentId === null) &&
    typeof row.assignedAgentLabel === "string" &&
    typeof row.addressLine1 === "string" &&
    typeof row.addressLine2 === "string" &&
    typeof row.city === "string" &&
    typeof row.zone === "string" &&
    (typeof row.latitude === "number" || row.latitude === null) &&
    (typeof row.longitude === "number" || row.longitude === null) &&
    (typeof row.installedAt === "string" || row.installedAt === null) &&
    (typeof row.lastInspectionAt === "string" || row.lastInspectionAt === null)
  );
}

export async function POST(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: ["meter:import"],
    requireExplicitPermissions: true,
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : null;
    if (!rows || !rows.every(isImportMeterRow)) {
      return NextResponse.json({ error: "invalid_rows_payload" }, { status: 400 });
    }

    const result = await importMetersRows(rows);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
