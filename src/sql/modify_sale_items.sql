-- RPC Function: modify_sale_items
-- Drop ALL old versions first
DROP FUNCTION IF EXISTS public.modify_sale_items(UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.modify_sale_items(TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.modify_sale_items(
    p_sale_id TEXT,
    p_items JSONB,
    p_subtotal NUMERIC,
    p_tax NUMERIC,
    p_discount NUMERIC,
    p_total NUMERIC,
    p_user_id TEXT
) RETURNS void AS $$
DECLARE
    v_sale RECORD;
    v_new_item RECORD;
BEGIN
    -- Ensure parent_deletion flag is OFF so triggers fire correctly
    PERFORM set_config('app.parent_deletion', 'false', true);

    -- 1. Get the sale
    SELECT * INTO v_sale FROM public.sales WHERE id::text = p_sale_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta no encontrada: %', p_sale_id;
    END IF;

    -- 2. DELETE old items → BEFORE DELETE trigger returns stock automatically
    DELETE FROM public.sale_items WHERE sale_id = v_sale.id;

    -- 3. UPDATE sale header
    UPDATE public.sales SET
        subtotal = p_subtotal,
        tax = p_tax,
        discount = p_discount,
        total = p_total,
        user_id = CASE WHEN p_user_id IS NOT NULL AND p_user_id != '' THEN p_user_id::UUID ELSE user_id END
    WHERE id = v_sale.id;

    -- 4. INSERT new items → AFTER INSERT trigger deducts stock automatically
    FOR v_new_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC, price NUMERIC, total NUMERIC)
    LOOP
        INSERT INTO public.sale_items (sale_id, product_id, quantity, price, total)
        VALUES (v_sale.id, v_new_item.product_id, v_new_item.quantity, v_new_item.price, v_new_item.total);
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
