-- Migration: Add discount column to sales table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'discount') THEN
        ALTER TABLE public.sales ADD COLUMN discount numeric DEFAULT 0;
    END IF;
END $$;
