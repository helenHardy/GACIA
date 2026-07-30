-- FUNCIÓN PARA ELIMINAR USUARIO COMPLETO (AUTH.USERS Y PROFILES)
-- Ejecutar en el SQL Editor de Supabase

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
    -- 1. Verificar si quien ejecuta es Administrador
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Administrador'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden eliminar usuarios.';
    END IF;

    -- 2. Eliminar de public.profiles (si no cae en cascada)
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 3. Eliminar por completo de auth.users (Autenticación)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
