const currentPage = window.location.pathname.split("/").pop() || "index.html";
const sidebarLinks = document.querySelectorAll(".sidebar a");

sidebarLinks.forEach(link => {
    const linkPage = link.getAttribute("href");
    const item = link.closest("li");

    if (!item) {
        return;
    }

    item.classList.toggle("active", linkPage == currentPage);
});

// Event listener untuk profile section di navbar
document.addEventListener("DOMContentLoaded", () => {
    const profileElement = document.querySelector(".profile");
    if (profileElement) {
        // Jika belum ada navbar-right container, buat satu
        if (!profileElement.parentElement.classList.contains("navbar-right")) {
            const navbarRight = document.createElement("div");
            navbarRight.className = "navbar-right";
            
            profileElement.parentElement.replaceChild(navbarRight, profileElement);
            navbarRight.appendChild(profileElement);
            
            // Logout button dihapus agar hanya menampilkan email & role
        }

        // Event listener untuk profile click
        profileElement.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }
});

// Logout function untuk semua halaman
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
