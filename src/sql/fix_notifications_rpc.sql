-- SOLUCIÓN DEFINITIVA MEDIANTE FUNCIONES (RPC) PARA NOTIFICACIONES
-- 1. Crear funciones en el servidor para evitar problemas de RLS con arrays

-- Función para marcar como leído
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET read_by = array_append(COALESCE(read_by, '{}'), p_user_id)
    WHERE id = p_notification_id 
    AND NOT (COALESCE(read_by, '{}') @> ARRAY[p_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para borrar (limpiar)
CREATE OR REPLACE FUNCTION public.clear_notification(p_notification_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET cleared_by = array_append(COALESCE(cleared_by, '{}'), p_user_id)
    WHERE id = p_notification_id
    AND NOT (COALESCE(cleared_by, '{}') @> ARRAY[p_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar TODO
CREATE OR REPLACE FUNCTION public.clear_all_notifications(p_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET cleared_by = array_append(COALESCE(cleared_by, '{}'), p_user_id)
    WHERE (
        user_id = p_user_id OR 
        branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = p_user_id) OR
        (SELECT role FROM public.profiles WHERE id = p_user_id) = 'Administrador'
    )
    AND NOT (COALESCE(cleared_by, '{}') @> ARRAY[p_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Simplificar RLS solo para SELECT
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;

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
