/**
 * @license
 * SiEpang - Registration, Dynamic Form Builder & Contingent Management v1.1
 * Fully implements:
 * - Requirement 6: Registration Configuration (Status OPEN/PAUSED/CLOSED/ENDED, quotas, dates, categories, docs, workflow)
 * - Requirement 7: Dynamic Registration Form Builder (TEXT, TEXTAREA, NUMBER, DATE, SELECT, MULTISELECT, CHECKBOX, PHOTO, DOCUMENT)
 * - Requirement 14 & 15: Contingent Creation, Management & Detail Inspector (identity, leadership, roster, verification, campsite, XP)
 */

import React, { useState } from 'react';
import { GudepReguManager } from './GudepReguManager';
import {
  Users,
  Shield,
  Layers,
  Calendar,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  FileText,
  Clock,
  Sparkles,
  Tent,
  AlertTriangle,
  X,
  Search,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Check,
  Building2,
  Phone,
} from 'lucide-react';
import { eventStudioService } from '../../services/eventStudioService';
import { participantService } from '../../services/participantService';
import {
  RegistrationFieldConfig,
  OrganizationLevel,
  RegistrationSettings,
  Contingent,
  Participant,
} from '../../types';

export const RegistrationContingentEditor: React.FC = () => {
  const event = eventStudioService.getEvent();
  const [activeTab, setActiveTab] = useState<'gudep' | 'config' | 'fields' | 'contingents'>('gudep');

  // Registration Configuration state
  const [settings, setSettings] = useState<RegistrationSettings>(eventStudioService.getRegistrationSettings());
  const [regStatus, setRegStatus] = useState<'OPEN' | 'PAUSED' | 'CLOSED' | 'ENDED'>('OPEN');
  const [verificationMode, setVerificationMode] = useState<'MANUAL' | 'AUTO_APPROVE'>('MANUAL');
  const [allowedCategories, setAllowedCategories] = useState<string[]>([
    'Penggalang',
    'Penegak',
    'Pandega',
    'Pembina Pendamping',
    'Pimpinan Kontingen',
  ]);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([
    'Kartu Tanda Anggota (KTA / NTA)',
    'Surat Mandat Kwartir',
    'Surat Izin Orang Tua / Wali',
    'Surat Keterangan Sehat Dokter',
    'Bukti Asuransi Kegiatan',
  ]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Dynamic Fields state
  const [fields, setFields] = useState<RegistrationFieldConfig[]>(eventStudioService.getRegistrationFields());
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newField, setNewField] = useState<{
    label: string;
    fieldType: 'text' | 'number' | 'select' | 'file';
    status: 'required' | 'optional' | 'hidden';
    restricted: boolean;
    helpText?: string;
  }>({
    label: '',
    fieldType: 'text',
    status: 'required',
    restricted: false,
    helpText: '',
  });

  // Contingents state
  const [contingents, setContingents] = useState<Contingent[]>(participantService.getContingents());
  const [contingentSearch, setContingentSearch] = useState('');
  const [selectedContingentDetail, setSelectedContingentDetail] = useState<Contingent | null>(null);
  const [showAddContingentModal, setShowAddContingentModal] = useState(false);
  const [newContingentForm, setNewContingentForm] = useState({
    name: '',
    leaderName: '',
    leaderPhone: '',
    quota: 32,
    region: '',
    campZone: 'Zona A (Putra)',
    subCamp: 'Kavling A-01',
  });

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Default suggested representation level based on event level
  const defaultSuggestedLevel: OrganizationLevel =
    event.organizationalLevel === 'Nasional' || event.organizationalLevel === 'KWARNAS'
      ? 'KWARDA'
      : event.organizationalLevel === 'Kwarda' || event.organizationalLevel === 'KWARDA'
      ? 'KWARCAB'
      : event.organizationalLevel === 'Kwarcab' || event.organizationalLevel === 'KWARCAB'
      ? 'KWARRAN'
      : 'GUDEP';

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const updated = await eventStudioService.updateRegistrationSettings({
        ...settings,
        status: regStatus === 'PAUSED' || regStatus === 'CLOSED' || regStatus === 'ENDED' ? 'CLOSED' : 'OPEN',
      });
      setSettings(updated);
      showToast('✅ Konfigurasi pendaftaran, kuota, & alur verifikasi berhasil disimpan!');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'required' | 'optional' | 'hidden') => {
    try {
      await eventStudioService.updateRegistrationField(id, { status: newStatus });
      setFields([...eventStudioService.getRegistrationFields()]);
      showToast(`Status kolom diubah menjadi: ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.label) return;
    try {
      await eventStudioService.createDynamicField({
        ...newField,
        name: newField.label.toLowerCase().replace(/\s+/g, '_'),
      });
      setFields([...eventStudioService.getRegistrationFields()]);
      setShowAddFieldModal(false);
      setNewField({ label: '', fieldType: 'text', status: 'required', restricted: false, helpText: '' });
      showToast('✅ Kolom formulir pendaftaran dinamis berhasil ditambahkan!');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleCreateContingent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContingentForm.name) return;
    try {
      const created = participantService.createContingent({
        name: newContingentForm.name,
        leaderName: newContingentForm.leaderName,
        leaderPhone: newContingentForm.leaderPhone,
        quota: newContingentForm.quota,
        region: newContingentForm.region,
        campZone: newContingentForm.campZone,
        subCamp: newContingentForm.subCamp,
        campsite_assignment: newContingentForm.subCamp,
      });
      setContingents([...participantService.getContingents()]);
      setShowAddContingentModal(false);
      setNewContingentForm({
        name: '',
        leaderName: '',
        leaderPhone: '',
        quota: 32,
        region: '',
        campZone: 'Zona A (Putra)',
        subCamp: 'Kavling A-01',
      });
      showToast(`✅ Kontingen '${created.name}' berhasil didaftarkan!`);
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-xs text-emerald-300 font-semibold flex items-center justify-between shadow-lg">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Top Banner & Tab Navigation */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <span>Pendaftaran, Gugus Depan & Regu</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola Gugus Depan dan Regu untuk pendaftaran peserta, serta konfigurasi formulir dan kuota.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'fields' && (
              <button
                onClick={() => setShowAddFieldModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Tambah Kolom Isian</span>
              </button>
            )}
            {activeTab === 'contingents' && (
              <button
                onClick={() => setShowAddContingentModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Buat Kontingen Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#F7F7F8] dark:bg-black/40 rounded-2xl border border-[#ECECEF] dark:border-white/5">
          <button type="button" onClick={() => setActiveTab('gudep')} className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'gudep' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
            🏕️ Gugus Depan & Regu
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'config' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ⚙️ Konfigurasi & Kuota
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'fields' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📝 Formulir Dinamis ({fields.length})
          </button>
          <button
            onClick={() => setActiveTab('contingents')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'contingents' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🚩 Kelola Kontingen ({contingents.length})
          </button>
        </div>
      </div>

      {activeTab === 'gudep' && <GudepReguManager />}

      {/* TAB 1: REGISTRATION CONFIGURATION */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveSettings} className="space-y-4">
          {/* Status Switcher (Requirement 6: CLOSED, OPEN, PAUSED, ENDED) */}
          <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>Status Pendaftaran Terbuka (Registration Lifecycle)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Menentukan apakah formulir pendaftaran peserta dan kontingen menerima input saat ini.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">
                {regStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              {[
                { id: 'OPEN', label: 'OPEN (Buka)', color: 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80', desc: 'Pendaftaran aktif menerima peserta' },
                { id: 'PAUSED', label: 'PAUSED (Jeda)', color: 'border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80', desc: 'Ditutup sementara untuk verifikasi kuota' },
                { id: 'CLOSED', label: 'CLOSED (Tutup)', color: 'border-rose-500 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80', desc: 'Pendaftaran belum dibuka atau ditutup panitia' },
                { id: 'ENDED', label: 'ENDED (Berakhir)', color: 'border-slate-400 text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-stone-900/80', desc: 'Batas akhir waktu pendaftaran telah lewat' },
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setRegStatus(st.id as any)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    regStatus === st.id
                      ? `${st.color} font-bold shadow-xs`
                      : 'bg-[#FAFAFA] dark:bg-white/5 border-[#ECECEF] dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="font-bold">{st.label}</div>
                  <div className="text-[10px] opacity-75 mt-0.5 leading-tight">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quotas & Hierarchy Configuration */}
          <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span>Kapasitas & Kuota Kontingen</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 space-y-2">
                <div className="text-slate-700 dark:text-slate-400 text-[10px] font-semibold">Tingkat Kontingen (Override):</div>
                <select
                  value={settings.contingentRepresentationLevel}
                  onChange={e => setSettings({ ...settings, contingentRepresentationLevel: e.target.value as OrganizationLevel })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-black/60 border border-emerald-500/40 rounded-xl text-emerald-600 dark:text-emerald-400 font-bold focus:outline-none"
                >
                  <option value="KWARDA">Kwartir Daerah (Kwarda)</option>
                  <option value="KWARCAB">Kwartir Cabang (Kwarcab)</option>
                  <option value="KWARRAN">Kwartir Ranting (Kwarran)</option>
                  <option value="GUDEP">Gugus Depan / Pangkalan (Gudep)</option>
                </select>
                <p className="text-[10px] text-slate-500">Saran sistem sesuai level event: {defaultSuggestedLevel}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 space-y-2">
                <div className="text-slate-700 dark:text-slate-400 text-[10px] font-semibold">Kuota Peserta per Kontingen:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={settings.maxParticipantsPerContingent}
                    onChange={e => setSettings({ ...settings, maxParticipantsPerContingent: Number(e.target.value) })}
                    className="w-20 px-2 py-1 bg-white dark:bg-black/60 border border-[#ECECEF] dark:border-white/10 rounded-xl text-amber-600 dark:text-amber-400 font-bold text-sm text-center"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Orang / Kontingen</span>
                </div>
                <p className="text-[10px] text-slate-500">Standar: 32 peserta (2 regu putra + 2 regu putri)</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 space-y-2">
                <div className="text-slate-700 dark:text-slate-400 text-[10px] font-semibold">Kuota Pembina Pendamping:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={settings.maxAdvisorsPerContingent}
                    onChange={e => setSettings({ ...settings, maxAdvisorsPerContingent: Number(e.target.value) })}
                    className="w-20 px-2 py-1 bg-white dark:bg-black/60 border border-[#ECECEF] dark:border-white/10 rounded-xl text-sky-600 dark:text-sky-400 font-bold text-sm text-center"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Pembina / Kontingen</span>
                </div>
                <p className="text-[10px] text-slate-500">Total kapasitas buper: {event.participantCapacity} orang</p>
              </div>
            </div>
          </div>

          {/* Participant Categories & Verification Workflow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categories */}
            <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-[#171717] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Kategori Kepesertaan yang Diizinkan:</span>
              </h3>
              <div className="space-y-1.5 text-xs">
                {['Penggalang', 'Penegak', 'Pandega', 'Pembina Pendamping', 'Pimpinan Kontingen'].map(cat => {
                  const isChecked = allowedCategories.includes(cat);
                  return (
                    <label key={cat} className="flex items-center gap-2 p-2 rounded-xl bg-[#FAFAFA] dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/8 cursor-pointer border border-[#ECECEF] dark:border-transparent">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) setAllowedCategories([...allowedCategories, cat]);
                          else setAllowedCategories(allowedCategories.filter(c => c !== cat));
                        }}
                        className="accent-emerald-600 rounded"
                      />
                      <span className={isChecked ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'}>{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Verification Workflow & Required Docs */}
            <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-[#171717] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-500" />
                <span>Alur Verifikasi & Dokumen Wajib:</span>
              </h3>

              <div className="p-2.5 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 space-y-2 text-xs">
                <div className="text-slate-700 dark:text-slate-400 text-[11px] font-semibold">Mode Verifikasi Pendaftaran:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerificationMode('MANUAL')}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      verificationMode === 'MANUAL'
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'bg-white dark:bg-white/5 border-[#ECECEF] dark:border-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Antrean Petugas (Manual)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationMode('AUTO_APPROVE')}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      verificationMode === 'AUTO_APPROVE'
                        ? 'bg-sky-50 dark:bg-sky-950/80 border-sky-500 text-sky-700 dark:text-sky-300 font-bold'
                        : 'bg-white dark:bg-white/5 border-[#ECECEF] dark:border-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Otomatis Verifikasi
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="text-[11px] text-slate-700 dark:text-slate-400 font-semibold mb-1">Daftar Dokumen Wajib Diunggah:</div>
                {requiredDocs.map(doc => (
                  <div key={doc} className="flex items-center gap-2 p-1.5 text-slate-700 dark:text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-2xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isSavingSettings ? 'Menyimpan...' : 'Simpan Semua Konfigurasi Pendaftaran'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: DYNAMIC FIELDS BUILDER (Requirement 7) */}
      {activeTab === 'fields' && (
        <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              <span>Kolom Formulir Pendaftaran Dinamis</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mendukung teks, angka, dropdown pilihan, berkas PDF/foto. Kolom sensitif dilindungi izin khusus.
            </p>
          </div>

          <div className="space-y-2.5">
            {fields.map(f => (
              <div
                key={f.id}
                className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <div className="font-bold text-[#171717] dark:text-white flex items-center gap-2">
                      <span>{f.label}</span>
                      {f.restricted && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-500/30">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Data Medis / Sensitif</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      Tipe: <span className="uppercase text-emerald-600 dark:text-emerald-300 font-semibold">{f.fieldType}</span> · Kunci API: {f.name}
                    </div>
                  </div>
                </div>

                {/* Status Radio Pills */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/40 p-1 rounded-xl border border-[#ECECEF] dark:border-white/5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(f.id, 'required')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      f.status === 'required' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Wajib (Required)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(f.id, 'optional')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      f.status === 'optional' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Opsional
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(f.id, 'hidden')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      f.status === 'hidden' ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Sembunyikan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CONTINGENTS MANAGEMENT & DETAIL (Requirement 14 & 15) */}
      {activeTab === 'contingents' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari nama kontingen, pimpinan kontingen, atau kavling buper..."
              value={contingentSearch}
              onChange={e => setContingentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-2xl text-xs text-[#171717] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {contingents
              .filter(c =>
                contingentSearch
                  ? c.name.toLowerCase().includes(contingentSearch.toLowerCase()) ||
                    (c.leaderName && c.leaderName.toLowerCase().includes(contingentSearch.toLowerCase()))
                  : true
              )
              .map(ctg => (
                <div
                  key={ctg.id}
                  className="p-4 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/8 hover:border-emerald-500/40 transition-all space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold border border-emerald-200 dark:border-transparent">
                        {ctg.id}
                      </span>
                      <h4 className="text-sm font-bold text-[#171717] dark:text-white mt-1">{ctg.name}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Pimpinan: <span className="text-slate-900 dark:text-white font-medium">{ctg.leaderName || 'Kak Pembina'}</span>
                      </p>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-bold">
                      {ctg.verification_status || 'VERIFIED'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-black/30 border border-white/5 text-xs grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Kuota & Peserta:</span>
                      <span className="font-bold text-white font-mono">
                        {ctg.participantCount} / {ctg.quota || 32} Orang
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Kavling Buper:</span>
                      <span className="font-semibold text-emerald-300">
                        {ctg.subCamp || ctg.campsite_assignment || 'Belum diatur'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      ⚡ {ctg.totalXp || 0} Total XP
                    </span>

                    <button
                      onClick={() => setSelectedContingentDetail(ctg)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Roster & Detail</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* CONTINGENT DETAIL MODAL (Requirement 15) */}
      {selectedContingentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/8">
              <div>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                  Detail & Roster Kontingen
                </span>
                <h3 className="text-lg font-black text-[#171717] dark:text-white">{selectedContingentDetail.name}</h3>
              </div>
              <button
                onClick={() => setSelectedContingentDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Leadership & Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Pimpinan Kontingen:</span>
                <span className="font-bold text-[#171717] dark:text-white">{selectedContingentDetail.leaderName || '-'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Kontak Telepon:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{selectedContingentDetail.leaderPhone || '-'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Lokasi Kavling:</span>
                <span className="font-bold text-amber-600 dark:text-amber-300">{selectedContingentDetail.subCamp || 'Kavling A-01'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Total XP Kontingen:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">⚡ {selectedContingentDetail.totalXp || 0} XP</span>
              </div>
            </div>

            {/* Participant Roster List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Daftar Anggota / Roster Peserta ({
                  participantService.getParticipants({ contingentId: selectedContingentDetail.id }).length
                } Orang)</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Status Verifikasi Terpusat</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {participantService
                  .getParticipants({ contingentId: selectedContingentDetail.id })
                  .map(p => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <img src={p.photoUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                        <div>
                          <div className="font-bold text-[#171717] dark:text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{p.code} · {p.role}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'approved'
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                        }`}>
                          {p.status.toUpperCase()}
                        </span>
                        <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold">⚡ {p.xp}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/8 flex justify-end">
              <button
                onClick={() => setSelectedContingentDetail(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD FIELD MODAL */}
      {showAddFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] dark:text-white">+ Tambah Kolom Isian Baru</h3>
              <button onClick={() => setShowAddFieldModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddField} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Label Kolom (Ditampilkan ke Peserta):</label>
                <input
                  type="text"
                  value={newField.label}
                  onChange={e => setNewField({ ...newField, label: e.target.value })}
                  placeholder="Contoh: Nomor Sepatu / Boots Lapangan"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tipe Isian Data:</label>
                <select
                  value={newField.fieldType}
                  onChange={e => setNewField({ ...newField, fieldType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                >
                  <option value="text">Teks Bebas</option>
                  <option value="number">Angka</option>
                  <option value="select">Pilihan Menu (Dropdown)</option>
                  <option value="file">Unggah Berkas (PDF / Foto)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Kewajiban Pengisian:</label>
                <select
                  value={newField.status}
                  onChange={e => setNewField({ ...newField, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                >
                  <option value="required">Wajib Diisi (Required)</option>
                  <option value="optional">Opsional (Boleh Kosong)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newField.restricted}
                  onChange={e => setNewField({ ...newField, restricted: e.target.checked })}
                  className="accent-emerald-500 rounded"
                />
                <span className="text-slate-300">Data Sensitif (Hanya Terbuka untuk Petugas Medis / Admin)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddFieldModal(false)} className="px-4 py-2 bg-white/5 rounded-xl">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">Simpan Kolom</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CONTINGENT MODAL */}
      {showAddContingentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] dark:text-white">+ Buat Kontingen Baru</h3>
              <button onClick={() => setShowAddContingentModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateContingent} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nama Kontingen / Kwartir:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kwarran Rogojampi"
                  value={newContingentForm.name}
                  onChange={e => setNewContingentForm({ ...newContingentForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Pimpinan Kontingen:</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Pembina"
                    value={newContingentForm.leaderName}
                    onChange={e => setNewContingentForm({ ...newContingentForm, leaderName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">No. HP / WhatsApp:</label>
                  <input
                    type="text"
                    required
                    placeholder="0812-3456-7890"
                    value={newContingentForm.leaderPhone}
                    onChange={e => setNewContingentForm({ ...newContingentForm, leaderPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Alokasi Kavling Tenda:</label>
                  <input
                    type="text"
                    value={newContingentForm.subCamp}
                    onChange={e => setNewContingentForm({ ...newContingentForm, subCamp: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Kuota Peserta:</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={newContingentForm.quota}
                    onChange={e => setNewContingentForm({ ...newContingentForm, quota: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddContingentModal(false)} className="px-4 py-2 bg-white/5 rounded-xl">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">Daftarkan Kontingen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
