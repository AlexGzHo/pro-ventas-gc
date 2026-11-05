import { escapeHtml } from '../../utils.js'
import { ICONS } from '../../ui/icons.js'

export function renderProductControlHtml(row, products) {
  const selected = products.find(product => product.id === row?.product_id)
  return `
    <div class="sub-form-field field">
      <label for="subProductSearchInput">Servicio <span class="sub-req">*</span></label>
      <div class="sub-client-search-wrap" id="subProductSearchWrap">
        <div class="search-box sub-client-search-field">
          <span class="sub-client-search-icon" aria-hidden="true">${ICONS.search}</span>
          <input type="search" id="subProductSearchInput" placeholder="Buscar servicio" value="${escapeHtml(selected?.name || '')}" autocomplete="off" aria-expanded="false" aria-controls="subProductDropdown">
        </div>
        <div id="subProductDropdown" class="sub-client-dropdown sub-hidden"></div>
      </div>
      <input type="hidden" id="subProductId" name="product_id" value="${row?.product_id || ''}">
      <div class="sub-field-error" id="error_product" aria-live="polite"></div>
    </div>`
}

/** Mantiene el contrato que consume el autocompletado existente. */
export function setupProductCombo(form, products) {
  const search = form.querySelector('#subProductSearchInput')
  const hidden = form.querySelector('#subProductId')
  const dropdown = form.querySelector('#subProductDropdown')
  const wrap = form.querySelector('#subProductSearchWrap')
  function close() {
    dropdown.classList.add('sub-hidden')
    search.setAttribute('aria-expanded', 'false')
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase()
    const matches = products.filter(product => (product.name || '').toLocaleLowerCase().includes(query)).slice(0, 8)
    dropdown.innerHTML = matches.length
      ? matches.map(product => `<button type="button" class="btn btn-ghost sub-client-dropdown-item" data-product-id="${product.id}">${escapeHtml(product.name)}${!product.active ? ' (Inactivo)' : ''}</button>`).join('')
      : '<div class="sub-dropdown-empty">Sin servicios coincidentes</div>'
    dropdown.classList.remove('sub-hidden')
    search.setAttribute('aria-expanded', 'true')
  }
  search.addEventListener('focus', render)
  search.addEventListener('input', () => {
    hidden.value = ''
    hidden.dispatchEvent(new Event('change'))
    render()
  })
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (dropdown.classList.contains('sub-hidden')) render()
      dropdown.querySelector('button')?.focus()
    }
    if (event.key === 'Escape' && !dropdown.classList.contains('sub-hidden')) {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    if (event.key === 'Enter' && !dropdown.classList.contains('sub-hidden')) {
      event.preventDefault()
      dropdown.querySelector('button')?.click()
    }
  })
  dropdown.addEventListener('click', event => {
    const option = event.target.closest('[data-product-id]')
    if (!option) return
    const product = products.find(item => item.id === option.dataset.productId)
    if (!product) return
    hidden.value = product.id
    search.value = product.name
    hidden.dispatchEvent(new Event('change'))
    close()
    search.focus()
    close()
  })
  wrap.addEventListener('focusout', (event) => {
    if (!wrap.contains(event.relatedTarget)) close()
  })
  return { focus: () => search.focus() }
}
