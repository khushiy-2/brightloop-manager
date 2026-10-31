import { NextResponse } from "next/server";
import { pageQuerySchema, quotationTemplateInputSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { createQuotationTemplate, listQuotationTemplates } from "@/server/services/quotation-template.service";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN", "STAFF");
    const url = new URL(request.url);
    const query = pageQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });
    if (!query.success) return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query." }, { status: 400 });
    return NextResponse.json(await listQuotationTemplates(query.data.page, query.data.q));
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN", "STAFF");
    const parsed = quotationTemplateInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ template: await createQuotationTemplate(parsed.data) }, { status: 201 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
