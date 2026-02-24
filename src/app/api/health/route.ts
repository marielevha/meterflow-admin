import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function getHealth() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        service: "meterflow-api",
        db: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
        responseTimeMs: Date.now() - startedAt,
        now: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "meterflow-api",
        db: "down",
        error: error instanceof Error ? error.message : "db_unavailable",
        responseTimeMs: Date.now() - startedAt,
        now: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

export const GET = withRouteInstrumentation("api.health", getHealth);
