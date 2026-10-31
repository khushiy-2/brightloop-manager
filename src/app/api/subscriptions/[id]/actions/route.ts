import { NextResponse } from "next/server";
import { idSchema, subscriptionActionSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { transitionSubscription } from "@/server/services/subscription.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid subscription id." }, { status: 400 });
    const parsed = subscriptionActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 400 });
    const subscription = await transitionSubscription(validId.data, parsed.data.action, actor);
    return NextResponse.json({ subscription });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
