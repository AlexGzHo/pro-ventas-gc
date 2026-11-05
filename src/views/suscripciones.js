import {
  amountInPEN,
  daysUntil,
  escapeHtml,
  formatDate,
  formatAmount,
  formatMoney,
  rowSaleCurrency,
  rowCostCurrency,
  statusFor
} from '../utils.js'
import {
  credentialsText,
  reminderText,
  updateText
} from '../whatsapp.js'
import { ICONS } from '../ui/icons.js'
import {
  state,
  getCachedServiceOptions,
  ownerNameForRow,
  rowById
} from '../state.js'
import { openSubscriptionForm } from '../features/subscriptionForm.js'
import { openRenewModal } from '../features/renewModal.js'
import {
  archiveRow,
  unarchiveRow,
  deleteRow,
  openCredentialsModal,
  safeWhatsapp,
  copyCredentialsAction
} from '../features/subscriptionActions.js'

// The desktop choice is persistent. Mobile only changes the rendered view.
const mobileViewport = window.matchMedia('(max-width: 640px)')
let sectionEvents = null
let activeActionMenu = null
mobileViewport.addEventListener('change', () => {
  if (state.currentSection === 'subscriptions' && document.querySelector('#cards')) renderData()
})

function effectiveView() {
  return mobileViewport.matches ? 'cards' : state.currentView
}

export function renderSubscriptionsSection(container) {
  const activeCount = getActiveFiltersCount()
  const hasAnyFilter = checkHasAnyActiveFilter()

  container.innerHTML = `
    <header class="page-header subs-header">
      <div class="subs-title-group">
        <h2>Suscripciones</h2>
      </div>
      <button id="newBtn" class="btn btn-primary" type="button">
        ${ICONS.plus} <span>Nueva suscripción</span>
      </button>
    </header>

    <div class="toolbar subs-toolbar-row">
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">${ICONS.search}</span>
        <input id="searchInput" type="search" placeholder="Buscar cliente, celular, servicio, correo..." value="${escapeHtml(state.filters.search)}">
        <button id="searchClearBtn" class="btn btn-ghost search-clear ${state.filters.search ? '' : 'hidden'}" type="button" title="Limpiar búsqueda" aria-label="Limpiar búsqueda">
          ${ICONS.close}
        </button>
      </div>

      <div class="subs-filter-menu-wrap">
        <button id="filtersToggleBtn" type="button" class="btn btn-secondary subs-filters-btn ${activeCount > 0 ? 'has-active' : ''}" aria-expanded="false" aria-controls="subsFilterPopover">
          <span class="subs-filters-icon">${ICONS.menu}</span>
          <span>Filtros</span>
          <span id="filtersBadge" class="subs-filter-badge ${activeCount > 0 ? '' : 'hidden'}">${activeCount}</span>
        </button>
        <div id="subsFilterPopover" class="subs-filter-popover hidden" role="region" aria-label="Filtros adicionales">
          <div class="subs-popover-header">
            <strong>Filtros</strong>
            <button id="closeFiltersBtn" type="button" class="btn btn-ghost subs-popover-close" aria-label="Cerrar filtros">
              ${ICONS.close}
            </button>
          </div>
          <div class="field subs-popover-field">
            <label for="serviceFilter" class="subs-field-label">Servicio</label>
            <select id="serviceFilter" class="filter-select"></select>
          </div>
          <div class="field subs-popover-field">
            <label for="ownerFilter" class="subs-field-label">Propietario</label>
            <select id="ownerFilter" class="filter-select">
              <option value="TODOS" ${state.filters.owner === 'TODOS' ? 'selected' : ''}>Todos</option>
              <option value="Alex" ${state.filters.owner === 'Alex' ? 'selected' : ''}>Alex</option>
              <option value="Liz" ${state.filters.owner === 'Liz' ? 'selected' : ''}>Liz</option>
            </select>
          </div>
          <div class="subs-popover-footer">
            <button id="popoverResetBtn" type="button" class="btn btn-ghost">Restablecer filtros</button>
          </div>
        </div>
      </div>

      <button id="clearFiltersBtn" type="button" class="btn btn-ghost subs-clear-all-btn ${hasAnyFilter ? '' : 'hidden'}" title="Limpiar todos los filtros">
        Limpiar
      </button>
    </div>

    <div id="quickViews" class="quick-views" role="group" aria-label="Vistas rápidas de estado"></div>

    <div class="results-bar">
      <div id="resultsLine" class="results-line"></div>
      <div class="view-toggle ${mobileViewport.matches ? 'hidden' : ''}" role="group" aria-label="Cambiar vista">
        <button id="viewCardsBtn" type="button" class="btn btn-secondary view-btn ${state.currentView === 'cards' ? 'active' : ''}" aria-pressed="${state.currentView === 'cards'}" title="Vista de tarjetas">
          ${ICONS.cards} <span>Tarjetas</span>
        </button>
        <button id="viewSummaryBtn" type="button" class="btn btn-secondary view-btn ${state.currentView === 'summary' ? 'active' : ''}" aria-pressed="${state.currentView === 'summary'}" title="Vista resumen">
          ${ICONS.summary} <span>Resumen</span>
        </button>
      </div>
    </div>

    <section id="cards" class="${effectiveView() === 'cards' ? 'grid' : 'summary-view-wrapper'}"></section>
  `

  bindSubscriptionsSectionEvents()
  renderData()
}

function getActiveFiltersCount() {
  let count = 0
  if (state.filters.service && state.filters.service !== 'TODOS') count++
  if (state.filters.owner && state.filters.owner !== 'TODOS') count++
  return count
}

function checkHasAnyActiveFilter() {
  return Boolean(
    (state.filters.search && state.filters.search.trim()) ||
    (state.filters.service && state.filters.service !== 'TODOS') ||
    (state.filters.owner && state.filters.owner !== 'TODOS') ||
    (state.filters.status && state.filters.status !== 'TODOS') ||
    (state.filters.quickView && state.filters.quickView !== 'all')
  )
}

export function resetAllFilters() {
  state.filters.search = ''
  state.filters.service = 'TODOS'
  state.filters.owner = 'TODOS'
  state.filters.status = 'TODOS'
  state.filters.quickView = 'all'

  const searchInput = document.querySelector('#searchInput')
  if (searchInput) searchInput.value = ''
  const searchClearBtn = document.querySelector('#searchClearBtn')
  if (searchClearBtn) searchClearBtn.classList.add('hidden')

  const popover = document.querySelector('#subsFilterPopover')
  if (popover) popover.classList.add('hidden')
  const filtersToggleBtn = document.querySelector('#filtersToggleBtn')
  if (filtersToggleBtn) filtersToggleBtn.setAttribute('aria-expanded', 'false')

  renderData()
}

export function bindSubscriptionsSectionEvents() {
  sectionEvents?.abort()
  sectionEvents = new AbortController()
  const { signal } = sectionEvents

  document.querySelector('#newBtn')?.addEventListener('click', () => openSubscriptionForm())

  document.querySelector('#viewCardsBtn')?.addEventListener('click', () => {
    if (state.currentView === 'cards') return
    state.currentView = 'cards'
    localStorage.setItem('pv_view_mode', 'cards')
    updateViewButtons()
    renderData()
  })

  document.querySelector('#viewSummaryBtn')?.addEventListener('click', () => {
    if (state.currentView === 'summary') return
    state.currentView = 'summary'
    localStorage.setItem('pv_view_mode', 'summary')
    updateViewButtons()
    renderData()
  })

  window.addEventListener('pv-test-set-rows', (e) => {
    state.rows = e.detail || []
    renderData()
  }, { signal })

  document.addEventListener('click', (e) => {
    if (activeActionMenu && !activeActionMenu.menu.contains(e.target) && !activeActionMenu.button.contains(e.target)) {
      activeActionMenu.close()
    }
  }, { signal, capture: true })
  window.addEventListener('scroll', (event) => {
    if (activeActionMenu && !activeActionMenu.menu.contains(event.target)) activeActionMenu.position()
  }, { signal, capture: true })
  window.addEventListener('resize', () => activeActionMenu?.close(), { signal })
  window.addEventListener('hashchange', () => activeActionMenu?.close(), { signal })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !activeActionMenu) return
    const trigger = activeActionMenu.button
    activeActionMenu.close()
    trigger.focus()
    event.preventDefault()
    event.stopPropagation()
  }, { signal, capture: true })

  const searchInput = document.querySelector('#searchInput')
  const searchClearBtn = document.querySelector('#searchClearBtn')

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value
      if (searchClearBtn) {
        searchClearBtn.classList.toggle('hidden', !e.target.value.trim())
      }
      renderData()
    })
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = ''
        state.filters.search = ''
        searchClearBtn.classList.add('hidden')
        searchInput.focus()
        renderData()
      }
    })
  }

  const filtersToggleBtn = document.querySelector('#filtersToggleBtn')
  const filterPopover = document.querySelector('#subsFilterPopover')
  const closeFiltersBtn = document.querySelector('#closeFiltersBtn')

  if (filtersToggleBtn && filterPopover) {
    filtersToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const isHidden = filterPopover.classList.toggle('hidden')
      filtersToggleBtn.setAttribute('aria-expanded', String(!isHidden))
    })

    closeFiltersBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      filterPopover.classList.add('hidden')
      filtersToggleBtn.setAttribute('aria-expanded', 'false')
    })

    filterPopover.addEventListener('click', (e) => {
      e.stopPropagation()
    })

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.subs-filter-menu-wrap')) {
        filterPopover.classList.add('hidden')
        filtersToggleBtn.setAttribute('aria-expanded', 'false')
      }
    }, { signal })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !filterPopover.classList.contains('hidden')) {
        filterPopover.classList.add('hidden')
        filtersToggleBtn.setAttribute('aria-expanded', 'false')
      }
    }, { signal })
  }

  document.querySelector('#popoverResetBtn')?.addEventListener('click', () => {
    state.filters.service = 'TODOS'
    state.filters.owner = 'TODOS'
    renderData()
  })

  document.querySelector('#clearFiltersBtn')?.addEventListener('click', () => {
    resetAllFilters()
  })

  document.querySelector('#serviceFilter')?.addEventListener('change', (e) => {
    state.filters.service = e.target.value
    renderData()
  })

  document.querySelector('#ownerFilter')?.addEventListener('change', (e) => {
    state.filters.owner = e.target.value
    renderData()
  })
}

export function updateViewButtons() {
  document.querySelector('.view-toggle')?.classList.toggle('hidden', mobileViewport.matches)
  const cardsBtn = document.querySelector('#viewCardsBtn')
  const summaryBtn = document.querySelector('#viewSummaryBtn')
  if (cardsBtn && summaryBtn) {
    const isCards = effectiveView() === 'cards'
    cardsBtn.classList.toggle('active', isCards)
    cardsBtn.setAttribute('aria-pressed', String(isCards))
    summaryBtn.classList.toggle('active', !isCards)
    summaryBtn.setAttribute('aria-pressed', String(!isCards))
  }
}

export function renderFilters() {
  const select = document.querySelector('#serviceFilter')
  if (select) {
    const current = state.filters.service
    const opts = getCachedServiceOptions()
    select.innerHTML = `<option value="TODOS">Todos</option>${opts
      .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
      .join('')}`
    select.value = opts.includes(current) ? current : 'TODOS'
  }

  const ownerSelect = document.querySelector('#ownerFilter')
  if (ownerSelect) {
    ownerSelect.value = state.filters.owner || 'TODOS'
  }

  const count = getActiveFiltersCount()
  const badge = document.querySelector('#filtersBadge')
  const filtersBtn = document.querySelector('#filtersToggleBtn')
  if (badge) {
    badge.textContent = String(count)
    badge.classList.toggle('hidden', count === 0)
  }
  if (filtersBtn) {
    filtersBtn.classList.toggle('has-active', count > 0)
  }

  const clearBtn = document.querySelector('#clearFiltersBtn')
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !checkHasAnyActiveFilter())
  }
}

export function matchesQuickView(row, view) {
  if (view === 'archived' || view === 'dadas_baja') return !!row.archived_at
  if (row.archived_at) return false

  const days = daysUntil(row.expiry_date)
  if (view === 'today') {
    return days === 0
  }
  if (view === 'next7') {
    return days !== null && days > 0 && days <= 7
  }
  if (view === 'soon' || view === 'por_vencer') {
    return days !== null && days >= 0 && days <= 7
  }
  if (view === 'expired' || view === 'vencidas') {
    return days !== null && days < 0
  }
  if (view === 'active' || view === 'activas') {
    return days === null || days > 7
  }
  return true
}

export function quickViewCounts() {
  const q = state.filters.search.trim().toLowerCase()
  const baseRows = state.rows.filter((row) => {
    const haystack = [
      row.client_name,
      row.phone,
      row.service,
      row.username_email,
      row.provider,
      row.notes,
    ].join(' ').toLowerCase()

    const searchOk = !q || haystack.includes(q)
    const serviceOk = state.filters.service === 'TODOS' || row.service === state.filters.service
    const ownerOk = state.filters.owner === 'TODOS' || ownerNameForRow(row) === state.filters.owner
    return searchOk && serviceOk && ownerOk
  })

  let soon = 0
  let expired = 0
  let active = 0
  let archived = 0

  baseRows.forEach((row) => {
    if (row.archived_at) {
      archived++
    } else {
      const days = daysUntil(row.expiry_date)
      if (days !== null && days < 0) {
        expired++
      } else if (days !== null && days >= 0 && days <= 7) {
        soon++
      } else {
        active++
      }
    }
  })

  return {
    all: baseRows.filter((r) => !r.archived_at).length,
    soon,
    next7: soon,
    expired,
    active,
    archived
  }
}

export function renderQuickViews() {
  const container = document.querySelector('#quickViews')
  if (!container) return

  const counts = quickViewCounts()
  const current = state.filters.quickView || 'all'

  const views = [
    { key: 'all', label: 'Todas', count: counts.all },
    { key: 'soon', label: 'Por vencer', count: counts.soon, tone: counts.soon > 0 ? 'warning' : '' },
    { key: 'expired', label: 'Vencidas', count: counts.expired, tone: counts.expired > 0 ? 'danger' : '' },
    { key: 'active', label: 'Activas', count: counts.active },
    { key: 'archived', label: 'Dadas de baja', count: counts.archived, tone: counts.archived > 0 ? 'neutral' : '' },
  ]

  container.innerHTML = views
    .map(
      (v) => `
      <button
        type="button"
        class="chip quick-view-btn ${v.key === current ? 'active' : ''} ${v.tone ? `tone-${v.tone}` : ''}"
        data-quick-view="${v.key}"
        aria-pressed="${v.key === current}"
      >
        <span class="quick-view-label">${escapeHtml(v.label)}</span>
        <span class="quick-view-count">${v.count}</span>
      </button>`
    )
    .join('')

  container.querySelectorAll('.quick-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.quickView
      if (state.filters.quickView === targetView) return

      state.filters.quickView = targetView
      if (targetView !== 'all' && state.filters.status !== 'TODOS') {
        state.filters.status = 'TODOS'
      }
      renderData()
    })
  })
}

export function filteredRows() {
  const q = state.filters.search.trim().toLowerCase()
  return state.rows.filter((row) => {
    const status = statusFor(row.expiry_date, row.archived_at)
    const haystack = [
      row.client_name,
      row.phone,
      row.service,
      row.username_email,
      row.provider,
      row.notes,
    ].join(' ').toLowerCase()

    const searchOk = !q || haystack.includes(q)
    const serviceOk = state.filters.service === 'TODOS' || row.service === state.filters.service
    const statusOk = state.filters.status === 'TODOS' || status.key === state.filters.status
    const ownerOk = state.filters.owner === 'TODOS' || ownerNameForRow(row) === state.filters.owner
    const quickOk = matchesQuickView(row, state.filters.quickView)
    return searchOk && serviceOk && statusOk && ownerOk && quickOk
  })
}

export function formatExpiryBadge(status) {
  if (status.days === null) {
    return { icon: status.key === 'archivado' ? ICONS.restore : ICONS.info, text: status.label }
  }
  if (status.days < 0) {
    const d = Math.abs(status.days)
    return { icon: ICONS.alertTriangle, text: d === 1 ? 'Vencido hace 1 día' : `Vencido hace ${d} días` }
  }
  if (status.days === 0) {
    return { icon: ICONS.alertTriangle, text: 'Vence hoy' }
  }
  if (status.days === 1) {
    return { icon: ICONS.alertTriangle, text: 'Vence mañana' }
  }
  return { icon: ICONS.clock, text: `Vence en ${status.days} días` }
}

function subscriptionBadgeHtml(row) {
  const status = statusFor(row.expiry_date, row.archived_at)
  const badge = formatExpiryBadge(status)
  return `<span class="badge badge-${status.tone}"><span class="badge-icon">${badge.icon}</span><span>${escapeHtml(badge.text)}</span></span>`
}

function subscriptionMenuHtml(row, table) {
  return `
    <div class="card-menu-wrap">
      <button type="button" class="btn ${table ? 'btn-small' : ''} btn-ghost card-menu-btn" aria-label="Más opciones de ${escapeHtml(row.client_name || 'suscripción')}" aria-haspopup="menu" aria-expanded="false">
        ${ICONS.moreHorizontal}
      </button>
      <div class="card-dropdown hidden" role="menu" aria-label="Acciones de suscripción">
        <button type="button" class="btn btn-ghost card-dropdown-item view-credentials" role="menuitem">
          <span class="dropdown-item-icon">${ICONS.key}</span> Ver accesos
        </button>
        <button type="button" class="btn btn-ghost card-dropdown-item whatsapp-data" role="menuitem">
          <span class="dropdown-item-icon">${ICONS.messageSquare}</span> Enviar datos
        </button>
        <button type="button" class="btn btn-ghost card-dropdown-item whatsapp-update" role="menuitem">
          <span class="dropdown-item-icon">${ICONS.refresh}</span> Actualización
        </button>
        <div class="card-dropdown-divider" role="separator"></div>
        <button type="button" class="btn btn-ghost card-dropdown-item edit" role="menuitem">
          <span class="dropdown-item-icon">${ICONS.edit}</span> Editar suscripción
        </button>
        <button type="button" class="btn btn-ghost card-dropdown-item ${row.archived_at ? 'unarchive' : 'archive'}" role="menuitem">
          <span class="dropdown-item-icon">${row.archived_at ? ICONS.restore : ICONS.trash}</span> ${row.archived_at ? 'Recuperar' : 'Dar de baja'}
        </button>
        <div class="card-dropdown-divider" role="separator"></div>
        <button type="button" class="btn btn-danger card-dropdown-item delete-hard card-dropdown-danger" role="menuitem">
          <span class="dropdown-item-icon">${ICONS.trash}</span> Eliminar definitivo
        </button>
      </div>
    </div>`
}

function subscriptionActionsHtml(row, table = false) {
  const size = table ? 'btn-small' : ''
  return `
    <div class="${table ? 'summary-actions-cell' : 'card-actions'}">
      <div class="card-actions-row card-actions-row-1">
        <button type="button" class="btn btn-secondary ${size} renew btn-action-renovar" title="Extender período">
          ${ICONS.calendar}<span>Renovar</span>
        </button>
        <button type="button" class="btn btn-secondary ${size} whatsapp-reminder btn-action-cobrar" title="Cobrar por WhatsApp">
          <span class="cobrar-icon">${ICONS.whatsapp}</span><span>Cobrar</span>
        </button>
      </div>
      <div class="card-actions-row card-actions-row-2">
        <button type="button" class="btn btn-secondary ${size} copy-all btn-action-copy" title="Copiar accesos completos">
          ${ICONS.copy}<span class="copy-btn-text">Copiar todo</span>
        </button>
        ${subscriptionMenuHtml(row, table)}
      </div>
    </div>`
}

export function cardHtml(row) {
  const status = statusFor(row.expiry_date, row.archived_at)
  const owner = ownerNameForRow(row)
  const ownerKey = owner.toLowerCase()

  const salePEN = amountInPEN(row.sale_price, rowSaleCurrency(row), row.sale_price_exchange_rate)
  const costPEN = amountInPEN(row.cost, rowCostCurrency(row), row.cost_exchange_rate)
  const profitPEN = salePEN - costPEN

  const serviceName = row.service || row.product?.name || 'SIN SERVICIO'
  const initials = serviceName.trim().substring(0, 2).toUpperCase()
  const logoUrl = row.product?.logo_url
  const categoryTag = row.product?.category || null

  const saleDisplay = formatAmount(row.sale_price, row.sale_price_currency)
  const costDisplay = formatAmount(row.cost, row.cost_currency)

  const logoHtml = logoUrl
    ? `
      <div class="card-product-logo-wrap">
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(serviceName)}" class="card-product-logo" onerror="this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');" />
        <div class="card-product-logo-fallback hidden">${escapeHtml(initials)}</div>
      </div>
    `
    : `
      <div class="card-product-logo-wrap">
        <div class="card-product-logo-fallback">${escapeHtml(initials)}</div>
      </div>
    `

  return `
    <article class="card card-status-${status.tone}" data-id="${row.id}">
      <div class="card-head">
        <div class="card-product-group">
          ${logoHtml}
          <div class="card-product-meta">
            <h3 class="card-product-title" title="${escapeHtml(serviceName)}">${escapeHtml(serviceName)}</h3>
            ${categoryTag ? `<span class="card-product-tag">${escapeHtml(categoryTag)}</span>` : ''}
          </div>
        </div>
        <div class="card-badge-wrap">
          ${subscriptionBadgeHtml(row)}
        </div>
      </div>

      <div class="card-client-row">
        <div class="card-client-name" title="${escapeHtml(row.client_name || 'Sin cliente')}">
          <span class="card-client-icon">${ICONS.user}</span>
          <span class="card-client-name-text">${escapeHtml(row.client_name || 'Sin nombre')}</span>
        </div>
        ${row.phone ? `
          <div class="card-client-phone" title="${escapeHtml(row.phone)}">
            ${row.phone.startsWith('@') ? '' : `<span class="card-phone-icon">${ICONS.phone}</span>`}
            <span>${escapeHtml(row.phone)}</span>
          </div>
        ` : ''}
      </div>

      <div class="card-meta-row">
        <div class="card-expiry-wrap">
          <span class="card-meta-icon">${ICONS.calendar}</span>
          <span class="card-expiry-label">Vence:</span>
          <strong class="card-expiry-val">${formatDate(row.expiry_date)}</strong>
          ${owner ? `<span class="owner-dot owner-dot-${escapeHtml(ownerKey)}" title="Propietario: ${escapeHtml(owner)}" aria-label="Propietario: ${escapeHtml(owner)}"></span>` : ''}
        </div>
        <div class="card-price-wrap">
          <strong class="card-price-val">${saleDisplay}</strong>
          <button type="button" class="btn btn-ghost btn-card-details-toggle" aria-expanded="false" aria-controls="card-details-${row.id}" title="Mostrar u ocultar detalles adicionales">
            <span class="toggle-chevron">${ICONS.chevronDown}</span>
          </button>
        </div>
      </div>

      <div id="card-details-${row.id}" class="card-details-panel hidden">
        <div class="card-details-grid">
          <div class="card-details-col">
            <span class="card-details-label">Costo</span>
            <span class="card-details-val">${costDisplay}</span>
          </div>
          <div class="card-details-col">
            <span class="card-details-label">Ganancia</span>
            <span class="card-details-val ${profitPEN >= 0 ? 'profit-positive' : 'profit-negative'}">${formatMoney(profitPEN)}</span>
          </div>
          <div class="card-details-col">
            <span class="card-details-label">Proveedor</span>
            <span class="card-details-val" title="${escapeHtml(row.provider || '—')}">${escapeHtml(row.provider || '—')}</span>
          </div>
          <div class="card-details-col">
            <span class="card-details-label">Propietario</span>
            <div class="card-details-val meta-owner-value">
              <span class="owner-dot owner-dot-${escapeHtml(ownerKey)}"></span>
              <span>${escapeHtml(owner)}</span>
            </div>
          </div>
        </div>
        ${(row.username_email || row.profile || row.pin || row.access_url || row.notes) ? `
          <div class="card-details-creds">
            ${row.username_email ? `<div class="card-cred-row"><span class="cred-tag">Cuenta:</span> <code class="cred-code">${escapeHtml(row.username_email)}</code></div>` : ''}
            ${row.profile ? `<div class="card-cred-row"><span class="cred-tag">Perfil:</span> <span>${escapeHtml(row.profile)}</span></div>` : ''}
            ${row.pin ? `<div class="card-cred-row"><span class="cred-tag">PIN:</span> <code class="cred-code">${escapeHtml(row.pin)}</code></div>` : ''}
            ${row.access_url ? `<div class="card-cred-row"><span class="cred-tag">URL:</span> <code class="cred-code">${escapeHtml(row.access_url)}</code></div>` : ''}
            ${row.notes ? `<div class="card-cred-row"><span class="cred-tag">Notas:</span> <span>${escapeHtml(row.notes)}</span></div>` : ''}
          </div>
        ` : ''}
      </div>

      ${subscriptionActionsHtml(row)}
    </article>`
}

export function bindCardEvents() {
  bindSubscriptionEvents()
}

function bindSubscriptionEvents() {
  document.querySelectorAll('#cards article[data-id], #cards tr[data-id]').forEach((card) => {
    const row = rowById(card.dataset.id)
    if (!row) return

    card.querySelector('.copy-all')?.addEventListener('click', async (e) => {
      await copyCredentialsAction(row, e.currentTarget)
    })

    card.querySelector('.whatsapp-reminder')?.addEventListener('click', () => safeWhatsapp(row, reminderText(row)))
    card.querySelector('.whatsapp-update')?.addEventListener('click', () => safeWhatsapp(row, updateText(row)))
    card.querySelector('.view-credentials')?.addEventListener('click', () => openCredentialsModal(row))
    card.querySelector('.whatsapp-data')?.addEventListener('click', () => safeWhatsapp(row, credentialsText(row)))
    card.querySelector('.renew')?.addEventListener('click', () => openRenewModal(row))
    card.querySelector('.edit')?.addEventListener('click', () => openSubscriptionForm(row))
    card.querySelector('.archive')?.addEventListener('click', () => archiveRow(row))
    card.querySelector('.unarchive')?.addEventListener('click', () => unarchiveRow(row))
    card.querySelector('.delete-hard')?.addEventListener('click', () => deleteRow(row))

    const detailsToggle = card.querySelector('.btn-card-details-toggle')
    const detailsPanel = card.querySelector('.card-details-panel')
    if (detailsToggle && detailsPanel) {
      detailsToggle.addEventListener('click', (e) => {
        e.stopPropagation()
        const isHidden = detailsPanel.classList.toggle('hidden')
        detailsToggle.setAttribute('aria-expanded', String(!isHidden))
        detailsToggle.classList.toggle('active', !isHidden)
      })
    }

    const menuBtn = card.querySelector('.card-menu-btn')
    const dropdown = card.querySelector('.card-dropdown')
    if (menuBtn && dropdown) {
      const menuWrap = menuBtn.closest('.card-menu-wrap')
      let updatingMenu = false
      const positionMenu = () => {
        const buttonRect = menuBtn.getBoundingClientRect()
        const menuRect = dropdown.getBoundingClientRect()
        const gutter = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-2'))
        const left = Math.max(gutter, Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - gutter))
        const below = buttonRect.bottom + gutter
        const top = below + menuRect.height <= window.innerHeight - gutter
          ? below : Math.max(gutter, buttonRect.top - menuRect.height - gutter)
        // Posición dinámica del disparador; tamaños y espacios vienen de CSS.
        dropdown.style.left = `${left}px`
        dropdown.style.top = `${top}px`
      }
      const setMenuOpen = (open, focusFirst = false) => {
        if (updatingMenu) return
        updatingMenu = true
        try {
          if (open) {
            if (activeActionMenu?.menu !== dropdown) activeActionMenu?.close()
            if (dropdown.parentElement !== document.body) document.body.appendChild(dropdown)
            dropdown.classList.add('dropdown-portaled')
            dropdown.classList.remove('hidden')
            positionMenu()
            activeActionMenu = { menu: dropdown, button: menuBtn, position: positionMenu, close: () => setMenuOpen(false) }
          } else {
            if (activeActionMenu?.menu === dropdown) activeActionMenu = null
            dropdown.classList.remove('dropdown-portaled')
            dropdown.style.removeProperty('left')
            dropdown.style.removeProperty('top')
            if (menuWrap.isConnected) menuWrap.appendChild(dropdown)
            else dropdown.remove()
          }
          dropdown.classList.toggle('hidden', !open)
          menuBtn.setAttribute('aria-expanded', String(open))
          if (focusFirst && open) dropdown.querySelector('[role="menuitem"]')?.focus({ preventScroll: true })
        } finally {
          updatingMenu = false
        }
      }

      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const isHidden = dropdown.classList.contains('hidden')
        document.querySelectorAll('.card-dropdown:not(.hidden)').forEach((d) => {
          if (d !== dropdown) {
            d.classList.add('hidden')
            const b = d.closest('.card-menu-wrap')?.querySelector('.card-menu-btn')
            if (b) b.setAttribute('aria-expanded', 'false')
          }
        })
        setMenuOpen(isHidden, true)
      })

      menuBtn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMenuOpen(true, true)
        }
      })

      dropdown.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setMenuOpen(false)
          menuBtn.focus()
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
        e.preventDefault()
        const items = [...dropdown.querySelectorAll('[role="menuitem"]')]
        const index = items.indexOf(document.activeElement)
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
          : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      })

      dropdown.querySelectorAll('.card-dropdown-item').forEach((item) => {
        item.addEventListener('click', () => {
          setMenuOpen(false)
          menuBtn.focus()
        }, { capture: true })
      })

      dropdown.addEventListener('focusout', (e) => {
        if (!updatingMenu && !dropdown.contains(e.relatedTarget) && e.relatedTarget !== menuBtn) setMenuOpen(false)
      })
    }
  })
}

export function summaryTableHtml(data) {
  return `
    <div class="summary-table-container">
      <table class="data-table summary-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Servicio</th>
            <th>Vence</th>
            <th>Estado</th>
            <th>Venta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(summaryRowHtml).join('')}
        </tbody>
      </table>
    </div>`
}

export function summaryRowHtml(row) {
  const serviceName = row.service || row.product?.name || 'SIN SERVICIO'
  const initials = serviceName.trim().substring(0, 2).toUpperCase()
  const logoUrl = row.product?.logo_url
  const categoryTag = row.product?.category || null
  const saleDisplay = formatAmount(row.sale_price, row.sale_price_currency)

  return `
    <tr data-id="${row.id}">
      <td data-label="Cliente">
        <div class="summary-client-cell">
          <strong class="summary-client-name" title="${escapeHtml(row.client_name || 'Sin nombre')}">${escapeHtml(row.client_name || 'Sin nombre')}</strong>
          ${row.phone ? `<span class="summary-phone">${escapeHtml(row.phone)}</span>` : ''}
        </div>
      </td>
      <td data-label="Servicio">
        <div class="summary-service-cell">
          ${logoUrl ? `
            <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(serviceName)}" class="summary-service-logo" onerror="this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');" />
            <div class="summary-service-fallback hidden">${escapeHtml(initials)}</div>
          ` : `
            <div class="summary-service-fallback">${escapeHtml(initials)}</div>
          `}
          <div class="summary-service-meta">
            <strong class="summary-service-title" title="${escapeHtml(serviceName)}">${escapeHtml(serviceName)}</strong>
            ${categoryTag ? `<span class="summary-service-tag">${escapeHtml(categoryTag)}</span>` : ''}
          </div>
        </div>
      </td>
      <td data-label="Vence">
        <div class="summary-date-cell">
          <span class="summary-date-val">${formatDate(row.expiry_date)}</span>
        </div>
      </td>
      <td data-label="Estado">
        ${subscriptionBadgeHtml(row)}
      </td>
      <td data-label="Venta">
        <strong class="summary-price-val">${saleDisplay}</strong>
      </td>
      <td data-label="Acciones">
        ${subscriptionActionsHtml(row, true)}
      </td>
    </tr>`
}

export function bindSummaryEvents() {
  bindSubscriptionEvents()
}

export function renderData() {
  activeActionMenu?.close()
  renderFilters()
  renderQuickViews()
  updateViewButtons()

  const data = filteredRows()
  const cards = document.querySelector('#cards')
  if (!cards) return

  const hasAnyFilter = checkHasAnyActiveFilter()
  const count = data.length
  const total = state.rows.length
  const totalNoun = total === 1 ? 'suscripción' : 'suscripciones'
  const counterText = hasAnyFilter
    ? `${count} de ${total} ${totalNoun}`
    : `${count} ${totalNoun}`

  const resultsLine = document.querySelector('#resultsLine')
  if (resultsLine) {
    resultsLine.innerHTML = `<span>${escapeHtml(counterText)}</span>`
  }

  if (total === 0) {
    cards.className = 'empty-state-wrapper'
    cards.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.subscriptions}</div>
        <h3>No hay suscripciones</h3>
        <p>Empieza registrando tu primera suscripción para llevar el control.</p>
        <button type="button" class="btn btn-primary" id="emptyNewBtn">
          ${ICONS.plus} Nueva suscripción
        </button>
      </div>
    `
    cards.querySelector('#emptyNewBtn')?.addEventListener('click', () => openSubscriptionForm())
    return
  }

  if (count === 0) {
    const q = state.filters.search.trim()
    cards.className = 'empty-state-wrapper'
    cards.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.search}</div>
        <h3>Sin resultados</h3>
        <p>No se encontraron suscripciones${q ? ` para "<strong>${escapeHtml(q)}</strong>"` : ' con los filtros seleccionados'}.</p>
        <button type="button" class="btn btn-secondary" id="emptyClearBtn">
          Limpiar filtros
        </button>
      </div>
    `
    cards.querySelector('#emptyClearBtn')?.addEventListener('click', () => resetAllFilters())
    return
  }

  if (effectiveView() === 'summary') {
    cards.className = 'summary-view-wrapper'
    cards.innerHTML = summaryTableHtml(data)
    bindSummaryEvents()
  } else {
    cards.className = 'grid'
    cards.innerHTML = data.map(cardHtml).join('')
    bindCardEvents()
  }

  if (state.highlightRowId) {
    const targetElement = cards.querySelector(`[data-id="${state.highlightRowId}"]`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      targetElement.classList.add('card-highlight-active')
      setTimeout(() => {
        targetElement.classList.remove('card-highlight-active')
      }, 2000)
    }
    state.highlightRowId = null
  }
}
