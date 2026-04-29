-- CORRECCIÓN DEFINITIVA DE PERMISOS PARA NOTIFICACIONES
-- 1. Eliminar cualquier política anterior que pueda estar bloqueando
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;

-- 2. Política de Lectura (SELECT)
-- Un usuario puede ver la notificación si:
-- - Es el destinatario directo (user_id)
-- - Pertenece a la sucursal (branch_id)
-- - Es Administrador
-- Y SIEMPRE QUE no esté en su array de 'cleared_by'
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
-- Necesitamos permitir que CUALQUIERA que pueda ver la notificación pueda actualizar los campos read_by y cleared_by
-- Usamos USING(true) para permitir el acceso al registro y controlamos con WITH CHECK si es necesario
CREATE POLICY "notifications_update_policy" 
ON public.notifications FOR UPDATE 
TO authenticated
USING (
    auth.uid() = user_id OR 
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()) OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Administrador'
)
WITH CHECK (true);

-- 4. Asegurar que las columnas existen con los tipos correctos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read_by') THEN
        ALTER TABLE public.notifications ADD COLUMN read_by uuid[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='cleared_by') THEN
        ALTER TABLE public.notifications ADD COLUMN cleared_by uuid[] DEFAULT '{}';
    END IF;
END $$;
