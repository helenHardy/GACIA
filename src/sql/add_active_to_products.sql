-- Añadir columna active a productos
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'active') THEN
        ALTER TABLE public.products ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
