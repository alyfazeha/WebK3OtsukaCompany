// =========================================================================
//  compliance_report.js
//  Controller untuk Modul 6.3 Compliance Analitika & Laporan (K3-IMS)
//  Mengacu pada K3-IMS General Specification v1.0:
//    - 6.3.3 Form Submission & Review
//    - 6.5   Information Dashboard
//
//  Skema tabel yang diasumsikan (Supabase):
//    monitoring_forms:
//      id, title, target_department
//    monitoring_submissions:
//      id, form_id, form_title, inspector_name, inspector_department,
//      submitted_answers (jsonb array of { label, type, value }),
//      submitted_at (timestamptz)
//
//  Catatan: 'db' diasumsikan sudah diinisialisasi secara global oleh
//  js/supabase-config.js, sama seperti pola di karyawan.js.
// =========================================================================

const modalDetail = document.getElementById("modalDetailAnswers");
const tbodySubmissionLogs = document.getElementById("tbodySubmissionLogs");

let deptChartInstance = null;
let ratioChartInstance = null;

let cachedForms = [];
let cachedSubmissions = [];

const DEPARTMENT_LIST = ["Produksi", "QA", "QC", "HRD", "Engineering", "Warehouse"];

// =========================================================================
// 1. MUAT DATA DARI SUPABASE
// =========================================================================
async function loadAnalyticsReport() {
    tbodySubmissionLogs.innerHTML = `
        <tr><td colspan="6" class="comp-table-loading">Memperbarui data analitik dari server Supabase...</td></tr>
    `;

    const { data: formsData, error: formsError } = await db
        .from("monitoring_forms")
        .select("id, title, target_department");

    if (formsError) {
        console.log(formsError);
        tbodySubmissionLogs.innerHTML = `
            <tr><td colspan="6" class="comp-table-error">Gagal memuat data form: ${formsError.message}</td></tr>
        `;
        return;
    }

    const { data: subsData, error: subsError } = await db
        .from("monitoring_submissions")
        .select("*")
        .order("submitted_at", { ascending: false });

    if (subsError) {
        console.log(subsError);
        tbodySubmissionLogs.innerHTML = `
            <tr><td colspan="6" class="comp-table-error">Gagal memuat data submisi: ${subsError.message}</td></tr>
        `;
        return;
    }

    cachedForms = formsData || [];
    cachedSubmissions = subsData || [];

    applyFilterAndRender();
}
loadAnalyticsReport();

// =========================================================================
// 2. FILTER DEPARTEMEN (Spesifikasi 6.5.2)
// =========================================================================
function applyFilterAndRender() {
    const filterDeptEl = document.getElementById("filterDept");
    const selectedDept = filterDeptEl ? filterDeptEl.value : "ALL";

    const filteredSubs = selectedDept === "ALL"
        ? cachedSubmissions
        : cachedSubmissions.filter(sub => sub.department === selectedDept);

    const totalFormsCount = cachedForms.length;
    const totalSubsCount = filteredSubs.length;

    document.getElementById("statTotalForms").textContent = totalFormsCount;
    document.getElementById("statTotalSubmissions").textContent = totalSubsCount;

    // Rata-rata rating (field bertipe 'rating', skala 1-5)
    let totalRatingSum = 0;
    let ratingElementsCount = 0;

    filteredSubs.forEach(sub => {
        if (Array.isArray(sub.submitted_answers)) {
            sub.submitted_answers.forEach(ans => {
                if (ans.type === "rating" && ans.value !== null && ans.value !== "") {
                    const numericValue = parseFloat(ans.value);
                    if (!Number.isNaN(numericValue)) {
                        totalRatingSum += numericValue;
                        ratingElementsCount++;
                    }
                }
            });
        }
    });

    const finalAvgRating = ratingElementsCount > 0
        ? (totalRatingSum / ratingElementsCount).toFixed(1)
        : "0.0";
    document.getElementById("statAvgRating").textContent = `${finalAvgRating}/5`;

    // Estimasi compliance rate sederhana: submisi vs ekspektasi (form x departemen)
    // Untuk kalkulasi resmi berbasis jadwal (6.3.2), perlu tabel jadwal terpisah.
    const expectedSubmissions = totalFormsCount * DEPARTMENT_LIST.length;
    const calculatedComplianceRate = expectedSubmissions > 0
        ? Math.min(Math.round((totalSubsCount / expectedSubmissions) * 100), 100)
        : 0;
    document.getElementById("statComplianceRate").textContent = `${calculatedComplianceRate}%`;

    processAndRenderCharts(filteredSubs);
    renderSubmissionTableLogs(filteredSubs);
}

// =========================================================================
// 3. GRAFIK (CHART.JS) — Spesifikasi 6.5.1
// =========================================================================
function processAndRenderCharts(submissions) {
    // --- Grafik Batang: Distribusi Submisi per Departemen ---
    const deptCounts = {};
    DEPARTMENT_LIST.forEach(dept => { deptCounts[dept] = 0; });

    submissions.forEach(sub => {
        if (deptCounts[sub.department] !== undefined) {
            deptCounts[sub.department]++;
        }
    });

    const ctxDeptEl = document.getElementById("chartDeptSubmissions");
    if (ctxDeptEl) {
        const ctxDept = ctxDeptEl.getContext("2d");
        if (deptChartInstance) deptChartInstance.destroy();

        deptChartInstance = new Chart(ctxDept, {
            type: "bar",
            data: {
                labels: Object.keys(deptCounts),
                datasets: [{
                    label: "Jumlah Inspeksi Lapangan Selesai",
                    data: Object.values(deptCounts),
                    backgroundColor: "#23A7C7",
                    borderRadius: 4,
                    barThickness: 32
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    // --- Grafik Donut: Rasio Penggunaan Template Form ---
    const formUsageCounts = {};
    submissions.forEach(sub => {
        const label = sub.form_title || "Tanpa Judul";
        formUsageCounts[label] = (formUsageCounts[label] || 0) + 1;
    });

    const formLabels = Object.keys(formUsageCounts);
    const formValues = Object.values(formUsageCounts);

    const safeLabels = formLabels.length > 0 ? formLabels : ["Belum Ada Data"];
    const safeValues = formValues.length > 0 ? formValues : [1];
    const safeColors = formLabels.length > 0
        ? ["#0F3D56", "#176C8C", "#23A7C7", "#2ecc71", "#f1c40f", "#e74c3c"]
        : ["#e2e8f0"];

    const ctxRatioEl = document.getElementById("chartFormRatio");
    if (ctxRatioEl) {
        const ctxRatio = ctxRatioEl.getContext("2d");
        if (ratioChartInstance) ratioChartInstance.destroy();

        ratioChartInstance = new Chart(ctxRatio, {
            type: "doughnut",
            data: {
                labels: safeLabels,
                datasets: [{
                    data: safeValues,
                    backgroundColor: safeColors,
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }
                },
                cutout: "65%"
            }
        });
    }
}

// =========================================================================
// 4. TABEL LOG RIWAYAT SUBMISI
// =========================================================================
function renderSubmissionTableLogs(submissions) {
    if (!submissions || submissions.length === 0) {
        tbodySubmissionLogs.innerHTML = `
            <tr><td colspan="6" class="comp-table-empty">Belum ada rekaman log inspeksi lapangan yang masuk ke sistem.</td></tr>
        `;
        return;
    }

    tbodySubmissionLogs.innerHTML = "";
    submissions.forEach(sub => {
        const totalParameters = Array.isArray(sub.submitted_answers) ? sub.submitted_answers.length : 0;
        const formattedDate = formatSubmissionDate(sub.submitted_at);

        tbodySubmissionLogs.innerHTML += `
        <tr>
            <td style="text-align:left;font-weight:600;">${escapeHtml(sub.form_title)}</td>
            <td>${escapeHtml(sub.submitted_by)}</td>
            <td>
                <span class="badge comp-badge-dept">${escapeHtml(sub.department)}</span>
            </td>
            <td>${totalParameters} Parameter</td>
            <td style="font-size:.8rem;color:#777;">${formattedDate}</td>
            <td>
                <button type="button" onclick="bukaModalDetail(${sub.id})" style="padding:8px 14px;font-size:13px;">
                    Lihat Detail
                </button>
            </td>
        </tr>
        `;
    });
}

// =========================================================================
// 5. MODAL DETAIL JAWABAN
// =========================================================================
function bukaModalDetail(id) {
    const submission = cachedSubmissions.find(s => String(s.id) === String(id));
    if (!submission) return;

    document.getElementById("modalFormTitle").innerText = submission.form_title || "Detail Jawaban Form Inspeksi";
    document.getElementById("modalMetaInfo").innerText =
        `Pemeriksa: ${submission.submitted_by || "-"} | Departemen: ${submission.department || "-"} | Waktu: ${formatSubmissionDate(submission.submitted_at)}`;

    const answers = Array.isArray(submission.submitted_answers) ? submission.submitted_answers : [];
    const container = document.getElementById("modalAnswersContainer");

    if (answers.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8;font-style:italic;">Tidak ada rincian jawaban yang tersimpan untuk submisi ini.</p>`;
    } else {
        container.innerHTML = answers.map(ans => {
            const label = escapeHtml(ans.label || ans.field || "Pertanyaan");
            const value = formatAnswerValue(ans);
            return `
            <div class="comp-modal-answer-row">
                <p class="comp-modal-answer-label">${label}</p>
                <p class="comp-modal-answer-value">${value}</p>
            </div>
            `;
        }).join("");
    }

    modalDetail.style.display = "flex";
}

function tutupModalDetail() {
    modalDetail.style.display = "none";
}

function formatAnswerValue(ans) {
    if (ans.type === "photo" && ans.value) {
        return `<img src="${escapeHtml(ans.value)}" alt="Foto bukti" style="max-height:160px;border-radius:8px;border:1px solid #eee;" />`;
    }
    if (ans.type === "signature" && ans.value) {
        return `<img src="${escapeHtml(ans.value)}" alt="Tanda tangan" style="max-height:96px;border-radius:8px;border:1px solid #eee;background:#fafafa;" />`;
    }
    if (ans.value === null || ans.value === undefined || ans.value === "") {
        return `<span style="color:#94a3b8;font-style:italic;">Tidak diisi</span>`;
    }
    return escapeHtml(String(ans.value));
}

// =========================================================================
// 6. EKSPOR CSV (Spesifikasi 6.5.3)
// =========================================================================
function exportSubmissionsToCsv() {
    const filterDeptEl = document.getElementById("filterDept");
    const selectedDept = filterDeptEl ? filterDeptEl.value : "ALL";

    const rowsToExport = selectedDept === "ALL"
        ? cachedSubmissions
        : cachedSubmissions.filter(sub => sub.department === selectedDept);

    if (rowsToExport.length === 0) {
        alert("Tidak ada data untuk diekspor pada filter yang sedang aktif.");
        return;
    }

    const header = ["Nama Form", "Inspektur", "Departemen", "Jumlah Parameter", "Waktu Submisi"];
    const csvRows = [header.join(",")];

    rowsToExport.forEach(sub => {
        const totalParameters = Array.isArray(sub.submitted_answers) ? sub.submitted_answers.length : 0;
        const row = [
            csvEscape(sub.form_title),
            csvEscape(sub.submitted_by),
            csvEscape(sub.department),
            totalParameters,
            csvEscape(formatSubmissionDate(sub.submitted_at))
        ];
        csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `riwayat-kepatuhan-k3_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function csvEscape(value) {
    const str = value === null || value === undefined ? "" : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// =========================================================================
// 7. UTILITAS
// =========================================================================
function formatSubmissionDate(rawDate) {
    if (!rawDate) return "-";
    const submissionDate = new Date(rawDate);
    if (Number.isNaN(submissionDate.getTime())) return "-";
    const datePart = submissionDate.toLocaleDateString("id-ID", {
        year: "numeric", month: "short", day: "numeric"
    });
    const timePart = `${String(submissionDate.getHours()).padStart(2, "0")}:${String(submissionDate.getMinutes()).padStart(2, "0")}`;
    return `${datePart} - ${timePart} WIB`;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "-";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================================================================
// 8. EVENT LISTENERS
// =========================================================================
document.getElementById("btnRefreshReport").addEventListener("click", loadAnalyticsReport);
document.getElementById("btnExportCsv").addEventListener("click", exportSubmissionsToCsv);

const filterDeptSelect = document.getElementById("filterDept");
if (filterDeptSelect) {
    filterDeptSelect.addEventListener("change", applyFilterAndRender);
}

// Tutup modal saat klik area luar (konsisten dengan window.onclick di karyawan.js)
window.addEventListener("click", (event) => {
    if (event.target === modalDetail) {
        tutupModalDetail();
    }
});