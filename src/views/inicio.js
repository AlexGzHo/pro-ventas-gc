import {
  amountInPEN,
  daysUntil,
  escapeHtml,
  formatDate,
  formatMoney,
  formatUSDT,
  normalizeCurrency,
  statusFor,
} from '../utils.js'
import { supabase } from '../supabase.js'
import { FINANCIAL_HISTORY_START, OWNERS_BY_ID } from '../constants.js'
import { ICONS } from '../ui/icons.js'
import { state, latestUSDTExchangeRate, rowById } from '../state.js'
import { safeWhatsapp, copyCredentialsAction } from '../features/subscriptionActions.js'
import { openRenewModal } from '../features/renewModal.js'
import { reminderText } from '../whatsapp.js'

let dashboardState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-11
  owner: 'TODOS',
  data: null, // current month data
  prevData: null, // previous month data
  loading: false,
  isBeforeHistory: false,
  isPrevBeforeHistory: false
}

export function calculateInicioMetrics(rows = []) {
  let today = 0, next7 = 0, expired = 0, active = 0

  rows.forEach((row) => {
    if (row.archived_at) return
    const days = daysUntil(row.expiry_date)
    if (days !== null && days >= 0) active++
    if (days === 0) today++
    if (days !== null && days > 0 && days <= 7) next7++
    if (days !== null && days < 0) expired++
  })

  return { total: rows.length, active, today, next7, expired }
}

export function getAttentionSubscriptions(rows = [], maxItems = 15) {
  const list = []

  rows.forEach((row) => {
    if (row.archived_at) return
    const days = daysUntil(row.expiry_date)
    // Vencidas (days < 0) y por vencer en <= 3 días (days >= 0 && days <= 3)
    if (days !== null && days <= 3) {
      list.push({ row, days })
    }
  })

  // Ordenar por urgencia: más vencidas primero, luego hoy, luego 1, 2, 3 días
  list.sort((a, b) => a.days - b.days)

  if (maxItems) {
    return list.slice(0, maxItems).map((item) => item.row)
  }
  return list.map((item) => item.row)
}

async function fetchDashboardData() {
  const { year, month, owner } = dashboardState

  // Mes actual
  const startDate = new Date(year, month, 1, 0, 0, 0, 0)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

  // Mes anterior
  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth < 0) {
    prevMonth = 11
    prevYear--
  }
  const prevStartDate = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0)
  const prevEndDate = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999)

  const [hsYear, hsMonth, hsDay] = FINANCIAL_HISTORY_START.split('-').map(Number)
  const historyStart = new Date(hsYear, hsMonth - 1, hsDay, 0, 0, 0, 0)

  dashboardState.isBeforeHistory = endDate < historyStart
  dashboardState.isPrevBeforeHistory = prevEndDate < historyStart

  let currentQuery = supabase
    .from('subscription_renewals')
    .select('sale_amount_pen, cost_amount_pen, renewed_by')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  let prevQuery = supabase
    .from('subscription_renewals')
    .select('sale_amount_pen, cost_amount_pen, renewed_by')
    .gte('created_at', prevStartDate.toISOString())
    .lte('created_at', prevEndDate.toISOString())

  const [currentRes, prevRes] = await Promise.all([currentQuery, prevQuery])

  const filterByOwner = (rows) => {
    if (!rows) return []
    if (owner === 'TODOS') return rows
    const ownerId = Object.keys(OWNERS_BY_ID).find(k => OWNERS_BY_ID[k] === owner)
    return rows.filter(r => r.renewed_by === ownerId)
  }

  dashboardState.data = filterByOwner(currentRes.data)
  dashboardState.prevData = filterByOwner(prevRes.data)
}

function getFormattedMoneyValue(amountInPEN) {
  const isUsdt = state.totalView === 'USDT'
  if (isUsdt) {
    const rate = Number(state.usdtViewRate) > 0 ? Number(state.usdtViewRate) : (latestUSDTExchangeRate() || 3.75)
    const usdtValue = rate > 0 ? (amountInPEN / rate) : amountInPEN
    return formatUSDT(usdtValue)
  }
  return formatMoney(amountInPEN)
}

export function renderPrimaryKpis(rows = []) {
  const op = calculateInicioMetrics(rows)

  let incomePEN = 0
  let costPEN = 0
  let profitPEN = 0

  if (dashboardState.data && !dashboardState.isBeforeHistory) {
    incomePEN = dashboardState.data.reduce((sum, r) => sum + Number(r.sale_amount_pen || 0), 0)
    costPEN = dashboardState.data.reduce((sum, r) => sum + Number(r.cost_amount_pen || 0), 0)
    profitPEN = incomePEN - costPEN
  }

  const incomeFormatted = dashboardState.loading ? '...' : getFormattedMoneyValue(incomePEN)
  const profitFormatted = dashboardState.loading ? '...' : getFormattedMoneyValue(profitPEN)
  const profitClass = profitPEN >= 0 ? 'profit-positive' : 'profit-negative'
  const currencyBadge = state.totalView === 'USDT' ? 'USDT' : 'PEN'

  return `
    <div class="inicio-kpi-grid">
      <!-- KPI 1: Ingresos del mes -->
      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Ingresos del mes</span>
          <span class="kpi-currency-pill">${currencyBadge}</span>
        </div>
        <strong class="inicio-kpi-val">${incomeFormatted}</strong>
        <span class="kpi-subtext">Ventas brutas registradas</span>
      </article>

      <!-- KPI 2: Ganancia del mes -->
      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Ganancia del mes</span>
          <div class="kpi-icon-wrap ${profitPEN >= 0 ? 'kpi-icon-accent' : 'kpi-icon-danger'}">
            ${ICONS.trendingUp}
          </div>
        </div>
        <strong class="inicio-kpi-val ${profitClass}">${profitFormatted}</strong>
        <span class="kpi-subtext">Margen neto operativo</span>
      </article>

      <!-- KPI 3: Activas -->
      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Activas</span>
          <div class="kpi-icon-wrap kpi-icon-primary">
            ${ICONS.subscriptions}
          </div>
        </div>
        <strong class="inicio-kpi-val">${op.active}</strong>
        <span class="kpi-subtext">Cuentas vigentes al día</span>
      </article>

      <!-- KPI 4: Por vencer -->
      <article class="kpi inicio-kpi-card ${op.next7 > 0 ? 'inicio-kpi-soon' : ''}">
        <div class="inicio-kpi-top">
          <span>Por vencer</span>
          <div class="kpi-icon-wrap kpi-icon-soon">
            ${ICONS.clock}
          </div>
        </div>
        <strong class="inicio-kpi-val">${op.next7}</strong>
        <span class="kpi-subtext">Próximos 7 días</span>
      </article>
    </div>
  `
}

function renderFinancialDashboard() {
  if (dashboardState.loading) {
    return `
      <div class="inicio-finance-grid inicio-finance-loading-wrapper">
         <div class="inicio-finance-loading">Calculando datos financieros...</div>
      </div>
    `
  }

  if (dashboardState.isBeforeHistory) {
    return `
      <div class="inicio-empty-attention inicio-empty-secondary">
        <div class="inicio-empty-icon-wrap">
          ${ICONS.alertTriangle}
        </div>
        <div>
          <strong>Sin datos históricos</strong>
          <p>El registro financiero inicia desde el ${FINANCIAL_HISTORY_START}.</p>
        </div>
      </div>
    `
  }

  const calcTotals = (rows) => {
    let income = 0, cost = 0
    if (rows) {
      income = rows.reduce((sum, r) => sum + Number(r.sale_amount_pen || 0), 0)
      cost = rows.reduce((sum, r) => sum + Number(r.cost_amount_pen || 0), 0)
    }
    return { income, cost, profit: income - cost }
  }

  const cur = calcTotals(dashboardState.data)
  const prev = dashboardState.isPrevBeforeHistory ? null : calcTotals(dashboardState.prevData)

  const profitClass = cur.profit >= 0 ? 'profit-positive' : 'profit-negative'

  // Crecimiento y barras comparativas
  let profitGrowthHtml = ''
  let barCurrentHeight = 10
  let barPrevHeight = 10

  if (prev && prev.profit !== 0) {
    const diff = cur.profit - prev.profit
    const growth = (diff / Math.abs(prev.profit)) * 100
    const isPositive = diff >= 0
    const symbol = isPositive ? '+' : ''
    profitGrowthHtml = `
      <span class="kpi-trend ${isPositive ? 'trend-up' : 'trend-down'}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${isPositive ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline></svg>
        ${symbol}${growth.toFixed(1)}% vs mes ant.
      </span>`
  } else if (prev && prev.profit === 0 && cur.profit > 0) {
    profitGrowthHtml = `
      <span class="kpi-trend trend-up">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
        +100% vs mes ant.
      </span>`
  } else if (!prev) {
    profitGrowthHtml = `<span class="kpi-trend trend-neutral">Sin historial anterior</span>`
  }

  if (prev) {
    const maxP = Math.max(Math.abs(cur.profit), Math.abs(prev.profit))
    if (maxP > 0) {
      barCurrentHeight = Math.round(Math.max((Math.abs(cur.profit) / maxP) * 65, 8))
      barPrevHeight = Math.round(Math.max((Math.abs(prev.profit) / maxP) * 65, 8))
    }
  } else {
    barCurrentHeight = 65
  }

  const currencyBadge = state.totalView === 'USDT' ? 'USDT' : 'PEN'

  return `
    <div class="inicio-finance-grid">
      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Ventas Registradas</span>
          <div class="kpi-icon-wrap kpi-icon-success">
            ${ICONS.dollarSign}
          </div>
        </div>
        <strong class="inicio-kpi-val">${getFormattedMoneyValue(cur.income)}</strong>
        <span class="kpi-subtext">Ingreso bruto mensual</span>
      </article>

      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Costos Est.</span>
          <div class="kpi-icon-wrap kpi-icon-neutral">
            ${ICONS.creditCard}
          </div>
        </div>
        <strong class="inicio-kpi-val">${getFormattedMoneyValue(cur.cost)}</strong>
        <span class="kpi-subtext">Inversión a proveedores</span>
      </article>

      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Margen Est.</span>
          <div class="kpi-icon-wrap kpi-icon-accent">
            ${ICONS.trendingUp}
          </div>
        </div>
        <strong class="inicio-kpi-val ${profitClass}">${getFormattedMoneyValue(cur.profit)}</strong>
        ${profitGrowthHtml}
      </article>

      <!-- Gráfico comparativo SVG responsivo y sin style en línea -->
      <article class="kpi inicio-kpi-card inicio-chart-card">
        <div class="inicio-kpi-top">
          <span>Comparativo Mensual</span>
          <span class="kpi-currency-pill">${currencyBadge}</span>
        </div>
        ${!prev ? `
          <div class="inicio-chart-empty">
            <span>Sin datos del mes anterior</span>
          </div>
        ` : `
          <div class="inicio-bars-wrapper">
            <div class="inicio-bar-column">
              <span class="inicio-bar-val">${getFormattedMoneyValue(prev.profit)}</span>
              <div class="inicio-bar-track">
                <svg class="inicio-bars-svg" viewBox="0 0 60 70" preserveAspectRatio="none">
                  <rect x="10" y="${70 - barPrevHeight}" width="40" height="${barPrevHeight}" rx="4" class="svg-bar-prev" />
                </svg>
              </div>
              <span class="inicio-bar-label">Mes Ant.</span>
            </div>

            <div class="inicio-bar-column">
              <span class="inicio-bar-val inicio-bar-val-cur">${getFormattedMoneyValue(cur.profit)}</span>
              <div class="inicio-bar-track">
                <svg class="inicio-bars-svg" viewBox="0 0 60 70" preserveAspectRatio="none">
                  <rect x="10" y="${70 - barCurrentHeight}" width="40" height="${barCurrentHeight}" rx="4" class="svg-bar-cur" />
                </svg>
              </div>
              <span class="inicio-bar-label inicio-bar-label-cur">Mes Actual</span>
            </div>
          </div>
        `}
      </article>
    </div>
  `
}

function renderDashboardControls() {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const years = [2026, 2027, 2028]

  return `
    <div class="dash-controls">
      <select id="dashMonthFilter" class="filter-select" aria-label="Filtrar por mes">
        ${months.map((m, i) => `<option value="${i}" ${dashboardState.month === i ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <select id="dashYearFilter" class="filter-select" aria-label="Filtrar por año">
        ${years.map(y => `<option value="${y}" ${dashboardState.year === y ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
      <select id="dashOwnerFilter" class="filter-select" aria-label="Filtrar por responsable">
        <option value="TODOS" ${dashboardState.owner === 'TODOS' ? 'selected' : ''}>Registrado por: Todos</option>
        <option value="Alex" ${dashboardState.owner === 'Alex' ? 'selected' : ''}>Registrado por: Alex</option>
        <option value="Liz" ${dashboardState.owner === 'Liz' ? 'selected' : ''}>Registrado por: Liz</option>
      </select>
    </div>
  `
}

export function renderInicioHtml(rows = []) {
  const attentionItems = getAttentionSubscriptions(rows, 15)

  return `
    <div class="inicio-view">
      <section class="hero inicio-hero">
        <div>
          <h2>Inicio</h2>
          <p>Prioridades del día y estado financiero del negocio.</p>
        </div>
      </section>

      <!-- SECCIÓN SUPERIOR: Requiere atención (vencidas y ≤ 3 días) -->
      <section class="inicio-section" aria-label="Requieren atención">
        <div class="inicio-section-header">
          <div class="inicio-title-wrap">
            <h3 class="inicio-section-title">Requieren atención</h3>
            ${attentionItems.length ? `<span class="inicio-badge-count">${attentionItems.length} pendientes</span>` : ''}
          </div>
          <span class="inicio-section-sub">Vencidas y por vencer en 3 días o menos</span>
        </div>

        ${attentionItems.length === 0 ? `
          <div class="inicio-empty-attention">
            <div class="inicio-empty-icon-wrap">
              ${ICONS.checkCircle}
            </div>
            <div>
              <strong>Todo al día</strong>
              <p>No hay suscripciones que requieran atención inmediata en este momento.</p>
            </div>
          </div>
        ` : `
          <div class="inicio-attention-list">
            ${attentionItems.map((r) => renderAttentionItemHtml(r)).join('')}
          </div>
        `}
      </section>

      <!-- SECCIÓN CENTRAL: 4 KPIs Máximo con Selector de Moneda y TC -->
      <section class="inicio-section" aria-label="Cómo va el negocio">
        <div class="inicio-section-header inicio-kpi-header">
          <div class="inicio-title-wrap">
            <h3 class="inicio-section-title">Cómo va el negocio</h3>
            <span class="inicio-section-sub">Rendimiento del mes actual y estado de cuentas</span>
          </div>

          <div class="inicio-currency-toolbar">
            <div class="currency-select-wrap">
              <select id="inicioTotalViewFilter" class="filter-select currency-select" title="Moneda de visualización">
                <option value="PEN" ${state.totalView === 'PEN' ? 'selected' : ''}>Moneda: S/ (PEN)</option>
                <option value="USDT" ${state.totalView === 'USDT' ? 'selected' : ''}>Moneda: USDT</option>
              </select>
            </div>

            <div id="inicioUsdtRateBox" class="rate-box-compact ${state.totalView === 'USDT' ? '' : 'hidden'}">
              <label class="rate-label-compact">TC S/:
                <input id="inicioUsdtRateInput" type="number" min="0" step="0.0001" placeholder="Ej. 3.75" class="rate-input-compact" value="${state.usdtViewRate ?? ''}">
              </label>
            </div>
          </div>
        </div>

        <div id="inicioPrimaryKpisContainer">
          ${renderPrimaryKpis(rows)}
        </div>
      </section>

      <!-- SECCIÓN INFERIOR: Resumen financiero detallado (visualmente secundario y plegable) -->
      <section class="inicio-section" aria-label="Historial financiero">
        <details class="inicio-financial-details">
          <summary class="inicio-financial-summary">
            <div class="financial-summary-header">
              <div class="financial-summary-title">
                <span class="financial-summary-icon">${ICONS.trendingUp}</span>
                <span>Detalle Financiero y Comparativo Mensual</span>
              </div>
              <span class="financial-summary-badge">Filtros y comparativa</span>
            </div>
          </summary>

          <div class="inicio-financial-content">
            <div class="inicio-section-header inicio-section-header-wrap">
              <span class="inicio-section-sub">Auditoría por mes y responsable</span>
              ${renderDashboardControls()}
            </div>
            <div id="financialDashboardContainer">
              ${renderFinancialDashboard()}
            </div>
          </div>
        </details>
      </section>
    </div>
  `
}

function renderAttentionItemHtml(row) {
  const status = statusFor(row.expiry_date, row.archived_at)
  const client = escapeHtml(row.client_name || 'Sin nombre')
  const service = escapeHtml(row.service || 'SIN SERVICIO')
  const expiry = formatDate(row.expiry_date)
  const phone = escapeHtml(row.phone || '')
  const days = daysUntil(row.expiry_date)
  const isOverdue = days !== null && days < 0

  let statusText = status.label
  if (days === 0) statusText = 'Vence hoy'
  else if (days === 1) statusText = 'Vence mañana'
  else if (days === -1) statusText = 'Venció ayer'
  else if (days !== null && days < -1) statusText = `Venció hace ${Math.abs(days)} días`
  else if (days !== null && days > 1) statusText = `Vence en ${days} días`

  return `
    <article class="inicio-attention-card ${isOverdue ? 'attention-danger' : 'attention-warning'}" data-sub-id="${row.id}">
      <div class="inicio-attention-info">
        <div class="inicio-attention-title-line">
          <strong class="inicio-attention-client">${client}</strong>
          <span class="service-pill"><span class="service-dot"></span>${service}</span>
        </div>
        <div class="inicio-attention-meta">
          ${phone ? `<span class="inicio-attention-phone">${ICONS.phone} ${phone}</span>` : ''}
          <span class="inicio-attention-expiry">
            ${ICONS.calendar} Vence: ${expiry}
          </span>
          <span class="badge badge-${status.tone}">${statusText}</span>
        </div>
      </div>
      <div class="inicio-attention-actions">
        <button type="button" class="btn btn-small btn-action-cobrar" data-sub-id="${row.id}" title="Enviar cobro / recordatorio por WhatsApp">
          ${ICONS.whatsapp}
          <span>Cobrar</span>
        </button>
        <button type="button" class="btn btn-small btn-action-copy-inicio" data-sub-id="${row.id}" title="Copiar accesos y credenciales" aria-label="Copiar accesos">
          ${ICONS.copy}
          <span>Copiar accesos</span>
        </button>
        <button type="button" class="btn btn-small btn-action-renovar" data-sub-id="${row.id}" title="Renovar suscripción">
          ${ICONS.calendar}
          <span>Renovar</span>
        </button>
        <button type="button" class="btn btn-small btn-ghost btn-view-sub" data-sub-id="${row.id}" title="Ver suscripción en Gestión">
          <span>Ver</span>
          ${ICONS.chevronRight}
        </button>
      </div>
    </article>
  `
}

export function bindInicioEvents(container, rows, { onNavigateToSubscription } = {}) {
  if (!container) return

  // 1. Acciones directas en las filas de "Requiere atención"
  container.querySelectorAll('.btn-action-cobrar').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const rowId = btn.dataset.subId
      const row = rowById(rowId) || rows.find((r) => String(r.id) === String(rowId))
      if (row) {
        safeWhatsapp(row, reminderText(row))
      }
    })
  })

  container.querySelectorAll('.btn-action-copy-inicio').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const rowId = btn.dataset.subId
      const row = rowById(rowId) || rows.find((r) => String(r.id) === String(rowId))
      if (row) {
        await copyCredentialsAction(row, btn)
      }
    })
  })

  container.querySelectorAll('.btn-action-renovar').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const rowId = btn.dataset.subId
      const row = rowById(rowId) || rows.find((r) => String(r.id) === String(rowId))
      if (row) {
        openRenewModal(row)
      }
    })
  })

  container.querySelectorAll('.btn-view-sub').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const rowId = btn.dataset.subId
      if (rowId && onNavigateToSubscription) {
        onNavigateToSubscription(rowId)
      }
    })
  })

  // 2. Selector de moneda y tipo de cambio (para los 4 KPIs y el resumen)
  const currencyFilter = container.querySelector('#inicioTotalViewFilter')
  const rateBox = container.querySelector('#inicioUsdtRateBox')
  const rateInput = container.querySelector('#inicioUsdtRateInput')
  const primaryKpisContainer = container.querySelector('#inicioPrimaryKpisContainer')
  const financialContainer = container.querySelector('#financialDashboardContainer')

  const refreshKpisAndFinances = () => {
    if (primaryKpisContainer) {
      primaryKpisContainer.innerHTML = renderPrimaryKpis(rows)
    }
    if (financialContainer) {
      financialContainer.innerHTML = renderFinancialDashboard()
    }
  }

  if (currencyFilter) {
    currencyFilter.addEventListener('change', (e) => {
      state.totalView = e.target.value
      if (rateBox) {
        rateBox.classList.toggle('hidden', state.totalView !== 'USDT')
      }
      if (state.totalView === 'USDT' && !(Number(state.usdtViewRate) > 0)) {
        const suggestion = latestUSDTExchangeRate() || 3.75
        state.usdtViewRate = suggestion
        if (rateInput) rateInput.value = suggestion
      }
      refreshKpisAndFinances()
    })
  }

  if (rateInput) {
    rateInput.addEventListener('input', (e) => {
      state.usdtViewRate = e.target.value
      refreshKpisAndFinances()
    })
  }
}

export async function mountInicioView(container, rows, handlers = {}) {
  document.title = 'Inicio — PRO VENTAS GC'

  // 1. Render base structure
  container.innerHTML = renderInicioHtml(rows)
  bindInicioEvents(container, rows, handlers)

  const primaryKpisContainer = container.querySelector('#inicioPrimaryKpisContainer')
  const fContainer = container.querySelector('#financialDashboardContainer')

  // 2. Fetch and render dashboard
  const refreshDashboard = async () => {
    dashboardState.loading = true
    if (primaryKpisContainer) {
      primaryKpisContainer.innerHTML = renderPrimaryKpis(rows)
    }
    if (fContainer) {
      fContainer.innerHTML = renderFinancialDashboard()
    }
    await fetchDashboardData()
    dashboardState.loading = false
    if (primaryKpisContainer) {
      primaryKpisContainer.innerHTML = renderPrimaryKpis(rows)
    }
    if (fContainer) {
      fContainer.innerHTML = renderFinancialDashboard()
    }
  }

  // 3. Bind controls del detalle mensual
  const monthSel = container.querySelector('#dashMonthFilter')
  const yearSel = container.querySelector('#dashYearFilter')
  const ownerSel = container.querySelector('#dashOwnerFilter')

  const applyControlsAndRefresh = () => {
    if (monthSel) dashboardState.month = parseInt(monthSel.value, 10)
    if (yearSel) dashboardState.year = parseInt(yearSel.value, 10)
    if (ownerSel) dashboardState.owner = ownerSel.value
    refreshDashboard()
  }

  monthSel?.addEventListener('change', applyControlsAndRefresh)
  yearSel?.addEventListener('change', applyControlsAndRefresh)
  ownerSel?.addEventListener('change', applyControlsAndRefresh)

  // Iniciar carga de datos financieros
  refreshDashboard()
}
