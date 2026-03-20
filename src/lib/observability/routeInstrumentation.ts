import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { logError, logInfo } from "@/lib/observability/logger";

type RouteHandler<T extends unknown[]> = (...args: T) => Promise<NextResponse>;

export function withRouteInstrumentation<T extends unknown[]>(
  routeName: string,
  handler: RouteHandler<T>,
): RouteHandler<T> {
  return (async (...args: T) => {
    const request = args[0] as Request | undefined;
    const method = request?.method || "UNKNOWN";
    const requestId = request?.headers.get("x-request-id") || randomUUID();
    const startedAt = Date.now();

    try {
      const response = await handler(...args);
      const durationMs = Date.now() - startedAt;
      response.headers.set("x-request-id", requestId);
      logInfo({
        event: "api_request_completed",
        requestId,
        route: routeName,
        method,
        status: response.status,
        durationMs,
      });
      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      logError({
        event: "api_request_failed",
        requestId,
        route: routeName,
        method,
        durationMs,
        error: error instanceof Error ? error.message : "unknown_error",
      });
      return NextResponse.json(
        { error: "internal_error", requestId },
        { status: 500, headers: { "x-request-id": requestId } },
      );
    }
  }) as RouteHandler<T>;
}

