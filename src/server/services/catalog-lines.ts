import { Prisma } from "@prisma/client";
import type { quotationTemplateLineSchema, subscriptionLineSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { ServiceValidationError } from "@/server/services/service-errors";

type CatalogLine = z.infer<typeof quotationTemplateLineSchema> | z.infer<typeof subscriptionLineSchema>;

export async function validateCatalogLines(
  transaction: Prisma.TransactionClient,
  lines: CatalogLine[],
) {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const variantIds = [...new Set(lines.flatMap((line) => line.variantId ? [line.variantId] : []))];
  const taxIds = [...new Set(lines.flatMap((line) => line.taxId ? [line.taxId] : []))];
  const [products, variants, taxes] = await Promise.all([
    transaction.product.findMany({ where: { id: { in: productIds }, isActive: true }, select: { id: true } }),
    transaction.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
      select: { id: true, productId: true },
    }),
    transaction.tax.findMany({ where: { id: { in: taxIds }, isActive: true }, select: { id: true } }),
  ]);
  const productSet = new Set(products.map((product) => product.id));
  const variantMap = new Map(variants.map((variant) => [variant.id, variant.productId]));
  const taxSet = new Set(taxes.map((tax) => tax.id));

  for (const [index, line] of lines.entries()) {
    if (!productSet.has(line.productId)) throw new ServiceValidationError(`Line ${index + 1} uses an unavailable product.`);
    if (line.variantId && variantMap.get(line.variantId) !== line.productId) {
      throw new ServiceValidationError(`Line ${index + 1} uses a variant that does not belong to its product.`);
    }
    if (line.taxId && !taxSet.has(line.taxId)) throw new ServiceValidationError(`Line ${index + 1} uses an unavailable tax.`);
  }
}
