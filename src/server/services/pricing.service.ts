import { Prisma } from "@prisma/client";

type DecimalInput = Prisma.Decimal | string;
type DiscountType = "PERCENT" | "FIXED";
type DiscountScope = "PRODUCT" | "SUBSCRIPTION";
type TaxType = "PERCENT" | "FIXED";

export type PricingLineInput = {
  productId: string;
  quantity: number;
  unitPrice: DecimalInput;
  tax: { type: TaxType; rate: DecimalInput } | null;
};

export type PricingDiscountInput = {
  id: string;
  name: string;
  type: DiscountType;
  value: DecimalInput;
  scope: DiscountScope;
  productIds: string[];
  minPurchase: DecimalInput | null;
  minQuantity: number | null;
  startDate: Date;
  endDate: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

export type PricedLine = {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

export type AppliedDiscount = {
  discountId: string;
  name: string;
  amount: Prisma.Decimal;
};

const zero = new Prisma.Decimal(0);
const cent = new Prisma.Decimal("0.01");

function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function allocateProportionally(amount: Prisma.Decimal, balances: Prisma.Decimal[]) {
  const total = balances.reduce((sum, balance) => sum.plus(balance), zero);
  if (amount.isZero() || total.isZero()) return balances.map(() => zero);

  const shares = balances.map((balance) => amount.mul(balance).div(total));
  const allocations = shares.map((share) => share.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN));
  let remainder = amount.minus(allocations.reduce((sum, allocation) => sum.plus(allocation), zero));
  const order = shares
    .map((share, index) => ({ index, fraction: share.minus(allocations[index]!) }))
    .sort((left, right) => right.fraction.comparedTo(left.fraction));

  for (const { index } of order) {
    if (remainder.lt(cent)) break;
    if (allocations[index]!.plus(cent).lte(balances[index]!)) {
      allocations[index] = allocations[index]!.plus(cent);
      remainder = remainder.minus(cent);
    }
  }

  if (!remainder.isZero()) {
    throw new Error("Unable to allocate the discount across eligible invoice lines.");
  }
  return allocations;
}

function isEligible(discount: PricingDiscountInput, issueDate: Date) {
  return discount.isActive
    && issueDate >= discount.startDate
    && (discount.endDate === null || issueDate <= discount.endDate)
    && (discount.usageLimit === null || discount.usedCount < discount.usageLimit);
}

export function calculateInvoice(
  lines: PricingLineInput[],
  discounts: PricingDiscountInput[],
  issueDate: Date,
) {
  const lineBases = lines.map((line) => roundMoney(new Prisma.Decimal(line.unitPrice).mul(line.quantity)));
  const remaining = [...lineBases];
  const appliedDiscounts: AppliedDiscount[] = [];

  for (const discount of discounts) {
    if (!isEligible(discount, issueDate)) continue;
    const productIds = new Set(discount.productIds);
    const eligibleIndexes = lines.flatMap((line, index) => (
      discount.scope === "SUBSCRIPTION" || productIds.has(line.productId) ? [index] : []
    ));
    if (eligibleIndexes.length === 0) continue;

    const eligibleBaseBeforeDiscount = eligibleIndexes.reduce(
      (sum, index) => sum.plus(lineBases[index]!),
      zero,
    );
    const eligibleQuantity = eligibleIndexes.reduce((sum, index) => sum + lines[index]!.quantity, 0);
    if (
      (discount.minPurchase !== null && eligibleBaseBeforeDiscount.lt(discount.minPurchase))
      || (discount.minQuantity !== null && eligibleQuantity < discount.minQuantity)
    ) {
      continue;
    }

    const eligibleBalances = eligibleIndexes.map((index) => remaining[index]!);
    const eligibleBase = eligibleBalances.reduce((sum, balance) => sum.plus(balance), zero);
    if (eligibleBase.isZero()) continue;

    const value = new Prisma.Decimal(discount.value);
    const requestedAmount = discount.type === "PERCENT"
      ? eligibleBase.mul(value).div(100)
      : Prisma.Decimal.min(value, eligibleBase);
    const discountAmount = Prisma.Decimal.min(roundMoney(requestedAmount), eligibleBase);
    if (discountAmount.isZero()) continue;

    const allocations = allocateProportionally(discountAmount, eligibleBalances);
    allocations.forEach((allocation, allocationIndex) => {
      const lineIndex = eligibleIndexes[allocationIndex]!;
      remaining[lineIndex] = remaining[lineIndex]!.minus(allocation);
    });
    appliedDiscounts.push({ discountId: discount.id, name: discount.name, amount: discountAmount });
  }

  const pricedLines = lines.map((line, index): PricedLine => {
    const discountAmount = lineBases[index]!.minus(remaining[index]!);
    const lineSubtotal = remaining[index]!;
    let taxAmount = zero;
    if (line.tax) {
      const rate = new Prisma.Decimal(line.tax.rate);
      taxAmount = roundMoney(
        line.tax.type === "PERCENT"
          ? lineSubtotal.mul(rate).div(100)
          : rate.mul(line.quantity),
      );
    }
    return {
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: new Prisma.Decimal(line.unitPrice),
      discountAmount,
      taxAmount,
      lineSubtotal,
      lineTotal: lineSubtotal.plus(taxAmount),
    };
  });

  const subtotal = lineBases.reduce((sum, amount) => sum.plus(amount), zero);
  const discountTotal = appliedDiscounts.reduce((sum, discount) => sum.plus(discount.amount), zero);
  const taxTotal = pricedLines.reduce((sum, line) => sum.plus(line.taxAmount), zero);
  const total = pricedLines.reduce((sum, line) => sum.plus(line.lineTotal), zero);

  return {
    lines: pricedLines,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    appliedDiscounts,
  };
}
