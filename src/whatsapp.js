import { formatDate, daysUntil } from './utils.js'

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

export function credentialsText(row) {
  const parts = [`✅ *${serviceTitle(row)}*`]

  if (row.username_email) parts.push(`📧 Usuario / correo: *${row.username_email}*`)
  if (row.password) parts.push(`🔐 Contraseña: *${row.password}*`)
  if (row.profile) parts.push(`👤 Perfil: *${row.profile}*`)
  if (row.pin) parts.push(`🔢 PIN: *${row.pin}*`)
  if (row.access_url) parts.push(`🔗 URL: ${row.access_url}`)
  if (row.expiry_date) parts.push(`📅 Vence: *${formatDate(row.expiry_date)}*`)

  const extras = row.extras && typeof row.extras === 'object' ? row.extras : {}
  for (const [key, value] of Object.entries(extras)) {
    if (value !== '' && value !== null && value !== undefined) {
      parts.push(`${key}: ${value}`)
    }
  }

  return parts.join('\n')
}

export function reminderText(row) {
  const days = daysUntil(row.expiry_date)
  const client = row.client_name || 'cliente'
  const service = serviceTitle(row)

  if (days === null) {
    return `Hola, *${client}*.\n\nTe escribimos por tu servicio de *${service}*.`
  }

  if (days <= 0) {
    return `🚨 Hola, *${client}*.\n\nTu membresía de *${service}* venció${row.expiry_date ? ` el ${formatDate(row.expiry_date)}` : ''}.\nSi deseas renovar, envía la captura del pago realizado.\n\nMuchas gracias 🫱🏼‍🫲🏼`
  }

  return `*MENSAJE RECORDATORIO 🚨*\n\nHola, *${client}*.\nTe quedan *${days} día${days === 1 ? '' : 's'}* de tu membresía de *${service}*.\n📅 Vence: *${formatDate(row.expiry_date)}*.`
}

export function updateText(row) {
  const lines = [`✅ *ACTUALIZACIÓN DE DATOS | ${serviceTitle(row)}*`]
  if (row.username_email) lines.push(`📧 Usuario / correo: *${row.username_email}*`)
  if (row.password) lines.push(`🔐 Contraseña: *${row.password}*`)
  if (row.profile) lines.push(`👤 Perfil: *${row.profile}*`)
  if (row.pin) lines.push(`🔢 PIN: *${row.pin}*`)
  if (row.access_url) lines.push(`🔗 URL: ${row.access_url}`)
  return lines.join('\n')
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
