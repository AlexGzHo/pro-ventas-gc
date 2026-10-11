import {
  amountInPEN,
  daysUntil,
  escapeHtml,
  formatDate,
  formatMoney,
  normalizeCurrency,
  statusFor,
} from '../utils.js'
import { supabase } from '../supabase.js'
import { FINANCIAL_HISTORY_START, OWNERS_BY_ID } from '../constants.js'

let dashboardState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-11
  owner: 'TODOS',
  data: null, // current month data
  prevData: null, // previous month data
  loading: false,
}

// Para la seccin operativa
function rowSaleCurrency(row) {
  return normalizeCurrency(row?.sale_price_currency)
}

function rowCostCurrency(row) {
  return normalizeCurrency(row?.cost_currency)
}

export function calculateInicioMetrics(rows = []) {
  let today = 0, next7 = 0, expired = 0

  rows.forEach((row) => {
    const days = daysUntil(row.expiry_date)
    if (days === 0) today++
    if (days !== null && days > 0 && days <= 7) next7++
    if (days !== null && days < 0) expired++
  })

  return { total: rows.length, today, next7, expired }
}

export function getAttentionSubscriptions(rows = [], maxItems = 8) {
  const todayList = []
  const soonList = []
  const expiredList = []

  rows.forEach((row) => {
    const st = statusFor(row.expiry_date, row.archived_at)
    const days = st.days
    if (st.key === 'hoy') todayList.push({ row, days: 0 })
    else if (st.key === 'proximo') soonList.push({ row, days })
    else if (st.key === 'vencido') expiredList.push({ row, days })
  })

  todayList.sort((a, b) => (a.row.client_name || '').localeCompare(b.row.client_name || '', 'es'))
  soonList.sort((a, b) => a.days - b.days)
  expiredList.sort((a, b) => b.days - a.days)

  const combined = [...todayList, ...soonList, ...expiredList].slice(0, maxItems)
  return combined.map((item) => item.row)
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

function renderFinancialDashboard() {
  if (dashboardState.loading) {
    return `
      <div class="inicio-finance-grid" style="opacity: 0.5;">
         <div style="padding:20px; text-align:center; grid-column: 1 / -1;">Calculando...</div>
      </div>
    `
  }

  if (dashboardState.isBeforeHistory) {
    return `
      <div class="inicio-empty-attention" style="margin-bottom: 20px;">
        <svg class="inicio-empty-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
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

  // Calculamos % de crecimiento y alturas
  let profitGrowthHtml = ''
  let barCurrentHeight = 5
  let barPrevHeight = 5
  let curColor = cur.profit >= 0 ? 'var(--color-brand)' : 'var(--status-danger-text)'
  let prevColor = (prev && prev.profit >= 0) ? 'var(--bg-surface-elevated)' : 'var(--status-danger-text)'

  if (prev && prev.profit !== 0) {
    const diff = cur.profit - prev.profit
    const growth = (diff / Math.abs(prev.profit)) * 100
    const color = diff >= 0 ? 'var(--status-success-text)' : 'var(--status-danger-text)'
    const symbol = diff >= 0 ? '+' : ''
    profitGrowthHtml = `<span class="kpi-trend" style="color: ${color};"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${diff >= 0 ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline></svg>${symbol}${growth.toFixed(1)}% vs mes ant.</span>`
  } else if (prev && prev.profit === 0 && cur.profit > 0) {
    profitGrowthHtml = `<span class="kpi-trend" style="color: var(--status-success-text);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>+100% vs mes ant.</span>`
  } else if (!prev) {
    profitGrowthHtml = `<span class="kpi-trend" style="color: var(--text-dim);">Sin historial anterior</span>`
  }

  if (prev) {
    const maxP = Math.max(Math.abs(cur.profit), Math.abs(prev.profit))
    if (maxP > 0) {
        barCurrentHeight = Math.max((Math.abs(cur.profit) / maxP) * 100, 6)
        barPrevHeight = Math.max((Math.abs(prev.profit) / maxP) * 100, 6)
    }
  } else {
    barCurrentHeight = 100
  }

  return `
    <div class="inicio-finance-grid">
      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Ventas Registradas</span>
          <div class="kpi-icon-wrap kpi-icon-success">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>
        <strong class="inicio-kpi-val">${formatMoney(cur.income)}</strong>
        <span class="kpi-subtext">Ingreso bruto mensual</span>
      </article>

      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Costos Est.</span>
          <div class="kpi-icon-wrap kpi-icon-neutral">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          </div>
        </div>
        <strong class="inicio-kpi-val">${formatMoney(cur.cost)}</strong>
        <span class="kpi-subtext">Inversión a proveedores</span>
      </article>

      <article class="kpi inicio-kpi-card">
        <div class="inicio-kpi-top">
          <span>Margen Est.</span>
          <div class="kpi-icon-wrap kpi-icon-accent">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </div>
        </div>
        <strong class="inicio-kpi-val ${profitClass}">${formatMoney(cur.profit)}</strong>
        ${profitGrowthHtml}
      </article>

      <!-- Gráfico comparativo compacto StreamNeox -->
      <article class="kpi inicio-kpi-card inicio-chart-card">
        <div class="inicio-kpi-top">
          <span>Comparativo Mensual</span>
          <span class="kpi-currency-pill">PEN</span>
        </div>
        ${!prev ? `
          <div class="inicio-chart-empty">
            <span>Sin datos del mes anterior</span>
          </div>
        ` : `
          <div class="inicio-bars-wrapper">
            <div class="inicio-bar-column">
              <span class="inicio-bar-val">${formatMoney(prev.profit)}</span>
              <div class="inicio-bar-track">
                <div class="inicio-bar-fill bar-prev" style="height:${barPrevHeight}%;"></div>
              </div>
              <span class="inicio-bar-label">Mes Anterior</span>
            </div>

            <div class="inicio-bar-column">
              <span class="inicio-bar-val inicio-bar-val-cur">${formatMoney(cur.profit)}</span>
              <div class="inicio-bar-track">
                <div class="inicio-bar-fill bar-cur" style="height:${barCurrentHeight}%;"></div>
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
      <select id="dashMonthFilter" class="filter-select">
        ${months.map((m, i) => `<option value="${i}" ${dashboardState.month === i ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <select id="dashYearFilter" class="filter-select">
        ${years.map(y => `<option value="${y}" ${dashboardState.year === y ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
      <select id="dashOwnerFilter" class="filter-select">
        <option value="TODOS" ${dashboardState.owner === 'TODOS' ? 'selected' : ''}>Registrado por: Todos</option>
        <option value="Alex" ${dashboardState.owner === 'Alex' ? 'selected' : ''}>Registrado por: Alex</option>
        <option value="Liz" ${dashboardState.owner === 'Liz' ? 'selected' : ''}>Registrado por: Liz</option>
      </select>
    </div>
  `
}

export function renderInicioHtml(rows = []) {
  const op = calculateInicioMetrics(rows)
  const attentionItems = getAttentionSubscriptions(rows, 8)

  return `
    <div class="inicio-view">
      <section class="hero inicio-hero">
        <div>
          <h2>Inicio</h2>
          <p>Visión general de suscripciones y operaciones del negocio.</p>
        </div>
      </section>

      <section class="inicio-section" aria-label="Resumen operativo">
        <div class="inicio-section-header">
          <h3 class="inicio-section-title">Resumen operativo</h3>
        </div>
        <div class="inicio-kpi-grid">
          <article class="kpi inicio-kpi-card">
            <div class="inicio-kpi-top">
              <span>Total Suscripciones</span>
              <div class="kpi-icon-wrap kpi-icon-primary">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              </div>
            </div>
            <strong class="inicio-kpi-val">${op.total}</strong>
            <span class="kpi-subtext">Cuentas gestionadas</span>
          </article>

          <article class="kpi inicio-kpi-card ${op.today > 0 ? 'inicio-kpi-warning' : ''}">
            <div class="inicio-kpi-top">
              <span>Vencen hoy</span>
              <div class="kpi-icon-wrap kpi-icon-warning">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
            </div>
            <strong class="inicio-kpi-val">${op.today}</strong>
            <span class="kpi-subtext">Atención inmediata</span>
          </article>

          <article class="kpi inicio-kpi-card ${op.next7 > 0 ? 'inicio-kpi-soon' : ''}">
            <div class="inicio-kpi-top">
              <span>Próximos 7 días</span>
              <div class="kpi-icon-wrap kpi-icon-soon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
            </div>
            <strong class="inicio-kpi-val">${op.next7}</strong>
            <span class="kpi-subtext">Por renovar</span>
          </article>

          <article class="kpi inicio-kpi-card ${op.expired > 0 ? 'inicio-kpi-danger' : ''}">
            <div class="inicio-kpi-top">
              <span>Vencidas</span>
              <div class="kpi-icon-wrap kpi-icon-danger">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </div>
            </div>
            <strong class="inicio-kpi-val">${op.expired}</strong>
            <span class="kpi-subtext">Pendientes de corte</span>
          </article>
        </div>
      </section>

      <section class="inicio-section" aria-label="Dashboard Financiero">
        <div class="inicio-section-header inicio-section-header-wrap">
          <h3 class="inicio-section-title">Dashboard Financiero Mensual</h3>
          ${renderDashboardControls()}
        </div>
        <div id="financialDashboardContainer">
            ${renderFinancialDashboard()}
        </div>
      </section>

      <section class="inicio-section" aria-label="Requieren atención">
        <div class="inicio-section-header">
          <div class="inicio-title-wrap">
            <h3 class="inicio-section-title">Requieren atención</h3>
            ${attentionItems.length ? `<span class="inicio-badge-count">${attentionItems.length} pendientes</span>` : ''}
          </div>
          <span class="inicio-section-sub">Vencen hoy, próximas o vencidas</span>
        </div>

        ${attentionItems.length === 0 ? `
          <div class="inicio-empty-attention">
            <svg class="inicio-empty-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
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
    </div>
  `
}

function renderAttentionItemHtml(row) {
  const status = statusFor(row.expiry_date, row.archived_at)
  const client = escapeHtml(row.client_name || 'Sin nombre')
  const service = escapeHtml(row.service || 'SIN SERVICIO')
  const expiry = formatDate(row.expiry_date)

  return `
    <article class="inicio-attention-card" data-sub-id="${row.id}">
      <div class="inicio-attention-info">
        <div class="inicio-attention-title-line">
          <strong class="inicio-attention-client">${client}</strong>
          <span class="service-pill"><span class="service-dot"></span>${service}</span>
        </div>
        <div class="inicio-attention-meta">
          <span class="inicio-attention-expiry">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Vence: ${expiry}
          </span>
          <span class="badge badge-${status.tone}">${escapeHtml(status.label)}</span>
        </div>
      </div>
      <div class="inicio-attention-action">
        <button type="button" class="btn btn-small btn-view-sub" data-sub-id="${row.id}" title="Ver suscripción en Gestión">
          Ver
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </article>
  `
}

export function bindInicioEvents(container, { onNavigateToSubscription } = {}) {
  if (!container) return

  container.querySelectorAll('.btn-view-sub').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const rowId = btn.dataset.subId
      if (rowId && onNavigateToSubscription) {
        onNavigateToSubscription(rowId)
      }
    })
  })
}

export async function mountInicioView(container, rows, handlers) {
  // 1. Render base structure
  container.innerHTML = renderInicioHtml(rows)
  bindInicioEvents(container, handlers)

  const fContainer = container.querySelector('#financialDashboardContainer')

  // 2. Fetch and render dashboard
  const refreshDashboard = async () => {
    dashboardState.loading = true;
    fContainer.innerHTML = renderFinancialDashboard()
    await fetchDashboardData()
    dashboardState.loading = false;
    fContainer.innerHTML = renderFinancialDashboard()
  }

  // 3. Bind controls
  const monthSel = container.querySelector('#dashMonthFilter')
  const yearSel = container.querySelector('#dashYearFilter')
  const ownerSel = container.querySelector('#dashOwnerFilter')

  const applyControlsAndRefresh = () => {
    dashboardState.month = parseInt(monthSel.value, 10)
    dashboardState.year = parseInt(yearSel.value, 10)
    dashboardState.owner = ownerSel.value
    refreshDashboard()
  }

  monthSel.addEventListener('change', applyControlsAndRefresh)
  yearSel.addEventListener('change', applyControlsAndRefresh)
  ownerSel.addEventListener('change', applyControlsAndRefresh)

  // Start initial fetch
  refreshDashboard()
}
