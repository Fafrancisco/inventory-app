import postgres from "postgres";

// Supabase (via Vercel integration) provides POSTGRES_URL as the
// transaction-mode pooler URL. Prepared statements must be disabled
// because PgBouncer transaction mode does not support them.
//
// max: 1 — each Vercel serverless function instance handles one request
//   at a time, so a single connection per instance is optimal.
// idle_timeout: 20 — short timeout is appropriate for short-lived
//   serverless invocations to release connections promptly.
export const sql = postgres(process.env.POSTGRES_URL!, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: "require",
  prepare: false,
});

let schemaPromise: Promise<void> | null = null;

async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_items (
      id           SERIAL PRIMARY KEY,
      nome         VARCHAR(255) NOT NULL,
      quantidade   INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
      stock_minimo INTEGER NOT NULL DEFAULT 1 CHECK (stock_minimo >= 0),
      localizacao  VARCHAR(100) NOT NULL DEFAULT '',
      unidade      VARCHAR(20)  NOT NULL DEFAULT 'un',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stock_items_localizacao ON stock_items (localizacao)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stock_items_nome ON stock_items (nome)
  `;
}

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initSchema().catch((err) => {
      // Reset so next request retries
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
