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
```

## 🛠️ Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npx tsc --noEmit   # type-check
```

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
