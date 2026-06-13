document.addEventListener("DOMContentLoaded", () => {
    hitungTotalKaryawan();
    hitungTotalDokumen();
    hitungTotalAudit();
    muatDataRekapUtama();
});

// 1. Fungsi mengambil jumlah total karyawan
async function hitungTotalKaryawan() {
    const { count, error } = await supabase
        .from('karyawan')
        .select('*', { count: 'exact', head: true });

    if (!error && count !== null) {
        document.getElementById('stat-karyawan').innerText = count;
    }
}

// 2. Fungsi mengambil jumlah total dokumen K3/SOP
async function hitungTotalDokumen() {
    const { count, error } = await supabase
        .from('dokumen_k3')
        .select('*', { count: 'exact', head: true });

    if (!error && count !== null) {
        document.getElementById('stat-dokumen').innerText = count;
    }
}

// 3. Fungsi mengambil jumlah agenda audit
async function hitungTotalAudit() {
    const { count, error } = await supabase
        .from('audit_k3')
        .select('*', { count: 'exact', head: true });

    if (!error && count !== null) {
        document.getElementById('stat-audit').innerText = count;
    }
}

// 4. Fungsi memuat tabel rekap bulanan & narasi otomatis terbaru
async function muatDataRekapUtama() {
    // Ambil semua riwayat rekap bulanan diurutkan dari yang terbaru
    const { data, error } = await supabase
        .from('kesimpulan_rekap')
        .select('*')
        .order('tahun', { ascending: false })
        .order('bulan', { ascending: false });

    if (error) {
        console.error("Gagal mengambil data rekap:", error.message);
        document.getElementById('narasi-box').innerText = "Gagal memuat evaluasi otomatis sistem.";
        return;
    }

    const narasiBox = document.getElementById('narasi-box');
    const tabelBody = document.getElementById('tabel-rekap-body');
    tabelBody.innerHTML = ""; // Bersihkan baris tabel

    // Jika data kosong
    if (!data || data.length === 0) {
        document.getElementById('stat-kepatuhan').innerText = "0%";
        narasiBox.innerHTML = "<em>Belum ada data rekapitulasi bulanan dan narasi evaluasi di database.</em>";
        tabelBody.innerHTML = `<tr><td colspan="3">Tidak ada riwayat rekap bulanan ditemukan.</td></tr>`;
        return;
    }

    // A. Atur data terbaru untuk komponen Card Utama & Kotak Narasi Otomatis
    const dataTerbaru = data[0];
    document.getElementById('stat-kepatuhan').innerText = `${dataTerbaru.rata_rata_kepatuhan}%`;
    narasiBox.innerHTML = `<strong>Evaluasi Periode ${konversiBulan(dataTerbaru.bulan)} ${dataTerbaru.tahun}:</strong><br>${dataTerbaru.narasi_kesimpulan}`;

    // B. Looping untuk menampilkan seluruh riwayat ke dalam tabel HTML
    data.forEach(item => {
        // Tentukan kelas badge berdasarkan persentase kepatuhan
        let badgeClass = "unfit"; // < 60%
        if (item.rata_rata_kepatuhan >= 80) {
            badgeClass = "fit"; // Bagus
        } else if (item.rata_rata_kepatuhan >= 60) {
            badgeClass = "catatan"; // Cukup/Warning
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
}

// Fungsi pembantu untuk mengubah angka bulan menjadi nama teks Indonesia
function konversiBulan(angkaBulan) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return namaBulan[angkaBulan - 1] || "Pilihan";
}