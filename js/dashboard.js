/**
 * dashboard.js
 * Alyfa Zahra – Backend & Dashboard Specialist
 * Updated: sesuai spesifikasi 6.5 Information Dashboard
 */

// ── Chart instances (destroy before re-render to avoid overlap) ──
let complianceChartInstance = null;
let incidentChartInstance   = null;
let docStatusChartInstance  = null;

// ── Supabase client alias ──
const client = typeof db !== 'undefined' ? db : supabase;

// ── Daftar departemen tetap (untuk heatmap) ──
const DEPTS = ['Produksi', 'QC', 'HRD', 'Engineering', 'Warehouse'];

// ── Nama bulan Indonesia ──
function konversiBulan(angkaBulan) {
    const namaBulan = [
        "Januari","Februari","Maret","April","Mei","Juni",
        "Juli","Agustus","September","Oktober","November","Desember"
    ];
    return namaBulan[angkaBulan - 1] || "—";
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    // Set default date range: awal tahun ini s/d hari ini
    const today   = new Date();
    const firstDay = new Date(today.getFullYear(), 0, 1);
    document.getElementById('filter-tgl-awal').value  = firstDay.toISOString().split('T')[0];
    document.getElementById('filter-tgl-akhir').value = today.toISOString().split('T')[0];

    refreshDashboard();

    // Pasang event listener pada semua kontrol filter
    ['filter-dept','filter-tahun','filter-jenis-form',
     'filter-kategori-dok','filter-tgl-awal','filter-tgl-akhir'].forEach(id => {
        document.getElementById(id).addEventListener('change', refreshDashboard);
    });

    // Sub-kontrol chart insiden
    document.getElementById('incident-view-mode').addEventListener('change', () => refreshInsiden());
    document.getElementById('incident-yoy').addEventListener('change', () => refreshInsiden());
});

// ══════════════════════════════════════════════
//  FUNGSI UTAMA REFRESH
// ══════════════════════════════════════════════
async function refreshDashboard() {
    const dept      = document.getElementById('filter-dept').value;
    const tahun     = document.getElementById('filter-tahun').value;
    const jenisForm = document.getElementById('filter-jenis-form').value;
    const katDok    = document.getElementById('filter-kategori-dok').value;
    const tglAwal   = document.getElementById('filter-tgl-awal').value;
    const tglAkhir  = document.getElementById('filter-tgl-akhir').value;

    // Semua dipanggil paralel untuk performa
    await Promise.allSettled([
        hitungFormulirOverdue(dept, jenisForm, tglAwal, tglAkhir),
        hitungDokumenKadaluarsa(katDok),
        hitungInsidenDanCapa(dept, tglAwal, tglAkhir),
        hitungSafeDays(),
        muatDataRekapUtama(tahun),
        muatStatusDokumen(katDok),
        muatHeatmapFormulir(jenisForm, tglAwal, tglAkhir),
    ]);
}

// ── Helper untuk re-render chart insiden saja (sub-kontrol) ──
let _cachedInsidenData = [];
async function refreshInsiden() {
    renderIncidentChart(_cachedInsidenData);
}

// ══════════════════════════════════════════════
//  KPI 1 – Formulir Terlambat (Overdue Forms)
// ══════════════════════════════════════════════
async function hitungFormulirOverdue(dept, jenisForm, tglAwal, tglAkhir) {
    try {
        // Ambil semua form aktif
        let qForms = client.from('monitoring_forms').select('id, frequency, target_department').eq('status', 'Active');
        if (jenisForm !== 'All') qForms = qForms.eq('frequency', jenisForm);
        if (dept !== 'All')     qForms = qForms.eq('target_department', dept);

        const { data: forms, error: fErr } = await qForms;
        if (fErr || !forms) return;

        const formIds = forms.map(f => f.id);
        if (formIds.length === 0) {
            document.getElementById('stat-overdue').innerText = 0;
            return;
        }

        // Ambil submission dalam rentang tanggal
        let qSubs = client.from('monitoring_submissions')
            .select('form_id, status')
            .in('form_id', formIds);
        if (tglAwal)  qSubs = qSubs.gte('submitted_at', tglAwal);
        if (tglAkhir) qSubs = qSubs.lte('submitted_at', tglAkhir + 'T23:59:59');

        const { data: subs, error: sErr } = await qSubs;
        if (sErr) return;

        // Form tanpa submission dianggap overdue
        const submittedIds = new Set((subs || []).map(s => s.form_id));
        const overdue = formIds.filter(id => !submittedIds.has(id)).length;
        document.getElementById('stat-overdue').innerText = overdue;

    } catch (err) {
        console.error("Gagal memuat formulir overdue:", err);
    }
}

// ══════════════════════════════════════════════
//  KPI 2 – Dokumen Segera Kadaluarsa (<30 hari)
// ══════════════════════════════════════════════
async function hitungDokumenKadaluarsa(katDok) {
    try {
        const today  = new Date();
        const in30   = new Date(); in30.setDate(today.getDate() + 30);

        let query = client.from('dokumen_k3')
            .select('*', { count: 'exact', head: true })
            .gte('tanggal_review', today.toISOString().split('T')[0])
            .lte('tanggal_review', in30.toISOString().split('T')[0]);

        if (katDok !== 'All') query = query.eq('jenis_dokumen', katDok);

        const { count, error } = await query;
        if (!error && count !== null) {
            document.getElementById('stat-dokumen-kadaluarsa').innerText = count;
        }
    } catch (err) {
        console.error("Gagal memuat dokumen kadaluarsa:", err);
    }
}

// ══════════════════════════════════════════════
//  KPI 3 & 4 – Insiden Terbuka + CAPA Terbuka
// ══════════════════════════════════════════════
async function hitungInsidenDanCapa(dept, tglAwal, tglAkhir) {
    try {
        // A. Insiden
        let qInsiden = client.from('incidents').select('jenis, status, dept, tgl');
        if (dept !== 'All') qInsiden = qInsiden.eq('dept', dept);
        if (tglAwal)  qInsiden = qInsiden.gte('tgl', tglAwal);
        if (tglAkhir) qInsiden = qInsiden.lte('tgl', tglAkhir);

        const { data: dataInsiden, error: errInsiden } = await qInsiden;
        if (!errInsiden && dataInsiden) {
            const openInsiden = dataInsiden.filter(i => i.status !== 'Closed').length;
            document.getElementById('stat-incidents').innerText = openInsiden;
            _cachedInsidenData = dataInsiden;
            renderIncidentChart(dataInsiden);
        }

        // B. CAPA – gabungan dari temuan_audit + capa_items
        const [{ data: temuanData }, { data: capaData }] = await Promise.all([
            client.from('temuan_audit').select('status_perbaikan'),
            client.from('capa_items').select('status_capa'),
        ]);

        const openTemuan = (temuanData || []).filter(c => c.status_perbaikan === 'Open').length;
        const openCapa   = (capaData   || []).filter(c => c.status_capa === 'Open').length;
        document.getElementById('stat-capa').innerText = openTemuan + openCapa;

    } catch (err) {
        console.error("Gagal memuat insiden/CAPA:", err);
    }
}

// ══════════════════════════════════════════════
//  KPI 5 – Safe Days Counter (tanpa LTI)
// ══════════════════════════════════════════════
async function hitungSafeDays() {
    try {
        // LTI = insiden dengan keparahan 'LTI' atau 'Berat'
        const { data, error } = await client
            .from('incidents')
            .select('tgl')
            .in('keparahan', ['LTI', 'Berat'])
            .order('tgl', { ascending: false })
            .limit(1);

        if (!error && data && data.length > 0 && data[0].tgl) {
            const lastLTI  = new Date(data[0].tgl);
            const diff     = Math.floor((new Date() - lastLTI) / 86400000);
            document.getElementById('stat-safedays').innerText = `${diff} Hari`;
        } else {
            document.getElementById('stat-safedays').innerText = "365+ Hari";
        }
    } catch (err) {
        console.error("Gagal menghitung Safe Days:", err);
    }
}

// ══════════════════════════════════════════════
//  REKAP BULANAN + NARASI + CHART KEPATUHAN
// ══════════════════════════════════════════════
async function muatDataRekapUtama(tahun) {
    try {
        let query = client.from('kesimpulan_rekap')
            .select('*')
            .order('tahun', { ascending: false })
            .order('bulan', { ascending: false });

        if (tahun !== 'All') query = query.eq('tahun', parseInt(tahun));

        const { data, error } = await query;
        const narasiBox = document.getElementById('narasi-box');
        const tabelBody = document.getElementById('tabel-rekap-body');

        if (error || !data || data.length === 0) {
            narasiBox.innerText = "Belum ada ringkasan evaluasi untuk periode ini.";
            tabelBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#95a5a6;">Tidak ada data rekapitulasi.</td></tr>`;
            document.getElementById('stat-kepatuhan').innerText = "0%";
            renderComplianceChart([]);
            return;
        }

        tabelBody.innerHTML = "";

        // Kartu kepatuhan + narasi terbaru
        const terbaru = data[0];
        document.getElementById('stat-kepatuhan').innerText = `${terbaru.rata_rata_kepatuhan}%`;
        narasiBox.innerHTML = `<strong>Evaluasi Periode ${konversiBulan(terbaru.bulan)} ${terbaru.tahun}:</strong><br>${terbaru.narasi_kesimpulan}`;

        data.forEach(item => {
            const skor = item.rata_rata_kepatuhan;
            const badgeClass = skor >= 80 ? 'fit' : skor >= 60 ? 'catatan' : 'unfit';
            tabelBody.innerHTML += `
                <tr>
                    <td><strong>${konversiBulan(item.bulan)} ${item.tahun}</strong></td>
                    <td><span class="badge ${badgeClass}">${skor}%</span></td>
                    <td style="text-align:left;max-width:450px;font-size:14px;line-height:1.5;">
                        ${item.narasi_kesimpulan || '—'}
                    </td>
                </tr>`;
        });

        renderComplianceChart(data);

    } catch (err) {
        console.error("Gagal memuat rekap utama:", err);
    }
}

// ══════════════════════════════════════════════
//  CHART 1 – Tren Kepatuhan per Departemen (Line)
// ══════════════════════════════════════════════
function renderComplianceChart(dataRekap) {
    const ctx = document.getElementById('complianceChart').getContext('2d');
    if (complianceChartInstance) complianceChartInstance.destroy();

    const sorted = [...dataRekap].reverse();
    const labels = sorted.map(d => `${konversiBulan(d.bulan).substring(0,3)} ${d.tahun}`);
    const skorData = sorted.map(d => d.rata_rata_kepatuhan);

    // Garis target 80%
    const targetLine = Array(labels.length).fill(80);

    complianceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Tingkat Kepatuhan (%)',
                    data: skorData,
                    borderColor: '#1FA9E6',
                    backgroundColor: 'rgba(31,169,230,0.08)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#1FA9E6',
                },
                {
                    label: 'Target (80%)',
                    data: targetLine,
                    borderColor: '#e74c3c',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%`
                    }
                }
            },
            scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } }
        }
    });
}

// ══════════════════════════════════════════════
//  CHART 2 – Statistik Insiden (Bar, multi-mode)
// ══════════════════════════════════════════════
function renderIncidentChart(dataInsiden) {
    const ctx = document.getElementById('incidentChart').getContext('2d');
    if (incidentChartInstance) incidentChartInstance.destroy();

    const viewMode = document.getElementById('incident-view-mode').value;  // jenis | dept | bulan
    const yoy      = document.getElementById('incident-yoy').value === 'on';

    const COLORS = ['#0F3D56','#176C8C','#23A7C7','#e74c3c','#f39c12','#8e44ad','#27ae60'];

    if (yoy) {
        // ── Year-over-Year: dua dataset berdasar tahun ──
        const tahunList = [...new Set(dataInsiden.map(i => new Date(i.tgl).getFullYear()))].sort();
        const bulanLabels = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

        const datasets = tahunList.map((yr, idx) => {
            const counts = Array(12).fill(0);
            dataInsiden.filter(i => new Date(i.tgl).getFullYear() === yr)
                       .forEach(i => counts[new Date(i.tgl).getMonth()]++);
            return {
                label: String(yr),
                data: counts,
                backgroundColor: COLORS[idx % COLORS.length],
                borderRadius: 4,
                borderWidth: 0,
            };
        });

        incidentChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: bulanLabels, datasets },
            options: {
                responsive: true,
                plugins: { legend: { display: true, position: 'top' } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
        return;
    }

    // ── Mode tunggal: jenis / dept / bulan ──
    const summary = {};
    dataInsiden.forEach(i => {
        let key;
        if (viewMode === 'jenis') key = i.jenis || 'Lain-lain';
        else if (viewMode === 'dept') key = i.dept || 'Tidak Diketahui';
        else {
            const tgl = new Date(i.tgl);
            key = `${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][tgl.getMonth()]} ${tgl.getFullYear()}`;
        }
        summary[key] = (summary[key] || 0) + 1;
    });

    const labels = Object.keys(summary);
    const counts = Object.values(summary);

    incidentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Jumlah Insiden',
                data: counts,
                backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
                borderWidth: 0,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// ══════════════════════════════════════════════
//  CHART 3 – Status Dokumen K3 (Doughnut)
// ══════════════════════════════════════════════
async function muatStatusDokumen(katDok) {
    try {
        let query = client.from('dokumen_k3').select('status_dokumen');
        if (katDok !== 'All') query = query.eq('jenis_dokumen', katDok);

        const { data, error } = await query;
        if (error || !data) return;

        const summary = {};
        data.forEach(d => {
            const s = d.status_dokumen || 'Tidak Diketahui';
            summary[s] = (summary[s] || 0) + 1;
        });

        renderDocStatusChart(summary);
    } catch (err) {
        console.error("Gagal memuat status dokumen:", err);
    }
}

function renderDocStatusChart(summary) {
    const ctx = document.getElementById('docStatusChart').getContext('2d');
    if (docStatusChartInstance) docStatusChartInstance.destroy();

    const statusColor = {
        'Active'       : '#27ae60',
        'Aktif'        : '#27ae60',
        'Draft'        : '#3498db',
        'Under Review' : '#f39c12',
        'Expiring'     : '#e67e22',
        'Obsolete'     : '#95a5a6',
        'Tidak Diketahui': '#bdc3c7',
    };

    const labels = Object.keys(summary);
    const counts = Object.values(summary);
    const colors = labels.map(l => statusColor[l] || '#ccc');

    docStatusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff',
            }]
        },
        options: {
            responsive: true,
            cutout: '60%',
            plugins: {
                legend: { display: true, position: 'right' },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} dokumen`
                    }
                }
            }
        }
    });
}

// ══════════════════════════════════════════════
//  HEATMAP – Pengisian Formulir per Departemen
// ══════════════════════════════════════════════
async function muatHeatmapFormulir(jenisForm, tglAwal, tglAkhir) {
    try {
        // Tentukan 6 bulan terakhir sebagai kolom
        const today  = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
        }

        // Ambil semua form aktif (filter jenis)
        let qF = client.from('monitoring_forms').select('id, target_department, frequency').eq('status', 'Active');
        if (jenisForm !== 'All') qF = qF.eq('frequency', jenisForm);
        const { data: forms } = await qF;
        if (!forms || forms.length === 0) {
            document.getElementById('heatmap-container').innerHTML =
                '<p style="color:#95a5a6;font-size:13px;">Tidak ada formulir aktif.</p>';
            return;
        }

        // Ambil semua submission dalam 6 bulan terakhir
        const startDate = `${months[0].year}-${String(months[0].month).padStart(2,'0')}-01`;
        const { data: subs } = await client
            .from('monitoring_submissions')
            .select('form_id, department, submitted_at, status')
            .gte('submitted_at', startDate);

        // Bangun lookup: dept → set of "YYYY-MM" yang sudah submit
        const submittedMap = {}; // dept → Set<"YYYY-MM">
        DEPTS.forEach(d => submittedMap[d] = new Set());

        (subs || []).forEach(s => {
            const dept = s.department;
            if (!dept) return;
            const key = s.submitted_at ? s.submitted_at.substring(0,7) : null;
            if (key && submittedMap[dept]) submittedMap[dept].add(key);
        });

        // Hitung berapa form yang seharusnya diisi tiap dept tiap bulan
        const formsByDept = {};
        DEPTS.forEach(d => formsByDept[d] = 0);
        forms.forEach(f => {
            const dept = f.target_department;
            if (formsByDept[dept] !== undefined) formsByDept[dept]++;
        });

        // Render HTML grid
        const cols = months.length + 1; // +1 untuk kolom dept
        let html = `<div class="heatmap-grid" style="grid-template-columns: 110px ${months.map(() => '1fr').join(' ')};">`;

        // Header row
        html += `<div class="heatmap-cell label-dept" style="font-weight:700; font-size:12px;">Departemen</div>`;
        months.forEach(m => {
            html += `<div class="heatmap-cell label-month">${konversiBulan(m.month).substring(0,3)}<br>${m.year}</div>`;
        });

        // Data rows
        DEPTS.forEach(dept => {
            html += `<div class="heatmap-cell label-dept">${dept}</div>`;
            months.forEach(m => {
                const key = `${m.year}-${String(m.month).padStart(2,'0')}`;
                const submitted = submittedMap[dept] && submittedMap[dept].has(key);
                const totalForms = formsByDept[dept] || 0;

                let cls = 'na', label = '—';
                if (totalForms === 0) {
                    cls = 'na'; label = 'N/A';
                } else if (submitted) {
                    cls = 'submitted'; label = '✓';
                } else {
                    const isPast = (m.year < today.getFullYear()) || (m.year === today.getFullYear() && m.month < today.getMonth() + 1);
                    cls = isPast ? 'missed' : 'na';
                    label = isPast ? '✗' : '—';
                }
                html += `<div class="heatmap-cell ${cls}">${label}</div>`;
            });
        });

        html += `</div>`;
        document.getElementById('heatmap-container').innerHTML = html;

    } catch (err) {
        console.error("Gagal memuat heatmap:", err);
        document.getElementById('heatmap-container').innerHTML =
            '<p style="color:#e74c3c;font-size:13px;">Gagal memuat heatmap.</p>';
    }
}

// ══════════════════════════════════════════════
//  EKSPOR – PDF
// ══════════════════════════════════════════════
async function eksporPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Laporan Dashboard K3 – OTSUKA', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`, 14, 22);

    // KPI Summary
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Ringkasan KPI', 14, 32);

    const kpiRows = [
        ['Rata-rata Kepatuhan', document.getElementById('stat-kepatuhan').innerText],
        ['Formulir Terlambat',  document.getElementById('stat-overdue').innerText],
        ['Insiden Terbuka',     document.getElementById('stat-incidents').innerText],
        ['CAPA Terbuka',        document.getElementById('stat-capa').innerText],
        ['Dokumen Segera Kadaluarsa', document.getElementById('stat-dokumen-kadaluarsa').innerText],
        ['Safe Days (tanpa LTI)', document.getElementById('stat-safedays').innerText],
    ];

    doc.autoTable({
        startY: 36,
        head: [['Indikator', 'Nilai']],
        body: kpiRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 61, 86] },
        styles: { fontSize: 10 },
        margin: { left: 14 }
    });

    // Tabel rekap
    const rows = [];
    document.querySelectorAll('#tabel-rekap-body tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 3) {
            rows.push([
                cells[0].innerText,
                cells[1].innerText,
                cells[2].innerText,
            ]);
        }
    });

    if (rows.length > 0) {
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Bulan / Tahun', 'Kepatuhan', 'Narasi Evaluasi']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [15, 61, 86] },
            styles: { fontSize: 9, cellWidth: 'wrap' },
            columnStyles: { 2: { cellWidth: 150 } },
            margin: { left: 14 }
        });
    }

    doc.save(`Laporan_K3_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ══════════════════════════════════════════════
//  EKSPOR – Excel (.xlsx)
// ══════════════════════════════════════════════
function eksporExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: KPI
    const kpiData = [
        ['Indikator', 'Nilai'],
        ['Rata-rata Kepatuhan', document.getElementById('stat-kepatuhan').innerText],
        ['Formulir Terlambat',  document.getElementById('stat-overdue').innerText],
        ['Insiden Terbuka',     document.getElementById('stat-incidents').innerText],
        ['CAPA Terbuka',        document.getElementById('stat-capa').innerText],
        ['Dokumen Segera Kadaluarsa', document.getElementById('stat-dokumen-kadaluarsa').innerText],
        ['Safe Days (tanpa LTI)', document.getElementById('stat-safedays').innerText],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), 'KPI');

    // Sheet 2: Rekap Bulanan
    const rows = [['Bulan / Tahun', 'Kepatuhan (%)', 'Narasi Evaluasi']];
    document.querySelectorAll('#tabel-rekap-body tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 3) rows.push([cells[0].innerText, cells[1].innerText, cells[2].innerText]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Rekap Bulanan');

    XLSX.writeFile(wb, `Laporan_K3_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ══════════════════════════════════════════════
//  EKSPOR – CSV
// ══════════════════════════════════════════════
function eksporCSV() {
    const rows = [['Bulan / Tahun', 'Kepatuhan (%)', 'Narasi Evaluasi']];
    document.querySelectorAll('#tabel-rekap-body tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 3) rows.push([cells[0].innerText, cells[1].innerText, cells[2].innerText]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Laporan_K3_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}