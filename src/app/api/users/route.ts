import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createStaffSchema } from "@/lib/validation/auth";
import { authorizationErrorResponse } from "@/server/auth/http";
import { requireRole } from "@/server/auth/guards";
import { createStaffAccount } from "@/server/services/auth";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN");
    const url = new URL(request.url);
    const page = z.coerce.number().int().min(1).catch(1).parse(url.searchParams.get("page") ?? 1);
    const pageSize = 20;
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      }),
      prisma.user.count(),
    ]);
    return NextResponse.json({ users, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const parsed = createStaffSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }

    const user = await createStaffAccount(parsed.data, actor.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}