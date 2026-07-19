import postgres from "postgres";

const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
  throw new Error("POSTGRES_URL environment variable is not set");
}

// Supabase (via Vercel integration) provides POSTGRES_URL as the
// transaction-mode pooler URL. Prepared statements must be disabled
// because PgBouncer transaction mode does not support them.
//
// max: 1 — each Vercel serverless function instance handles one request
//   at a time, so a single connection per instance is optimal.
// idle_timeout: 20 — short timeout is appropriate for short-lived
//   serverless invocations to release connections promptly.
export const sql = postgres(dbUrl, {
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

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id         SERIAL PRIMARY KEY,
      nome       VARCHAR(255) NOT NULL UNIQUE,
      unidade    VARCHAR(20)  NOT NULL DEFAULT 'un',
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS locations (
      id         SERIAL PRIMARY KEY,
      nome       VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  // Seed common household products (idempotent – skips duplicates)
  await sql`
    INSERT INTO products (nome, unidade) VALUES
      ('Arroz',              'kg'),
      ('Esparguete',         'kg'),
      ('Massa',              'kg'),
      ('Feijão',             'kg'),
      ('Grão-de-bico',       'kg'),
      ('Lentilhas',          'kg'),
      ('Farinha',            'kg'),
      ('Açúcar',             'kg'),
      ('Sal',                'g'),
      ('Azeite',             'L'),
      ('Óleo',               'L'),
      ('Vinagre',            'L'),
      ('Molho de tomate',    'un'),
      ('Polpa de tomate',    'un'),
      ('Atum',               'un'),
      ('Sardinha',           'un'),
      ('Mel',                'un'),
      ('Bolachas',           'pac'),
      ('Cereais',            'pac'),
      ('Leite',              'L'),
      ('Manteiga',           'un'),
      ('Ovos',               'un'),
      ('Queijo',             'un'),
      ('Iogurte',            'un'),
      ('Café',               'kg'),
      ('Chá',                'un'),
      ('Água',               'L'),
      ('Sumo',               'L'),
      ('Pão',                'un'),
      ('Tostas',             'pac'),
      ('Legumes congelados', 'kg'),
      ('Peixe congelado',    'kg'),
      ('Detergente loiça',   'un'),
      ('Detergente roupa',   'kg'),
      ('Amaciador',          'L'),
      ('Lixívia',            'L'),
      ('Desinfetante',       'L'),
      ('Limpa-vidros',       'un'),
      ('Esponjas',           'un'),
      ('Sacos de lixo',      'pac'),
      ('Papel higiénico',    'un'),
      ('Champô',             'un'),
      ('Gel de banho',       'un'),
      ('Pasta de dentes',    'un'),
      ('Desodorizante',      'un'),
      ('Sabão',              'un'),
      ('Fraldas',            'pac'),
      ('Pilhas',             'un'),
      ('Papel de cozinha',   'un')
    ON CONFLICT (nome) DO NOTHING
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
