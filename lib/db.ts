import postgres from "postgres";

const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
  throw new Error("POSTGRES_URL environment variable is not set");
}

const isLocalDb = /@(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(dbUrl);

// Supabase (via Vercel integration) provides POSTGRES_URL as the
// transaction-mode pooler URL. Prepared statements must be disabled
// because PgBouncer transaction mode does not support them.
//
// Keep a small pool because a Vercel function instance can serve overlapping
// requests; max: 1 would let one stalled query block every other request.
// idle_timeout: 20 — short timeout is appropriate for short-lived
//   serverless invocations to release connections promptly.
export const sql = postgres(dbUrl, {
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: {
    statement_timeout: 10_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 10_000,
  },
  ssl: isLocalDb ? false : "require",
  prepare: false,
});

let schemaPromise: Promise<void> | null = null;

async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_items (
      id           SERIAL PRIMARY KEY,
      nome         VARCHAR(255) NOT NULL,
      quantidade   NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
      stock_minimo NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (stock_minimo >= 0),
      localizacao  VARCHAR(100) NOT NULL DEFAULT '',
      unidade      VARCHAR(20)  NOT NULL DEFAULT 'un',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE stock_items
    ALTER COLUMN quantidade TYPE NUMERIC(12, 3)
    USING quantidade::NUMERIC(12, 3)
  `;

  await sql`
    ALTER TABLE stock_items
    ALTER COLUMN stock_minimo TYPE NUMERIC(12, 3)
    USING stock_minimo::NUMERIC(12, 3)
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
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS localizacao_padrao VARCHAR(100)
  `;

  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(60)
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
      default_servings              INTEGER NOT NULL DEFAULT 2 CHECK (default_servings BETWEEN 1 AND 12),
      planned_meals                 INTEGER NOT NULL DEFAULT 1 CHECK (planned_meals BETWEEN 1 AND 3),
      auto_suggest_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
      auto_suggest_cooldown_minutes INTEGER NOT NULL DEFAULT 180 CHECK (auto_suggest_cooldown_minutes >= 5),
      updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE recipe_preferences
    ADD COLUMN IF NOT EXISTS default_servings INTEGER NOT NULL DEFAULT 2 CHECK (default_servings BETWEEN 1 AND 12)
  `;

  await sql`
    ALTER TABLE recipe_preferences
    ADD COLUMN IF NOT EXISTS planned_meals INTEGER NOT NULL DEFAULT 1 CHECK (planned_meals BETWEEN 1 AND 3)
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
      is_favorite             BOOLEAN NOT NULL DEFAULT FALSE,
      inventory_signature     TEXT NOT NULL DEFAULT '',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE
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

  await sql`
    CREATE TABLE IF NOT EXISTS app_meta (
      key        VARCHAR(120) PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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

  const seedVersion = "products-default-seed-v1";
  const seedAlreadyRan = await sql<{ key: string }[]>`
    SELECT key
    FROM app_meta
    WHERE key = ${seedVersion}
    LIMIT 1
  `;

  if (seedAlreadyRan.length === 0) {
    // Seed common household products once per database.
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
        ('Alho',               'un'),
        ('Cebola',             'kg'),
        ('Batata',             'kg'),
        ('Cenoura',            'kg'),
        ('Tomate',             'kg'),
        ('Alface',             'un'),
        ('Pimento',            'un'),
        ('Curgete',            'kg'),
        ('Salsa',              'un'),
        ('Coentros',           'un'),
        ('Limão',              'un'),
        ('Maçã',               'kg'),
        ('Banana',             'kg'),
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

    await sql`
      INSERT INTO app_meta (key, value)
      VALUES (${seedVersion}, 'done')
      ON CONFLICT (key) DO NOTHING
    `;
  }
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
