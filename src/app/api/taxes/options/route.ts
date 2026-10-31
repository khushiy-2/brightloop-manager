import { NextResponse } from "next/server";
import { adminApiErrorResponse } from "@/server/auth/admin-api";
import { requireRole } from "@/server/auth/guards";
import { listTaxOptions } from "@/server/services/admin-catalog";

export async function GET(request: Request) {
  void request.url;
  try {
    await requireRole("ADMIN", "STAFF");
    return NextResponse.json({ taxes: await listTaxOptions() });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
