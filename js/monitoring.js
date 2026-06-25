/**
 * monitoring.js
 * Controller untuk Modul 6.3 Compliance Monitoring & Form Builder
 * Programmer: Anindya Naura (Operational & Checklist Specialist)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Elemen DOM
    const tabListBtn = document.getElementById('tab-list-btn');
    const tabBuilderBtn = document.getElementById('tab-builder-btn');
    const sectionFormList = document.getElementById('section-form-list');
    const sectionFormBuilder = document.getElementById('section-form-builder');
    
    const btnAddField = document.getElementById('btn-add-field');
    const builderFieldType = document.getElementById('builder-field-type');
    const fieldsContainer = document.getElementById('mon-builder-fields-container');
    const formBuilderMain = document.getElementById('form-builder-main');
    const btnResetBuilder = document.getElementById('btn-reset-builder');
    const tbodyTemplateForms = document.getElementById('tbody-template-forms');

    let loadedFormsCache = []; // Cache hasil fetch terakhir, dipakai oleh modal Lihat & mode Edit

    let fieldCounter = 0;
    let editingFormId = null; // null = mode create baru, terisi = mode edit data lama

    // Role yang boleh membuat & mengubah template form (sesuai Permission Matrix spesifikasi 6.3)
    const FORM_MANAGER_ROLES = ['Admin', 'K3Manager', 'K3Officer'];
    function canManageForms() {
        // getCurrentRole() disediakan oleh auth.js yang sudah dimuat sebelum monitoring.js
        const role = typeof getCurrentRole === 'function' ? getCurrentRole() : 'Viewer';
        return FORM_MANAGER_ROLES.includes(role);
    }

    // Set tanggal di navbar secara otomatis
    if (document.getElementById('navbar-date')) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('navbar-date').textContent = new Date().toLocaleDateString('id-ID', options);
    }

    // =========================================================================
    // 2. FUNGSI NAVIGASI TAB
    // =========================================================================
    function switchTab(activeTab) {
        if (activeTab === 'list') {
            tabListBtn.classList.add('active');
            tabListBtn.style.color = '#0284c7';
            tabListBtn.style.borderBottom = '3px solid #0284c7';
            
            tabBuilderBtn.classList.remove('active');
            tabBuilderBtn.style.color = '#6b7280';
            tabBuilderBtn.style.borderBottom = 'none';
            
            sectionFormList.style.display = 'block';
            sectionFormBuilder.style.display = 'none';
            loadTemplateForms(); // Refresh data saat tab list dibuka
        } else {
            tabBuilderBtn.classList.add('active');
            tabBuilderBtn.style.color = '#0284c7';
            tabBuilderBtn.style.borderBottom = '3px solid #0284c7';
            
            tabListBtn.classList.remove('active');
            tabListBtn.style.color = '#6b7280';
            tabListBtn.style.borderBottom = 'none';
            
            sectionFormList.style.display = 'none';
            sectionFormBuilder.style.display = 'block';
        }
    }

    tabListBtn.addEventListener('click', () => switchTab('list'));
    tabBuilderBtn.addEventListener('click', () => switchTab('builder'));

    // =========================================================================
    // 3. LOGIKA DYNAMIC FORM BUILDER (INJEKSI KOMPONEN INPUT)
    // =========================================================================
    btnAddField.addEventListener('click', () => {
        createFieldCard(builderFieldType.value, '', []);
    });

    function createFieldCard(selectedType, prefillLabel, prefillOptions) {
        // Hapus empty state bawaan jika komponen pertama dimasukkan
        const emptyState = fieldsContainer.querySelector('.mon-fields-empty-state');
        if (emptyState) emptyState.remove();

        fieldCounter++;
        const typeOptionEl = Array.from(builderFieldType.options).find(opt => opt.value === selectedType);
        const selectedText = typeOptionEl ? typeOptionEl.text : selectedType;

        // Wadah kartu komponen field
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'mon-field-card';
        fieldWrapper.dataset.id = fieldCounter;
        fieldWrapper.dataset.type = selectedType;
        fieldWrapper.style.cssText = "background: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; padding: 1.25rem; border-radius: 6px; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1rem;";

        // Generate konten internal kartu berdasarkan tipe input
        const optionsValuePrefill = Array.isArray(prefillOptions) ? prefillOptions.join(', ') : '';
        let dynamicSubInput = '';
        if (selectedType === 'dropdown' || selectedType === 'checklist') {
            dynamicSubInput = `
                <div style="margin-top: 0.75rem;">
                    <label style="font-size: 0.8rem; font-weight: 600; color: #4b5563;">Opsi Pilihan (Pisahkan dengan koma) <span style="color:red">*</span></label>
                    <input type="text" class="field-options" placeholder="Contoh: Baik, Rusak, Butuh Perbaikan" value="${optionsValuePrefill.replace(/"/g, '&quot;')}" style="width:100%; padding:0.4rem; font-size:0.85rem; border:1px solid #cbd5e1; border-radius:4px; margin-top:0.25rem;" required />
                </div>
            `;
        } else if (selectedType === 'rating') {
            dynamicSubInput = `<p style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem; font-style: italic;">💡 Skala penilaian otomatis di-set 1 sampai 5 di form lapangan.</p>`;
        }

        fieldWrapper.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.5rem; border-radius: 4px;">
                        ${selectedText.split(' ')[0]} Element
                    </span>
                    <div style="margin-top: 0.75rem;">
                        <label style="font-size: 0.85rem; font-weight: 600;">Label / Pertanyaan Inspeksi <span style="color:red">*</span></label>
                        <input type="text" class="field-label" placeholder="Masukkan instruksi pengecekan lapangan..." value="${(prefillLabel || '').replace(/"/g, '&quot;')}" style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:4px; margin-top:0.25rem;" required />
                    </div>
                    ${dynamicSubInput}
                </div>
                <button type="button" class="btn-delete-field" style="background: #fee2e2; color: #ef4444; border: none; padding: 0.4rem 0.7rem; border-radius: 4px; cursor: pointer; font-weight: 600; margin-left: 1rem;">
                    ✕ Hapus
                </button>
            </div>
        `;

        // Event listener hapus item field secara mandiri
        fieldWrapper.querySelector('.btn-delete-field').addEventListener('click', () => {
            fieldWrapper.remove();
            if (fieldsContainer.querySelectorAll('.mon-field-card').length === 0) {
                resetFieldsContainerToEmpty();
            }
        });

        fieldsContainer.appendChild(fieldWrapper);
        return fieldWrapper;
    }

    function resetFieldsContainerToEmpty() {
        fieldsContainer.innerHTML = `
            <div class="mon-fields-empty-state" style="text-align: center; padding: 3rem 1rem; border: 2px dashed #e2e8f0; border-radius: 8px; color: #94a3b8;">
                <p style="margin: 0; font-weight: 500;">Belum ada komponen yang ditambahkan.</p>
                <p style="font-size: 0.85rem; margin-top: 0.25rem;">Silakan pilih tipe komponen di atas lalu klik "Sisipkan Field".</p>
            </div>
        `;
        fieldCounter = 0;
    }

    function exitEditMode() {
        editingFormId = null;
        const btnSave = document.getElementById('btn-save-template');
        if (btnSave) btnSave.textContent = '💾 Terbitkan Template Form';
        const editBanner = document.getElementById('mon-edit-mode-banner');
        if (editBanner) editBanner.remove();
    }

    btnResetBuilder.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin mengosongkan seluruh rancangan form ini?')) {
            formBuilderMain.reset();
            resetFieldsContainerToEmpty();
            exitEditMode();
        }
    });

    // =========================================================================
    // 4. PENGIRIMAN DATA KE SUPABASE (PUBLISH TEMPLATE FORM)
    // =========================================================================
    formBuilderMain.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('form-title').value.trim();
        const frequency = document.getElementById('form-frequency').value;
        const targetDept = document.getElementById('form-target-dept').value;
        const description = document.getElementById('form-desc').value.trim();
        const reviewerRole = document.getElementById('form-reviewer').value;
        const templateStatus = document.getElementById('form-status').value || 'Active';

        // Ambil identitas user yang sedang login (diisi auth.js dari Supabase saat login, bukan hardcode)
        const currentUserNama = sessionStorage.getItem('k3_nama') || sessionStorage.getItem('k3_email') || 'Unknown User';

        // Validasi kelengkapan data dasar (Kolom NOT NULL)
        if (!title || !frequency || !targetDept) {
            alert('Mohon lengkapi seluruh field identitas utama form!');
            return;
        }

        if (!reviewerRole) {
            alert('Mohon pilih Reviewer / Approver (Atasan Langsung) untuk form ini!');
            return;
        }

        const fieldCards = fieldsContainer.querySelectorAll('.mon-field-card');
        if (fieldCards.length === 0) {
            alert('Gagal menerbitkan! Template form minimal harus memiliki 1 komponen checklist.');
            return;
        }

        // Ekstraksi skema field dinamis menjadi array objek JSON
        const structurePayload = [];
        let validationStatus = true;

        fieldCards.forEach(card => {
            const labelInput = card.querySelector('.field-label');
            const labelValue = labelInput ? labelInput.value.trim() : '';
            const fieldType = card.dataset.type;

            if (!labelValue) {
                validationStatus = false;
                if (labelInput) labelInput.style.borderColor = '#ef4444';
            }

            let optionsArray = [];
            if (fieldType === 'dropdown' || fieldType === 'checklist') {
                const optionsInput = card.querySelector('.field-options');
                const optionsValue = optionsInput ? optionsInput.value.trim() : '';
                
                if (!optionsValue) {
                    validationStatus = false;
                    if (optionsInput) optionsInput.style.borderColor = '#ef4444';
                } else {
                    optionsArray = optionsValue.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
                }
            }

            structurePayload.push({
                element_id: card.dataset.id,
                type: fieldType,
                label: labelValue,
                options: optionsArray
            });
        });

        if (!validationStatus) {
            alert('Ada label atau opsi komponen yang masih kosong. Mohon periksa kembali!');
            return;
        }

        try {
            const payload = {
                title: title,
                frequency: frequency,
                target_department: targetDept,
                description: description,
                fields_schema: structurePayload, // Payload JSONB otomatis masuk dengan aman
                reviewer_role: reviewerRole,
                status: templateStatus
            };

            let error;
            if (editingFormId) {
                // Mode EDIT: update baris yang sudah ada, created_by tidak diubah (tetap pencatat asli)
                const result = await supabaseClient
                    .from('monitoring_forms')
                    .update(payload)
                    .eq('id', editingFormId);
                error = result.error;
            } else {
                // Mode CREATE: insert baris baru, created_by diisi user yang sedang login
                payload.created_by = currentUserNama;
                const result = await supabaseClient
                    .from('monitoring_forms')
                    .insert([payload]);
                error = result.error;
            }

            if (error) throw error;

            alert(editingFormId
                ? '✅ Template form berhasil diperbarui.'
                : '🎉 Sukses! Template Form Checklist K3 berhasil diterbitkan dan masuk ke sistem penjadwalan.');
            formBuilderMain.reset();
            resetFieldsContainerToEmpty();
            exitEditMode();
            switchTab('list'); // Pindah otomatis ke tab list riwayat setelah sukses

        } catch (err) {
            console.error('Error saving data to Supabase:', err);
            alert('Terjadi kesalahan sistem saat menyimpan ke Supabase: ' + err.message);
        }
    });

    // =========================================================================
    // 5. PENAMPILAN DATA SECARA DINAMIS DARI SUPABASE
    // =========================================================================

    // Label tampilan yang lebih ramah untuk tipe field & frequency
    const FIELD_TYPE_LABELS = {
        text: 'Text Input', number: 'Number', boolean: 'Yes/No',
        checklist: 'Checklist', dropdown: 'Dropdown', datetime: 'Date/Time',
        photo: 'Photo Upload', signature: 'Signature', rating: 'Rating Scale'
    };

    function closeMonModal() {
        const overlay = document.getElementById('mon-modal-overlay');
        if (overlay) overlay.remove();
    }

    function openViewModal(formId) {
        const form = loadedFormsCache.find(f => String(f.id) === String(formId));
        if (!form) {
            alert('Data form tidak ditemukan. Silakan muat ulang daftar.');
            return;
        }

        const fields = Array.isArray(form.fields_schema) ? form.fields_schema : [];
        const fieldsHtml = fields.length === 0
            ? '<p style="color:#94a3b8; font-style:italic;">Tidak ada komponen field.</p>'
            : fields.map((f, idx) => `
                <div style="border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:6px; padding:0.75rem 1rem; margin-bottom:0.6rem; background:#f8fafc;">
                    <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#0369a1;">${idx + 1}. ${FIELD_TYPE_LABELS[f.type] || f.type}</div>
                    <div style="font-weight:600; margin-top:0.25rem;">${f.label || '(tanpa label)'}</div>
                    ${Array.isArray(f.options) && f.options.length > 0 ? `<div style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">Opsi: ${f.options.join(', ')}</div>` : ''}
                </div>
            `).join('');

        const createdAtStr = form.created_at
            ? new Date(form.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
            : '-';

        const modalHtml = `
            <div id="mon-modal-overlay" style="position:fixed; inset:0; background:rgba(15,23,42,0.55); display:flex; align-items:center; justify-content:center; z-index:1000; padding:1rem;">
                <div style="background:#fff; border-radius:10px; max-width:640px; width:100%; max-height:85vh; overflow-y:auto; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:1.25rem 1.5rem; border-bottom:1px solid #e2e8f0;">
                        <div>
                            <h2 style="margin:0; font-size:1.15rem; color:#1e293b;">${form.title}</h2>
                            <p style="margin:0.25rem 0 0; font-size:0.85rem; color:#6b7280;">${form.target_department} • ${form.frequency}</p>
                        </div>
                        <button type="button" id="mon-modal-close" style="background:none; border:none; font-size:1.4rem; line-height:1; cursor:pointer; color:#94a3b8;">✕</button>
                    </div>
                    <div style="padding:1.5rem;">
                        ${form.description ? `<p style="color:#475569; margin-top:0; margin-bottom:1.25rem;">${form.description}</p>` : ''}

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem 1.5rem; margin-bottom:1.5rem; font-size:0.85rem;">
                            <div><strong style="color:#475569;">Reviewer / Approver:</strong><br>${form.reviewer_role || '-'}</div>
                            <div><strong style="color:#475569;">Status:</strong><br>${form.status || 'Active'}</div>
                            <div><strong style="color:#475569;">Dibuat oleh:</strong><br>${form.created_by || 'System'}</div>
                            <div><strong style="color:#475569;">Dibuat pada:</strong><br>${createdAtStr}</div>
                        </div>

                        <h3 style="font-size:0.95rem; margin-bottom:0.75rem; color:#1e293b;">Komponen Checklist (${fields.length})</h3>
                        ${fieldsHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('mon-modal-close').addEventListener('click', closeMonModal);
        document.getElementById('mon-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'mon-modal-overlay') closeMonModal();
        });
    }

    function enterEditMode(formId) {
        const form = loadedFormsCache.find(f => String(f.id) === String(formId));
        if (!form) {
            alert('Data form tidak ditemukan. Silakan muat ulang daftar.');
            return;
        }
        if (!canManageForms()) {
            alert('Anda tidak memiliki akses untuk mengubah template form ini.');
            return;
        }

        editingFormId = form.id;

        // Pindah ke tab builder & isi field identitas
        switchTab('builder');
        document.getElementById('form-title').value = form.title || '';
        document.getElementById('form-frequency').value = form.frequency || '';
        document.getElementById('form-target-dept').value = form.target_department || '';
        document.getElementById('form-desc').value = form.description || '';
        document.getElementById('form-reviewer').value = form.reviewer_role || '';
        document.getElementById('form-status').value = form.status || 'Active';

        // Render ulang field cards dari fields_schema yang tersimpan
        fieldsContainer.innerHTML = '';
        fieldCounter = 0;
        const fields = Array.isArray(form.fields_schema) ? form.fields_schema : [];
        fields.forEach(f => createFieldCard(f.type, f.label, f.options));
        if (fields.length === 0) resetFieldsContainerToEmpty();

        // Ubah teks tombol submit & tampilkan banner mode edit
        const btnSave = document.getElementById('btn-save-template');
        if (btnSave) btnSave.textContent = '💾 Simpan Perubahan Template';

        if (!document.getElementById('mon-edit-mode-banner')) {
            const banner = document.createElement('div');
            banner.id = 'mon-edit-mode-banner';
            banner.style.cssText = 'background:#fef9c3; border:1px solid #fde047; color:#854d0e; padding:0.75rem 1rem; border-radius:6px; margin-bottom:1.5rem; font-size:0.85rem; font-weight:600;';
            banner.textContent = `✏️ Anda sedang mengedit template: "${form.title}". Klik "Reset Desain" untuk membatalkan dan membuat form baru.`;
            sectionFormBuilder.insertBefore(banner, sectionFormBuilder.firstChild);
        }
    }

    async function loadTemplateForms() {
        try {
            tbodyTemplateForms.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 2rem; color: #64748b;">Mendownload data dari server Supabase...</td>
                </tr>
            `;

            const { data, error } = await supabaseClient
                .from('monitoring_forms')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbodyTemplateForms.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding: 2rem;">
                            <div class="pel-empty-state">
                                <p style="color: #94a3b8; font-weight: 500;">Belum ada template form monitoring yang dibuat.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            loadedFormsCache = data;
            tbodyTemplateForms.innerHTML = '';
            data.forEach(form => {
                const tr = document.createElement('tr');
                
                // Hitung total komponen instan dari payload array JSONB
                const totalElements = Array.isArray(form.fields_schema) ? form.fields_schema.length : 0;

                const editButtonHtml = canManageForms()
                    ? `<button type="button" class="btn-edit-form" data-id="${form.id}" style="background:#fef9c3; color:#854d0e; border:none; padding:0.35rem 0.6rem; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:600; margin-left:0.4rem;">✏️ Edit</button>`
                    : '';

                // Membentuk susunan data presisi sebanyak 7 kolom (td) sesuai header tabel
                tr.innerHTML = `
                    <td style="font-weight:600; color:#1e293b;">${form.title}</td>
                    <td><span class="pel-badge" style="background:#f1f5f9; color:#475569; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; font-weight:600;">${form.frequency}</span></td>
                    <td>${form.target_department}</td>
                    <td style="text-align:center; font-weight:500;">${totalElements} Fields</td>
                    <td style="font-size:0.85rem; color:#6b7280;">${form.reviewer_role || '-'}</td>
                    <td><span style="color:#10b981; font-weight:700;">● ${form.status || 'Active'}</span></td>
                    <td style="text-align:center; white-space:nowrap;">
                        <button type="button" class="btn-view-form" data-id="${form.id}" style="background:#e0f2fe; color:#0369a1; border:none; padding:0.35rem 0.6rem; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:600;">👁 Lihat</button>${editButtonHtml}
                    </td>
                `;
                tbodyTemplateForms.appendChild(tr);
            });

            // Pasang event listener tombol Lihat & Edit (re-pasang setiap render karena innerHTML diganti total)
            tbodyTemplateForms.querySelectorAll('.btn-view-form').forEach(btn => {
                btn.addEventListener('click', () => openViewModal(btn.dataset.id));
            });
            tbodyTemplateForms.querySelectorAll('.btn-edit-form').forEach(btn => {
                btn.addEventListener('click', () => enterEditMode(btn.dataset.id));
            });

        } catch (err) {
            console.error('Error fetching data:', err);
            tbodyTemplateForms.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; color:#ef4444; font-weight:600; padding:2rem;">
                        ❌ Gagal memuat data: ${err.message}. Pastikan koneksi tabel Supabase sudah tepat.
                    </td>
                </tr>
            `;
        }
    }

    // Load data otomatis saat halaman pertama kali dibuka
    loadTemplateForms();
});
