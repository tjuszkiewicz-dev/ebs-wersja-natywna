-- Tabela produktów/aplikacji dostępnych w sklepie
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(10) DEFAULT '📦',
  category VARCHAR(20) NOT NULL CHECK (category IN ('SUBSCRIPTION', 'ONE_TIME')),
  price_pkt INTEGER NOT NULL CHECK (price_pkt > 0),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela zakupów pracowników
CREATE TABLE IF NOT EXISTS employee_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('SUBSCRIPTION', 'ONE_TIME')),
  price_pkt INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  next_billing_date TIMESTAMPTZ,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_employee_purchases_employee_id
  ON employee_purchases(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_purchases_status
  ON employee_purchases(status);
CREATE INDEX IF NOT EXISTS idx_employee_purchases_next_billing
  ON employee_purchases(next_billing_date)
  WHERE status = 'ACTIVE' AND category = 'SUBSCRIPTION';

-- Unikalność: ONE_TIME nie można kupić dwa razy
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_one_time_purchase
  ON employee_purchases(employee_id, product_id)
  WHERE category = 'ONE_TIME' AND status = 'ACTIVE';

-- Trigger: automatyczny updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_purchases_updated_at
  BEFORE UPDATE ON employee_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products visible to authenticated users"
  ON products FOR SELECT
  TO authenticated
  USING (is_available = true);

CREATE POLICY "Employee sees own purchases"
  ON employee_purchases FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employee can create own purchases"
  ON employee_purchases FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employee can update own purchases"
  ON employee_purchases FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid());

-- Seed: produkty domyślne
INSERT INTO products (name, description, icon, category, price_pkt, is_available) VALUES
  ('Wellbeing',        'AI Coach, medytacje i sesje deep work.',  '🧠', 'SUBSCRIPTION', 100, true),
  ('AI Prawnik',       'Analiza umów i porady prawne 24/7.',      '⚖️', 'SUBSCRIPTION', 150, true),
  ('Secure Messenger', 'Szyfrowana komunikacja end-to-end.',      '🔒', 'ONE_TIME',     200, true),
  ('Digital Vault',    'Prywatny sejf cyfrowy 10 GB. AES-256.',   '🛡️', 'ONE_TIME',      50, true)
ON CONFLICT DO NOTHING;
