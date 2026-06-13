const modal = document.getElementById("modal");
const tbody = document.getElementById("tbody");
const strukturBoard = document.getElementById("strukturBoard");
const totalAnggota = document.getElementById("totalAnggota");
const periodeAktif = document.getElementById("periodeAktif");
const pengurusInti = document.getElementById("pengurusInti");
let editId = null;
let semuaData = [];

document.getElementById("openModal").onclick = () => {
    editId = null;
    document.getElementById("judulModal").innerHTML = "Tambah Anggota P2K3";
    document.getElementById("karyawan").value = "";
    document.getElementById("jabatan").value = "Ketua";
    document.getElementById("periode").value = "";
    modal.style.display = "flex";
};

function tutupModal() {
    modal.style.display = "none";
    editId = null;
}

async function loadKaryawan() {
    const { data, error } = await db
        .from("karyawan")
        .select("*")
        .order("nama");

    if (error) {
        console.log(error);
        return;
    }
    const select = document.getElementById("karyawan");
    select.innerHTML = "<option value=''>Pilih Karyawan</option>";
    data.forEach(item => {
        select.innerHTML += `
        <option value="${item.id}">
            ${item.nama}
        </option>
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
            karyawan (
                nama
            )
        `)
        .order("id");

    if (error) {
        console.log(error);
        return;
    }
    semuaData = data;
    tampilkanData(data);
}

function tampilkanData(data) {
    tbody.innerHTML = "";
    tampilkanRingkasan(data);
    tampilkanStruktur(data);

    if (data.length == 0) {
        tbody.innerHTML = `
        <tr>
            <td colspan="4" class="empty-row">
                Belum ada anggota P2K3 yang sesuai.
            </td>
        </tr>
        `;
        return;
    }

    data.forEach(item => {
        tbody.innerHTML += `
        <tr>
            <td>
                <strong>${namaKaryawan(item)}</strong>
            </td>
            <td>
                <span class="role-badge ${kelasJabatan(item.jabatan_p2k3)}">
                    ${item.jabatan_p2k3}
                </span>
            </td>
            <td>${item.periode || "-"}</td>
            <td>
                <button onclick="editData(${item.id})">
                    Edit
                </button>
                <button
                    onclick="hapusData(${item.id})"
                    style="background:red;"
                >
                    Hapus
                </button>
            </td>
        </tr>
        `;
    });
}

function tampilkanRingkasan(data) {
    totalAnggota.innerText = data.length;
    const periode = data.map(item => item.periode).filter(Boolean);
    periodeAktif.innerText = periode.length > 0 ? periode[periode.length - 1] : "-";
    pengurusInti.innerText = data.filter(item =>
        ["Ketua", "Wakil Ketua", "Sekretaris"].includes(item.jabatan_p2k3)
    ).length;
}

function tampilkanStruktur(data) {
    const urutanJabatan = ["Ketua", "Wakil Ketua", "Sekretaris", "Anggota"];
    strukturBoard.innerHTML = "";

    urutanJabatan.forEach(jabatan => {
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
                <div class="empty-structure">
                    Belum ada data untuk jabatan ini.
                </div>
            `;

        strukturBoard.innerHTML += `
        <section class="role-column ${kelasJabatan(jabatan)}">
            <div class="role-header">
                <span>${jabatan}</span>
                <strong>${anggota.length}</strong>
            </div>
            <div class="member-list">
                ${daftarAnggota}
            </div>
        </section>
        `;
    });
}

function namaKaryawan(item) {
    return item.karyawan && item.karyawan.nama ? item.karyawan.nama : "Karyawan tidak ditemukan";
}

function inisialNama(nama) {
    return nama
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(kata => kata[0])
        .join("")
        .toUpperCase();
}

function kelasJabatan(jabatan) {
    return jabatan.toLowerCase().replace(/\s+/g, "-");
}

async function simpanData() {
    if (editId == null) {
        tambahData();
    } else {
        updateData();
    }
}

async function tambahData() {
    const karyawan = document.getElementById("karyawan").value;
    const jabatan = document.getElementById("jabatan").value;
    const periode = document.getElementById("periode").value;

    if (karyawan == "" || periode == "") {
        alert("Lengkapi data.");
        return;
    }
    const { error } = await db
        .from("struktur_p2k3")
        .insert([
            {
                karyawan_id: karyawan,
                jabatan_p2k3: jabatan,
                periode: periode
            }
        ]);

    if (error) {
        alert(error.message);
        return;
    }
    alert("Data berhasil ditambahkan.");
    tutupModal();
    loadP2K3();
}

function editData(id) {
    const data = semuaData.find(item => item.id == id);
    editId = id;
    document.getElementById("judulModal").innerHTML = "Edit Anggota P2K3";
    document.getElementById("karyawan").value = data.karyawan_id;
    document.getElementById("jabatan").value = data.jabatan_p2k3;
    document.getElementById("periode").value = data.periode;
    modal.style.display = "flex";
}

async function updateData() {
    const karyawan = document.getElementById("karyawan").value;
    const jabatan = document.getElementById("jabatan").value;
    const periode = document.getElementById("periode").value;

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

async function hapusData(id) {
    if (!confirm("Yakin ingin menghapus data?")) {
        return;
    }
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

document.getElementById("search").addEventListener("keyup", function () {
    const keyword = this.value.toLowerCase();
    const hasil = semuaData.filter(item =>
        namaKaryawan(item).toLowerCase().includes(keyword) ||
        item.jabatan_p2k3.toLowerCase().includes(keyword) ||
        (item.periode || "").toLowerCase().includes(keyword)
    );
    tampilkanData(hasil);
});

window.onclick = function (e) {
    if (e.target == modal) {
        tutupModal();
    }
};

loadKaryawan();
loadP2K3();
