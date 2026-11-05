import { supabase } from '../supabase.js'
import { defaultTemplates, interpolateTemplate, setTemplates, templates } from '../whatsapp.js'
import { toast } from '../ui/toast.js'
import { confirmDialog } from '../ui/confirm.js'
import { ICONS } from '../ui/icons.js'
import { toISODate } from '../utils.js'

/**
 * PRO VENTAS GC — Vista de Plantillas de WhatsApp
 * Editor reactivo con variables clicables con inserción en el cursor y vista previa en tiempo real.
 */
export async function mountWhatsappTemplatesView(container, options = {}) {
  let isSaving = false
  let activeTextareaId = 'tplReminder'

  const availableVariables = [
    { tag: '{{cliente}}', label: 'Nombre del cliente' },
    { tag: '{{servicio}}', label: 'Nombre del servicio' },
    { tag: '{{vencimiento}}', label: 'Fecha de vencimiento (DD/MM/AAAA)' },
    { tag: '{{dias}}', label: 'Frase relativa («vence en X días»)' },
    { tag: '{{dias_numero}}', label: 'Número de días restantes' },
    { tag: '{{importe}}', label: 'Importe de venta (ej. S/ 25.00)' },
    { tag: '{{usuario}}', label: 'Correo o usuario' },
    { tag: '{{contrasena}}', label: 'Contraseña de acceso' },
    { tag: '{{perfil}}', label: 'Nombre del perfil' },
    { tag: '{{pin}}', label: 'PIN de acceso' },
    { tag: '{{url}}', label: 'URL de acceso' },
    { tag: '{{extras}}', label: 'Campos adicionales' }
  ]

  // Suscripción de ejemplo para simulación de vista previa
  const now = new Date()
  const initialExpiry = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5)
  const dummyRow = {
    client_name: 'Juan Pérez',
    service: 'NETFLIX PREMIUM',
    expiry_date: toISODate(initialExpiry),
    sale_price: 25.00,
    sale_price_currency: 'PEN',
    username_email: 'juan@ejemplo.com',
    password: 'securePassword123',
    profile: 'Perfil 1',
    pin: '1234',
    access_url: 'https://netflix.com',
    extras: { 'Pantalla': 1 }
  }

  async function loadData() {
    container.innerHTML = '<div class="empty-state">Cargando plantillas de WhatsApp...</div>'

    try {
      const { data, error } = await supabase.from('whatsapp_templates').select('id, content')
      if (error) throw error

      const loaded = {}
      if (data) {
        data.forEach(item => {
          loaded[item.id] = item.content
        })
      }
      setTemplates(loaded)
      render()
    } catch (err) {
      console.error('Error cargando plantillas:', err)
      container.innerHTML = '<div class="empty-state text-danger">Error al cargar: ' + err.message + '</div>'
    }
  }

  function render() {
    container.innerHTML = `
      <section class="page-header">
        <div>
          <h2>Plantillas de WhatsApp</h2>
          <p>Personaliza los mensajes automatizados de cobro, accesos y actualización.</p>
        </div>
        <div class="templates-hero-actions">
          <button id="btnRestoreAll" class="btn btn-ghost" type="button">
            ${ICONS.restore} Restaurar predeterminadas
          </button>
          <button id="btnSaveAll" class="btn btn-primary" type="button">
            ${ICONS.check} Guardar Cambios
          </button>
        </div>
      </section>

      <div class="templates-view">
        <!-- Barra de Variables Disponibles Clicables -->
        <div class="card template-variables-card">
          <div class="template-variables-header">
            <h3 class="template-variables-title">
              ${ICONS.messageSquare} Variables disponibles
            </h3>
            <span class="template-variables-help">Haz clic en una variable para insertarla en la posición del cursor</span>
          </div>
          <div class="template-variables-list" id="varsList">
            ${availableVariables.map(v => `
              <button type="button" class="chip template-var-tag" data-tag="${v.tag}" title="${v.label}">
                ${v.tag}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Barra de Simulación de Escenarios -->
        <div class="card template-sim-card">
          <span class="template-sim-label">
            ${ICONS.calendar} Simular fecha de vencimiento:
          </span>
          <div class="template-sim-buttons">
            <button type="button" class="chip template-sim-btn active" data-offset="5" aria-pressed="true">En 5 días</button>
            <button type="button" class="chip template-sim-btn" data-offset="1" aria-pressed="false">Mañana</button>
            <button type="button" class="chip template-sim-btn" data-offset="0" aria-pressed="false">Hoy</button>
            <button type="button" class="chip template-sim-btn" data-offset="-1" aria-pressed="false">Ayer</button>
            <button type="button" class="chip template-sim-btn" data-offset="-3" aria-pressed="false">Hace 3 días</button>
          </div>
        </div>

        <!-- Grid de Plantillas -->
        <div class="templates-grid">
          <!-- Plantilla 1: Recordatorio -->
          <article class="card template-card">
            <div class="template-card-header">
              <div>
                <h3 class="template-card-title">Plantilla de Recordatorio</h3>
                <p class="template-card-desc">Se envía al presionar "Cobrar" o "WhatsApp" en las tablas de suscripciones.</p>
              </div>
              <button type="button" class="btn btn-ghost btn-restore-single" data-tpl="reminder" title="Restaurar solo esta plantilla" aria-label="Restaurar plantilla de recordatorio">
                ${ICONS.restore}
              </button>
            </div>
            <textarea id="tplReminder" class="form-control template-textarea" rows="7" placeholder="Escribe tu mensaje..." aria-label="Plantilla de recordatorio"></textarea>
            <div class="template-preview-wrapper">
              <span class="template-preview-label">Vista previa en vivo:</span>
              <div id="prevReminder" class="template-preview-box"></div>
            </div>
          </article>

          <!-- Plantilla 2: Credenciales -->
          <article class="card template-card">
            <div class="template-card-header">
              <div>
                <h3 class="template-card-title">Plantilla de Credenciales</h3>
                <p class="template-card-desc">Se envía al compartir los accesos de una cuenta con el cliente.</p>
              </div>
              <button type="button" class="btn btn-ghost btn-restore-single" data-tpl="credentials" title="Restaurar solo esta plantilla" aria-label="Restaurar plantilla de credenciales">
                ${ICONS.restore}
              </button>
            </div>
            <textarea id="tplCredentials" class="form-control template-textarea" rows="7" placeholder="Escribe tu mensaje..." aria-label="Plantilla de credenciales"></textarea>
            <div class="template-preview-wrapper">
              <span class="template-preview-label">Vista previa en vivo:</span>
              <div id="prevCredentials" class="template-preview-box"></div>
            </div>
          </article>

          <!-- Plantilla 3: Actualización -->
          <article class="card template-card full-width">
            <div class="template-card-header">
              <div>
                <h3 class="template-card-title">Plantilla de Actualización</h3>
                <p class="template-card-desc">Se envía al actualizar credenciales o datos de la cuenta existente.</p>
              </div>
              <button type="button" class="btn btn-ghost btn-restore-single" data-tpl="update" title="Restaurar solo esta plantilla" aria-label="Restaurar plantilla de actualización">
                ${ICONS.restore}
              </button>
            </div>
            <textarea id="tplUpdate" class="form-control template-textarea" rows="6" placeholder="Escribe tu mensaje..." aria-label="Plantilla de actualización"></textarea>
            <div class="template-preview-wrapper">
              <span class="template-preview-label">Vista previa en vivo:</span>
              <div id="prevUpdate" class="template-preview-box"></div>
            </div>
          </article>
        </div>

        <div class="card template-bottom-actions">
          <button id="btnBottomSave" class="btn btn-primary" type="button">
            ${ICONS.check} Guardar Cambios
          </button>
          <span id="saveStatusIndicator" class="template-status-msg"></span>
        </div>
      </div>
    `

    const tplReminder = container.querySelector('#tplReminder')
    const tplCredentials = container.querySelector('#tplCredentials')
    const tplUpdate = container.querySelector('#tplUpdate')

    const prevReminder = container.querySelector('#prevReminder')
    const prevCredentials = container.querySelector('#prevCredentials')
    const prevUpdate = container.querySelector('#prevUpdate')

    tplReminder.value = templates.reminder || defaultTemplates.reminder
    tplCredentials.value = templates.credentials || defaultTemplates.credentials
    tplUpdate.value = templates.update || defaultTemplates.update

    function updatePreviews() {
      prevReminder.textContent = interpolateTemplate(tplReminder.value, dummyRow)
      prevCredentials.textContent = interpolateTemplate(tplCredentials.value, dummyRow)
      prevUpdate.textContent = interpolateTemplate(tplUpdate.value, dummyRow)
    }

    // Seguimiento del último textarea enfocado para insertar variables
    const trackFocus = (el) => {
      el.addEventListener('focus', () => {
        activeTextareaId = el.id
      })
    }
    trackFocus(tplReminder)
    trackFocus(tplCredentials)
    trackFocus(tplUpdate)

    tplReminder.addEventListener('input', updatePreviews)
    tplCredentials.addEventListener('input', updatePreviews)
    tplUpdate.addEventListener('input', updatePreviews)

    // Clic en variables: inserta en la posición del cursor del textarea activo
    container.querySelector('#varsList').addEventListener('click', (e) => {
      const btn = e.target.closest('.template-var-tag')
      if (!btn) return
      const tag = btn.dataset.tag
      if (!tag) return

      const activeTextarea = container.querySelector(`#${activeTextareaId}`) || tplReminder
      const start = activeTextarea.selectionStart ?? activeTextarea.value.length
      const end = activeTextarea.selectionEnd ?? activeTextarea.value.length
      const val = activeTextarea.value

      activeTextarea.value = val.substring(0, start) + tag + val.substring(end)
      activeTextarea.focus()
      activeTextarea.setSelectionRange(start + tag.length, start + tag.length)

      updatePreviews()
    })

    // Simulación de situaciones de vencimiento
    container.querySelectorAll('.template-sim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.template-sim-btn').forEach(b => {
          b.classList.remove('active')
          b.setAttribute('aria-pressed', 'false')
        })
        btn.classList.add('active')
        btn.setAttribute('aria-pressed', 'true')
        const offset = parseInt(btn.dataset.offset, 10)
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
        dummyRow.expiry_date = toISODate(target)
        updatePreviews()
      })
    })

    // Restaurar individual
    container.querySelectorAll('.btn-restore-single').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tplKey = btn.dataset.tpl
        const defaultVal = defaultTemplates[tplKey]
        if (!defaultVal) return

        const confirmed = await confirmDialog({
          title: '¿Restaurar plantilla predeterminada?',
          message: 'Se reemplazará el texto actual de esta plantilla por su formato original predeterminado.',
          confirmText: 'Restaurar',
          cancelText: 'Cancelar'
        })

        if (!confirmed) return

        if (tplKey === 'reminder') tplReminder.value = defaultVal
        if (tplKey === 'credentials') tplCredentials.value = defaultVal
        if (tplKey === 'update') tplUpdate.value = defaultVal
        updatePreviews()
        toast('Plantilla restaurada a valor predeterminado.', 'ok')
      })
    })

    // Restaurar todas
    container.querySelector('#btnRestoreAll').addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: '¿Restaurar todas las plantillas?',
        message: 'Se descartarán las modificaciones actuales y se volverá a la configuración predeterminada en las 3 plantillas.',
        confirmText: 'Restaurar todas',
        cancelText: 'Cancelar',
        danger: true
      })

      if (!confirmed) return

      tplReminder.value = defaultTemplates.reminder
      tplCredentials.value = defaultTemplates.credentials
      tplUpdate.value = defaultTemplates.update
      updatePreviews()
      toast('Todas las plantillas fueron restauradas a sus valores predeterminados.', 'ok')
    })

    // Guardar cambios
    async function handleSave() {
      if (isSaving) return
      isSaving = true

      const saveBtns = [container.querySelector('#btnSaveAll'), container.querySelector('#btnBottomSave')].filter(Boolean)
      const statusEl = container.querySelector('#saveStatusIndicator')

      saveBtns.forEach(b => {
        b.disabled = true
        b.innerHTML = `${ICONS.refresh} Guardando...`
      })
      if (statusEl) statusEl.textContent = ''

      try {
        const updates = [
          { id: 'reminder', content: tplReminder.value },
          { id: 'credentials', content: tplCredentials.value },
          { id: 'update', content: tplUpdate.value }
        ]

        const { error } = await supabase.from('whatsapp_templates').upsert(updates)
        if (error) throw error

        setTemplates({
          reminder: tplReminder.value,
          credentials: tplCredentials.value,
          update: tplUpdate.value
        })

        toast('Plantillas de WhatsApp guardadas con éxito.', 'ok')
        if (statusEl) {
          statusEl.textContent = '¡Cambios guardados con éxito!'
          setTimeout(() => {
            if (statusEl) statusEl.textContent = ''
          }, 3500)
        }
      } catch (err) {
        console.error('Error guardando plantillas:', err)
        toast('Error al guardar: ' + err.message, 'error')
      } finally {
        isSaving = false
        saveBtns.forEach(b => {
          b.disabled = false
          b.innerHTML = `${ICONS.check} Guardar Cambios`
        })
      }
    }

    container.querySelector('#btnSaveAll').addEventListener('click', handleSave)
    container.querySelector('#btnBottomSave')?.addEventListener('click', handleSave)

    updatePreviews()
  }

  await loadData()
}
