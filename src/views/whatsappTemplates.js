import { supabase } from '../supabase.js'
import { defaultTemplates, interpolateTemplate, setTemplates } from '../whatsapp.js'

export async function mountWhatsappTemplatesView(container) {
  let isSaving = false

  // Dummy row for previewing the templates
  const dummyRow = {
    client_name: 'Juan Pérez',
    service: 'NETFLIX PREMIUM',
    expiry_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    sale_price: 25.00,
    sale_price_currency: 'PEN',
    username_email: 'juan@ejemplo.com',
    password: 'securePassword123',
    profile: 'Perfil 1',
    pin: '1234',
    access_url: 'https://netflix.com',
    extras: { 'Pantalla': 1 }
  }

  // Load latest from DB
  async function loadData() {
    container.innerHTML = `<div style="padding: 20px;">Cargando plantillas...</div>`

    try {
      const { data, error } = await supabase.from('whatsapp_templates').select('id, content')
      if (error) throw error

      const newTemplates = {}
      if (data) {
        data.forEach(item => {
          newTemplates[item.id] = item.content
        })
      }
      setTemplates(newTemplates)
      render()
    } catch (err) {
      console.error(err)
      container.innerHTML = `<div style="padding: 20px; color: red;">Error al cargar: ${err.message}</div>`
    }
  }

  function render() {
    container.innerHTML = `
      <section class="hero">
        <div>
          <h2>Plantillas de WhatsApp</h2>
          <p>Personaliza los mensajes de WhatsApp que se envían a los clientes.</p>
        </div>
      </section>

      <div class="grid" style="display: grid; gap: 20px; grid-template-columns: 1fr 1fr;">
        <div class="card" style="padding: 20px;">
          <h3>Plantilla de Recordatorio</h3>
          <p class="text-muted" style="margin-bottom: 15px; font-size: 0.9em;">Se envía al presionar el botón "Cobrar" o "WhatsApp" en los resúmenes.</p>
          <textarea id="tplReminder" rows="8" style="width: 100%; font-family: monospace; padding: 10px; margin-bottom: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); resize: vertical;"></textarea>
          <h4>Vista previa (con datos de ejemplo):</h4>
          <pre id="prevReminder" style="background: var(--bg-hover); padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 0.9em; margin-bottom: 15px;"></pre>
        </div>

        <div class="card" style="padding: 20px;">
          <h3>Plantilla de Credenciales</h3>
          <p class="text-muted" style="margin-bottom: 15px; font-size: 0.9em;">Se envía al presionar "Enviar datos" o "Enviar WhatsApp" desde la vista de accesos.</p>
          <textarea id="tplCredentials" rows="8" style="width: 100%; font-family: monospace; padding: 10px; margin-bottom: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); resize: vertical;"></textarea>
          <h4>Vista previa (con datos de ejemplo):</h4>
          <pre id="prevCredentials" style="background: var(--bg-hover); padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 0.9em; margin-bottom: 15px;"></pre>
        </div>

        <div class="card" style="padding: 20px; grid-column: 1 / -1;">
          <h3>Plantilla de Actualización</h3>
          <p class="text-muted" style="margin-bottom: 15px; font-size: 0.9em;">Se envía al presionar "Actualizar datos".</p>
          <textarea id="tplUpdate" rows="8" style="width: 100%; font-family: monospace; padding: 10px; margin-bottom: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); resize: vertical;"></textarea>
          <h4>Vista previa (con datos de ejemplo):</h4>
          <pre id="prevUpdate" style="background: var(--bg-hover); padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 0.9em; margin-bottom: 15px;"></pre>
        </div>
      </div>

      <div class="card" style="padding: 20px; margin-top: 20px; display: flex; gap: 15px; align-items: center;">
        <button id="btnSaveTemplates" class="btn btn-primary" style="padding: 10px 24px;">Guardar Cambios</button>
        <button id="btnRestoreTemplates" class="btn btn-ghost">Restaurar Valores por Defecto</button>
        <span id="saveStatus" style="color: var(--status-success-text); font-weight: bold; margin-left: auto;"></span>
      </div>

      <div class="card" style="padding: 20px; margin-top: 20px;">
        <h3>Variables disponibles</h3>
        <p class="text-muted" style="margin-bottom: 10px;">Puedes usar estas variables en tus plantillas encerrándolas en llaves dobles (ej. <code>{{cliente}}</code>). Se reemplazarán automáticamente.</p>
        <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
          <li><code>{{cliente}}</code> Nombre del cliente</li>
          <li><code>{{servicio}}</code> Nombre del servicio</li>
          <li><code>{{vencimiento}}</code> Fecha de vencimiento</li>
          <li><code>{{dias}}</code> Días restantes</li>
          <li><code>{{importe}}</code> Importe de venta</li>
          <li><code>{{usuario}}</code> Correo o usuario</li>
          <li><code>{{contrasena}}</code> Contraseña</li>
          <li><code>{{perfil}}</code> Nombre del perfil</li>
          <li><code>{{pin}}</code> PIN de acceso</li>
          <li><code>{{url}}</code> URL de acceso</li>
          <li><code>{{extras}}</code> Muestra los campos adicionales</li>
        </ul>
      </div>
    `

    // Import current templates from whatsapp module
    import('../whatsapp.js').then(({ templates }) => {
      const tplReminder = document.getElementById('tplReminder')
      const tplCredentials = document.getElementById('tplCredentials')
      const tplUpdate = document.getElementById('tplUpdate')

      tplReminder.value = templates.reminder
      tplCredentials.value = templates.credentials
      tplUpdate.value = templates.update

      function updatePreviews() {
        document.getElementById('prevReminder').textContent = interpolateTemplate(tplReminder.value, dummyRow)
        document.getElementById('prevCredentials').textContent = interpolateTemplate(tplCredentials.value, dummyRow)
        document.getElementById('prevUpdate').textContent = interpolateTemplate(tplUpdate.value, dummyRow)
      }

      tplReminder.addEventListener('input', updatePreviews)
      tplCredentials.addEventListener('input', updatePreviews)
      tplUpdate.addEventListener('input', updatePreviews)

      updatePreviews()

      document.getElementById('btnRestoreTemplates').addEventListener('click', () => {
        if (!confirm('¿Estás seguro de restaurar las plantillas por defecto? Perderás tus cambios no guardados.')) return
        tplReminder.value = defaultTemplates.reminder
        tplCredentials.value = defaultTemplates.credentials
        tplUpdate.value = defaultTemplates.update
        updatePreviews()
      })

      document.getElementById('btnSaveTemplates').addEventListener('click', async () => {
        if (isSaving) return
        isSaving = true

        const btn = document.getElementById('btnSaveTemplates')
        const status = document.getElementById('saveStatus')

        btn.textContent = 'Guardando...'
        status.textContent = ''

        try {
          const updates = [
            { id: 'reminder', content: tplReminder.value },
            { id: 'credentials', content: tplCredentials.value },
            { id: 'update', content: tplUpdate.value }
          ]

          const { error } = await supabase.from('whatsapp_templates').upsert(updates)

          if (error) throw error

          // Update local state
          setTemplates({
            reminder: tplReminder.value,
            credentials: tplCredentials.value,
            update: tplUpdate.value
          })

          status.textContent = '¡Cambios guardados con éxito!'
          setTimeout(() => {
            if (status) status.textContent = ''
          }, 3000)

        } catch (err) {
          console.error(err)
          alert('Error al guardar: ' + err.message)
        } finally {
          isSaving = false
          btn.textContent = 'Guardar Cambios'
        }
      })
    })
  }

  await loadData()
}
