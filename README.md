# Stock Doméstico — Inventory App

Uma PWA mobile-first para controlo de stock doméstico, construída com **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS** e **Vercel Postgres**.

---

## Variáveis de Ambiente

Para conectar à base de dados Vercel Postgres, defina as seguintes variáveis de ambiente no painel da Vercel (ou num ficheiro `.env.local` para desenvolvimento local):

```env
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NO_SSL=
POSTGRES_URL_NON_POOLING=
POSTGRES_USER=
POSTGRES_HOST=
POSTGRES_PASSWORD=
POSTGRES_DATABASE=
```

Estas variáveis são fornecidas automaticamente ao fazer **Storage → Connect** no projeto Vercel. Para desenvolvimento local, use o [Vercel CLI](https://vercel.com/docs/cli) e execute:

```bash
vercel env pull .env.local
```

---

## Aplicar o Schema SQL

Após criar e ligar a base de dados Vercel Postgres, execute o schema inicial. Pode fazê-lo de duas formas:

### Via Vercel Dashboard

1. Abra o separador **Storage** → selecione a base de dados.
2. Clique em **Query** e cole o conteúdo de `db/schema.sql`.
3. Execute.

### Via psql

```bash
psql "$POSTGRES_URL" -f db/schema.sql
```

O script:
- Activa a extensão `pgcrypto` (para `gen_random_uuid()`).
- Cria a tabela `stock_items` com todos os campos e constraints.
- Cria índices em `localizacao` e `updated_at`.
- Cria um trigger que auto-actualiza `updated_at` em cada `UPDATE`.

---

## Correr Localmente

### Pré-requisitos

- Node.js ≥ 18
- Conta e projecto Vercel (para ligar à Postgres)

### Instalação

```bash
npm install
```

### Configuração

```bash
# Instala o Vercel CLI globalmente (se ainda não tiver)
npm i -g vercel

# Liga o projecto local ao projecto Vercel
vercel link

# Puxa as variáveis de ambiente para .env.local
vercel env pull .env.local
```

### Desenvolvimento

```bash
npm run dev
```

Aceda a [http://localhost:3000](http://localhost:3000).

### Build de produção

```bash
npm run build
npm start
```

---

## Estrutura do Projecto

```
inventory-app/
├── app/
│   ├── api/
│   │   └── stock/
│   │       └── route.ts    # API CRUD (GET, POST, PATCH, DELETE)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # Dashboard mobile-first
├── db/
│   └── schema.sql          # Schema inicial da base de dados
├── lib/
│   └── types.ts            # Tipos TypeScript (StockItem, etc.)
├── public/
│   └── manifest.json       # PWA manifest
└── README.md
```

---

## API Reference

### `GET /api/stock`

Retorna todos os itens. Parâmetros opcionais:

| Parâmetro     | Tipo    | Descrição                                           |
|---------------|---------|-----------------------------------------------------|
| `localizacao` | string  | Filtra por localização (ex: `Despensa`)             |
| `shoppingList`| boolean | Se `true`, retorna itens com `quantidade <= stock_minimo` |

### `POST /api/stock`

Cria um novo item. Body JSON:

```json
{
  "nome": "Arroz",
  "quantidade": 2,
  "unidade": "kg",
  "localizacao": "Despensa",
  "categoria": "Cereais",
  "stock_minimo": 1
}
```

### `PATCH /api/stock`

Actualiza um item. Body JSON com `id` obrigatório:

**Modo A — ajuste rápido de quantidade:**
```json
{ "id": "uuid", "delta": 1 }
```

**Modo B — actualização parcial de campos:**
```json
{ "id": "uuid", "nome": "Arroz Integral", "stock_minimo": 2 }
```

### `DELETE /api/stock?id=<uuid>`

Remove um item pelo `id`.

---

## Deploy na Vercel

```bash
vercel --prod
```

Certifique-se de que a base de dados Postgres está ligada ao projecto no painel da Vercel antes do deploy.
