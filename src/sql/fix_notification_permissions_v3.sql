-- CORRECCIÓN ROBUSTA DE PERMISOS PARA NOTIFICACIONES
-- 1. Eliminar CUALQUIER política previa con estos nombres para evitar errores de duplicidad
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;

-- 2. Política de Lectura (SELECT)
CREATE POLICY "notifications_select_policy" 
ON public.notifications FOR SELECT 
TO authenticated
USING (
    (
        auth.uid() = user_id OR 
        branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()) OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Administrador'
    ) 
    AND (cleared_by IS NULL OR NOT (cleared_by @> ARRAY[auth.uid()]))
);

-- 3. Política de Actualización (UPDATE)
CREATE POLICY "notifications_update_policy" 
ON public.notifications FOR UPDATE 
TO authenticated
USING (
    auth.uid() = user_id OR 
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()) OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Administrador'
)
WITH CHECK (true);
