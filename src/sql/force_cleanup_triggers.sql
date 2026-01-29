-- SOLUCIÓN DEFINITIVA "NUCLEAR" PARA DUPLICIDAD DE STOCK
-- Este script elimina TODOS los triggers de purchase_items programáticamente y reinstala los correctos.

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- 1. Eliminar TODOS los triggers de purchase_items
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'purchase_items') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.purchase_items CASCADE'; 
        RAISE NOTICE 'Trigger eliminado: %', r.trigger_name;
    END LOOP;

    -- 2. Eliminar TODOS los triggers de sale_items (por seguridad)
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'sale_items') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.sale_items CASCADE'; 
        RAISE NOTICE 'Trigger eliminado: %', r.trigger_name;
    END LOOP;
    
    -- 3. Eliminar limpieza de product_branch_settings
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'product_branch_settings') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.product_branch_settings CASCADE'; 
        RAISE NOTICE 'Trigger eliminado: %', r.trigger_name;
    END LOOP;
END $$;

-- 4. REINSTALAR FUNCIONES Y TRIGGERS CORRECTOS

-- A. Función unificada de stock (sin update a products, solo branch)
CREATE OR REPLACE FUNCTION public.update_branch_stock(
    p_product_id bigint,
    p_branch_id bigint,
    p_quantity_change numeric
) RETURNS numeric AS $$
DECLARE
    v_new_stock numeric;
BEGIN
    -- Flag interno
    perform set_config('app.internal_stock_update', 'true', true);

    insert into public.product_branch_settings (product_id, branch_id, stock, min_stock)
    values (p_product_id, p_branch_id, p_quantity_change, 0)
    on conflict (product_id, branch_id)
    do update set stock = product_branch_settings.stock + p_quantity_change
    returning stock into v_new_stock;
    
    return v_new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Sync Global
CREATE OR REPLACE FUNCTION public.handle_product_branch_changes()
RETURNS trigger AS $$
DECLARE
    v_new_global_stock numeric;
    v_diff numeric;
    v_is_internal text;
BEGIN
    -- Sincronizar Global
    SELECT coalesce(sum(stock), 0) INTO v_new_global_stock
    FROM public.product_branch_settings
    WHERE product_id = coalesce(new.product_id, old.product_id);

    UPDATE public.products 
    SET stock = v_new_global_stock
    WHERE id = coalesce(new.product_id, old.product_id);

    -- Loguear manuales
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

CREATE TRIGGER trg_sync_global_stock
AFTER INSERT OR UPDATE OR DELETE ON public.product_branch_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_product_branch_changes();

-- C. Trigger de Compras
CREATE OR REPLACE FUNCTION public.handle_purchase_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
BEGIN
    if (TG_OP = 'INSERT') then
        select branch_id into v_branch_id from public.purchases where id = new.purchase_id;
        update public.products set cost_price = new.unit_cost where id = new.product_id;
        
        v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, new.quantity);

        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, new.product_id, 'COMPRA', new.quantity, v_new_stock, new.purchase_id::text, 'Compra registrada #' || new.purchase_id);
        
        return new;

    elsif (TG_OP = 'UPDATE') then
        v_diff := new.quantity - old.quantity;
        if v_diff = 0 and new.unit_cost = old.unit_cost then return new; end if;

        select branch_id into v_branch_id from public.purchases where id = new.purchase_id;
        
        if new.unit_cost != old.unit_cost then
            update public.products set cost_price = new.unit_cost where id = new.product_id;
        end if;

        if v_diff != 0 then
            v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, v_diff);
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (v_branch_id, new.product_id, 'MODIFICACION_COMPRA', v_diff, v_new_stock, new.purchase_id::text, 'Compra modificada #' || new.purchase_id);
        end if;
        
        return new;
        
    elsif (TG_OP = 'DELETE') then
        select branch_id into v_branch_id from public.purchases where id = old.purchase_id;
        v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, -old.quantity);

        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, old.product_id, 'ANULACION_COMPRA', -old.quantity, v_new_stock, old.purchase_id::text, 'Compra anulada #' || old.purchase_id);
        return old;
    end if;
    return null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_kardex_purchase_insert_update
AFTER INSERT OR UPDATE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_item_changes();

CREATE TRIGGER trg_kardex_purchase_delete
BEFORE DELETE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_item_changes();

-- D. Trigger de Ventas (Reinstalación segura)
CREATE TRIGGER trg_kardex_sale_insert_update
AFTER INSERT OR UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

CREATE TRIGGER trg_kardex_sale_delete
BEFORE DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

-- 5. REPARACIÓN FINAL DE STOCK
UPDATE public.products p
SET stock = (
    SELECT coalesce(sum(stock), 0)
    FROM public.product_branch_settings s
    WHERE s.product_id = p.id
);
