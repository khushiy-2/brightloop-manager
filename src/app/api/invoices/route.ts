import { NextResponse } from "next/server";
import { invoiceListQuerySchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { listInvoices } from "@/server/services/invoice.service";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN", "STAFF");
    const params = new URL(request.url).searchParams;
    const query = invoiceListQuerySchema.safeParse({
      page: params.get("page") ?? undefined,
      q: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
      customerId: params.get("customerId") ?? undefined,
      overdue: params.get("overdue") ?? undefined,
      startDate: params.get("startDate") ?? undefined,
      endDate: params.get("endDate") ?? undefined,
    });
    if (!query.success) {
      return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query." }, { status: 400 });
    }
    return NextResponse.json(await listInvoices(query.data));
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
