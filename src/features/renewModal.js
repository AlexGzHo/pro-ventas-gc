import { supabase } from '../supabase.js'
import { escapeHtml, formatDate, addPeriod } from '../utils.js'
import { toast } from '../ui/toast.js'
import { openModal } from '../ui/modal.js'
import { ICONS } from '../ui/icons.js'
import { state, loadRows, setLoading } from '../state.js'
import { updateText, getWhatsAppUrl } from '../whatsapp.js'

let currentRenewIdempotencyKey = null

/**
 * Abre el modal interactivo de renovación para una suscripción.
 * 
 * @param {Object} row - Suscripción a renovar
 * @returns {Object} Instancia del modal abierto
 */
export function openRenewModal(row) {
  currentRenewIdempotencyKey = crypto.randomUUID()

  // Resolver nombre de cliente, servicio y contacto de forma segura
  const clientName = row.client_name || row.clients?.name || state.clients?.find(c => c.id === row.client_id)?.name || 'Cliente'
  const serviceName = row.service || row.product_name || row.products?.name || state.products?.find(p => p.id === row.product_id)?.name || 'Servicio'
  const clientPhone = row.phone || row.client_phone || state.clients?.find(c => c.id === row.client_id)?.phone || ''

  // Calcular fecha sugerida
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = row.expiry_date ? new Date(row.expiry_date + 'T00:00:00') : today
  const autoDateObj = !isNaN(exp.getTime()) && exp >= today ? exp : today
  const autoDateStr = `${autoDateObj.getFullYear()}-${String(autoDateObj.getMonth() + 1).padStart(2, '0')}-${String(autoDateObj.getDate()).padStart(2, '0')}`

  const bodyHtml = `
    <div id="renewFormFields">
      <!-- 1. Encabezado: Cliente + Servicio + Vence: dd/mm/aaaa -->
      <div class="renew-header-card">
        <div class="renew-header-client">${escapeHtml(clientName)}</div>
        <div class="renew-header-service">${escapeHtml(serviceName)}</div>
        <div class="renew-header-expiry">Vence: <strong>${formatDate(row.expiry_date)}</strong></div>
      </div>

      <!-- 2. Fecha de inicio -->
      <div class="renew-section">
        <label class="renew-section-label">Fecha de inicio del nuevo período</label>
        <div class="renew-mode-group">
          <label class="renew-radio-label">
            <input type="radio" name="renew_mode" value="auto" checked class="renew-radio">
            <span>Automático</span>
          </label>
          <label class="renew-radio-label">
            <input type="radio" name="renew_mode" value="manual" class="renew-radio">
            <span>Elegir fecha</span>
          </label>
        </div>
        <div class="renew-date-wrapper">
          <input type="date" id="renewCustomDate" class="form-control renew-date-input sub-hidden" value="${autoDateStr}">
          <span id="renewAutoText" class="renew-auto-text">Iniciará el ${formatDate(autoDateStr)}</span>
        </div>
      </div>

      <!-- 3. Chips de duración seleccionables -->
      <div class="renew-section">
        <label class="renew-section-label">Duración</label>
        <div class="renew-chips-grid">
          <button type="button" class="chip renew-chip" data-period="7 days" data-days="7" data-months="0">+ 7 días</button>
          <button type="button" class="chip renew-chip" data-period="15 days" data-days="15" data-months="0">+ 15 días</button>
          <button type="button" class="chip renew-chip" data-period="1 month" data-days="0" data-months="1">+ 1 mes</button>
          <button type="button" class="chip renew-chip" data-period="3 months" data-days="0" data-months="3">+ 3 meses</button>
          <button type="button" class="chip renew-chip" data-period="6 months" data-days="0" data-months="6">+ 6 meses</button>
          <button type="button" class="chip renew-chip" data-period="12 months" data-days="0" data-months="12">+ 12 meses</button>
        </div>
      </div>

      <!-- 4. Vista previa en vivo -->
      <div id="renewPreview" class="renew-preview-box sub-hidden">
        <div class="renew-preview-row">
          <span class="renew-preview-label">Inicio:</span>
          <strong id="previewStart" class="renew-preview-val">—</strong>
        </div>
        <div class="renew-preview-row">
          <span class="renew-preview-label">Duración:</span>
          <strong id="previewDuration" class="renew-preview-val">—</strong>
        </div>
        <div class="renew-preview-row renew-preview-highlight">
          <span class="renew-preview-label">Nuevo vencimiento:</span>
          <strong id="previewEnd" class="renew-preview-end">—</strong>
        </div>
      </div>
    </div>

    <!-- 5. Estado de éxito tras renovación -->
    <div id="renewSuccessState" class="renew-success-box sub-hidden">
      <div class="renew-success-icon">${ICONS.check || ICONS.success || ''}</div>
      <div class="renew-success-title">Suscripción renovada con éxito</div>
      <div class="renew-success-desc">Nuevo vencimiento: <strong id="renewSuccessDate"></strong></div>
      <div class="renew-success-actions">
        <a id="renewWhatsAppBtn" class="btn btn-primary renew-wa-action sub-hidden" target="_blank" rel="noopener noreferrer">
          ${ICONS.whatsapp || ''} <span>Enviar confirmación por WhatsApp</span>
        </a>
        <button type="button" id="renewDoneBtn" class="btn btn-outline">Cerrar</button>
      </div>
    </div>
  `

  const footerHtml = `
    <div id="renewModalFooter" class="renew-footer-actions">
      <button type="button" id="cancelRenewBtn" class="btn btn-outline">Cancelar</button>
      <button type="button" id="confirmRenewBtn" class="btn btn-primary" disabled>Confirmar renovación</button>
    </div>
  `

  const modal = openModal({
    title: 'Renovar suscripción',
    body: bodyHtml,
    footer: footerHtml,
    size: 'sm',
    customClass: 'renew-modal',
    onClose: () => {
      currentRenewIdempotencyKey = null
    }
  })

  const formFields = modal.el.querySelector('#renewFormFields')
  const successState = modal.el.querySelector('#renewSuccessState')
  const successDateEl = modal.el.querySelector('#renewSuccessDate')
  const waBtn = modal.el.querySelector('#renewWhatsAppBtn')
  const doneBtn = modal.el.querySelector('#renewDoneBtn')
  const modalFooter = modal.el.querySelector('#renewModalFooter')

  const cancelBtn = modal.el.querySelector('#cancelRenewBtn')
  const confirmBtn = modal.el.querySelector('#confirmRenewBtn')
  const radios = modal.el.querySelectorAll('input[name="renew_mode"]')
  const customDateInput = modal.el.querySelector('#renewCustomDate')
  const autoText = modal.el.querySelector('#renewAutoText')
  const chips = modal.el.querySelectorAll('.renew-chip')
  const previewBox = modal.el.querySelector('#renewPreview')

  let selectedMode = 'auto'
  let selectedPeriod = null
  let selectedPeriodLabel = ''
  let selectedDays = 0
  let selectedMonths = 0
  let calculatedEndISO = ''

  cancelBtn.addEventListener('click', modal.close)
  doneBtn.addEventListener('click', modal.close)

  function updatePreview() {
    if (!selectedPeriod) {
      previewBox.classList.add('sub-hidden')
      confirmBtn.disabled = true
      return
    }

    if (selectedMode === 'manual' && !customDateInput.value) {
      previewBox.classList.add('sub-hidden')
      confirmBtn.disabled = true
      return
    }

    const startStr = selectedMode === 'manual' ? customDateInput.value : autoDateStr
    calculatedEndISO = addPeriod(startStr, { days: selectedDays, months: selectedMonths })

    modal.el.querySelector('#previewStart').textContent = formatDate(startStr)
    modal.el.querySelector('#previewDuration').textContent = selectedPeriodLabel
    modal.el.querySelector('#previewEnd').textContent = formatDate(calculatedEndISO)

    previewBox.classList.remove('sub-hidden')
    confirmBtn.disabled = false
  }

  radios.forEach((r) => {
    r.addEventListener('change', (e) => {
      selectedMode = e.target.value
      if (selectedMode === 'auto') {
        customDateInput.classList.add('sub-hidden')
        autoText.classList.remove('sub-hidden')
      } else {
        customDateInput.classList.remove('sub-hidden')
        autoText.classList.add('sub-hidden')
      }
      updatePreview()
    })
  })

  customDateInput.addEventListener('input', updatePreview)
  customDateInput.addEventListener('change', updatePreview)

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'))
      chip.classList.add('active')

      selectedPeriod = chip.dataset.period
      selectedPeriodLabel = chip.textContent.replace('+ ', '').trim()
      selectedDays = parseInt(chip.dataset.days || '0', 10)
      selectedMonths = parseInt(chip.dataset.months || '0', 10)

      updatePreview()
    })
  })

  confirmBtn.addEventListener('click', async () => {
    if (!selectedPeriod) return
    if (selectedMode === 'manual' && !customDateInput.value) return

    const finalStartDate = selectedMode === 'manual' ? customDateInput.value : null

    confirmBtn.disabled = true
    confirmBtn.textContent = 'Procesando renovación…'
    cancelBtn.disabled = true

    const success = await renewRow(row, selectedPeriod, finalStartDate, confirmBtn)
    if (success) {
      // Mostrar estado de éxito y opción de WhatsApp
      formFields.classList.add('sub-hidden')
      modalFooter.classList.add('sub-hidden')
      successState.classList.remove('sub-hidden')
      successDateEl.textContent = formatDate(calculatedEndISO)

      // Configurar enlace de WhatsApp si el cliente tiene teléfono
      if (clientPhone) {
        const updatedRowForTemplate = {
          ...row,
          client_name: clientName,
          service: serviceName,
          expiry_date: calculatedEndISO
        }
        const message = updateText(updatedRowForTemplate)
        const waUrl = getWhatsAppUrl(clientPhone, message)

        if (waUrl) {
          waBtn.href = waUrl
          waBtn.classList.remove('sub-hidden')
        }
      }
    } else {
      confirmBtn.disabled = false
      confirmBtn.textContent = 'Confirmar renovación'
      cancelBtn.disabled = false
    }
  })

  return modal
}

/**
 * Ejecuta la llamada RPC process_renewal en Supabase manteniendo idempotencia y estado.
 * 
 * @param {Object|string} rowOrId - Suscripción o ID a renovar
 * @param {string} period - Cadena de período (ej. '1 month', '7 days')
 * @param {string|null} [customStartDate=null] - Fecha de inicio manual opcional (YYYY-MM-DD)
 * @param {HTMLElement|null} [btnRef=null] - Referencia al botón activador para feedback visual
 * @returns {Promise<boolean>} Éxito de la operación
 */
export async function renewRow(rowOrId, period, customStartDate = null, btnRef = null) {
  const rowId = typeof rowOrId === 'object' ? rowOrId.id : rowOrId
  const row = typeof rowOrId === 'object' ? rowOrId : state.rows.find((r) => r.id === rowId)

  const btn = btnRef || (typeof event !== 'undefined' ? event?.currentTarget : null)
  const originalText = btn ? btn.innerHTML : ''

  if (btn && btn.tagName === 'BUTTON') {
    btn.disabled = true
    btn.innerHTML = 'Procesando…'
  }

  setLoading(true, 'Procesando renovación...')
  try {
    let period_value = 1
    let period_unit = 'month'

    if (period === '7 days') { period_value = 7; period_unit = 'day' }
    else if (period === '15 days') { period_value = 15; period_unit = 'day' }
    else if (period === '1 month') { period_value = 1; period_unit = 'month' }
    else if (period === '3 months') { period_value = 3; period_unit = 'month' }
    else if (period === '6 months') { period_value = 6; period_unit = 'month' }
    else if (period === '12 months') { period_value = 12; period_unit = 'month' }
    else throw new Error('Período no soportado por PRO VENTAS GC v2')

    const payload = {
      p_subscription_id: rowId,
      p_period_value: period_value,
      p_period_unit: period_unit,
      p_idempotency_key: currentRenewIdempotencyKey || crypto.randomUUID()
    }
    if (customStartDate) {
      payload.p_start_date = customStartDate
    }

    const { error } = await supabase.rpc('process_renewal', payload)
    if (error) throw error

    toast('Suscripción renovada (con historial)')
    currentRenewIdempotencyKey = null
    await loadRows()
    return true
  } catch (err) {
    toast('Error al renovar: ' + err.message, 'error')
    if (btn && btn.tagName === 'BUTTON') {
      btn.disabled = false
      btn.innerHTML = originalText
    }
    return false
  } finally {
    setLoading(false)
  }
}
