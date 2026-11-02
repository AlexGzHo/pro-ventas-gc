import './styles/index.css'
import { supabase, isConfigured } from './supabase.js'
import {
  state,
  loadRows,
  ownerNameForSession,
  invalidateServiceCache
} from './state.js'
import { configScreen, loginScreen, newPasswordScreen } from './auth.js'
import { renderShellMarkup, initShell } from './shell.js'
import {
  setupRouter,
  navigateToSection,
  findSectionByHash,
  renderCurrentSection
} from './router.js'
import { openSubscriptionForm } from './features/subscriptionForm.js'
import { setTemplates } from './whatsapp.js'

const root = document.querySelector('#app')

// Cierre global de dropdowns de tarjetas al pulsar fuera o Escape
const closeCardDropdowns = () => {
  document.querySelectorAll('.card-dropdown:not(.hidden)').forEach((d) => {
    d.classList.add('hidden')
    const pb = d.closest('.card-menu-wrap')?.querySelector('.card-menu-btn')
    if (pb) pb.setAttribute('aria-expanded', 'false')
  })
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.card-menu-wrap')) closeCardDropdowns()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCardDropdowns()
})

async function loadWhatsAppTemplates() {
  try {
    const { data, error } = await supabase.from('whatsapp_templates').select('id, content')
    if (error) {
      console.error('Error loading templates:', error)
      return
    }
    const newTemplates = {}
    if (data) {
      data.forEach((item) => {
        newTemplates[item.id] = item.content
      })
    }
    setTemplates(newTemplates)
  } catch (err) {
    console.error('Failed to load templates:', err)
  }
}

export function appShell() {
  const initialSection = findSectionByHash(window.location.hash)
  state.currentSection = initialSection

  root.innerHTML = renderShellMarkup({
    userName: ownerNameForSession(state.session),
    contentHtml: '<div id="sectionContainer"></div>',
    activeNav: initialSection,
  })

  initShell({
    onLogout: () => supabase.auth.signOut(),
    onNavigate: (navKey) => {
      navigateToSection(navKey)
    },
    onNewSubscription: () => {
      openSubscriptionForm()
    }
  })

  setupRouter()
  renderCurrentSection()
}

async function boot() {
  if (!isConfigured) return configScreen(root)

  const isRecoveryLink =
    window.location.hash.includes('type=recovery') ||
    new URLSearchParams(window.location.search).get('type') === 'recovery'

  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    state.session = data.session
  } catch (err) {
    state.session = null
    loginScreen('Error al verificar la sesión. Intenta de nuevo.', '', root)
    return
  }

  if (isRecoveryLink) {
    state.isResettingPassword = true
    newPasswordScreen('', '', root)
  } else if (!state.session) {
    loginScreen('', '', root)
  } else {
    appShell()
    await loadWhatsAppTemplates()
    await loadRows()
  }

  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    const previousSession = state.session
    state.session = nextSession

    if (event === 'PASSWORD_RECOVERY') {
      state.isResettingPassword = true
      newPasswordScreen('', '', root)
      return
    }

    if (state.isResettingPassword) {
      return
    }

    const changed = previousSession?.access_token !== nextSession?.access_token
    if (!changed) return

    if (!state.session) {
      state.rows = []
      state.products = []
      state.productsLoaded = false
      if (state.catalogAbortController) {
        state.catalogAbortController.abort()
        state.catalogAbortController = null
      }
      state.productsLoadingPromise = null
      state.catalogRenderId++
      invalidateServiceCache()
      root.innerHTML = ''
      loginScreen('Sesión cerrada.', '', root)
    } else {
      appShell()
      await loadWhatsAppTemplates()
      await loadRows()
    }
  })
}

boot()
