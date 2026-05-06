-- Asegurar que la columna 'notes' exista en la tabla 'sales'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'notes') THEN
        ALTER TABLE public.sales ADD COLUMN notes text;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.register_sale_v2(
  p_items JSONB,              -- Array of items: [{product_id, quantity, price}, ...]
  p_subtotal NUMERIC,
  p_tax NUMERIC,
  p_total NUMERIC,
  p_discount NUMERIC,
  p_payment_method TEXT,
  p_amount_received NUMERIC,
  p_amount_change NUMERIC,
  p_branch_id BIGINT,
  p_customer_id BIGINT,
  p_is_credit BOOLEAN,
  p_user_id UUID,
  p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
  v_sale_id UUID;
  v_item RECORD;
  v_sale_record JSONB;
BEGIN
  -- 1. Insert Sales Header
  INSERT INTO public.sales (
    subtotal, 
    tax, 
    total, 
    discount, 
    payment_method, 
    amount_received, 
    amount_change, 
    branch_id, 
    customer_id, 
    is_credit, 
    user_id,
    notes
  )
  VALUES (
    p_subtotal, 
    p_tax, 
    p_total, 
    p_discount, 
    p_payment_method, 
    p_amount_received, 
    p_amount_change, 
    p_branch_id::BIGINT, 
    p_customer_id::BIGINT, 
    p_is_credit, 
    p_user_id::UUID,
    p_notes
  )
  RETURNING id INTO v_sale_id;

  -- 2. Insert Sale Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC, price NUMERIC)
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
      v_item.price * v_item.quantity
    );
  END LOOP;

  -- 3. Return the created sale record
  SELECT to_json(s.*)::jsonb INTO v_sale_record FROM public.sales s WHERE s.id = v_sale_id;
  
  RETURN v_sale_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
