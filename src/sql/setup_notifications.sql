-- SISTEMA DE NOTIFICACIONES EN TIEMPO REAL
-- 1. Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- Si es para un usuario específico
    branch_id bigint REFERENCES public.branches(id) ON DELETE CASCADE, -- Si es para toda una sucursal
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info', -- info, success, warning, error
    link text, -- URL para redirigir
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can see their own notifications" 
ON public.notifications FOR SELECT 
USING (
    auth.uid() = user_id OR 
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()) OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Administrador'
);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- 2. Trigger para crear notificación al CREAR un traspaso (Pendiente)
CREATE OR REPLACE FUNCTION public.notify_new_transfer()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.notifications (branch_id, title, message, type, link)
    VALUES (
        new.destination_branch_id, 
        'Nuevo Traspaso Pendiente', 
        'Se ha creado una solicitud de traspaso desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
        'info',
        '/transfers'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_new_transfer
AFTER INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_new_transfer();

-- 3. Trigger para crear notificación al ENVIAR un traspaso (Enviado)
CREATE OR REPLACE FUNCTION public.notify_sent_transfer()
RETURNS trigger AS $$
BEGIN
    IF (new.status = 'Enviado' AND old.status = 'Pendiente') THEN
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id, 
            'Traspaso en Camino', 
            'El traspaso #' || new.transfer_number || ' ha sido enviado y está en camino.',
            'warning',
            '/transfers'
        );
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_sent_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_sent_transfer();

-- 4. Habilitar Realtime para la tabla de notificaciones
ALTER publication supabase_realtime ADD TABLE public.notifications;
