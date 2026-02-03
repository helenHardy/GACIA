-- Migración para añadir permisos granulares a las ventas
DO $$ 
BEGIN 
    -- Añadir columna can_edit si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'can_edit') THEN
        ALTER TABLE public.sales ADD COLUMN can_edit BOOLEAN DEFAULT FALSE;
    END IF;

    -- Añadir columna can_void si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'can_void') THEN
        ALTER TABLE public.sales ADD COLUMN can_void BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
