import { openOverlay } from './overlay.js'

/** Consulta lateral: 440 px en escritorio y pantalla completa en móvil. */
export function openPanel({ title = '', subtitle = '', body = '', footer = '', onClose = null }) {
  const { el, close } = openOverlay({ kind: 'panel', title, subtitle, body, footer, onClose })
  return { el, close }
}
