const modal = document.getElementById("modal");
const tbody = document.getElementById("tbody");
let editId = null;
let semuaData = [];

document.getElementById("openModal").onclick = () => {
    editId = null;
    document.getElementById("judulModal").innerText = "Tambah Data Karyawan";
    document.getElementById("nama").value = "";
    document.getElementById("nik").value = "";
    document.getElementById("departemen").value = "Produksi";
    document.getElementById("jabatan").value = "";
    document.getElementById("mcu").value = "Fit";
    modal.style.display = "flex";
};

function tutupModal() {
    modal.style.display = "none";
    editId = null;
}

async function loadData() {
    const { data, error } = await db
        .from("karyawan")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.log(error);
        return;
    }
    semuaData = data;
    tampilkanData(data);
}
loadData();

function tampilkanData(data) {
    tbody.innerHTML = "";
    data.forEach(item => {
        let warna = "fit";
        if (item.status_mcu == "Fit dengan Catatan") {
            warna = "catatan";
        }
        if (item.status_mcu == "Unfit") {
            warna = "unfit";
        }
        tbody.innerHTML += `
        <tr>
            <td>${item.nama}</td>
            <td>${item.nik}</td>
            <td>${item.departemen}</td>
            <td>${item.jabatan}</td>
            <td>
                <span class="badge ${warna}">
                    ${item.status_mcu}
                </span>
            </td>
            <td>
                <button onclick="editData(${item.id})">Edit</button>
                <button onclick="hapusData(${item.id})" style="background:red;">Hapus</button>
            </td>
        </tr>
        `;
    });
}

async function simpanData() {
    if (editId == null) {
        tambahData();
    } else {
        updateData();
    }
}

async function tambahData() {
    let nama = document.getElementById("nama").value;
    let nik = document.getElementById("nik").value;
    let departemen = document.getElementById("departemen").value;
    let jabatan = document.getElementById("jabatan").value;
    let mcu = document.getElementById("mcu").value;

    const { error } = await db
        .from("karyawan")
        .insert([{
            nama,
            nik,
            departemen,
            jabatan,
            status_mcu: mcu
        }]);

    if (error) {
        alert(error.message);
        return;
    }
    alert("Data berhasil ditambahkan");
    tutupModal();
    loadData();
}

function editData(id) {
    const data = semuaData.find(item => item.id == id);
    editId = id;
    document.getElementById("judulModal").innerText = "Edit Data Karyawan";
    document.getElementById("nama").value = data.nama;
    document.getElementById("nik").value = data.nik;
    document.getElementById("departemen").value = data.departemen;
    document.getElementById("jabatan").value = data.jabatan;
    document.getElementById("mcu").value = data.status_mcu;
    modal.style.display = "flex";
}

async function updateData() {
    let nama = document.getElementById("nama").value;
    let nik = document.getElementById("nik").value;
    let departemen = document.getElementById("departemen").value;
    let jabatan = document.getElementById("jabatan").value;
    let mcu = document.getElementById("mcu").value;

    const { error } = await db
        .from("karyawan")
        .update({
            nama: nama,
            nik: nik,
            departemen: departemen,
            jabatan: jabatan,
            status_mcu: mcu
        })
        .eq("id", editId);

    if (error) {
        alert(error.message);
        return;
    }
    alert("Data berhasil diubah");
    tutupModal();
    loadData();
}

async function hapusData(id) {
    if (!confirm("Yakin ingin menghapus data?")) {
        return;
    }
    const { error } = await db
        .from("karyawan")
        .delete()
        .eq("id", id);

    if (error) {
        alert(error.message);
        return;
    }
    alert("Data berhasil dihapus");
    loadData();
}

document.getElementById("search").addEventListener("keyup", function () {
    const keyword = this.value.toLowerCase();
    const hasil = semuaData.filter(item =>
        item.nama.toLowerCase().includes(keyword) ||
        item.nik.toLowerCase().includes(keyword) ||
        item.departemen.toLowerCase().includes(keyword) ||
        item.jabatan.toLowerCase().includes(keyword) ||
        item.status_mcu.toLowerCase().includes(keyword)
    );
    tampilkanData(hasil);
});

window.onclick = function (event) {
    if (event.target == modal) {
        tutupModal();
    }
};