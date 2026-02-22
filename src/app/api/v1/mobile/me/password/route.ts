import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export async function PATCH(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const currentPassword =
      typeof payload?.currentPassword === "string" ? payload.currentPassword : "";
    const newPassword = typeof payload?.newPassword === "string" ? payload.newPassword : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "current_and_new_password_required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    }

    if (!auth.user.passwordHash || !verifyPassword(currentPassword, auth.user.passwordHash)) {
      return NextResponse.json({ error: "invalid_current_password" }, { status: 401 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "new_password_must_be_different" }, { status: 400 });
    }

    const passwordHash = hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: auth.user.id },
        data: { passwordHash },
      });

      await tx.authSession.updateMany({
        where: {
          userId: auth.user.id,
          revokedAt: null,
          deletedAt: null,
        },
        data: {
          revokedAt: new Date(),
          deletedAt: new Date(),
        },
      });
    });

    return NextResponse.json(
      {
        message: "password_updated_relogin_required",
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
