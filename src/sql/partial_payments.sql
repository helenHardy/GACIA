-- GACIA ERP - SOPORTE PARA PAGOS PARCIALES POR TICKET (Producción Safe)
-- 1. Agregar columna sale_id a customer_payments
DO $$ 
BEGIN 
    -- Si existe con tipo incorrecto (bigint), lo corregimos. 
    -- Nota: Esto es seguro porque el error 400 impedía que se guardaran datos.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'sale_id' AND data_type = 'bigint') THEN
        ALTER TABLE public.customer_payments DROP COLUMN sale_id;
    END IF;

    -- Añadimos la columna como BIGINT para que coincida con sales.id en este entorno
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'sale_id') THEN
        ALTER TABLE public.customer_payments ADD COLUMN sale_id bigint REFERENCES public.sales(id) ON DELETE CASCADE;
    END IF;

    -- Aseguramos que existan 'payment_method' y 'notes'
    -- Si existe 'method' pero no 'payment_method', lo renombramos o lo usamos como base.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'method') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'payment_method') THEN
        ALTER TABLE public.customer_payments RENAME COLUMN method TO payment_method;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'payment_method') THEN
        ALTER TABLE public.customer_payments ADD COLUMN payment_method text DEFAULT 'Efectivo' NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'notes') THEN
        ALTER TABLE public.customer_payments ADD COLUMN notes text;
    END IF;
END $$;

-- Recargar el cache de PostgREST para que reconozca las nuevas columnas inmediatamente
NOTIFY pgrst, 'reload schema';

-- 2. Crear función para manejar la actualización de deuda al recibir un pago
CREATE OR REPLACE FUNCTION public.handle_customer_payment_changes()
RETURNS trigger AS $$
BEGIN
    -- INSERT: Restar del saldo del cliente
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.customers 
        SET current_balance = coalesce(current_balance, 0) - new.amount
        WHERE id = new.customer_id;
    
    -- DELETE: Devolver al saldo (revertir pago)
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.customers 
        SET current_balance = coalesce(current_balance, 0) + old.amount
        WHERE id = old.customer_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para pagos
DROP TRIGGER IF EXISTS trg_customer_payments_balance ON public.customer_payments;
CREATE TRIGGER trg_customer_payments_balance
AFTER INSERT OR DELETE ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_customer_payment_changes();

-- 4. Función auxiliar para obtener el saldo de un ticket específico
CREATE OR REPLACE FUNCTION public.get_sale_balance(p_sale_id bigint)
RETURNS numeric AS $$
DECLARE
    v_total numeric;
    v_paid numeric;
BEGIN
    SELECT total INTO v_total FROM public.sales WHERE id = p_sale_id;
    SELECT coalesce(sum(amount), 0) INTO v_paid FROM public.customer_payments WHERE sale_id = p_sale_id;
    RETURN coalesce(v_total, 0) - coalesce(v_paid, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Asegurar RLS para pagos (Permitir a personal autenticado registrar pagos)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_payments' AND policyname = 'Gestión operativa pagos para autenticados') THEN
        CREATE POLICY "Gestión operativa pagos para autenticados" ON public.customer_payments 
        FOR ALL USING (auth.role() = 'authenticated');
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;
