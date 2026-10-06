// Vista Inicio (Dashboard operativo y financiero compacto) para PRO VENTAS GC
// docs/DESIGN.md: midnight precision instrument con azul cobalto institucional
import {
  amountInPEN,
  daysUntil,
  escapeHtml,
  formatDate,
  formatMoney,
  normalizeCurrency,
  statusFor,
} from '../utils.js'

function rowSaleCurrency(row) {
  return normalizeCurrency(row?.sale_price_currency)
}

function rowCostCurrency(row) {
  return normalizeCurrency(row?.cost_currency)
}

/**
 * Calcula los totales y métricas de Inicio a partir de los datos en memoria
 * Reutiliza exactamente los mismos criterios de fecha y estado que las vistas rápidas
 * y cálculos de Suscripciones.
 */
export function calculateInicioMetrics(rows = []) {
  let today = 0
  let next7 = 0
  let expired = 0

  let totalIncome = 0
  let totalCost = 0

  rows.forEach((row) => {
    const days = daysUntil(row.expiry_date)

    // Criterios idénticos a matchesQuickView en Suscripciones
    if (days === 0) {
      today++
    }
    if (days !== null && days > 0 && days <= 7) {
      next7++
    }
    if (days !== null && days < 0) {
      expired++
    }

    // Totales financieros de las suscripciones activas/actuales en soles (PEN)
    const salePEN = amountInPEN(row.sale_price, rowSaleCurrency(row), row.sale_price_exchange_rate)
    const costPEN = amountInPEN(row.cost, rowCostCurrency(row), row.cost_exchange_rate)
    totalIncome += salePEN
    totalCost += costPEN
  })

  const totalProfit = totalIncome - totalCost

  return {
    operational: {
      total: rows.length,
      today,
      next7,
      expired,
    },
    financial: {
      income: totalIncome,
      cost: totalCost,
      profit: totalProfit,
    },
  }
}

/**
 * Obtiene las suscripciones que requieren atención inmediata según la lógica existente:
 * Requieren atención únicamente los registros cuyo statusFor(row.expiry_date) determina:
 * - hoy (days === 0) -> Vence hoy (prioridad 1)
 * - proximo (days > 0 && days <= 3) -> Vencen pronto (prioridad 2)
 * - vencido (days < 0) -> Vencidas (prioridad 3)
 * No incluye las que quedan > 3 días (que están en estado 'activo').
 */
export function getAttentionSubscriptions(rows = [], maxItems = 8) {
  const todayList = []
  const soonList = []
  const expiredList = []

  rows.forEach((row) => {
    const st = statusFor(row.expiry_date)
    const days = st.days

    if (st.key === 'hoy') {
      todayList.push({ row, days: 0 })
    } else if (st.key === 'proximo') {
      soonList.push({ row, days })
    } else if (st.key === 'vencido') {
      expiredList.push({ row, days })
    }
  })

  // Ordenamiento:
  // Vencen hoy: orden alfabético por cliente
  todayList.sort((a, b) => (a.row.client_name || '').localeCompare(b.row.client_name || '', 'es'))
  // Próximas (1 a 3 días): menor días primero
  soonList.sort((a, b) => a.days - b.days)
  // Vencidas: las vencidas más recientemente primero (-1 antes de -10)
  expiredList.sort((a, b) => b.days - a.days)

  const combined = [...todayList, ...soonList, ...expiredList].slice(0, maxItems)
  return combined.map((item) => item.row)
}

/**
 * Genera el markup HTML completo de la vista Inicio
 */
export function renderInicioHtml(rows = []) {
  const metrics = calculateInicioMetrics(rows)
  const attentionItems = getAttentionSubscriptions(rows, 8)
  const { operational, financial } = metrics

  const profitClass = financial.profit >= 0 ? 'profit-positive' : 'profit-negative'

  return `
    <div class="inicio-view">
      <!-- Encabezado de la vista -->
      <section class="hero inicio-hero">
        <div>
          <h2>Inicio</h2>
          <p>Visión general de suscripciones y operaciones del negocio.</p>
        </div>
      </section>

      <!-- Resumen operativo: 4 métricas con criterios de vistas rápidas -->
      <section class="inicio-section" aria-label="Resumen operativo">
        <div class="inicio-section-header">
          <h3 class="inicio-section-title">Resumen operativo</h3>
        </div>
        <div class="inicio-kpi-grid">
          <article class="kpi inicio-kpi-card">
            <span>Total</span>
            <strong class="inicio-kpi-val">${operational.total}</strong>
          </article>
          <article class="kpi inicio-kpi-card ${operational.today > 0 ? 'inicio-kpi-warning' : ''}">
            <span>Vencen hoy</span>
            <strong class="inicio-kpi-val">${operational.today}</strong>
          </article>
          <article class="kpi inicio-kpi-card ${operational.next7 > 0 ? 'inicio-kpi-soon' : ''}">
            <span>Próximos 7 días</span>
            <strong class="inicio-kpi-val">${operational.next7}</strong>
          </article>
          <article class="kpi inicio-kpi-card ${operational.expired > 0 ? 'inicio-kpi-danger' : ''}">
            <span>Vencidas</span>
            <strong class="inicio-kpi-val">${operational.expired}</strong>
          </article>
        </div>
      </section>

      <!-- Resumen financiero: 3 tarjetas con valores de suscripciones actuales -->
      <section class="inicio-section" aria-label="Resumen financiero">
        <div class="inicio-section-header">
          <h3 class="inicio-section-title">Resumen financiero</h3>
          <span class="inicio-section-meta">Suscripciones actuales</span>
        </div>
        <div class="inicio-finance-grid">
          <article class="kpi inicio-kpi-card">
            <span>Ingresos</span>
            <strong class="inicio-kpi-val">${formatMoney(financial.income)}</strong>
          </article>
          <article class="kpi inicio-kpi-card">
            <span>Costos</span>
            <strong class="inicio-kpi-val">${formatMoney(financial.cost)}</strong>
          </article>
          <article class="kpi inicio-kpi-card">
            <span>Ganancia</span>
            <strong class="inicio-kpi-val ${profitClass}">${formatMoney(financial.profit)}</strong>
          </article>
        </div>
      </section>

      <!-- Bloque Requieren atención -->
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
            <svg class="inicio-empty-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <div>
              <strong>Todo al día</strong>
              <p>No hay suscripciones que requieran atención inmediata en este momento.</p>
            </div>
          </div>
        ` : `
          <div class="inicio-attention-list">
            ${attentionItems.map((row) => renderAttentionItemHtml(row)).join('')}
          </div>
        `}
      </section>
    </div>
  `
}

function renderAttentionItemHtml(row) {
  const status = statusFor(row.expiry_date)
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Vence: ${expiry}
          </span>
          <span class="badge badge-${status.tone}">${escapeHtml(status.label)}</span>
        </div>
      </div>
      <div class="inicio-attention-action">
        <button type="button" class="btn btn-small btn-view-sub" data-sub-id="${row.id}" title="Ver suscripción en Gestión">
          Ver
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </article>
  `
}

/**
 * Asocia los eventos interactivos de la vista Inicio:
 * - Al pulsar 'Ver', ejecuta el callback onNavigateToSubscription(rowId)
 */
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
