import { NextResponse } from "next/server";
import { idSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { getInvoice } from "@/server/services/invoice.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return NextResponse.json({ error: "Invalid invoice id." }, { status: 400 });
    const invoice = await getInvoice(parsedId.data);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
