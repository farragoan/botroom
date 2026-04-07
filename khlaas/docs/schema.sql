-- khlaas database schema
-- Run against a Supabase project (PostgreSQL)

-- A bill split session
CREATE TABLE split_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code  TEXT UNIQUE NOT NULL,        -- short URL slug: /t/abc123
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  status      TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'settled', 'expired')),
  receipt_url TEXT,                        -- Cloudflare R2 object key
  raw_ocr     JSONB                        -- cached OCR response
);

-- Line items extracted from receipt
CREATE TABLE items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID NOT NULL REFERENCES split_tables(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit_price  NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  sort_order  INTEGER,
  is_fee      BOOLEAN NOT NULL DEFAULT FALSE  -- TRUE for tax, service charge, tip
);

-- Participants (V1: anonymous via session token; V2: linked to auth.users)
CREATE TABLE participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id      UUID NOT NULL REFERENCES split_tables(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id),  -- NULL in V1
  session_token TEXT,                             -- client-generated ephemeral ID (V1)
  joined_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Who ate what (many-to-many: participant <-> item)
-- Non-exclusive: multiple participants can select the same item (cost split equally)
CREATE TABLE selections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, item_id)
);

-- Final ledger (computed when host settles the table)
CREATE TABLE ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id         UUID NOT NULL REFERENCES split_tables(id),
  from_participant UUID NOT NULL REFERENCES participants(id),
  to_participant   UUID NOT NULL REFERENCES participants(id),
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  settled          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_items_table_id ON items(table_id);
CREATE INDEX idx_participants_table_id ON participants(table_id);
CREATE INDEX idx_selections_participant ON selections(participant_id);
CREATE INDEX idx_selections_item ON selections(item_id);
CREATE INDEX idx_ledger_table ON ledger_entries(table_id);
CREATE INDEX idx_ledger_from ON ledger_entries(from_participant);

-- Row Level Security
ALTER TABLE split_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- V1 RLS: anyone with the share_code can read a table and its data
-- (Tighten in V2 when accounts are added)
CREATE POLICY "read by share_code" ON split_tables
  FOR SELECT USING (true);

CREATE POLICY "read items" ON items
  FOR SELECT USING (true);

CREATE POLICY "read participants" ON participants
  FOR SELECT USING (true);

CREATE POLICY "read selections" ON selections
  FOR SELECT USING (true);

CREATE POLICY "read ledger" ON ledger_entries
  FOR SELECT USING (true);

-- V1: writes allowed with valid session_token (enforced in application layer)
-- TODO V2: restrict writes to authenticated users who are participants
CREATE POLICY "insert participant" ON participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "insert selection" ON selections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "delete own selection" ON selections
  FOR DELETE USING (true);
