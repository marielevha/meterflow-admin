import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { registerInvoicePayment } from "@/lib/backoffice/billing";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function postRegisterPayment(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "invoice_id_required" }, { status: 400 });

  try {
    const payload = await request.json();
    const result = await registerInvoicePayment({ id: auth.user.id, role: auth.user.role }, id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export const POST = withRouteInstrumentation("api.v1.billing.invoices.payments", postRegisterPayment);
