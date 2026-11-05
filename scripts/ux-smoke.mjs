// Run with the existing Playwright installation, no app dependencies added:
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/ux-smoke.mjs
// Start Vite with VITE_SUPABASE_URL=https://ux-fixture.supabase.co and a dummy public key.
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const moduleName = process.env.PLAYWRIGHT_MODULE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const { chromium } = await import(pathToFileURL(moduleName).href)
const baseURL = process.env.UX_BASE_URL || 'http://127.0.0.1:5173'
const output = resolve(process.env.UX_OUTPUT || '/tmp/proventas-ux-capturas')
const phase = process.env.UX_PHASE || 'final'
const legacy = phase === 'L1'
const phaseNumber = /^L[1-6]$/.test(phase) ? Number(phase.slice(1)) : 6
const legacyForm = phaseNumber < 3
const legacyPanel = phaseNumber < 5
await mkdir(output, { recursive: true })
const report = { generatedAt: new Date().toISOString(), phase, baseURL, output, syntheticData: true, cases: [], errors: [], blockedExternalRequests: [], networkWrites: [] }
const userId = '3d8f71db-5e06-4859-92d6-acb57e90b74b'
const date = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
const clients = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Ejemplo', phone: '51999000111', notes: 'Datos ficticios para revisión de interfaz.', created_at: date(-30) },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Luis Demostración', phone: '@cliente_demo', notes: '', created_at: date(-20) }
]
const providers = [{ id: '33333333-3333-4333-8333-333333333333', name: 'Proveedor Demo', whatsapp: '51999000222', telegram: '@proveedor_demo', website: 'https://example.com', notes: 'Solo datos de prueba.', created_at: date(-60) }]
const products = [
  { id: '44444444-4444-4444-8444-444444444444', name: 'NETFLIX', category: 'Entretenimiento', sale_price: 20, default_cost: 9, currency: 'PEN', provider_id: providers[0].id, default_period_value: 1, default_period_unit: 'month', active: true, description: 'Servicio ficticio para revisar catálogo.', logo_url: null },
  { id: '55555555-5555-4555-8555-555555555555', name: 'CANVA PRO', category: 'Diseño', sale_price: 7, default_cost: 3, currency: 'USDT', provider_id: providers[0].id, default_period_value: 3, default_period_unit: 'month', active: true, description: 'Servicio de demostración.', logo_url: null }
]
const subscriptions = [10, 2, -4].map((days, i) => ({
  id: `66666666-6666-4666-8666-66666666666${i}`, client_id: clients[0].id, product_id: products[i % 2].id, provider_id: providers[0].id,
  client: clients[0], product: products[i % 2], provider_rel: providers[0], client_name: clients[0].name, phone: clients[0].phone,
  service: products[i % 2].name, username_email: 'demo@example.com', password: 'clave-ficticia', profile: 'Perfil Demo', pin: '0000', access_url: 'https://example.com',
  sale_price: 20 + i, cost: 9, sale_price_currency: 'PEN', cost_currency: 'PEN', sale_price_exchange_rate: null, cost_exchange_rate: null,
  start_date: date(-20), expiry_date: date(days), provider_expiry_date: date(30), extras: { Plan: 'Demo' }, notes: 'Nota ficticia.', created_by: userId, created_at: `${date(-20)}T10:00:00Z`, archived_at: null
}))
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', user_metadata: {}, app_metadata: { provider: 'email' }, created_at: '2026-01-01T00:00:00Z' }
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const session = { access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}.fixture-signature`, refresh_token: 'fixture-refresh-only', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user }
const browser = await chromium.launch({ executablePath: process.env.UX_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })

async function runViewport(viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  page.on('pageerror', (error) => report.errors.push({ viewport: viewport.width, type: 'pageerror', message: error.message }))
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'ux-fixture.supabase.co') {
      const table = url.pathname.split('/').at(-1)
      let payload = []
      if (url.pathname.includes('/auth/v1/user')) payload = user
      else if (url.pathname.includes('/auth/v1/token')) payload = session
      else if (table === 'subscriptions') payload = subscriptions
      else if (table === 'clients') payload = clients
      else if (table === 'products') payload = products
      else if (table === 'providers') payload = providers
      else if (table === 'whatsapp_templates') payload = []
      else if (table === 'subscription_renewals') payload = []
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) report.networkWrites.push({ method: request.method(), path: url.pathname, intercepted: true })
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, payload.length - 1)}/${payload.length || 0}` }, body: JSON.stringify(payload) })
      return
    }
    if (url.origin === new URL(baseURL).origin) return route.continue()
    report.blockedExternalRequests.push({ viewport: viewport.width, origin: url.origin, path: url.pathname })
    return route.abort()
  })
  await page.addInitScript((value) => localStorage.setItem('sb-ux-fixture-auth-token', JSON.stringify(value)), session)
  await page.goto(baseURL + '/#inicio', { waitUntil: 'networkidle', timeout: 30000 })

  async function capture(name, action = null) {
    const item = { viewport, name, status: 'pending' }
    report.cases.push(item)
    try {
      if (action) await action()
      await page.waitForTimeout(150)
      item.hash = await page.evaluate(() => location.hash)
      item.path = `${output}/${viewport.width}-${name}.png`
      await page.screenshot({ path: item.path, fullPage: false, timeout: 20000 })
      item.measurements = await page.evaluate(() => {
        const visible = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
        const controls = [...document.querySelectorAll('button, .btn, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select')].filter(visible)
        const issues = controls.flatMap((el) => {
          const rect = el.getBoundingClientRect()
          const expected = innerWidth <= 640 ? 44 : el.matches('.btn-small, .btn-sm') && el.closest('table, .data-table') ? 32 : 40
          return Math.abs(rect.height - expected) > 0.6 ? [{ tag: el.tagName, id: el.id, classes: el.className, height: rect.height, expected }] : []
        })
        const modal = document.querySelector('.sub-form-modal')
        const body = modal?.querySelector('.modal-body')
        const dialog = [...document.querySelectorAll('.modal, .panel')].at(-1)
        return { horizontalOverflow: document.documentElement.scrollWidth > innerWidth, controlCount: controls.length, controlIssues: issues, dialogWidth: dialog?.getBoundingClientRect().width || null, dialogClass: dialog?.className || null, modalWidth: modal?.getBoundingClientRect().width || null, modalHeight: modal?.getBoundingClientRect().height || null, modalBodyClientHeight: body?.clientHeight || null, modalBodyScrollHeight: body?.scrollHeight || null, formHeight: document.querySelector('#subscriptionForm')?.getBoundingClientRect().height || null }
      })
      item.status = 'captured'
    } catch (error) {
      item.status = 'failed'; item.error = error.message
      item.debug = await page.locator('.financial-subrow-grid, .state-usdt, #sale_currency_select, #sale_usdt').evaluateAll(elements => elements.map(el => ({ id: el.id, classes: el.className, display: getComputedStyle(el).display, value: el.value, checked: el.checked })))
    }
  }
  async function section(hash, selector) {
    await page.evaluate((value) => { location.hash = value }, hash)
    await page.waitForSelector(selector)
    await page.waitForTimeout(200)
  }
  async function checkDialogKeyboard(selector, name) {
    const item = { viewport, name, status: 'pending' }
    report.cases.push(item)
    try {
      const dialog = page.locator(selector).last()
      item.role = await dialog.getAttribute('role')
      const labelId = await dialog.getAttribute('aria-labelledby')
      item.labelled = !!labelId && await page.locator(`[id="${labelId}"]`).count() === 1
      const focusables = dialog.locator('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]):not([type="radio"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]').filter({ visible: true })
      const count = await focusables.count()
      if (!count) throw new Error('El diálogo no tiene controles visibles para probar Tab.')
      await focusables.last().focus()
      await page.keyboard.press('Tab')
      item.forwardWrapped = await focusables.first().evaluate((el) => el === document.activeElement)
      await page.keyboard.press('Shift+Tab')
      item.backwardWrapped = await focusables.last().evaluate((el) => el === document.activeElement)
      item.status = item.role === 'dialog' && item.labelled && item.forwardWrapped && item.backwardWrapped ? 'passed' : 'failed'
    } catch (error) { item.status = 'failed'; item.error = error.message }
  }
  await capture('inicio')
  await capture('suscripciones-tarjetas', async () => { await section('#suscripciones', '#cards'); const cards = page.locator('#viewCardsBtn'); if (await cards.isVisible()) await cards.click() })
  if (viewport.width > 640) await capture('suscripciones-resumen', async () => { await page.locator('#viewSummaryBtn').click() })
  else await capture('suscripciones-resumen-preferencia-movil', async () => {
    await page.evaluate(async () => { const { state } = await import('/src/state.js'); const { renderData } = await import('/src/views/suscripciones.js'); state.currentView = 'summary'; renderData() })
  })
  if (!legacyPanel && viewport.width > 640) {
    await capture('suscripciones-menu-resumen', async () => {
      await page.locator('#cards .card-menu-btn').first().click()
      const menu = page.locator('.dropdown-portaled')
      await menu.waitFor()
      const rect = await menu.boundingBox()
      if (!rect || rect.x < 0 || rect.y < 0 || rect.x + rect.width > viewport.width || rect.y + rect.height > viewport.height) throw new Error('Menú recortado fuera del viewport.')
    })
    await page.keyboard.press('Escape')
    if (await page.locator('.dropdown-portaled').count()) throw new Error('Portal del menú no se limpió al cerrar.')
  }
  await capture('nueva-suscripcion-inicial', async () => {
    await page.evaluate(async () => { const { openSubscriptionForm } = await import('/src/features/subscriptionForm.js'); await openSubscriptionForm() })
    await page.locator('#subscriptionForm').waitFor()
    await page.locator('#subClientSearchInput').evaluate((el) => el.blur())
    await page.locator('.modal-head h3').click()
  })
  if (legacyForm) report.cases.push({ viewport, name: 'nueva-suscripcion-fechas', status: 'not-applicable', reason: 'El despliegue Cambiar fechas llega en L3.' })
  else await capture('nueva-suscripcion-fechas', async () => { await page.getByText('Cambiar fechas', { exact: false }).click() })
  await capture('nueva-suscripcion-detalles', async () => {
    const details = page.locator('#subMoreOptions')
    if (await details.getAttribute('open') === null) await details.locator('summary').click()
    await page.locator('#subAccessUrlInput').scrollIntoViewIfNeeded()
  })
  await capture('nueva-suscripcion-usdt', async () => {
    const currency = page.locator('select[name="sale_price_currency"], #sale_currency_select, #sale_currency')
    if (await currency.count()) await currency.first().selectOption('USDT')
    else await page.locator('label[for="sale_usdt"]').click()
    await page.locator('input[name="sale_price"]').fill('7')
    await page.locator('input[name="sale_price_exchange_rate"]').fill('3.75')
  })
  if (!legacy) await checkDialogKeyboard('.sub-form-modal', 'modal-teclado-etiqueta')
  const closeCheck = { viewport, name: 'modal-atras', status: legacy ? 'not-applicable' : 'pending' }
  report.cases.push(closeCheck)
  if (legacy) { closeCheck.reason = 'Historial de capas llega en L2.'; await page.keyboard.press('Escape') }
  else try {
    await page.goBack()
    await page.locator('#subscriptionForm').waitFor({ state: 'detached', timeout: 3000 })
    closeCheck.status = 'passed'
  } catch (error) { closeCheck.status = 'failed'; closeCheck.error = error.message; await page.keyboard.press('Escape') }
  await capture('clientes', async () => { await section('#clientes', '#clientesList .client-card') })
  await capture(legacyPanel ? 'cliente-ficha-legacy' : 'cliente-panel', async () => { await page.locator('#clientesList .client-card').first().click(); await page.locator(legacyPanel ? '.modal' : '.panel').waitFor({ timeout: 3000 }) })
  if (!legacyPanel) {
    await checkDialogKeyboard('.panel', 'panel-teclado-etiqueta')
    const nestedCheck = { viewport, name: 'panel-editar-escape', status: 'pending' }
    report.cases.push(nestedCheck)
    try {
      await page.locator('#btnProfileEdit').click()
      await page.locator('#clientNameInput').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('#clientNameInput').waitFor({ state: 'detached', timeout: 3000 })
      nestedCheck.panelRemains = await page.locator('.panel').count() === 1
      nestedCheck.focusRestored = await page.locator('#btnProfileEdit').evaluate((el) => el === document.activeElement)
      nestedCheck.status = nestedCheck.panelRemains && nestedCheck.focusRestored ? 'passed' : 'failed'
    } catch (error) { nestedCheck.status = 'failed'; nestedCheck.error = error.message }
  }
  const panelCheck = { viewport, name: 'panel-atras-foco', status: legacyPanel ? 'not-applicable' : 'pending' }
  report.cases.push(panelCheck)
  if (legacyPanel) { panelCheck.reason = 'Panel de ficha llega en L5.'; await page.keyboard.press('Escape') }
  else try {
    await page.goBack()
    await page.locator('.panel').waitFor({ state: 'detached', timeout: 3000 })
    panelCheck.focusRestored = await page.evaluate(() => document.activeElement?.classList.contains('client-card'))
    panelCheck.status = panelCheck.focusRestored ? 'passed' : 'failed'
  } catch (error) { panelCheck.status = 'failed'; panelCheck.error = error.message; await page.keyboard.press('Escape') }
  await capture('catalogo', async () => { await section('#productos', '#productosGrid .product-card') })
  await capture('producto-modal', async () => { await page.locator('#btnNewProduct').click(); await page.locator('#prodNameInput').waitFor() })
  await page.keyboard.press('Escape')
  await capture('proveedores', async () => { await section('#proveedores', '#proveedoresList tr') })
  await capture('proveedor-modal', async () => { await page.locator('#btnNewProvider').click(); await page.locator('#provNameInput').waitFor() })
  await page.keyboard.press('Escape')
  await capture('plantillas', async () => { await section('#whatsapp-templates', '#tplReminder') })
  if (!legacy) {
    const aliasCheck = { viewport, name: 'hash-legado-nueva-suscripcion-modal', status: 'pending' }
    report.cases.push(aliasCheck)
    try {
      await page.evaluate(() => { location.hash = '#nueva-suscripcion' })
      await page.locator('#subscriptionForm').waitFor()
      aliasCheck.section = await page.evaluate(() => location.hash)
      aliasCheck.listRemains = await page.locator('#cards').count() === 1
      aliasCheck.status = aliasCheck.section === '#suscripciones' && aliasCheck.listRemains ? 'passed' : 'failed'
      await page.goBack()
      await page.locator('#subscriptionForm').waitFor({ state: 'detached', timeout: 3000 })
    } catch (error) { aliasCheck.status = 'failed'; aliasCheck.error = error.message }
  }
  if (!legacyForm && !legacyPanel) {
    const formCheck = { viewport, name: 'formulario-validacion-autocompletar-moneda', status: 'pending' }
    report.cases.push(formCheck)
    try {
      await page.evaluate(async () => { const { openSubscriptionForm } = await import('/src/features/subscriptionForm.js'); await openSubscriptionForm() })
      await page.locator('#subSaveBtn').click()
      if (await page.locator('#subClientSearchInput').getAttribute('aria-invalid') !== 'true') throw new Error('Cliente inválido sin estado accesible.')
      await page.locator('#subClientSearchInput').fill('Ana')
      await page.locator(`#subClientDropdown [data-id="${clients[0].id}"]`).click()
      await page.locator('#subSaveBtn').click()
      if (await page.locator('#subProductSearchInput').getAttribute('aria-invalid') !== 'true') throw new Error('Servicio inválido sin estado accesible.')
      await page.locator('#subProductSearchInput').fill('CANVA')
      await page.locator(`#subProductDropdown [data-product-id="${products[1].id}"]`).click()
      const values = await page.locator('#subscriptionForm').evaluate(form => ({
        client: form.querySelector('[name="client_id"]').value,
        product: form.querySelector('[name="product_id"]').value,
        sale: form.querySelector('[name="sale_price"]').value,
        cost: form.querySelector('[name="cost"]').value,
        currency: form.querySelector('#sale_currency_select').value,
        provider: form.querySelector('[name="provider_id"]').value,
        period: form.querySelector('[data-months="3"]').getAttribute('aria-pressed')
      }))
      if (values.client !== clients[0].id || values.product !== products[1].id || values.sale !== '7' || values.cost !== '3' || values.currency !== 'USDT' || values.provider !== providers[0].id || values.period !== 'true') throw new Error(`Autocompletado incorrecto: ${JSON.stringify(values)}`)
      await page.locator('#sale_exchange_rate').fill('3.75')
      await page.locator('#cost_exchange_rate').fill('3.75')
      if (await page.locator('#summary_profit').textContent() !== 'S/ 15.00') throw new Error('Ganancia USDT incorrecta.')
      await page.locator('#sale_currency_select').selectOption('PEN')
      if (await page.locator('#sale_exchange_rate').isVisible()) throw new Error('Tipo de cambio visible en PEN.')
      formCheck.status = 'passed'
      await page.goBack()
      await page.locator('#subscriptionForm').waitFor({ state: 'detached' })
    } catch (error) {
      formCheck.status = 'failed'; formCheck.error = error.message
      formCheck.debug = await page.locator('#subscriptionForm').evaluate(form => ({ errors: [...form.querySelectorAll('.sub-field-error')].map(el => ({ id: el.id, text: el.textContent })), client: form.querySelector('[name="client_id"]').value, product: form.querySelector('[name="product_id"]').value, invalid: [...form.querySelectorAll('[aria-invalid]')].map(el => ({ id: el.id, invalid: el.getAttribute('aria-invalid') })) })).catch(() => null)
    } finally {
      await page.evaluate(async () => { const { closeAllOverlays } = await import('/src/ui/overlay.js'); await closeAllOverlays() })
    }
    const resizeCheck = { viewport, name: 'preferencia-escritorio-tras-redimensionar', status: 'pending' }
    report.cases.push(resizeCheck)
    try {
      await section('#suscripciones', '#cards')
      await page.setViewportSize({ width: 1280, height: 860 })
      await page.locator('#viewSummaryBtn').click()
      await page.locator('#cards table').waitFor()
      await page.setViewportSize({ width: 360, height: 780 })
      await page.locator('#cards article').first().waitFor()
      if (await page.locator('#viewSummaryBtn').isVisible()) throw new Error('Selector de vista visible en móvil.')
      await page.setViewportSize({ width: 1280, height: 860 })
      await page.locator('#cards table').waitFor()
      resizeCheck.status = 'passed'
    } catch (error) { resizeCheck.status = 'failed'; resizeCheck.error = error.message }
  }
  await context.close()
}

try {
  for (const viewport of [{ width: 1280, height: 860 }, { width: 360, height: 780 }].filter(value => !process.env.UX_VIEWPORT || value.width === Number(process.env.UX_VIEWPORT))) await runViewport(viewport)
} catch (error) {
  report.errors.push({ type: 'harness', message: error.message })
  process.exitCode = 1
} finally {
  await browser.close()
  report.assertions = report.cases.flatMap((item) => {
    if (!item.measurements) return []
    const assertions = [{ viewport: item.viewport.width, name: `${item.name}:sin-desborde-horizontal`, passed: !item.measurements.horizontalOverflow }]
    assertions.push({ viewport: item.viewport.width, name: `${item.name}:alturas-controles`, passed: item.measurements.controlIssues.length === 0, issues: item.measurements.controlIssues })
    if (item.name === 'nueva-suscripcion-inicial') assertions.push({ viewport: item.viewport.width, name: 'nueva-suscripcion-inicial:scroll', passed: item.viewport.width > 640 ? item.measurements.modalBodyScrollHeight <= item.measurements.modalBodyClientHeight + 1 : item.measurements.formHeight <= item.viewport.height * 1.5, measurements: item.measurements })
    return assertions
  })
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ output, captured: report.cases.filter((item) => item.status === 'captured').length, passed: report.cases.filter((item) => item.status === 'passed').length, failed: report.cases.filter((item) => item.status === 'failed').map((item) => ({ viewport: item.viewport.width, name: item.name, error: item.error })), failedAssertions: report.assertions.filter((item) => !item.passed).map((item) => ({ viewport: item.viewport, name: item.name })), errors: report.errors }, null, 2))
  if (process.env.UX_STRICT === '1' && (report.errors.length || report.cases.some((item) => item.status === 'failed') || report.assertions.some((item) => !item.passed))) process.exitCode = 1
}
