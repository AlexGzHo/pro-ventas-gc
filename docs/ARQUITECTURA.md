# Arquitectura Técnica: PRO VENTAS GC

```text
Usuarios Autorizados (Alex / Liz)
              │
              ▼
   PRO VENTAS GC (Frontend)
   Vite + JavaScript Vanilla SPA
              │
      ┌───────┴────────────────────────┐
      ▼                                ▼
Supabase Auth                  Supabase Data API
(sesión correo + pass)        (PostgreSQL + RLS + RPC)
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             Tablas Relacionales              Funciones RPC Atómicas
             - clients                        - create_subscription_v3
             - products                       - process_renewal
             - providers                      - delete_subscription_transactional
             - subscriptions                  - merge_clients
             - subscription_renewals          - merge_providers
             - whatsapp_templates

Hosting Frontend: Netlify (Producción)
```

---

## 1. Modelo de Base de Datos y Relaciones

- **Base de Datos:** PostgreSQL en Supabase.
- **Acceso:** Cliente `@supabase/supabase-js` con Row Level Security (RLS) y funciones RPC con `SECURITY DEFINER` para operaciones atómicas.

### Módulos y Tablas Principales
- **Clientes (`public.clients`):** Directorio de clientes con nombre, teléfono WhatsApp (`phone`) y notas.
- **Proveedores (`public.providers`):** Datos de contacto, sitio web, WhatsApp y Telegram de proveedores de servicios y cuentas.
- **Productos (`public.products`):** Catálogo de servicios disponibles con precio sugerido (`suggested_sale_price`), costo sugerido (`suggested_cost_price`), moneda y categoría (`category`: Entretenimiento, IA y Productividad, Diseño, Educación, Almacenamiento, Otros).
- **Suscripciones (`public.subscriptions`):** Registros activos e históricos de suscripciones asignadas. Vinculan `client_id`, `product_id`, `provider_id`, credenciales (usuario, contraseña, perfil, PIN, URL, extra), fechas de vigencia (`start_date`, `expiry_date`), montos y propietario (`owner`).
- **Renovaciones (`public.subscription_renewals`):** Historial financiero de cada periodo renovado con control de claves de idempotencia (`idempotency_key`), fecha de renovación, montos en PEN/USDT y tipo de cambio.
- **Plantillas de WhatsApp (`public.whatsapp_templates`):** Almacenamiento sincronizado de los mensajes automáticos (`recordatorio`, `cobro`, `actualizacion`, `datos`).

### Restricciones Relacionales
- **Clientes y Productos:** La relación hacia `subscriptions` utiliza `ON DELETE RESTRICT` para evitar pérdidas accidentales de historial.
- **Proveedores:** La relación hacia `subscriptions` utiliza `ON DELETE SET NULL`, permitiendo reasignaciones asistidas mediante `merge_providers`.

---

## 2. Funciones RPC Críticas

- `create_subscription_v3`: Alta transaccional de suscripción vinculando cliente, producto y proveedor, con registro en el historial financiero inicial e idempotencia.
- `process_renewal`: Extensión de vigencia y cálculo financiero en soles/USDT con control de idempotencia.
- `delete_subscription_transactional`: Eliminación atómica y definitiva de una suscripción y todas sus renovaciones asociadas (`subscription_renewals`), validando autorización de usuario y bloqueo por fila (`FOR UPDATE`).
- `merge_clients(p_target_client_id, p_source_client_id)`: Fusión segura de perfiles de clientes transfiriendo todas las suscripciones al cliente destino y eliminando el origen.
- `merge_providers(p_target_provider_id, p_source_provider_id)`: Reasignación de dependencias (productos y suscripciones) de un proveedor origen a otro destino y eliminación del origen.

---

## 3. Flujos de Operación

### Flujo de Autenticación
1. El usuario introduce credenciales en la pantalla de login.
2. `supabase.auth.signInWithPassword()` autentica la sesión.
3. Supabase persiste y refresca la sesión en el navegador (`localStorage`).
4. Si no hay sesión válida, se restringe la UI a las vistas de autenticación. Las políticas RLS de Supabase bloquean accesos no autorizados a nivel de base de datos.
5. Soporte para recuperación de contraseña vía correo con vista especializada (`#nueva-contrasena`).

### Flujo de Suscripción y Renovación
1. Se abre el formulario de suscripción (en modal o pantalla completa `#nueva`).
2. Selección combinada de cliente (existente o creación rápida inline con teléfono).
3. Selección de servicio del catálogo con autocompletado de precios, moneda y dominios.
4. Alta transaccional vía `create_subscription_v3`.
5. Al vencer, la suscripción se renueva seleccionando chips de duración (`7d`, `15d`, `1m`, `3m`, `6m`, `12m`) vía `process_renewal`, recalculando la fecha en tiempo real y ofreciendo confirmación opcional inmediata por WhatsApp.

### Flujo de Mensajería WhatsApp
1. Generación del mensaje a partir de plantillas dinámicas con interpolación segura de variables (`{cliente}`, `{servicio}`, `{vencimiento}`, `{precio}`, etc.).
2. Normalización de contacto telefónico (+51, teléfonos locales o enlaces directos).
3. Apertura controlada de `https://wa.me/<numero>?text=<mensaje>` con codificación URI completa y preservación de caracteres especiales/emojis.

---

## 4. Mapa de Módulos Frontend (SPA Modular Vanilla)

```text
src/
├── app.js                      # Entry point (<150 líneas): boot, auth listener, montaje de shell
├── state.js                    # Estado reactivo global compartido (state) y carga con caché
├── router.js                   # Mapa declarativo de rutas hash y helper goToSubscription()
├── auth.js                     # Login, recuperación y cambio de contraseña
├── shell.js                    # Shell de la aplicación, sidebar contraíble y bottom nav móvil
├── constants.js                # Constantes globales, opciones y mapeos
├── utils.js                    # Formateo de fechas, moneda PEN/USDT, sanitización y badges
├── supabase.js                 # Inicialización del cliente Supabase
├── whatsapp.js                 # Manejo y normalización de enlaces y plantillas de WhatsApp
│
├── ui/                         # Primitivas de interfaz reutilizables
│   ├── modal.js                # openModal() estándar, accesible y responsive
│   ├── confirm.js              # confirmDialog() y alertDialog() asíncronos (Promise<boolean>)
│   ├── toast.js                # toast() con deduplicación y auto-dismiss
│   ├── icons.js                # Catálogo unificado de SVGs vectoriales consistentes
│   ├── dom.js                  # Utilidades ligeras de manipulación DOM
│   └── mergeDialog.js          # Modal de fusión/reasignación para clientes y proveedores
│
├── features/                   # Lógica de negocio interactiva
│   ├── subscriptionForm.js     # Formulario de alta/edición en 3 bloques + cliente combinado
│   ├── renewModal.js           # Modal de renovación con chips, vista previa y WhatsApp
│   └── subscriptionActions.js  # Acciones de tarjeta (bajas, recuperación, eliminación atómica)
│
├── views/                      # Pantallas principales
│   ├── inicio.js               # Dashboard operativo, cobros inmediatos y 4 KPIs ejecutivos
│   ├── suscripciones.js        # Explorador principal, popover de filtros, chips y vista resumen
│   ├── subscriptionForm.js     # Adaptador de vista para formulario en ruta directa
│   ├── clientes.js             # Directorio de clientes con historial de suscripciones y fusión
│   ├── productos.js            # Catálogo de servicios por categoría y precios base
│   ├── proveedores.js          # Directorio de proveedores, enlaces de contacto y reasignación
│   └── whatsappTemplates.js    # Editor interactivo de plantillas con píldoras de variables
│
└── styles/                     # Arquitectura CSS modular sin estilos en línea
    ├── tokens.css              # Variables :root, escalas de espaciado (4-32), colores y radios
    ├── base.css                # Resets, tipografía, botones, badges e inputs
    ├── layout.css              # Contenedores, sidebar, topbar, bottom nav y breakpoints
    ├── components.css          # Estilos de modales, toasts, confirmaciones y tablas
    ├── index.css               # Importador principal de estilos
    └── views/                  # Hojas de estilo específicas por vista
        ├── inicio.css
        ├── suscripciones.css
        ├── form.css
        ├── clientes.css
        ├── productos.css
        ├── proveedores.css
        └── plantillas.css
```

---

## 5. Despliegue y Configuración

- **Servidor de Producción:** Netlify.
- **Variables de Entorno Necesarias:**
  - `VITE_SUPABASE_URL`: Endpoint de la instancia de Supabase.
  - `VITE_SUPABASE_ANON_KEY`: Clave pública anónima de Supabase.
- **Comando de Compilación:** `npm run build` (genera la distribución estática optimizada en `dist/`).
