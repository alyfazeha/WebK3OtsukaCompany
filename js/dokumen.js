/**
 * dokumen.js
 * Kartiko Widyotomo – Document Repository & Audit Specialist
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

function handleFile(file) {
  if (file.type !== 'application/pdf') {
    showToast('Hanya diperbolehkan mengunggah berkas PDF!', 'error');
    clearFile();
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Ukuran berkas maksimal adalah 10 MB!', 'error');
    clearFile();
    return;
  }
  selectedFile = file;
  
  // Update info teks nama file & ubah tampilan menjadi FULL CARD ikon PDF besar
  document.getElementById('selected-file-name').textContent = file.name;
  document.getElementById('upload-prompt').style.display = 'none';
  document.getElementById('selected-file-badge').style.display = 'flex';
}

function clearFile() {
  selectedFile = null;
  const input = document.getElementById('file-input');
  if (input) input.value = '';
  
  // Kembalikan ke tampilan default instruksi kosong semula
  document.getElementById('selected-file-badge').style.display = 'none';
  document.getElementById('upload-prompt').style.display = 'flex';
}

/* ─────────────────────────────────────────────
   UPLOAD LOGIC
───────────────────────────────────────────── */
async function uploadDokumen() {
  const namaInp = document.getElementById('nama-dokumen');
  const jenisInp = document.getElementById('jenis-dokumen');
  const btn = document.getElementById('btn-upload');

  if (!namaInp || !jenisInp) return;

  const nama = namaInp.value.trim();
  const jenis = jenisInp.value;

  if (!selectedFile) {
    showToast('Silakan pilih atau jatuhkan berkas PDF terlebih dahulu!', 'error');
    return;
  }
  if (!nama) {
    showToast('Nama dokumen wajib diisi!', 'error');
    return;
  }
  if (!jenis) {
    showToast('Silakan pilih jenis dokumen!', 'error');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Mengunggah...';
    animateProgress(0, 80, 1500);

    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `repository/${fileName}`;

    // 1. Upload file fisik ke Supabase Storage Bucket menggunakan 'db' dari config kamu
    const { error: storageError } = await db.storage
      .from('dokumen-k3')
      .upload(filePath, selectedFile, { cacheControl: '3600', upsert: false });

    if (storageError) throw storageError;

    // 2. Insert metadata ke database tabel dokumen_k3 menggunakan 'db' dari config kamu
    const { error: dbError } = await db
      .from('dokumen_k3')
      .insert([{ 
        nama_dokumen: nama, 
        jenis_dokumen: jenis, 
        file_path: filePath, 
        tanggal_upload: new Date().toISOString().split('T')[0] 
      }]);

    if (dbError) throw dbError;

    animateProgress(80, 100, 300);
    setTimeout(() => {
      showToast('Dokumen berhasil disimpan ke repository!', 'success');
      namaInp.value = '';
      jenisInp.value = '';
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
    btn.textContent = 'Upload Dokumen';
  }
}

/* ─────────────────────────────────────────────
   LOAD & DISPLAY
───────────────────────────────────────────── */
async function loadDokumen() {
  try {
    // Menggunakan koneksi 'db' dari config kamu
    const { data, error } = await db
      .from('dokumen_k3')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    allDokumen = data || [];
    renderTable(allDokumen);
    calculateStats(allDokumen);
  } catch (err) {
    console.error(err);
    document.getElementById('doc-tbody').innerHTML = `<tr><td colspan="5" style="color:#dc2626;">Gagal memuat data: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderTable(list) {
  const tbody = document.getElementById('doc-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#95a5a6;">Tidak ada dokumen ditemukan.</td></tr>`;
    return;
  }

  let html = '';
  list.forEach((doc, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-weight:500; color:#0F3D56; text-align: left;">${escapeHtml(doc.nama_dokumen)}</td>
        <td><span class="badge-jenis badge-${doc.jenis_dokumen}">${doc.jenis_dokumen}</span></td>
        <td>${formatDate(doc.tanggal_upload)}</td>
        <td>
          <div style="display:flex; gap:8px; justify-content: center;">
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
    // Menggunakan koneksi 'db' dari config kamu
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
  if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini secara permanen dari basis data?')) return;

  try {
    // Menggunakan koneksi 'db' dari config kamu
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
  const searchVal = document.getElementById('search-input').value.toLowerCase();
  const jenisVal = document.getElementById('filter-jenis').value;

  const filtered = allDokumen.filter(doc => {
    const matchSearch = (doc.nama_dokumen || '').toLowerCase().includes(searchVal);
    const matchJenis = jenisVal === '' || doc.jenis_dokumen === jenisVal;
    return matchSearch && matchJenis;
  });

  renderTable(filtered);
}

function calculateStats(list) {
  document.getElementById('stat-total').textContent = list.length;
  document.getElementById('stat-sop').textContent = list.filter(d => d.jenis_dokumen === 'SOP').length;
  document.getElementById('stat-protap').textContent = list.filter(d => d.jenis_dokumen === 'PROTAP').length;
  document.getElementById('stat-regulasi').textContent = list.filter(d => d.jenis_dokumen === 'Regulasi').length;
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
  return new Date(dateStr).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#111827';
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}