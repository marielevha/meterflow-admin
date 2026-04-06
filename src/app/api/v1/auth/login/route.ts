import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/login";
import { buildSessionCookieOptions } from "@/lib/auth/sessionCookies";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function postLogin(request: Request) {
  try {
    const payload = await request.json();
    const result = await loginUser(
      { ...payload, platform: "web" },
      { allowedIdentifiers: ["username", "email"] }
    );
    const response = NextResponse.json(result.body, { status: result.status });

    const accessToken =
      "accessToken" in result.body && typeof result.body.accessToken === "string"
        ? result.body.accessToken
        : null;
    const refreshToken =
      "refreshToken" in result.body && typeof result.body.refreshToken === "string"
        ? result.body.refreshToken
        : null;
    const accessTokenExpiresIn =
      "accessTokenExpiresIn" in result.body &&
      typeof result.body.accessTokenExpiresIn === "number"
        ? result.body.accessTokenExpiresIn
        : undefined;
    const refreshTokenExpiresIn =
      "refreshTokenExpiresIn" in result.body &&
      typeof result.body.refreshTokenExpiresIn === "number"
        ? result.body.refreshTokenExpiresIn
        : undefined;

    if (result.status === 200 && accessToken && refreshToken) {
      response.cookies.set("access_token", accessToken, {
        ...buildSessionCookieOptions(request, { maxAge: accessTokenExpiresIn }),
      });
      response.cookies.set("refresh_token", refreshToken, {
        ...buildSessionCookieOptions(request, { maxAge: refreshTokenExpiresIn }),
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export const POST = withRouteInstrumentation("api.v1.auth.login", postLogin);
