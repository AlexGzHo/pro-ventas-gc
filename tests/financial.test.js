import {
  normalizeCurrency,
  isUSDT,
  formatMoney,
  formatUSDT,
  formatAmount,
  currencyLabel,
  amountInPEN,
  amountInUSDT,
  convertPENToUSDT,
} from '../src/utils.js'

let passCount = 0
let failCount = 0
const failures = []

function assert(condition, message) {
  if (condition) {
    passCount++
    console.log(`✅ PASS: ${message}`)
  } else {
    failCount++
    failures.push(message)
    console.log(`❌ FAIL: ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  const pass = actual === expected
  if (!pass) {
    failCount++
    failures.push(`${message} - Expected: "${expected}", Got: "${actual}"`)
    console.log(`❌ FAIL: ${message} - Expected: "${expected}", Got: "${actual}"`)
  } else {
    passCount++
    console.log(`✅ PASS: ${message}`)
  }
}

function assertClose(actual, expected, tolerance, message) {
  const pass = Math.abs(actual - expected) <= tolerance
  if (!pass) {
    failCount++
    failures.push(`${message} - Expected: ~${expected}, Got: ${actual}`)
    console.log(`❌ FAIL: ${message} - Expected: ~${expected}, Got: ${actual}`)
  } else {
    passCount++
    console.log(`✅ PASS: ${message}`)
  }
}

console.log('=== Financial Module Tests ===\n')

console.log('--- normalizeCurrency ---')
{
  assertEqual(normalizeCurrency('PEN'), 'PEN', 'PEN uppercase')
  assertEqual(normalizeCurrency('pen'), 'PEN', 'PEN lowercase')
  assertEqual(normalizeCurrency(' Pen '), 'PEN', 'PEN with spaces')
  assertEqual(normalizeCurrency('USDT'), 'USDT', 'USDT uppercase')
  assertEqual(normalizeCurrency('usdt'), 'USDT', 'USDT lowercase')
  assertEqual(normalizeCurrency('UsDt'), 'USDT', 'USDT mixed case')
  assertEqual(normalizeCurrency(''), 'PEN', 'Empty defaults to PEN')
  assertEqual(normalizeCurrency(null), 'PEN', 'Null defaults to PEN')
  assertEqual(normalizeCurrency(undefined), 'PEN', 'Undefined defaults to PEN')
  assertEqual(normalizeCurrency('EUR'), 'PEN', 'Invalid currency defaults to PEN')
  assertEqual(normalizeCurrency('USD'), 'PEN', 'USD defaults to PEN')
}

console.log('\n--- isUSDT ---')
{
  assert(isUSDT('USDT'), 'USDT returns true')
  assert(isUSDT('usdt'), 'usdt returns true')
  assert(!isUSDT('PEN'), 'PEN returns false')
  assert(!isUSDT('pen'), 'pen returns false')
  assert(!isUSDT(''), 'Empty returns false')
  assert(!isUSDT(null), 'Null returns false')
  assert(!isUSDT('EUR'), 'EUR returns false')
}

console.log('\n--- formatMoney (PEN formatting) ---')
{
  // Intl.NumberFormat uses non-breaking space (U+00A0) and currency symbol
  const nbsp = '\u00A0'
  assertEqual(formatMoney(0), `S/${nbsp}0.00`, 'Zero')
  assertEqual(formatMoney(100), `S/${nbsp}100.00`, 'Integer')
  assertEqual(formatMoney(49.9), `S/${nbsp}49.90`, 'One decimal')
  assertEqual(formatMoney(49.999), `S/${nbsp}50.00`, 'Rounds up')
  assertEqual(formatMoney(1234.56), `S/${nbsp}1,234.56`, 'Thousands separator')
  assertEqual(formatMoney('100'), `S/${nbsp}100.00`, 'String input')
  assertEqual(formatMoney(null), `S/${nbsp}0.00`, 'Null treated as 0')
  assertEqual(formatMoney(undefined), `S/${nbsp}0.00`, 'Undefined treated as 0')
  assertEqual(formatMoney(-50), `-S/${nbsp}50.00`, 'Negative value')
}

console.log('\n--- formatUSDT ---')
{
  // Intl.NumberFormat('es-PE', {style:'currency', currency:'USD'}) uses "USD" symbol
  const nbsp = '\u00A0'
  assertEqual(formatUSDT(0), `USD${nbsp}0.00`, 'Zero')
  assertEqual(formatUSDT(100), `USD${nbsp}100.00`, 'Integer')
  assertEqual(formatUSDT(13.33), `USD${nbsp}13.33`, 'Two decimals')
  assertEqual(formatUSDT(13.335), `USD${nbsp}13.34`, 'Rounds up')
  assertEqual(formatUSDT('100'), `USD${nbsp}100.00`, 'String input')
  assertEqual(formatUSDT(null), `USD${nbsp}0.00`, 'Null treated as 0')
}

console.log('\n--- formatAmount (currency-aware formatting) ---')
{
  const nbsp = '\u00A0'
  assertEqual(formatAmount(100, 'PEN'), `S/${nbsp}100.00`, 'PEN currency')
  assertEqual(formatAmount(100, 'pen'), `S/${nbsp}100.00`, 'PEN lowercase')
  assertEqual(formatAmount(100, 'USDT'), `USD${nbsp}100.00`, 'USDT currency')
  assertEqual(formatAmount(100, 'usdt'), `USD${nbsp}100.00`, 'USDT lowercase')
  assertEqual(formatAmount(100, 'EUR'), `S/${nbsp}100.00`, 'Invalid defaults to PEN')
  assertEqual(formatAmount(100, ''), `S/${nbsp}100.00`, 'Empty defaults to PEN')
}

console.log('\n--- currencyLabel ---')
{
  assertEqual(currencyLabel('PEN'), 'PEN', 'PEN label')
  assertEqual(currencyLabel('USDT'), 'USDT', 'USDT label')
  assertEqual(currencyLabel('pen'), 'PEN', 'Lowercase PEN')
  assertEqual(currencyLabel('usdt'), 'USDT', 'Lowercase USDT')
  assertEqual(currencyLabel('EUR'), 'PEN', 'Invalid defaults to PEN')
  assertEqual(currencyLabel(''), 'PEN', 'Empty defaults to PEN')
}

console.log('\n--- amountInPEN (conversion to PEN using operation exchange rate) ---')
{
  // PEN amounts: no conversion, exchange rate ignored
  assertEqual(amountInPEN(100, 'PEN', 3.75), 100, 'PEN sale: returns same amount, ignores rate')
  assertEqual(amountInPEN(100, 'pen', 3.75), 100, 'PEN lowercase')
  assertEqual(amountInPEN(0, 'PEN', 3.75), 0, 'Zero PEN')
  assertEqual(amountInPEN(49.9, 'PEN', 3.75), 49.9, 'Decimal PEN')

  // USDT amounts: convert using provided exchange rate
  assertClose(amountInPEN(10, 'USDT', 3.75), 37.5, 0.01, 'USDT 10 @ 3.75 = 37.50 PEN')
  assertClose(amountInPEN(13.33, 'USDT', 3.75), 49.9875, 0.01, 'USDT 13.33 @ 3.75')
  assertClose(amountInPEN(1, 'USDT', 4.0), 4.0, 0.01, 'USDT 1 @ 4.0 = 4.0 PEN')

  // Invalid/zero exchange rate for USDT: returns original amount (no conversion)
  assertEqual(amountInPEN(10, 'USDT', 0), 10, 'USDT with rate 0 returns original')
  assertEqual(amountInPEN(10, 'USDT', null), 10, 'USDT with null rate returns original')
  assertEqual(amountInPEN(10, 'USDT', undefined), 10, 'USDT with undefined rate returns original')
  assertEqual(amountInPEN(10, 'USDT', -1), 10, 'USDT with negative rate returns original')

  // Invalid currency defaults to PEN (no conversion)
  assertEqual(amountInPEN(100, 'EUR', 3.75), 100, 'Invalid currency treated as PEN')
  assertEqual(amountInPEN(100, '', 3.75), 100, 'Empty currency treated as PEN')

  // Null/undefined amount treated as 0
  assertEqual(amountInPEN(null, 'PEN', 3.75), 0, 'Null amount = 0')
  assertEqual(amountInPEN(undefined, 'PEN', 3.75), 0, 'Undefined amount = 0')
  assertEqual(amountInPEN('', 'PEN', 3.75), 0, 'Empty string amount = 0')
}

console.log('\n--- amountInUSDT (conversion from PEN to USDT) ---')
{
  // USDT amounts: no conversion, exchange rate ignored
  assertEqual(amountInUSDT(10, 'USDT', 3.75), 10, 'USDT: returns same amount')
  assertEqual(amountInUSDT(0, 'USDT', 3.75), 0, 'Zero USDT')

  // PEN amounts: convert using provided exchange rate
  assertClose(amountInUSDT(37.5, 'PEN', 3.75), 10, 0.01, 'PEN 37.5 @ 3.75 = 10 USDT')
  assertClose(amountInUSDT(100, 'PEN', 4.0), 25, 0.01, 'PEN 100 @ 4.0 = 25 USDT')
  assertClose(amountInUSDT(49.99, 'PEN', 3.75), 13.330666, 0.01, 'PEN 49.99 @ 3.75')

  // Invalid/zero exchange rate for PEN: returns original amount
  assertEqual(amountInUSDT(100, 'PEN', 0), 100, 'PEN with rate 0 returns original')
  assertEqual(amountInUSDT(100, 'PEN', null), 100, 'PEN with null rate returns original')
  assertEqual(amountInUSDT(100, 'PEN', undefined), 100, 'PEN with undefined rate returns original')
  assertEqual(amountInUSDT(100, 'PEN', -1), 100, 'PEN with negative rate returns original')

  // Invalid currency treated as PEN
  assertClose(amountInUSDT(100, 'EUR', 4.0), 25, 0.01, 'Invalid currency treated as PEN')

  // Null/undefined amount treated as 0
  assertEqual(amountInUSDT(null, 'PEN', 3.75), 0, 'Null amount = 0')
  assertEqual(amountInUSDT(undefined, 'PEN', 3.75), 0, 'Undefined amount = 0')
}

console.log('\n--- convertPENToUSDT (direct PEN to USDT conversion) ---')
{
  assertClose(convertPENToUSDT(37.5, 3.75), 10, 0.01, '37.5 PEN @ 3.75 = 10 USDT')
  assertClose(convertPENToUSDT(100, 4.0), 25, 0.01, '100 PEN @ 4.0 = 25 USDT')
  assertClose(convertPENToUSDT(0, 3.75), 0, 0.01, 'Zero PEN = 0 USDT')

  // Zero or invalid rate returns 0
  assertEqual(convertPENToUSDT(100, 0), 0, 'Rate 0 returns 0')
  assertEqual(convertPENToUSDT(100, null), 0, 'Null rate returns 0')
  assertEqual(convertPENToUSDT(100, undefined), 0, 'Undefined rate returns 0')
  assertEqual(convertPENToUSDT(100, -1), 0, 'Negative rate returns 0')

  // Null/undefined amount treated as 0
  assertEqual(convertPENToUSDT(null, 3.75), 0, 'Null amount = 0')
  assertEqual(convertPENToUSDT(undefined, 3.75), 0, 'Undefined amount = 0')
  assertEqual(convertPENToUSDT('', 3.75), 0, 'Empty string amount = 0')
}

console.log('\n--- Cross-currency scenarios (real-world combinations) ---')
{
  // Scenario 1: Both sale and cost in PEN
  const salePEN = amountInPEN(100, 'PEN', null)
  const costPEN = amountInPEN(60, 'PEN', null)
  assertEqual(salePEN, 100, 'Sale in PEN: 100')
  assertEqual(costPEN, 60, 'Cost in PEN: 60')
  assertEqual(salePEN - costPEN, 40, 'Profit PEN: 40')

  // Scenario 2: Both sale and cost in USDT (same rate)
  const rate = 3.75
  const saleUSDT = amountInPEN(10, 'USDT', rate)
  const costUSDT = amountInPEN(6, 'USDT', rate)
  assertClose(saleUSDT, 37.5, 0.01, 'Sale USDT 10 @ 3.75 = 37.5 PEN')
  assertClose(costUSDT, 22.5, 0.01, 'Cost USDT 6 @ 3.75 = 22.5 PEN')
  assertClose(saleUSDT - costUSDT, 15, 0.01, 'Profit: 15 PEN')

  // Scenario 3: Sale in PEN, Cost in USDT
  const sale3 = amountInPEN(150, 'PEN', null)
  const cost3 = amountInPEN(20, 'USDT', 3.80)
  assertEqual(sale3, 150, 'Sale PEN: 150')
  assertClose(cost3, 76, 0.01, 'Cost USDT 20 @ 3.80 = 76 PEN')
  assertClose(sale3 - cost3, 74, 0.01, 'Profit: 74 PEN')

  // Scenario 4: Sale in USDT, Cost in PEN
  const sale4 = amountInPEN(25, 'USDT', 3.70)
  const cost4 = amountInPEN(50, 'PEN', null)
  assertClose(sale4, 92.5, 0.01, 'Sale USDT 25 @ 3.70 = 92.5 PEN')
  assertEqual(cost4, 50, 'Cost PEN: 50')
  assertClose(sale4 - cost4, 42.5, 0.01, 'Profit: 42.5 PEN')

  // Scenario 5: Different rates for sale and cost (realistic)
  const saleRate = 3.75
  const costRate = 3.70
  const sale5 = amountInPEN(10, 'USDT', saleRate)
  const cost5 = amountInPEN(8, 'USDT', costRate)
  assertClose(sale5, 37.5, 0.01, 'Sale USDT 10 @ 3.75')
  assertClose(cost5, 29.6, 0.01, 'Cost USDT 8 @ 3.70')
  assertClose(sale5 - cost5, 7.9, 0.01, 'Profit with different rates')
}

console.log('\n--- Profit calculations (positive, negative, zero) ---')
{
  // Positive profit
  assertClose(amountInPEN(100, 'PEN') - amountInPEN(60, 'PEN'), 40, 0.01, 'Positive profit PEN')

  // Negative profit (loss)
  assertClose(amountInPEN(50, 'PEN') - amountInPEN(80, 'PEN'), -30, 0.01, 'Negative profit PEN')

  // Zero profit (break-even)
  assertClose(amountInPEN(100, 'PEN') - amountInPEN(100, 'PEN'), 0, 0.01, 'Zero profit PEN')

  // USDT cross-currency positive
  const s = amountInPEN(20, 'USDT', 4.0)
  const c = amountInPEN(10, 'USDT', 4.0)
  assertClose(s - c, 40, 0.01, 'Positive profit USDT')

  // USDT cross-currency negative
  const s2 = amountInPEN(10, 'USDT', 4.0)
  const c2 = amountInPEN(20, 'USDT', 4.0)
  assertClose(s2 - c2, -40, 0.01, 'Negative profit USDT')
}

console.log('\n--- Edge cases: empty, null, invalid values ---')
{
  // Empty strings
  assertEqual(amountInPEN('', 'PEN', 3.75), 0, 'Empty sale price')
  assertEqual(amountInPEN('', 'USDT', 3.75), 0, 'Empty sale price USDT')
  assertEqual(amountInPEN(100, '', 3.75), 100, 'Empty currency defaults to PEN')

  // Null values
  assertEqual(amountInPEN(null, 'PEN', 3.75), 0, 'Null sale price')
  assertEqual(amountInPEN(100, null, 3.75), 100, 'Null currency defaults to PEN')

  // Invalid numeric strings - Number() returns NaN, not 0
  assert(Number.isNaN(amountInPEN('abc', 'PEN', 3.75)), 'Non-numeric sale price = NaN')
  assert(Number.isNaN(amountInPEN('100abc', 'PEN', 3.75)), 'Partial numeric string = NaN')

  // Very large numbers
  assertEqual(amountInPEN(1e10, 'PEN', 3.75), 1e10, 'Large PEN amount')
  assertClose(amountInPEN(1e6, 'USDT', 3.75), 3.75e6, 0.01, 'Large USDT amount')

  // Very small numbers
  assertClose(amountInPEN(0.01, 'USDT', 3.75), 0.0375, 0.0001, 'Small USDT amount')
}

console.log('\n--- Rounding and precision (matching SQL GENERATED columns) ---')
{
  // SQL uses ROUND((sale_price * sale_exchange_rate)::numeric, 2)
  // JavaScript: amountInPEN uses direct multiplication without explicit rounding
  // Test that JS behavior matches expected precision

  // Case: 13.33 * 3.75 = 49.9875 -> SQL ROUND to 2 decimals = 49.99
  const jsResult = amountInPEN(13.33, 'USDT', 3.75)
  const sqlExpected = Math.round(13.33 * 3.75 * 100) / 100
  assertClose(jsResult, 49.9875, 0.0001, 'JS precision: 13.33 * 3.75')
  assertEqual(sqlExpected, 49.99, 'SQL ROUND(,2) would give 49.99')

  // Case: 10 * 3.75 = 37.5 -> no rounding needed
  assertEqual(amountInPEN(10, 'USDT', 3.75), 37.5, 'Exact multiplication')

  // Case: 100 * 3.777 = 377.7 -> SQL rounds to 377.70
  const jsResult2 = amountInPEN(100, 'USDT', 3.777)
  const sqlExpected2 = Math.round(100 * 3.777 * 100) / 100
  assertClose(jsResult2, 377.7, 0.01, 'JS: 100 * 3.777')
  assertEqual(sqlExpected2, 377.7, 'SQL ROUND(,2) gives 377.70')

  // Note: JS does not auto-round to 2 decimals like SQL GENERATED columns
  // This is a known difference - JS keeps full precision, SQL stores rounded
}

console.log('\n--- Consistency: amountInPEN <-> amountInUSDT round-trip ---')
{
  const rate = 3.75
  const originalPEN = 100
  const toUSDT = amountInUSDT(originalPEN, 'PEN', rate)
  const backToPEN = amountInPEN(toUSDT, 'USDT', rate)
  assertClose(backToPEN, originalPEN, 0.01, 'PEN -> USDT -> PEN round-trip')

  // USDT -> PEN -> USDT: start with USDT, convert to PEN, then back to USDT
  const originalUSDT = 25
  const toPEN = amountInPEN(originalUSDT, 'USDT', rate)
  const backToUSDT = amountInUSDT(toPEN, 'PEN', rate)  // Must use 'PEN' to convert back
  assertClose(backToUSDT, originalUSDT, 0.01, 'USDT -> PEN -> USDT round-trip')

  // With different rates (asymmetric - not expected to round-trip perfectly)
  const rate1 = 3.75
  const rate2 = 3.80
  const asymmetric = amountInUSDT(amountInPEN(10, 'USDT', rate1), 'PEN', rate2)
  assertClose(asymmetric, 10 * (rate1 / rate2), 0.01, 'Asymmetric rates')
}

console.log('\n--- KPI Financial calculations (from app.js renderKpis) ---')
{
  // Simulating the KPI logic from app.js renderKpis()
  // income = sum(sale_amount_pen) from subscription_renewals
  // cost = sum(cost_amount_pen) from subscription_renewals
  // profit = income - cost

  const mockRenewals = [
    { sale_amount_pen: 100, cost_amount_pen: 60 },
    { sale_amount_pen: 50, cost_amount_pen: 30 },
    { sale_amount_pen: 200, cost_amount_pen: 150 },
  ]

  const income = mockRenewals.reduce((sum, r) => sum + Number(r.sale_amount_pen || 0), 0)
  const cost = mockRenewals.reduce((sum, r) => sum + Number(r.cost_amount_pen || 0), 0)
  const profit = income - cost

  assertEqual(income, 350, 'KPI income sum')
  assertEqual(cost, 240, 'KPI cost sum')
  assertEqual(profit, 110, 'KPI profit')

  // Empty renewals
  const emptyIncome = [].reduce((sum, r) => sum + Number(r.sale_amount_pen || 0), 0)
  const emptyCost = [].reduce((sum, r) => sum + Number(r.cost_amount_pen || 0), 0)
  assertEqual(emptyIncome, 0, 'Empty income = 0')
  assertEqual(emptyCost, 0, 'Empty cost = 0')

  // Null values in renewals
  const withNulls = [
    { sale_amount_pen: 100, cost_amount_pen: null },
    { sale_amount_pen: null, cost_amount_pen: 50 },
    { sale_amount_pen: undefined, cost_amount_pen: undefined },
  ]
  const nullIncome = withNulls.reduce((sum, r) => sum + Number(r.sale_amount_pen || 0), 0)
  const nullCost = withNulls.reduce((sum, r) => sum + Number(r.cost_amount_pen || 0), 0)
  assertEqual(nullIncome, 100, 'Null sale_amount_pen treated as 0')
  assertEqual(nullCost, 50, 'Null cost_amount_pen treated as 0')
}

console.log('\n--- FINANCIAL_HISTORY_START boundary (from app.js) ---')
{
  // From app.js: FINANCIAL_HISTORY_START is used to filter renewals
  // Period before history start shows "Sin datos históricos"
  const FINANCIAL_HISTORY_START = '2024-01-01'

  const historyStart = new Date(FINANCIAL_HISTORY_START)
  const periodStart = new Date('2023-12-01')
  const periodEnd = new Date('2023-12-31')

  const isBeforeHistory = periodEnd < historyStart
  assert(isBeforeHistory, 'Period before FINANCIAL_HISTORY_START is before history')

  const periodStart2 = new Date('2024-06-01')
  const periodEnd2 = new Date('2024-06-30')
  const isBeforeHistory2 = periodEnd2 < historyStart
  assert(!isBeforeHistory2, 'Period after FINANCIAL_HISTORY_START is not before history')

  // Effective start when period spans history boundary
  const effectiveStart = periodStart < historyStart ? historyStart : periodStart
  assertEqual(effectiveStart.toISOString().split('T')[0], '2024-01-01', 'Effective start clamped to history start')
}

console.log('\n--- Exchange rate validation (matching SQL constraints) ---')
{
  // SQL constraints:
  // - PEN + rate IS NULL
  // - USDT + rate > 0

  function validateRate(currency, rate) {
    const curr = normalizeCurrency(currency)
    if (curr === 'PEN') return rate === null || rate === undefined
    if (curr === 'USDT') return rate !== null && rate !== undefined && rate > 0
    return false
  }

  assert(validateRate('PEN', null), 'PEN with null rate: valid')
  assert(validateRate('PEN', undefined), 'PEN with undefined rate: valid')
  assert(!validateRate('PEN', 3.75), 'PEN with rate: invalid per SQL')
  assert(!validateRate('PEN', 0), 'PEN with 0 rate: invalid per SQL')

  assert(validateRate('USDT', 3.75), 'USDT with positive rate: valid')
  assert(!validateRate('USDT', null), 'USDT with null rate: invalid')
  assert(!validateRate('USDT', 0), 'USDT with 0 rate: invalid')
  assert(!validateRate('USDT', -1), 'USDT with negative rate: invalid')
  assert(!validateRate('USDT', undefined), 'USDT with undefined rate: invalid')
}

console.log('\n--- Integration: cardHtml profit calculation (from app.js) ---')
{
  // Simulating the profit calculation from cardHtml() in app.js:
  // const salePEN = amountInPEN(row.sale_price, rowSaleCurrency(row), row.sale_price_exchange_rate)
  // const costPEN = amountInPEN(row.cost, rowCostCurrency(row), row.cost_exchange_rate)
  // const profitPEN = salePEN - costPEN

  function rowSaleCurrency(row) { return normalizeCurrency(row?.sale_price_currency) }
  function rowCostCurrency(row) { return normalizeCurrency(row?.cost_currency) }

  // Test case 1: PEN/PEN
  const row1 = { sale_price: 100, sale_price_currency: 'PEN', sale_price_exchange_rate: null, cost: 60, cost_currency: 'PEN', cost_exchange_rate: null }
  const sale1 = amountInPEN(row1.sale_price, rowSaleCurrency(row1), row1.sale_price_exchange_rate)
  const cost1 = amountInPEN(row1.cost, rowCostCurrency(row1), row1.cost_exchange_rate)
  assertEqual(sale1, 100, 'Row1 sale PEN')
  assertEqual(cost1, 60, 'Row1 cost PEN')
  assertEqual(sale1 - cost1, 40, 'Row1 profit PEN')

  // Test case 2: USDT/USDT same rate
  const row2 = { sale_price: 10, sale_price_currency: 'USDT', sale_price_exchange_rate: 3.75, cost: 6, cost_currency: 'USDT', cost_exchange_rate: 3.75 }
  const sale2 = amountInPEN(row2.sale_price, rowSaleCurrency(row2), row2.sale_price_exchange_rate)
  const cost2 = amountInPEN(row2.cost, rowCostCurrency(row2), row2.cost_exchange_rate)
  assertClose(sale2, 37.5, 0.01, 'Row2 sale USDT')
  assertClose(cost2, 22.5, 0.01, 'Row2 cost USDT')
  assertClose(sale2 - cost2, 15, 0.01, 'Row2 profit')

  // Test case 3: PEN/USDT
  const row3 = { sale_price: 150, sale_price_currency: 'PEN', sale_price_exchange_rate: null, cost: 20, cost_currency: 'USDT', cost_exchange_rate: 3.80 }
  const sale3 = amountInPEN(row3.sale_price, rowSaleCurrency(row3), row3.sale_price_exchange_rate)
  const cost3 = amountInPEN(row3.cost, rowCostCurrency(row3), row3.cost_exchange_rate)
  assertEqual(sale3, 150, 'Row3 sale PEN')
  assertClose(cost3, 76, 0.01, 'Row3 cost USDT')
  assertClose(sale3 - cost3, 74, 0.01, 'Row3 profit')

  // Test case 4: USDT/PEN
  const row4 = { sale_price: 25, sale_price_currency: 'USDT', sale_price_exchange_rate: 3.70, cost: 50, cost_currency: 'PEN', cost_exchange_rate: null }
  const sale4 = amountInPEN(row4.sale_price, rowSaleCurrency(row4), row4.sale_price_exchange_rate)
  const cost4 = amountInPEN(row4.cost, rowCostCurrency(row4), row4.cost_exchange_rate)
  assertClose(sale4, 92.5, 0.01, 'Row4 sale USDT')
  assertEqual(cost4, 50, 'Row4 cost PEN')
  assertClose(sale4 - cost4, 42.5, 0.01, 'Row4 profit')

  // Test case 5: Different rates
  const row5 = { sale_price: 10, sale_price_currency: 'USDT', sale_price_exchange_rate: 3.75, cost: 8, cost_currency: 'USDT', cost_exchange_rate: 3.70 }
  const sale5 = amountInPEN(row5.sale_price, rowSaleCurrency(row5), row5.sale_price_exchange_rate)
  const cost5 = amountInPEN(row5.cost, rowCostCurrency(row5), row5.cost_exchange_rate)
  assertClose(sale5, 37.5, 0.01, 'Row5 sale USDT @ 3.75')
  assertClose(cost5, 29.6, 0.01, 'Row5 cost USDT @ 3.70')
  assertClose(sale5 - cost5, 7.9, 0.01, 'Row5 profit diff rates')
}

console.log('\n=== Test Summary ===')
console.log(`Passed: ${passCount}`)
console.log(`Failed: ${failCount}`)
console.log(`Total:  ${passCount + failCount}`)

if (failCount > 0) {
  console.log('\n--- Failures ---')
  failures.forEach(f => console.log(`  - ${f}`))
  process.exit(1)
} else {
  console.log('\n✅ All tests passed!')
  process.exit(0)
}