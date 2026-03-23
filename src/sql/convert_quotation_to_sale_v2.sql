-- Convert Quotation to Sale V2: Atomic conversion with stock validation
CREATE OR REPLACE FUNCTION public.convert_quotation_to_sale_v2(
  p_quotation_id UUID,
  p_payment_method TEXT,
  p_amount_received NUMERIC,
  p_amount_change NUMERIC,
  p_is_credit BOOLEAN,
  p_discount_extra NUMERIC DEFAULT 0,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_quotation RECORD;
  v_item RECORD;
  v_sale_id UUID;
  v_sale_record JSONB;
BEGIN
  -- 1. Fetch Quotation Header
  SELECT * INTO v_quotation FROM public.quotations WHERE id = p_quotation_id;
  IF v_quotation IS NULL THEN
    RAISE EXCEPTION 'Cotización con ID % no encontrada', p_quotation_id;
  END IF;

  IF v_quotation.status = 'Convertido' THEN
    RAISE EXCEPTION 'Esta cotización ya ha sido convertida a venta.';
  END IF;

  -- 2. Insert Sale Header
  INSERT INTO public.sales (
    customer_id, 
    branch_id, 
    user_id, 
    subtotal, 
    tax, 
    discount, 
    total, 
    payment_method, 
    amount_received, 
    amount_change, 
    is_credit
  )
  VALUES (
    v_quotation.customer_id, 
    v_quotation.branch_id, 
    COALESCE(p_user_id, v_quotation.user_id), 
    v_quotation.subtotal, 
    v_quotation.tax, 
    v_quotation.discount + p_discount_extra, 
    v_quotation.total - p_discount_extra, 
    p_payment_method, 
    p_amount_received, 
    p_amount_change, 
    p_is_credit
  )
  RETURNING id INTO v_sale_id;

  -- 3. Insert Sale Items from Quotation Items
  -- Triggers will automatically: 
  --   a. Validate stock
  --   b. Subtract stock
  --   c. Register Kardex
  FOR v_item IN SELECT * FROM public.quotation_items WHERE quotation_id = p_quotation_id
  LOOP
    INSERT INTO public.sale_items (
      sale_id, 
      product_id, 
      quantity, 
      price, 
      total
    )
    VALUES (
      v_sale_id, 
      v_item.product_id, 
      v_item.quantity, 
      v_item.price, 
      v_item.total
    );
  END LOOP;

  -- 4. Update Quotation Status
  UPDATE public.quotations 
  SET status = 'Convertido', 
      updated_at = NOW() 
  WHERE id = p_quotation_id;

  -- 5. Return the sale record
  SELECT to_json(s.*)::jsonb INTO v_sale_record FROM public.sales s WHERE s.id = v_sale_id;
  RETURN v_sale_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
