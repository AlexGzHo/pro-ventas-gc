import { escapeHtml, todayISO, addPeriod, formatDate } from '../../utils.js'
import { ICONS } from '../../ui/icons.js'
import { createFinancialBlock } from './financialBlock.js'
import { renderClientControlHtml } from './clientCombo.js'
import { renderProductControlHtml } from './productCombo.js'

/** Conserva los nombres de campo del contrato de guardado. */
export function renderFormBodyHtml(row, products, providers, extrasText, hasMoreOptionsData) {
  const defaultStartDate = row?.start_date || todayISO()
  const defaultExpiryDate = row?.expiry_date || addPeriod(defaultStartDate, { months: 1 })

  return `
    <form id="subscriptionForm" class="sub-form-container" novalidate autocomplete="off">
      ${renderClientControlHtml(row)}
      ${renderProductControlHtml(row, products)}
      <div class="sub-form-field field">
        <label id="subDurationLabel">Duración</label>
        <div class="sub-period-shortcuts" role="group" aria-labelledby="subDurationLabel">
          ${[1, 3, 6, 12].map(months => `<button type="button" class="chip sub-period-btn" data-months="${months}" aria-pressed="false">${months} ${months === 1 ? 'mes' : 'meses'}</button>`).join('')}
        </div>
        <details class="sub-date-details" id="subDateDetails">
          <summary><span id="subExpirySummary">Vence el ${formatDate(defaultExpiryDate)}</span> · Cambiar fechas</summary>
          <div class="sub-form-grid-2 sub-date-fields">
            <div class="sub-form-field field">
              <label for="subStartDate">Inicio <span class="sub-req">*</span></label>
              <input type="date" id="subStartDate" name="start_date" value="${defaultStartDate}" required>
              <div class="sub-field-error" id="error_start_date" aria-live="polite"></div>
            </div>
            <div class="sub-form-field field">
              <label for="subExpiryDate">Vencimiento <span class="sub-req">*</span></label>
              <input type="date" id="subExpiryDate" name="expiry_date" value="${defaultExpiryDate}" required>
              <div class="sub-field-error" id="error_expiry_date" aria-live="polite"></div>
            </div>
          </div>
        </details>
      </div>
      <div class="sub-form-grid-2">
        <div class="sub-form-field field">
          ${createFinancialBlock('sale', 'Precio de venta', row)}
          <div id="subSuggestedPriceHint" class="sub-suggested-price-hint"></div>
          <div class="sub-field-error" id="error_sale_price" aria-live="polite"></div>
        </div>
        <div class="sub-form-field field">
          ${createFinancialBlock('cost', 'Costo', row)}
          <div class="sub-field-error" id="error_cost" aria-live="polite"></div>
        </div>
      </div>
      <div class="sub-profit-line"><span>Ganancia</span><strong id="summary_profit" class="sub-profit-positive">S/ 0.00</strong></div>
      <div class="sub-form-grid-2">
        <div class="sub-form-field field">
          <label for="subEmailInput">Usuario/correo</label>
          <div class="email-input-wrapper">
            <input type="text" id="subEmailInput" name="username_email" value="${escapeHtml(row?.username_email || '')}" placeholder="usuario@correo.com" autocomplete="off" spellcheck="false">
            <span class="email-ghost" aria-hidden="true"></span>
          </div>
          <div class="sub-field-error" id="error_username_email" aria-live="polite"></div>
        </div>
        <div class="sub-form-field field">
          <label for="subPasswordInput">Contraseña</label>
          <div class="sub-password-wrap">
            <input type="password" id="subPasswordInput" name="password" value="${escapeHtml(row?.password || '')}" autocomplete="new-password">
            <button type="button" id="subTogglePwdBtn" class="btn btn-ghost sub-password-toggle" aria-label="Mostrar contraseña" aria-pressed="false">${ICONS.key}</button>
          </div>
          <div class="sub-field-error" id="error_password" aria-live="polite"></div>
        </div>
      </div>
      <div class="sub-form-grid-2">
        <div class="sub-form-field field">
          <label for="subProfileInput">Perfil</label>
          <input type="text" id="subProfileInput" name="profile" value="${escapeHtml(row?.profile || '')}" placeholder="Perfil 1">
        </div>
        <div class="sub-form-field field">
          <label for="subPinInput">PIN</label>
          <input type="text" id="subPinInput" name="pin" value="${escapeHtml(row?.pin || '')}" placeholder="1234">
        </div>
      </div>
      <details class="sub-collapsible-block" id="subMoreOptions" ${hasMoreOptionsData ? 'open' : ''}>
        <summary class="sub-collapsible-summary"><span class="sub-collapsible-title">Más detalles</span><span class="sub-collapsible-chevron">${ICONS.chevronDown}</span></summary>
        <div class="sub-collapsible-body">
          <div class="sub-form-field field">
            <label for="subAccessUrlInput">URL de acceso</label>
            <input type="url" id="subAccessUrlInput" name="access_url" value="${escapeHtml(row?.access_url || '')}" placeholder="https://...">
          </div>
          <div class="sub-form-field field">
            <label for="subProviderSelect">Proveedor</label>
            <select id="subProviderSelect" name="provider_id">
              <option value="">Ninguno (Propio)</option>
              ${providers.map(p => `<option value="${p.id}" ${row?.provider_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="sub-form-field field">
            <label for="subProviderExpiryDate">Vencimiento del proveedor</label>
            <input type="date" id="subProviderExpiryDate" name="provider_expiry_date" value="${row?.provider_expiry_date || ''}">
            <div class="sub-field-error" id="error_provider_expiry_date" aria-live="polite"></div>
          </div>
          <div class="sub-form-field field">
            <label for="subExtrasText">Campos extra <span class="sub-hint">(Clave: Valor)</span></label>
            <textarea id="subExtrasText" name="extras_text" rows="3" placeholder="Plan: Familiar">${escapeHtml(extrasText)}</textarea>
          </div>
          <div class="sub-form-field field">
            <label for="subNotesText">Notas internas</label>
            <textarea id="subNotesText" name="notes" rows="3">${escapeHtml(row?.notes || '')}</textarea>
          </div>
        </div>
      </details>
    </form>
  `
}
