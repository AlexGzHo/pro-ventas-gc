import { escapeHtml } from '../../utils.js'
import { parseWhatsAppContact, getWhatsAppUrl } from '../../whatsapp.js'
import { toast } from '../../ui/toast.js'
import { ICONS } from '../../ui/icons.js'

/**
 * PRO VENTAS GC — Selector Combinado de Cliente
 * Búsqueda reactiva, renderizado de tarjeta de cliente seleccionado y registro inline
 * con verificación automática de duplicados por nombre y teléfono/WhatsApp.
 */

/**
 * Renderiza el markup HTML del control combinado de cliente.
 * 
 * @param {Object|null} row - Fila de suscripción si existe
 * @returns {string} Markup HTML
 */
export function renderClientControlHtml(row = null) {
  return `
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
  `
}

/**
 * Inicializa la lógica interactiva del combo de cliente.
 * 
 * @param {HTMLElement} rootEl - Elemento raíz que contiene el formulario o el control
 * @param {Object} options - Dependencias y callbacks
 * @returns {Object} API del controlador del cliente
 */
export function setupClientCombo(rootEl, {
  initialClientId = null,
  getClients = () => [],
  getRows = () => [],
  showFieldError = () => {},
  clearFieldError = () => {}
} = {}) {
  const clientCard = rootEl.querySelector('#subClientCard')
  const clientAvatar = rootEl.querySelector('#subClientAvatar')
  const clientNameEl = rootEl.querySelector('#subClientName')
  const clientContactEl = rootEl.querySelector('#subClientContact')
  const clientChangeBtn = rootEl.querySelector('#subClientChangeBtn')

  const clientSearchWrap = rootEl.querySelector('#subClientSearchWrap')
  const clientSearchInput = rootEl.querySelector('#subClientSearchInput')
  const clientClearBtn = rootEl.querySelector('#subClientClearBtn')
  const clientDropdown = rootEl.querySelector('#subClientDropdown')

  const clientInlineCreate = rootEl.querySelector('#subClientInlineCreate')
  const newClientNameInput = rootEl.querySelector('#subNewClientName')
  const newClientPhoneInput = rootEl.querySelector('#subNewClientPhone')
  const clientCancelCreateBtn = rootEl.querySelector('#subClientCancelCreateBtn')

  const duplicateBox = rootEl.querySelector('#subClientDuplicateBox')
  const duplicateList = rootEl.querySelector('#subClientDuplicateList')
  const clientIdHidden = rootEl.querySelector('#subClientIdHidden')

  let selectedClientId = initialClientId
  let isCreatingInline = false

  function getActiveSubsCount(clientId) {
    if (!clientId) return 0
    return (getRows() || []).filter(s => s.client_id === clientId && !s.archived_at).length
  }

  function updateClientUI() {
    if (selectedClientId) {
      const client = (getClients() || []).find(c => c.id === selectedClientId)
      if (client) {
        const initials = (client.name || 'CL').trim().substring(0, 2).toUpperCase()
        if (clientAvatar) clientAvatar.textContent = initials
        if (clientNameEl) clientNameEl.textContent = client.name

        const parsedContact = client.phone ? parseWhatsAppContact(client.phone) : null
        const waUrl = parsedContact?.isValid ? getWhatsAppUrl(client.phone) : ''
        const isUserContact = parsedContact?.type === 'username' || (client.phone || '').startsWith('@')
        const activeCount = getActiveSubsCount(client.id)

        if (clientContactEl) {
          clientContactEl.innerHTML = `
            ${waUrl ? `
              <a href="${waUrl}" target="_blank" rel="noopener noreferrer">
                ${isUserContact ? '' : (ICONS.phone || '')}
                <span>${escapeHtml(client.phone)}</span>
              </a>
            ` : (client.phone ? `<span>${escapeHtml(client.phone)}</span>` : '<span class="sub-hint">Sin teléfono</span>')}
            <span class="sub-hint">· ${activeCount} suscripción(es)</span>
          `
        }

        clientCard?.classList.remove('sub-hidden')
        clientSearchWrap?.classList.add('sub-hidden')
        clientInlineCreate?.classList.add('sub-hidden')
        if (clientIdHidden) clientIdHidden.value = client.id
        clearFieldError('client')
        return
      }
    }

    clientCard?.classList.add('sub-hidden')
    if (clientIdHidden) clientIdHidden.value = ''

    if (isCreatingInline) {
      clientSearchWrap?.classList.add('sub-hidden')
      clientInlineCreate?.classList.remove('sub-hidden')
    } else {
      clientSearchWrap?.classList.remove('sub-hidden')
      clientInlineCreate?.classList.add('sub-hidden')
    }
  }

  function selectClient(id) {
    selectedClientId = id
    isCreatingInline = false
    if (clientSearchInput) clientSearchInput.value = ''
    clientDropdown?.classList.add('sub-hidden')
    updateClientUI()
  }

  function renderClientSearchResults() {
    if (!clientSearchInput || !clientDropdown) return
    const q = (clientSearchInput.value || '').trim().toLowerCase()
    const clients = getClients() || []

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

  function checkClientDuplicates() {
    if (!newClientNameInput || !newClientPhoneInput || !duplicateBox || !duplicateList) return
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

    const matches = (getClients() || []).filter(c => {
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

  // Listeners
  clientSearchInput?.addEventListener('input', () => {
    clientClearBtn?.classList.toggle('sub-hidden', !clientSearchInput.value)
    renderClientSearchResults()
  })

  clientSearchInput?.addEventListener('focus', () => {
    renderClientSearchResults()
  })

  clientClearBtn?.addEventListener('click', () => {
    clientSearchInput.value = ''
    clientClearBtn.classList.add('sub-hidden')
    clientDropdown?.classList.add('sub-hidden')
    clientSearchInput.focus()
  })

  clientDropdown?.addEventListener('click', (e) => {
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
      if (newClientNameInput) newClientNameInput.value = q
      if (newClientPhoneInput) newClientPhoneInput.value = ''
      checkClientDuplicates()
      newClientPhoneInput?.focus()
    }
  })

  clientChangeBtn?.addEventListener('click', () => {
    selectedClientId = null
    isCreatingInline = false
    if (clientSearchInput) clientSearchInput.value = ''
    updateClientUI()
    clientSearchInput?.focus()
  })

  clientCancelCreateBtn?.addEventListener('click', () => {
    isCreatingInline = false
    if (newClientNameInput) newClientNameInput.value = ''
    if (newClientPhoneInput) newClientPhoneInput.value = ''
    duplicateBox?.classList.add('sub-hidden')
    updateClientUI()
    clientSearchInput?.focus()
  })

  newClientNameInput?.addEventListener('input', () => {
    clearFieldError('new_client_name')
    checkClientDuplicates()
  })

  newClientPhoneInput?.addEventListener('input', () => {
    clearFieldError('new_client_phone')
    checkClientDuplicates()
  })

  const handleDocumentClick = (e) => {
    if (!e.target.closest('#subClientSearchWrap')) {
      clientDropdown?.classList.add('sub-hidden')
    }
  }
  document.addEventListener('click', handleDocumentClick)

  updateClientUI()

  return {
    getSelectedClientId: () => selectedClientId,
    setSelectedClientId: (id) => selectClient(id),
    isCreatingNewInline: () => isCreatingInline,
    getNewClientName: () => (newClientNameInput?.value || '').trim(),
    getNewClientPhone: () => (newClientPhoneInput?.value || '').trim(),
    focusSearch: () => clientSearchInput?.focus(),
    focusNewName: () => newClientNameInput?.focus(),
    focusNewPhone: () => newClientPhoneInput?.focus(),
    updateClientUI,
    destroy: () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }
}
