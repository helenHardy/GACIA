CREATE OR REPLACE FUNCTION public.clean_database()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id uuid;
    v_main_branch_id bigint;
BEGIN
    -- 1. Identificar registros vitales a conservar
    SELECT id INTO v_admin_id FROM public.profiles WHERE email = 'admin@gmail.com' LIMIT 1;
    SELECT id INTO v_main_branch_id FROM public.branches WHERE name = 'Casa Matriz' LIMIT 1;

    -- Si no existe Casa Matriz, tomamos la primera sucursal para no romper el sistema
    IF v_main_branch_id IS NULL THEN
        SELECT id INTO v_main_branch_id FROM public.branches ORDER BY created_at ASC, id ASC LIMIT 1;
    END IF;

    -- 2. Limpiar Tablas Operativas y de Movimientos (hijos primero)
    -- Nota: El WHERE true (no-op) es necesario porque Supabase activa pg_safeupdate,
    -- que bloquea cualquier DELETE sin cláusula WHERE, incluso dentro de funciones.
    DELETE FROM public.customer_payments WHERE true;
    DELETE FROM public.sale_items WHERE true;
    DELETE FROM public.purchase_items WHERE true;
    DELETE FROM public.transfer_items WHERE true;
    DELETE FROM public.quotation_items WHERE true;
    DELETE FROM public.kardex WHERE true;
    DELETE FROM public.inventory_movements WHERE true;
    DELETE FROM public.notifications WHERE true;
    DELETE FROM public.sales WHERE true;
    DELETE FROM public.purchases WHERE true;
    DELETE FROM public.transfers WHERE true;
    DELETE FROM public.quotations WHERE true;

    -- Las tablas debt_ledger y special_permissions solo se limpian si existen
    -- en la instalación (varía según versión instalada)
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'debt_ledger' AND n.nspname = 'public') THEN
        EXECUTE 'DELETE FROM public.debt_ledger WHERE true';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'special_permissions' AND n.nspname = 'public') THEN
        EXECUTE 'DELETE FROM public.special_permissions WHERE true';
    END IF;

    -- 3. Limpiar Catálogo e Inventario
    DELETE FROM public.product_branch_settings WHERE true;
    DELETE FROM public.products WHERE true;
    DELETE FROM public.models WHERE true;
    DELETE FROM public.brands WHERE true;
    DELETE FROM public.categories WHERE true;
    DELETE FROM public.customers WHERE true;
    DELETE FROM public.suppliers WHERE true;

    -- 4. Limpiar Usuarios Secundarios (conservando solo admin@gmail.com)
    DELETE FROM public.user_branches WHERE user_id IS DISTINCT FROM v_admin_id;
    DELETE FROM public.profiles WHERE id IS DISTINCT FROM v_admin_id OR v_admin_id IS NULL;

    -- 5. Limpiar Sucursales Secundarias (conservando solo Casa Matriz)
    DELETE FROM public.branches WHERE id IS DISTINCT FROM v_main_branch_id OR v_main_branch_id IS NULL;

    -- Nota: 'roles', 'role_permissions' y 'settings' se conservan por diseño
    -- para mantener la estructura y configuración básica del sistema.
END;
$$;

GRANT EXECUTE ON FUNCTION public.clean_database() TO authenticated;