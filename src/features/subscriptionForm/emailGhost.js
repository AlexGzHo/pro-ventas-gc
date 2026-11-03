/**
 * PRO VENTAS GC — Autocompletado Ghost para Correo Electrónico
 * Ofrece sugerencias de dominios comunes en tiempo real usando medición exacta por canvas.
 */

/**
 * Inicializa el autocompletado de dominios ghost en el campo de correo/usuario.
 * 
 * @param {HTMLInputElement} emailInput - Campo de entrada de email
 * @param {HTMLElement} ghostEl - Elemento span overlay para mostrar el dominio sugerido
 * @param {Array} rows - Filas de suscripciones para alimentar la lista de dominios conocidos
 * @returns {Function} Función destructora para limpiar listeners si fuera necesario
 */
export function setupEmailGhost(emailInput, ghostEl, rows = []) {
  if (!emailInput || !ghostEl) return () => {}

  // Cache de dominios de email
  const emailDomains = new Set(['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com'])
  ;(rows || []).forEach(s => {
    const email = s.username_email
    if (email && email.includes('@')) {
      const domain = email.split('@')[1]?.toLowerCase()
      if (domain) emailDomains.add(`@${domain}`)
    }
  })
  const cachedEmailDomains = [...emailDomains].sort()

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')

  function findDomainSuggestion(val) {
    const atIndex = val.indexOf('@')
    if (atIndex === -1) return ''
    const typed = val.slice(atIndex + 1).toLowerCase()
    if (!typed) return ''
    for (const d of cachedEmailDomains) {
      const dom = d.slice(1)
      if (dom.startsWith(typed) && dom !== typed) {
        return dom.slice(typed.length)
      }
    }
    return ''
  }

  function updateGhostDomain() {
    const val = emailInput.value
    const suggestion = findDomainSuggestion(val)

    if (!suggestion) {
      ghostEl.textContent = ''
      return
    }

    const cs = getComputedStyle(emailInput)
    ghostEl.style.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    ghostEl.style.lineHeight = cs.lineHeight
    ghostEl.style.letterSpacing = cs.letterSpacing
    ghostEl.style.paddingTop = cs.paddingTop
    ghostEl.style.paddingBottom = cs.paddingBottom

    measureCtx.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const baseWidth = measureCtx.measureText(val).width
    const paddingLeft = parseFloat(cs.paddingLeft) || 0
    const scrollLeft = emailInput.scrollLeft

    const left = paddingLeft + baseWidth - scrollLeft
    ghostEl.textContent = suggestion
    ghostEl.style.left = `${left}px`
    ghostEl.style.width = `${Math.max(0, emailInput.clientWidth - left)}px`
  }

  function handleKeyDown(e) {
    if (e.key === 'Tab') {
      const suggestion = findDomainSuggestion(emailInput.value)
      if (suggestion) {
        e.preventDefault()
        emailInput.value = emailInput.value + suggestion
        ghostEl.textContent = ''
        updateGhostDomain()
      }
    }
  }

  function handleBlur() {
    setTimeout(() => { if (ghostEl) ghostEl.textContent = '' }, 100)
  }

  emailInput.addEventListener('input', updateGhostDomain)
  emailInput.addEventListener('scroll', updateGhostDomain)
  emailInput.addEventListener('keydown', handleKeyDown)
  emailInput.addEventListener('blur', handleBlur)

  return () => {
    emailInput.removeEventListener('input', updateGhostDomain)
    emailInput.removeEventListener('scroll', updateGhostDomain)
    emailInput.removeEventListener('keydown', handleKeyDown)
    emailInput.removeEventListener('blur', handleBlur)
  }
}
