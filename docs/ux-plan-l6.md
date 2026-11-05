# L6: evidencia reproducible en navegador

Crear `scripts/ux-smoke.mjs` con fixtures sintéticos y una sesión de prueba, sin leer `.env` ni credenciales. Ejecutar contra Vite local con URL Supabase ficticia; interceptar esa URL mediante `page.route` y bloquear cualquier petición externa. No alterar parámetros ni lógica de aplicación.

Capturar Inicio, Suscripciones tarjetas/resumen, formulario de suscripción inicial/fechas/detalles/USDT, ficha de cliente y configuración (Catálogo, Proveedores, Plantillas) a 360×780 y 1280×860. Guardar imágenes fuera de git en `/tmp/proventas-ux-capturas` y un informe JSON con rutas, medidas, errores y comprobaciones del historial/foco.

Comprobar controles 40/44 px, excepción sm32 en tablas, scroll del formulario inicial, Escape, atrás y foco. Inspeccionar imágenes reales antes de afirmar validación visual. El script no añade dependencias de producto; usa Playwright disponible en el entorno y Chromium instalado. Riesgos: datos ficticios insuficientes y selectores que cambien durante los lotes; fallos deben reportarse por estado sin ocultarlos.
