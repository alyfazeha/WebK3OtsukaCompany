// Jalankan fungsi saat halaman selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
    ambilDataKaryawan();
    
    // Pasang event listener untuk form submit
    document.getElementById("formKaryawan").addEventListener("submit", tambahKaryawan);
});

// Fungsi 1: Mengambil data dari tabel 'karyawan' di Supabase
async function ambilDataKaryawan() {
    const { data, error } = await supabase
        .from('karyawan')
        .select('*');

    if (error) {
        console.error("Gagal mengambil data:", error.message);
        return;
    }

    const tbody = document.getElementById("tabelKaryawanBody");
    tbody.innerHTML = ""; // Bersihkan tabel terlebih dahulu

    // Looping data dan masukkan ke dalam baris tabel HTML
    data.forEach(karyawan => {
        const row = `
            <tr>
                <td>${karyawan.nik}</td>
                <td>${karyawan.nama}</td>
                <td>${karyawan.departemen || '-'}</td>
                <td>${karyawan.jabatan || '-'}</td>
                <td>${karyawan.status_mcu || '-'}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Fungsi 2: Menambah data ke tabel 'karyawan' di Supabase
async function tambahKaryawan(event) {
    event.preventDefault(); // Mencegah halaman refresh otomatis

    const nik = document.getElementById("nik").value;
    const nama = document.getElementById("nama").value;
    const departemen = document.getElementById("departemen").value;
    const jabatan = document.getElementById("jabatan").value;
    const status_mcu = document.getElementById("status_mcu").value;

    // Kirim data ke Supabase
    const { data, error } = await supabase
        .from('karyawan')
        .insert([
            { nik: nik, nama: nama, departemen: departemen, jabatan: jabatan, status_mcu: status_mcu }
        ]);

    if (error) {
        alert("Gagal menambahkan karyawan: " + error.message);
    } else {
        alert("Karyawan berhasil ditambahkan!");
        document.getElementById("formKaryawan").reset(); // Reset form input
        ambilDataKaryawan(); // Refresh tabel agar data baru langsung muncul
    }
}