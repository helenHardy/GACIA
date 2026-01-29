-- Migration: Sync global products.stock from product_branch_settings
update public.products p
set stock = (
    select coalesce(sum(stock), 0)
    from public.product_branch_settings s
    where s.product_id = p.id
);
