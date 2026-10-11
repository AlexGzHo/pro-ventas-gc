import { supabase } from '../supabase.js'
import { escapeHtml, formatAmount } from '../utils.js'

export async function mountProductosView(container) {
  let productsData = []
  let searchTerm = ''
  let editingId = null

  container.innerHTML = `
    <section class="hero">
      <div>
        <h2>Catálogo de Productos</h2>
        <p>Directorio de servicios comercializados, precios y márgenes.</p>
      </div>
      <button id="btnNewProduct" class="btn btn-primary">+ Nuevo Producto</button>
    </section>

    <div id="productsMain">
      <section class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input id="productSearch" type="search" placeholder="Buscar producto...">
        </div>
      </section>

      <div id="productFormContainer" class="card hidden" style="margin-bottom: 20px;">
        <h3 id="productFormTitle" style="margin-top:0;">Registrar Nuevo Producto</h3>
        <form id="productFormLocal" class="form-stack" style="max-width: 600px;">
          <label>Nombre del producto *
            <input type="text" id="prodName" required class="form-control" />
          </label>
          <label>URL del Logo (Opcional)
            <input type="url" id="prodLogoUrl" class="form-control" placeholder="https://..." />
          </label>

          <div style="display:flex; gap:10px;">
            <label style="flex:1;">Costo sugerido
              <input type="number" step="0.01" min="0" id="prodCost" class="form-control" />
            </label>
            <label style="flex:1;">Venta sugerida *
              <input type="number" step="0.01" min="0" required id="prodPrice" class="form-control" />
            </label>
            <label style="flex:1;">Moneda
              <select id="prodCurrency" class="form-control">
                <option value="PEN">PEN (S/)</option>
                <option value="USDT">USDT</option>
              </select>
            </label>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
             <label style="margin:0; display:flex; align-items:center; gap:5px;">
               <input type="checkbox" id="prodActive" checked> Producto activo y visible
             </label>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button type="submit" class="btn btn-primary">Guardar</button>
            <button type="button" id="productFormCancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </form>
      </div>

      <div class="summary-view-wrapper">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Costo Sugerido</th>
              <th>Venta Sugerida</th>
              <th>Margen Est.</th>
              <th>Estado</th>
              <th style="width: 80px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="productosList">
            <tr><td colspan="6">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `

  const listEl = container.querySelector('#productosList')
  const formContainer = container.querySelector('#productFormContainer')
  const form = container.querySelector('#productFormLocal')
  const searchInput = container.querySelector('#productSearch')

  async function loadData() {
    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>'
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) {
      listEl.innerHTML = '<tr><td colspan="6">Error cargando productos.</td></tr>'
      return
    }
    productsData = data || []
    renderList()
  }

  function renderList() {
    const q = searchTerm.toLowerCase().trim()
    const filtered = productsData.filter(p => {
      return !q || (p.name || '').toLowerCase().includes(q)
    })

    if (filtered.length === 0) {
      listEl.innerHTML = '<tr><td colspan="6" class="empty-state">No se encontraron productos.</td></tr>'
      return
    }

    listEl.innerHTML = filtered.map(p => {
      const cost = Number(p.default_cost || 0)
      const sale = Number(p.sale_price || 0)
      const margin = sale - cost
      const marginPct = sale > 0 ? (margin / sale * 100).toFixed(0) : 0
      const curr = p.currency || 'PEN'

      const logoHtml = p.logo_url
        ? `<img src="${escapeHtml(p.logo_url)}" alt="logo" style="width:24px; height:24px; border-radius:4px;">`
        : `<div style="width:24px; height:24px; border-radius:4px; background:var(--border-strong); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold;">${p.name.substring(0,2).toUpperCase()}</div>`

      return `
        <tr style="opacity: ${p.active ? '1' : '0.5'};">
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
               ${logoHtml}
               <div style="font-weight: 500;">${escapeHtml(p.name)}</div>
            </div>
          </td>
          <td>${p.default_cost ? formatAmount(p.default_cost, curr) : '<span style="color:var(--text-muted);">—</span>'}</td>
          <td>${formatAmount(p.sale_price, curr)}</td>
          <td>
             <span style="color:${margin > 0 ? 'var(--status-ok-text)' : (margin < 0 ? 'var(--status-err-text)' : 'inherit')}">
                ${formatAmount(margin, curr)} (${marginPct}%)
             </span>
          </td>
          <td>
            ${p.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-neutral">Inactivo</span>'}
          </td>
          <td>
            <div style="display:flex; gap: 8px;">
              <button class="btn btn-small btn-ghost btn-edit-prod" data-id="${p.id}">✎</button>
            </div>
          </td>
        </tr>
      `
    }).join('')
  }

  container.addEventListener('click', (e) => {
    if (e.target.closest('.btn-edit-prod')) {
      const id = e.target.closest('.btn-edit-prod').dataset.id
      const p = productsData.find(x => x.id === id)
      if (p) {
        editingId = id
        document.getElementById('productFormTitle').textContent = 'Editar Producto'
        document.getElementById('prodName').value = p.name || ''
        document.getElementById('prodLogoUrl').value = p.logo_url || ''
        document.getElementById('prodCost').value = p.default_cost || ''
        document.getElementById('prodPrice').value = p.sale_price !== null ? p.sale_price : ''
        document.getElementById('prodCurrency').value = p.currency || 'PEN'
        document.getElementById('prodActive').checked = p.active
        formContainer.classList.remove('hidden')
        document.getElementById('prodName').focus()
      }
    }
  })

  document.getElementById('btnNewProduct').addEventListener('click', () => {
    editingId = null
    form.reset()
    document.getElementById('productFormTitle').textContent = 'Registrar Nuevo Producto'
    document.getElementById('prodActive').checked = true
    formContainer.classList.remove('hidden')
    document.getElementById('prodName').focus()
  })

  document.getElementById('productFormCancel').addEventListener('click', () => {
    formContainer.classList.add('hidden')
    form.reset()
    editingId = null
  })

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value
    renderList()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('prodName').value.trim()
    const logo_url = document.getElementById('prodLogoUrl').value.trim() || null
    const default_cost = document.getElementById('prodCost').value || null
    const sale_price = document.getElementById('prodPrice').value || 0
    const currency = document.getElementById('prodCurrency').value
    const active = document.getElementById('prodActive').checked

    const payload = { name, logo_url, default_cost, sale_price, currency, active }
    const btn = form.querySelector('button[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Guardando...'

    if (editingId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId)
      if (error) alert('Error al actualizar: ' + error.message)
    } else {
      const { error } = await supabase.from('products').insert([payload])
      if (error) alert('Error al guardar: ' + error.message)
    }

    btn.disabled = false
    btn.textContent = 'Guardar'
    formContainer.classList.add('hidden')
    form.reset()
    editingId = null
    await loadData()
  })

  await loadData()
}
