# Evidencia de cierre UX

Base `3b06513`; PR hacia `refactor/ux-limpieza`. No se modifica `main`, Supabase, sus consultas/payloads ni las dependencias. Las decisiones finales están en Spec 01 y FRONTEND.

## Resultado por lote

| Lote | Resultado | Evidencia |
| --- | --- | --- |
| L1 | Tokens 40/44/32, tipografía, radios, componentes y estados comunes; verificador nuevo | `npm run check` y strict OK; 19 casos del verificador; 26 capturas de transición |
| L2 | Panel, foco, inert e historial compartido con modales; hashes legados | check y strict OK; 26 capturas y 6 interacciones de transición; regresiones de capas en Python Playwright OK |
| L3 | Modal de suscripción 560 px, buscadores, fechas plegables, moneda, accesos y detalles | check y strict OK; 28 capturas y 6 interacciones de transición; scroll inicial y alturas OK |
| L4 | Tarjetas/resumen comparten badges, acciones y menú; móvil fuerza tarjetas | check y strict OK; 28 capturas y 6 interacciones de transición; menú sin recorte ni carreras de foco |
| L5 | Cliente en panel 440 px; edición 420 px; Catálogo/Proveedores/Plantillas comunes | check y strict OK; 29 capturas, 16 recorridos y 60 comprobaciones visuales/geométricas en el recorrido integrado |
| L6 | Repaso móvil, tabla compacta sin ocultar ⋯, documentación y harness reproducible | check y strict OK; 29 capturas, 16 recorridos y 60 comprobaciones, sin errores; informe final `browser-report.json` |

Cada `npm run check` ejecutó 155 comprobaciones financieras, 154 de WhatsApp, 19 casos de uniformidad y el build Vite. No se añadieron paquetes. Los logs completos se entregan junto a las capturas fuera de git.

Los estados del formulario de L1/L2 aún tenían el diseño anterior y no satisfacían el límite de scroll final; esto se corrigió en L3. Los informes intermedios no se presentan como el estado final. Las regresiones de selección de combos y del menú se corrigieron dentro de los lotes que las introducían antes de publicar la rama.

## Criterios de cierre

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Menú conserva nombres y grupos Operación/Configuración | Cumplido | Capturas Inicio y configuración; shell existente conservado |
| Crear/editar en modal, solo 420/560 px, cuerpo con scroll, una columna móvil | Cumplido | CSS común y capturas suscripción/producto/proveedor; editar cliente sobre panel |
| Consultar cliente en panel 440 px o pantalla completa | Cumplido | `cliente-panel` en ambas resoluciones; contadores y Renovar/Cobrar/Ver |
| Atrás cierra paneles y modales conservando sección | Cumplido | `modal-atras`, `panel-atras-foco` y pruebas de capas anidadas |
| Ninguna ruta de creación independiente | Cumplido | Alias `#nueva-suscripcion` abre modal sobre lista; ruta retirada del mapa |
| Tarjetas/resumen en escritorio; solo tarjetas móvil sin perder preferencia | Cumplido | Capturas y recorrido `preferencia-escritorio-tras-redimensionar` |
| Formulario inicial sin scroll en 1280×860 | Cumplido | Cuerpo: clientHeight 601 px = scrollHeight 601 px; ancho 560 px |
| Formulario inicial ≤1,5 pantallas en 360×780 | Cumplido | Formulario 843 px; contenido total con encabezado y pie 1029 px <1170 px; modal 360×780 |
| Botones, inputs y selects 40/44 px; sm 32 px solo tablas escritorio | Cumplido | Medición real de controles visibles, incluido shell, por captura |
| Lupa separada del texto; URL igual al resto; sin hueco Cliente ni corte del pie | Cumplido | Capturas formulario inicial y Más detalles; CSS compartido |
| Tokens, componentes comunes y estados visibles | Cumplido | verify estricto, auditoría CSS y capturas |
| Verificador de uniformidad incluido y sin dependencias | Cumplido | 19 casos: multilínea, calc, controles, comentarios y excepciones locales |
| check, strict y búsqueda de literales en vistas | Cumplido | Todos los lotes; búsqueda sin resultados |
| Pruebas con sesión falsa/datos ficticios y Supabase interceptado | Cumplido | Harness, cero escrituras remotas; ninguna credencial real |

## Capturas y revisión visual

Capturas PNG reales con Chromium/Playwright a **1280×860** y **360×780**. No se redimensionaron ni se sustituyeron por diseños. Se inspeccionaron las imágenes, además de medir el DOM. En móvil Más detalles se desplaza dentro del cuerpo para mostrar sus campos conservando el pie y el encabezado.

En cada resolución: Inicio, Suscripciones tarjetas, preferencia resumen (escritorio muestra tabla; móvil sigue tarjetas), nueva suscripción inicial, Cambiar fechas, Más detalles, USDT, Clientes, ficha de cliente, Catálogo, producto nuevo, Proveedores, proveedor nuevo y Plantillas. Además: menú ⋯ de resumen en escritorio.

Las imágenes y logs están **fuera de git**, como requiere el flujo del proyecto. Se entregan en `proventas-ux-evidence.zip` junto a este PR a través del chat. `browser-report.json` registra nombres, medidas y resultados; el manifiesto del ZIP añade bytes y SHA-256 de cada captura. Los archivos individuales están en el subdirectorio `capturas/` del ZIP. El directorio original de ejecución es `/tmp/proventas-ux-cierre-verificado`.

No quedan pantallas o estados solicitados sin comprobar en Chromium con fixtures. No se verificó una sesión de producción, navegadores Safari/Firefox ni un dispositivo físico; el recorrido con cuenta real corresponde al propietario.

## Reproducir sin credenciales

Terminal 1, con dependencias del lockfile ya instaladas:

```bash
VITE_SUPABASE_URL=https://ux-fixture.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=fixture-public-key npm run dev -- --host 127.0.0.1
```

Terminal 2, con Playwright y Chromium instalados en el entorno (no son dependencias del producto):

```bash
PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs UX_CHROMIUM=/ruta/a/chromium UX_STRICT=1 node scripts/ux-smoke.mjs
python tests/overlays.browser.py
npm run check
npm run verify -- --strict
rg -n '(height|font-size|border-radius):\s*[0-9.]+(px|rem)' src/styles/views
```

La última búsqueda debe producir cero resultados. El harness permite `UX_BASE_URL`, `UX_OUTPUT` y `UX_VIEWPORT` para elegir servidor, salida o resolución. Los perfiles `UX_PHASE=L1..L6` identifican explícitamente interacciones aún no aplicables en snapshots de transición; el cierre usa L6 sin excepciones. Bloquea peticiones externas, intercepta toda la URL ficticia de Supabase y no lee `.env` ni datos de producción.

## Documentación oficial consultada mediante TinyFish

- https://developer.mozilla.org/en-US/docs/Web/API/History/pushState
- https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
- https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
- https://playwright.dev/docs/network

TinyFish solo se usó para leer documentación pública. No recibió credenciales ni accedió a la app autenticada.

## Recorrido del propietario con su cuenta real

Crear una suscripción y un cliente; comprobar autocompletado del catálogo, PEN/USDT y fechas; copiar credenciales; renovar y cobrar por WhatsApp; editar desde ficha; archivar, recuperar, eliminar y fusionar clientes. Validar los permisos y datos reales queda fuera de los fixtures; esta entrega no cambia esas operaciones de backend.
