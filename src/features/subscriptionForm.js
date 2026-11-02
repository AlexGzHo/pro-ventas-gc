import { supabase } from '../supabase.js'
import {
  escapeHtml,
  formatDate,
  todayISO,
  addPeriod,
  normalizeCurrency
} from '../utils.js'
import { parseWhatsAppContact, getWhatsAppUrl } from '../whatsapp.js'
import { toast } from '../ui/toast.js'
import { openModal } from '../ui/modal.js'
import { ICONS } from '../ui/icons.js'
import {
  state,
  loadProducts,
  loadClients,
  loadProviders,
  loadRows
} from '../state.js'

/**
 * Genera el markup HTML del bloque financiero para precio de venta o costo mayorista.
 * Cero atributos style en línea.
 * 
 * @param {'sale'|'cost'} prefix - Prefijo de campo ('sale' o 'cost')
 * @param {string} title - Título visible del bloque
 * @param {Object|null} row - Datos iniciales de la suscripción
 * @returns {string} Markup HTML
 */
export function createFinancialBlock(prefix, title, row) {
  const price = row?.[prefix + '_price'] ?? (prefix === 'cost' ? row?.cost : null) ?? ''
  const currency = row?.[prefix + '_price_currency'] ?? (prefix === 'cost' ? row?.cost_currency : null) ?? 'PEN'
  const rate = row?.[prefix + '_price_exchange_rate'] ?? (prefix === 'cost' ? row?.cost_exchange_rate : null) ?? ''
  const isUsdt = currency === 'USDT'

  return `
    <div class="financial-group">
      <label for="${prefix}_price_input">${title}</label>

      <div class="financial-input-row">
        <span class="currency-prefix" id="${prefix}_prefix">${isUsdt ? 'USDT' : 'S/'}</span>
        <input id="${prefix}_price_input" name="${prefix === 'sale' ? 'sale_price' : 'cost'}" type="number" inputmode="decimal" min="0" step="0.01" value="${price}" placeholder="0.00" autocomplete="off">

        <div class="segmented-control" role="radiogroup">
          <input type="radio" class="sr-only" id="${prefix}_pen" name="${prefix === 'sale' ? 'sale_price_currency' : 'cost_currency'}" value="PEN" ${!isUsdt ? 'checked' : ''}>
          <label for="${prefix}_pen">PEN</label>

          <input type="radio" class="sr-only" id="${prefix}_usdt" name="${prefix === 'sale' ? 'sale_price_currency' : 'cost_currency'}" value="USDT" ${isUsdt ? 'checked' : ''}>
          <label for="${prefix}_usdt">USDT</label>
        </div>
      </div>

      <div class="financial-subrow-grid">
        <div id="${prefix}_pen_info" class="subrow-state state-pen ${!isUsdt ? 'active' : ''}">
          <span>Equivalente</span>
          <strong class="equiv-amount" id="${prefix}_equiv_pen">S/ 0.00</strong>
        </div>

        <div id="${prefix}_usdt_info" class="subrow-state state-usdt ${isUsdt ? 'active' : ''}">
          <span class="tc-wrapper">
            TC 1 USDT = S/
            <input name="${prefix === 'sale' ? 'sale_price_exchange_rate' : 'cost_exchange_rate'}" type="number" class="tc-input" inputmode="decimal" step="0.0001" value="${rate}" placeholder="3.75">
          </span>
          <strong class="equiv-amount" id="${prefix}_equiv_usdt">Ingresa el tipo de cambio</strong>
        </div>
      </div>
      ${prefix === 'cost' ? '<button type="button" id="copy_tc_btn" class="btn btn-small btn-ghost copy-tc-btn sub-hidden">Copiar TC de venta</button>' : ''}
    </div>
  `
}

/**
 * Vincula los eventos de recálculo dinámico de divisas en tiempo real.
 * 
 * @param {HTMLFormElement|HTMLElement} form - Formulario o contenedor que contiene los bloques financieros
 */
export function bindFinancialEvents(form) {
  const saleInput = form.querySelector('input[name="sale_price"]')
  const costInput = form.querySelector('input[name="cost"]')
  const saleTCR = form.querySelector('input[name="sale_price_exchange_rate"]')
  const costTCR = form.querySelector('input[name="cost_exchange_rate"]')
  const copyBtn = form.querySelector('#copy_tc_btn')

  function update() {
    const saleVal = Number(saleInput?.value) || 0
    const costVal = Number(costInput?.value) || 0
    const saleC = form.querySelector('input[name="sale_price_currency"]:checked')?.value || 'PEN'
    const costC = form.querySelector('input[name="cost_currency"]:checked')?.value || 'PEN'

    const salePrefix = form.querySelector('#sale_prefix')
    const costPrefix = form.querySelector('#cost_prefix')
    if (salePrefix) salePrefix.textContent = saleC === 'USDT' ? 'USDT' : 'S/'
    if (costPrefix) costPrefix.textContent = costC === 'USDT' ? 'USDT' : 'S/'

    form.querySelector('#sale_pen_info')?.classList.toggle('active', saleC === 'PEN')
    form.querySelector('#sale_usdt_info')?.classList.toggle('active', saleC === 'USDT')

    form.querySelector('#cost_pen_info')?.classList.toggle('active', costC === 'PEN')
    form.querySelector('#cost_usdt_info')?.classList.toggle('active', costC === 'USDT')

    if (copyBtn) {
      copyBtn.classList.toggle('sub-hidden', !(saleC === 'USDT' && costC === 'USDT'))
    }

    const saleTC = Number(saleTCR?.value) || 0
    const costTC = Number(costTCR?.value) || 0

    const salePenCalc = saleC === 'PEN' ? saleVal : (saleTC > 0 ? saleVal * saleTC : 0)
    const costPenCalc = costC === 'PEN' ? costVal : (costTC > 0 ? costVal * costTC : 0)

    const saleEquivPen = form.querySelector('#sale_equiv_pen')
    if (saleEquivPen) saleEquivPen.textContent = 'S/ ' + salePenCalc.toFixed(2)

    const saleEquivUsdt = form.querySelector('#sale_equiv_usdt')
    if (saleEquivUsdt && saleC === 'USDT') {
      saleEquivUsdt.textContent = saleTC > 0 ? '≈ S/ ' + salePenCalc.toFixed(2) : 'Ingresa el tipo de cambio'
    }

    const costEquivPen = form.querySelector('#cost_equiv_pen')
    if (costEquivPen) costEquivPen.textContent = 'S/ ' + costPenCalc.toFixed(2)

    const costEquivUsdt = form.querySelector('#cost_equiv_usdt')
    if (costEquivUsdt && costC === 'USDT') {
      costEquivUsdt.textContent = costTC > 0 ? '≈ S/ ' + costPenCalc.toFixed(2) : 'Ingresa el tipo de cambio'
    }

    const summarySale = form.querySelector('#summary_sale')
    const summaryCost = form.querySelector('#summary_cost')
    const summaryProfit = form.querySelector('#summary_profit')

    if (summarySale) summarySale.textContent = 'S/ ' + salePenCalc.toFixed(2)
    if (summaryCost) summaryCost.textContent = 'S/ ' + costPenCalc.toFixed(2)
    if (summaryProfit) {
      const profit = salePenCalc - costPenCalc
      summaryProfit.textContent = 'S/ ' + profit.toFixed(2)
      summaryProfit.classList.toggle('sub-profit-positive', profit >= 0)
      summaryProfit.classList.toggle('sub-profit-negative', profit < 0)
    }
  }

  form.addEventListener('input', update)
  form.addEventListener('change', update)
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (costTCR && saleTCR) {
        costTCR.value = saleTCR.value
        update()
      }
    })
  }
  update()
}

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
function renderFormBodyHtml(row, products, providers, extrasText, hasMoreOptionsData) {
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

        <!-- Control Combinado: Buscar o Crear Cliente -->
        <div class="sub-form-field">
          <label>Cliente <span class="sub-req">*</span></label>
          <div class="sub-client-control" id="subClientControl">
            <!-- Tarjeta de cliente seleccionado -->
            <div id="subClientCard" class="sub-client-card sub-hidden">
              <div class="sub-client-avatar" id="subClientAvatar">CL</div>
              <div class="sub-client-meta">
                <span class="sub-client-name" id="subClientName">Nombre</span>
                <div class="sub-client-contact" id="subClientContact"></div>
              </div>
              <button type="button" id="subClientChangeBtn" class="btn btn-small btn-ghost sub-client-change-btn">
                ${ICONS.edit || ''} <span>Cambiar</span>
              </button>
            </div>

            <!-- Buscador combinado de cliente -->
            <div id="subClientSearchWrap" class="sub-client-search-wrap">
              <div class="sub-client-search-field">
                <span class="sub-client-search-icon">${ICONS.search}</span>
                <input type="text" id="subClientSearchInput" class="sub-client-search-input" placeholder="Buscar o crear cliente (nombre o WhatsApp)..." autocomplete="off">
                <button type="button" id="subClientClearBtn" class="sub-client-clear-btn sub-hidden" title="Limpiar búsqueda">${ICONS.close}</button>
              </div>
              <div id="subClientDropdown" class="sub-client-dropdown sub-hidden" role="listbox"></div>
            </div>

            <!-- Formulario inline para nuevo cliente -->
            <div id="subClientInlineCreate" class="sub-client-inline-create sub-hidden">
              <div class="sub-inline-header">
                <span class="sub-inline-title">${ICONS.plus || ''} Registrar nuevo cliente</span>
                <button type="button" id="subClientCancelCreateBtn" class="btn btn-small btn-ghost">Cancelar</button>
              </div>
              <div class="sub-form-grid-2">
                <div class="sub-form-field">
                  <label for="subNewClientName">Nombre completo <span class="sub-req">*</span></label>
                  <input type="text" id="subNewClientName" name="new_client_name" placeholder="Ej. Juan Pérez" autocomplete="off">
                  <div class="sub-field-error" id="error_new_client_name"></div>
                </div>
                <div class="sub-form-field">
                  <label for="subNewClientPhone">WhatsApp (Teléfono o @usuario)</label>
                  <input type="text" id="subNewClientPhone" name="new_client_phone" placeholder="Ej. 987654321 o @usuario" autocomplete="off">
                  <div class="sub-field-error" id="error_new_client_phone"></div>
                </div>
              </div>

              <!-- Detección de duplicados -->
              <div id="subClientDuplicateBox" class="sub-duplicate-alert sub-hidden">
                <div class="sub-duplicate-title">${ICONS.warning || ''} Coincidencia con clientes existentes:</div>
                <div id="subClientDuplicateList" class="sub-duplicate-list"></div>
              </div>
            </div>

            <input type="hidden" name="client_id" id="subClientIdHidden" value="${row?.client_id || ''}">
            <div class="sub-field-error" id="error_client"></div>
          </div>
        </div>

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

/**
 * Inicializa e interconecta todos los comportamientos del formulario de suscripción.
 * 
 * @param {HTMLElement} rootEl - Contenedor raíz o elemento del modal
 * @param {Object} options - Opciones de configuración
 * @param {Object|null} options.row - Fila de suscripción si se está editando
 * @param {Function} [options.onClose] - Callback al cerrar
 * @param {Function} [options.onSuccess] - Callback al guardar con éxito
 */
function setupSubscriptionFormLogic(rootEl, { row = null, onClose = null, onSuccess = null } = {}) {
  const form = rootEl.querySelector('#subscriptionForm')
  if (!form) return

  const isEditing = Boolean(row?.id)
  const idempotencyKey = isEditing ? null : crypto.randomUUID()
  let isSubmitting = false

  // Elementos de Cliente
  const clientCard = form.querySelector('#subClientCard')
  const clientAvatar = form.querySelector('#subClientAvatar')
  const clientNameEl = form.querySelector('#subClientName')
  const clientContactEl = form.querySelector('#subClientContact')
  const clientChangeBtn = form.querySelector('#subClientChangeBtn')

  const clientSearchWrap = form.querySelector('#subClientSearchWrap')
  const clientSearchInput = form.querySelector('#subClientSearchInput')
  const clientClearBtn = form.querySelector('#subClientClearBtn')
  const clientDropdown = form.querySelector('#subClientDropdown')

  const clientInlineCreate = form.querySelector('#subClientInlineCreate')
  const newClientNameInput = form.querySelector('#subNewClientName')
  const newClientPhoneInput = form.querySelector('#subNewClientPhone')
  const clientCancelCreateBtn = form.querySelector('#subClientCancelCreateBtn')

  const duplicateBox = form.querySelector('#subClientDuplicateBox')
  const duplicateList = form.querySelector('#subClientDuplicateList')
  const clientIdHidden = form.querySelector('#subClientIdHidden')

  let selectedClientId = row?.client_id || null
  let isCreatingInline = false
  let searchHighlightIdx = -1

  // Elementos de Servicio y Proveedor
  const productSelect = form.querySelector('#subProductId')
  const providerSelect = form.querySelector('#subProviderSelect')
  const suggestedHint = form.querySelector('#subSuggestedPriceHint')

  // Fechas
  const startDateInput = form.querySelector('#subStartDate')
  const expiryDateInput = form.querySelector('#subExpiryDate')
  const quickPeriodBtns = form.querySelectorAll('.sub-period-btn')

  // Contraseña
  const pwdInput = form.querySelector('#subPasswordInput')
  const togglePwdBtn = form.querySelector('#subTogglePwdBtn')

  // Email ghost autocomplete
  const emailInput = form.querySelector('#subEmailInput')
  const ghostEl = form.querySelector('.email-ghost')

  // Cache de dominios de email
  const emailDomains = new Set(['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com'])
  ;(state.rows || []).forEach(s => {
    const email = s.username_email
    if (email && email.includes('@')) {
      const domain = email.split('@')[1]?.toLowerCase()
      if (domain) emailDomains.add(`@${domain}`)
    }
  })
  const cachedEmailDomains = [...emailDomains].sort()

  // --- 1. Gestión del Cliente ---
  function getActiveSubsCount(clientId) {
    if (!clientId) return 0
    return (state.rows || []).filter(s => s.client_id === clientId && !s.archived_at).length
  }

  function updateClientUI() {
    if (selectedClientId) {
      const client = (state.clients || []).find(c => c.id === selectedClientId)
      if (client) {
        const initials = (client.name || 'CL').trim().substring(0, 2).toUpperCase()
        clientAvatar.textContent = initials
        clientNameEl.textContent = client.name

        const parsedContact = client.phone ? parseWhatsAppContact(client.phone) : null
        const waUrl = parsedContact?.isValid ? getWhatsAppUrl(client.phone) : ''
        const isUserContact = parsedContact?.type === 'username' || (client.phone || '').startsWith('@')
        const activeCount = getActiveSubsCount(client.id)

        clientContactEl.innerHTML = `
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer">
              ${isUserContact ? '' : (ICONS.phone || '')}
              <span>${escapeHtml(client.phone)}</span>
            </a>
          ` : (client.phone ? `<span>${escapeHtml(client.phone)}</span>` : '<span class="sub-hint">Sin teléfono</span>')}
          <span class="sub-hint">· ${activeCount} suscripción(es)</span>
        `

        clientCard.classList.remove('sub-hidden')
        clientSearchWrap.classList.add('sub-hidden')
        clientInlineCreate.classList.add('sub-hidden')
        clientIdHidden.value = client.id
        clearFieldError('client')
        return
      }
    }

    clientCard.classList.add('sub-hidden')
    clientIdHidden.value = ''

    if (isCreatingInline) {
      clientSearchWrap.classList.add('sub-hidden')
      clientInlineCreate.classList.remove('sub-hidden')
    } else {
      clientSearchWrap.classList.remove('sub-hidden')
      clientInlineCreate.classList.add('sub-hidden')
    }
  }

  function selectClient(id) {
    selectedClientId = id
    isCreatingInline = false
    clientSearchInput.value = ''
    clientDropdown.classList.add('sub-hidden')
    updateClientUI()
  }

  function renderClientSearchResults() {
    searchHighlightIdx = -1
    const q = (clientSearchInput.value || '').trim().toLowerCase()
    const clients = state.clients || []

    const matches = clients.filter(c => {
      if (!q) return true
      return (c.name || '').toLowerCase().includes(q) ||
             (c.phone || '').toLowerCase().includes(q) ||
             (c.notes || '').toLowerCase().includes(q)
    }).slice(0, 8)

    let html = ''

    if (matches.length === 0 && !q) {
      clientDropdown.classList.add('sub-hidden')
      return
    }

    if (matches.length === 0) {
      html += `<div class="sub-dropdown-empty">No se encontraron clientes existentes para "${escapeHtml(q)}".</div>`
    } else {
      html += matches.map((c, idx) => {
        const count = getActiveSubsCount(c.id)
        return `
          <div class="sub-client-dropdown-item" data-id="${c.id}" data-idx="${idx}" role="option">
            <div class="sub-dropdown-item-info">
              <span class="sub-dropdown-item-name">${escapeHtml(c.name)}</span>
              <span class="sub-dropdown-item-contact">${c.phone ? escapeHtml(c.phone) : 'Sin teléfono'}</span>
            </div>
            <div class="sub-dropdown-item-meta">
              <span class="sub-dropdown-item-badge">${count} sub(s)</span>
              <button type="button" class="btn btn-small btn-ghost">Elegir</button>
            </div>
          </div>
        `
      }).join('')
    }

    // Opción para crear cliente con el texto escrito
    if (q.length >= 2) {
      html += `
        <div class="sub-dropdown-create-item" data-action="create-new" role="button">
          ${ICONS.plus || ''}
          <span>Crear cliente "<strong>${escapeHtml(q)}</strong>" (desplegar teléfono)</span>
        </div>
      `
    }

    clientDropdown.innerHTML = html
    clientDropdown.classList.remove('sub-hidden')
  }

  clientSearchInput.addEventListener('input', () => {
    clientClearBtn.classList.toggle('sub-hidden', !clientSearchInput.value)
    renderClientSearchResults()
  })

  clientSearchInput.addEventListener('focus', () => {
    renderClientSearchResults()
  })

  clientClearBtn.addEventListener('click', () => {
    clientSearchInput.value = ''
    clientClearBtn.classList.add('sub-hidden')
    clientDropdown.classList.add('sub-hidden')
    clientSearchInput.focus()
  })

  clientDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.sub-client-dropdown-item')
    if (item && item.dataset.id) {
      selectClient(item.dataset.id)
      return
    }

    const createBtn = e.target.closest('.sub-dropdown-create-item')
    if (createBtn) {
      const q = (clientSearchInput.value || '').trim()
      isCreatingInline = true
      selectedClientId = null
      updateClientUI()
      newClientNameInput.value = q
      newClientPhoneInput.value = ''
      checkClientDuplicates()
      newClientPhoneInput.focus()
    }
  })

  clientChangeBtn.addEventListener('click', () => {
    selectedClientId = null
    isCreatingInline = false
    clientSearchInput.value = ''
    updateClientUI()
    clientSearchInput.focus()
  })

  clientCancelCreateBtn.addEventListener('click', () => {
    isCreatingInline = false
    newClientNameInput.value = ''
    newClientPhoneInput.value = ''
    duplicateBox.classList.add('sub-hidden')
    updateClientUI()
    clientSearchInput.focus()
  })

  // Detección de duplicados al crear cliente inline
  function checkClientDuplicates() {
    const nameVal = (newClientNameInput.value || '').trim().toLowerCase()
    const rawPhone = (newClientPhoneInput.value || '').trim()
    const parsedPhone = rawPhone ? parseWhatsAppContact(rawPhone) : null
    const isUserSearch = parsedPhone?.type === 'username' || rawPhone.startsWith('@')
    const phoneVal = isUserSearch
      ? rawPhone.replace(/^@+/, '').trim().toLowerCase()
      : rawPhone.replace(/\D/g, '')

    const minPhoneLen = isUserSearch ? 3 : 4
    if ((!nameVal || nameVal.length < 2) && (!phoneVal || phoneVal.length < minPhoneLen)) {
      duplicateBox.classList.add('sub-hidden')
      duplicateList.innerHTML = ''
      return
    }

    const matches = (state.clients || []).filter(c => {
      const cName = (c.name || '').toLowerCase()
      const cRawPhone = (c.phone || '').trim()

      const nameMatch = nameVal.length >= 2 && cName.includes(nameVal)
      let phoneMatch = false
      if (phoneVal && phoneVal.length >= minPhoneLen) {
        if (isUserSearch) {
          phoneMatch = cRawPhone.toLowerCase().includes(phoneVal)
        } else {
          const cDigits = cRawPhone.replace(/\D/g, '')
          phoneMatch = cDigits.length >= 4 && cDigits.includes(phoneVal)
        }
      }
      return nameMatch || phoneMatch
    }).slice(0, 3)

    if (matches.length === 0) {
      duplicateBox.classList.add('sub-hidden')
      duplicateList.innerHTML = ''
      return
    }

    duplicateList.innerHTML = matches.map(c => `
      <div class="sub-duplicate-item">
        <span>• <strong>${escapeHtml(c.name)}</strong> ${c.phone ? `(${escapeHtml(c.phone)})` : ''}</span>
        <button type="button" class="sub-duplicate-use-btn" data-id="${c.id}">
          Usar este cliente
        </button>
      </div>
    `).join('')

    duplicateList.querySelectorAll('.sub-duplicate-use-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectClient(btn.dataset.id)
        toast('Cliente seleccionado de la lista existente.')
      })
    })

    duplicateBox.classList.remove('sub-hidden')
  }

  newClientNameInput.addEventListener('input', () => {
    clearFieldError('new_client_name')
    checkClientDuplicates()
  })

  newClientPhoneInput.addEventListener('input', () => {
    clearFieldError('new_client_phone')
    checkClientDuplicates()
  })

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#subClientSearchWrap')) {
      clientDropdown.classList.add('sub-hidden')
    }
  })

  // --- 2. Sugerencias desde Catálogo (applyProductSuggestion) ---
  let lastAppliedProductId = row?.product_id || ''

  function applyProductSuggestion() {
    const currentVal = productSelect.value || ''
    clearFieldError('product')

    if (!currentVal) {
      lastAppliedProductId = ''
      if (suggestedHint) suggestedHint.textContent = ''
      return
    }
    if (currentVal === lastAppliedProductId) return
    lastAppliedProductId = currentVal

    const prod = (state.products || []).find(p => p.id === currentVal)
    if (!prod) {
      if (suggestedHint) suggestedHint.textContent = ''
      return
    }

    const saleInput = form.querySelector('input[name="sale_price"]')
    const costInput = form.querySelector('input[name="cost"]')

    if (saleInput && prod.sale_price != null) {
      saleInput.value = prod.sale_price
    }
    if (costInput && prod.default_cost != null) {
      costInput.value = prod.default_cost
    }

    if (suggestedHint) {
      if (prod.sale_price != null) {
        const symbol = prod.currency === 'USDT' ? 'USDT ' : 'S/ '
        suggestedHint.textContent = `Precio sugerido en catálogo: ${symbol}${prod.sale_price}`
      } else {
        suggestedHint.textContent = ''
      }
    }

    if (providerSelect && prod.provider_id) {
      providerSelect.value = prod.provider_id
    }

    const saleCurrencyPen = form.querySelector('#sale_pen')
    const saleCurrencyUsdt = form.querySelector('#sale_usdt')
    const costCurrencyPen = form.querySelector('#cost_pen')
    const costCurrencyUsdt = form.querySelector('#cost_usdt')

    if (prod.currency === 'USDT') {
      if (saleCurrencyUsdt) saleCurrencyUsdt.checked = true
      if (costCurrencyUsdt) costCurrencyUsdt.checked = true
    } else {
      if (saleCurrencyPen) saleCurrencyPen.checked = true
      if (costCurrencyPen) costCurrencyPen.checked = true
    }

    // Duración sugerida desde el catálogo
    if (prod.default_period_value && prod.default_period_unit) {
      const pVal = Number(prod.default_period_value)
      const pUnit = String(prod.default_period_unit).toLowerCase().trim()
      let days = 0
      let months = 0

      if (pUnit.includes('day') || pUnit.includes('dia') || pUnit === 'd') {
        days = pVal
      } else if (pUnit.includes('month') || pUnit.includes('mes') || pUnit === 'm') {
        months = pVal
      } else if (pUnit.includes('year') || pUnit.includes('año') || pUnit === 'y') {
        months = pVal * 12
      }

      if (days > 0 || months > 0) {
        const baseStart = startDateInput.value || todayISO()
        expiryDateInput.value = addPeriod(baseStart, { days, months })
      }
    }

    form.dispatchEvent(new Event('input'))
  }

  productSelect.addEventListener('change', applyProductSuggestion)

  // --- 3. Botones Rápidos de Vencimiento ---
  quickPeriodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const months = parseInt(btn.dataset.months || '1', 10)
      const baseStart = startDateInput.value || todayISO()
      expiryDateInput.value = addPeriod(baseStart, { months })
      clearFieldError('expiry_date')
      form.dispatchEvent(new Event('input'))
    })
  })

  // --- 4. Password Toggle ---
  if (togglePwdBtn && pwdInput) {
    let isPwdVisible = false
    togglePwdBtn.addEventListener('click', () => {
      isPwdVisible = !isPwdVisible
      pwdInput.type = isPwdVisible ? 'text' : 'password'
    })
  }

  // --- 5. Autocompletado Ghost para Email ---
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')

  function findDomainSuggestion(val) {
    const atIndex = val.indexOf('@')
    if (atIndex === -1) return ''
    const typed = val.slice(atIndex + 1).toLowerCase()
    if (!typed) return ''
    for (const d of cachedEmailDomains) {
      const dom = d.slice(1)
      if (dom.startsWith(typed) && dom !== typed) {
        return dom.slice(typed.length)
      }
    }
    return ''
  }

  function updateGhostDomain() {
    if (!emailInput || !ghostEl) return
    const val = emailInput.value
    const suggestion = findDomainSuggestion(val)

    if (!suggestion) {
      ghostEl.textContent = ''
      return
    }

    const cs = getComputedStyle(emailInput)
    ghostEl.style.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    ghostEl.style.lineHeight = cs.lineHeight
    ghostEl.style.letterSpacing = cs.letterSpacing
    ghostEl.style.paddingTop = cs.paddingTop
    ghostEl.style.paddingBottom = cs.paddingBottom

    measureCtx.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const baseWidth = measureCtx.measureText(val).width
    const paddingLeft = parseFloat(cs.paddingLeft) || 0
    const scrollLeft = emailInput.scrollLeft

    const left = paddingLeft + baseWidth - scrollLeft
    ghostEl.textContent = suggestion
    ghostEl.style.left = `${left}px`
    ghostEl.style.width = `${Math.max(0, emailInput.clientWidth - left)}px`
  }

  emailInput?.addEventListener('input', updateGhostDomain)
  emailInput?.addEventListener('scroll', updateGhostDomain)
  emailInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const suggestion = findDomainSuggestion(emailInput.value)
      if (suggestion) {
        e.preventDefault()
        emailInput.value = emailInput.value + suggestion
        ghostEl.textContent = ''
        updateGhostDomain()
      }
    }
  })
  emailInput?.addEventListener('blur', () => {
    setTimeout(() => { if (ghostEl) ghostEl.textContent = '' }, 100)
  })

  // --- 6. Helper de Validación Inline ---
  function showFieldError(fieldId, errorMsg) {
    const errEl = form.querySelector(`#error_${fieldId}`)
    if (errEl) errEl.textContent = errorMsg

    const inputEl = form.querySelector(`#sub${fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}`) ||
                    form.querySelector(`[name="${fieldId}"]`)
    if (inputEl) {
      inputEl.classList.add('is-invalid')
      const details = inputEl.closest('details')
      if (details) details.open = true
    }
  }

  function clearFieldError(fieldId) {
    const errEl = form.querySelector(`#error_${fieldId}`)
    if (errEl) errEl.textContent = ''
    const inputEl = form.querySelector(`#sub${fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}`) ||
                    form.querySelector(`[name="${fieldId}"]`)
    if (inputEl) inputEl.classList.remove('is-invalid')
  }

  function clearAllErrors() {
    form.querySelectorAll('.sub-field-error').forEach(el => el.textContent = '')
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'))
  }

  // Limpiar errores cuando el usuario interactúe
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', () => {
      const fieldId = input.name || input.id.replace(/^sub/, '').toLowerCase()
      clearFieldError(fieldId)
    })
  })

  // --- 7. Envío y Validación del Formulario ---
  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (isSubmitting) return

    clearAllErrors()

    // Validar cliente
    let finalClientId = selectedClientId
    const newName = (newClientNameInput?.value || '').trim()

    if (!finalClientId && !newName) {
      showFieldError('client', 'Debes seleccionar un cliente existente o registrar uno nuevo.')
      clientSearchInput?.focus()
      return
    }

    if (!finalClientId && newName) {
      if (newName.length < 2) {
        showFieldError('new_client_name', 'El nombre del cliente debe tener al menos 2 caracteres.')
        newClientNameInput?.focus()
        return
      }

      const rawPhone = (newClientPhoneInput?.value || '').trim()
      if (rawPhone) {
        const parsed = parseWhatsAppContact(rawPhone)
        if (!parsed || !parsed.isValid) {
          showFieldError('new_client_phone', parsed?.error || 'El contacto de WhatsApp no es válido.')
          newClientPhoneInput?.focus()
          return
        }
      }
    }

    // Validar servicio
    const prodId = productSelect.value
    if (!prodId) {
      showFieldError('product', 'Debes seleccionar un servicio o producto.')
      productSelect.focus()
      return
    }

    // Validar fechas
    const startDate = startDateInput.value
    const expiryDate = expiryDateInput.value

    if (!startDate) {
      showFieldError('start_date', 'La fecha de inicio es requerida.')
      startDateInput.focus()
      return
    }

    if (!expiryDate) {
      showFieldError('expiry_date', 'La fecha de vencimiento es obligatoria.')
      expiryDateInput.focus()
      return
    }

    if (startDate && expiryDate && new Date(expiryDate) < new Date(startDate)) {
      showFieldError('expiry_date', 'La fecha de vencimiento no puede ser anterior a la fecha de inicio.')
      expiryDateInput.focus()
      return
    }

    // Validar importes
    const saleInput = form.querySelector('input[name="sale_price"]')
    const costInput = form.querySelector('input[name="cost"]')
    const saleRateInput = form.querySelector('input[name="sale_price_exchange_rate"]')
    const costRateInput = form.querySelector('input[name="cost_exchange_rate"]')

    const saleVal = Number(saleInput?.value) || 0
    const costVal = Number(costInput?.value) || 0

    if (saleVal < 0) {
      showFieldError('sale_price', 'El precio de venta no puede ser negativo.')
      saleInput.focus()
      return
    }

    if (costVal < 0) {
      showFieldError('cost', 'El costo mayorista no puede ser negativo.')
      costInput.focus()
      return
    }

    const saleCurrency = form.querySelector('input[name="sale_price_currency"]:checked')?.value || 'PEN'
    const costCurrency = form.querySelector('input[name="cost_currency"]:checked')?.value || 'PEN'
    const saleRate = Number(saleRateInput?.value) || 0
    const costRate = Number(costRateInput?.value) || 0

    if (saleCurrency === 'USDT' && !(saleRate > 0)) {
      showFieldError('sale_price', 'Ingresa el tipo de cambio de venta (S/ por 1 USDT).')
      saleRateInput?.focus()
      return
    }

    if (costCurrency === 'USDT' && !(costRate > 0)) {
      showFieldError('cost', 'Ingresa el tipo de cambio de costo (S/ por 1 USDT).')
      costRateInput?.focus()
      return
    }

    // Iniciar guardado: bloquear botones y cambiar texto a "Guardando…"
    isSubmitting = true
    const saveBtn = rootEl.querySelector('#subSaveBtn')
    const cancelBtn = rootEl.querySelector('#subCancelBtn')
    const originalSaveText = saveBtn ? saveBtn.textContent : ''

    if (saveBtn) {
      saveBtn.disabled = true
      saveBtn.textContent = 'Guardando…'
    }
    if (cancelBtn) cancelBtn.disabled = true

    try {
      // 1. Crear nuevo cliente si fue registrado inline
      if (!finalClientId && newName) {
        const rawPhone = (newClientPhoneInput?.value || '').trim()
        let finalPhone = null
        if (rawPhone) {
          const parsed = parseWhatsAppContact(rawPhone)
          finalPhone = parsed?.value || null
        }

        const { data: createdClient, error: clientErr } = await supabase
          .from('clients')
          .insert([{ name: newName, phone: finalPhone }])
          .select()
          .single()

        if (clientErr) throw new Error('Error al registrar nuevo cliente: ' + clientErr.message)

        finalClientId = createdClient.id
        if (!state.clients) state.clients = []
        state.clients.push(createdClient)
      }

      // 2. Parsear extras
      const extrasMap = {}
      const rawExtras = form.querySelector('#subExtrasText')?.value || ''
      rawExtras.split('\n').forEach(line => {
        const idx = line.indexOf(':')
        if (idx <= 0) return
        const k = line.slice(0, idx).trim()
        const v = line.slice(idx + 1).trim()
        if (k && v) extrasMap[k] = v
      })

      // 3. Preparar payload
      const providerExpiryDate = form.querySelector('#subProviderExpiryDate')?.value || null
      const payload = {
        client_id: finalClientId,
        product_id: prodId,
        provider_id: providerSelect.value || null,
        username_email: String(form.querySelector('#subEmailInput')?.value || '').trim() || null,
        password: String(form.querySelector('#subPasswordInput')?.value || '').trim() || null,
        profile: String(form.querySelector('#subProfileInput')?.value || '').trim() || null,
        pin: String(form.querySelector('#subPinInput')?.value || '').trim() || null,
        access_url: String(form.querySelector('#subAccessUrlInput')?.value || '').trim() || null,
        sale_price: saleVal,
        cost: costVal,
        sale_price_currency: normalizeCurrency(saleCurrency),
        cost_currency: normalizeCurrency(costCurrency),
        sale_price_exchange_rate: saleCurrency === 'USDT' ? saleRate : null,
        cost_exchange_rate: costCurrency === 'USDT' ? costRate : null,
        start_date: startDate || null,
        expiry_date: expiryDate || null,
        provider_expiry_date: providerExpiryDate,
        extras: extrasMap,
        notes: String(form.querySelector('#subNotesText')?.value || '').trim() || null
      }

      let opError = null

      if (isEditing) {
        if (payload.sale_price_currency === 'PEN') payload.sale_price_exchange_rate = null
        if (payload.cost_currency === 'PEN') payload.cost_exchange_rate = null

        const res = await supabase.from('subscriptions').update(payload).eq('id', row.id)
        opError = res.error
      } else {
        const res = await supabase.rpc('create_subscription_v3', {
          p_client_id: payload.client_id,
          p_product_id: payload.product_id,
          p_provider_id: payload.provider_id,
          p_username_email: payload.username_email,
          p_password: payload.password,
          p_profile: payload.profile,
          p_pin: payload.pin,
          p_access_url: payload.access_url,
          p_sale_price: payload.sale_price,
          p_cost: payload.cost,
          p_sale_currency: payload.sale_price_currency,
          p_cost_currency: payload.cost_currency,
          p_sale_exchange_rate: payload.sale_price_exchange_rate,
          p_cost_exchange_rate: payload.cost_exchange_rate,
          p_start_date: payload.start_date,
          p_expiry_date: payload.expiry_date,
          p_provider_expiry_date: payload.provider_expiry_date,
          p_extras: payload.extras,
          p_notes: payload.notes,
          p_idempotency_key: idempotencyKey
        })
        opError = res.error
      }

      if (opError) throw opError

      toast(isEditing ? 'Suscripción actualizada con éxito.' : 'Suscripción registrada con éxito.', 'ok')
      await loadRows()

      if (typeof onSuccess === 'function') {
        onSuccess()
      }
      if (typeof onClose === 'function') {
        onClose()
      }
    } catch (err) {
      isSubmitting = false
      if (saveBtn) {
        saveBtn.disabled = false
        saveBtn.textContent = originalSaveText
      }
      if (cancelBtn) cancelBtn.disabled = false
      toast('Error al guardar: ' + (err?.message || err), 'error')
    }
  }

  const saveBtn = rootEl.querySelector('#subSaveBtn')
  const cancelBtn = rootEl.querySelector('#subCancelBtn')

  saveBtn?.addEventListener('click', handleSubmit)
  form.addEventListener('submit', handleSubmit)
  cancelBtn?.addEventListener('click', () => {
    if (typeof onClose === 'function') onClose()
  })

  // Vincular eventos financieros dinámicos
  bindFinancialEvents(form)

  // Inicializar estado de cliente
  updateClientUI()
}

/**
 * Abre el formulario de suscripción como modal accesible.
 * 
 * @param {Object|null} [row=null] - Suscripción a editar o null
 * @returns {Object} Instancia del modal
 */
export function openSubscriptionFormModal(row = null) {
  const isEditing = Boolean(row?.id)
  const products = state.products || []
  const providers = state.providers || []

  const extrasText = row?.extras && typeof row.extras === 'object'
    ? Object.entries(row.extras)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : ''

  const hasMoreOptionsData = Boolean(
    row?.provider_expiry_date ||
    (extrasText && extrasText.trim()) ||
    (row?.notes && String(row.notes).trim())
  )

  const bodyHtml = renderFormBodyHtml(row, products, providers, extrasText, hasMoreOptionsData)
  const footerHtml = `
    <div class="sub-form-footer">
      <button type="button" id="subCancelBtn" class="btn btn-outline">Cancelar</button>
      <button type="button" id="subSaveBtn" class="btn btn-primary">
        ${isEditing ? 'Guardar cambios' : 'Registrar suscripción'}
      </button>
    </div>
  `

  const modal = openModal({
    title: isEditing ? 'Editar suscripción' : 'Nueva suscripción',
    subtitle: isEditing ? 'Modifica los datos del servicio, credenciales o vigencia.' : 'Registra una suscripción asignando cliente, servicio y credenciales.',
    body: bodyHtml,
    footer: footerHtml,
    size: 'lg',
    customClass: 'sub-form-modal',
    onClose: () => {
      state.editingRowData = null
      state.editingId = null
    }
  })

  setupSubscriptionFormLogic(modal.el, {
    row,
    onClose: () => modal.close(),
    onSuccess: () => modal.close()
  })

  return modal
}

/**
 * Monta el formulario de suscripción directamente en un contenedor DOM (para compatibilidad de ruta o sección).
 * 
 * @param {HTMLElement} container - Contenedor DOM
 * @param {Object} [options={}] - Opciones adicionales
 */
export function mountSubscriptionForm(container, options = {}) {
  const row = options.row || state.editingRowData || null
  const isEditing = Boolean(row?.id)
  const products = state.products || []
  const providers = state.providers || []

  const extrasText = row?.extras && typeof row.extras === 'object'
    ? Object.entries(row.extras)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : ''

  const hasMoreOptionsData = Boolean(
    row?.provider_expiry_date ||
    (extrasText && extrasText.trim()) ||
    (row?.notes && String(row.notes).trim())
  )

  container.innerHTML = `
    <div class="sub-form-container">
      ${renderFormBodyHtml(row, products, providers, extrasText, hasMoreOptionsData)}
      <div class="sub-form-footer">
        <button type="button" id="subCancelBtn" class="btn btn-outline">Cancelar</button>
        <button type="button" id="subSaveBtn" class="btn btn-primary">
          ${isEditing ? 'Guardar cambios' : 'Registrar suscripción'}
        </button>
      </div>
    </div>
  `

  setupSubscriptionFormLogic(container, {
    row,
    onClose: () => {
      if (typeof options.onCancel === 'function') {
        options.onCancel()
      } else {
        window.history.back()
      }
    },
    onSuccess: () => {
      if (typeof options.onSuccess === 'function') {
        options.onSuccess()
      }
    }
  })
}

/**
 * Abre la pantalla o modal de formulario de suscripción (nueva o edición).
 * Precarga catálogos en paralelo y respeta la interfaz esperada por el sistema.
 * 
 * @param {Object|null} [row=null] - Suscripción a editar, o null para crear una nueva
 * @param {HTMLElement|boolean} [targetOrUpdateHash=null] - Contenedor HTMLElement para incrustar, o boolean
 */
export async function openSubscriptionForm(row = null, targetOrUpdateHash = null) {
  try {
    await Promise.all([
      loadProducts(true),
      loadClients(true),
      loadProviders(true)
    ])
  } catch (err) {
    // Si la carga falla, el formulario continúa utilizable
  }

  state.editingRowData = row
  state.editingId = row?.id || null

  if (targetOrUpdateHash instanceof HTMLElement) {
    mountSubscriptionForm(targetOrUpdateHash, { row })
  } else {
    return openSubscriptionFormModal(row)
  }
}
