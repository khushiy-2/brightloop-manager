import { NextResponse } from "next/server";
import { discountInputSchema, idSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { deleteDiscount, updateDiscount } from "@/server/services/discounts.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid discount id." }, { status: 400 });
    const parsed = discountInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ discount: await updateDiscount(validId.data, parsed.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid discount id." }, { status: 400 });
    return NextResponse.json({ discount: await deleteDiscount(validId.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
