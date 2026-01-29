-- Add purchase_number column for human-readable sequential IDs
-- This will automatically assign a number to existing and new rows

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'purchase_number') THEN
        ALTER TABLE public.purchases ADD COLUMN purchase_number SERIAL;
    END IF;
END $$;
