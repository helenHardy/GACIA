-- SOLUCIÓN LOGÍSTICA DE DOS PASOS (ENVÍO Y RECEPCIÓN)
-- 1. Al enviar: Se descuenta de Origen.
-- 2. Al recibir: Se suma a Destino.

-- A. Función para manejar cambios de ESTADO en la tabla 'transfers'
CREATE OR REPLACE FUNCTION public.handle_transfer_status_changes()
RETURNS trigger AS $$
DECLARE
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    -- 1. CASO: SE ENVÍA EL TRASPASO (Pendiente -> Enviado)
    IF (new.status = 'Enviado' AND (old.status IS NULL OR old.status = 'Pendiente')) THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            -- Solo descontar de origen
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text, 
                   'Envío de traspaso hacia ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id));
        END LOOP;

    -- 2. CASO: SE RECIBE EL TRASPASO (Enviado -> Recibido)
    ELSIF (new.status = 'Recibido' AND old.status = 'Enviado') THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            -- Solo sumar a destino
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.destination_branch_id, t_item.product_id, 'TRASPASO_ENTRADA', t_item.quantity, v_dest_stock, new.id::text, 
                   'Recepción de traspaso desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id));
        END LOOP;

    -- 3. CASO: PASO DIRECTO (Pendiente -> Recibido) - Para compatibilidad
    ELSIF (new.status = 'Recibido' AND (old.status IS NULL OR old.status = 'Pendiente')) THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            -- Descontar de origen Y sumar a destino
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text, 'Traspaso directo: Salida');
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.destination_branch_id, t_item.product_id, 'TRASPASO_ENTRADA', t_item.quantity, v_dest_stock, new.id::text, 'Traspaso directo: Entrada');
        END LOOP;

    -- 4. CASO: CANCELACIÓN (Reversión)
    ELSIF (new.status = 'Cancelado') THEN
        IF (old.status = 'Enviado') THEN
            -- Solo devolver a origen
            FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
                v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_REVERSION', t_item.quantity, v_origin_stock, old.id::text, 'Envío cancelado: Retorno a origen');
            END LOOP;
        ELSIF (old.status = 'Recibido') THEN
            -- Devolver a origen Y quitar de destino
            FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
                v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);
                v_dest_stock := public.update_branch_stock(t_item.product_id, old.destination_branch_id, -t_item.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_REVERSION', t_item.quantity, v_origin_stock, old.id::text, 'Recepción cancelada: Retorno total');
            END LOOP;
        END IF;
    END IF;
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Función para manejar cambios en los ITEMS del traspaso
CREATE OR REPLACE FUNCTION public.handle_transfer_item_stock_changes()
RETURNS trigger AS $$
DECLARE
    v_status text;
    v_origin_id bigint;
    v_dest_id bigint;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    SELECT status, origin_branch_id, destination_branch_id 
    INTO v_status, v_origin_id, v_dest_id
    FROM public.transfers 
    WHERE id = COALESCE(NEW.transfer_id, OLD.transfer_id);

    -- 1. Si el traspaso ya se envió (pero no se recibió aún)
    IF v_status = 'Enviado' THEN
        IF (TG_OP = 'DELETE') THEN
            -- Devolver solo a origen
            v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
        ELSIF (TG_OP = 'INSERT') THEN
            -- Quitar solo de origen
            v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
        END IF;

    -- 2. Si el traspaso ya se recibió completamente
    ELSIF v_status = 'Recibido' THEN
        IF (TG_OP = 'DELETE') THEN
            -- Revertir ambos
            v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
            v_dest_stock := public.update_branch_stock(OLD.product_id, v_dest_id, -OLD.quantity);
        ELSIF (TG_OP = 'INSERT') THEN
            -- Aplicar a ambos
            v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
            v_dest_stock := public.update_branch_stock(NEW.product_id, v_dest_id, NEW.quantity);
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar que los disparadores existan
DROP TRIGGER IF EXISTS trg_kardex_transfer ON public.transfers;
CREATE TRIGGER trg_kardex_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_status_changes();

DROP TRIGGER IF EXISTS trg_transfer_item_stock ON public.transfer_items;
CREATE TRIGGER trg_transfer_item_stock
AFTER INSERT OR DELETE ON public.transfer_items
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_item_stock_changes();
