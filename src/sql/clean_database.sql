CREATE OR REPLACE FUNCTION clean_database()
RETURNS void AS $$
BEGIN
    -- 1. Tablas de dependencias de segundo nivel (Pagos, Items)
    DELETE FROM customer_payments;
    DELETE FROM sale_items;
    DELETE FROM purchase_items;
    DELETE FROM transfer_items;
    DELETE FROM quotation_items;

    -- 2. Historial e Inventario
    DELETE FROM kardex;
    DELETE FROM inventory_movements;
    DELETE FROM inventory_logs; -- Asegurar si existe

    -- 3. Transacciones (Cabeceras)
    DELETE FROM sales;
    DELETE FROM purchases;
    DELETE FROM transfers;
    DELETE FROM quotations;

    -- 4. Configuraciones de Producto por Sucursal
    DELETE FROM product_branch_settings;

    -- 5. Catálogo Base (Productos y Entidades)
    DELETE FROM products;
    DELETE FROM models;
    DELETE FROM brands;
    DELETE FROM categories;
    DELETE FROM customers;
    DELETE FROM suppliers;

    -- 6. Usuarios y Sucursales Secundarias
    DELETE FROM user_branches 
    WHERE user_id IN (SELECT id FROM profiles WHERE email != 'admin@gmail.com')
       OR branch_id NOT IN (SELECT id FROM branches WHERE LOWER(name) LIKE '%casa matriz%');

    DELETE FROM profiles 
    WHERE email != 'admin@gmail.com';

    DELETE FROM branches
    WHERE LOWER(name) NOT LIKE '%casa matriz%';

    -- NOTA: Se conservan la sucursal 'Casa Matriz', 'roles', 'role_permissions' y 'settings' 
    -- para que el sistema siga operativo para el administrador.

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
