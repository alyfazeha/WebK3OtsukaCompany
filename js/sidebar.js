// =========================================================================
//  sidebar.js — Auto-inject sidebar & active state (Termasuk Form Submission)
//  Cara pakai: cukup taruh <div class="sidebar"></div> kosong
//  di setiap HTML, sisanya diurus script ini.
// =========================================================================

const SIDEBAR_MENU = [
    { href: "dashboard.html",    icon: "🏠", label: "Dashboard" },
    { href: "karyawan.html",     icon: "👥", label: "Data Karyawan" },
    { href: "p2k3.html",         icon: "🏢", label: "Struktur P2K3" },
    { href: "dokumen.html",      icon: "📂", label: "Dokumen K3" },
    { href: "pelaksanaan.html",  icon: "📋", label: "Pelaksanaan SOP" },
    { href: "submission.html",   icon: "📝", label: "Form Kepatuhan" }, // <-- Menu Baru Terintegrasi
    { href: "monitoring.html",   icon: "🛡️", label: "Monitoring Kepatuhan" },
    { href: "insiden.html",      icon: "⚠️", label: "Laporan Insiden" },
    { href: "audit.html",        icon: "📊", label: "Audit" },
    { href: "admin.html",        icon: "⚙️", label: "Kelola User" },
];

function renderSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;

    // Mengambil nama file halaman saat ini (contoh: "submission.html")
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // Mapping item menu ke dalam format tag HTML <li>
    const menuHTML = SIDEBAR_MENU.map(item => {
        const isActive = item.href === currentPage ? ' class="active"' : '';
        return `<li${isActive}><a href="${item.href}">${item.icon} ${item.label}</a></li>`;
    }).join("\n        ");

    // Suntik struktur HTML internal ke komponen .sidebar
    sidebar.innerHTML = `
    <div class="logo">
        <img src="images/logo otsuka.jpg" alt="Logo Otsuka" onerror="this.style.display='none';">
        <h2>OTSUKA K3</h2>
        <p>Admin Panel</p>
    </div>
    <ul>
        ${menuHTML}
    </ul>
    <div style="padding: 0 20px; margin-top: auto; margin-bottom: 20px;">
        <button onclick="logout()" style="width: 100%; background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.4)'" onmouseout="this.style.background='rgba(239,68,68,0.2)'">
            🚪 Keluar Sistem
        </button>
    </div>`;
}

// =========================================================================
//  Navbar UI Adjustments: wrap .profile dalam .navbar-right & handle click
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    renderSidebar();

    const profileElement = document.querySelector(".profile");
    if (profileElement) {
        if (!profileElement.parentElement.classList.contains("navbar-right")) {
            const navbarRight = document.createElement("div");
            navbarRight.className = "navbar-right";
            profileElement.parentElement.replaceChild(navbarRight, profileElement);
            navbarRight.appendChild(profileElement);
        }

        profileElement.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }
});

// =========================================================================
//  Sistem Keamanan Keluar Akun (Logout Supabase)
// =========================================================================
async function logout() {
    const confirmed = confirm("Apakah Anda yakin ingin keluar dari sistem K3-IMS?");
    if (!confirmed) return;

    try {
        // Cek fallback client object baik 'supabase' maupun 'supabaseClient'
        const client = typeof supabase !== "undefined" ? supabase : (typeof supabaseClient !== "undefined" ? supabaseClient : null);
        
        if (!client) {
            alert("Sistem autentikasi belum siap. Silakan refresh halaman.");
            return;
        }

        const { error } = await client.auth.signOut();
        if (error) {
            alert("Gagal melakukan penutupan sesi: " + error.message);
            return;
        }

        alert("Anda telah berhasil keluar dari sistem.");
        setTimeout(() => { window.location.href = "login.html"; }, 500);

    } catch (err) {
        alert("Terjadi kesalahan sistem saat logout: " + err.message);
    }
}

/* ══════════════════════════════════════════════════
   PATCH sidebar.js — tambahkan kode ini
   setelah sidebar selesai di-render / di DOMContentLoaded
   ══════════════════════════════════════════════════ */

function initMobileSidebar() {
  // Buat overlay jika belum ada
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  // Buat tombol hamburger jika belum ada
  let hamburger = document.querySelector('.btn-hamburger');
  if (!hamburger) {
    hamburger = document.createElement('button');
    hamburger.className = 'btn-hamburger';
    hamburger.setAttribute('aria-label', 'Buka menu');
    hamburger.innerHTML = `
      <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"
           viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>`;

    // Sisipkan hamburger sebagai anak pertama navbar
    const navbar = document.querySelector('.navbar');
    if (navbar) navbar.insertBefore(hamburger, navbar.firstChild);
  }

  const sidebar = document.querySelector('.sidebar');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden'; // cegah scroll background
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  // Tutup sidebar saat link diklik (navigasi mobile)
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 600) closeSidebar();
    });
  });
}

// Jalankan setelah DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileSidebar);
} else {
  initMobileSidebar();
}