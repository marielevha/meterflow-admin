import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissions";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { createBillingCampaign, listBillingCampaigns } from "@/lib/backoffice/billing";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingCampaignsManage],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const result = await listBillingCampaigns();
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingCampaignsManage],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  try {
    const payload = await request.json();
    const result = await createBillingCampaign({ id: auth.user.id, role: auth.user.role }, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
