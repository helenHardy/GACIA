-- ========================================================
-- SOLUCIÓN DEFINITIVA: ERROR DE TIPO UUID EN REGISTRO DE VENTA
-- ========================================================
-- Este script detecta si tu tabla 'sales' usa IDs SERIAL (BIGINT) o UUID
-- y recrea el procedimiento 'register_sale_v2' para que sea compatible.

DO $$ 
DECLARE 
    v_id_type text;
BEGIN 
    -- 1. Detectar el tipo de dato de public.sales.id
    SELECT data_type INTO v_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'id' AND table_schema = 'public';

    RAISE NOTICE 'Tipo detectado para sales.id: %', v_id_type;

    -- 2. Eliminar funciones anteriores para evitar conflictos de sobrecarga
    DROP FUNCTION IF EXISTS public.register_sale_v2(jsonb, numeric, numeric, numeric, numeric, text, numeric, numeric, bigint, bigint, boolean, uuid);
    
    -- También intentamos borrar cualquier versión que use UUID para branch_id por si acaso
    EXECUTE 'DROP FUNCTION IF EXISTS public.register_sale_v2(jsonb, numeric, numeric, numeric, numeric, text, numeric, numeric, uuid, uuid, boolean, uuid)';

    -- 3. Crear la función adaptada al tipo real de tu base de datos
    IF v_id_type = 'uuid' THEN
        -- VERSIÓN UUID
        CREATE OR REPLACE FUNCTION public.register_sale_v2(
          p_items JSONB,
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
          p_user_id UUID
        ) RETURNS JSONB AS $body$
        DECLARE
          v_sale_id UUID;
          v_item RECORD;
          v_sale_record JSONB;
        BEGIN
          INSERT INTO public.sales (subtotal, tax, total, discount, payment_method, amount_received, amount_change, branch_id, customer_id, is_credit, user_id)
          VALUES (p_subtotal, p_tax, p_total, p_discount, p_payment_method, p_amount_received, p_amount_change, p_branch_id, p_customer_id, p_is_credit, p_user_id)
          RETURNING id INTO v_sale_id;

          FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC, price NUMERIC)
          LOOP
            INSERT INTO public.sale_items (sale_id, product_id, quantity, price, total)
            VALUES (v_sale_id, v_item.product_id, v_item.quantity, v_item.price, v_item.price * v_item.quantity);
          END LOOP;

          SELECT to_json(s.*)::jsonb INTO v_sale_record FROM public.sales s WHERE s.id = v_sale_id;
          RETURN v_sale_record;
        END;
        $body$ LANGUAGE plpgsql SECURITY DEFINER;
    ELSE
        -- VERSIÓN BIGINT/SERIAL
        CREATE OR REPLACE FUNCTION public.register_sale_v2(
          p_items JSONB,
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
          p_user_id UUID
        ) RETURNS JSONB AS $body$
        DECLARE
          v_sale_id BIGINT;
          v_item RECORD;
          v_sale_record JSONB;
        BEGIN
          INSERT INTO public.sales (subtotal, tax, total, discount, payment_method, amount_received, amount_change, branch_id, customer_id, is_credit, user_id)
          VALUES (p_subtotal, p_tax, p_total, p_discount, p_payment_method, p_amount_received, p_amount_change, p_branch_id, p_customer_id, p_is_credit, p_user_id)
          RETURNING id INTO v_sale_id;

          FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id BIGINT, quantity NUMERIC, price NUMERIC)
          LOOP
            -- Nota: Se asume que sale_items.sale_id también es BIGINT si sales.id lo es
            INSERT INTO public.sale_items (sale_id, product_id, quantity, price, total)
            VALUES (v_sale_id, v_item.product_id, v_item.quantity, v_item.price, v_item.price * v_item.quantity);
          END LOOP;

          SELECT to_json(s.*)::jsonb INTO v_sale_record FROM public.sales s WHERE s.id = v_sale_id;
          RETURN v_sale_record;
        END;
        $body$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;

END $$;

-- 4. ACTUALIZAR TRIGGERS PARA EVITAR CASTING DE UUID ERRONEO
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = NEW.sale_id;
        v_new_stock := public.update_branch_stock(NEW.product_id, v_branch_id, -NEW.quantity);
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (v_branch_id, NEW.product_id, 'VENTA', -NEW.quantity, v_new_stock, NEW.sale_id::text, 'Venta registrada');
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
