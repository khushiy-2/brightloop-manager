import { NextResponse } from "next/server";
import { idSchema, invoiceActionSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { transitionInvoice } from "@/server/services/invoice.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return NextResponse.json({ error: "Invalid invoice id." }, { status: 400 });
    const parsed = invoiceActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 400 });
    }
    const invoice = await transitionInvoice(parsedId.data, parsed.data.action);
    return NextResponse.json({ invoice });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
