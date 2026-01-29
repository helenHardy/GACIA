-- SOLUCIÓN INTEGRAL PARA ANULACIÓN DE VENTAS (STOCK + DEUDA)
-- Este script asegura que al borrar una venta se devuelva el stock Y se limpie la deuda del cliente.

-- 1. Desactivar el trigger de crédito antiguo para evitar duplicidad si ya existía
DROP TRIGGER IF EXISTS trg_sales_credit ON public.sales;

-- 2. Función maestra para manejar TODO lo relacionado a borrar una venta
CREATE OR REPLACE FUNCTION public.handle_sale_deletion()
RETURNS trigger AS $$
DECLARE
    item RECORD;
    v_new_stock numeric;
BEGIN
    -- A. Notificar a los triggers de los hijos (sale_items) que no hagan nada (nosotros nos encargamos)
    perform set_config('app.parent_deletion', 'true', true);

    -- B. RESTAURAR STOCK: Recorrer cada ítem de la venta
    FOR item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
        v_new_stock := public.update_branch_stock(item.product_id, old.branch_id, item.quantity);
        
        -- Registrar en Kardex
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (old.branch_id, item.product_id, 'ANULACION_VENTA', item.quantity, v_new_stock, old.id::text, 
               'Venta eliminada #' || coalesce(old.sale_number::text, old.id::text));
    END LOOP;

    -- C. RESTAURAR CRÉDITO: Si era una venta a crédito, restar del saldo del cliente
    IF (old.is_credit = true AND old.customer_id IS NOT NULL) THEN
        UPDATE public.customers 
        SET current_balance = coalesce(current_balance, 0) - old.total
        WHERE id = old.customer_id;
    END IF;

    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el trigger maestro de anulación
DROP TRIGGER IF EXISTS trg_sale_stock_reversion ON public.sales;
CREATE TRIGGER trg_sale_complete_reversion
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_deletion();

-- 4. Re-instalar lógica de crédito SOLO para INSERT y UPDATE (para no perder funcionalidad)
CREATE OR REPLACE FUNCTION public.handle_sale_credit_changes()
RETURNS trigger AS $$
BEGIN
    -- INSERT: Aumentar deuda
    IF (TG_OP = 'INSERT') THEN
        IF (new.is_credit = true AND new.customer_id IS NOT NULL) THEN
            UPDATE public.customers 
            SET current_balance = coalesce(current_balance, 0) + new.total
            WHERE id = new.customer_id;
        END IF;
    
    -- UPDATE: Ajustar diferencia
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Si cambió el cliente
        IF (old.customer_id != new.customer_id) THEN
            -- Revertir en el viejo
            IF (old.is_credit = true) THEN
                UPDATE public.customers SET current_balance = coalesce(current_balance, 0) - old.total WHERE id = old.customer_id;
            END IF;
            -- Aplicar en el nuevo
            IF (new.is_credit = true) THEN
                UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + new.total WHERE id = new.customer_id;
            END IF;
        -- Si es el mismo cliente pero cambió el monto o el estado de crédito
        ELSE
            IF (old.is_credit = true AND new.is_credit = true) THEN
                UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + (new.total - old.total) WHERE id = new.customer_id;
            ELSIF (old.is_credit = true AND new.is_credit = false) THEN
                UPDATE public.customers SET current_balance = coalesce(current_balance, 0) - old.total WHERE id = old.customer_id;
            ELSIF (old.is_credit = false AND new.is_credit = true) THEN
                UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + new.total WHERE id = new.customer_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sales_credit_sync
AFTER INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_credit_changes();
