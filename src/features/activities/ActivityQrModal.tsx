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

import React, { useState } from 'react';
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

interface ActivityQrModalProps {
  activityId: string;
  activityTitle: string;
  category?: string;
  location?: string;
  scheduleTime?: string;
  onClose: () => void;
  onOpenPrintSign?: (config: ActivityQrConfig) => void;
}

export const ActivityQrModal: React.FC<ActivityQrModalProps> = ({
  activityId,
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveConfig = () => {
    const saved = activityQrService.configureActivityQr(activityId, {
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
    });

    showToast('✅ Pengaturan QR Kegiatan berhasil disimpan!');
  };

  const handleRotateToken = () => {
    if (!rotateReason.trim()) return;
    try {
      activityQrService.rotateActivityToken(activityId, currentUser?.name || 'Panitia Giat', rotateReason);
      setShowRotateConfirm(false);
      showToast('🔄 Token QR berhasil diregenerasi! Token lama tidak lagi berlaku.');
    } catch (err: any) {
      alert(err.message);
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

  const currentConfig = activityQrService.getConfigByActivityId(activityId);
  const analytics = currentConfig ? activityQrService.getActivityAnalytics(activityId) : null;
  const qrDisplayToken = currentConfig?.qrToken || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-[#1c0c0f] border-2 border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-slate-100">
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
        <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-2xl border border-white/5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'config' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚙️ Parameter QR
          </button>
          <button
            onClick={() => setActiveTab('checkpoints')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'checkpoints' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🧭 Multi-Pos ({checkpoints.length})
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'preview' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            👁️ Pratinjau
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 rounded-xl transition-all ${
              activeTab === 'analytics' ? 'bg-red-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Statistik ({analytics?.validScansCount || 0})
          </button>
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

            {/* Purpose Mode (Req 2, 13) */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Fungsi & Mode Validasi QR:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'PARTICIPATION', label: 'Partisipasi & XP', desc: 'Catat kehadiran umum & beri XP' },
                  { id: 'ATTENDANCE', label: 'Presensi Resmi', desc: 'Sinkron otomatis ke buku presensi' },
                  { id: 'CHECKPOINT', label: 'Pos / Checkpoint', desc: 'Rangkaian pos Wide Game' },
                  { id: 'CHECK_IN', label: 'Pintu Gerbang Masuk', desc: 'Check-in area panggung / sesi' },
                  { id: 'CHALLENGE', label: 'Penyelesaian Tantangan', desc: 'Poin untuk uji keterampilan' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id as ActivityQrMode)}
                    className={`p-3 rounded-2xl text-left border transition-all ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    max="500"
                    value={rewardXp}
                    onChange={e => setRewardXp(Number(e.target.value))}
                    className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white font-mono font-bold"
                  />
                  <span className="text-xs text-amber-400 font-bold">XP</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Poin masuk ke Ledger Transaksi resmi saat scan berhasil.
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
            <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 space-y-2">
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
                Pemindaian di luar jam ini akan ditolak dengan pesan informatif kepada peserta.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowRotateConfirm(true)}
                className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl font-semibold flex items-center gap-1.5 transition-all text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerasi Token</span>
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-950/50 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Parameter QR</span>
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
                  Cocok untuk Wide Game, Penjelajahan Rimba, Orienteering, dan Pos Uji Keterampilan.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMultiCheckpoint}
                  onChange={e => setIsMultiCheckpoint(e.target.checked)}
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
            {/* Live QR Sign Card Preview */}
            <div className="max-w-sm mx-auto p-5 rounded-3xl bg-gradient-to-b from-[#2a0e13] via-[#1c0c0f] to-[#120709] border-2 border-red-500/40 text-center space-y-3 shadow-2xl">
              <div className="space-y-0.5">
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold text-[10px] uppercase">
                  {category}
                </span>
                <h4 className="text-base font-black text-white mt-1">{activityTitle}</h4>
                <div className="text-[11px] text-slate-300 flex items-center justify-center gap-2">
                  <span>⏰ {scheduleTime}</span>
                  <span>·</span>
                  <span>📍 {location}</span>
                </div>
              </div>

              {/* QR Canvas Box */}
              <div className="w-48 h-48 mx-auto p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDisplayToken)}`}
                  alt="QR Code Kegiatan"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-slate-300 font-medium">
                  Scan menggunakan aplikasi SiEpang untuk mencatat keikutsertaan
                </div>
                {rewardXp > 0 && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/30">
                    <Zap className="w-3.5 h-3.5" />
                    <span>+{rewardXp} XP Poin Pramuka</span>
                  </div>
                )}
              </div>

              <div className="text-[9px] text-slate-500 font-mono truncate px-2">
                Token Opaque: {qrDisplayToken}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (currentConfig && onOpenPrintSign) {
                    onOpenPrintSign(currentConfig);
                  } else {
                    window.print();
                  }
                }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lembar Tanda Kegiatan (A4 Sign)</span>
              </button>

              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrDisplayToken)}`}
                download={`QR_${activityTitle.replace(/\s+/g, '_')}.png`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold flex items-center gap-2 border border-white/10"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Gambar PNG</span>
              </a>
            </div>
          </div>
        )}

        {/* TAB 4: SCAN ANALYTICS (Req 18) */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Total Pemindaian</div>
                <div className="text-base font-black text-white mt-0.5 font-mono">
                  {analytics?.totalScans || 0} Kali
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Peserta Unik</div>
                <div className="text-base font-black text-red-400 mt-0.5 font-mono">
                  {analytics?.uniqueParticipants || 0} Orang
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Percobaan Duplikat</div>
                <div className="text-base font-black text-amber-400 mt-0.5 font-mono">
                  {analytics?.duplicateAttemptsCount || 0} Dicegah
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[10px]">Total XP Terdistribusi</div>
                <div className="text-base font-black text-amber-300 mt-0.5 font-mono">
                  +{analytics?.totalXpDistributed || 0} XP
                </div>
              </div>
            </div>

            {/* Recent Scans Table */}
            <div className="rounded-2xl bg-black/30 border border-white/5 overflow-hidden">
              <div className="p-3 border-b border-white/5 font-bold text-slate-300">
                Log Pemindaian Terbaru
              </div>
              <div className="divide-y divide-white/5 max-h-[220px] overflow-y-auto">
                {analytics?.recentScans && analytics.recentScans.length > 0 ? (
                  analytics.recentScans.map(scan => (
                    <div key={scan.scanId} className="p-3 flex items-center justify-between text-[11px]">
                      <div>
                        <div className="font-bold text-white">{scan.participantName}</div>
                        <div className="text-slate-400 text-[10px]">
                          {scan.contingentName} · {scan.scannedAt}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            scan.status === 'SUCCESS'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {scan.status === 'SUCCESS' ? `+${scan.xpAwarded} XP` : 'Duplikat Dicegah'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-500">
                    Belum ada riwayat pemindaian untuk kegiatan ini.
                  </div>
                )}
              </div>
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
