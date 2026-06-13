/**
 * dokumen.js
 * Kartiko Widyotomo – Document Repository & Audit Specialist
 *
 * Handles:
 *  - Drag-and-drop / file picker for PDF upload to Supabase Storage
 *  - Saving metadata (nama, jenis, file_path, tanggal_upload) to tabel dokumen_k3
 *  - Listing, searching, filtering, and deleting documents
 */

const supabase = db;

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

/* ─────────────────────────────────────────────
   FILE SELECTION
───────────────────────────────────────────── */
function onFileSelected(input) {
  if (input.files && input.files[0]) handleFile(input.files[0]);
}

function handleFile(file) {
  if (file.type !== 'application/pdf') {
    showToast('Hanya file PDF yang diperbolehkan.', 'error'); return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Ukuran file maksimal 10 MB.', 'error'); return;
  }
  selectedFile = file;
  document.getElementById('selected-file-name').textContent = file.name;
  document.getElementById('selected-file-badge').style.display = 'inline-flex';

  const nameField = document.getElementById('nama-dokumen');
  if (!nameField.value) {
    nameField.value = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  }
}

function clearFile() {
  selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('selected-file-badge').style.display = 'none';
}

/* ─────────────────────────────────────────────
   UPLOAD DOKUMEN
───────────────────────────────────────────── */
async function uploadDokumen() {
  const namaDokumen  = document.getElementById('nama-dokumen').value.trim();
  const jenisDokumen = document.getElementById('jenis-dokumen').value;
  const btn          = document.getElementById('btn-upload');
  const statusEl     = document.getElementById('upload-status');

  if (!selectedFile)   { showToast('Pilih file PDF terlebih dahulu.', 'error'); return; }
  if (!namaDokumen)    { showToast('Nama dokumen wajib diisi.', 'error');        return; }
  if (!jenisDokumen)   { showToast('Pilih jenis dokumen.',              'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Mengupload…';
  statusEl.textContent = 'Mengunggah file ke storage…';
  showProgress(0);

  try {
    const timestamp   = Date.now();
    const safeFileName = selectedFile.name.replace(/\s+/g, '_');
    const filePath    = `${timestamp}_${safeFileName}`;

    animateProgress(0, 70, 800);

    const { error: storageError } = await supabase
      .storage
      .from('dokumen-k3')
      .upload(filePath, selectedFile, { contentType: 'application/pdf', upsert: false });

    if (storageError) throw storageError;

    animateProgress(70, 90, 300);

    const { data: urlData } = supabase
      .storage
      .from('dokumen-k3')
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl || filePath;

    const { error: dbError } = await supabase
      .from('dokumen_k3')
      .insert([{
        nama_dokumen:   namaDokumen,
        jenis_dokumen:  jenisDokumen,
        file_path:      publicUrl,
        tanggal_upload: new Date().toISOString().split('T')[0],
      }]);

    if (dbError) throw dbError;

    animateProgress(90, 100, 200);

    setTimeout(() => {
      hideProgress();
      showToast('Dokumen berhasil diupload!', 'success');
      resetUploadForm();
      loadDokumen();
    }, 300);

  } catch (err) {
    hideProgress();
    console.error('Upload error:', err);
    showToast(`Gagal upload: ${err.message || 'Terjadi kesalahan'}`, 'error');
    statusEl.textContent = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload Dokumen`;
  }
}

function resetUploadForm() {
  clearFile();
  document.getElementById('nama-dokumen').value = '';
  document.getElementById('jenis-dokumen').value = '';
  document.getElementById('upload-status').textContent = '';
}

/* ─────────────────────────────────────────────
   LOAD & RENDER DOKUMEN
───────────────────────────────────────────── */
async function loadDokumen() {
  const tbody = document.getElementById('doc-tbody');
  tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>Memuat data…</p></div></td></tr>`;

  try {
    const { data, error } = await supabase
      .from('dokumen_k3')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allDokumen = data || [];
    updateStats(allDokumen);
    renderTable(allDokumen);

  } catch (err) {
    console.error('Load error:', err);
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div></td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('doc-tbody');

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <p>Belum ada dokumen. Upload dokumen pertama Anda!</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((doc, idx) => {
    const jenis = doc.jenis_dokumen || 'Lainnya';
    const tanggal = doc.tanggal_upload
      ? new Date(doc.tanggal_upload).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })
      : '-';
    const filePathEscaped = escapeHtml(doc.file_path || '');
    const namaEscaped     = escapeHtml(doc.nama_dokumen);

    return `<tr>
      <td style="color:#9ca3af; font-size:.8rem;">${idx + 1}</td>
      <td><div style="font-weight:500; color:#111827;">${namaEscaped}</div></td>
      <td><span class="badge-jenis badge-${escapeHtml(jenis)}">${escapeHtml(jenis)}</span></td>
      <td>${tanggal}</td>
      <td style="display:flex; gap:.5rem; flex-wrap:wrap; align-items:center;">
        ${doc.file_path
          ? `<a href="${filePathEscaped}" target="_blank" rel="noopener" class="btn-lihat">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg> Lihat</a>`
          : '<span style="color:#9ca3af; font-size:.82rem;">–</span>'}
        <button class="btn-hapus" onclick="hapusDokumen(${doc.id}, '${filePathEscaped}', '${namaEscaped}')">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg> Hapus
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   HAPUS DOKUMEN
───────────────────────────────────────────── */
async function hapusDokumen(id, filePath, namaDokumen) {
  if (!confirm(`Hapus dokumen "${namaDokumen}"?\nTindakan ini tidak dapat dibatalkan.`)) return;

  try {
    const { error: dbError } = await db.from('dokumen_k3').delete().eq('id', id);
    if (dbError) throw dbError;

    // Try to delete from storage too
    if (filePath) {
      try {
        const url = new URL(filePath);
        const pathParts = url.pathname.split('/dokumen-k3/');
        const storagePath = pathParts[1];
        if (storagePath) await db.storage.from('dokumen-k3').remove([storagePath]);
      } catch (_) { /* ignore */ }
    }

    showToast('Dokumen berhasil dihapus.', 'success');
    loadDokumen();

  } catch (err) {
    console.error('Delete error:', err);
    showToast(`Gagal menghapus: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────
   SEARCH & FILTER
───────────────────────────────────────────── */
function filterDokumen() {
  const keyword = document.getElementById('search-input').value.toLowerCase();
  const jenis   = document.getElementById('filter-jenis').value;
  const filtered = allDokumen.filter(doc => {
    const matchKeyword = !keyword || (doc.nama_dokumen || '').toLowerCase().includes(keyword);
    const matchJenis   = !jenis   || doc.jenis_dokumen === jenis;
    return matchKeyword && matchJenis;
  });
  renderTable(filtered);
}

/* ─────────────────────────────────────────────
   STATS
───────────────────────────────────────────── */
function updateStats(data) {
  document.getElementById('stat-total').textContent    = data.length;
  document.getElementById('stat-sop').textContent      = data.filter(d => d.jenis_dokumen === 'SOP').length;
  document.getElementById('stat-protap').textContent   = data.filter(d => d.jenis_dokumen === 'PROTAP').length;
  document.getElementById('stat-regulasi').textContent = data.filter(d => d.jenis_dokumen === 'Regulasi').length;
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
    bar.style.width = Math.min(current, to) + '%';
    if (current >= to) clearInterval(iv);
  }, stepTime);
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#111827';
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

/* ─────────────────────────────────────────────
   UTIL
───────────────────────────────────────────── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}