-- =====================================================
-- CONSOLIDACIÓN FINAL: LÓGICA DE STOCK DE TRASPASOS
-- =====================================================
-- Este script es la versión CANÓNICA y debe ejecutarse ULTIMO
-- (después de kardex_triggers, fix_transfer_logistics_v2,
-- fix_transfer_modification_stock, fix_transfer_stock_doubling
-- y fix_transfer_delete_stock). Reemplaza las versiones previas
-- de las funciones de stock y recrea SOLO los triggers de stock
-- (NO toca los triggers de notificaciones trg_notify_*).
--
-- Modelo de dos pasos:
--   1. ENVIAR  (Pendiente -> Enviado):   descuenta stock del ORIGEN,
--      validando disponibilidad (el stock en tránsito deja de ser vendible).
--   2. RECIBIR  (Enviado -> Recibido):   suma stock al DESTINO.
--   Cancelar / Eliminar / Modificar tienen doble certeza: jamás se
--   cuenta el mismo movimiento dos veces.
-- =====================================================

-- ---------- LIMPIEZA PREVIA (solo triggers de stock) ----------
DROP TRIGGER IF EXISTS trg_kardex_transfer ON public.transfers;
DROP TRIGGER IF EXISTS trg_kardex_transfer_delete ON public.transfers;
DROP TRIGGER IF EXISTS trg_transfer_item_stock ON public.transfer_items;

-- ---------- 1. CAMBIOS DE ESTADO ----------
CREATE OR REPLACE FUNCTION public.handle_transfer_status_changes()
RETURNS trigger AS $$
DECLARE
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
    v_available numeric;
BEGIN
    -- 1. ENVÍO (Pendiente -> Enviado): descontar ORIGEN con validación
    IF (new.status = 'Enviado' AND old.status = 'Pendiente') THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            SELECT stock INTO v_available FROM public.product_branch_settings
            WHERE product_id = t_item.product_id AND branch_id = new.origin_branch_id;

            IF coalesce(v_available, 0) < t_item.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente en origen para enviar el traspaso #% (producto %, disponible %, requerido %)',
                    new.transfer_number,
                    COALESCE((SELECT name FROM public.products WHERE id = t_item.product_id), '?'),
                    coalesce(v_available, 0), t_item.quantity;
            END IF;

            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text,
                    'Envío de traspaso hacia ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id));
        END LOOP;

    -- 2. RECEPCIÓN (Enviado -> Recibido): sumar DESTINO
    ELSIF (new.status = 'Recibido' AND old.status = 'Enviado') THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.destination_branch_id, t_item.product_id, 'TRASPASO_ENTRADA', t_item.quantity, v_dest_stock, new.id::text,
                    'Recepción de traspaso desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id));
        END LOOP;

    -- 3. RECEPCIÓN DIRECTA (Pendiente -> Recibido): descontar origen Y sumar destino
    ELSIF (new.status = 'Recibido' AND old.status = 'Pendiente') THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            SELECT stock INTO v_available FROM public.product_branch_settings
            WHERE product_id = t_item.product_id AND branch_id = new.origin_branch_id;

            IF coalesce(v_available, 0) < t_item.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente en origen (producto %, disponible %, requerido %)',
                    COALESCE((SELECT name FROM public.products WHERE id = t_item.product_id), '?'),
                    coalesce(v_available, 0), t_item.quantity;
            END IF;

            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text, 'Recepción directa (salida)');

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.destination_branch_id, t_item.product_id, 'TRASPASO_ENTRADA', t_item.quantity, v_dest_stock, new.id::text, 'Recepción directa (entrada)');
        END LOOP;

    -- 4. CANCELACIÓN (Enviado -> Cancelado): devolver a ORIGEN
    ELSIF (new.status = 'Cancelado' AND old.status = 'Enviado') THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_CANCELADO', t_item.quantity, v_origin_stock, new.id::text, 'Envío cancelado: retorno a origen');
        END LOOP;

    -- 5. CANCELACIÓN (Recibido -> Cancelado): devolver a ORIGEN y quitar de DESTINO
    ELSIF (new.status = 'Cancelado' AND old.status = 'Recibido') THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, -t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_REVERSION', t_item.quantity, v_origin_stock, new.id::text, 'Recepción cancelada: retorno total');
        END LOOP;

    -- 6. REVERSIÓN (Enviado -> Pendiente, defensivo): devolver a ORIGEN
    ELSIF (new.status = 'Pendiente' AND old.status = 'Enviado') THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = new.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (new.origin_branch_id, t_item.product_id, 'TRASPASO_REVERSION', t_item.quantity, v_origin_stock, new.id::text, 'Traspaso devuelto a pendiente');
        END LOOP;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 2. CAMBIOS EN LOS ITEMS ----------
CREATE OR REPLACE FUNCTION public.handle_transfer_item_stock_changes()
RETURNS trigger AS $$
DECLARE
    v_status text;
    v_origin_id bigint;
    v_dest_id bigint;
    v_origin_stock numeric;
    v_dest_stock numeric;
    v_available numeric;
BEGIN
    SELECT status, origin_branch_id, destination_branch_id
    INTO v_status, v_origin_id, v_dest_id
    FROM public.transfers
    WHERE id = COALESCE(NEW.transfer_id, OLD.transfer_id);

    -- Si el traspaso no existe aún (p.ej. insert/delete en cascada por borrado
    -- del traspaso padre), no hay stock que ajustar aquí.
    IF NOT FOUND OR v_status NOT IN ('Enviado', 'Recibido') THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    -- ---------- ENVIADO: el stock ya está descontado en ORIGEN ----------
    IF v_status = 'Enviado' THEN
        IF TG_OP = 'DELETE' THEN
            v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_origin_id, OLD.product_id, 'TRASPASO_ITEM_REST', OLD.quantity, v_origin_stock, OLD.transfer_id::text, 'Item eliminado de traspaso en tránsito (retorno a origen)');

        ELSIF TG_OP = 'INSERT' THEN
            SELECT stock INTO v_available FROM public.product_branch_settings
            WHERE product_id = NEW.product_id AND branch_id = v_origin_id;
            IF coalesce(v_available, 0) < NEW.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente en origen para el producto % (disponible %, requerido %)',
                    COALESCE((SELECT name FROM public.products WHERE id = NEW.product_id), '?'),
                    coalesce(v_available, 0), NEW.quantity;
            END IF;
            v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_origin_id, NEW.product_id, 'TRASPASO_ITEM_APP', -NEW.quantity, v_origin_stock, NEW.transfer_id::text, 'Item agregado a traspaso en tránsito (descuento de origen)');

        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.product_id IS DISTINCT FROM NEW.product_id OR OLD.quantity <> NEW.quantity THEN
                v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
                SELECT stock INTO v_available FROM public.product_branch_settings
                WHERE product_id = NEW.product_id AND branch_id = v_origin_id;
                IF coalesce(v_available, 0) < NEW.quantity THEN
                    RAISE EXCEPTION 'Stock insuficiente en origen para el producto % (disponible %, requerido %)',
                        COALESCE((SELECT name FROM public.products WHERE id = NEW.product_id), '?'),
                        coalesce(v_available, 0), NEW.quantity;
                END IF;
                v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_origin_id, NEW.product_id, 'TRASPASO_ITEM_UPD', NEW.quantity - OLD.quantity, v_origin_stock, NEW.transfer_id::text, 'Item modificado en traspaso en tránsito');
            END IF;
        END IF;

    -- ---------- RECIBIDO: el stock ya está en DESTINO ----------
    ELSIF v_status = 'Recibido' THEN
        IF TG_OP = 'DELETE' THEN
            v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
            v_dest_stock := public.update_branch_stock(OLD.product_id, v_dest_id, -OLD.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_origin_id, OLD.product_id, 'TRASPASO_ITEM_REST', OLD.quantity, v_origin_stock, OLD.transfer_id::text, 'Item eliminado de traspaso recibido (reversión)');

        ELSIF TG_OP = 'INSERT' THEN
            SELECT stock INTO v_available FROM public.product_branch_settings
            WHERE product_id = NEW.product_id AND branch_id = v_origin_id;
            IF coalesce(v_available, 0) < NEW.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente en origen para el producto % (disponible %, requerido %)',
                    COALESCE((SELECT name FROM public.products WHERE id = NEW.product_id), '?'),
                    coalesce(v_available, 0), NEW.quantity;
            END IF;
            v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
            v_dest_stock := public.update_branch_stock(NEW.product_id, v_dest_id, NEW.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_origin_id, NEW.product_id, 'TRASPASO_ITEM_APP', -NEW.quantity, v_origin_stock, NEW.transfer_id::text, 'Item agregado a traspaso recibido');

        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.product_id IS DISTINCT FROM NEW.product_id OR OLD.quantity <> NEW.quantity THEN
                v_origin_stock := public.update_branch_stock(OLD.product_id, v_origin_id, OLD.quantity);
                v_dest_stock := public.update_branch_stock(OLD.product_id, v_dest_id, -OLD.quantity);
                SELECT stock INTO v_available FROM public.product_branch_settings
                WHERE product_id = NEW.product_id AND branch_id = v_origin_id;
                IF coalesce(v_available, 0) < NEW.quantity THEN
                    RAISE EXCEPTION 'Stock insuficiente en origen para el producto % (disponible %, requerido %)',
                        COALESCE((SELECT name FROM public.products WHERE id = NEW.product_id), '?'),
                        coalesce(v_available, 0), NEW.quantity;
                END IF;
                v_origin_stock := public.update_branch_stock(NEW.product_id, v_origin_id, -NEW.quantity);
                v_dest_stock := public.update_branch_stock(NEW.product_id, v_dest_id, NEW.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_origin_id, NEW.product_id, 'TRASPASO_ITEM_UPD', NEW.quantity - OLD.quantity, v_origin_stock, NEW.transfer_id::text, 'Item modificado en traspaso recibido');
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 3. ELIMINACIÓN DE TRASPASO ----------
CREATE OR REPLACE FUNCTION public.handle_transfer_delete()
RETURNS trigger AS $$
DECLARE
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    -- Recibido: devolver a ORIGEN y quitar de DESTINO
    IF old.status = 'Recibido' THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = old.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, old.destination_branch_id, -t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_ELIMINADO', t_item.quantity, v_origin_stock, old.id::text, 'Traspaso recibido eliminado (reversión stock)');
        END LOOP;

    -- Enviado: devolver a ORIGEN (estaba descontado en el envío)
    ELSIF old.status = 'Enviado' THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = old.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_ELIMINADO', t_item.quantity, v_origin_stock, old.id::text, 'Traspaso en tránsito eliminado (retorno a origen)');
        END LOOP;

    -- Pendiente / Cancelado: sin stock en movimiento, nada que devolver.
    END IF;

    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- INSTALAR TRIGGERS ----------
CREATE TRIGGER trg_kardex_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_status_changes();

CREATE TRIGGER trg_kardex_transfer_delete
BEFORE DELETE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_delete();

CREATE TRIGGER trg_transfer_item_stock
AFTER INSERT OR UPDATE OR DELETE ON public.transfer_items
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_item_stock_changes();

-- ---------- SANEAR STOCK GLOBAL POR SEGURIDAD ----------
UPDATE public.products p
SET stock = (
    SELECT coalesce(sum(stock), 0)
    FROM public.product_branch_settings s
    WHERE s.product_id = p.id
);

DO $$ BEGIN RAISE NOTICE 'Lógica de stock de traspasos consolidada (2 pasos con validación).'; END $$;