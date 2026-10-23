/**
 * @license
 * SiEpang - Activity QR Configuration & Management Modal (Req 1-20)
 * Provides:
 * - Generate / toggle Activity QR
 * - Purpose mode selector (ATTENDANCE, CHECK_IN, CHECKPOINT, PARTICIPATION, CHALLENGE)
 * - Configured XP point reward & scan window (scanOpens, scanCloses)
 * - Multi-checkpoint builder for Wide Game / Penjelajahan
 * - Token rotation modal with audit reason
 * - Live QR preview & quick print launcher
 * - Scan analytics & participant scan logs
 */

import React, { useEffect, useState } from 'react';
import {
  QrCode,
  Zap,
  Clock,
  MapPin,
  Calendar,
  Layers,
  ShieldCheck,
  RefreshCw,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Users,
  Compass,
  Plus,
  Trash2,
  X,
  Eye,
  Check,
} from 'lucide-react';
import { activityQrService, ScanResult } from '../../services/activityQrService';
import { ActivityQrConfig, ActivityQrMode, ActivityCheckpointItem } from '../../types';
import { authService } from '../../services/authService';
import { workspaceService } from '../../services/workspaceService';
import { eventStudioService } from '../../services/eventStudioService';
import { QrImage } from '../../components/qr/QrImage';
import { agendaAttendanceService } from '../../services/agendaAttendanceService';

interface ActivityQrModalProps {
  activityId: string;
  scheduleId?: string;
  scheduleXpReward?: number;
  activityTitle: string;
  category?: string;
  location?: string;
  scheduleTime?: string;
  onClose: () => void;
  onOpenPrintSign?: (config: ActivityQrConfig) => void;
}

export const ActivityQrModal: React.FC<ActivityQrModalProps> = ({
  activityId,
  scheduleId,
  scheduleXpReward,
  activityTitle,
  category = 'Kegiatan Umum',
  location = 'Lapangan Buper',
  scheduleTime = '08:00 - 10:00',
  onClose,
  onOpenPrintSign,
}) => {
  const currentUser = authService.getCurrentUser();
  const existingConfig = activityQrService.getConfigByActivityId(activityId);

  const [activeTab, setActiveTab] = useState<'config' | 'checkpoints' | 'analytics' | 'preview'>('config');

  // Form State
  const [enabled, setEnabled] = useState(existingConfig?.enabled ?? true);
  const [mode, setMode] = useState<ActivityQrMode>(existingConfig?.mode || 'PARTICIPATION');
  const [rewardXp, setRewardXp] = useState<number>(existingConfig?.rewardXp ?? 25);
  const [scanOpens, setScanOpens] = useState<string>(existingConfig?.scanOpens || '07:30');
  const [scanCloses, setScanCloses] = useState<string>(existingConfig?.scanCloses || '11:00');
  const [isMultiCheckpoint, setIsMultiCheckpoint] = useState<boolean>(existingConfig?.isMultiCheckpoint ?? false);
  const [checkpointOrder, setCheckpointOrder] = useState<'ordered' | 'unordered'>(existingConfig?.checkpointOrder || 'ordered');
  const [checkpoints, setCheckpoints] = useState<ActivityCheckpointItem[]>(
    existingConfig?.checkpoints || [
      {
        checkpointId: `cp_1_${Date.now()}`,
        name: 'Pos 1: Titik Awal',
        orderIndex: 1,
        location: location,
        rewardXp: 10,
        qrToken: `SIEPANG:QR:v1:CP_${activityId}_pos1`,
        hint: 'Kunjungi pos awal untuk validasi regu',
      },
    ]
  );

  // Rotate Token State (Req 20)
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [rotateReason, setRotateReason] = useState('Pencegahan kebocoran token / pergantian sesi kegiatan');
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [serverAnalytics, setServerAnalytics] = useState<{ total_scans: number; unique_participants: number; total_xp_distributed: number } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const workspaceId = workspaceService.getCurrentWorkspace()?.id || currentUser?.workspaceId || '';
  const activeEvent = eventStudioService.getEvent();
  const eventId = workspaceService.getCurrentWorkspace()?.activeEventId || currentUser?.eventId || activeEvent?.id || '';

  const ensureConfig = () => {
    return activityQrService.configureActivityQr(
      activityId,
      {
        title: activityTitle,
        category,
        location,
        mode,
        rewardXp: Number(rewardXp),
        scanOpens,
        scanCloses,
        enabled,
        isMultiCheckpoint,
        checkpointOrder,
        checkpoints: isMultiCheckpoint ? checkpoints : undefined,
        scheduleId,
      },
      workspaceId,
      eventId
    );
  };

  const currentConfig = activityQrService.getConfigByActivityId(activityId);
  const analytics = serverAnalytics;

  useEffect(() => {
    if (activeTab !== 'analytics' || !scheduleId) return;
    let alive = true;
    setAnalyticsLoading(true);
    agendaAttendanceService.analytics(scheduleId)
      .then(result => { if (alive) setServerAnalytics({ total_scans: result.total_scans, unique_participants: result.unique_participants, total_xp_distributed: result.total_xp_distributed }); })
      .catch((err: any) => { if (alive) showToast(`Statistik GAS gagal dimuat: ${err?.message || 'Kesalahan tidak diketahui'}`); })
      .finally(() => { if (alive) setAnalyticsLoading(false); });
    return () => { alive = false; };
  }, [activeTab, scheduleId]);
  const isOfficialToken = Boolean(currentConfig?.qrToken && /^AGENDA_[a-f0-9]{64}$/i.test(currentConfig.qrToken));
  const previewToken = isOfficialToken && enabled ? currentConfig!.qrToken : '';
  const downloadHref = previewToken
    ? `data:text/plain;charset=utf-8,${encodeURIComponent(previewToken)}`
    : '';

  const handleSaveConfig = async () => {
    if (!enabled) {
      if (!scheduleId) {
        showToast('Agenda ID tidak tersedia. QR belum dapat dinonaktifkan di GAS dari kartu aktivitas ini.');
        return;
      }
      setIsSaving(true);
      try {
        const result = await agendaAttendanceService.disable(scheduleId);
        activityQrService.toggleActivityQr(activityId, false);
        const disabledConfig = activityQrService.getConfigByActivityId(activityId);
        if (disabledConfig) disabledConfig.qrToken = '';
        showToast(`QR agenda dinonaktifkan di GAS. ${result.disabled_count} token tidak lagi dapat dipindai.`);
      } catch (err: any) {
        showToast(`Penonaktifan QR gagal: ${err?.message || 'Kesalahan tidak diketahui'}`);
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (!scheduleId) {
      showToast('Agenda ID tidak tersedia. Buka Kelola QR dari kartu Jadwal Kegiatan agar QR resmi dapat diterbitkan.');
      return;
    }

    setIsSaving(true);
    try {
      const previousConfig = currentConfig;
      const hadOfficialToken = Boolean(previousConfig?.qrToken && /^AGENDA_[a-f0-9]{64}$/i.test(previousConfig.qrToken));
      const scanWindowChanged = Boolean(previousConfig && (previousConfig.scanOpens !== scanOpens || previousConfig.scanCloses !== scanCloses));
      const saved = ensureConfig();
      let officialToken = saved.qrToken;
      let authoritativeXp = saved.rewardXp;
      if (hadOfficialToken && scanWindowChanged) {
        const rotated = await agendaAttendanceService.rotate(scheduleId, previousConfig!.qrToken, 'Perubahan jendela waktu pemindaian', scanOpens, scanCloses);
        officialToken = rotated.qr_token;
        authoritativeXp = Number(rotated.xp_reward || 0);
        saved.qrToken = officialToken;
        saved.scheduleId = rotated.schedule_id;
        saved.rewardXp = authoritativeXp;
      } else if (!hadOfficialToken || saved.scheduleId !== scheduleId) {
        const issued = await agendaAttendanceService.issue(scheduleId, scanOpens, scanCloses);
        officialToken = issued.qr_token;
        authoritativeXp = Number(issued.xp_reward || 0);
        saved.qrToken = officialToken;
        saved.scheduleId = issued.schedule_id;
        saved.rewardXp = authoritativeXp;
      }
      setRewardXp(authoritativeXp);
      setActiveTab('preview');
      showToast('QR agenda resmi tersimpan di GAS. Jendela scan divalidasi server dan XP mengikuti konfigurasi agenda.');
    } catch (err: any) {
      showToast(`QR belum diterbitkan: ${err?.message || 'Gagal menghubungi GAS'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPrint = () => {
    if (!enabled || !isOfficialToken) {
      showToast('Aktifkan dan terbitkan QR agenda resmi terlebih dahulu sebelum mencetak.');
      setActiveTab('config');
      return;
    }
    const saved = ensureConfig();
    if (onOpenPrintSign) {
      onOpenPrintSign(saved);
      return;
    }
    window.print();
  };

  const handleRotateToken = async () => {
    if (!rotateReason.trim()) return;
    if (!scheduleId) {
      showToast('QR resmi hanya dapat diregenerasi dari agenda yang tersimpan di GAS. Buka QR melalui kartu Jadwal Kegiatan.');
      return;
    }
    setIsSaving(true);
    try {
      const currentToken = /^AGENDA_[a-f0-9]{64}$/i.test(currentConfig?.qrToken || '') ? currentConfig!.qrToken : '';
      const response = await agendaAttendanceService.rotate(scheduleId, currentToken, rotateReason, scanOpens, scanCloses);
      const saved = activityQrService.configureActivityQr(
        activityId,
        { title: activityTitle, category, location, mode, rewardXp: response.xp_reward, scanOpens, scanCloses, enabled: true, isMultiCheckpoint, checkpointOrder, checkpoints: isMultiCheckpoint ? checkpoints : undefined, scheduleId },
        workspaceId,
        eventId
      );
      saved.qrToken = response.qr_token;
      saved.scheduleId = response.schedule_id;
      saved.rewardXp = response.xp_reward;
      setEnabled(true);
      setRewardXp(response.xp_reward);
      setShowRotateConfirm(false);
      setActiveTab('preview');
      showToast('Token QR resmi diregenerasi di GAS. Token lama telah dinonaktifkan.');
    } catch (err: any) {
      showToast(`Regenerasi QR gagal: ${err?.message || 'Kesalahan tidak diketahui'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCheckpoint = () => {
    const nextIdx = checkpoints.length + 1;
    const newCp: ActivityCheckpointItem = {
      checkpointId: `cp_${nextIdx}_${Date.now()}`,
      name: `Pos ${nextIdx}: Tantangan Baru`,
      orderIndex: nextIdx,
      location: `Pos Lapangan ${nextIdx}`,
      rewardXp: 10,
      qrToken: `SIEPANG:QR:v1:CP_${activityId}_pos${nextIdx}_${Math.random().toString(36).substring(2, 6)}`,
      hint: 'Selesaikan tugas pos sebelum lanjut ke pos berikutnya',
    };
    setCheckpoints([...checkpoints, newCp]);
  };

  const handleRemoveCheckpoint = (idx: number) => {
    setCheckpoints(checkpoints.filter((_, i) => i !== idx));
  };

  const qrDisplayToken = previewToken;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-6xl bg-[#1c0c0f] border-2 border-red-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-slate-100">
        {toast && (
          <div className="p-3.5 rounded-2xl bg-red-950/90 border border-red-500/50 text-xs text-red-200 font-semibold flex items-center justify-between shadow-xl">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Kelola QR Kegiatan & Presensi
              </h3>
              <p className="text-xs text-slate-400">{activityTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { key: 'config', icon: '⚙️', title: 'Parameter QR', desc: 'Aktivasi, mode, reward, dan jadwal scan' },
            { key: 'checkpoints', icon: '🧭', title: `Multi-Pos (${checkpoints.length})`, desc: 'Belum terhubung ke endpoint scan GAS' },
            { key: 'preview', icon: '👁️', title: 'Pratinjau', desc: 'Lihat QR siap pakai dan aksi cepat' },
            { key: 'analytics', icon: '📊', title: `Statistik (${analytics?.total_scans || 0})`, desc: 'Presensi dan XP terverifikasi dari GAS' },
          ].map(tab => (
            <button
              key={tab.key}
              disabled={tab.key === 'checkpoints'}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                activeTab === tab.key
                  ? 'border-red-500/50 bg-red-950/50 shadow-lg shadow-red-950/40'
                  : 'border-white/5 bg-black/35 hover:border-white/10 hover:bg-black/50'
              }`}
            >
              <div className="text-base">{tab.icon}</div>
              <div className="mt-2 font-bold text-white">{tab.title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-400">{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* TAB 1: CONFIGURATION */}
        {activeTab === 'config' && (
          <div className="space-y-4 text-xs">
            {/* Enable Toggle */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-sm">Aktifkan QR Code Kegiatan</div>
                <div className="text-[11px] text-slate-400">
                  Peserta dapat memindai QR ini untuk mencatat partisipasi dan meraih poin XP.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Purpose Mode (Req 2, 13) */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <label className="text-slate-300 font-semibold block mb-1">
                Fungsi & Mode Validasi QR:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'PARTICIPATION', label: 'Partisipasi & XP', desc: 'Presensi agenda dan reward XP', supported: true },
                  { id: 'ATTENDANCE', label: 'Presensi Resmi', desc: 'Tercatat ke AttendanceLogs GAS', supported: true },
                  { id: 'CHECKPOINT', label: 'Pos / Checkpoint', desc: 'Belum terhubung ke endpoint scan resmi', supported: false },
                  { id: 'CHECK_IN', label: 'Pintu Gerbang Masuk', desc: 'Gunakan QR gerbang khusus', supported: false },
                  { id: 'CHALLENGE', label: 'Penyelesaian Tantangan', desc: 'Endpoint scan tantangan belum aktif', supported: false },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!m.supported}
                    onClick={() => setMode(m.id as ActivityQrMode)}
                    title={!m.supported ? 'Belum didukung oleh alur scan QR agenda saat ini' : undefined}
                    className={`p-3 rounded-2xl text-left border transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      mode === m.id
                        ? 'bg-red-950/60 border-red-500 text-white shadow-md'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-white text-xs">{m.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* XP Reward & Point Rule (Req 16, 17) */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Hadiah Poin XP Peserta (Terkonfigurasi):
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                    <Zap className="w-5 h-5" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={isOfficialToken ? (currentConfig?.rewardXp ?? rewardXp) : (scheduleXpReward ?? rewardXp)}
                    readOnly
                    aria-label="XP sesuai konfigurasi agenda di GAS"
                    className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white font-mono font-bold cursor-not-allowed"
                  />
                  <span className="text-xs text-amber-400 font-bold">XP</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Nilai resmi dibaca dari agenda di GAS; ubah reward melalui pengaturan jadwal.
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Batas Scan per Peserta:
                </label>
                <input
                  type="text"
                  disabled
                  value="1x per Peserta (Mencegah Duplikasi)"
                  className="w-full px-3.5 py-2.5 bg-black/20 border border-white/5 rounded-xl text-slate-400 font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Scan kedua hanya menampilkan &apos;Kegiatan sudah tercatat&apos; tanpa reward ganda.
                </p>
              </div>
            </div>

            {/* Scan Window (Req 11) */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Clock className="w-4 h-4 text-red-400" />
                <span>Jendela Waktu Pemindaian (Scan Window):</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Scan Dibuka (Opens At):</label>
                  <input
                    type="time"
                    value={scanOpens}
                    onChange={e => setScanOpens(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Scan Ditutup (Closes At):</label>
                  <input
                    type="time"
                    value={scanCloses}
                    onChange={e => setScanCloses(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
              </div>
              <div className="text-[10px] text-slate-400">
                Jendela ini disimpan bersama token resmi dan divalidasi oleh GAS saat QR dipindai.
              </div>
            </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowRotateConfirm(true)}
                disabled={!enabled || isSaving}
                className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/60 disabled:opacity-50 disabled:cursor-not-allowed text-rose-300 border border-rose-500/30 rounded-xl font-semibold flex items-center gap-1.5 transition-all text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerasi Token</span>
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl font-bold shadow-lg shadow-red-950/50 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Memproses QR...' : 'Simpan & Terbitkan QR Resmi'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MULTI-CHECKPOINT BUILDER (Req 14, 15) */}
        {activeTab === 'checkpoints' && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-sm">Mode Rangkaian Pos / Checkpoints</div>
                <div className="text-[11px] text-slate-400">
                  Multi-pos belum terhubung ke endpoint scan GAS. Gunakan QR agenda resmi untuk presensi dan XP.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMultiCheckpoint}
                  onChange={e => setIsMultiCheckpoint(e.target.checked)}
                  disabled
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {isMultiCheckpoint ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 font-semibold">Aturan Urutan Pos:</span>
                    <select
                      value={checkpointOrder}
                      onChange={e => setCheckpointOrder(e.target.value as any)}
                      className="px-2.5 py-1 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-semibold"
                    >
                      <option value="ordered">Berurutan (Pos 1 → Pos 2 → Finish)</option>
                      <option value="unordered">Bebas (Dapat diselesaikan acak)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCheckpoint}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center gap-1 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Pos</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {checkpoints.map((cp, idx) => (
                    <div
                      key={cp.checkpointId}
                      className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-red-600/30 text-red-300 font-mono font-bold flex items-center justify-center text-xs">
                            #{cp.orderIndex}
                          </span>
                          <input
                            type="text"
                            value={cp.name}
                            onChange={e => {
                              const updated = [...checkpoints];
                              updated[idx].name = e.target.value;
                              setCheckpoints(updated);
                            }}
                            className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-amber-400 font-bold font-mono">
                            <Zap className="w-3 h-3" />
                            <input
                              type="number"
                              value={cp.rewardXp}
                              onChange={e => {
                                const updated = [...checkpoints];
                                updated[idx].rewardXp = Number(e.target.value);
                                setCheckpoints(updated);
                              }}
                              className="w-12 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-lg text-center font-bold text-xs"
                            />
                            <span>XP</span>
                          </div>

                          {checkpoints.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCheckpoint(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <input
                          type="text"
                          value={cp.location}
                          onChange={e => {
                            const updated = [...checkpoints];
                            updated[idx].location = e.target.value;
                            setCheckpoints(updated);
                          }}
                          placeholder="Lokasi Pos..."
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded-xl text-slate-300"
                        />
                        <input
                          type="text"
                          value={cp.hint || ''}
                          onChange={e => {
                            const updated = [...checkpoints];
                            updated[idx].hint = e.target.value;
                            setCheckpoints(updated);
                          }}
                          placeholder="Petunjuk / Tantangan..."
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded-xl text-slate-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow"
                  >
                    Simpan Rangkaian Pos
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <Compass className="w-8 h-8 mx-auto text-slate-600" />
                <p>Aktifkan mode multi-pos jika kegiatan ini memerlukan lebih dari satu pos pemberhentian.</p>
              </div>
            )}
          </div>
        )}
        {/* TAB 3: LIVE PREVIEW & PRINT (Req 5, 6, 7) */}
        {activeTab === 'preview' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4">
              <div className="min-w-0 overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-b from-[#2a0e13] via-[#1c0c0f] to-[#120709] p-4 sm:p-5 shadow-2xl">
                <div className="grid grid-cols-1 gap-5 items-start min-w-0">
                  <div className="mx-auto flex w-full max-w-[240px] min-w-0 flex-col items-center gap-3">
                    <QrImage
                      value={qrDisplayToken}
                      size={220}
                      className="shadow-xl"
                      emptyLabel="QR belum aktif"
                      subtitle="Simpan pengaturan untuk menghasilkan token resmi yang siap dipindai."
                    />
                    <div className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-center text-[10px] text-slate-400">
                      <div className="font-semibold text-slate-300">Token QR</div>
                      <div className="mt-1 truncate font-mono">{qrDisplayToken || 'Belum dibuat'}</div>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div>
                      <div className="inline-flex rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300">
                        {category}
                      </div>
                      <h4 className="mt-2 text-2xl font-black tracking-tight text-white">{activityTitle}</h4>
                      <p className="mt-1 text-sm text-slate-300">QR ini digunakan untuk presensi dan pencatatan partisipasi kegiatan secara resmi di SiEpang.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-center gap-2 text-slate-300 font-semibold"><Clock className="w-4 h-4 text-red-400" />Waktu Kegiatan</div>
                        <div className="mt-2 text-base font-bold text-white">{scheduleTime}</div>
                        <div className="mt-1 text-[11px] text-slate-400">Jendela scan: {scanOpens} - {scanCloses}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-center gap-2 text-slate-300 font-semibold"><MapPin className="w-4 h-4 text-red-400" />Lokasi</div>
                        <div className="mt-2 text-base font-bold text-white">{location}</div>
                        <div className="mt-1 text-[11px] text-slate-400">Mode: {mode}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-slate-300 font-semibold">Reward XP</div>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-amber-300">
                          <Zap className="w-4 h-4" />
                          <span className="text-lg font-black">+{rewardXp}</span>
                          <span className="text-xs font-semibold">XP</span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-400">Scan kedua dicegah agar reward tidak ganda.</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-slate-300 font-semibold">Status QR</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'}`}>
                            {enabled ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${isOfficialToken ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                            {isOfficialToken ? 'TOKEN RESMI GAS' : 'BELUM DITERBITKAN'}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-400">Token hanya valid jika diterbitkan GAS dari agenda resmi.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <h5 className="text-sm font-bold text-white">Aksi Cepat</h5>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 font-bold text-white shadow hover:bg-red-500"
                    >
                      <Check className="w-4 h-4" />
                      <span>Simpan Pengaturan QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPrint}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-semibold text-white border border-white/10 hover:bg-white/15"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Cetak Lembar Tanda Kegiatan</span>
                    </button>
                    <a
                      href={downloadHref || undefined}
                      download={`QR_${activityTitle.replace(/\s+/g, '_')}.txt`}
                      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold border ${downloadHref ? 'bg-white/10 text-white border-white/10 hover:bg-white/15' : 'pointer-events-none bg-white/5 text-slate-500 border-white/5'}`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh Token QR</span>
                    </a>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <h5 className="text-sm font-bold text-white">Ringkasan Pengaturan</h5>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-[10px] text-slate-400">Jenis QR</div>
                      <div className="mt-1 font-bold text-white">{mode}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-[10px] text-slate-400">Multi-Pos</div>
                      <div className="mt-1 font-bold text-white">{isMultiCheckpoint ? `${checkpoints.length} Pos` : 'Tidak aktif'}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-[10px] text-slate-400">Urutan Pos</div>
                      <div className="mt-1 font-bold text-white">{checkpointOrder}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-[10px] text-slate-400">Event Aktif</div>
                      <div className="mt-1 truncate font-bold text-white">{eventId || 'Belum terdeteksi'}</div>
                    </div>
                  </div>
                </div>

                {isMultiCheckpoint && checkpoints.length > 0 && (
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <h5 className="text-sm font-bold text-white">Daftar Pos</h5>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      {checkpoints.map((cp, idx) => (
                        <div key={cp.checkpointId} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-white">{idx + 1}. {cp.name}</div>
                              <div className="mt-1 text-[11px] text-slate-400">{cp.location}</div>
                            </div>
                            <span className="rounded-full bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">+{cp.rewardXp} XP</span>
                          </div>
                          <div className="mt-2 truncate rounded-xl bg-black/30 px-2.5 py-2 font-mono text-[10px] text-slate-400">{cp.qrToken}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SCAN ANALYTICS (Req 18) */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 text-xs">
            {!scheduleId && <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-3 text-amber-200">Statistik server hanya tersedia untuk QR yang terhubung ke agenda resmi GAS.</div>}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-slate-400">Angka berikut dibaca dari AttendanceLogs dan PointTransactions GAS. Percobaan duplikat tidak dihitung sebagai presensi baru; server mencegah reward ganda.</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Total Pemindaian</div>
                <div className="text-base font-black text-white mt-0.5 font-mono">
                  {analyticsLoading ? 'Memuat…' : (analytics?.total_scans ?? 0)} Kali
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Peserta Unik</div>
                <div className="text-base font-black text-red-400 mt-0.5 font-mono">
                  {analyticsLoading ? 'Memuat…' : (analytics?.unique_participants ?? 0)} Orang
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Percobaan Duplikat</div>
                <div className="text-base font-black text-amber-400 mt-0.5 font-mono">
                  Idempotensi GAS
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Total XP Terdistribusi</div>
                <div className="text-base font-black text-amber-300 mt-0.5 font-mono">
                  +{analyticsLoading ? '…' : (analytics?.total_xp_distributed ?? 0)} XP
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-black/30 border border-white/5 p-4">
              <div className="font-bold text-slate-300">Integritas Data Scan</div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                GAS menyimpan presensi yang berhasil dan transaksi XP. Percobaan duplikat ditolak secara idempoten, tetapi belum dicatat sebagai metrik terpisah sehingga tidak ditampilkan sebagai angka palsu.
              </p>
            </div>
          </div>
        )}

        {/* ROTATE TOKEN AUDIT REASON MODAL (Req 20) */}
        {showRotateConfirm && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Konfirmasi Regenerasi Token QR</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Token QR lama akan langsung dinonaktifkan. Pengguna yang memindai QR lama akan ditolak. Tindakan ini dicatat dalam log audit resmi.
            </p>
            <div>
              <label className="text-slate-300 text-[11px] font-semibold block mb-1">
                Alasan Regenerasi Token:
              </label>
              <input
                type="text"
                value={rotateReason}
                onChange={e => setRotateReason(e.target.value)}
                placeholder="Contoh: Kode QR bocor di grup WA sebelum waktu kegiatan..."
                className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-white text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRotateConfirm(false)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRotateToken}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Konfirmasi Regenerasi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
