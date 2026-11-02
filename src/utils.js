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
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  const str = String(value).trim()
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const d = new Date(str)
  if (isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function formatDate(value) {
  const d = dateOnly(value)
  if (!d || isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
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

export function daysUntil(value, referenceDate = null) {
  if (!value) return null
  let y, m, d
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    y = value.getFullYear()
    m = value.getMonth()
    d = value.getDate()
  } else {
    const str = String(value).trim()
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      y = Number(match[1])
      m = Number(match[2]) - 1
      d = Number(match[3])
    } else {
      const dt = new Date(str)
      if (isNaN(dt.getTime())) return null
      y = dt.getFullYear()
      m = dt.getMonth()
      d = dt.getDate()
    }
  }

  const now = referenceDate ? (referenceDate instanceof Date ? referenceDate : dateOnly(referenceDate)) : new Date()
  if (!now || isNaN(now.getTime())) return null

  // Usar Date.UTC con las partes locales de año, mes y día para calcular la diferencia
  // exacta de días calendario, independiente de la hora local o conversiones UTC cerca de medianoche.
  const targetUtc = Date.UTC(y, m, d)
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((targetUtc - todayUtc) / 86400000)
}

export function statusFor(value, archived_at = null) {
  if (archived_at) return { key: 'archivado', label: 'Archivado', tone: 'neutral', days: null }
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

export function rowSaleCurrency(row) {
  return normalizeCurrency(row?.sale_price_currency)
}

export function rowCostCurrency(row) {
  return normalizeCurrency(row?.cost_currency)
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text)
}
