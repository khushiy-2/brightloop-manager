import { NextResponse } from "next/server";
import { paymentListQuerySchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { listPayments } from "@/server/services/payment.service";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN", "STAFF");
    const params = new URL(request.url).searchParams;
    const query = paymentListQuerySchema.safeParse({
      page: params.get("page") ?? undefined,
      q: params.get("q") ?? undefined,
      method: params.get("method") ?? undefined,
      startDate: params.get("startDate") ?? undefined,
      endDate: params.get("endDate") ?? undefined,
    });
    if (!query.success) {
      return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query." }, { status: 400 });
    }
    return NextResponse.json(await listPayments(query.data));
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
