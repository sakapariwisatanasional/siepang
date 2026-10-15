/**
 * @license
 * SiEpang - Participant Directory, Verification Workspace, Step-Registration & Import v1.1
 * Fully implements:
 * - Requirement 8: Single-page participant registration form (identity, Gudep/regu, medical info, photo, documents)
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
  School,
  Plus,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { participantService, type ParticipantDocumentSummary, type ParticipantDocumentType, type ParticipantDocumentDecision } from '../../services/participantService';
import { gudepRegistrationService, GudepRecord, GudepRegu } from '../../services/gudepRegistrationService';
import { authService } from '../../services/authService';
import { profilePhotoService } from '../../services/profilePhotoService';
import { Participant, ParticipantStatus, Contingent, ProfilePhotoStatus, PhotoRequiredConfig, PhotoReplacementPolicy } from '../../types';
import { PersonalQrModal } from './PersonalQrModal';
import { ParticipantAdminDialog } from './ParticipantAdminDialog';
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
  const [adminDialog, setAdminDialog] = useState<{mode:'assign'|'edit'|'archive'; participants:Participant[]} | null>(null);
  const [bulkTargetCategory, setBulkTargetCategory] = useState<Participant['role']>('Penggalang');

  // Modals
  const [selectedQrParticipant, setSelectedQrParticipant] = useState<Participant | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Participant | null>(null);
  const [statusHistoryTarget, setStatusHistoryTarget] = useState<Participant | null>(null);
  const [revisionModalTarget, setRevisionModalTarget] = useState<Participant | null>(null);
  const [revisionReasonText, setRevisionReasonText] = useState('Foto KTA atau dokumen izin kurang jelas, mohon unggah ulang.');
  const [documentTarget, setDocumentTarget] = useState<Participant | null>(null);
  const [documentSummary, setDocumentSummary] = useState<ParticipantDocumentSummary | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({});
  const documentFileInput = useRef<HTMLInputElement | null>(null);
  const uploadDocumentType = useRef<ParticipantDocumentType>('KTA');
  const documentLabels: Record<ParticipantDocumentType, string> = {
    KTA: 'KTA / NTA Pramuka',
    PARENT_CONSENT: 'Surat izin orang tua',
    HEALTH_CERTIFICATE: 'Surat keterangan sehat',
  };
  const documentTypes: ParticipantDocumentType[] = ['KTA', 'PARENT_CONSENT', 'HEALTH_CERTIFICATE'];

  const openDocumentVerification = async (participant: Participant) => {
    setDocumentTarget(participant);
    setDocumentSummary(null);
    setDocumentError('');
    setDocumentLoading(true);
    try {
      setDocumentSummary(await participantService.listParticipantDocuments(participant.id));
    } catch (err: any) {
      setDocumentError(err?.message || 'Gagal membaca berkas dari GAS.');
    } finally {
      setDocumentLoading(false);
    }
  };

  const runDocumentAction = async (operation: () => Promise<ParticipantDocumentSummary>, message: string) => {
    setDocumentBusy(true);
    setDocumentError('');
    try {
      const updated = await operation();
      setDocumentSummary(updated);
      showToast(message);
    } catch (err: any) {
      setDocumentError(err?.message || 'Gagal menyimpan perubahan berkas ke GAS.');
    } finally {
      setDocumentBusy(false);
    }
  };

  const handleDocumentUpload = async (file: File | undefined) => {
    if (!file || !documentTarget) return;
    const type = uploadDocumentType.current;
    await runDocumentAction(
      () => participantService.uploadParticipantDocument(documentTarget.id, type, file),
      'Dokumen berhasil diunggah, menunggu verifikasi digital.'
    );
    if (documentFileInput.current) documentFileInput.current.value = '';
  };

  const handleDocumentDecision = async (type: ParticipantDocumentType, decision: ParticipantDocumentDecision, method: 'DIGITAL' | 'PHYSICAL') => {
    if (!documentTarget) return;
    const notes = (documentNotes[type] || '').trim();
    if (decision !== 'VERIFIED' && !notes) {
      setDocumentError('Masukkan alasan untuk revisi atau penolakan dokumen.');
      return;
    }
    await runDocumentAction(
      () => participantService.verifyParticipantDocument(documentTarget.id, type, decision, method, notes),
      `Status ${documentLabels[type]} tersimpan di GAS.`
    );
  };
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStepRegModal, setShowStepRegModal] = useState(false);
  const [showGudepManager, setShowGudepManager] = useState(false);
  const [managerGudep, setManagerGudep] = useState<GudepRecord[]>([]);
  const [managerSelectedId, setManagerSelectedId] = useState('');
  const [managerRegu, setManagerRegu] = useState<GudepRegu[]>([]);
  const [managerBusy, setManagerBusy] = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState('');
  const [managerMessage, setManagerMessage] = useState('');
  const [gudepForm, setGudepForm] = useState({ gudep_number: '', gudep_name: '', institution_name: '' });
  const [reguForm, setReguForm] = useState({ regu_name: '', gender: 'PUTRA' as 'PUTRA' | 'PUTRI', quota: 8 });
  const gudepCreateKey = useRef(makeRequestKey());
  const reguCreateKey = useRef(makeRequestKey());
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
    docKta: false,
    docIzin: false,
    docSehat: false,
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
      if (active) setGudepOptions((gudep || []).filter(g => g.verification_status === 'VERIFIED' && g.activation_status === 'ACTIVE'));
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
      if (active) setReguOptions((result.regu || []).filter(r => r.verification_status === 'VERIFIED' && r.activation_status === 'ACTIVE'));
    }).catch((err: any) => {
      if (active) { setReguOptions([]); setReguLoadError(err?.message || 'Daftar regu tidak dapat dimuat.'); }
    }).finally(() => { if (active) setReguLoading(false); });
    return () => { active = false; };
  }, [showStepRegModal, stepData.gudepId]);

  const refreshGudepManager = async (preferredId?: string) => {
    setManagerLoading(true);
    try {
      const response = await gudepRegistrationService.list();
      const items = response.gudep || [];
      setManagerGudep(items);
      setManagerSelectedId(previous => items.some(g => g.gudep_id === (preferredId || previous))
        ? (preferredId || previous) : (items[0]?.gudep_id || ''));
      setManagerError('');
    } catch (err: any) {
      setManagerError(err?.message || 'Gagal memuat Gugus Depan dari GAS.');
    } finally { setManagerLoading(false); }
  };

  useEffect(() => {
    if (showGudepManager) void refreshGudepManager();
  }, [showGudepManager]);

  useEffect(() => {
    if (!showGudepManager || !managerSelectedId) { setManagerRegu([]); return; }
    let active = true;
    gudepRegistrationService.detail(managerSelectedId).then(data => {
      if (active) setManagerRegu(data.regu || []);
    }).catch((err: any) => {
      if (active) setManagerError(err?.message || 'Gagal memuat regu.');
    });
    return () => { active = false; };
  }, [showGudepManager, managerSelectedId]);

  const submitNewGudep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (managerBusy) return;
    setManagerBusy(true); setManagerError(''); setManagerMessage('');
    try {
      const result = await gudepRegistrationService.create({ ...gudepForm, request_key: gudepCreateKey.current });
      gudepCreateKey.current = makeRequestKey();
      setGudepForm({ gudep_number: '', gudep_name: '', institution_name: '' });
      setManagerMessage(`Gugus Depan ${result.gudep.gudep_name} tersimpan. Perlu verifikasi dan aktivasi sebelum digunakan mendaftarkan peserta.`);
      await refreshGudepManager(result.gudep.gudep_id);
    } catch (err: any) { setManagerError(err?.message || 'Gagal menyimpan Gudep. Periksa riwayat GAS sebelum mengulangi.'); }
    finally { setManagerBusy(false); }
  };

  const submitNewRegu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (managerBusy || !managerSelectedId) return;
    setManagerBusy(true); setManagerError(''); setManagerMessage('');
    try {
      const result = await gudepRegistrationService.createRegu({ ...reguForm, gudep_id: managerSelectedId, request_key: reguCreateKey.current });
      reguCreateKey.current = makeRequestKey();
      setReguForm({ regu_name: '', gender: 'PUTRA', quota: 8 });
      setManagerMessage(`Regu ${result.regu.regu_name} tersimpan. Regu hanya dapat dipilih peserta setelah diverifikasi dan diaktifkan.`);
      const detail = await gudepRegistrationService.detail(managerSelectedId);
      setManagerRegu(detail.regu || []);
    } catch (err: any) { setManagerError(err?.message || 'Gagal menyimpan regu.'); }
    finally { setManagerBusy(false); }
  };

  const selectedGudep = gudepOptions.find(g => g.gudep_id === stepData.gudepId);
  const matchingRegu = reguOptions.filter(r => r.gender === (stepData.gender === 'M' ? 'PUTRA' : 'PUTRI'));
  const selectedRegu = matchingRegu.find(r => r.regu_id === stepData.reguId);

  const contingents = participantService.getContingents();
  const participants = participantService.getParticipants({
    search,
    status: statusFilter,
    contingentId: contingentFilter,
  });

  const allParticipants = participantService.getParticipants();
  const verifiedCount = allParticipants.filter(p => p.status === 'approved' || p.status === 'verified').length;
  const checkedInCount = allParticipants.filter(p => p.checkedIn).length;

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

  // Verification actions (Requirement 9)
  const handleApprove = (p: Participant) => {
    participantService.approveParticipant(p.id, currentActorName);
    showToast(`✓ Peserta '${p.name}' disetujui (Approved).`);
  };

  const handleVerify = (p: Participant) => {
    participantService.verifyParticipant(p.id, currentActorName);
    showToast(`✓ Berkas '${p.name}' terverifikasi.`);
  };

  const handleConfirmRevision = () => {
    if (!revisionModalTarget) return;
    participantService.requestRevision(revisionModalTarget.id, revisionReasonText, currentActorName);
    showToast(`⚠️ Permintaan perbaikan berkas dikirimkan ke '${revisionModalTarget.name}'.`);
    setRevisionModalTarget(null);
  };

  const handleReject = (p: Participant) => {
    const reason = prompt('Masukkan alasan penolakan berkas:', 'Data ganda atau syarat kepramukaan tidak terpenuhi');
    if (reason) {
      participantService.rejectParticipant(p.id, reason, currentActorName);
      showToast(`Peserta '${p.name}' ditolak.`);
    }
  };

  // Admin participant mutations now use persistent GAS endpoints only.
  // The previous local-only bulk helpers must never claim a successful write.
  const handleExecuteBulkAction = () => {
    if (!bulkActionConfirm) return;
    if (bulkActionConfirm.action === 'assign_contingent' || bulkActionConfirm.action === 'archive') {
      const picked = participants.filter(p => selectedIds.includes(p.id));
      if (picked.length) setAdminDialog({mode:bulkActionConfirm.action === 'archive'?'archive':'assign',participants:picked});
    } else {
      showToast('Aksi massal ini belum memiliki endpoint GAS resmi; perubahan tidak dijalankan.');
    }
    setBulkActionConfirm(null);
  };

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
      return;
    }

    // Requirement 27: Final submission rule: if photo required, reject submission if no photo
    const entityType = (stepData.role === 'Pembina Pendamping' || stepData.role === 'Pimpinan Kontingen') ? 'OFFICIAL' : 'PARTICIPANT';
    if (!profilePhotoService.isSubmissionAllowed(entityType, stepData.profile_photo_status)) {
      showToast('⚠️ Foto profil resmi wajib diunggah sebelum pendaftaran dapat diselesaikan.');
      return;
    }

    if (!stepData.docKta || !stepData.docIzin || !stepData.docSehat) {
      showToast('Konfirmasi bahwa tiga berkas wajib akan disiapkan secara digital atau dibawa fisik.');
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
      docKta: false,
      docIzin: false,
      docSehat: false,
      photoUrl: '',
      profile_photo_file_id: '',
      profile_photo_status: 'NOT_UPLOADED',
    });
  };

  // Process CSV import (Requirement 12)
  const handleProcessImport = () => {
    const lines = rawCsvText.trim().split('\n');
    if (lines.length < 2) {
      alert('File CSV harus memiliki header dan minimal 1 baris data.');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] || '';
      });
      return obj;
    });

    const res = participantService.importParticipants(rows, currentActorName);
    setImportResult(res);
    setImportStep('result');
    showToast(`✅ Impor selesai: ${res.accepted} Diterima, ${res.needsReview} Ditinjau.`);
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

      {/* Navigation and actions are deliberately separate; all existing handlers remain intact. */}
      <section className="rounded-[24px] border border-[#ECECEF] dark:border-white/10 bg-white dark:bg-[#141418] p-4 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Event Studio / Peserta</p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#171717] dark:text-white">Manajemen Peserta</h1>
            <p className="text-sm mt-1 text-[#6B7280] dark:text-slate-400">Pendaftaran, verifikasi, kehadiran, dan data peserta dalam satu tempat.</p>
          </div>
          <button type="button" onClick={() => { setRegStep(1); setRegistrationRequestKey(makeRequestKey()); setShowStepRegModal(true); }}
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm min-h-[44px]">
            <UserPlus className="w-4 h-4" /> Registrasi Peserta
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3" aria-label="Ringkasan peserta dari data yang dimuat">
          {[
            {label:'Total Terdaftar', count:allParticipants.length},
            {label:'Terverifikasi', count:verifiedCount},
            {label:'Menunggu Verifikasi', count:pendingVerificationList.length},
            {label:'Check-in Buper', count:checkedInCount},
          ].map(stat => <div key={stat.label} className="rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 p-3 sm:p-4">
            <p className="text-xs text-[#6B7280] dark:text-slate-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-[#171717] dark:text-white tabular-nums">{loadState === 'ready' ? stat.count : '—'}</p>
          </div>)}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Halaman pengelolaan peserta">
            <button type="button" onClick={() => setActiveView('directory')} aria-current={activeView === 'directory' ? 'page' : undefined}
              className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold ${activeView === 'directory' ? 'bg-emerald-600 text-white' : 'bg-[#FAFAFA] dark:bg-white/5 text-[#171717] dark:text-slate-200 border border-[#ECECEF] dark:border-white/10'}`}><Users className="w-4 h-4"/> Direktori Peserta</button>
            <button type="button" onClick={() => setActiveView('verification')} aria-current={activeView === 'verification' ? 'page' : undefined}
              className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold ${activeView === 'verification' ? 'bg-emerald-600 text-white' : 'bg-[#FAFAFA] dark:bg-white/5 text-[#171717] dark:text-slate-200 border border-[#ECECEF] dark:border-white/10'}`}><ShieldCheck className="w-4 h-4"/> Verifikasi Berkas {pendingVerificationList.length > 0 && <span className="rounded-full bg-orange-500 px-2 text-white text-xs">{pendingVerificationList.length}</span>}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowGudepManager(true)} className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#ECECEF] dark:border-white/10 px-3 py-2 text-xs font-semibold text-[#171717] dark:text-slate-200"><School className="w-4 h-4"/> Gudep & Regu</button>
            <button type="button" onClick={() => setShowImportModal(true)} className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#ECECEF] dark:border-white/10 px-3 py-2 text-xs font-semibold text-[#171717] dark:text-slate-200"><Upload className="w-4 h-4"/> Impor CSV</button>
            <button type="button" onClick={() => setShowPhotoConfigModal(true)} className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#ECECEF] dark:border-white/10 px-3 py-2 text-xs font-semibold text-[#171717] dark:text-slate-200"><Camera className="w-4 h-4"/> Kebijakan Foto</button>
          </div>
        </div>
      </section>

      {/* VIEW 1: DIRECTORY WITH BULK ACTIONS */}
      {activeView === 'directory' && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Cari nama, nomor NTA, kode peserta, atau Gugus Depan..."
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
              <option value="all">Semua Gugus Depan</option>
              {[...new Map(allParticipants.map(p=>[p.contingentId,{id:p.contingentId,name:p.contingentName}])).values()].filter(c=>c.id).map(c=>(<option key={c.id} value={c.id}>{c.name}</option>))}
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
                      label: 'Alokasikan Gudep & Regu Massal',
                      impactDescription: `Pindahkan ${selectedIds.length} peserta ke Gudep dan Regu aktif setelah validasi GAS.`,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-semibold border border-white/10 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                  title="Alokasikan Gudep dan Regu"
                  aria-label="Alokasikan Gudep dan Regu"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Atur Gudep/Regu</span>
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
          <div className="hidden lg:block rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 overflow-x-auto max-w-full shadow-xs">
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
                            <button type="button" onClick={() => setAdminDialog({mode:'edit', participants:[p]})}
                              className="p-2 rounded-xl bg-white/5 text-emerald-500 border border-white/10 text-[10px] font-bold" title="Edit Peserta">Edit</button>
                            <button type="button" onClick={() => setAdminDialog({mode:'archive', participants:[p]})}
                              className="p-2 rounded-xl bg-white/5 text-rose-400 border border-white/10 text-[10px] font-bold" title="Arsipkan Peserta">Arsip</button>
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
          {/* Mobile cards: use the SAME filtered GAS-derived records and action handlers as desktop. */}
          <div className="lg:hidden space-y-3" aria-label="Daftar peserta">
            {loadState === 'loading' ? <p role="status" className="p-5 rounded-2xl bg-white dark:bg-[#141418] text-sm dark:text-white">Memuat peserta dari GAS…</p>
            : loadState === 'error' ? <div role="alert" className="rounded-2xl border border-red-500/30 p-4 text-sm text-red-600">Gagal memuat peserta: {loadError}</div>
            : participants.length === 0 ? <p className="rounded-2xl border border-[#ECECEF] dark:border-white/10 p-5 text-sm text-[#6B7280]">Belum ada peserta yang sesuai dengan filter.</p>
            : participants.map(p => <article key={p.id} className="rounded-2xl border border-[#ECECEF] dark:border-white/10 bg-white dark:bg-[#141418] p-4 space-y-3">
              <div className="flex gap-3 items-start">
                <input type="checkbox" className="mt-3 accent-emerald-600" aria-label={`Pilih ${p.name}`} checked={selectedIds.includes(p.id)} onChange={e => setSelectedIds(prev => e.target.checked ? [...prev.filter(id => id !== p.id),p.id] : prev.filter(id => id !== p.id))}/>
                <img src={p.photoUrl || profilePhotoService.getPlaceholderUrl(p.name)} onError={e => { const fallback = profilePhotoService.getPlaceholderUrl(p.name); if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }} alt="" className="h-11 w-11 rounded-xl object-cover shrink-0"/>
                <div className="min-w-0 flex-1"><button type="button" onClick={() => setSelectedDetail(p)} className="font-bold text-left text-[#171717] dark:text-white break-words">{p.name}</button><p className="text-xs text-[#6B7280] dark:text-slate-400 break-all">{p.code} · NTA: {p.membershipNumber || '—'}</p><p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1">{p.contingentName || 'Belum ada kontingen'}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">{getStatusBadge(p.status)}<span className="text-xs text-[#6B7280] dark:text-slate-300">{p.xp} XP · {p.attendanceCount} kegiatan</span></div>
              <div className="flex gap-2 items-center flex-wrap border-t border-[#ECECEF] dark:border-white/10 pt-3">
                <button type="button" onClick={() => setSelectedDetail(p)} className="rounded-xl px-3 py-2 text-xs font-bold bg-emerald-600 text-white min-h-[42px]">Lihat Detail</button>
                <button type="button" onClick={() => setAdminDialog({mode:'edit',participants:[p]})} className="rounded-xl px-3 py-2 text-xs font-semibold min-h-[42px] border border-[#ECECEF] dark:border-white/10 dark:text-white">Edit</button>
                <details className="relative group"><summary className="list-none cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold min-h-[42px] border border-[#ECECEF] dark:border-white/10 dark:text-white flex items-center gap-1"><MoreHorizontal className="w-4 h-4"/> Lainnya</summary><div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedQrParticipant(p)} className="rounded-xl px-3 py-2 text-xs border border-[#ECECEF] dark:border-white/10 dark:text-white">QR Pass</button>
                  <button type="button" onClick={() => setStatusHistoryTarget(p)} className="rounded-xl px-3 py-2 text-xs border border-[#ECECEF] dark:border-white/10 dark:text-white">Riwayat</button>
                  <button type="button" onClick={() => setAdminDialog({mode:'archive',participants:[p]})} className="rounded-xl px-3 py-2 text-xs border border-rose-500/30 text-rose-600">Arsip</button>
                  <button type="button" onClick={() => handleCheckInToggle(p)} className="rounded-xl px-3 py-2 text-xs border border-[#ECECEF] dark:border-white/10 dark:text-white">{p.checkedIn ? 'Status Check-in' : 'Check-in Buper'}</button>
                </div></details>
              </div>
            </article>)}
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
                Periksa KTA, izin orang tua, dan surat sehat secara digital atau fisik. Status tersimpan di GAS.
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
                      <button type="button" onClick={() => void openDocumentVerification(p)} className="w-full rounded-xl border border-[#F47743]/40 px-3 py-2 text-xs font-bold text-[#F47743] hover:bg-orange-50 dark:hover:bg-white/5">
                        Periksa KTA, Izin Orang Tua & Surat Sehat (GAS)
                      </button>
                      <p className="mt-2 text-[10px] text-[#6B7280]">Status berkas wajib dibaca dari GAS; tidak diasumsikan lengkap.</p>
                    </div>
                  </div>

                  <button type="button" onClick={() => void openDocumentVerification(p)} className="w-full rounded-xl bg-[#F47743] p-2.5 text-xs font-bold text-white hover:opacity-90">
                    Buka Pemeriksaan Dokumen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PERSISTENT DOCUMENT VERIFICATION — GAS is the only source of truth */}
      {documentTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Verifikasi dokumen peserta">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#141418] sm:p-7">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#171717] dark:text-white">Verifikasi Berkas Peserta</h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-300">{documentTarget.name} — {documentTarget.code}</p>
              </div>
              <button type="button" disabled={documentBusy} onClick={() => setDocumentTarget(null)} className="rounded-lg border px-3 py-1 text-sm dark:text-white">Tutup</button>
            </div>
            {documentError && <p role="alert" className="mb-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{documentError}</p>}
            {documentLoading && <p className="p-3 text-sm dark:text-white">Memuat status dokumen dari GAS...</p>}
            {!documentLoading && documentSummary && (
              <>
                <p className={`mb-3 rounded-xl p-3 text-xs font-semibold ${documentSummary.all_verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {documentSummary.all_verified ? 'Ketiga dokumen telah diverifikasi.' : 'Masih ada dokumen yang belum lolos verifikasi.'}
                </p>
                <input ref={documentFileInput} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e => void handleDocumentUpload(e.target.files?.[0])} />
                <div className="space-y-3">
                  {documentTypes.map(type => {
                    const doc = documentSummary.documents.find(row => row.document_type === type);
                    const status = doc?.verification_status || 'NOT_SUBMITTED';
                    const method = doc?.method || 'NOT_SELECTED';
                    const verified = status === 'VERIFIED';
                    return (
                      <div key={type} className="rounded-2xl border border-[#ECECEF] p-4 dark:border-white/10">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm text-[#171717] dark:text-white">{documentLabels[type]}</strong>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{method} / {status}</span>
                        </div>
                        {doc?.original_filename && <p className="mt-1 text-[11px] text-[#6B7280]">Berkas: {doc.original_filename} (tersimpan di Drive)</p>}
                        {doc?.notes && <p className="mt-1 text-xs text-amber-700">Catatan pemeriksa: {doc.notes}</p>}
                        {!verified && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" disabled={documentBusy} onClick={() => { uploadDocumentType.current = type; documentFileInput.current?.click(); }} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#171717] disabled:opacity-50 dark:text-white">Unggah PDF/JPG/PNG</button>
                            <button type="button" disabled={documentBusy} onClick={() => documentTarget && void runDocumentAction(() => participantService.chooseParticipantDocumentPhysical(documentTarget.id, type), 'Pemeriksaan fisik telah dijadwalkan.')} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#171717] disabled:opacity-50 dark:text-white">Bawa berkas fisik</button>
                          </div>
                        )}
                        {status !== 'NOT_SUBMITTED' && !verified && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-[#6B7280]">Pemeriksaan {method === 'DIGITAL' ? 'digital' : 'fisik di lokasi'} — hanya nyatakan valid setelah pemeriksaan.</p>
                            <textarea rows={2} value={documentNotes[type] || ''} onChange={e => setDocumentNotes(prev => ({...prev, [type]: e.target.value}))} placeholder="Alasan revisi / penolakan (wajib jika tidak valid)" className="w-full rounded-lg border bg-transparent p-2 text-xs dark:text-white" />
                            <div className="flex flex-wrap gap-2">
                              <button type="button" disabled={documentBusy || method === 'NOT_SELECTED'} onClick={() => void handleDocumentDecision(type, 'VERIFIED', method as 'DIGITAL' | 'PHYSICAL')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Verifikasi Valid</button>
                              <button type="button" disabled={documentBusy || method === 'NOT_SELECTED'} onClick={() => void handleDocumentDecision(type, 'REVISION', method as 'DIGITAL' | 'PHYSICAL')} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Perlu Revisi</button>
                              <button type="button" disabled={documentBusy || method === 'NOT_SELECTED'} onClick={() => void handleDocumentDecision(type, 'REJECTED', method as 'DIGITAL' | 'PHYSICAL')} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Tolak</button>
                            </div>
                          </div>
                        )}
                        {verified && <p className="mt-2 text-xs font-semibold text-emerald-700">✓ Berkas valid. Tidak memerlukan pemeriksaan fisik ulang.</p>}
                      </div>
                    );
                  })}
                </div>
                <button type="button" disabled={documentBusy} onClick={() => void openDocumentVerification(documentTarget)} className="mt-4 rounded-lg border px-4 py-2 text-xs font-semibold dark:text-white">Muat Ulang Status dari GAS</button>
              </>
            )}
          </div>
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

      {adminDialog && <ParticipantAdminDialog mode={adminDialog.mode} participants={adminDialog.participants}
        onClose={() => setAdminDialog(null)} onSaved={message => { setSelectedIds([]); showToast(message); }} />}

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

      {/* Gugus Depan dan Regu: data ditulis melalui GAS, bukan localStorage. */}
      {showGudepManager && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Kelola Gugus Depan dan Regu">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#141418] shadow-2xl p-5 sm:p-7 space-y-5 text-slate-900 dark:text-white">
            <div className="flex justify-between gap-3 items-start border-b dark:border-white/10 pb-4">
              <div><h2 className="text-xl font-bold">Pendaftaran Gugus Depan & Regu</h2><p className="text-sm text-slate-500 dark:text-slate-400">Buat pangkalan dan regu langsung dari halaman peserta.</p></div>
              <button type="button" aria-label="Tutup" onClick={() => setShowGudepManager(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            {managerError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{managerError}</p>}
            {managerMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{managerMessage}</p>}
            <form onSubmit={submitNewGudep} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <h3 className="font-bold flex gap-2 items-center"><School className="h-4 w-4" /> 1. Tambah Gugus Depan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">Nomor Gugus Depan *<input required maxLength={60} value={gudepForm.gudep_number} onChange={e => setGudepForm(x=>({...x,gudep_number:e.target.value}))} placeholder="Contoh: 07.101–07.102" className="mt-1 w-full rounded-xl border p-3 bg-white text-slate-900 dark:bg-[#242428] dark:border-white/20 dark:text-white" /></label>
                <label className="text-sm">Nama Gugus Depan *<input required maxLength={150} value={gudepForm.gudep_name} onChange={e => setGudepForm(x=>({...x,gudep_name:e.target.value}))} placeholder="Contoh: Gugus Depan Melati" className="mt-1 w-full rounded-xl border p-3 bg-white text-slate-900 dark:bg-[#242428] dark:border-white/20 dark:text-white" /></label>
              </div>
              <label className="text-sm block">Nama Pangkalan / Sekolah<input maxLength={150} value={gudepForm.institution_name} onChange={e => setGudepForm(x=>({...x,institution_name:e.target.value}))} placeholder="Contoh: SMP Negeri 1 Malang" className="mt-1 w-full rounded-xl border p-3 bg-white text-slate-900 dark:bg-[#242428] dark:border-white/20 dark:text-white" /></label>
              <div className="flex justify-end"><button type="submit" disabled={managerBusy} className="rounded-xl bg-emerald-600 disabled:opacity-50 text-white font-bold px-4 py-2.5 inline-flex gap-2 items-center"><Plus className="h-4 w-4" /> Simpan Gudep ke GAS</button></div>
            </form>
            <form onSubmit={submitNewRegu} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><h3 className="font-bold flex gap-2 items-center"><Users className="h-4 w-4" /> 2. Tambah Regu</h3><button type="button" disabled={managerLoading || managerBusy} onClick={() => void refreshGudepManager()} className="text-xs text-emerald-600 flex gap-1 items-center"><RefreshCw className="h-3.5 w-3.5" /> Segarkan</button></div>
              <label className="text-sm block">Pilih Gugus Depan *<select required value={managerSelectedId} onChange={e => setManagerSelectedId(e.target.value)} className="mt-1 w-full rounded-xl border p-3 bg-white text-slate-900 dark:bg-[#242428] dark:border-white/20 dark:text-white"><option value="">{managerLoading?'Memuat…':'-- Pilih Gugus Depan --'}</option>{managerGudep.map(g=><option value={g.gudep_id} key={g.gudep_id}>{g.gudep_number} — {g.gudep_name} ({g.verification_status})</option>)}</select></label>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-sm">Nama Regu *<input required maxLength={120} value={reguForm.regu_name} onChange={e=>setReguForm(x=>({...x,regu_name:e.target.value}))} placeholder="Contoh: Regu Elang" className="mt-1 w-full rounded-xl border p-3 bg-white text-slate-900 dark:bg-[#242428] dark:border-white/20 dark:text-white" /></label>
                <label className="text-sm">Jenis Regu *<select value={reguForm.gender} onChange={e=>setReguForm(x=>({...x,gender:e.target.value as 'PUTRA'|'PUTRI'}))} className="mt-1 w-full rounded-xl border p-3 bg-white text-slate-900 dark:bg-[#242428] dark:border-white/20 dark:text-white"><option value="PUTRA">Putra</option><option value="PUTRI">Putri</option></select></label>
                <label className="text-sm">Kuota (1–100) *<input required type="number" min={1} max={100} value={reguForm.quota} onChange={e=>setReguForm(x=>({...x,quota:Number(e.target.value)}))} className="mt-1 w-full rounded-xl border p-3 bg-white text-slate-900 dark:bg-[#242428] dark:border-white/20 dark:text-white" /></label>
              </div>
              <div className="flex justify-end"><button type="submit" disabled={managerBusy || !managerSelectedId} className="rounded-xl bg-emerald-600 disabled:opacity-50 text-white font-bold px-4 py-2.5 inline-flex gap-2 items-center"><Plus className="h-4 w-4" /> Simpan Regu ke GAS</button></div>
              {managerSelectedId && <div className="text-sm space-y-1"><h4 className="font-semibold">Daftar regu di Gudep terpilih ({managerRegu.length})</h4>{managerRegu.map(r=><p key={r.regu_id} className="border-b border-slate-100 dark:border-white/10 py-1">{r.regu_name} · {r.gender} · Kuota {r.quota} · {r.verification_status || 'PENDING'}</p>)}</div>}
            </form>
            <p className="text-xs text-amber-700 dark:text-amber-300">Gudep dan regu baru berstatus draf/pending. Data peserta hanya dapat menggunakan Gudep/Regu yang sudah diverifikasi dan diaktifkan oleh Admin. Jika muncul ADMIN_ONLY, backend GAS harus diperbarui agar role registration_officer mendapat izin pembuatan.</p>
          </div>
        </div>
      )}

      {/* STEP-BASED REGISTRATION MODAL (Requirement 8) */}
      {showStepRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleFinishStepReg}
            className="siepang-participant-registration w-full max-w-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div>
                <span className="text-[10px] text-[#F47743] font-bold font-mono">FORMULIR LENGKAP · 1 HALAMAN</span>
                <h3 className="text-base font-bold text-[#171717] dark:text-white">Formulir Pendaftaran Peserta</h3>
              </div>
              <button type="button" disabled={isSubmittingRegistration} onClick={() => setShowStepRegModal(false)} className="p-1 text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <p className="text-xs text-[#6B7280] dark:text-slate-400">Isi seluruh persyaratan dalam satu halaman. Kolom bertanda * wajib diisi; tinjau data sebelum menyimpan ke GAS.</p>

            {/* STEP 1: IDENTITY */}
            
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


            {/* STEP 2: GUGUS DEPAN & REGU — sumber tunggal dari GAS */}
            
              <div className="space-y-3 text-xs animate-in fade-in">
                <div className="font-bold text-[#171717] dark:text-slate-200">2. Pilih Gugus Depan & Regu</div>
                <p className="text-[#6B7280] dark:text-slate-400">Pilih Gudep terlebih dahulu. Regu disaring otomatis berdasarkan pilihan Putra/Putri di bagian identitas.</p>
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


            {/* STEP 3: PARTICIPANT INFORMATION */}
            
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


            {/* STEP 4: PHOTO & REQUIRED DOCUMENTS (Requirements 25 - 34) */}
            
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
                  <div className="text-[11px] font-semibold text-[#171717] dark:text-slate-300">Konfirmasi kesediaan menyiapkan berkas (unggah digital atau bawa fisik):</div>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepData.docKta}
                      required
                      onChange={e => setStepData({ ...stepData, docKta: e.target.checked })}
                      className="accent-[#F47743] rounded"
                    />
                    <span className="text-[#171717] dark:text-slate-200">KTA / NTA Pramuka tersedia untuk diunggah atau dibawa fisik</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepData.docIzin}
                      required
                      onChange={e => setStepData({ ...stepData, docIzin: e.target.checked })}
                      className="accent-[#F47743] rounded"
                    />
                    <span className="text-[#171717] dark:text-slate-200">Surat izin orang tua akan disiapkan secara digital atau fisik</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepData.docSehat}
                      required
                      onChange={e => setStepData({ ...stepData, docSehat: e.target.checked })}
                      className="accent-[#F47743] rounded"
                    />
                    <span className="text-[#171717] dark:text-slate-200">Surat keterangan sehat akan disiapkan secara digital atau fisik</span>
                  </label>
                </div>
              </div>


            <div className="pt-4 border-t border-[#ECECEF] dark:border-white/10 space-y-3">
              <p className="text-xs text-[#6B7280] dark:text-slate-400">Pastikan nama, Gudep, regu, foto profil, dan kelengkapan berkas sudah benar sebelum mengirimkan pendaftaran.</p>
              <button
                type="submit"
                disabled={isSubmittingRegistration || gudepLoading || reguLoading || !selectedGudep || !selectedRegu}
                aria-busy={isSubmittingRegistration}
                className="w-full px-6 py-3 text-white rounded-xl text-sm font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #833AB4 0%, #C13584 30%, #E1306C 52%, #F77737 78%, #FCAF45 100%)' }}
              >
                {isSubmittingRegistration ? 'Menyimpan ke GAS…' : 'Kirim & Daftarkan Peserta'}
              </button>
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

      {/* DETAIL PESERTA — tampilan detail dari data yang sudah dimuat; aksi tetap memakai handler lama. */}
      {selectedDetail && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-5" role="dialog" aria-modal="true" aria-label={`Detail peserta ${selectedDetail.name}`}>
          <div className="w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto bg-white dark:bg-[#141418] sm:rounded-[24px] border border-[#ECECEF] dark:border-white/10 shadow-2xl">
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#141418]/95 backdrop-blur border-b border-[#ECECEF] dark:border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Manajemen Peserta / Direktori</p><h2 className="text-lg sm:text-xl font-bold text-[#171717] dark:text-white">Detail Peserta</h2></div>
              <button type="button" onClick={() => setSelectedDetail(null)} aria-label="Tutup detail peserta" className="shrink-0 p-2 rounded-xl border border-[#ECECEF] dark:border-white/10 text-[#171717] dark:text-white hover:bg-gray-100 dark:hover:bg-white/10"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 sm:p-6 space-y-5">
              <section className="flex items-start gap-4 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 p-4">
                <img src={selectedDetail.photoUrl || profilePhotoService.getPlaceholderUrl(selectedDetail.name)} onError={e => { const fallback = profilePhotoService.getPlaceholderUrl(selectedDetail.name); if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }} alt={selectedDetail.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-[#ECECEF] dark:border-white/10"/>
                <div className="min-w-0 flex-1"><h3 className="font-bold text-lg text-[#171717] dark:text-white break-words">{selectedDetail.name}</h3><p className="text-sm text-[#6B7280] dark:text-slate-300">{selectedDetail.role} · {selectedDetail.contingentName || 'Kontingen belum ditentukan'}</p><p className="mt-1 text-xs font-mono break-all text-[#6B7280] dark:text-slate-400">Kode: {selectedDetail.code || 'Belum tersedia'}</p><div className="mt-2">{getStatusBadge(selectedDetail.status)}</div></div>
              </section>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 p-3"><p className="text-xs text-[#6B7280] dark:text-slate-400">Verifikasi</p><p className="mt-1 font-bold text-[#171717] dark:text-white capitalize">{selectedDetail.status || '—'}</p></div>
                <div className="rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 p-3"><p className="text-xs text-[#6B7280] dark:text-slate-400">Check-in Buper</p><p className="mt-1 font-bold text-[#171717] dark:text-white">{selectedDetail.checkedIn ? 'Sudah hadir' : 'Belum check-in'}</p></div>
                <div className="rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 p-3"><p className="text-xs text-[#6B7280] dark:text-slate-400">Presensi kegiatan</p><p className="mt-1 font-bold text-[#171717] dark:text-white">{selectedDetail.attendanceCount ?? 0} kegiatan</p></div>
                <div className="rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 p-3"><p className="text-xs text-[#6B7280] dark:text-slate-400">Poin XP</p><p className="mt-1 font-bold text-emerald-700 dark:text-emerald-400">{selectedDetail.xp ?? 0} XP</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="rounded-2xl border border-[#ECECEF] dark:border-white/10 p-4 space-y-3"><h4 className="font-bold text-[#171717] dark:text-white flex items-center gap-2"><Users className="w-4 h-4"/> Identitas & Keanggotaan</h4>
                  {([['Nomor NTA',selectedDetail.membershipNumber],['Jenis kelamin',selectedDetail.gender === 'M' || selectedDetail.gender === 'L' ? 'Putra' : 'Putri'],['Gugus depan / Pangkalan',selectedDetail.schoolPangkalan],['Kontingen',selectedDetail.contingentName],['Email',selectedDetail.email],['Telepon',selectedDetail.phone]] as Array<[string, string | undefined]>).map(([label,value]) => <div key={label} className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-[#ECECEF] dark:border-white/5 pb-2 text-sm"><span className="text-[#6B7280] dark:text-slate-400">{label}</span><span className="font-medium text-[#171717] dark:text-white break-all sm:text-right">{value || 'Belum diisi'}</span></div>)}
                </section>
                <section className="rounded-2xl border border-[#ECECEF] dark:border-white/10 p-4 space-y-3"><h4 className="font-bold text-[#171717] dark:text-white flex items-center gap-2"><School className="w-4 h-4"/> Perkemahan & Kontak</h4>
                  {([['Subcamp',selectedDetail.subCamp],['Nomor tenda',selectedDetail.tentNumber],['Kontak darurat',selectedDetail.emergencyContact],['Golongan darah',selectedDetail.bloodType]] as Array<[string,string | undefined]>).map(([label,value]) => <div key={label} className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-[#ECECEF] dark:border-white/5 pb-2 text-sm"><span className="text-[#6B7280] dark:text-slate-400">{label}</span><span className="font-medium text-[#171717] dark:text-white break-all sm:text-right">{value || 'Belum diisi'}</span></div>)}
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3"><p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Catatan medis — akses petugas berwenang saja</p><p className="text-sm mt-1 text-amber-900 dark:text-amber-200">{selectedDetail.medicalNotes || 'Tidak ada catatan yang tercatat'}</p></div>
                </section>
              </div>
              {selectedDetail.status === 'revision' && selectedDetail.revisionReason && <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">Alasan revisi: {selectedDetail.revisionReason}</div>}
              <section className="border-t border-[#ECECEF] dark:border-white/10 pt-4"><h4 className="font-bold text-[#171717] dark:text-white mb-3">Tindakan Peserta</h4><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button type="button" onClick={() => { setSelectedQrParticipant(selectedDetail); setSelectedDetail(null); }} className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2"><QrCode className="w-4 h-4"/> Lihat QR Pass</button>
                <button type="button" onClick={() => { setStatusHistoryTarget(selectedDetail); setSelectedDetail(null); }} className="min-h-[44px] rounded-xl border border-[#ECECEF] dark:border-white/10 text-[#171717] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5"><History className="w-4 h-4"/> Riwayat Status</button>
                <button type="button" onClick={() => { const participant = selectedDetail; setSelectedDetail(null); void openDocumentVerification(participant); }} className="min-h-[44px] rounded-xl border border-[#ECECEF] dark:border-white/10 text-[#171717] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5"><FileText className="w-4 h-4"/> Verifikasi Berkas</button>
              </div></section>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">Informasi ini berasal dari daftar peserta yang dimuat aplikasi. Untuk memastikan perubahan terbaru, muat ulang direktori peserta dari GAS.</p>
            </div>
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
