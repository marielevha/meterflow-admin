import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissions";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { issueInvoice } from "@/lib/backoffice/billing";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingInvoiceIssue],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "invoice_id_required" }, { status: 400 });

  const result = await issueInvoice({ id: auth.user.id, role: auth.user.role }, id);
  return NextResponse.json(result.body, { status: result.status });
}
