import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BillingPeriod } from "@prisma/client";
import { addPeriod } from "@/lib/dates";

describe("addPeriod", () => {
  it("keeps monthly dates anchored to the original day of the month", () => {
    const startDate = new Date("2025-01-31T00:00:00.000Z");
    assert.equal(addPeriod(startDate, 1, BillingPeriod.MONTHLY).toISOString(), "2025-02-28T00:00:00.000Z");
    assert.equal(addPeriod(startDate, 2, BillingPeriod.MONTHLY).toISOString(), "2025-03-31T00:00:00.000Z");
  });

  it("rejects fractional and negative period counts", () => {
    assert.throws(() => addPeriod(new Date("2025-01-01T00:00:00.000Z"), -1, BillingPeriod.MONTHLY), RangeError);
    assert.throws(() => addPeriod(new Date("2025-01-01T00:00:00.000Z"), 1.5, BillingPeriod.MONTHLY), RangeError);
  });
});
