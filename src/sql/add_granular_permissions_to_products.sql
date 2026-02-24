-- Migración para añadir permisos granulares a los productos
DO $$ 
BEGIN 
    -- Añadir columna can_edit si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'can_edit') THEN
        ALTER TABLE public.products ADD COLUMN can_edit BOOLEAN DEFAULT FALSE;
    END IF;

    -- Añadir columna can_delete si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'can_delete') THEN
        ALTER TABLE public.products ADD COLUMN can_delete BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
