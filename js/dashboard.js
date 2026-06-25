/**
 * dashboard.js
 * Alyfa Zahra – Backend & Dashboard Specialist
 * Updated: sesuai spesifikasi 6.5 Information Dashboard
 */

// ── Chart instances (destroy before re-render to avoid overlap) ──
let complianceChartInstance = null;
let incidentChartInstance = null;
let docStatusChartInstance = null;

// ── Supabase client alias ──
const client = typeof db !== 'undefined' ? db : supabase;

// ── Daftar departemen tetap (untuk heatmap) ──
const DEPTS = ['Produksi', 'QC', 'HRD', 'Engineering', 'Warehouse'];

// ── Nama bulan Indonesia ──
function konversiBulan(angkaBulan) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return namaBulan[angkaBulan - 1] || "—";
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    // Set default date range: awal tahun ini s/d hari ini
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), 0, 1);
    document.getElementById('filter-tgl-awal').value = firstDay.toISOString().split('T')[0];
    document.getElementById('filter-tgl-akhir').value = today.toISOString().split('T')[0];

    refreshDashboard();

    // Pasang event listener pada semua kontrol filter
    ['filter-dept', 'filter-tahun', 'filter-jenis-form',
        'filter-kategori-dok', 'filter-tgl-awal', 'filter-tgl-akhir'].forEach(id => {
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
    const dept = document.getElementById('filter-dept').value;
    const tahun = document.getElementById('filter-tahun').value;
    const jenisForm = document.getElementById('filter-jenis-form').value;
    const katDok = document.getElementById('filter-kategori-dok').value;
    const tglAwal = document.getElementById('filter-tgl-awal').value;
    const tglAkhir = document.getElementById('filter-tgl-akhir').value;

    // Semua dipanggil paralel untuk performa
    await Promise.allSettled([
        hitungFormulirOverdue(dept, jenisForm, tglAwal, tglAkhir),
        hitungDokumenKadaluarsa(katDok),
        hitungInsidenDanCapa(dept, tglAwal, tglAkhir),
        hitungSafeDays(),
        hitungTotalKaryawanDept(),
        muatDataRekapUtama(tahun),
        muatTrenKepatuhanPerDepartemen(tahun),
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
        if (dept !== 'All') qForms = qForms.eq('target_department', dept);

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
        if (tglAwal) qSubs = qSubs.gte('submitted_at', tglAwal);
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
        const today = new Date();
        const in30 = new Date(); in30.setDate(today.getDate() + 30);

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
        if (tglAwal) qInsiden = qInsiden.gte('tgl', tglAwal);
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
        const openCapa = (capaData || []).filter(c => c.status_capa === 'Open').length;
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
            const lastLTI = new Date(data[0].tgl);
            const diff = Math.floor((new Date() - lastLTI) / 86400000);
            document.getElementById('stat-safedays').innerText = `${diff} Hari`;
        } else {
            document.getElementById('stat-safedays').innerText = "365+ Hari";
        }
    } catch (err) {
        console.error("Gagal menghitung Safe Days:", err);
    }
}

// ══════════════════════════════════════════════
//  KPI 7 & 8 – Total Karyawan & Total Departemen
// ══════════════════════════════════════════════
async function hitungTotalKaryawanDept() {
    try {
        // Total karyawan (hitung jumlah baris, tanpa perlu ambil semua datanya)
        const { count: totalKaryawan, error: errKaryawan } = await client
            .from('karyawan')
            .select('*', { count: 'exact', head: true });

        document.getElementById('stat-total-karyawan').innerText =
            !errKaryawan && totalKaryawan !== null ? totalKaryawan : 0;

        // Total departemen = jumlah departemen unik yang benar-benar punya karyawan
        const { data: dataDept, error: errDept } = await client
            .from('karyawan')
            .select('departemen');

        if (!errDept && dataDept) {
            const deptUnik = new Set(
                dataDept
                    .map(d => (d.departemen || '').trim())
                    .filter(d => d.length > 0)
            );
            document.getElementById('stat-total-departemen').innerText = deptUnik.size;
        } else {
            document.getElementById('stat-total-departemen').innerText = 0;
        }
    } catch (err) {
        console.error("Gagal menghitung Total Karyawan/Departemen:", err);
    }
}

// ══════════════════════════════════════════════
//  HELPER – Format Narasi jadi Paragraf Rapi
// ══════════════════════════════════════════════
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

// Memecah teks narasi (dipisah baris kosong) menjadi beberapa <p> rapi,
// alih-alih ditampilkan menumpuk jadi satu paragraf.
function formatNarasiParagraf(narasiText) {
    if (!narasiText || !narasiText.trim()) {
        return '<p style="color:#95a5a6; margin:0;">Belum ada narasi untuk periode ini.</p>';
    }
    const paragraf = narasiText
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (paragraf.length === 0) {
        return `<p style="margin:0; line-height:1.8;">${escapeHtml(narasiText)}</p>`;
    }

    return paragraf
        .map(p => `<p style="margin:0 0 14px 0; line-height:1.8; text-align:justify;">${escapeHtml(p)}</p>`)
        .join('');
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
            return;
        }

        tabelBody.innerHTML = "";

        // Simpan data rekap secara global agar bisa dipakai oleh modal detail & ekspor
        window._rekapData = data;

        // Kartu kepatuhan + narasi terbaru (tampil sebagai paragraf rapi, bukan satu blok teks)
        const terbaru = data[0];
        document.getElementById('stat-kepatuhan').innerText = `${terbaru.rata_rata_kepatuhan}%`;
        narasiBox.innerHTML = `
            <strong>Evaluasi Periode ${konversiBulan(terbaru.bulan)} ${terbaru.tahun}:</strong>
            <div style="margin-top:8px;">${formatNarasiParagraf(terbaru.narasi_kesimpulan)}</div>`;

        data.forEach((item, idx) => {
            const skor = item.rata_rata_kepatuhan;
            const badgeClass = skor >= 80 ? 'fit' : skor >= 60 ? 'catatan' : 'unfit';

            const tr = document.createElement('tr');

            const tdBulan = document.createElement('td');
            tdBulan.innerHTML = `<strong>${konversiBulan(item.bulan)} ${item.tahun}</strong>`;

            const tdSkor = document.createElement('td');
            tdSkor.innerHTML = `<span class="badge ${badgeClass}">${skor}%</span>`;

            const tdNarasi = document.createElement('td');
            tdNarasi.style.textAlign = 'center';
            const btnDetail = document.createElement('button');
            btnDetail.type = 'button';
            btnDetail.className = 'btn-lihat-narasi';
            btnDetail.innerHTML = '📄 Lihat Narasi Detail';
            btnDetail.addEventListener('click', () => bukaModalNarasi(idx));
            tdNarasi.appendChild(btnDetail);

            tr.append(tdBulan, tdSkor, tdNarasi);
            tabelBody.appendChild(tr);
        });

    } catch (err) {
        console.error("Gagal memuat rekap utama:", err);
    }
}

// ══════════════════════════════════════════════
//  MODAL – Lihat Narasi Detail (dari tabel rekap)
// ══════════════════════════════════════════════
function bukaModalNarasi(idx) {
    const item = (window._rekapData || [])[idx];
    if (!item) return;

    document.getElementById('modal-narasi-judul').innerText =
        `📋 Narasi Evaluasi — ${konversiBulan(item.bulan)} ${item.tahun}`;
    document.getElementById('modal-narasi-skor').innerText =
        item.rata_rata_kepatuhan !== null && item.rata_rata_kepatuhan !== undefined
            ? `Rata-rata Kepatuhan: ${item.rata_rata_kepatuhan}%`
            : '';
    document.getElementById('modal-narasi-body').innerHTML = formatNarasiParagraf(item.narasi_kesimpulan);

    document.getElementById('modal-narasi-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function tutupModalNarasi() {
    document.getElementById('modal-narasi-overlay').style.display = 'none';
    document.body.style.overflow = '';
}

// Tutup modal dengan tombol Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('modal-narasi-overlay');
        if (overlay && overlay.style.display === 'flex') tutupModalNarasi();
    }
});

// ══════════════════════════════════════════════
//  CHART 1 – Tren Kepatuhan per Departemen (Line)
//  Dihitung LANGSUNG dari data Pelaksanaan SOP (pelaksanaan_k3),
//  bukan dari kesimpulan_rekap — sehingga betul-betul per departemen.
// ══════════════════════════════════════════════
const DEPT_COLORS = {
    'Produksi': '#1FA9E6',
    'QC': '#27ae60',
    'HRD': '#9b59b6',
    'Engineering': '#f39c12',
    'Warehouse': '#e74c3c',
};
const DEPT_COLOR_FALLBACK = ['#16a085', '#d35400', '#2c3e50', '#c0392b', '#8e44ad'];

async function muatTrenKepatuhanPerDepartemen(tahun) {
    try {
        // 1. Ambil jumlah form aktif sebagai dasar target per departemen
        const { data: forms } = await client.from('monitoring_forms').select('id').eq('status', 'Active');
        const totalForms = (forms || []).length;

        // 2. Ambil data submission
        let query = client.from('monitoring_submissions').select('submitted_at, department');
        if (tahun !== 'All') {
            query = query.gte('submitted_at', `${tahun}-01-01`).lte('submitted_at', `${tahun}-12-31T23:59:59`);
        }

        const { data, error } = await query;
        if (error || !data || totalForms === 0) {
            renderComplianceChart([], [], {});
            return;
        }

        // 3. Kelompokkan jumlah submission per bulan (YYYY-MM) per departemen
        const groupedCount = {};
        data.forEach(row => {
            if (!row.submitted_at) return;
            const d = new Date(row.submitted_at);
            if (Number.isNaN(d.getTime())) return;

            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const dept = (row.department || 'Umum').trim();

            if (!groupedCount[key]) {
                groupedCount[key] = {};
                DEPTS.forEach(dep => groupedCount[key][dep] = 0);
            }
            if (groupedCount[key][dept] !== undefined) {
                groupedCount[key][dept]++;
            } else {
                groupedCount[key][dept] = 1; // Jika ada dept lain yg tidak terdaftar
            }
        });

        // 4. Ubah jumlah (count) menjadi persentase compliance rate
        const grouped = {};
        const monthKeys = Object.keys(groupedCount).sort();

        monthKeys.forEach(key => {
            grouped[key] = {};
            Object.keys(groupedCount[key]).forEach(dept => {
                const count = groupedCount[key][dept];
                // Rumus = (Total Submisi Dept / Total Form) * 100
                const percentage = Math.min(Math.round((count / totalForms) * 100), 100);
                grouped[key][dept] = [percentage]; // Dibungkus array agar terbaca oleh helper chart
            });
        });

        // 5. Urutkan label bulan
        const labels = monthKeys.map(key => {
            const [y, m] = key.split('-');
            return `${konversiBulan(parseInt(m)).substring(0, 3)} ${y}`;
        });

        renderComplianceChart(monthKeys, labels, grouped);

    } catch (err) {
        console.error("Gagal memuat tren kepatuhan per departemen:", err);
    }
}

function renderComplianceChart(monthKeys, labels, grouped) {
    const ctx = document.getElementById('complianceChart').getContext('2d');
    if (complianceChartInstance) complianceChartInstance.destroy();

    if (!monthKeys || monthKeys.length === 0) {
        complianceChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: { responsive: true }
        });
        return;
    }

    // Gabungkan daftar departemen tetap dengan departemen apa pun yang
    // benar-benar muncul di data (supaya tidak ada data yang terlewat).
    const deptSet = new Set(DEPTS);
    monthKeys.forEach(key => Object.keys(grouped[key]).forEach(d => deptSet.add(d)));

    const datasets = Array.from(deptSet).map((dept, i) => {
        const data = monthKeys.map(key => {
            const skors = grouped[key] && grouped[key][dept];
            if (!skors || skors.length === 0) return null; // null = celah di garis, bukan 0%
            return Math.round(skors.reduce((a, b) => a + b, 0) / skors.length);
        });
        const color = DEPT_COLORS[dept] || DEPT_COLOR_FALLBACK[i % DEPT_COLOR_FALLBACK.length];

        return {
            label: dept,
            data,
            borderColor: color,
            backgroundColor: color + '22',
            borderWidth: 2.5,
            tension: 0.3,
            spanGaps: true,
            pointRadius: 3,
            pointBackgroundColor: color,
        };
    });

    // Garis target 80%
    datasets.push({
        label: 'Target (80%)',
        data: Array(labels.length).fill(80),
        borderColor: '#7f8c8d',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
    });

    complianceChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y === null ? 'Tidak ada data' : ctx.parsed.y + '%'}`
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
    const yoy = document.getElementById('incident-yoy').value === 'on';

    const COLORS = ['#0F3D56', '#176C8C', '#23A7C7', '#e74c3c', '#f39c12', '#8e44ad', '#27ae60'];

    if (yoy) {
        // ── Year-over-Year: dua dataset berdasar tahun ──
        const tahunList = [...new Set(dataInsiden.map(i => new Date(i.tgl).getFullYear()))].sort();
        const bulanLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

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
            key = `${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][tgl.getMonth()]} ${tgl.getFullYear()}`;
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
        'Active': '#27ae60',
        'Aktif': '#27ae60',
        'Draft': '#3498db',
        'Under Review': '#f39c12',
        'Expiring': '#e67e22',
        'Obsolete': '#95a5a6',
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
        const today = new Date();
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
        const startDate = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`;
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
            const key = s.submitted_at ? s.submitted_at.substring(0, 7) : null;
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
            html += `<div class="heatmap-cell label-month">${konversiBulan(m.month).substring(0, 3)}<br>${m.year}</div>`;
        });

        // Data rows
        DEPTS.forEach(dept => {
            html += `<div class="heatmap-cell label-dept">${dept}</div>`;
            months.forEach(m => {
                const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
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
        ['Formulir Terlambat', document.getElementById('stat-overdue').innerText],
        ['Insiden Terbuka', document.getElementById('stat-incidents').innerText],
        ['CAPA Terbuka', document.getElementById('stat-capa').innerText],
        ['Dokumen Segera Kadaluarsa', document.getElementById('stat-dokumen-kadaluarsa').innerText],
        ['Safe Days (tanpa LTI)', document.getElementById('stat-safedays').innerText],
        ['Total Karyawan', document.getElementById('stat-total-karyawan').innerText],
        ['Total Departemen', document.getElementById('stat-total-departemen').innerText],
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

    // Tabel rekap (ambil narasi lengkap dari data, bukan dari tombol "Lihat Narasi Detail")
    const rows = (window._rekapData || []).map(item => [
        `${konversiBulan(item.bulan)} ${item.tahun}`,
        `${item.rata_rata_kepatuhan}%`,
        item.narasi_kesimpulan || '—',
    ]);

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
        ['Formulir Terlambat', document.getElementById('stat-overdue').innerText],
        ['Insiden Terbuka', document.getElementById('stat-incidents').innerText],
        ['CAPA Terbuka', document.getElementById('stat-capa').innerText],
        ['Dokumen Segera Kadaluarsa', document.getElementById('stat-dokumen-kadaluarsa').innerText],
        ['Safe Days (tanpa LTI)', document.getElementById('stat-safedays').innerText],
        ['Total Karyawan', document.getElementById('stat-total-karyawan').innerText],
        ['Total Departemen', document.getElementById('stat-total-departemen').innerText],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), 'KPI');

    // Sheet 2: Rekap Bulanan (narasi lengkap dari data, bukan dari tombol)
    const rows = [['Bulan / Tahun', 'Kepatuhan (%)', 'Narasi Evaluasi']];
    (window._rekapData || []).forEach(item => {
        rows.push([
            `${konversiBulan(item.bulan)} ${item.tahun}`,
            item.rata_rata_kepatuhan,
            item.narasi_kesimpulan || '—',
        ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Rekap Bulanan');

    XLSX.writeFile(wb, `Laporan_K3_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ══════════════════════════════════════════════
//  EKSPOR – CSV
// ══════════════════════════════════════════════
function eksporCSV() {
    const rows = [['Bulan / Tahun', 'Kepatuhan (%)', 'Narasi Evaluasi']];
    (window._rekapData || []).forEach(item => {
        rows.push([
            `${konversiBulan(item.bulan)} ${item.tahun}`,
            item.rata_rata_kepatuhan,
            item.narasi_kesimpulan || '—',
        ]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_K3_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
//  GENERATE NARASI OTOMATIS (Gratis, Tanpa API)
// ══════════════════════════════════════════════

function bukaGenerateNarasi() {
    // Set default ke bulan sekarang
    const now = new Date();
    document.getElementById('gen-bulan').value = now.getMonth() + 1;
    document.getElementById('gen-tahun').value = now.getFullYear();
    document.getElementById('panel-generate').style.display = 'block';
    document.getElementById('gen-status').style.display = 'none';
    document.getElementById('gen-preview-wrap').style.display = 'none';
    document.getElementById('panel-generate').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function tutupGenerateNarasi() {
    document.getElementById('panel-generate').style.display = 'none';
}

function setGenStatus(type, msg) {
    const el = document.getElementById('gen-status');
    const warna = { info: '#e8f4fd', success: '#d4edda', error: '#f8d7da' };
    const teks = { info: '#1FA9E6', success: '#155724', error: '#721c24' };
    el.style.display = 'block';
    el.style.background = warna[type];
    el.style.color = teks[type];
    el.innerText = msg;
}

async function generateNarasiOtomatis() {
    const bulan = parseInt(document.getElementById('gen-bulan').value);
    const tahun = parseInt(document.getElementById('gen-tahun').value);

    setGenStatus('info', '⏳ Mengambil data KPI dari database…');
    document.getElementById('gen-preview-wrap').style.display = 'none';

    try {
        const tglAwal = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
        const tglAkhir = new Date(tahun, bulan, 0).toISOString().split('T')[0];
        const now = new Date();

        // Tarik semua data yang dibutuhkan secara paralel (resPelaksanaan dihapus)
        const [
            resInsiden,
            resCapa,
            resTemuan,
            resForms,
            resSubs,
            resDokExp,
        ] = await Promise.all([
            client.from('incidents').select('jenis, status, keparahan, dept').gte('tgl', tglAwal).lte('tgl', tglAkhir),
            client.from('capa_items').select('status_capa'),
            client.from('temuan_audit').select('status_perbaikan'),
            client.from('monitoring_forms').select('id, target_department').eq('status', 'Active'),
            client.from('monitoring_submissions').select('form_id, department').gte('submitted_at', tglAwal + 'T00:00:00').lte('submitted_at', tglAkhir + 'T23:59:59'),
            client.from('dokumen_k3').select('id', { count: 'exact', head: true }).gte('tanggal_review', now.toISOString().split('T')[0]).lte('tanggal_review', new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]),
        ]);

        // ── Kalkulasi KPI ──
        const dataInsiden = resInsiden.data || [];
        const totalInsiden = dataInsiden.length;
        const insidenOpen = dataInsiden.filter(i => i.status !== 'Closed').length;
        const openCapa = (resCapa.data || []).filter(c => c.status_capa === 'Open').length;
        const openTemuan = (resTemuan.data || []).filter(t => t.status_perbaikan === 'Open').length;
        const totalCapa = openCapa + openTemuan;
        const dokExp = resDokExp.count || 0;

        // ── Kepatuhan Baru (Mirip dengan compliance_report.js) ──
        const dataForms = resForms.data || [];
        const dataSubs = resSubs.data || [];
        const totalForms = dataForms.length;
        const expectedSubmissions = totalForms * DEPTS.length;

        // Rata-rata kepatuhan bulan terkait:
        const rataKepatuhan = expectedSubmissions > 0
            ? Math.min(Math.round((dataSubs.length / expectedSubmissions) * 100), 100)
            : 0;

        // Kepatuhan per departemen (ambil 2 terbaik & terburuk)
        const deptSubCounts = {};
        DEPTS.forEach(d => deptSubCounts[d] = 0);
        dataSubs.forEach(s => {
            const d = s.department;
            if (deptSubCounts[d] !== undefined) deptSubCounts[d]++;
        });

        const deptRata = Object.entries(deptSubCounts).map(([dept, count]) => {
            const rata = totalForms > 0 ? Math.min(Math.round((count / totalForms) * 100), 100) : 0;
            return { dept, rata };
        }).sort((a, b) => b.rata - a.rata);

        // Overdue forms
        const submittedIds = new Set((resSubs.data || []).map(s => s.form_id));
        const overdue = (resForms.data || []).filter(f => !submittedIds.has(f.id)).length;

        // Jenis insiden terbanyak
        const insidenJenis = {};
        dataInsiden.forEach(i => {
            const j = i.jenis || 'Lain-lain';
            insidenJenis[j] = (insidenJenis[j] || 0) + 1;
        });
        const topJenis = Object.entries(insidenJenis).sort((a, b) => b[1] - a[1]).slice(0, 2);

        setGenStatus('info', '✍️ Menyusun narasi evaluasi…');

        // ── Susun Narasi dari Template Cerdas ──
        const narasi = susunNarasi({
            bulan, tahun, rataKepatuhan,
            totalInsiden, insidenOpen, topJenis,
            totalCapa, overdue, dokExp, deptRata
        });

        document.getElementById('gen-narasi-text').value = narasi;
        document.getElementById('gen-preview-wrap').style.display = 'block';
        setGenStatus('success', '✅ Narasi berhasil dibuat. Periksa, edit jika perlu, lalu simpan.');

        // Simpan kpiData untuk dipakai saat simpan
        window._genKPI = { bulan, tahun, rataKepatuhan };

    } catch (err) {
        console.error(err);
        setGenStatus('error', '❌ Gagal mengambil data: ' + err.message);
    }
}

/**
 * Menyusun narasi evaluasi profesional berdasarkan data KPI
 * menggunakan template kondisional — gratis, tanpa API eksternal
 */
function susunNarasi({ bulan, tahun, rataKepatuhan, totalInsiden, insidenOpen,
    topJenis, totalCapa, overdue, dokExp, deptRata }) {
    const bln = konversiBulan(bulan);
    const rata = rataKepatuhan !== null ? rataKepatuhan : 0;

    // ── Paragraf 1: Penilaian kepatuhan keseluruhan ──
    let p1 = '';
    if (rata >= 85) {
        p1 = `Pada periode ${bln} ${tahun}, kinerja Keselamatan dan Kesehatan Kerja (K3) perusahaan menunjukkan hasil yang sangat memuaskan dengan rata-rata tingkat kepatuhan mencapai ${rata}%. ` +
            `Pencapaian ini mencerminkan komitmen seluruh elemen organisasi dalam menerapkan standar K3 secara konsisten dan menyeluruh.`;
    } else if (rata >= 70) {
        p1 = `Pada periode ${bln} ${tahun}, kinerja K3 perusahaan berada pada level yang cukup baik dengan rata-rata tingkat kepatuhan sebesar ${rata}%. ` +
            `Meskipun hasil ini masih di atas ambang batas minimal, terdapat sejumlah area yang masih memerlukan perhatian dan peningkatan lebih lanjut.`;
    } else if (rata > 0) {
        p1 = `Pada periode ${bln} ${tahun}, kinerja K3 perusahaan perlu mendapat perhatian serius dengan rata-rata tingkat kepatuhan hanya mencapai ${rata}%, ` +
            `di bawah target minimum yang ditetapkan. Kondisi ini memerlukan evaluasi menyeluruh dan tindakan korektif segera dari semua pihak terkait.`;
    } else {
        p1 = `Pada periode ${bln} ${tahun}, data kepatuhan K3 belum tersedia secara lengkap. ` +
            `Diperlukan pengisian data pelaksanaan inspeksi secara konsisten agar evaluasi dapat dilakukan secara akurat.`;
    }

    // ── Paragraf 2: Insiden & CAPA ──
    let p2 = '';
    if (totalInsiden === 0) {
        p2 = `Selama periode ini, tidak terdapat insiden K3 yang tercatat, yang merupakan pencapaian positif yang perlu dipertahankan. `;
    } else {
        const jenisText = topJenis.length > 0
            ? `dengan jenis terbanyak adalah ${topJenis.map(([j, c]) => `${j} (${c} kasus)`).join(' dan ')}`
            : '';
        p2 = `Selama periode ${bln} ${tahun}, tercatat sebanyak ${totalInsiden} insiden K3 ${jenisText}. ` +
            (insidenOpen > 0
                ? `Dari total insiden tersebut, ${insidenOpen} insiden masih berstatus terbuka (Open) dan memerlukan tindak lanjut segera. `
                : `Seluruh insiden yang terjadi telah berhasil ditangani dan ditutup dalam periode yang sama. `);
    }

    if (totalCapa > 0) {
        p2 += `Terdapat ${totalCapa} item CAPA (Corrective and Preventive Action) yang masih terbuka, ` +
            `yang perlu diselesaikan sesuai target waktu yang ditetapkan untuk mencegah potensi risiko berulang.`;
    } else {
        p2 += `Seluruh temuan CAPA dari periode sebelumnya telah berhasil ditutup, mencerminkan responsivitas tim K3 dalam menangani temuan audit.`;
    }

    // ── Paragraf 3: Departemen & Formulir ──
    let p3 = '';
    if (deptRata.length > 0) {
        const terbaik = deptRata[0];
        const terburuk = deptRata[deptRata.length - 1];
        if (deptRata.length > 1 && terbaik.dept !== terburuk.dept) {
            p3 = `Dari sisi kinerja per departemen, ${terbaik.dept} mencatat kepatuhan tertinggi sebesar ${terbaik.rata}%, ` +
                `sementara ${terburuk.dept} perlu mendapat perhatian khusus dengan kepatuhan sebesar ${terburuk.rata}%. `;
        } else {
            p3 = `Departemen ${terbaik.dept} mencatat kepatuhan sebesar ${terbaik.rata}% pada periode ini. `;
        }
    }

    if (overdue > 0) {
        p3 += `Sebanyak ${overdue} formulir monitoring belum diselesaikan tepat waktu, ` +
            `yang mengindikasikan perlunya peningkatan kedisiplinan dalam pengisian laporan rutin K3.`;
    } else {
        p3 += `Seluruh formulir monitoring berhasil diselesaikan tepat waktu, menunjukkan kedisiplinan yang baik dari seluruh petugas K3.`;
    }

    // ── Paragraf 4: Rekomendasi ──
    const rekoms = [];
    if (rata < 80 && rata > 0) rekoms.push(`meningkatkan konsistensi pelaksanaan inspeksi K3 harian di seluruh departemen guna mendorong kepatuhan di atas 80%`);
    if (insidenOpen > 0) rekoms.push(`mempercepat penyelesaian ${insidenOpen} insiden yang masih berstatus Open dengan menetapkan PIC dan target waktu yang jelas`);
    if (totalCapa > 0) rekoms.push(`memantau dan menyelesaikan ${totalCapa} item CAPA yang masih terbuka sesuai rencana tindakan korektif`);
    if (overdue > 0) rekoms.push(`memastikan pengisian ${overdue} formulir monitoring yang terlambat segera diselesaikan dan mencegah keterlambatan serupa di bulan berikutnya`);
    if (dokExp > 0) rekoms.push(`melakukan review terhadap ${dokExp} dokumen K3 yang akan segera kadaluarsa agar dokumen tetap valid dan berlaku`);
    if (rekoms.length === 0) rekoms.push(`mempertahankan capaian positif ini dan terus meningkatkan budaya K3 di seluruh lini organisasi`);

    const p4 = `Berdasarkan evaluasi menyeluruh periode ${bln} ${tahun}, tindakan prioritas yang perlu segera diambil antara lain: ` +
        rekoms.slice(0, 3).join('; ') +
        `. Pemantauan berkelanjutan dan komunikasi rutin antar departemen menjadi kunci keberhasilan implementasi K3 yang optimal di periode mendatang.`;

    return [p1, p2, p3, p4].filter(Boolean).join('\n\n');
}

async function simpanNarasiKeDB() {
    const narasi = document.getElementById('gen-narasi-text').value.trim();
    const kpi = window._genKPI;

    if (!narasi || !kpi) return;

    const btn = document.querySelector('#gen-preview-wrap button');

    const setS = (type, msg) => {
        const el = document.getElementById('gen-simpan-status');
        const w = { info: '#e8f4fd', success: '#d4edda', error: '#f8d7da' };
        const t = { info: '#1FA9E6', success: '#155724', error: '#721c24' };
        el.style.display = 'block';
        el.style.background = w[type];
        el.style.color = t[type];
        el.innerText = msg;
    };

    setS('info', '⏳ Menyimpan ke database…');

    try {
        // Cek apakah sudah ada data bulan ini
        const { data: existing } = await client
            .from('kesimpulan_rekap')
            .select('id')
            .eq('bulan', kpi.bulan)
            .eq('tahun', kpi.tahun)
            .maybeSingle();

        let error;
        if (existing) {
            ({ error } = await client.from('kesimpulan_rekap')
                .update({ rata_rata_kepatuhan: kpi.rataKepatuhan, narasi_kesimpulan: narasi })
                .eq('id', existing.id));
        } else {
            ({ error } = await client.from('kesimpulan_rekap')
                .insert({ bulan: kpi.bulan, tahun: kpi.tahun, rata_rata_kepatuhan: kpi.rataKepatuhan, narasi_kesimpulan: narasi }));
        }

        if (error) throw error;

        setS('success', `✅ Narasi ${konversiBulan(kpi.bulan)} ${kpi.tahun} berhasil disimpan! Dashboard diperbarui…`);

        // Refresh tampilan dashboard otomatis
        setTimeout(() => {
            tutupGenerateNarasi();
            muatDataRekapUtama(document.getElementById('filter-tahun').value);
        }, 1500);

    } catch (err) {
        setS('error', '❌ Gagal menyimpan: ' + err.message);
    }
}