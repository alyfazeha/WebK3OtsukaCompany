/**
 * audit.js  —  K3-IMS Audit Support Module
 * Disesuaikan dengan K3-IMS General Specification v1.0
 * §6.6 Audit Support: Audit Trail, Checklist Module, Evidence Package
 * §6.4 Incident & Hazard: CAPA (Corrective & Preventive Action)
 */

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let allAudit      = [];
let allChecklist  = [];
let allCapa       = [];
let allTrail      = [];
let currentAuditId = null;

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadAudit();
});

/* ─────────────────────────────────────────────
   TABS
───────────────────────────────────────────── */
function switchTab(tabId, btn) {
  const panel = document.getElementById(tabId);
  if (!panel) return;

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  panel.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'tab-checklist') {
    populateAuditFilter('filter-audit-checklist');
    loadChecklist();
  } else if (tabId === 'tab-capa') {
    populateAuditFilter('filter-audit-capa');
    loadCapa();
  } else if (tabId === 'tab-trail') {
    loadAuditTrail();
  }
}

/* ─────────────────────────────────────────────
   LOAD AUDIT (jadwal)
───────────────────────────────────────────── */
async function loadAudit() {
  const tbody = document.getElementById('tbody-jadwal');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Memuat data…</p></div></td></tr>`;

  try {
    const { data, error } = await db
      .from('audit_k3')
      .select('*')
      .order('tanggal_rencana', { ascending: false });

    if (error) throw error;
    allAudit = data || [];

    updateSummaryAudit(allAudit);
    renderJadwalTable(allAudit);
    updateSummaryCapa();
    logTrail('Sistem', 'Load Data', 'Jadwal Audit', `Memuat ${allAudit.length} jadwal audit`);

  } catch (err) {
    console.error('loadAudit error:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Gagal memuat: ${err.message}</p></div></td></tr>`;
  }
}

function renderJadwalTable(data) {
  const tbody = document.getElementById('tbody-jadwal');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Belum ada jadwal audit. Klik "+ Jadwalkan Audit Baru" untuk memulai.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((a, idx) => {
    const tglRencana   = formatDate(a.tanggal_rencana);
    const tglRealisasi = a.tanggal_realisasi ? formatDate(a.tanggal_realisasi) : '<span class="text-muted-sm">–</span>';
    const jenisClass   = a.jenis_audit === 'Internal' ? 'badge-internal' : 'badge-eksternal';
    const statusClass  = a.status === 'Selesai' ? 'badge-selesai' : 'badge-terjadwal';

    return `<tr>
      <td class="text-muted-sm">${idx + 1}</td>
      <td><span class="badge ${jenisClass}">${escapeHtml(a.jenis_audit)}</span></td>
      <td class="td-standar">${escapeHtml(a.standar_k3)}</td>
      <td>${escapeHtml(a.auditor || '–')}</td>
      <td>${escapeHtml(a.departemen || '–')}</td>
      <td>${tglRencana}</td>
      <td>${tglRealisasi}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(a.status)}</span></td>
      <td>
        <div class="aksi-group">
          <button class="btn-sm btn-detail" onclick="openModalDetail(${a.id})">🔍 Detail</button>
          ${a.status !== 'Selesai'
            ? `<button class="btn-sm btn-selesai" onclick="tandaiSelesai(${a.id})">✅ Selesai</button>`
            : ''}
          <button class="btn-sm btn-hapus" onclick="hapusAudit(${a.id})">🗑️ Hapus</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   MODAL AUDIT
───────────────────────────────────────────── */
function openModalAudit() {
  const modal = document.getElementById('modal-audit');
  if (!modal) return;
  ['inp-jenis-audit','inp-standar','inp-tgl-rencana','inp-auditor','inp-dept','inp-scope']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  modal.classList.add('open');
}

function closeModalAudit() {
  const modal = document.getElementById('modal-audit');
  if (modal) modal.classList.remove('open');
}

async function simpanAudit() {
  const jenisAudit = document.getElementById('inp-jenis-audit')?.value;
  const standar    = document.getElementById('inp-standar')?.value?.trim();
  const tglRencana = document.getElementById('inp-tgl-rencana')?.value;
  const auditor    = document.getElementById('inp-auditor')?.value?.trim();
  const dept       = document.getElementById('inp-dept')?.value?.trim();
  const scope      = document.getElementById('inp-scope')?.value?.trim();

  if (!jenisAudit) { showToast('Pilih jenis audit.', 'error'); return; }
  if (!standar)    { showToast('Standar K3 wajib diisi.', 'error'); return; }
  if (!tglRencana) { showToast('Tanggal rencana wajib diisi.', 'error'); return; }

  try {
    const { error } = await db.from('audit_k3').insert([{
      jenis_audit:     jenisAudit,
      standar_k3:      standar,
      tanggal_rencana: tglRencana,
      auditor:         auditor || null,
      departemen:      dept || null,
      lingkup_audit:   scope || null,
      status:          'Terjadwal',
    }]);

    if (error) throw error;
    closeModalAudit();
    showToast('Jadwal audit berhasil disimpan!', 'success');
    logTrail(getCurrentUser(), 'Buat Jadwal Audit', 'Audit K3', `${jenisAudit} – ${standar}`);
    loadAudit();

  } catch (err) {
    showToast(`Gagal menyimpan: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   TANDAI SELESAI
───────────────────────────────────────────── */
async function tandaiSelesai(id) {
  if (!confirm('Tandai audit ini sebagai Selesai?')) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    const { error } = await db
      .from('audit_k3')
      .update({ status: 'Selesai', tanggal_realisasi: today })
      .eq('id', id);

    if (error) throw error;
    showToast('Audit ditandai Selesai.', 'success');
    logTrail(getCurrentUser(), 'Tandai Selesai', 'Audit K3', `Audit ID ${id} ditandai selesai`);
    loadAudit();
    closeModalDetail();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   HAPUS AUDIT
───────────────────────────────────────────── */
async function hapusAudit(id) {
  if (!confirm('Hapus jadwal audit ini beserta seluruh checklist dan CAPA-nya?')) return;
  try {
    const { error } = await db.from('audit_k3').delete().eq('id', id);
    if (error) throw error;
    showToast('Audit berhasil dihapus.', 'success');
    logTrail(getCurrentUser(), 'Hapus Audit', 'Audit K3', `Audit ID ${id} dihapus`);
    loadAudit();
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   DETAIL MODAL
───────────────────────────────────────────── */
async function openModalDetail(auditId) {
  currentAuditId = auditId;
  const audit = allAudit.find(a => a.id === auditId);
  if (!audit) return;

  const titleEl = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = `${audit.jenis_audit} – ${audit.standar_k3}`;

  const infoEl = document.getElementById('detail-info');
  if (infoEl) {
    const statusClass = audit.status === 'Selesai' ? 'badge-selesai' : 'badge-terjadwal';
    infoEl.innerHTML = `
      <div class="detail-info-grid">
        <div><span class="lbl-muted">Auditor:</span> ${escapeHtml(audit.auditor || '–')}</div>
        <div><span class="lbl-muted">Status:</span> <span class="badge ${statusClass}" style="font-size:.75rem;">${escapeHtml(audit.status)}</span></div>
        <div><span class="lbl-muted">Tgl. Rencana:</span> ${formatDate(audit.tanggal_rencana)}</div>
        <div><span class="lbl-muted">Tgl. Realisasi:</span> ${audit.tanggal_realisasi ? formatDate(audit.tanggal_realisasi) : '–'}</div>
        <div><span class="lbl-muted">Departemen:</span> ${escapeHtml(audit.departemen || '–')}</div>
        <div><span class="lbl-muted">Lingkup:</span> ${escapeHtml(audit.lingkup_audit || '–')}</div>
      </div>`;
  }

  // Hide "Selesai" button if already done
  const btnSelesai = document.getElementById('btn-detail-selesai');
  if (btnSelesai) btnSelesai.style.display = audit.status === 'Selesai' ? 'none' : '';

  const modal = document.getElementById('modal-detail');
  if (modal) modal.classList.add('open');
  await loadChecklistForDetail(auditId);
}

function closeModalDetail() {
  const modal = document.getElementById('modal-detail');
  if (modal) modal.classList.remove('open');
  currentAuditId = null;
}

async function loadChecklistForDetail(auditId) {
  const container = document.getElementById('detail-temuan-list');
  if (!container) return;
  container.innerHTML = '<p class="text-muted-sm">Memuat ringkasan temuan…</p>';

  try {
    const { data, error } = await db
      .from('audit_checklist')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-muted-sm">Belum ada item checklist untuk audit ini. Buka tab Checklist Audit untuk menambahkan.</p>';
      return;
    }

    // Count by classification
    const counts = { Conformance: 0, 'Minor NC': 0, 'Major NC': 0, Observation: 0 };
    data.forEach(item => { if (counts[item.klasifikasi] !== undefined) counts[item.klasifikasi]++; });

    container.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
        <span class="badge" style="background:#16a34a;">✅ Conformance: ${counts['Conformance']}</span>
        <span class="badge badge-minor">⚠️ Minor NC: ${counts['Minor NC']}</span>
        <span class="badge badge-mayor">🚨 Major NC: ${counts['Major NC']}</span>
        <span class="badge" style="background:#6366f1;">👁️ Observation: ${counts['Observation']}</span>
      </div>
      ${data.map(item => {
        const klasMap = {
          'Conformance': 'badge" style="background:#16a34a;"',
          'Minor NC': 'badge badge-minor"',
          'Major NC': 'badge badge-mayor"',
          'Observation': 'badge" style="background:#6366f1;"',
        };
        const klas = klasMap[item.klasifikasi] || 'badge"';
        return `<div class="temuan-item">
          <div class="temuan-item-header">
            <span class="${klas}>${escapeHtml(item.klasifikasi)}</span>
            <span class="text-muted-sm">${escapeHtml(item.klausul || '')}</span>
          </div>
          <div class="temuan-desc">${escapeHtml(item.deskripsi)}</div>
          ${item.evidence_ref ? `<div class="temuan-tindakan">📎 <b>Bukti:</b> ${escapeHtml(item.evidence_ref)}</div>` : ''}
        </div>`;
      }).join('')}`;

  } catch (err) {
    container.innerHTML = `<p class="text-muted-sm" style="color:#dc2626;">Gagal memuat: ${err.message}</p>`;
  }
}

function goToChecklistTab() {
  closeModalDetail();
  const btn = document.querySelectorAll('.tab-btn')[1];
  switchTab('tab-checklist', btn);
  if (currentAuditId) {
    setTimeout(() => {
      const sel = document.getElementById('filter-audit-checklist');
      if (sel) { sel.value = currentAuditId; loadChecklist(); }
    }, 100);
  }
}

/* ─────────────────────────────────────────────
   AUDIT CHECKLIST (§6.6.2)
───────────────────────────────────────────── */
function openModalChecklist(auditId) {
  const modal = document.getElementById('modal-checklist');
  if (!modal) return;

  // Reset
  ['inp-klausul','inp-checklist-desc','inp-evidence-ref','inp-checklist-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('inp-klasifikasi').value = '';
  document.getElementById('inp-checklist-edit-id').value = '';

  populateChecklistAuditSelect();
  if (auditId) document.getElementById('inp-checklist-audit-sel').value = auditId;

  modal.classList.add('open');
}

function closeModalChecklist() {
  const modal = document.getElementById('modal-checklist');
  if (modal) modal.classList.remove('open');
}

function populateChecklistAuditSelect() {
  const sel = document.getElementById('inp-checklist-audit-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Event Audit --</option>';
  allAudit.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.jenis_audit} – ${a.standar_k3} (${formatDate(a.tanggal_rencana)})`;
    sel.appendChild(opt);
  });
}

async function simpanChecklist() {
  const auditId  = document.getElementById('inp-checklist-audit-sel')?.value;
  const klausul  = document.getElementById('inp-klausul')?.value?.trim();
  const deskripsi= document.getElementById('inp-checklist-desc')?.value?.trim();
  const klasif   = document.getElementById('inp-klasifikasi')?.value;
  const evidence = document.getElementById('inp-evidence-ref')?.value?.trim();
  const notes    = document.getElementById('inp-checklist-notes')?.value?.trim();
  const editId   = document.getElementById('inp-checklist-edit-id')?.value;

  if (!auditId)  { showToast('Pilih event audit.', 'error'); return; }
  if (!klausul)  { showToast('Klausul wajib diisi.', 'error'); return; }
  if (!deskripsi){ showToast('Deskripsi temuan wajib diisi.', 'error'); return; }
  if (!klasif)   { showToast('Klasifikasi temuan wajib dipilih.', 'error'); return; }

  const payload = {
    audit_id:     parseInt(auditId),
    klausul,
    deskripsi,
    klasifikasi:  klasif,
    evidence_ref: evidence || null,
    catatan:      notes || null,
    capa_status:  (klasif === 'Conformance') ? 'N/A' : 'Open',
  };

  try {
    let err;
    if (editId) {
      ({ error: err } = await db.from('audit_checklist').update(payload).eq('id', editId));
    } else {
      ({ error: err } = await db.from('audit_checklist').insert([payload]));
    }
    if (err) throw err;

    closeModalChecklist();
    showToast('Item checklist berhasil disimpan!', 'success');
    logTrail(getCurrentUser(), editId ? 'Edit Checklist Item' : 'Tambah Checklist Item', 'Checklist Audit', `${klasif} – ${klausul}`);
    loadChecklist();
    updateSummaryCapa();

  } catch (err) {
    showToast(`Gagal menyimpan: ${err.message}`, 'error');
  }
}

async function loadChecklist() {
  const auditId = document.getElementById('filter-audit-checklist')?.value;
  const tbody   = document.getElementById('tbody-checklist');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Memuat checklist…</p></div></td></tr>`;

  try {
    let query = db
      .from('audit_checklist')
      .select('*, audit_k3(jenis_audit, standar_k3)')
      .order('created_at', { ascending: false });

    if (auditId) query = query.eq('audit_id', auditId);

    const { data, error } = await query;
    if (error) throw error;

    allChecklist = data || [];
    renderChecklistTable(allChecklist);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Gagal memuat: ${err.message}</p></div></td></tr>`;
  }
}

function filterChecklist() {
  const status   = document.getElementById('filter-status-checklist')?.value;
  const filtered = !status ? allChecklist : allChecklist.filter(c => c.klasifikasi === status);
  renderChecklistTable(filtered);
}

function renderChecklistTable(data) {
  const tbody = document.getElementById('tbody-checklist');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Tidak ada item checklist ditemukan.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((c, idx) => {
    const klasMap = {
      'Conformance': 'badge" style="background:#16a34a;"',
      'Minor NC':    'badge badge-minor"',
      'Major NC':    'badge badge-mayor"',
      'Observation': 'badge" style="background:#6366f1;"',
    };
    const klas = klasMap[c.klasifikasi] || 'badge"';

    const capaStatusMap = {
      'N/A':         'badge" style="background:#9ca3af;"',
      'Open':        'badge badge-open"',
      'In Progress': 'badge" style="background:#f59e0b;"',
      'Closed':      'badge badge-closed"',
    };
    const capaKlas = capaStatusMap[c.capa_status] || 'badge"';

    return `<tr>
      <td class="text-muted-sm">${idx + 1}</td>
      <td>${escapeHtml(c.klausul)}</td>
      <td>${escapeHtml(c.deskripsi)}</td>
      <td><span class="${klas}>${escapeHtml(c.klasifikasi)}</span></td>
      <td>${escapeHtml(c.evidence_ref || '–')}</td>
      <td><span class="${capaKlas}>${escapeHtml(c.capa_status || '–')}</span></td>
      <td>
        <div class="aksi-group">
          ${(c.klasifikasi !== 'Conformance' && c.capa_status !== 'Closed')
            ? `<button class="btn-sm btn-selesai" onclick="openModalCapa(${c.id}, '${escapeHtml(c.klausul)}')">+ CAPA</button>`
            : ''}
          <button class="btn-sm btn-hapus" onclick="hapusChecklistItem(${c.id})">Hapus</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function hapusChecklistItem(id) {
  if (!confirm('Hapus item checklist ini?')) return;
  try {
    const { error } = await db.from('audit_checklist').delete().eq('id', id);
    if (error) throw error;
    showToast('Item checklist dihapus.', 'success');
    logTrail(getCurrentUser(), 'Hapus Checklist Item', 'Checklist Audit', `ID ${id}`);
    loadChecklist();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   CAPA MODULE (§6.4 + §6.6.2)
───────────────────────────────────────────── */
function openModalCapa(checklistId, refLabel) {
  const modal = document.getElementById('modal-capa');
  if (!modal) return;

  document.getElementById('inp-capa-checklist-id').value = checklistId || '';
  document.getElementById('inp-capa-edit-id').value      = '';
  document.getElementById('inp-capa-ref').value          = refLabel || `Checklist ID ${checklistId}`;
  document.getElementById('inp-capa-ca').value           = '';
  document.getElementById('inp-capa-pa').value           = '';
  document.getElementById('inp-capa-pic').value          = '';
  document.getElementById('inp-capa-target').value       = '';
  document.getElementById('inp-capa-status').value       = 'Open';

  modal.classList.add('open');
}

function closeModalCapa() {
  const modal = document.getElementById('modal-capa');
  if (modal) modal.classList.remove('open');
}

async function simpanCapa() {
  const checklistId = document.getElementById('inp-capa-checklist-id')?.value;
  const ca          = document.getElementById('inp-capa-ca')?.value?.trim();
  const pa          = document.getElementById('inp-capa-pa')?.value?.trim();
  const pic         = document.getElementById('inp-capa-pic')?.value?.trim();
  const target      = document.getElementById('inp-capa-target')?.value;
  const status      = document.getElementById('inp-capa-status')?.value;
  const editId      = document.getElementById('inp-capa-edit-id')?.value;

  if (!ca) { showToast('Tindakan Korektif wajib diisi.', 'error'); return; }

  const payload = {
    checklist_id:        checklistId ? parseInt(checklistId) : null,
    tindakan_korektif:   ca,
    tindakan_preventif:  pa || null,
    pic:                 pic || null,
    target_selesai:      target || null,
    status_capa:         status,
  };

  try {
    let err;
    if (editId) {
      ({ error: err } = await db.from('capa_items').update(payload).eq('id', editId));
    } else {
      ({ error: err } = await db.from('capa_items').insert([payload]));
      // Update checklist item capa_status
      if (!err && checklistId) {
        await db.from('audit_checklist').update({ capa_status: status }).eq('id', checklistId);
      }
    }
    if (err) throw err;

    closeModalCapa();
    showToast('CAPA berhasil disimpan!', 'success');
    logTrail(getCurrentUser(), editId ? 'Edit CAPA' : 'Tambah CAPA', 'CAPA', `Status: ${status}`);
    loadCapa();
    loadChecklist();
    updateSummaryCapa();

  } catch (err) {
    showToast(`Gagal menyimpan CAPA: ${err.message}`, 'error');
  }
}

async function loadCapa() {
  const auditId = document.getElementById('filter-audit-capa')?.value;
  const tbody   = document.getElementById('tbody-capa');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Memuat CAPA…</p></div></td></tr>`;

  try {
    let query = db
      .from('capa_items')
      .select('*, audit_checklist(klausul, klasifikasi, audit_id, audit_k3(jenis_audit, standar_k3))')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    allCapa = data || [];
    // Filter by audit if selected
    let filtered = allCapa;
    if (auditId) {
      filtered = allCapa.filter(c => c.audit_checklist?.audit_id === parseInt(auditId));
    }
    renderCapaTable(filtered);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Gagal memuat: ${err.message}</p></div></td></tr>`;
  }
}

function filterCapa() {
  const status   = document.getElementById('filter-status-capa')?.value;
  const auditId  = document.getElementById('filter-audit-capa')?.value;
  let filtered = allCapa;
  if (auditId) filtered = filtered.filter(c => c.audit_checklist?.audit_id === parseInt(auditId));
  if (status)  filtered = filtered.filter(c => c.status_capa === status);
  renderCapaTable(filtered);
}

function renderCapaTable(data) {
  const tbody = document.getElementById('tbody-capa');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Tidak ada CAPA ditemukan.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((c, idx) => {
    const auditLabel = c.audit_checklist?.audit_k3
      ? `${c.audit_checklist.audit_k3.jenis_audit} – ${c.audit_checklist.audit_k3.standar_k3}`
      : '–';
    const temuan = c.audit_checklist
      ? `${c.audit_checklist.klasifikasi}: ${c.audit_checklist.klausul}`
      : `CAPA #${c.id}`;

    const statusMap = {
      'Open':        'badge badge-open"',
      'In Progress': 'badge" style="background:#f59e0b;"',
      'Closed':      'badge badge-closed"',
    };
    const stKlas = statusMap[c.status_capa] || 'badge"';

    return `<tr>
      <td class="text-muted-sm">${idx + 1}</td>
      <td>${escapeHtml(auditLabel)}</td>
      <td>${escapeHtml(temuan)}</td>
      <td>${escapeHtml(c.tindakan_korektif)}</td>
      <td>${escapeHtml(c.tindakan_preventif || '–')}</td>
      <td>${escapeHtml(c.pic || '–')}</td>
      <td>${c.target_selesai ? formatDate(c.target_selesai) : '–'}</td>
      <td><span class="${stKlas}>${escapeHtml(c.status_capa)}</span></td>
      <td>
        <div class="aksi-group">
          ${c.status_capa !== 'Closed'
            ? `<button class="btn-sm btn-selesai" onclick="tutupCapa(${c.id}, ${c.checklist_id})">Tutup</button>`
            : ''}
          <button class="btn-sm btn-hapus" onclick="hapusCapa(${c.id})">Hapus</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function tutupCapa(id, checklistId) {
  if (!confirm('Tandai CAPA ini sebagai Closed?')) return;
  try {
    const { error: e1 } = await db.from('capa_items').update({ status_capa: 'Closed' }).eq('id', id);
    if (e1) throw e1;
    if (checklistId) {
      await db.from('audit_checklist').update({ capa_status: 'Closed' }).eq('id', checklistId);
    }
    showToast('CAPA ditandai Closed.', 'success');
    logTrail(getCurrentUser(), 'Tutup CAPA', 'CAPA', `CAPA ID ${id} closed`);
    loadCapa();
    loadChecklist();
    updateSummaryCapa();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
  }
}

async function hapusCapa(id) {
  if (!confirm('Hapus CAPA ini?')) return;
  try {
    const { error } = await db.from('capa_items').delete().eq('id', id);
    if (error) throw error;
    showToast('CAPA dihapus.', 'success');
    logTrail(getCurrentUser(), 'Hapus CAPA', 'CAPA', `ID ${id}`);
    loadCapa();
    updateSummaryCapa();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   AUDIT TRAIL (§6.6.1) — read-only, immutable
───────────────────────────────────────────── */
const _trailBuffer = []; // In-memory trail for session actions

function logTrail(user, action, module, detail) {
  _trailBuffer.unshift({
    ts:     new Date().toLocaleString('id-ID'),
    user,
    action,
    module,
    detail,
  });
  // also try to persist to DB
  if (typeof db !== 'undefined') {
    db.from('audit_trail').insert([{
      pengguna: user,
      aksi:     action,
      modul:    module,
      detail,
    }]).then(() => {}).catch(() => {});
  }
}

async function loadAuditTrail() {
  const tbody = document.getElementById('tbody-trail');
  if (!tbody) return;

  try {
    const { data, error } = await db
      .from('audit_trail')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    allTrail = [
      ..._trailBuffer.map(t => ({
        created_at: t.ts,
        pengguna:   t.user,
        aksi:       t.action,
        modul:      t.module,
        detail:     t.detail,
        _local:     true,
      })),
      ...(data || []),
    ];

    renderTrailTable(allTrail);

  } catch (err) {
    // Fallback: show in-memory buffer only
    allTrail = _trailBuffer.map(t => ({
      created_at: t.ts,
      pengguna:   t.user,
      aksi:       t.action,
      modul:      t.module,
      detail:     t.detail,
      _local:     true,
    }));
    renderTrailTable(allTrail);
  }
}

function filterTrail() {
  const userFilter = document.getElementById('filter-trail-user')?.value?.toLowerCase();
  const dateFilter = document.getElementById('filter-trail-date')?.value;

  let filtered = allTrail;
  if (userFilter) filtered = filtered.filter(t => (t.pengguna || '').toLowerCase().includes(userFilter));
  if (dateFilter) filtered = filtered.filter(t => (t.created_at || '').startsWith(dateFilter));
  renderTrailTable(filtered);
}

function renderTrailTable(data) {
  const tbody = document.getElementById('tbody-trail');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>Tidak ada catatan audit trail.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(t => `<tr>
    <td class="text-muted-sm" style="white-space:nowrap;">${escapeHtml(t.created_at || '–')}</td>
    <td>${escapeHtml(t.pengguna || '–')}</td>
    <td><strong>${escapeHtml(t.aksi || '–')}</strong></td>
    <td><span class="badge badge-internal" style="font-size:10px;">${escapeHtml(t.modul || '–')}</span></td>
    <td>${escapeHtml(t.detail || '–')}</td>
  </tr>`).join('');
}

/* ─────────────────────────────────────────────
   EVIDENCE PACKAGE (§6.6.3)
───────────────────────────────────────────── */
async function exportEvidencePackage(auditId) {
  if (!auditId) { showToast('Pilih event audit terlebih dahulu.', 'error'); return; }
  const audit = allAudit.find(a => a.id === auditId);
  if (!audit) return;

  showToast('Menyiapkan Evidence Package…', 'info');

  try {
    // Fetch checklist items
    const { data: checklistData } = await db
      .from('audit_checklist')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: true });

    // Fetch CAPA items linked to this audit's checklist
    const checklistIds = (checklistData || []).map(c => c.id);
    let capaData = [];
    if (checklistIds.length > 0) {
      const { data: cd } = await db
        .from('capa_items')
        .select('*')
        .in('checklist_id', checklistIds);
      capaData = cd || [];
    }

    // Build HTML report
    const now = new Date().toLocaleString('id-ID');
    const html = buildEvidencePackageHTML(audit, checklistData || [], capaData, now);

    // Open in new window for printing/saving as PDF
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      logTrail(getCurrentUser(), 'Export Evidence Package', 'Audit K3', `${audit.jenis_audit} – ${audit.standar_k3}`);
    } else {
      showToast('Popup diblokir browser. Izinkan popup untuk export.', 'error');
    }

  } catch (err) {
    showToast(`Gagal export: ${err.message}`, 'error');
  }
}

function buildEvidencePackageHTML(audit, checklist, capa, generatedAt) {
  const countByKlas = { Conformance: 0, 'Minor NC': 0, 'Major NC': 0, Observation: 0 };
  checklist.forEach(c => { if (countByKlas[c.klasifikasi] !== undefined) countByKlas[c.klasifikasi]++; });

  const checklistRows = checklist.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${c.klausul || ''}</td>
      <td>${c.deskripsi || ''}</td>
      <td><b>${c.klasifikasi || ''}</b></td>
      <td>${c.evidence_ref || '–'}</td>
      <td>${c.capa_status || '–'}</td>
      <td>${c.catatan || '–'}</td>
    </tr>`).join('');

  const capaRows = capa.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${c.tindakan_korektif || ''}</td>
      <td>${c.tindakan_preventif || '–'}</td>
      <td>${c.pic || '–'}</td>
      <td>${c.target_selesai ? formatDate(c.target_selesai) : '–'}</td>
      <td><b>${c.status_capa || ''}</b></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"/>
<title>Evidence Package – ${audit.jenis_audit} ${audit.standar_k3}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 30px; }
  h1 { color: #0F3D56; font-size: 18px; }
  h2 { color: #0F3D56; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #0F3D56; color: white; }
  tr:nth-child(even) { background: #f5f5f5; }
  .summary-box { display: flex; gap: 20px; margin: 12px 0; flex-wrap: wrap; }
  .kpi { background: #f0f8ff; border: 1px solid #ccc; border-radius: 6px; padding: 10px 16px; text-align: center; min-width: 100px; }
  .kpi .num { font-size: 22px; font-weight: bold; color: #0F3D56; }
  .kpi .lbl { font-size: 11px; color: #666; }
  .footer { margin-top: 30px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { button { display: none; } }
</style>
</head><body>
<h1>📦 Evidence Package — Audit K3</h1>
<p><b>Jenis Audit:</b> ${audit.jenis_audit} &nbsp;|&nbsp; <b>Standar:</b> ${audit.standar_k3}</p>
<p><b>Auditor:</b> ${audit.auditor || '–'} &nbsp;|&nbsp; <b>Tgl. Rencana:</b> ${formatDate(audit.tanggal_rencana)} &nbsp;|&nbsp; <b>Tgl. Realisasi:</b> ${audit.tanggal_realisasi ? formatDate(audit.tanggal_realisasi) : '–'}</p>
<p><b>Departemen:</b> ${audit.departemen || '–'} &nbsp;|&nbsp; <b>Lingkup:</b> ${audit.lingkup_audit || '–'} &nbsp;|&nbsp; <b>Status:</b> ${audit.status}</p>

<h2>Ringkasan Temuan</h2>
<div class="summary-box">
  <div class="kpi"><div class="num" style="color:#16a34a;">${countByKlas['Conformance']}</div><div class="lbl">Conformance</div></div>
  <div class="kpi"><div class="num" style="color:#f59e0b;">${countByKlas['Observation']}</div><div class="lbl">Observation</div></div>
  <div class="kpi"><div class="num" style="color:#e67e22;">${countByKlas['Minor NC']}</div><div class="lbl">Minor NC</div></div>
  <div class="kpi"><div class="num" style="color:#dc2626;">${countByKlas['Major NC']}</div><div class="lbl">Major NC</div></div>
  <div class="kpi"><div class="num">${capa.length}</div><div class="lbl">Total CAPA</div></div>
</div>

<h2>Detail Checklist Audit</h2>
<table>
  <thead><tr><th>#</th><th>Klausul / Persyaratan</th><th>Deskripsi Temuan</th><th>Klasifikasi</th><th>Referensi Bukti</th><th>Status CAPA</th><th>Catatan</th></tr></thead>
  <tbody>${checklistRows || '<tr><td colspan="7">Tidak ada item checklist.</td></tr>'}</tbody>
</table>

<h2>Daftar CAPA (Corrective & Preventive Action)</h2>
<table>
  <thead><tr><th>#</th><th>Tindakan Korektif</th><th>Tindakan Preventif</th><th>PIC</th><th>Target Selesai</th><th>Status</th></tr></thead>
  <tbody>${capaRows || '<tr><td colspan="6">Tidak ada CAPA terdaftar.</td></tr>'}</tbody>
</table>

<div class="footer">
  <p>Dokumen ini dibuat secara otomatis oleh K3-IMS pada ${generatedAt}. Sesuai K3-IMS General Specification §6.6.3 Evidence Package.</p>
  <p>OTSUKA K3 — Sistem Informasi Manajemen K3</p>
</div>
<br/><button onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
</body></html>`;
}

/* ─────────────────────────────────────────────
   POPULATE FILTER DROPDOWNS
───────────────────────────────────────────── */
function populateAuditFilter(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Semua Event Audit --</option>';
  allAudit.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.jenis_audit} – ${a.standar_k3} (${formatDate(a.tanggal_rencana)})`;
    sel.appendChild(opt);
  });
  sel.value = current;
}

/* ─────────────────────────────────────────────
   SUMMARY COUNTS
───────────────────────────────────────────── */
function updateSummaryAudit(data) {
  const totalEl     = document.getElementById('sum-total');
  const terjadwalEl = document.getElementById('sum-terjadwal');
  const selesaiEl   = document.getElementById('sum-selesai');

  if (totalEl)     totalEl.textContent     = data.length;
  if (terjadwalEl) terjadwalEl.textContent = data.filter(a => a.status === 'Terjadwal').length;
  if (selesaiEl)   selesaiEl.textContent   = data.filter(a => a.status === 'Selesai').length;
}

async function updateSummaryCapa() {
  const openEl   = document.getElementById('sum-open');
  const closedEl = document.getElementById('sum-closed');
  if (!openEl && !closedEl) return;

  try {
    const { data, error } = await db.from('capa_items').select('status_capa');
    if (error) throw error;
    const items = data || [];
    if (openEl)   openEl.textContent   = items.filter(t => t.status_capa === 'Open' || t.status_capa === 'In Progress').length;
    if (closedEl) closedEl.textContent = items.filter(t => t.status_capa === 'Closed').length;
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getCurrentUser() {
  // Attempt to get from auth module; fallback gracefully
  try {
    return window._currentUser?.name || window._currentUser?.email || 'Admin';
  } catch (_) { return 'Admin'; }
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#111827';
  toast.style.display    = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Menutup modal dengan klik overlay luar
document.addEventListener('click', (e) => {
  ['modal-audit', 'modal-checklist', 'modal-capa', 'modal-detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) {
      el.classList.remove('open');
      if (id === 'modal-detail') currentAuditId = null;
    }
  });
});