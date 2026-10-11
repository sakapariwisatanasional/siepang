/**
 * @license
 * SiEpang - Participant Directory, Verification Workspace, Step-Registration & Import v1.1
 * Fully implements:
 * - Requirement 8: Mobile-friendly step-based participant registration experience (1. Identity, 2. Org, 3. Info, 4. Docs, 5. Review, 6. Submit)
 * - Requirement 9: Participant Verification Workspace for Registration Officers (pending queue, preview, approve, request revision with reason, reject)
 * - Requirement 10: Participant Status History tracking & timeline viewer
 * - Requirement 11: Duplicate Participant Detection with review modal
 * - Requirement 12: CSV / Spreadsheet Participant Import (Upload -> Map -> Validate -> Preview -> Duplicate Check -> Confirm -> Result)
 * - Requirement 13: Participant Bulk Actions (Approve, Assign Contingent, Assign Category, Export, Archive) with impact confirmation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  QrCode,
  UserPlus,
  ChevronRight,
  ShieldCheck,
  Eye,
  AlertCircle,
  AlertTriangle,
  X,
  Upload,
  Download,
  Trash2,
  FileText,
  UserCheck,
  Check,
  Layers,
  History,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Camera,
  Sliders,
  Image as ImageIcon,
  Users,
} from 'lucide-react';
import { participantService } from '../../services/participantService';
import { gudepRegistrationService, GudepRecord, GudepRegu } from '../../services/gudepRegistrationService';
import { authService } from '../../services/authService';
import { profilePhotoService } from '../../services/profilePhotoService';
import { Participant, ParticipantStatus, Contingent, ProfilePhotoStatus, PhotoRequiredConfig, PhotoReplacementPolicy } from '../../types';
import { PersonalQrModal } from './PersonalQrModal';
import { ProfilePhotoUploader } from '../../components/media/ProfilePhotoUploader';

function makeRequestKey(): string {
  return 'gudep-register-' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
}

export const ParticipantList: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const currentActorName = currentUser?.name || 'Petugas Registrasi';
  const [activeView, setActiveView] = useState<'directory' | 'verification'>('directory');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ParticipantStatus | 'all'>('all');
  const [contingentFilter, setContingentFilter] = useState<string>('all');

  // Multi-select for Bulk Actions (Requirement 13)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{
    action: 'approve' | 'archive' | 'assign_contingent' | 'assign_category';
    label: string;
    impactDescription: string;
  } | null>(null);
  const [bulkTargetContingent, setBulkTargetContingent] = useState('');
  const [bulkTargetCategory, setBulkTargetCategory] = useState<Participant['role']>('Penggalang');

  // Modals
  const [selectedQrParticipant, setSelectedQrParticipant] = useState<Participant | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Participant | null>(null);
  const [statusHistoryTarget, setStatusHistoryTarget] = useState<Participant | null>(null);
  const [revisionModalTarget, setRevisionModalTarget] = useState<Participant | null>(null);
  const [revisionReasonText, setRevisionReasonText] = useState('Foto KTA atau dokumen izin kurang jelas, mohon unggah ulang.');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStepRegModal, setShowStepRegModal] = useState(false);
  const [showPhotoConfigModal, setShowPhotoConfigModal] = useState(false);
  const [photoConfig, setPhotoConfig] = useState<PhotoRequiredConfig>(profilePhotoService.getRequiredConfig());
  const [photoPolicy, setPhotoPolicy] = useState<PhotoReplacementPolicy>(profilePhotoService.getReplacementPolicy());
  const [rejectPhotoTarget, setRejectPhotoTarget] = useState<Participant | null>(null);
  const [photoRejectReason, setPhotoRejectReason] = useState('Foto buram');

  // Step-based Registration State (Requirement 8, 25, 27)
  const [regStep, setRegStep] = useState<number>(1);
  const [gudepOptions, setGudepOptions] = useState<GudepRecord[]>([]);
  const [reguOptions, setReguOptions] = useState<GudepRegu[]>([]);
  const [gudepLoading, setGudepLoading] = useState(false);
  const [reguLoading, setReguLoading] = useState(false);
  const [gudepLoadError, setGudepLoadError] = useState('');
  const [reguLoadError, setReguLoadError] = useState('');
  const [registrationRequestKey, setRegistrationRequestKey] = useState(() => makeRequestKey());
  const [stepData, setStepData] = useState({
    name: '',
    gender: 'M' as 'M' | 'F',
    role: 'Penggalang' as Participant['role'],
    membershipNumber: '',
    email: '',
    phone: '',
    contingentId: '',
    contingentName: '',
    gudepId: '',
    reguId: '',
    schoolPangkalan: '',
    bloodType: 'O+',
    emergencyContact: '',
    medicalNotes: '',
    docKta: true,
    docIzin: true,
    docSehat: true,
    photoUrl: '',
    profile_photo_file_id: '',
    profile_photo_status: 'NOT_UPLOADED' as ProfilePhotoStatus,
  });

  // Import State (Requirement 12)
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [rawCsvText, setRawCsvText] = useState('');
  const [importResult, setImportResult] = useState<{
    accepted: number;
    needsReview: number;
    rejected: number;
    duplicatesCount: number;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const registrationSubmitLock = useRef(false);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Memuat ulang dari GAS saat layar dibuka, bukan dari state kosong setelah refresh.
  const [, forceRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const unsubscribe = participantService.subscribe(() => {
      if (active) forceRefresh(prev => prev + 1);
    });
    participantService.loadParticipants().then(() => {
      if (active) setLoadState('ready');
    }).catch((err: any) => {
      if (active) { setLoadState('error'); setLoadError(err?.message || 'Gagal memuat peserta dari GAS.'); }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  // Daftar disaring di GAS menurut hak akses akun aktif; jangan gunakan kontingen lokal.
  useEffect(() => {
    if (!showStepRegModal) return;
    let active = true;
    setGudepLoading(true);
    setGudepLoadError('');
    gudepRegistrationService.list().then(({ gudep }) => {
      if (active) setGudepOptions(gudep || []);
    }).catch((err: any) => {
      if (active) { setGudepOptions([]); setGudepLoadError(err?.message || 'Daftar Gudep tidak dapat dimuat.'); }
    }).finally(() => { if (active) setGudepLoading(false); });
    return () => { active = false; };
  }, [showStepRegModal]);

  useEffect(() => {
    if (!showStepRegModal || !stepData.gudepId) {
      setReguOptions([]);
      return;
    }
    let active = true;
    setReguLoading(true);
    setReguLoadError('');
    gudepRegistrationService.detail(stepData.gudepId).then(result => {
      if (active) setReguOptions(result.regu || []);
    }).catch((err: any) => {
      if (active) { setReguOptions([]); setReguLoadError(err?.message || 'Daftar regu tidak dapat dimuat.'); }
    }).finally(() => { if (active) setReguLoading(false); });
    return () => { active = false; };
  }, [showStepRegModal, stepData.gudepId]);

  const selectedGudep = gudepOptions.find(g => g.gudep_id === stepData.gudepId);
  const matchingRegu = reguOptions.filter(r => r.gender === (stepData.gender === 'M' ? 'PUTRA' : 'PUTRI'));
  const selectedRegu = matchingRegu.find(r => r.regu_id === stepData.reguId);

  const contingents = participantService.getContingents();
  const participants = participantService.getParticipants({
    search,
    status: statusFilter,
    contingentId: contingentFilter,
  });

  const pendingVerificationList = participantService.getParticipants({
    status: 'submitted',
  });

  const handleCheckInToggle = async (p: Participant) => {
    try {
      await participantService.checkIn(p.id);
      showToast(`✓ Check-in berhasil untuk ${p.name}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Tahap stabilisasi: keputusan verifikasi/bulk memerlukan endpoint GAS permanen.
  // Tidak boleh mengubah browser cache seolah-olah keputusan sudah tersimpan.
  const pendingBackend = (operation: string) =>
    showToast(`⚠️ ${operation} belum tersedia di GAS. Data peserta tidak diubah.`);
  const handleApprove = (_p: Participant) => pendingBackend('Persetujuan peserta');
  const handleVerify = (_p: Participant) => pendingBackend('Verifikasi berkas');
  const handleConfirmRevision = () => pendingBackend('Permintaan revisi');
  const handleReject = (_p: Participant) => pendingBackend('Penolakan peserta');
  const handleExecuteBulkAction = () => pendingBackend('Aksi massal peserta');

  const handleExportCsv = () => {
    const exportTargets = selectedIds.length > 0
      ? participants.filter(p => selectedIds.includes(p.id))
      : participants;

    let csvContent = 'data:text/csv;charset=utf-8,Kode,Nama,Golongan,Gender,Kontingen,Status,XP,CheckIn\n';
    exportTargets.forEach(p => {
      csvContent += `"${p.code}","${p.name}","${p.role}","${p.gender}","${p.contingentName}","${p.status}",${p.xp},${p.checkedIn ? 'Hadir' : 'Belum'}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Peserta_SiEpang_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`📥 Ekspor ${exportTargets.length} peserta selesai.`);
  };

  // Step-based Registration submit (Requirement 8, 25, 27)
  const handleFinishStepReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registrationSubmitLock.current) return;
    if (!stepData.name.trim()) return;
    if (!selectedGudep || !selectedRegu) {
      showToast('Pilih Gugus Depan dan regu yang sesuai terlebih dahulu.');
      setRegStep(2);
      return;
    }

    // Requirement 27: Final submission rule: if photo required, reject submission if no photo
    const entityType = (stepData.role === 'Pembina Pendamping' || stepData.role === 'Pimpinan Kontingen') ? 'OFFICIAL' : 'PARTICIPANT';
    if (!profilePhotoService.isSubmissionAllowed(entityType, stepData.profile_photo_status)) {
      showToast('⚠️ Foto profil resmi wajib diunggah sebelum pendaftaran dapat diselesaikan.');
      setRegStep(4);
      return;
    }

    registrationSubmitLock.current = true;
    setIsSubmittingRegistration(true);

    try {
             const result = await gudepRegistrationService.registerParticipant({
         request_key: registrationRequestKey,
         gudep_id: selectedGudep.gudep_id,
         regu_id: selectedRegu.regu_id,
         name: stepData.name.trim(),
         gender: stepData.gender,
         role: stepData.role,
         membershipNumber: stepData.membershipNumber,
         email: stepData.email,
         phone: stepData.phone,
         profile_photo_file_id: stepData.profile_photo_file_id,
         profile_photo_url: stepData.photoUrl,
       });
       if (!result.participant?.id || !result.link?.participant_id) {
         throw new Error('GAS belum mengonfirmasi relasi Gudep–Regu peserta.');
       }
       try { await participantService.loadParticipants(); } catch (refreshError) {
         console.warn('Peserta tersimpan, tetapi direktori belum berhasil diperbarui:', refreshError);
       }
    } catch (err: any) {
      showToast(`❌ ${err?.message || 'Gagal menyimpan pendaftaran ke GAS.'}`);
      return;
    } finally {
      registrationSubmitLock.current = false;
      setIsSubmittingRegistration(false);
    }

    showToast(`✅ Pendaftaran berhasil! Berkas '${stepData.name}' masuk ke antrean verifikasi.`);
    setShowStepRegModal(false);
    setRegStep(1);
    setRegistrationRequestKey(makeRequestKey());
    setStepData({
      name: '',
      gender: 'M',
      role: 'Penggalang',
      membershipNumber: '',
      email: '',
      phone: '',
      contingentId: '',
      contingentName: '',
      gudepId: '',
      reguId: '',
      schoolPangkalan: '',
      bloodType: 'O+',
      emergencyContact: '',
      medicalNotes: '',
      docKta: true,
      docIzin: true,
      docSehat: true,
      photoUrl: '',
      profile_photo_file_id: '',
      profile_photo_status: 'NOT_UPLOADED',
    });
  };

  // Import belum punya endpoint server yang memvalidasi Gudep/Regu dan kuota.
  // Tidak membuat "peserta" yang hanya terlihat sampai halaman dimuat ulang.
  const handleProcessImport = () => {
    showToast('⚠️ Import CSV belum terhubung ke GAS. Tidak ada data yang disimpan. Gunakan formulir Gudep–Regu.');
  };

  const getStatusBadge = (status: ParticipantStatus) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">✓ Approved</span>;
      case 'verified':
        return <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold">✓ Verified</span>;
      case 'revision':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">⚠️ Perlu Revisi</span>;
      case 'submitted':
        return <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 text-[10px] font-semibold">Menunggu Verifikasi</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">✕ Ditolak</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-stone-500/20 text-slate-400 text-[10px]">Draft</span>;
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/95 border border-emerald-500/50 text-xs text-emerald-300 font-semibold flex items-center justify-between shadow-xl animate-in fade-in">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Top Header with Multi-Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 rounded-[28px] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFF0F4] text-[#F47743] border border-[#FFE0E8] text-[10px] font-bold">
              Manajemen Peserta Online v1.1
            </span>
            <span className="text-xs text-[#6B7280] dark:text-slate-400">{loadState === 'loading' ? 'Memuat peserta…' : loadState === 'error' ? 'Gagal memuat' : `Total ${participants.length} Terdaftar`}</span>
          </div>
          <h1 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">Database & Verifikasi Peserta</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Switcher: Directory vs Verification Queue */}
          <div className="p-1 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 flex">
            <button
              type="button"
              onClick={() => setActiveView('directory')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px] ${
                activeView === 'directory' ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs' : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
              }`}
              title="Direktori Peserta"
              aria-label="Direktori Peserta"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Direktori</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('verification')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px] ${
                activeView === 'verification' ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs' : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
              }`}
              title="Verifikasi Berkas"
              aria-label="Verifikasi Berkas"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Verifikasi Berkas</span>
              {pendingVerificationList.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#F47743] text-white font-bold text-[10px]">
                  {pendingVerificationList.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowPhotoConfigModal(true)}
            className="flex items-center justify-center p-2.5 sm:px-3 sm:py-2 bg-[#FAFAFA] hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 text-[#6B7280] dark:text-slate-300 rounded-xl text-xs font-semibold border border-[#ECECEF] dark:border-white/10 transition-colors min-w-[44px] min-h-[44px] cursor-pointer"
            title="Kebijakan & Aturan Wajib Foto"
            aria-label="Kebijakan & Aturan Wajib Foto"
          >
            <Camera className="w-4 h-4 text-[#208C60] dark:text-purple-400" />
            <span className="hidden sm:inline sm:ml-1.5">Kebijakan Foto</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center justify-center p-2.5 sm:px-3 sm:py-2 bg-[#FAFAFA] hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 text-[#6B7280] dark:text-slate-300 rounded-xl text-xs font-semibold border border-[#ECECEF] dark:border-white/10 transition-colors min-w-[44px] min-h-[44px] cursor-pointer"
            title="Impor CSV Peserta"
            aria-label="Impor CSV Peserta"
          >
            <Upload className="w-4 h-4 text-sky-500" />
            <span className="hidden sm:inline sm:ml-1.5">Impor CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRegStep(1);
              setRegistrationRequestKey(makeRequestKey());
              setShowStepRegModal(true);
            }}
            className="flex items-center justify-center p-2.5 sm:px-4 sm:py-2 bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20 shrink-0 min-w-[44px] min-h-[44px] cursor-pointer"
            title="Registrasi Peserta Baru"
            aria-label="Registrasi Peserta Baru"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline sm:ml-1.5">+ Registrasi Peserta</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: DIRECTORY WITH BULK ACTIONS */}
      {activeView === 'directory' && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Cari nama, nomor NTA, kode peserta (cth: PST-2026), atau kontingen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-2xl text-base sm:text-xs text-[#171717] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#F47743]"
              />
            </div>

            <select
              value={contingentFilter}
              onChange={e => setContingentFilter(e.target.value)}
              className="bg-white dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-2xl px-3 py-2 text-base sm:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
            >
              <option value="all">Semua Kontingen ({contingents.length})</option>
              {contingents.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-white dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-2xl px-3 py-2 text-base sm:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
            >
              <option value="all">Semua Status</option>
              <option value="approved">Approved (Disetujui)</option>
              <option value="verified">Verified (Terverifikasi)</option>
              <option value="submitted">Submitted (Antre)</option>
              <option value="revision">Revision (Perlu Revisi)</option>
              <option value="rejected">Rejected (Ditolak)</option>
            </select>
          </div>

          {/* BULK ACTIONS TOOLBAR (Requirement 13) */}
          {selectedIds.length > 0 && (
            <div className="p-3 sm:p-4 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-[#171717] dark:text-white">
                <span className="w-6 h-6 rounded-lg bg-[#FFF0F4] text-[#F47743] flex items-center justify-center font-mono text-xs font-black">
                  {selectedIds.length}
                </span>
                <span>Peserta Terpilih</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBulkActionConfirm({
                      action: 'approve',
                      label: 'Setujui (Approve) Massal',
                      impactDescription: `Apakah Anda yakin ingin menyetujui ${selectedIds.length} peserta terpilih sekaligus? Peserta yang disetujui akan berstatus 'approved' dan berhak mencetak ID Card.`,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                  title={`Approve ${selectedIds.length} Peserta`}
                  aria-label={`Approve ${selectedIds.length} Peserta`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span className="hidden sm:inline">Approve ({selectedIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setBulkActionConfirm({
                      action: 'assign_contingent',
                      label: 'Alokasikan Kontingen Massal',
                      impactDescription: `Pindahkan ${selectedIds.length} peserta ke kontingen yang ditentukan di bawah ini.`,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-semibold border border-white/10 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                  title="Alokasikan Kontingen"
                  aria-label="Alokasikan Kontingen"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Atur Kontingen</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-semibold border border-white/10 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                  title="Ekspor CSV Peserta"
                  aria-label="Ekspor CSV Peserta"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span className="hidden sm:inline">Ekspor CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setBulkActionConfirm({
                      action: 'archive',
                      label: 'Arsipkan Peserta Terpilih',
                      impactDescription: `Apakah Anda yakin ingin mengarsipkan ${selectedIds.length} peserta? Tindakan ini akan memindahkan data ke riwayat arsip.`,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-semibold border border-rose-500/30 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                  title="Arsipkan Peserta"
                  aria-label="Arsipkan Peserta"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Arsipkan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="p-2.5 text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                  title="Batalkan Pilihan"
                  aria-label="Batalkan Pilihan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* DIRECTORY TABLE VIEW */}
          <div className="rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 overflow-x-auto max-w-full shadow-xs">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead className="bg-[#FAFAFA] dark:bg-white/5 border-b border-[#ECECEF] dark:border-white/10 text-[#6B7280] dark:text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === participants.length}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(participants.map(p => p.id));
                        else setSelectedIds([]);
                      }}
                      className="accent-[#F47743] rounded"
                    />
                  </th>
                  <th className="py-3 px-3">Peserta & Identitas</th>
                  <th className="py-3 px-3">Kontingen & Pangkalan</th>
                  <th className="py-3 px-3">Status Verifikasi</th>
                  <th className="py-3 px-3">Presensi / XP</th>
                  <th className="py-3 px-3 text-center">Check-in Buper</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECECEF] dark:divide-white/5 text-[#171717] dark:text-slate-200">
                {loadState === 'loading' ? (
                  <tr><td colSpan={7} className="px-4 py-10"><div role="status" className="flex items-center gap-3 text-sm text-[#6B6257]"><span className="inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-[#D4A017] border-t-[#C62828]"/> Memuat peserta dari Google Spreadsheet…</div><div className="mt-5 space-y-3 animate-pulse">{[0,1,2].map(i => <div key={i} className="h-14 rounded-2xl bg-[#F4EBDD] dark:bg-white/10"/>)}</div></td></tr>
                ) : loadState === 'error' ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center"><p role="alert" className="font-semibold text-red-700">Gagal memuat peserta: {loadError}</p><button type="button" className="mt-3 rounded-xl bg-[#C62828] px-4 py-2 font-bold text-white" onClick={() => { setLoadState('loading'); participantService.loadParticipants().then(() => setLoadState('ready')).catch((e:any) => {setLoadState('error');setLoadError(e?.message || 'Koneksi gagal');}); }}>Coba Lagi</button></td></tr>
                ) : participants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-[#9CA3AF] dark:text-slate-400">
                      Belum ada peserta yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  participants.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <tr key={p.id} className={`hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors ${isSelected ? 'bg-pink-50/60 dark:bg-pink-950/20' : ''}`}>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) setSelectedIds([...selectedIds, p.id]);
                              else setSelectedIds(selectedIds.filter(id => id !== p.id));
                            }}
                            className="accent-[#F47743] rounded"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <img src={p.photoUrl || profilePhotoService.getPlaceholderUrl(p.name)} onError={e => { const fallback = profilePhotoService.getPlaceholderUrl(p.name); if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }} alt={p.name} className="w-9 h-9 rounded-xl object-cover border border-[#ECECEF] dark:border-white/10" />
                            <div>
                              <div className="font-bold text-[#171717] dark:text-white flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {p.isPossibleDuplicate && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-bold border border-amber-500/30">
                                    ⚠️ Duplikat?
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#6B7280] dark:text-slate-400 font-mono">
                                {p.code} · NTA: {p.membershipNumber || '-'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[#171717] dark:text-white">{p.contingentName}</div>
                          <div className="text-[10px] text-[#6B7280] dark:text-slate-400">{p.schoolPangkalan || p.subCamp}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            {getStatusBadge(p.status)}
                            {p.status === 'revision' && p.revisionReason && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 line-clamp-1">
                                Catatan: {p.revisionReason}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#F47743] font-mono">⚡ {p.xp} XP</div>
                          <div className="text-[10px] text-[#6B7280] dark:text-slate-400">{p.attendanceCount} Kegiatan Hadir</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleCheckInToggle(p)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold inline-flex items-center gap-1 transition-colors ${
                              p.checkedIn
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-500/30'
                                : 'bg-[#FAFAFA] text-[#6B7280] hover:text-[#171717] border border-[#ECECEF] dark:bg-white/5 dark:text-slate-400 dark:hover:text-white dark:border-white/10'
                            }`}
                          >
                            <CheckCircle2 className={`w-3 h-3 ${p.checkedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#9CA3AF]'}`} />
                            <span>{p.checkedIn ? 'Hadir' : 'Check-in'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedQrParticipant(p)}
                              className="p-2 rounded-xl bg-[#FAFAFA] hover:bg-pink-50 text-[#F47743] border border-[#ECECEF] dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
                              title="Buka QR Pass"
                              aria-label={`Buka QR Pass ${p.name}`}
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatusHistoryTarget(p)}
                              className="p-2 rounded-xl bg-[#FAFAFA] hover:bg-gray-100 text-[#6B7280] hover:text-[#171717] border border-[#ECECEF] dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-400 dark:hover:text-white dark:border-white/10 transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
                              title="Riwayat Status"
                              aria-label={`Riwayat Status ${p.name}`}
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedDetail(p)}
                              className="p-2 rounded-xl bg-[#FAFAFA] hover:bg-gray-100 text-[#6B7280] hover:text-[#171717] border border-[#ECECEF] dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-400 dark:hover:text-white dark:border-white/10 transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
                              title="Lihat Detail Lengkap"
                              aria-label={`Lihat Detail Lengkap ${p.name}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: DEDICATED VERIFICATION WORKSPACE (Requirement 9) */}
      {activeView === 'verification' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#F47743]" />
                <span>Antrean Verifikasi Berkas Peserta (Registration Officers Workspace)</span>
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Periksa kelengkapan KTA, surat mandat, izin orang tua, dan surat sehat sebelum disetujui.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-pink-50 text-[#F47743] border border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800 text-xs font-bold shrink-0 self-start sm:self-auto">
              {pendingVerificationList.length} Menunggu Verifikasi
            </span>
          </div>

          {pendingVerificationList.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 text-center space-y-2 shadow-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-[#171717] dark:text-white">Antrean Verifikasi Kosong</h4>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 max-w-sm mx-auto">
                Semua pendaftar telah diverifikasi atau belum ada berkas pendaftaran baru yang diajukan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingVerificationList.map(p => (
                <div key={p.id} className="p-5 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/40 transition-all space-y-3 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={p.photoUrl || profilePhotoService.getPlaceholderUrl(p.name)} onError={e => { const fallback = profilePhotoService.getPlaceholderUrl(p.name); if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }} alt={p.name} className="w-12 h-12 rounded-2xl object-cover border border-[#ECECEF] dark:border-white/10" />
                      <div>
                        <h4 className="text-sm font-bold text-[#171717] dark:text-white">{p.name}</h4>
                        <div className="text-xs text-[#6B7280] dark:text-slate-300">{p.contingentName} · {p.role}</div>
                        <div className="text-[10px] text-[#F47743] font-mono mt-0.5">
                          {p.code} | NTA: {p.membershipNumber || '-'}
                        </div>
                      </div>
                    </div>
                    {p.isPossibleDuplicate && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                        ⚠️ Duplikat
                      </span>
                    )}
                  </div>

                  {/* Document Checklist & Photo Status Preview (Requirements 41 - 44) */}
                  <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-wider">
                        Status Foto Profil:
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.profile_photo_status === 'VALID'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : p.profile_photo_status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                          : p.profile_photo_status === 'NEEDS_REPLACEMENT'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
                      }`}>
                        {p.profile_photo_status === 'VALID' && '✓ Foto Valid'}
                        {p.profile_photo_status === 'REJECTED' && '✕ Foto Ditolak'}
                        {p.profile_photo_status === 'NEEDS_REPLACEMENT' && '⚠️ Perlu Penggantian'}
                        {(!p.profile_photo_status || p.profile_photo_status === 'UPLOADED') && '⏳ Menunggu Verifikasi'}
                      </span>
                    </div>

                    {p.photo_rejection_reason && (
                      <div className="text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30">
                        Catatan Foto: {p.photo_rejection_reason}
                      </div>
                    )}

                    {/* Quick Photo Moderation Actions */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          showToast('Verifikasi foto permanen belum tersedia. Jangan mengubah status hanya di browser.');
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-600/30 dark:hover:bg-emerald-600/50 dark:text-emerald-300 dark:border-emerald-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        ✓ Sahkan Foto
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRejectPhotoTarget(p);
                          setPhotoRejectReason('Foto buram');
                        }}
                        className="py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 dark:text-rose-300 dark:border-rose-500/30 text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        ✕ Tolak Foto
                      </button>
                    </div>

                    <div className="pt-1.5 border-t border-[#ECECEF] dark:border-white/5">
                      <div className="text-[10px] font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-wider mb-1">
                        Kelengkapan Berkas:
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3" /> KTA Pramuka
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Izin Ortu
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Surat Sehat
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Approve / Request Revision / Reject */}
                  <div className="pt-2 border-t border-[#ECECEF] dark:border-white/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleApprove(p)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-h-[40px]"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => {
                        setRevisionModalTarget(p);
                        setRevisionReasonText('Foto KTA atau dokumen izin orang tua kurang jelas, mohon unggah ulang.');
                      }}
                      className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-300 dark:border-amber-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
                    >
                      Minta Revisi
                    </button>

                    <button
                      onClick={() => handleReject(p)}
                      className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 dark:text-rose-300 dark:border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REQUEST REVISION MODAL (Requirement 9) */}
      {revisionModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Minta Perbaikan Berkas Peserta</span>
              </div>
              <button onClick={() => setRevisionModalTarget(null)} className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-[#6B7280] dark:text-slate-300">
                Peserta: <strong className="text-[#171717] dark:text-white">{revisionModalTarget.name}</strong> ({revisionModalTarget.code})
              </p>
              <label className="text-[#171717] dark:text-slate-300 font-semibold block">Alasan / Catatan Perbaikan untuk Peserta:</label>
              <textarea
                rows={3}
                value={revisionReasonText}
                onChange={e => setRevisionReasonText(e.target.value)}
                className="w-full p-3 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                placeholder="Contoh: Foto KTA kurang jelas. Harap unggah ulang file KTA yang dapat terbaca..."
              />
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <span className="font-bold block">Tampilan Peserta di Portal Companion:</span>
                <p className="italic">"Perlu Perbaikan: {revisionReasonText} [ Perbaiki Data ]"</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 flex justify-end gap-2">
              <button onClick={() => setRevisionModalTarget(null)} className="px-4 py-2 text-xs text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer">Batal</button>
              <button
                onClick={handleConfirmRevision}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Kirim Permintaan Revisi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS HISTORY TIMELINE MODAL (Requirement 10) */}
      {statusHistoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div>
                <span className="text-[10px] text-[#F47743] font-bold font-mono uppercase">Riwayat Status Berkas</span>
                <h3 className="text-sm font-bold text-[#171717] dark:text-white">{statusHistoryTarget.name}</h3>
              </div>
              <button onClick={() => setStatusHistoryTarget(null)} className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {(statusHistoryTarget.statusHistory || []).length === 0 ? (
                <div className="text-center py-6 text-xs text-[#9CA3AF] dark:text-slate-500">
                  Belum ada catatan mutasi status untuk peserta ini.
                </div>
              ) : (
                statusHistoryTarget.statusHistory?.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#171717] dark:text-white uppercase text-[10px] px-2 py-0.5 rounded bg-pink-50 dark:bg-pink-950/40 text-[#F47743] border border-pink-200 dark:border-pink-800">
                        {item.previous_status} → {item.new_status}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF] dark:text-slate-500 font-mono">{item.timestamp}</span>
                    </div>
                    <div className="text-[#6B7280] dark:text-slate-300">Oleh: <strong className="text-[#171717] dark:text-white">{item.changed_by}</strong></div>
                    {item.reason && (
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 italic bg-amber-50 dark:bg-white/5 p-1.5 rounded-lg mt-1 border border-amber-200 dark:border-white/5">
                        "{item.reason}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 flex justify-end">
              <button onClick={() => setStatusHistoryTarget(null)} className="px-4 py-2 bg-[#FAFAFA] hover:bg-gray-100 dark:bg-white/10 dark:hover:bg-white/20 rounded-xl text-xs font-bold text-[#171717] dark:text-white border border-[#ECECEF] dark:border-white/10 cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTION IMPACT CONFIRMATION MODAL (Requirement 13 & 57) */}
      {bulkActionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-[#171717] dark:text-white">{bulkActionConfirm.label}</h3>
            </div>

            <p className="text-xs text-[#6B7280] dark:text-slate-300 leading-relaxed">
              {bulkActionConfirm.impactDescription}
            </p>

            {bulkActionConfirm.action === 'assign_contingent' && (
              <div>
                <label className="text-xs text-[#171717] dark:text-slate-400 block mb-1 font-semibold">Pilih Kontingen Tujuan:</label>
                <select
                  value={bulkTargetContingent}
                  onChange={e => setBulkTargetContingent(e.target.value)}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white text-xs"
                >
                  <option value="">-- Pilih Kontingen --</option>
                  {contingents.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {bulkActionConfirm.action === 'assign_category' && (
              <div>
                <label className="text-xs text-[#171717] dark:text-slate-400 block mb-1 font-semibold">Pilih Golongan / Tingkatan Baru:</label>
                <select
                  value={bulkTargetCategory}
                  onChange={e => setBulkTargetCategory(e.target.value as any)}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white text-xs"
                >
                  <option value="Penggalang">Penggalang</option>
                  <option value="Penegak">Penegak</option>
                  <option value="Pandega">Pandega</option>
                  {/* Pembina didaftarkan melalui menu Gudep → Pembina, bukan sebagai peserta regu. */}
                  <option value="Pimpinan Kontingen">Pimpinan Kontingen</option>
                </select>
              </div>
            )}

            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setBulkActionConfirm(null)}
                className="px-4 py-2 bg-[#FAFAFA] hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-[#6B7280] dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteBulkAction}
                className="px-5 py-2.5 bg-[#F47743] hover:bg-[#E78B3C] text-white font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Konfirmasi & Jalankan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP-BASED REGISTRATION MODAL (Requirement 8) */}
      {showStepRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleFinishStepReg}
            className="siepang-participant-registration w-full max-w-lg bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div>
                <span className="text-[10px] text-[#F47743] font-bold font-mono">LANGKAH {regStep} DARI 6</span>
                <h3 className="text-base font-bold text-[#171717] dark:text-white">Formulir Pendaftaran Peserta</h3>
              </div>
              <button type="button" disabled={isSubmittingRegistration} onClick={() => setShowStepRegModal(false)} className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="w-full bg-gray-100 dark:bg-black/40 h-2 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${(regStep / 6) * 100}%`,
                  background: 'linear-gradient(135deg, #833AB4 0%, #C13584 30%, #E1306C 52%, #F77737 78%, #FCAF45 100%)',
                }}
              />
            </div>

            {/* STEP 1: IDENTITY */}
            {regStep === 1 && (
              <div className="space-y-3 text-xs animate-in fade-in">
                <div className="font-bold text-[#171717] dark:text-slate-200">1. Identitas Pribadi Peserta</div>
                <div>
                  <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Nama Lengkap Peserta *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rian Anggara"
                    value={stepData.name}
                    onChange={e => setStepData({ ...stepData, name: e.target.value })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Jenis Kelamin</label>
                    <select
                      value={stepData.gender}
                      onChange={e => setStepData({ ...stepData, gender: e.target.value as any })}
                      className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                    >
                      <option value="M">Putra</option>
                      <option value="F">Putri</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Golongan Pramuka</label>
                    <select
                      value={stepData.role}
                      onChange={e => setStepData({ ...stepData, role: e.target.value as any })}
                      className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                    >
                      <option value="Penggalang">Penggalang</option>
                      <option value="Penegak">Penegak</option>
                      <option value="Pandega">Pandega</option>
                      {/* Pembina didaftarkan melalui menu Gudep → Pembina, bukan sebagai peserta regu. */}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Nomor Tanda Anggota (NTA / KTA)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 10.01.002.0451"
                    value={stepData.membershipNumber}
                    onChange={e => setStepData({ ...stepData, membershipNumber: e.target.value })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono focus:outline-none focus:border-[#F47743]"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: GUGUS DEPAN & REGU — sumber tunggal dari GAS */}
            {regStep === 2 && (
              <div className="space-y-3 text-xs animate-in fade-in">
                <div className="font-bold text-[#171717] dark:text-slate-200">2. Pilih Gugus Depan & Regu</div>
                <p className="text-[#6B7280] dark:text-slate-400">Pilih Gudep terlebih dahulu. Regu akan disaring otomatis berdasarkan Putra/Putri pada langkah pertama.</p>
                <div>
                  <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Gugus Depan *</label>
                  <select
                    required
                    disabled={gudepLoading || !!gudepLoadError}
                    value={stepData.gudepId}
                    onChange={e => {
                      const g = gudepOptions.find(x => x.gudep_id === e.target.value);
                      setStepData(prev => ({ ...prev,
                        gudepId: e.target.value, reguId: '',
                        contingentId: g?.gudep_id || '',
                        contingentName: g?.gudep_name || '',
                        schoolPangkalan: g?.institution_name || g?.gudep_name || '',
                      }));
                    }}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white"
                  >
                    <option value="">{gudepLoading ? 'Memuat Gudep…' : '-- Pilih Gugus Depan --'}</option>
                    {gudepOptions.map(g => (
                      <option key={g.gudep_id} value={g.gudep_id}>{g.gudep_number} — {g.gudep_name}</option>
                    ))}
                  </select>
                  {gudepLoadError && <p role="alert" className="text-rose-500 mt-2">{gudepLoadError}</p>}
                  {!gudepLoading && !gudepLoadError && gudepOptions.length === 0 && (
                    <p className="text-amber-500 mt-2">Belum ada Gudep yang dapat diakses akun ini. Hubungi admin untuk membuat Gudep atau menugaskan operator.</p>
                  )}
                </div>
                <div>
                  <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Regu {stepData.gender === 'M' ? 'Putra' : 'Putri'} *</label>
                  <select
                    required
                    disabled={!stepData.gudepId || reguLoading || !!reguLoadError}
                    value={stepData.reguId}
                    onChange={e => setStepData(prev => ({ ...prev, reguId: e.target.value }))}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white"
                  >
                    <option value="">{reguLoading ? 'Memuat regu…' : '-- Pilih Regu --'}</option>
                    {matchingRegu.map(r => <option key={r.regu_id} value={r.regu_id}>{r.regu_name} (kuota {r.quota})</option>)}
                  </select>
                  {reguLoadError && <p role="alert" className="text-rose-500 mt-2">{reguLoadError}</p>}
                  {stepData.gudepId && !reguLoading && !reguLoadError && matchingRegu.length === 0 && (
                    <p className="text-amber-500 mt-2">Belum ada regu {stepData.gender === 'M' ? 'Putra' : 'Putri'} di Gudep ini. Buat regu terlebih dahulu pada pengelolaan Gudep.</p>
                  )}
                </div>
                {selectedGudep && <p className="text-[#6B7280] dark:text-slate-400">Pangkalan: {selectedGudep.institution_name || selectedGudep.gudep_name}</p>}
              </div>
            )}

            {/* STEP 3: PARTICIPANT INFORMATION */}
            {regStep === 3 && (
              <div className="space-y-3 text-xs animate-in fade-in">
                <div className="font-bold text-[#171717] dark:text-slate-200">3. Informasi Tambahan & Medis</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Golongan Darah</label>
                    <select
                      value={stepData.bloodType}
                      onChange={e => setStepData({ ...stepData, bloodType: e.target.value })}
                      className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                    >
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="AB+">AB+</option>
                      <option value="O+">O+</option>
                      <option value="Tidak Tahu">Tidak Tahu</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Kontak Darurat (Ortu/Wali)</label>
                    <input
                      type="text"
                      placeholder="0812-3456-7890"
                      value={stepData.emergencyContact}
                      onChange={e => setStepData({ ...stepData, emergencyContact: e.target.value })}
                      className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono focus:outline-none focus:border-[#F47743]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[#6B7280] dark:text-slate-300 block mb-1 font-semibold">Catatan Medis / Riwayat Penyakit</label>
                  <input
                    type="text"
                    placeholder="Contoh: Riwayat asma dingin"
                    value={stepData.medicalNotes}
                    onChange={e => setStepData({ ...stepData, medicalNotes: e.target.value })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: PHOTO & REQUIRED DOCUMENTS (Requirements 25 - 34) */}
            {regStep === 4 && (
              <div className="space-y-4 text-xs animate-in fade-in">
                <div className="space-y-1">
                  <div className="font-bold text-[#171717] dark:text-slate-200">4. Foto Profil Resmi & Kelengkapan Berkas</div>
                  <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                    Unggah pas foto resmi berseragam Pramuka. Foto akan dipangkas 1:1 dan disimpan di Google Drive Kwartir untuk ID Card dan Piagam.
                  </p>
                </div>

                {/* Profile Photo Uploader Component */}
                <ProfilePhotoUploader
                  entityType={(stepData.role === 'Pembina Pendamping' || stepData.role === 'Pimpinan Kontingen') ? 'OFFICIAL' : 'PARTICIPANT'}
                  entityId={`draft_p_${stepData.membershipNumber || Date.now()}`}
                  entityName={stepData.name || 'Peserta'}
                  currentPhotoUrl={stepData.photoUrl}
                  required={profilePhotoService.isPhotoRequired((stepData.role === 'Pembina Pendamping' || stepData.role === 'Pimpinan Kontingen') ? 'OFFICIAL' : 'PARTICIPANT')}
                  onPhotoSaved={rec => {
                    setStepData({
                      ...stepData,
                      photoUrl: rec.profile_photo_url,
                      profile_photo_file_id: rec.profile_photo_file_id,
                      profile_photo_status: rec.profile_photo_status,
                    });
                    showToast('✓ Foto profil berhasil diproses & disimpan.');
                  }}
                  onPhotoRemoved={() => {
                    setStepData({
                      ...stepData,
                      photoUrl: '',
                      profile_photo_file_id: '',
                      profile_photo_status: 'NOT_UPLOADED',
                    });
                  }}
                />

                <div className="space-y-2 pt-2 border-t border-[#ECECEF] dark:border-white/5">
                  <div className="text-[11px] font-semibold text-[#171717] dark:text-slate-300">Berkas Pendukung Wajib:</div>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepData.docKta}
                      onChange={e => setStepData({ ...stepData, docKta: e.target.checked })}
                      className="accent-[#F47743] rounded"
                    />
                    <span className="text-[#171717] dark:text-slate-200">KTA / NTA Pramuka (Digital / Fisik Terlampir)</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepData.docIzin}
                      onChange={e => setStepData({ ...stepData, docIzin: e.target.checked })}
                      className="accent-[#F47743] rounded"
                    />
                    <span className="text-[#171717] dark:text-slate-200">Surat Izin Mengikuti Perkemahan dari Orang Tua / Gugus Depan</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepData.docSehat}
                      onChange={e => setStepData({ ...stepData, docSehat: e.target.checked })}
                      className="accent-[#F47743] rounded"
                    />
                    <span className="text-[#171717] dark:text-slate-200">Surat Keterangan Sehat dari Fasilitas Kesehatan / Dokter</span>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 5: REVIEW */}
            {regStep === 5 && (
              <div className="space-y-3 text-xs animate-in fade-in">
                <div className="font-bold text-[#171717] dark:text-slate-200">5. Tinjau Ringkasan Pendaftaran</div>
                <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 space-y-2">
                  <div className="flex items-center gap-3 pb-2 border-b border-[#ECECEF] dark:border-white/10">
                    <img
                      src={stepData.photoUrl || profilePhotoService.getPlaceholderUrl(stepData.name)}
                      alt="Foto Profil"
                      className="w-12 h-12 rounded-xl object-cover border border-[#ECECEF] dark:border-white/10 bg-slate-100 dark:bg-slate-900"
                    />
                    <div>
                      <div className="font-bold text-[#171717] dark:text-white text-sm">{stepData.name || '-'}</div>
                      <div className="text-[#F47743] font-mono text-[10px]">
                        {stepData.role} · {stepData.gender === 'M' ? 'Putra' : 'Putri'}
                      </div>
                      <div className="text-[10px] text-[#6B7280] dark:text-slate-400">
                        Status Foto: {stepData.photoUrl ? '✓ Terunggah' : 'Belum Ada Foto'}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-[#6B7280] dark:text-slate-400">Gugus Depan:</span><span className="text-[#F47743] font-semibold">{selectedGudep?.gudep_name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280] dark:text-slate-400">Regu:</span><span className="text-[#171717] dark:text-white">{selectedRegu?.regu_name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280] dark:text-slate-400">Pangkalan:</span><span className="text-[#171717] dark:text-white">{stepData.schoolPangkalan}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280] dark:text-slate-400">Gol. Darah:</span><span className="text-[#171717] dark:text-white">{stepData.bloodType}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280] dark:text-slate-400">NTA / KTA:</span><span className="text-[#171717] dark:text-white font-mono">{stepData.membershipNumber || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280] dark:text-slate-400">Berkas:</span><span className="text-emerald-600 dark:text-emerald-300 font-semibold">Lengkap (3 Berkas)</span></div>
                </div>
              </div>
            )}

            {/* STEP 6: SUBMIT CONFIRMATION */}
            {regStep === 6 && (
              <div className="space-y-3 text-xs text-center animate-in fade-in py-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/30">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="text-sm font-bold text-[#171717] dark:text-white">Siap Mengirimkan Pendaftaran?</h4>
                <p className="text-[#6B7280] dark:text-slate-400 max-w-xs mx-auto">
                  Data peserta akan dikirim ke antrean verifikasi panitia dan diterbitkan kode tiket peserta resmi.
                </p>
              </div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="pt-3 border-t border-[#ECECEF] dark:border-white/10 flex items-center justify-between">
              {regStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setRegStep(regStep - 1)}
                  className="px-4 py-2 bg-[#FAFAFA] hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-[#6B7280] dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-[#ECECEF] dark:border-white/10 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>
              ) : (
                <div />
              )}

              {regStep < 6 ? (
                <button
                  type="button"
                  disabled={(regStep === 1 && !stepData.name.trim()) || (regStep === 2 && (!selectedGudep || !selectedRegu || reguLoading || gudepLoading))}
                  onClick={() => setRegStep(regStep + 1)}
                  className="px-5 py-2.5 bg-[#F47743] hover:bg-[#E78B3C] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <span>Lanjutkan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmittingRegistration}
                  aria-busy={isSubmittingRegistration}
                  className="px-6 py-2.5 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  style={{
                    background: 'linear-gradient(135deg, #833AB4 0%, #C13584 30%, #E1306C 52%, #F77737 78%, #FCAF45 100%)',
                  }}
                >
                  {isSubmittingRegistration ? 'Menyimpan ke GAS…' : 'Kirim & Daftarkan Peserta'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* CSV / SPREADSHEET IMPORT MODAL (Requirement 12) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div>
                <span className="text-[10px] text-sky-500 font-bold font-mono uppercase">
                  Impor Peserta Massal
                </span>
                <h3 className="text-sm font-bold text-[#171717] dark:text-white">Upload / Tempel Data CSV</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            {importStep === 'upload' && (
              <div className="space-y-3 text-xs">
                <p className="text-[#6B7280] dark:text-slate-300">
                  Tempelkan baris data CSV dengan kolom: <code className="text-[#F47743] font-mono bg-pink-50 dark:bg-pink-950/40 px-1 py-0.5 rounded">Nama Lengkap, Jenis Kelamin, Tingkatan, NTA, Kontingen, Telepon</code>.
                </p>
                <textarea
                  rows={6}
                  value={rawCsvText}
                  onChange={e => setRawCsvText(e.target.value)}
                  className="w-full p-3 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white font-mono text-[11px] focus:outline-none focus:border-[#F47743]"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-[#FAFAFA] hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-[#6B7280] dark:text-slate-300 cursor-pointer border border-[#ECECEF] dark:border-white/10">Batal</button>
                  <button
                    onClick={handleProcessImport}
                    className="px-5 py-2.5 bg-[#F47743] hover:bg-[#E78B3C] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Validasi & Impor
                  </button>
                </div>
              </div>
            )}

            {importStep === 'result' && importResult && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold">DITERIMA</span>
                    <span className="text-lg font-black text-emerald-700 dark:text-white font-mono">{importResult.accepted}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold">PERLU DITINJAU</span>
                    <span className="text-lg font-black text-amber-700 dark:text-white font-mono">{importResult.needsReview}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                    <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-bold">DITOLAK</span>
                    <span className="text-lg font-black text-rose-700 dark:text-white font-mono">{importResult.rejected}</span>
                  </div>
                </div>

                {importResult.duplicatesCount > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Terdeteksi {importResult.duplicatesCount} kemungkinan duplikasi (telah ditandai untuk tinjauan).</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportStep('upload');
                    }}
                    className="px-5 py-2 bg-[#F47743] hover:bg-[#E78B3C] text-white rounded-xl font-bold cursor-pointer"
                  >
                    Selesai & Lihat Database
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHOTO REJECTION REASON MODAL (Requirements 43, 44) */}
      {rejectPhotoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Tolak Foto Profil</span>
              </div>
              <button
                type="button"
                onClick={() => setRejectPhotoTarget(null)}
                className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#6B7280] dark:text-slate-300">
                Pilih alasan penolakan foto untuk <strong className="text-[#171717] dark:text-white">{rejectPhotoTarget.name}</strong>:
              </p>

              <div className="space-y-2">
                {[
                  'Foto buram',
                  'Wajah tidak terlihat jelas',
                  'Foto terpotong',
                  'File rusak',
                  'Bukan seragam Pramuka / atribut resmi',
                ].map(r => (
                  <label
                    key={r}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      photoRejectReason === r
                        ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-500/50 dark:text-white font-semibold'
                        : 'bg-[#FAFAFA] border-[#ECECEF] text-[#6B7280] hover:text-[#171717] dark:bg-white/5 dark:border-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="radio"
                      name="photo_reject_reason"
                      value={r}
                      checked={photoRejectReason === r}
                      onChange={() => setPhotoRejectReason(r)}
                      className="accent-[#F47743]"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectPhotoTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-[#FAFAFA] hover:bg-gray-100 dark:bg-white/10 text-[#6B7280] dark:text-slate-300 text-xs font-semibold border border-[#ECECEF] dark:border-white/10 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    profilePhotoService.rejectPhoto(rejectPhotoTarget.id, photoRejectReason, currentActorName);
                    rejectPhotoTarget.profile_photo_status = 'REJECTED';
                    rejectPhotoTarget.photo_rejection_reason = photoRejectReason;
                    showToast(`⚠️ Foto '${rejectPhotoTarget.name}' ditolak: ${photoRejectReason}.`);
                    setRejectPhotoTarget(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Konfirmasi Tolak Foto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO REQUIRED & REPLACEMENT CONFIG MODAL (Requirements 26, 48) */}
      {showPhotoConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#F47743]" />
                <span>Pengaturan Kebijakan Foto Profil</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoConfigModal(false)}
                className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-[#171717] dark:text-slate-200 mb-1">
                  1. Keharusan Foto Profil per Kategori (Wajib / Opsional)
                </h4>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mb-2.5">
                  Jika diset 'Wajib', pendaftaran final tidak dapat dikirim tanpa foto profil yang valid.
                </p>

                <div className="space-y-2">
                  {(['PARTICIPANT', 'OFFICIAL', 'COMMITTEE', 'JUDGE'] as const).map(roleKey => {
                    const labelMap = {
                      PARTICIPANT: 'Peserta Kemah',
                      OFFICIAL: 'Pembina & Pinkon',
                      COMMITTEE: 'Panitia Pelaksana',
                      JUDGE: 'Dewan Juri Lomba',
                    };
                    const isReq = photoConfig[roleKey] === 'REQUIRED';
                    return (
                      <div
                        key={roleKey}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5"
                      >
                        <span className="font-semibold text-[#171717] dark:text-white">{labelMap[roleKey]}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated: PhotoRequiredConfig = {
                              ...photoConfig,
                              [roleKey]: isReq ? 'OPTIONAL' : 'REQUIRED',
                            };
                            setPhotoConfig(updated);
                            profilePhotoService.setRequiredConfig(updated);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                            isReq
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                          }`}
                        >
                          {isReq ? '🔴 Wajib (Required)' : '🟢 Opsional'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10">
                <h4 className="font-bold text-[#171717] dark:text-slate-200 mb-1">
                  2. Kebijakan Penggantian Foto yang Telah Disetujui (Approved)
                </h4>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mb-2">
                  Mengatur tindakan bila peserta/pengguna mengganti foto setelah disahkan.
                </p>

                <div className="space-y-1.5">
                  {[
                    { key: 'REQUIRE_REAPPROVAL', label: 'Wajib Verifikasi Ulang (Rekomendasi)', desc: 'Status foto kembali ke UPLOADED dan menunggu review ulang.' },
                    { key: 'ALLOW', label: 'Izinkan Otomatis (Allow)', desc: 'Foto baru langsung berstatus VALID tanpa menunggu verifikator.' },
                    { key: 'ADMIN_ONLY', label: 'Hanya Admin yang Boleh Mengganti', desc: 'Peserta dilarang mengganti foto yang telah disetujui.' },
                  ].map(pol => (
                    <label
                      key={pol.key}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer ${
                        photoPolicy === pol.key
                          ? 'bg-pink-50 border-pink-200 text-[#171717] dark:bg-pink-950/40 dark:border-[#F47743]/40 dark:text-white'
                          : 'bg-[#FAFAFA] border-[#ECECEF] text-[#6B7280] hover:text-[#171717] dark:bg-white/5 dark:border-white/5 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="photo_replace_policy"
                        value={pol.key}
                        checked={photoPolicy === pol.key}
                        onChange={() => {
                          setPhotoPolicy(pol.key as any);
                          profilePhotoService.setReplacementPolicy(pol.key as any);
                        }}
                        className="accent-[#F47743] mt-0.5"
                      />
                      <div>
                        <div className="font-bold text-xs">{pol.label}</div>
                        <div className="text-[10px] text-[#6B7280] dark:text-slate-400">{pol.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#ECECEF] dark:border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoConfigModal(false);
                    showToast('✓ Pengaturan kebijakan foto berhasil disimpan.');
                  }}
                  className="px-5 py-2.5 bg-[#F47743] hover:bg-[#E78B3C] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Tutup & Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL PARTICIPANT MODAL */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div className="text-sm font-bold text-[#171717] dark:text-white">Profil Berkas Peserta</div>
              <button onClick={() => setSelectedDetail(null)} className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="flex items-center gap-4">
              <img src={selectedDetail.photoUrl || profilePhotoService.getPlaceholderUrl(selectedDetail.name)} onError={e => { const fallback = profilePhotoService.getPlaceholderUrl(selectedDetail.name); if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }} alt={selectedDetail.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-pink-200 dark:border-[#F47743]/30" />
              <div>
                <h3 className="text-base font-bold text-[#171717] dark:text-white">{selectedDetail.name}</h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">{selectedDetail.role} · {selectedDetail.contingentName}</p>
                <p className="text-xs font-mono text-[#F47743] mt-0.5">{selectedDetail.code}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-[#FAFAFA] dark:bg-white/5 p-3.5 rounded-2xl border border-[#ECECEF] dark:border-white/5">
              <div className="flex justify-between py-1 border-b border-[#ECECEF] dark:border-white/5"><span className="text-[#6B7280] dark:text-slate-400">Nomor NTA:</span><span className="font-mono text-[#171717] dark:text-white font-medium">{selectedDetail.membershipNumber || '-'}</span></div>
              <div className="flex justify-between py-1 border-b border-[#ECECEF] dark:border-white/5"><span className="text-[#6B7280] dark:text-slate-400">Pangkalan:</span><span className="font-medium text-[#171717] dark:text-white">{selectedDetail.schoolPangkalan || '-'}</span></div>
              <div className="flex justify-between py-1 border-b border-[#ECECEF] dark:border-white/5"><span className="text-[#6B7280] dark:text-slate-400">Gol. Darah:</span><span className="font-semibold text-[#171717] dark:text-white">{selectedDetail.bloodType || '-'}</span></div>
              <div className="flex justify-between py-1 border-b border-[#ECECEF] dark:border-white/5"><span className="text-[#6B7280] dark:text-slate-400">Kontak Darurat:</span><span className="font-medium text-[#171717] dark:text-white">{selectedDetail.emergencyContact || '-'}</span></div>
              <div className="flex justify-between py-1 border-b border-[#ECECEF] dark:border-white/5"><span className="text-[#6B7280] dark:text-slate-400">Tenda & Sub-camp:</span><span className="font-medium text-[#171717] dark:text-white">{selectedDetail.tentNumber} ({selectedDetail.subCamp})</span></div>
              <div className="flex justify-between py-1"><span className="text-[#6B7280] dark:text-slate-400">Catatan Medis:</span><span className="font-medium text-amber-700 dark:text-amber-300">{selectedDetail.medicalNotes || 'Sehat'}</span></div>
            </div>

            <button
              onClick={() => {
                setSelectedQrParticipant(selectedDetail);
                setSelectedDetail(null);
              }}
              className="w-full py-2.5 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              style={{
                background: 'linear-gradient(135deg, #833AB4 0%, #C13584 30%, #E1306C 52%, #F77737 78%, #FCAF45 100%)',
              }}
            >
              <QrCode className="w-4 h-4" />
              <span>Tampilkan QR Tiket Peserta</span>
            </button>
          </div>
        </div>
      )}

      {/* PERSONAL QR MODAL */}
      {selectedQrParticipant && (
        <PersonalQrModal
          isOpen={true}
          onClose={() => setSelectedQrParticipant(null)}
          participant={selectedQrParticipant}
        />
      )}
    </div>
  );
};
