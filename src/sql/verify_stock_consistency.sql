-- SCRIPT DE VERIFICACIÓN DE CONSISTENCIA DE STOCK

-- 1. Buscar desajustes entre el total global y la suma por sucursales
with branch_totals as (
    select product_id, sum(stock) as total_branch_stock
    from public.product_branch_settings
    group by product_id
),
discrepancies as (
    select 
        p.id, 
        p.name, 
        p.stock as global_stock, 
        bt.total_branch_stock,
        (p.stock - coalesce(bt.total_branch_stock, 0)) as diff
    from public.products p
    left join branch_totals bt on p.id = bt.product_id
    where p.stock != coalesce(bt.total_branch_stock, 0)
)
select * from discrepancies;

-- 2. Verificar si hay productos sin configuración de sucursal pero con stock global
select id, name, stock 
from public.products 
where stock != 0 
and id not in (select product_id from public.product_branch_settings);

-- 3. (OPCIONAL) Corregir desajustes si existieran (Sync Forzado)
/*
update public.products p
set stock = (
    select coalesce(sum(stock), 0)
    from public.product_branch_settings s
    where s.product_id = p.id
);
*/
