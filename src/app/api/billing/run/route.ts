import { NextResponse } from "next/server";
import { billingRunInputSchema } from "@/lib/validation/admin";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { runBilling } from "@/server/services/billing.service";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("ADMIN", "STAFF");
    const parsed = billingRunInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid billing date." }, { status: 400 });
    }
    const asOfDate = new Date(`${parsed.data.asOfDate}T00:00:00.000Z`);
    const run = await runBilling(asOfDate, actor);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
