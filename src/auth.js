import { supabase, isConfigured } from './supabase.js'
import { escapeHtml } from './utils.js'
import { toast } from './ui/toast.js'
import { state, setLoading } from './state.js'

export function brandHtml() {
  return `
    <div class="brand">
      <div class="brand-mark">GC</div>
      <div>
        <h1>PRO VENTAS GC</h1>
        <p>Administrador de suscripciones</p>
      </div>
    </div>`
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function configScreen(root = document.querySelector('#app')) {
  if (!root) return
  document.title = 'Configuración — PRO VENTAS GC'
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

export function loginScreen(error = '', info = '', root = document.querySelector('#app')) {
  if (!root) return
  document.title = 'Iniciar sesión — PRO VENTAS GC'
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
          <div id="loginAlertBox" class="auth-alert-container">
            ${error ? `<div class="auth-inline-alert auth-alert-error" role="alert">${escapeHtml(error)}</div>` : ''}
            ${info ? `<div class="auth-inline-alert auth-alert-info" role="status">${escapeHtml(info)}</div>` : ''}
          </div>
          <button id="loginSubmitBtn" class="btn btn-primary btn-full" type="submit">Entrar</button>
          <div class="auth-links-row">
            <button type="button" id="forgotPasswordBtn" class="link-btn">¿Olvidaste tu contraseña?</button>
          </div>
        </form>
      </section>
    </main>`

  document.querySelector('#loginForm')?.addEventListener('submit', handleLogin)
  document.querySelector('#forgotPasswordBtn')?.addEventListener('click', () => {
    recoveryRequestScreen()
  })
}

export async function handleLogin(event) {
  event.preventDefault()
  const form = event.currentTarget
  const button = form.querySelector('button[type="submit"]')
  const alertBox = form.querySelector('#loginAlertBox')

  const setAlert = (message, type = 'error') => {
    if (alertBox) {
      alertBox.innerHTML = message
        ? `<div class="auth-inline-alert auth-alert-${type}" role="alert">${escapeHtml(message)}</div>`
        : ''
    }
  }

  setAlert('')

  if (button) {
    button.disabled = true
    button.textContent = 'Ingresando...'
  }
  setLoading(true, 'Ingresando...')

  const formData = new FormData(form)
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get('email'),
      password: formData.get('password'),
    })
    if (error) {
      setLoading(false)
      if (button) {
        button.disabled = false
        button.textContent = 'Entrar'
      }
      setAlert('Correo o contraseña incorrectos, o el usuario no está habilitado.', 'error')
    }
  } catch (err) {
    setLoading(false)
    if (button) {
      button.disabled = false
      button.textContent = 'Entrar'
    }
    setAlert('Error de conexión. Intenta de nuevo.', 'error')
  }
}

export function recoveryRequestScreen(error = '', info = '', root = document.querySelector('#app')) {
  if (!root) return
  document.title = 'Recuperar contraseña — PRO VENTAS GC'
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
            <input name="email" type="email" autocomplete="email" required placeholder="correo@ejemplo.com" value="${escapeHtml(state.recoveryEmail)}">
          </label>
          <div id="recoveryAlertBox" class="auth-alert-container">
            ${error ? `<div class="auth-inline-alert auth-alert-error" role="alert">${escapeHtml(error)}</div>` : ''}
            ${info ? `<div class="auth-inline-alert auth-alert-info" role="status">${escapeHtml(info)}</div>` : ''}
          </div>
          <button id="recoverySubmitBtn" class="btn btn-primary btn-full" type="submit">Enviar enlace</button>
          <button type="button" id="backToLoginBtn" class="btn btn-ghost btn-full">Volver a iniciar sesión</button>
        </form>
      </section>
    </main>`

  document.querySelector('#recoveryRequestForm')?.addEventListener('submit', handleRecoveryRequest)
  document.querySelector('#backToLoginBtn')?.addEventListener('click', () => {
    state.isResettingPassword = false
    loginScreen()
  })
}

export async function handleRecoveryRequest(event) {
  event.preventDefault()
  const form = event.currentTarget
  const submitBtn = form.querySelector('button[type="submit"]')
  const alertBox = form.querySelector('#recoveryAlertBox')

  const setAlert = (message, type = 'error') => {
    if (alertBox) {
      alertBox.innerHTML = message
        ? `<div class="auth-inline-alert auth-alert-${type}" role="alert">${escapeHtml(message)}</div>`
        : ''
    }
  }

  const formData = new FormData(form)
  const email = String(formData.get('email') || '').trim()

  if (!email || !isValidEmail(email)) {
    return setAlert('Ingresa un correo electrónico válido.', 'error')
  }

  setAlert('')
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
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Enviar enlace'
      }
      return setAlert('No se pudo enviar el enlace de recuperación. Intenta nuevamente.', 'error')
    }

    state.recoveryEmail = email
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = 'Enviar enlace'
    }
    setAlert('Si el correo corresponde a una cuenta válida, recibirás un enlace para restablecer tu contraseña.', 'info')
  } catch (err) {
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = 'Enviar enlace'
    }
    setAlert('No se pudo enviar el enlace de recuperación. Intenta nuevamente.', 'error')
  }
}

export function newPasswordScreen(error = '', info = '', root = document.querySelector('#app')) {
  if (!root) return
  document.title = 'Nueva contraseña — PRO VENTAS GC'
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
          <div id="newPasswordAlertBox" class="auth-alert-container">
            ${error ? `<div class="auth-inline-alert auth-alert-error" role="alert">${escapeHtml(error)}</div>` : ''}
            ${info ? `<div class="auth-inline-alert auth-alert-info" role="status">${escapeHtml(info)}</div>` : ''}
          </div>
          <button id="newPasswordSubmitBtn" class="btn btn-primary btn-full" type="submit">Actualizar contraseña</button>
          <button type="button" id="cancelNewPasswordBtn" class="btn btn-ghost btn-full">Cancelar</button>
        </form>
      </section>
    </main>`

  document.querySelector('#newPasswordForm')?.addEventListener('submit', handleUpdatePassword)
  document.querySelector('#cancelNewPasswordBtn')?.addEventListener('click', async () => {
    state.isResettingPassword = false
    await supabase.auth.signOut()
    loginScreen()
  })
}

export async function handleUpdatePassword(event) {
  event.preventDefault()
  const form = event.currentTarget
  const submitBtn = form.querySelector('button[type="submit"]')
  const alertBox = form.querySelector('#newPasswordAlertBox')

  const setAlert = (message, type = 'error') => {
    if (alertBox) {
      alertBox.innerHTML = message
        ? `<div class="auth-inline-alert auth-alert-${type}" role="alert">${escapeHtml(message)}</div>`
        : ''
    }
  }

  const formData = new FormData(form)
  const password = String(formData.get('password') || '').trim()
  const confirmPassword = String(formData.get('confirm_password') || '').trim()

  if (!password || !confirmPassword) {
    return setAlert('Todos los campos son obligatorios.', 'error')
  }

  if (password.length < 6) {
    return setAlert('La contraseña debe tener al menos 6 caracteres.', 'error')
  }

  if (password !== confirmPassword) {
    return setAlert('Las contraseñas no coinciden.', 'error')
  }

  setAlert('')
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'Guardando...'
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Actualizar contraseña'
      }
      const errMsg = (error.message || '').toLowerCase()
      if (
        errMsg.includes('session') ||
        errMsg.includes('token') ||
        errMsg.includes('expired') ||
        errMsg.includes('auth') ||
        errMsg.includes('reauthenticate') ||
        errMsg.includes('user not found')
      ) {
        return setAlert('El enlace de recuperación expiró o ya no es válido. Solicita uno nuevo.', 'error')
      }
      return setAlert('No se pudo actualizar la contraseña. Intenta nuevamente.', 'error')
    }

    await supabase.auth.signOut()
    state.isResettingPassword = false
    state.recoveryEmail = ''
    toast('Contraseña actualizada con éxito.')
    loginScreen('', 'Contraseña actualizada con éxito. Inicia sesión con tu nueva contraseña.')
  } catch (err) {
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = 'Actualizar contraseña'
    }
    setAlert('No se pudo actualizar la contraseña. Intenta nuevamente.', 'error')
  }
}
