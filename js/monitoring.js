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

    let fieldCounter = 0;

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
        // Hapus empty state bawaan jika komponen pertama dimasukkan
        const emptyState = fieldsContainer.querySelector('.mon-fields-empty-state');
        if (emptyState) emptyState.remove();

        fieldCounter++;
        const selectedType = builderFieldType.value;
        const selectedText = builderFieldType.options[builderFieldType.selectedIndex].text;

        // Wadah kartu komponen field
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'mon-field-card';
        fieldWrapper.dataset.id = fieldCounter;
        fieldWrapper.dataset.type = selectedType;
        fieldWrapper.style.cssText = "background: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; padding: 1.25rem; border-radius: 6px; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1rem;";

        // Generate konten internal kartu berdasarkan tipe input
        let dynamicSubInput = '';
        if (selectedType === 'dropdown' || selectedType === 'checklist') {
            dynamicSubInput = `
                <div style="margin-top: 0.75rem;">
                    <label style="font-size: 0.8rem; font-weight: 600; color: #4b5563;">Opsi Pilihan (Pisahkan dengan koma) <span style="color:red">*</span></label>
                    <input type="text" class="field-options" placeholder="Contoh: Baik, Rusak, Butuh Perbaikan" style="width:100%; padding:0.4rem; font-size:0.85rem; border:1px solid #cbd5e1; border-radius:4px; margin-top:0.25rem;" required />
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
                        <input type="text" class="field-label" placeholder="Masukkan instruksi pengecekan lapangan..." style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:4px; margin-top:0.25rem;" required />
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
    });

    function resetFieldsContainerToEmpty() {
        fieldsContainer.innerHTML = `
            <div class="mon-fields-empty-state" style="text-align: center; padding: 3rem 1rem; border: 2px dashed #e2e8f0; border-radius: 8px; color: #94a3b8;">
                <p style="margin: 0; font-weight: 500;">Belum ada komponen yang ditambahkan.</p>
                <p style="font-size: 0.85rem; margin-top: 0.25rem;">Silakan pilih tipe komponen di atas lalu klik "Sisipkan Field".</p>
            </div>
        `;
        fieldCounter = 0;
    }

    btnResetBuilder.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin mengosongkan seluruh rancangan form ini?')) {
            formBuilderMain.reset();
            resetFieldsContainerToEmpty();
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

        // Validasi kelengkapan data dasar (Kolom NOT NULL)
        if (!title || !frequency || !targetDept) {
            alert('Mohon lengkapi seluruh field identitas utama form!');
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
            // Pengiriman murni properti yang ada di struktur database Anda
            const { data, error } = await supabaseClient
                .from('monitoring_forms')
                .insert([
                    {
                        title: title,
                        frequency: frequency,
                        target_department: targetDept,
                        description: description,
                        fields_schema: structurePayload, // Payload JSONB otomatis masuk dengan aman
                        created_by: 'Anindya Naura (Operational & Checklist Specialist)',
                        status: 'Active'
                    }
                ]);

            if (error) throw error;

            alert('🎉 Sukses! Template Form Checklist K3 berhasil diterbitkan dan masuk ke sistem penjadwalan.');
            formBuilderMain.reset();
            resetFieldsContainerToEmpty();
            switchTab('list'); // Pindah otomatis ke tab list riwayat setelah sukses

        } catch (err) {
            console.error('Error saving data to Supabase:', err);
            alert('Terjadi kesalahan sistem saat menyimpan ke Supabase: ' + err.message);
        }
    });

    // =========================================================================
    // 5. PENAMPILAN DATA SECARA DINAMIS DARI SUPABASE
    // =========================================================================
    async function loadTemplateForms() {
        try {
            tbodyTemplateForms.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding: 2rem; color: #64748b;">Mendownload data dari server Supabase...</td>
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
                        <td colspan="6" style="text-align:center; padding: 2rem;">
                            <div class="pel-empty-state">
                                <p style="color: #94a3b8; font-weight: 500;">Belum ada template form monitoring yang dibuat.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbodyTemplateForms.innerHTML = '';
            data.forEach(form => {
                const tr = document.createElement('tr');
                
                // Hitung total komponen instan dari payload array JSONB
                const totalElements = Array.isArray(form.fields_schema) ? form.fields_schema.length : 0;

                // Membentuk susunan data presisi sebanyak 6 kolom (td) 
                tr.innerHTML = `
                    <td style="font-weight:600; color:#1e293b;">${form.title}</td>
                    <td><span class="pel-badge" style="background:#f1f5f9; color:#475569; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; font-weight:600;">${form.frequency}</span></td>
                    <td>${form.target_department}</td>
                    <td style="text-align:center; font-weight:500;">${totalElements} Fields</td>
                    <td style="font-size:0.85rem; color:#6b7280;">${form.created_by || 'System'}</td>
                    <td><span style="color:#10b981; font-weight:700;">● ${form.status || 'Active'}</span></td>
                `;
                tbodyTemplateForms.appendChild(tr);
            });

        } catch (err) {
            console.error('Error fetching data:', err);
            tbodyTemplateForms.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; color:#ef4444; font-weight:600; padding:2rem;">
                        ❌ Gagal memuat data: ${err.message}. Pastikan koneksi tabel Supabase sudah tepat.
                    </td>
                </tr>
            `;
        }
    }

    // Load data otomatis saat halaman pertama kali dibuka
    loadTemplateForms();
});