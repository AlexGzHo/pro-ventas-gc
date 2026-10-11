import { supabase } from '../supabase.js'
import { escapeHtml, formatDate, formatAmount, statusFor, normalizeCurrency } from '../utils.js'

export async function mountClientesView(container, options = {}) {
  let clientsData = []
  let subsData = []
  let searchTerm = ''
  let editingId = null
  let selectedClientId = null

  container.innerHTML = `
    <section class="hero">
      <div>
        <h2>Clientes</h2>
        <p>Directorio y fichas individuales de clientes.</p>
      </div>
      <button id="btnNewClient" class="btn btn-primary">+ Nuevo Cliente</button>
    </section>

    <div id="clientsMain">
      <section class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input id="clientSearch" type="search" placeholder="Buscar por nombre o teléfono...">
        </div>
      </section>

      <div id="clientFormContainer" class="card hidden" style="margin-bottom: 20px;">
        <h3 id="clientFormTitle" style="margin-top:0;">Registrar Nuevo Cliente</h3>
        <form id="clientForm" class="form-stack" style="max-width: 500px;">
          <label>Nombre del cliente *
            <input type="text" id="clientName" required class="form-control" />
          </label>
          <label>WhatsApp / Teléfono
            <input type="text" id="clientPhone" class="form-control" />
          </label>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button type="submit" class="btn btn-primary">Guardar</button>
            <button type="button" id="clientFormCancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </form>
      </div>

      <div id="clientMergeContainer" class="card hidden" style="margin-bottom: 20px; border-color: var(--color-brand);">
        <h3 style="margin-top:0;">Fusionar Cliente</h3>
        <div id="clientMergeInfo" style="margin-bottom: 15px; color: var(--text-secondary);"></div>
        <form id="clientMergeForm" class="form-stack" style="max-width: 500px;">
          <input type="hidden" id="mergeSourceId" />
          <label>Cliente de destino (Conservar) *
            <select id="mergeTargetSelect" required class="form-control"></select>
          </label>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button type="submit" class="btn btn-danger">Confirmar Fusión</button>
            <button type="button" id="clientMergeCancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </form>
      </div>

      <div id="clientesList" style="margin-top: 20px;">
        <div style="text-align:center; padding: 20px;">Cargando...</div>
      </div>
    </div>

    <div id="clientProfile" class="hidden">
      <!-- Ficha de cliente -->
    </div>
  `

  const listEl = container.querySelector('#clientesList')
  const formContainer = container.querySelector('#clientFormContainer')
  const form = container.querySelector('#clientForm')
  const searchInput = container.querySelector('#clientSearch')
  const profileEl = container.querySelector('#clientProfile')
  const mainEl = container.querySelector('#clientsMain')

  async function loadData() {
    listEl.innerHTML = '<div style="text-align:center; padding: 20px;">Cargando...</div>'

    const [cRes, sRes] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('subscriptions').select('*, product:products(name, logo_url)').order('created_at', { ascending: false })
    ])

    if (cRes.error) {
      listEl.innerHTML = '<div style="color:red; padding: 20px;">Error cargando clientes.</div>'
      return
    }

    clientsData = cRes.data || []
    subsData = sRes.data || []
    renderList()
  }

  function renderList() {
    const q = searchTerm.toLowerCase().trim()
    const filtered = clientsData.filter(c => {
      return !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
    })

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 20px;">No se encontraron clientes.</div>'
      return
    }

    // Preparar datos de clientes con sus suscripciones y estados
    const clientsWithMeta = filtered.map(c => {
      const cSubs = subsData.filter(s => s.client_id === c.id && !s.archived_at)

      let minDays = Infinity
      let nearestStatus = null

      const activeSubs = cSubs.filter(s => {
        const st = statusFor(s.expiry_date, s.archived_at)
        if (st.days !== null && st.days < minDays) {
          minDays = st.days
          nearestStatus = st
        }
        return true
      })

      return {
        ...c,
        activeSubs,
        minDays: minDays === Infinity ? null : minDays,
        nearestStatus
      }
    })

    // Ordenar: primero los que tienen servicios vencidos (< 0), luego por vencer (0..3), luego los demás, luego alfabéticamente
    clientsWithMeta.sort((a, b) => {
      const aVal = a.minDays !== null ? a.minDays : 9999
      const bVal = b.minDays !== null ? b.minDays : 9999
      if (aVal !== bVal) return aVal - bVal
      return (a.name || '').localeCompare(b.name || '')
    })

    const maxLogos = 4

    listEl.innerHTML = `
      <div class="client-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
        ${clientsWithMeta.map(c => {
          const wappLink = c.phone ? `https://wa.me/${c.phone.replace(/[^0-9]/g, '')}` : '#'

          const logosToShow = c.activeSubs.slice(0, maxLogos)
          const extraCount = c.activeSubs.length > maxLogos ? c.activeSubs.length - maxLogos : 0

          let avatarGroupHtml = ''
          if (c.activeSubs.length > 0) {
            const logosItems = logosToShow.map((s, i) => {
              const name = s.product?.name || s.service || '?'
              const initials = name.trim().substring(0, 2).toUpperCase()
              const logoUrl = s.product?.logo_url
              const margin = i > 0 ? 'margin-left: -10px;' : ''

              if (logoUrl) {
                return `
                  <div style="position: relative; width: 32px; height: 32px; ${margin}">
                    <img src="${escapeHtml(logoUrl)}" title="${escapeHtml(name)}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--bg-card); object-fit: cover; background-color: var(--bg-surface);" />
                    <div title="${escapeHtml(name)}" style="display: none; width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--bg-card); background-color: var(--bg-surface-elevated); color: var(--text-primary); align-items: center; justify-content: center; font-size: 11px; font-weight: 600;">${escapeHtml(initials)}</div>
                  </div>
                `
              } else {
                return `
                  <div title="${escapeHtml(name)}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--bg-card); ${margin} background-color: var(--bg-surface-elevated); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600;">${escapeHtml(initials)}</div>
                `
              }
            }).join('')

            avatarGroupHtml = `
              <div style="display: flex; align-items: center; margin-top: 12px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center;">
                  ${logosItems}
                  ${extraCount > 0 ? `<div style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--bg-card); margin-left: -10px; background-color: var(--bg-surface-elevated); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; z-index: 1;">+${extraCount}</div>` : ''}
                </div>
                <div style="margin-left: 10px; font-size: 12px; color: var(--text-muted);">
                  ${c.activeSubs.length} sub${c.activeSubs.length !== 1 ? 's' : ''}
                </div>
              </div>
            `
          } else {
            avatarGroupHtml = `<div style="margin-top: 12px; margin-bottom: 12px; font-size: 12px; color: var(--text-muted);">Sin suscripciones activas</div>`
          }

          let statusHtml = ''
          if (c.nearestStatus) {
             statusHtml = `
               <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                 <span style="color: var(--text-muted);">Próx. alerta:</span>
                 <span class="status-badge ${c.nearestStatus.tone}">${escapeHtml(c.nearestStatus.label)}</span>
               </div>
             `
          }

          return `
            <div class="card btn-view-profile" data-id="${c.id}" style="cursor: pointer; display: flex; flex-direction: column; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h3 style="margin: 0; font-size: 16px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px;">${escapeHtml(c.name)}</h3>
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-small btn-ghost btn-merge-client" data-id="${c.id}" title="Fusionar" style="padding: 4px; padding-bottom: 0px;" onclick="event.stopPropagation();">🔗</button>
                  <button class="btn btn-small btn-ghost btn-delete-client" data-id="${c.id}" title="Eliminar" style="padding: 4px; padding-bottom: 0px;" onclick="event.stopPropagation();">🗑️</button>
                  <button class="btn btn-small btn-ghost btn-edit-client" data-id="${c.id}" title="Editar" style="padding: 4px; padding-bottom: 0px;" onclick="event.stopPropagation();">✎</button>
                </div>
              </div>

              <div style="margin-top: 4px;">
                ${c.phone ? `<a href="${wappLink}" target="_blank" onclick="event.stopPropagation();" class="badge badge-success" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  ${escapeHtml(c.phone)}
                </a>` : '<span style="color:var(--text-muted); font-size:12px;">Sin teléfono</span>'}
              </div>

              ${avatarGroupHtml}
              ${statusHtml}
            </div>
          `
        }).join('')}
      </div>
    `
  }


  function renderProfile(clientId) {
    const client = clientsData.find(c => c.id === clientId)
    if (!client) return

    const cSubs = subsData.filter(s => s.client_id === clientId)

    // Separar activas/vigentes vs archivadas
    const activeSubs = cSubs.filter(s => !s.archived_at)
    const archivedSubs = cSubs.filter(s => !!s.archived_at)

    // Ordenar activas: 1. Vencidas, 2. Próximas a vencer, 3. Activas
    activeSubs.sort((a, b) => {
      const stA = statusFor(a.expiry_date, a.archived_at)
      const stB = statusFor(b.expiry_date, b.archived_at)

      const rank = (st) => {
        if (st.key === 'vencido') return 1
        if (st.key === 'hoy' || st.key === 'proximo') return 2
        return 3
      }

      const rankA = rank(stA)
      const rankB = rank(stB)

      if (rankA !== rankB) return rankA - rankB

      const daysA = stA.days !== null ? stA.days : 9999
      const daysB = stB.days !== null ? stB.days : 9999
      return daysA - daysB
    })

    // Contadores KPIs
    const totalActiveCount = activeSubs.length
    const expiredCount = activeSubs.filter(s => statusFor(s.expiry_date).key === 'vencido').length
    const soonCount = activeSubs.filter(s => {
      const k = statusFor(s.expiry_date).key
      return k === 'proximo' || k === 'hoy'
    }).length

    // Alerta Prioritaria
    let alertHtml = ''
    if (expiredCount > 0) {
      alertHtml = `
        <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px;">
          <span style="font-size: 18px;">⚠️</span>
          <div>
            <strong>Alerta Prioritaria:</strong> Este cliente tiene <b>${expiredCount}</b> suscripción(es) vencida(s) que requiere(n) atención.
          </div>
        </div>
      `
    } else if (soonCount > 0) {
      alertHtml = `
        <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px;">
          <span style="font-size: 18px;">⚡</span>
          <div>
            <strong>Alerta Prioritaria:</strong> Este cliente tiene <b>${soonCount}</b> suscripción(es) próxima(s) a vencer.
          </div>
        </div>
      `
    } else if (totalActiveCount > 0) {
      alertHtml = `
        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px;">
          <span style="font-size: 18px;">✅</span>
          <div>
            <strong>Estado Al Día:</strong> Todas las suscripciones del cliente se encuentran vigentes y al día.
          </div>
        </div>
      `
    } else {
      alertHtml = `
        <div style="background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.2); color: var(--text-muted); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px;">
          <span style="font-size: 18px;">ℹ️</span>
          <div>
            El cliente no tiene suscripciones vigentes registradas actualmente.
          </div>
        </div>
      `
    }

    const wappLink = client.phone ? `https://wa.me/${client.phone.replace(/[^0-9]/g, '')}` : '#'

    const renderSubCard = (s) => {
      const st = statusFor(s.expiry_date, s.archived_at)
      const serviceName = s.product?.name || s.service || 'Servicio'
      const initials = serviceName.trim().substring(0, 2).toUpperCase()
      const logoUrl = s.product?.logo_url

      let logoHtml = ''
      if (logoUrl) {
        logoHtml = `
          <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
            <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(serviceName)}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; background-color: var(--bg-surface);" />
            <div style="display: none; width: 40px; height: 40px; border-radius: 8px; background-color: var(--bg-surface-elevated); color: var(--text-primary); align-items: center; justify-content: center; font-size: 13px; font-weight: 600;">${escapeHtml(initials)}</div>
          </div>
        `
      } else {
        logoHtml = `
          <div style="width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0; background-color: var(--bg-surface-elevated); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;">${escapeHtml(initials)}</div>
        `
      }

      return `
        <div class="card" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; margin-bottom: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 14px; min-width: 220px; flex: 1;">
            ${logoHtml}
            <div>
              <h4 style="margin: 0 0 3px 0; font-size: 15px; color: var(--text-primary);">${escapeHtml(serviceName)}</h4>
              <div style="font-size: 12px; color: var(--text-muted);">
                Proveedor: ${escapeHtml(s.provider || 'Sin asignar')}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div style="text-align: right; min-width: 140px;">
              <div style="font-size: 11px; color: var(--text-muted);">Vencimiento</div>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${formatDate(s.expiry_date)}</div>
            </div>

            <span class="badge badge-${st.tone}">${escapeHtml(st.label)}</span>

            <button type="button" class="btn btn-small btn-ghost btn-open-sub" data-sub-id="${s.id}" title="Ver detalle en Suscripciones" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
              Ver en Suscripciones
            </button>
          </div>
        </div>
      `
    }

    profileEl.innerHTML = `
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <button id="btnBackToMain" class="btn btn-ghost">← Volver al directorio</button>
        <div style="display: flex; gap: 8px;">
          <button id="btnEditClientProfile" class="btn btn-small btn-ghost" title="Editar datos del cliente">✎ Editar Cliente</button>
          <button id="btnMergeClientProfile" class="btn btn-small btn-ghost" title="Fusionar cliente">🔗 Fusionar</button>
          <button id="btnDeleteClientProfile" class="btn btn-small btn-ghost" title="Eliminar cliente" style="color: var(--status-danger-text);">🗑️ Eliminar</button>
        </div>
      </div>

      <!-- Ficha Header del Cliente -->
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div>
            <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600;">Ficha de Cliente</span>
            <h2 style="margin: 4px 0 8px 0; font-size: 22px; color: var(--text-primary);">${escapeHtml(client.name)}</h2>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              ${client.phone ? `
                <a href="${wappLink}" target="_blank" class="badge badge-success" style="text-decoration:none; display:inline-flex; align-items:center; gap:5px; font-size: 13px; padding: 4px 10px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  ${escapeHtml(client.phone)}
                </a>
              ` : '<span style="color:var(--text-muted); font-size: 13px;">Sin teléfono registrado</span>'}
            </div>
          </div>
        </div>

        <!-- Indicadores KPIs -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
          <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: 8px;">
            <div style="font-size: 11px; color: var(--text-muted);">Suscripciones Vigentes</div>
            <div style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${totalActiveCount}</div>
          </div>
          <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: 8px;">
            <div style="font-size: 11px; color: var(--text-muted);">Vencen Pronto</div>
            <div style="font-size: 20px; font-weight: 700; color: ${soonCount > 0 ? 'var(--status-warning-text)' : 'var(--text-primary)'}; margin-top: 2px;">${soonCount}</div>
          </div>
          <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: 8px;">
            <div style="font-size: 11px; color: var(--text-muted);">Vencidas</div>
            <div style="font-size: 20px; font-weight: 700; color: ${expiredCount > 0 ? 'var(--status-danger-text)' : 'var(--text-primary)'}; margin-top: 2px;">${expiredCount}</div>
          </div>
        </div>
      </div>

      <!-- Banner de Alerta Prioritaria -->
      ${alertHtml}

      <!-- Listado de Suscripciones Vigentes -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; margin: 0 0 14px 0; color: var(--text-primary); display: flex; align-items: center; justify-content: space-between;">
          <span>Suscripciones Vigentes (${totalActiveCount})</span>
        </h3>
        ${activeSubs.length > 0
          ? activeSubs.map(renderSubCard).join('')
          : '<div class="card" style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 13px;">No hay suscripciones vigentes para este cliente.</div>'
        }
      </div>

      <!-- Listado de Suscripciones Archivadas -->
      ${archivedSubs.length > 0 ? `
        <div style="margin-top: 30px;">
          <h3 style="font-size: 15px; margin: 0 0 14px 0; color: var(--text-muted);">
            Historial de Suscripciones Archivadas (${archivedSubs.length})
          </h3>
          ${archivedSubs.map(s => {
            const serviceName = s.product?.name || s.service || 'Servicio'
            const initials = serviceName.trim().substring(0, 2).toUpperCase()
            const logoUrl = s.product?.logo_url

            let logoHtml = logoUrl
              ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(serviceName)}" onerror="this.style.display='none';" style="width: 28px; height: 28px; border-radius: 6px; object-fit: cover; background: var(--bg-surface);" />`
              : `<div style="width: 28px; height: 28px; border-radius: 6px; background: var(--bg-surface-elevated); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600;">${escapeHtml(initials)}</div>`

            return `
              <div class="card" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; margin-bottom: 8px; opacity: 0.75;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  ${logoHtml}
                  <div>
                    <strong style="font-size: 13px; color: var(--text-secondary);">${escapeHtml(serviceName)}</strong>
                    <span style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">Dada de baja el ${formatDate(s.archived_at)}</span>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="badge badge-neutral">Archivada</span>
                  <button type="button" class="btn btn-small btn-ghost btn-open-sub" data-sub-id="${s.id}" title="Ver en Suscripciones">🔍 Ver en Suscripciones</button>
                </div>
              </div>
            `
          }).join('')}
        </div>
      ` : ''}
    `

    // Eventos de la Ficha
    profileEl.querySelector('#btnBackToMain').addEventListener('click', () => {
      selectedClientId = null
      profileEl.classList.add('hidden')
      mainEl.classList.remove('hidden')
    })

    profileEl.querySelector('#btnEditClientProfile')?.addEventListener('click', () => {
      editingId = clientId
      document.getElementById('clientFormTitle').textContent = 'Editar Cliente'
      document.getElementById('clientName').value = client.name || ''
      document.getElementById('clientPhone').value = client.phone || ''
      formContainer.classList.remove('hidden')
      document.getElementById('clientName').focus()
    })

    profileEl.querySelector('#btnMergeClientProfile')?.addEventListener('click', () => {
      const sourceId = clientId
      const sourceClient = client
      const mergeContainer = document.getElementById('clientMergeContainer')
      const infoEl = document.getElementById('clientMergeInfo')
      const selectEl = document.getElementById('mergeTargetSelect')
      const sourceInput = document.getElementById('mergeSourceId')

      sourceInput.value = sourceId
      infoEl.innerHTML = `Trasladando <b>${cSubs.length}</b> relación(es) de <b>${escapeHtml(sourceClient.name)}</b> a:`

      selectEl.innerHTML = '<option value="">-- Selecciona cliente destino --</option>' +
        clientsData
          .filter(c => c.id !== sourceId)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.phone ? ' (' + escapeHtml(c.phone) + ')' : ''}</option>`)
          .join('')

      mergeContainer.classList.remove('hidden')
      formContainer.classList.add('hidden')
      profileEl.classList.add('hidden')
      mainEl.classList.remove('hidden')
    })

    profileEl.querySelector('#btnDeleteClientProfile')?.addEventListener('click', () => {
      if (cSubs.length > 0) {
        alert('Bloqueado: No se puede eliminar el cliente porque tiene ' + cSubs.length + ' suscripciones asociadas.')
        return
      }

      if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente "${client.name}"?`)) {
        supabase.rpc('delete_client', { p_client_id: clientId }).then(({error}) => {
          if (error) alert('Error al eliminar: ' + error.message)
          else {
            profileEl.classList.add('hidden')
            mainEl.classList.remove('hidden')
            loadData()
          }
        })
      }
    })

    profileEl.querySelectorAll('.btn-open-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.dataset.subId
        if (subId && options.onNavigateToSubscription) {
          options.onNavigateToSubscription(subId)
        } else if (subId) {
          window.location.hash = '#suscripciones'
        }
      })
    })

    mainEl.classList.add('hidden')
    profileEl.classList.remove('hidden')
  }

  container.addEventListener('click', (e) => {
    if (e.target.closest('.btn-view-profile')) {
      const id = e.target.closest('.btn-view-profile').dataset.id
      selectedClientId = id
      renderProfile(id)
    }
    if (e.target.closest('.btn-edit-client')) {
      const id = e.target.closest('.btn-edit-client').dataset.id
      const client = clientsData.find(c => c.id === id)
      if (client) {
        editingId = id
        document.getElementById('clientFormTitle').textContent = 'Editar Cliente'
        document.getElementById('clientName').value = client.name || ''
        document.getElementById('clientPhone').value = client.phone || ''
        formContainer.classList.remove('hidden')
        document.getElementById('clientName').focus()
      }
    }
    if (e.target.closest('.btn-delete-client')) {
      const id = e.target.closest('.btn-delete-client').dataset.id
      const client = clientsData.find(c => c.id === id)
      if (!client) return

      const cSubs = subsData.filter(s => s.client_id === id)
      if (cSubs.length > 0) {
        alert('Bloqueado: No se puede eliminar el cliente porque tiene ' + cSubs.length + ' suscripciones asociadas.')
        return
      }

      if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente "${client.name}"?`)) {
        supabase.rpc('delete_client', { p_client_id: id }).then(({error}) => {
          if (error) alert('Error al eliminar: ' + error.message)
          else loadData()
        })
      }
    }
    if (e.target.closest('.btn-merge-client')) {
      const sourceId = e.target.closest('.btn-merge-client').dataset.id
      const sourceClient = clientsData.find(c => c.id === sourceId)
      if (!sourceClient) return

      const cSubs = subsData.filter(s => s.client_id === sourceId)
      const mergeContainer = document.getElementById('clientMergeContainer')
      const infoEl = document.getElementById('clientMergeInfo')
      const selectEl = document.getElementById('mergeTargetSelect')
      const sourceInput = document.getElementById('mergeSourceId')

      sourceInput.value = sourceId
      infoEl.innerHTML = `Trasladando <b>${cSubs.length}</b> relación(es) de <b>${escapeHtml(sourceClient.name)}</b> a:`

      // Llenar select con otros clientes
      selectEl.innerHTML = '<option value="">-- Selecciona cliente destino --</option>' +
        clientsData
          .filter(c => c.id !== sourceId)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.phone ? ' (' + escapeHtml(c.phone) + ')' : ''}</option>`)
          .join('')

      mergeContainer.classList.remove('hidden')
      formContainer.classList.add('hidden')
    }
  })

  document.getElementById('clientMergeCancel').addEventListener('click', () => {
    document.getElementById('clientMergeContainer').classList.add('hidden')
    document.getElementById('clientMergeForm').reset()
  })

  document.getElementById('clientMergeForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const sourceId = document.getElementById('mergeSourceId').value
    const targetId = document.getElementById('mergeTargetSelect').value
    if (!sourceId || !targetId) return

    const sourceClient = clientsData.find(c => c.id === sourceId)
    const targetClient = clientsData.find(c => c.id === targetId)
    if (!sourceClient || !targetClient) return

    if (!confirm(`¿Confirmas la fusión?\n\nEliminar permanentemente: ${sourceClient.name}\nConservar: ${targetClient.name}\n\nSe trasladarán todas las suscripciones al cliente destino.`)) {
      return
    }

    const btn = e.target.querySelector('button[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Fusionando...'

    const { error } = await supabase.rpc('merge_clients', { p_target_client_id: targetId, p_source_client_id: sourceId })

    btn.disabled = false
    btn.textContent = 'Confirmar Fusión'

    if (error) {
      alert('Error al fusionar: ' + error.message)
    } else {
      document.getElementById('clientMergeContainer').classList.add('hidden')
      e.target.reset()
      await loadData()
    }
  })

  document.getElementById('btnNewClient').addEventListener('click', () => {
    editingId = null
    form.reset()
    document.getElementById('clientFormTitle').textContent = 'Registrar Nuevo Cliente'
    formContainer.classList.remove('hidden')
    document.getElementById('clientName').focus()
  })

  document.getElementById('clientFormCancel').addEventListener('click', () => {
    formContainer.classList.add('hidden')
    form.reset()
    editingId = null
  })

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value
    renderList()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('clientName').value.trim()
    const phone = document.getElementById('clientPhone').value.trim()
    const btn = form.querySelector('button[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Guardando...'

    if (editingId) {
      const { error } = await supabase.from('clients').update({ name, phone }).eq('id', editingId)
      if (error) alert('Error al actualizar: ' + error.message)
    } else {
      const { error } = await supabase.from('clients').insert([{ name, phone }])
      if (error) alert('Error al guardar: ' + error.message)
    }

    btn.disabled = false
    btn.textContent = 'Guardar'
    formContainer.classList.add('hidden')
    form.reset()
    editingId = null
    await loadData()
  })

  await loadData()
}
