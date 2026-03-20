import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_LOCALE_COOKIE,
  ADMIN_LOCALES,
  normalizeAdminLocale,
} from "@/lib/admin-i18n/config";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const locale = normalizeAdminLocale(payload?.locale);
    if (!ADMIN_LOCALES.includes(locale)) {
      return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_LOCALE_COOKIE, locale, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ locale }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
