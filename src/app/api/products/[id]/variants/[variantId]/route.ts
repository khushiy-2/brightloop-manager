import { NextResponse } from "next/server";
import { idSchema, variantUpdateSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { deactivateProductVariant, updateProductVariant } from "@/server/services/admin-catalog";

type RouteContext = { params: Promise<{ id: string; variantId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN");
    const { id, variantId } = await context.params;
    const productId = idSchema.safeParse(id);
    const parsedVariantId = idSchema.safeParse(variantId);
    if (!productId.success || !parsedVariantId.success) return NextResponse.json({ error: "Invalid variant id." }, { status: 400 });
    const parsed = variantUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ variant: await updateProductVariant(productId.data, parsedVariantId.data, parsed.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN");
    const { id, variantId } = await context.params;
    const productId = idSchema.safeParse(id);
    const parsedVariantId = idSchema.safeParse(variantId);
    if (!productId.success || !parsedVariantId.success) return NextResponse.json({ error: "Invalid variant id." }, { status: 400 });
    return NextResponse.json({ variant: await deactivateProductVariant(productId.data, parsedVariantId.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
