# Manual de Usuario - Gacia ERP

Bienvenido a **Gacia ERP**, su sistema integral para la gestión de inventarios y puntos de venta. Esta guía le ayudará a configurar y operar el sistema desde cero.

---

## 1. Configuración Inicial
Antes de comenzar a vender, es necesario configurar los datos maestros del sistema.

### 1.1. Sucursales
Vaya al menú **Sucursales** para configurar sus puntos de venta.
*   **Crear Sucursal**: Haga clic en "Nueva Sucursal". Ingrese el nombre, dirección y teléfono.
*   **Logo**: Puede subir un logo específico para cada sucursal, que aparecerá en el menú lateral de los usuarios asignados.
*   **Nota**: La sucursal "Matriz" suele venir por defecto.

### 1.2. Usuarios y Permisos
Vaya al menú **Usuarios** (visible solo para Administradores).
*   **Nuevo Usuario**: Registre el correo, contraseña y nombre del personal.
*   **Roles**:
    *   **Administrador**: Acceso total.
    *   **Empleado**: Acceso a ventas, compras e inventario, pero restringido en configuraciones.
    *   **Cajero**: Acceso limitado principalmente al POS.
*   **Asignar Sucursal**: Es crucial vincular al usuario con una o más sucursales para que pueda operar en ellas.

---

## 2. Gestión de Inventario
El corazón del sistema. Antes de vender, debe tener productos.

### 2.1. Proveedores
Registre a sus proveedores en el menú **Proveedores**. Esto es necesario para registrar compras.

### 2.2. Productos
Vaya a **Inventario**.
*   **Categorías y Marcas**: Cree estas clasificaciones primero para organizar su catálogo.
*   **Nuevo Producto**: Registre el nombre, SKU (código único), precio de venta y costo.
    *   *Stock Inicial*: Puede definir un stock de arranque, pero lo ideal es ingresarlo mediante "Compras".

### 2.3. Compras (Ingreso de Mercadería)
Para aumentar el stock de manera correcta:
1.  Vaya a **Compras** > **Nueva Compra**.
2.  Seleccione el **Proveedor** y la **Sucursal de destino**.
3.  Agregue los productos y cantidades.
    *   **Unidades y Cajas**: Puede ingresar productos por unidad suelta o por cajas (definiendo cuántas unidades trae la caja).
4.  Al guardar, el stock se sumará automáticamente a la sucursal seleccionada.

### 2.4. Traspasos
Para mover mercadería entre sucursales:
1.  Vaya a **Traspasos** > **Nuevo Traspaso**.
2.  Seleccione **Origen** (de donde sale) y **Destino** (a donde llega).
3.  Seleccione los productos. El sistema validará que haya stock suficiente en el origen.

---

## 3. Ventas y Punto de Venta (POS)

### 3.1. Operar el POS
El módulo **Punto de Venta** es donde ocurren las transacciones diarias.
1.  **Seleccionar Sucursal**: Si tiene acceso a varias, elija en cuál está vendiendo.
2.  **Buscar Productos**: Use el buscador o navegue por categorías.
3.  **Carrito**: Los ítems se suman a la derecha. Puede ajustar cantidades.
4.  **Cobrar**:
    *   Seleccione el cliente (o "Público General").
    *   Elija método de pago (Efectivo, Tarjeta, QR, Transferencia).
    *   Si es crédito, marque la opción correspondiente.
5.  **Ticket**: Al finalizar, se generará un comprobante que puede imprimir.

### 3.2. Historial de Ventas
En **Historial Ventas** puede ver todas las transacciones, reimprimir tickets o anular ventas (requiere permisos de Administrador o especiales).

### 3.3. Cotizaciones
Puede crear proformas en el menú **Cotizaciones**. Estas no descuentan stock hasta que se convierten en una venta real.

---

## 4. Reportes y Consultas
El módulo **Reportes** le ofrece visión estratégica:
*   **Ventas**: Resumen por día, mes o año.
*   **Mejores Productos**: Qué ítems se venden más.
*   **Inventario Valorado**: Cuánto dinero tiene invertido en mercadería actualmente.

---

## 5. Soporte y Ayuda
Si encuentra errores o necesita funcionalidades adicionales, contacte al administrador del sistema.

> **Nota Técnica**: Este sistema cuenta con copias de seguridad automáticas y control de permisos granulares. No comparta su contraseña de administrador.
