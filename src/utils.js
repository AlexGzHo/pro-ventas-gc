export const PEN = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
})

export const USDT = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

export const CURRENCIES = ['PEN', 'USDT']
export const BASE_CURRENCY = 'PEN'

export function normalizeCurrency(value) {
  const code = String(value || '').trim().toUpperCase()
  return CURRENCIES.includes(code) ? code : BASE_CURRENCY
}

export function isUSDT(currency) {
  return normalizeCurrency(currency) === 'USDT'
}

export function formatMoney(value) {
  return PEN.format(Number(value || 0))
}

export function formatUSDT(value) {
  return USDT.format(Number(value || 0))
}

export function formatAmount(value, currency = BASE_CURRENCY) {
  return isUSDT(currency) ? formatUSDT(value) : formatMoney(value)
}

export function currencyLabel(currency) {
  return isUSDT(currency) ? 'USDT' : 'PEN'
}

// Convierte un importe a la moneda base (soles) usando el tipo de cambio
// registrado en la propia operación. Para PEN devuelve el valor sin cambios.
export function amountInPEN(amount, currency, exchangeRate) {
  const value = Number(amount || 0)
  if (!isUSDT(currency)) return value
  const rate = Number(exchangeRate || 0)
  return rate > 0 ? value * rate : value
}

// Convierte un importe en soles a USDT usando un tipo de cambio dado.
// Se usa solo en la vista resumida de gastos en USDT, sin alterar registros.
export function amountInUSDT(amount, currency, exchangeRate) {
  const value = Number(amount || 0)
  if (isUSDT(currency)) return value
  const rate = Number(exchangeRate || 0)
  return rate > 0 ? value / rate : value
}

// Convierte un importe de PEN a USDT en el contexto del form (para autollenar)
export function convertPENToUSDT(amount, exchangeRate) {
  const value = Number(amount || 0)
  const rate = Number(exchangeRate || 0)
  return rate > 0 ? value / rate : 0
}

export function dateOnly(value) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(value) {
  const d = dateOnly(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function daysUntil(value) {
  const target = dateOnly(value)
  if (!target) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

export function statusFor(value) {
  const days = daysUntil(value)
  if (days === null) return { key: 'sin-fecha', label: 'Sin fecha', tone: 'neutral', days }
  if (days < 0) return { key: 'vencido', label: `Vencido hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`, tone: 'danger', days }
  if (days === 0) return { key: 'hoy', label: 'Vence hoy', tone: 'warning', days }
  if (days <= 3) return { key: 'proximo', label: `Quedan ${days} día${days === 1 ? '' : 's'}`, tone: 'warning', days }
  return { key: 'activo', label: `Quedan ${days} días`, tone: 'success', days }
}


export function addPeriod(expiry, { days = 0, months = 0 } = {}) {
  const base = dateOnly(expiry)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = !base || base < today ? today : base

  const result = new Date(start)

  if (months) {
    const originalDay = result.getDate()
    result.setDate(1)
    result.setMonth(result.getMonth() + months)
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
    result.setDate(Math.min(originalDay, lastDay))
  }

  if (days) result.setDate(result.getDate() + days)

  return toISODate(result)
}

export function addOneMonth(expiry) {
  const base = dateOnly(expiry)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = !base || base < today ? today : base

  const originalDay = start.getDate()
  const result = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(originalDay, lastDay))
  return toISODate(result)
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text)
}
