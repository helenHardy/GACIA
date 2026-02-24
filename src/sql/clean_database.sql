-- Disable triggers to avoid side effects during cleanup (optional, but recommended if possible, otherwise just delete in order)
-- Since we can't easily disable triggers on Supabase without superuser, we will just delete in correct order.

-- 1. Transacciones y Permisos Temporales
-- DELETE FROM special_permissions; -- Comentado porque la tabla puede no existir aún
DELETE FROM sale_items;
DELETE FROM purchase_items;
DELETE FROM transfer_items;
DELETE FROM quotation_items;
DELETE FROM kardex;
DELETE FROM inventory_movements;
DELETE FROM customer_payments;

-- 2. Transacciones (Cabeceras)
DELETE FROM sales;
DELETE FROM purchases;
DELETE FROM transfers;
DELETE FROM quotations;

-- 3. Inventario y Relaciones
DELETE FROM product_branch_settings;
DELETE FROM products;
DELETE FROM models;
DELETE FROM brands;
DELETE FROM categories;

-- 4. Entidades
DELETE FROM customers;
DELETE FROM suppliers;

-- 5. Usuarios y Configuraciones (CUIDADO AQUÍ)
-- Eliminar asignaciones de ramas para usuarios que no sean el admin (o todos menos el ID del admin)
DELETE FROM user_branches 
WHERE user_id IN (SELECT id FROM profiles WHERE email != 'admin@gmail.com');

-- Eliminar perfiles excepto el admin
DELETE FROM profiles 
WHERE email != 'admin@gmail.com';

-- Nota: No tocamos la tabla 'branches' (Sucursales) porque suelen ser estructurales, 
-- pero si se requiere limpiar también:
-- DELETE FROM branches WHERE name != 'Matriz'; -- Ejemplo opcional

-- Nota: role_permissions se mantiene ya que es configuración del sistema.
