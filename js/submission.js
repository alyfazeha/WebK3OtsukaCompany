/**
 * submission.js
 * Controller untuk Modul 6.3 Compliance Monitoring (Form Lapangan / Submission)
 * Programmer: Anindya Naura (Operational & Checklist Specialist)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Elemen DOM
    const selectFormTemplate = document.getElementById('select-form-template');
    const formMetaInfo = document.getElementById('form-meta-info');
    const formSubmissionMain = document.getElementById('form-submission-main');
    const submissionEmptyState = document.getElementById('submission-empty-state');
    const dynamicFieldsContainer = document.getElementById('dynamic-fields-container');
    const btnCancelSubmission = document.getElementById('btn-cancel-submission');
    const btnSubmitForm = document.getElementById('btn-submit-form');
    
    // Elemen Meteran & Display Skor (Sesuai dengan elemen baru di HTML)
    const meterPct = document.getElementById('meter-pct');
    const skorMeterFill = document.getElementById('skor-meter-fill');
    const bigSkor = document.getElementById('big-skor');
    const skorLabelText = document.getElementById('skor-label-text');

    // Variabel lokal untuk menyimpan template form yang sedang aktif dipilih
    let activeTemplates = [];
    let currentSelectedTemplate = null;

    // Set tanggal otomatis di navbar jika elemen tersedia
    if (document.getElementById('navbar-date')) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('navbar-date').textContent = new Date().toLocaleDateString('id-ID', options);
    }

    // =========================================================================
    // 2. MENGAMBIL DAFTAR TEMPLATE FORM DARI SUPABASE
    // =========================================================================
    async function fetchFormTemplates() {
        try {
            // Ambil form dengan status 'Active'
            const { data, error } = await supabaseClient
                .from('monitoring_forms')
                .select('*')
                .eq('status', 'Active')
                .order('title', { ascending: true });

            if (error) throw error;

            activeTemplates = data || [];
            
            // Bersihkan pilihan lama kecuali opsi pertama
            selectFormTemplate.innerHTML = '<option value="">-- Pilih Template Form Inspeksi --</option>';
            
            // Injeksi data ke dalam dropdown select
            activeTemplates.forEach(form => {
                const option = document.createElement('option');
                option.value = form.id;
                option.textContent = form.title;
                selectFormTemplate.appendChild(option);
            });

        } catch (err) {
            console.error('Gagal mengambil template form:', err);
            showToast('Gagal memuat daftar template form: ' + err.message, 'error');
        }
    }

    // =========================================================================
    // 3. EVENT HANDLER: SAAT USER MEMILIH TEMPLATE FORM
    // =========================================================================
    selectFormTemplate.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        
        if (!selectedId) {
            resetToEmptyState();
            return;
        }

        // Cari objek data form berdasarkan ID yang dipilih
        currentSelectedTemplate = activeTemplates.find(form => String(form.id) === String(selectedId));

        if (currentSelectedTemplate) {
            // Update informasi metadata (Frekuensi & Target Departemen)
            formMetaInfo.innerHTML = `
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-deep); display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
                    <span>🎯 Target:</span> 
                    <span style="background: #e0f2fe; border: 1px solid #bae6fd; px: 8px; padding: 2px 6px; rounded-radius: 4px; border-radius: 4px; color: var(--color-mid); font-weight: 700;">${currentSelectedTemplate.target_department}</span> 
                    <span style="color: #cbd5e1;">|</span>
                    <span>⏱️ Frekuensi:</span> 
                    <span style="background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #475569; font-weight: 700;">${currentSelectedTemplate.frequency}</span>
                </div>
                ${currentSelectedTemplate.description ? `<p style="font-size: 0.75rem; color: #9ca3af; margin-top: 6px; font-weight: 400; width: 100%; margin-bottom:0;">${currentSelectedTemplate.description}</p>` : ''}
            `;

            // Render komponen ke dalam tabel kuesioner dinamis
            renderDynamicFields(currentSelectedTemplate.fields_schema);

            // Tampilkan form utama dan sembunyikan empty state
            formSubmissionMain.style.display = 'block';
            submissionEmptyState.style.display = 'none';

            // Reset indikator skor ke awal
            calculateComplianceScore();
        }
    });

    // =========================================================================
    // 4. FUNGSI RENDERING KOMPONEN INPUT DINAMIS KE DALAM STRUKTUR TABEL
    // =========================================================================
    function renderDynamicFields(schema) {
        dynamicFieldsContainer.innerHTML = ''; 

        // Reset meteran skor
        meterPct.textContent = '0%';
        skorMeterFill.style.width = '0%';
        skorMeterFill.style.backgroundColor = 'var(--color-bright)';
        bigSkor.textContent = '0';
        skorLabelText.textContent = 'Mulai Evaluasi';
        skorLabelText.style.color = '#4b5563';
        btnSubmitForm.disabled = true;

        if (!schema || !Array.isArray(schema) || schema.length === 0) {
            dynamicFieldsContainer.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ef4444; font-style:italic; padding: 1.5rem;">⚠️ Template form ini belum memiliki komponen kuesioner.</td></tr>';
            btnSubmitForm.disabled = true;
            return;
        }

        schema.forEach((field, index) => {
            const tr = document.createElement('tr');
            tr.className = 'dynamic-field-item';
            tr.dataset.id = field.element_id;
            tr.dataset.type = field.type;
            tr.dataset.label = field.label;

            // Kolom Nomor Urut
            const tdIndex = document.createElement('td');
            tdIndex.style.textAlign = 'center';
            tdIndex.style.fontWeight = '600';
            tdIndex.style.color = '#9ca3af';
            tdIndex.textContent = index + 1;

            // Kolom Parameter Kepatuhan (Label Pertanyaan)
            const tdLabel = document.createElement('td');
            tdLabel.innerHTML = `<span style="font-weight: 500; color: #374151;">${field.label}</span> <span style="color: #ef4444;">*</span>`;

            // Kolom Opsi Jawaban (Input Status)
            const tdInput = document.createElement('td');
            tdInput.style.textAlign = 'center';

            let inputHtml = '';

            switch (field.type) {
                case 'checklist':
                    // Konsep K3: Menggunakan Pilihan Sesuai / Tidak Sesuai / N/A
                    let checklistOptions = '';
                    if (Array.isArray(field.options)) {
                        field.options.forEach((opt) => {
                            checklistOptions += `
                                <label style="inline-flex; align-items: center; margin: 0 4px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">
                                    <input type="radio" name="radio-group-${field.element_id}" value="${opt}" class="user-answer-input-radio" required style="margin-right: 4px; accent-color: var(--color-bright);">
                                    <span>${opt}</span>
                                </label>
                            `;
                        });
                    } else {
                        // Default Fallback jika opsi kosong di database
                        ['Sesuai', 'Tidak Sesuai'].forEach(opt => {
                            checklistOptions += `
                                <label style="inline-flex; align-items: center; margin: 0 4px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">
                                    <input type="radio" name="radio-group-${field.element_id}" value="${opt}" class="user-answer-input-radio" required style="margin-right: 4px; accent-color: var(--color-bright);">
                                    <span>${opt}</span>
                                </label>
                            `;
                        });
                    }
                    inputHtml = `<div style="display:flex; justify-content:center; gap:8px;">${checklistOptions}</div>`;
                    break;

                case 'rating':
                    let ratingOptions = `<select class="user-answer-input" required style="width:100%; max-width:120px; padding: 4px 8px; font-size:0.8rem; border-radius:6px; border:1px solid #cbd5e1;">`;
                    ratingOptions += `<option value="">-- Pilih --</option>`;
                    for (let i = 1; i <= 5; i++) {
                        ratingOptions += `<option value="${i}">${i} Star</option>`;
                    }
                    ratingOptions += `</select>`;
                    inputHtml = ratingOptions;
                    break;

                case 'dropdown':
                    let dropdownOptions = `<select class="user-answer-input" required style="width:100%; padding: 4px 8px; font-size:0.8rem; border-radius:6px; border:1px solid #cbd5e1;">`;
                    dropdownOptions += `<option value="">-- Pilih --</option>`;
                    if (Array.isArray(field.options)) {
                        field.options.forEach(opt => {
                            dropdownOptions += `<option value="${opt}">${opt}</option>`;
                        });
                    }
                    dropdownOptions += `</select>`;
                    inputHtml = dropdownOptions;
                    break;

                case 'number':
                    inputHtml = `<input type="number" class="user-answer-input" placeholder="0" required style="width:80px; text-align:center; padding: 4px 8px; font-size:0.8rem; border-radius:6px; border:1px solid #cbd5e1;">`;
                    break;

                case 'text':
                default:
                    inputHtml = `<input type="text" class="user-answer-input" placeholder="Catatan Lapangan..." required style="width:100%; padding: 4px 8px; font-size:0.8rem; border-radius:6px; border:1px solid #cbd5e1;">`;
                    break;
            }

            tdInput.innerHTML = inputHtml;

            tr.appendChild(tdIndex);
            tr.appendChild(tdLabel);
            tr.appendChild(tdInput);
            dynamicFieldsContainer.appendChild(tr);
        });

        // Daftarkan listener kalkulator skor otomatis secara real-time saat jawaban diubah
        attachRealtimeScoreCalculator();
    }

    // =========================================================================
    // 5. SISTEM KALKULATOR SKOR REAL-TIME KEPATUHAN K3
    // =========================================================================
    function attachRealtimeScoreCalculator() {
        // Deteksi perubahan input text/dropdown/number
        dynamicFieldsContainer.querySelectorAll('.user-answer-input').forEach(input => {
            input.addEventListener('change', calculateComplianceScore);
            input.addEventListener('input', calculateComplianceScore);
        });

        // Deteksi perubahan input radio (checklist/rating)
        dynamicFieldsContainer.querySelectorAll('.user-answer-input-radio').forEach(radio => {
            radio.addEventListener('change', calculateComplianceScore);
        });
    }

    function calculateComplianceScore() {
        const dynamicItems = dynamicFieldsContainer.querySelectorAll('.dynamic-field-item');
        if (dynamicItems.length === 0) return;

        const totalQuestions = dynamicItems.length;
        let answeredQuestions = 0;
        let compliantAnswers = 0;

        dynamicItems.forEach(item => {
            const type = item.dataset.type;
            const fieldId = item.dataset.id;

            // Cari schema field ini dari template aktif
            const fieldSchema = currentSelectedTemplate?.fields_schema?.find(
                f => String(f.element_id) === String(fieldId)
            );

            if (type === 'checklist') {
                const checkedRadio = item.querySelector('.user-answer-input-radio:checked');
                if (checkedRadio) {
                    answeredQuestions++;
                    // Opsi pertama dari schema = jawaban positif/patuh
                    const firstOption = Array.isArray(fieldSchema?.options) && fieldSchema.options.length > 0
                        ? fieldSchema.options[0]
                        : null;
                    const positifFallback = ['Sesuai', 'Aman', 'Ya', 'Ada', 'OK', 'Baik', 'Layak', 'Tersedia'];
                    const isCompliant = firstOption
                        ? checkedRadio.value === firstOption
                        : positifFallback.includes(checkedRadio.value);
                    if (isCompliant) compliantAnswers++;
                }

            } else if (type === 'dropdown') {
                const selectEl = item.querySelector('.user-answer-input');
                if (selectEl && selectEl.value) {
                    answeredQuestions++;
                    // Opsi pertama dari schema = jawaban positif/patuh
                    const firstOption = Array.isArray(fieldSchema?.options) && fieldSchema.options.length > 0
                        ? fieldSchema.options[0]
                        : null;
                    if (firstOption && selectEl.value === firstOption) compliantAnswers++;
                    else if (!firstOption) compliantAnswers++; // tidak ada referensi, anggap patuh
                }

            } else if (type === 'rating') {
                const selectEl = item.querySelector('.user-answer-input');
                if (selectEl && selectEl.value) {
                    answeredQuestions++;
                    if (parseInt(selectEl.value) >= 4) compliantAnswers++;
                }

            } else if (type === 'number') {
                const inputEl = item.querySelector('.user-answer-input');
                if (inputEl && inputEl.value.trim() !== '') {
                    answeredQuestions++;
                    // Nilai > 0 dianggap patuh (bisa disesuaikan)
                    if (parseFloat(inputEl.value) > 0) compliantAnswers++;
                }

            } else {
                // type === 'text' dan tipe lainnya: diisi = patuh
                const inputEl = item.querySelector('.user-answer-input');
                if (inputEl && inputEl.value.trim() !== '') {
                    answeredQuestions++;
                    compliantAnswers++;
                }
            }
        });

        // Hitung persentase — hindari pembagian dengan 0
        const finalPercentage = totalQuestions > 0
            ? Math.round((compliantAnswers / totalQuestions) * 100)
            : 0;

        // Update DOM meteran skor
        meterPct.textContent = `${finalPercentage}%`;
        skorMeterFill.style.width = `${finalPercentage}%`;
        bigSkor.textContent = finalPercentage;

        if (finalPercentage >= 85) {
            skorMeterFill.style.backgroundColor = '#0e9f6e';
            skorLabelText.textContent = 'Kepatuhan Tinggi (Aman)';
            skorLabelText.style.color = '#0e9f6e';
        } else if (finalPercentage >= 60) {
            skorMeterFill.style.backgroundColor = '#e3a008';
            skorLabelText.textContent = 'Kepatuhan Sedang (Peringatan)';
            skorLabelText.style.color = '#e3a008';
        } else {
            skorMeterFill.style.backgroundColor = '#f05252';
            skorLabelText.textContent = 'Kepatuhan Rendah (Bahaya)';
            skorLabelText.style.color = '#f05252';
        }

        // Aktifkan tombol submit hanya jika semua soal sudah dijawab
        btnSubmitForm.disabled = answeredQuestions < totalQuestions;
    }

    // =========================================================================
    // 6. PENGIRIMAN DATA HASIL EVALUASI KE SUPABASE
    // =========================================================================
    formSubmissionMain.addEventListener('submit', async (e) => {
        e.preventDefault();

        const inspectorName = document.getElementById('inspector-name').value.trim();
        const inspectorDept = document.getElementById('inspector-dept').value;

        if (!inspectorName || !inspectorDept || !currentSelectedTemplate) {
            showToast('Mohon lengkapi identitas pelaksana inspeksi terlebih dahulu!', 'warning');
            return;
        }

        const answersPayload = [];
        const dynamicItems = dynamicFieldsContainer.querySelectorAll('.dynamic-field-item');

        dynamicItems.forEach(item => {
            const elementId = item.dataset.id;
            const type = item.dataset.type;
            const label = item.dataset.label;
            let finalValue = '';

            if (type === 'checklist') {
                const checkedRadio = item.querySelector('.user-answer-input-radio:checked');
                if (checkedRadio) finalValue = checkedRadio.value;
            } else {
                const normalInput = item.querySelector('.user-answer-input');
                if (normalInput) finalValue = normalInput.value.trim();
            }

            answersPayload.push({
                element_id: elementId,
                label: label,
                type: type,
                value: finalValue
            });
        });

        // Ambil nilai akhir skor dari teks display
        const finalScoreCalculated = parseInt(bigSkor.textContent) || 0;

        try {
            const { data, error } = await supabaseClient
                .from('monitoring_submissions')
                .insert([
                    {
                        form_id           : currentSelectedTemplate.id,
                        form_title        : currentSelectedTemplate.title,
                        submitted_by      : inspectorName,
                        department        : inspectorDept,
                        submitted_answers : answersPayload,
                        score             : finalScoreCalculated,
                        status            : finalScoreCalculated >= 60 ? 'Compliant' : 'Non-Compliant',
                        submitted_at      : new Date().toISOString()
                    }
                ]);

            if (error) throw error;

            showToast('🎉 Sukses! Hasil inspeksi lapangan K3-IMS berhasil dikirim ke server data pusat.', 'success');
            formSubmissionMain.reset();
            resetToEmptyState();

        } catch (err) {
            console.error('Error saving submission to Supabase:', err);
            showToast('Gagal mengirimkan data ke Supabase: ' + err.message, 'error');
        }
    });

    function resetToEmptyState() {
        formSubmissionMain.style.display = 'none';
        submissionEmptyState.style.display = 'block';
        selectFormTemplate.value = '';
        formMetaInfo.innerHTML = 'Silakan pilih template form di samping untuk memuat info target.';
        dynamicFieldsContainer.innerHTML = '';
        currentSelectedTemplate = null;

        // Reset display meteran skor ke default
        meterPct.textContent = '0%';
        skorMeterFill.style.width = '0%';
        skorMeterFill.style.backgroundColor = 'var(--color-bright)';
        bigSkor.textContent = '0';
        skorLabelText.textContent = 'Mulai Evaluasi';
        skorLabelText.style.color = '#4b5563';
        btnSubmitForm.disabled = true;
    }

    btnCancelSubmission.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin membatalkan pengisian form monitoring ini? Semua isian sementara akan hilang.')) {
            formSubmissionMain.reset();
            resetToEmptyState();
        }
    });

    // Helper: Sistem Toast Alert Elegan pengganti default alert()
    function showToast(message, type = 'success') {
        const container = document.getElementById('pel-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `pel-toast ${type}`;
        toast.style.cssText = `
            padding: 12px 20px;
            margin-top: 10px;
            border-radius: 8px;
            color: white;
            font-size: 0.85rem;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: fadeIn 0.3s ease;
            background-color: ${type === 'success' ? '#0e9f6e' : type === 'warning' ? '#e3a008' : '#f05252'};
        `;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    fetchFormTemplates();
});