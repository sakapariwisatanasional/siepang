/**
 * @license
 * SiEpang - Native-feel Fullscreen QR Scanner & Action Bottom Sheet
 * Role-aware action dispatch with strict privacy protection for sensitive health records,
 * and robust peer-appreciation anti-abuse validation (no self-appreciation, daily quota, duplicates).
 */

import React, { useState, useEffect, useRef } from 'react';
import { resolveGoogleDriveImageUrl } from '../../utils/googleDriveImage';
import {
  X,
  Zap,
  CheckCircle2,
  Flashlight,
  UserCheck,
  HeartHandshake,
  CalendarCheck,
  Stethoscope,
  ChevronRight,
  Smile,
  Flame,
  Leaf,
  Lightbulb,
  ShieldCheck,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { participantService } from '../../services/participantService';
import { attendanceService } from '../../services/attendanceService';
import { pointService, PEER_APPRECIATIONS } from '../../services/pointService';
import { authService } from '../../services/authService';
import { activityQrService, ScanResult } from '../../services/activityQrService';
import { visitorManagementService } from '../../services/visitorManagementService';
import { qrResolverService } from '../../services/qrResolverService';
import { gudepQrService, GudepGateStatus } from '../../services/gudepQrService';
import { apiTransport } from '../../services/apiTransport';
import { Participant, PeerAppreciationType, VisitorRegistration } from '../../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessFeedback?: (message: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccessFeedback,
}) => {
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanHandlerRef = useRef<(code: string) => Promise<void>>(async () => {});
  const processingScanRef = useRef(false);

  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [scannedUserQr, setScannedUserQr] = useState<{
    userId: string;
    name: string;
    email?: string;
    role?: string;
    status?: string;
    organizationId?: string;
    avatarUrl?: string;
  } | null>(null);
  const [scannedActivityResult, setScannedActivityResult] = useState<ScanResult | null>(null);
  const [scannedVisitor, setScannedVisitor] = useState<{ visitor: VisitorRegistration; action: 'ENTRY' | 'EXIT' } | null>(null);
  const [scannedGudepQr, setScannedGudepQr] = useState<{
    token: string;
    result?: {
      gudep_id: string;
      gudep_name: string;
      gate_status: GudepGateStatus;
      already_processed: boolean;
      message: string;
      logged_at?: string;
    };
    busy?: boolean;
  } | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [scanTypeFilter, setScanTypeFilter] = useState<'all' | 'participant' | 'activity' | 'visitor'>('all');

  // Anti-abuse state
  const [givenTypes, setGivenTypes] = useState<Set<PeerAppreciationType>>(new Set());
  const [checkingAppreciations, setCheckingAppreciations] = useState(false);

  const currentUser = authService.getCurrentUser();
  const currentRole = currentUser?.role || 'viewer';
  const canViewHealth = currentRole === 'health_officer' || currentRole === 'workspace_admin' || currentRole === 'superadmin';
  const canCheckIn = currentRole === 'registration_officer' || currentRole === 'workspace_admin' || currentRole === 'superadmin';
  const canTakeAttendance = currentRole === 'attendance_officer' || currentRole === 'committee' || currentRole === 'workspace_admin' || currentRole === 'superadmin';

  const handleScanCode = async (rawCode: string) => {
    setActionErrorMessage(null);
    setIsResolving(true);
    setScanPaused(true);
    try {
    let code = rawCode.trim();
    // Kompatibel dengan QR yang berisi ID langsung maupun URL /scan?p=ID.
    try {
      if (/^https?:\/\//i.test(code)) {
        const url = new URL(code);
        code = url.searchParams.get('p') || url.searchParams.get('participant_id') || code;
      }
    } catch { /* Gunakan token QR asli bila bukan URL valid. */ }

    // 0. QR KEHADIRAN GUDEP/KONTINGEN.
    // Token GDEP_ belongs to the Gudep gate flow, never to Participants.id.
    if (/^GDEP_[A-Z0-9]+$/i.test(code)) {
      setScannedGudepQr({ token: code });
      return;
    }

    // 0. QR IDENTITAS PENGGUNA/PANITIA.
    // Token SIEPANG-USER-* harus langsung ke GAS user.qr.scan,
    // bukan ke participants.list. Ini menjaga QR peserta lama tetap berjalan.
    const normalizedCode = code.toUpperCase();
    const isUserQr =
      normalizedCode.startsWith('SIEPANG-USER-') ||
      normalizedCode.startsWith('SIEPANG:QR:V1:USR_') ||
      normalizedCode.startsWith('SIEPANG:QR:V1:USER_');

    if (isUserQr) {
      try {
        const userQrRes = await apiTransport.send<any>('user.qr.scan', { token: code });
        if (!userQrRes.ok) {
          throw new Error(userQrRes.error?.message || 'QR akun/panitia tidak dikenali oleh GAS.');
        }

        const payload = userQrRes.data || {};
        const user = payload.user || payload.profile || payload;
        const userId = String(
          user.user_id || user.userId || payload.user_id || payload.userId || ''
        ).trim();

        if (!userId) {
          throw new Error('GAS menerima QR, tetapi identitas pengguna tidak ada pada respons.');
        }

        setScannedUserQr({
          userId,
          name: String(user.name || user.full_name || user.fullName || 'Pengguna SiEpang'),
          email: user.email ? String(user.email) : undefined,
          role: user.role ? String(user.role) : undefined,
          status: user.status ? String(user.status) : undefined,
          organizationId: user.organization_id || user.organizationId
            ? String(user.organization_id || user.organizationId)
            : undefined,
          avatarUrl: user.avatar_url || user.avatarUrl
            ? String(user.avatar_url || user.avatarUrl)
            : undefined,
        });
        return;
      } catch (err: any) {
        setActionErrorMessage(`QR akun/panitia gagal diverifikasi: ${err?.message || 'GAS tidak mengenali token.'}`);
        return;
      }
    }

    // 1. Check if Activity QR or Checkpoint QR token (Requirements 8-10)
    const actConfig = activityQrService.getConfigByToken(code);
    const isActToken =
      Boolean(actConfig) ||
      /^AGENDA_[a-f0-9]{64}$/i.test(code) ||
      /^SIEPANG-CP-[A-Z0-9]+$/i.test(code) ||
      code.includes('ACT_') ||
      code.includes('CP_') ||
      code.startsWith('SIEPANG:QR:v1:ACT') ||
      code.startsWith('SIEPANG:QR:v1:CHE');
    if (isActToken) {
      try {
        const scanRes = await activityQrService.scanActivityQr(code);
        setScannedActivityResult(scanRes);
        return;
      } catch (err: any) {
        setActionErrorMessage(err.message || 'Gagal memproses QR Aktivitas.');
        return;
      }
    }

    // 2. Check if Visitor Pass QR token (Requirements 31, 32)
    const vis = visitorManagementService.getVisitorByToken(code) || visitorManagementService.getVisitorByCode(code);
    const isVisToken = Boolean(vis) || code.includes('VIS_') || code.toUpperCase().startsWith('VIS-') || code.startsWith('SIEPANG:QR:v1:VIS');
    if (isVisToken) {
      // A visitor pass never enters the participant identity/verification flow.
      // Read the visitor ledger even on a different officer device.
      try {
        await visitorManagementService.loadVisitors();
        const visitor = visitorManagementService.getVisitorByToken(code) || visitorManagementService.getVisitorByCode(code);
        if (!visitor) throw new Error('Pass tidak ditemukan dalam Buku Tamu untuk event aktif. Gunakan QR visitor yang terbit setelah pendaftaran.');
        setScannedVisitor({ visitor, action: visitor.status === 'CHECKED_IN' ? 'EXIT' : 'ENTRY' });
      } catch (error: any) {
        setActionErrorMessage(`Pencatatan kunjungan belum dapat dilanjutkan: ${error?.message || 'Gagal memuat Buku Tamu.'}`);
      }
      return;
    }

    // 3. Resolve only this participant through GAS. A short in-memory cache
    // avoids repeat lookups in the same event/session; no full roster download is
    // required for scanner identity. All write actions are still authorized by GAS.
    try {
      const actorId = String((currentUser as any)?.id || (currentUser as any)?.user_id || '');
      const found = await participantService.resolveScannerParticipant(code, actorId);
      setScannedParticipant(found);
    } catch (error: any) {
      setActionErrorMessage(`Gagal memeriksa peserta ke GAS: ${error?.message || 'Koneksi tidak tersedia'}. Silakan coba lagi.`);
    }
    } finally { setIsResolving(false); }
  };

  // Scanner resolves one participant on demand; it no longer preloads the full roster.

  // Start each fresh opening with an active scanner, not the previous result state.
  useEffect(() => {
    if (!isOpen) {
      setScanPaused(false);
      setScannedParticipant(null);
      setScannedUserQr(null);
      setScannedActivityResult(null);
      setScannedVisitor(null);
      setScannedGudepQr(null);
      setActionErrorMessage(null);
      setIsResolving(false);
    }
  }, [isOpen]);

  // Scanner global sebelumnya hanya simulasi. Hidupkan kamera asli saat modal terbuka.
  scanHandlerRef.current = handleScanCode;
  useEffect(() => {
    if (!isOpen || scanPaused) return;
    let cancelled = false;
    let timer: number | undefined;
    let detector: { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } | null = null;
    processingScanRef.current = false;
    setCameraReady(false);
    setCameraError(null);

    const closeCamera = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const video = videoRef.current;
      if (video) { video.pause(); video.srcObject = null; }
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };

    const scanFrame = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (detector && video && video.readyState >= 2 && !processingScanRef.current) {
        try {
          const results = await detector.detect(video);
          const value = results.find(result => result.rawValue?.trim())?.rawValue?.trim();
          if (value) {
            processingScanRef.current = true;
            closeCamera();
            setCameraReady(false);
            await scanHandlerRef.current(value);
            return;
          }
        } catch (error) { console.debug('QR frame belum dapat dibaca:', error); }
      }
      if (!cancelled) timer = window.setTimeout(scanFrame, 180);
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setCameraError('Kamera membutuhkan browser HTTPS dan izin kamera. Gunakan Chrome Android atau input manual.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) { closeCamera(); return; }
        video.srcObject = stream;
        await video.play();
        if (cancelled) { closeCamera(); return; }
        setCameraReady(true);
        type QRDetectorClass = new (options: { formats: string[] }) => typeof detector;
        const Detector = (window as Window & { BarcodeDetector?: QRDetectorClass }).BarcodeDetector;
        if (!Detector) {
          setCameraError('Kamera aktif, tetapi browser ini belum mendukung pembacaan QR otomatis (BarcodeDetector). Gunakan Chrome Android terbaru atau masukkan kode manual.');
          return;
        }
        detector = new Detector({ formats: ['qr_code'] });
        void scanFrame();
      } catch (error: unknown) {
        const name = error instanceof DOMException ? error.name : '';
        setCameraError(name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Izinkan Kamera pada pengaturan situs browser, lalu tekan Coba Lagi.'
          : name === 'NotFoundError'
            ? 'Kamera tidak ditemukan pada perangkat ini.'
            : 'Tidak dapat membuka kamera. Pastikan tidak dipakai aplikasi lain, lalu coba lagi.');
      }
    };
    void startCamera();
    return () => { cancelled = true; closeCamera(); };
  }, [isOpen, cameraRetry, scanPaused]);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !cameraReady) return;
    const constraint = { advanced: [{ torch: flashlightOn }] } as unknown as MediaTrackConstraints;
    void track.applyConstraints(constraint).catch(() => {
      if (flashlightOn) setCameraError('Senter tidak didukung kamera ini. Pemindaian tetap bisa dilakukan.');
    });
  }, [flashlightOn, cameraReady]);

  if (!isOpen) return null;

  const handleGudepGateScan = async (direction: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!scannedGudepQr || scannedGudepQr.busy) return;
    setScannedGudepQr(previous => previous ? { ...previous, busy: true } : previous);
    setActionErrorMessage(null);
    try {
      const result = await gudepQrService.scan(scannedGudepQr.token, direction);
      setScannedGudepQr(previous => previous ? { ...previous, busy: false, result } : previous);
      setActionSuccessMessage(result.message);
    } catch (err: any) {
      setScannedGudepQr(previous => previous ? { ...previous, busy: false } : previous);
      setActionErrorMessage(err?.message || 'Gagal memproses QR kehadiran Gudep melalui GAS.');
    }
  };

  const resetGudepScan = () => {
    setScannedGudepQr(null);
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    setScanPaused(false);
    setCameraRetry(value => value + 1);
  };

  const handleCheckIn = async () => {
    if (!scannedParticipant) return;
    try {
      await participantService.checkIn(scannedParticipant.id);
      setActionSuccessMessage(`✅ Check-in berhasil untuk ${scannedParticipant.name}`);
      setTimeout(() => {
        setActionSuccessMessage(null);
        setScannedParticipant(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setActionErrorMessage(err.message);
    }
  };

  const handleAttendance = async () => {
    if (!scannedParticipant) return;
    try {
      const res = await attendanceService.recordAttendance(scannedParticipant.code);
      participantService.invalidateScannerIdentityCache(scannedParticipant.id);
      setActionSuccessMessage(
        `✅ Presensi tersimpan di GAS untuk ${scannedParticipant.name}. XP hanya diberikan setelah transaksi poin tercatat.`
      );
      setTimeout(() => {
        setActionSuccessMessage(null);
        setScannedParticipant(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setActionErrorMessage(err.message);
    }
  };

  const handleOpenPeerModal = async () => {
    if (!scannedParticipant) return;
    if (currentUser?.participantCode && scannedParticipant.code === currentUser.participantCode) {
      setActionErrorMessage('Tidak boleh memberikan apresiasi kepada diri sendiri.');
      return;
    }
    setCheckingAppreciations(true);
    try {
      // Langsung periksa riwayat pemberi + penerima di GAS, tanpa memuat
      // seluruh buku besar transaksi XP lebih dulu (dua request berurutan).
      // Backend remains authoritative; UI lets the user attempt only unused types.
      // The ledger XPTransaction view does not expose giver ID, so only disable
      // types already granted in this browser; GAS validates all historic grants.
      const existingTypes = await pointService.getGivenAppreciationTypes(scannedParticipant.id);
      setGivenTypes(new Set(existingTypes));
      setActionErrorMessage(null);
      setShowPeerModal(true);
    } catch (err: any) {
      setActionErrorMessage(err?.message || 'Gagal memeriksa riwayat apresiasi di GAS.');
    } finally {
      setCheckingAppreciations(false);
    }
  };

  const handlePeerAppreciation = async (type: PeerAppreciationType) => {
    if (!scannedParticipant) return;
    try {
      await pointService.givePeerAppreciation(scannedParticipant.id, scannedParticipant.name, type);
      participantService.invalidateScannerIdentityCache(scannedParticipant.id);
      setGivenTypes(prev => new Set(prev).add(type));
      setShowPeerModal(false);
      setActionSuccessMessage(`⚜️ Apresiasi "${type}" tersimpan di GAS (PointTransactions).`);
      setTimeout(() => {
        setActionSuccessMessage(null);
        setScannedParticipant(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setActionErrorMessage(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white animate-in fade-in duration-200">
      {/* Top Scanner Controls */}
      <div className="flex items-center justify-between p-4 z-20">
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Tutup Pemindai"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-sm font-bold tracking-tight">Pindai QR Pramuka</div>
          <div className="text-[11px] text-emerald-400">Arahkan kamera ke ID Card / Digital Pass</div>
        </div>

        <button
          onClick={() => setFlashlightOn(!flashlightOn)}
          className={`p-2.5 rounded-full transition-colors ${
            flashlightOn ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 text-white'
          }`}
          aria-label="Senter"
        >
          <Flashlight className="w-5 h-5" />
        </button>
      </div>

      {/* Pratinjau kamera nyata, bukan animasi simulasi */}
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <div className="relative w-full max-w-sm aspect-square rounded-3xl border-2 border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.25)] overflow-hidden bg-slate-950">
          <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" aria-label="Pratinjau kamera untuk membaca QR" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />
          </div>
          {isResolving && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-center px-6 text-sm text-white z-10" role="status">Mencari data peserta di GAS…</div>
          )}
          {!cameraReady && !isResolving && !scanPaused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-center px-6 text-sm text-white">
              {cameraError ? 'Kamera belum aktif' : 'Mengaktifkan kamera…'}
            </div>
          )}
          {scanPaused && !isResolving && !scannedParticipant && !scannedUserQr && !scannedActivityResult && !scannedVisitor && !scannedGudepQr && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-black/90 px-5 py-6 text-center">
              <div className="text-base font-semibold text-white">{actionErrorMessage ? 'QR belum berhasil diproses' : 'Pemindaian selesai'}</div>
              {actionErrorMessage && (
                <div role="alert" className="w-full max-w-sm rounded-xl border border-rose-500/40 bg-rose-950/80 p-3 text-left text-xs leading-relaxed text-rose-100 break-words">
                  <div className="mb-1 font-bold text-rose-300">Penyebab</div>
                  {actionErrorMessage}
                </div>
              )}
              <button type="button" onClick={() => { setActionErrorMessage(null); setScanPaused(false); setCameraRetry(v => v + 1); }} className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white">Scan Ulang</button>
              <div className="max-w-sm text-[11px] leading-relaxed text-slate-300">Jika penyebab menyebut akun belum terhubung, hubungkan akun dengan data peserta terlebih dahulu. Jika menyebut QR tidak aktif atau event berbeda, terbitkan QR dari agenda aktif yang benar.</div>
            </div>
          )}
          {cameraReady && !cameraError && !scanPaused && (
            <div className="absolute bottom-3 inset-x-3 text-center text-xs rounded-lg bg-black/70 px-3 py-2 text-white pointer-events-none">
              Arahkan QR ke dalam bingkai
            </div>
          )}
        </div>
        {cameraError && (
          <div className="absolute bottom-4 left-4 right-4 max-w-sm mx-auto rounded-xl border border-amber-500/40 bg-slate-950/95 p-3 text-xs text-amber-100 text-center z-10">
            <div>{cameraError}</div>
            <button type="button" onClick={() => setCameraRetry(value => value + 1)} className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white">Coba Lagi Kamera</button>
          </div>
        )}
      </div>

      {/* Manual Input Bar */}
      <div className="p-4 bg-slate-900/90 border-t border-white/10 z-10 backdrop-blur-md">
        <div className="max-w-md mx-auto space-y-2.5">

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Ketik/Paste token QR (Panitia, Peserta, Kegiatan, Visitor)"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              className="flex-1 bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              onClick={() => {
                if (manualCode) handleScanCode(manualCode);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white transition-colors"
            >
              Proses
            </button>
          </div>

          {actionErrorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionErrorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scanned Participant Action Bottom Sheet */}
      {scannedParticipant && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#141418] border-t border-[#ECECEF] dark:border-white/10 rounded-t-[28px] p-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Sheet Handle */}
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

            {actionSuccessMessage ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <div className="text-base font-bold text-[#171717] dark:text-white">{actionSuccessMessage}</div>
              </div>
            ) : (
              <>
                {/* Participant Identity Card Header */}
                <div className="flex items-center gap-3.5 pb-4 border-b border-[#ECECEF] dark:border-white/10">
                  <img
                    src={resolveGoogleDriveImageUrl(scannedParticipant.photoUrl, (scannedParticipant as any).profile_photo_file_id, 320)}
                    alt={scannedParticipant.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-[#171717] dark:text-white truncate">{scannedParticipant.name}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{scannedParticipant.contingentName}</div>
                    <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                      <span className="font-mono">{scannedParticipant.code}</span>
                      <span>·</span>
                      <span>{scannedParticipant.subCamp}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-500">⚡ {scannedParticipant.xp} XP</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Rank #{scannedParticipant.rank}</div>
                  </div>
                </div>

                {/* Role-Aware Actions with Strict Privacy */}
                <div className="pt-4 space-y-2.5">
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Pilihan Tindakan Sesuai Hak Akses:</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      Apresiasi satu kali per jenis
                    </span>
                  </div>

                  {/* 1. Presensi Lapangan (Authorized officers only) */}
                  {canTakeAttendance && (
                    <button
                      onClick={handleAttendance}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-md shadow-emerald-950/20 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <CalendarCheck className="w-4 h-4" />
                        <span>Catat Presensi Kegiatan Lapangan</span>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  {/* 2. Check-in Registrasi (Registration & Admin only) */}
                  {canCheckIn && (
                    <button
                      onClick={handleCheckIn}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors border border-[#ECECEF] dark:border-white/10 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {scannedParticipant.checkedIn ? 'Peserta Sudah Check-in (Perbarui)' : 'Check-in Kedatangan Buper'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  )}

                  {/* 3. Peer Appreciation (With Anti-Abuse Rules) */}
                  <button
                    disabled={checkingAppreciations}
                    onClick={handleOpenPeerModal}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold text-xs transition-colors border border-amber-500/30 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <HeartHandshake className="w-4 h-4 text-amber-500" />
                      <span>Beri Tanda Apresiasi Kawan Pramuka</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-500" />
                  </button>

                  {/* 4. Rekam Medis (HEALTH OFFICER ONLY — PRIVACY ENFORCED) */}
                  {canViewHealth ? (
                    <button
                      onClick={() => setShowHealthModal(true)}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold text-xs transition-colors border border-rose-500/30 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Stethoscope className="w-4 h-4 text-rose-500" />
                        <span>Rekam Medis & Riwayat Alergi (Petugas Medis)</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-rose-500" />
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-[#ECECEF] dark:border-white/5 text-[11px] text-slate-500 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                      <span>Data medis & kontak darurat dilindungi privasi (Khusus Petugas Medis).</span>
                    </div>
                  )}

                  {/* Cancel / Close */}
                  <button
                    onClick={() => {
                      setScannedParticipant(null);
                      setActionErrorMessage(null);
                    }}
                    className="w-full py-2 text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Kembali ke Kamera
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Peer Appreciation Modal */}
      {showPeerModal && scannedParticipant && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#141418] border border-amber-500/30 rounded-[28px] p-5 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="text-sm font-bold text-[#171717] dark:text-white">Apresiasi Kawan Kemah ⚜️</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Pilih karakter kepramukaan yang paling menonjol pada <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{scannedParticipant.name}</span>:
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Setiap jenis hanya sekali untuk peserta ini, tanpa reset harian
              </div>
            </div>

            <div className="space-y-2">
              {PEER_APPRECIATIONS.map(item => (
                <button
                  key={item.type}
                  onClick={() => handlePeerAppreciation(item.type)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-amber-500/15 border border-[#ECECEF] dark:border-white/10 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      {item.type === 'Helpful' && '🤝'}
                      {item.type === 'Friendly' && '😊'}
                      {item.type === 'Scout Spirit' && '⚜️'}
                      {item.type === 'Inspiring' && '💡'}
                      {item.type === 'Eco Action' && '🌱'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#171717] dark:text-white">{item.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.type}</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{givenTypes.has(item.type) ? 'Sudah diberikan' : `+${item.xp} XP`}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPeerModal(false)}
              className="w-full py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Health Officer Confidential Record Modal */}
      {showHealthModal && scannedParticipant && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#141418] border border-rose-500/40 rounded-[28px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#ECECEF] dark:border-white/10">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 font-bold text-xs">
                <Stethoscope className="w-4 h-4 text-rose-500" />
                <span>Rekam Medis Rahasia Peserta</span>
              </div>
              <button onClick={() => setShowHealthModal(false)} className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-[#171717] dark:hover:text-white flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-black/30 rounded-2xl border border-[#ECECEF] dark:border-white/5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nama:</span>
                  <span className="font-bold text-[#171717] dark:text-white">{scannedParticipant.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Golongan Darah:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{scannedParticipant.bloodType || 'O+'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Kontak Darurat:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{scannedParticipant.emergencyContact || '081234567890'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Riwayat Penyakit:</span>
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">{scannedParticipant.medicalNotes || 'Tidak ada riwayat'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Lokasi Tenda:</span>
                  <span className="text-[#171717] dark:text-white">{scannedParticipant.tentNumber} ({scannedParticipant.subCamp})</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHealthModal(false)}
              className="w-full py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-semibold"
            >
              Tutup Rekam Medis
            </button>
          </div>
        </div>
      )}

      {/* User / Committee QR Result */}
      {scannedUserQr && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#141418] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full overflow-hidden bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                {scannedUserQr.avatarUrl ? (
                  <img
                    src={scannedUserQr.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <UserCheck className="w-7 h-7 text-emerald-600" />
                )}
              </div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                Identitas Akun Terverifikasi
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {scannedUserQr.name}
              </h3>
              {scannedUserQr.role && (
                <div className="inline-flex px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                  {scannedUserQr.role}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Nama</span>
                <strong className="text-slate-900 dark:text-white text-right">{scannedUserQr.name}</strong>
              </div>
              {scannedUserQr.email && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-700 dark:text-slate-200 text-right break-all">{scannedUserQr.email}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">User ID</span>
                <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 text-right break-all">{scannedUserQr.userId}</span>
              </div>
              {scannedUserQr.organizationId && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Organisasi</span>
                  <span className="text-slate-700 dark:text-slate-200 text-right">{scannedUserQr.organizationId}</span>
                </div>
              )}
              {scannedUserQr.status && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Status</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{scannedUserQr.status}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setScannedUserQr(null);
                setActionErrorMessage(null);
                setScanPaused(false);
                setCameraRetry(v => v + 1);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs"
            >
              Scan QR Berikutnya
            </button>
            <button
              onClick={() => {
                setScannedUserQr(null);
                setActionErrorMessage(null);
                onClose();
              }}
              className="w-full py-2 text-xs text-slate-500 dark:text-slate-400"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Activity QR Scan Result Modal (Requirements 8-10, 11, 12, 14, 15) */}
      {scannedGudepQr && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-emerald-500/30 bg-slate-950 p-5 text-white shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <UserCheck className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold">Kehadiran Gudep / Kontingen</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                QR Gudep terdeteksi. Pilih tindakan; GAS akan memvalidasi event, status aktivasi, dan kewenangan petugas.
              </p>
            </div>

            {scannedGudepQr.result ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4">
                  <div className="text-xs text-emerald-300">Gudep terverifikasi oleh GAS</div>
                  <div className="mt-1 text-base font-bold">{scannedGudepQr.result.gudep_name}</div>
                  <div className="mt-2 text-xs text-slate-200">{scannedGudepQr.result.message}</div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    Status: {scannedGudepQr.result.gate_status === 'CHECKED_IN'
                      ? 'Sudah check-in'
                      : scannedGudepQr.result.gate_status === 'CHECKED_OUT'
                        ? 'Sudah check-out'
                        : 'Belum tiba'}
                    {scannedGudepQr.result.already_processed ? ' · Pemindaian sebelumnya sudah tercatat' : ''}
                  </div>
                </div>
                <button type="button" onClick={resetGudepScan}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold hover:bg-emerald-500">
                  Scan QR Berikutnya
                </button>
                <button type="button" onClick={() => { setScannedGudepQr(null); onClose(); }}
                  className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/15">
                  Tutup Scanner
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {actionErrorMessage && (
                  <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-xs leading-relaxed text-rose-100">
                    {actionErrorMessage}
                  </div>
                )}
                <button type="button" disabled={Boolean(scannedGudepQr.busy)}
                  onClick={() => void handleGudepGateScan('CHECK_IN')}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50">
                  {scannedGudepQr.busy ? 'Memproses di GAS…' : 'Catat Kedatangan (Check-in)'}
                </button>
                <button type="button" disabled={Boolean(scannedGudepQr.busy)}
                  onClick={() => void handleGudepGateScan('CHECK_OUT')}
                  className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
                  Catat Kepulangan (Check-out)
                </button>
                <button type="button" disabled={Boolean(scannedGudepQr.busy)}
                  onClick={() => { setScannedGudepQr(null); setActionErrorMessage(null); setScanPaused(false); setCameraRetry(value => value + 1); }}
                  className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/15 disabled:opacity-50">
                  Batal / Kembali ke Kamera
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {scannedActivityResult && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#14291c] to-[#0c1810] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            {scannedActivityResult.success ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 text-3xl animate-bounce">
                  ✅
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 font-mono">
                    Kegiatan Tercatat
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">
                    {scannedActivityResult.activityTitle}
                  </h3>
                  {scannedActivityResult.scheduleTime && (
                    <p className="text-xs text-slate-300 mt-1">
                      {scannedActivityResult.scheduleTime} · {scannedActivityResult.location || 'Bumi Perkemahan'}
                    </p>
                  )}
                </div>

                {scannedActivityResult.xpAwarded > 0 && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-lg">
                    <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span>+{scannedActivityResult.xpAwarded} XP</span>
                  </div>
                )}

                {scannedActivityResult.checkpointProgress && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-slate-300 text-left space-y-1">
                    <div className="font-semibold text-emerald-300 flex items-center justify-between">
                      <span>Progres Pos: {scannedActivityResult.checkpointProgress.checkpointName}</span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {scannedActivityResult.checkpointProgress.current}/{scannedActivityResult.checkpointProgress.total}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{
                          width: `${(scannedActivityResult.checkpointProgress.current / scannedActivityResult.checkpointProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    {scannedActivityResult.checkpointProgress.completed && (
                      <div className="text-[11px] text-amber-300 font-bold">
                        🎉 Selamat! Seluruh pos tantangan telah berhasil diselesaikan!
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-emerald-200/90 italic font-medium">
                  Semangat mengikuti kegiatan!
                </p>

                <button
                  onClick={() => {
                    setScannedActivityResult(null);
                    onClose();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg transition-transform active:scale-95"
                >
                  Selesai
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-400 text-2xl">
                  {scannedActivityResult.isDuplicate ? 'ℹ️' : '⚠️'}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-amber-400 font-mono">
                    {scannedActivityResult.isDuplicate ? 'Kegiatan Sudah Tercatat' : 'Pemberitahuan Scan'}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">
                    {scannedActivityResult.activityTitle}
                  </h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {scannedActivityResult.message}
                  </p>
                </div>

                <button
                  onClick={() => setScannedActivityResult(null)}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold text-xs transition-colors"
                >
                  Tutup
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Visitor Gate Check-in & Check-out Modal (Requirements 31, 32, 33) */}
      {scannedVisitor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#142319] to-[#0c160f] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Pos Gerbang Masuk & Keluar</span>
              </div>
              <h3 className="text-base font-black text-white">
                {scannedVisitor.action === 'EXIT' ? 'Visitor Sedang Berada di Area' : '✅ Visitor Valid'}
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{scannedVisitor.visitor.name}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  {scannedVisitor.visitor.category}
                </span>
              </div>
              <div className="text-xs text-slate-300 space-y-1">
                <div>Pass: <strong className="font-mono text-emerald-400">{scannedVisitor.visitor.registrationCode}</strong></div>
                <div>
                  Mengunjungi:{' '}
                  <strong className="text-white">{scannedVisitor.visitor.personVisited.targetName}</strong>{' '}
                  <span className="text-slate-400 text-[11px]">({scannedVisitor.visitor.personVisited.targetDetail})</span>
                </div>
                <div>Tujuan: <span className="text-slate-300">{scannedVisitor.visitor.purpose}</span></div>
                {scannedVisitor.visitor.vehicleInfo && (
                  <div>Kendaraan: <span className="text-amber-300 font-mono text-[11px]">{scannedVisitor.visitor.vehicleInfo}</span></div>
                )}
                {scannedVisitor.action === 'EXIT' && (
                  <div className="pt-1 text-[11px] text-amber-400">
                    Check-in pada: {scannedVisitor.visitor.currentVisitSession?.checkinAt || 'Hari ini'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setScannedVisitor(null)}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold text-xs transition-colors"
              >
                Batal
              </button>
              {scannedVisitor.action === 'EXIT' ? (
                <button
                  onClick={async () => {
                    const res = await visitorManagementService.processGateScan(
                      scannedVisitor.visitor.qrToken,
                      'gate_utama',
                      currentUser?.name || 'Petugas Gate',
                      { forceCheckout: true }
                    );
                    setActionSuccessMessage(res.message);
                    setScannedVisitor(null);
                    setTimeout(() => {
                      setActionSuccessMessage(null);
                      onClose();
                    }, 1500);
                  }}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-xs shadow-md"
                >
                  [ Check Out ]
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const res = await visitorManagementService.processGateScan(
                      scannedVisitor.visitor.qrToken,
                      'gate_utama',
                      currentUser?.name || 'Petugas Gate'
                    );
                    if (res.success) {
                      setActionSuccessMessage(`✅ ${scannedVisitor.visitor.name} diizinkan masuk buper!`);
                    } else {
                      setActionErrorMessage(res.message);
                    }
                    setScannedVisitor(null);
                    setTimeout(() => {
                      setActionSuccessMessage(null);
                      onClose();
                    }, 1500);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md"
                >
                  [ Izinkan Masuk ]
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
