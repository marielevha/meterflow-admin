import { NextResponse } from "next/server";
import { resendAgentMobileSignupOtp } from "@/lib/auth/agentMobile";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await resendAgentMobileSignupOtp(payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
