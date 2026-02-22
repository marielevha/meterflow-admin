import { OtpPurpose, OtpStatus, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  generateOtpCode,
  hashOtpCode,
  otpCodeLength,
  otpMaxAttempts,
  otpTtlSeconds,
} from "@/lib/auth/otp";

type RegisterMobileClientPayload = {
  phone?: string;
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  region?: string;
  city?: string;
  zone?: string;
};

type ActivateMobileClientPayload = {
  phone?: string;
  code?: string;
};

type ResendMobileSignupOtpPayload = {
  phone?: string;
};

type RequestClientPasswordResetPayload = {
  phone?: string;
};

type ConfirmClientPasswordResetPayload = {
  phone?: string;
  code?: string;
  newPassword?: string;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePhone(phone?: string) {
  return phone?.trim() ?? "";
}

function normalizeEmail(email?: string) {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

export async function registerMobileClient(payload: RegisterMobileClientPayload) {
  const phone = normalizePhone(payload.phone);
  const username = normalizeOptional(payload.username);
  const email = normalizeEmail(payload.email);
  const password = payload.password?.trim() ?? "";
  const firstName = normalizeOptional(payload.firstName);
  const lastName = normalizeOptional(payload.lastName);
  const region = normalizeOptional(payload.region);
  const city = normalizeOptional(payload.city);
  const zone = normalizeOptional(payload.zone);

  if (!phone || !password) {
    return { status: 400, body: { error: "phone_and_password_required" } };
  }

  if (!/^\+?[0-9]{8,20}$/.test(phone)) {
    return { status: 400, body: { error: "invalid_phone_format" } };
  }

  if (password.length < 8) {
    return { status: 400, body: { error: "password_too_short" } };
  }

  const conflict = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { phone },
        ...(email ? [{ email }] : []),
        ...(username ? [{ username }] : []),
      ],
    },
    select: {
      phone: true,
      email: true,
      username: true,
      status: true,
      role: true,
    },
  });

  if (conflict) {
    if (conflict.phone === phone && conflict.status === UserStatus.PENDING) {
      return { status: 409, body: { error: "account_pending_activation" } };
    }
    if (conflict.phone === phone) {
      return { status: 409, body: { error: "phone_already_exists" } };
    }
    if (email && conflict.email === email) {
      return { status: 409, body: { error: "email_already_exists" } };
    }
    if (username && conflict.username === username) {
      return { status: 409, body: { error: "username_already_exists" } };
    }
    return { status: 409, body: { error: "user_already_exists" } };
  }

  const clientRole = await prisma.role.findFirst({
    where: { code: UserRole.CLIENT, deletedAt: null },
    select: { id: true },
  });

  if (!clientRole) {
    return { status: 500, body: { error: "client_role_not_configured" } };
  }

  const passwordHash = hashPassword(password);
  const codeLength = otpCodeLength();
  const otpCode = generateOtpCode(codeLength);
  const otpCodeHash = hashOtpCode(otpCode);
  const expiresInSeconds = otpTtlSeconds();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        phone,
        username,
        email,
        passwordHash,
        firstName,
        lastName,
        region,
        city,
        zone,
        role: UserRole.CLIENT,
        status: UserStatus.PENDING,
      },
      select: {
        id: true,
        phone: true,
        username: true,
        email: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
      },
    });

    await tx.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: clientRole.id,
      },
    });

    await tx.otpCode.updateMany({
      where: {
        phone,
        purpose: OtpPurpose.SIGNUP,
        status: OtpStatus.PENDING,
        deletedAt: null,
      },
      data: {
        status: OtpStatus.CANCELED,
        deletedAt: new Date(),
      },
    });

    await tx.otpCode.create({
      data: {
        userId: user.id,
        phone,
        purpose: OtpPurpose.SIGNUP,
        status: OtpStatus.PENDING,
        codeHash: otpCodeHash,
        attempts: 0,
        expiresAt,
        metadata: { channel: "api_json" },
      },
    });

    return user;
  });

  return {
    status: 201,
    body: {
      message: "client_account_created_pending_activation",
      otp: {
        code: otpCode,
        expiresInSeconds,
        purpose: OtpPurpose.SIGNUP,
      },
      user: createdUser,
    },
  };
}

export async function activateMobileClientAccount(payload: ActivateMobileClientPayload) {
  const phone = normalizePhone(payload.phone);
  const code = payload.code?.trim() ?? "";

  if (!phone || !code) {
    return { status: 400, body: { error: "phone_and_code_required" } };
  }

  const user = await prisma.user.findFirst({
    where: {
      phone,
      role: UserRole.CLIENT,
      deletedAt: null,
    },
    select: {
      id: true,
      phone: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return { status: 404, body: { error: "user_not_found" } };
  }

  if (user.status === UserStatus.ACTIVE) {
    return { status: 409, body: { error: "account_already_active" } };
  }

  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose: OtpPurpose.SIGNUP,
      status: OtpStatus.PENDING,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { status: 400, body: { error: "otp_not_found" } };
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { status: OtpStatus.EXPIRED },
    });
    return { status: 400, body: { error: "otp_expired" } };
  }

  const maxAttempts = otpMaxAttempts();
  if (otp.attempts >= maxAttempts) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { status: OtpStatus.CANCELED },
    });
    return { status: 400, body: { error: "otp_max_attempts_exceeded" } };
  }

  const isValidCode = hashOtpCode(code) === otp.codeHash;
  if (!isValidCode) {
    const nextAttempts = otp.attempts + 1;
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: {
        attempts: nextAttempts,
        status: nextAttempts >= maxAttempts ? OtpStatus.CANCELED : OtpStatus.PENDING,
      },
    });
    return { status: 400, body: { error: "invalid_otp" } };
  }

  const activated = await prisma.$transaction(async (tx) => {
    await tx.otpCode.update({
      where: { id: otp.id },
      data: {
        status: OtpStatus.VERIFIED,
        verifiedAt: new Date(),
        attempts: otp.attempts + 1,
      },
    });

    return tx.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        activatedAt: new Date(),
      },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
      },
    });
  });

  return {
    status: 200,
    body: {
      message: "account_activated",
      user: activated,
    },
  };
}

export async function resendMobileSignupOtp(payload: ResendMobileSignupOtpPayload) {
  const phone = normalizePhone(payload.phone);

  if (!phone) {
    return { status: 400, body: { error: "phone_required" } };
  }

  const user = await prisma.user.findFirst({
    where: {
      phone,
      role: UserRole.CLIENT,
      deletedAt: null,
    },
    select: {
      id: true,
      phone: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return { status: 404, body: { error: "user_not_found" } };
  }

  if (user.status === UserStatus.ACTIVE) {
    return { status: 409, body: { error: "account_already_active" } };
  }

  if (user.status !== UserStatus.PENDING) {
    return { status: 409, body: { error: "account_not_eligible_for_activation" } };
  }

  const codeLength = otpCodeLength();
  const otpCode = generateOtpCode(codeLength);
  const otpCodeHash = hashOtpCode(otpCode);
  const expiresInSeconds = otpTtlSeconds();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.otpCode.updateMany({
      where: {
        phone,
        purpose: OtpPurpose.SIGNUP,
        status: OtpStatus.PENDING,
        deletedAt: null,
      },
      data: {
        status: OtpStatus.CANCELED,
        deletedAt: new Date(),
      },
    });

    await tx.otpCode.create({
      data: {
        userId: user.id,
        phone,
        purpose: OtpPurpose.SIGNUP,
        status: OtpStatus.PENDING,
        codeHash: otpCodeHash,
        attempts: 0,
        expiresAt,
        metadata: { channel: "api_json", action: "resend" },
      },
    });
  });

  return {
    status: 200,
    body: {
      message: "otp_resent",
      otp: {
        code: otpCode,
        expiresInSeconds,
        purpose: OtpPurpose.SIGNUP,
      },
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    },
  };
}

export async function requestClientPasswordReset(payload: RequestClientPasswordResetPayload) {
  const phone = normalizePhone(payload.phone);

  if (!phone) {
    return { status: 400, body: { error: "phone_required" } };
  }

  const user = await prisma.user.findFirst({
    where: {
      phone,
      role: UserRole.CLIENT,
      deletedAt: null,
    },
    select: {
      id: true,
      phone: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return { status: 404, body: { error: "user_not_found" } };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { status: 403, body: { error: "user_not_active" } };
  }

  const codeLength = otpCodeLength();
  const otpCode = generateOtpCode(codeLength);
  const otpCodeHash = hashOtpCode(otpCode);
  const expiresInSeconds = otpTtlSeconds();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.otpCode.updateMany({
      where: {
        phone,
        purpose: OtpPurpose.PASSWORD_RESET,
        status: OtpStatus.PENDING,
        deletedAt: null,
      },
      data: {
        status: OtpStatus.CANCELED,
        deletedAt: new Date(),
      },
    });

    await tx.otpCode.create({
      data: {
        userId: user.id,
        phone,
        purpose: OtpPurpose.PASSWORD_RESET,
        status: OtpStatus.PENDING,
        codeHash: otpCodeHash,
        attempts: 0,
        expiresAt,
        metadata: { channel: "api_json", action: "password_reset_request" },
      },
    });
  });

  return {
    status: 200,
    body: {
      message: "password_reset_otp_sent",
      otp: {
        code: otpCode,
        expiresInSeconds,
        purpose: OtpPurpose.PASSWORD_RESET,
      },
    },
  };
}

export async function confirmClientPasswordReset(payload: ConfirmClientPasswordResetPayload) {
  const phone = normalizePhone(payload.phone);
  const code = payload.code?.trim() ?? "";
  const newPassword = payload.newPassword?.trim() ?? "";

  if (!phone || !code || !newPassword) {
    return { status: 400, body: { error: "phone_code_new_password_required" } };
  }

  if (newPassword.length < 8) {
    return { status: 400, body: { error: "password_too_short" } };
  }

  const user = await prisma.user.findFirst({
    where: {
      phone,
      role: UserRole.CLIENT,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!user) {
    return { status: 404, body: { error: "user_not_found" } };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { status: 403, body: { error: "user_not_active" } };
  }

  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose: OtpPurpose.PASSWORD_RESET,
      status: OtpStatus.PENDING,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { status: 400, body: { error: "otp_not_found" } };
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { status: OtpStatus.EXPIRED },
    });
    return { status: 400, body: { error: "otp_expired" } };
  }

  const maxAttempts = otpMaxAttempts();
  if (otp.attempts >= maxAttempts) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { status: OtpStatus.CANCELED },
    });
    return { status: 400, body: { error: "otp_max_attempts_exceeded" } };
  }

  const isValidCode = hashOtpCode(code) === otp.codeHash;
  if (!isValidCode) {
    const nextAttempts = otp.attempts + 1;
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: {
        attempts: nextAttempts,
        status: nextAttempts >= maxAttempts ? OtpStatus.CANCELED : OtpStatus.PENDING,
      },
    });
    return { status: 400, body: { error: "invalid_otp" } };
  }

  const nextPasswordHash = hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.otpCode.update({
      where: { id: otp.id },
      data: {
        status: OtpStatus.VERIFIED,
        verifiedAt: new Date(),
        attempts: otp.attempts + 1,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: nextPasswordHash },
    });

    await tx.authSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        deletedAt: null,
      },
      data: {
        revokedAt: new Date(),
        deletedAt: new Date(),
      },
    });
  });

  return {
    status: 200,
    body: {
      message: "password_reset_success",
    },
  };
}
