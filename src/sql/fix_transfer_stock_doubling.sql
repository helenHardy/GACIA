-- SOLUCIÓN DEFINITIVA PARA DUPLICIDAD DE STOCK EN TRASPASOS
-- Este script elimina disparadores redundantes y asegura que el stock solo se mueva una vez.

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- 1. Eliminar TODOS los disparadores de 'transfers' para limpiar duplicados ocultos
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'transfers' AND event_object_schema = 'public') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.transfers CASCADE'; 
        RAISE NOTICE 'Trigger eliminado de transfers: %', r.trigger_name;
    END LOOP;

    -- 2. Eliminar TODOS los disparadores de 'transfer_items' (por si acaso)
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'transfer_items' AND event_object_schema = 'public') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.transfer_items CASCADE'; 
        RAISE NOTICE 'Trigger eliminado de transfer_items: %', r.trigger_name;
    END LOOP;
END $$;

-- 2. REINSTALAR FUNCIÓN DE MANEJO DE ESTADO DE TRASPASO
-- Se añade una protección extra para asegurar que no se procese dos veces por accidente.
CREATE OR REPLACE FUNCTION public.handle_transfer_status_changes()
RETURNS trigger AS $$
DECLARE
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    -- Solo actuar cuando cambia de cualquier estado a 'Recibido'
    IF (new.status = 'Recibido' AND (old.status IS NULL OR old.status != 'Recibido')) THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            -- A. Origen: Descontar stock
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text, 
                   'Transferencia hacia ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id));

            -- B. Destino: Sumar stock
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.destination_branch_id, t_item.product_id, 'TRASPASO_ENTRADA', t_item.quantity, v_dest_stock, new.id::text, 
                   'Transferencia desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id));
        END LOOP;

    -- Reversión si pasa de 'Recibido' a 'Cancelado' (poco común)
    ELSIF (new.status = 'Cancelado' AND old.status = 'Recibido') THEN
         FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, -t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_REVERSION', t_item.quantity, v_origin_stock, new.id::text, 'Reversión: Traspaso cancelado');
        END LOOP;
    END IF;
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REINSTALAR DISPARADOR DE ACTUALIZACIÓN
CREATE TRIGGER trg_kardex_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_status_changes();

-- 4. REINSTALAR DISPARADOR DE ELIMINACIÓN (Reversión preventiva)
CREATE OR REPLACE FUNCTION public.handle_transfer_delete()
RETURNS trigger AS $$
DECLARE
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    IF old.status = 'Recibido' THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = old.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, old.destination_branch_id, -t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_ELIMINADO', t_item.quantity, v_origin_stock, old.id::text, 'Traspaso eliminado (reversión)');
        END LOOP;
    END IF;
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_kardex_transfer_delete
BEFORE DELETE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_delete();

-- 5. CORRECCIÓN DE STOCK GLOBAL (Último paso de seguridad)
UPDATE public.products p
SET stock = (
    SELECT coalesce(sum(stock), 0)
    FROM public.product_branch_settings s
    WHERE s.product_id = p.id
);

-- NOTIFICACIÓN DE ÉXITO (Para logs de Supabase)
-- NOTIFY pgrst, 'reload schema';
DO $$ BEGIN RAISE NOTICE 'Sistema de Traspasos saneado y restaurado.'; END $$;
