# 📦 Inventory App

A mobile-first PWA for household/lab stock management built with **Next.js 16.2.10**, **React 19**, and **Tailwind CSS v4**.

## ✨ Features

| Feature | Description |
|---|---|
| 📋 Dashboard | Full inventory list with item cards |
| 🔍 Location filters | Filter items by room/area |
| ➕ / ➖ Quick actions | Tap +/− to adjust quantities instantly |
| 🛒 Shopping list | Auto-shows items where `quantidade ≤ stock_mínimo` |
| ➕ Add item | Form with name, quantity, min stock, location, and unit |
| 🗑️ Delete | Remove items with confirmation |
| 🍳 Receitas com Gemini | Gera receitas com base no inventário, histórico e preferências |

## 🚀 Tech Stack

- **Next.js** `16.2.10` (App Router, Turbopack)
- **React** `^19.2.7`
- **Tailwind CSS** `v4.3.3`
- **@vercel/postgres** `^0.10.0` (Neon Postgres)
- **TypeScript** `^5`

## 🔒 Security

| Before | After |
|---|---|
| No Next.js (static HTML only) | Next.js `16.2.10` (latest stable) |
| N/A | `postcss` overridden to `^8.5.19` (fixes CVE in bundled version) |

```
$ npm audit
found 0 vulnerabilities
```

## 🗄️ Database Setup

Run `db/schema.sql` against your [Vercel Postgres / Neon](https://neon.com) database:

```bash
psql $POSTGRES_URL -f db/schema.sql
```

Set the environment variable:

```env
POSTGRES_URL=******host/dbname
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY` must only be configured server-side (local env + Vercel Environment Variables).

## 🛠️ Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npx tsc --noEmit   # type-check
```

## 🌐 Production Smoke Tests

The production suite uses Playwright and is intentionally read-only. It checks the dashboard, Chef AI navigation, return-navigation latency, Settings, and browser console errors without creating or deleting data.

```bash
PROD_BASE_URL=https://your-deployment.example.com npm run test:e2e:prod
```

For a Vercel deployment protected by Deployment Protection, provide the bypass secret through the shell without committing it:

```bash
PROD_BASE_URL=https://your-deployment.example.com \
VERCEL_PROTECTION_BYPASS=your-secret \
npm run test:e2e:prod
```

Run this against a staging deployment first. Add authenticated or mutating scenarios only with a disposable test account and explicit test data cleanup.

## 📸 Playwright Evidence

All screenshots were captured with Playwright on a simulated **iPhone 14 Pro** viewport (390×844 @2x):

| Screenshot | Description |
|---|---|
| `01-dashboard.png` | Full inventory dashboard with 5 sample items |
| `02-filter-cozinha.png` | Location filter → Cozinha |
| `03-filter-casa-de-banho.png` | Location filter → Casa de banho |
| `04-lista-compras.png` | Lista de Compras tab (2 low-stock items) |
| `05-add-form-open.png` | Add item form open |
| `06-add-form-filled.png` | Add form filled with new item data |
| `07-item-added.png` | Dashboard after item added |
| `08-quantity-incremented.png` | After +2 on Detergente (badge removed) |
| `09-quantity-decremented.png` | After −1 on Arroz |
| `10-lista-compras-updated.png` | Shopping list after stock updates |

Screenshots are saved in [`docs/screenshots/`](./docs/screenshots/).
