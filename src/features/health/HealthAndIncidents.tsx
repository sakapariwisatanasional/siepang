/**
 * @license
 * SiEpang - Posko Kesehatan & Manajemen Insiden Operasional Buper (RC1 Global Design System)
 * Separates confidential health post medical triage from general camp operational incident reports.
 * Standardized to Light-First, Instagram-inspired accent system, and 44px touch targets.
 */

import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Clock,
  HeartPulse,
  MapPin,
  X,
  ShieldAlert,
  Search,
  Check,
} from 'lucide-react';
import { healthService } from '../../services/healthService';
import { HealthIncident, OperationalIncident } from '../../types';
import { authService } from '../../services/authService';

export const HealthAndIncidents: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'health' | 'incidents'>('health');
  const [healthIncidents, setHealthIncidents] = useState<HealthIncident[]>(healthService.getHealthIncidents());
  const [opIncidents, setOpIncidents] = useState<OperationalIncident[]>(healthService.getOperationalIncidents());
  const [loadError, setLoadError] = useState('');
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showOpModal, setShowOpModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsub = healthService.subscribe(() => {
      if (!mounted) return;
      setHealthIncidents(healthService.getHealthIncidents());
      setOpIncidents(healthService.getOperationalIncidents());
    });
    healthService.refresh().then(() => { if (mounted) setLoadError(''); })
      .catch((err: any) => { if (mounted) setLoadError(err?.message || 'Gagal memuat data dari GAS.'); });
    return () => { mounted = false; unsub(); };
  }, []);

  // New medical triage form
  const [newHealth, setNewHealth] = useState({
    participantName: '',
    participantCode: '',
    contingentName: '',
    severity: 'ringan' as 'ringan' | 'sedang' | 'darurat',
    type: 'Keletihan' as any,
    location: '',
    treatment: '',
  });

  // New operational incident form
  const [newOp, setNewOp] = useState({
    title: '',
    category: 'Barang Hilang / Temuan' as any,
    location: '',
    severity: 'rendah' as 'rendah' | 'sedang' | 'tinggi',
    description: '',
  });

  const handleHealthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHealth.participantName) return;

    try { await healthService.recordHealthIncident({
      participantCode: newHealth.participantCode,
      participantName: newHealth.participantName,
      contingentName: newHealth.contingentName,
      severity: newHealth.severity,
      type: newHealth.type,
      location: newHealth.location,
      reportedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reportedBy: authService.getCurrentUser()?.name || authService.getCurrentUser()?.id || '',
      treatment: newHealth.treatment,
    }); setLoadError(''); setShowHealthModal(false); } catch (err: any) { setLoadError(err?.message || 'Gagal menyimpan melalui GAS.'); }
  };

  const handleOpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOp.title) return;

    try { await healthService.recordOperationalIncident({
      title: newOp.title,
      category: newOp.category,
      location: newOp.location,
      reportedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reportedBy: authService.getCurrentUser()?.name || authService.getCurrentUser()?.id || '',
      severity: newOp.severity,
      description: newOp.description,
    }); setLoadError(''); setShowOpModal(false); } catch (err: any) { setLoadError(err?.message || 'Gagal menyimpan melalui GAS.'); }
  };

  const getSeverityBadge = (severity: HealthIncident['severity']) => {
    switch (severity) {
      case 'darurat':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FFF1F2] text-rose-700 border border-[#FECDD3] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30">
            🚨 Darurat (Rujuk RS)
          </span>
        );
      case 'sedang':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-amber-700 border border-[#FEF08A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30">
            ⚠️ Sedang (Observasi)
          </span>
        );
      case 'ringan':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-emerald-700 border border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30">
            ✓ Ringan (P3K)
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-8">
      {loadError && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div>}
      {/* Header with Segmented Navigation */}
      <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0F4] border border-[#FFE0E8] text-xs font-semibold text-[#F47743] mb-1.5">
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Posko Tanggap Darurat & Ketertiban Buper</span>
            </div>
            <h1 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">
              Kesehatan & Penanganan Insiden Buper
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
              Posko medis tanggap darurat, catatan triase, serta log insiden fasilitas & keamanan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => (activeTab === 'health' ? setShowHealthModal(true) : setShowOpModal(true))}
            className="flex items-center justify-center gap-1.5 p-2.5 sm:px-4 sm:py-2.5 bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20 shrink-0 min-w-[44px] min-h-[44px] cursor-pointer"
            title={activeTab === 'health' ? 'Lapor Kasus Medis Baru' : 'Lapor Insiden Fasilitas/Keamanan'}
            aria-label={activeTab === 'health' ? 'Lapor Medis Baru' : 'Lapor Insiden Buper'}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">
              {activeTab === 'health' ? 'Lapor Medis Baru' : 'Lapor Insiden Buper'}
            </span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'health'
                ? 'bg-white dark:bg-[#1C1C1E] text-[#F47743] font-bold shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            🩺 Posko Medis & Triase ({healthIncidents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incidents')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'incidents'
                ? 'bg-white dark:bg-[#1C1C1E] text-amber-600 font-bold shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            🛡️ Insiden Lapangan & Fasilitas ({opIncidents.length})
          </button>
        </div>
      </div>

      {/* TAB 1: HEALTH POST (Confidential medical triage) */}
      {activeTab === 'health' && (
        <div className="space-y-3">
          {healthIncidents.map(inc => (
            <div
              key={inc.id}
              className="p-5 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/30 space-y-3 transition-colors shadow-2xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#171717] dark:text-white">{inc.participantName}</h3>
                    <span className="text-[11px] font-mono text-[#F47743] font-semibold">{inc.participantCode}</span>
                  </div>
                  <div className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                    {inc.contingentName} · Jenis: <span className="text-amber-600 font-semibold">{inc.type}</span>
                  </div>
                </div>

                <div>{getSeverityBadge(inc.severity)}</div>
              </div>

              <div className="p-3 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5 text-xs text-[#171717] dark:text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-[#6B7280] dark:text-slate-400 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {inc.location} ({inc.reportedAt})
                  </span>
                </div>
                <p className="pt-1 text-[#171717] dark:text-slate-200">
                  <span className="font-semibold text-emerald-600">Tindakan Medis: </span>
                  {inc.treatment}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-slate-400 pt-1">
                <span>Pemeriksa: {inc.reportedBy}</span>
                <span className="capitalize font-semibold text-emerald-600">Status: {inc.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: OPERATIONAL INCIDENTS (Lost & Found, Security, Facilities) */}
      {activeTab === 'incidents' && (
        <div className="space-y-3">
          {opIncidents.map(op => (
            <div
              key={op.id}
              className="p-5 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-amber-400/40 space-y-3 transition-colors shadow-2xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#171717] dark:text-white">{op.title}</h3>
                  <div className="text-xs text-emerald-600 font-medium mt-0.5">
                    {op.category} · Lokasi: {op.location}
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                    op.status === 'selesai'
                      ? 'bg-[#ECFDF5] text-emerald-700 border-[#A7F3D0]'
                      : 'bg-[#FFFBEB] text-amber-700 border-[#FEF08A]'
                  }`}
                >
                  {op.status === 'selesai' ? '✓ Selesai' : 'Sedang Diproses'}
                </span>
              </div>

              <p className="text-xs text-[#171717] dark:text-slate-300 leading-relaxed bg-[#FAFAFA] dark:bg-white/5 p-3 rounded-2xl border border-[#ECECEF] dark:border-white/5">
                {op.description}
              </p>

              <div className="flex items-center justify-between text-[11px] text-[#6B7280] dark:text-slate-400 pt-1">
                <span>Pelapor: {op.reportedBy}</span>
                <span>Waktu: {op.reportedAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: LAPOR KASUS MEDIS BARU */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#ECECEF] dark:border-white/10">
              <div className="flex items-center gap-2 font-bold text-sm text-[#171717] dark:text-white">
                <Stethoscope className="w-4 h-4 text-[#F47743]" />
                <span>Catat Pemeriksaan Pasien Medis</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHealthModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleHealthSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[#171717] dark:text-slate-200 font-semibold block">Nama Pasien / Peserta:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nama Lengkap Pasien / Peserta"
                  value={newHealth.participantName}
                  onChange={e => setNewHealth({ ...newHealth, participantName: e.target.value })}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[#171717] dark:text-slate-200 font-semibold block">ID Peserta:</label>
                  <input
                    type="text"
                    value={newHealth.participantCode}
                    onChange={e => setNewHealth({ ...newHealth, participantCode: e.target.value })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743] font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[#171717] dark:text-slate-200 font-semibold block">Kontingen Ranting:</label>
                  <input
                    type="text"
                    value={newHealth.contingentName}
                    onChange={e => setNewHealth({ ...newHealth, contingentName: e.target.value })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[#171717] dark:text-slate-200 font-semibold block">Tingkat Triase:</label>
                  <select
                    value={newHealth.severity}
                    onChange={e => setNewHealth({ ...newHealth, severity: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                  >
                    <option value="ringan">Ringan (Cukup P3K)</option>
                    <option value="sedang">Sedang (Perlu Rehidrasi / Observasi)</option>
                    <option value="darurat">Darurat (Rujuk Ambulans RS)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[#171717] dark:text-slate-200 font-semibold block">Keluhan / Diagnosa:</label>
                  <input
                    type="text"
                    value={newHealth.type}
                    onChange={e => setNewHealth({ ...newHealth, type: e.target.value })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#171717] dark:text-slate-200 font-semibold block">Lokasi Evakuasi:</label>
                <input
                  type="text"
                  value={newHealth.location}
                  onChange={e => setNewHealth({ ...newHealth, location: e.target.value })}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#171717] dark:text-slate-200 font-semibold block">Tindakan Medis & Obat yang Diberikan:</label>
                <textarea
                  rows={2}
                  value={newHealth.treatment}
                  onChange={e => setNewHealth({ ...newHealth, treatment: e.target.value })}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowHealthModal(false)}
                  className="flex-1 py-2.5 bg-[#FAFAFA] hover:bg-slate-100 text-[#6B7280] rounded-xl font-semibold text-xs border border-[#ECECEF]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white rounded-xl font-bold text-xs shadow-md shadow-pink-500/20"
                >
                  Simpan Laporan Medis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LAPOR INSIDEN LAPANGAN */}
      {showOpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#ECECEF] dark:border-white/10">
              <div className="flex items-center gap-2 font-bold text-sm text-[#171717] dark:text-white">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Lapor Insiden Fasilitas / Keamanan Buper</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[#171717] dark:text-slate-200 font-semibold block">Judul Kejadian / Insiden:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Temuan Jam Tangan Digital di Lapangan"
                  value={newOp.title}
                  onChange={e => setNewOp({ ...newOp, title: e.target.value })}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[#171717] dark:text-slate-200 font-semibold block">Kategori:</label>
                  <select
                    value={newOp.category}
                    onChange={e => setNewOp({ ...newOp, category: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                  >
                    <option value="Barang Hilang / Temuan">Barang Hilang / Temuan</option>
                    <option value="Kerusakan Fasilitas">Kerusakan Fasilitas</option>
                    <option value="Keamanan & Ketertiban">Keamanan & Ketertiban</option>
                    <option value="Cuaca & Lingkungan">Cuaca & Lingkungan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[#171717] dark:text-slate-200 font-semibold block">Prioritas:</label>
                  <select
                    value={newOp.severity}
                    onChange={e => setNewOp({ ...newOp, severity: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                  >
                    <option value="rendah">Rendah (Pencegahan)</option>
                    <option value="sedang">Sedang (Perlu Penanganan)</option>
                    <option value="tinggi">Tinggi (Mendesak)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#171717] dark:text-slate-200 font-semibold block">Lokasi Kejadian:</label>
                <input
                  type="text"
                  value={newOp.location}
                  onChange={e => setNewOp({ ...newOp, location: e.target.value })}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#171717] dark:text-slate-200 font-semibold block">Deskripsi Detail:</label>
                <textarea
                  rows={3}
                  value={newOp.description}
                  onChange={e => setNewOp({ ...newOp, description: e.target.value })}
                  className="w-full p-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOpModal(false)}
                  className="flex-1 py-2.5 bg-[#FAFAFA] hover:bg-slate-100 text-[#6B7280] rounded-xl font-semibold text-xs border border-[#ECECEF]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  Kirim Laporan Insiden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
