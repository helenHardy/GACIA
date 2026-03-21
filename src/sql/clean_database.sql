CREATE OR REPLACE FUNCTION clean_database()
RETURNS void AS $$
BEGIN
    -- 1. Tablas de dependencias de segundo nivel (Pagos, Items)
    DELETE FROM customer_payments WHERE true;
    DELETE FROM sale_items WHERE true;
    DELETE FROM purchase_items WHERE true;
    DELETE FROM transfer_items WHERE true;
    DELETE FROM quotation_items WHERE true;

    -- 2. Historial e Inventario
    DELETE FROM kardex WHERE true;
    DELETE FROM inventory_movements WHERE true;

    -- 3. Transacciones (Cabeceras)
    DELETE FROM sales WHERE true;
    DELETE FROM purchases WHERE true;
    DELETE FROM transfers WHERE true;
    DELETE FROM quotations WHERE true;

    -- 4. Configuraciones de Producto por Sucursal
    DELETE FROM product_branch_settings WHERE true;

    -- 5. Catálogo Base (Productos y Entidades)
    DELETE FROM products WHERE true;
    DELETE FROM models WHERE true;
    DELETE FROM brands WHERE true;
    DELETE FROM categories WHERE true;
    DELETE FROM customers WHERE true;
    DELETE FROM suppliers WHERE true;

    -- 6. Usuarios y Estructura
    DELETE FROM user_branches 
    WHERE user_id IN (SELECT id FROM profiles WHERE email != 'admin@gmail.com');

    DELETE FROM profiles 
    WHERE email != 'admin@gmail.com';

    -- NOTA: Se conservan 'branches', 'roles', 'role_permissions' y 'settings' 
    -- para que el sistema siga operativo para el administrador.

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
