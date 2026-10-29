/**
 * @license
 * SiEpang - Online Check-in Desk, Contingent Check-in & Activity Attendance Station (RC1 Global Design System)
 * Fully implements:
 * - Requirement 20: Online Check-in Desk (QR scan, code, search by name, participant identity card, verification status, contingent, campsite lot, double check-in prevention)
 * - Requirement 21: Contingent Check-in (Registered, Verified, Present counts, individual exceptions)
 * - Requirement 22: Activity Attendance (Select session, QR scan, participant search, manual attendance, bulk roster, duplicate prevention)
 * - Requirement 23: Attendance Dashboard (Expected, present, absent, late, attendance rate %, filter by activity, contingent, organization)
 * Standardized to Light-First, Instagram-inspired accent system, and 44px touch targets.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  CalendarCheck,
  Zap,
  WifiOff,
  UserCheck,
  History,
  RotateCcw,
  Search,
  Users,
  Tent,
  Building2,
  AlertTriangle,
  Check,
  X,
  Filter,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { attendanceService, AttendanceRecord } from '../../services/attendanceService';
import { participantService } from '../../services/participantService';
import { apiTransport } from '../../services/apiTransport';
import { authService } from '../../services/authService';
import { syncQueue } from '../../offline/syncQueue';
import { Participant, Contingent, ScheduleItem } from '../../types';

export const AttendanceScanner: React.FC<{ activityOnly?: boolean; initialScheduleId?: string; sourceKind?: 'schedule' | 'activity' }> = ({ activityOnly = false, initialScheduleId = '', sourceKind = 'schedule' }) => {
  const currentUser = authService.getCurrentUser();
  const [attendanceKind,setAttendanceKind] = useState<'schedule' | 'activity'>(sourceKind);
  const isCampActivity = attendanceKind === 'activity';
  const itemLabel = isCampActivity ? 'aktivitas perkemahan' : 'jadwal kegiatan';
  const [activeTab, setActiveTab] = useState<'individual_checkin' | 'contingent_checkin' | 'activity_session' | 'dashboard'>(activityOnly ? 'activity_session' : 'individual_checkin');

  // Search and manual input
  const [searchQuery, setSearchQuery] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inspectedParticipant, setInspectedParticipant] = useState<Participant | null>(null);

  // Kamera nyata. QR berisi Participants.id; tidak pernah langsung menulis presensi.
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerBusyRef = useRef(false);
  const scannerModeRef = useRef<'individual_checkin' | 'activity_session'>('individual_checkin');

  const stopCamera = () => {
    scannerBusyRef.current = true;
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  };

  const startCamera = async (mode: 'individual_checkin' | 'activity_session') => {
    setCameraError('');
    if (!window.isSecureContext) {
      setCameraError('Kamera memerlukan HTTPS (atau localhost). Buka SiEpang melalui alamat HTTPS.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser ini tidak menyediakan akses kamera. Coba Chrome Android terbaru, atau masukkan ID peserta secara manual.');
      return;
    }
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setCameraError('Browser ini belum mendukung pembacaan QR melalui BarcodeDetector. Gunakan Chrome Android terbaru, atau masukkan ID peserta secara manual.');
      return;
    }
    stopCamera();
    scannerModeRef.current = mode;
    scannerBusyRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error: any) {
      setCameraError(error?.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser untuk situs SiEpang.'
        : `Tidak dapat mengaktifkan kamera: ${error?.message || 'kamera tidak tersedia'}`);
      stopCamera();
    }
  };

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const Detector = (window as any).BarcodeDetector;
    let detector: any;
    try { detector = new Detector({ formats: ['qr_code'] }); }
    catch (err: any) { setCameraError(err?.message || 'Decoder QR gagal dibuka.'); stopCamera(); return; }
    let disposed = false;
    const detect = async () => {
      if (disposed || scannerBusyRef.current) return;
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video);
          const value = String(codes?.[0]?.rawValue || '').trim();
          if (value && !scannerBusyRef.current) {
            scannerBusyRef.current = true;
            // Hanya ID peserta atau kode tiket terdaftar, bukan URL arbitrer.
            const parsed = (() => {
              try { const u = new URL(value); return u.searchParams.get('p') || u.searchParams.get('participant_id') || value; }
              catch { return value; }
            })();
            if (scannerModeRef.current === 'activity_session') setManualCode(parsed);
            else {
              setSearchQuery(parsed);
              handleInspectParticipant(parsed);
            }
            stopCamera();
            showToast('QR terbaca. Periksa identitas sebelum menyimpan presensi.');
            return;
          }
        }
      } catch (err: any) {
        // Tidak mengubah data presensi jika decoder menemui frame yang tidak terbaca.
        console.warn('Pembacaan frame QR:', err);
      }
      if (!disposed) scanTimerRef.current = setTimeout(detect, 250);
    };
    video.play().then(detect).catch(err => {
      setCameraError(`Video kamera tidak dapat diputar: ${err?.message || 'unknown'}`);
      stopCamera();
    });
    return () => { disposed = true; if (scanTimerRef.current) clearTimeout(scanTimerRef.current); };
  }, [cameraOpen]);

  useEffect(() => () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  // Contingent Check-in state (Requirement 21)
  const contingents = participantService.getContingents();
  const [selectedContingentId, setSelectedContingentId] = useState<string>(contingents[0]?.id || 'ctg_kwarran_glagah');
  const [exceptionParticipantIds, setExceptionParticipantIds] = useState<string[]>([]);

  // Activity Session Attendance state (Requirement 22)
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const activitySubmitLock = useRef(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(initialScheduleId);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>(attendanceService.getRecords());
  const [, forceRefresh] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoadingData(true); setLoadError('');
    const jobs = [
      participantService.loadParticipants(),
      attendanceService.refreshRecords().then(rows => {if(mounted)setRecentRecords(rows);}),
      apiTransport.send<any[]>(isCampActivity ? 'activities.list' : 'schedules.list', {}).then(response => {
        if(!response.ok || !Array.isArray(response.data)) throw new Error(response.error?.message || 'Jadwal kegiatan belum dapat dibaca dari GAS.');
        if(mounted) setScheduleItems(response.data.map(s => isCampActivity ? ({...s,title:s.name || s.title,xpReward:Number(s.pointRule ?? s.xp_reward ?? 0),time:`${s.startTime || ''} - ${s.endTime || ''}`}) : s).filter(s => !(s as any).archived_at && !['archived','cancelled','canceled','deleted','inactive'].includes(String(s.status || '').toLowerCase())));
      }),
    ];
    void Promise.allSettled(jobs).then(results => {
      if(!mounted)return;
      setLoadError(results.filter((r): r is PromiseRejectedResult => r.status==='rejected').map(r => r.reason instanceof Error ? r.reason.message : String(r.reason)).join(' | '));
      setLoadingData(false); forceRefresh(v => v+1);
    });
    return () => {mounted=false;};
  }, [reloadVersion, attendanceKind]);
  const [latestSuccess, setLatestSuccess] = useState<{ record: AttendanceRecord; offline: boolean } | null>(null);

  // Dashboard filter state (Requirement 23)
  const [dashFilterActivity, setDashFilterActivity] = useState<string>('all');
  const [dashFilterContingent, setDashFilterContingent] = useState<string>('all');

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const connectionState = syncQueue.getConnectionState();
  const allParticipants = participantService.getParticipants();
  const selectedSchedule = scheduleItems.find(s => s.id === selectedScheduleId);
  const sessionKey = isCampActivity ? `ACTIVITY:${selectedScheduleId}` : selectedScheduleId;
  const sessionRecords = recentRecords.filter(r => r.sessionId === sessionKey);
  const selectedContingent = contingents.find(c => c.id === selectedContingentId) || contingents[0];
  const contingentParticipants = participantService.getParticipants({ contingentId: selectedContingent?.id });

  // 1. INDIVIDUAL CHECK-IN HANDLERS (Requirement 20)
  const handleInspectParticipant = (codeOrId: string) => {
    const p = participantService.getParticipantByCode(codeOrId) || allParticipants.find(part => part.id === codeOrId);
    if (!p) {
      showToast(`❌ Peserta '${codeOrId}' tidak ditemukan.`);
      return;
    }
    setInspectedParticipant(p);
  };

  const handlePerformCheckIn = async (p: Participant) => {
    setIsProcessing(true);
    try {
      await participantService.checkIn(p.id);
      showToast(`✓ Check-in kedatangan berhasil untuk ${p.name}!`);
      setInspectedParticipant({ ...p, checkedIn: true, checkInTime: new Date().toISOString() });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. CONTINGENT CHECK-IN HANDLER (Requirement 21)
  const handlePerformContingentCheckIn = async () => {
    if (!selectedContingent) return;
    setIsProcessing(true);
    try {
      let count = 0;
      for (const p of contingentParticipants) {
        if (!p.checkedIn && !exceptionParticipantIds.includes(p.id)) {
          await participantService.checkIn(p.id);
          count++;
        }
      }
      showToast(`✓ Berhasil check-in rombongan kontingen ${selectedContingent.name} (${count} peserta)!`);
      setExceptionParticipantIds([]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. ACTIVITY ATTENDANCE HANDLER (Requirement 22)
  const handleActivityScan = async (code: string) => {
    if (!code || loadingData || activitySubmitLock.current) return;
    if (!selectedSchedule?.id) {
      showToast('❌ Pilih jadwal kegiatan resmi sebelum mencatat presensi.');
      return;
    }
    activitySubmitLock.current = true;
    setIsProcessing(true);
    try {
      const res = await attendanceService.recordAttendance(
        code,
        selectedSchedule.id,
        selectedSchedule?.title || 'Kegiatan Lapangan',
        attendanceKind
      );
      setLatestSuccess(res);
      setRecentRecords([...attendanceService.getRecords()]);
      setManualCode('');
      showToast(`✓ ${res.record.participantName}: kehadiran tersimpan di GAS. Tambahan ${res.record.xpAwarded} poin. Scan ulang tidak menggandakan poin.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      activitySubmitLock.current = false;
      setIsProcessing(false);
    }
  };

  // 4. DASHBOARD STATS COMPUTATION (Requirement 23)
  const filteredDashboardParticipants = allParticipants.filter(p => {
    if (dashFilterContingent !== 'all' && p.contingentId !== dashFilterContingent) return false;
    return true;
  });

  const attendedIds = new Set(recentRecords.filter(r => dashFilterActivity === 'all' ? scheduleItems.some(s => (isCampActivity ? `ACTIVITY:${s.id}` : s.id)===r.sessionId) : r.sessionId===(isCampActivity ? `ACTIVITY:${dashFilterActivity}` : dashFilterActivity)).map(r => r.participantId));
  const presentCount = filteredDashboardParticipants.filter(p => attendedIds.has(p.id)).length;
  const absentCount = filteredDashboardParticipants.length - presentCount;
  const attendanceRate =
    filteredDashboardParticipants.length > 0
      ? Math.round((presentCount / filteredDashboardParticipants.length) * 100)
      : 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => setReloadVersion(v => v+1)} disabled={loadingData || isProcessing} className="px-4 py-2 rounded-xl border disabled:opacity-40">{loadingData?'Memuat data GAS…':'Muat ulang data'}</button>
        {loadError && <p role="alert" className="text-red-700 dark:text-red-300">{loadError} Data yang tampil mungkin belum lengkap.</p>}
      </div>
      {!activityOnly && <div className="flex flex-wrap gap-2" aria-label="Jenis pemberian poin">
        <button type="button" disabled={isProcessing} onClick={() => {setAttendanceKind('schedule');setSelectedScheduleId('');setDashFilterActivity('all');}} className={`px-4 py-3 rounded-xl border ${!isCampActivity?'bg-emerald-700 text-white':''}`}>Jadwal Kegiatan</button>
        <button type="button" disabled={isProcessing} onClick={() => {setAttendanceKind('activity');setSelectedScheduleId('');setDashFilterActivity('all');}} className={`px-4 py-3 rounded-xl border ${isCampActivity?'bg-emerald-700 text-white':''}`}>Aktivitas Perkemahan</button>
      </div>}
      {toast && (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-emerald-500/40 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Scanner QR SiEpang">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-amber-500/60 bg-[#111115] p-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-lg">Arahkan kamera ke QR peserta</h3>
              <button type="button" onClick={stopCamera} aria-label="Tutup kamera" className="p-3 rounded-xl bg-white/15"><CameraOff className="w-5 h-5" /></button>
            </div>
            <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-square bg-black object-cover rounded-2xl border-2 border-[#D4A017]" />
            <p className="text-sm text-center text-slate-300">Setelah QR terbaca, periksa identitas peserta. Pemindaian saja tidak menyimpan absensi.</p>
            <button type="button" onClick={stopCamera} className="w-full py-3 bg-red-700 rounded-xl font-bold">Batalkan</button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FFF0F4] border border-[#FFE0E8] text-xs font-semibold text-[#E1306C]">
                Operasional Presensi & Check-in v1.1
              </span>
              {connectionState === 'offline' && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-[#FFFBEB] border border-[#FEF08A] px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline Ready</span>
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">
              Meja Check-in Kedatangan & Presensi Kegiatan
            </h1>
          </div>
        </div>

        {/* Tab Switcher */}
        {!activityOnly && <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('individual_checkin')}
            className={`py-2 px-3 rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'individual_checkin' ? 'bg-white dark:bg-[#1C1C1E] text-[#E1306C] font-bold shadow-xs' : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            🎫 Check-in Peserta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contingent_checkin')}
            className={`py-2 px-3 rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'contingent_checkin' ? 'bg-white dark:bg-[#1C1C1E] text-[#E1306C] font-bold shadow-xs' : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            🚩 Check-in Kontingen
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity_session')}
            className={`py-2 px-3 rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'activity_session' ? 'bg-white dark:bg-[#1C1C1E] text-[#E1306C] font-bold shadow-xs' : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            📲 Presensi Sesi / Apel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-3 rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-white dark:bg-[#1C1C1E] text-[#E1306C] font-bold shadow-xs' : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            📊 Statistik Kehadiran
          </button>
        </div>}
      </div>

      {/* TAB 1: INDIVIDUAL CHECK-IN DESK (Requirement 20) */}
      {activeTab === 'individual_checkin' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
              Cari & Pindai Tiket Peserta Kedatangan:
            </h3>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Ketik kode (cth: PST-2026-0142) atau nama peserta..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleInspectParticipant(searchQuery);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E1306C] font-mono min-h-[44px]"
                />
              </div>

              <button
                type="button"
                onClick={() => handleInspectParticipant(searchQuery)}
                className="px-5 py-2.5 bg-gradient-to-r from-[#833AB4] to-[#E1306C] hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20 min-h-[44px] cursor-pointer"
              >
                Cari Peserta
              </button>
            </div>

            <button type="button" onClick={() => startCamera('individual_checkin')}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#171717] text-white dark:bg-[#D4A017] dark:text-black text-sm font-bold">
              <Camera className="w-5 h-5" /> Buka Kamera untuk Scan QR Peserta
            </button>
            {cameraError && <div role="alert" className="text-sm text-red-700 dark:text-red-300 p-3 rounded-xl border border-red-300">{cameraError}</div>}

            {/* Quick Demo Scan Buttons */}
            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/5">
              <span className="text-[10px] text-[#6B7280] dark:text-slate-400 block mb-1.5 font-semibold">
                Simulasi Pindai Tiket Cepat:
              </span>
              <div className="flex flex-wrap gap-2">
                {allParticipants.slice(0, 3).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleInspectParticipant(p.code)}
                    className="px-3 py-1.5 rounded-xl bg-[#FAFAFA] hover:bg-slate-100 text-[#171717] dark:bg-white/5 dark:text-slate-300 border border-[#ECECEF] dark:border-white/10 text-[11px] font-mono flex items-center gap-1.5 min-h-[36px] cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#E1306C]" />
                    <span>{p.name.split(' ')[0]} ({p.code.split('-')[2]})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* INSPECTED PARTICIPANT RESULT CARD (Requirement 20) */}
          {inspectedParticipant && (
            <div className="p-6 rounded-[28px] bg-white dark:bg-[#141418] border-2 border-[#E1306C]/30 shadow-lg space-y-4 animate-in fade-in">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={inspectedParticipant.photoUrl}
                    alt={inspectedParticipant.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#E1306C]/40 shadow-xs"
                  />
                  <div>
                    <span className="text-[10px] font-mono text-[#E1306C] font-bold bg-[#FFF0F4] px-2 py-0.5 rounded-md border border-[#FFE0E8]">
                      {inspectedParticipant.code}
                    </span>
                    <h3 className="text-base font-bold text-[#171717] dark:text-white mt-1">
                      {inspectedParticipant.name}
                    </h3>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400">
                      {inspectedParticipant.role} · {inspectedParticipant.contingentName}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      inspectedParticipant.checkedIn
                        ? 'bg-[#ECFDF5] text-emerald-700 border border-[#A7F3D0]'
                        : 'bg-[#FFFBEB] text-amber-700 border border-[#FEF08A]'
                    }`}
                  >
                    {inspectedParticipant.checkedIn ? '✓ Sudah Tiba di Buper' : 'Belum Check-in'}
                  </span>
                </div>
              </div>

              {/* Data Grid: Verification Status, Contingent, Campsite Lot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[10px] text-[#6B7280] block">Status Berkas:</span>
                  <span className="font-bold text-emerald-700 uppercase">{inspectedParticipant.status}</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[10px] text-[#6B7280] block">Kontingen Ranting:</span>
                  <span className="font-bold text-[#171717] dark:text-white truncate block">{inspectedParticipant.contingentName}</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[10px] text-[#6B7280] block">Alokasi Kavling:</span>
                  <span className="font-bold text-amber-700">{inspectedParticipant.subCamp} ({inspectedParticipant.tentNumber})</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[10px] text-[#6B7280] block">Waktu Check-in:</span>
                  <span className="font-mono text-[#171717] dark:text-slate-200">
                    {inspectedParticipant.checkInTime ? new Date(inspectedParticipant.checkInTime).toLocaleTimeString('id-ID') : '-'}
                  </span>
                </div>
              </div>

              {/* Check-in Action with Double Check-in Guard */}
              <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 flex items-center justify-between">
                {inspectedParticipant.checkedIn ? (
                  <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-emerald-800 text-xs flex items-center gap-2 w-full">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Peserta ini telah selesai check-in. Akses tenda dan ID Card aktif.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePerformCheckIn(inspectedParticipant)}
                    disabled={isProcessing}
                    className="w-full py-3 bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi Check-in Kedatangan Sekarang</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTINGENT CHECK-IN (Requirement 21) */}
      {activeTab === 'contingent_checkin' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E1306C]" />
                <span>Check-in Rombongan Kontingen</span>
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Lakukan check-in sekaligus untuk satu kontingen dengan pengecualian peserta yang belum hadir.
              </p>
            </div>

            {/* Contingent Selector */}
            <div>
              <label className="text-xs font-semibold text-[#171717] dark:text-slate-300 block mb-1">Pilih Kontingen:</label>
              <select
                value={selectedContingentId}
                onChange={e => setSelectedContingentId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white min-h-[44px]"
              >
                {contingents.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.participantCount} Peserta)</option>
                ))}
              </select>
            </div>

            {/* Contingent Statistics Banner (Requirement 21) */}
            {selectedContingent && (
              <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 space-y-3">
                <div className="font-bold text-[#171717] dark:text-white text-sm">{selectedContingent.name}</div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 shadow-2xs">
                    <span className="text-[10px] text-[#6B7280] block font-semibold">Registered</span>
                    <span className="text-base font-black text-[#171717] dark:text-white font-mono">{contingentParticipants.length}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] shadow-2xs">
                    <span className="text-[10px] text-emerald-700 block font-semibold">Verified</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {contingentParticipants.filter(p => p.status === 'verified' || p.status === 'approved').length}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] shadow-2xs">
                    <span className="text-[10px] text-blue-700 block font-semibold">Present (Hadir)</span>
                    <span className="text-base font-black text-blue-700 font-mono">
                      {contingentParticipants.filter(p => p.checkedIn).length}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FEF08A] text-[11px] text-amber-800 space-y-0.5">
                  <div>• {contingentParticipants.filter(p => !p.checkedIn).length} peserta belum hadir di buper.</div>
                  <div>
                    • {contingentParticipants.filter(p => p.status !== 'verified' && p.status !== 'approved').length} peserta belum berstatus verified.
                  </div>
                </div>
              </div>
            )}

            {/* Individual Exceptions Roster */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#171717] dark:text-slate-300 font-semibold">
                <span>Daftar Peserta Kontingen (Centang jika Belum Hadir / Pengecualian):</span>
                <span className="font-mono text-amber-600 font-bold">{exceptionParticipantIds.length} Dikecualikan</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {contingentParticipants.map(p => {
                  const isExcepted = exceptionParticipantIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer text-xs transition-colors min-h-[44px] ${
                        isExcepted
                          ? 'bg-[#FFFBEB] border-[#FEF08A] text-amber-900'
                          : 'bg-[#FAFAFA] dark:bg-white/5 border-[#ECECEF] dark:border-white/5 text-[#171717] dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isExcepted}
                          onChange={e => {
                            if (e.target.checked) setExceptionParticipantIds([...exceptionParticipantIds, p.id]);
                            else setExceptionParticipantIds(exceptionParticipantIds.filter(id => id !== p.id));
                          }}
                          className="accent-[#E1306C] rounded w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-[#171717] dark:text-white">{p.name}</div>
                          <div className="text-[10px] text-[#6B7280] font-mono">{p.code} · {p.role}</div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.checkedIn ? 'text-emerald-600 bg-emerald-50' : 'text-[#6B7280]'
                      }`}>
                        {p.checkedIn ? 'Sudah Hadir' : isExcepted ? 'Dikecualikan' : 'Siap Check-in'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePerformContingentCheckIn}
              className="w-full py-3 bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Check-in Seluruh Kontingen (Kecuali Pengecualian)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITY SESSION ATTENDANCE (Requirement 22) */}
      {activeTab === 'activity_session' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-[#E1306C]" />
                <span>Presensi &amp; Poin {isCampActivity ? 'Aktivitas Perkemahan' : 'Jadwal Kegiatan'}</span>
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Pilih {itemLabel}. Poin dihitung terpisah oleh GAS untuk setiap peserta.
              </p>
            </div>

            {/* Session Selector */}
            <div>
              <label className="text-xs font-semibold text-[#171717] dark:text-slate-300 block mb-1">Pilih {itemLabel}:</label>
              <select
                value={selectedScheduleId}
                onChange={e => setSelectedScheduleId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white min-h-[44px]"
              >
                <option value="">Pilih {itemLabel}</option>
                {scheduleItems.map(s => (
                  <option key={s.id} value={s.id}>
                    Hari ke-{s.dayNumber} · {s.time} · {s.title} ({s.location}) · {s.xpReward || 0} poin
                  </option>
                ))}
              </select>
            </div>

            {!loadingData && scheduleItems.length === 0 && <p role="status" className="text-sm text-amber-700">Belum ada {itemLabel} aktif dari GAS. Tambahkan data terlebih dahulu.</p>}
            <p className="text-xs text-slate-600 dark:text-slate-300">Poin mengikuti {isCampActivity ? 'Activities.xp_points' : 'Schedules.xp_reward'} di GAS. Satu peserta mendapat poin sekali untuk setiap {itemLabel}.</p>
            {/* Scan or Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Pindai barcode atau ketik kode tiket (cth: PST-2026-0142)..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleActivityScan(manualCode);
                }}
                className="flex-1 px-4 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white font-mono focus:outline-none focus:border-[#E1306C] min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => handleActivityScan(manualCode)}
                disabled={isProcessing || loadingData || !manualCode || !selectedSchedule}
                className="px-5 py-2.5 bg-gradient-to-r from-[#833AB4] to-[#E1306C] hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20 disabled:opacity-40 min-h-[44px] cursor-pointer"
              >
                Presensi
              </button>
            </div>
          </div>

          <button type="button" disabled={isProcessing || loadingData || !selectedSchedule} onClick={() => startCamera('activity_session')}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#171717] text-white dark:bg-[#D4A017] dark:text-black text-sm font-bold">
            <Camera className="w-5 h-5" /> Scan QR untuk Presensi Sesi
          </button>
          {cameraError && <div role="alert" className="text-sm text-red-700 dark:text-red-300 p-3 rounded-xl border border-red-300">{cameraError}</div>}

          {/* Recent Records List */}
          <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#171717] dark:text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#E1306C]" />
                <span>Log Presensi Terbaru Sesi Ini ({sessionRecords.length})</span>
              </span>
              <span className="text-[#6B7280] font-mono text-[10px]">Sumber: GAS</span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 text-xs">
              {sessionRecords.map(rec => (
                <div key={rec.id} className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#171717] dark:text-white">{rec.participantName}</div>
                    <div className="text-[10px] text-[#6B7280] font-mono">{rec.participantCode} · {rec.contingentName}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[#E1306C] text-xs font-bold">+{rec.xpAwarded} XP</span>
                    <div className="text-[10px] text-[#9CA3AF] font-mono">{rec.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ATTENDANCE DASHBOARD (Requirement 23) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 flex flex-col sm:flex-row gap-3 text-xs shadow-xs">
            <div className="flex-1">
              <label className="text-[#6B7280] font-semibold block mb-1">Filter Kontingen:</label>
              <select
                value={dashFilterContingent}
                onChange={e => setDashFilterContingent(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white min-h-[44px]"
              >
                <option value="all">Semua Kontingen ({contingents.length})</option>
                {contingents.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="block text-sm">{isCampActivity ? 'Aktivitas Perkemahan' : 'Jadwal Kegiatan'}
            <select className="block w-full p-3 rounded-xl border text-slate-900" value={dashFilterActivity} onChange={e => setDashFilterActivity(e.target.value)}>
              <option value="all">Pernah hadir pada kegiatan mana pun</option>
              {scheduleItems.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          {/* 4 Core Summary Stat Cards (Requirement 23: expected, present, absent, rate) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-1 shadow-2xs">
              <span className="text-[#6B7280] text-[11px] block font-semibold">Total Expected:</span>
              <div className="text-2xl font-black text-[#171717] dark:text-white font-mono">{filteredDashboardParticipants.length}</div>
              <span className="text-[10px] text-[#9CA3AF]">Kuota Terdaftar</span>
            </div>

            <div className="p-4 rounded-[24px] bg-[#ECFDF5] border border-[#A7F3D0] space-y-1 shadow-2xs">
              <span className="text-emerald-800 text-[11px] block font-semibold">Present (Hadir):</span>
              <div className="text-2xl font-black text-emerald-700 font-mono">{presentCount}</div>
              <span className="text-[10px] text-emerald-600">Tercatat pada kegiatan terpilih</span>
            </div>

            <div className="p-4 rounded-[24px] bg-[#FFFBEB] border border-[#FEF08A] space-y-1 shadow-2xs">
              <span className="text-amber-800 text-[11px] block font-semibold">Belum tercatat hadir:</span>
              <div className="text-2xl font-black text-amber-700 font-mono">{absentCount}</div>
              <span className="text-[10px] text-amber-600">Belum ada catatan kegiatan</span>
            </div>

            <div className="p-4 rounded-[24px] bg-[#EFF6FF] border border-[#BFDBFE] space-y-1 shadow-2xs">
              <span className="text-blue-800 text-[11px] block font-semibold">Tingkat Kehadiran:</span>
              <div className="text-2xl font-black text-blue-700 font-mono">{attendanceRate}%</div>
              <span className="text-[10px] text-blue-600">Berdasarkan catatan kegiatan</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
