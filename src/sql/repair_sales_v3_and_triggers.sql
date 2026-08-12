-- ========================================================
-- REPARACIÓN VENTAS: register_sale_v3 + TRIGGERS DE STOCK COMPLETOS
-- ========================================================
-- Qué hace:
--   1. Crea el RPC register_sale_v3 (el que llama POS.jsx:199) compatible
--      con el tipo real de sales.id (BIGINT/SERIAL o UUID).
--   2. Reinstala la versión COMPLETA de handle_sale_item_changes()
--      (INSERT valida stock, UPDATE valida aumentos, DELETE devuelve stock)
--      por si repair_sales_rpc.sql la sobrescribió con la versión de solo INSERT.
--   3. Recrea los triggers de sale_items (insert/update AFTER, delete BEFORE).
--
-- IMPORTANTE: ejecutar UNO O DOS VECES está bien (todo es idempotente).
-- NO ejecutes esto si ya existe 'register_sale_v3' y los triggers funcionan.
-- ========================================================

-- ========================================================
-- 1. RPC register_sale_v3 (misma lógica que v2, pero con el nombre
--    que el POS usa. Detecta si sales.id es UUID o BIGINT)
-- ========================================================
DO $$
DECLARE
    v_id_type text;
BEGIN
    SELECT data_type INTO v_id_type
    FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'id' AND table_schema = 'public';

    RAISE NOTICE 'Tipo detectado para sales.id: %', v_id_type;

    -- 1.5. Asegurar la columna notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'notes') THEN
        ALTER TABLE public.sales ADD COLUMN notes text;
    END IF;

    -- 2. Eliminar versiones previas de register_sale_v3 para evitar sobrecargas
    EXECUTE 'DROP FUNCTION IF EXISTS public.register_sale_v3(jsonb, numeric, numeric, numeric, numeric, text, numeric, numeric, bigint, bigint, boolean, uuid, text)';
    EXECUTE 'DROP FUNCTION IF EXISTS public.register_sale_v3(jsonb, numeric, numeric, numeric, numeric, text, numeric, numeric, uuid, uuid, boolean, uuid, text)';

    -- 3. Crear la función adaptada al tipo real de sales.id
    IF v_id_type = 'uuid' THEN
        CREATE OR REPLACE FUNCTION public.register_sale_v3(
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
          p_user_id UUID,
          p_notes TEXT DEFAULT ''
        ) RETURNS JSONB AS $body$
        DECLARE
          v_sale_id UUID;
          v_item RECORD;
          v_sale_record JSONB;
        BEGIN
          INSERT INTO public.sales (subtotal, tax, total, discount, payment_method, amount_received, amount_change, branch_id, customer_id, is_credit, user_id, notes)
          VALUES (p_subtotal, p_tax, p_total, p_discount, p_payment_method, p_amount_received, p_amount_change, p_branch_id, p_customer_id, p_is_credit, p_user_id, p_notes)
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
        CREATE OR REPLACE FUNCTION public.register_sale_v3(
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
          p_user_id UUID,
          p_notes TEXT DEFAULT ''
        ) RETURNS JSONB AS $body$
        DECLARE
          v_sale_id BIGINT;
          v_item RECORD;
          v_sale_record JSONB;
        BEGIN
          INSERT INTO public.sales (subtotal, tax, total, discount, payment_method, amount_received, amount_change, branch_id, customer_id, is_credit, user_id, notes)
          VALUES (p_subtotal, p_tax, p_total, p_discount, p_payment_method, p_amount_received, p_amount_change, p_branch_id, p_customer_id, p_is_credit, p_user_id, p_notes)
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
    END IF;
END $$;

-- ========================================================
-- 2. Versión COMPLETA de handle_sale_item_changes
--    (INSERT valida stock, UPDATE valida aumentos, DELETE devuelve stock)
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = NEW.sale_id;

        -- Validar stock antes de descontar
        SELECT stock INTO v_diff FROM public.product_branch_settings
        WHERE product_id = NEW.product_id AND branch_id = v_branch_id;

        IF coalesce(v_diff, 0) < NEW.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto %. Disponible: %, Solicitado: %',
                (SELECT name FROM public.products WHERE id = NEW.product_id),
                coalesce(v_diff, 0),
                NEW.quantity;
        END IF;

        v_new_stock := public.update_branch_stock(NEW.product_id, v_branch_id, -NEW.quantity);

        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (v_branch_id, NEW.product_id, 'VENTA', -NEW.quantity, v_new_stock, NEW.sale_id::text, 'Venta registrada #' || NEW.sale_id);

        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        v_diff := NEW.quantity - OLD.quantity;
        IF v_diff <= 0 THEN RETURN NEW; END IF;

        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = NEW.sale_id;

        -- Validar stock adicional antes de descontar
        SELECT stock INTO v_new_stock FROM public.product_branch_settings
        WHERE product_id = NEW.product_id AND branch_id = v_branch_id;

        IF coalesce(v_new_stock, 0) < v_diff THEN
            RAISE EXCEPTION 'Stock insuficiente para aumentar la cantidad del producto %. Disponible adicional: %, Solicitado adicional: %',
                (SELECT name FROM public.products WHERE id = NEW.product_id),
                coalesce(v_new_stock, 0),
                v_diff;
        END IF;

        v_new_stock := public.update_branch_stock(NEW.product_id, v_branch_id, -v_diff);

        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (v_branch_id, NEW.product_id, 'MODIFICACION_VENTA', -v_diff, v_new_stock, NEW.sale_id::text, 'Venta modificada #' || NEW.sale_id);

        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = OLD.sale_id;

        v_new_stock := public.update_branch_stock(OLD.product_id, v_branch_id, OLD.quantity);

        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (v_branch_id, OLD.product_id, 'ANULACION_VENTA', OLD.quantity, v_new_stock, OLD.sale_id::text, 'Venta anulada #' || OLD.sale_id);

        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 3. Triggers de sale_items (INSERT/UPDATE AFTER, DELETE BEFORE)
-- ========================================================
DROP TRIGGER IF EXISTS trg_kardex_sale_insert_update ON public.sale_items;
DROP TRIGGER IF EXISTS trg_kardex_sale_delete ON public.sale_items;

CREATE TRIGGER trg_kardex_sale_insert_update
AFTER INSERT OR UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

CREATE TRIGGER trg_kardex_sale_delete
BEFORE DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

-- ========================================================
-- 4. VERIFICACIÓN POST-REPARACIÓN (revisar en el Result Data)
--    Debe mostrar: register_sale_v3 y handle_sale_item_changes
-- ========================================================
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname IN ('register_sale_v3', 'handle_sale_item_changes')
ORDER BY proname;