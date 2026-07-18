-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main stock items table
CREATE TABLE IF NOT EXISTS stock_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  quantidade   NUMERIC     NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  unidade      TEXT        NOT NULL DEFAULT 'un',
  localizacao  TEXT        NOT NULL DEFAULT 'Despensa',
  categoria    TEXT        NOT NULL DEFAULT '',
  stock_minimo NUMERIC     NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  updated_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Index for filtering by location
CREATE INDEX IF NOT EXISTS idx_stock_items_localizacao
  ON stock_items (localizacao);

-- Index for sorting/filtering by last update
CREATE INDEX IF NOT EXISTS idx_stock_items_updated_at
  ON stock_items (updated_at DESC);

-- Function to auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger that calls the function before every UPDATE
DROP TRIGGER IF EXISTS trg_stock_items_updated_at ON stock_items;
CREATE TRIGGER trg_stock_items_updated_at
  BEFORE UPDATE ON stock_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
