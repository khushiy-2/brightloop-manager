import { NextResponse } from "next/server";
import { idSchema, quotationTemplateInputSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { updateQuotationTemplate } from "@/server/services/quotation-template.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await context.params;
    const validId = idSchema.safeParse(id);
    if (!validId.success) return NextResponse.json({ error: "Invalid quotation template id." }, { status: 400 });
    const parsed = quotationTemplateInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ template: await updateQuotationTemplate(validId.data, parsed.data) });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
