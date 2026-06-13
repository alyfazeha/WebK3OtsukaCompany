const modal = document.getElementById("modal");
const tbody = document.getElementById("tbody");

document.getElementById("openModal").onclick = () => {
    modal.style.display = "flex";
};

// ==========================
// LOAD DATA KARYAWAN KE SELECT
// ==========================

async function loadKaryawan() {

    const { data, error } = await db
        .from("karyawan")
        .select("*");

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

// ==========================
// SIMPAN DATA
// ==========================

async function tambahP2K3() {

    const karyawan = document.getElementById("karyawan").value;
    const jabatan = document.getElementById("jabatan").value;
    const periode = document.getElementById("periode").value;

    if (karyawan == "" || periode == "") {

        alert("Lengkapi data terlebih dahulu.");

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

        console.log(error);

        alert(error.message);

        return;

    }

    alert("Data berhasil disimpan");

    modal.style.display = "none";

    loadP2K3();

}

// ==========================
// TAMPILKAN DATA
// ==========================

async function loadP2K3() {

    const { data, error } = await db

        .from("struktur_p2k3")

        .select(`
            id,
            jabatan_p2k3,
            periode,
            karyawan (
                nama
            )
        `);

    if (error) {

        console.log(error);

        return;

    }

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `

        <tr>

            <td>${item.karyawan.nama}</td>

            <td>${item.jabatan_p2k3}</td>

            <td>${item.periode}</td>

            <td>

                <button>Edit</button>

                <button
                    onclick="hapus(${item.id})"
                    style="background:red;"
                >
                    Hapus
                </button>

            </td>

        </tr>

        `;

    });

}

// ==========================
// HAPUS
// ==========================

async function hapus(id){

    if(!confirm("Yakin ingin menghapus?")){

        return;

    }

    await db

        .from("struktur_p2k3")

        .delete()

        .eq("id",id);

    loadP2K3();

}

loadKaryawan();

loadP2K3();