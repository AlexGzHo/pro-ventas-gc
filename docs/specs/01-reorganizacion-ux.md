# Spec 01 — Reorganización de la experiencia de usuario

> Estado: **aprobada para implementar** (fase B del plan, ver `docs/specs/README.md`).
> Alcance: solo frontend (`src/`). **Sin cambios en Supabase** (ni tablas, ni migraciones, ni RLS, ni RPCs).
> Las llamadas a `supabase.from()` / `supabase.rpc()` conservan exactamente sus parámetros actuales.

## 1. Problema

El MVP funciona, pero cada pantalla resuelve las cosas a su manera:

| Síntoma que percibe el usuario | Causa en el código |
|---|---|
| "Tengo que buscar aquí y allá para registrar una venta" | Para vender un servicio nuevo hay que salir a **Catálogo**, crear el producto, volver a **Suscripciones** y abrir el formulario. El cliente se crea en otro control distinto. |
| "Hay modales por todos lados" | Conviven 4 patrones para lo mismo: modal (`ui/modal.js`), página propia (`#nueva-suscripcion` en `router.js`), formulario incrustado en la página (Clientes antiguo) y panel de detalle (ficha de cliente). |
| "No sé dónde está cada cosa" | 6 secciones al mismo nivel en el menú (Inicio, Suscripciones, Clientes, Catálogo, Proveedores, Plantillas). Las de uso diario y las de configuración pesan igual. |
| "Los tamaños no son uniformes" | Encabezados, toolbars y KPIs sin estilos (CSS borrado en el refactor: `.hero`, `.toolbar`, `.filter-controls`, `kpi-*`, `inicio-bar-*`). Botones de 26, 36, 40 y 44 px. Más de 10 tamaños de letra distintos. |
| "Para ver los accesos de un cliente doy vueltas" | El modal de credenciales solo se abría desde la vista Resumen; la ficha del cliente no muestra accesos. |

## 2. Referencias (patrones probados, no copiar marcas ni estilos)

- **Lista + panel de detalle lateral** (patrón de Stripe Dashboard, Linear, Gmail): se elige un elemento de la lista y su detalle aparece al lado, sin cambiar de página. Al cerrar, la lista sigue donde estaba (scroll, filtros).
- **Crear lo que falta sin salir del flujo** (patrón de Shopify al crear un pedido): si el cliente o el servicio no existen, se crean ahí mismo dentro del formulario.
- **Separar operación diaria de configuración** (patrón casi universal en paneles administrativos): el menú principal muestra solo lo que se usa cada día; catálogos y plantillas van en "Ajustes".

## 3. Nueva arquitectura de información

### 3.1 Menú

```
Hoy            (antes "Inicio")          #hoy
Ventas         (antes "Suscripciones")   #ventas
Clientes                                  #clientes
Ajustes                                   #ajustes/catalogo | #ajustes/proveedores | #ajustes/plantillas
```

- Móvil: barra inferior con **Hoy · Ventas · Clientes · Ajustes** y un botón central flotante **"+ Nueva venta"**.
- Escritorio: barra lateral con esas 4 entradas y el botón **"+ Nueva venta"** arriba.
- Los hashes antiguos (`#inicio`, `#suscripciones`, `#productos`, `#proveedores`, `#whatsapp-templates`, `#nueva-suscripcion`) **redirigen** al nuevo equivalente (los usuarios pueden tener marcadores guardados).
- Reservar en Ajustes el espacio para **"Revendedores"** (solo admin), que llega con la Spec 02. No implementarlo aquí.

### 3.2 Qué hay en cada sección

**Hoy**: lo que hay que hacer ahora.
1. Cola "Requieren atención" (vencidas y que vencen en ≤ 3 días) con acciones directas: Cobrar · Copiar accesos · Renovar · Abrir.
2. Tres cifras: Ganancia del mes · Activas · Por vencer (7 días). Selector S/ / USDT.
3. "Resumen financiero" plegado por defecto (lo que hoy es el detalle y el comparativo mensual).

**Ventas**: todas las suscripciones.
- Buscador + chips de estado (Todas, Por vencer, Vencidas, Activas, Dadas de baja) + botón "Filtros" (servicio, propietario).
- Una fila/tarjeta por venta. Al tocarla se abre el **panel de detalle** (3.3). Las acciones rápidas de la tarjeta se mantienen: Renovar · Cobrar · Copiar todo · ⋯.
- Se elimina el conmutador Tarjetas/Resumen: en escritorio se usa la tabla compacta y en móvil las tarjetas (mismo componente, responsive). Así hay un solo diseño que mantener.

**Clientes**: el directorio.
- Lista con nombre, celular, n.º de ventas activas y próximo vencimiento.
- Al tocar un cliente se abre su **panel**: datos de contacto, sus ventas (con las mismas acciones rápidas) y el botón **"Nueva venta para este cliente"** (abre Nueva venta con el cliente ya elegido). Editar, fusionar y eliminar quedan en el menú ⋯ del panel.

**Ajustes**: pestañas Catálogo · Proveedores · Plantillas WhatsApp. Mismo patrón de lista + panel.

### 3.3 Un único patrón de interacción: el panel lateral

Crear un componente `src/ui/panel.js` (`openPanel({ title, subtitle, body, footer, onClose })`) que reemplaza a los modales grandes:

- Escritorio: panel de 480 px que entra por la derecha; la lista queda visible y desplazable detrás.
- Móvil (≤ 640 px): ocupa toda la pantalla, con barra superior fija (título + cerrar) y pie fijo con las acciones.
- Mismo contrato de accesibilidad que `ui/modal.js`: foco atrapado, Escape cierra, el foco vuelve al elemento que lo abrió, `role="dialog"` y `aria-labelledby`.
- El hash refleja el panel abierto (`#ventas/ID`, `#clientes/ID`) para que el botón "atrás" del celular lo cierre en lugar de salir de la app.

Reglas de uso (todas las pantallas):

| Situación | Patrón |
|---|---|
| Ver o editar un elemento (venta, cliente, producto, proveedor) | Panel |
| Crear un elemento (Nueva venta, Nuevo cliente, Nuevo producto…) | Panel |
| Confirmar algo destructivo o irreversible | `confirmDialog` (ya existe) |
| Elegir algo corto sin más contexto (p. ej. duración de renovación) | Modal pequeño (`ui/modal.js`) |
| Avisar de un resultado | `toast` (ya existe) |

Queda prohibido: formularios incrustados en la página, páginas propias para formularios (`#nueva-suscripcion` desaparece como página) y modales encima de modales (salvo `confirmDialog`).

### 3.4 Panel de detalle de una venta

Orden de secciones (de lo más usado a lo menos):
1. **Encabezado**: servicio, cliente y celular, badge de estado.
2. **Accesos**: usuario, contraseña (oculta, con mostrar/ocultar), perfil, PIN y URL; cada uno con botón copiar. Botón "Copiar todo". Esto reemplaza al modal de credenciales.
3. **Acciones**: Renovar (abre el modal pequeño de renovación ya existente), Cobrar por WhatsApp, Enviar datos, Enviar actualización.
4. **Vigencia y dinero**: inicio, vencimiento, venta, costo, ganancia, proveedor.
5. **Historial de renovaciones** (lectura de `subscription_renewals`, consulta ya existente o equivalente en lectura).
6. **Notas y campos extra**.
7. Pie: Editar · ⋯ (Dar de baja / Recuperar, Eliminar definitivamente).

"Editar" cambia el mismo panel a modo formulario (no abre otro).

### 3.5 Nueva venta (el flujo más importante)

Un panel con tres pasos visibles en una sola columna (no un asistente de varias pantallas):

1. **Cliente**: un solo campo "Buscar o crear". Si no existe: opción "Crear cliente «texto»" que despliega el celular en línea. Si se llegó desde la ficha de un cliente, viene ya elegido.
2. **Servicio y precio**: campo "Buscar servicio". Al elegir un producto del catálogo se autocompletan precio, costo, proveedor y duración. Si no existe: opción "Crear servicio «texto»" que despliega precio/costo en línea y **lo guarda en el catálogo** al guardar la venta (misma tabla `products`, mismos campos que el formulario de Catálogo). Vencimiento calculado con chips +1 / +3 / +6 / +12 meses.
3. **Accesos**: usuario/correo (con el autocompletado de dominio existente), contraseña, perfil, PIN, URL. "Más opciones" plegado: vencimiento del proveedor, campos extra, notas.

Pie fijo: Cancelar · **Guardar venta**. Al guardar: toast con acciones "Enviar datos por WhatsApp" y "Copiar accesos".

Se conserva intacta la lógica actual de `create_subscription_v3` (idempotency key, monedas y tipo de cambio).

## 4. Sistema visual uniforme

Definir en `src/styles/tokens.css` y usar **solo** estos valores (el verificador de tokens debe pasar):

- **Tipografía** (`--text-xs` 12, `--text-sm` 13, `--text-md` 14, `--text-lg` 16, `--text-xl` 20, `--text-2xl` 24 px). Pesos 400 / 500 / 600.
- **Espaciado**: `--space-1..8` = 4, 8, 12, 16, 20, 24, 32, 40 px.
- **Controles**: altura 36 px en escritorio y 44 px en móvil para botones, inputs y selects. Un solo tamaño de botón pequeño: 32 px (solo escritorio, en tablas).
- **Radios**: 6 (controles), 10 (tarjetas y paneles), 999 (chips).
- **Componentes únicos** en `components.css`, cada uno con una sola definición: `.page-header` (reemplaza `.hero`), `.toolbar`, `.search-box`, `.chip`, `.card`, `.list-row`, `.data-table`, `.empty-state`, `.panel`, `.field` (label + control + error), `.btn` (variantes: primary, secondary, ghost, danger; tamaños: md, sm).
- Cada vista solo puede añadir CSS de **layout propio**; no redefine botones, inputs ni tarjetas.

## 5. Fuera de alcance (no hacer)

- Cambios en Supabase de cualquier tipo.
- Funciones nuevas que no estén descritas aquí (no agregar gráficos, reportes, exportaciones, tema claro, etc.).
- Librerías o frameworks nuevos.
- Revendedores / roles (Spec 02).

## 6. Criterios de aceptación

1. `npm run check` pasa, y `npm run verify -- --strict` pasa (cero clases sin estilos, salvo las declaradas en `scripts/verify/class-hooks.txt` como ganchos de JS).
2. Registrar una venta con **cliente nuevo y servicio nuevo** se hace sin salir del panel de Nueva venta y sin abrir ningún otro modal.
3. Desde la ficha de un cliente se pueden copiar los accesos de cualquiera de sus ventas en ≤ 2 toques.
4. El botón "atrás" del celular cierra el panel abierto.
5. No queda ningún formulario incrustado ni página `#nueva-suscripcion`; `grep -rn "openModal(" src` solo aparece en confirmaciones, renovación y diálogos pequeños.
6. Capturas a 360 px y 1280 px de: Hoy, Ventas, panel de venta, Nueva venta (con cliente y servicio nuevos desplegados), Clientes + panel, Ajustes (las 3 pestañas). Con datos simulados, guardadas fuera de git.
7. Recorrido manual con usuario real (lo hace el dueño): crear, copiar, renovar, cobrar, editar, dar de baja, recuperar, eliminar, fusionar clientes.

## 7. Orden de implementación sugerido (lotes con archivos separados)

| Lote | Contenido | Archivos principales | Depende de |
|---|---|---|---|
| B0 | Restaurar CSS perdido + tokens y componentes únicos (sección 4) | `src/styles/**` | — |
| B1 | `ui/panel.js` + integración con router (hash `#seccion/ID`, atrás cierra) | `src/ui/panel.js`, `src/router.js` | — |
| B2 | Menú nuevo, redirecciones de hashes, Ajustes con pestañas | `src/shell.js`, `src/router.js`, vistas de Ajustes | B1 |
| B3 | Panel de detalle de venta + Ventas responsive única | `src/views/suscripciones.js` (renombrar a `ventas.js`), `src/features/subscriptionActions.js` | B0, B1 |
| B4 | Nueva venta en panel con creación en línea de cliente y servicio | `src/features/subscriptionForm/**` | B1 |
| B5 | Clientes con panel + "Nueva venta para este cliente" | `src/views/clientes.js` | B1, B4 |
| B6 | Hoy (antes Inicio) | `src/views/inicio.js` (renombrar a `hoy.js`) | B0 |

B0 y B1 pueden ir en paralelo. Luego B2, B3, B4 y B6 en paralelo (archivos distintos). B5 al final.
