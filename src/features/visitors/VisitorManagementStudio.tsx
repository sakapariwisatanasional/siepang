/**
 * @license
 * SiEpang - Visitor / Camp Guest Management Studio (Req 21-56)
 * Complete operational module for event organizers and gate officers:
 * - Live camp occupancy tracking (Inside Camp count)
 * - Visitor registration approvals, rejections & revocation
 * - Fast Mobile Gate Officer interface (Check-In & Check-Out)
 * - Gates management (Gate Utama, Gate Barat, VIP Gate)
 * - Immutable Visit Logs audit
 * - Visiting hours, quotas, and rules configuration
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  LogOut,
  QrCode,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DoorOpen,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Eye,
  X,
  Check,
  Lock,
  Printer,
  Sparkles,
  Phone,
  Car,
  FileText,
  AlertOctagon,
} from 'lucide-react';
import {
  visitorManagementService,
  GateScanResult,
} from '../../services/visitorManagementService';
import {
  VisitorRegistration,
  VisitorGate,
  VisitorVisitLog,
  VisitorStatus,
  VisitorCategory,
} from '../../types';
import { authService } from '../../services/authService';

export const VisitorManagementStudio: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const currentActorName = currentUser?.name || 'Petugas Keamanan Gerbang';
  const [activeTab, setActiveTab] = useState<'directory' | 'gate' | 'gates_config' | 'logs' | 'rules'>('directory');

  // Directory filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Gate Scanner state (Req 31, 32, 39)
  const gates = visitorManagementService.getGates();
  const [selectedGateId, setSelectedGateId] = useState<string>(gates[0]?.id || 'gate_utama');
  const [scanInput, setScanInput] = useState('');
  const [scanDirection, setScanDirection] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [, refreshView] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(true);
  useEffect(() => {
    let active = true;
    const unsubscribe = visitorManagementService.subscribe(() => { if (active) refreshView(x => x + 1); });
    visitorManagementService.loadVisitors().then(() => { if (active) setLoadError(''); })
      .catch(e => { if (active) setLoadError(e?.message || 'Gagal memuat pengunjung.'); })
      .finally(() => { if (active) setIsLoadingVisitors(false); });
    return () => { active = false; unsubscribe(); };
  }, []);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<GateScanResult | null>(null);
  const [overrideHoursPrompt, setOverrideHoursPrompt] = useState<string | null>(null);

  // Kamera hanya membaca token. Petugas tetap harus memilih MASUK/KELUAR dan
  // menekan Validasi: tidak ada transaksi gerbang otomatis saat kamera mendeteksi QR.
  useEffect(() => {
    if (!cameraOpen || activeTab !== 'gate') return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let polling: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      stopped = true;
      if (polling) clearTimeout(polling);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    };
    const start = async () => {
      setCameraError('');
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Kamera memerlukan HTTPS dan izin kamera. Gunakan input manual atau scanner eksternal.');
        return;
      }
      try {
        type QRHit = { rawValue: string };
        type QRDetector = { detect: (source: HTMLVideoElement) => Promise<QRHit[]> };
        type QRDetectorConstructor = new (options: { formats: string[] }) => QRDetector;
        const Detector = (window as Window & { BarcodeDetector?: QRDetectorConstructor }).BarcodeDetector;
        if (!Detector) {
          setCameraError('Pembaca QR kamera belum didukung browser ini. Gunakan browser dengan BarcodeDetector, atau scanner eksternal/input manual.');
          return;
        }
        const detector = new Detector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const video = cameraVideoRef.current;
        if (!video) { stop(); return; }
        video.srcObject = stream;
        await video.play();
        const poll = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const hits = await detector.detect(video);
              const token = hits.find(h => typeof h.rawValue === 'string' && h.rawValue.trim())?.rawValue.trim();
              if (token && !stopped) {
                setScanInput(token);
                setCameraOpen(false);
                return;
              }
            }
          } catch { /* Kamera bergerak / frame belum siap; coba frame berikutnya. */ }
          if (!stopped) polling = setTimeout(() => { void poll(); }, 220);
        };
        void poll();
      } catch (error) {
        if (stopped) return;
        const kind = error instanceof Error ? error.name : '';
        setCameraError(kind === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser.' : 'Tidak dapat mengaktifkan kamera. Periksa perangkat dan izinnya.');
        if (stream) stream.getTracks().forEach(t => t.stop());
      }
    };
    void start();
    return stop;
  }, [cameraOpen, cameraRetry, activeTab]);

  // Modals state
  const [inspectedVisitor, setInspectedVisitor] = useState<VisitorRegistration | null>(null);
  const [rejectModalVisitor, setRejectModalVisitor] = useState<VisitorRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('Kuota kunjungan telah penuh / waktu kunjungan tidak sesuai');
  const [revokeModalVisitor, setRevokeModalVisitor] = useState<VisitorRegistration | null>(null);
  const [revokeReason, setRevokeReason] = useState('Pelanggaran tata tertib bumi perkemahan');
  const [showAddGateModal, setShowAddGateModal] = useState(false);
  const [newGateForm, setNewGateForm] = useState({
    gateName: '',
    location: '',
    operatingHours: '08:00 - 17:00',
    allowedCategories: ['Orang Tua / Wali', 'Keluarga', 'Umum'] as VisitorCategory[],
  });

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const visitors = visitorManagementService.getVisitors();
  const metrics = visitorManagementService.getVisitorMetrics();
  const overdueVisitors = visitorManagementService.getOverdueVisitors();
  const visitLogs = visitorManagementService.getVisitLogs();
  const rules = visitorManagementService.getRules();

  // Filtered visitors
  const filteredVisitors = visitors.filter(v => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        v.name.toLowerCase().includes(q) ||
        v.registrationCode.toLowerCase().includes(q) ||
        (v.personVisited?.targetName || '').toLowerCase().includes(q) ||
        v.phone.includes(q)
      );
    }
    return true;
  });

  // 1. GATE OFFICER SCAN HANDLER (Req 31, 32)
  const handlePerformGateScan = async (overrideHours: boolean = false) => {
    if (!scanInput.trim() || isProcessingScan) return;
    if (!currentUser) { showToast('Petugas wajib login sebelum mencatat gerbang.'); return; }
    setIsProcessingScan(true);
    setLastScanResult(null);

    try {
      const result = await visitorManagementService.processGateScan(
        scanInput.trim(),
        selectedGateId,
        currentActorName,
        {
          forceCheckout: scanDirection === 'CHECK_OUT',
        }
      );

      setLastScanResult(result);
      if (result.success) {
        showToast(result.message);
        setScanInput('');
        setOverrideHoursPrompt(null);
      } else if (result.errorCode === 'OUTSIDE_VISITING_HOURS' || result.errorCode === 'TOO_EARLY') {
        setOverrideHoursPrompt(result.message);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessingScan(false);
    }
  };

  // 2. APPROVE / REJECT / REVOKE HANDLERS
  const handleApprove = (v: VisitorRegistration) => {
    showToast('Persetujuan manual belum tersedia di GAS. Status tidak diubah.');
  };

  const handleConfirmReject = () => {
    if (!rejectModalVisitor) return;
    showToast('Penolakan manual belum tersedia di GAS. Status tidak diubah.');
    setRejectModalVisitor(null);

  };

  const handleConfirmRevoke = () => {
    if (!revokeModalVisitor) return;
    showToast('Pencabutan akses belum tersedia di GAS. Status tidak diubah.');
    setRevokeModalVisitor(null);

  };

  const handleCreateGate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGateForm.gateName) return;

    showToast('Penambahan gerbang belum tersedia di GAS. Data tidak diubah.');
    /* visitorManagementService.addGate(
      {
        eventId: '',
        gateName: newGateForm.gateName,
        location: newGateForm.location || 'Bumi Perkemahan',
        operatingHours: newGateForm.operatingHours,
        allowedCategories: newGateForm.allowedCategories,
        status: 'active',
      },
      currentActorName
    );

    */
    setShowAddGateModal(false);

  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 text-slate-100">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-red-950/95 border border-red-500/50 text-xs text-red-200 font-semibold flex items-center justify-between shadow-xl">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {(isLoadingVisitors || loadError) && <div role="status" className="p-3 rounded-xl bg-amber-500/10 text-amber-300 text-xs">{isLoadingVisitors ? 'Memuat data pengunjung dari GAS…' : `Gagal memuat: ${loadError}`}</div>}
      {/* TOP HEADER & LIVE OCCUPANCY BANNER */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#200b0e] via-[#1c0c0f] to-[#14080a] border-2 border-red-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-xs font-bold text-red-300">
                Modul Operasional Tamu & Kunjungan
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-slate-300 font-semibold">
                Sistem Mandiri & Gerbang
              </span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Manajemen Kunjungan & Tamu Bumi Perkemahan
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Pendaftaran wali santri/peserta, verifikasi izin, kontrol gerbang pos, dan pemantauan okupansi riil.
            </p>
          </div>

          {/* Real-time Occupancy Badge (Req 43) */}
          <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/10 shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-medium">Pengunjung di Dalam Buper</div>
              <div className="text-xl font-black text-red-400 font-mono">
                {metrics.insideCamp} <span className="text-xs text-slate-400 font-normal">Jiwa</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-600/30 text-red-400 flex items-center justify-center font-black">
              <DoorOpen className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
            <div className="text-slate-400 text-[10px]">Tamu Terdaftar Hari Ini</div>
            <div className="text-base font-black text-white mt-0.5 font-mono">
              {metrics.totalRegistered} Orang
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
            <div className="text-slate-400 text-[10px]">Menunggu Verifikasi</div>
            <div className={`text-base font-black mt-0.5 font-mono ${metrics.pendingApproval > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {metrics.pendingApproval} Tamu
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
            <div className="text-slate-400 text-[10px]">Telah Check-Out</div>
            <div className="text-base font-black text-emerald-400 mt-0.5 font-mono">
              {metrics.checkedOutToday} Selesai
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
            <div className="text-slate-400 text-[10px]">Overdue (Lewat Jam)</div>
            <div className={`text-base font-black mt-0.5 font-mono ${metrics.overdueCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
              {metrics.overdueCount > 0 ? `⚠ ${metrics.overdueCount} Tamu` : '0 Tamu'}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
            <div className="text-slate-400 text-[10px]">Sisa Kuota Hari Ini</div>
            <div className="text-base font-black text-sky-400 mt-0.5 font-mono">
              {metrics.remainingQuota} / {metrics.dailyQuota}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1 bg-black/40 rounded-2xl border border-white/5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('directory')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'directory' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📋 Daftar & Verifikasi ({visitors.length})
          </button>
          <button
            onClick={() => setActiveTab('gate')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'gate' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🚪 Pos Gerbang (Scanner)
          </button>
          <button
            onClick={() => setActiveTab('gates_config')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'gates_config' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📍 Gerbang Buper ({gates.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'logs' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📖 Buku Tamu ({visitLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'rules' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚙️ Kebijakan & Jam
          </button>
        </div>
      </div>

      {/* TAB 1: VISITOR DIRECTORY & APPROVAL WORKSPACE */}
      {activeTab === 'directory' && (
        <div className="space-y-4 text-xs">
          {/* Overdue Warning Alert (Req 44) */}
          {overdueVisitors.length > 0 && (
            <div className="p-4 rounded-3xl bg-rose-950/50 border border-rose-500/40 flex items-start justify-between gap-3 text-rose-200 shadow-lg">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white text-sm">
                    Peringatan: Terdapat {overdueVisitors.length} Pengunjung Melebihi Batas Waktu Kunjungan (Overdue)
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Petugas keamanan pos disarankan memeriksa area perkemahan atau menghubungi nomor telepon pengunjung terkait.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStatusFilter('CHECKED_IN')}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shrink-0"
              >
                Lihat Tamu
              </button>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="p-4 rounded-3xl bg-[#1c0c0f] border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari nama pengunjung, kode VIS-xxxx, peserta yang dikunjungi, atau telepon..."
                  className="w-full pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-2xl text-white text-xs placeholder:text-slate-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-2xl text-white text-xs font-semibold"
              >
                <option value="all">Semua Status</option>
                <option value="PENDING">Menunggu Persetujuan</option>
                <option value="APPROVED">Disetujui</option>
                <option value="CHECKED_IN">Sedang di Dalam (Inside)</option>
                <option value="CHECKED_OUT">Telah Keluar (Checkout)</option>
                <option value="REJECTED">Ditolak</option>
                <option value="REVOKED">Akses Dicabut (Revoked)</option>
              </select>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-2xl text-white text-xs font-semibold"
              >
                <option value="all">Semua Kategori</option>
                <option value="Orang Tua / Wali">Orang Tua / Wali</option>
                <option value="Keluarga">Keluarga</option>
                <option value="Tamu Undangan">Tamu Undangan</option>
                <option value="Umum">Umum</option>
                <option value="Alumni">Alumni</option>
                <option value="VIP">VIP</option>
              </select>
            </div>
          </div>

          {/* Visitors Table / List */}
          <div className="rounded-3xl bg-[#1c0c0f] border border-white/10 overflow-hidden shadow-lg">
            <div className="divide-y divide-white/5">
              {filteredVisitors.map(v => {
                const isOverdue =
                  v.status === 'CHECKED_IN' &&
                  v.expectedDeparture &&
                  new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') >
                    v.expectedDeparture;

                return (
                  <div
                    key={v.id}
                    className="p-4 hover:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-300 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                        {v.name.charAt(0)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm">{v.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono font-bold text-[10px]">
                            {v.registrationCode}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-semibold text-[10px]">
                            {v.category}
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] animate-pulse">
                              ⚠ OVERDUE
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-2">
                          <span>
                            Mengunjungi:{' '}
                            <strong className="text-white">{v.personVisited?.targetName || '-'}</strong>{' '}
                            ({v.relationship})
                          </span>
                          <span>·</span>
                          <span className="text-slate-400 font-mono">📞 {v.phone}</span>
                          {v.vehicleInfo && (
                            <>
                              <span>·</span>
                              <span className="text-slate-400">🚗 {v.vehicleInfo}</span>
                            </>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400">
                          Jadwal:{' '}
                          <strong className="text-slate-200">
                            {v.visitDate} ({v.expectedArrival} - {v.expectedDeparture} WIB)
                          </strong>{' '}
                          · {v.accompanyingPersonsCount > 0 && `+${v.accompanyingPersonsCount} Pendamping · `}
                          Tujuan: {v.purpose}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex items-center gap-2 justify-between md:justify-end">
                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${
                            v.status === 'CHECKED_IN'
                              ? 'bg-red-600 text-white shadow'
                              : v.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : v.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : v.status === 'CHECKED_OUT'
                              ? 'bg-slate-700 text-slate-300'
                              : v.status === 'REVOKED'
                              ? 'bg-rose-900 text-rose-200'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          {v.status === 'CHECKED_IN'
                            ? `Di Dalam (Gate: ${v.currentVisitSession?.gateName?.split(' ')[0] || 'Pos'})`
                            : v.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {v.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(v)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] shadow"
                              title="Setujui Kunjungan"
                            >
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectModalVisitor(v)}
                              className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium text-[11px]"
                              title="Tolak Pendaftaran"
                            >
                              Tolak
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setInspectedVisitor(v)}
                          className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold text-[11px] flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Pass QR</span>
                        </button>

                        {v.status !== 'REVOKED' && (
                          <button
                            type="button"
                            onClick={() => setRevokeModalVisitor(v)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-xl"
                            title="Cabut Akses (Revoke)"
                          >
                            <AlertOctagon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredVisitors.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  Tidak ada data pengunjung yang cocok dengan filter.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FAST MOBILE GATE SCANNER (Part 121) */}
      {activeTab === 'gate' && (
        <div className="max-w-md mx-auto space-y-4 text-xs select-none">
          {/* Header Card: Occupancy Counter & Gate Badge */}
          <div className="p-5 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs text-center space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider">Kunjungan</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Pos Gerbang Aktif</span>
              </span>
            </div>

            <div className="py-2">
              <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {metrics.insideCamp} <span className="text-base font-semibold text-slate-500 dark:text-slate-400">di area</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Kapasitas maksimal: {rules.dailyQuota} pengunjung per hari
              </p>
            </div>

            {/* Gate Selector */}
            <div className="text-left pt-1">
              <label className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                Pos Gerbang Bertugas:
              </label>
              <select
                value={selectedGateId}
                onChange={e => setSelectedGateId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold"
              >
                {gates.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.gateName} ({g.location})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 p-2 rounded-xl bg-white/5">
            <button type="button" disabled={isProcessingScan} onClick={() => setScanDirection('CHECK_IN')} className={`flex-1 py-2 rounded-lg font-bold ${scanDirection === 'CHECK_IN' ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-300'}`}>MASUK</button>
            <button type="button" disabled={isProcessingScan} onClick={() => setScanDirection('CHECK_OUT')} className={`flex-1 py-2 rounded-lg font-bold ${scanDirection === 'CHECK_OUT' ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-300'}`}>KELUAR</button>
          </div>
          {/* QR scanner wedge / manual code input. Never fabricate a scan. */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={isProcessingScan} onClick={() => { setCameraRetry(r => r + 1); setCameraOpen(true); }}
                className="py-4 px-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50">
                <QrCode className="w-5 h-5" /> BUKA KAMERA QR
              </button>
              <button type="button" onClick={() => scanInputRef.current?.focus()}
                className="py-4 px-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs">
                INPUT / SCANNER EKSTERNAL
              </button>
            </div>
            {cameraOpen && (
              <div className="rounded-2xl border border-emerald-500/40 p-3 space-y-2 bg-black text-white">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-xs">Arahkan kamera ke QR Visitor</strong>
                  <button type="button" onClick={() => setCameraOpen(false)} className="text-xs rounded-lg px-3 py-2 bg-white/20">Tutup</button>
                </div>
                <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full max-h-72 object-cover rounded-xl bg-slate-900" aria-label="Pratinjau kamera scanner Visitor" />
                {cameraError && <p role="alert" className="text-xs text-amber-300">{cameraError}</p>}
                <p className="text-[11px] text-slate-300">Setelah QR terbaca, periksa arah MASUK/KELUAR dan tekan Validasi. Tidak ada check-in otomatis.</p>
              </div>
            )}

            {/* Manual Code Input Bar */}
            <div className="flex gap-2">
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePerformGateScan(false)}
                placeholder="Ketik kode tiket / scan QR pass..."
                className="flex-1 px-3.5 py-2.5 bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-mono text-xs placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => handlePerformGateScan(false)}
                disabled={isProcessingScan || !scanInput.trim()}
                className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl font-bold text-xs disabled:opacity-40 transition-colors"
              >
                {isProcessingScan ? 'Memeriksa...' : 'Validasi'}
              </button>
            </div>
          </div>

          {/* Override prompt if outside hours (Req 35) */}
          {false && overrideHoursPrompt && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Peringatan Jam Kunjungan</span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-200">{overrideHoursPrompt}</p>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handlePerformGateScan(true)}
                  className="px-3.5 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Izinkan Masuk (Override Petugas)
                </button>
              </div>
            </div>
          )}

          {/* Scan Result Feedback Card */}
          {lastScanResult && (
            <div
              className={`p-4 rounded-2xl border text-center space-y-2 shadow-xs animate-in fade-in duration-300 ${
                lastScanResult.success
                  ? lastScanResult.action === 'CHECKED_IN'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center font-black">
                {lastScanResult.success ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{lastScanResult.message}</h4>
                {lastScanResult.visitor && (
                  <div className="mt-2 p-3 bg-white/70 dark:bg-black/40 rounded-xl text-left text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nama Tamu:</span>
                      <strong className="text-slate-900 dark:text-white">{lastScanResult.visitor.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Kategori:</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">{lastScanResult.visitor.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mengunjungi:</span>
                      <span className="text-slate-700 dark:text-slate-300">{lastScanResult.visitor.personVisited?.targetName || '-'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TERBARU (Part 121 - Recent Gate Logs) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Terbaru
              </span>
              <span className="text-[10px] text-slate-400">Aktivitas Gerbang</span>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 overflow-hidden divide-y divide-black/5 dark:divide-white/5 shadow-xs">
              {visitLogs.slice(0, 5).map(log => {
                const isCheckin = log.status === 'CHECKED_IN';
                const timeStr = isCheckin ? log.checkinAt : (log.checkoutAt || log.checkinAt);
                return (
                  <div key={log.visitLogId} className="p-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {log.visitorName}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>{log.gateName}</span>
                        <span>·</span>
                        <span className="font-mono">{timeStr?.split(' ')[1] || timeStr}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCheckin
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isCheckin ? 'Masuk' : 'Keluar'} {timeStr?.split(' ')[1]?.slice(0, 5) || ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GATES CONFIGURATION (Req 38) */}
      {activeTab === 'gates_config' && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Daftar Pintu Gerbang (Gate Management)</h3>
            <button
              onClick={() => setShowAddGateModal(true)}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Gerbang Pos</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {gates.map(g => (
              <div key={g.id} className="p-4 rounded-3xl bg-[#1c0c0f] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-400" />
                    <span>{g.gateName}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    Aktif
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{g.location}</p>
                <div className="text-[10px] text-slate-400">
                  ⏰ Jam Operasi: <strong className="text-white">{g.operatingHours}</strong>
                </div>
                <div className="pt-1 flex flex-wrap gap-1">
                  {g.allowedCategories.map(cat => (
                    <span key={cat} className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-slate-300">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: IMMUTABLE VISIT LOGS (Req 33) */}
      {activeTab === 'logs' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-3xl bg-[#1c0c0f] border border-white/10 overflow-hidden shadow-lg">
            <div className="p-3 border-b border-white/5 font-bold text-white flex items-center justify-between">
              <span>Buku Tamu & Catatan Masuk-Keluar Pos Gerbang</span>
              <span className="text-[11px] text-slate-400 font-mono">Immutable Audit Logs</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/40 text-slate-400 text-[10px] uppercase font-bold border-b border-white/5">
                  <tr>
                    <th className="p-3">Nama Tamu & Kode</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Waktu Check-In</th>
                    <th className="p-3">Waktu Check-Out</th>
                    <th className="p-3">Pos Gerbang</th>
                    <th className="p-3">Petugas</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visitLogs.map(l => (
                    <tr key={l.visitLogId} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-semibold text-white">
                        <div>{l.visitorName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{l.registrationCode}</div>
                      </td>
                      <td className="p-3 text-slate-300">{l.visitorCategory}</td>
                      <td className="p-3 font-mono text-white">{l.checkinAt}</td>
                      <td className="p-3 font-mono text-slate-300">{l.checkoutAt || 'Masih di dalam'}</td>
                      <td className="p-3 text-slate-300">{l.gateName}</td>
                      <td className="p-3 text-slate-400">{l.verifiedBy}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.status === 'CHECKED_IN'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: VISITOR RULES & POLICIES (Req 35, 36, 50) */}
      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Visiting Hours by Day */}
          <div className="p-5 rounded-3xl bg-[#1c0c0f] border border-white/10 space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-400" />
              <span>Jam Operasional Kunjungan (Visiting Hours)</span>
            </h4>
            <div className="space-y-2">
              {rules.visitingHours.map((h, idx) => (
                <div key={h.dayName} className="p-2.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <span className="font-bold text-white">{h.dayName}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-300">{h.openTime} - {h.closeTime} WIB</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      Buka
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quotas & Security Guidelines */}
          <div className="p-5 rounded-3xl bg-[#1c0c0f] border border-white/10 space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <span>Kuota & Tata Tertib Kunjungan</span>
            </h4>
            <div className="p-3 bg-black/30 rounded-2xl border border-white/5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Kuota Harian Maksimal:</span>
                <span className="font-bold text-white font-mono">{rules.dailyQuota} Pengunjung</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mode Persetujuan:</span>
                <span className="font-bold text-amber-400">{rules.approvalMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tipe Akses Standar:</span>
                <span className="font-bold text-slate-200">{rules.entryTypeDefault}</span>
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-300 mb-1">Tata Tertib & Larangan:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                {rules.rulesAndGuidelines.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* VISITOR PASS INSPECTION MODAL (Req 28, 29) */}
      {inspectedVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#2a0e13] via-[#1c0c0f] to-[#120709] border-2 border-red-500/50 rounded-3xl p-6 shadow-2xl text-center space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                ⚜️ KARTU TANDA PENGUNJUNG RESMI
              </span>
              <button onClick={() => setInspectedVisitor(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <h3 className="text-xl font-black text-white">{inspectedVisitor.name}</h3>
              <p className="text-xs text-red-300 font-bold">{inspectedVisitor.category}</p>
              <div className="text-[11px] text-slate-400 mt-1">
                Mengunjungi: <strong className="text-white">{inspectedVisitor.personVisited?.targetName || '-'}</strong>
              </div>
            </div>

            {/* QR Pass Box */}
            <div className="w-48 h-48 mx-auto p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inspectedVisitor.qrToken)}`}
                alt="Visitor Pass QR"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-3 bg-black/40 rounded-2xl text-left text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Kode Kunjungan:</span>
                <span className="font-mono text-red-400 font-bold">{inspectedVisitor.registrationCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tanggal Izin:</span>
                <span className="text-white">{inspectedVisitor.visitDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jam Berkunjung:</span>
                <span className="text-white font-mono">{inspectedVisitor.expectedArrival} - {inspectedVisitor.expectedDeparture} WIB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-emerald-400">{inspectedVisitor.status}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectedVisitor(null)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#1c0c0f] border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-3 text-xs">
            <h4 className="font-bold text-white text-sm">Tolak Pendaftaran Kunjungan</h4>
            <p className="text-slate-300">
              Apakah Anda yakin ingin menolak permohonan kunjungan dari <strong>{rejectModalVisitor.name}</strong>?
            </p>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Alasan Penolakan:</label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalVisitor(null)}
                className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE MODAL */}
      {revokeModalVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#1c0c0f] border-2 border-rose-600 rounded-3xl p-6 shadow-2xl space-y-3 text-xs">
            <h4 className="font-bold text-rose-300 text-sm flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              <span>Cabut Akses Pengunjung (Revoke Watchlist)</span>
            </h4>
            <p className="text-slate-300">
              Akses kunjungan untuk <strong>{revokeModalVisitor.name}</strong> ({revokeModalVisitor.registrationCode}) akan langsung dicabut dan tidak dapat memasuki bumi perkemahan.
            </p>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Alasan Pencabutan Izin:</label>
              <textarea
                rows={2}
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokeModalVisitor(null)}
                className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold"
              >
                Cabut Izin Akses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD GATE MODAL */}
      {showAddGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#1c0c0f] border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm">+ Tambah Pos Gerbang Baru</h4>
              <button onClick={() => setShowAddGateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateGate} className="space-y-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nama Gerbang:</label>
                <input
                  type="text"
                  value={newGateForm.gateName}
                  onChange={e => setNewGateForm({ ...newGateForm, gateName: e.target.value })}
                  placeholder="Contoh: Gate Timur (Akses Tenda)"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Lokasi Titik Pos:</label>
                <input
                  type="text"
                  value={newGateForm.location}
                  onChange={e => setNewGateForm({ ...newGateForm, location: e.target.value })}
                  placeholder="Contoh: Pos Jaga Lapangan Timur"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Jam Operasional:</label>
                <input
                  type="text"
                  value={newGateForm.operatingHours}
                  onChange={e => setNewGateForm({ ...newGateForm, operatingHours: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGateModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold"
                >
                  Simpan Gerbang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
