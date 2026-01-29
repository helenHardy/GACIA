-- Trigger for sales table to handle customer credit
create or replace function public.handle_sale_credit_changes()
returns trigger as $$
begin
    -- 1. INSERT: Add to balance if it's a credit sale
    if (TG_OP = 'INSERT') then
        if (new.is_credit = true and new.customer_id is not null) then
            update public.customers 
            set current_balance = coalesce(current_balance, 0) + new.total
            where id = new.customer_id;
        end if;
        return new;

    -- 2. UPDATE: Handle changes in total, customer, or credit status
    elsif (TG_OP = 'UPDATE') then
        -- Caso A: Misma deuda, sigue siendo crédito, solo cambia el monto o el cliente
        if (old.is_credit = true and new.is_credit = true) then
            -- Si cambió el cliente
            if (old.customer_id != new.customer_id) then
                -- Revertir en el anterior
                update public.customers 
                set current_balance = coalesce(current_balance, 0) - old.total
                where id = old.customer_id;
                -- Aplicar en el nuevo
                update public.customers 
                set current_balance = coalesce(current_balance, 0) + new.total
                where id = new.customer_id;
            -- Si es el mismo cliente pero cambió el total
            elsif (old.total != new.total) then
                update public.customers 
                set current_balance = coalesce(current_balance, 0) + (new.total - old.total)
                where id = new.customer_id;
            end if;
            
        -- Caso B: Era crédito pero ya no lo es (ej. se pagó al contado tras edición)
        elsif (old.is_credit = true and new.is_credit = false) then
            update public.customers 
            set current_balance = coalesce(current_balance, 0) - old.total
            where id = old.customer_id;

        -- Caso C: No era crédito pero ahora sí lo es
        elsif (old.is_credit = false and new.is_credit = true) then
            update public.customers 
            set current_balance = coalesce(current_balance, 0) + new.total
            where id = new.customer_id;
        end if;
        
        return new;

    -- 3. DELETE: Revert balance if it was a credit sale
    elsif (TG_OP = 'DELETE') then
        if (old.is_credit = true and old.customer_id is not null) then
            update public.customers 
            set current_balance = coalesce(current_balance, 0) - old.total
            where id = old.customer_id;
        end if;
        return old;
    end if;
    
    return null;
end;
$$ language plpgsql security definer;

-- Trigger para sales
drop trigger if exists trg_sales_credit on public.sales;
create trigger trg_sales_credit
after insert or update or delete on public.sales
for each row execute function public.handle_sale_credit_changes();
