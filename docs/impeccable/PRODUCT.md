# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo 2 personas: Alex y Liz.
- Uso diario continuo, principalmente desde teléfonos móviles (smartphones), frecuentemente en paralelo mientras conversan y atienden a clientes por WhatsApp.
- Reemplaza un flujo anterior basado en hojas de cálculo de Excel.

## Product Purpose

Herramienta interna privada de alta eficiencia para administrar suscripciones y cuentas digitales revendidas (Netflix, Disney+, Max, ChatGPT Plus, Canva Pro, Spotify, YouTube Premium, etc.). Permite gestionar clientes, vigencia de servicios, credenciales de acceso, proveedores y cobranza recurrente.

## Positioning

Sistema operativo interno sobrio, ultrarrápido y confiable enfocado en la velocidad de atención al cliente y cobro directo, con sincronización de estado en tiempo real y cálculo financiero exacto bimoneda (S/ y USDT). Sin elementos decorativos, de marketing ni sobrecarga cognitiva.

## Operating Context

- **Situación típica:** El operador está chateando con un cliente en WhatsApp en su smartphone, necesita cambiar a PRO VENTAS GC, encontrar al cliente en 2 segundos, copiar credenciales con 1 tap o presionar el botón de cobrar/recordar por WhatsApp, y volver al chat.
- **Jerarquía de tareas (por frecuencia):**
  1. Encontrar un cliente / suscripción rápidamente.
  2. Copiar credenciales para enviarlas al cliente.
  3. Cobrar o enviar recordatorio por WhatsApp.
  4. Procesar renovaciones.
  5. Registrar una nueva venta / suscripción.
  6. Revisar ganancias del mes y métricas financieras.
- **Entorno técnico:** Móvil vertical (viewport típico 360px - 412px) y escritorio (≥ 1024px). Idioma español (Perú), monedas Soles (S/) y Tether (USDT).

## Capabilities and Constraints

- **Stack:** Vite + JavaScript Vanilla moderno (ES Modules) + CSS modular nativo (sin frameworks UI como Tailwind, Bootstrap o React).
- **Backend:** Supabase (PostgreSQL con RLS, RPCs transaccionales con idempotencia y Supabase Auth).
- **Tema:** Modo oscuro único (*Midnight Precision Instrument*). Sin tema claro.
- **Restricciones estrictas:** No modificar esquemas ni realizar escrituras destructivas en Supabase; cero dependencias nuevas; diseño mobile-first real con áreas táctiles ≥ 44px.

## Brand Commitments

- **Nombre:** PRO VENTAS GC.
- **Voz y tono:** Herramienta de trabajo sobria, quirúrgica, rápida y confiable. Cero marketing ni adornos superfluos. Densidad media, optimizada para legibilidad inmediata en pantallas pequeñas.
- **Identidad visual:** Fondo oscuro `#080b11`, acentos funcionales en azul cobalto (`#3b82f6` para Alex) y rosa fucsia (`#ec4899` para Liz).

## Evidence on Hand

- Sistema de diseño de referencia: [docs/DESIGN.md](file:///c:/Users/lizna/OneDrive/Desktop/ALEX/Proyectos/PRO%20VENTAS%20GC/docs/DESIGN.md).
- Tokens CSS semánticos: [src/styles/tokens.css](file:///c:/Users/lizna/OneDrive/Desktop/ALEX/Proyectos/PRO%20VENTAS%20GC/src/styles/tokens.css).
- Arquitectura del sistema: [docs/ARQUITECTURA.md](file:///c:/Users/lizna/OneDrive/Desktop/ALEX/Proyectos/PRO%20VENTAS%20GC/docs/ARQUITECTURA.md).

## Product Principles

1. **Velocidad de atención inmediata (Taps mínimos):** Encontrar una suscripción y copiar credenciales o enviar WhatsApp debe resolverse en máximo 2 toques.
2. **Claridad sobre ornamentación:** La información financiera y el estado de vencimiento (vigente, por vencer, vencido) deben ser legibles de un vistazo bajo luz solar o en pantalla pequeña.
3. **Ergonomía táctil para WhatsApp:** Áreas interactivas de al menos 44px, navegación inferior fija al alcance del pulgar y modales con pie fijo para no perder botones de acción.
4. **Seguridad y precisión de datos:** Confirmaciones claras para acciones destructivas y consistencia en el balance de Soles y USDT.

## Accessibility & Inclusion

- Contraste WCAG AA en textos y estados sobre fondos oscuros.
- Áreas táctiles mínimas de 44x44px en móviles para evitar toques accidentales.
- Navegación por teclado completa (foco visible, Escape para cerrar diálogos).
