import { NextResponse } from "next/server";
import { idSchema, variantInputSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { createProductVariant, listProductVariants } from "@/server/services/admin-catalog";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
    return NextResponse.json({ variants: await listProductVariants(validId.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
    const parsed = variantInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ variant: await createProductVariant(validId.data, parsed.data) }, { status: 201 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
