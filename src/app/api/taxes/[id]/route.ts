import { NextResponse } from "next/server";
import { idSchema, taxInputSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { deactivateTax, updateTax } from "@/server/services/admin-catalog";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid tax id." }, { status: 400 });
    const parsed = taxInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ tax: await updateTax(validId.data, parsed.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid tax id." }, { status: 400 });
    return NextResponse.json({ tax: await deactivateTax(validId.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
