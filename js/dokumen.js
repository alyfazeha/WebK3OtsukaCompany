/**
 * dokumen.js
 * Kartiko Widyotomo – Document Repository & Audit Specialist
 * Updated: Metadata lengkap (nomor, revisi, departemen, status, tgl efektif, tgl review)
 */

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let allDokumen = [];
let selectedFile = null;

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  loadDokumen();
});

/* ─────────────────────────────────────────────
   DRAG & DROP
───────────────────────────────────────────── */
function setupDragAndDrop() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

function onFileSelected(input) {
  const file = input.files[0];
  if (file) handleFile(file);
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'video/mp4'
];

const MAX_SIZE_MB = 50;

function handleFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast('Format berkas tidak didukung! Gunakan PDF, DOCX, XLSX, JPG, PNG, atau MP4.', 'error');
    clearFile();
    return;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    showToast(`Ukuran berkas maksimal adalah ${MAX_SIZE_MB} MB!`, 'error');
    clearFile();
    return;
  }
  selectedFile = file;

  document.getElementById('selected-file-name').textContent = file.name;
  document.getElementById('upload-prompt').style.display = 'none';
  document.getElementById('selected-file-badge').style.display = 'flex';
}

function clearFile() {
  selectedFile = null;
  const input = document.getElementById('file-input');
  if (input) input.value = '';

  document.getElementById('selected-file-badge').style.display = 'none';
  document.getElementById('upload-prompt').style.display = 'flex';
}

/* ─────────────────────────────────────────────
   UPLOAD LOGIC
───────────────────────────────────────────── */
async function uploadDokumen() {
  const fields = {
    nama:       document.getElementById('nama-dokumen'),
    nomor:      document.getElementById('nomor-dokumen'),
    jenis:      document.getElementById('jenis-dokumen'),
    status:     document.getElementById('status-dokumen'),
    dept:       document.getElementById('departemen-dokumen'),
    revisi:     document.getElementById('nomor-revisi'),
    tglEfektif: document.getElementById('tanggal-efektif'),
    tglReview:  document.getElementById('tanggal-review'),
  };
  const btn = document.getElementById('btn-upload');

  // Validasi wajib
  if (!selectedFile)               return showToast('Silakan pilih atau jatuhkan berkas terlebih dahulu!', 'error');
  if (!fields.nama.value.trim())   return showToast('Nama dokumen wajib diisi!', 'error');
  if (!fields.nomor.value.trim())  return showToast('Nomor dokumen wajib diisi!', 'error');
  if (!fields.jenis.value)         return showToast('Silakan pilih kategori dokumen!', 'error');
  if (!fields.status.value)        return showToast('Silakan pilih status dokumen!', 'error');
  if (!fields.dept.value)          return showToast('Silakan pilih departemen pemilik!', 'error');
  if (!fields.tglEfektif.value)    return showToast('Tanggal efektif wajib diisi!', 'error');

  try {
    btn.disabled = true;
    btn.textContent = 'Mengunggah…';
    animateProgress(0, 80, 1500);

    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `repository/${fileName}`;

    // 1. Upload ke Supabase Storage
    const { error: storageError } = await db.storage
      .from('dokumen-k3')
      .upload(filePath, selectedFile, { cacheControl: '3600', upsert: false });

    if (storageError) throw storageError;

    // 2. Insert metadata ke tabel dokumen_k3
    const { error: dbError } = await db
      .from('dokumen_k3')
      .insert([{
        nama_dokumen:     fields.nama.value.trim(),
        nomor_dokumen:    fields.nomor.value.trim(),
        jenis_dokumen:    fields.jenis.value,
        status_dokumen:   fields.status.value,
        departemen:       fields.dept.value,
        nomor_revisi:     fields.revisi.value.trim() || 'Rev.00',
        tanggal_efektif:  fields.tglEfektif.value,
        tanggal_review:   fields.tglReview.value || null,
        file_path:        filePath,
        tanggal_upload:   new Date().toISOString().split('T')[0]
      }]);

    if (dbError) throw dbError;

    animateProgress(80, 100, 300);
    setTimeout(() => {
      showToast('Dokumen berhasil disimpan ke repositori!', 'success');
      // Reset form
      Object.values(fields).forEach(el => { el.value = ''; });
      clearFile();
      hideProgress();
      loadDokumen();
    }, 400);

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Gagal mengunggah dokumen', 'error');
    hideProgress();
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
      </svg>
      Upload Dokumen`;
  }
}

/* ─────────────────────────────────────────────
   LOAD & DISPLAY
───────────────────────────────────────────── */
async function loadDokumen() {
  try {
    const { data, error } = await db
      .from('dokumen_k3')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    allDokumen = data || [];
    renderTable(allDokumen);
    calculateStats(allDokumen);
    checkExpiryAlert(allDokumen);
  } catch (err) {
    console.error(err);
    document.getElementById('doc-tbody').innerHTML =
      `<tr><td colspan="10" class="table-empty" style="color:#dc2626;">Gagal memuat data: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderTable(list) {
  const tbody = document.getElementById('doc-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="table-empty">Tidak ada dokumen ditemukan.</td></tr>`;
    return;
  }

  const today = new Date();
  const warn30 = new Date(today); warn30.setDate(warn30.getDate() + 30);

  let html = '';
  list.forEach((doc, idx) => {
    // Cek apakah mendekati tanggal review
    const isExpiring = doc.tanggal_review && new Date(doc.tanggal_review) <= warn30 && doc.status_dokumen !== 'Obsolete';
    const rowClass = isExpiring ? 'row-expiring' : '';

    // Status badge class (handle spasi → tanda hubung)
    const statusClass = `badge-${(doc.status_dokumen || 'Draft').replace(/\s+/g, '-')}`;

    // Ganti bagian html += `` di dalam forEach di fungsi renderTable()
    html += `
      <tr class="${rowClass}">
        <td>${idx + 1}</td>
        <td style="font-size:12px; color:#475569; font-weight:500;">${escapeHtml(doc.nomor_dokumen || '–')}</td>
        <td style="font-weight:500; color:#0F3D56;">${escapeHtml(doc.nama_dokumen)}</td>
        <td><span class="badge-jenis">${escapeHtml(doc.jenis_dokumen)}</span></td>
        <td class="col-hide-mobile" style="font-size:12px; color:#374151;">${escapeHtml(doc.departemen || '–')}</td>
        <td class="col-hide-mobile" style="text-align:center; font-size:12px;">${escapeHtml(doc.nomor_revisi || '–')}</td>
        <td style="text-align:center;"><span class="badge-status ${statusClass}">${escapeHtml(doc.status_dokumen || '–')}</span></td>
        <td class="col-hide-mobile" style="text-align:center; font-size:12px;">${formatDate(doc.tanggal_efektif)}</td>
        <td class="col-hide-mobile" style="text-align:center; font-size:12px; ${isExpiring ? 'color:#c2410c; font-weight:600;' : ''}">
          ${doc.tanggal_review ? formatDate(doc.tanggal_review) + (isExpiring ? ' ⚠️' : '') : '–'}
        </td>
        <td>
          <div class="action-cell">
            <button class="btn-lihat" onclick="bukaDokumen('${escapeHtml(doc.file_path)}')">👁️ Lihat</button>
            <button class="btn-hapus-doc" onclick="hapusDokumen(${doc.id}, '${escapeHtml(doc.file_path)}')">🗑️ Hapus</button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

async function bukaDokumen(path) {
  try {
    const { data } = db.storage.from('dokumen-k3').getPublicUrl(path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank');
    } else {
      showToast('Gagal mendapatkan URL dokumen', 'error');
    }
  } catch (err) {
    showToast('Gagal membuka dokumen', 'error');
  }
}

async function hapusDokumen(id, path) {
  if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini secara permanen?')) return;

  try {
    await db.storage.from('dokumen-k3').remove([path]);
    const { error } = await db.from('dokumen_k3').delete().eq('id', id);
    if (error) throw error;

    showToast('Dokumen berhasil dihapus!', 'success');
    loadDokumen();
  } catch (err) {
    console.error(err);
    showToast('Gagal menghapus dokumen: ' + err.message, 'error');
  }
}

/* ─────────────────────────────────────────────
   FILTER & SEARCH
───────────────────────────────────────────── */
function filterDokumen() {
  const searchVal  = document.getElementById('search-input').value.toLowerCase();
  const jenisVal   = document.getElementById('filter-jenis').value;
  const statusVal  = document.getElementById('filter-status').value;

  const filtered = allDokumen.filter(doc => {
    const matchSearch = (doc.nama_dokumen || '').toLowerCase().includes(searchVal)
                     || (doc.nomor_dokumen || '').toLowerCase().includes(searchVal);
    const matchJenis  = jenisVal  === '' || doc.jenis_dokumen  === jenisVal;
    const matchStatus = statusVal === '' || doc.status_dokumen === statusVal;
    return matchSearch && matchJenis && matchStatus;
  });

  renderTable(filtered);
}

/* ─────────────────────────────────────────────
   STATS & EXPIRY
───────────────────────────────────────────── */
function calculateStats(list) {
  const today = new Date();
  const warn30 = new Date(today); warn30.setDate(warn30.getDate() + 30);

  const expiring = list.filter(d =>
    d.tanggal_review &&
    new Date(d.tanggal_review) <= warn30 &&
    d.status_dokumen !== 'Obsolete'
  ).length;

  document.getElementById('stat-total').textContent    = list.length;
  document.getElementById('stat-approved').textContent = list.filter(d => d.status_dokumen === 'Approved').length;
  document.getElementById('stat-review').textContent   = list.filter(d => d.status_dokumen === 'Under Review').length;
  document.getElementById('stat-draft').textContent    = list.filter(d => d.status_dokumen === 'Draft').length;
  document.getElementById('stat-expiring').textContent = expiring;
}

function checkExpiryAlert(list) {
  const today = new Date();
  const warn30 = new Date(today); warn30.setDate(warn30.getDate() + 30);

  const expiringDocs = list.filter(d =>
    d.tanggal_review &&
    new Date(d.tanggal_review) <= warn30 &&
    d.status_dokumen !== 'Obsolete'
  );

  const alertEl = document.getElementById('expiry-alert');
  const alertText = document.getElementById('expiry-alert-text');

  if (expiringDocs.length > 0) {
    alertText.textContent =
      `${expiringDocs.length} dokumen akan jatuh tempo review dalam 30 hari ke depan. Segera lakukan tindak lanjut.`;
    alertEl.style.display = 'block';
  } else {
    alertEl.style.display = 'none';
  }
}

/* ─────────────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────────────── */
function showProgress(pct) {
  document.getElementById('upload-progress').style.display = 'block';
  document.getElementById('upload-progress-bar').style.width = pct + '%';
}
function hideProgress() {
  document.getElementById('upload-progress').style.display = 'none';
  document.getElementById('upload-progress-bar').style.width = '0%';
}
function animateProgress(from, to, duration) {
  const bar = document.getElementById('upload-progress-bar');
  const steps = 20;
  const stepTime = duration / steps;
  const stepSize = (to - from) / steps;
  let current = from;
  showProgress(current);
  const iv = setInterval(() => {
    current += stepSize;
    if (bar) bar.style.width = Math.min(current, to) + '%';
    if (current >= to) clearInterval(iv);
  }, stepTime);
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background =
    type === 'error'   ? '#dc2626' :
    type === 'success' ? '#16a34a' : '#111827';
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}