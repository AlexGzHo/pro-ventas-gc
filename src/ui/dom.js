/**
 * Helper DOM utilities
 */

export function qs(selector, parent = document) {
  return parent.querySelector(selector)
}

export function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector))
}

export function html(strings, ...values) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
}
