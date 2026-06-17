document.addEventListener("DOMContentLoaded", () => {
    loadProfil();
});

async function loadProfil() {
    try {
        console.log("🔄 [PROFILE] Loading profil...");

        const {
            data: { user }
        } = await db.auth.getUser();

        if (!user) {
            console.error("❌ [PROFILE] User not authenticated");
            alert("Silakan login terlebih dahulu");
            window.location.href = "login.html";
            return;
        }

        console.log("✓ [PROFILE] User authenticated:", {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata
        });

        const authMeta = user.user_metadata || {};

        // Ambil data user_profiles berdasarkan auth user id
        console.log("📊 [PROFILE] Querying user_profiles for id:", user.id);
        let { data, error } = await db
            .from("user_profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        console.log("📋 [PROFILE] Query result:", { data, error });

        // Jika ada error tapi data ada, tetap lanjut
        if (error) {
            console.error("❌ [PROFILE] Error fetching user profile:", error);
        }

        // Jika profile belum ada, buat profile baru untuk user ini
        if (!data) {
            console.warn("⚠️ [PROFILE] Profile tidak ditemukan, membuat baru...");

            const newProfileData = {
                id: user.id,
                email: user.email,
                nama: authMeta?.nama || "",
                nik: authMeta?.nik || "",
                departemen: authMeta?.departemen || "",
                work_unit: authMeta?.work_unit || "",
                role: "Viewer",
                is_active: true,
                created_at: new Date().toISOString()
            };

            console.log("📝 [PROFILE] Inserting new profile:", newProfileData);

            const { data: newProfile, error: insertError } = await db
                .from("user_profiles")
                .insert([newProfileData])
                .select()
                .single();

            console.log("📝 [PROFILE] Insert result:", { newProfile, insertError });

            if (insertError) {
                console.error("❌ [PROFILE] Error creating user profile:", insertError);
                data = null;
            } else {
                data = newProfile;
                console.log("✅ [PROFILE] Profile berhasil dibuat");
            }
        }

        // Siapkan data dengan fallback
        const nama = data?.nama || authMeta?.nama || "";
        const nik = data?.nik || authMeta?.nik || "";
        const departemen = data?.departemen || authMeta?.departemen || "";
        const work_unit = data?.work_unit || authMeta?.work_unit || "";
        const email = data?.email || user.email || "";

        console.log("📋 [PROFILE] Data yang akan ditampilkan:", {
            nama,
            nik,
            departemen,
            work_unit,
            email,
            dbData: data
        });

        // Isi form fields dengan data
        const namaEl = document.getElementById("nama");
        const emailEl = document.getElementById("email");
        const nikEl = document.getElementById("nik");
        const departemenEl = document.getElementById("departemen");
        const workUnitEl = document.getElementById("work_unit");

        if (namaEl) namaEl.value = nama;
        if (emailEl) emailEl.value = email;
        if (nikEl) nikEl.value = nik;
        if (departemenEl) departemenEl.value = departemen;
        if (workUnitEl) workUnitEl.value = work_unit;

        // Status password (password tidak bisa ditampilkan ulang dari Supabase)
        const passwordStatusEl = document.getElementById("password-status");
        if (passwordStatusEl) {
            passwordStatusEl.textContent =
                "Password akun Anda: sudah di-set (tidak ditampilkan). Isi password baru untuk mengganti.";
        }

        // Update navbar profile
        const navbar = document.getElementById("navbar-profile");
        if (navbar) navbar.textContent = nama || email || "User";

        console.log("✅ [PROFILE] Profile page loaded successfully!");
    } catch (err) {
        console.error("❌ [PROFILE] Error di loadProfil:", err);
        console.error("Stack:", err.stack);
        alert("Gagal memuat profil. Cek console untuk detail error.");
    }
}

async function simpanProfil() {
    try {
        const nama = document.getElementById("nama").value.trim();
        const nik = document.getElementById("nik").value.trim();
        const departemen = document.getElementById("departemen").value.trim();
        const work_unit = document.getElementById("work_unit").value.trim();

        // Validasi field yang wajib
        if (!nama) {
            alert("⚠️ Nama lengkap wajib diisi");
            document.getElementById("nama").focus();
            return;
        }

        if (!nik) {
            alert("⚠️ NIK karyawan wajib diisi");
            document.getElementById("nik").focus();
            return;
        }

        if (!departemen) {
            alert("⚠️ Departemen wajib dipilih");
            document.getElementById("departemen").focus();
            return;
        }

        // Ambil user yang sedang login
        const { data: { user } } = await db.auth.getUser();
        if (!user) {
            alert("❌ Silakan login terlebih dahulu");
            return;
        }

        // Update user_profiles dengan data baru
        const { error } = await db
            .from("user_profiles")
            .update({
                nama,
                nik,
                departemen,
                work_unit
            })
            .eq("id", user.id);

        if (error) {
            console.error("Error saat menyimpan profil:", error);
            alert("❌ Gagal menyimpan data!\n\nError: " + error.message);
            return;
        }

        // Update navbar dengan nama baru + sessionStorage
        const navbar = document.getElementById("navbar-profile");
        if (navbar) navbar.textContent = nama;
        sessionStorage.setItem("k3_nama", nama);

        alert("✅ Profil berhasil diperbarui!");

        // Refresh field supaya tampil ulang seperti awal
        await loadProfil();
    } catch (err) {
        console.error("Error di simpanProfil:", err);
        alert("❌ Terjadi kesalahan: " + err.message);
    }
}

async function ubahPassword() {
    try {
        const passwordBaru = document.getElementById("passwordBaru").value;

        if (!passwordBaru) {
            alert("⚠️ Password baru wajib diisi");
            return;
        }

        if (passwordBaru.length < 6) {
            alert("⚠️ Password minimal harus 6 karakter");
            return;
        }

        const { error } = await db.auth.updateUser({
            password: passwordBaru
        });

        if (error) {
            console.error("Error saat mengubah password:", error);
            alert("❌ Gagal mengubah password!\n\nError: " + error.message);
            return;
        }

        document.getElementById("passwordBaru").value = "";
        alert("✅ Password berhasil diperbarui!");

        await loadProfil();
    } catch (err) {
        console.error("Error di ubahPassword:", err);
        alert("❌ Terjadi kesalahan: " + err.message);
    }
}

async function logout() {
    const confirmed = confirm("Apakah Anda yakin ingin keluar dari sistem?");
    if (!confirmed) return;

    try {
        if (typeof db === "undefined") {
            alert("Sistem belum siap. Silahkan refresh halaman.");
            console.error("DB not initialized");
            return;
        }

        const { error } = await db.auth.signOut();
        if (error) {
            alert("❌ Gagal logout: " + error.message);
            console.error("Logout error:", error);
            return;
        }

        sessionStorage.clear();
        alert("✅ Anda telah logout");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 500);
    } catch (err) {
        alert("❌ Error logout: " + err.message);
        console.error("Logout error:", err);
    }
}

