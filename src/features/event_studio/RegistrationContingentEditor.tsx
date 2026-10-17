/**
 * @license
 * SiEpang - Registration, Dynamic Form Builder & Contingent Management v1.1
 * Fully implements:
 * - Requirement 6: Registration Configuration (Status OPEN/PAUSED/CLOSED/ENDED, quotas, dates, categories, docs, workflow)
 * - Requirement 7: Dynamic Registration Form Builder (TEXT, TEXTAREA, NUMBER, DATE, SELECT, MULTISELECT, CHECKBOX, PHOTO, DOCUMENT)
 * - Requirement 14 & 15: Contingent Creation, Management & Detail Inspector (identity, leadership, roster, verification, campsite, XP)
 */

import React, { useEffect, useState } from 'react';
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
import { gudepRegistrationService, GudepRecord, GudepDetail } from '../../services/gudepRegistrationService';
import { authService } from '../../services/authService';
import {
  RegistrationFieldConfig,
  OrganizationLevel,
  RegistrationSettings,
} from '../../types';

export const RegistrationContingentEditor: React.FC = () => {
  const event = eventStudioService.getEvent();
  const [activeTab, setActiveTab] = useState<'config' | 'fields' | 'contingents'>('config');
  const currentRole = authService.getCurrentUser()?.role || 'viewer';
  const canVerifyAdministratively = ['superadmin','workspace_admin','event_admin','registration_officer'].includes(currentRole);

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

  // Event-specific Gudep/contingent data is loaded from GAS, not local arrays.
  const [gudepRecords, setGudepRecords] = useState<GudepRecord[]>([]);
  const [gudepLoading, setGudepLoading] = useState(false);
  const [gudepDetail, setGudepDetail] = useState<GudepDetail | null>(null);
  const [selectedGudep, setSelectedGudep] = useState<GudepRecord | null>(null);
  const [contingentSearch, setContingentSearch] = useState('');
  const [showAddContingentModal, setShowAddContingentModal] = useState(false);
  const [isCreatingGudep, setIsCreatingGudep] = useState(false);
  const [isSyncingContingents, setIsSyncingContingents] = useState(false);
  const [newGudepForm, setNewGudepForm] = useState({
    gudep_number: '', gudep_name: '', institution_name: '', address: '',
    contact_name: '', contact_phone: '', contact_email: '',
  });

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadGudepRecords = async () => {
    setGudepLoading(true);
    try {
      const result = await gudepRegistrationService.list();
      setGudepRecords(Array.isArray(result.gudep) ? result.gudep : []);
    } catch (err: any) {
      showToast(`❌ Gagal memuat data Gudep/Kontingen dari GAS: ${err?.message || 'Kesalahan tidak diketahui'}`);
    } finally {
      setGudepLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'contingents') void loadGudepRecords();
  }, [activeTab]);

  const handleContingentDecision = async (g: GudepRecord, decision: 'VERIFIED' | 'REVISION' | 'REJECTED') => {
    if (!canVerifyAdministratively) { showToast('Keputusan verifikasi hanya dapat dilakukan panitia/admin.'); return; }
    const notes = decision === 'VERIFIED' ? '' : (window.prompt(decision === 'REVISION' ? 'Catatan revisi kontingen:' : 'Alasan penolakan kontingen:') || '').trim();
    if (decision !== 'VERIFIED' && !notes) return;
    const label = decision === 'VERIFIED' ? 'menyetujui' : decision === 'REVISION' ? 'meminta revisi' : 'menolak';
    if (!window.confirm(`Yakin ${label} administrasi kontingen ${g.gudep_name}? Status Gudep tidak akan berubah.`)) return;
    try {
      await gudepRegistrationService.verifyContingent(g.gudep_id, decision, notes);
      await loadGudepRecords();
      showToast(`Verifikasi kontingen tersimpan: ${decision}. Status Gudep tetap terpisah.`);
    } catch (err: any) { showToast(`Gagal memverifikasi kontingen: ${err?.message || 'Kesalahan GAS'}`); }
  };

  const handleGudepDecision = async (g: GudepRecord, decision: 'VERIFIED' | 'REVISION' | 'REJECTED') => {
    if (!canVerifyAdministratively) { showToast('Keputusan verifikasi hanya dapat dilakukan panitia/admin.'); return; }
    const notes = decision === 'VERIFIED' ? '' : (window.prompt(decision === 'REVISION' ? 'Catatan revisi Gudep:' : 'Alasan penolakan Gudep:') || '').trim();
    if (decision !== 'VERIFIED' && !notes) return;
    if (!window.confirm(`Yakin memproses verifikasi Gudep ${g.gudep_name}? Status kontingen dan regu tidak akan berubah.`)) return;
    try {
      await gudepRegistrationService.verify(g.gudep_id, decision, notes);
      await loadGudepRecords();
      showToast(`Verifikasi Gudep tersimpan: ${decision}. Status kontingen dan regu tetap terpisah.`);
    } catch (err: any) { showToast(`Gagal memverifikasi Gudep: ${err?.message || 'Kesalahan GAS'}`); }
  };

  const handleReguDecision = async (g: GudepRecord, reguId: string, reguName: string, decision: 'VERIFIED' | 'REVISION' | 'REJECTED') => {
    if (!canVerifyAdministratively) { showToast('Keputusan verifikasi hanya dapat dilakukan panitia/admin.'); return; }
    const notes = decision === 'VERIFIED' ? '' : (window.prompt(decision === 'REVISION' ? `Catatan revisi regu ${reguName}:` : `Alasan penolakan regu ${reguName}:`) || '').trim();
    if (decision !== 'VERIFIED' && !notes) return;
    if (!window.confirm(`Yakin memproses verifikasi regu ${reguName}? Status Gudep dan kontingen tidak akan berubah.`)) return;
    try {
      await gudepRegistrationService.verifyRegu(g.gudep_id, reguId, decision, notes);
      const fresh = await gudepRegistrationService.detail(g.gudep_id);
      setGudepDetail(fresh);
      showToast(`Verifikasi regu tersimpan: ${decision}. Keputusan entitas lain tidak berubah.`);
    } catch (err: any) { showToast(`Gagal memverifikasi regu: ${err?.message || 'Kesalahan GAS'}`); }
  };

  const handleSyncAllContingents = async () => {
    setIsSyncingContingents(true);
    let synced = 0;
    try {
      for (const record of gudepRecords) {
        await gudepRegistrationService.syncContingent(record.gudep_id);
        synced += 1;
      }
      await loadGudepRecords();
      showToast(`Sinkronisasi selesai: ${synced} Gudep/Kontingen diproses. Data peserta dan regu tidak dihapus.`);
    } catch (err: any) {
      showToast(`❌ Sinkronisasi berhenti setelah ${synced} data: ${err?.message || 'Kesalahan tidak diketahui'}. Tidak ada penghapusan data.`);
    } finally {
      setIsSyncingContingents(false);
    }
  };

  const openGudepDetail = async (record: GudepRecord) => {
    setSelectedGudep(record);
    setGudepDetail(null);
    try {
      const detail = await gudepRegistrationService.detail(record.gudep_id);
      setGudepDetail(detail);
    } catch (err: any) {
      showToast(`❌ Gagal memuat detail Gudep: ${err?.message || 'Kesalahan tidak diketahui'}`);
    }
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

  const handleCreateContingent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGudepForm.gudep_number.trim() || !newGudepForm.gudep_name.trim()) {
      showToast('Nomor dan nama Gudep wajib diisi.');
      return;
    }
    setIsCreatingGudep(true);
    try {
      const requestKey = `gudep-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const result = await gudepRegistrationService.create({ request_key: requestKey, ...newGudepForm });
      await loadGudepRecords();
      setShowAddContingentModal(false);
      setNewGudepForm({ gudep_number: '', gudep_name: '', institution_name: '', address: '', contact_name: '', contact_phone: '', contact_email: '' });
      showToast(result.alreadyExists ? 'Gudep sudah terdaftar; data dimuat ulang.' : 'Gudep/Kontingen berhasil dibuat dan disimpan melalui GAS.');
    } catch (err: any) {
      showToast(`❌ Gagal membuat Gudep/Kontingen: ${err?.message || 'Kesalahan tidak diketahui'}`);
    } finally {
      setIsCreatingGudep(false);
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
              <span>Pendaftaran, Formulir Dinamis & Kontingen</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola registrasi event dan kontingen yang terhubung dengan identitas Gudep, regu, pembina, dan peserta.
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
                <span>+ Tambah Gudep / Kontingen</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F7F7F8] dark:bg-black/40 rounded-2xl border border-[#ECECEF] dark:border-white/5">
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
            🚩 Kelola Kontingen ({gudepRecords.length})
          </button>
        </div>
      </div>

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

      {/* TAB 3: EVENT CONTINGENTS FROM VERIFIED GAS GUDEP RECORDS */}
      {activeTab === 'contingents' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/5 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
            <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Kontingen pada event ini menggunakan identitas Gudep yang tersimpan di GAS. Regu, pembina, dan hubungan peserta ditampilkan dari data Gudep; tidak membuat kontingen lokal terpisah.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input type="text" placeholder="Cari nomor/nama Gudep, pangkalan, atau pembina..." value={contingentSearch} onChange={e => setContingentSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-2xl text-xs text-[#171717] dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500" />
            </div>
            <button type="button" onClick={() => void loadGudepRecords()} disabled={gudepLoading} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <Calendar className={`w-4 h-4 ${gudepLoading ? 'animate-spin' : ''}`} /> Muat Ulang
            </button>
            <button type="button" onClick={() => void handleSyncAllContingents()} disabled={gudepLoading || isSyncingContingents || gudepRecords.length === 0} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <Layers className={`w-4 h-4 ${isSyncingContingents ? 'animate-pulse' : ''}`} /> {isSyncingContingents ? 'Sinkronisasi…' : 'Sinkronkan Kontingen'}
            </button>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10"><div className="text-[10px] text-slate-500">Gudep/Kontingen</div><div className="text-xl font-black text-slate-900 dark:text-white">{gudepRecords.length}</div></div>
            <div className="p-3 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10"><div className="text-[10px] text-slate-500">Kontingen terverifikasi</div><div className="text-xl font-black text-emerald-600">{gudepRecords.filter(g => g.contingent_verification_status === 'VERIFIED').length}</div></div>
            <div className="p-3 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10"><div className="text-[10px] text-slate-500">Kontingen menunggu</div><div className="text-xl font-black text-amber-600">{gudepRecords.filter(g => g.contingent_verification_status !== 'VERIFIED').length}</div></div>
            <div className="p-3 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10"><div className="text-[10px] text-slate-500">Status data</div><div className="text-sm font-bold text-slate-900 dark:text-white">{gudepLoading ? 'Memuat…' : 'Terhubung GAS'}</div></div>
          </div>
          {gudepLoading && gudepRecords.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 text-sm text-slate-500">Memuat data Gudep/Kontingen dari GAS…</div>
          ) : gudepRecords.filter(g => {
            const q = contingentSearch.trim().toLowerCase();
            return !q || [g.gudep_number, g.gudep_name, g.institution_name].some(v => String(v || '').toLowerCase().includes(q));
          }).length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-white dark:bg-[#141418] border border-dashed border-slate-300 dark:border-white/10">
              <Building2 className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="font-bold text-slate-800 dark:text-white">Belum ada Gudep/Kontingen untuk event ini</p>
              <p className="text-xs text-slate-500 mt-1">Buat identitas Gudep melalui tombol di atas. Data akan disimpan oleh backend GAS.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {gudepRecords.filter(g => {
                const q = contingentSearch.trim().toLowerCase();
                return !q || [g.gudep_number, g.gudep_name, g.institution_name].some(v => String(v || '').toLowerCase().includes(q));
              }).map(g => (
                <article key={g.gudep_id} className="p-4 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0"><Tent className="w-5 h-5 text-emerald-700 dark:text-emerald-300" /></div>
                    <div className="min-w-0 flex-1"><div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">{g.gudep_number || 'Nomor Gudep belum diisi'}</div><h4 className="text-sm font-bold text-slate-900 dark:text-white break-words">{g.gudep_name}</h4><p className="text-xs text-slate-500 break-words">{g.institution_name || 'Pangkalan belum dicantumkan'}</p></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-2 space-y-1"><div className="font-bold text-slate-500">Administrasi Kontingen</div><span className={`inline-block px-2 py-1 rounded-full ${g.contingent_verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'}`}>{g.contingent_verification_status || 'PENDING'}</span></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-2 space-y-1"><div className="font-bold text-slate-500">Administrasi Gudep</div><span className="inline-block px-2 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200">{g.registration_status || 'DRAFT'} · {g.verification_status || 'PENDING'}</span></div>
                  </div>
                  {canVerifyAdministratively && <div className="space-y-2 rounded-xl border border-slate-200 dark:border-white/10 p-3">
                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Keputusan Kontingen (independen)</div>
                    <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => void handleContingentDecision(g,'VERIFIED')} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white">Setujui kontingen</button><button type="button" onClick={() => void handleContingentDecision(g,'REVISION')} className="rounded-lg bg-amber-500 px-2 py-1.5 text-[10px] font-bold text-slate-950">Revisi kontingen</button><button type="button" onClick={() => void handleContingentDecision(g,'REJECTED')} className="rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-bold text-white">Tolak kontingen</button></div>
                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Keputusan Gudep (independen)</div>
                    {g.registration_status === 'SUBMITTED' ? <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => void handleGudepDecision(g,'VERIFIED')} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white">Setujui Gudep</button><button type="button" onClick={() => void handleGudepDecision(g,'REVISION')} className="rounded-lg bg-amber-500 px-2 py-1.5 text-[10px] font-bold text-slate-950">Revisi Gudep</button><button type="button" onClick={() => void handleGudepDecision(g,'REJECTED')} className="rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-bold text-white">Tolak Gudep</button></div> : <p className="text-[10px] text-slate-500">Gudep harus diajukan terlebih dahulu (status SUBMITTED).</p>}
                  </div>}
                  <button type="button" onClick={() => void openGudepDetail(g)} className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2"><Eye className="w-4 h-4" /> Detail Regu, Peserta & Pembina</button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* G U D E P / CONTINGENT DETAIL MODAL */}
      {selectedGudep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
              <div><span className="text-[10px] uppercase font-bold tracking-wide text-emerald-600">Detail Kontingen / Gudep</span><h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedGudep.gudep_name}</h3><p className="text-xs text-slate-500">{selectedGudep.gudep_number} · {selectedGudep.institution_name || 'Pangkalan belum dicantumkan'}</p></div>
              <button type="button" onClick={() => { setSelectedGudep(null); setGudepDetail(null); }} className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            {!gudepDetail ? <div className="py-10 text-center text-sm text-slate-500">Memuat detail dari GAS…</div> : <>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5"><div className="text-[10px] text-slate-500">Regu</div><div className="text-xl font-black text-slate-900 dark:text-white">{gudepDetail.regu?.length || 0}</div></div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5"><div className="text-[10px] text-slate-500">Peserta terhubung</div><div className="text-xl font-black text-slate-900 dark:text-white">{gudepDetail.participantLinks?.filter(x => x.status === 'ACTIVE').length || 0}</div></div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5"><div className="text-[10px] text-slate-500">Pembina</div><div className="text-xl font-black text-slate-900 dark:text-white">{gudepDetail.advisors?.length || 0}</div></div>
              </div>
              <section className="space-y-2"><h4 className="font-bold text-sm text-slate-900 dark:text-white">Regu — verifikasi independen</h4>{(gudepDetail.regu || []).length ? gudepDetail.regu.map(r => <div key={r.regu_id} className="p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-2"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-sm text-slate-900 dark:text-white">{r.regu_name}</div><div className="text-xs text-slate-500">{r.gender} · Kuota {r.quota} · {r.registration_status || 'DRAFT'}</div></div><span className="text-[10px] rounded-full px-2 py-1 bg-slate-100 dark:bg-white/5">{r.verification_status || 'PENDING'}</span></div>{canVerifyAdministratively && r.registration_status === 'SUBMITTED' && <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => void handleReguDecision(selectedGudep!, r.regu_id, r.regu_name, 'VERIFIED')} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white">Setujui regu</button><button type="button" onClick={() => void handleReguDecision(selectedGudep!, r.regu_id, r.regu_name, 'REVISION')} className="rounded-lg bg-amber-500 px-2 py-1.5 text-[10px] font-bold text-slate-950">Revisi</button><button type="button" onClick={() => void handleReguDecision(selectedGudep!, r.regu_id, r.regu_name, 'REJECTED')} className="rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-bold text-white">Tolak</button></div>}</div>) : <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-50 dark:bg-white/5">Belum ada regu.</p>}</section>
              <section className="space-y-2"><h4 className="font-bold text-sm text-slate-900 dark:text-white">Pembina Pendamping</h4>{(gudepDetail.advisors || []).length ? gudepDetail.advisors.map(a => <div key={a.advisor_id} className="p-3 rounded-xl border border-slate-200 dark:border-white/10"><div className="font-semibold text-sm text-slate-900 dark:text-white">{a.full_name}</div><div className="text-xs text-slate-500">{a.phone || 'Nomor telepon belum diisi'} · {a.email || 'Email belum diisi'}</div></div>) : <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-50 dark:bg-white/5">Belum ada pembina.</p>}</section>
              <section className="space-y-2"><h4 className="font-bold text-sm text-slate-900 dark:text-white">Status hubungan peserta</h4><p className="text-xs text-slate-500">Peserta aktif terhubung melalui GudepParticipantLinks. Detail nama peserta tetap bersumber dari data Participants; tidak dibuat duplikat pada halaman ini.</p><div className="text-xs font-mono text-slate-600 dark:text-slate-300">{gudepDetail.participantLinks?.filter(x => x.status === 'ACTIVE').length || 0} link aktif · {(gudepDetail.participantLinks || []).filter(x => x.status !== 'ACTIVE').length} riwayat nonaktif</div></section>
            </>}
            <div className="flex justify-end"><button type="button" onClick={() => { setSelectedGudep(null); setGudepDetail(null); }} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold">Tutup</button></div>
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

      {/* CREATE GUDEP / EVENT CONTINGENT MODAL */}
      {showAddContingentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900 dark:text-white">Tambah Gudep sebagai Kontingen Event</h3><p className="text-xs text-slate-500 mt-1">Data akan disimpan melalui GAS. Isi identitas Gudep dan pangkalan, bukan membuat roster terpisah.</p></div><button type="button" onClick={() => setShowAddContingentModal(false)} className="text-slate-400 p-2">✕</button></div>
            <form onSubmit={handleCreateContingent} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block"><span className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Nomor Gudep *</span><input required value={newGudepForm.gudep_number} onChange={e => setNewGudepForm({ ...newGudepForm, gudep_number: e.target.value })} placeholder="Contoh: 01.023" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white" /></label>
                <label className="block"><span className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Nama Gudep *</span><input required value={newGudepForm.gudep_name} onChange={e => setNewGudepForm({ ...newGudepForm, gudep_name: e.target.value })} placeholder="Nama Gugus Depan" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white" /></label>
                <label className="block sm:col-span-2"><span className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Pangkalan / Instansi</span><input value={newGudepForm.institution_name} onChange={e => setNewGudepForm({ ...newGudepForm, institution_name: e.target.value })} placeholder="Nama sekolah atau lembaga" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white" /></label>
                <label className="block sm:col-span-2"><span className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Alamat</span><input value={newGudepForm.address} onChange={e => setNewGudepForm({ ...newGudepForm, address: e.target.value })} placeholder="Alamat pangkalan" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white" /></label>
                <label className="block"><span className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Nama Kontak</span><input value={newGudepForm.contact_name} onChange={e => setNewGudepForm({ ...newGudepForm, contact_name: e.target.value })} placeholder="Pembina / kontak" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white" /></label>
                <label className="block"><span className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Telepon</span><input value={newGudepForm.contact_phone} onChange={e => setNewGudepForm({ ...newGudepForm, contact_phone: e.target.value })} placeholder="Nomor WhatsApp" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white" /></label>
                <label className="block sm:col-span-2"><span className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Email Kontak</span><input type="email" value={newGudepForm.contact_email} onChange={e => setNewGudepForm({ ...newGudepForm, contact_email: e.target.value })} placeholder="email@sekolah.sch.id" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white" /></label>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2"><button type="button" onClick={() => setShowAddContingentModal(false)} className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white rounded-xl font-semibold">Batal</button><button type="submit" disabled={isCreatingGudep} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold">{isCreatingGudep ? 'Menyimpan…' : 'Simpan Gudep / Kontingen'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
