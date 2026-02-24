import { NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { ImportUserRow, importUsersRows } from "@/lib/backoffice/usersImport";

function isImportRow(value: unknown): value is ImportUserRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ImportUserRow;
  return (
    typeof row.phone === "string" &&
    typeof row.username === "string" &&
    typeof row.email === "string" &&
    typeof row.firstName === "string" &&
    typeof row.lastName === "string" &&
    typeof row.region === "string" &&
    typeof row.city === "string" &&
    typeof row.zone === "string" &&
    typeof row.password === "string" &&
    Array.isArray(row.roleCodes) &&
    Object.values(UserStatus).includes(row.status)
  );
}

export async function POST(request: Request) {
  const auth = await getCurrentStaffUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "admin_only_endpoint" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : null;
    if (!rows || !rows.every(isImportRow)) {
      return NextResponse.json({ error: "invalid_rows_payload" }, { status: 400 });
    }

    const result = await importUsersRows(rows);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
