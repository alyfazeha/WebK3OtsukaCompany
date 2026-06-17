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

    const authMeta = user.user_metadata || {};

    // ambil data user_profiles berdasarkan auth user id
    const { data, error } = await supabase
        .from("user_profiles")
        .select("nama, nik, email, departemen, work_unit, role, is_active") // ✅ tambah email
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.log(error);
        return;
    }

    // catatan: karena kolom nama/nik belum tersimpan (sesuai info), fallback ke metadata auth
    const nama = data?.nama || authMeta?.nama || "";
    const nik = data?.nik || authMeta?.nik || "";
    const email = data?.email || user.email || "";

    document.getElementById("nama").value = nama;
    document.getElementById("email").value = user.email || "";
    document.getElementById("nik").value = nik;

    document.getElementById("departemen").value = data?.departemen || authMeta?.departemen || "";
    document.getElementById("work_unit").value = data?.work_unit || authMeta?.work_unit || "";

    // Update navbar profile dengan nama user
    const navbar = document.getElementById("navbar-profile");
    if (navbar) {
        navbar.textContent = nama || "User";
    }
}




async function simpanProfil() {

    const nama = document.getElementById("nama").value.trim();
    const nik = document.getElementById("nik").value.trim();
    const departemen = document.getElementById("departemen").value;
    const work_unit = document.getElementById("work_unit").value.trim();

    if (!nama || !nik || !departemen) {
        alert("Nama, NIK, dan Departemen wajib diisi.");
        return;
    }

    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
        alert("Silakan login");
        return;
    }

    // update user_profiles: kolom nama/nik bisa jadi belum ada isinya, tapi kita tetap coba
    const { error } = await supabase
        .from("user_profiles")
        .update({
            nama,
            nik,
            departemen,
            work_unit,
        })
        .eq("id", user.id);

    if (error) {
        alert("Gagal menyimpan data! (cek kolom di user_profiles)");
        console.log(error);
        return;
    }

    alert("Profil berhasil diperbarui!");
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


async function logout() {

    const confirmed = confirm("Apakah Anda yakin ingin keluar dari sistem?");

    if (!confirmed) {
        return;
    }

    try {
        // Cek apakah supabase sudah tersedia
        if (typeof supabase === 'undefined') {
            alert("Sistem belum siap. Silahkan refresh halaman.");
            console.error("Supabase not initialized");
            return;
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
            alert("Gagal logout: " + error.message);
            console.log(error);
            return;
        }

        alert("Anda telah logout");
        
        // Tunggu sebentar sebelum redirect
        setTimeout(() => {
            window.location.href = "login.html";
        }, 500);
        
    } catch (err) {
        alert("Error logout: " + err.message);
        console.log(err);
    }

}