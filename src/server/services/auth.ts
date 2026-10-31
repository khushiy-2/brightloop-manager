import { createHash, randomBytes } from "node:crypto";
import { Role } from "@prisma/client";
import { comparePassword, hashPassword } from "@/server/auth/password";
import { prisma } from "@/server/db";
import type { LoginInput, SignupInput } from "@/server/services/auth-types";

const RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1000;

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCustomerAccount(input: SignupInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.CUSTOMER,
      customer: {
        create: { name: input.name, email: input.email },
      },
    },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive || !(await comparePassword(input.password, user.passwordHash))) {
    return null;
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function createStaffAccount(
  input: SignupInput,
  createdById: string,
) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.STAFF,
      createdById,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
}

export async function createPasswordReset(email: string, baseUrl: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  if (!user?.isActive) return;

  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: digestToken(rawToken),
        expiresAt: new Date(now.getTime() + RESET_TOKEN_LIFETIME_MS),
      },
    }),
  ]);

  const resetUrl = new URL(`/reset-password?token=${encodeURIComponent(rawToken)}`, baseUrl);
  console.log(`Password reset link for ${email}: ${resetUrl.toString()}`);
}

export async function resetUserPassword(token: string, password: string): Promise<boolean> {
  const tokenHash = digestToken(token);
  const existingToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, usedAt: true },
  });
  if (!existingToken || existingToken.usedAt || existingToken.expiresAt <= new Date()) return false;

  const passwordHash = await hashPassword(password);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const resetToken = await transaction.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) return false;

    const claimed = await transaction.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;

    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    await transaction.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: now },
    });
    return true;
  });
}