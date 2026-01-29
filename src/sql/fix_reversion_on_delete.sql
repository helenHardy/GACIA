-- SOLUCIÓN PARA REVERSIÓN DE STOCK AL ELIMINAR/ANULAR
-- Este script asegura que al borrar una Venta o Compra, el stock se devuelva correctamente.

-- 1. Modificar Item Triggers para evitar doble reversión
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
    v_parent_deletion text;
BEGIN
    -- Si el padre se está borrando, ignoramos este trigger (el padre lo maneja)
    v_parent_deletion := current_setting('app.parent_deletion', true);
    if (v_parent_deletion = 'true') then return coalesce(new, old); end if;

    if (TG_OP = 'INSERT') then
        select branch_id into v_branch_id from public.sales where id = new.sale_id;
        v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, new.product_id, 'VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta registrada #' || new.sale_id);
        return new;
        
    elsif (TG_OP = 'UPDATE') then
        v_diff := new.quantity - old.quantity;
        if v_diff = 0 then return new; end if;
        select branch_id into v_branch_id from public.sales where id = new.sale_id;
        v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -v_diff);
        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, new.product_id, 'MODIFICACION_VENTA', -v_diff, v_new_stock, new.sale_id::text, 'Venta modificada #' || new.sale_id);
        return new;

    elsif (TG_OP = 'DELETE') then
        select branch_id into v_branch_id from public.sales where id = old.sale_id;
        -- Solo si encontramos la sucursal (significa que el padre existe y es borrado individual de item)
        if (v_branch_id is not null) then
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (v_branch_id, old.product_id, 'ANULACION_VENTA', old.quantity, v_new_stock, old.sale_id::text, 'Venta anulada #' || old.sale_id);
        end if;
        return old;
    end if;
    return null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_purchase_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
    v_parent_deletion text;
BEGIN
    v_parent_deletion := current_setting('app.parent_deletion', true);
    if (v_parent_deletion = 'true') then return coalesce(new, old); end if;

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
        if (v_branch_id is not null) then
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, -old.quantity);
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (v_branch_id, old.product_id, 'ANULACION_COMPRA', -old.quantity, v_new_stock, old.purchase_id::text, 'Compra anulada #' || old.purchase_id);
        end if;
        return old;
    end if;
    return null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Funciones para Deletions en Padres (Ventas y Compras)
CREATE OR REPLACE FUNCTION public.handle_sale_deletion()
RETURNS trigger AS $$
DECLARE
    item RECORD;
    v_new_stock numeric;
BEGIN
    -- Marcar que estamos borrando el padre
    perform set_config('app.parent_deletion', 'true', true);

    -- Devolver stock de cada item
    FOR item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
        v_new_stock := public.update_branch_stock(item.product_id, old.branch_id, item.quantity);
        
        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (old.branch_id, item.product_id, 'ANULACION_VENTA', item.quantity, v_new_stock, old.id::text, 'Venta eliminada #' || coalesce(old.sale_number::text, old.id::text));
    END LOOP;

    return old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_purchase_deletion()
RETURNS trigger AS $$
DECLARE
    item RECORD;
    v_new_stock numeric;
BEGIN
    perform set_config('app.parent_deletion', 'true', true);

    FOR item IN SELECT * FROM public.purchase_items WHERE purchase_id = old.id LOOP
        v_new_stock := public.update_branch_stock(item.product_id, old.branch_id, -item.quantity);
        
        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (old.branch_id, item.product_id, 'ANULACION_COMPRA', -item.quantity, v_new_stock, old.id::text, 'Compra eliminada #' || old.id::text);
    END LOOP;

    return old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear los Triggers en las tablas padres
DROP TRIGGER IF EXISTS trg_sale_stock_reversion ON public.sales;
CREATE TRIGGER trg_sale_stock_reversion
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_deletion();

DROP TRIGGER IF EXISTS trg_purchase_stock_reversion ON public.purchases;
CREATE TRIGGER trg_purchase_stock_reversion
BEFORE DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_deletion();
