import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSessionCookieOptions } from "@/lib/auth/sessionCookies";
import { generateTokenHash } from "@/lib/auth/token";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const refreshToken = typeof payload?.refreshToken === "string" ? payload.refreshToken : "";

    if (!refreshToken) {
      return NextResponse.json({ error: "refresh_token_required" }, { status: 400 });
    }

    const refreshTokenHash = generateTokenHash(refreshToken);

    await prisma.authSession.updateMany({
      where: {
        refreshTokenHash,
        revokedAt: null,
        deletedAt: null,
      },
      data: {
        revokedAt: new Date(),
        deletedAt: new Date(),
      },
    });

    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set("access_token", "", {
      ...buildSessionCookieOptions(request, { maxAge: 0 }),
    });
    response.cookies.set("refresh_token", "", {
      ...buildSessionCookieOptions(request, { maxAge: 0 }),
    });

    return response;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
