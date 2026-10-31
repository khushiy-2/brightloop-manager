import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateInvoice, type PricingDiscountInput } from "@/server/services/pricing.service";

const issueDate = new Date("2026-10-31T12:00:00.000Z");

function discount(overrides: Partial<PricingDiscountInput> = {}): PricingDiscountInput {
  return {
    id: "discount-1",
    name: "Ten percent",
    type: "PERCENT",
    value: "10.00",
    scope: "SUBSCRIPTION",
    productIds: [],
    minPurchase: null,
    minQuantity: null,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: null,
    usageLimit: null,
    usedCount: 0,
    isActive: true,
    ...overrides,
  };
}

describe("calculateInvoice", () => {
  it("applies eligible discounts before calculating per-line tax", () => {
    const result = calculateInvoice(
      [
        { productId: "product-1", quantity: 2, unitPrice: "100.00", tax: { type: "PERCENT", rate: "18.000" } },
        { productId: "product-2", quantity: 1, unitPrice: "50.00", tax: { type: "FIXED", rate: "2.500" } },
      ],
      [discount({ scope: "PRODUCT", productIds: ["product-1"] })],
      issueDate,
    );

    assert.deepEqual(result.lines.map((line) => line.discountAmount.toFixed(2)), ["20.00", "0.00"]);
    assert.deepEqual(result.lines.map((line) => line.lineSubtotal.toFixed(2)), ["180.00", "50.00"]);
    assert.deepEqual(result.lines.map((line) => line.taxAmount.toFixed(2)), ["32.40", "2.50"]);
    assert.equal(result.subtotal.toFixed(2), "250.00");
    assert.equal(result.discountTotal.toFixed(2), "20.00");
    assert.equal(result.taxTotal.toFixed(2), "34.90");
    assert.equal(result.total.toFixed(2), "264.90");
  });

  it("spreads fixed discounts proportionally without exceeding line bases", () => {
    const result = calculateInvoice(
      [
        { productId: "product-1", quantity: 1, unitPrice: "10.00", tax: null },
        { productId: "product-2", quantity: 1, unitPrice: "30.00", tax: null },
      ],
      [discount({ type: "FIXED", value: "35.00" })],
      issueDate,
    );

    assert.deepEqual(result.lines.map((line) => line.discountAmount.toFixed(2)), ["8.75", "26.25"]);
    assert.equal(result.discountTotal.toFixed(2), "35.00");
    assert.equal(result.total.toFixed(2), "5.00");
  });

  it("skips inactive, out-of-date, exhausted, and unmet-minimum discounts", () => {
    const result = calculateInvoice(
      [{ productId: "product-1", quantity: 1, unitPrice: "50.00", tax: null }],
      [
        discount({ id: "inactive", isActive: false }),
        discount({ id: "future", startDate: new Date("2027-01-01T00:00:00.000Z") }),
        discount({ id: "expired", endDate: new Date("2026-10-30T00:00:00.000Z") }),
        discount({ id: "exhausted", usageLimit: 2, usedCount: 2 }),
        discount({ id: "minimum", minPurchase: "100.00" }),
      ],
      issueDate,
    );

    assert.deepEqual(result.appliedDiscounts, []);
    assert.equal(result.discountTotal.toFixed(2), "0.00");
    assert.equal(result.total.toFixed(2), "50.00");
  });

  it("checks minimum quantity against matching product lines", () => {
    const [belowMinimum, meetsMinimum] = [1, 2].map((quantity) => calculateInvoice(
      [{ productId: "product-1", quantity, unitPrice: "20.00", tax: null }],
      [discount({
        scope: "PRODUCT",
        productIds: ["product-1"],
        minQuantity: 2,
      })],
      issueDate,
    ));

    assert.equal(belowMinimum!.discountTotal.toFixed(2), "0.00");
    assert.equal(meetsMinimum!.discountTotal.toFixed(2), "4.00");
  });

  it("rounds tax half-up per line and multiplies fixed tax by quantity", () => {
    const result = calculateInvoice(
      [
        { productId: "product-1", quantity: 1, unitPrice: "0.05", tax: { type: "PERCENT", rate: "10.000" } },
        { productId: "product-2", quantity: 2, unitPrice: "10.00", tax: { type: "FIXED", rate: "2.500" } },
      ],
      [],
      issueDate,
    );

    assert.deepEqual(result.lines.map((line) => line.taxAmount.toFixed(2)), ["0.01", "5.00"]);
    assert.equal(result.taxTotal.toFixed(2), "5.01");
  });
});
