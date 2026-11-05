# Spec 01 — Uniformización de UX de PRO VENTAS GC

Estado: decisiones finales aprobadas por el propietario. Este documento reemplaza la propuesta anterior de Hoy/Ventas/Ajustes y paneles de creación. Base de trabajo: `refactor/ux-limpieza`, commit `3b06513` (B0). El PR se dirige a esa rama, nunca a `main`.

## 1. Alcance y preservación

Solo frontend y sus verificadores/documentación. JavaScript vanilla, Vite y CSS nativo; ninguna dependencia nueva. No modificar Supabase, migraciones, RLS, RPC, ni parámetros de llamadas `supabase.from()`/`rpc()`. Preservar idempotencia, importes, monedas, fechas, renovaciones, mensajes y operaciones existentes. No implementar tema claro, multi-revendedor ni funciones ajenas a esta fase.

No existe `docs/design/stitch/` en el commit base. Si se incorpora, `screen.png` es referencia visual aprobada y `code.html` solo referencia: nunca copiar HTML ni Tailwind.

## 2. Navegación e interacción

Se conservan los nombres y hashes actuales:

- Operación: Inicio, Suscripciones, Clientes.
- Configuración: Catálogo, Proveedores, Plantillas WhatsApp.
- Móvil: Inicio, Suscripciones, Clientes y Más para configuración.

Crear y editar siempre abre `src/ui/modal.js`. Dos anchos: 420 px para cliente, confirmaciones y renovación; 560 px para suscripción, producto y proveedor. Encabezado y pie permanecen visibles y solo el cuerpo desplaza. A ≤640 px: pantalla completa y formulario de una columna.

Consultar ficha de cliente abre `src/ui/panel.js`: `openPanel({ title, subtitle, body, footer, onClose }) → { el, close }`. Ancho 440 px a la derecha en escritorio y pantalla completa a ≤640 px. Presenta datos, contadores Vigentes / Vencen pronto / Vencidas y suscripciones con Renovar / Cobrar / Ver. Editar abre el modal correspondiente.

Modal y panel: `role="dialog"`, nombre mediante `aria-labelledby`, foco atrapado, Escape cierra la capa superior y foco restaurado al disparador. La confirmación destructiva puede superponerse; no debe cerrar otras capas ni filtrar el foco al fondo.

Cada apertura de modal/panel agrega una entrada al historial. Atrás cierra la capa superior y conserva la sección. Los hashes antiguos siguen funcionando. `#nueva-suscripcion` y sus alias abren el modal sobre Suscripciones; no existe una página de creación independiente.

## 3. Suscripciones

Conservar Tarjetas / Resumen en escritorio. A ≤640 px ocultar el selector y mostrar siempre tarjetas, preservando la preferencia de escritorio al volver a ampliar. Ambas presentaciones comparten badges con icono + texto, botones y menú ⋯.

### Formulario de alta y edición

Orden y contenido visibles:

1. Cliente: buscar existente o crear en el flujo.
2. Servicio: buscador del mismo tipo; seleccionar autocompleta precio, costo, duración y proveedor como antes.
3. Duración: chips 1 / 3 / 6 / 12 meses, inicio hoy al crear. Texto «Vence el dd/mm/aaaa · Cambiar fechas»; cambiar fechas despliega inicio y vencimiento.
4. Precio de venta y Costo con moneda pequeña dentro del campo. Ganancia en una línea. Tipo de cambio y Equivalente solo cuando la moneda correspondiente es USDT.
5. Usuario/correo + Contraseña; Perfil + PIN.
6. Más detalles: URL de acceso, Proveedor, Vencimiento del proveedor, Campos extra y Notas internas. Cerrado al crear; abierto al editar cuando contiene datos.

Sin cajas numeradas, frases de relleno ni «mayorista» en etiquetas. La lupa no invade el texto, URL usa el control común, Cliente no reserva huecos vacíos y el borde superior del pie cubre todo el ancho.

## 4. Sistema visual único

Valores en `src/styles/tokens.css`:

| Elemento | Valores |
| --- | --- |
| Controles | `--control-h`: 40 px escritorio, 44 px a ≤640 px |
| Botones pequeños | `--control-h-sm`: 32 px, únicamente dentro de tablas en escritorio |
| Tipografía | `--text-xs` 12, `--text-sm` 13, `--text-md` 14, `--text-lg` 16, `--text-xl` 20, `--text-2xl` 24 px |
| Pesos | 400 / 500 / 600 |
| Radios | 8 px controles, 12 px tarjetas/modales/paneles, 999 px chips |
| Espaciado | escala `--space-*`: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 px |

`components.css` define los componentes y sus variantes; `layout.css` define el shell. Componentes: `.btn` (primary/secondary/ghost/danger; md/sm), `.field`, `.search-box`, `.chip`, `.badge`, `.card`, `.stat-card`, `.data-table`, `.page-header`, `.toolbar`, `.empty-state`, `.modal`, `.panel`. Las vistas solo añaden layout propio: no redefinen controles, colores ni geometría de componentes.

Estados reales: `.is-invalid` con borde de peligro y texto de error; `.current` y `.filter-active` con fondo/borde de marca; `.cred-masked` con espaciado de caracteres. No se declaran como ganchos sin estilos.

`uniformity.mjs`, sin dependencias e incluido en `npm run verify`, falla ante valores literales px/rem en height/min-height/font-size/font-weight/border-radius de vistas, y ante selectores que redefinen `.btn`, `input`, `select` o `textarea`. Excepciones únicamente con `/* uniformity-ok: motivo */` en la misma línea.

## 5. Lotes de entrega

- L1: tokens, componentes, estados y verificador de uniformidad.
- L2: panel, accesibilidad e historial; creación solo como modal y compatibilidad de hashes.
- L3: formulario de suscripción y anchos de modales.
- L4: Suscripciones y sus dos presentaciones.
- L5: ficha de cliente en panel; Catálogo, Proveedores y Plantillas con componentes comunes.
- L6: repaso móvil, documentación y evidencia.

Un commit por lote; todos deben conservar una aplicación funcional. Las reglas de `AGENTS.md` siguen siendo obligatorias. No editar con scripts de reemplazo masivo o regex.

## 6. Criterios de aceptación y evidencia

En cada lote: `npm run check`, `npm run verify -- --strict` y búsqueda de literales en vistas. Revisar diff y capturas con datos ficticios.

Capturas reales a 360×780 y 1280×860: Inicio, Suscripciones tarjetas y resumen (resumen solo escritorio), nueva suscripción inicial / Cambiar fechas / Más detalles / USDT, ficha cliente en panel, Catálogo, Proveedores y Plantillas. Playwright intercepta la URL de Supabase con `page.route`, sesión falsa en localStorage y datos ficticios. No usar credenciales ni datos reales.

Cierre:

- Modal inicial sin scroll interno a 1280×860.
- Contenido inicial de como máximo 1,5 pantallas a 360×780.
- Controles 40 px escritorio / 44 px móvil; sm solo tablas.
- Atrás cierra panel/modal; Escape y ciclo Tab/Shift+Tab correctos y foco restaurado.
- Ninguna ruta de creación renderiza una página independiente.
- Verificadores, pruebas y build en verde.

Si algo no se pudo verificar, el PR debe marcarlo como no verificado y enumerar exactamente las pantallas y estados pendientes. El recorrido con cuenta real queda para el propietario: crear, copiar, renovar, cobrar, editar, archivar, recuperar, eliminar y fusionar.

TinyFish se limita a documentación oficial y páginas públicas sin sesión. Nunca recibe credenciales, tokens, .env ni datos de clientes; no iniciar sesión en la app ni Supabase mediante TinyFish.
