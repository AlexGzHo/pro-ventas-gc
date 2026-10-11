import { supabase } from '../supabase.js'
import { escapeHtml } from '../utils.js'

export async function mountProveedoresView(container) {
  let providersData = []
  let searchTerm = ''
  let editingId = null

  container.innerHTML = `
    <section class="hero">
      <div>
        <h2>Proveedores</h2>
        <p>Directorio de proveedores y enlaces funcionales.</p>
      </div>
      <button id="btnNewProvider" class="btn btn-primary">+ Nuevo Proveedor</button>
    </section>

    <div id="providersMain">
      <section class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input id="providerSearch" type="search" placeholder="Buscar proveedor...">
        </div>
      </section>

      <div id="providerFormContainer" class="card hidden" style="margin-bottom: 20px;">
        <h3 id="providerFormTitle" style="margin-top:0;">Registrar Nuevo Proveedor</h3>
        <form id="providerForm" class="form-stack" style="max-width: 600px;">
          <label>Nombre del proveedor *
            <input type="text" id="provName" required class="form-control" />
          </label>
          <div style="display:flex; gap:10px;">
            <label style="flex:1;">Website
              <input type="url" id="provWebsite" class="form-control" placeholder="https://..." />
            </label>
            <label style="flex:1;">WhatsApp
              <input type="text" id="provWhatsapp" class="form-control" placeholder="Celular o URL" />
            </label>
            <label style="flex:1;">Telegram
              <input type="text" id="provTelegram" class="form-control" placeholder="@usuario o URL" />
            </label>
          </div>
          <label>Notas
            <textarea id="provNotes" class="form-control" rows="2"></textarea>
          </label>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button type="submit" class="btn btn-primary">Guardar</button>
            <button type="button" id="providerFormCancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </form>
      </div>

      <div id="providerMergeContainer" class="card hidden" style="margin-bottom: 20px; border-color: var(--color-brand);">
        <h3 style="margin-top:0;">Reasignar Proveedor</h3>
        <div id="providerMergeInfo" style="margin-bottom: 15px; color: var(--text-secondary);"></div>
        <form id="providerMergeForm" class="form-stack" style="max-width: 500px;">
          <input type="hidden" id="provMergeSourceId" />
          <label>Proveedor de destino (Conservar) *
            <select id="provMergeTargetSelect" required class="form-control"></select>
          </label>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button type="submit" class="btn btn-danger">Confirmar Reasignación</button>
            <button type="button" id="providerMergeCancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </form>
      </div>

      <div class="summary-view-wrapper">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Website</th>
              <th>WhatsApp</th>
              <th>Telegram</th>
              <th style="width: 80px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="proveedoresList">
            <tr><td colspan="5">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `

  const listEl = container.querySelector('#proveedoresList')
  const formContainer = container.querySelector('#providerFormContainer')
  const form = container.querySelector('#providerForm')
  const searchInput = container.querySelector('#providerSearch')

  let subsData = []
  let productsData = []

  async function loadData() {
    listEl.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>'
    const [pRes, sRes, prodRes] = await Promise.all([
      supabase.from('providers').select('*').order('name'),
      supabase.from('subscriptions').select('provider_id').not('provider_id', 'is', null),
      supabase.from('products').select('provider_id').not('provider_id', 'is', null)
    ])
    if (pRes.error) {
      listEl.innerHTML = '<tr><td colspan="5">Error cargando proveedores.</td></tr>'
      return
    }
    providersData = pRes.data || []
    subsData = sRes.data || []
    productsData = prodRes.data || []
    renderList()
  }

  function renderList() {
    const q = searchTerm.toLowerCase().trim()
    const filtered = providersData.filter(p => {
      return !q || (p.name || '').toLowerCase().includes(q)
    })

    if (filtered.length === 0) {
      listEl.innerHTML = '<tr><td colspan="5" class="empty-state">No se encontraron proveedores.</td></tr>'
      return
    }

    listEl.innerHTML = filtered.map(p => {
      const waLink = p.whatsapp ? (p.whatsapp.startsWith('http') ? p.whatsapp : `https://wa.me/${p.whatsapp.replace(/[^0-9]/g, '')}`) : ''
      const tgLink = p.telegram ? (p.telegram.startsWith('http') ? p.telegram : `https://t.me/${p.telegram.replace('@', '')}`) : ''

      return `
        <tr>
          <td>
            <div style="font-weight: 500;">${escapeHtml(p.name)}</div>
            ${p.notes ? `<div style="font-size:11px; color:var(--text-muted);">${escapeHtml(p.notes)}</div>` : ''}
          </td>
          <td>
            ${p.website ? `<a href="${escapeHtml(p.website)}" target="_blank" class="badge badge-neutral" style="text-decoration:none;">Sitio web</a>` : '<span style="color:var(--text-muted); font-size:12px;">—</span>'}
          </td>
          <td>
            ${p.whatsapp ? `<a href="${waLink}" target="_blank" class="badge badge-success" style="text-decoration:none;">WhatsApp</a>` : '<span style="color:var(--text-muted); font-size:12px;">—</span>'}
          </td>
          <td>
            ${p.telegram ? `<a href="${tgLink}" target="_blank" class="badge badge-info" style="text-decoration:none; background:#0088cc; color:#fff;">Telegram</a>` : '<span style="color:var(--text-muted); font-size:12px;">—</span>'}
          </td>
          <td>
            <div style="display:flex; gap: 8px;">
              <button class="btn btn-small btn-ghost btn-merge-prov" data-id="${p.id}" title="Reasignar a otro proveedor y eliminar">🔗</button>
              <button class="btn btn-small btn-ghost btn-delete-prov" data-id="${p.id}" title="Eliminar">🗑️</button>
              <button class="btn btn-small btn-ghost btn-edit-prov" data-id="${p.id}" title="Editar">✎</button>
            </div>
          </td>
        </tr>
      `
    }).join('')
  }

  container.addEventListener('click', (e) => {
    if (e.target.closest('.btn-edit-prov')) {
      const id = e.target.closest('.btn-edit-prov').dataset.id
      const p = providersData.find(x => x.id === id)
      if (p) {
        editingId = id
        document.getElementById('providerFormTitle').textContent = 'Editar Proveedor'
        document.getElementById('provName').value = p.name || ''
        document.getElementById('provWebsite').value = p.website || ''
        document.getElementById('provWhatsapp').value = p.whatsapp || ''
        document.getElementById('provTelegram').value = p.telegram || ''
        document.getElementById('provNotes').value = p.notes || ''
        formContainer.classList.remove('hidden')
        document.getElementById('provName').focus()
      }
    }
    if (e.target.closest('.btn-delete-prov')) {
      const id = e.target.closest('.btn-delete-prov').dataset.id
      const p = providersData.find(x => x.id === id)
      if (!p) return

      const depSubs = subsData.filter(s => s.provider_id === id).length
      const depProds = productsData.filter(pr => pr.provider_id === id).length

      if (depSubs > 0 || depProds > 0) {
        alert(`Bloqueado: El proveedor "${p.name}" tiene ${depSubs} suscripciones y ${depProds} productos vinculados.\nDebes reasignar (🔗) estas dependencias antes de eliminarlo.`)
        return
      }

      if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el proveedor "${p.name}"?`)) {
        supabase.rpc('delete_provider', { p_provider_id: id }).then(({error}) => {
          if (error) alert('Error al eliminar: ' + error.message)
          else loadData()
        })
      }
    }
    if (e.target.closest('.btn-merge-prov')) {
      const sourceId = e.target.closest('.btn-merge-prov').dataset.id
      const sourceProv = providersData.find(x => x.id === sourceId)
      if (!sourceProv) return

      const depSubs = subsData.filter(s => s.provider_id === sourceId).length
      const depProds = productsData.filter(pr => pr.provider_id === sourceId).length

      const mergeContainer = document.getElementById('providerMergeContainer')
      const infoEl = document.getElementById('providerMergeInfo')
      const selectEl = document.getElementById('provMergeTargetSelect')
      const sourceInput = document.getElementById('provMergeSourceId')

      sourceInput.value = sourceId
      infoEl.innerHTML = `Trasladando <b>${depSubs}</b> suscripciones y <b>${depProds}</b> productos de <b>${escapeHtml(sourceProv.name)}</b> a:`

      selectEl.innerHTML = '<option value="">-- Selecciona proveedor destino --</option>' +
        providersData
          .filter(p => p.id !== sourceId)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(p => {
            const extra = p.website ? p.website : (p.whatsapp ? p.whatsapp : '')
            return `<option value="${p.id}">${escapeHtml(p.name)}${extra ? ' (' + escapeHtml(extra) + ')' : ''}</option>`
          })
          .join('')

      mergeContainer.classList.remove('hidden')
      formContainer.classList.add('hidden')
    }
  })

  document.getElementById('providerMergeCancel').addEventListener('click', () => {
    document.getElementById('providerMergeContainer').classList.add('hidden')
    document.getElementById('providerMergeForm').reset()
  })

  document.getElementById('providerMergeForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const sourceId = document.getElementById('provMergeSourceId').value
    const targetId = document.getElementById('provMergeTargetSelect').value
    if (!sourceId || !targetId) return

    const sourceProv = providersData.find(p => p.id === sourceId)
    const targetProv = providersData.find(p => p.id === targetId)
    if (!sourceProv || !targetProv) return

    if (!confirm(`¿Confirmas la reasignación?\n\nEliminar permanentemente: ${sourceProv.name}\nConservar: ${targetProv.name}\n\nSe trasladarán todos los productos y suscripciones.`)) {
      return
    }

    const btn = e.target.querySelector('button[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Reasignando...'

    const { error } = await supabase.rpc('merge_providers', { p_target_provider_id: targetId, p_source_provider_id: sourceId })

    btn.disabled = false
    btn.textContent = 'Confirmar Reasignación'

    if (error) {
      alert('Error al reasignar: ' + error.message)
    } else {
      document.getElementById('providerMergeContainer').classList.add('hidden')
      e.target.reset()
      await loadData()
    }
  })

  document.getElementById('btnNewProvider').addEventListener('click', () => {
    editingId = null
    form.reset()
    document.getElementById('providerFormTitle').textContent = 'Registrar Nuevo Proveedor'
    formContainer.classList.remove('hidden')
    document.getElementById('provName').focus()
  })

  document.getElementById('providerFormCancel').addEventListener('click', () => {
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
    const name = document.getElementById('provName').value.trim()
    const website = document.getElementById('provWebsite').value.trim()
    const whatsapp = document.getElementById('provWhatsapp').value.trim()
    const telegram = document.getElementById('provTelegram').value.trim()
    const notes = document.getElementById('provNotes').value.trim()

    const payload = { name, website, whatsapp, telegram, notes }
    const btn = form.querySelector('button[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Guardando...'

    if (editingId) {
      const { error } = await supabase.from('providers').update(payload).eq('id', editingId)
      if (error) alert('Error al actualizar: ' + error.message)
    } else {
      const { error } = await supabase.from('providers').insert([payload])
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
