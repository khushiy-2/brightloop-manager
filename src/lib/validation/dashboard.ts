import { z } from "zod";
import { idSchema } from "@/lib/validation/admin";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const dashboardQuerySchema = z.object({
  startDate: dateOnly,
  endDate: dateOnly,
  planId: idSchema.optional(),
  customerId: idSchema.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
}).superRefine((value, context) => {
  if (value.startDate > value.endDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
  }
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
