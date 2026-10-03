import './styles.css'
import { supabase, isConfigured } from './supabase.js'
import { SERVICES, credentialLabels, OWNERS_BY_ID } from './constants.js'
import {
  addOneMonth,
  addPeriod,
  amountInPEN,
  amountInUSDT,
  copyText,
  currencyLabel,
  escapeHtml,
  formatDate,
  formatAmount,
  formatMoney,
  formatUSDT,
  isUSDT,
  normalizeCurrency,
  statusFor,
  todayISO,
} from './utils.js'
import {
  credentialsText,
  credentialsPlain,
  openWhatsApp,
  reminderText,
  updateText,
} from './whatsapp.js'

const root = document.querySelector('#app')

// Inline styles for email autocomplete ghost text
const styleEl = document.createElement('style')
styleEl.textContent = `
  .email-input-wrapper { position: relative; display: inline-flex; width: 100%; }
  .email-input-wrapper input { width: 100%; }
  .email-ghost { position: absolute; pointer-events: none; color: #888; border: none; background: transparent; white-space: pre; overflow: hidden; }
`
document.head.appendChild(styleEl)

let session = null
let rows = []
let products = []
let productsLoaded = false
let productsLoadingPromise = null
let catalogAbortController = null
let catalogRenderId = 0
let editingId = null
let filters = { search: '', service: 'TODOS', status: 'TODOS', owner: 'TODOS' }
let loading = false
// Vista de suscripciones: 'cards' (predeterminado) o 'summary' (tabla compacta).
let currentView = localStorage.getItem('pv_view_mode') || 'cards'
// Vista de totales: 'PEN' (predeterminado) o 'USDT' (solo lectura, no altera registros).
let totalView = 'PEN'
// Tipo de cambio ingresado manualmente para la vista USDT (S/ por 1 USDT).
let usdtViewRate = null
// Control de recuperación de contraseña por OTP
let isResettingPassword = false
let recoveryEmail = ''

function rowSaleCurrency(row) {
  return normalizeCurrency(row?.sale_price_currency)
}

function rowCostCurrency(row) {
  return normalizeCurrency(row?.cost_currency)
}

// Último tipo de cambio registrado en una operación USDT (para sugerir en la vista USDT).
function latestUSDTExchangeRate() {
  const rates = []
  rows.forEach((r) => {
    const sr = Number(r.sale_price_exchange_rate || 0)
    const cr = Number(r.cost_exchange_rate || 0)
    if (sr > 0) rates.push(sr)
    if (cr > 0) rates.push(cr)
  })
  return rates.length ? Math.max(...rates) : null
}

function ownerNameForId(id) {
  return OWNERS_BY_ID[id] || 'No identificado'
}

function ownerNameForSession(activeSession) {
  return activeSession?.user?.id ? ownerNameForId(activeSession.user.id) : ''
}

function ownerNameForRow(row) {
  return row.created_by ? ownerNameForId(row.created_by) : 'Sin asignar'
}

function setLoading(state, label = 'Cargando...') {
  loading = state
  document.querySelectorAll('.btn:disabled').forEach((b) => {
    b.disabled = state
    if (state) b.textContent = label
  })
}

function toast(message, type = 'ok') {
  let area = document.querySelector('.toast-area')
  if (!area) {
    area = document.createElement('div')
    area.className = 'toast-area'
    document.body.append(area)
  }
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = message
  area.append(el)
  setTimeout(() => el.remove(), 2600)
}

function configScreen() {
  root.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        ${brandHtml()}
        <div class="login-copy">
          <h2>Falta conectar Supabase</h2>
          <p>El proyecto está listo. Solo copia <code>.env.example</code> como <code>.env</code> y coloca la URL y la clave pública de tu proyecto Supabase.</p>
        </div>
        <div class="config-box">
          VITE_SUPABASE_URL=https://...supabase.co<br>
          VITE_SUPABASE_PUBLISHABLE_KEY=...
        </div>
      </section>
    </main>`
}

function brandHtml() {
  return `
    <div class="brand">
      <div class="brand-mark">GC</div>
      <div>
        <h1>PRO VENTAS GC</h1>
        <p>Administrador de suscripciones</p>
      </div>
    </div>`
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

function loginScreen(error = '', info = '') {
  root.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        ${brandHtml()}
        <div class="login-copy">
          <h2>Iniciar sesión</h2>
          <p>Acceso privado para los usuarios autorizados.</p>
        </div>
        <form id="loginForm" class="form-stack">
          <label>Correo
            <input name="email" type="email" autocomplete="email" required placeholder="correo@ejemplo.com">
          </label>
          <label>Contraseña
            <input name="password" type="password" autocomplete="current-password" required placeholder="••••••••">
          </label>
          <button class="btn btn-primary btn-full" type="submit">Entrar</button>
          <div class="auth-links-row">
            <button type="button" id="forgotPasswordBtn" class="link-btn">¿Olvidaste tu contraseña?</button>
          </div>
        </form>
        ${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ''}
        ${info ? `<div class="info-box">${escapeHtml(info)}</div>` : ''}
      </section>
    </main>`

  document.querySelector('#loginForm').addEventListener('submit', handleLogin)
  document.querySelector('#forgotPasswordBtn').addEventListener('click', () => {
    recoveryRequestScreen()
  })
}

async function handleLogin(event) {
  event.preventDefault()
  const button = event.submitter
  button.disabled = true
  button.textContent = 'Ingresando...'
  setLoading(true, 'Ingresando...')

  const form = new FormData(event.currentTarget)
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: form.get('email'),
      password: form.get('password'),
    })
    if (error) {
      setLoading(false)
      button.disabled = false
      button.textContent = 'Entrar'
      loginScreen('Correo o contraseña incorrectos, o el usuario no está habilitado.')
    }
  } catch (err) {
    setLoading(false)
    button.disabled = false
    button.textContent = 'Entrar'
    loginScreen('Error de conexión. Intenta de nuevo.')
  }
}

function recoveryRequestScreen(error = '', info = '') {
  root.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        ${brandHtml()}
        <div class="login-copy">
          <h2>Recuperar contraseña</h2>
          <p>Ingresa tu correo para recibir un enlace de recuperación.</p>
        </div>
        <form id="recoveryRequestForm" class="form-stack">
          <label>Correo
            <input name="email" type="email" autocomplete="email" required placeholder="correo@ejemplo.com" value="${escapeHtml(recoveryEmail)}">
          </label>
          <button class="btn btn-primary btn-full" type="submit">Enviar enlace</button>
          <button type="button" id="backToLoginBtn" class="btn btn-ghost btn-full">Volver a iniciar sesión</button>
        </form>
        ${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ''}
        ${info ? `<div class="info-box">${escapeHtml(info)}</div>` : ''}
      </section>
    </main>`

  document.querySelector('#recoveryRequestForm').addEventListener('submit', handleRecoveryRequest)
  document.querySelector('#backToLoginBtn').addEventListener('click', () => {
    isResettingPassword = false
    loginScreen()
  })
}

async function handleRecoveryRequest(event) {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  const email = String(form.get('email') || '').trim()

  if (!email || !isValidEmail(email)) {
    return recoveryRequestScreen('Ingresa un correo electrónico válido.')
  }

  const submitBtn = event.currentTarget.querySelector('button[type="submit"]')
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'Enviando...'
  }

  try {
    const redirectTo = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    if (error) {
      return recoveryRequestScreen('No se pudo enviar el enlace de recuperación. Intenta nuevamente.')
    }

    recoveryEmail = email
    recoveryRequestScreen('', 'Si el correo corresponde a una cuenta válida, recibirás un enlace para restablecer tu contraseña.')
  } catch (err) {
    recoveryRequestScreen('No se pudo enviar el enlace de recuperación. Intenta nuevamente.')
  }
}

function newPasswordScreen(error = '', info = '') {
  root.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        ${brandHtml()}
        <div class="login-copy">
          <h2>Nueva contraseña</h2>
          <p>Crea tu nueva contraseña para acceder a PRO VENTAS GC.</p>
        </div>
        <form id="newPasswordForm" class="form-stack">
          <label>Nueva contraseña
            <input name="password" type="password" autocomplete="new-password" required placeholder="Mínimo 6 caracteres" autofocus>
          </label>
          <label>Confirmar contraseña
            <input name="confirm_password" type="password" autocomplete="new-password" required placeholder="Repite la nueva contraseña">
          </label>
          <button class="btn btn-primary btn-full" type="submit">Actualizar contraseña</button>
          <button type="button" id="cancelNewPasswordBtn" class="btn btn-ghost btn-full">Cancelar</button>
        </form>
        ${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ''}
        ${info ? `<div class="info-box">${escapeHtml(info)}</div>` : ''}
      </section>
    </main>`

  document.querySelector('#newPasswordForm').addEventListener('submit', handleUpdatePassword)
  document.querySelector('#cancelNewPasswordBtn').addEventListener('click', async () => {
    isResettingPassword = false
    await supabase.auth.signOut()
    loginScreen()
  })
}

async function handleUpdatePassword(event) {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  const password = String(form.get('password') || '').trim()
  const confirmPassword = String(form.get('confirm_password') || '').trim()

  if (!password || !confirmPassword) {
    return newPasswordScreen('Todos los campos son obligatorios.')
  }

  if (password.length < 6) {
    return newPasswordScreen('La contraseña debe tener al menos 6 caracteres.')
  }

  if (password !== confirmPassword) {
    return newPasswordScreen('Las contraseñas no coinciden.')
  }

  const submitBtn = event.currentTarget.querySelector('button[type="submit"]')
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'Guardando...'
  }

  try {
    const { data, error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      const errMsg = (error.message || '').toLowerCase()
      if (
        errMsg.includes('session') ||
        errMsg.includes('token') ||
        errMsg.includes('expired') ||
        errMsg.includes('auth') ||
        errMsg.includes('reauthenticate') ||
        errMsg.includes('user not found')
      ) {
        return newPasswordScreen('El enlace de recuperación expiró o ya no es válido. Solicita uno nuevo.')
      }
      return newPasswordScreen('No se pudo actualizar la contraseña. Intenta nuevamente.')
    }

    await supabase.auth.signOut()
    isResettingPassword = false
    recoveryEmail = ''
    toast('Contraseña actualizada con éxito.')
    loginScreen('', 'Contraseña actualizada con éxito. Inicia sesión con tu nueva contraseña.')
  } catch (err) {
    newPasswordScreen('No se pudo actualizar la contraseña. Intenta nuevamente.')
  }
}

function appShell() {
  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        ${brandHtml()}
        <div class="topbar-actions">
          <span class="user-email">${escapeHtml(ownerNameForSession(session))}</span>
          <button id="catalogBtn" class="btn btn-ghost btn-small" type="button" title="Administrar catálogo de productos">Catálogo</button>
          <button id="logoutBtn" class="btn btn-ghost btn-small">Salir</button>
        </div>
      </header>
      <main class="main">
        <section class="hero">
          <div>
            <h2>Suscripciones</h2>
            <p>Registra, renueva, copia accesos y abre WhatsApp desde un solo lugar.</p>
          </div>
          <button id="newBtn" class="btn btn-primary">+ Nueva suscripción</button>
        </section>
        <section id="kpis" class="kpis"></section>
        <section class="toolbar">
          <input id="searchInput" type="search" placeholder="Buscar cliente, celular, servicio, correo...">
          <select id="serviceFilter"></select>
          <select id="ownerFilter">
            <option value="TODOS">Todos</option>
            <option value="Alex">Alex</option>
            <option value="Liz">Liz</option>
          </select>
          <select id="statusFilter">
            <option value="TODOS">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="proximo">Próximos (1–3 días)</option>
            <option value="hoy">Vencen hoy</option>
            <option value="vencido">Vencidos</option>
            <option value="sin-fecha">Sin fecha</option>
          </select>
          <select id="totalViewFilter" title="Moneda de los totales principales">
            <option value="PEN">Totales en S/</option>
            <option value="USDT">Totales en USDT</option>
          </select>
        </section>
        <div id="usdtRateBox" class="toolbar rate-box hidden">
          <label class="rate-label">TC S/ por 1 USDT
            <input id="usdtRateInput" type="number" min="0" step="0.0001" placeholder="Ej. 3.75">
          </label>
        </div>
        <div class="results-bar">
          <div id="resultsLine" class="results-line"></div>
          <div class="view-toggle" role="group" aria-label="Cambiar vista">
            <button id="viewCardsBtn" type="button" class="view-btn ${currentView === 'cards' ? 'active' : ''}" title="Vista de tarjetas">⊞ Tarjetas</button>
            <button id="viewSummaryBtn" type="button" class="view-btn ${currentView === 'summary' ? 'active' : ''}" title="Vista resumen">☰ Resumen</button>
          </div>
        </div>
        <section id="cards" class="${currentView === 'cards' ? 'grid' : 'summary-view-wrapper'}"></section>
      </main>
      <div id="modalHost"></div>
    </div>`

  document.querySelector('#logoutBtn').addEventListener('click', () => supabase.auth.signOut())
  document.querySelector('#catalogBtn').addEventListener('click', () => openCatalogModal())
  document.querySelector('#newBtn').addEventListener('click', () => openForm())
  document.querySelector('#viewCardsBtn').addEventListener('click', () => {
    if (currentView === 'cards') return
    currentView = 'cards'
    localStorage.setItem('pv_view_mode', 'cards')
    updateViewButtons()
    renderData()
  })
  document.querySelector('#viewSummaryBtn').addEventListener('click', () => {
    if (currentView === 'summary') return
    currentView = 'summary'
    localStorage.setItem('pv_view_mode', 'summary')
    updateViewButtons()
    renderData()
  })
  document.querySelector('#searchInput').addEventListener('input', (e) => {
    filters.search = e.target.value
    renderData()
  })
  document.querySelector('#serviceFilter').addEventListener('change', (e) => {
    filters.service = e.target.value
    renderData()
  })
  document.querySelector('#statusFilter').addEventListener('change', (e) => {
    filters.status = e.target.value
    renderData()
  })
  document.querySelector('#ownerFilter').addEventListener('change', (e) => {
    filters.owner = e.target.value
    renderData()
  })
  // Vista de totales: PEN (predeterminado) o USDT (solo presentación).
  document.querySelector('#totalViewFilter').addEventListener('change', (e) => {
    totalView = e.target.value
    if (totalView === 'USDT' && !(Number(usdtViewRate) > 0)) {
      // Sugiere el último TC registrado en una operación USDT, si existe.
      const suggestion = latestUSDTExchangeRate()
      usdtViewRate = suggestion ?? usdtViewRate
      const input = document.querySelector('#usdtRateInput')
      if (input && usdtViewRate !== null) input.value = usdtViewRate
    }
    renderKpis()
  })
  document.querySelector('#usdtRateInput').addEventListener('input', (e) => {
    usdtViewRate = e.target.value
    renderKpis()
  })
}

function updateViewButtons() {
  const cardsBtn = document.querySelector('#viewCardsBtn')
  const summaryBtn = document.querySelector('#viewSummaryBtn')
  if (cardsBtn && summaryBtn) {
    cardsBtn.classList.toggle('active', currentView === 'cards')
    summaryBtn.classList.toggle('active', currentView === 'summary')
  }
}

async function loadRows() {
  setLoading(true, 'Cargando...')
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      toast(`No se pudieron cargar los datos: ${error.message}`, 'error')
      return
    }
    rows = data || []
    invalidateServiceCache()
    invalidateEmailDomainCache()
    renderData()
  } finally {
    setLoading(false)
  }
}

function findActiveProduct(name) {
  const norm = String(name || '').trim().toUpperCase()
  if (!norm) return null
  return products.find((p) => Boolean(p.active) && String(p.name || '').trim().toUpperCase() === norm) || null
}

function serviceOptions() {
  const activeProductNames = products
    .filter((p) => p.active && p.name)
    .map((p) => p.name.trim().toUpperCase())

  const subServices = rows
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

let _cachedServiceOptions = null
let _cachedEmailDomains = null

function getCachedServiceOptions() {
  if (_cachedServiceOptions === null) {
    _cachedServiceOptions = serviceOptions()
  }
  return _cachedServiceOptions
}

function invalidateServiceCache() {
  _cachedServiceOptions = null
}

function emailDomainOptions() {
  const domains = new Set()
  rows.forEach((r) => {
    const email = r.username_email
    if (email && email.includes('@')) {
      const domain = email.split('@')[1].toLowerCase()
      if (domain) domains.add(`@${domain}`)
    }
  })
  return [...domains].sort()
}

function getCachedEmailDomains() {
  if (_cachedEmailDomains === null) {
    _cachedEmailDomains = emailDomainOptions()
  }
  return _cachedEmailDomains
}

function invalidateEmailDomainCache() {
  _cachedEmailDomains = null
}

function renderFilters() {
  const select = document.querySelector('#serviceFilter')
  if (!select) return
  const current = filters.service
  const opts = getCachedServiceOptions()
  select.innerHTML = `<option value="TODOS">Todos los servicios</option>${opts
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join('')}`
  select.value = opts.includes(current) ? current : 'TODOS'
}

function filteredRows() {
  const q = filters.search.trim().toLowerCase()
  return rows.filter((row) => {
    const status = statusFor(row.expiry_date)
    const haystack = [
      row.client_name,
      row.phone,
      row.service,
      row.username_email,
      row.provider,
      row.notes,
    ].join(' ').toLowerCase()

    const searchOk = !q || haystack.includes(q)
    const serviceOk = filters.service === 'TODOS' || row.service === filters.service
    const statusOk = filters.status === 'TODOS' || status.key === filters.status
    const ownerOk = filters.owner === 'TODOS' || ownerNameForRow(row) === filters.owner
    return searchOk && serviceOk && statusOk && ownerOk
  })
}

function renderKpis() {
  // Totales principales siempre en soles (moneda base).
  // Los importes en USDT se convierten con el tipo de cambio registrado
  // en su propia operación, por lo que son históricamente estables.
  const income = rows.reduce((sum, r) => sum + amountInPEN(r.sale_price, rowSaleCurrency(r), r.sale_price_exchange_rate), 0)
  const cost = rows.reduce((sum, r) => sum + amountInPEN(r.cost, rowCostCurrency(r), r.cost_exchange_rate), 0)
  const counts = rows.reduce((acc, r) => {
    const key = statusFor(r.expiry_date).key
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const rate = Number(usdtViewRate || 0)
  const usdtViewReady = totalView === 'USDT' && rate > 0

  document.querySelector('#kpis').innerHTML = `
    ${kpi('Ingresos', totalView === 'PEN' ? formatMoney(income) : usdtViewReady ? formatUSDT(amountInUSDT(income, 'PEN', rate)) : '—')}
    ${kpi('Egresos', totalView === 'PEN' ? formatMoney(cost) : usdtViewReady ? formatUSDT(amountInUSDT(cost, 'PEN', rate)) : '—')}
    ${kpi('Ganancia', totalView === 'PEN' ? formatMoney(income - cost) : usdtViewReady ? formatUSDT(amountInUSDT(income - cost, 'PEN', rate)) : '—')}
    ${kpi('Activos', counts.activo || 0)}
    ${kpi('Por vencer', (counts.proximo || 0) + (counts.hoy || 0))}
    ${kpi('Vencidos', counts.vencido || 0)}`

  const rateBox = document.querySelector('#usdtRateBox')
  if (rateBox) rateBox.classList.toggle('hidden', totalView === 'PEN')
}

function kpi(label, value) {
  return `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`
}

function renderData() {
  renderFilters()
  renderKpis()
  updateViewButtons()
  const data = filteredRows()
  const cards = document.querySelector('#cards')

  const hasFilters = Boolean(
    filters.search.trim() ||
    filters.service !== 'TODOS' ||
    filters.status !== 'TODOS' ||
    filters.owner !== 'TODOS'
  ) || data.length !== rows.length

  const count = data.length
  const total = rows.length
  const totalNoun = total === 1 ? 'suscripción' : 'suscripciones'
  const counterText = hasFilters
    ? `${count} de ${total} ${totalNoun}`
    : `${count} ${totalNoun}`

  document.querySelector('#resultsLine').innerHTML = `<span>${escapeHtml(counterText)}</span>`

  if (!data.length) {
    cards.className = currentView === 'cards' ? 'grid' : 'summary-view-wrapper'
    cards.innerHTML = `<div class="empty"><strong>No hay resultados.</strong>Prueba otro filtro o registra una nueva suscripción.</div>`
    return
  }

  if (currentView === 'summary') {
    cards.className = 'summary-view-wrapper'
    cards.innerHTML = summaryTableHtml(data)
    bindSummaryEvents()
  } else {
    cards.className = 'grid'
    cards.innerHTML = data.map(cardHtml).join('')
    bindCardEvents()
  }
}

function cardHtml(row) {
  const status = statusFor(row.expiry_date)
  const owner = ownerNameForRow(row)
  const ownerKey = owner.toLowerCase()

  const salePEN = amountInPEN(row.sale_price, rowSaleCurrency(row), row.sale_price_exchange_rate)
  const costPEN = amountInPEN(row.cost, rowCostCurrency(row), row.cost_exchange_rate)
  const profitPEN = salePEN - costPEN

  return `
    <article class="card" data-id="${row.id}">
      <div class="card-head">
        <div>
          <div class="service-pill"><span class="service-dot"></span>${escapeHtml(row.service || 'SIN SERVICIO')}</div>
          <h3 class="client">${escapeHtml(row.client_name || 'Sin nombre')}</h3>
          <div class="phone"><span class="phone-icon">📞</span> ${escapeHtml(row.phone || 'Sin celular')}</div>
        </div>
        <div class="card-badge-wrap">
          <span class="badge badge-${status.tone}">${escapeHtml(status.label)}</span>
        </div>
      </div>

      <div class="financial-grid">
        <div class="meta-box">
          <span>Venta (${currencyLabel(row.sale_price_currency)})</span>
          <strong class="meta-price-sale">${formatAmount(row.sale_price, row.sale_price_currency)}</strong>
          ${isUSDT(row.sale_price_currency) ? `<small class="ex-rate">TC ${formatMoney(row.sale_price_exchange_rate)}</small>` : ''}
        </div>
        <div class="meta-box">
          <span>Costo (${currencyLabel(row.cost_currency)})</span>
          <strong class="meta-price-cost">${formatAmount(row.cost, row.cost_currency)}</strong>
          ${isUSDT(row.cost_currency) ? `<small class="ex-rate">TC ${formatMoney(row.cost_exchange_rate)}</small>` : ''}
        </div>
        <div class="meta-box">
          <span>Ganancia</span>
          <strong class="meta-price-profit ${profitPEN >= 0 ? 'profit-positive' : 'profit-negative'}">${formatMoney(profitPEN)}</strong>
        </div>
      </div>

      <div class="meta-details-grid">
        <div class="meta-box">
          <span>Vencimiento</span>
          <strong>📅 ${formatDate(row.expiry_date)}</strong>
        </div>
        <div class="meta-box">
          <span>Proveedor</span>
          <strong>${escapeHtml(row.provider || '—')}</strong>
        </div>
        <div class="meta-box meta-box-owner">
          <span>Propietario</span>
          <div class="meta-owner-value">
            <span class="owner-dot owner-dot-${escapeHtml(ownerKey)}"></span>
            <strong>${escapeHtml(owner)}</strong>
          </div>
        </div>
      </div>

      <div class="card-actions">
        <div class="card-actions-row card-actions-top">
          <button type="button" class="btn btn-small copy-all btn-action-copy" title="Copiar todos los accesos">📋 Copiar todo</button>
          <button type="button" class="btn btn-small whatsapp-reminder btn-action-cobrar" title="Enviar recordatorio / cobro por WhatsApp">💰 Cobrar</button>
          <button type="button" class="btn btn-small whatsapp-update btn-action-actualizar" title="Enviar actualización por WhatsApp">🔄 Actualizar</button>
          <button type="button" class="btn btn-small whatsapp-data btn-action-datos" title="Enviar datos por WhatsApp">💻 Datos</button>
        </div>
        <div class="card-actions-row card-actions-bottom">
          <button type="button" class="btn btn-small renew btn-action-renovar" title="Extender período">📅 Renovar</button>
          <div class="card-actions-group">
            <button type="button" class="btn btn-small edit btn-action-edit" title="Editar suscripción">✏️ Editar</button>
            <button type="button" class="btn btn-small btn-danger delete btn-action-delete" title="Eliminar suscripción">🗑️ Eliminar</button>
          </div>
        </div>
      </div>
    </article>`
}

function credentialHtml(id, key, value) {
  const display = key === 'password' ? '••••••••' : value
  return `
    <div class="cred">
      <div class="cred-copy">
        <span class="cred-label">${escapeHtml(credentialLabels[key] || key)}</span>
        <code class="cred-value">${escapeHtml(display)}</code>
      </div>
      <button type="button" class="btn btn-small copy-field" data-key="${key}" data-id="${id}" title="Copiar ${escapeHtml(credentialLabels[key] || key)}">📋 Copiar</button>
    </div>`
}

function rowById(id) {
  return rows.find((r) => r.id === id)
}

function bindCardEvents() {
  document.querySelectorAll('.card').forEach((card) => {
    const row = rowById(card.dataset.id)
    if (!row) return
    card.querySelector('.copy-all').addEventListener('click', async () => {
      await copyText(credentialsPlain(row))
      toast('Credenciales copiadas.')
    })
    card.querySelector('.whatsapp-reminder').addEventListener('click', () => safeWhatsapp(row, reminderText(row)))
    card.querySelector('.whatsapp-update').addEventListener('click', () => safeWhatsapp(row, updateText(row)))
    card.querySelector('.whatsapp-data').addEventListener('click', () => safeWhatsapp(row, credentialsText(row)))
    card.querySelector('.renew').addEventListener('click', () => openRenewModal(row))
    card.querySelector('.edit').addEventListener('click', () => openForm(row))
    card.querySelector('.delete').addEventListener('click', () => deleteRow(row))
  })
}

function safeWhatsapp(row, message) {
  try {
    openWhatsApp(row, message)
  } catch (error) {
    toast(error.message, 'error')
  }
}

function summaryTableHtml(data) {
  return `
    <div class="summary-table-container">
      <table class="summary-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Correo</th>
            <th>Fecha inicio</th>
            <th>Fecha fin</th>
            <th>Días restantes</th>
            <th>Renovar</th>
            <th>Datos de acceso</th>
            <th>Propietario</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(summaryRowHtml).join('')}
        </tbody>
      </table>
    </div>`
}

function summaryRowHtml(row) {
  const status = statusFor(row.expiry_date)
  const owner = ownerNameForRow(row)
  const email = row.username_email ? escapeHtml(row.username_email) : ''

  return `
    <tr data-id="${row.id}">
      <td>
        <div class="summary-client-cell">
          <strong class="summary-client-name">${escapeHtml(row.client_name || 'Sin nombre')}</strong>
          <span class="summary-service-tag">${escapeHtml(row.service || 'SIN SERVICIO')}</span>
          ${row.phone ? `<span class="summary-phone">${escapeHtml(row.phone)}</span>` : ''}
        </div>
      </td>
      <td>
        ${email ? `
          <div class="summary-email-cell">
            <span class="summary-email" title="${email}">${email}</span>
            <button type="button" class="btn btn-ghost btn-small copy-email-btn" data-email="${email}" title="Copiar correo">📋</button>
          </div>
        ` : '<span class="text-muted">—</span>'}
      </td>
      <td>${formatDate(row.start_date)}</td>
      <td>${formatDate(row.expiry_date)}</td>
      <td>
        <span class="badge badge-${status.tone}">${escapeHtml(status.label)}</span>
      </td>
      <td>
        <div class="summary-actions-cell">
          <button type="button" class="btn btn-small btn-whatsapp-renew" data-id="${row.id}" title="Enviar recordatorio / renovación por WhatsApp">💬 WhatsApp</button>
          <button type="button" class="btn btn-small renew-modal-btn" data-id="${row.id}" title="Extender período">↻ Extender</button>
        </div>
      </td>
      <td>
        <button type="button" class="btn btn-small creds-modal-btn" data-id="${row.id}">🔑 Ver accesos</button>
      </td>
      <td>
        <span class="summary-owner-tag owner-${escapeHtml(owner.toLowerCase())}">${escapeHtml(owner)}</span>
      </td>
    </tr>`
}

function bindSummaryEvents() {
  const container = document.querySelector('#cards')
  if (!container) return

  container.querySelectorAll('.copy-email-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const email = btn.dataset.email
      if (email) {
        await copyText(email)
        toast('Correo copiado.')
      }
    })
  })

  container.querySelectorAll('.btn-whatsapp-renew').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const row = rowById(btn.dataset.id)
      if (row) safeWhatsapp(row, reminderText(row))
    })
  })

  container.querySelectorAll('.renew-modal-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const row = rowById(btn.dataset.id)
      if (row) openRenewModal(row)
    })
  })

  container.querySelectorAll('.creds-modal-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const row = rowById(btn.dataset.id)
      if (row) openCredentialsModal(row)
    })
  })
}

function openCredentialsModal(row) {
  const host = document.querySelector('#modalHost')
  const creds = [
    ['username_email', row.username_email],
    ['password', row.password],
    ['profile', row.profile],
    ['pin', row.pin],
    ['access_url', row.access_url],
  ].filter(([, value]) => value)

  const extras = row.extras && typeof row.extras === 'object'
    ? Object.entries(row.extras).filter(([, v]) => v !== null && v !== undefined && v !== '')
    : []

  host.innerHTML = `
    <div class="modal-backdrop" id="credsBackdrop">
      <section class="modal creds-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h3>Datos de acceso</h3>
            <p class="modal-subtitle">${escapeHtml(row.client_name || 'Cliente')} · ${escapeHtml(row.service || 'Servicio')}</p>
          </div>
          <button id="closeCredsModal" class="btn btn-small btn-ghost" type="button">✕</button>
        </div>
        <div class="modal-body">
          ${creds.length || extras.length ? `
            <div class="credentials modal-credentials">
              ${creds.map(([key, value]) => `
                <div class="cred">
                  <div class="cred-copy">
                    <span class="cred-label">${escapeHtml(credentialLabels[key] || key)}</span>
                    <code class="cred-value">${escapeHtml(value)}</code>
                  </div>
                  <button type="button" class="btn btn-small copy-modal-field" data-value="${escapeHtml(value)}" data-label="${escapeHtml(credentialLabels[key] || key)}">📋 Copiar</button>
                </div>
              `).join('')}
              ${extras.map(([key, value]) => `
                <div class="cred">
                  <div class="cred-copy">
                    <span class="cred-label">${escapeHtml(key)}</span>
                    <code class="cred-value">${escapeHtml(value)}</code>
                  </div>
                  <button type="button" class="btn btn-small copy-modal-field" data-value="${escapeHtml(value)}" data-label="${escapeHtml(key)}">📋 Copiar</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="empty-creds">No hay credenciales registradas para esta suscripción.</p>
          `}
          <div class="modal-actions" style="margin-top: 18px; justify-content: space-between; flex-wrap: wrap;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="copyAllCredsBtn" class="btn btn-small">📋 Copiar todo</button>
              <button type="button" id="sendWhatsappCredsBtn" class="btn btn-small">💬 Enviar WhatsApp</button>
            </div>
            <button type="button" id="closeCredsBtn" class="btn btn-small">Cerrar</button>
          </div>
        </div>
      </section>
    </div>`

  const close = () => { host.innerHTML = '' }
  document.querySelector('#closeCredsModal').addEventListener('click', close)
  document.querySelector('#closeCredsBtn').addEventListener('click', close)
  document.querySelector('#credsBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'credsBackdrop') close()
  })

  document.querySelectorAll('.copy-modal-field').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await copyText(btn.dataset.value || '')
      toast(`${btn.dataset.label} copiado.`)
    })
  })

  document.querySelector('#copyAllCredsBtn')?.addEventListener('click', async () => {
    await copyText(credentialsPlain(row))
    toast('Credenciales copiadas.')
  })

  document.querySelector('#sendWhatsappCredsBtn')?.addEventListener('click', () => {
    safeWhatsapp(row, credentialsText(row))
  })
}

function openRenewModal(row) {
  const host = document.querySelector('#modalHost')
  host.innerHTML = `
    <div class="modal-backdrop" id="renewBackdrop">
      <section class="modal renew-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h3>Renovar suscripción</h3>
            <p class="modal-subtitle">${escapeHtml(row.client_name || 'Cliente')} · ${escapeHtml(row.service || 'Servicio')}</p>
          </div>
          <button id="closeRenew" class="btn btn-small btn-ghost">✕</button>
        </div>
        <div class="modal-body">
          <p class="renew-current">Vencimiento actual: <strong>${formatDate(row.expiry_date)}</strong></p>
          <div class="renew-grid">
            <button class="btn renew-option" data-days="7">+ 7 días</button>
            <button class="btn renew-option" data-days="15">+ 15 días</button>
            <button class="btn renew-option" data-months="1">+ 1 mes</button>
            <button class="btn renew-option" data-months="3">+ 3 meses</button>
            <button class="btn renew-option" data-months="6">+ 6 meses</button>
            <button class="btn renew-option" data-months="12">+ 12 meses</button>
          </div>
        </div>
      </section>
    </div>`

  const close = () => { host.innerHTML = '' }
  document.querySelector('#closeRenew').addEventListener('click', close)
  document.querySelector('#renewBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'renewBackdrop') close()
  })
  document.querySelectorAll('.renew-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const days = Number(btn.dataset.days || 0)
      const months = Number(btn.dataset.months || 0)
      await renewRow(row, { days, months })
      close()
    })
  })
}

async function renewRow(row, period) {
  const newDate = addPeriod(row.expiry_date, period)
  setLoading(true, 'Renovando...')
  const { error } = await supabase.from('subscriptions').update({ expiry_date: newDate }).eq('id', row.id)
  setLoading(false)
  if (error) return toast(error.message, 'error')
  toast(`Renovado hasta ${formatDate(newDate)}.`)
  await loadRows()
}

async function deleteRow(row) {
  const ok = window.confirm(`¿Eliminar la suscripción de ${row.client_name || 'este cliente'} en ${row.service || 'este servicio'}?`)
  if (!ok) return
  setLoading(true, 'Eliminando...')
  const { error } = await supabase.from('subscriptions').delete().eq('id', row.id)
  setLoading(false)
  if (error) return toast(error.message, 'error')
  toast('Registro eliminado.')
  await loadRows()
}

async function loadProducts(force = false) {
  if (productsLoaded && !force) return { data: products, error: null }
  if (productsLoadingPromise && !force) return productsLoadingPromise

  if (force && catalogAbortController) {
    catalogAbortController.abort()
    catalogAbortController = null
  }

  if (!catalogAbortController || catalogAbortController.signal.aborted) {
    catalogAbortController = new AbortController()
  }

  const signal = catalogAbortController.signal

  productsLoadingPromise = (async () => {
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
        return { data: null, error }
      }
      products = data || []
      productsLoaded = true
      invalidateServiceCache()
      return { data: products, error: null }
    } catch (err) {
      return { data: null, error: err }
    } finally {
      productsLoadingPromise = null
    }
  })()

  return productsLoadingPromise
}

async function openCatalogModal(forceReload = false) {
  const host = document.querySelector('#modalHost')
  if (!host) return

  // Si ya hay un backdrop de carga activo del catálogo y una carga en curso, no reiniciar
  const existingLoadingBackdrop = document.querySelector('#catalogBackdrop[data-loading="true"]')
  if (existingLoadingBackdrop && productsLoadingPromise && !forceReload) {
    return
  }

  const currentToken = ++catalogRenderId
  const neededLoading = !productsLoaded || forceReload

  // Si no está en caché o se fuerza recarga, mostrar modal con estado de carga
  if (neededLoading) {
    host.innerHTML = `
      <div class="modal-backdrop" id="catalogBackdrop" data-render-id="${currentToken}" data-loading="true">
        <section class="modal catalog-modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <h3>Catálogo de productos</h3>
              <p class="modal-subtitle">Cargando productos...</p>
            </div>
            <button id="closeCatalogModal" class="btn btn-small btn-ghost" type="button">✕</button>
          </div>
          <div class="modal-body">
            <div class="empty"><strong>Cargando...</strong>Por favor espera un momento.</div>
          </div>
        </section>
      </div>`

    const close = () => {
      catalogRenderId++
      if (catalogAbortController) {
        catalogAbortController.abort()
        catalogAbortController = null
      }
      host.innerHTML = ''
    }

    document.querySelector('#closeCatalogModal')?.addEventListener('click', close)
    document.querySelector('#catalogBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'catalogBackdrop') close()
    })
  }

  const { data, error } = await loadProducts(forceReload)

  // Comprobar token de render y cancelación antes de tocar el DOM
  if (currentToken !== catalogRenderId) {
    return
  }
  if (catalogAbortController?.signal.aborted) {
    return
  }

  // Si se mostró pantalla de carga, confirmar que el modal sigue activo en el DOM
  if (neededLoading) {
    const activeBackdrop = document.querySelector(`#catalogBackdrop[data-render-id="${currentToken}"]`)
    if (!activeBackdrop) {
      return
    }
  }

  if (error) {
    // Si fue cancelado voluntariamente, no mostrar pantalla ni toast de error
    if (catalogAbortController?.signal.aborted || currentToken !== catalogRenderId) {
      return
    }

    host.innerHTML = `
      <div class="modal-backdrop" id="catalogBackdrop" data-render-id="${currentToken}">
        <section class="modal catalog-modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <h3>Catálogo de productos</h3>
              <p class="modal-subtitle">Error al cargar</p>
            </div>
            <button id="closeCatalogModal" class="btn btn-small btn-ghost" type="button">✕</button>
          </div>
          <div class="modal-body">
            <div class="error-box">No se pudieron cargar los datos del catálogo. Intenta nuevamente.</div>
            <div class="modal-actions" style="margin-top: 16px;">
              <button type="button" id="retryCatalogBtn" class="btn btn-primary">Reintentar</button>
              <button type="button" id="closeCatalogBtn" class="btn">Cerrar</button>
            </div>
          </div>
        </section>
      </div>`

    const close = () => {
      catalogRenderId++
      host.innerHTML = ''
    }

    document.querySelector('#closeCatalogModal')?.addEventListener('click', close)
    document.querySelector('#closeCatalogBtn')?.addEventListener('click', close)
    document.querySelector('#retryCatalogBtn')?.addEventListener('click', () => openCatalogModal(true))
    document.querySelector('#catalogBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'catalogBackdrop') close()
    })
    toast('Error al cargar el catálogo.', 'error')
    return
  }

  const totalCount = products.length
  const totalNoun = totalCount === 1 ? 'producto' : 'productos'

  host.innerHTML = `
    <div class="modal-backdrop" id="catalogBackdrop" data-render-id="${currentToken}">
      <section class="modal catalog-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h3>Catálogo de productos</h3>
            <p class="modal-subtitle">Administra los nombres, precios base y estados</p>
          </div>
          <button id="closeCatalogModal" class="btn btn-small btn-ghost" type="button">✕</button>
        </div>
        <div class="modal-body">
          <div class="catalog-top-bar">
            <span class="catalog-count">${totalCount} ${totalNoun}</span>
            <button type="button" id="newProductBtn" class="btn btn-primary btn-small">+ Nuevo producto</button>
          </div>

          ${totalCount === 0 ? `
            <div class="empty">
              <strong>No hay productos registrados.</strong>
              Agrega el primer producto haciendo clic en <em>+ Nuevo producto</em>.
            </div>
          ` : `
            <div class="catalog-table-wrapper">
              <table class="catalog-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio base</th>
                    <th>Moneda</th>
                    <th>Estado</th>
                    <th style="text-align: right;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${products.map((p) => `
                    <tr class="catalog-row ${!p.active ? 'catalog-row-inactive' : ''}" data-id="${p.id}">
                      <td class="catalog-cell-name">
                        <strong class="catalog-prod-name">${escapeHtml(p.name)}</strong>
                      </td>
                      <td class="catalog-cell-price">
                        <span class="catalog-prod-price">${formatAmount(p.sale_price, p.currency)}</span>
                      </td>
                      <td class="catalog-cell-currency">
                        <span class="catalog-currency-pill">${escapeHtml(p.currency)}</span>
                      </td>
                      <td class="catalog-cell-status">
                        <span class="badge ${p.active ? 'badge-success' : 'badge-neutral'}">
                          ${p.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td class="catalog-cell-actions" style="text-align: right;">
                        <button type="button" class="btn btn-small btn-action-edit edit-product-btn" data-id="${p.id}" title="Editar producto">✏️ Editar</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
          <div class="modal-actions" style="margin-top: 20px;">
            <button type="button" id="closeCatalogFooterBtn" class="btn">Cerrar</button>
          </div>
        </div>
      </section>
    </div>`

  const close = () => {
    catalogRenderId++
    host.innerHTML = ''
  }

  document.querySelector('#closeCatalogModal')?.addEventListener('click', close)
  document.querySelector('#closeCatalogFooterBtn')?.addEventListener('click', close)
  document.querySelector('#catalogBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'catalogBackdrop') close()
  })

  document.querySelector('#newProductBtn')?.addEventListener('click', () => {
    openProductFormModal(null)
  })

  document.querySelectorAll('.edit-product-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = products.find((p) => p.id === btn.dataset.id)
      if (prod) openProductFormModal(prod)
    })
  })
}

function openProductFormModal(product = null) {
  const host = document.querySelector('#modalHost')
  if (!host) return

  const isEditing = Boolean(product?.id)
  const isSelectedActive = product ? Boolean(product.active) : true
  const selectedCurrency = product?.currency === 'USDT' ? 'USDT' : 'PEN'
  const initialPrice = product?.sale_price != null ? String(product.sale_price) : ''

  host.innerHTML = `
    <div class="modal-backdrop" id="productFormBackdrop">
      <section class="modal product-form-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h3>${isEditing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <p class="modal-subtitle">${isEditing ? escapeHtml(product.name) : 'Ingresa los datos del nuevo producto'}</p>
          </div>
          <button id="closeProductFormModal" class="btn btn-small btn-ghost" type="button" title="Volver al catálogo">✕</button>
        </div>
        <form id="productForm" class="modal-body">
          <div class="form-grid">
            <label class="span-2">Nombre
              <input name="name" required placeholder="Ej. NETFLIX" value="${escapeHtml(product?.name || '')}" autocomplete="off" autofocus>
            </label>
            <label>Precio base
              <input name="sale_price" type="number" min="0.01" step="0.01" required placeholder="0.00" value="${escapeHtml(initialPrice)}">
            </label>
            <label>Moneda
              <select name="currency">
                <option value="PEN" ${selectedCurrency === 'PEN' ? 'selected' : ''}>PEN (S/)</option>
                <option value="USDT" ${selectedCurrency === 'USDT' ? 'selected' : ''}>USDT</option>
              </select>
            </label>
            <label class="span-2">Estado
              <select name="active">
                <option value="true" ${isSelectedActive ? 'selected' : ''}>Activo</option>
                <option value="false" ${!isSelectedActive ? 'selected' : ''}>Inactivo</option>
              </select>
            </label>
          </div>

          <div id="productFormError" class="error-box hidden"></div>

          <div class="modal-actions" style="margin-top: 20px;">
            <button type="button" id="cancelProductFormBtn" class="btn">Volver al catálogo</button>
            <button type="submit" id="saveProductBtn" class="btn btn-primary">${isEditing ? 'Guardar cambios' : 'Registrar producto'}</button>
          </div>
        </form>
      </section>
    </div>`

  const returnToCatalog = () => openCatalogModal()
  document.querySelector('#closeProductFormModal')?.addEventListener('click', returnToCatalog)
  document.querySelector('#cancelProductFormBtn')?.addEventListener('click', returnToCatalog)
  document.querySelector('#productFormBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'productFormBackdrop') returnToCatalog()
  })

  const form = document.querySelector('#productForm')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitBtn = form.querySelector('#saveProductBtn')
    const errorBox = form.querySelector('#productFormError')

    function setFormError(message) {
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = isEditing ? 'Guardar cambios' : 'Registrar producto'
      }
      if (errorBox) {
        errorBox.textContent = message
        errorBox.classList.remove('hidden')
      }
      toast(message, 'error')
    }

    if (errorBox) {
      errorBox.textContent = ''
      errorBox.classList.add('hidden')
    }

    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = 'Guardando...'
    }

    const fd = new FormData(form)
    const rawName = String(fd.get('name') || '').trim()
    const name = rawName.toUpperCase()
    const rawPrice = String(fd.get('sale_price') || '').trim()
    const salePrice = Number(rawPrice)
    const currency = fd.get('currency') === 'USDT' ? 'USDT' : 'PEN'
    const active = fd.get('active') === 'true'

    if (!rawName) {
      setFormError('Ingresa el nombre del producto.')
      return
    }

    if (!rawPrice || isNaN(salePrice) || salePrice <= 0) {
      setFormError('El precio de venta debe ser un número mayor a 0.')
      return
    }

    const payload = {
      name,
      sale_price: salePrice,
      currency,
      active,
    }

    try {
      const query = isEditing
        ? supabase.from('products').update(payload).eq('id', product.id)
        : supabase.from('products').insert(payload)

      const { error } = await query

      if (error) {
        let friendlyError = isEditing ? 'Error al actualizar el producto.' : 'Error al crear el producto.'
        const errCode = String(error.code || '')
        const errMsg = String(error.message || '').toLowerCase()
        const errDetails = String(error.details || '').toLowerCase()

        if (
          errCode === '23505' ||
          errMsg.includes('23505') ||
          errMsg.includes('already exists') ||
          errMsg.includes('duplicate key') ||
          errMsg.includes('unique') ||
          errDetails.includes('already exists')
        ) {
          friendlyError = 'Ya existe un producto con ese nombre.'
        }

        setFormError(friendlyError)
        return
      }

      toast(isEditing ? 'Producto actualizado con éxito.' : 'Producto registrado con éxito.')
      await loadProducts(true)
      openCatalogModal()
    } catch (err) {
      setFormError('Error de conexión. Intenta nuevamente.')
    }
  })
}

async function openForm(row = null) {
  try {
    await loadProducts()
  } catch (err) {
    // Si la carga falla, el formulario continúa utilizable sin bloquearse
  }

  editingId = row?.id || null
  const host = document.querySelector('#modalHost')
  const extras = row?.extras && typeof row.extras === 'object'
    ? Object.entries(row.extras)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : ''

  host.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <section class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${editingId ? 'Editar suscripción' : 'Nueva suscripción'}</h3>
          <button id="closeModal" class="btn btn-small btn-ghost">✕</button>
        </div>
        <form id="subscriptionForm" class="modal-body">
          <div class="form-grid">
            <div class="section-title">Cliente y servicio</div>
            <label>Cliente
              <input name="client_name" required value="${escapeHtml(row?.client_name || '')}" placeholder="Nombre del cliente">
            </label>
            <label>Celular
              <input name="phone" inputmode="numeric" value="${escapeHtml(row?.phone || '')}" placeholder="987654321">
            </label>
            <label class="span-2">Servicio
              <input name="service" list="servicesList" required value="${escapeHtml(row?.service || '')}" placeholder="Ej. CHATGPT PLUS">
              <datalist id="servicesList">${getCachedServiceOptions().map((s) => `<option value="${escapeHtml(s)}"></option>`).join('')}</datalist>
            </label>

            <div class="section-title">Datos de acceso</div>
            <label>Usuario / correo
              <div class="email-input-wrapper">
                <input name="username_email" type="email" value="${escapeHtml(row?.username_email || '')}" autocomplete="off" spellcheck="false">
                <span class="email-ghost" aria-hidden="true"></span>
              </div>
            </label>
            <label>Contraseña
              <input name="password" value="${escapeHtml(row?.password || '')}" autocomplete="off">
            </label>
            <label>Perfil
              <input name="profile" value="${escapeHtml(row?.profile || '')}">
            </label>
            <label>PIN
              <input name="pin" value="${escapeHtml(row?.pin || '')}">
            </label>
            <label class="span-2">URL
              <input name="access_url" value="${escapeHtml(row?.access_url || '')}" placeholder="https://...">
            </label>

            <div class="section-title">Venta y vencimiento</div>
            <label>Fecha inicio
              <input name="start_date" type="date" value="${row?.start_date || todayISO()}">
            </label>
            <label>Fecha vencimiento
              <input name="expiry_date" type="date" required value="${row?.expiry_date || addOneMonth(todayISO())}">
            </label>
            <label>Precio de venta
              <input name="sale_price" type="number" min="0" step="0.01" value="${row?.sale_price ?? ''}">
              <select name="sale_price_currency">
                <option value="PEN">PEN (S/)</option>
                <option value="USDT" ${isUSDT(row?.sale_price_currency) ? 'selected' : ''}>USDT</option>
              </select>
              <input name="sale_price_exchange_rate" type="number" min="0" step="0.0001" placeholder="TC S/ por 1 USDT" value="${row?.sale_price_exchange_rate ?? ''}" ${isUSDT(row?.sale_price_currency) ? '' : 'hidden'}>
            </label>
            <label>Costo
              <input name="cost" type="number" min="0" step="0.01" value="${row?.cost ?? ''}">
              <select name="cost_currency">
                <option value="PEN">PEN (S/)</option>
                <option value="USDT" ${isUSDT(row?.cost_currency) ? 'selected' : ''}>USDT</option>
              </select>
              <input name="cost_exchange_rate" type="number" min="0" step="0.0001" placeholder="TC S/ por 1 USDT" value="${row?.cost_exchange_rate ?? ''}" ${isUSDT(row?.cost_currency) ? '' : 'hidden'}>
            </label>
            <label class="span-2">Proveedor
              <input name="provider" value="${escapeHtml(row?.provider || '')}">
            </label>

            <div class="section-title">Opcional</div>
            <label class="span-2">Campos extra
              <textarea name="extras_text" placeholder="Plan: Plus\nDispositivos: 1\nServidor: Principal">${escapeHtml(extras)}</textarea>
            </label>
            <label class="span-2">Notas
              <textarea name="notes" placeholder="Observaciones internas">${escapeHtml(row?.notes || '')}</textarea>
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" id="cancelModal" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">${editingId ? 'Guardar cambios' : 'Registrar suscripción'}</button>
          </div>
        </form>
      </section>
    </div>`

  const close = () => { host.innerHTML = ''; editingId = null }
  document.querySelector('#closeModal').addEventListener('click', close)
  document.querySelector('#cancelModal').addEventListener('click', close)
  document.querySelector('#backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'backdrop') close()
  })
  document.querySelector('#subscriptionForm').addEventListener('submit', saveForm)

  // Mostrar/ocultar el campo de tipo de cambio según la moneda seleccionada.
  // En PEN el TC no aplica; en USDT es obligatorio al guardar.
  const saleCurrencySelect = document.querySelector('select[name="sale_price_currency"]')
  const saleRateInput = document.querySelector('input[name="sale_price_exchange_rate"]')
  const costCurrencySelect = document.querySelector('select[name="cost_currency"]')
  const costRateInput = document.querySelector('input[name="cost_exchange_rate"]')

  saleCurrencySelect?.addEventListener('change', () => {
    saleRateInput.hidden = saleCurrencySelect.value !== 'USDT'
  })
  costCurrencySelect?.addEventListener('change', () => {
    costRateInput.hidden = costCurrencySelect.value !== 'USDT'
  })

  // Autollenado de precio y moneda desde catálogo para productos activos
  const serviceInput = document.querySelector('input[name="service"]')
  const salePriceInput = document.querySelector('input[name="sale_price"]')

  let lastAppliedService = (row?.service || '').trim().toUpperCase()

  function applyProductSuggestion() {
    const currentVal = (serviceInput?.value || '').trim().toUpperCase()
    if (!currentVal) {
      lastAppliedService = ''
      return
    }
    if (currentVal === lastAppliedService) return
    lastAppliedService = currentVal

    const prod = findActiveProduct(currentVal)
    if (!prod) return

    if (salePriceInput) {
      salePriceInput.value = prod.sale_price != null ? prod.sale_price : ''
    }

    if (saleCurrencySelect) {
      const isProdUSDT = prod.currency === 'USDT'
      saleCurrencySelect.value = isProdUSDT ? 'USDT' : 'PEN'
      if (saleRateInput) {
        saleRateInput.hidden = !isProdUSDT
        saleRateInput.value = ''
      }
    }
  }

  serviceInput?.addEventListener('change', applyProductSuggestion)
  serviceInput?.addEventListener('input', (e) => {
    if (e.inputType === 'insertReplacementText') {
      applyProductSuggestion()
    }
  })

  // Inline email domain autocomplete
  const emailInput = document.querySelector('input[name="username_email"]')
  const ghostEl = emailInput?.parentElement?.querySelector('.email-ghost')
  let currentSuggestion = ''

  // Canvas for measuring text width
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')

  function getInputFont(input) {
    const cs = getComputedStyle(input)
    return `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  }

  function getInputLetterSpacing(input) {
    const cs = getComputedStyle(input)
    const ls = cs.letterSpacing
    return ls === 'normal' ? 0 : parseFloat(ls) || 0
  }

  function measureTextWidth(text, font, letterSpacing) {
    measureCtx.font = font
    const baseWidth = measureCtx.measureText(text).width
    // Add letter-spacing: (n-1) * letterSpacing for n characters
    if (letterSpacing && text.length > 1) {
      return baseWidth + (text.length - 1) * letterSpacing
    }
    return baseWidth
  }

  function findMatchingDomain(value) {
    const atIndex = value.indexOf('@')
    if (atIndex === -1) return ''
    const typedDomain = value.slice(atIndex + 1).toLowerCase()
    if (!typedDomain) return ''
    const domains = getCachedEmailDomains()
    for (const d of domains) {
      const domain = d.slice(1) // remove leading @
      if (domain.startsWith(typedDomain) && domain !== typedDomain) {
        return domain.slice(typedDomain.length)
      }
    }
    return ''
  }

  function syncGhostStyles() {
    if (!emailInput || !ghostEl) return
    const cs = getComputedStyle(emailInput)
    // Copy only font/text metrics that affect vertical positioning
    // Do NOT copy horizontal padding/border - ghost position already accounts for input padding
    ghostEl.style.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    ghostEl.style.lineHeight = cs.lineHeight
    ghostEl.style.letterSpacing = cs.letterSpacing
    // Vertical padding/border only for baseline alignment
    ghostEl.style.paddingTop = cs.paddingTop
    ghostEl.style.paddingBottom = cs.paddingBottom
    ghostEl.style.borderTopWidth = cs.borderTopWidth
    ghostEl.style.borderBottomWidth = cs.borderBottomWidth
    ghostEl.style.boxSizing = cs.boxSizing
    // Position at the same top as the input's content box
    ghostEl.style.top = '0'
  }

  function updateGhost() {
    if (!emailInput || !ghostEl) return
    const val = emailInput.value
    const suggestion = findMatchingDomain(val)
    currentSuggestion = suggestion

    if (!suggestion) {
      ghostEl.textContent = ''
      ghostEl.style.left = '0'
      ghostEl.style.width = '0'
      return
    }

    // Ensure styles are synced (in case of dynamic changes)
    syncGhostStyles()

    // Calculate position: measure typed text width
    const font = getInputFont(emailInput)
    const letterSpacing = getInputLetterSpacing(emailInput)
    const typedWidth = measureTextWidth(val, font, letterSpacing)
    const paddingLeft = parseFloat(getComputedStyle(emailInput).paddingLeft) || 0
    const scrollLeft = emailInput.scrollLeft

    // Position ghost right after typed text, accounting for scroll
    const left = paddingLeft + typedWidth - scrollLeft
    ghostEl.textContent = suggestion
    ghostEl.style.left = `${left}px`
    // Set width to remaining space
    const inputWidth = emailInput.clientWidth
    ghostEl.style.width = `${Math.max(0, inputWidth - left)}px`
  }

  function clearGhost() {
    if (!ghostEl) return
    ghostEl.textContent = ''
    ghostEl.style.left = '0'
    ghostEl.style.width = '0'
    currentSuggestion = ''
  }

  emailInput?.addEventListener('input', updateGhost)
  emailInput?.addEventListener('scroll', updateGhost) // handle horizontal scroll

  emailInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && currentSuggestion) {
      e.preventDefault()
      const atIndex = emailInput.value.indexOf('@')
      if (atIndex !== -1) {
        emailInput.value = emailInput.value + currentSuggestion
        clearGhost()
        updateGhost()
      }
    }
    if (e.key === 'Escape') {
      clearGhost()
    }
  })

  emailInput?.addEventListener('blur', () => {
    // Delay to allow Tab to work before clearing
    setTimeout(clearGhost, 100)
  })

  // Initialize ghost in case of prefilled value
  updateGhost()
}

function parseExtras(text) {
  const out = {}
  String(text || '').split('\n').forEach((line) => {
    const i = line.indexOf(':')
    if (i <= 0) return
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    if (key && value) out[key] = value
  })
  return out
}

// Lee un importe del formulario: vacío u omitido = 0 (mismo comportamiento previo).
function readAmount(fd, name) {
  return Number(fd.get(name) || 0)
}

// Moneda de un importe: 'PEN' o 'USDT'; cualquier valor inválido cae en PEN.
function readCurrency(fd, name) {
  return normalizeCurrency(fd.get(name))
}

// Tipo de cambio (S/ por 1 USDT) asociado a la operación.
// - PEN: se guarda como null (el tipo de cambio no aplica).
// - USDT: se exige > 0; un valor nulo o no numérico rechaza el guardado.
function readExchangeRate(fd, name, currency, submit, isEdit) {
  if (currency !== 'USDT') return { rate: null, error: null }
  const raw = Number(fd.get(name) || 0)
  if (!(raw > 0)) {
    return { rate: null, error: 'Para importes en USDT debes indicar el tipo de cambio (S/ por 1 USDT).' }
  }
  return { rate: raw, error: null }
}

async function saveForm(event) {
  event.preventDefault()
  const submit = event.submitter
  submit.disabled = true
  submit.textContent = 'Guardando...'
  setLoading(true, 'Guardando...')

  const fd = new FormData(event.currentTarget)
  const startDate = fd.get('start_date')
  const expiryDate = fd.get('expiry_date')

  if (startDate && expiryDate && new Date(expiryDate) < new Date(startDate)) {
    submit.disabled = false
    submit.textContent = editingId ? 'Guardar cambios' : 'Registrar suscripción'
    setLoading(false)
    toast('La fecha de vencimiento no puede ser anterior a la fecha de inicio.', 'error')
    return
  }

  const saleCurrency = readCurrency(fd, 'sale_price_currency')
  const costCurrency = readCurrency(fd, 'cost_currency')

  const saleRate = readExchangeRate(fd, 'sale_price_exchange_rate', saleCurrency, submit, Boolean(editingId))
  if (saleRate.error) {
    submit.disabled = false
    submit.textContent = editingId ? 'Guardar cambios' : 'Registrar suscripción'
    setLoading(false)
    toast(saleRate.error, 'error')
    return
  }

  const costRate = readExchangeRate(fd, 'cost_exchange_rate', costCurrency, submit, Boolean(editingId))
  if (costRate.error) {
    submit.disabled = false
    submit.textContent = editingId ? 'Guardar cambios' : 'Registrar suscripción'
    setLoading(false)
    toast(costRate.error, 'error')
    return
  }

  const payload = {
    client_name: String(fd.get('client_name')).trim(),
    phone: String(fd.get('phone')).trim() || null,
    service: String(fd.get('service')).trim().toUpperCase(),
    username_email: String(fd.get('username_email')).trim() || null,
    password: String(fd.get('password')).trim() || null,
    profile: String(fd.get('profile')).trim() || null,
    pin: String(fd.get('pin')).trim() || null,
    access_url: String(fd.get('access_url')).trim() || null,
    sale_price: readAmount(fd, 'sale_price'),
    cost: readAmount(fd, 'cost'),
    // Moneda original del importe y tipo de cambio registrado en la operación.
    sale_price_currency: saleCurrency,
    cost_currency: costCurrency,
    sale_price_exchange_rate: saleRate.rate,
    cost_exchange_rate: costRate.rate,
    provider: String(fd.get('provider')).trim() || null,
    start_date: startDate || null,
    expiry_date: expiryDate || null,
    extras: parseExtras(fd.get('extras_text')),
    notes: String(fd.get('notes')).trim() || null,
  }

  const query = editingId
    ? supabase.from('subscriptions').update(payload).eq('id', editingId)
    : supabase.from('subscriptions').insert(payload)
  const { error } = await query

  if (error) {
    submit.disabled = false
    submit.textContent = editingId ? 'Guardar cambios' : 'Registrar suscripción'
    setLoading(false)
    return toast(error.message, 'error')
  }

  document.querySelector('#modalHost').innerHTML = ''
  editingId = null
  invalidateServiceCache()
  invalidateEmailDomainCache()
  toast('Datos guardados.')
  setLoading(false)
  await loadRows()
}

async function boot() {
  if (!isConfigured) return configScreen()

  const isRecoveryLink =
    window.location.hash.includes('type=recovery') ||
    new URLSearchParams(window.location.search).get('type') === 'recovery'

  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    session = data.session
  } catch (err) {
    session = null
    loginScreen('Error al verificar la sesión. Intenta de nuevo.')
    return
  }

  if (isRecoveryLink) {
    isResettingPassword = true
    newPasswordScreen()
  } else if (!session) {
    loginScreen()
  } else {
    appShell()
    await loadRows()
  }

  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    session = nextSession

    if (event === 'PASSWORD_RECOVERY') {
      isResettingPassword = true
      newPasswordScreen()
      return
    }

    if (isResettingPassword) {
      return
    }

    const changed = session?.access_token !== nextSession?.access_token
    if (!changed) return

    if (!session) {
      rows = []
      products = []
      productsLoaded = false
      if (catalogAbortController) {
        catalogAbortController.abort()
        catalogAbortController = null
      }
      productsLoadingPromise = null
      catalogRenderId++
      invalidateServiceCache()
      root.innerHTML = ''
      loginScreen('Sesión cerrada.')
    } else {
      appShell()
      await loadRows()
    }
  })
}

boot()
