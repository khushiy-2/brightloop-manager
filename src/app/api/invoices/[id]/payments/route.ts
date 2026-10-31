import { NextResponse } from "next/server";
import { idSchema, paymentInputSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { recordInvoicePayment } from "@/server/services/invoice.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return NextResponse.json({ error: "Invalid invoice id." }, { status: 400 });
    const parsed = paymentInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment." }, { status: 400 });
    }
    const result = await recordInvoicePayment(parsedId.data, user.id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
