-- RPC: Get Sales Report (Daily Aggregation)
-- Returns date, revenue, profit, and transaction count.
create or replace function get_sales_report(
  p_start_date date,
  p_end_date date,
  p_branch_id bigint default null
)
returns table (
  report_date text,
  total_sales numeric,
  total_profit numeric,
  transaction_count bigint
) as $$
begin
  return query
  with daily_sales as (
    select
      date(created_at) as d_date,
      sum(total) as d_total,
      sum(subtotal) as d_subtotal,
      sum(discount) as d_discount,
      count(id) as d_count
    from sales
    where date(created_at) >= p_start_date and date(created_at) <= p_end_date
    and (p_branch_id is null or branch_id = p_branch_id)
    group by date(created_at)
  ),
  daily_costs as (
    select
      date(s.created_at) as c_date,
      sum(si.quantity * coalesce(p.cost_price, 0)) as total_cost
    from sales s
    join sale_items si on s.id = si.sale_id
    join products p on si.product_id = p.id
    where date(s.created_at) >= p_start_date and date(s.created_at) <= p_end_date
    and (p_branch_id is null or s.branch_id = p_branch_id)
    group by date(s.created_at)
  )
  select
    to_char(ds.d_date, 'YYYY-MM-DD') as report_date,
    coalesce(ds.d_total, 0)::numeric as total_sales,
    (coalesce(ds.d_subtotal, 0) - coalesce(ds.d_discount, 0) - coalesce(dc.total_cost, 0))::numeric as total_profit,
    coalesce(ds.d_count, 0)::bigint as transaction_count
  from daily_sales ds
  left join daily_costs dc on ds.d_date = dc.c_date
  order by ds.d_date;
end;
$$ language plpgsql;

-- RPC: Get Top Products
-- Returns product name, quantity sold, and total revenue.
create or replace function get_top_products(
  p_start_date date,
  p_end_date date,
  p_branch_id bigint default null,
  p_limit int default 5
)
returns table (
  product_name text,
  quantity_sold numeric,
  total_revenue numeric,
  image_url text
) as $$
begin
  return query
  select
    p.name::text as product_name,
    sum(si.quantity)::numeric as quantity_sold,
    sum(si.total)::numeric as total_revenue,
    p.image_url::text
  from sale_items si
  join sales s on si.sale_id = s.id
  join products p on si.product_id = p.id
  where
    date(s.created_at) >= p_start_date
    and date(s.created_at) <= p_end_date
    and (p_branch_id is null or s.branch_id = p_branch_id)
  group by p.id, p.name, p.image_url
  order by total_revenue desc
  limit p_limit;
end;
$$ language plpgsql;

-- RPC: Get Inventory Valuation
-- Returns total cost value, total retail value, and item count.
create or replace function get_inventory_valuation(
  p_branch_id bigint default null
)
returns table (
  total_cost_value numeric,
  total_retail_value numeric,
  item_count bigint
) as $$
begin
  return query
  select
    sum(pbs.stock * coalesce(p.cost_price, 0))::numeric as total_cost_value,
    sum(pbs.stock * coalesce(pbs.price, p.price, 0))::numeric as total_retail_value,
    count(distinct p.id)::bigint as item_count
  from product_branch_settings pbs
  join products p on pbs.product_id = p.id
  where
    (p_branch_id is null or pbs.branch_id = p_branch_id)
    and pbs.stock > 0;
end;
$$ language plpgsql;
