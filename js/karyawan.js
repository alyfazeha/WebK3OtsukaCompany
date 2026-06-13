// Modal
const modal = document.getElementById("modal");
const tbody = document.getElementById("tbody");

document.getElementById("openModal").onclick = () => {
    modal.style.display = "flex";
};

// =======================
// LOAD DATA DARI SUPABASE
// =======================

async function loadData() {

    const { data, error } = await db
        .from("karyawan")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.log(error);
        return;
    }

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

                <button onclick="editData(${item.id})">
                    Edit
                </button>

                <button
                    onclick="hapusData(${item.id})"
                    style="background:red"
                >
                    Hapus
                </button>

            </td>

        </tr>

        `;

    });

}

loadData();


// =======================
// TAMBAH DATA
// =======================

async function tambahData() {

    let nama = document.getElementById("nama").value;

    let nik = document.getElementById("nik").value;

    let departemen = document.getElementById("departemen").value;

    let jabatan = document.getElementById("jabatan").value;

    let mcu = document.getElementById("mcu").value;

    const { error } = await db

        .from("karyawan")

        .insert([

            {

                nama: nama,

                nik: nik,

                departemen: departemen,

                jabatan: jabatan,

                status_mcu: mcu

            }

        ]);

    if (error) {

        alert(error.message);

        console.log(error);

        return;

    }

    modal.style.display = "none";

    document.getElementById("nama").value = "";

    document.getElementById("nik").value = "";

    document.getElementById("jabatan").value = "";

    loadData();

}


// =======================
// HAPUS DATA
// =======================

async function hapusData(id){

    if(!confirm("Yakin ingin menghapus data?")){

        return;

    }

    const {error}=await db

        .from("karyawan")

        .delete()

        .eq("id",id);

    if(error){

        alert(error.message);

        return;

    }

    loadData();

}


// =======================
// EDIT DATA
// =======================

function editData(id){

    alert("Fitur edit nanti bisa dibuat dengan modal edit.");

}