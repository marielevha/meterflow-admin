import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissions";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { issueCampaignInvoices } from "@/lib/backoffice/billing";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function postIssueCampaignInvoices(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingCampaignsIssue],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "campaign_id_required" }, { status: 400 });

  const result = await issueCampaignInvoices({ id: auth.user.id, role: auth.user.role }, id);
  return NextResponse.json(result.body, { status: result.status });
}

export const POST = withRouteInstrumentation(
  "api.v1.billing.campaigns.issue",
  postIssueCampaignInvoices,
);
