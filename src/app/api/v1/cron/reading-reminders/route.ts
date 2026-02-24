import { NextResponse } from "next/server";
import { executeReadingRemindersJob } from "@/lib/reminders/readingReminders";

export const runtime = "nodejs";

function extractCronSecret(request: Request): string | null {
  const byHeader = request.headers.get("x-cron-secret")?.trim();
  if (byHeader) return byHeader;

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return null;
}

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 });
  }

  const providedSecret = extractCronSecret(request);
  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    force?: boolean;
    runAt?: string;
  };

  const runAt = payload.runAt ? new Date(payload.runAt) : new Date();
  if (Number.isNaN(runAt.getTime())) {
    return NextResponse.json({ error: "invalid_runAt" }, { status: 400 });
  }

  const result = await executeReadingRemindersJob({
    force: Boolean(payload.force),
    runAt,
  });

  return NextResponse.json(result, { status: 200 });
}
