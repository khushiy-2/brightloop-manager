import { QuotationTemplateManager } from "@/components/admin/quotation-template-manager";
import { parsePageQueryParams } from "@/lib/validation/admin";
import { requireRole } from "@/server/auth/guards";
import { listTemplateEditorOptions } from "@/server/services/quotation-template.service";

export const instant = false;

export default async function QuotationTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole("ADMIN", "STAFF");
  const [query, options] = await Promise.all([
    searchParams.then(parsePageQueryParams),
    listTemplateEditorOptions(),
  ]);
  return (
    <QuotationTemplateManager
      initialPage={query.page}
      initialQuery={query.q}
      plans={options.plans}
      products={options.products}
      taxes={options.taxes}
    />
  );
}
