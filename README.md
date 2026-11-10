Polar Bear is a Next.js App Router application for store operations.

## Structure

- `app/(app)/`: authenticated screens and the application shell.
- `app/api/`: HTTP route handlers. Authentication and store scoping use `lib/api-auth.ts`.
- `app/components/`: reusable UI components.
- `lib/`: shared utilities and domain services. Inventory access and validation live under `lib/inventory/`.
- `models/`: Mongoose persistence models.
- `types/`: shared domain contracts. `types/common.ts` contains cross-feature contracts; feature files contain page and API contracts.

The application intentionally uses Mongoose for the primary domain models and the native MongoDB driver for inventory transactions. Keep that boundary explicit when adding inventory behavior.

## Billing

Franchise administrators can open **Point of Sale > New Order** for their selected store.
New orders default to dine-in. Choose dine-in or takeaway and select a serving
token using the searchable selector, then add priced menu products and save a
bill. The existing table numbers act as serving tokens for both order types;
token selection is required for every new bill. T1 through T10 are available by default; **Store Config >
Table Configuration > Add table** persists additional table numbers per store.
Admins set tax-exclusive INR prices in
**Catalog > Products**. Legacy products without prices cannot be billed.

Totals are calculated on the server in integer paise, with 5% GST rounded once
on the subtotal. Billing request UUIDs are issued by the server, so saving also
works in local HTTP environments without browser cryptography APIs. Bills
snapshot names/prices and are saved idempotently; later
catalog edits do not change saved receipts. **Point of Sale > Billing History** defaults
to today's full business day in Asia/Kolkata on entry. Filter by date range,
order type, serving token, and bill number; results are paginated in groups of 25.
Legacy takeaway bills without a token remain unchanged and show "Token not recorded."
Bill details and customer information can be opened and receipts printed.
**Reset to today** restores the current IST date and clears other filters.
Saving a bill does not record payment, deduct inventory, or automatically
create a daily sales/P&L record.

Customer details are optional. When included, a 10-digit mobile number and first
name are required; middle and last names are optional. All four fields are
encrypted at rest using the existing `FIELD_ENCRYPTION_KEY`; customer writes
fail closed if secure storage is not configured. Billing uses the existing
native MongoDB inventory connection and initializes its indexes on first use.
The MySQL reference documents the new collections; no database migration or
production data is included in it.

## Local Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
Run `npm run typecheck` for a TypeScript-only validation pass.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
