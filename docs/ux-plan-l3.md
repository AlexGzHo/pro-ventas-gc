# L3 — Modal de suscripción

Aplicar las decisiones finales del usuario sobre la Spec 01: crear y editar en modal de 560 px, sin encabezados numerados ni textos de relleno. No modificar operaciones, parámetros ni payloads de Supabase.

Archivos: `src/features/subscriptionForm.js`, `subscriptionForm/formHtml.js`, `subscriptionForm/financialBlock.js`, `subscriptionForm/clientCombo.js`, nuevo `subscriptionForm/productCombo.js` y `src/styles/views/form.css`. Los estilos de componentes del formulario se trasladan a `components.css` mediante coordinación con L1; la vista conserva únicamente layout.

Conservar IDs, names y exports consumidos por la lógica de guardado. El buscador de servicio mantiene `subProductId` y despacha `change` para reutilizar el autocompletado existente. El selector de moneda sincroniza los radios existentes y conserva el cálculo financiero. Fechas plegables conservan los inputs requeridos y la validación los descubre antes de enfocar.

Verificación: sintaxis JS, verificadores del proyecto, tests financieros existentes y pruebas de navegador con datos simulados en integración. Riesgos: altura en móvil, estados USDT y edición con detalles; medir esos estados con Playwright antes del cierre. Los lotes de historial y estilos son propiedad de otros especialistas y se integran antes de confirmar el commit.
