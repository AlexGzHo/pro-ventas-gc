import { formatDate, daysUntil, formatAmount, normalizeCurrency } from './utils.js'

export const templates = {
  reminder: '*MENSAJE RECORDATORIO 🚨*\n\nHola, *{{cliente}}*.\nTu membresía de *{{servicio}}* {{dias}}.\n📅 Vence: *{{vencimiento}}*.',
  credentials: '✅ *{{servicio}}*\n📧 Usuario / correo: *{{usuario}}*\n🔐 Contraseña: *{{contrasena}}*\n👤 Perfil: *{{perfil}}*\n🔢 PIN: *{{pin}}*\n🔗 URL: {{url}}\n📅 Vence: *{{vencimiento}}*\n{{extras}}',
  update: '✅ *ACTUALIZACIÓN DE DATOS | {{servicio}}*\n📧 Usuario / correo: *{{usuario}}*\n🔐 Contraseña: *{{contrasena}}*\n👤 Perfil: *{{perfil}}*\n🔢 PIN: *{{pin}}*\n🔗 URL: {{url}}'
}

export const defaultTemplates = { ...templates }

export function setTemplates(newTemplates) {
  if (newTemplates.reminder) templates.reminder = newTemplates.reminder
  if (newTemplates.credentials) templates.credentials = newTemplates.credentials
  if (newTemplates.update) templates.update = newTemplates.update
}

export function parseWhatsAppContact(input = '') {
  if (input === null || input === undefined) return null
  let trimmed = String(input).trim()
  if (!trimmed) return null

  const EMPTY_PLACEHOLDERS = ['sin celular', 'sin telefono', 'sin contacto', 'no tiene', 'ninguno', 'n/a', 'na', '-', '--', 'null', 'undefined']
  if (EMPTY_PLACEHOLDERS.includes(trimmed.toLowerCase())) return null

  // Strip URL prefixes if pasted
  trimmed = trimmed.replace(/^(https?:\/\/)?(www\.)?wa\.me\//i, '')
  trimmed = trimmed.replace(/^(https?:\/\/)?api\.whatsapp\.com\/send\/?\?(phone=)?/i, '')
  trimmed = trimmed.split('?')[0].trim()

  if (!trimmed) return null

  // 1. Explicit username starting with @
  if (trimmed.startsWith('@')) {
    const usernameBody = trimmed.replace(/^@+/, '').trim()
    const isValid = /^[a-zA-Z0-9._]{3,30}$/.test(usernameBody)
    const clean = usernameBody
    return {
      type: 'username',
      raw: input,
      clean,
      value: `@${clean}`,
      isValid,
      error: isValid ? null : 'El usuario de WhatsApp debe tener entre 3 y 30 caracteres alfanuméricos, puntos o guiones bajos (sin espacios).'
    }
  }

  // 2. Contains letters -> username entered without @
  if (/[a-zA-Z]/.test(trimmed)) {
    const isValid = /^[a-zA-Z0-9._]{3,30}$/.test(trimmed)
    const clean = trimmed
    return {
      type: 'username',
      raw: input,
      clean,
      value: `@${clean}`,
      isValid,
      error: isValid ? null : 'El usuario de WhatsApp debe tener entre 3 y 30 caracteres alfanuméricos, puntos o guiones bajos (sin espacios).'
    }
  }

  // 3. Phone number
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) {
    return {
      type: 'phone',
      raw: input,
      clean: '',
      value: '',
      isValid: false,
      error: 'El número de teléfono no contiene dígitos válidos.'
    }
  }

  if (digits.startsWith('0051')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  // 9 digits local Peruvian mobile -> prefix 51
  if (digits.length === 9) {
    digits = `51${digits}`
  }

  const isValid = digits.length >= 7 && digits.length <= 15
  return {
    type: 'phone',
    raw: input,
    clean: digits,
    value: digits,
    isValid,
    error: isValid ? null : 'El número telefónico debe tener entre 7 y 15 dígitos.'
  }
}

export function normalizeWhatsAppContact(input = '') {
  const parsed = parseWhatsAppContact(input)
  if (!parsed || !parsed.isValid) return ''
  return parsed.value
}

export function normalizePhone(phone = '') {
  const parsed = parseWhatsAppContact(phone)
  if (parsed && parsed.type === 'phone' && parsed.isValid) {
    return parsed.clean
  }
  let clean = String(phone).replace(/\D/g, '')
  if (!clean) return ''
  if (clean.startsWith('0051')) clean = clean.slice(2)
  if (clean.length === 9) clean = `51${clean}`
  return clean
}

export function getWhatsAppUrl(contact = '', message = '') {
  const parsed = parseWhatsAppContact(contact)
  if (!parsed || !parsed.isValid) return ''
  const base = `https://wa.me/${parsed.clean}`
  if (!message) return base

  const sanitized = String(message)
    .replace(/\uFFFD/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .normalize('NFC')

  return `${base}?text=${encodeURIComponent(sanitized)}`
}


function serviceTitle(row) {
  return String(row.service || 'SERVICIO').trim().toUpperCase()
}

export function formatExpirationStatus(days) {
  if (days === null || days === undefined || isNaN(days)) return 'sin fecha definida'
  if (days > 1) return `vence en ${days} días`
  if (days === 1) return 'vence mañana'
  if (days === 0) return 'vence hoy'
  if (days === -1) return 'venció ayer'
  return `venció hace ${Math.abs(days)} días`
}

export function formatDaysLeft(days, expiry_date) {
  return formatExpirationStatus(days)
}

export function interpolateTemplate(templateStr, row) {
  if (!templateStr) return ''

  const days = daysUntil(row.expiry_date)
  const expirationText = formatExpirationStatus(days)
  const daysNumber = days !== null && !isNaN(days) ? Math.abs(days) : ''

  const dict = {
    cliente: row.client_name || 'cliente',
    servicio: serviceTitle(row),
    vencimiento: formatDate(row.expiry_date),
    dias: expirationText,
    dias_numero: daysNumber,
    estado_vencimiento: expirationText,
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

  let result = String(templateStr)

  // 1. Limpieza preventiva de caracteres de sustitución o espacios no separables en la plantilla
  result = result.replace(/\uFFFD/g, '').replace(/[\u00A0\u202F]/g, ' ')

  // 2. Prevenir concatenaciones incompatibles si la plantilla guardada contiene frases heredadas
  // como "Te quedan *{{dias}}* de tu membresía de *{{servicio}}*" o "Te quedan {{dias}}"
  result = result
    .replace(/(?:[Tt]e quedan|[Tt]e queda)\s+(\*?\{\{dias\}\}\*?)\s+de tu membresía(?:\s+de\s+(\*?\{\{servicio\}\}\*?))?/gi, (match, pDias, pServicio) => {
      if (pServicio) {
        return `Tu membresía de ${pServicio} ${pDias}`
      }
      return `Tu membresía ${pDias}`
    })
    .replace(/(?:[Tt]e quedan|[Tt]e queda)\s+(\*?\{\{dias\}\}\*?)/gi, (match, pDias) => pDias)

  // 3. Reemplazo seguro de variables usando función para evitar problemas con '$' en contraseñas o importes
  for (const [k, v] of Object.entries(dict)) {
    const safeVal = String(v ?? '')
      .replace(/\uFFFD/g, '')
      .replace(/[\u00A0\u202F]/g, ' ')
    result = result.replace(new RegExp(`{{${k}}}`, 'g'), () => safeVal)
  }

  // 4. Limpieza de líneas vacías excesivas conservando saltos intencionados
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

export function openWhatsApp(rowOrContact, message = '') {
  const rawContact = typeof rowOrContact === 'string'
    ? rowOrContact
    : (rowOrContact?.phone || rowOrContact?.whatsapp || '')

  const parsed = parseWhatsAppContact(rawContact)
  if (!parsed) {
    throw new Error('Este registro no tiene un contacto de WhatsApp válido.')
  }
  if (!parsed.isValid) {
    throw new Error(parsed.error || 'El contacto de WhatsApp no es válido.')
  }

  const cleanMessage = String(message || '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .normalize('NFC')

  const url = getWhatsAppUrl(parsed.value, cleanMessage)
  if (!url) {
    throw new Error('No se pudo generar el enlace de WhatsApp.')
  }

  // Pre-load clipboard if sending a template message to a username as fallback
  let copied = false
  if (parsed.type === 'username' && cleanMessage && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(cleanMessage).catch(() => {})
    copied = true
  }

  window.open(url, '_blank', 'noopener,noreferrer')
  return { url, type: parsed.type, copied }
}
