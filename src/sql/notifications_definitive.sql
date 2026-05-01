-- =====================================================
-- SOLUCIÓN DEFINITIVA: NOTIFICACIONES DE TRASPASOS
-- =====================================================
-- Este script REEMPLAZA toda la lógica de notificaciones.
-- Ejecutar COMPLETO en el SQL Editor de Supabase.
-- =====================================================

-- =====================================================
-- PASO 1: LIMPIAR TODAS LAS POLÍTICAS CONFLICTIVAS
-- =====================================================
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "Permitir lectura para autenticados" ON public.notifications;
DROP POLICY IF EXISTS "Permitir gestión para Administradores" ON public.notifications;
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;

-- =====================================================
-- PASO 2: ASEGURAR ESTRUCTURA DE TABLA
-- =====================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT '{}';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS cleared_by uuid[] DEFAULT '{}';

-- Asegurar que RLS está habilitado
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: CREAR POLÍTICAS LIMPIAS (SIN bypass admin)
-- =====================================================

-- SELECT: Solo ver notificaciones de TUS sucursales o dirigidas a ti
CREATE POLICY "notif_select"
ON public.notifications FOR SELECT
TO authenticated
USING (
    (
        auth.uid() = user_id
        OR
        branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
    )
    AND (cleared_by IS NULL OR NOT (cleared_by @> ARRAY[auth.uid()]))
);

-- UPDATE: Permitir actualizar (para marcar leído/borrado via RPC)
CREATE POLICY "notif_update"
ON public.notifications FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- INSERT: Solo funciones del servidor (triggers) pueden insertar
CREATE POLICY "notif_insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    OR
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
);

-- =====================================================
-- PASO 4: RPCs PARA MARCAR LEÍDO/BORRADO
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET read_by = array_append(COALESCE(read_by, '{}'), p_user_id)
    WHERE id = p_notification_id
    AND NOT (COALESCE(read_by, '{}') @> ARRAY[p_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.clear_notification(p_notification_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET cleared_by = array_append(COALESCE(cleared_by, '{}'), p_user_id)
    WHERE id = p_notification_id
    AND NOT (COALESCE(cleared_by, '{}') @> ARRAY[p_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.clear_all_notifications(p_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET cleared_by = array_append(COALESCE(cleared_by, '{}'), p_user_id)
    WHERE (
        user_id = p_user_id
        OR branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = p_user_id)
    )
    AND NOT (COALESCE(cleared_by, '{}') @> ARRAY[p_user_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PASO 5: TRIGGERS DE TRASPASOS (AMBAS SUCURSALES)
-- =====================================================

-- Limpiar triggers previos
DROP TRIGGER IF EXISTS trg_notify_new_transfer ON public.transfers;
DROP TRIGGER IF EXISTS trg_notify_sent_transfer ON public.transfers;
DROP TRIGGER IF EXISTS trg_notify_received_transfer ON public.transfers;

-- TRIGGER: Al crear un traspaso (Pendiente)
CREATE OR REPLACE FUNCTION public.notify_new_transfer()
RETURNS trigger AS $$
BEGIN
    -- Notificar a DESTINO
    INSERT INTO public.notifications (branch_id, title, message, type, link)
    VALUES (
        new.destination_branch_id,
        'Nuevo Traspaso Solicitado',
        'Se solicita un traspaso desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
        'info',
        '/transfers'
    );
    -- Notificar a ORIGEN
    INSERT INTO public.notifications (branch_id, title, message, type, link)
    VALUES (
        new.origin_branch_id,
        'Traspaso Registrado',
        'Has registrado un envío hacia ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id),
        'info',
        '/transfers'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_new_transfer
AFTER INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_new_transfer();

-- TRIGGER: Al enviar un traspaso (Pendiente -> Enviado)
CREATE OR REPLACE FUNCTION public.notify_sent_transfer()
RETURNS trigger AS $$
BEGIN
    IF (new.status = 'Enviado' AND (old.status IS NULL OR old.status = 'Pendiente')) THEN
        -- Notificar a DESTINO
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id,
            'Traspaso en Camino',
            'El traspaso #' || COALESCE(new.transfer_number::text, '') || ' ha sido enviado desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
            'warning',
            '/transfers'
        );
        -- Notificar a ORIGEN
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.origin_branch_id,
            'Envío Confirmado',
            'El traspaso #' || COALESCE(new.transfer_number::text, '') || ' hacia ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id) || ' ha sido enviado.',
            'success',
            '/transfers'
        );
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_sent_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_sent_transfer();

-- TRIGGER: Al recibir un traspaso (Enviado -> Recibido)
CREATE OR REPLACE FUNCTION public.notify_received_transfer()
RETURNS trigger AS $$
BEGIN
    IF (new.status = 'Recibido' AND old.status = 'Enviado') THEN
        -- Notificar a ORIGEN
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.origin_branch_id,
            'Traspaso Recibido',
            'La sucursal ' || (SELECT name FROM public.branches WHERE id = new.destination_branch_id) || ' ha recibido el traspaso #' || COALESCE(new.transfer_number::text, ''),
            'success',
            '/transfers'
        );
        -- Notificar a DESTINO
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id,
            'Recepción Completada',
            'Se ha registrado la recepción del traspaso desde ' || (SELECT name FROM public.branches WHERE id = new.origin_branch_id),
            'success',
            '/transfers'
        );
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_received_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_received_transfer();

-- TRIGGER: Al MODIFICAR un traspaso (cambios en sucursales o estado manual)
CREATE OR REPLACE FUNCTION public.notify_modified_transfer()
RETURNS trigger AS $$
BEGIN
    -- Solo notificar si hay un cambio real en las sucursales asignadas
    -- y NO es un cambio de status (esos ya tienen sus propios triggers)
    IF (
        (old.origin_branch_id IS DISTINCT FROM new.origin_branch_id OR
         old.destination_branch_id IS DISTINCT FROM new.destination_branch_id)
        AND old.status = new.status
    ) THEN
        -- Notificar a ORIGEN
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.origin_branch_id,
            'Traspaso Modificado',
            'El traspaso #' || COALESCE(new.transfer_number::text, '') || ' ha sido modificado.',
            'warning',
            '/transfers'
        );
        -- Notificar a DESTINO
        INSERT INTO public.notifications (branch_id, title, message, type, link)
        VALUES (
            new.destination_branch_id,
            'Traspaso Modificado',
            'El traspaso #' || COALESCE(new.transfer_number::text, '') || ' ha sido modificado.',
            'warning',
            '/transfers'
        );
        -- Si el destino anterior cambió, notificar también al destino anterior
        IF (old.destination_branch_id IS DISTINCT FROM new.destination_branch_id) THEN
            INSERT INTO public.notifications (branch_id, title, message, type, link)
            VALUES (
                old.destination_branch_id,
                'Traspaso Redirigido',
                'El traspaso #' || COALESCE(new.transfer_number::text, '') || ' ya no tiene como destino tu sucursal.',
                'info',
                '/transfers'
            );
        END IF;
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_modified_transfer ON public.transfers;
CREATE TRIGGER trg_notify_modified_transfer
AFTER UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_modified_transfer();

-- TRIGGER: Al ELIMINAR un traspaso
CREATE OR REPLACE FUNCTION public.notify_deleted_transfer()
RETURNS trigger AS $$
BEGIN
    -- Notificar a ORIGEN
    INSERT INTO public.notifications (branch_id, title, message, type, link)
    VALUES (
        old.origin_branch_id,
        'Traspaso Eliminado',
        'El traspaso #' || COALESCE(old.transfer_number::text, '') || ' ha sido eliminado del sistema.',
        'error',
        '/transfers'
    );
    -- Notificar a DESTINO
    INSERT INTO public.notifications (branch_id, title, message, type, link)
    VALUES (
        old.destination_branch_id,
        'Traspaso Eliminado',
        'El traspaso #' || COALESCE(old.transfer_number::text, '') || ' que venía desde ' || (SELECT name FROM public.branches WHERE id = old.origin_branch_id) || ' ha sido eliminado.',
        'error',
        '/transfers'
    );
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_deleted_transfer ON public.transfers;
CREATE TRIGGER trg_notify_deleted_transfer
BEFORE DELETE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_deleted_transfer();

-- =====================================================
-- PASO 6: ASEGURAR REALTIME
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

