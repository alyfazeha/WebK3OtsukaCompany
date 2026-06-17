/**
 * auth.js — Auth Guard & Role Management
 * K3-IMS Otsuka
 */

const ROLE_ACCESS = {
    pages: {
        Admin:      ['dashboard.html', 'karyawan.html', 'p2k3.html', 'dokumen.html', 'pelaksanaan.html', 'monitoring.html', 'insiden.html', 'audit.html', 'admin.html'],
        K3Manager:  ['dashboard.html', 'karyawan.html', 'p2k3.html', 'dokumen.html', 'pelaksanaan.html', 'monitoring.html', 'insiden.html', 'audit.html'],
        K3Officer:  ['dashboard.html', 'karyawan.html', 'p2k3.html', 'dokumen.html', 'pelaksanaan.html', 'monitoring.html', 'insiden.html', 'audit.html'],
        DeptHead:   ['dashboard.html', 'dokumen.html', 'pelaksanaan.html', 'monitoring.html', 'insiden.html'],
        Employee:   ['dashboard.html', 'pelaksanaan.html', 'insiden.html'],
        Auditor:    ['dashboard.html', 'karyawan.html', 'p2k3.html', 'dokumen.html', 'pelaksanaan.html', 'monitoring.html', 'audit.html', 'insiden.html'],
        Viewer:     ['dashboard.html', 'dokumen.html'],
    },
    readOnly: {
        Admin: false, K3Manager: false, K3Officer: false,
        DeptHead: false, Employee: false, Auditor: true, Viewer: true,
    },
    badge: {
        Admin:     { label: 'Administrator', color: '#0F3D56' },
        K3Manager: { label: 'K3 Manager',    color: '#176C8C' },
        K3Officer: { label: 'K3 Officer',    color: '#23A7C7' },
        DeptHead:  { label: 'Dept. Head',    color: '#2D9B73' },
        Employee:  { label: 'Karyawan',      color: '#6D7D8B' },
        Auditor:   { label: 'Auditor',       color: '#8B6914' },
        Viewer:    { label: 'Viewer',        color: '#9B59B6' },
    }
};

async function initAuth() {
    const { data: sessionData } = await db.auth.getSession();
    if (!sessionData.session) {
        window.location.href = 'login.html';
        return;
    }

    let role  = sessionStorage.getItem('k3_role');
    let email = sessionStorage.getItem('k3_email');
    let nama  = sessionStorage.getItem('k3_nama');

    // Refresh dari DB kalau sessionStorage kosong (misal buka tab baru)
    if (!role) {
        const userId = sessionData.session.user.id;
        const { data: profile } = await db
            .from('user_profiles')
            .select('role, is_active, nama, departemen')
            .eq('id', userId)
            .single();

        // Blokir user yang belum di-approve Admin
        if (!profile || !profile.is_active) {
            await db.auth.signOut();
            window.location.href = 'login.html?msg=pending';
            return;
        }

        role  = profile.role  || 'Viewer';
        nama  = profile.nama  || sessionData.session.user.email;
        email = sessionData.session.user.email;
        sessionStorage.setItem('k3_role',  role);
        sessionStorage.setItem('k3_email', email);
        sessionStorage.setItem('k3_nama',  nama);
    }

    // Cek akses halaman
    const currentPage  = window.location.pathname.split('/').pop() || 'index.html';
    const allowedPages = ROLE_ACCESS.pages[role] || ROLE_ACCESS.pages['Viewer'];

    if (!allowedPages.includes(currentPage)) {
        window.location.href = allowedPages[0] || 'index.html';
        return;
    }

    renderUserBadge(role, nama || email);
    restrictSidebar(role);

    if (ROLE_ACCESS.readOnly[role]) {
        applyReadOnlyMode();
        showReadOnlyBanner(role);
    }
}

function renderUserBadge(role, nama) {
    const profileEl = document.querySelector('.profile');
    if (!profileEl) return;

    const badge   = ROLE_ACCESS.badge[role] || { label: role, color: '#555' };
    const initial = (nama || 'U')[0].toUpperCase();

    profileEl.innerHTML = `
        <div class="user-badge">
            <div class="user-avatar" style="background:${badge.color}">${initial}</div>
            <div class="user-info">
                <span class="user-email">${nama}</span>
                <span class="user-role-chip" style="background:${badge.color}">${badge.label}</span>
            </div>
        </div>`;
}

function restrictSidebar(role) {
    const allowed = ROLE_ACCESS.pages[role] || [];
    document.querySelectorAll('.sidebar li').forEach(li => {
        const link = li.querySelector('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (href && !allowed.includes(href)) {
            li.style.display = 'none';
        } else {
            li.style.display = '';
        }
    });
}

function applyReadOnlyMode() {
    ['.btn-tambah','.btn-hapus','.btn-edit','.btn-save','.btn-submit',
     '.p2k3-hero button','.top button',
     'button[onclick*="tambah"]','button[onclick*="hapus"]',
     'button[onclick*="edit"]','button[onclick*="simpan"]',
     'button[onclick*="submit"]','button[onclick*="buka"]'
    ].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
    });
    document.querySelectorAll('input:not([type=search]):not(#search), select, textarea')
        .forEach(el => el.setAttribute('disabled', true));
}

function showReadOnlyBanner(role) {
    const label  = ROLE_ACCESS.badge[role]?.label || role;
    const banner = document.createElement('div');
    banner.className = 'readonly-banner';
    banner.innerHTML = `<span>👁 Mode <strong>${label}</strong> — Anda hanya dapat melihat data. Hubungi Administrator untuk perubahan.</span>`;
    document.querySelector('.content')?.prepend(banner);
}

async function handleLogout() {
    if (!confirm('Yakin ingin keluar dari sistem?')) return;
    await db.auth.signOut();
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function getCurrentRole() { return sessionStorage.getItem('k3_role') || 'Viewer'; }
function isReadOnly()      { return ROLE_ACCESS.readOnly[getCurrentRole()] === true; }
function canAccess(page)   { return (ROLE_ACCESS.pages[getCurrentRole()] || []).includes(page); }