// p2k3.js (CRUD & render struktur P2K3)
// Catatan: halaman p2k3.html saat ini hanya menampilkan gambar struktur.
// File ini dibuat aman agar tidak melempar error jika elemen DOM tidak tersedia.

const modal = document.getElementById("modal");
const tbody = document.getElementById("tbody");
const strukturBoard = document.getElementById("strukturBoard");
const totalAnggota = document.getElementById("totalAnggota");
const periodeAktif = document.getElementById("periodeAktif");
const pengurusInti = document.getElementById("pengurusInti");

let editId = null;
let semuaData = [];

function namaKaryawan(item) {
  return item?.karyawan?.nama ? item.karyawan.nama : "Karyawan tidak ditemukan";
}

function inisialNama(nama) {
  return (nama || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(kata => kata[0])
    .join("")
    .toUpperCase();
}

function kelasJabatan(jabatan) {
  return (jabatan || "").toLowerCase().replace(/\s+/g, "-");
}

function tampilkanRingkasan(data) {
  if (!totalAnggota || !periodeAktif || !pengurusInti) return;

  totalAnggota.innerText = data.length;
  const periode = data.map(item => item.periode).filter(Boolean);
  periodeAktif.innerText = periode.length > 0 ? periode[periode.length - 1] : "-";
  pengurusInti.innerText = data.filter(item =>
    ["Ketua", "Wakil Ketua", "Sekretaris"].includes(item.jabatan_p2k3)
  ).length;
}

function tampilkanStruktur(data) {
  if (!strukturBoard) return;

  const renderJabatan = jabatan => {
    const anggota = data.filter(item => item.jabatan_p2k3 == jabatan);
    const daftarAnggota = anggota.length > 0
      ? anggota.map(item => `
        <div class="member-card">
          <span class="member-avatar">${inisialNama(namaKaryawan(item))}</span>
          <div>
            <strong>${namaKaryawan(item)}</strong>
            <small>${item.periode || "Periode belum diisi"}</small>
          </div>
        </div>
      `).join("")
      : `
        <div class="empty-structure">Belum ada data untuk jabatan ini.</div>
      `;

    return `
      <section class="role-node ${kelasJabatan(jabatan)}">
        <div class="role-header">
          <span>${jabatan}</span>
          <strong>${anggota.length}</strong>
        </div>
        <div class="member-list">${daftarAnggota}</div>
      </section>
    `;
  };

  strukturBoard.innerHTML = `
    <div class="chart-level chart-level-top">${renderJabatan("Ketua")}</div>
    <div class="chart-connector chart-connector-middle"></div>
    <div class="chart-level chart-level-middle">
      ${renderJabatan("Wakil Ketua")}
      ${renderJabatan("Sekretaris")}
    </div>
    <div class="chart-connector chart-connector-bottom"></div>
    <div class="chart-level chart-level-bottom">${renderJabatan("Anggota")}</div>
  `;
}

function tampilkanData(data) {
  if (!tbody) return;

  tbody.innerHTML = "";
  tampilkanRingkasan(data);
  tampilkanStruktur(data);

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">Belum ada anggota P2K3 yang sesuai.</td>
      </tr>
    `;
    return;
  }

  data.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${namaKaryawan(item)}</strong></td>
        <td>
          <span class="role-badge ${kelasJabatan(item.jabatan_p2k3)}">${item.jabatan_p2k3}</span>
        </td>
        <td>${item.periode || "-"}</td>
        <td>
          <button onclick="editData(${item.id})">Edit</button>
          <button onclick="hapusData(${item.id})" style="background:red;">Hapus</button>
        </td>
      </tr>
    `;
  });
}

async function loadKaryawan() {
  const select = document.getElementById("karyawan");
  if (!select) return;

  const { data, error } = await db
    .from("karyawan")
    .select("*")
    .order("nama");

  if (error) {
    console.log(error);
    return;
  }

  select.innerHTML = "<option value=''>Pilih Karyawan</option>";
  data.forEach(item => {
    select.innerHTML += `
      <option value="${item.id}">${item.nama}</option>
    `;
  });
}

async function loadP2K3() {
  const { data, error } = await db
    .from("struktur_p2k3")
    .select(`
      id,
      karyawan_id,
      jabatan_p2k3,
      periode,
      karyawan (nama)
    `)
    .order("id");

  if (error) {
    console.log(error);
    return;
  }

  semuaData = data;
  tampilkanData(data);
}

function tutupModal() {
  if (modal) modal.style.display = "none";
  editId = null;
}

// ====== EDIT FOTO STRUKTUR (opsional) ======
// Konsep: simpan foto struktur ke Storage Supabase, lalu render image dari URL.
// Karena belum ada struktur DB/storage yang pasti di repo ini,
// implementasi dibuat defensif:
// - Kalau upload/storage tidak terkonfigurasi, UI tetap jalan tanpa crash.

let strukturFotoUploadPath = "";

function tutupUploadFotoStruktur() {
  const box = document.getElementById('strukturUploadBox');
  const input = document.getElementById('inputFotoStruktur');
  if (box) box.style.display = 'none';
  if (input) input.value = '';
}

function bukaUploadFotoStruktur() {
  const box = document.getElementById('strukturUploadBox');
  if (!box) return;
  box.style.display = 'block';
}

async function simpanUploadFotoStruktur() {
  const input = document.getElementById('inputFotoStruktur');
  if (!input || !input.files || !input.files[0]) {
    alert('Pilih file foto terlebih dahulu.');
    return;
  }

  // Nama file default
  const file = input.files[0];
  const fileExt = (file.name.split('.').pop() || 'png').toLowerCase();
  const fileName = `struktur_p2k3_${Date.now()}.${fileExt}`;

  // Pastikan storage client tersedia.
  if (!db || !db.storage) {
    alert('Storage Supabase belum terhubung.');
    return;
  }

  // Container (bucket) harus ada di Supabase Storage.
  // Jika bucket kamu berbeda, ubah nilai berikut.
  const BUCKET_NAME = 'struktur_p2k3';

  try {
    // Upload
    const { error: uploadErr } = await db.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (uploadErr) {
      // Kalau storage tidak izin/terjadi error, jangan blok user.
      // UI tidak perlu memunculkan error berkali-kali.
      console.warn('upload foto struktur gagal (diabaikan):', uploadErr);
      throw uploadErr;
    }

    // Dapatkan public URL
    const { data: publicData } = db.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    strukturFotoUploadPath = publicData?.publicUrl || '';

    // Foto preview di halaman bisa saja tidak ditampilkan (karena permintaan UI).
    // Jadi hanya update jika elemen img-nya ada.
    const img = document.getElementById('strukturPhoto');
    if (img && strukturFotoUploadPath) {
      img.src = strukturFotoUploadPath;
    }

    // Sembunyikan empty state jika ada foto.
    const empty = document.getElementById('strukturPhotoEmpty');
    if (empty) empty.style.display = 'none';

    // Jika upload gagal tapi image di browser sudah berubah, kita tetap anggap sukses.
    alert('✅ Foto struktur berhasil diubah.');
    tutupUploadFotoStruktur();
  } catch (err) {
    console.error('simpanUploadFotoStruktur error:', err);
    alert('❌ Gagal mengupload foto struktur.');
  }
}

// Hook tombol edit foto
(function initStrukturFotoUI() {
  const btn = document.getElementById('btnEditFotoStruktur');
  if (!btn) return;

  btn.addEventListener('click', () => {
    bukaUploadFotoStruktur();
  });

  // Expose global untuk onclick inline di p2k3.html
  window.tutupUploadFotoStruktur = tutupUploadFotoStruktur;
  window.simpanUploadFotoStruktur = simpanUploadFotoStruktur;
})();


function editData(id) {
  const data = semuaData.find(item => item.id == id);
  if (!data) return;

  editId = id;
  document.getElementById("judulModal") && (document.getElementById("judulModal").innerHTML = "Edit Anggota P2K3");
  document.getElementById("karyawan") && (document.getElementById("karyawan").value = data.karyawan_id);
  document.getElementById("jabatan") && (document.getElementById("jabatan").value = data.jabatan_p2k3);
  document.getElementById("periode") && (document.getElementById("periode").value = data.periode);
  if (modal) modal.style.display = "flex";
}

async function updateData() {
  const karyawan = document.getElementById("karyawan")?.value;
  const jabatan = document.getElementById("jabatan")?.value;
  const periode = document.getElementById("periode")?.value;

  const { error } = await db
    .from("struktur_p2k3")
    .update({
      karyawan_id: karyawan,
      jabatan_p2k3: jabatan,
      periode: periode
    })
    .eq("id", editId);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Data berhasil diupdate.");
  tutupModal();
  loadP2K3();
}

async function tambahData() {
  const karyawan = document.getElementById("karyawan")?.value;
  const jabatan = document.getElementById("jabatan")?.value;
  const periode = document.getElementById("periode")?.value;

  if (!karyawan || !periode) {
    alert("Lengkapi data.");
    return;
  }

  const { error } = await db
    .from("struktur_p2k3")
    .insert([
      { karyawan_id: karyawan, jabatan_p2k3: jabatan, periode }
    ]);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Data berhasil ditambahkan.");
  tutupModal();
  loadP2K3();
}

async function simpanData() {
  if (editId == null) await tambahData();
  else await updateData();
}

async function hapusData(id) {
  if (!confirm("Yakin ingin menghapus data?")) return;

  const { error } = await db
    .from("struktur_p2k3")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Data berhasil dihapus.");
  loadP2K3();
}

// Hook event (hanya kalau elemen tersedia)
if (modal && tbody && strukturBoard && totalAnggota && periodeAktif && pengurusInti) {
  document.getElementById("openModal")?.addEventListener("click", () => {
    editId = null;
    document.getElementById("judulModal") && (document.getElementById("judulModal").innerHTML = "Tambah Anggota P2K3");
    document.getElementById("karyawan") && (document.getElementById("karyawan").value = "");
    document.getElementById("jabatan") && (document.getElementById("jabatan").value = "Ketua");
    document.getElementById("periode") && (document.getElementById("periode").value = "");
    modal.style.display = "flex";
  });

  document.getElementById("search")?.addEventListener("keyup", function () {
    const keyword = (this.value || "").toLowerCase();
    const hasil = semuaData.filter(item =>
      namaKaryawan(item).toLowerCase().includes(keyword) ||
      (item.jabatan_p2k3 || "").toLowerCase().includes(keyword) ||
      (item.periode || "").toLowerCase().includes(keyword)
    );
    tampilkanData(hasil);
  });

  window.onclick = function (e) {
    if (e.target === modal) tutupModal();
  };

  // global functions untuk inline onclick di table
  window.editData = editData;
  window.hapusData = hapusData;
  window.simpanData = simpanData;

  loadKaryawan();
  loadP2K3();
} else {
  console.warn('[p2k3.js] DOM P2K3 tidak lengkap; skip inisialisasi CRUD/render.');
}

