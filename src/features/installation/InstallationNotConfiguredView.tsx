/**
 * @license
 * SiEpang - Installation Not Configured View (INSTALLATION_NOT_CONFIGURED)
 * Displayed when Script Properties are incomplete or unconfigured.
 * Prevents silent fallback to any hardcoded default event.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Settings,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Server,
  FileSpreadsheet,
  Building2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { customerInstallationService } from '../../services/customerInstallationService';
import { eventService } from '../../services/eventService';
import { workspaceService } from '../../services/workspaceService';

interface InstallationNotConfiguredViewProps {
  onRetry: () => void;
  onOpenSetup: () => void;
  errorMessage?: string | null;
}

export const InstallationNotConfiguredView: React.FC<InstallationNotConfiguredViewProps> = ({
  onRetry,
  onOpenSetup,
  errorMessage,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const REQUIRED_SCRIPT_PROPERTIES = [
    {
      key: 'SIEPANG_INSTALLATION_ID',
      label: 'ID Instalasi SiEpang',
      example: 'ID instalasi dari GAS',
      desc: 'Pengidentifikasi unik deployment instans SiEpang untuk kegiatan ini.',
      icon: Server,
    },
    {
      key: 'SIEPANG_ACTIVE_WORKSPACE_ID',
      label: 'ID Workspace / Kwartir',
      example: 'ID workspace dari GAS',
      desc: 'ID kwartir penyelenggara kegiatan pada sheet Workspaces.',
      icon: Building2,
    },
    {
      key: 'SIEPANG_ACTIVE_EVENT_ID',
      label: 'ID Kegiatan / Event Aktif',
      example: 'ID event dari GAS',
      desc: 'ID resmi kegiatan perkemahan pada sheet Events di Spreadsheet Database.',
      icon: Calendar,
    },
    {
      key: 'SPREADSHEET_ID',
      label: 'ID Google Spreadsheet Database',
      example: 'ID Spreadsheet/Drive dari GAS',
      desc: 'ID file Google Spreadsheet yang memuat skema tabel SiEpang.',
      icon: FileSpreadsheet,
    },
    {
      key: 'DRIVE_ROOT_ID',
      label: 'ID Google Drive Root Folder',
      example: 'ID Spreadsheet/Drive dari GAS',
      desc: 'ID folder Google Drive utama untuk penyimpanan dokumen, foto, & piagam.',
      icon: Settings,
    },
  ];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCopyAll = () => {
    const snippet = REQUIRED_SCRIPT_PROPERTIES.map(p => `${p.key}=${p.example}`).join('\n');
    navigator.clipboard.writeText(snippet);
    setCopiedKey('ALL');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry();
    setIsRetrying(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans selection:bg-[#F47743] selection:text-white">
      <div className="max-w-4xl mx-auto w-full my-auto space-y-6">
        {/* Top Header Card */}
        <div className="rounded-[32px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#ECECEF] dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#208C60] via-[#F47743] to-[#FFD36A] flex items-center justify-center text-2xl shadow-md text-white shrink-0">
                ⚜️
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#171717] dark:text-white tracking-tight">
                  SiEpang — Sistem Informasi Perkemahan
                </h1>
                <p className="text-xs text-[#6B7280] dark:text-slate-400 font-medium">
                  Prinsip Arsitektur: 1 Instalasi = 1 Kegiatan / Event
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>INSTALLATION_NOT_CONFIGURED</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#171717] dark:text-white">
              Script Properties Instalasi Belum Lengkap
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280] dark:text-slate-300 leading-relaxed max-w-3xl">
              Instalasi SiEpang ini belum terhubung dengan Script Properties yang lengkap pada backend Google Apps Script. 
              Sesuai arsitektur instalasi tunggal, sistem <strong>tidak otomatis mengasumsikan data sembarang</strong>. 
              Administrator wajib melengkapi konfigurasi Script Properties agar aplikasi mengenali kegiatan resmi yang diselenggarakan.
            </p>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-rose-900 dark:text-rose-200 text-xs font-mono flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Required Script Properties Card */}
        <div className="rounded-[32px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#171717] dark:text-white uppercase tracking-wider">
                Daftar Script Properties Wajib (Authoritative Context)
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Konfigurasikan properti berikut pada menu Google Apps Script: <code>Project Settings &gt; Script Properties</code>.
              </p>
            </div>

            <button
              onClick={handleCopyAll}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-[#171717] dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {copiedKey === 'ALL' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'ALL' ? 'Tersalin Semua!' : 'Salin Semua Properti'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {REQUIRED_SCRIPT_PROPERTIES.map(item => {
              const Icon = item.icon;
              const isCopied = copiedKey === item.key;
              return (
                <div
                  key={item.key}
                  className="p-4 rounded-2xl bg-[#F7F7F8] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/5 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-[#171717] dark:text-white">{item.label}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(item.key, item.key)}
                        title="Salin Nama Properti"
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="font-mono text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200/50 dark:border-sky-800/30 break-all">
                      {item.key}
                    </div>

                    <p className="text-[11px] text-[#6B7280] dark:text-slate-400 leading-snug pt-1">
                      {item.desc}
                    </p>
                  </div>

                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono pt-1">
                    Contoh nilai: <span className="text-slate-600 dark:text-slate-300">{item.example}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls & Steps Card */}
        <div className="rounded-[32px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-6 sm:p-8 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-[#171717] dark:text-white uppercase tracking-wider">
            Langkah Cepat Konfigurasi
          </h3>

          <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-[#6B7280] dark:text-slate-300 leading-relaxed">
            <li>Buka proyek Google Apps Script (kode <code>Code.gs</code>) yang mengelola backend SiEpang Anda.</li>
            <li>Di bilah sisi kiri, klik ikon <strong>Project Settings</strong> (ikon gerigi).</li>
            <li>Gulir ke bawah hingga menemukan bagian <strong>Script Properties</strong>.</li>
            <li>Klik tombol <strong>Add script property</strong> untuk setiap properti di atas.</li>
            <li>Pastikan baris kegiatan Anda sudah ada di sheet <code>Events</code> pada Google Spreadsheet terkait.</li>
            <li>Klik <strong>Deploy &gt; New deployment</strong> (Pilih jenis <em>Web App</em>, akses <em>Anyone</em>).</li>
            <li>Salin URL Web App dan hubungkan melalui <strong>Pusat Instalasi SiEpang</strong> atau variabel lingkungan.</li>
          </ol>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#ECECEF] dark:border-white/10">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#FFD36A] hover:opacity-95 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Memeriksa Konfigurasi...' : 'Cek Ulang Status Koneksi'}</span>
            </button>

            <button
              onClick={onOpenSetup}
              className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[#171717] dark:text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Sliders className="w-4 h-4" />
              <span>Buka Pusat Instalasi (Setup Mode)</span>
            </button>

          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-400 dark:text-slate-600 pt-6">
        SiEpang — Sistem Informasi Perkemahan Pramuka · 1 Deployment = 1 Kegiatan
      </footer>
    </div>
  );
};
