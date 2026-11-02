import { openModal } from './modal.js'
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

/**
 * Muestra un diálogo de confirmación accesible con Promise<boolean>.
 * 
 * @param {Object} options
 * @param {string} [options.title='¿Confirmar acción?']
 * @param {string} [options.message='']
 * @param {string} [options.confirmText='Confirmar']
 * @param {string} [options.cancelText='Cancelar']
 * @param {boolean} [options.danger=false]
 * @param {boolean} [options.isDanger=false] - Alias de danger
 * @param {'danger'|'warning'|'info'} [options.icon]
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title = '¿Confirmar acción?',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
  isDanger = false,
  icon = null
}) {
  const destructive = danger || isDanger
  const iconType = icon || (destructive ? 'danger' : 'info')
  const iconSvg = iconType === 'danger' ? ICONS.error : (iconType === 'warning' ? ICONS.warning : ICONS.info)

  const formattedMessage = message.includes('<')
    ? message
    : message.split('\n\n').map(p => `<p>${escapeHtmlText(p).replace(/\n/g, '<br>')}</p>`).join('')

  return new Promise((resolve) => {
    let resolved = false

    const handleResult = (val) => {
      if (resolved) return
      resolved = true
      modal.close()
      resolve(val)
    }

    const bodyHtml = `
      <div class="confirm-modal-header">
        <div class="confirm-modal-icon-badge ${iconType}">
          ${iconSvg}
        </div>
        <div class="confirm-modal-header-text">
          <h3 class="confirm-modal-title">${escapeHtmlText(title)}</h3>
        </div>
      </div>
      <div class="confirm-modal-body">
        ${formattedMessage}
      </div>
    `

    const footerHtml = `
      <div class="confirm-modal-actions">
        ${cancelText ? `<button type="button" class="btn btn-small btn-ghost confirm-cancel-btn">${escapeHtmlText(cancelText)}</button>` : ''}
        <button type="button" class="btn btn-small ${destructive ? 'btn-danger' : 'btn-primary'} confirm-submit-btn">${escapeHtmlText(confirmText)}</button>
      </div>
    `

    const modal = openModal({
      title: '',
      body: bodyHtml,
      footer: footerHtml,
      size: 'sm',
      customClass: 'confirm-modal-card',
      showCloseBtn: false,
      onClose: () => {
        if (!resolved) {
          resolved = true
          resolve(false)
        }
      }
    })

    const cancelBtn = modal.el.querySelector('.confirm-cancel-btn')
    const submitBtn = modal.el.querySelector('.confirm-submit-btn')

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => handleResult(false))
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', () => handleResult(true))
    }

    // Si es destructivo, enfocar el botón Cancelar por seguridad; si no, Confirmar
    setTimeout(() => {
      if (destructive && cancelBtn) {
        cancelBtn.focus()
      } else if (submitBtn) {
        submitBtn.focus()
      }
    }, 50)
  })
}

// Aliases para retrocompatibilidad total con código existente
export const confirmModal = confirmDialog

/**
 * Diálogo de aviso / alerta que no bloquea la interfaz nativa.
 */
export function alertDialog({
  title = 'Aviso',
  message = '',
  buttonText = 'Entendido',
  type = 'info'
}) {
  return confirmDialog({
    title,
    message,
    confirmText: buttonText,
    cancelText: '',
    danger: type === 'error',
    icon: type
  }).then(() => {})
}

export const alertModal = alertDialog
