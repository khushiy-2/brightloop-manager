import {
  BillingPeriod,
  DiscountScope,
  DiscountType,
  Prisma,
  ProductType,
  Role,
  SubscriptionStatus,
  TaxType,
} from "@prisma/client";
import { addDays } from "date-fns";
import { hashPassword } from "../src/server/auth/password";
import { prisma } from "../src/server/db";

const seedBatchSize = 50;

async function seedUser(input: { name: string; email: string; password: string; role: Role }) {
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: { name: input.name, email: input.email, passwordHash, role: input.role },
    update: { name: input.name, passwordHash, role: input.role, isActive: true },
  });

  if (input.role === Role.CUSTOMER) {
    await prisma.customer.upsert({
      where: { userId: user.id },
      create: { userId: user.id, name: input.name, email: input.email },
      update: { name: input.name, email: input.email },
    });
  }
}

async function seedTax(name: string, rate: string) {
  const existing = await prisma.tax.findFirst({ where: { name } });
  const data = { type: TaxType.PERCENT, rate: new Prisma.Decimal(rate), isActive: true };
  if (existing) {
    return prisma.tax.update({ where: { id: existing.id }, data });
  }
  return prisma.tax.create({ data: { name, ...data } });
}

async function seedProduct(input: {
  name: string;
  type: ProductType;
  salesPrice: string;
  costPrice: string;
  notes: string;
  defaultTaxId: string;
  variants: { attribute: string; value: string; extraPrice: string }[];
}) {
  const existing = await prisma.product.findFirst({ where: { name: input.name } });
  const data = {
    type: input.type,
    salesPrice: new Prisma.Decimal(input.salesPrice),
    costPrice: new Prisma.Decimal(input.costPrice),
    notes: input.notes,
    defaultTaxId: input.defaultTaxId,
    isActive: true,
  };
  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data: { name: input.name, ...data } });

  for (const variant of input.variants) {
    await prisma.productVariant.upsert({
      where: { productId_attribute_value: { productId: product.id, attribute: variant.attribute, value: variant.value } },
      create: {
        productId: product.id,
        attribute: variant.attribute,
        value: variant.value,
        extraPrice: new Prisma.Decimal(variant.extraPrice),
        isActive: true,
      },
      update: { extraPrice: new Prisma.Decimal(variant.extraPrice), isActive: true },
    });
  }
}

async function seedPlan(input: {
  name: string;
  price: string;
  period: BillingPeriod;
  minQuantity: number;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
}) {
  const existing = await prisma.plan.findFirst({ where: { name: input.name } });
  const data = {
    price: new Prisma.Decimal(input.price),
    period: input.period,
    minQuantity: input.minQuantity,
    availableFrom: new Date(),
    availableTo: null,
    autoClose: input.autoClose,
    closable: input.closable,
    pausable: input.pausable,
    renewable: input.renewable,
    isActive: true,
  };
  if (existing) {
    await prisma.plan.update({ where: { id: existing.id }, data });
  } else {
    await prisma.plan.create({ data: { name: input.name, ...data } });
  }
}

async function seedCustomer(input: {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
}) {
  const existing = await prisma.customer.findFirst({ where: { email: input.email } });
  if (existing) {
    await prisma.customer.update({ where: { id: existing.id }, data: input });
  } else {
    await prisma.customer.create({ data: input });
  }
}

async function seedDemoCustomersAndSubscriptions() {
  const customers = Array.from({ length: 100 }, (_, index) => {
    const sequence = String(index + 1).padStart(3, "0");
    const name = `Brightloop Demo Customer ${sequence}`;
    return {
      id: `demo-customer-${sequence}`,
      name,
      email: `demo-customer-${sequence}@brightloop.example`,
      phone: `+1 555 020 ${String(index + 1).padStart(4, "0")}`,
      company: `${name} Inc.`,
      address: `${100 + index} Market Street, San Francisco, CA`,
    };
  });

  for (let offset = 0; offset < customers.length; offset += seedBatchSize) {
    await prisma.customer.createMany({
      data: customers.slice(offset, offset + seedBatchSize),
      skipDuplicates: true,
    });
  }

  const [plan, paymentTerm, product] = await Promise.all([
    prisma.plan.findFirst({ where: { name: "Growth Monthly" } }),
    prisma.paymentTerm.findUnique({ where: { name: "Net 30" } }),
    prisma.product.findFirst({
      where: { name: "Brightloop Subscription" },
      include: { defaultTax: true },
    }),
  ]);
  if (!plan || !paymentTerm || !product?.defaultTaxId || !product.defaultTax) {
    throw new Error("Unable to seed demo subscriptions: required plan, payment term, product, or tax is missing.");
  }

  const now = new Date();
  const subscriptionRows = Array.from({ length: 300 }, (_, index) => {
    const sequence = String(index + 1).padStart(4, "0");
    const nextBillingDate = addDays(now, -((index * 37) % 90 + 1));
    return {
      id: `demo-subscription-${sequence}`,
      number: `DEMO-SUB-${sequence}`,
      customerId: customers[index % customers.length]!.id,
      planId: plan.id,
      paymentTermId: paymentTerm.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: addDays(nextBillingDate, -30),
      expiryDate: addDays(now, 365),
      billedCount: 0,
      nextBillingDate,
    };
  });

  for (let offset = 0; offset < subscriptionRows.length; offset += seedBatchSize) {
    await prisma.subscription.createMany({
      data: subscriptionRows.slice(offset, offset + seedBatchSize),
      skipDuplicates: true,
    });
  }

  const seededSubscriptions = await prisma.subscription.findMany({
    where: { number: { in: subscriptionRows.map(({ number }) => number) } },
    select: { id: true, number: true },
  });
  if (seededSubscriptions.length !== subscriptionRows.length) {
    throw new Error("Unable to seed demo subscription lines: one or more subscriptions are missing.");
  }

  const unitPrice = product.salesPrice;
  const taxId = product.defaultTaxId;
  const quantity = 3;
  const subtotal = unitPrice.mul(quantity);
  const taxAmount = subtotal
    .mul(product.defaultTax.rate)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const lines = seededSubscriptions.map(({ id, number }) => ({
    id: `demo-line-${number.slice(-4)}`,
    subscriptionId: id,
    productId: product.id,
    quantity,
    unitPrice,
    taxId,
    amount: subtotal.plus(taxAmount),
  }));

  for (let offset = 0; offset < lines.length; offset += seedBatchSize) {
    await prisma.subscriptionLine.createMany({
      data: lines.slice(offset, offset + seedBatchSize),
      skipDuplicates: true,
    });
  }
}

async function seedQuotationTemplate(input: {
  name: string;
  planName: string;
  validityDays: number;
  lines: {
    productName: string;
    variant?: { attribute: string; value: string };
    quantity: number;
    taxName?: string;
  }[];
}) {
  const plan = await prisma.plan.findFirst({ where: { name: input.planName }, select: { id: true } });
  if (!plan) throw new Error(`Unable to seed template ${input.name}: plan ${input.planName} was not found.`);
  const lines = await Promise.all(input.lines.map(async (line) => {
    const product = await prisma.product.findFirst({
      where: { name: line.productName },
      select: {
        id: true,
        defaultTaxId: true,
        variants: { select: { id: true, attribute: true, value: true } },
      },
    });
    if (!product) throw new Error(`Unable to seed template ${input.name}: product ${line.productName} was not found.`);
    const variant = line.variant
      ? product.variants.find((candidate) => candidate.attribute === line.variant!.attribute && candidate.value === line.variant!.value)
      : undefined;
    if (line.variant && !variant) {
      throw new Error(`Unable to seed template ${input.name}: variant ${line.variant.value} was not found.`);
    }
    const tax = line.taxName ? await prisma.tax.findFirst({ where: { name: line.taxName }, select: { id: true } }) : null;
    if (line.taxName && !tax) throw new Error(`Unable to seed template ${input.name}: tax ${line.taxName} was not found.`);
    return {
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity: line.quantity,
      taxId: tax?.id ?? product.defaultTaxId,
    };
  }));
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.quotationTemplate.findFirst({ where: { name: input.name }, select: { id: true } });
    const template = existing
      ? await transaction.quotationTemplate.update({
        where: { id: existing.id },
        data: { planId: plan.id, validityDays: input.validityDays, isActive: true },
      })
      : await transaction.quotationTemplate.create({
        data: { name: input.name, planId: plan.id, validityDays: input.validityDays, isActive: true },
      });
    await transaction.quotationTemplateLine.deleteMany({ where: { templateId: template.id } });
    await transaction.quotationTemplateLine.createMany({
      data: lines.map((line) => ({ templateId: template.id, ...line })),
    });
  });
}

async function seedDiscount(input: {
  name: string;
  code: string;
  type: DiscountType;
  value: string;
  scope: DiscountScope;
  productNames: string[];
  minPurchase: string | null;
  minQuantity: number | null;
  usageLimit: number | null;
}) {
  const products = await prisma.product.findMany({
    where: { name: { in: input.productNames } },
    select: { id: true, name: true },
  });
  if (products.length !== input.productNames.length) {
    throw new Error(`Unable to seed discount ${input.code}: a target product was not found.`);
  }

  const discountData = {
    name: input.name,
    type: input.type,
    value: new Prisma.Decimal(input.value),
    scope: input.scope,
    minPurchase: input.minPurchase === null ? null : new Prisma.Decimal(input.minPurchase),
    minQuantity: input.minQuantity,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: null,
    usageLimit: input.usageLimit,
    isActive: true,
  };
  await prisma.$transaction(async (transaction) => {
    const discount = await transaction.discount.upsert({
      where: { code: input.code },
      create: { ...discountData, code: input.code },
      update: discountData,
    });
    await transaction.discountProduct.deleteMany({ where: { discountId: discount.id } });
    if (products.length > 0) {
      await transaction.discountProduct.createMany({
        data: products.map((product) => ({ discountId: discount.id, productId: product.id })),
      });
    }
  });
}

async function main() {
  await seedUser({ name: "Brightloop Admin", email: "admin@brightloop.com", password: "Admin@12345!", role: Role.ADMIN });
  await seedUser({ name: "Brightloop Staff", email: "staff@brightloop.com", password: "Staff@12345!", role: Role.STAFF });
  await seedUser({ name: "Brightloop Customer", email: "customer@brightloop.com", password: "Customer@12345!", role: Role.CUSTOMER });

  for (const [name, days] of [["Immediate", 0], ["Net 15", 15], ["Net 30", 30]] as const) {
    await prisma.paymentTerm.upsert({ where: { name }, create: { name, days }, update: { days } });
  }

  const gst18 = await seedTax("GST 18%", "18");
  const gst5 = await seedTax("GST 5%", "5");

  await seedProduct({
    name: "Odoo Implementation",
    type: ProductType.SERVICE,
    salesPrice: "1500.00",
    costPrice: "700.00",
    notes: "Guided setup and implementation service.",
    defaultTaxId: gst18.id,
    variants: [
      { attribute: "Brand", value: "Odoo", extraPrice: "560.00" },
      { attribute: "Support", value: "Standard", extraPrice: "0.00" },
    ],
  });
  await seedProduct({
    name: "Brightloop Subscription",
    type: ProductType.SOFTWARE,
    salesPrice: "99.00",
    costPrice: "25.00",
    notes: "Core subscription software license.",
    defaultTaxId: gst18.id,
    variants: [
      { attribute: "License", value: "Team", extraPrice: "25.00" },
      { attribute: "License", value: "Business", extraPrice: "75.00" },
    ],
  });
  await seedProduct({
    name: "Data Migration",
    type: ProductType.ADDON,
    salesPrice: "450.00",
    costPrice: "180.00",
    notes: "One-time assisted data migration add-on.",
    defaultTaxId: gst18.id,
    variants: [{ attribute: "Volume", value: "Large", extraPrice: "200.00" }],
  });
  await seedProduct({
    name: "Priority Support",
    type: ProductType.SERVICE,
    salesPrice: "250.00",
    costPrice: "90.00",
    notes: "Priority response support package.",
    defaultTaxId: gst5.id,
    variants: [{ attribute: "Coverage", value: "24x7", extraPrice: "120.00" }],
  });
  await seedProduct({
    name: "Setup Kit",
    type: ProductType.PHYSICAL,
    salesPrice: "89.00",
    costPrice: "42.00",
    notes: "Physical onboarding and setup kit.",
    defaultTaxId: gst5.id,
    variants: [{ attribute: "Package", value: "Extended", extraPrice: "30.00" }],
  });

  await seedPlan({
    name: "Starter Daily",
    price: "4.99",
    period: BillingPeriod.DAILY,
    minQuantity: 1,
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
  });
  await seedPlan({
    name: "Growth Monthly",
    price: "49.00",
    period: BillingPeriod.MONTHLY,
    minQuantity: 3,
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
  });
  await seedPlan({
    name: "Annual Enterprise",
    price: "499.00",
    period: BillingPeriod.YEARLY,
    minQuantity: 10,
    autoClose: true,
    closable: false,
    pausable: false,
    renewable: true,
  });

  await seedCustomer({
    name: "Northstar Analytics",
    email: "billing@northstar.example",
    phone: "+1 555 010 2401",
    company: "Northstar Analytics",
    address: "120 Market Street, San Francisco, CA",
  });
  await seedCustomer({
    name: "Cedar Grove Studio",
    email: "accounts@cedargrove.example",
    phone: "+1 555 010 2402",
    company: "Cedar Grove Studio",
    address: "45 King Street, Toronto, ON",
  });
  await seedCustomer({
    name: "Meridian Health Group",
    email: "finance@meridianhealth.example",
    phone: "+1 555 010 2403",
    company: "Meridian Health Group",
    address: "800 Lake Avenue, Chicago, IL",
  });

  await seedDemoCustomersAndSubscriptions();

  await seedQuotationTemplate({
    name: "Starter Implementation",
    planName: "Starter Daily",
    validityDays: 14,
    lines: [{
      productName: "Odoo Implementation",
      variant: { attribute: "Brand", value: "Odoo" },
      quantity: 1,
      taxName: "GST 18%",
    }],
  });
  await seedQuotationTemplate({
    name: "Growth Team Package",
    planName: "Growth Monthly",
    validityDays: 30,
    lines: [
      {
        productName: "Brightloop Subscription",
        variant: { attribute: "License", value: "Team" },
        quantity: 3,
        taxName: "GST 18%",
      },
      { productName: "Priority Support", quantity: 1, taxName: "GST 5%" },
    ],
  });
  await seedQuotationTemplate({
    name: "Enterprise Annual Rollout",
    planName: "Annual Enterprise",
    validityDays: 45,
    lines: [
      {
        productName: "Brightloop Subscription",
        variant: { attribute: "License", value: "Business" },
        quantity: 10,
        taxName: "GST 18%",
      },
      {
        productName: "Data Migration",
        variant: { attribute: "Volume", value: "Large" },
        quantity: 1,
        taxName: "GST 18%",
      },
    ],
  });

  await seedDiscount({
    name: "Welcome 10%",
    code: "WELCOME10",
    type: DiscountType.PERCENT,
    value: "10.00",
    scope: DiscountScope.SUBSCRIPTION,
    productNames: [],
    minPurchase: "100.00",
    minQuantity: 1,
    usageLimit: 100,
  });
  await seedDiscount({
    name: "Implementation $100 Off",
    code: "IMPLEMENT100",
    type: DiscountType.FIXED,
    value: "100.00",
    scope: DiscountScope.PRODUCT,
    productNames: ["Odoo Implementation"],
    minPurchase: "500.00",
    minQuantity: 1,
    usageLimit: null,
  });
  await seedDiscount({
    name: "Add-on 5% Off",
    code: "ADDON5",
    type: DiscountType.PERCENT,
    value: "5.00",
    scope: DiscountScope.PRODUCT,
    productNames: ["Data Migration", "Priority Support"],
    minPurchase: null,
    minQuantity: 2,
    usageLimit: 250,
  });
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());