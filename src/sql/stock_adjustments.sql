-- ============================================================
-- AJUSTES DE STOCK — Módulo profesional (producción)
-- ============================================================
-- Flujo:  create (PENDIENTE) → approve (aplica stock + kardex)
--                          └→ reject / cancel
--
-- Reglas:
--   * Individual: 1 ajuste = 1 producto
--   * Solo Administrador crea/aprueba/rechaza/cancela
--   * El stock NUNCA se escribe desde el frontend:
--     solo vía update_branch_stock() dentro de approve_stock_adjustment()
--   * Aprobación atómica: stock + kardex + estado en una sola transacción
--   * Script idempotente: re-ejecutable sin romper nada
--
-- Requiere (ya existente en el esquema):
--   public.update_branch_stock()  — kardex_triggers.sql
--   public.profiles(role)         — full_schema.sql
--   public.user_branches          — user_branches_migration.sql
--
-- ROLLBACK manual (si se requiere revertir TODO este módulo):
--   DROP POLICY IF EXISTS "Leer ajustes de stock de mis sucursales" ON public.stock_adjustments;
--   DROP POLICY IF EXISTS "Solo Administradores gestionan ajustes de stock" ON public.stock_adjustments;
--   DROP TABLE IF EXISTS public.stock_adjustments;
--   DROP SEQUENCE IF EXISTS public.stock_adjustments_folio_seq;
--   DROP FUNCTION IF EXISTS public.create_stock_adjustment(bigint, bigint, text, text, text, numeric, numeric, text);
--   DROP FUNCTION IF EXISTS public.approve_stock_adjustment(uuid);
--   DROP FUNCTION IF EXISTS public.reject_stock_adjustment(uuid, text);
--   DROP FUNCTION IF EXISTS public.cancel_stock_adjustment(uuid);
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABLA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    folio               text NOT NULL UNIQUE,
    branch_id           bigint NOT NULL REFERENCES public.branches(id),
    product_id          bigint NOT NULL REFERENCES public.products(id),

    adjustment_type     text NOT NULL CHECK (adjustment_type IN ('INCREMENTO', 'DECREMENTO', 'RECALIBRACION')),
    reason              text NOT NULL CHECK (reason IN (
                            'CONTEO_FISICO', 'MERMA', 'DANO', 'ROBO_PERDIDA',
                            'VENCIMIENTO', 'ERROR_CAPTURA', 'OTRO'
                        )),
    reason_detail       text,

    previous_stock      numeric NOT NULL DEFAULT 0,
    counted_stock       numeric CHECK (counted_stock IS NULL OR counted_stock >= 0),
    quantity_change     numeric NOT NULL DEFAULT 0,
    notes               text,

    status              text NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (status IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO')),

    requested_by        uuid NOT NULL,
    requested_at        timestamptz NOT NULL DEFAULT now(),

    approved_by         uuid,
    approved_at         timestamptz,

    rejected_by         uuid,
    rejected_at         timestamptz,
    rejection_reason    text,

    cancelled_by        uuid,
    cancelled_at        timestamptz,

    kardex_id           uuid REFERENCES public.kardex(id),

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_adjustments IS
    'Ajustes de stock individuales con flujo de aprobación (PENDIENTE → APROBADO/RECHAZADO/CANCELADO).';

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_branch_status
    ON public.stock_adjustments (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product
    ON public.stock_adjustments (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_requested_by
    ON public.stock_adjustments (requested_by);

-- updated_at automático (idempotente)
CREATE OR REPLACE FUNCTION public.set_stock_adjustments_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_adjustments_updated_at ON public.stock_adjustments;
CREATE TRIGGER trg_stock_adjustments_updated_at
    BEFORE UPDATE ON public.stock_adjustments
    FOR EACH ROW EXECUTE FUNCTION public.set_stock_adjustments_updated_at();


-- ------------------------------------------------------------
-- 2. SECUENCIA DE FOLIOS (AJT-000001, AJT-000002, ...)
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.stock_adjustments_folio_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;


-- ------------------------------------------------------------
-- 3. RLS
--    - Lectura: sucursales asignadas al usuario (o Admin ve las suyas)
--    - Escritura directa: PROHIBIDA (solo RPC SECURITY DEFINER)
-- ------------------------------------------------------------
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leer ajustes de stock de mis sucursales" ON public.stock_adjustments;
CREATE POLICY "Leer ajustes de stock de mis sucursales"
    ON public.stock_adjustments FOR SELECT
    TO authenticated
    USING (
        branch_id IN (
            SELECT ub.branch_id FROM public.user_branches ub WHERE ub.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'Administrador'
        )
    );

-- Sin política INSERT/UPDATE/DELETE → los clientes no pueden escribir directo.
-- Solo las funciones SECURITY DEFINER de este archivo modifican la tabla.


-- ------------------------------------------------------------
-- 4. VALIDACIONES AUXILIARES (SECURITY DEFINER)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_admin_stock_adjustment()
RETURNS void AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sesión no válida para realizar ajustes de stock.';
    END IF;

    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role IS DISTINCT FROM 'Administrador' THEN
        RAISE EXCEPTION 'Solo los Administradores pueden gestionar ajustes de inventario.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.assert_user_branch_access(p_branch_id bigint)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_branches
        WHERE user_id = auth.uid() AND branch_id = p_branch_id
    ) THEN
        RAISE EXCEPTION 'No tiene acceso a la sucursal indicada para ajustes de stock.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- 5. RPC: CREAR AJUSTE (queda PENDIENTE, no toca stock)
-- ------------------------------------------------------------
-- p_adjustment_type : INCREMENTO | DECREMENTO | RECALIBRACION
-- p_reason          : CONTEO_FISICO | MERMA | DANO | ROBO_PERDIDA |
--                     VENCIMIENTO | ERROR_CAPTURA | OTRO
-- p_quantity        : solo INCREMENTO/DECREMENTO (unidad absoluta > 0)
-- p_counted_stock   : solo RECALIBRACION (>= 0)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_adjustment(
    p_branch_id         bigint,
    p_product_id        bigint,
    p_adjustment_type   text,
    p_reason            text,
    p_reason_detail     text,
    p_quantity          numeric,
    p_counted_stock     numeric,
    p_notes             text
) RETURNS public.stock_adjustments AS $$
DECLARE
    v_adjustment        public.stock_adjustments%ROWTYPE;
    v_product_name      text;
    v_previous_stock    numeric := 0;
    v_quantity_change   numeric := 0;
    v_folio             text;
BEGIN
    PERFORM public.assert_admin_stock_adjustment();
    PERFORM public.assert_user_branch_access(p_branch_id);

    IF p_adjustment_type NOT IN ('INCREMENTO', 'DECREMENTO', 'RECALIBRACION') THEN
        RAISE EXCEPTION 'Tipo de ajuste no válido: %', p_adjustment_type;
    END IF;

    IF p_reason NOT IN ('CONTEO_FISICO', 'MERMA', 'DANO', 'ROBO_PERDIDA',
                        'VENCIMIENTO', 'ERROR_CAPTURA', 'OTRO') THEN
        RAISE EXCEPTION 'Motivo de ajuste no válido: %', p_reason;
    END IF;

    IF p_reason = 'OTRO' AND (p_reason_detail IS NULL OR btrim(p_reason_detail) = '') THEN
        RAISE EXCEPTION 'Debe especificar el detalle del motivo cuando el motivo es "Otro".';
    END IF;

    SELECT name INTO v_product_name
    FROM public.products
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado (id %).', p_product_id;
    END IF;

    -- Snapshot del stock actual en la sucursal (fila bloqueada durante la transacción)
    SELECT coalesce(stock, 0) INTO v_previous_stock
    FROM public.product_branch_settings
    WHERE product_id = p_product_id AND branch_id = p_branch_id
    FOR UPDATE;

    IF v_previous_stock IS NULL THEN
        v_previous_stock := 0;
    END IF;

    -- Calcular el delta según el tipo
    IF p_adjustment_type = 'INCREMENTO' THEN
        IF p_quantity IS NULL OR p_quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad del incremento debe ser mayor a cero.';
        END IF;
        v_quantity_change := abs(p_quantity);

    ELSIF p_adjustment_type = 'DECREMENTO' THEN
        IF p_quantity IS NULL OR p_quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad del decremento debe ser mayor a cero.';
        END IF;
        v_quantity_change := -abs(p_quantity);

    ELSIF p_adjustment_type = 'RECALIBRACION' THEN
        IF p_counted_stock IS NULL OR p_counted_stock < 0 THEN
            RAISE EXCEPTION 'El stock contado físicamente no puede ser negativo.';
        END IF;
        v_quantity_change := p_counted_stock - v_previous_stock;
    END IF;

    IF v_quantity_change = 0 THEN
        RAISE EXCEPTION 'El ajuste no genera ningún cambio de stock (delta = 0).';
    END IF;

    IF (v_previous_stock + v_quantity_change) < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %. Disponible: %, Ajuste: %',
            v_product_name, v_previous_stock, v_quantity_change;
    END IF;

    v_folio := 'AJT-' || lpad(nextval('public.stock_adjustments_folio_seq')::text, 6, '0');

    INSERT INTO public.stock_adjustments (
        folio, branch_id, product_id,
        adjustment_type, reason, reason_detail,
        previous_stock, counted_stock, quantity_change, notes,
        status, requested_by
    ) VALUES (
        v_folio, p_branch_id, p_product_id,
        p_adjustment_type, p_reason,
        CASE WHEN btrim(coalesce(p_reason_detail, '')) = '' THEN NULL ELSE btrim(p_reason_detail) END,
        v_previous_stock,
        CASE WHEN p_adjustment_type = 'RECALIBRACION' THEN p_counted_stock ELSE NULL END,
        v_quantity_change,
        nullif(btrim(coalesce(p_notes, '')), ''),
        'PENDIENTE', auth.uid()
    )
    RETURNING * INTO v_adjustment;

    RETURN v_adjustment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_stock_adjustment(bigint, bigint, text, text, text, numeric, numeric, text)
    TO authenticated;


-- ------------------------------------------------------------
-- 6. RPC: APROBAR AJUSTE (aplica stock + kardex, atómico)
-- ------------------------------------------------------------
-- Revalida el stock al momento de aprobar (puede haber cambiado
-- desde la creación). En RECALIBRACION recalcula el delta contra
-- el stock vigente; en INCREMENTO/DECREMENTO aplica el delta fijo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_stock_adjustment(
    p_adjustment_id uuid
) RETURNS public.stock_adjustments AS $$
DECLARE
    v_adjustment        public.stock_adjustments%ROWTYPE;
    v_current_stock     numeric := 0;
    v_applied_delta     numeric;
    v_kardex_type       text;
    v_kardex_id         uuid;
    v_product_name      text;
    v_new_stock         numeric;
BEGIN
    PERFORM public.assert_admin_stock_adjustment();

    -- Bloquear la fila del ajuste para evitar doble aprobación concurrente
    SELECT * INTO v_adjustment
    FROM public.stock_adjustments
    WHERE id = p_adjustment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ajuste de stock no encontrado.';
    END IF;

    IF v_adjustment.status <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'Solo se pueden aprobar ajustes en estado PENDIENTE (estado actual: %).',
            v_adjustment.status;
    END IF;

    PERFORM public.assert_user_branch_access(v_adjustment.branch_id);

    -- Stock vigente al momento de aprobar
    SELECT coalesce(stock, 0) INTO v_current_stock
    FROM public.product_branch_settings
    WHERE product_id = v_adjustment.product_id
      AND branch_id = v_adjustment.branch_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
        v_current_stock := 0;
    END IF;

    -- Delta efectivo a aplicar
    IF v_adjustment.adjustment_type = 'RECALIBRACION' THEN
        IF v_adjustment.counted_stock IS NULL THEN
            RAISE EXCEPTION 'La recalibración no tiene stock contado registrado.';
        END IF;
        v_applied_delta := v_adjustment.counted_stock - v_current_stock;
    ELSE
        v_applied_delta := v_adjustment.quantity_change;
    END IF;

    IF v_applied_delta = 0 THEN
        RAISE EXCEPTION 'El ajuste ya no genera cambios de stock (delta = 0). Stock actual: %.',
            v_current_stock;
    END IF;

    IF (v_current_stock + v_applied_delta) < 0 THEN
        SELECT name INTO v_product_name FROM public.products WHERE id = v_adjustment.product_id;
        RAISE EXCEPTION 'Stock insuficiente para el producto %. Disponible: %, Ajuste: %',
            coalesce(v_product_name, v_adjustment.product_id::text), v_current_stock, v_applied_delta;
    END IF;

    -- 1) Aplicar stock (evita log automático AJUSTE_MANUAL vía app.internal_stock_update)
    v_new_stock := public.update_branch_stock(
        v_adjustment.product_id,
        v_adjustment.branch_id,
        v_applied_delta
    );

    -- 2) Kardex de auditoría con referencia al folio
    IF v_adjustment.adjustment_type = 'INCREMENTO' THEN
        v_kardex_type := 'AJUSTE_INCREMENTO';
    ELSIF v_adjustment.adjustment_type = 'DECREMENTO' THEN
        v_kardex_type := 'AJUSTE_DECREMENTO';
    ELSE
        v_kardex_type := 'AJUSTE_RECALIBRACION';
    END IF;

    INSERT INTO public.kardex (
        branch_id, product_id, type, quantity, balance_after, reference_id, notes
    ) VALUES (
        v_adjustment.branch_id,
        v_adjustment.product_id,
        v_kardex_type,
        v_applied_delta,
        v_new_stock,
        v_adjustment.folio,
        'Ajuste ' || v_adjustment.folio || ' (' || v_adjustment.adjustment_type || ', motivo: ' || v_adjustment.reason ||
            CASE WHEN v_adjustment.reason_detail IS NOT NULL THEN ' - ' || v_adjustment.reason_detail ELSE '' END ||
            CASE WHEN v_adjustment.notes IS NOT NULL THEN ' | ' || v_adjustment.notes ELSE '' END || ')'
    )
    RETURNING id INTO v_kardex_id;

    -- 3) Marcar aprobado + auditar (delta efectivo aplicado)
    UPDATE public.stock_adjustments
    SET status          = 'APROBADO',
        approved_by     = auth.uid(),
        approved_at     = now(),
        quantity_change = v_applied_delta,
        kardex_id       = v_kardex_id,
        previous_stock  = v_current_stock
    WHERE id = p_adjustment_id
    RETURNING * INTO v_adjustment;

    RETURN v_adjustment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.approve_stock_adjustment(uuid) TO authenticated;


-- ------------------------------------------------------------
-- 7. RPC: RECHAZAR AJUSTE (no toca stock)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_stock_adjustment(
    p_adjustment_id    uuid,
    p_rejection_reason text
) RETURNS public.stock_adjustments AS $$
DECLARE
    v_adjustment public.stock_adjustments%ROWTYPE;
BEGIN
    PERFORM public.assert_admin_stock_adjustment();

    IF p_rejection_reason IS NULL OR btrim(p_rejection_reason) = '' THEN
        RAISE EXCEPTION 'Debe indicar el motivo del rechazo.';
    END IF;

    SELECT * INTO v_adjustment
    FROM public.stock_adjustments
    WHERE id = p_adjustment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ajuste de stock no encontrado.';
    END IF;

    IF v_adjustment.status <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'Solo se pueden rechazar ajustes en estado PENDIENTE (estado actual: %).',
            v_adjustment.status;
    END IF;

    PERFORM public.assert_user_branch_access(v_adjustment.branch_id);

    UPDATE public.stock_adjustments
    SET status           = 'RECHAZADO',
        rejected_by      = auth.uid(),
        rejected_at      = now(),
        rejection_reason = btrim(p_rejection_reason)
    WHERE id = p_adjustment_id
    RETURNING * INTO v_adjustment;

    RETURN v_adjustment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reject_stock_adjustment(uuid, text) TO authenticated;


-- ------------------------------------------------------------
-- 8. RPC: CANCELAR AJUSTE (solo PENDIENTE, no toca stock)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_stock_adjustment(
    p_adjustment_id uuid
) RETURNS public.stock_adjustments AS $$
DECLARE
    v_adjustment public.stock_adjustments%ROWTYPE;
BEGIN
    PERFORM public.assert_admin_stock_adjustment();

    SELECT * INTO v_adjustment
    FROM public.stock_adjustments
    WHERE id = p_adjustment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ajuste de stock no encontrado.';
    END IF;

    IF v_adjustment.status <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'Solo se pueden cancelar ajustes en estado PENDIENTE (estado actual: %).',
            v_adjustment.status;
    END IF;

    PERFORM public.assert_user_branch_access(v_adjustment.branch_id);

    UPDATE public.stock_adjustments
    SET status       = 'CANCELADO',
        cancelled_by = auth.uid(),
        cancelled_at = now()
    WHERE id = p_adjustment_id
    RETURNING * INTO v_adjustment;

    RETURN v_adjustment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cancel_stock_adjustment(uuid) TO authenticated;


-- ------------------------------------------------------------
-- 9. VERIFICACIÓN POST-EJECUCIÓN (ejecutar en Query Tool)
-- ------------------------------------------------------------
-- \d public.stock_adjustments
-- SELECT proname, prosecdef FROM pg_proc
--  WHERE proname IN ('create_stock_adjustment','approve_stock_adjustment',
--                    'reject_stock_adjustment','cancel_stock_adjustment');
-- SELECT polname FROM pg_policies WHERE tablename = 'stock_adjustments';
--
-- Prueba de humo (en sesión de Administrador):
--   1) SELECT public.create_stock_adjustment(
--          <branch_id>, <product_id>, 'INCREMENTO', 'CONTEO_FISICO', NULL, 5, NULL, 'prueba');
--   2) SELECT public.approve_stock_adjustment('<uuid>');
--   3) Verificar kardex: SELECT * FROM public.kardex
--       WHERE reference_id LIKE 'AJT-%' ORDER BY created_at DESC LIMIT 5;
--   4) Verificar stock: SELECT * FROM public.product_branch_settings
--       WHERE product_id = <product_id> AND branch_id = <branch_id>;
-- ------------------------------------------------------------
