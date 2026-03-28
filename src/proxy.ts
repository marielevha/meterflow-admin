import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (!accessToken) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("next", currentPath);
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", currentPath);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
