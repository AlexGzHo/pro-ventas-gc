import { supabase } from '../supabase.js'
import { escapeHtml } from '../utils.js'
import { parseWhatsAppContact, getWhatsAppUrl } from '../whatsapp.js'
import { toast } from '../ui/toast.js'
import { confirmDialog } from '../ui/confirm.js'
import { openModal } from '../ui/modal.js'
import { ICONS } from '../ui/icons.js'
import { openProviderReassignDialog } from '../ui/mergeDialog.js'

/**
 * PRO VENTAS GC — Vista Proveedores
 */
export async function mountProveedoresView(container, options = {}) {
  let providersData = []
  let subsData = []
  let productsData = []
  let searchTerm = ''

  container.innerHTML = `
    <section class="page-header">
      <div>
        <h2>Proveedores</h2>
        <p>Directorio de proveedores y enlaces funcionales.</p>
      </div>
      <button id="btnNewProvider" class="btn btn-primary" type="button">
        ${ICONS.plus} Nuevo proveedor
      </button>
    </section>

    <div class="providers-view">
      <section class="toolbar">
        <div class="search-box">
          <span class="search-icon" aria-hidden="true">${ICONS.search}</span>
          <input id="providerSearch" type="search" placeholder="Buscar proveedor o notas..." autocomplete="off">
          <button id="providerSearchClear" class="search-clear hidden" type="button" title="Limpiar búsqueda" aria-label="Limpiar búsqueda">${ICONS.close}</button>
        </div>
      </section>

      <div class="results-bar">
        <div id="providersCountLine" class="results-line">Cargando proveedores...</div>
      </div>

      <div class="summary-view-wrapper">
        <table class="data-table summary-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Website</th>
              <th>WhatsApp</th>
              <th>Telegram</th>
              <th>Vinculaciones</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="proveedoresList">
            <tr><td colspan="6" class="empty-state">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `

  const listEl = container.querySelector('#proveedoresList')
  const searchInput = container.querySelector('#providerSearch')
  const searchClearBtn = container.querySelector('#providerSearchClear')
  const countLineEl = container.querySelector('#providersCountLine')
  const btnNewProvider = container.querySelector('#btnNewProvider')

  async function loadData() {
    listEl.innerHTML = '<tr><td colspan="6" class="empty-state">Cargando proveedores...</td></tr>'
    countLineEl.textContent = 'Cargando proveedores...'

    const [pRes, sRes, prodRes] = await Promise.all([
      supabase.from('providers').select('*').order('name'),
      supabase.from('subscriptions').select('provider_id').not('provider_id', 'is', null),
      supabase.from('products').select('provider_id').not('provider_id', 'is', null)
    ])

    if (pRes.error) {
      listEl.innerHTML = '<tr><td colspan="6" class="empty-state text-danger">Error cargando proveedores: ' + escapeHtml(pRes.error.message) + '</td></tr>'
      countLineEl.textContent = 'Error de carga'
      return
    }

    providersData = pRes.data || []
    subsData = sRes.data || []
    productsData = prodRes.data || []
    renderList()
  }

  async function notifyProvidersChanged() {
    if (typeof options.onProvidersChanged === 'function') {
      await options.onProvidersChanged()
    } else {
      window.dispatchEvent(new CustomEvent('pv-providers-changed', { detail: { providers: providersData } }))
    }
  }

  function renderList() {
    const q = searchTerm.toLowerCase().trim()
    const filtered = providersData.filter(p => {
      return !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q) ||
        (p.website || '').toLowerCase().includes(q) ||
        (p.whatsapp || '').toLowerCase().includes(q) ||
        (p.telegram || '').toLowerCase().includes(q)
    })

    const count = filtered.length
    countLineEl.textContent = `${count} ${count === 1 ? 'proveedor' : 'proveedores'}${q ? ' (filtrados)' : ''}`

    if (filtered.length === 0) {
      listEl.innerHTML = '<tr><td colspan="6" class="empty-state">No se encontraron proveedores.</td></tr>'
      return
    }

    listEl.innerHTML = filtered.map(p => {
      const parsedWa = p.whatsapp ? parseWhatsAppContact(p.whatsapp) : null
      const waLink = parsedWa && parsedWa.isValid ? getWhatsAppUrl(p.whatsapp) : (p.whatsapp && p.whatsapp.startsWith('http') ? p.whatsapp : '')
      const waLabel = parsedWa?.type === 'username' ? escapeHtml(parsedWa.value) : (p.whatsapp || 'WhatsApp')

      let tgLink = ''
      if (p.telegram) {
        tgLink = p.telegram.startsWith('http')
          ? p.telegram
          : `https://t.me/${p.telegram.replace('@', '')}`
      }

      const depSubs = subsData.filter(s => s.provider_id === p.id).length
      const depProds = productsData.filter(pr => pr.provider_id === p.id).length

      return `
        <tr data-id="${p.id}">
          <td>
            <div class="provider-name-cell">
              <span class="provider-name-title">${escapeHtml(p.name)}</span>
              ${p.notes ? `<span class="provider-notes-sub">${escapeHtml(p.notes)}</span>` : ''}
            </div>
          </td>
          <td>
            ${p.website ? `
              <a href="${escapeHtml(p.website)}" target="_blank" rel="noopener noreferrer" class="badge badge-neutral provider-link-badge">
                ${ICONS.search} Sitio web
              </a>
            ` : '<span class="text-muted">—</span>'}
          </td>
          <td>
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="badge badge-success provider-link-badge">
                ${ICONS.phone} ${escapeHtml(waLabel)}
              </a>
            ` : (p.whatsapp ? `<span class="badge badge-neutral">${ICONS.phone} ${escapeHtml(p.whatsapp)}</span>` : '<span class="text-muted">—</span>')}
          </td>
          <td>
            ${tgLink ? `
              <a href="${escapeHtml(tgLink)}" target="_blank" rel="noopener noreferrer" class="badge badge-neutral provider-link-badge">
                ${ICONS.messageSquare} Telegram
              </a>
            ` : (p.telegram ? `<span class="badge badge-neutral">${ICONS.messageSquare} ${escapeHtml(p.telegram)}</span>` : '<span class="text-muted">—</span>')}
          </td>
          <td>
            <span class="badge badge-neutral provider-deps-badge">
              ${ICONS.subscriptions} ${depSubs} sub(s) • ${depProds} prod(s)
            </span>
          </td>
          <td>
            <div class="provider-actions-cell justify-end">
              <button type="button" class="btn btn-small btn-ghost btn-merge-prov" data-id="${p.id}" title="Reasignar dependencias y eliminar" aria-label="Reasignar dependencias">
                ${ICONS.refresh}
              </button>
              <button type="button" class="btn btn-small btn-ghost btn-edit-prov" data-id="${p.id}" title="Editar proveedor" aria-label="Editar proveedor">
                ${ICONS.edit}
              </button>
              <button type="button" class="btn btn-small btn-ghost btn-delete-prov" data-id="${p.id}" title="Eliminar proveedor" aria-label="Eliminar proveedor">
                ${ICONS.trash}
              </button>
            </div>
          </td>
        </tr>
      `
    }).join('')
  }

  // --- Modal Formulario Proveedor (Crear / Editar) ---
  function openProviderFormModal(providerId = null) {
    const isEditing = Boolean(providerId)
    const provider = isEditing ? providersData.find(p => p.id === providerId) : null

    const bodyEl = document.createElement('form')
    bodyEl.className = 'form-stack'
    bodyEl.id = 'providerForm'
    bodyEl.innerHTML = `
      <label class="field">
        Nombre del proveedor *
        <input type="text" id="provNameInput" required class="form-control" value="${escapeHtml(provider?.name || '')}" placeholder="Ej. Proveedor XYZ" />
      </label>

      <div class="provider-form-row">
        <label class="field">
          Website
          <input type="url" id="provWebsiteInput" class="form-control" value="${escapeHtml(provider?.website || '')}" placeholder="https://..." />
        </label>

        <label class="field">
          WhatsApp (Teléfono o @usuario)
          <input type="text" id="provWhatsappInput" class="form-control" value="${escapeHtml(provider?.whatsapp || '')}" placeholder="Ej. 987654321, +1... o @usuario" />
        </label>

        <label class="field">
          Telegram
          <input type="text" id="provTelegramInput" class="form-control" value="${escapeHtml(provider?.telegram || '')}" placeholder="@usuario o URL" />
        </label>
      </div>

      <label class="field">
        Notas / Condiciones del proveedor
        <textarea id="provNotesInput" class="form-control" rows="3" placeholder="Información de contacto adicional, reglas, garantías...">${escapeHtml(provider?.notes || '')}</textarea>
      </label>
    `

    const footerEl = document.createElement('div')
    footerEl.className = 'modal-actions'
    footerEl.innerHTML = `
      <button type="button" class="btn btn-ghost" id="btnCancelProvForm">Cancelar</button>
      <button type="submit" form="providerForm" class="btn btn-primary" id="btnSaveProv">
        ${isEditing ? 'Guardar Cambios' : 'Registrar Proveedor'}
      </button>
    `

    const modal = openModal({
      title: isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor',
      subtitle: isEditing ? provider.name : 'Ingresa los datos para registrar un nuevo proveedor.',
      body: bodyEl,
      footer: footerEl,
      size: 'md'
    })

    footerEl.querySelector('#btnCancelProvForm').addEventListener('click', () => modal.close())

    bodyEl.addEventListener('submit', async (e) => {
      e.preventDefault()
      const name = bodyEl.querySelector('#provNameInput').value.trim()
      const website = bodyEl.querySelector('#provWebsiteInput').value.trim() || null
      const rawWhatsapp = bodyEl.querySelector('#provWhatsappInput').value.trim()
      const telegram = bodyEl.querySelector('#provTelegramInput').value.trim() || null
      const notes = bodyEl.querySelector('#provNotesInput').value.trim() || null
      const submitBtn = footerEl.querySelector('#btnSaveProv')

      if (!name) {
        toast('El nombre del proveedor es obligatorio.', 'error')
        bodyEl.querySelector('#provNameInput').focus()
        return
      }

      let whatsapp = null
      if (rawWhatsapp) {
        const parsed = parseWhatsAppContact(rawWhatsapp)
        if (!parsed || !parsed.isValid) {
          toast(parsed?.error || 'El contacto de WhatsApp no es válido.', 'error')
          return
        }
        whatsapp = parsed.value
      }

      const payload = { name, website, whatsapp, telegram, notes }
      submitBtn.disabled = true
      submitBtn.textContent = 'Guardando...'

      try {
        if (isEditing) {
          const { error } = await supabase.from('providers').update(payload).eq('id', providerId)
          if (error) throw error
          toast(`Proveedor "${name}" actualizado con éxito.`, 'ok')
        } else {
          const { error } = await supabase.from('providers').insert([payload])
          if (error) throw error
          toast(`Proveedor "${name}" registrado con éxito.`, 'ok')
        }

        modal.close()
        await loadData()
        await notifyProvidersChanged()
      } catch (err) {
        console.error('Error guardando proveedor:', err)
        toast('Error al guardar: ' + err.message, 'error')
        submitBtn.disabled = false
        submitBtn.textContent = isEditing ? 'Guardar Cambios' : 'Registrar Proveedor'
      }
    })
  }

  // --- Eliminación de Proveedor ---
  async function handleDeleteProvider(providerId) {
    const prov = providersData.find(p => p.id === providerId)
    if (!prov) return

    const depSubs = subsData.filter(s => s.provider_id === providerId).length
    const depProds = productsData.filter(pr => pr.provider_id === providerId).length

    if (depSubs > 0 || depProds > 0) {
      // Bloqueo con sugerencia interactiva de reasignación
      const shouldReassign = await confirmDialog({
        title: 'Proveedor con dependencias vinculadas',
        message: `El proveedor <strong>${escapeHtml(prov.name)}</strong> tiene <strong>${depSubs}</strong> suscripción(es) y <strong>${depProds}</strong> producto(s) vinculado(s).<br><br>No se puede eliminar directamente. ¿Deseas reasignar sus dependencias a otro proveedor antes de eliminarlo?`,
        confirmText: 'Reasignar proveedor',
        cancelText: 'Cerrar',
        icon: 'warning'
      })

      if (shouldReassign) {
        openProviderReassignDialog({
          sourceProviderId: providerId,
          providers: providersData,
          subscriptions: subsData,
          products: productsData,
          onSuccess: async () => {
            await loadData()
            await notifyProvidersChanged()
          }
        })
      }
      return
    }

    const confirmed = await confirmDialog({
      title: '¿Eliminar proveedor permanentemente?',
      message: `¿Estás seguro de que deseas eliminar al proveedor <strong>${escapeHtml(prov.name)}</strong>?<br><br><span class="text-danger">Esta acción es irreversible y no se puede deshacer.</span>`,
      confirmText: 'Eliminar proveedor',
      cancelText: 'Cancelar',
      danger: true
    })

    if (!confirmed) return

    try {
      const { error } = await supabase.rpc('delete_provider', { p_provider_id: providerId })
      if (error) throw error
      toast('Proveedor eliminado con éxito.', 'ok')
      await loadData()
      await notifyProvidersChanged()
    } catch (err) {
      console.error('Error eliminando proveedor:', err)
      toast('Error al eliminar: ' + err.message, 'error')
    }
  }

  // --- Event Delegation ---
  container.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-prov')
    if (editBtn) {
      openProviderFormModal(editBtn.dataset.id)
      return
    }

    const deleteBtn = e.target.closest('.btn-delete-prov')
    if (deleteBtn) {
      handleDeleteProvider(deleteBtn.dataset.id)
      return
    }

    const mergeBtn = e.target.closest('.btn-merge-prov')
    if (mergeBtn) {
      openProviderReassignDialog({
        sourceProviderId: mergeBtn.dataset.id,
        providers: providersData,
        subscriptions: subsData,
        products: productsData,
        onSuccess: async () => {
          await loadData()
          await notifyProvidersChanged()
        }
      })
      return
    }
  })

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value
    searchClearBtn.classList.toggle('hidden', !searchTerm.trim())
    renderList()
  })

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = ''
    searchTerm = ''
    searchClearBtn.classList.add('hidden')
    searchInput.focus()
    renderList()
  })

  btnNewProvider.addEventListener('click', () => {
    openProviderFormModal(null)
  })

  await loadData()
}
