/**
 * audit.js
 * Kartiko Widyotomo – Document Repository & Audit Specialist
 */

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let allAudit       = [];
let allTemuan      = [];
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

  if (tabId === 'tab-temuan') {
    populateAuditFilter();
    loadTemuan();
  }
}

/* ─────────────────────────────────────────────
   LOAD AUDIT (jadwal)
───────────────────────────────────────────── */
async function loadAudit() {
  const tbody = document.getElementById('tbody-jadwal');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Memuat data…</p></div></td></tr>`;
  }

  try {
    const { data, error } = await db
      .from('audit_k3')
      .select('*')
      .order('tanggal_rencana', { ascending: false });

    if (error) throw error;
    allAudit = data || [];

    updateSummaryAudit(allAudit);
    renderJadwalTable(allAudit);
    updateSummaryTemuan();

  } catch (err) {
    console.error('loadAudit error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Gagal memuat: ${err.message}</p></div></td></tr>`;
    }
  }
}

function renderJadwalTable(data) {
  const tbody = document.getElementById('tbody-jadwal');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Belum ada jadwal audit. Klik "+ Jadwalkan Audit Baru" untuk memulai.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((a, idx) => {
    const tglRencana   = formatDate(a.tanggal_rencana);
    const tglRealisasi = a.tanggal_realisasi
      ? formatDate(a.tanggal_realisasi)
      : '<span class="text-muted-sm">–</span>';
    const jenisClass  = a.jenis_audit === 'Internal' ? 'badge-internal' : 'badge-eksternal';
    const statusClass = a.status === 'Selesai' ? 'badge-selesai' : 'badge-terjadwal';

    return `<tr>
      <td class="text-muted-sm">${idx + 1}</td>
      <td><span class="badge ${jenisClass}">${escapeHtml(a.jenis_audit)}</span></td>
      <td class="td-standar">${escapeHtml(a.standar_k3)}</td>
      <td>${escapeHtml(a.auditor || '–')}</td>
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

  document.getElementById('inp-jenis-audit').value  = '';
  document.getElementById('inp-standar').value      = '';
  document.getElementById('inp-tgl-rencana').value  = '';
  document.getElementById('inp-auditor').value      = '';

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

  if (!jenisAudit) { showToast('Pilih jenis audit.', 'error');            return; }
  if (!standar)    { showToast('Standar K3 wajib diisi.', 'error');       return; }
  if (!tglRencana) { showToast('Tanggal rencana wajib diisi.', 'error'); return; }

  try {
    const { error } = await db.from('audit_k3').insert([{
      jenis_audit:     jenisAudit,
      standar_k3:      standar,
      tanggal_rencana: tglRencana,
      auditor:         auditor || null,
      status:          'Terjadwal',
    }]);

    if (error) throw error;
    closeModalAudit();
    showToast('Jadwal audit berhasil disimpan!', 'success');
    loadAudit();

  } catch (err) {
    console.error('simpanAudit error:', err);
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
    loadAudit();

  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   HAPUS AUDIT
───────────────────────────────────────────── */
async function hapusAudit(id) {
  if (!confirm('Hapus jadwal audit ini beserta semua temuannya?')) return;
  try {
    const { error } = await db.from('audit_k3').delete().eq('id', id);
    if (error) throw error;
    showToast('Audit berhasil dihapus.', 'success');
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
  if (titleEl) titleEl.textContent = `${audit.jenis_audit} – ${escapeHtml(audit.standar_k3)}`;

  const infoEl = document.getElementById('detail-info');
  if (infoEl) {
    const statusClass = audit.status === 'Selesai' ? 'badge-selesai' : 'badge-terjadwal';
    infoEl.innerHTML = `
      <div class="detail-info-grid">
        <div><span class="lbl-muted">Auditor:</span> ${escapeHtml(audit.auditor || '–')}</div>
        <div><span class="lbl-muted">Status:</span> <span class="badge ${statusClass}" style="font-size:.75rem;">${escapeHtml(audit.status)}</span></div>
        <div><span class="lbl-muted">Tgl. Rencana:</span> ${formatDate(audit.tanggal_rencana)}</div>
        <div><span class="lbl-muted">Tgl. Realisasi:</span> ${audit.tanggal_realisasi ? formatDate(audit.tanggal_realisasi) : '–'}</div>
      </div>`;
  }

  const modal = document.getElementById('modal-detail');
  if (modal) modal.classList.add('open');
  await loadTemuanForDetail(auditId);
}

function closeModalDetail() {
  const modal = document.getElementById('modal-detail');
  if (modal) modal.classList.remove('open');
  currentAuditId = null;
}

async function loadTemuanForDetail(auditId) {
  const container = document.getElementById('detail-temuan-list');
  if (!container) return;
  container.innerHTML = '<p class="text-muted-sm">Memuat temuan…</p>';

  try {
    const { data, error } = await db
      .from('temuan_audit')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-muted-sm">Belum ada temuan untuk audit ini.</p>';
      return;
    }

    container.innerHTML = data.map(t => {
      const katClass    = t.kategori === 'Mayor' ? 'badge-mayor' : 'badge-minor';
      const statusClass = t.status_perbaikan === 'Closed' ? 'badge-closed' : 'badge-open';
      return `<div class="temuan-item">
        <div class="temuan-item-header">
          <span class="badge ${katClass}">${escapeHtml(t.kategori || 'Minor')}</span>
          <div class="temuan-item-actions">
            <span class="badge ${statusClass}">${escapeHtml(t.status_perbaikan)}</span>
            ${t.status_perbaikan === 'Open'
              ? `<button class="btn-sm btn-selesai" onclick="tutupTemuan(${t.id})">Tutup</button>`
              : ''}
            <button class="btn-sm btn-hapus" onclick="hapusTemuan(${t.id})">Hapus</button>
          </div>
        </div>
        <div class="temuan-desc"><b>Temuan:</b> ${escapeHtml(t.deskripsi_temuan)}</div>
        ${t.tindakan_koreksi
          ? `<div class="temuan-tindakan">🔧 <b>Koreksi:</b> ${escapeHtml(t.tindakan_koreksi)}</div>`
          : ''}
      </div>`;
    }).join('');

    updateSummaryTemuan();

  } catch (err) {
    container.innerHTML = `<p class="text-muted-sm" style="color:#dc2626;">Gagal memuat temuan: ${err.message}</p>`;
  }
}

/* ─────────────────────────────────────────────
   TEMUAN (standalone tab)
───────────────────────────────────────────── */
function populateAuditFilter() {
  const sel = document.getElementById('filter-audit');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Semua Audit --</option>';
  allAudit.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.jenis_audit} – ${a.standar_k3} (${formatDate(a.tanggal_rencana)})`;
    sel.appendChild(opt);
  });
  sel.value = current;
}

async function loadTemuan() {
  const auditId = document.getElementById('filter-audit')?.value;
  const tbody   = document.getElementById('tbody-temuan');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Memuat temuan…</p></div></td></tr>`;

  try {
    let query = db
      .from('temuan_audit')
      .select('*, audit_k3(jenis_audit, standar_k3)')
      .order('created_at', { ascending: false });

    if (auditId) query = query.eq('audit_id', auditId);

    const { data, error } = await query;
    if (error) throw error;

    allTemuan = data || [];
    renderTemuanTable(allTemuan);
    updateSummaryTemuan();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Gagal memuat: ${err.message}</p></div></td></tr>`;
  }
}

function filterTemuan() {
  const status   = document.getElementById('filter-status-temuan')?.value;
  const filtered = !status ? allTemuan : allTemuan.filter(t => t.status_perbaikan === status);
  renderTemuanTable(filtered);
}

function renderTemuanTable(data) {
  const tbody = document.getElementById('tbody-temuan');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Tidak ada temuan ditemukan.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((t, idx) => {
    const auditLabel  = t.audit_k3
      ? `${escapeHtml(t.audit_k3.jenis_audit)} – ${escapeHtml(t.audit_k3.standar_k3)}`
      : `Audit #${t.audit_id}`;
    const katClass    = t.kategori === 'Mayor' ? 'badge-mayor' : 'badge-minor';
    const statusClass = t.status_perbaikan === 'Closed' ? 'badge-closed' : 'badge-open';

    return `<tr>
      <td class="text-muted-sm">${idx + 1}</td>
      <td class="td-ref">${auditLabel}</td>
      <td class="td-desc">${escapeHtml(t.deskripsi_temuan)}</td>
      <td><span class="badge ${katClass}">${escapeHtml(t.kategori || '–')}</span></td>
      <td class="td-tindakan">${escapeHtml(t.tindakan_koreksi || '–')}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(t.status_perbaikan)}</span></td>
      <td>
        <div class="aksi-group">
          ${t.status_perbaikan === 'Open'
            ? `<button class="btn-sm btn-selesai" onclick="tutupTemuan(${t.id})">Tutup</button>`
            : ''}
          <button class="btn-sm btn-hapus" onclick="hapusTemuan(${t.id})">Hapus</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   MODAL TEMUAN
───────────────────────────────────────────── */
function openModalTemuan(auditId) {
  const modal = document.getElementById('modal-temuan');
  if (!modal) return;

  document.getElementById('inp-audit-id-temuan').value  = auditId;
  document.getElementById('inp-deskripsi').value        = '';
  document.getElementById('inp-kategori').value         = '';
  document.getElementById('inp-status-perbaikan').value = 'Open';
  document.getElementById('inp-tindakan').value         = '';

  modal.classList.add('open');
}

function closeModalTemuan() {
  const modal = document.getElementById('modal-temuan');
  if (modal) modal.classList.remove('open');
}

async function simpanTemuan() {
  const auditId   = document.getElementById('inp-audit-id-temuan')?.value;
  const deskripsi = document.getElementById('inp-deskripsi')?.value?.trim();
  const kategori  = document.getElementById('inp-kategori')?.value;
  const status    = document.getElementById('inp-status-perbaikan')?.value;
  const tindakan  = document.getElementById('inp-tindakan')?.value?.trim();

  if (!deskripsi) { showToast('Deskripsi temuan wajib diisi.', 'error');   return; }
  if (!kategori)  { showToast('Kategori temuan wajib dipilih.', 'error'); return; }

  try {
    const { error } = await db.from('temuan_audit').insert([{
      audit_id:         parseInt(auditId),
      deskripsi_temuan: deskripsi,
      kategori:         kategori,
      tindakan_koreksi: tindakan || null,
      status_perbaikan: status,
    }]);

    if (error) throw error;
    closeModalTemuan();
    showToast('Temuan berhasil disimpan!', 'success');

    if (currentAuditId) await loadTemuanForDetail(currentAuditId);
    await loadAudit();
    if (document.getElementById('tab-temuan')?.classList?.contains('active')) loadTemuan();

  } catch (err) {
    showToast(`Gagal menyimpan temuan: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   TUTUP TEMUAN (Open → Closed)
───────────────────────────────────────────── */
async function tutupTemuan(id) {
  if (!confirm('Tandai temuan ini sebagai Closed (selesai diperbaiki)?')) return;
  try {
    const { error } = await db
      .from('temuan_audit')
      .update({ status_perbaikan: 'Closed' })
      .eq('id', id);

    if (error) throw error;
    showToast('Temuan ditandai Closed.', 'success');
    if (currentAuditId) await loadTemuanForDetail(currentAuditId);
    await loadAudit();
    if (document.getElementById('tab-temuan')?.classList?.contains('active')) loadTemuan();

  } catch (err) {
    showToast(`Gagal: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   HAPUS TEMUAN
───────────────────────────────────────────── */
async function hapusTemuan(id) {
  if (!confirm('Hapus temuan ini?')) return;
  try {
    const { error } = await db.from('temuan_audit').delete().eq('id', id);
    if (error) throw error;
    showToast('Temuan dihapus.', 'success');
    if (currentAuditId) await loadTemuanForDetail(currentAuditId);
    await loadAudit();
    if (document.getElementById('tab-temuan')?.classList?.contains('active')) loadTemuan();
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   SUMMARY COUNTS
───────────────────────────────────────────── */
function updateSummaryAudit(data) {
  const totalEl    = document.getElementById('sum-total');
  const terjadwalEl = document.getElementById('sum-terjadwal');
  const selesaiEl  = document.getElementById('sum-selesai');

  if (totalEl)     totalEl.textContent    = data.length;
  if (terjadwalEl) terjadwalEl.textContent = data.filter(a => a.status === 'Terjadwal').length;
  if (selesaiEl)   selesaiEl.textContent  = data.filter(a => a.status === 'Selesai').length;
}

async function updateSummaryTemuan() {
  const openEl   = document.getElementById('sum-open');
  const closedEl = document.getElementById('sum-closed');
  if (!openEl && !closedEl) return;

  try {
    const { data, error } = await db
      .from('temuan_audit')
      .select('status_perbaikan');

    if (error) throw error;
    const items = data || [];
    if (openEl)   openEl.textContent   = items.filter(t => t.status_perbaikan === 'Open').length;
    if (closedEl) closedEl.textContent = items.filter(t => t.status_perbaikan === 'Closed').length;
  } catch (_) { /* abaikan error summary */ }
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
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
  ['modal-audit', 'modal-temuan', 'modal-detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) {
      el.classList.remove('open');
      if (id === 'modal-detail') currentAuditId = null;
    }
  });
});