-- Register Quotation V2: Atomic insert/update of quotation and its items
CREATE OR REPLACE FUNCTION public.register_quotation_v2(
  p_quotation_id UUID,        -- NULL for new, non-NULL for edit
  p_items JSONB,              -- Array: [{product_id, quantity, price}, ...]
  p_customer_id BIGINT,
  p_branch_id BIGINT,
  p_user_id UUID,
  p_subtotal NUMERIC,
  p_tax NUMERIC,
  p_discount NUMERIC,
  p_total NUMERIC,
  p_valid_until DATE,
  p_notes TEXT,
  p_status TEXT DEFAULT 'Pendiente'
) RETURNS JSONB AS $$
DECLARE
  v_quotation_id UUID;
  v_item RECORD;
  v_result JSONB;
BEGIN
  -- 1. Create or Update Header
  IF p_quotation_id IS NULL THEN
    INSERT INTO public.quotations (
      customer_id, branch_id, user_id, subtotal, tax, discount, total, valid_until, notes, status
    )
    VALUES (
      p_customer_id, p_branch_id, p_user_id, p_subtotal, p_tax, p_discount, p_total, p_valid_until, p_notes, p_status
    )
    RETURNING id INTO v_quotation_id;
  ELSE
    -- Delete old items first
    DELETE FROM public.quotation_items WHERE quotation_id = p_quotation_id;

    UPDATE public.quotations 
    SET customer_id = p_customer_id,
        branch_id = p_branch_id,
        user_id = p_user_id,
        subtotal = p_subtotal,
        tax = p_tax,
        discount = p_discount,
        total = p_total,
        valid_until = p_valid_until,
        notes = p_notes,
        status = p_status,
        updated_at = NOW()
    WHERE id = p_quotation_id
    RETURNING id INTO v_quotation_id;
    
    IF v_quotation_id IS NULL THEN
      RAISE EXCEPTION 'Quotation with id % not found', p_quotation_id;
    END IF;
  END IF;

  -- 2. Insert New Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC, price NUMERIC)
  LOOP
    INSERT INTO public.quotation_items (
      quotation_id, product_id, quantity, price, total
    )
    VALUES (
      v_quotation_id, v_item.product_id, v_item.quantity, v_item.price, v_item.price * v_item.quantity
    );
  END LOOP;

  -- 3. Return the quotation record
  SELECT to_json(q.*)::jsonb INTO v_result FROM public.quotations q WHERE q.id = v_quotation_id;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
