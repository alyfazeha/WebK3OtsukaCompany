/**
 * dashboard.js
 * Alyfa Zahra – Backend & Dashboard Specialist
 */

// Instansiasi variabel penampung grafik agar tidak terjadi tumpang tindih (overlap) saat filter diubah
let complianceChartInstance = null;
let incidentChartInstance = null;

// Mengamankan pemanggilan objek Supabase (mendukung instansiasi 'db' maupun 'supabase')
const client = typeof db !== 'undefined' ? db : supabase;

document.addEventListener("DOMContentLoaded", () => {
    // Jalankan kalkulasi data pertama kali saat halaman selesai dimuat
    refreshDashboard();

    // Pasang event listener interaktif pada elemen filter
    document.getElementById('filter-dept').addEventListener('change', refreshDashboard);
    document.getElementById('filter-tahun').addEventListener('change', refreshDashboard);
});

/**
 * Fungsi utama memicu pembaruan seluruh komponen dashboard berdasarkan filter aktif
 */
async function refreshDashboard() {
    const deptSelected = document.getElementById('filter-dept').value;
    const tahunSelected = document.getElementById('filter-tahun').value;

    // Eksekusi penarikan data secara paralel untuk performa optimal
    hitungTotalKaryawan(deptSelected);
    hitungTotalDokumen();
    hitungInsidenDanCapa(deptSelected);
    hitungSafeDays();
    muatDataRekapUtama(tahunSelected);
}

// 1. Mengambil jumlah total karyawan (Bisa difilter per departemen)
async function hitungTotalKaryawan(dept) {
    try {
        let query = client.from('karyawan').select('*', { count: 'exact', head: true });
        
        if (dept !== 'All') {
            query = query.eq('departemen', dept);
        }

        const { count, error } = await query;
        if (!error && count !== null) {
            document.getElementById('stat-karyawan').innerText = count;
        }
    } catch (err) {
        console.error("Gagal memuat total karyawan:", err);
    }
}

// 2. Mengambil jumlah total berkas regulasi & SOP K3
async function hitungTotalDokumen() {
    try {
        const { count, error } = await client
            .from('dokumen_k3')
            .select('*', { count: 'exact', head: true });

        if (!error && count !== null) {
            document.getElementById('stat-dokumen').innerText = count;
        }
    } catch (err) {
        console.error("Gagal memuat total dokumen:", err);
    }
}

// 3. Mengambil metrik Insiden Aktif (Open) & Temuan CAPA Terbuka dari Audit
async function hitungInsidenDanCapa(dept) {
    try {
        // A. Penghitungan Insiden Aktif
        let queryInsiden = client.from('insiden_k3').select('jenis, status');
        if (dept !== 'All') {
            queryInsiden = queryInsiden.eq('dept', dept);
        }
        
        const { data: dataInsiden, error: errInsiden } = await queryInsiden;
        
        if (!errInsiden && dataInsiden) {
            const openInsiden = dataInsiden.filter(i => i.status !== 'Closed').length;
            document.getElementById('stat-incidents').innerText = openInsiden;
            
            // Proses pembentukan visualisasi grafik kategori insiden
            renderIncidentChart(dataInsiden);
        }

        // B. Penghitungan Temuan CAPA (Audit Findings) berstatus 'Open'
        const { data: dataCapa, error: errCapa } = await client
            .from('temuan_audit')
            .select('status_perbaikan');

        if (!errCapa && dataCapa) {
            const openCapa = dataCapa.filter(c => c.status_perbaikan === 'Open').length;
            document.getElementById('stat-capa').innerText = openCapa;
        }

    } catch (err) {
        console.error("Gagal memuat data insiden/CAPA:", err);
    }
}

// 4. Kalkulasi otomatis 'Safe Days Counter' sejak kecelakaan kerja terakhir
async function hitungSafeDays() {
    try {
        const { data, error } = await client
            .from('insiden_k3')
            .select('tgl')
            .order('tgl', { ascending: false })
            .limit(1);

        if (!error && data && data.length > 0 && data[0].tgl) {
            const tglInsidenTerakhir = new Date(data[0].tgl);
            const tglHariIni = new Date();
            
            const selisihWaktu = Math.abs(tglHariIni - tglInsidenTerakhir);
            const selisihHari = Math.floor(selisihWaktu / (1000 * 60 * 60 * 24));
            
            document.getElementById('stat-safedays').innerText = `${selisihHari} Hari`;
        } else {
            // Jika tidak ada rekam jejak insiden, set performa maksimal default
            document.getElementById('stat-safedays').innerText = "365+ Hari";
        }
    } catch (err) {
        console.error("Gagal menghitung Safe Days:", err);
    }
}

// 5. Memuat tabel riwayat bulanan, persentase kepatuhan, & narasi AI otomatis
async function muatDataRekapUtama(tahun) {
    try {
        let query = client.from('kesimpulan_rekap').select('*').order('tahun', { ascending: false }).order('bulan', { ascending: false });

        if (tahun !== 'All') {
            query = query.eq('tahun', parseInt(tahun));
        }

        const { data, error } = await query;
        const narasiBox = document.getElementById('narasi-box');
        const tabelBody = document.getElementById('tabel-rekap-body');

        if (error || !data || data.length === 0) {
            narasiBox.innerText = "Belum ada ringkasan evaluasi untuk periode ini.";
            tabelBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#95a5a6;">Tidak ada data rekapitulasi.</td></tr>`;
            document.getElementById('stat-kepatuhan').innerText = "0%";
            renderComplianceChart([]);
            return;
        }

        tabelBody.innerHTML = "";

        // A. Perbarui Tampilan Ringkasan Utama berdasarkan data paling aktual (Indeks 0)
        const dataTerbaru = data[0];
        document.getElementById('stat-kepatuhan').innerText = `${dataTerbaru.rata_rata_kepatuhan}%`;
        narasiBox.innerHTML = `<strong>Evaluasi Periode ${konversiBulan(dataTerbaru.bulan)} ${dataTerbaru.tahun}:</strong><br>${dataTerbaru.narasi_kesimpulan}`;

        // B. Looping untuk menampilkan seluruh riwayat ke dalam tabel HTML
        data.forEach(item => {
            let badgeClass = "unfit"; // Skor < 60%
            if (item.rata_rata_kepatuhan >= 80) {
                badgeClass = "fit"; // Aman / Bagus
            } else if (item.rata_rata_kepatuhan >= 60) {
                badgeClass = "catatan"; // Peringatan / Cukup
            }

            const row = `
                <tr>
                    <td><strong>${konversiBulan(item.bulan)} ${item.tahun}</strong></td>
                    <td><span class="badge ${badgeClass}">${item.rata_rata_kepatuhan}%</span></td>
                    <td style="text-align: left; max-width: 450px; font-size: 14px; line-height: 1.5;">
                        ${item.narasi_kesimpulan || '-'}
                    </td>
                </tr>
            `;
            tabelBody.innerHTML += row;
        });

        // C. Render grafik tren kepatuhan dari database rekap bulanan
        renderComplianceChart(data);

    } catch (err) {
        console.error("Gagal memuat rekap utama:", err);
    }
}

/**
 * RENDER CHART: Tren Kepatuhan Bulanan (Line Chart)
 */
function renderComplianceChart(dataRekap) {
    const ctx = document.getElementById('complianceChart').getContext('2d');
    
    // Hancurkan instansiasi grafik lama jika ada perubahan filter untuk menghindari malfungsi rendering
    if (complianceChartInstance) {
        complianceChartInstance.destroy();
    }

    // Urutkan data secara kronologis (dari bulan terlama ke terbaru) untuk grafik tren
    const dataSorted = [...dataRekap].reverse();
    const labels = dataSorted.map(d => `${konversiBulan(d.bulan).substring(0,3)} ${d.tahun}`);
    const skorData = dataSorted.map(d => d.rata_rata_kepatuhan);

    complianceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tingkat Kepatuhan (%)',
                data: skorData,
                borderColor: '#1FA9E6',
                backgroundColor: 'rgba(31, 169, 230, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: 0, max: 100 } }
        }
    });
}

/**
 * RENDER CHART: Kategori Distribusi Insiden (Bar Chart)
 */
function renderIncidentChart(dataInsiden) {
    const ctx = document.getElementById('incidentChart').getContext('2d');
    
    if (incidentChartInstance) {
        incidentChartInstance.destroy();
    }

    // Mengelompokkan & menghitung total akumulasi frekuensi insiden per jenis kategori
    const summary = {};
    dataInsiden.forEach(i => {
        const jenis = i.jenis || 'Lain-lain';
        summary[jenis] = (summary[jenis] || 0) + 1;
    });

    const labels = Object.keys(summary);
    const counts = Object.values(summary);

    incidentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: ['#0F3D56', '#176C8C', '#23A7C7', '#e74c3c', '#f39c12'],
                borderWidth: 0,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// Fungsi pembantu mengubah angka bulan menjadi nama teks Indonesia Resmi
function konversiBulan(angkaBulan) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return namaBulan[angkaBulan - 1] || "Pilihan";
}