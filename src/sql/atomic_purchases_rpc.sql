CREATE OR REPLACE FUNCTION public.register_purchase_v2(
  p_purchase_id UUID,        -- NULL for new, non-NULL for edit
  p_supplier_id BIGINT,
  p_branch_id BIGINT,
  p_total NUMERIC,
  p_user_id UUID,
  p_items JSONB              -- Array of items: [{product_id, quantity, unit_cost, total}, ...]
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_item RECORD;
BEGIN
  -- 1. Create or Update Header
  IF p_purchase_id IS NULL THEN
    INSERT INTO public.purchases (supplier_id, branch_id, total, user_id)
    VALUES (p_supplier_id, p_branch_id, p_total, p_user_id)
    RETURNING id INTO v_purchase_id;
  ELSE
    -- Delete old items first to trigger stock reversion
    DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;

    UPDATE public.purchases 
    SET supplier_id = p_supplier_id,
        branch_id = p_branch_id,
        total = p_total,
        user_id = p_user_id
    WHERE id = p_purchase_id
    RETURNING id INTO v_purchase_id;
    
    IF v_purchase_id IS NULL THEN
      RAISE EXCEPTION 'Purchase with id % not found', p_purchase_id;
    END IF;
  END IF;

  -- 2. Insert New Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC, unit_cost NUMERIC, total NUMERIC)
  LOOP
    IF v_item.quantity < 0 THEN
      RAISE EXCEPTION 'La cantidad no puede ser negativa para el producto id %', v_item.product_id;
    END IF;
    IF v_item.unit_cost < 0 THEN
      RAISE EXCEPTION 'El costo unitario no puede ser negativo para el producto id %', v_item.product_id;
    END IF;

    INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_cost, total)
    VALUES (v_purchase_id, v_item.product_id, v_item.quantity, v_item.unit_cost, v_item.total);
  END LOOP;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
