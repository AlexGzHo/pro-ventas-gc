import { openOverlay } from './overlay.js'

/**
 * Modal accesible. sm = 420 px; md = 560 px. lg/full son alias de md.
 * Encabezado y pie fijos, cuerpo desplazable y pantalla completa en móvil.
 * Conserva el contrato histórico { el, backdrop, close }.
 */
export function openModal(options = {}) {
  return openOverlay({
    ...options,
    kind: 'modal',
    size: options.size === 'sm' ? 'sm' : 'md'
  })
}
