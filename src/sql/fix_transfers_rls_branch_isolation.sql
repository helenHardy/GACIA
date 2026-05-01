-- =====================================================
-- CORRECCIÓN CRÍTICA: AISLAMIENTO DE TRASPASOS POR SUCURSAL
-- =====================================================
-- Problema: La política genérica "Permitir lectura para autenticados"
-- permite que CUALQUIER usuario autenticado vea TODOS los traspasos,
-- incluso los de sucursales que no le pertenecen.
--
-- Solución: Reemplazar esa política con una que solo permita ver
-- traspasos donde el origin_branch_id O destination_branch_id
-- esté en la lista de sucursales asignadas al usuario.
-- =====================================================

-- 1. Eliminar políticas genéricas existentes de la tabla transfers
DROP POLICY IF EXISTS "Permitir lectura para autenticados" ON public.transfers;
DROP POLICY IF EXISTS "Permitir gestión para Administradores" ON public.transfers;

-- 2. Crear política estricta: Solo ver traspasos de TUS sucursales
CREATE POLICY "Usuarios ven traspasos de sus sucursales"
ON public.transfers FOR SELECT
USING (
    origin_branch_id IN (
        SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
    )
    OR
    destination_branch_id IN (
        SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
    )
);

-- 3. Política de gestión: Solo pueden modificar traspasos de sus sucursales
CREATE POLICY "Usuarios gestionan traspasos de sus sucursales"
ON public.transfers FOR ALL
USING (
    origin_branch_id IN (
        SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
    )
    OR
    destination_branch_id IN (
        SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
    )
);

-- 4. Hacer lo mismo para transfer_items (los ítems del traspaso)
DROP POLICY IF EXISTS "Permitir lectura para autenticados" ON public.transfer_items;
DROP POLICY IF EXISTS "Permitir gestión para Administradores" ON public.transfer_items;

CREATE POLICY "Usuarios ven items de traspasos de sus sucursales"
ON public.transfer_items FOR SELECT
USING (
    transfer_id IN (
        SELECT t.id FROM public.transfers t
        WHERE t.origin_branch_id IN (
            SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
        )
        OR t.destination_branch_id IN (
            SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Usuarios gestionan items de traspasos de sus sucursales"
ON public.transfer_items FOR ALL
USING (
    transfer_id IN (
        SELECT t.id FROM public.transfers t
        WHERE t.origin_branch_id IN (
            SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
        )
        OR t.destination_branch_id IN (
            SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
        )
    )
);
