CREATE OR REPLACE FUNCTION clean_database()
RETURNS void AS $$
DECLARE
    v_admin_id uuid;
    v_main_branch_id bigint;
BEGIN
    -- 1. Identificar registros vitales a conservar
    SELECT id INTO v_admin_id FROM profiles WHERE email = 'admin@gmail.com' LIMIT 1;
    SELECT id INTO v_main_branch_id FROM branches WHERE name = 'Casa Matriz' LIMIT 1;

    -- Si no existe Casa Matriz (por algún motivo), tomamos la primera para no romper el sistema
    IF v_main_branch_id IS NULL THEN
        SELECT id INTO v_main_branch_id FROM branches ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 2. Limpiar Tablas Operativas y de Movimientos (Sin restricciones)
    DELETE FROM customer_payments;
    DELETE FROM sale_items;
    DELETE FROM purchase_items;
    DELETE FROM transfer_items;
    DELETE FROM quotation_items;
    DELETE FROM kardex;
    DELETE FROM inventory_movements;
    DELETE FROM sales;
    DELETE FROM purchases;
    DELETE FROM transfers;
    DELETE FROM quotations;
    DELETE FROM notifications;
    DELETE FROM debt_ledger;

    -- 3. Limpiar Catálogo e Inventario
    DELETE FROM product_branch_settings;
    DELETE FROM products;
    DELETE FROM models;
    DELETE FROM brands;
    DELETE FROM categories;
    DELETE FROM customers;
    DELETE FROM suppliers;

    -- 4. Limpiar Usuarios Secundarios
    -- Primero las asignaciones de sucursal
    DELETE FROM user_branches WHERE user_id != v_admin_id OR v_admin_id IS NULL;
    
    -- Los perfiles (excepto admin)
    DELETE FROM profiles WHERE email != 'admin@gmail.com' OR email IS NULL;

    -- 5. Limpiar Sucursales Secundarias
    -- Conservamos solo 'Casa Matriz' (o la principal identificada)
    DELETE FROM branches WHERE id != v_main_branch_id OR v_main_branch_id IS NULL;

    -- Nota: 'roles', 'role_permissions' y 'settings' se conservan por diseño 
    -- para mantener la estructura y configuración básica del sistema.

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
