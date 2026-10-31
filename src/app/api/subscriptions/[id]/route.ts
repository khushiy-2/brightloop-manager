import { NextResponse } from "next/server";
import { idSchema, subscriptionInputSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { getSubscription, updateSubscription } from "@/server/services/subscription.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid subscription id." }, { status: 400 });
    const subscription = await getSubscription(validId.data);
    if (!subscription) return NextResponse.json({ error: "The requested subscription was not found." }, { status: 404 });
    return NextResponse.json({ subscription });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid subscription id." }, { status: 400 });
    const parsed = subscriptionInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ subscription: await updateSubscription(validId.data, parsed.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
