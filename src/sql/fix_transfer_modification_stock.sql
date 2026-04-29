-- SOLUCIÓN PARA LA EDICIÓN DE TRASPASOS RECIBIDOS
-- Esta función asegura que si se modifican los productos de un traspaso que ya fue recibido,
-- el stock se ajuste correctamente (revierta lo viejo y aplique lo nuevo).

-- 1. Función para manejar cambios directamente en los items del traspaso
CREATE OR REPLACE FUNCTION public.handle_transfer_item_stock_changes()
RETURNS trigger AS $$
DECLARE
    v_status text;
    v_origin_id bigint;
    v_dest_id bigint;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    -- Obtener el estado y sucursales del traspaso padre
    SELECT status, origin_branch_id, destination_branch_id 
    INTO v_status, v_origin_id, v_dest_id
    FROM public.transfers 
    WHERE id = COALESCE(NEW.transfer_id, OLD.transfer_id);

    -- Solo actuar si el traspaso ya está en estado 'Recibido'
    IF v_status = 'Recibido' THEN
        
        -- Caso: SE ELIMINA UN ITEM (o se está reemplazando)
        IF (TG_OP = 'DELETE') THEN
            -- Revertir stock: Devolver a origen, quitar de destino
            v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
            v_dest_stock := public.update_branch_stock(OLD.product_id, v_dest_id, -OLD.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_origin_id, OLD.product_id, 'TRASPASO_MOD_REV', OLD.quantity, v_origin_stock, OLD.transfer_id::text, 'Modificación Traspaso: Item eliminado/revertido');
        
        -- Caso: SE INSERTA UN NUEVO ITEM
        ELSIF (TG_OP = 'INSERT') THEN
            -- Aplicar stock: Quitar de origen, sumar a destino
            v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
            v_dest_stock := public.update_branch_stock(NEW.product_id, v_dest_id, NEW.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_origin_id, NEW.product_id, 'TRASPASO_MOD_APP', -NEW.quantity, v_origin_stock, NEW.transfer_id::text, 'Modificación Traspaso: Item nuevo/actualizado');

        -- Caso: SE ACTUALIZA UN ITEM EXISTENTE (por si acaso no se borra/inserta)
        ELSIF (TG_OP = 'UPDATE') THEN
            IF OLD.quantity != NEW.quantity OR OLD.product_id != NEW.product_id THEN
                -- Revertir OLD
                v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
                v_dest_stock := public.update_branch_stock(OLD.product_id, v_dest_id, -OLD.quantity);
                
                -- Aplicar NEW
                v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
                v_dest_stock := public.update_branch_stock(NEW.product_id, v_dest_id, NEW.quantity);
                
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_origin_id, NEW.product_id, 'TRASPASO_MOD_UPD', NEW.quantity - OLD.quantity, v_origin_stock, NEW.transfer_id::text, 'Modificación Traspaso: Cambio de cantidad');
            END IF;
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear los disparadores para transfer_items
DROP TRIGGER IF EXISTS trg_transfer_item_stock ON public.transfer_items;
CREATE TRIGGER trg_transfer_item_stock
AFTER INSERT OR UPDATE OR DELETE ON public.transfer_items
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_item_stock_changes();

-- 3. IMPORTANTE: Modificar el disparador de la tabla 'transfers' 
-- para evitar doble conteo cuando se crea o se marca como recibido por primera vez.
-- El disparador de 'transfers' SOLO debe actuar cuando el estado cambia de algo a 'Recibido'.

CREATE OR REPLACE FUNCTION public.handle_transfer_status_changes()
RETURNS trigger AS $$
DECLARE
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    -- Cuando cambia a 'Recibido'
    IF (new.status = 'Recibido' AND (old.status IS NULL OR old.status != 'Recibido')) THEN
        -- Aquí procesamos los items que YA están en la tabla
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text, 'Traspaso recibido');
        END LOOP;

    -- Cuando pasa de 'Recibido' a otra cosa (Reversión)
    ELSIF (old.status = 'Recibido' AND new.status != 'Recibido') THEN
         FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, old.destination_branch_id, -t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_REVERSION', t_item.quantity, v_origin_stock, old.id::text, 'Traspaso anulado/revertido');
        END LOOP;
    END IF;
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
