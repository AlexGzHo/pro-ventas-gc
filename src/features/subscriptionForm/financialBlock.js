/**
 * PRO VENTAS GC — Bloque Financiero para Suscripciones
 * Cálculo reactivo en tiempo real entre PEN y USDT con tipo de cambio y márgenes.
 */

/**
 * Genera el markup HTML del bloque financiero para precio de venta o costo mayorista.
 * Cero atributos style en línea.
 * 
 * @param {'sale'|'cost'} prefix - Prefijo de campo ('sale' o 'cost')
 * @param {string} title - Título visible del bloque
 * @param {Object|null} row - Datos iniciales de la suscripción
 * @returns {string} Markup HTML
 */
export function createFinancialBlock(prefix, title, row) {
  const price = row?.[prefix + '_price'] ?? (prefix === 'cost' ? row?.cost : null) ?? ''
  const currency = row?.[prefix + '_price_currency'] ?? (prefix === 'cost' ? row?.cost_currency : null) ?? 'PEN'
  const rate = row?.[prefix + '_price_exchange_rate'] ?? (prefix === 'cost' ? row?.cost_exchange_rate : null) ?? ''
  const isUsdt = currency === 'USDT'

  return `
    <div class="financial-group">
      <label for="${prefix}_price_input">${title}</label>

      <div class="financial-input-row">
        <input id="${prefix}_price_input" name="${prefix === 'sale' ? 'sale_price' : 'cost'}" type="number" inputmode="decimal" min="0" step="0.01" value="${price}" placeholder="0.00" autocomplete="off">
        <select id="${prefix}_currency_select" class="financial-currency-select" aria-label="Moneda de ${title.toLowerCase()}">
          <option value="PEN" ${!isUsdt ? 'selected' : ''}>S/</option>
          <option value="USDT" ${isUsdt ? 'selected' : ''}>USDT</option>
        </select>
        <div class="sub-hidden">
          <input type="radio" class="sr-only" id="${prefix}_pen" name="${prefix === 'sale' ? 'sale_price_currency' : 'cost_currency'}" value="PEN" ${!isUsdt ? 'checked' : ''}>
          <input type="radio" class="sr-only" id="${prefix}_usdt" name="${prefix === 'sale' ? 'sale_price_currency' : 'cost_currency'}" value="USDT" ${isUsdt ? 'checked' : ''}>
        </div>
      </div>

      <div class="financial-subrow-grid">
        <div id="${prefix}_usdt_info" class="subrow-state state-usdt ${isUsdt ? 'active' : ''}">
          <span class="tc-wrapper">
            <label for="${prefix}_exchange_rate">Tipo de cambio</label>
            <input id="${prefix}_exchange_rate" name="${prefix === 'sale' ? 'sale_price_exchange_rate' : 'cost_exchange_rate'}" type="number" inputmode="decimal" step="0.0001" value="${rate}" placeholder="3.75">
          </span>
          <span>Equivalente <strong class="equiv-amount" id="${prefix}_equiv_usdt">Ingresa el tipo de cambio</strong></span>
        </div>
      </div>
      ${prefix === 'cost' ? '<button type="button" id="copy_tc_btn" class="btn btn-small btn-ghost copy-tc-btn sub-hidden">Copiar TC de venta</button>' : ''}
    </div>
  `
}

/**
 * Vincula los eventos de recálculo dinámico de divisas en tiempo real.
 * 
 * @param {HTMLFormElement|HTMLElement} form - Formulario o contenedor que contiene los bloques financieros
 */
export function bindFinancialEvents(form) {
  const saleInput = form.querySelector('input[name="sale_price"]')
  const costInput = form.querySelector('input[name="cost"]')
  const saleTCR = form.querySelector('input[name="sale_price_exchange_rate"]')
  const costTCR = form.querySelector('input[name="cost_exchange_rate"]')
  const copyBtn = form.querySelector('#copy_tc_btn')

  for (const prefix of ['sale', 'cost']) {
    const select = form.querySelector(`#${prefix}_currency_select`)
    const syncCurrency = event => {
      const radio = form.querySelector(`#${prefix}_${event.target.value === 'USDT' ? 'usdt' : 'pen'}`)
      if (radio) radio.checked = true
      update()
    }
    // El input nativo precede a change: sincronizar antes del recálculo del form.
    select?.addEventListener('input', syncCurrency)
    select?.addEventListener('change', syncCurrency)
  }

  function update() {
    const saleVal = Number(saleInput?.value) || 0
    const costVal = Number(costInput?.value) || 0
    const saleC = form.querySelector('input[name="sale_price_currency"]:checked')?.value || 'PEN'
    const costC = form.querySelector('input[name="cost_currency"]:checked')?.value || 'PEN'
    const saleSelect = form.querySelector('#sale_currency_select')
    const costSelect = form.querySelector('#cost_currency_select')
    if (saleSelect) saleSelect.value = saleC
    if (costSelect) costSelect.value = costC

    const salePrefix = form.querySelector('#sale_prefix')
    const costPrefix = form.querySelector('#cost_prefix')
    if (salePrefix) salePrefix.textContent = saleC === 'USDT' ? 'USDT' : 'S/'
    if (costPrefix) costPrefix.textContent = costC === 'USDT' ? 'USDT' : 'S/'

    form.querySelector('#sale_pen_info')?.classList.toggle('active', saleC === 'PEN')
    form.querySelector('#sale_usdt_info')?.classList.toggle('active', saleC === 'USDT')

    form.querySelector('#cost_pen_info')?.classList.toggle('active', costC === 'PEN')
    form.querySelector('#cost_usdt_info')?.classList.toggle('active', costC === 'USDT')

    if (copyBtn) {
      copyBtn.classList.toggle('sub-hidden', !(saleC === 'USDT' && costC === 'USDT'))
    }

    const saleTC = Number(saleTCR?.value) || 0
    const costTC = Number(costTCR?.value) || 0

    const salePenCalc = saleC === 'PEN' ? saleVal : (saleTC > 0 ? saleVal * saleTC : 0)
    const costPenCalc = costC === 'PEN' ? costVal : (costTC > 0 ? costVal * costTC : 0)

    const saleEquivPen = form.querySelector('#sale_equiv_pen')
    if (saleEquivPen) saleEquivPen.textContent = 'S/ ' + salePenCalc.toFixed(2)

    const saleEquivUsdt = form.querySelector('#sale_equiv_usdt')
    if (saleEquivUsdt && saleC === 'USDT') {
      saleEquivUsdt.textContent = saleTC > 0 ? '≈ S/ ' + salePenCalc.toFixed(2) : 'Ingresa el tipo de cambio'
    }

    const costEquivPen = form.querySelector('#cost_equiv_pen')
    if (costEquivPen) costEquivPen.textContent = 'S/ ' + costPenCalc.toFixed(2)

    const costEquivUsdt = form.querySelector('#cost_equiv_usdt')
    if (costEquivUsdt && costC === 'USDT') {
      costEquivUsdt.textContent = costTC > 0 ? '≈ S/ ' + costPenCalc.toFixed(2) : 'Ingresa el tipo de cambio'
    }

    const summarySale = form.querySelector('#summary_sale')
    const summaryCost = form.querySelector('#summary_cost')
    const summaryProfit = form.querySelector('#summary_profit')

    if (summarySale) summarySale.textContent = 'S/ ' + salePenCalc.toFixed(2)
    if (summaryCost) summaryCost.textContent = 'S/ ' + costPenCalc.toFixed(2)
    if (summaryProfit) {
      const profit = salePenCalc - costPenCalc
      summaryProfit.textContent = 'S/ ' + profit.toFixed(2)
      summaryProfit.classList.toggle('sub-profit-positive', profit >= 0)
      summaryProfit.classList.toggle('sub-profit-negative', profit < 0)
    }
  }

  form.addEventListener('input', update)
  form.addEventListener('change', update)
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (costTCR && saleTCR) {
        costTCR.value = saleTCR.value
        update()
      }
    })
  }

  update()
}
