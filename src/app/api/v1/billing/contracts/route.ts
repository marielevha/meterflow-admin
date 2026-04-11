import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissions";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { createServiceContract, listServiceContracts } from "@/lib/backoffice/serviceContracts";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingContractsView],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const url = new URL(request.url);
  const result = await listServiceContracts({
    search: url.searchParams.get("search") || url.searchParams.get("q") || undefined,
    status: url.searchParams.get("status") || undefined,
    page: Number(url.searchParams.get("page") || 1),
    perPage: Number(url.searchParams.get("perPage") || 20),
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingContractsManage],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  try {
    const payload = await request.json();
    const result = await createServiceContract({ id: auth.user.id, role: auth.user.role }, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
