import { ICONS } from './icons.js'

function escapeHtmlText(str) {
  if (typeof str !== 'string') return String(str ?? '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

let lastToastMessage = null
let lastToastTime = 0

/**
 * Muestra una notificación emergente toast no intrusiva.
 * 
 * @param {string} message - Mensaje a mostrar
 * @param {'ok'|'success'|'error'|'warning'|'info'} [type='ok'] - Tipo de notificación
 * @param {number} [duration=3200] - Duración en ms
 * @returns {HTMLElement|undefined}
 */
export function toast(message, type = 'ok', duration = 3200) {
  if (!message) return

  // Evitar duplicados seguidos en menos de 1.2 segundos
  const now = Date.now()
  if (lastToastMessage === message && now - lastToastTime < 1200) {
    return
  }
  lastToastMessage = message
  lastToastTime = now

  let area = document.querySelector('.toast-area')
  if (!area) {
    area = document.createElement('div')
    area.className = 'toast-area'
    area.setAttribute('role', 'region')
    area.setAttribute('aria-label', 'Notificaciones')
    document.body.append(area)
  }

  const normalizedType = type === 'success' ? 'ok' : type
  const iconSvg = ICONS[normalizedType] || ICONS.ok

  const el = document.createElement('div')
  el.className = `toast ${normalizedType}`
  el.setAttribute('role', 'alert')
  el.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <div class="toast-message">${escapeHtmlText(message)}</div>
    <button type="button" class="toast-close" aria-label="Cerrar notificación">${ICONS.close}</button>
  `

  const closeBtn = el.querySelector('.toast-close')
  const dismiss = () => {
    if (el.dataset.dismissed) return
    el.dataset.dismissed = 'true'
    el.classList.add('toast-hiding')
    setTimeout(() => el.remove(), 200)
  }

  closeBtn.addEventListener('click', dismiss)
  area.append(el)

  if (duration > 0) {
    setTimeout(dismiss, duration)
  }

  return el
}


