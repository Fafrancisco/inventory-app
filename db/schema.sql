-- Schema for inventory app stock management
-- Run this against your Vercel Postgres (Neon) database

CREATE TABLE IF NOT EXISTS stock_items (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    quantidade  INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    stock_minimo INTEGER NOT NULL DEFAULT 1 CHECK (stock_minimo >= 0),
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

-- Sample data (optional)
INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade) VALUES
    ('Arroz',        5,  2, 'Cozinha',   'kg'),
    ('Azeite',       2,  1, 'Cozinha',   'L'),
    ('Detergente',   1,  2, 'Casa de banho', 'un'),
    ('Papel higiénico', 4, 6, 'Casa de banho', 'un'),
    ('Café',         3,  2, 'Cozinha',   'un')
ON CONFLICT DO NOTHING;
