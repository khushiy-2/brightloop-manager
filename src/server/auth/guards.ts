import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getSession(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive || user.role !== claims.role) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getSession();
  if (!user) throw new AuthorizationError(401, "Authentication required.");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthorizationError(403, "You do not have permission to perform this action.");
  }
  return user;
}