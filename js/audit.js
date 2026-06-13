/**
 * audit.js
 * Kartiko Widyotomo – Document Repository & Audit Specialist
 *
 * Handles:
 *  - Scheduling audits (audit_k3 table)
 *  - Recording audit findings (temuan_audit table)
 *  - Status management: Terjadwal → Selesai, Open → Closed
 *  - Filtering and displaying both tables
 */

const supabase = db;

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let allAudit   = [];
let allTemuan  = [];
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
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');

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
  tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Memuat data…</p></div></td></tr>`;

  try {
    const { data, error } = await supabase
      .from('audit_k3')
      .select('*')
      .order('tanggal_rencana', { ascending: false });

    if (error) throw error;
    allAudit = data || [];
    updateSummaryAudit(allAudit);
    renderJadwalTable(allAudit);
    populateAuditFilter();

  } catch (err) {
    console.error('loadAudit error:', err);
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Gagal memuat: ${err.message}</p></div></td></tr>`;
  }
}

function renderJadwalTable(data) {
  const tbody = document.getElementById('tbody-jadwal');
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p>Belum ada jadwal audit. Klik "+ Jadwalkan Audit Baru" untuk memulai.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((a, idx) => {
    const tglRencana    = formatDate(a.tanggal_rencana);
    const tglRealisasi  = a.tanggal_realisasi ? formatDate(a.tanggal_realisasi) : '<span style="color:#9ca3af">–</span>';
    const jenisClass    = a.jenis_audit === 'Internal' ? 'badge-internal' : 'badge-eksternal';
    const statusClass   = a.status === 'Selesai' ? 'badge-selesai' : 'badge-terjadwal';

    return `<tr>
      <td style="color:#9ca3af; font-size:.8rem;">${idx + 1}</td>
      <td><span class="badge ${jenisClass}">${escapeHtml(a.jenis_audit)}</span></td>
      <td style="max-width:180px; word-break:break-word;">${escapeHtml(a.standar_k3)}</td>
      <td>${escapeHtml(a.auditor || '–')}</td>
      <td>${tglRencana}</td>
      <td>${tglRealisasi}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(a.status)}</span></td>
      <td style="display:flex; gap:.4rem; flex-wrap:wrap;">
        <button class="btn-sm btn-detail" onclick="openModalDetail(${a.id})">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg> Detail
        </button>
        ${a.status !== 'Selesai'
          ? `<button class="btn-sm btn-selesai" onclick="tandaiSelesai(${a.id})">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg> Selesai
            </button>`
          : ''}
        <button class="btn-sm btn-hapus" onclick="hapusAudit(${a.id})">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg> Hapus
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   MODAL AUDIT
───────────────────────────────────────────── */
function openModalAudit() {
  document.getElementById('inp-jenis-audit').value   = '';
  document.getElementById('inp-standar').value       = '';
  document.getElementById('inp-tgl-rencana').value   = '';
  document.getElementById('inp-auditor').value       = '';
  document.getElementById('modal-audit').classList.add('open');
}

function closeModalAudit() {
  document.getElementById('modal-audit').classList.remove('open');
}

async function simpanAudit() {
  const jenisAudit  = document.getElementById('inp-jenis-audit').value;
  const standar     = document.getElementById('inp-standar').value.trim();
  const tglRencana  = document.getElementById('inp-tgl-rencana').value;
  const auditor     = document.getElementById('inp-auditor').value.trim();

  if (!jenisAudit) { showToast('Pilih jenis audit.', 'error');        return; }
  if (!standar)    { showToast('Standar K3 wajib diisi.', 'error');   return; }
  if (!tglRencana) { showToast('Tanggal rencana wajib diisi.', 'error'); return; }

  try {
    const { error } = await db.from('audit_k3').insert([{
      jenis_audit:    jenisAudit,
      standar_k3:     standar,
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
    const { error } = await supabase
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
    // temuan_audit ON DELETE CASCADE will handle child rows
    const { error } = await db.from('audit_k3').delete().eq('id', id);
    if (error) throw error;
    showToast('Audit berhasil dihapus.', 'success');
    loadAudit();
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   DETAIL MODAL (shows audit info + temuan)
───────────────────────────────────────────── */
async function openModalDetail(auditId) {
  currentAuditId = auditId;
  const audit = allAudit.find(a => a.id === auditId);
  if (!audit) return;

  document.getElementById('detail-title').textContent =
    `${audit.jenis_audit} – ${escapeHtml(audit.standar_k3)}`;

  document.getElementById('detail-info').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:.5rem .75rem; font-size:.88rem;">
      <div><span style="color:#9ca3af;">Auditor:</span> ${escapeHtml(audit.auditor || '–')}</div>
      <div><span style="color:#9ca3af;">Status:</span> <span class="badge ${audit.status==='Selesai'?'badge-selesai':'badge-terjadwal'}" style="font-size:.75rem;">${escapeHtml(audit.status)}</span></div>
      <div><span style="color:#9ca3af;">Tgl. Rencana:</span> ${formatDate(audit.tanggal_rencana)}</div>
      <div><span style="color:#9ca3af;">Tgl. Realisasi:</span> ${audit.tanggal_realisasi ? formatDate(audit.tanggal_realisasi) : '–'}</div>
    </div>`;

  document.getElementById('modal-detail').classList.add('open');
  await loadTemuanForDetail(auditId);
}

function closeModalDetail() {
  document.getElementById('modal-detail').classList.remove('open');
  currentAuditId = null;
}

async function loadTemuanForDetail(auditId) {
  const container = document.getElementById('detail-temuan-list');
  container.innerHTML = '<p style="color:#9ca3af; font-size:.88rem;">Memuat temuan…</p>';

  try {
    const { data, error } = await supabase
      .from('temuan_audit')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:#9ca3af; font-size:.88rem;">Belum ada temuan untuk audit ini.</p>';
      return;
    }

    container.innerHTML = data.map(t => {
      const katClass    = t.kategori === 'Mayor' ? 'badge-mayor' : 'badge-minor';
      const statusClass = t.status_perbaikan === 'Closed' ? 'badge-closed' : 'badge-open';
      return `<div class="temuan-item">
        <div class="temuan-item-header">
          <span class="badge ${katClass}">${escapeHtml(t.kategori || 'Minor')}</span>
          <div style="display:flex; gap:.4rem; align-items:center;">
            <span class="badge ${statusClass}">${escapeHtml(t.status_perbaikan)}</span>
            ${t.status_perbaikan === 'Open'
              ? `<button class="btn-sm btn-closed" onclick="tutupTemuan(${t.id})">Tutup</button>`
              : ''}
            <button class="btn-sm btn-hapus" onclick="hapusTemuan(${t.id})">Hapus</button>
          </div>
        </div>
        <div class="temuan-desc">${escapeHtml(t.deskripsi_temuan)}</div>
        ${t.tindakan_koreksi ? `<div class="temuan-tindakan">🔧 ${escapeHtml(t.tindakan_koreksi)}</div>` : ''}
      </div>`;
    }).join('');

    // Refresh summary counts
    updateSummaryTemuan();

  } catch (err) {
    container.innerHTML = `<p style="color:#dc2626; font-size:.88rem;">Gagal memuat temuan: ${err.message}</p>`;
  }
}

/* ─────────────────────────────────────────────
   TEMUAN (standalone tab)
───────────────────────────────────────────── */
function populateAuditFilter() {
  const sel = document.getElementById('filter-audit');
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
  const auditId = document.getElementById('filter-audit').value;
  const tbody   = document.getElementById('tbody-temuan');
  tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Memuat temuan…</p></div></td></tr>`;

  try {
    let query = supabase
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
  const status = document.getElementById('filter-status-temuan').value;
  const filtered = !status ? allTemuan : allTemuan.filter(t => t.status_perbaikan === status);
  renderTemuanTable(filtered);
}

function renderTemuanTable(data) {
  const tbody = document.getElementById('tbody-temuan');

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
      <p>Tidak ada temuan ditemukan.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((t, idx) => {
    const auditLabel = t.audit_k3
      ? `${escapeHtml(t.audit_k3.jenis_audit)} – ${escapeHtml(t.audit_k3.standar_k3)}`
      : `Audit #${t.audit_id}`;
    const katClass    = t.kategori === 'Mayor' ? 'badge-mayor' : 'badge-minor';
    const statusClass = t.status_perbaikan === 'Closed' ? 'badge-closed' : 'badge-open';

    return `<tr>
      <td style="color:#9ca3af; font-size:.8rem;">${idx + 1}</td>
      <td style="font-size:.82rem; max-width:160px; word-break:break-word;">${auditLabel}</td>
      <td style="max-width:220px; word-break:break-word;">${escapeHtml(t.deskripsi_temuan)}</td>
      <td><span class="badge ${katClass}">${escapeHtml(t.kategori || '–')}</span></td>
      <td style="max-width:180px; word-break:break-word; font-size:.85rem; color:#6b7280;">${escapeHtml(t.tindakan_koreksi || '–')}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(t.status_perbaikan)}</span></td>
      <td style="display:flex; gap:.4rem; flex-wrap:wrap;">
        ${t.status_perbaikan === 'Open'
          ? `<button class="btn-sm btn-closed" onclick="tutupTemuan(${t.id})">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Tutup
            </button>`
          : ''}
        <button class="btn-sm btn-hapus" onclick="hapusTemuan(${t.id})">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg> Hapus
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   MODAL TEMUAN
───────────────────────────────────────────── */
function openModalTemuan(auditId) {
  document.getElementById('inp-audit-id-temuan').value = auditId;
  document.getElementById('inp-deskripsi').value        = '';
  document.getElementById('inp-kategori').value         = '';
  document.getElementById('inp-status-perbaikan').value = 'Open';
  document.getElementById('inp-tindakan').value         = '';
  document.getElementById('modal-temuan').classList.add('open');
}

function closeModalTemuan() {
  document.getElementById('modal-temuan').classList.remove('open');
}

async function simpanTemuan() {
  const auditId   = document.getElementById('inp-audit-id-temuan').value;
  const deskripsi = document.getElementById('inp-deskripsi').value.trim();
  const kategori  = document.getElementById('inp-kategori').value;
  const status    = document.getElementById('inp-status-perbaikan').value;
  const tindakan  = document.getElementById('inp-tindakan').value.trim();

  if (!deskripsi) { showToast('Deskripsi temuan wajib diisi.', 'error'); return; }
  if (!kategori)  { showToast('Kategori temuan wajib dipilih.', 'error'); return; }

  try {
    const { error } = await db.from('temuan_audit').insert([{
      audit_id:          parseInt(auditId),
      deskripsi_temuan:  deskripsi,
      kategori:          kategori,
      tindakan_koreksi:  tindakan || null,
      status_perbaikan:  status,
    }]);

    if (error) throw error;
    closeModalTemuan();
    showToast('Temuan berhasil disimpan!', 'success');

    // Refresh whichever view is showing
    if (currentAuditId) loadTemuanForDetail(currentAuditId);
    loadTemuan();

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
    const { error } = await supabase
      .from('temuan_audit')
      .update({ status_perbaikan: 'Closed' })
      .eq('id', id);

    if (error) throw error;
    showToast('Temuan ditandai Closed.', 'success');
    if (currentAuditId) loadTemuanForDetail(currentAuditId);
    loadTemuan();

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
    if (currentAuditId) loadTemuanForDetail(currentAuditId);
    loadTemuan();
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   SUMMARY COUNTS
───────────────────────────────────────────── */
function updateSummaryAudit(data) {
  document.getElementById('sum-total').textContent     = data.length;
  document.getElementById('sum-terjadwal').textContent = data.filter(a => a.status === 'Terjadwal').length;
  document.getElementById('sum-selesai').textContent   = data.filter(a => a.status === 'Selesai').length;
}

async function updateSummaryTemuan() {
  try {
    const { data, error } = await supabase
      .from('temuan_audit')
      .select('status_perbaikan');

    if (error) throw error;
    const items = data || [];
    document.getElementById('sum-open').textContent   = items.filter(t => t.status_perbaikan === 'Open').length;
    document.getElementById('sum-closed').textContent = items.filter(t => t.status_perbaikan === 'Closed').length;
  } catch (_) { /* ignore */ }
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#111827';
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  ['modal-audit', 'modal-temuan', 'modal-detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) el.classList.remove('open');
  });
});