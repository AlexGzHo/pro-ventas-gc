import { supabase } from '../supabase.js'
import { escapeHtml, copyText } from '../utils.js'
import { toast } from '../ui/toast.js'
import { confirmDialog } from '../ui/confirm.js'
import { openModal } from '../ui/modal.js'
import { ICONS } from '../ui/icons.js'
import { credentialLabels } from '../constants.js'
import { credentialsPlain, credentialsText, openWhatsApp } from '../whatsapp.js'
import { loadRows, setLoading } from '../state.js'

export function safeWhatsapp(row, message) {
  try {
    const res = openWhatsApp(row, message)
    if (res?.type === 'username' && message) {
      toast('Abriendo chat con @usuario. Mensaje copiado al portapapeles por compatibilidad.', 'info')
    }
  } catch (error) {
    toast(error.message, 'error')
  }
}

export async function copyCredentialsAction(row, btn) {
  if (!row) return
  await copyText(credentialsPlain(row))
  toast('Copiado: Accesos completos')
  if (btn) {
    const originalHtml = btn.innerHTML
    btn.classList.add('btn-copied')
    btn.innerHTML = `${ICONS.check} <span>Copiado</span>`
    btn.disabled = true
    setTimeout(() => {
      btn.innerHTML = originalHtml
      btn.classList.remove('btn-copied')
      btn.disabled = false
    }, 1500)
  }
}

export async function archiveRow(row) {
  const ok = await confirmDialog({
    title: 'Dar de baja suscripción',
    message: `¿Estás seguro de que deseas dar de baja y archivar la suscripción de <strong>${escapeHtml(row?.client_name || 'este cliente')}</strong>? Podrás recuperarla en cualquier momento si es necesario.`,
    confirmText: 'Dar de baja',
    danger: true
  })
  if (!ok) return

  setLoading(true, 'Dando de baja...')
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', row.id)

    if (error) throw error
    toast('Suscripción dada de baja')
    await loadRows()
  } catch (err) {
    console.error(err)
    toast('Error al dar de baja: ' + err.message, 'error')
  } finally {
    setLoading(false)
  }
}

export async function unarchiveRow(row) {
  const ok = await confirmDialog({
    title: 'Recuperar suscripción',
    message: `¿Deseas restaurar y dar de alta la suscripción de <strong>${escapeHtml(row?.client_name || 'este cliente')}</strong>?`,
    confirmText: 'Recuperar',
    danger: false
  })
  if (!ok) return

  setLoading(true, 'Recuperando...')
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({ archived_at: null })
      .eq('id', row.id)

    if (error) throw error
    toast('Suscripción recuperada')
    await loadRows()
  } catch (err) {
    console.error(err)
    toast('Error al recuperar: ' + err.message, 'error')
  } finally {
    setLoading(false)
  }
}

export async function deleteRow(row) {
  setLoading(true, 'Consultando historial...')
  let renewalsCount = 0
  try {
    const { count } = await supabase
      .from('subscription_renewals')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', row.id)
    renewalsCount = count || 0
  } catch (e) {
    console.error('Error al contar renovaciones:', e)
  }
  setLoading(false)

  const details = renewalsCount > 0
    ? `Se borrarán también sus <strong>${renewalsCount}</strong> registros financieros asociados.<br><span class="danger-notice">Esta acción es irreversible y no se puede deshacer.</span>`
    : `<span class="danger-notice">Esta acción es irreversible y no se puede deshacer.</span>`

  const ok = await confirmDialog({
    title: 'Eliminar suscripción definitivamente',
    message: `¿Eliminar DEFINITIVAMENTE la suscripción de <strong>${escapeHtml(row?.client_name || 'este cliente')}</strong> (${escapeHtml(row?.service || 'servicio')})?<br><br>${details}`,
    confirmText: 'Eliminar definitivamente',
    danger: true
  })

  if (!ok) return

  setLoading(true, 'Eliminando...')
  try {
    const { error } = await supabase.rpc('delete_subscription_transactional', {
      p_sub_id: row.id
    })

    if (error) {
      throw error
    }

    toast('Suscripción eliminada definitivamente')
    await loadRows()
  } catch (err) {
    console.error(err)
    toast('Error al eliminar: ' + err.message, 'error')
  } finally {
    setLoading(false)
  }
}

export function openCredentialsModal(row) {
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

  const hasCreds = creds.length > 0 || extras.length > 0

  const renderField = (key, value, customLabel) => {
    const label = customLabel || credentialLabels[key] || key
    const isPassword = key.toLowerCase() === 'password' || key.toLowerCase().includes('contrase')
    const displayVal = isPassword ? '••••••••' : String(value)
    return `
      <div class="cred-row" data-key="${escapeHtml(key)}">
        <div class="cred-info">
          <span class="cred-label">${escapeHtml(label)}</span>
          <code class="cred-value ${isPassword ? 'cred-masked' : ''}" data-full-value="${escapeHtml(String(value))}">${escapeHtml(displayVal)}</code>
        </div>
        <div class="cred-actions">
          ${isPassword ? `
            <button type="button" class="btn btn-ghost btn-icon toggle-password-visibility" aria-label="Mostrar contraseña" title="Mostrar contraseña">
              ${ICONS.eye}
            </button>
          ` : ''}
          <button type="button" class="btn btn-secondary btn-icon copy-modal-field" data-value="${escapeHtml(String(value))}" data-label="${escapeHtml(label)}" aria-label="Copiar ${escapeHtml(label)}" title="Copiar ${escapeHtml(label)}">
            ${ICONS.copy}
          </button>
        </div>
      </div>
    `
  }

  const bodyHtml = `
    ${hasCreds ? `
      <div class="credentials modal-credentials">
        ${creds.map(([key, value]) => renderField(key, value)).join('')}
        ${extras.map(([key, value]) => renderField(key, value, key)).join('')}
      </div>
    ` : `
      <p class="empty-creds">No hay credenciales registradas para esta suscripción.</p>
    `}
  `

  const footerHtml = `
    <div class="creds-modal-footer">
      <button type="button" id="copyAllCredsBtn" class="btn btn-primary creds-footer-btn">
        ${ICONS.copy} <span>Copiar todo</span>
      </button>
      <button type="button" id="sendWhatsappCredsBtn" class="btn btn-secondary creds-footer-btn">
        ${ICONS.whatsapp} <span>Enviar por WhatsApp</span>
      </button>
    </div>
  `

  const modal = openModal({
    title: 'Datos de acceso',
    subtitle: `${row.client_name || 'Cliente'} · ${row.service || 'Servicio'}`,
    body: bodyHtml,
    footer: footerHtml,
    size: 'md',
    customClass: 'creds-modal'
  })

  // Toggle mostrar/ocultar contraseña
  modal.el.querySelectorAll('.toggle-password-visibility').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rowEl = btn.closest('.cred-row')
      const codeEl = rowEl?.querySelector('.cred-value')
      if (!codeEl) return
      const isMasked = codeEl.classList.contains('cred-masked')
      if (isMasked) {
        codeEl.textContent = codeEl.dataset.fullValue || ''
        codeEl.classList.remove('cred-masked')
        btn.innerHTML = ICONS.eyeOff
        btn.setAttribute('aria-label', 'Ocultar contraseña')
        btn.setAttribute('title', 'Ocultar contraseña')
      } else {
        codeEl.textContent = '••••••••'
        codeEl.classList.add('cred-masked')
        btn.innerHTML = ICONS.eye
        btn.setAttribute('aria-label', 'Mostrar contraseña')
        btn.setAttribute('title', 'Mostrar contraseña')
      }
    })
  })

  // Copiar campo individual
  modal.el.querySelectorAll('.copy-modal-field').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const val = btn.dataset.value || ''
      const label = btn.dataset.label || 'Dato'
      await copyText(val)
      toast(`Copiado: ${label}`)
      const originalHtml = btn.innerHTML
      btn.classList.add('btn-copied')
      btn.innerHTML = ICONS.check
      btn.disabled = true
      setTimeout(() => {
        btn.innerHTML = originalHtml
        btn.classList.remove('btn-copied')
        btn.disabled = false
      }, 1500)
    })
  })

  // Copiar todo
  modal.el.querySelector('#copyAllCredsBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget
    await copyText(credentialsPlain(row))
    toast('Copiado: Accesos completos')
    const originalHtml = btn.innerHTML
    btn.classList.add('btn-copied')
    btn.innerHTML = `${ICONS.check} <span>Copiado</span>`
    btn.disabled = true
    setTimeout(() => {
      btn.innerHTML = originalHtml
      btn.classList.remove('btn-copied')
      btn.disabled = false
    }, 1500)
  })

  // Enviar por WhatsApp
  modal.el.querySelector('#sendWhatsappCredsBtn')?.addEventListener('click', () => {
    safeWhatsapp(row, credentialsText(row))
  })

  return modal
}
