-- REFINAMIENTO DE NOTIFICACIONES PARA TRASPASOS Y SEGURIDAD POR SUCURSAL

-- 1. Actualizar Política de RLS para Notificaciones
-- Eliminamos el bypass de Administrador para que incluso ellos solo vean lo de sus sucursales asignadas
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
CREATE POLICY "Users can see their own notifications" 
ON public.notifications FOR SELECT 
USING (
    (
        auth.uid() = user_id OR 
        branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
    ) AND NOT (cleared_by @> ARRAY[auth.uid()])
);

-- 2. Trigger para Notificar a AMBAS sucursales al CREAR un traspaso (Pendiente)
CREATE OR REPLACE FUNCTION public.notify_new_transfer()
RETURNS trigger AS $$
BEGIN
    -- Notificar a la sucursal de DESTINO (Que recibirá la mercadería)
    INSERT INTO public.notifications (branch_id, title, message, type, link)
    VALUES (
        new.destination_branch_id, 
        'Nuevo Traspaso Solicitado', 
        'Se ha solicitado un traspaso hacia tu sucursal desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
        'info',
        '/transfers'
    );

    -- Notificar a la sucursal de ORIGEN (Que enviará la mercadería)
    INSERT INTO public.notifications (branch_id, title, message, type, link)
    VALUES (
        new.origin_branch_id, 
        'Traspaso Registrado', 
        'Has registrado una salida de mercadería hacia ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id),
        'info',
        '/transfers'
    );
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para Notificar a AMBAS sucursales al ENVIAR un traspaso
CREATE OR REPLACE FUNCTION public.notify_sent_transfer()
RETURNS trigger AS $$
BEGIN
    IF (new.status = 'Enviado' AND (old.status IS NULL OR old.status = 'Pendiente')) THEN
        -- Notificar a la sucursal de DESTINO (Para que sepa que viene en camino)
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id, 
            'Traspaso en Camino 🚚', 
            'El traspaso #' || COALESCE(new.transfer_number::text, '') || ' ya ha sido enviado desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
            'warning',
            '/transfers'
        );
        
        -- Notificar a la sucursal de ORIGEN (Confirmación de envío)
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.origin_branch_id, 
            'Envío Confirmado ✅', 
            'El traspaso #' || COALESCE(new.transfer_number::text, '') || ' hacia ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id) || ' ha sido marcado como enviado.',
            'success',
            '/transfers'
        );
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para Notificar cuando un traspaso es FINALIZADO/RECIBIDO
CREATE OR REPLACE FUNCTION public.notify_received_transfer()
RETURNS trigger AS $$
BEGIN
    IF (new.status = 'Recibido' AND old.status = 'Enviado') THEN
        -- Notificar a la sucursal de ORIGEN (Para que sepan que llegó bien)
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.origin_branch_id, 
            'Traspaso Recibido 📦', 
            'La sucursal ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id) || ' ha recibido correctamente el traspaso.',
            'success',
            '/transfers'
        );
        
        -- Notificar a la sucursal de DESTINO (Confirmación de recepción en sistema)
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id, 
            'Recepción Completada ✅', 
            'Se ha procesado la entrada de mercadería del traspaso proveniente de ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
            'success',
            '/transfers'
        );
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar que los triggers existan
DROP TRIGGER IF EXISTS trg_notify_received_transfer ON public.transfers;
CREATE TRIGGER trg_notify_received_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_received_transfer();
