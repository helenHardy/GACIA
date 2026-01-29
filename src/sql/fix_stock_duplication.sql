-- SOLUCIÓN DEFINITIVA PARA DUPLICIDAD DE STOCK
-- Este script elimina disparadores antiguos y asegura una sola fuente de verdad.

-- 1. ELIMINAR CUALQUIER TRIGGER ANTIGUO QUE PUEDA ESTAR DUPLICANDO
DROP TRIGGER IF EXISTS trg_kardex_purchase ON public.purchase_items;
DROP TRIGGER IF EXISTS trg_kardex_purchase_insert_update ON public.purchase_items;
DROP TRIGGER IF EXISTS trg_kardex_purchase_delete ON public.purchase_items;
DROP TRIGGER IF EXISTS trg_sync_global_stock ON public.product_branch_settings;

-- 2. RE-APLICAR LA FUNCIÓN DE SINCRONIZACIÓN GLOBAL (FIABLE)
CREATE OR REPLACE FUNCTION public.handle_product_branch_changes()
RETURNS trigger AS $$
DECLARE
    v_new_global_stock numeric;
    v_diff numeric;
    v_is_internal text;
BEGIN
    -- A. Sincronizar stock sumando todas las sucursales
    SELECT coalesce(sum(stock), 0) INTO v_new_global_stock
    FROM public.product_branch_settings
    WHERE product_id = coalesce(new.product_id, old.product_id);

    -- B. Actualizar la tabla maestra de productos con el total real
    UPDATE public.products 
    SET stock = v_new_global_stock
    WHERE id = coalesce(new.product_id, old.product_id);

    -- C. Loguear si es un ajuste manual (no provocado por compra/venta/traspaso)
    v_is_internal := current_setting('app.internal_stock_update', true);
    IF (v_is_internal IS NULL OR v_is_internal != 'true') THEN
        IF (TG_OP = 'UPDATE') THEN
            v_diff := new.stock - old.stock;
            IF v_diff != 0 THEN
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
                VALUES (new.branch_id, new.product_id, 'AJUSTE_MANUAL', v_diff, new.stock, 'Ajuste manual de inventario');
            END IF;
        ELSIF (TG_OP = 'INSERT') AND new.stock != 0 THEN
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
            VALUES (new.branch_id, new.product_id, 'CARGA_INICIAL', new.stock, new.stock, 'Carga inicial');
        END IF;
    END IF;

    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREAR EL ÚNICO TRIGGER DE SINCRONIZACIÓN NECESARIO
CREATE TRIGGER trg_sync_global_stock
AFTER INSERT OR UPDATE OR DELETE ON public.product_branch_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_product_branch_changes();

-- 4. RE-APLICAR DISPARADORES DE COMPRAS (LIMPIOS)
-- Nota: handle_purchase_item_changes debe usar update_branch_stock
CREATE TRIGGER trg_kardex_purchase_insert_update
AFTER INSERT OR UPDATE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_item_changes();

CREATE TRIGGER trg_kardex_purchase_delete
BEFORE DELETE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_item_changes();

-- 5. REPARACIÓN INMEDIATA: Sincronizar todo el stock actual
UPDATE public.products p
SET stock = (
    SELECT coalesce(sum(stock), 0)
    FROM public.product_branch_settings s
    WHERE s.product_id = p.id
);

-- 6. VERIFICACIÓN FINAL: Listar productos con stock inconsistent
SELECT id, name, stock as global_stock, 
       (SELECT sum(stock) FROM public.product_branch_settings WHERE product_id = p.id) as branches_sum
FROM public.products p
WHERE stock != (SELECT coalesce(sum(stock), 0) FROM public.product_branch_settings WHERE product_id = p.id);
