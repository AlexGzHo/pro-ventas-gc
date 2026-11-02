import { supabase } from './supabase.js'
import { toast } from './ui/toast.js'
import { SERVICES, OWNERS_BY_ID } from './constants.js'

export const state = {
  session: null,
  rows: [],
  products: [],
  productsLoaded: false,
  productsLoadingPromise: null,
  clients: [],
  clientsLoaded: false,
  clientsLoadingPromise: null,
  providers: [],
  providersLoaded: false,
  providersLoadingPromise: null,
  catalogAbortController: null,
  catalogRenderId: 0,
  editingId: null,
  editingRowData: null,
  currentFormIdempotencyKey: null,
  filters: {
    search: '',
    service: 'TODOS',
    status: 'TODOS',
    owner: 'TODOS',
    quickView: 'all'
  },
  loading: false,
  currentSection: 'inicio',
  highlightRowId: null,
  currentView: (typeof localStorage !== 'undefined' && localStorage.getItem('pv_view_mode') === 'summary') ? 'summary' : 'cards',
  totalView: 'PEN',
  usdtViewRate: null,
  isResettingPassword: false,
  recoveryEmail: ''
}

let onRowsLoadedCallbacks = []

export function onRowsLoaded(cb) {
  if (typeof cb === 'function') {
    onRowsLoadedCallbacks.push(cb)
  }
}

export function notifyRowsLoaded() {
  onRowsLoadedCallbacks.forEach((cb) => {
    try { cb(state.rows) } catch (e) { console.error(e) }
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pv-rows-loaded', { detail: { rows: state.rows } }))
  }
}

export function setLoading(isLoading, label = 'Cargando...') {
  state.loading = isLoading
  document.querySelectorAll('.btn:disabled').forEach((b) => {
    b.disabled = isLoading
    if (isLoading) b.textContent = label
  })
}

export function rowById(id) {
  return state.rows.find((r) => String(r.id) === String(id)) || null
}

export function ownerNameForId(id) {
  return OWNERS_BY_ID[id] || 'No identificado'
}

export function ownerNameForSession(activeSession) {
  return activeSession?.user?.id ? ownerNameForId(activeSession.user.id) : ''
}

export function ownerNameForRow(row) {
  return row.created_by ? ownerNameForId(row.created_by) : 'Sin asignar'
}

export function latestUSDTExchangeRate() {
  const rates = []
  state.rows.forEach((r) => {
    const sr = Number(r.sale_price_exchange_rate || 0)
    const cr = Number(r.cost_exchange_rate || 0)
    if (sr > 0) rates.push(sr)
    if (cr > 0) rates.push(cr)
  })
  return rates.length ? Math.max(...rates) : null
}

export function findActiveProduct(name) {
  const norm = String(name || '').trim().toUpperCase()
  if (!norm) return null
  return state.products.find((p) => Boolean(p.active) && String(p.name || '').trim().toUpperCase() === norm) || null
}

let _cachedServiceOptions = null
let _cachedEmailDomains = null

export function invalidateServiceCache() {
  _cachedServiceOptions = null
}

export function invalidateEmailDomainCache() {
  _cachedEmailDomains = null
}

export function serviceOptions() {
  const activeProductNames = state.products
    .filter((p) => p.active && p.name)
    .map((p) => p.name.trim().toUpperCase())

  const subServices = state.rows
    .map((r) => r.service)
    .filter(Boolean)
    .map((s) => s.trim().toUpperCase())

  const baseServices = SERVICES
    .filter(Boolean)
    .map((s) => s.trim().toUpperCase())

  const unique = [...new Set([...activeProductNames, ...subServices, ...baseServices])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'))

  return unique
}

export function getCachedServiceOptions() {
  if (_cachedServiceOptions === null) {
    _cachedServiceOptions = serviceOptions()
  }
  return _cachedServiceOptions
}

export function emailDomainOptions() {
  const domains = new Set()
  state.rows.forEach((r) => {
    const email = r.username_email
    if (email && email.includes('@')) {
      const domain = email.split('@')[1]?.toLowerCase()
      if (domain) domains.add(`@${domain}`)
    }
  })
  return [...domains].sort()
}

export function getCachedEmailDomains() {
  if (_cachedEmailDomains === null) {
    _cachedEmailDomains = emailDomainOptions()
  }
  return _cachedEmailDomains
}

export async function loadRows() {
  setLoading(true, 'Cargando...')
  try {
    let { data, error } = await supabase
      .from('subscriptions')
      .select('*, client:clients(*), product:products(*), provider_rel:providers(*)')
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    // Fallback: Si migration v3 no está aplicada
    if (error && error.code === 'PGRST200') {
      const fallback = await supabase
        .from('subscriptions')
        .select('*')
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      toast(`No se pudieron cargar los datos: ${error.message}`, 'error')
      return
    }

    state.rows = (data || []).map(r => ({
      ...r,
      client_name: r.client?.name || r.client_name,
      phone: r.client?.phone || r.phone,
      service: r.product?.name || r.service,
      provider: r.provider_rel?.name || r.provider
    }))

    invalidateServiceCache()
    invalidateEmailDomainCache()
    notifyRowsLoaded()
  } finally {
    setLoading(false)
  }
}

export async function loadProducts(force = false) {
  if (state.productsLoaded && !force) return { data: state.products, error: null }
  if (state.productsLoadingPromise && !force) return state.productsLoadingPromise

  if (force) {
    state.productsLoaded = false
    if (state.catalogAbortController) {
      state.catalogAbortController.abort()
      state.catalogAbortController = null
    }
  }

  if (!state.catalogAbortController || state.catalogAbortController.signal.aborted) {
    state.catalogAbortController = new AbortController()
  }

  const signal = state.catalogAbortController.signal

  state.productsLoadingPromise = (async () => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .order('active', { ascending: false })
        .order('name', { ascending: true })

      if (signal) {
        query = query.abortSignal(signal)
      }

      const { data, error } = await query

      if (error) {
        state.productsLoaded = false
        return { data: null, error }
      }
      state.products = data || []
      state.productsLoaded = true
      invalidateServiceCache()
      return { data: state.products, error: null }
    } catch (err) {
      state.productsLoaded = false
      return { data: null, error: err }
    } finally {
      state.productsLoadingPromise = null
    }
  })()

  return state.productsLoadingPromise
}

export async function loadClients(force = false) {
  if (state.clientsLoaded && !force) return { data: state.clients, error: null }
  if (state.clientsLoadingPromise && !force) return state.clientsLoadingPromise
  if (force) {
    state.clientsLoaded = false
  }
  state.clientsLoadingPromise = (async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true })
      if (error) {
        state.clientsLoaded = false
        return { data: null, error }
      }
      state.clients = data || []
      state.clientsLoaded = true
      return { data: state.clients, error: null }
    } catch (err) {
      state.clientsLoaded = false
      return { data: null, error: err }
    } finally {
      state.clientsLoadingPromise = null
    }
  })()
  return state.clientsLoadingPromise
}

export async function loadProviders(force = false) {
  if (state.providersLoaded && !force) return { data: state.providers, error: null }
  if (state.providersLoadingPromise && !force) return state.providersLoadingPromise
  if (force) {
    state.providersLoaded = false
  }
  state.providersLoadingPromise = (async () => {
    try {
      const { data, error } = await supabase.from('providers').select('*').order('name', { ascending: true })
      if (error) {
        state.providersLoaded = false
        return { data: null, error }
      }
      state.providers = data || []
      state.providersLoaded = true
      return { data: state.providers, error: null }
    } catch (err) {
      state.providersLoaded = false
      return { data: null, error: err }
    } finally {
      state.providersLoadingPromise = null
    }
  })()
  return state.providersLoadingPromise
}

export async function reloadProviders() {
  const res = await loadProviders(true)
  if (res?.error) {
    toast('Error sincronizando proveedores: ' + (res.error.message || res.error), 'error')
    return res
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pv-providers-changed', { detail: { providers: state.providers } }))
  }
  return res
}

export async function reloadProducts() {
  const res = await loadProducts(true)
  if (res?.error) {
    toast('Error sincronizando productos: ' + (res.error.message || res.error), 'error')
    return res
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pv-products-changed', { detail: { products: state.products } }))
  }
  return res
}

export async function reloadClients() {
  const res = await loadClients(true)
  if (res?.error) {
    toast('Error sincronizando clientes: ' + (res.error.message || res.error), 'error')
    return res
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pv-clients-changed', { detail: { clients: state.clients } }))
  }
  return res
}
