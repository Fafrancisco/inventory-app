-- Schema for inventory app stock management
-- Run this against your Vercel Postgres (Neon) database

CREATE TABLE IF NOT EXISTS stock_items (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    quantidade  NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    stock_minimo NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (stock_minimo >= 0),
    localizacao VARCHAR(100) NOT NULL DEFAULT '',
    unidade     VARCHAR(20)  NOT NULL DEFAULT 'un',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_localizacao ON stock_items (localizacao);
CREATE INDEX IF NOT EXISTS idx_stock_items_nome       ON stock_items (nome);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_items_updated_at ON stock_items;
CREATE TRIGGER trg_stock_items_updated_at
    BEFORE UPDATE ON stock_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Configurable products with default unit
CREATE TABLE IF NOT EXISTS products (
    id         SERIAL PRIMARY KEY,
    nome       VARCHAR(255) NOT NULL UNIQUE,
    unidade    VARCHAR(20)  NOT NULL DEFAULT 'un',
    localizacao_padrao VARCHAR(100),
    categoria  VARCHAR(60),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Configurable locations
CREATE TABLE IF NOT EXISTS locations (
    id         SERIAL PRIMARY KEY,
    nome       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Preferences used to guide Gemini recipe generation
CREATE TABLE IF NOT EXISTS recipe_preferences (
    id                           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cuisine                      VARCHAR(100) NOT NULL DEFAULT '',
    diet                         VARCHAR(100) NOT NULL DEFAULT '',
    allergens                    TEXT NOT NULL DEFAULT '',
    max_time_minutes             INTEGER CHECK (max_time_minutes >= 0),
    notes                        TEXT NOT NULL DEFAULT '',
    auto_suggest_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    auto_suggest_cooldown_minutes INTEGER NOT NULL DEFAULT 180 CHECK (auto_suggest_cooldown_minutes >= 5),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO recipe_preferences (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Stored recipes generated manually or automatically
CREATE TABLE IF NOT EXISTS recipes (
    id                    SERIAL PRIMARY KEY,
    title                 VARCHAR(255) NOT NULL,
    summary               TEXT NOT NULL DEFAULT '',
    servings              INTEGER,
    prep_minutes          INTEGER,
    cook_minutes          INTEGER,
    ingredients_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
    instructions_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_inventory_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    context_recipe_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    generation_mode       VARCHAR(20) NOT NULL DEFAULT 'manual',
    is_favorite          BOOLEAN NOT NULL DEFAULT FALSE,
    inventory_signature   TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_generation_mode ON recipes (generation_mode);

-- Generated dish preview returned by the image-capable Gemini model.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS generated_image_data TEXT;

-- Ingredient rows normalized for filtering and future analytics
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id         SERIAL PRIMARY KEY,
    recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    nome       VARCHAR(255) NOT NULL,
    quantidade VARCHAR(50) NOT NULL DEFAULT '',
    unidade    VARCHAR(20) NOT NULL DEFAULT 'un',
    available  BOOLEAN NOT NULL DEFAULT TRUE,
    notes      TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients (recipe_id);

-- Enable RLS only after every application table exists.
ALTER TABLE stock_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients   ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS app_meta (
    key        VARCHAR(120) PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sample data (optional)
-- Remove only exact duplicate seed rows left by older schema runs.
WITH duplicate_stock_rows AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY nome, quantidade, stock_minimo, localizacao, unidade
               ORDER BY id
           ) AS row_number
    FROM stock_items
)
DELETE FROM stock_items
WHERE id IN (
    SELECT id
    FROM duplicate_stock_rows
    WHERE row_number > 1
);

INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade)
SELECT seed.nome, seed.quantidade, seed.stock_minimo, seed.localizacao, seed.unidade
FROM (
    VALUES
        ('Arroz', '5'::numeric, '2'::numeric, 'Cozinha', 'kg'),
        ('Azeite', '2'::numeric, '1'::numeric, 'Cozinha', 'L'),
        ('Detergente', '1'::numeric, '2'::numeric, 'Casa de banho', 'un'),
        ('Papel higiénico', '4'::numeric, '6'::numeric, 'Casa de banho', 'un'),
        ('Café', '3'::numeric, '2'::numeric, 'Cozinha', 'un')
) AS seed(nome, quantidade, stock_minimo, localizacao, unidade)
WHERE NOT EXISTS (
    SELECT 1
    FROM stock_items existing
    WHERE existing.nome = seed.nome
      AND existing.quantidade = seed.quantidade
      AND existing.stock_minimo = seed.stock_minimo
      AND existing.localizacao = seed.localizacao
      AND existing.unidade = seed.unidade
);

-- Seed common household products once per database
WITH seed_lock AS (
    INSERT INTO app_meta (key, value)
    VALUES ('products-default-seed-v1', 'done')
    ON CONFLICT (key) DO NOTHING
    RETURNING key
)
INSERT INTO products (nome, unidade)
SELECT v.nome, v.unidade
FROM (
    VALUES
  -- Mercearia / Despensa
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
  -- Frios / Laticínios
  ('Leite',              'L'),
  ('Manteiga',           'un'),
  ('Ovos',               'un'),
  ('Queijo',             'un'),
  ('Iogurte',            'un'),
  -- Bebidas
  ('Café',               'kg'),
  ('Chá',                'un'),
  ('Água',               'L'),
  ('Sumo',               'L'),
  -- Pão / Padaria
  ('Pão',                'un'),
  ('Tostas',             'pac'),
    -- Frescos básicos
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
  -- Congelados
  ('Legumes congelados', 'kg'),
  ('Peixe congelado',    'kg'),
  -- Limpeza
  ('Detergente loiça',   'un'),
  ('Detergente roupa',   'kg'),
  ('Amaciador',          'L'),
  ('Lixívia',            'L'),
  ('Desinfetante',       'L'),
  ('Limpa-vidros',       'un'),
  ('Esponjas',           'un'),
  ('Sacos de lixo',      'pac'),
  -- Higiene pessoal
  ('Papel higiénico',    'un'),
  ('Champô',             'un'),
  ('Gel de banho',       'un'),
  ('Pasta de dentes',    'un'),
  ('Desodorizante',      'un'),
  ('Sabão',              'un'),
  ('Fraldas',            'pac'),
  -- Farmácia / Casa
  ('Pilhas',             'un'),
  ('Papel de cozinha',   'un')
) AS v(nome, unidade)
WHERE EXISTS (SELECT 1 FROM seed_lock)
ON CONFLICT (nome) DO NOTHING;
