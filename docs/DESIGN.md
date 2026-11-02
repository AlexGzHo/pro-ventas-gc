# Sistema de Diseño: PRO VENTAS GC
> Midnight Precision Instrument — Sistema de Interfaz Operativo Financiero

**Tema Principal:** Oscuro (`Midnight Precision Instrument` consistente en toda la aplicación).  
**Enfoque de Experiencia:** Alta densidad de información, contraste visual optimizado (WCAG AA), legibilidad financiera inmediata y usabilidad táctil móvil nativa (áreas táctiles ≥ 40px).

---

## 1. Filosofía y Principios de Diseño

1. **Claridad Operativa Inmediata:** La interfaz prioriza los cobros y renovaciones urgentes antes de métricas secundarias.
2. **Jerarquía Visual en 3 Niveles:**
   - **Nivel 1:** Servicio y estado de vencimiento con badge cromático.
   - **Nivel 2:** Nombre de cliente y contacto de WhatsApp directo.
   - **Nivel 3:** Fechas exactas de vencimiento y monto monetario en soles o USDT.
3. **Cero Ruido Visual:** Eliminación de estilos en línea, popups nativos y adornos innecesarios; uso exclusivo de tokens semánticos y componentes accesibles.
4. **Respuesta Táctil Móvil:** Navegación inferior fija en celular (≤640px), modales a pantalla completa con pie fijo (*sticky footer*) y botones con área mínima de 40px.

---

## 2. Tokens de Color

### Tema Oscuro (Midnight Precision — Predeterminado)
| Rol Semántico | Token CSS | Valor HEX / RGBA | Uso |
| :--- | :--- | :--- | :--- |
| **Canvas** | `--bg-canvas` | `#080b11` | Fondo general de la aplicación |
| **Tarjeta** | `--bg-card` | `#0c1220` | Superficie de tarjetas y módulos |
| **Tarjeta Hover** | `--bg-card-hover` | `#10182b` | Hover en filas y tarjetas interactivas |
| **Superficie Elevada**| `--bg-surface-elevated`| `#131e33` | Modales, popovers y dropdowns |
| **Superficie Hundida**| `--bg-surface-sunken` | `#060910` | Entradas de texto e inputs |
| **Borde Sutil** | `--border-subtle` | `#25334a` | Separadores y divisores de listas |
| **Borde Fuerte** | `--border-strong` | `#334664` | Bordes de inputs, tarjetas y modales |
| **Texto Primario** | `--text-primary` | `#f8fafc` | Títulos, precios y nombres |
| **Texto Secundario**| `--text-secondary` | `#cbd5e1` | Subtítulos y etiquetas principales |
| **Texto Muted** | `--text-muted` | `#94a3b8` | Metadatos, fechas y textos auxiliares |
| **Texto Dim** | `--text-dim` | `#64748b` | Placeholders y texto desactivado |

### Identidad de Marca (Azul Cobalto)
| Estado | Token CSS | Valor | Rol |
| :--- | :--- | :--- | :--- |
| **Primario** | `--color-brand` | `#3b82f6` | Botones de acción principal, pestañas activas |
| **Hover** | `--color-brand-hover` | `#60a5fa` | Estado hover de interactivos principales |
| **Activo / Click**| `--color-brand-active`| `#2563eb` | Estado presionado |
| **Fondo Tenue** | `--color-brand-subtle`| `#172b4d` | Fondos de selección y badges de marca |
| **Borde Tenue** | `--color-brand-border`| `rgba(59, 130, 246, 0.35)` | Delimitador de botones secundarios |

### Estados Funcionales
| Estado | Texto / Ícono | Fondo Tenue | Borde |
| :--- | :--- | :--- | :--- |
| **Éxito (Activas)** | `#34d399` (`--status-success-text`) | `rgba(16, 185, 129, 0.12)` | `rgba(16, 185, 129, 0.28)` |
| **Alerta (Por vencer)** | `#fbbf24` (`--status-warning-text`) | `rgba(245, 158, 11, 0.12)` | `rgba(245, 158, 11, 0.28)` |
| **Peligro (Vencidas)** | `#f87171` (`--status-danger-text`) | `rgba(239, 68, 68, 0.12)` | `rgba(239, 68, 68, 0.28)` |
| **Neutro (Bajas)** | `#94a3b8` (`--status-neutral-text`) | `rgba(148, 163, 184, 0.08)` | `rgba(148, 163, 184, 0.22)` |

### Distinción de Propietarios
- **Alex:** `--owner-alex` (`#3b82f6`) — Azul cobalto.
- **Liz:** `--owner-liz` (`#ec4899`) — Rosa fucsia.

---

## 3. Escala Espacial y Radios

### Escala de Espaciado (Base 4px)
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
```

### Radios de Borde (Border Radius)
- **Extra pequeño (`--radius-xs`):** `4px` (tooltips, microtags).
- **Insignias y chips (`--radius-badges`, `--radius-sm`):** `6px`.
- **Botones e Inputs (`--radius-inputs`, `--radius-buttons`, `--radius-md`):** `8px`.
- **Tarjetas y Paneles (`--radius-cards`, `--radius-lg`):** `12px`.
- **Modales (`--radius-xl`):** `16px`.
- **Píldoras y Contadores (`--radius-pills`):** `9999px`.

---

## 4. Tipografía y Jerarquía

- **Fuente Principal:** `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Jerarquía:**
  - `H1 / Títulos de Sección:` `28px` a `34px` (`--fs-h1`), peso 700.
  - `H2 / Títulos de Módulo:` `21px` (`--fs-h2`), peso 650.
  - `Valores KPI Financieros:` `22px` (`--fs-kpi-val`), peso 700 monoespaciado para cifras.
  - `Nombre de Cliente / Servicio:` `15.5px` (`--fs-item-name`), peso 600.
  - `Cuerpo de Texto / Contenido:` `14.5px` (`--fs-body`), peso 400.
  - `Etiquetas de Formulario:` `14px` (`--fs-label`), peso 550.
  - `Metadatos y Fechas:` `12.5px` (`--fs-meta`), peso 500.
  - `Insignias de Estado:` `11.5px` (`--fs-small`), peso 600.

---

## 5. Puntos de Interrupción (Breakpoints) y Layout

- **Móvil compacto:** `< 640px`
  - Sidebar oculto; se activa la **Barra de Navegación Inferior Fija** (`.mobile-bottom-nav`) con accesos a *Inicio*, *Suscripciones*, *Clientes* y menú *Más*.
  - Modales ocupan el 100% del ancho y alto con footer sticky.
  - Tablas resumen pasan a disposición vertical compacta en bloque.
- **Tablet / Escritorio Compacto:** `640px` a `1024px`
  - Sidebar contraíble (`--sidebar-collapsed-width: 68px`).
  - Grillas de tarjetas a 2 columnas.
- **Escritorio Estándar:** `> 1024px`
  - Sidebar expandido (`--sidebar-width: 304px`).
  - Grillas de tarjetas a 2-3 columnas fluidas.
  - Panel superior persistente con buscador y acciones principales.

---

## 6. Primitivas de Componentes Reutilizables

1. **Modales (`src/ui/modal.js`):**
   - Backdrop difuminado con desenfoque suave (`backdrop-filter: blur(8px)`).
   - Animación de entrada fluida (`scale(0.95)` a `1` en 180ms).
   - Tamaños normalizados: `sm` (420px), `md` (600px), `lg` (840px), `full`.
2. **Confirmaciones Asíncronas (`src/ui/confirm.js`):**
   - Reemplaza `confirm()` con promesa tipada `Promise<boolean>`.
   - Modos seguro (`info`) y destructivo (`danger` con acento carmesí).
3. **Notificaciones Toasts (`src/ui/toast.js`):**
   - Flotantes en esquina inferior derecha (`z-index: 99999`).
   - Deduplicación de mensajes idénticos simultáneos.
   - Descarte automático con barra de progreso opcional.
4. **Catálogo de Íconos (`src/ui/icons.js`):**
   - SVG vectoriales normalizados a viewBox `24x24`, trazo uniforme `stroke-width="2"`.
