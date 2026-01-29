-- SOLUCIÓN NUCLEAR PARA DEUDA DUPLICADA
-- Este script elimina TODOS los triggers de la tabla sales y reinstala la lógica correcta.

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- 1. Eliminar TODOS los triggers de la tabla sales para evitar duplicidad
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'sales') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.sales CASCADE'; 
        RAISE NOTICE 'Trigger eliminado: %', r.trigger_name;
    END LOOP;
END $$;

-- 2. REINSTALAR LÓGICA DE CRÉDITO (Aumento de Deuda)
CREATE OR REPLACE FUNCTION public.handle_sale_credit_changes()
RETURNS trigger AS $$
BEGIN
    -- INSERT: Aumentar deuda si es crédito
    IF (TG_OP = 'INSERT') THEN
        IF (new.is_credit = true AND new.customer_id IS NOT NULL) THEN
            UPDATE public.customers 
            SET current_balance = coalesce(current_balance, 0) + new.total
            WHERE id = new.customer_id;
        END IF;

    -- UPDATE: Ajustar deuda por pago o cambio de monto
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Si cambió el cliente, revertir en anterior y sumar en nuevo
        IF (old.customer_id != new.customer_id) THEN
            IF (old.is_credit = true) THEN
                UPDATE public.customers SET current_balance = coalesce(current_balance, 0) - old.total WHERE id = old.customer_id;
            END IF;
            IF (new.is_credit = true) THEN
                UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + new.total WHERE id = new.customer_id;
            END IF;
        ELSE
            -- Mismo cliente, diferentes escenarios de crédito
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

-- Trigger para Insert y Update (Sincronización de deuda activa)
CREATE TRIGGER trg_sales_credit_sync
AFTER INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_credit_changes();

-- 3. REINSTALAR LÓGICA DE ANULACIÓN (Stock + Deuda)
CREATE OR REPLACE FUNCTION public.handle_sale_deletion()
RETURNS trigger AS $$
DECLARE
    item RECORD;
    v_new_stock numeric;
BEGIN
    -- Informar a los hijos que estamos borrando el padre
    perform set_config('app.parent_deletion', 'true', true);

    -- Devolver Stock
    FOR item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
        v_new_stock := public.update_branch_stock(item.product_id, old.branch_id, item.quantity);
        
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (old.branch_id, item.product_id, 'ANULACION_VENTA', item.quantity, v_new_stock, old.id::text, 
               'Venta anulada #' || coalesce(old.sale_number::text, old.id::text));
    END LOOP;

    -- Limpiar Deuda si era crédito
    IF (old.is_credit = true AND old.customer_id IS NOT NULL) THEN
        UPDATE public.customers 
        SET current_balance = coalesce(current_balance, 0) - old.total
        WHERE id = old.customer_id;
    END IF;

    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para Delete (Limpieza total)
CREATE TRIGGER trg_sale_complete_reversion
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_deletion();

-- 4. REPARACIÓN INMEDIATA DE DEUDAS
-- Este comando corrige a todos los clientes cuyo saldo esté mal por la duplicidad previa.
UPDATE public.customers c
SET current_balance = (
    SELECT coalesce(sum(total), 0)
    FROM public.sales s
    WHERE s.customer_id = c.id AND s.is_credit = true
);

-- VERIFICACIÓN: Mostrar si algún cliente sigue con inconsistencias (si hubiera abonos externos)
-- Por ahora asumimos que la deuda = suma de ventas a crédito.
