import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissions";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { triggerInvoiceDelivery } from "@/lib/backoffice/billing";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingInvoicesManage],
  });
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "invoice_id_required" }, { status: 400 });

  try {
    const payload = await request.json().catch(() => ({}));
    const result = await triggerInvoiceDelivery({ id: auth.user.id, role: auth.user.role }, id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
