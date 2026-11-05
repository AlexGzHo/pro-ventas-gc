import {
  state,
  reloadProviders,
  reloadProducts,
  reloadClients,
  onRowsLoaded
} from './state.js'
import { toast } from './ui/toast.js'
import { confirmModal, alertModal } from './ui/confirm.js'
import { mountInicioView } from './views/inicio.js'
import { renderSubscriptionsSection, renderData } from './views/suscripciones.js'
import { mountClientesView } from './views/clientes.js'
import { mountProductosView } from './views/productos.js'
import { mountProveedoresView } from './views/proveedores.js'
import { mountWhatsappTemplatesView } from './views/whatsappTemplates.js'
import { openSubscriptionForm } from './features/subscriptionForm.js'
import { closeAllOverlays } from './ui/overlay.js'

const FORM_HASHES = ['#nueva-suscripcion', '#nueva', '#editar-suscripcion', '#editar']

function openLegacyFormHash() {
  const hash = window.location.hash.toLowerCase()
  if (!FORM_HASHES.includes(hash)) return
  const editingRow = hash === '#editar-suscripcion' || hash === '#editar'
    ? state.editingRowData : null
  // La URL base pertenece a la lista; el modal añade su propia entrada al historial.
  history.replaceState(history.state, '', '#suscripciones')
  void openSubscriptionForm(editingRow)
}

export const ROUTES = {
  inicio: {
    hash: '#inicio',
    aliases: ['', '#', '#/', '#inicio'],
    mount: (container) => {
      mountInicioView(container, state.rows, {
        onNavigateToSubscription: (rowId) => goToSubscription(rowId)
      })
    }
  },
  subscriptions: {
    hash: '#suscripciones',
    aliases: ['#suscripciones', '#subscriptions', ...FORM_HASHES],
    mount: (container) => {
      renderSubscriptionsSection(container)
    }
  },
  clientes: {
    hash: '#clientes',
    aliases: ['#clientes'],
    mount: (container) => {
      mountClientesView(container, {
        toast,
        confirmModal,
        alertModal,
        onClientsChanged: reloadClients,
        onNavigateToSubscription: (rowId) => goToSubscription(rowId)
      })
    }
  },
  productos: {
    hash: '#productos',
    aliases: ['#productos', '#catalogo'],
    mount: (container) => {
      mountProductosView(container, {
        toast,
        confirmModal,
        alertModal,
        products: state.products,
        providers: state.providers,
        onProductsChanged: reloadProducts
      })
    }
  },
  proveedores: {
    hash: '#proveedores',
    aliases: ['#proveedores'],
    mount: (container) => {
      mountProveedoresView(container, {
        toast,
        confirmModal,
        alertModal,
        onProvidersChanged: reloadProviders
      })
    }
  },
  whatsappTemplates: {
    hash: '#whatsapp-templates',
    aliases: ['#whatsapp-templates', '#whatsapp', '#plantillas'],
    mount: (container) => {
      mountWhatsappTemplatesView(container, { toast, confirmModal, alertModal })
    }
  }
}

export function findSectionByHash(hash) {
  const norm = String(hash || '').toLowerCase().trim()
  for (const [sectionKey, route] of Object.entries(ROUTES)) {
    if (route.aliases.includes(norm)) {
      return sectionKey
    }
    const defaultHash = typeof route.hash === 'function' ? route.hash() : route.hash
    if (defaultHash.toLowerCase() === norm) {
      return sectionKey
    }
  }
  return 'inicio'
}

export function updateSidebarActiveNav() {
  document.querySelectorAll('#appSidebar .nav-item').forEach((item) => {
    const isTarget = item.dataset.nav === state.currentSection

    item.classList.toggle('active', isTarget)
    if (isTarget) {
      item.setAttribute('aria-current', 'page')
    } else {
      item.removeAttribute('aria-current')
    }
  })
}

export function renderCurrentSection() {
  const container = document.querySelector('#sectionContainer') || document.querySelector('#mainContent')
  if (!container) return

  const route = ROUTES[state.currentSection] || ROUTES.inicio
  route.mount(container)
  openLegacyFormHash()
}

export function navigateToSection(sectionName, updateHash = true) {
  if (state.currentSection === sectionName && !state.highlightRowId) {
    openLegacyFormHash()
    return
  }
  const closingOverlays = closeAllOverlays()
  if (closingOverlays) {
    return closingOverlays.then(() => navigateToSection(sectionName, updateHash))
  }
  state.currentSection = sectionName

  if (updateHash) {
    const route = ROUTES[sectionName]
    const targetHash = route
      ? (typeof route.hash === 'function' ? route.hash() : route.hash)
      : '#inicio'

    if (window.location.hash !== targetHash) {
      history.replaceState(null, '', targetHash)
    }
  }

  updateSidebarActiveNav()
  renderCurrentSection()
}

/**
 * Reemplaza el bloque duplicado "reset filters + highlightRowId + navigate"
 */
export function goToSubscription(rowId) {
  state.highlightRowId = rowId
  state.filters.search = ''
  state.filters.service = 'TODOS'
  state.filters.status = 'TODOS'
  state.filters.owner = 'TODOS'
  state.filters.quickView = 'all'
  navigateToSection('subscriptions')
}

let routerInitialized = false

export function setupRouter() {
  if (routerInitialized) return
  routerInitialized = true

  window.addEventListener('hashchange', () => {
    const section = findSectionByHash(window.location.hash)
    navigateToSection(section, false)
  })

  // Re-render reactivo ante actualizaciones en los registros
  onRowsLoaded(() => {
    if (state.currentSection === 'subscriptions') {
      renderData()
    } else if (state.currentSection === 'inicio') {
      renderCurrentSection()
    }
  })
}
