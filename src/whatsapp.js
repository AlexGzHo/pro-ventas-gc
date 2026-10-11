import { formatDate, daysUntil, formatAmount, normalizeCurrency } from './utils.js'

export const templates = {
  reminder: '*MENSAJE RECORDATORIO 🚨*\n\nHola, *{{cliente}}*.\nTe quedan *{{dias}}* de tu membresía de *{{servicio}}*.\n📅 Vence: *{{vencimiento}}*.',
  credentials: '✅ *{{servicio}}*\n📧 Usuario / correo: *{{usuario}}*\n🔐 Contraseña: *{{contrasena}}*\n👤 Perfil: *{{perfil}}*\n🔢 PIN: *{{pin}}*\n🔗 URL: {{url}}\n📅 Vence: *{{vencimiento}}*\n{{extras}}',
  update: '✅ *ACTUALIZACIÓN DE DATOS | {{servicio}}*\n📧 Usuario / correo: *{{usuario}}*\n🔐 Contraseña: *{{contrasena}}*\n👤 Perfil: *{{perfil}}*\n🔢 PIN: *{{pin}}*\n🔗 URL: {{url}}'
}

export const defaultTemplates = { ...templates }

export function setTemplates(newTemplates) {
  if (newTemplates.reminder) templates.reminder = newTemplates.reminder
  if (newTemplates.credentials) templates.credentials = newTemplates.credentials
  if (newTemplates.update) templates.update = newTemplates.update
}

export function normalizePhone(phone = '') {
  let clean = String(phone).replace(/\D/g, '')
  if (!clean) return ''
  if (clean.startsWith('0051')) clean = clean.slice(2)
  if (clean.length === 9) clean = `51${clean}`
  return clean
}

function serviceTitle(row) {
  return String(row.service || 'SERVICIO').trim().toUpperCase()
}

function formatDaysLeft(days, expiry_date) {
  if (days === null) return 'sin fecha definida'
  if (days < 0) return `venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'vence hoy'
  if (days === 1) return '1 día'
  return `${days} días`
}

export function interpolateTemplate(templateStr, row) {
  const days = daysUntil(row.expiry_date)
  const dict = {
    cliente: row.client_name || 'cliente',
    servicio: serviceTitle(row),
    vencimiento: formatDate(row.expiry_date),
    dias: formatDaysLeft(days, row.expiry_date),
    importe: row.sale_price !== undefined ? formatAmount(row.sale_price, normalizeCurrency(row.sale_price_currency)) : '',
    usuario: row.username_email || '',
    contrasena: row.password || '',
    perfil: row.profile || '',
    pin: row.pin || '',
    url: row.access_url || ''
  }

  // Build extras
  const extrasObj = row.extras && typeof row.extras === 'object' ? row.extras : {}
  const extrasArr = []
  for (const [key, value] of Object.entries(extrasObj)) {
    if (value !== '' && value !== null && value !== undefined) {
      extrasArr.push(`${key}: ${value}`)
    }
  }
  dict.extras = extrasArr.join('\n')

  let result = templateStr
  for (const [k, v] of Object.entries(dict)) {
    result = result.replace(new RegExp(`{{${k}}}`, 'g'), v)
  }

  // Clean up empty lines that might have been left by empty variables (like extras or url)
  return result.split('\n').filter(line => line.trim() !== '' || line === '').join('\n')
}

export function credentialsText(row) {
  return interpolateTemplate(templates.credentials, row)
}

export function reminderText(row) {
  // If no date or expired, we might want to fallback to a simpler text if the user relies on old behavior,
  // but using the interpolated template is what we want for dynamic templates.
  return interpolateTemplate(templates.reminder, row)
}

export function updateText(row) {
  return interpolateTemplate(templates.update, row)
}

export function credentialsPlain(row) {
  const parts = [serviceTitle(row)]

  if (row.username_email) parts.push(`Usuario / correo: ${row.username_email}`)
  if (row.password) parts.push(`Contraseña: ${row.password}`)
  if (row.profile) parts.push(`Perfil: ${row.profile}`)
  if (row.pin) parts.push(`PIN: ${row.pin}`)
  if (row.access_url) parts.push(`URL: ${row.access_url}`)
  if (row.expiry_date) parts.push(`Vence: ${formatDate(row.expiry_date)}`)

  const extras = row.extras && typeof row.extras === 'object' ? row.extras : {}
  for (const [key, value] of Object.entries(extras)) {
    if (value !== '' && value !== null && value !== undefined) {
      parts.push(`${key}: ${value}`)
    }
  }

  return parts.join('\n')
}

export function openWhatsApp(row, message) {
  const phone = normalizePhone(row.phone)
  if (!phone) throw new Error('Este registro no tiene un número de celular válido.')
  if (!/^51\d{9}$/.test(phone)) throw new Error('El número de celular no es válido.')
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
