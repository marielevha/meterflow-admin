import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissions";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { listInvoices } from "@/lib/backoffice/billing";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingInvoicesView],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const result = await listInvoices({
    status: searchParams.get("status") ?? undefined,
    campaignId: searchParams.get("campaignId") ?? undefined,
    customerId: searchParams.get("customerId") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    zone: searchParams.get("zone") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
    perPage: Number(searchParams.get("perPage") ?? "20"),
  });

  return NextResponse.json(result.body, { status: result.status });
}
