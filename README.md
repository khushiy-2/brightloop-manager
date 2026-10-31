# Brightloop

Brightloop is a subscription-management MVP for managing a customer lifecycle from catalog setup through recurring billing, invoicing, and customer self-service.

## Features by Brightloop scene

| Scene | What you can demonstrate |
| --- | --- |
| Catalog and offers | Create products and variants, billing plans, taxes, payment terms, discounts, and reusable quotation templates. |
| Customer and subscription operations | Browse customers, create subscriptions from products or templates, and manage subscription status and discounts. |
| Recurring billing | Run billing for subscriptions that are due, inspect each billing run, and create invoices with calculated line items, discounts, and taxes. |
| Invoice and payment handling | Review invoices, confirm or cancel them, print them, and record payments against them. |
| Customer self-service | Sign in as a customer to view only their own subscriptions and invoices, including printable invoices. |
| Operations and access | Review dashboard metrics and overdue invoices; manage staff accounts as an administrator. |

## Tech stack

- Next.js App Router and React
- TypeScript
- PostgreSQL with Prisma ORM
- Tailwind CSS
- Zod validation
- JWT session cookies and bcrypt password hashing

## Local setup

Requirements: Node.js/npm and a PostgreSQL database.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env`, then replace the placeholder values with your PostgreSQL connection strings and a private JWT secret of at least 32 characters. `DATABASE_URL` is used by the app and Prisma; `DIRECT_URL` is the direct database connection used by Prisma migrations.

3. Apply migrations and load demo data:

   ```sh
   npx prisma migrate deploy
   npm run db:seed
   ```

4. Start the development server:

   ```sh
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

The seed is safe to rerun: demo users and named reference data are upserted, and the 100 demo customers, 300 demo subscriptions, and their lines use stable identifiers and batched inserts that skip existing rows.

## Demo credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@brightloop.com` | `Admin@12345!` |
| Staff | `staff@brightloop.com` | `Staff@12345!` |
| Customer | `customer@brightloop.com` | `Customer@12345!` |

## Billing idempotency

Each billing run considers active subscriptions whose next billing date is on or before the run date. Billing locks each subscription row inside a database transaction, then checks for a non-cancelled invoice for that subscription and billing-period start before creating an invoice. An already-invoiced period is recorded as `ALREADY_BILLED`; successful periods advance the subscription's billed count and next billing date within the transaction. This serializes overlapping runs for the same subscription and avoids duplicate invoices for a billing period.

## Role matrix

| Capability | Admin | Staff | Customer |
| --- | :---: | :---: | :---: |
| Dashboard and operational workspace | Yes | Yes | No |
| View/manage customers and subscriptions | Yes | Yes | Own portal data only |
| Run billing; manage invoices and payments | Yes | Yes | No |
| Maintain catalog and related configuration | Full access | Operational access; restricted changes | No |
| Manage staff accounts | Yes | No | No |
| View subscriptions and invoices | All records | All records | Own records only |

Server-side role checks protect API operations in addition to the role-specific admin workspace and customer portal.
