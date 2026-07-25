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

  await sql`
    CREATE TABLE IF NOT EXISTS recipe_preferences (
      id                            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      cuisine                       VARCHAR(100) NOT NULL DEFAULT '',
      diet                          VARCHAR(100) NOT NULL DEFAULT '',
      allergens                     TEXT NOT NULL DEFAULT '',
      max_time_minutes              INTEGER CHECK (max_time_minutes >= 0),
      notes                         TEXT NOT NULL DEFAULT '',
      auto_suggest_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
      auto_suggest_cooldown_minutes INTEGER NOT NULL DEFAULT 180 CHECK (auto_suggest_cooldown_minutes >= 5),
      updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO recipe_preferences (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id                      SERIAL PRIMARY KEY,
      title                   VARCHAR(255) NOT NULL,
      summary                 TEXT NOT NULL DEFAULT '',
      servings                INTEGER,
      prep_minutes            INTEGER,
      cook_minutes            INTEGER,
      ingredients_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
      instructions_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_inventory_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
      context_recipe_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      generation_mode         VARCHAR(20) NOT NULL DEFAULT 'manual',
      inventory_signature     TEXT NOT NULL DEFAULT '',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes (created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recipes_generation_mode ON recipes (generation_mode)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id         SERIAL PRIMARY KEY,
      recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      nome       VARCHAR(255) NOT NULL,
      quantidade VARCHAR(50) NOT NULL DEFAULT '',
      unidade    VARCHAR(20) NOT NULL DEFAULT 'un',
      available  BOOLEAN NOT NULL DEFAULT TRUE,
      notes      TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients (recipe_id)
  `;

  // Enable RLS on all public tables so PostgREST (anon/authenticated roles)
  // cannot access them directly. The server uses the service-role pooler URL
  // which bypasses RLS, so no permissive policies are needed.
  await sql`ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE products ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE locations ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE recipe_preferences ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE recipes ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY`;

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
