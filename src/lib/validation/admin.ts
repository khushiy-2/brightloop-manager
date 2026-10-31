import { z } from "zod";

export const productTypes = ["SERVICE", "SOFTWARE", "ADDON", "PHYSICAL"] as const;
export const taxTypes = ["PERCENT", "FIXED"] as const;
export const billingPeriods = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export const discountTypes = ["PERCENT", "FIXED"] as const;
export const discountScopes = ["PRODUCT", "SUBSCRIPTION"] as const;
export const subscriptionStatuses = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED", "CLOSED"] as const;

const moneyString = z.string().trim().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter an amount with up to 10 whole digits and 2 decimal places.");
const rateString = z.string().trim().regex(/^\d{1,4}(?:\.\d{1,3})?$/, "Enter a rate with up to 4 whole digits and 3 decimal places.");

function decimalIsPositive(value: string) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) > BigInt("0") || BigInt(fraction.padEnd(2, "0")) > BigInt("0");
}

function percentageIsAtMost100(value: string) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) < BigInt("100")
    || (BigInt(whole) === BigInt("100") && BigInt(fraction.padEnd(2, "0")) === BigInt("0"));
}

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  q: z.string().trim().max(100).default(""),
});

export function parsePageQueryParams(input: {
  page?: string | string[];
  q?: string | string[];
}) {
  const parsed = pageQuerySchema.safeParse({
    page: typeof input.page === "string" ? input.page : undefined,
    q: typeof input.q === "string" ? input.q : undefined,
  });
  return parsed.success ? parsed.data : { page: 1, q: "" };
}

export const idSchema = z.string().cuid();

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(productTypes),
  salesPrice: moneyString,
  costPrice: moneyString,
  notes: z.string().trim().max(2000).nullable(),
  defaultTaxId: z.string().cuid().nullable(),
  isActive: z.boolean(),
});

export const variantInputSchema = z.object({
  attribute: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(160),
  extraPrice: moneyString,
});

export const taxInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(taxTypes),
  rate: rateString,
  isActive: z.boolean(),
}).superRefine((value, context) => {
  if (value.type === "PERCENT" && Number(value.rate) > 100) {
    context.addIssue({ code: "custom", path: ["rate"], message: "Percentage tax cannot exceed 100." });
  }
});

export const paymentTermInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  days: z.number().int().min(0).max(2_147_483_647),
});

export const planInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  price: moneyString,
  period: z.enum(billingPeriods),
  minQuantity: z.number().int().min(1).max(2_147_483_647),
  availableFrom: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid start date."),
  availableTo: z.string().nullable(),
  autoClose: z.boolean(),
  closable: z.boolean(),
  pausable: z.boolean(),
  renewable: z.boolean(),
}).superRefine((value, context) => {
  if (value.availableTo && Number.isNaN(Date.parse(value.availableTo))) {
    context.addIssue({ code: "custom", path: ["availableTo"], message: "Enter a valid end date." });
  } else if (value.availableTo && new Date(value.availableTo) <= new Date(value.availableFrom)) {
    context.addIssue({ code: "custom", path: ["availableTo"], message: "End date must be after start date." });
  }
});

export const discountInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(80).nullable().optional().default(null).transform((value) => value || null),
  type: z.enum(discountTypes),
  value: moneyString.refine(decimalIsPositive, "Value must be greater than zero."),
  scope: z.enum(discountScopes),
  productIds: z.array(idSchema).max(500).default([]),
  minPurchase: moneyString.nullable().optional().default(null),
  minQuantity: z.number().int().min(1).max(2_147_483_647).nullable().optional().default(null),
  startDate: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid start date."),
  endDate: z.string().nullable().optional().default(null),
  usageLimit: z.number().int().min(1).max(2_147_483_647).nullable().optional().default(null),
  isActive: z.boolean(),
}).superRefine((value, context) => {
  if (value.type === "PERCENT" && !percentageIsAtMost100(value.value)) {
    context.addIssue({ code: "custom", path: ["value"], message: "Percentage discounts cannot exceed 100." });
  }
  if (value.scope === "PRODUCT" && value.productIds.length === 0) {
    context.addIssue({ code: "custom", path: ["productIds"], message: "Choose at least one product." });
  }
  if (value.scope === "SUBSCRIPTION" && value.productIds.length > 0) {
    context.addIssue({ code: "custom", path: ["productIds"], message: "Subscription discounts cannot target individual products." });
  }
  if (value.endDate && Number.isNaN(Date.parse(value.endDate))) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "Enter a valid end date." });
  } else if (value.endDate && new Date(value.endDate) < new Date(value.startDate)) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot be before start date." });
  }
});

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().default(null)
  .transform((value) => value || null);
const validDate = z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date.");

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.email().max(254),
  phone: optionalText(80),
  company: optionalText(160),
  address: optionalText(1000),
});

export const quotationTemplateLineSchema = z.object({
  productId: idSchema,
  variantId: idSchema.nullable().optional().default(null),
  quantity: z.number().int().min(1).max(2_147_483_647),
  taxId: idSchema.nullable().optional().default(null),
});

export const quotationTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  planId: idSchema,
  validityDays: z.number().int().min(1).max(36_500),
  isActive: z.boolean().default(true),
  lines: z.array(quotationTemplateLineSchema).min(1).max(100),
});

export const subscriptionLineSchema = z.object({
  productId: idSchema,
  variantId: idSchema.nullable().optional().default(null),
  quantity: z.number().int().min(1).max(2_147_483_647),
  unitPrice: moneyString,
  taxId: idSchema.nullable().optional().default(null),
});

export const subscriptionInputSchema = z.object({
  customerId: idSchema,
  planId: idSchema,
  templateId: idSchema.nullable().optional().default(null),
  paymentTermId: idSchema,
  startDate: validDate,
  expiryDate: validDate,
  notes: optionalText(2000),
  lines: z.array(subscriptionLineSchema).min(1).max(100),
}).superRefine((value, context) => {
  if (new Date(value.expiryDate) < new Date(value.startDate)) {
    context.addIssue({ code: "custom", path: ["expiryDate"], message: "Expiry date must be on or after the start date." });
  }
});

export const subscriptionListQuerySchema = pageQuerySchema.extend({
  status: z.enum(subscriptionStatuses).optional(),
  customerId: idSchema.optional(),
  planId: idSchema.optional(),
});

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const billingRunInputSchema = z.object({
  asOfDate: dateOnly,
});

export const invoiceStatuses = ["DRAFT", "CONFIRMED", "PAID", "CANCELLED"] as const;
export const paymentMethods = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;

export const invoiceListQuerySchema = pageQuerySchema.extend({
  status: z.enum(invoiceStatuses).optional(),
  customerId: idSchema.optional(),
  overdue: z.enum(["true", "false"]).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
  }
});

const positiveMoneyString = moneyString.refine(decimalIsPositive, "Amount must be greater than zero.");

export const paymentInputSchema = z.object({
  method: z.enum(paymentMethods),
  amount: positiveMoneyString,
  paidAt: validDate,
  note: optionalText(1000),
  reference: optionalText(160),
});

export const paymentListQuerySchema = pageQuerySchema.extend({
  method: z.enum(paymentMethods).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
  }
});

export const invoiceActionSchema = z.object({
  action: z.enum(["confirm", "cancel", "send"]),
});

export const subscriptionActionSchema = z.object({
  action: z.enum([
    "send_quotation",
    "confirm",
    "activate",
    "pause",
    "resume",
    "close",
    "renew",
    "cancel",
  ]),
});

export const subscriptionDiscountSchema = z.object({ discountId: idSchema });

export const variantUpdateSchema = variantInputSchema.extend({
  isActive: z.boolean(),
});
