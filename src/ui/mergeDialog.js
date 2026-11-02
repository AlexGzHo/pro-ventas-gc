import { supabase } from '../supabase.js'
import { escapeHtml } from '../utils.js'
import { openModal } from './modal.js'
import { confirmDialog } from './confirm.js'
import { toast } from './toast.js'
import { ICONS } from './icons.js'

/**
 * Modal simplificado de fusión de clientes (merge_clients).
 */
export function openClientMergeDialog({ primaryClientId, clients = [], subscriptions = [], onSuccess = null }) {
  const primary = clients.find(c => c.id === primaryClientId)
  if (!primary) return

  const candidates = clients.filter(c => c.id !== primaryClientId).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const getSubs = (id) => subscriptions.filter(s => s.client_id === id)
  let secondaryId = '', isMerging = false

  const bodyEl = document.createElement('div')
  bodyEl.className = 'merge-dialog-content'
  bodyEl.innerHTML = `
    <div class="merge-banner">
      <span class="merge-banner-icon">${ICONS.info}</span>
      <div class="merge-banner-text">Se conservará a <strong>${escapeHtml(primary.name)}</strong> y se le transferirán las suscripciones del cliente secundario, que será eliminado.</div>
    </div>
    <div class="form-group merge-field-wrap">
      <label for="mergeSecSelect" class="form-label">Cliente a fusionar (será eliminado) *</label>
      <select id="mergeSecSelect" class="form-control">
        <option value="">-- Selecciona cliente secundario --</option>
        ${candidates.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.phone ? ' - ' + escapeHtml(c.phone) : ''} (${getSubs(c.id).length} sub(s))</option>`).join('')}
      </select>
    </div>
    <div id="mergeCliPreview" class="merge-preview-box hidden">
      <div class="merge-preview-head">${ICONS.info} <strong>Resumen:</strong></div>
      <ul class="merge-preview-list">
        <li><strong>Conserva:</strong> <span class="text-primary font-bold">${escapeHtml(primary.name)}</span></li>
        <li><strong>Transfiere:</strong> <strong id="mergeSubsCount">0</strong> suscripción(es).</li>
        <li class="text-danger"><strong>Elimina:</strong> <span id="mergeDeleteName"></span></li>
      </ul>
    </div>`

  const footerEl = document.createElement('div')
  footerEl.className = 'merge-dialog-footer'
  footerEl.innerHTML = `
    <button type="button" class="btn btn-ghost" id="btnCancelMerge">Cancelar</button>
    <button type="button" class="btn btn-danger" id="btnSubmitMerge" disabled>Fusionar Clientes</button>`

  const modalInstance = openModal({ title: 'Fusión de Clientes', subtitle: `Transfiere a ${primary.name}`, body: bodyEl, footer: footerEl, size: 'md' })
  const selectEl = bodyEl.querySelector('#mergeSecSelect')
  const previewEl = bodyEl.querySelector('#mergeCliPreview')
  const countEl = bodyEl.querySelector('#mergeSubsCount')
  const deleteNameEl = bodyEl.querySelector('#mergeDeleteName')
  const submitBtn = footerEl.querySelector('#btnSubmitMerge')

  selectEl.addEventListener('change', () => {
    secondaryId = selectEl.value
    if (secondaryId) {
      const sec = candidates.find(c => c.id === secondaryId)
      countEl.textContent = String(getSubs(secondaryId).length)
      deleteNameEl.textContent = sec ? sec.name : ''
      previewEl.classList.remove('hidden')
      submitBtn.disabled = false
    } else {
      previewEl.classList.add('hidden')
      submitBtn.disabled = true
    }
  })

  footerEl.querySelector('#btnCancelMerge').addEventListener('click', () => modalInstance.close())
  submitBtn.addEventListener('click', async () => {
    if (isMerging || !secondaryId) return
    const sec = candidates.find(c => c.id === secondaryId)
    if (!sec) return
    const count = getSubs(secondaryId).length
    const ok = await confirmDialog({
      title: '¿Confirmar fusión de clientes?',
      message: `Se transferirán <strong>${count}</strong> suscripción(es) a <strong>${escapeHtml(primary.name)}</strong>.<br><br>El cliente <strong>${escapeHtml(sec.name)}</strong> será eliminado permanentemente.`,
      confirmText: 'Sí, fusionar',
      cancelText: 'Cancelar',
      danger: true
    })
    if (!ok) return

    isMerging = true
    submitBtn.disabled = true
    submitBtn.textContent = 'Fusionando...'
    try {
      const { error } = await supabase.rpc('merge_clients', { p_target_client_id: primaryClientId, p_source_client_id: secondaryId })
      if (error) throw error
      toast(`Clientes fusionados. Se transfirieron ${count} suscripciones a ${primary.name}.`, 'success')
      modalInstance.close()
      if (onSuccess) await onSuccess({ targetId: primaryClientId, sourceId: secondaryId })
    } catch (err) {
      console.error('Error al fusionar clientes:', err)
      toast('Error al fusionar: ' + err.message, 'error')
      isMerging = false
      submitBtn.disabled = false
      submitBtn.textContent = 'Fusionar Clientes'
    }
  })
}

/**
 * Modal simplificado de reasignación de proveedor (merge_providers).
 */
export function openProviderReassignDialog({ sourceProviderId, providers = [], subscriptions = [], products = [], onSuccess = null }) {
  const sourceProv = providers.find(p => p.id === sourceProviderId)
  if (!sourceProv) return

  const depSubs = subscriptions.filter(s => s.provider_id === sourceProviderId).length
  const depProds = products.filter(pr => pr.provider_id === sourceProviderId).length
  const candidates = providers.filter(p => p.id !== sourceProviderId).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  let targetId = '', isMerging = false

  const bodyEl = document.createElement('div')
  bodyEl.className = 'reassign-dialog-content'
  bodyEl.innerHTML = `
    <div class="merge-banner">
      <span class="merge-banner-icon">${ICONS.warning}</span>
      <div class="merge-banner-text"><strong>${escapeHtml(sourceProv.name)}</strong> tiene <strong>${depSubs}</strong> suscripción(es) y <strong>${depProds}</strong> producto(s) vinculado(s).</div>
    </div>
    <div class="form-group merge-field-wrap">
      <label for="provTargetSel" class="form-label">Proveedor de destino (Conservar) *</label>
      <select id="provTargetSel" class="form-control">
        <option value="">-- Selecciona proveedor destino --</option>
        ${candidates.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
    <div id="reassignPrev" class="merge-preview-box hidden">
      <div class="merge-preview-head">${ICONS.info} <strong>Resumen:</strong></div>
      <ul class="merge-preview-list">
        <li><strong>Conserva:</strong> <span id="reassignTargetName" class="text-primary font-bold"></span></li>
        <li><strong>Transfiere:</strong> <strong>${depSubs}</strong> suscripción(es) y <strong>${depProds}</strong> producto(s).</li>
        <li class="text-danger"><strong>Elimina:</strong> <strong>${escapeHtml(sourceProv.name)}</strong></li>
      </ul>
    </div>`

  const footerEl = document.createElement('div')
  footerEl.className = 'reassign-dialog-footer'
  footerEl.innerHTML = `
    <button type="button" class="btn btn-ghost" id="btnCancelReassign">Cancelar</button>
    <button type="button" class="btn btn-danger" id="btnSubmitReassign" disabled>Confirmar Reasignación</button>`

  const modalInstance = openModal({ title: 'Reasignar Proveedor', subtitle: `Traslada dependencias de ${sourceProv.name}`, body: bodyEl, footer: footerEl, size: 'md' })
  const selectEl = bodyEl.querySelector('#provTargetSel')
  const previewEl = bodyEl.querySelector('#reassignPrev')
  const targetNameEl = bodyEl.querySelector('#reassignTargetName')
  const submitBtn = footerEl.querySelector('#btnSubmitReassign')

  selectEl.addEventListener('change', () => {
    targetId = selectEl.value
    if (targetId) {
      const tp = providers.find(p => p.id === targetId)
      if (tp) targetNameEl.textContent = tp.name
      previewEl.classList.remove('hidden')
      submitBtn.disabled = false
    } else {
      previewEl.classList.add('hidden')
      submitBtn.disabled = true
    }
  })

  footerEl.querySelector('#btnCancelReassign').addEventListener('click', () => modalInstance.close())
  submitBtn.addEventListener('click', async () => {
    if (isMerging || !targetId) return
    const tp = providers.find(p => p.id === targetId)
    if (!tp) return
    const ok = await confirmDialog({
      title: '¿Confirmar reasignación?',
      message: `Se trasladarán <strong>${depSubs}</strong> suscripción(es) y <strong>${depProds}</strong> producto(s) a <strong>${escapeHtml(tp.name)}</strong>.<br><br>El proveedor <strong>${escapeHtml(sourceProv.name)}</strong> será eliminado permanentemente.`,
      confirmText: 'Sí, reasignar',
      cancelText: 'Cancelar',
      danger: true
    })
    if (!ok) return

    isMerging = true
    submitBtn.disabled = true
    submitBtn.textContent = 'Reasignando...'
    try {
      const { error } = await supabase.rpc('merge_providers', { p_target_provider_id: targetId, p_source_provider_id: sourceProviderId })
      if (error) throw error
      toast(`Proveedor reasignado con éxito a ${tp.name}.`, 'success')
      modalInstance.close()
      if (onSuccess) await onSuccess({ targetId, sourceId: sourceProviderId })
    } catch (err) {
      console.error('Error al reasignar proveedor:', err)
      toast('Error al reasignar: ' + err.message, 'error')
      isMerging = false
      submitBtn.disabled = false
      submitBtn.textContent = 'Confirmar Reasignación'
    }
  })
}
