-- Migración para hacer opcional el proveedor en las compras
ALTER TABLE public.purchases ALTER COLUMN supplier_id DROP NOT NULL;
