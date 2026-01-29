-- Create Quotations tables
-- Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number SERIAL,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    branch_id BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'Convertido', 'Vencido', 'Anulado'
    valid_until DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC DEFAULT 1,
    price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Quotations policies
CREATE POLICY "Allow select for authenticated users" ON quotations FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated users" ON quotations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON quotations FOR UPDATE USING (true);
CREATE POLICY "Allow delete for authenticated users" ON quotations FOR DELETE USING (true);

-- Quotation items policies
CREATE POLICY "Allow select for authenticated users" ON quotation_items FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated users" ON quotation_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON quotation_items FOR UPDATE USING (true);
CREATE POLICY "Allow delete for authenticated users" ON quotation_items FOR DELETE USING (true);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to handle updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_quotations_updated_at') THEN
        CREATE TRIGGER update_quotations_updated_at
            BEFORE UPDATE ON quotations
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
