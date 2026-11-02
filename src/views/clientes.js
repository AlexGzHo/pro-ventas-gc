import { supabase } from '../supabase.js'
import { escapeHtml, formatDate, statusFor } from '../utils.js'
import { parseWhatsAppContact, getWhatsAppUrl } from '../whatsapp.js'
import { toast } from '../ui/toast.js'
import { confirmDialog } from '../ui/confirm.js'
import { openModal } from '../ui/modal.js'
import { ICONS } from '../ui/icons.js'
import { goToSubscription } from '../router.js'
import { openClientMergeDialog } from '../ui/mergeDialog.js'

/**
 * PRO VENTAS GC — Vista Clientes
 */
export async function mountClientesView(container, options = {}) {
  let clientsData = []
  let subsData = []
  let searchTerm = ''

  container.innerHTML = `
    <section class="hero">
      <div>
        <h2>Clientes</h2>
        <p>Directorio y fichas individuales de clientes.</p>
      </div>
      <button id="btnNewClient" class="btn btn-primary" type="button">
        ${ICONS.plus} Nuevo cliente
      </button>
    </section>

    <div class="clients-view">
      <section class="toolbar">
        <div class="search-box">
          <span class="search-icon" aria-hidden="true">${ICONS.search}</span>
          <input id="clientSearch" type="search" placeholder="Buscar por nombre, teléfono o @usuario..." autocomplete="off">
          <button id="clientSearchClear" class="search-clear hidden" type="button" title="Limpiar búsqueda" aria-label="Limpiar búsqueda">${ICONS.close}</button>
        </div>
      </section>

      <div class="results-bar">
        <div id="clientsCountLine" class="results-line">Cargando clientes...</div>
      </div>

      <div id="clientesList" class="clients-grid"></div>
    </div>
  `

  const listEl = container.querySelector('#clientesList')
  const searchInput = container.querySelector('#clientSearch')
  const searchClearBtn = container.querySelector('#clientSearchClear')
  const countLineEl = container.querySelector('#clientsCountLine')
  const btnNewClient = container.querySelector('#btnNewClient')

  async function loadData() {
    listEl.innerHTML = '<div class="empty-state">Cargando clientes...</div>'
    countLineEl.textContent = 'Cargando clientes...'

    const [cRes, sRes] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('subscriptions').select('*, product:products(name, logo_url)').order('created_at', { ascending: false })
    ])

    if (cRes.error) {
      listEl.innerHTML = '<div class="empty-state text-danger">Error cargando clientes: ' + escapeHtml(cRes.error.message) + '</div>'
      countLineEl.textContent = 'Error de carga'
      return
    }

    clientsData = cRes.data || []
    subsData = sRes.data || []
    renderList()
  }

  async function notifyClientsChanged() {
    if (typeof options.onClientsChanged === 'function') {
      await options.onClientsChanged()
    } else {
      window.dispatchEvent(new CustomEvent('pv-clients-changed', { detail: { clients: clientsData } }))
    }
  }

  function navigateToSub(rowId) {
    if (typeof options.onNavigateToSubscription === 'function') {
      options.onNavigateToSubscription(rowId)
    } else {
      goToSubscription(rowId)
    }
  }

  function renderList() {
    const q = searchTerm.toLowerCase().trim()
    const filtered = clientsData.filter(c => {
      return !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
    })

    const count = filtered.length
    countLineEl.textContent = `${count} ${count === 1 ? 'cliente' : 'clientes'}${q ? ' (filtrados)' : ''}`

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No se encontraron clientes.</div>'
      return
    }

    // Calcular metadatos para cada cliente
    const clientsWithMeta = filtered.map(c => {
      const cSubs = subsData.filter(s => s.client_id === c.id && !s.archived_at)

      let minDays = Infinity
      let nearestStatus = null

      cSubs.forEach(s => {
        const st = statusFor(s.expiry_date, s.archived_at)
        if (st.days !== null && st.days < minDays) {
          minDays = st.days
          nearestStatus = st
        }
      })

      return {
        ...c,
        activeSubs: cSubs,
        minDays: minDays === Infinity ? null : minDays,
        nearestStatus
      }
    })

    // Ordenar: primero los que tienen servicios vencidos, luego por vencer, luego activos, luego alfabéticamente
    clientsWithMeta.sort((a, b) => {
      const aVal = a.minDays !== null ? a.minDays : 9999
      const bVal = b.minDays !== null ? b.minDays : 9999
      if (aVal !== bVal) return aVal - bVal
      return (a.name || '').localeCompare(b.name || '')
    })

    const maxLogos = 4

    listEl.innerHTML = clientsWithMeta.map(c => {
      const parsedContact = c.phone ? parseWhatsAppContact(c.phone) : null
      const wappLink = parsedContact && parsedContact.isValid ? getWhatsAppUrl(c.phone) : ''
      const isUserContact = parsedContact?.type === 'username' || (c.phone || '').startsWith('@')
      const contactIcon = isUserContact ? '' : ICONS.phone

      const logosToShow = c.activeSubs.slice(0, maxLogos)
      const extraCount = c.activeSubs.length > maxLogos ? c.activeSubs.length - maxLogos : 0

      let avatarGroupHtml = ''
      if (c.activeSubs.length > 0) {
        const logosItems = logosToShow.map(s => {
          const name = s.product?.name || s.service || 'Servicio'
          const initials = name.trim().substring(0, 2).toUpperCase()
          const logoUrl = s.product?.logo_url

          if (logoUrl) {
            return `<img src="${escapeHtml(logoUrl)}" class="client-sub-avatar" alt="${escapeHtml(name)}" title="${escapeHtml(name)}" onerror="this.outerHTML='<span class=\\'client-sub-avatar-initials\\' title=\\'${escapeHtml(name)}\\'>${escapeHtml(initials)}</span>'" />`
          }
          return `<span class="client-sub-avatar-initials" title="${escapeHtml(name)}">${escapeHtml(initials)}</span>`
        }).join('')

        avatarGroupHtml = `
          <div class="client-subs-summary">
            <div class="client-subs-avatars">
              ${logosItems}
              ${extraCount > 0 ? `<span class="client-sub-avatar-overflow">+${extraCount}</span>` : ''}
            </div>
            <span class="client-subs-count">
              ${c.activeSubs.length} sub${c.activeSubs.length !== 1 ? 's' : ''}
            </span>
          </div>
        `
      } else {
        avatarGroupHtml = `<div class="client-subs-summary text-muted">Sin suscripciones activas</div>`
      }

      let statusHtml = ''
      if (c.nearestStatus) {
        statusHtml = `
          <div class="client-card-footer">
            <span class="client-card-status-label">Próx. alerta:</span>
            <span class="badge badge-${c.nearestStatus.tone}">${escapeHtml(c.nearestStatus.label)}</span>
          </div>
        `
      }

      return `
        <article class="client-card" data-id="${c.id}" role="button" tabindex="0">
          <div class="client-card-top">
            <h3 class="client-card-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</h3>
            <div class="client-card-actions">
              <button type="button" class="btn btn-small btn-ghost btn-merge-client" data-id="${c.id}" title="Fusionar cliente" aria-label="Fusionar cliente">
                ${ICONS.refresh}
              </button>
              <button type="button" class="btn btn-small btn-ghost btn-edit-client" data-id="${c.id}" title="Editar cliente" aria-label="Editar cliente">
                ${ICONS.edit}
              </button>
              <button type="button" class="btn btn-small btn-ghost btn-delete-client" data-id="${c.id}" title="Eliminar cliente" aria-label="Eliminar cliente">
                ${ICONS.trash}
              </button>
            </div>
          </div>

          <div class="client-card-contact">
            ${wappLink ? `
              <a href="${wappLink}" target="_blank" rel="noopener noreferrer" class="badge badge-success client-contact-link">
                ${contactIcon} ${escapeHtml(c.phone)}
              </a>
            ` : (c.phone ? `<span class="badge badge-neutral">${escapeHtml(c.phone)}</span>` : '<span class="text-muted">Sin contacto</span>')}
          </div>

          ${c.notes ? `
            <div class="client-card-notes" title="${escapeHtml(c.notes)}">
              ${escapeHtml(c.notes)}
            </div>
          ` : ''}

          ${avatarGroupHtml}
          ${statusHtml}
        </article>
      `
    }).join('')
  }

  // --- Modal de Ficha de Cliente ---
  function openClientProfileModal(clientId) {
    const client = clientsData.find(c => c.id === clientId)
    if (!client) return

    const cSubs = subsData.filter(s => s.client_id === clientId)
    const activeSubs = cSubs.filter(s => !s.archived_at)
    const archivedSubs = cSubs.filter(s => !!s.archived_at)

    // Ordenar activas: vencidas primero, luego por vencer, luego normales
    activeSubs.sort((a, b) => {
      const stA = statusFor(a.expiry_date, a.archived_at)
      const stB = statusFor(b.expiry_date, b.archived_at)
      const rank = (st) => st.key === 'vencido' ? 1 : (st.key === 'hoy' || st.key === 'proximo' ? 2 : 3)
      const rankA = rank(stA)
      const rankB = rank(stB)
      if (rankA !== rankB) return rankA - rankB
      return (stA.days ?? 9999) - (stB.days ?? 9999)
    })

    const totalActiveCount = activeSubs.length
    const expiredCount = activeSubs.filter(s => statusFor(s.expiry_date).key === 'vencido').length
    const soonCount = activeSubs.filter(s => {
      const k = statusFor(s.expiry_date).key
      return k === 'proximo' || k === 'hoy'
    }).length

    let priorityAlertHtml = ''
    if (expiredCount > 0) {
      priorityAlertHtml = `
        <div class="client-priority-alert danger">
          ${ICONS.error}
          <div><strong>Atención requerida:</strong> Este cliente tiene <strong>${expiredCount}</strong> suscripción(es) vencida(s).</div>
        </div>
      `
    } else if (soonCount > 0) {
      priorityAlertHtml = `
        <div class="client-priority-alert warning">
          ${ICONS.warning}
          <div><strong>Próximo vencimiento:</strong> Este cliente tiene <strong>${soonCount}</strong> suscripción(es) por vencer.</div>
        </div>
      `
    } else if (totalActiveCount > 0) {
      priorityAlertHtml = `
        <div class="client-priority-alert success">
          ${ICONS.success}
          <div><strong>Al día:</strong> Todas las suscripciones del cliente se encuentran vigentes.</div>
        </div>
      `
    } else {
      priorityAlertHtml = `
        <div class="client-priority-alert info">
          ${ICONS.info}
          <div>No tiene suscripciones activas registradas.</div>
        </div>
      `
    }

    const parsedContact = client.phone ? parseWhatsAppContact(client.phone) : null
    const wappLink = parsedContact && parsedContact.isValid ? getWhatsAppUrl(client.phone) : ''
    const isUserContact = parsedContact?.type === 'username' || (client.phone || '').startsWith('@')
    const contactIcon = isUserContact ? '' : ICONS.phone

    const renderSubRow = (s, isArchived = false) => {
      const st = statusFor(s.expiry_date, s.archived_at)
      const serviceName = s.product?.name || s.service || 'Servicio'
      const initials = serviceName.trim().substring(0, 2).toUpperCase()
      const logoUrl = s.product?.logo_url

      const logoEl = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(serviceName)}" class="client-sub-logo" onerror="this.outerHTML='<span class=\\'client-sub-logo-initials\\'>${escapeHtml(initials)}</span>'" />`
        : `<span class="client-sub-logo-initials">${escapeHtml(initials)}</span>`

      return `
        <div class="client-sub-item ${isArchived ? 'archived' : ''}">
          <div class="client-sub-item-main">
            ${logoEl}
            <div>
              <h4 class="client-sub-title">${escapeHtml(serviceName)}</h4>
              <div class="client-sub-details">
                ${s.provider ? `Proveedor: ${escapeHtml(s.provider)}` : ''}
                ${s.account ? ` • Cuenta: ${escapeHtml(s.account)}` : ''}
              </div>
            </div>
          </div>

          <div class="client-sub-meta">
            <div class="client-sub-expiry">
              <div class="client-sub-expiry-label">${isArchived ? 'Baja' : 'Vencimiento'}</div>
              <div class="client-sub-expiry-date">${formatDate(isArchived ? s.archived_at : s.expiry_date)}</div>
            </div>

            <span class="badge badge-${st.tone}">${escapeHtml(st.label)}</span>

            <button type="button" class="btn btn-small btn-ghost btn-view-sub" data-sub-id="${s.id}" title="Ver en Suscripciones">
              ${ICONS.search} Ver
            </button>
          </div>
        </div>
      `
    }

    const bodyEl = document.createElement('div')
    bodyEl.className = 'client-profile-content'
    bodyEl.innerHTML = `
      <div class="client-profile-hero">
        <div class="client-profile-header-info">
          <h3 class="client-profile-title">${escapeHtml(client.name)}</h3>
          <div class="client-card-contact">
            ${wappLink ? `
              <a href="${wappLink}" target="_blank" rel="noopener noreferrer" class="badge badge-success client-contact-link">
                ${contactIcon} ${escapeHtml(client.phone)}
              </a>
            ` : (client.phone ? `<span class="badge badge-neutral">${escapeHtml(client.phone)}</span>` : '<span class="text-muted">Sin teléfono registrado</span>')}
          </div>
          ${client.notes ? `<div class="client-profile-notes">${escapeHtml(client.notes)}</div>` : ''}
        </div>
      </div>

      <div class="client-profile-kpis">
        <div class="client-kpi-box">
          <div class="client-kpi-label">Vigentes</div>
          <div class="client-kpi-val">${totalActiveCount}</div>
        </div>
        <div class="client-kpi-box">
          <div class="client-kpi-label">Vencen pronto</div>
          <div class="client-kpi-val ${soonCount > 0 ? 'warning' : ''}">${soonCount}</div>
        </div>
        <div class="client-kpi-box">
          <div class="client-kpi-label">Vencidas</div>
          <div class="client-kpi-val ${expiredCount > 0 ? 'danger' : ''}">${expiredCount}</div>
        </div>
      </div>

      ${priorityAlertHtml}

      <div class="client-subs-section">
        <h4 class="client-subs-section-title">
          <span>Suscripciones Vigentes (${totalActiveCount})</span>
        </h4>
        ${activeSubs.length > 0
          ? activeSubs.map(s => renderSubRow(s, false)).join('')
          : '<div class="empty-state">No hay suscripciones vigentes para este cliente.</div>'
        }
      </div>

      ${archivedSubs.length > 0 ? `
        <div class="client-archived-section">
          <h4 class="client-archived-title">Historial de Archivadas (${archivedSubs.length})</h4>
          ${archivedSubs.map(s => renderSubRow(s, true)).join('')}
        </div>
      ` : ''}
    `

    const footerEl = document.createElement('div')
    footerEl.className = 'modal-actions'
    footerEl.innerHTML = `
      <button type="button" class="btn btn-ghost" id="btnProfileClose">Cerrar</button>
      <button type="button" class="btn btn-ghost" id="btnProfileMerge">${ICONS.refresh} Fusionar</button>
      <button type="button" class="btn btn-primary" id="btnProfileEdit">${ICONS.edit} Editar Cliente</button>
    `

    const modal = openModal({
      title: 'Ficha de Cliente',
      subtitle: client.name,
      body: bodyEl,
      footer: footerEl,
      size: 'lg',
      customClass: 'client-profile-modal'
    })

    footerEl.querySelector('#btnProfileClose').addEventListener('click', () => modal.close())

    footerEl.querySelector('#btnProfileEdit').addEventListener('click', () => {
      modal.close()
      openClientFormModal(clientId)
    })

    footerEl.querySelector('#btnProfileMerge').addEventListener('click', () => {
      modal.close()
      openClientMergeDialog({
        primaryClientId: clientId,
        clients: clientsData,
        subscriptions: subsData,
        onSuccess: async () => {
          await loadData()
          await notifyClientsChanged()
        }
      })
    })

    bodyEl.querySelectorAll('.btn-view-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.dataset.subId
        if (subId) {
          modal.close()
          navigateToSub(subId)
        }
      })
    })
  }

  // --- Modal Formulario Crear / Editar Cliente ---
  function openClientFormModal(clientId = null) {
    const isEditing = Boolean(clientId)
    const client = isEditing ? clientsData.find(c => c.id === clientId) : null

    const bodyEl = document.createElement('form')
    bodyEl.className = 'form-stack'
    bodyEl.id = 'clientForm'
    bodyEl.innerHTML = `
      <label>
        Nombre del cliente *
        <input type="text" id="clientNameInput" required class="form-control" value="${escapeHtml(client?.name || '')}" placeholder="Ej. Juan Pérez" />
      </label>

      <label>
        WhatsApp (Teléfono o @usuario)
        <input type="text" id="clientPhoneInput" class="form-control" value="${escapeHtml(client?.phone || '')}" placeholder="Ej. 987654321, +54 911... o @usuario" />
      </label>

      <label>
        Notas internas / preferencias
        <textarea id="clientNotesInput" class="form-control" rows="3" placeholder="Notas sobre el cliente...">${escapeHtml(client?.notes || '')}</textarea>
      </label>
    `

    const footerEl = document.createElement('div')
    footerEl.className = 'modal-actions'
    footerEl.innerHTML = `
      <button type="button" class="btn btn-ghost" id="btnCancelClientForm">Cancelar</button>
      <button type="submit" form="clientForm" class="btn btn-primary" id="btnSaveClient">
        ${isEditing ? 'Guardar Cambios' : 'Registrar Cliente'}
      </button>
    `

    const modal = openModal({
      title: isEditing ? 'Editar Cliente' : 'Nuevo Cliente',
      subtitle: isEditing ? client.name : 'Ingresa los datos para registrar un nuevo cliente.',
      body: bodyEl,
      footer: footerEl,
      size: 'md'
    })

    footerEl.querySelector('#btnCancelClientForm').addEventListener('click', () => modal.close())

    bodyEl.addEventListener('submit', async (e) => {
      e.preventDefault()
      const name = bodyEl.querySelector('#clientNameInput').value.trim()
      const rawPhone = bodyEl.querySelector('#clientPhoneInput').value.trim()
      const notes = bodyEl.querySelector('#clientNotesInput').value.trim() || null
      const submitBtn = footerEl.querySelector('#btnSaveClient')

      if (!name) {
        toast('El nombre del cliente es obligatorio.', 'error')
        bodyEl.querySelector('#clientNameInput').focus()
        return
      }

      let phone = null
      if (rawPhone) {
        const parsed = parseWhatsAppContact(rawPhone)
        if (!parsed || !parsed.isValid) {
          toast(parsed?.error || 'El contacto de WhatsApp no es válido.', 'error')
          return
        }
        phone = parsed.value
      }

      submitBtn.disabled = true
      submitBtn.textContent = 'Guardando...'

      try {
        if (isEditing) {
          const { error } = await supabase.from('clients').update({ name, phone, notes }).eq('id', clientId)
          if (error) throw error
          toast(`Cliente "${name}" actualizado con éxito.`, 'ok')
        } else {
          const { error } = await supabase.from('clients').insert([{ name, phone, notes }])
          if (error) throw error
          toast(`Cliente "${name}" registrado con éxito.`, 'ok')
        }

        modal.close()
        await loadData()
        await notifyClientsChanged()
      } catch (err) {
        console.error('Error guardando cliente:', err)
        toast('Error al guardar: ' + err.message, 'error')
        submitBtn.disabled = false
        submitBtn.textContent = isEditing ? 'Guardar Cambios' : 'Registrar Cliente'
      }
    })
  }

  // --- Eliminación de Cliente ---
  async function handleDeleteClient(clientId) {
    const client = clientsData.find(c => c.id === clientId)
    if (!client) return

    const cSubs = subsData.filter(s => s.client_id === clientId)

    if (cSubs.length > 0) {
      // Bloqueo con sugerencia interactiva de fusión
      const shouldMerge = await confirmDialog({
        title: 'Cliente con suscripciones asociadas',
        message: `El cliente <strong>${escapeHtml(client.name)}</strong> tiene <strong>${cSubs.length}</strong> suscripción(es) asociada(s).<br><br>No se puede eliminar directamente. ¿Deseas fusionarlo con otro cliente para transferir sus suscripciones?`,
        confirmText: 'Fusionar cliente',
        cancelText: 'Cerrar',
        icon: 'warning'
      })

      if (shouldMerge) {
        openClientMergeDialog({
          primaryClientId: clientId,
          clients: clientsData,
          subscriptions: subsData,
          onSuccess: async () => {
            await loadData()
            await notifyClientsChanged()
          }
        })
      }
      return
    }

    const confirmed = await confirmDialog({
      title: '¿Eliminar cliente permanentemente?',
      message: `¿Estás seguro de que deseas eliminar permanentemente al cliente <strong>${escapeHtml(client.name)}</strong>?<br><br><span class="text-danger">Esta acción es irreversible y no se puede deshacer.</span>`,
      confirmText: 'Eliminar cliente',
      cancelText: 'Cancelar',
      danger: true
    })

    if (!confirmed) return

    try {
      const { error } = await supabase.rpc('delete_client', { p_client_id: clientId })
      if (error) throw error
      toast('Cliente eliminado con éxito.', 'ok')
      await loadData()
      await notifyClientsChanged()
    } catch (err) {
      console.error('Error eliminando cliente:', err)
      toast('Error al eliminar: ' + err.message, 'error')
    }
  }

  // --- Event Delegation ---
  container.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-client')
    if (editBtn) {
      e.stopPropagation()
      openClientFormModal(editBtn.dataset.id)
      return
    }

    const deleteBtn = e.target.closest('.btn-delete-client')
    if (deleteBtn) {
      e.stopPropagation()
      handleDeleteClient(deleteBtn.dataset.id)
      return
    }

    const mergeBtn = e.target.closest('.btn-merge-client')
    if (mergeBtn) {
      e.stopPropagation()
      openClientMergeDialog({
        primaryClientId: mergeBtn.dataset.id,
        clients: clientsData,
        subscriptions: subsData,
        onSuccess: async () => {
          await loadData()
          await notifyClientsChanged()
        }
      })
      return
    }

    // No abrir ficha si se hace clic en enlaces (WhatsApp)
    if (e.target.closest('a')) {
      return
    }

    const card = e.target.closest('.client-card')
    if (card && card.dataset.id) {
      openClientProfileModal(card.dataset.id)
    }
  })

  // Enter en la tarjeta para accesibilidad con teclado
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const card = e.target.closest('.client-card')
      if (card && card.dataset.id && !e.target.closest('button, a')) {
        openClientProfileModal(card.dataset.id)
      }
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

  btnNewClient.addEventListener('click', () => {
    openClientFormModal(null)
  })

  await loadData()
}
