import { ICONS } from './icons.js'

let activeModalCount = 0

/**
 * Abre un modal accesible estándar con backdrop, foco automático y bloqueo de scroll.
 * 
 * @param {Object} options
 * @param {string} [options.title] - Título en el encabezado
 * @param {string} [options.subtitle] - Subtítulo opcional
 * @param {string|HTMLElement} options.body - Contenido del cuerpo (HTML o nodo)
 * @param {string|HTMLElement} [options.footer] - Botones o acciones del pie
 * @param {'sm'|'md'|'lg'|'full'} [options.size='md'] - Tamaño del modal
 * @param {string} [options.customClass=''] - Clase CSS adicional
 * @param {boolean} [options.closeOnBackdrop=true] - Permitir cerrar al hacer click fuera
 * @param {boolean} [options.closeOnEscape=true] - Permitir cerrar con Escape
 * @param {boolean} [options.showCloseBtn=true] - Mostrar botón X
 * @param {Function} [options.onClose] - Callback al cerrarse
 * @returns {{ el: HTMLElement, backdrop: HTMLElement, close: () => void }}
 */
export function openModal({
  title = '',
  subtitle = '',
  body = '',
  footer = '',
  size = 'md',
  customClass = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseBtn = true,
  onClose = null
}) {
  const host = document.querySelector('#modalHost') || document.body
  const previousActiveElement = document.activeElement

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')

  const card = document.createElement('section')
  card.className = `modal modal-${size} ${customClass}`.trim()

  const head = document.createElement('div')
  head.className = 'modal-head'

  const headText = document.createElement('div')
  if (title) {
    const h3 = document.createElement('h3')
    h3.textContent = title
    headText.appendChild(h3)
  }
  if (subtitle) {
    const p = document.createElement('p')
    p.className = 'modal-subtitle'
    p.textContent = subtitle
    headText.appendChild(p)
  }
  head.appendChild(headText)

  let closeBtn = null
  if (showCloseBtn) {
    closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'btn btn-small btn-ghost modal-close-btn'
    closeBtn.setAttribute('aria-label', 'Cerrar ventana')
    closeBtn.innerHTML = ICONS.close
    head.appendChild(closeBtn)
  }

  const bodyEl = document.createElement('div')
  bodyEl.className = 'modal-body'
  if (typeof body === 'string') {
    bodyEl.innerHTML = body
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body)
  }

  if (title || subtitle || showCloseBtn) {
    card.appendChild(head)
  }
  card.appendChild(bodyEl)

  if (footer) {
    const footEl = document.createElement('div')
    footEl.className = 'modal-actions modal-footer'
    if (typeof footer === 'string') {
      footEl.innerHTML = footer
    } else if (footer instanceof HTMLElement) {
      footEl.appendChild(footer)
    }
    card.appendChild(footEl)
  }

  backdrop.appendChild(card)

  // Bloqueo de scroll global
  activeModalCount++
  if (activeModalCount === 1) {
    document.body.style.overflow = 'hidden'
  }

  let isClosed = false
  const close = () => {
    if (isClosed) return
    isClosed = true

    document.removeEventListener('keydown', handleKey)
    backdrop.classList.add('modal-hiding')

    setTimeout(() => {
      backdrop.remove()
      activeModalCount = Math.max(0, activeModalCount - 1)
      if (activeModalCount === 0) {
        document.body.style.overflow = ''
      }
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus()
      }
      if (typeof onClose === 'function') {
        onClose()
      }
    }, 160)
  }

  const handleKey = (e) => {
    if (closeOnEscape && e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }

    if (e.key === 'Tab') {
      const focusableEls = card.querySelectorAll(
        'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
      )
      if (focusableEls.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = focusableEls[0]
      const lastEl = focusableEls[focusableEls.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !card.contains(document.activeElement)) {
          e.preventDefault()
          lastEl.focus()
        }
      } else {
        if (document.activeElement === lastEl || !card.contains(document.activeElement)) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', close)
  }

  if (closeOnBackdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        close()
      }
    })
  }

  document.addEventListener('keydown', handleKey)
  host.appendChild(backdrop)

  // Auto-focus en el primer campo interactivo
  setTimeout(() => {
    const focusable = card.querySelector('input:not([type="hidden"]), select, textarea, button.btn-primary, button:not(.modal-close-btn)')
    if (focusable) {
      focusable.focus()
    }
  }, 40)

  return { el: card, backdrop, close }
}
