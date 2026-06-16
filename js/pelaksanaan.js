/* ================================================================
   pelaksanaan.js
   Logika form checklist K3 harian (APD / APAR / P3K)
   Tabel Supabase: public.pelaksanaan_k3
================================================================ */

/* ── 1. DATA BUTIR CHECKLIST ─────────────────────────────────── */
const CHECKLIST_ITEMS = {
  APD: [
    "Helm keselamatan tersedia & kondisi baik",
    "Kacamata pelindung / face shield tersedia",
    "Sarung tangan (sesuai jenis pekerjaan) tersedia",
    "Sepatu safety (steel-toe) dipakai seluruh pekerja",
    "Masker / respirator tersedia & layak pakai",
    "Rompi atau pakaian kerja berpenanda tersedia",
    "Ear plug / ear muff tersedia di area bising",
    "APD disimpan di lokasi yang mudah dijangkau",
    "APD dalam kondisi bersih dan tidak rusak",
    "Pekerja mengetahui cara memakai APD dengan benar",
  ],
  APAR: [
    "APAR terpasang di posisi yang mudah terlihat & dijangkau",
    "Segel / pin pengaman APAR masih utuh",
    "Jarum pressure gauge pada zona hijau (normal)",
    "Label inspeksi terakhir tidak lebih dari 1 tahun",
    "APAR tidak terhalang benda / rak lain",
    "Nomor identifikasi APAR tertera jelas",
    "Selang dan nozel APAR dalam kondisi baik",
    "Berat APAR sesuai (tidak jauh berkurang)",
    "Tanda / sign lokasi APAR terpasang di dinding",
    "Petugas tahu cara menggunakan APAR (metode PASS)",
  ],
  P3K: [
    "Kotak P3K tersedia di setiap area kerja",
    "Kotak P3K mudah diakses & tidak terkunci",
    "Isi kotak P3K lengkap sesuai standar",
    "Obat-obatan tidak melewati tanggal kedaluwarsa",
    "Plester / perban tersedia dalam jumlah cukup",
    "Antiseptik (betadine / alkohol) tersedia",
    "Gunting & pinset ada di dalam kotak P3K",
    "Daftar isi & instruksi P3K tertempel di kotak",
    "Petugas P3K terlatih tersedia di setiap shift",
    "Log penggunaan P3K diisi & diperbarui rutin",
  ],
};

/* ── 2. STATE ─────────────────────────────────────────────────── */
let currentJenis = null;   // 'APD' | 'APAR' | 'P3K'
let checkState   = {};     // { APD: [bool,...], APAR: [...], P3K: [...] }
let skorAkhir    = 0;      // nilai 0–100 yang akan disimpan ke Supabase

/* ── 3. INISIALISASI ──────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDate();
  showNavbarDate();
  await loadKaryawan();
  await loadHistory();
  bindEvents();
});

/** Set input tanggal ke hari ini */
function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("tanggal").value = today;
}

/** Tampilkan tanggal di navbar kanan */
function showNavbarDate() {
  const el = document.getElementById("navbar-date");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

/* ── 4. LOAD KARYAWAN dari Supabase ──────────────────────────── */
async function loadKaryawan() {
  const sel = document.getElementById("pemeriksa_id");
  try {
    const { data, error } = await window.supabaseClient
      .from("karyawan")
      .select("id, nama")
      .order("nama", { ascending: true });

    if (error) throw error;

    sel.innerHTML = '<option value="">-- Pilih Pemeriksa --</option>';
    (data || []).forEach((k) => {
      const opt = document.createElement("option");
      opt.value       = k.id;
      opt.textContent = k.nama;
      sel.appendChild(opt);
    });

  } catch (err) {
    console.error("Detail error:", err);
    sel.innerHTML = '<option value="">Gagal memuat karyawan</option>';
    showToast("Gagal memuat data karyawan: " + err.message, "error");
  }
}

/* ── 5. RENDER CHECKLIST ──────────────────────────────────────── */
function renderChecklist(jenis) {
  // Sembunyikan semua seksi, tampilkan yang aktif
  ["APD", "APAR", "P3K"].forEach((j) => {
    document.getElementById(`checklist-${j}`).style.display =
      j === jenis ? "block" : "none";
  });

  // Init state array jika belum ada
  if (!checkState[jenis]) {
    checkState[jenis] = new Array(CHECKLIST_ITEMS[jenis].length).fill(false);
  }

  const tbody = document.getElementById(`tbody-${jenis}`);
  tbody.innerHTML = "";

  CHECKLIST_ITEMS[jenis].forEach((teks, idx) => {
    const checked = checkState[jenis][idx];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color:#6b7280;font-size:.78rem;font-weight:700;">
        ${String(idx + 1).padStart(2, "0")}
      </td>
      <td>${teks}</td>
      <td style="text-align:center;">
        <label class="pel-toggle-wrap">
          <label class="pel-toggle">
            <input type="checkbox"
              data-jenis="${jenis}"
              data-idx="${idx}"
              ${checked ? "checked" : ""} />
            <span class="pel-slider"></span>
          </label>
          <span class="pel-toggle-label">${checked ? "✅ OK" : "❌ Tidak"}</span>
        </label>
      </td>`;
    tbody.appendChild(tr);
  });

  // Event listener setiap toggle
  tbody.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", onToggleItem);
  });

  updateSkor(jenis);
}

/* ── 6. EVENT: TOGGLE ITEM ───────────────────────────────────── */
function onToggleItem(e) {
  const jenis = e.target.dataset.jenis;
  const idx   = parseInt(e.target.dataset.idx);

  // Perbarui state
  checkState[jenis][idx] = e.target.checked;

  // Perbarui label di samping toggle
  const labelEl = e.target.closest(".pel-toggle-wrap").querySelector(".pel-toggle-label");
  labelEl.textContent = e.target.checked ? "✅ OK" : "❌ Tidak";

  updateSkor(jenis);
}

/* ── 7. HITUNG & TAMPILKAN SKOR ──────────────────────────────── */
function updateSkor(jenis) {
  const state  = checkState[jenis] || [];
  const total  = state.length;
  const lulus  = state.filter(Boolean).length;
  const pct    = total > 0 ? Math.round((lulus / total) * 100) : 0;

  // Pastikan nilai 0–100
  skorAkhir = Math.min(100, Math.max(0, pct));

  const cls = getSkorClass(skorAkhir);

  // Badge skor di header seksi
  const badge = document.getElementById(`skor-badge-${jenis}`);
  if (badge) {
    badge.textContent = `Skor: ${skorAkhir}%`;
    badge.className   = "pel-skor-badge" + cls;
  }

  // Progress bar
  const fill = document.getElementById("skor-meter-fill");
  if (fill) {
    fill.style.width = skorAkhir + "%";
    fill.className   = "pel-skor-meter-fill" + cls;
  }
  document.getElementById("meter-pct").textContent = skorAkhir + "%";

  // Angka skor besar
  const bigSkor = document.getElementById("big-skor");
  bigSkor.textContent = skorAkhir;
  bigSkor.className   = "pel-big-skor" + cls;

  // Teks label status
  document.getElementById("skor-label-text").textContent = getSkorLabel(skorAkhir);

  validateEnableSubmit();
}

function getSkorClass(pct) {
  if (pct >= 80) return "";      // hijau
  if (pct >= 60) return " warn";     // kuning
  return " danger";                  // merah
}

function getSkorLabel(pct) {
  if (pct >= 80) return "✅ Kepatuhan Baik";
  if (pct >= 60) return "⚠️ Perlu Perbaikan";
  if (pct >  0)  return "❌ Kepatuhan Rendah";
  return "Mulai isi checklist";
}

/* ── 8. VALIDASI AKTIFKAN TOMBOL SUBMIT ──────────────────────── */
function validateEnableSubmit() {
  const tanggal    = document.getElementById("tanggal").value.trim();
  const jenis      = document.getElementById("jenis_inspeksi").value;
  const departemen = document.getElementById("departemen_id").value;
  const pemeriksa  = document.getElementById("pemeriksa_id").value;
  const btn        = document.getElementById("btn-submit");

  // Aktifkan tombol HANYA jika seluruh elemen bertanda '*' (required) di HTML sudah terisi
  btn.disabled = !(tanggal && jenis && departemen && pemeriksa && currentJenis);
}

/* ── 9. BIND EVENTS ──────────────────────────────────────────── */
function bindEvents() {
  // Jenis inspeksi berubah → render checklist yang sesuai
  document.getElementById("jenis_inspeksi").addEventListener("change", (e) => {
    currentJenis = e.target.value || null;
    const cardChecklist = document.getElementById("card-checklist");

    if (currentJenis) {
      cardChecklist.style.display = "block";
      document.getElementById("checklist-title").textContent = `Butir Pemeriksaan – ${currentJenis}`;
      renderChecklist(currentJenis);
    } else {
      cardChecklist.style.display = "none";
    }

    validateEnableSubmit();
  });

  // Validasi realtime saat field wajib lainnya berubah
  ["tanggal", "departemen_id", "pemeriksa_id"].forEach((id) => {
    document.getElementById(id).addEventListener("change", validateEnableSubmit);
  });

  // Submit form
  document.getElementById("form-pelaksanaan").addEventListener("submit", handleSubmit);
}

/* ── 10. SUBMIT & KIRIM KE SUPABASE ──────────────────────────── */
async function handleSubmit(e) {
  e.preventDefault();

  const tanggal        = document.getElementById("tanggal").value.trim();
  const jenis_inspeksi = document.getElementById("jenis_inspeksi").value;
  const departemen_id  = document.getElementById("departemen_id").value;
  const pemeriksa_raw  = document.getElementById("pemeriksa_id").value;
  const catatan        = document.getElementById("catatan").value.trim() || null;
  const pemeriksa_id   = pemeriksa_raw ? parseInt(pemeriksa_raw) : null;
  const fileInput      = document.getElementById("foto_bukti");

  if (skorAkhir < 0 || skorAkhir > 100) {
    showToast("⚠️ Skor tidak valid (harus 0–100). Periksa checklist.", "error");
    return;
  }

  // Nonaktifkan tombol & tampilkan spinner loading
  const btn = document.getElementById("btn-submit");
  btn.disabled   = true;
  btn.innerHTML  = `<span class="pel-spinner"></span> Menyimpan...`;

  try {
    let foto_url = null;

    // Logika upload foto_bukti ke Supabase Storage (jika user melampirkan gambar)
    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `${jenis_inspeksi}/${fileName}`;

      // Unggah ke bucket storage bernama 'k3-photos'
      const { data: uploadData, error: uploadError } = await window.supabaseClient
        .storage
        .from('k3-photos')
        .upload(filePath, file);

      if (uploadError) throw new Error("Gagal mengunggah gambar bukti: " + uploadError.message);

      // Ambil Public URL hasil upload
      const { data: urlData } = window.supabaseClient
        .storage
        .from('k3-photos')
        .getPublicUrl(filePath);

      foto_url = urlData.publicUrl;
    }

    // Konstruksi Payload yang sepenuhnya sesuai dengan struktur input Form HTML
    const payload = {
      tanggal,
      jenis_inspeksi,
      departemen_id,
      skor_kepatuhan : skorAkhir,
      foto_bukti     : foto_url, // Menyimpan teks URL gambar / null
      catatan,
      pemeriksa_id,
    };

    const { error } = await window.supabaseClient
      .from("pelaksanaan_k3")
      .insert([payload]);

    if (error) throw error;

    showToast(`✅ Inspeksi ${jenis_inspeksi} berhasil disimpan! Skor: ${skorAkhir}/100`, "success");

    resetForm();
    await loadHistory();

  } catch (err) {
    showToast("❌ Gagal menyimpan: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
      </svg>
      Simpan Hasil Inspeksi`;
  }
}

/* ── 11. RESET FORM ──────────────────────────────────────────── */
function resetForm() {
  document.getElementById("form-pelaksanaan").reset();
  setDefaultDate();

  // Reset state program
  currentJenis = null;
  checkState   = {};
  skorAkhir    = 0;

  // Sembunyikan kembali card bodi checklist
  document.getElementById("card-checklist").style.display = "none";

  // Kembalikan tampilan parameter meter skor ke default awal
  document.getElementById("big-skor").textContent       = "0";
  document.getElementById("big-skor").className         = "pel-big-skor";
  document.getElementById("skor-label-text").textContent = "Mulai isi checklist";
  
  const fill = document.getElementById("skor-meter-fill");
  if (fill) {
    fill.style.width = "0%";
    fill.className   = "pel-skor-meter-fill";
  }
  document.getElementById("meter-pct").textContent       = "0%";
  document.getElementById("btn-submit").disabled         = true;
}

/* ── 12. LOAD RIWAYAT INSPEKSI ───────────────────────────────── */
async function loadHistory() {
  const tbody = document.getElementById("tbody-history");
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center;padding:20px;color:#6b7280;font-size:.85rem;">
        Memuat data...
      </td>
    </tr>`;

  try {
    const { data, error } = await window.supabaseClient
      .from("pelaksanaan_k3")
      .select(`
        id,
        tanggal,
        jenis_inspeksi,
        departemen_id,
        skor_kepatuhan,
        foto_bukti,
        catatan,
        created_at,
        karyawan:pemeriksa_id ( nama )
      `)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="pel-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              <p>Belum ada data inspeksi yang tersimpan.</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map((row) => {
      const skor    = row.skor_kepatuhan ?? 0;
      const pillCls = skor >= 80 ? "green" : skor >= 60 ? "yellow" : "red";
      const status  = skor >= 80 ? "Baik" : skor >= 60 ? "Perlu Perbaikan" : "Rendah";

      const tgl = row.tanggal
        ? new Date(row.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
            day: "2-digit", month: "short", year: "numeric",
          })
        : "–";

      const namaStr = row.karyawan?.nama ?? `<span style="color:#9ca3af;font-style:italic;">–</span>`;

      const catatanStr = row.catatan
        ? `<span title="${row.catatan}" style="display:inline-block;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;color:#6b7280;">
             ${row.catatan}
           </span>`
        : `<span style="color:#9ca3af;">–</span>`;

      return `
        <tr>
          <td>${tgl}</td>
          <td><strong>${row.jenis_inspeksi}</strong></td>
          <td>${namaStr}</td>
          <td>
            <strong style="font-size:1rem;">${skor}</strong>
            <span style="color:#9ca3af;font-size:.75rem;">/100</span>
          </td>
          <td><span class="pel-pill ${pillCls}">${status}</span></td>
          <td>${catatanStr}</td>
        </tr>`;
    }).join("");

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="color:#e02424;text-align:center;padding:16px;font-size:.85rem;">
          ❌ Gagal memuat riwayat: ${err.message}
        </td>
      </tr>`;
  }
}

/* ── 13. TOAST NOTIFICATION ──────────────────────────────────── */
function showToast(msg, type = "info") {
  const container = document.getElementById("pel-toast-container");
  if (!container) return;
  const el        = document.createElement("div");
  el.className    = `pel-toast ${type}`;
  el.textContent  = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}