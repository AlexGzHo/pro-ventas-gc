import { ICONS } from './icons.js'

// Un gestor único evita que Escape/Tab o «atrás» alcancen dos diálogos anidados.
const overlays = []
const inertBeforeOpen = new Map()
let closingThroughHistory = false
let nextId = 0
let closeAllPromise = null
let resolveCloseAll = null

function historyIds() {
  return Array.isArray(history.state?.pvOverlays) ? history.state.pvOverlays : []
}

function stateWithIds(ids) {
  const next = { ...(history.state || {}) }
  if (ids.length) next.pvOverlays = ids
  else delete next.pvOverlays
  return next
}

function focusableElements(card) {
  return [...card.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
  )].filter(el => el.getClientRects().length && !el.closest('[inert], [hidden], [aria-hidden="true"]'))
}

function updateInert() {
  for (const [el, wasInert] of inertBeforeOpen) el.inert = wasInert
  const top = overlays.at(-1)
  if (!top) {
    inertBeforeOpen.clear()
    document.body.classList.remove('overlay-open')
    return
  }
  document.body.classList.add('overlay-open')
  // También sirve si modalHost está dentro del shell.
  let current = top.backdrop
  while (current.parentElement) {
    for (const sibling of current.parentElement.children) {
      if (sibling === current) continue
      if (!inertBeforeOpen.has(sibling)) inertBeforeOpen.set(sibling, sibling.inert)
      sibling.inert = true
    }
    current = current.parentElement
    if (current === document.body) break
  }
}

function removeOverlay(entry, restoreFocus = true) {
  const index = overlays.indexOf(entry)
  if (index < 0) return
  overlays.splice(index, 1)
  entry.backdrop.remove()
  updateInert()
  if (restoreFocus) {
    const previous = entry.previousActiveElement
    if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
    else overlays.at(-1)?.card.focus({ preventScroll: true })
  }
  entry.onClose?.()
}

window.addEventListener('popstate', () => {
  closingThroughHistory = false
  const resolveNavigation = resolveCloseAll
  closeAllPromise = null
  resolveCloseAll = null
  const ids = historyIds()
  for (const entry of [...overlays].reverse()) {
    if (!ids.includes(entry.id)) removeOverlay(entry)
  }
  // Avanzar o recargar no reconstruye formularios que ya fueron cerrados.
  const activeIds = overlays.map(entry => entry.id)
  if (ids.some(id => !activeIds.includes(id))) {
    history.replaceState(stateWithIds(activeIds), '', window.location.href)
  }
  resolveNavigation?.()
})

document.addEventListener('keydown', event => {
  const top = overlays.at(-1)
  if (!top) return
  if (event.key === 'Escape' && top.closeOnEscape) {
    event.preventDefault()
    event.stopImmediatePropagation()
    top.close()
    return
  }
  if (event.key !== 'Tab') return
  const elements = focusableElements(top.card)
  const first = elements[0]
  const last = elements.at(-1)
  if (!first) {
    event.preventDefault()
    top.card.focus()
  } else if (event.shiftKey && (document.activeElement === first || !top.card.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !top.card.contains(document.activeElement))) {
    event.preventDefault()
    first.focus()
  }
})

/** Cierra overlays al cambiar de sección sin modificar datos. */
export function closeAllOverlays() {
  if (!overlays.length) return null
  if (closeAllPromise) return closeAllPromise
  const ids = historyIds()
  const firstPosition = ids.indexOf(overlays[0].id)
  if (closingThroughHistory || firstPosition >= 0) {
    closeAllPromise = new Promise(resolve => { resolveCloseAll = resolve })
    if (!closingThroughHistory) {
      closingThroughHistory = true
      history.go(-(ids.length - firstPosition))
    }
    return closeAllPromise
  }
  for (const entry of [...overlays].reverse()) removeOverlay(entry, false)
  history.replaceState(stateWithIds([]), '', window.location.href)
  return null
}

function appendContent(parent, content) {
  if (typeof content === 'string') parent.innerHTML = content
  else if (content instanceof HTMLElement) parent.appendChild(content)
}

/** Infraestructura compartida; los consumidores usan openModal/openPanel. */
export function openOverlay({
  kind = 'modal', title = '', subtitle = '', body = '', footer = '',
  size = 'md', customClass = '', closeOnBackdrop = true,
  closeOnEscape = true, showCloseBtn = true, onClose = null
}) {
  const previousActiveElement = document.activeElement
  const host = document.querySelector('#modalHost') || document.body
  const id = `pv-overlay-${Date.now()}-${++nextId}`
  const backdrop = document.createElement('div')
  backdrop.className = `${kind}-backdrop`
  const card = document.createElement('section')
  card.className = `${kind} ${kind === 'modal' ? `modal-${size}` : ''} ${customClass}`.trim()
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-modal', 'true')
  card.setAttribute('tabindex', '-1')

  const head = document.createElement('div')
  head.className = `${kind}-head`
  const headText = document.createElement('div')
  const heading = document.createElement('h3')
  heading.id = `${id}-title`
  heading.textContent = title || 'Confirmación'
  if (!title) heading.className = 'sr-only'
  headText.appendChild(heading)
  card.setAttribute('aria-labelledby', heading.id)
  if (subtitle) {
    const sub = document.createElement('p')
    sub.className = `${kind}-subtitle`
    sub.textContent = subtitle
    headText.appendChild(sub)
  }
  head.appendChild(headText)
  card.appendChild(head)

  const bodyEl = document.createElement('div')
  bodyEl.className = `${kind}-body`
  appendContent(bodyEl, body)
  card.appendChild(bodyEl)
  // Las confirmaciones ya tienen su título visual dentro del cuerpo.
  if (!title) {
    const bodyHeading = bodyEl.querySelector('h1, h2, h3')
    if (bodyHeading) {
      bodyHeading.id ||= `${id}-body-title`
      card.setAttribute('aria-labelledby', bodyHeading.id)
    }
  }

  if (footer) {
    const foot = document.createElement('div')
    foot.className = kind === 'modal' ? 'modal-actions modal-footer' : 'panel-footer'
    appendContent(foot, footer)
    card.appendChild(foot)
  }
  backdrop.appendChild(card)

  const entry = { id, card, backdrop, previousActiveElement, closeOnEscape, onClose, close: null }
  const close = () => {
    if (!overlays.includes(entry) || closingThroughHistory) return
    const ids = historyIds()
    const position = ids.indexOf(entry.id)
    if (position >= 0 && ids.at(-1) === overlays.at(-1)?.id) {
      closingThroughHistory = true
      history.go(-(ids.length - position))
    } else {
      removeOverlay(entry)
    }
  }
  entry.close = close

  if (showCloseBtn) {
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = `btn btn-ghost ${kind}-close-btn`
    closeBtn.setAttribute('aria-label', 'Cerrar ventana')
    closeBtn.innerHTML = ICONS.close
    closeBtn.addEventListener('click', close)
    head.appendChild(closeBtn)
  }
  if (closeOnBackdrop) {
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop && overlays.at(-1) === entry) close()
    })
  }

  overlays.push(entry)
  host.appendChild(backdrop)
  updateInert()
  history.pushState(stateWithIds(overlays.map(item => item.id)), '', window.location.href)
  // Enfoque síncrono para no competir con confirmDialog, que enfoca Cancelar.
  const firstControl = focusableElements(card).find(el => !el.classList.contains(`${kind}-close-btn`))
  ;(firstControl || card).focus({ preventScroll: true })
  return { el: card, backdrop, close }
}
