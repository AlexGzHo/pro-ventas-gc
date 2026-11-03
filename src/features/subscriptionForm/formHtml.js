import { escapeHtml, todayISO, addPeriod } from '../../utils.js'
import { ICONS } from '../../ui/icons.js'
import { createFinancialBlock } from './financialBlock.js'
import { renderClientControlHtml } from './clientCombo.js'

/**
 * Renderiza el cuerpo HTML completo del formulario en 3 bloques claros + bloque plegable.
 * Cero atributos style en línea.
 * 
 * @param {Object|null} row - Datos iniciales de la suscripción a editar o null si es nueva
 * @param {Array} products - Lista de productos cargados
 * @param {Array} providers - Lista de proveedores cargados
 * @param {string} extrasText - Texto formateado de campos extra
 * @param {boolean} hasMoreOptionsData - Si hay datos en el bloque plegable
 * @returns {string} Markup HTML
 */
export function renderFormBodyHtml(row, products, providers, extrasText, hasMoreOptionsData) {
  const isEditing = Boolean(row?.id)
  const defaultStartDate = row?.start_date || todayISO()
  const defaultExpiryDate = row?.expiry_date || addPeriod(defaultStartDate, { months: 1 })

  return `
    <form id="subscriptionForm" class="sub-form-container" novalidate autocomplete="off">
      <!-- BLOQUE 1: Cliente y servicio -->
      <section class="sub-form-block">
        <h3 class="sub-form-block-title">
          <span class="sub-block-badge">1</span>
          <span>Cliente y servicio</span>
        </h3>
        <p class="sub-form-block-desc">Selecciona o registra el cliente y asigna el producto o servicio.</p>

        ${renderClientControlHtml(row)}

        <!-- Servicio / Producto -->
        <div class="sub-form-field">
          <label for="subProductId">Servicio / Producto <span class="sub-req">*</span></label>
          <select id="subProductId" name="product_id" required class="form-control">
            <option value="">Seleccione un producto...</option>
            ${products.map(p => `<option value="${p.id}" ${row?.product_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}${!p.active ? ' (Inactivo)' : ''}</option>`).join('')}
          </select>
          <div class="sub-field-error" id="error_product"></div>
        </div>
      </section>

      <!-- BLOQUE 2: Accesos -->
      <section class="sub-form-block">
        <h3 class="sub-form-block-title">
          <span class="sub-block-badge">2</span>
          <span>Accesos</span>
        </h3>
        <p class="sub-form-block-desc">Credenciales de acceso, perfil, PIN y dirección de conexión.</p>

        <div class="sub-form-grid-2">
          <!-- Usuario / Correo con autocompletado ghost -->
          <div class="sub-form-field">
            <label for="subEmailInput">Usuario / correo</label>
            <div class="email-input-wrapper">
              <input type="email" id="subEmailInput" name="username_email" value="${escapeHtml(row?.username_email || '')}" placeholder="usuario@correo.com" autocomplete="off" spellcheck="false">
              <span class="email-ghost" aria-hidden="true"></span>
            </div>
            <div class="sub-field-error" id="error_username_email"></div>
          </div>

          <!-- Contraseña con botón mostrar/ocultar -->
          <div class="sub-form-field">
            <label for="subPasswordInput">Contraseña</label>
            <div class="sub-password-wrap">
              <input type="password" id="subPasswordInput" name="password" value="${escapeHtml(row?.password || '')}" placeholder="Contraseña de la cuenta" autocomplete="off">
              <button type="button" id="subTogglePwdBtn" class="sub-password-toggle" title="Mostrar/ocultar contraseña" aria-label="Mostrar u ocultar contraseña">
                ${ICONS.key || ''}
              </button>
            </div>
            <div class="sub-field-error" id="error_password"></div>
          </div>
        </div>

        <div class="sub-form-grid-3">
          <div class="sub-form-field">
            <label for="subProfileInput">Perfil</label>
            <input type="text" id="subProfileInput" name="profile" value="${escapeHtml(row?.profile || '')}" placeholder="Ej. Perfil 1">
          </div>
          <div class="sub-form-field">
            <label for="subPinInput">PIN</label>
            <input type="text" id="subPinInput" name="pin" value="${escapeHtml(row?.pin || '')}" placeholder="Ej. 1234">
          </div>
          <div class="sub-form-field">
            <label for="subAccessUrlInput">URL de acceso</label>
            <input type="url" id="subAccessUrlInput" name="access_url" value="${escapeHtml(row?.access_url || '')}" placeholder="https://...">
          </div>
        </div>
      </section>

      <!-- BLOQUE 3: Fechas y montos -->
      <section class="sub-form-block">
        <h3 class="sub-form-block-title">
          <span class="sub-block-badge">3</span>
          <span>Fechas y montos</span>
        </h3>
        <p class="sub-form-block-desc">Vigencia del servicio, importes de venta y costo, y proveedor asociado.</p>

        <div class="sub-form-grid-2">
          <!-- Fecha de inicio -->
          <div class="sub-form-field">
            <label for="subStartDate">Fecha de inicio <span class="sub-req">*</span></label>
            <input type="date" id="subStartDate" name="start_date" value="${defaultStartDate}" required>
            <div class="sub-field-error" id="error_start_date"></div>
          </div>

          <!-- Fecha de vencimiento con botones rápidos al crear -->
          <div class="sub-form-field">
            <label for="subExpiryDate">Fecha de vencimiento <span class="sub-req">*</span></label>
            <input type="date" id="subExpiryDate" name="expiry_date" value="${defaultExpiryDate}" required>
            ${!isEditing ? `
              <div class="sub-period-shortcuts">
                <button type="button" class="sub-period-btn" data-months="1">+ 1 mes</button>
                <button type="button" class="sub-period-btn" data-months="3">+ 3 meses</button>
                <button type="button" class="sub-period-btn" data-months="6">+ 6 meses</button>
                <button type="button" class="sub-period-btn" data-months="12">+ 12 meses</button>
              </div>
            ` : ''}
            <div class="sub-field-error" id="error_expiry_date"></div>
          </div>
        </div>

        <!-- Precio de venta -->
        <div class="sub-form-field">
          ${createFinancialBlock('sale', 'Precio de venta', row)}
          <div id="subSuggestedPriceHint" class="sub-suggested-price-hint"></div>
          <div class="sub-field-error" id="error_sale_price"></div>
        </div>

        <!-- Costo mayorista -->
        <div class="sub-form-field">
          ${createFinancialBlock('cost', 'Costo mayorista', row)}
          <div class="sub-field-error" id="error_cost"></div>
        </div>

        <!-- Proveedor -->
        <div class="sub-form-field">
          <label for="subProviderSelect">Proveedor mayorista</label>
          <select id="subProviderSelect" name="provider_id" class="form-control">
            <option value="">Ninguno (Propio)</option>
            ${providers.map(p => `<option value="${p.id}" ${row?.provider_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>

        <!-- Resumen Financiero en Vivo -->
        <div class="sub-financial-summary">
          <div class="sub-summary-item">
            <span class="sub-summary-label">Venta</span>
            <span class="sub-summary-val" id="summary_sale">S/ 0.00</span>
          </div>
          <div class="sub-summary-item">
            <span class="sub-summary-label">Costo</span>
            <span class="sub-summary-val" id="summary_cost">S/ 0.00</span>
          </div>
          <div class="sub-summary-item">
            <span class="sub-summary-label">Ganancia estimada</span>
            <span class="sub-summary-val sub-profit-positive" id="summary_profit">S/ 0.00</span>
          </div>
        </div>
      </section>

      <!-- BLOQUE PLEGABLE: Más opciones -->
      <details class="sub-collapsible-block" id="subMoreOptions" ${hasMoreOptionsData ? 'open' : ''}>
        <summary class="sub-collapsible-summary">
          <div class="sub-collapsible-left">
            <span class="sub-collapsible-title">Más opciones</span>
            <span class="sub-collapsible-hint">Vencimiento del proveedor, campos extra y notas</span>
          </div>
          <span class="sub-collapsible-chevron">${ICONS.chevronDown || ''}</span>
        </summary>

        <div class="sub-collapsible-body">
          <div class="sub-form-field">
            <label for="subProviderExpiryDate">Vencimiento del proveedor</label>
            <input type="date" id="subProviderExpiryDate" name="provider_expiry_date" value="${row?.provider_expiry_date || ''}">
            <div class="sub-field-error" id="error_provider_expiry_date"></div>
          </div>

          <div class="sub-form-field">
            <label for="subExtrasText">Campos extra <span class="sub-hint">(Formato Clave: Valor)</span></label>
            <textarea id="subExtrasText" name="extras_text" rows="3" placeholder="Plan: Familiar&#10;Dispositivos: 4&#10;Servidor: Principal">${escapeHtml(extrasText)}</textarea>
          </div>

          <div class="sub-form-field">
            <label for="subNotesText">Notas internas</label>
            <textarea id="subNotesText" name="notes" rows="3" placeholder="Observaciones, acuerdos especiales o preferencias del cliente...">${escapeHtml(row?.notes || '')}</textarea>
          </div>
        </div>
      </details>
    </form>
  `
}
