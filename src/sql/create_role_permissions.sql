-- SISTEMA DE ROLES Y PERMISOS DE MENÚ
-- Permite crear roles personalizados y administrar sus accesos desde la interfaz.

-- 1. TABLA DE ROLES
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. TABLA DE PERMISOS DE MENÚ
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    role_name text NOT NULL, -- Se vincula por nombre para compatibilidad con profiles.role actual
    menu_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(role_name, menu_key)
);

-- Habilitar RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Lectura para autenticados" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Gestión para Administradores" ON public.roles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrador')
);

CREATE POLICY "Lectura para autenticados" ON public.role_permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Gestión para Administradores" ON public.role_permissions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrador')
);

-- DATOS INICIALES
INSERT INTO public.roles (name, description) VALUES
('Administrador', 'Acceso total a todas las funciones y configuraciones del sistema.'),
('Empleado', 'Gestión operativa de inventario, compras, proveedores y ventas.'),
('Cajero', 'Acceso enfocado exclusivamente a punto de venta, clientes y cobros.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_name, menu_key) VALUES
('Administrador', 'dashboard'), ('Administrador', 'pos'), ('Administrador', 'sales'), ('Administrador', 'quotations'),
('Administrador', 'inventory'), ('Administrador', 'branches'), ('Administrador', 'suppliers'), ('Administrador', 'purchases'),
('Administrador', 'transfers'), ('Administrador', 'reports'), ('Administrador', 'customers'), ('Administrador', 'users'),
('Administrador', 'classifications'), ('Administrador', 'settings'),

('Empleado', 'dashboard'), ('Empleado', 'pos'), ('Empleado', 'sales'), ('Empleado', 'quotations'),
('Empleado', 'inventory'), ('Empleado', 'suppliers'), ('Empleado', 'purchases'), ('Empleado', 'transfers'),
('Empleado', 'reports'), ('Empleado', 'customers'), ('Empleado', 'classifications'),

('Cajero', 'dashboard'), ('Cajero', 'pos'), ('Cajero', 'sales'), ('Cajero', 'quotations'), ('Cajero', 'customers')
ON CONFLICT (role_name, menu_key) DO NOTHING;

-- 3. TABLA DE PERMISOS ESPECIALES (PARA REGISTROS ESPECÍFICOS)
-- Permite que un usuario no-administrador modifique o elimine un registro concreto.
CREATE TABLE IF NOT EXISTS public.special_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    resource_type text NOT NULL, -- 'sale', 'purchase', 'transfer'
    resource_id uuid NOT NULL,    -- ID único del registro
    action text NOT NULL,        -- 'modify', 'delete'
    granted_by uuid REFERENCES auth.users(id),
    expires_at timestamp with time zone DEFAULT (now() + interval '24 hours'),
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.special_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Lectura propia para usuarios" ON public.special_permissions FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrador'));
CREATE POLICY "Gestión para Administradores" ON public.special_permissions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrador')
);
