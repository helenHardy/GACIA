-- 1. Crear la tabla Kardex
create table if not exists public.kardex (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    branch_id bigint references public.branches(id),
    product_id bigint references public.products(id),
    type text not null, 
    quantity numeric not null,
    balance_after numeric,
    notes text,
    reference_id text
);

-- Habilitar RLS
alter table public.kardex enable row level security;
do $$ 
begin
    if not exists (select 1 from pg_policies where tablename = 'kardex' and policyname = 'Enable read access for all users') then
        create policy "Enable read access for all users" on public.kardex for select using (true);
    end if;
    if not exists (select 1 from pg_policies where tablename = 'kardex' and policyname = 'Enable insert access for authenticated users') then
        create policy "Enable insert access for authenticated users" on public.kardex for insert with check (auth.role() = 'authenticated');
    end if;
end $$;

-- FUNCIÓN AUXILIAR: Actualizar Stock
create or replace function public.update_branch_stock(
    p_product_id bigint,
    p_branch_id bigint,
    p_quantity_change numeric
) returns numeric as $$
declare
    v_new_stock numeric;
begin
    -- Marcar como actualización interna para evitar duplicidad de logs en el Kardex
    perform set_config('app.internal_stock_update', 'true', true);

    insert into public.product_branch_settings (product_id, branch_id, stock, min_stock)
    values (p_product_id, p_branch_id, p_quantity_change, 0)
    on conflict (product_id, branch_id)
    do update set stock = product_branch_settings.stock + p_quantity_change
    returning stock into v_new_stock;
    
    -- NOTA: Ya no actualizamos public.products aquí. 
    -- Se hace vía trigger trg_sync_global_stock en la tabla product_branch_settings.
    
    return v_new_stock;
end;
$$ language plpgsql security definer;


-- 2. Trigger para Sincronizar Stock Global y Loguear Ajustes Manuales
create or replace function public.handle_product_branch_changes()
returns trigger as $$
declare
    v_new_global_stock numeric;
    v_diff numeric;
    v_is_internal text;
begin
    -- 1. Sincronizar stock global en la tabla products
    select coalesce(sum(stock), 0) into v_new_global_stock
    from public.product_branch_settings
    where product_id = coalesce(new.product_id, old.product_id);

    update public.products 
    set stock = v_new_global_stock
    where id = coalesce(new.product_id, old.product_id);

    -- 2. Loguear Ajustes Manuales
    v_is_internal := current_setting('app.internal_stock_update', true);
    
    if (v_is_internal is null or v_is_internal != 'true') then
        if (TG_OP = 'UPDATE') then
            v_diff := new.stock - old.stock;
            if v_diff != 0 then
                insert into public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
                values (new.branch_id, new.product_id, 'AJUSTE_MANUAL', v_diff, new.stock, 'Ajuste manual de inventario');
            end if;
        elsif (TG_OP = 'INSERT') then
            if new.stock != 0 then
                insert into public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
                values (new.branch_id, new.product_id, 'CARGA_INICIAL', new.stock, new.stock, 'Carga inicial de inventario');
            end if;
        end if;
    end if;

    return coalesce(new, old);
end;
$$ language plpgsql security definer;



drop trigger if exists trg_sync_global_stock on public.product_branch_settings;
create trigger trg_sync_global_stock
after insert or update or delete on public.product_branch_settings
for each row execute function public.handle_product_branch_changes();


-- 2. Trigger para VENTAS (sale_items)
create or replace function public.handle_sale_item_changes()
returns trigger as $$
declare
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
begin
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
        
        -- Si la venta ya no existe (por CASCADE), intentamos obtener el branch de la propia venta antes de que se borre si es posible,
        -- pero como es un trigger BEFORE DELETE de sale_items, la venta padre todavía existe.
        
        v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);

        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, old.product_id, 'ANULACION_VENTA', old.quantity, v_new_stock, old.sale_id::text, 'Venta anulada #' || old.sale_id);
        
        return old;
    end if;
    return null;
end;
$$ language plpgsql security definer;

-- Trigger para sale_items: INSERT y UPDATE son AFTER, DELETE es BEFORE para asegurar acceso a la venta padre
drop trigger if exists trg_kardex_sale_insert_update on public.sale_items;
create trigger trg_kardex_sale_insert_update
after insert or update on public.sale_items
for each row execute function public.handle_sale_item_changes();

drop trigger if exists trg_kardex_sale_delete on public.sale_items;
create trigger trg_kardex_sale_delete
before delete on public.sale_items
for each row execute function public.handle_sale_item_changes();

-- Eliminar el viejo trigger si existe
drop trigger if exists trg_kardex_sale on public.sale_items;


-- 4. Trigger para COMPRAS (purchase_items)
create or replace function public.handle_purchase_item_changes()
returns trigger as $$
declare
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
begin
    if (TG_OP = 'INSERT') then
        select branch_id into v_branch_id from public.purchases where id = new.purchase_id;
        
        -- Actualizar precio de costo
        update public.products set cost_price = new.unit_cost where id = new.product_id;
        
        v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, new.quantity);

        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, new.product_id, 'COMPRA', new.quantity, v_new_stock, new.purchase_id::text, 'Compra registrada #' || new.purchase_id);
        
        return new;

    elsif (TG_OP = 'UPDATE') then
        v_diff := new.quantity - old.quantity;
        if v_diff = 0 and new.unit_cost = old.unit_cost then return new; end if;

        select branch_id into v_branch_id from public.purchases where id = new.purchase_id;
        
        -- Si cambió el costo, actualizarlo
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
end;
$$ language plpgsql security definer;

-- Trigger para purchase_items: INSERT y UPDATE son AFTER, DELETE es BEFORE
drop trigger if exists trg_kardex_purchase_insert_update on public.purchase_items;
create trigger trg_kardex_purchase_insert_update
after insert or update on public.purchase_items
for each row execute function public.handle_purchase_item_changes();

drop trigger if exists trg_kardex_purchase_delete on public.purchase_items;
create trigger trg_kardex_purchase_delete
before delete on public.purchase_items
for each row execute function public.handle_purchase_item_changes();

-- Eliminar el viejo trigger
drop trigger if exists trg_kardex_purchase on public.purchase_items;



-- 4. Trigger para TRASPASOS (transfers update)
create or replace function public.handle_transfer_status_changes()
returns trigger as $$
declare
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
begin
    -- CASO 1: Envío procesado (Pendiente -> Enviado)
    -- Se descuenta de origen inmediatamente para que el stock en tránsito no sea vendible.
    if new.status = 'Enviado' and (old.status = 'Pendiente' or old.status is null) then
        for t_item in select * from public.transfer_items where transfer_id = new.id loop
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text, 
                   'Envío de transferencia a ' || (select name from public.branches where id = new.destination_branch_id));
        end loop;

    -- CASO 2: Recepción confirmada (Enviado -> Recibido)
    -- Se suma al destino.
    elsif new.status = 'Recibido' and old.status = 'Enviado' then
        for t_item in select * from public.transfer_items where transfer_id = new.id loop
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
            
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (new.destination_branch_id, t_item.product_id, 'TRASPASO_ENTRADA', t_item.quantity, v_dest_stock, new.id::text, 
                   'Recepción de transferencia desde ' || (select name from public.branches where id = new.origin_branch_id));
        end loop;

    -- CASO 3: Cancelación de envío (Enviado -> Cancelado)
    -- Se devuelve el stock al origen.
    elsif new.status = 'Cancelado' and old.status = 'Enviado' then
        for t_item in select * from public.transfer_items where transfer_id = new.id loop
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, t_item.quantity);
            
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (new.origin_branch_id, t_item.product_id, 'TRASPASO_CANCELADO', t_item.quantity, v_origin_stock, new.id::text, 'Retorno stock por traspaso cancelado');
        end loop;

    -- CASO Especial: Recepción directa (Pendiente -> Recibido) 
    -- Se hace todo el movimiento (Poco común pero posible vía API/SQL)
    elsif new.status = 'Recibido' and (old.status = 'Pendiente' or old.status is null) then
         for t_item in select * from public.transfer_items where transfer_id = new.id loop
            v_origin_stock := public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
            
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (new.origin_branch_id, t_item.product_id, 'TRASPASO_SALIDA', -t_item.quantity, v_origin_stock, new.id::text, 'Traspaso rápido (salida)');
            
             insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (new.destination_branch_id, t_item.product_id, 'TRASPASO_ENTRADA', t_item.quantity, v_dest_stock, new.id::text, 'Traspaso rápido (entrada)');
        end loop;
    end if;
    
    return new;
end;
$$ language plpgsql security definer;

-- Trigger para manejar cambios de estado
drop trigger if exists trg_kardex_transfer on public.transfers;
create trigger trg_kardex_transfer
after update on public.transfers
for each row execute function public.handle_transfer_status_changes();

-- Trigger para manejar ELIMINACIÓN de traspasos recibidos
create or replace function public.handle_transfer_delete()
returns trigger as $$
declare
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
begin
    if old.status = 'Recibido' then
        for t_item in select * from public.transfer_items where transfer_id = old.id loop
            v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, old.destination_branch_id, -t_item.quantity);
            
            insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            values (old.origin_branch_id, t_item.product_id, 'TRASPASO_ELIMINADO', t_item.quantity, v_origin_stock, old.id::text, 'Traspaso eliminado (reversión stock)');
        end loop;
    end if;
    return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_kardex_transfer_delete on public.transfers;
create trigger trg_kardex_transfer_delete
before delete on public.transfers
for each row execute function public.handle_transfer_delete();
