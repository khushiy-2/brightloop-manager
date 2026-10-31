import { BillingPeriod } from "@prisma/client";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";

export function addPeriod(startDate: Date, n: number, period: BillingPeriod) {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError("Period count must be a non-negative integer.");
  }

  switch (period) {
    case BillingPeriod.DAILY:
      return addDays(startDate, n);
    case BillingPeriod.WEEKLY:
      return addWeeks(startDate, n);
    case BillingPeriod.MONTHLY:
      return addMonths(startDate, n);
    case BillingPeriod.YEARLY:
      return addYears(startDate, n);
  }
}
