Polar Bear is a Next.js App Router application for store operations.

## Structure

- `app/(app)/`: authenticated screens and the application shell.
- `app/api/`: HTTP route handlers. Authentication and store scoping use `lib/api-auth.ts`.
- `app/components/`: reusable UI components.
- `lib/`: shared utilities and domain services. Inventory access and validation live under `lib/inventory/`.
- `models/`: Mongoose persistence models.
- `types/`: shared domain contracts. `types/common.ts` contains cross-feature contracts; feature files contain page and API contracts.

The application intentionally uses Mongoose for the primary domain models and the native MongoDB driver for inventory transactions. Keep that boundary explicit when adding inventory behavior.

## Getting Started

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
