-- CLEANUP PREVIOUS ATTEMPTS
DROP FUNCTION IF EXISTS public.convert_quotation_to_sale_v2(UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.convert_quotation_to_sale_v3(BIGINT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.convert_quotation_to_sale_v4(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.convert_quotation_to_sale_v5(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.convert_quotation_to_sale_v6(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.convert_quotation_to_sale_v7(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.convert_quotation_to_sale_v8(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, TEXT);

-- Final Robust BIGINT Conversion RPC (v9)
CREATE OR REPLACE FUNCTION public.convert_quotation_to_sale_v9(
  p_quotation_id TEXT,
  p_payment_method TEXT,
  p_amount_received NUMERIC,
  p_amount_change NUMERIC,
  p_is_credit BOOLEAN,
  p_discount_extra NUMERIC DEFAULT 0,
  p_user_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_quotation RECORD;
  v_item RECORD;
  v_sale_id BIGINT;           -- DEFINITIVE FIX: Sales use BIGINT
  v_user_uuid UUID;
  v_sale_record JSONB;
BEGIN
  -- 1. Identify User (Profiles STILL use UUID)
  IF p_user_id IS NOT NULL AND p_user_id ~ '^[0-9a-fA-F-]{36}$' THEN
    v_user_uuid := p_user_id::UUID;
  END IF;

  -- 2. Fetch Quotation (Supporting both string and number)
  IF p_quotation_id ~ '^[0-9]+$' THEN
    SELECT * INTO v_quotation FROM public.quotations 
    WHERE quotation_number::text = p_quotation_id OR id::text = p_quotation_id LIMIT 1;
  ELSE
    SELECT * INTO v_quotation FROM public.quotations 
    WHERE id::text = p_quotation_id LIMIT 1;
  END IF;

  IF v_quotation IS NULL THEN
    RAISE EXCEPTION 'Cotización con ID % no encontrada', p_quotation_id;
  END IF;

  -- 3. Resolve Auditor User
  IF v_user_uuid IS NULL AND v_quotation.user_id::text ~ '^[0-9a-fA-F-]{36}$' THEN
     v_user_uuid := v_quotation.user_id::UUID;
  END IF;

  -- 4. INSERT INTO SALES
  INSERT INTO public.sales (
    customer_id, branch_id, user_id, subtotal, tax, discount, total, 
    payment_method, amount_received, amount_change, is_credit
  )
  VALUES (
    v_quotation.customer_id, 
    v_quotation.branch_id, 
    v_user_uuid, 
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

  -- 5. INSERT ITEMS (Type-agnostic join)
  INSERT INTO public.sale_items (sale_id, product_id, quantity, price, total)
  SELECT v_sale_id, product_id, quantity, price, total
  FROM public.quotation_items 
  WHERE quotation_id::text = v_quotation.id::text;

  -- 6. Finalize Header
  UPDATE public.quotations SET status = 'Convertido', updated_at = NOW() 
  WHERE id::text = v_quotation.id::text;

  -- 7. Return Result
  SELECT to_json(s.*)::jsonb INTO v_sale_record FROM public.sales s WHERE s.id = v_sale_id;
  RETURN v_sale_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
