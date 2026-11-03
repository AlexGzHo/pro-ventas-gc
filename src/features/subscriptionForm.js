import { supabase } from '../supabase.js'
import {
  todayISO,
  addPeriod,
  normalizeCurrency
} from '../utils.js'
import { parseWhatsAppContact } from '../whatsapp.js'
import { toast } from '../ui/toast.js'
import { openModal } from '../ui/modal.js'
import {
  state,
  loadProducts,
  loadClients,
  loadProviders,
  loadRows
} from '../state.js'
import {
  createFinancialBlock,
  bindFinancialEvents
} from './subscriptionForm/financialBlock.js'
import { setupEmailGhost } from './subscriptionForm/emailGhost.js'
import { setupClientCombo } from './subscriptionForm/clientCombo.js'
import { renderFormBodyHtml } from './subscriptionForm/formHtml.js'

export { createFinancialBlock, bindFinancialEvents }

/**
 * PRO VENTAS GC — Formulario Completo de Suscripción (Creación y Edición)
 * Coordina los bloques de cliente, credenciales, catálogo y finanzas.
 */

/**
 * Configura la interactividad y eventos del formulario de suscripción.
 */
function setupSubscriptionFormLogic(rootEl, { row = null, onClose = null, onSuccess = null } = {}) {
  const form = rootEl.querySelector('#subscriptionForm')
  if (!form) return

  const isEditing = Boolean(row?.id)
  const idempotencyKey = isEditing ? null : crypto.randomUUID()
  let isSubmitting = false

  // Helper de validación inline
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

  // 1. Selector combinado de cliente
  const clientController = setupClientCombo(form, {
    initialClientId: row?.client_id || null,
    getClients: () => state.clients || [],
    getRows: () => state.rows || [],
    showFieldError,
    clearFieldError
  })

  // 2. Elementos de servicio y proveedor
  const productSelect = form.querySelector('#subProductId')
  const providerSelect = form.querySelector('#subProviderSelect')
  const suggestedHint = form.querySelector('#subSuggestedPriceHint')
  const startDateInput = form.querySelector('#subStartDate')
  const expiryDateInput = form.querySelector('#subExpiryDate')
  const quickPeriodBtns = form.querySelectorAll('.sub-period-btn')

  // 3. Password toggle
  const pwdInput = form.querySelector('#subPasswordInput')
  const togglePwdBtn = form.querySelector('#subTogglePwdBtn')
  if (togglePwdBtn && pwdInput) {
    let isPwdVisible = false
    togglePwdBtn.addEventListener('click', () => {
      isPwdVisible = !isPwdVisible
      pwdInput.type = isPwdVisible ? 'text' : 'password'
    })
  }

  // 4. Autocompletado Ghost para correo
  const emailInput = form.querySelector('#subEmailInput')
  const ghostEl = form.querySelector('.email-ghost')
  setupEmailGhost(emailInput, ghostEl, state.rows || [])

  // 5. Sugerencias desde catálogo al seleccionar producto
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

    if (saleInput && prod.sale_price != null) saleInput.value = prod.sale_price
    if (costInput && prod.default_cost != null) costInput.value = prod.default_cost

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

    const isProdUsdt = prod.currency === 'USDT'
    const saleRadio = form.querySelector(isProdUsdt ? '#sale_usdt' : '#sale_pen')
    const costRadio = form.querySelector(isProdUsdt ? '#cost_usdt' : '#cost_pen')
    if (saleRadio) saleRadio.checked = true
    if (costRadio) costRadio.checked = true

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

  // 6. Botones rápidos de vencimiento
  quickPeriodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const months = parseInt(btn.dataset.months || '1', 10)
      const baseStart = startDateInput.value || todayISO()
      expiryDateInput.value = addPeriod(baseStart, { months })
      clearFieldError('expiry_date')
      form.dispatchEvent(new Event('input'))
    })
  })

  // Limpiar errores al interactuar
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', () => {
      const fieldId = input.name || input.id.replace(/^sub/, '').toLowerCase()
      clearFieldError(fieldId)
    })
  })

  // 7. Envío y Validación
  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (isSubmitting) return

    clearAllErrors()

    let finalClientId = clientController.getSelectedClientId()
    const newName = clientController.getNewClientName()

    if (!finalClientId && !newName) {
      showFieldError('client', 'Debes seleccionar un cliente existente o registrar uno nuevo.')
      clientController.focusSearch()
      return
    }

    if (!finalClientId && newName) {
      if (newName.length < 2) {
        showFieldError('new_client_name', 'El nombre del cliente debe tener al menos 2 caracteres.')
        clientController.focusNewName()
        return
      }

      const rawPhone = clientController.getNewClientPhone()
      if (rawPhone) {
        const parsed = parseWhatsAppContact(rawPhone)
        if (!parsed || !parsed.isValid) {
          showFieldError('new_client_phone', parsed?.error || 'El contacto de WhatsApp no es válido.')
          clientController.focusNewPhone()
          return
        }
      }
    }

    const prodId = productSelect.value
    if (!prodId) {
      showFieldError('product', 'Debes seleccionar un servicio o producto.')
      productSelect.focus()
      return
    }

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
      if (!finalClientId && newName) {
        const rawPhone = clientController.getNewClientPhone()
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

      const extrasMap = {}
      const rawExtras = form.querySelector('#subExtrasText')?.value || ''
      rawExtras.split('\n').forEach(line => {
        const idx = line.indexOf(':')
        if (idx <= 0) return
        const k = line.slice(0, idx).trim()
        const v = line.slice(idx + 1).trim()
        if (k && v) extrasMap[k] = v
      })

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

      if (typeof onSuccess === 'function') onSuccess()
      if (typeof onClose === 'function') onClose()
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

  bindFinancialEvents(form)
}

/**
 * Abre el formulario de suscripción como modal accesible.
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
 * Monta el formulario de suscripción directamente en un contenedor DOM.
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
