import { NextResponse } from "next/server";
import { idSchema, subscriptionDiscountSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { attachSubscriptionDiscount, detachSubscriptionDiscount } from "@/server/services/subscription.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid subscription id." }, { status: 400 });
    const parsed = subscriptionDiscountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json(await attachSubscriptionDiscount(validId.data, parsed.data.discountId), { status: 201 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid subscription id." }, { status: 400 });
    const parsed = subscriptionDiscountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    await detachSubscriptionDiscount(validId.data, parsed.data.discountId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
