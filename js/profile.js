document.addEventListener("DOMContentLoaded", () => {
    loadProfil();
});


async function loadProfil() {

    const {
        data: { user }
    } = await supabase.auth.getUser();


    if (!user) {
        alert("Silakan login");
        return;
    }


    // ambil data profile berdasarkan email
    const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("email", user.email)
        .single();


    if (error) {
        console.log(error);
        return;
    }


    document.getElementById("nama").value = data.nama_lengkap || "";
    document.getElementById("email").value = data.email || "";
    document.getElementById("no_hp").value = data.no_hp || "";
    document.getElementById("alamat").value = data.alamat || "";
    document.getElementById("nik").value = data.nomor_induk_karyawan || "";
    document.getElementById("role").value = data.role || "";
    document.getElementById("departemen").value = data.departemen || "";
    document.getElementById("jabatan").value = data.jabatan || "";
    
    // Update navbar profile dengan nama user
    if (document.getElementById("navbar-profile")) {
        document.getElementById("navbar-profile").textContent = data.nama_lengkap || "User";
    }

}



async function simpanProfil() {


    const email = document.getElementById("email").value;


    const dataUpdate = {

        nama_lengkap:
            document.getElementById("nama").value,

        no_hp:
            document.getElementById("no_hp").value,

        alamat:
            document.getElementById("alamat").value,

        nomor_induk_karyawan:
            document.getElementById("nik").value,

        departemen:
            document.getElementById("departemen").value,

        jabatan:
            document.getElementById("jabatan").value
    };


    const { error } = await supabase
        .from("profile")
        .update(dataUpdate)
        .eq("email", email);


    if(error){
        alert("Gagal menyimpan data!");
        console.log(error);
    }
    else{
        alert("Profil berhasil diperbarui!");
    }

}



async function ubahPassword(){

    const passwordBaru =
        document.getElementById("passwordBaru").value;


    if(passwordBaru.length < 6){
        alert("Password minimal 6 karakter");
        return;
    }


    const { error } =
        await supabase.auth.updateUser({

            password: passwordBaru

        });


    if(error){
        alert("Gagal mengubah password");
        console.log(error);
    }
    else{

        alert("Password berhasil diperbarui");

        document
        .getElementById("passwordBaru")
        .value = "";

    }

}