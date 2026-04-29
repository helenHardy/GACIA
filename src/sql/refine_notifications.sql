-- REFINAMIENTO DE NOTIFICACIONES DE TRASPASOS
-- 1. Eliminar trigger que notifica al crear (solo queremos al enviar)
DROP TRIGGER IF EXISTS trg_notify_new_transfer ON public.transfers;
DROP FUNCTION IF EXISTS public.notify_new_transfer();

-- 2. Asegurar que la notificación solo se cree al pasar a 'Enviado'
CREATE OR REPLACE FUNCTION public.notify_sent_transfer()
RETURNS trigger AS $$
BEGIN
    -- Solo notificar cuando el estado cambia de 'Pendiente' a 'Enviado'
    IF (new.status = 'Enviado' AND (old.status IS NULL OR old.status = 'Pendiente')) THEN
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id, 
            'Traspaso en Camino', 
            'Se ha enviado un traspaso desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id) || '. Por favor, confirma la recepción al llegar.',
            'warning',
            '/transfers'
        );
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-instalar trigger de envío
DROP TRIGGER IF EXISTS trg_notify_sent_transfer ON public.transfers;
CREATE TRIGGER trg_notify_sent_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_sent_transfer();
