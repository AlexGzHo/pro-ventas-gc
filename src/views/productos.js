import { supabase } from '../supabase.js'
import { escapeHtml, formatAmount } from '../utils.js'
import { toast } from '../ui/toast.js'
import { confirmDialog } from '../ui/confirm.js'
import { openModal } from '../ui/modal.js'
import { ICONS } from '../ui/icons.js'

/**
 * PRO VENTAS GC — Catálogo de Productos
 * Grid compacto con vista previa de logo, precio base y estado activo/inactivo.
 * Creación y edición 100% en ui/modal estándar sin romper el layout.
 */
export async function mountProductosView(container, options = {}) {
  let productsData = options.products || []
  let providersData = options.providers || []
  let searchTerm = ''
  let selectedStatus = 'TODOS'

  container.innerHTML = `
    <section class="hero">
      <div>
        <h2>Catálogo de Productos</h2>
        <p>Servicios, precios base sugeridos y proveedores.</p>
      </div>
      <button id="btnNewProduct" class="btn btn-primary" type="button">
        ${ICONS.plus} Nuevo producto
      </button>
    </section>

    <div class="products-view">
      <section class="toolbar">
        <div class="search-box">
          <span class="search-icon" aria-hidden="true">${ICONS.search}</span>
          <input id="productSearch" type="search" placeholder="Buscar producto o descripción..." autocomplete="off">
          <button id="productSearchClear" class="search-clear hidden" type="button" title="Limpiar búsqueda" aria-label="Limpiar búsqueda">${ICONS.close}</button>
        </div>

        <div class="filter-controls">
          <select id="statusFilter" class="filter-select" title="Filtrar por estado">
            <option value="TODOS">Estado: Todos</option>
            <option value="ACTIVE">Solo Activos</option>
            <option value="INACTIVE">Solo Inactivos</option>
          </select>
        </div>
      </section>

      <div class="results-bar">
        <div id="catalogResultsLine" class="results-line">Cargando catálogo...</div>
      </div>

      <div id="productosGrid" class="products-grid"></div>
    </div>
  `

  const gridEl = container.querySelector('#productosGrid')
  const searchInput = container.querySelector('#productSearch')
  const searchClearBtn = container.querySelector('#productSearchClear')
  const statusFilterEl = container.querySelector('#statusFilter')
  const resultsLineEl = container.querySelector('#catalogResultsLine')
  const btnNewProduct = container.querySelector('#btnNewProduct')

  async function loadData() {
    if (productsData.length && !options.forceReload) {
      if (!providersData.length) {
        const { data: provRes } = await supabase.from('providers').select('id, name').order('name', { ascending: true })
        if (provRes) providersData = provRes
      }
      renderList()
      return
    }

    gridEl.innerHTML = '<div class="empty-state">Cargando catálogo...</div>'
    resultsLineEl.textContent = 'Cargando catálogo...'

    const promises = [
      supabase.from('products').select('*').order('name', { ascending: true })
    ]
    if (!providersData.length) {
      promises.push(supabase.from('providers').select('id, name').order('name', { ascending: true }))
    }

    const [prodRes, provRes] = await Promise.all(promises)
    if (prodRes.error) {
      gridEl.innerHTML = '<div class="empty-state text-danger">Error cargando productos: ' + escapeHtml(prodRes.error.message) + '</div>'
      resultsLineEl.textContent = 'Error de carga'
      return
    }

    productsData = prodRes.data || []
    if (provRes?.data) {
      providersData = provRes.data
    }

    renderList()
  }

  async function notifyProductsChanged() {
    if (typeof options.onProductsChanged === 'function') {
      await options.onProductsChanged()
    } else {
      window.dispatchEvent(new CustomEvent('pv-products-changed', { detail: { products: productsData } }))
    }
  }

  function calculateMargin(cost, sale) {
    const c = Number(cost) || 0
    const s = Number(sale) || 0
    const margin = s - c
    const pct = s > 0 ? Math.round((margin / s) * 100) : 0
    return { margin, pct }
  }

  function renderList() {
    const q = searchTerm.toLowerCase().trim()
    const filtered = productsData.filter(p => {
      const matchSearch = !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      const matchStatus = selectedStatus === 'TODOS' || (selectedStatus === 'ACTIVE' ? p.active : !p.active)
      return matchSearch && matchStatus
    })

    const count = filtered.length
    resultsLineEl.textContent = `${count} ${count === 1 ? 'producto' : 'productos'}${selectedStatus !== 'TODOS' || q ? ' (filtrados)' : ''}`

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state">
          <strong>No se encontraron productos</strong>
          <span>Intenta modificar los filtros de búsqueda o estado.</span>
        </div>
      `
      return
    }

    gridEl.innerHTML = filtered.map(p => {
      const initials = (p.name || 'P').trim().substring(0, 2).toUpperCase()
      const logoEl = p.logo_url
        ? `<div class="product-card-logo"><img src="${escapeHtml(p.logo_url)}" alt="${escapeHtml(p.name)}" onerror="this.outerHTML='<span class=\\'product-card-logo-initials\\'>${escapeHtml(initials)}</span>'" /></div>`
        : `<div class="product-card-logo"><span class="product-card-logo-initials">${escapeHtml(initials)}</span></div>`

      const { margin, pct } = calculateMargin(p.default_cost, p.sale_price)
      const hasCost = p.default_cost !== null && p.default_cost !== undefined && p.default_cost !== ''
      const prov = providersData.find(pr => pr.id === p.provider_id)

      return `
        <article class="product-card ${p.active ? '' : 'inactive'}" data-id="${p.id}">
          <div class="product-card-top">
            ${logoEl}
            <div class="product-card-header-info">
              <h3 class="product-card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
            </div>
          </div>

          <div class="product-card-body">
            <div class="product-card-price-row">
              <span class="product-card-price">
                ${formatAmount(p.sale_price ?? 0, p.currency || 'PEN')}
              </span>
              ${hasCost ? `
                <span class="product-card-margin ${margin >= 0 ? 'positive' : 'negative'}" title="Margen estimado">
                  ${margin >= 0 ? '+' : ''}${formatAmount(margin, p.currency || 'PEN')} (${pct}%)
                </span>
              ` : ''}
            </div>

            <div class="product-card-meta">
              ${prov ? `<span>Proveedor: <strong>${escapeHtml(prov.name)}</strong></span>` : ''}
              ${p.default_cost ? `<span>Costo sugerido: ${formatAmount(p.default_cost, p.currency || 'PEN')}</span>` : ''}
            </div>

            ${p.description ? `
              <div class="product-card-desc" title="${escapeHtml(p.description)}">
                ${escapeHtml(p.description)}
              </div>
            ` : ''}
          </div>

          <div class="product-card-actions">
            <button type="button"
              class="product-status-btn ${p.active ? 'active' : 'inactive'} btn-toggle-status"
              data-id="${p.id}"
              title="Cambiar estado activo/inactivo"
            >
              ${p.active ? 'Activo' : 'Inactivo'}
            </button>

            <div class="product-action-btns">
              <button type="button" class="btn btn-small btn-ghost btn-edit-product" data-id="${p.id}" title="Editar producto" aria-label="Editar producto">
                ${ICONS.edit} Editar
              </button>
              <button type="button" class="btn btn-small btn-ghost btn-delete-product" data-id="${p.id}" title="Eliminar producto" aria-label="Eliminar producto">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        </article>
      `
    }).join('')
  }

  // --- Modal Formulario Producto (Crear / Editar) ---
  function openProductFormModal(productId = null) {
    const isEditing = Boolean(productId)
    const product = isEditing ? productsData.find(p => p.id === productId) : null

    const bodyEl = document.createElement('form')
    bodyEl.className = 'form-stack'
    bodyEl.id = 'productForm'
    bodyEl.innerHTML = `
      <label>
        Nombre del producto *
        <input type="text" id="prodNameInput" required class="form-control" value="${escapeHtml(product?.name || '')}" placeholder="Ej. NETFLIX PREMIUM" />
      </label>

      <label>
        Proveedor predeterminado
        <select id="prodProviderSelect" class="form-control">
          <option value="" ${!product?.provider_id ? 'selected' : ''}>(Sin proveedor)</option>
          ${providersData.map(prov => `
            <option value="${prov.id}" ${product?.provider_id === prov.id ? 'selected' : ''}>
              ${escapeHtml(prov.name)}
            </option>
          `).join('')}
        </select>
      </label>

      <div class="product-modal-grid-3">
        <label>
          Venta sugerida *
          <input type="number" step="0.01" min="0" id="prodPriceInput" required class="form-control" value="${product?.sale_price !== null && product?.sale_price !== undefined ? product.sale_price : ''}" placeholder="0.00" />
        </label>

        <label>
          Costo sugerido
          <input type="number" step="0.01" min="0" id="prodCostInput" class="form-control" value="${product?.default_cost !== null && product?.default_cost !== undefined ? product.default_cost : ''}" placeholder="0.00" />
        </label>

        <label>
          Moneda
          <select id="prodCurrencySelect" class="form-control">
            <option value="PEN" ${(product?.currency || 'PEN') === 'PEN' ? 'selected' : ''}>S/ (PEN)</option>
            <option value="USDT" ${product?.currency === 'USDT' ? 'selected' : ''}>USDT</option>
          </select>
        </label>
      </div>

      <div class="product-modal-grid-2">
        <label>
          Período sugerido (valor)
          <input type="number" min="1" id="prodPeriodValInput" class="form-control" value="${product?.default_period_value || ''}" placeholder="Ej. 30" />
        </label>

        <label>
          Unidad de período
          <select id="prodPeriodUnitSelect" class="form-control">
            <option value="days" ${(product?.default_period_unit || 'days') === 'days' ? 'selected' : ''}>Días</option>
            <option value="months" ${product?.default_period_unit === 'months' ? 'selected' : ''}>Meses</option>
            <option value="years" ${product?.default_period_unit === 'years' ? 'selected' : ''}>Años</option>
          </select>
        </label>
      </div>

      <label>
        URL del Logo (Opcional)
        <div class="product-logo-input-wrap">
          <input type="url" id="prodLogoInput" class="form-control" value="${escapeHtml(product?.logo_url || '')}" placeholder="https://ejemplo.com/logo.png" />
          <div id="prodLogoPreview" class="product-logo-preview-box">
            ${product?.logo_url ? `<img src="${escapeHtml(product.logo_url)}" alt="" />` : `<span class="text-muted">${ICONS.products}</span>`}
          </div>
        </div>
      </label>

      <label>
        Descripción / Notas del servicio (Opcional)
        <textarea id="prodDescInput" class="form-control" rows="2" placeholder="Características de la cuenta, reglas o información de soporte...">${escapeHtml(product?.description || '')}</textarea>
      </label>

      <label class="product-checkbox-label">
        <input type="checkbox" id="prodActiveCheck" ${product ? (product.active ? 'checked' : '') : 'checked'} />
        <span>Producto activo y visible para nuevas suscripciones</span>
      </label>
    `

    const footerEl = document.createElement('div')
    footerEl.className = 'modal-actions'
    footerEl.innerHTML = `
      <button type="button" class="btn btn-ghost" id="btnCancelProdForm">Cancelar</button>
      <button type="submit" form="productForm" class="btn btn-primary" id="btnSaveProd">
        ${isEditing ? 'Guardar Cambios' : 'Registrar Producto'}
      </button>
    `

    const modal = openModal({
      title: isEditing ? 'Editar Producto' : 'Nuevo Producto',
      subtitle: isEditing ? product.name : 'Configura un producto o servicio del catálogo.',
      body: bodyEl,
      footer: footerEl,
      size: 'md'
    })

    footerEl.querySelector('#btnCancelProdForm').addEventListener('click', () => modal.close())

    const logoInput = bodyEl.querySelector('#prodLogoInput')
    const logoPreview = bodyEl.querySelector('#prodLogoPreview')
    logoInput.addEventListener('input', () => {
      const url = logoInput.value.trim()
      if (url) {
        logoPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="" onerror="this.outerHTML='<span class=\\'text-muted\\'>${ICONS.warning}</span>'" />`
      } else {
        logoPreview.innerHTML = `<span class="text-muted">${ICONS.products}</span>`
      }
    })

    bodyEl.addEventListener('submit', async (e) => {
      e.preventDefault()
      const name = bodyEl.querySelector('#prodNameInput').value.trim()
      if (!name) {
        toast('El nombre del producto es obligatorio.', 'error')
        bodyEl.querySelector('#prodNameInput').focus()
        return
      }

      const salePriceVal = bodyEl.querySelector('#prodPriceInput').value
      const sale_price = Number(salePriceVal)
      if (isNaN(sale_price) || sale_price < 0) {
        toast('El precio de venta sugerido debe ser un número mayor o igual a 0.', 'error')
        return
      }

      const costVal = bodyEl.querySelector('#prodCostInput').value
      const default_cost = costVal !== '' ? Number(costVal) : null
      if (default_cost !== null && (isNaN(default_cost) || default_cost < 0)) {
        toast('El costo debe ser un número válido.', 'error')
        return
      }

      const periodVal = bodyEl.querySelector('#prodPeriodValInput').value
      const default_period_value = periodVal ? parseInt(periodVal, 10) : null

      const payload = {
        name,
        provider_id: bodyEl.querySelector('#prodProviderSelect').value || null,
        sale_price,
        default_cost,
        currency: bodyEl.querySelector('#prodCurrencySelect').value || 'PEN',
        default_period_value,
        default_period_unit: default_period_value ? bodyEl.querySelector('#prodPeriodUnitSelect').value : null,
        logo_url: logoInput.value.trim() || null,
        description: bodyEl.querySelector('#prodDescInput').value.trim() || null,
        active: bodyEl.querySelector('#prodActiveCheck').checked,
        updated_at: new Date().toISOString()
      }

      const submitBtn = footerEl.querySelector('#btnSaveProd')
      submitBtn.disabled = true
      submitBtn.textContent = 'Guardando...'

      try {
        if (isEditing) {
          const { error } = await supabase.from('products').update(payload).eq('id', productId)
          if (error) throw error
          toast(`Producto "${name}" actualizado con éxito.`, 'ok')
        } else {
          const { error } = await supabase.from('products').insert([payload])
          if (error) throw error
          toast(`Producto "${name}" registrado con éxito.`, 'ok')
        }

        modal.close()
        options.forceReload = true
        await loadData()
        await notifyProductsChanged()
      } catch (err) {
        console.error('Error guardando producto:', err)
        toast('Error al guardar: ' + err.message, 'error')
        submitBtn.disabled = false
        submitBtn.textContent = isEditing ? 'Guardar Cambios' : 'Registrar Producto'
      }
    })
  }

  // --- Cambio rápido de estado activo/inactivo ---
  async function toggleProductStatus(id) {
    const prod = productsData.find(p => p.id === id)
    if (!prod) return

    const nextActive = !prod.active
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      prod.active = nextActive
      renderList()
      toast(`Producto ${nextActive ? 'activado' : 'desactivado'}.`, 'ok')
      await notifyProductsChanged()
    } catch (err) {
      console.error('Error al cambiar estado:', err)
      toast('Error al actualizar estado: ' + err.message, 'error')
    }
  }

  // --- Eliminación de Producto ---
  async function handleDeleteProduct(id) {
    const prod = productsData.find(p => p.id === id)
    if (!prod) return

    // Verificar si existen suscripciones vinculadas
    const { count, error: countErr } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)

    if (countErr) {
      toast('Error al verificar suscripciones: ' + countErr.message, 'error')
      return
    }

    if (count > 0) {
      await confirmDialog({
        title: 'Producto con suscripciones asociadas',
        message: `El producto <strong>${escapeHtml(prod.name)}</strong> tiene <strong>${count}</strong> suscripción(es) vinculada(s).<br><br>No puede eliminarse para no dañar el historial. Puedes marcarlo como <strong>Inactivo</strong> para ocultarlo en nuevos registros.`,
        confirmText: 'Entendido',
        cancelText: '',
        icon: 'warning'
      })
      return
    }

    const confirmed = await confirmDialog({
      title: '¿Eliminar producto?',
      message: `¿Estás seguro de que deseas eliminar permanentemente el producto <strong>${escapeHtml(prod.name)}</strong> del catálogo?<br><br><span class="text-danger">Esta acción no se puede deshacer.</span>`,
      confirmText: 'Eliminar producto',
      cancelText: 'Cancelar',
      danger: true
    })

    if (!confirmed) return

    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error

      productsData = productsData.filter(p => p.id !== id)
      toast('Producto eliminado con éxito.', 'ok')
      renderList()
      await notifyProductsChanged()
    } catch (err) {
      console.error('Error eliminando producto:', err)
      toast('Error al eliminar: ' + err.message, 'error')
    }
  }

  // --- Event Delegation ---
  container.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-product')
    if (editBtn) {
      openProductFormModal(editBtn.dataset.id)
      return
    }

    const deleteBtn = e.target.closest('.btn-delete-product')
    if (deleteBtn) {
      handleDeleteProduct(deleteBtn.dataset.id)
      return
    }

    const statusBtn = e.target.closest('.btn-toggle-status')
    if (statusBtn) {
      toggleProductStatus(statusBtn.dataset.id)
      return
    }
  })

  // Filtros
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value
    searchClearBtn.classList.toggle('hidden', !searchTerm.trim())
    renderList()
  })

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = ''
    searchTerm = ''
    searchClearBtn.classList.add('hidden')
    searchInput.focus()
    renderList()
  })

  statusFilterEl.addEventListener('change', (e) => {
    selectedStatus = e.target.value
    statusFilterEl.classList.toggle('filter-active', selectedStatus !== 'TODOS')
    renderList()
  })

  btnNewProduct.addEventListener('click', () => {
    openProductFormModal(null)
  })

  await loadData()
}
