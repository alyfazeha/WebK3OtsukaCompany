/* ============================================================
   insiden.js — Laporan Insiden, HIRARC, dan CAPA Tracking
   Tabel Supabase yang dibutuhkan:
     - insiden_k3  (id, tgl, waktu, jenis, lokasi, pelapor, dept,
                    kronologi, keparahan, korban, root_cause,
                    corrective, preventive, target_selesai, status,
                    created_at)
     - hirarc_k3   (id, bahaya, lokasi, dept, kemungkinan,
                    keparahan, nilai_risiko, level_risiko,
                    pengendalian, pj, target, status, created_at)
   ============================================================ */

"use strict";

/* ── State ── */
let allInsiden = [];
let allHirarc  = [];

/* ========================================================
   UTILITIES
   ======================================================== */
function toast(msg, ok = true) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  t.style.background = ok ? "#0F3D56" : "#e74c3c";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.display = "none"), 3000);
}

function formatTgl(str) {
  if (!str) return "–";
  const d = new Date(str);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function switchTab(id, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  btn.classList.add("active");
}

/* ── Level risiko dari nilai ── */
function levelDariNilai(nilai) {
  if (nilai <= 4)  return "Rendah";
  if (nilai <= 9)  return "Menengah";
  if (nilai <= 15) return "Tinggi";
  return "Ekstrem";
}

function badgeLevel(level) {
  const map = {
    Rendah: "badge-rendah", Menengah: "badge-menengah",
    Tinggi: "badge-tinggi", Ekstrem: "badge-ekstrem"
  };
  return `<span class="badge-status ${map[level] || ''}">${level}</span>`;
}

function badgeStatus(status) {
  const map = {
    Open: "badge-open",
    "Dalam Proses": "badge-proses",
    Closed: "badge-closed"
  };
  return `<span class="badge-status ${map[status] || ''}">${status}</span>`;
}

function badgeKeparahan(k) {
  const map = { Ringan: "badge-ringan", Sedang: "badge-sedang", Berat: "badge-berat" };
  return `<span class="badge-status ${map[k] || ''}">${k}</span>`;
}

/* ========================================================
   KALKULASI RISIKO (HIRARC)
   ======================================================== */
function hitungRisiko() {
  const k = parseInt(document.getElementById("inp-kemungkinan").value) || 0;
  const s = parseInt(document.getElementById("inp-keparahan-hirarc").value) || 0;
  if (!k || !s) return;

  const nilai = k * s;
  const level = levelDariNilai(nilai);

  document.getElementById("inp-nilai-risiko").value = nilai;
  document.getElementById("inp-level-risiko").value = level;
}

/* ========================================================
   LOAD DATA
   ======================================================== */
async function loadAll() {
  await Promise.all([loadInsiden(), loadHirarc()]);
  updateKPI();
  renderCapa();
}

async function loadInsiden() {
  try {
    const { data, error } = await db
      .from("insiden_k3")
      .select("*")
      .order("tgl", { ascending: false });

    if (error) throw error;
    allInsiden = data || [];
  } catch (e) {
    console.error("loadInsiden:", e);
    allInsiden = [];
  }
  renderInsiden();
}

async function loadHirarc() {
  try {
    const { data, error } = await db
      .from("hirarc_k3")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    allHirarc = data || [];
  } catch (e) {
    console.error("loadHirarc:", e);
    allHirarc = [];
  }
  renderHirarc();
}

/* ========================================================
   RENDER: KPI
   ======================================================== */
function updateKPI() {
  document.getElementById("kpi-open").textContent =
    allInsiden.filter(i => i.status === "Open").length;
  document.getElementById("kpi-proses").textContent =
    allInsiden.filter(i => i.status === "Dalam Proses").length;
  document.getElementById("kpi-closed").textContent =
    allInsiden.filter(i => i.status === "Closed").length;
  document.getElementById("kpi-bahaya").textContent = allHirarc.length;
  document.getElementById("kpi-capa").textContent =
    allInsiden.filter(i => i.status !== "Closed").length;
}

/* ========================================================
   RENDER: TABEL INSIDEN
   ======================================================== */
function renderInsiden() {
  const q      = (document.getElementById("cari-insiden").value || "").toLowerCase();
  const fjenis  = document.getElementById("filter-jenis-insiden").value;
  const fstatus = document.getElementById("filter-status-insiden").value;

  let data = allInsiden.filter(i => {
    const matchQ = !q || (i.jenis + i.lokasi + i.pelapor).toLowerCase().includes(q);
    const matchJ = !fjenis  || i.jenis === fjenis;
    const matchS = !fstatus || i.status === fstatus;
    return matchQ && matchJ && matchS;
  });

  const tbody = document.getElementById("tbody-insiden");

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Tidak ada data insiden yang sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((row, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${formatTgl(row.tgl)}</td>
      <td>${row.jenis}</td>
      <td>${row.lokasi}</td>
      <td>${row.pelapor}</td>
      <td>${badgeKeparahan(row.keparahan)}</td>
      <td>${badgeStatus(row.status)}</td>
      <td>
        <button class="btn-sm btn-detail" onclick="lihatDetailInsiden('${row.id}')">Detail</button>
        <button class="btn-sm btn-detail" style="background:#176C8C" onclick="editInsiden('${row.id}')">Edit</button>
        <button class="btn-sm btn-hapus" onclick="hapusInsiden('${row.id}')">Hapus</button>
      </td>
    </tr>
  `).join("");
}

/* ========================================================
   RENDER: TABEL HIRARC
   ======================================================== */
function renderHirarc() {
  const q      = (document.getElementById("cari-hirarc").value || "").toLowerCase();
  const frisiko = document.getElementById("filter-risiko").value;

  let data = allHirarc.filter(h => {
    const matchQ = !q || (h.bahaya + h.lokasi).toLowerCase().includes(q);
    const matchR = !frisiko || h.level_risiko === frisiko;
    return matchQ && matchR;
  });

  const tbody = document.getElementById("tbody-hirarc");

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Tidak ada data bahaya yang sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((row, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td style="text-align:left">${row.bahaya}</td>
      <td>${row.lokasi}</td>
      <td style="text-align:center">${row.kemungkinan}</td>
      <td style="text-align:center">${row.keparahan}</td>
      <td style="text-align:center;font-weight:700;color:#0F3D56">${row.nilai_risiko}</td>
      <td>${badgeLevel(row.level_risiko)}</td>
      <td style="text-align:left;font-size:13px">${row.pengendalian || '–'}</td>
      <td>
        <button class="btn-sm btn-detail" style="background:#176C8C" onclick="editHirarc('${row.id}')">Edit</button>
        <button class="btn-sm btn-hapus" onclick="hapusHirarc('${row.id}')">Hapus</button>
      </td>
    </tr>
  `).join("");
}

/* ========================================================
   RENDER: CAPA LIST
   ======================================================== */
function renderCapa() {
  const fstatus = document.getElementById("filter-status-capa").value;

  let data = allInsiden.filter(i => {
    const hasCapa = i.corrective || i.preventive;
    const matchS = !fstatus || i.status === fstatus;
    return hasCapa && matchS;
  });

  const container = document.getElementById("capa-list");

  if (!data.length) {
    container.innerHTML = `<div class="empty-state">Belum ada CAPA terdaftar. CAPA muncul otomatis dari laporan insiden yang memiliki tindakan perbaikan.</div>`;
    return;
  }

  container.innerHTML = data.map(row => {
    const cls = row.status === "Closed" ? "closed" : row.status === "Dalam Proses" ? "proses" : "";
    return `
      <div class="capa-item ${cls}">
        <div class="capa-header">
          <strong style="color:#0F3D56;font-size:14px">${row.jenis} — ${row.lokasi}</strong>
          ${badgeStatus(row.status)}
        </div>
        ${row.corrective ? `<div class="capa-desc">✅ <strong>Corrective:</strong> ${row.corrective}</div>` : ""}
        ${row.preventive ? `<div class="capa-desc" style="margin-top:4px">🛡 <strong>Preventive:</strong> ${row.preventive}</div>` : ""}
        <div class="capa-meta">
          Pelapor: ${row.pelapor} · Tanggal: ${formatTgl(row.tgl)}
          ${row.target_selesai ? ` · Target: ${formatTgl(row.target_selesai)}` : ""}
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          ${row.status !== "Dalam Proses" && row.status !== "Closed"
            ? `<button class="btn-sm btn-proses" onclick="updateStatusInsiden('${row.id}','Dalam Proses')">Tandai: Dalam Proses</button>` : ""}
          ${row.status !== "Closed"
            ? `<button class="btn-sm btn-selesai" onclick="updateStatusInsiden('${row.id}','Closed')">Tandai: Closed</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

/* ========================================================
   MODAL: INSIDEN — BUKA / TUTUP / SIMPAN
   ======================================================== */
function openModalInsiden(id = null) {
  bersihkanFormInsiden();
  document.getElementById("inp-insiden-id").value = id || "";
  document.getElementById("modal-insiden-title").textContent =
    id ? "Edit Laporan Insiden" : "Laporan Insiden Baru";

  if (id) {
    const row = allInsiden.find(i => i.id == id);
    if (row) {
      document.getElementById("inp-tgl-insiden").value     = row.tgl || "";
      document.getElementById("inp-waktu-insiden").value   = row.waktu || "";
      document.getElementById("inp-jenis-insiden").value   = row.jenis || "";
      document.getElementById("inp-lokasi-insiden").value  = row.lokasi || "";
      document.getElementById("inp-pelapor").value         = row.pelapor || "";
      document.getElementById("inp-dept-insiden").value    = row.dept || "";
      document.getElementById("inp-kronologi").value       = row.kronologi || "";
      document.getElementById("inp-keparahan-insiden").value = row.keparahan || "";
      document.getElementById("inp-korban").value          = row.korban || 0;
      document.getElementById("inp-root-cause").value      = row.root_cause || "";
      document.getElementById("inp-corrective").value      = row.corrective || "";
      document.getElementById("inp-preventive").value      = row.preventive || "";
      document.getElementById("inp-target-insiden").value  = row.target_selesai || "";
      document.getElementById("inp-status-insiden").value  = row.status || "Open";
    }
  }

  document.getElementById("modal-insiden").classList.add("open");
}

function editInsiden(id) { openModalInsiden(id); }

function closeModalInsiden() {
  document.getElementById("modal-insiden").classList.remove("open");
}

function bersihkanFormInsiden() {
  ["inp-insiden-id","inp-tgl-insiden","inp-waktu-insiden","inp-jenis-insiden",
   "inp-lokasi-insiden","inp-pelapor","inp-dept-insiden","inp-kronologi",
   "inp-keparahan-insiden","inp-korban","inp-root-cause","inp-corrective",
   "inp-preventive","inp-target-insiden"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("inp-status-insiden").value = "Open";
  document.getElementById("inp-korban").value = 0;
}

async function simpanInsiden() {
  const id         = document.getElementById("inp-insiden-id").value;
  const tgl        = document.getElementById("inp-tgl-insiden").value;
  const jenis      = document.getElementById("inp-jenis-insiden").value;
  const lokasi     = document.getElementById("inp-lokasi-insiden").value;
  const pelapor    = document.getElementById("inp-pelapor").value;

  if (!tgl || !jenis || !lokasi || !pelapor) {
    toast("Lengkapi field yang wajib diisi (*).", false);
    return;
  }

  const kronologi  = document.getElementById("inp-kronologi").value;
  if (!kronologi) {
    toast("Kronologi kejadian wajib diisi.", false);
    return;
  }
  if (!document.getElementById("inp-keparahan-insiden").value) {
    toast("Pilih tingkat keparahan.", false);
    return;
  }

  const payload = {
    tgl,
    waktu:         document.getElementById("inp-waktu-insiden").value || null,
    jenis,
    lokasi,
    pelapor,
    dept:          document.getElementById("inp-dept-insiden").value || null,
    kronologi,
    keparahan:     document.getElementById("inp-keparahan-insiden").value,
    korban:        parseInt(document.getElementById("inp-korban").value) || 0,
    root_cause:    document.getElementById("inp-root-cause").value || null,
    corrective:    document.getElementById("inp-corrective").value || null,
    preventive:    document.getElementById("inp-preventive").value || null,
    target_selesai: document.getElementById("inp-target-insiden").value || null,
    status:        document.getElementById("inp-status-insiden").value,
  };

  try {
    let error;
    if (id) {
      ({ error } = await db.from("insiden_k3").update(payload).eq("id", id));
    } else {
      ({ error } = await db.from("insiden_k3").insert([payload]));
    }
    if (error) throw error;

    toast(id ? "Laporan insiden berhasil diperbarui." : "Laporan insiden berhasil disimpan.");
    closeModalInsiden();
    await loadAll();
  } catch (e) {
    console.error(e);
    toast("Gagal menyimpan: " + e.message, false);
  }
}

async function hapusInsiden(id) {
  if (!confirm("Hapus laporan insiden ini? Tindakan tidak dapat dibatalkan.")) return;
  const { error } = await db.from("insiden_k3").delete().eq("id", id);
  if (error) { toast("Gagal menghapus: " + error.message, false); return; }
  toast("Laporan insiden dihapus.");
  await loadAll();
}

async function updateStatusInsiden(id, status) {
  const { error } = await db.from("insiden_k3").update({ status }).eq("id", id);
  if (error) { toast("Gagal update status.", false); return; }
  toast(`Status diubah ke: ${status}`);
  await loadAll();
}

/* ── Detail Insiden ── */
function lihatDetailInsiden(id) {
  const row = allInsiden.find(i => i.id == id);
  if (!row) return;

  const body = document.getElementById("detail-insiden-body");
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;">
      ${infoBox("Tanggal",       formatTgl(row.tgl))}
      ${infoBox("Waktu",         row.waktu || "–")}
      ${infoBox("Jenis Insiden", row.jenis)}
      ${infoBox("Lokasi",        row.lokasi)}
      ${infoBox("Pelapor",       row.pelapor)}
      ${infoBox("Departemen",    row.dept || "–")}
      ${infoBox("Tingkat Keparahan", row.keparahan)}
      ${infoBox("Jumlah Korban", row.korban ?? "–")}
    </div>
    ${narasiBox("Kronologis Kejadian", row.kronologi)}
    ${narasiBox("Root Cause / Akar Masalah", row.root_cause)}
    ${narasiBox("Corrective Action", row.corrective)}
    ${narasiBox("Preventive Action", row.preventive)}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;padding-top:12px;border-top:1px solid #eee;">
      <span style="font-size:13px;color:#888">Target: ${formatTgl(row.target_selesai)}</span>
      ${badgeStatus(row.status)}
    </div>
  `;
  document.getElementById("modal-detail-insiden").classList.add("open");
}

function infoBox(label, val) {
  return `<div style="background:#f4f8fb;padding:10px 14px;border-radius:10px;">
    <div style="font-size:11px;color:#888;margin-bottom:2px">${label}</div>
    <div style="font-size:14px;font-weight:500;color:#0F3D56">${val}</div>
  </div>`;
}

function narasiBox(label, val) {
  if (!val) return "";
  return `<div style="background:#f4f8fb;padding:12px 14px;border-radius:10px;margin-bottom:10px;">
    <div style="font-size:11px;font-weight:700;color:#1FA9E6;margin-bottom:5px">${label}</div>
    <div style="font-size:14px;color:#333;line-height:1.6">${val}</div>
  </div>`;
}

/* ========================================================
   MODAL: HIRARC — BUKA / TUTUP / SIMPAN
   ======================================================== */
function openModalHirarc(id = null) {
  bersihkanFormHirarc();
  document.getElementById("inp-hirarc-id").value = id || "";
  document.getElementById("modal-hirarc-title").textContent =
    id ? "Edit Identifikasi Bahaya" : "Identifikasi Bahaya Baru";

  if (id) {
    const row = allHirarc.find(h => h.id == id);
    if (row) {
      document.getElementById("inp-bahaya").value            = row.bahaya || "";
      document.getElementById("inp-lokasi-hirarc").value     = row.lokasi || "";
      document.getElementById("inp-dept-hirarc").value       = row.dept || "";
      document.getElementById("inp-kemungkinan").value       = row.kemungkinan || "";
      document.getElementById("inp-keparahan-hirarc").value  = row.keparahan || "";
      document.getElementById("inp-nilai-risiko").value      = row.nilai_risiko || "";
      document.getElementById("inp-level-risiko").value      = row.level_risiko || "";
      document.getElementById("inp-pengendalian").value      = row.pengendalian || "";
      document.getElementById("inp-pj-hirarc").value         = row.pj || "";
      document.getElementById("inp-target-hirarc").value     = row.target || "";
      document.getElementById("inp-status-hirarc").value     = row.status || "Open";
    }
  }

  document.getElementById("modal-hirarc").classList.add("open");
}

function editHirarc(id) { openModalHirarc(id); }

function closeModalHirarc() {
  document.getElementById("modal-hirarc").classList.remove("open");
}

function bersihkanFormHirarc() {
  ["inp-hirarc-id","inp-bahaya","inp-lokasi-hirarc","inp-dept-hirarc",
   "inp-kemungkinan","inp-keparahan-hirarc","inp-nilai-risiko","inp-level-risiko",
   "inp-pengendalian","inp-pj-hirarc","inp-target-hirarc"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("inp-status-hirarc").value = "Open";
}

async function simpanHirarc() {
  const id          = document.getElementById("inp-hirarc-id").value;
  const bahaya      = document.getElementById("inp-bahaya").value;
  const lokasi      = document.getElementById("inp-lokasi-hirarc").value;
  const kemungkinan = parseInt(document.getElementById("inp-kemungkinan").value);
  const keparahan   = parseInt(document.getElementById("inp-keparahan-hirarc").value);
  const pengendalian = document.getElementById("inp-pengendalian").value;

  if (!bahaya || !lokasi || !kemungkinan || !keparahan || !pengendalian) {
    toast("Lengkapi semua field wajib (*).", false);
    return;
  }

  const nilai_risiko = kemungkinan * keparahan;
  const level_risiko = levelDariNilai(nilai_risiko);

  const payload = {
    bahaya,
    lokasi,
    dept:          document.getElementById("inp-dept-hirarc").value || null,
    kemungkinan,
    keparahan,
    nilai_risiko,
    level_risiko,
    pengendalian,
    pj:            document.getElementById("inp-pj-hirarc").value || null,
    target:        document.getElementById("inp-target-hirarc").value || null,
    status:        document.getElementById("inp-status-hirarc").value,
  };

  try {
    let error;
    if (id) {
      ({ error } = await db.from("hirarc_k3").update(payload).eq("id", id));
    } else {
      ({ error } = await db.from("hirarc_k3").insert([payload]));
    }
    if (error) throw error;

    toast(id ? "Data bahaya berhasil diperbarui." : "Identifikasi bahaya berhasil disimpan.");
    closeModalHirarc();
    await loadAll();
  } catch (e) {
    console.error(e);
    toast("Gagal menyimpan: " + e.message, false);
  }
}

async function hapusHirarc(id) {
  if (!confirm("Hapus data bahaya ini?")) return;
  const { error } = await db.from("hirarc_k3").delete().eq("id", id);
  if (error) { toast("Gagal menghapus: " + error.message, false); return; }
  toast("Data bahaya dihapus.");
  await loadAll();
}

/* ========================================================
   INIT
   ======================================================== */
document.addEventListener("DOMContentLoaded", loadAll);