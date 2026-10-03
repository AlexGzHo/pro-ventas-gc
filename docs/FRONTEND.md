# Frontend

## Tecnología
Frontend en JavaScript vanilla con Vite. No utiliza React ni otro framework de interfaz.

## Pantalla de login
Muestra:
- nombre PRO VENTAS GC;
- correo;
- contraseña;
- botón Entrar.

No hay botón de registro.

## Dashboard
Después del login se muestran:
- ingresos;
- egresos;
- ganancia;
- activos;
- próximos a vencer;
- vencidos.

También hay búsqueda y filtros.

## Tarjeta de suscripción
Cada registro muestra:
- servicio;
- cliente;
- celular;
- estado;
- vencimiento;
- precio de venta;
- proveedor;
- costo;
- credenciales disponibles.

Acciones:
- copiar todo;
- cobrar por WhatsApp;
- enviar actualización;
- enviar datos;
- renovar;
- editar;
- eliminar.

## Formulario
Campos:
- cliente;
- celular;
- servicio;
- usuario/correo;
- contraseña;
- perfil;
- PIN;
- URL;
- fecha de inicio;
- vencimiento;
- precio;
- costo;
- proveedor;
- vencimiento del proveedor;
- campos extra;
- notas.

Los campos que no aplican se dejan vacíos.

## Copiado rápido
Usuario, contraseña, perfil, PIN y URL tienen botones independientes. `Copiar todo` genera un bloque con únicamente los campos existentes.

## WhatsApp
El frontend normaliza un celular peruano de 9 dígitos agregando `51`. El mensaje se codifica en un enlace `wa.me`. La aplicación abre WhatsApp/WhatsApp Web; el usuario revisa y envía manualmente.

## Responsive
En escritorio se muestran varias tarjetas por fila. En móvil las tarjetas pasan a una columna y el formulario se adapta al ancho disponible.
