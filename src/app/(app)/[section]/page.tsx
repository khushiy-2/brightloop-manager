const pageTitles: Record<string, string> = {
  products: "Products",
  plans: "Plans",
  taxes: "Taxes",
  "payment-terms": "Payment Terms",
  discounts: "Discounts",
  "quotation-templates": "Quotation Templates",
  customers: "Customers",
  subscriptions: "Subscriptions",
  invoices: "Invoices",
  payments: "Payments",
  billing: "Billing",
};

export const instant = false;

export default async function PlaceholderPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const title = pageTitles[section];
  if (!title) return <h1>Not found</h1>;

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">WORKSPACE</p>
        <h1>{title}</h1>
      </div>
    </section>
  );
}