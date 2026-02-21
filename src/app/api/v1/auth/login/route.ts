import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/login";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await loginUser(
      { ...payload, platform: "web" },
      { allowedIdentifiers: ["username", "email"] }
    );
    const response = NextResponse.json(result.body, { status: result.status });

    if (result.status === 200) {
      const isSecure = process.env.NODE_ENV === "production";
      response.cookies.set("access_token", result.body.accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: result.body.accessTokenExpiresIn,
      });
      response.cookies.set("refresh_token", result.body.refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: result.body.refreshTokenExpiresIn,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
