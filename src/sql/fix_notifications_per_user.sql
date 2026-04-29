-- MEJORA DEL SISTEMA DE NOTIFICACIONES: ESTADO POR USUARIO
-- 1. Modificar tabla para rastrear quién ha leído o borrado qué
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cleared_by uuid[] DEFAULT '{}';

-- 2. Actualizar políticas de RLS para filtrar por cleared_by
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
CREATE POLICY "Users can see their own notifications" 
ON public.notifications FOR SELECT 
USING (
    (
        auth.uid() = user_id OR 
        branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()) OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Administrador'
    ) AND NOT (cleared_by @> ARRAY[auth.uid()]) -- Ocultar si el usuario ya la borró
);

-- Permitir que los usuarios actualicen los arrays (para marcar como leído/borrado)
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update notifications" 
ON public.notifications FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 3. Trigger para notificar a sucursales involucradas
-- (Ya lo hacía, pero aseguramos que solo a la de destino o ambas si se prefiere)
CREATE OR REPLACE FUNCTION public.notify_sent_transfer()
RETURNS trigger AS $$
BEGIN
    IF (new.status = 'Enviado' AND (old.status IS NULL OR old.status = 'Pendiente')) THEN
        -- Notificar a la sucursal de DESTINO
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id, 
            'Traspaso en Camino', 
            'Un traspaso ha sido enviado hacia tu sucursal desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
            'warning',
            '/transfers'
        );
        
        -- OPCIONAL: Notificar también a la sucursal de ORIGEN (como confirmación)
        -- INSERT INTO public.notifications (branch_id, title, message, type, link)
        -- VALUES (new.origin_branch_id, 'Envío Confirmado', 'Has enviado con éxito el traspaso a ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id), 'success', '/transfers');
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
