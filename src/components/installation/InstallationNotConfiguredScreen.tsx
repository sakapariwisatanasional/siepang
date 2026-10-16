/**
 * @license
 * SiEpang - Installation Not Configured Screen
 * Ditampilkan ketika Script Properties pada backend belum lengkap:
 * 1 Instalasi = 1 Kegiatan.
 * Jika Script Properties belum lengkap -> INSTALLATION_NOT_CONFIGURED -> Tampilkan pesan konfigurasi.
 * BUKAN otomatis pakai demo event.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Key,
  Database,
  Calendar,
  Building2,
  RefreshCw,
  Copy,
  Check,
  Settings,
  HelpCircle,
  ExternalLink,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface InstallationNotConfiguredScreenProps {
  onRetry: () => void;
  onOpenInstallationCenter?: () => void;
  missingProperties?: string[];
}

export const InstallationNotConfiguredScreen: React.FC<InstallationNotConfiguredScreenProps> = ({
  onRetry,
  onOpenInstallationCenter,
  missingProperties = ['SIEPANG_INSTALLATION_ID', 'SIEPANG_ACTIVE_WORKSPACE_ID', 'SIEPANG_ACTIVE_EVENT_ID', 'SPREADSHEET_ID'],
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  const scriptPropertiesList = [
    {
      key: 'SIEPANG_INSTALLATION_ID',
      label: 'ID Unik Instalasi',
      example: 'ID instalasi dari GAS',
      desc: 'Pengenal permanen instalasi SiEpang ini.',
      icon: Key,
    },
    {
      key: 'SIEPANG_ACTIVE_WORKSPACE_ID',
      label: 'ID Kwartir / Workspace',
      example: 'ID workspace dari GAS',
      desc: 'Identitas tenant penyelenggara kegiatan.',
      icon: Building2,
    },
    {
      key: 'SIEPANG_ACTIVE_EVENT_ID',
      label: 'ID Kegiatan / Event Aktif',
      example: 'ID event dari GAS',
      desc: 'Kegiatan tunggal yang dilayani oleh instalasi ini (1 Instalasi = 1 Kegiatan).',
      icon: Calendar,
    },
    {
      key: 'SPREADSHEET_ID',
      label: 'ID Google Spreadsheet',
      example: 'ID Spreadsheet/Drive dari GAS',
      desc: 'Database Spreadsheet utama penyimpan tabel canonical SiEpang.',
      icon: Database,
    },
  ];

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRetryClick = async () => {
    setIsRetrying(true);
    await onRetry();
    setTimeout(() => setIsRetrying(false), 800);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 p-4 sm:p-6 lg:p-8 selection:bg-[#F47743] selection:text-white">
      <div className="w-full max-w-3xl mx-auto space-y-6 my-auto pt-6 pb-12">
        {/* Header Hero Card */}
        <div className="rounded-[32px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-4xl shadow-lg shadow-orange-500/20 text-white">
            ⚙️
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>INSTALLATION_NOT_CONFIGURED</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight">
              Instalasi SiEpang Belum Dikonfigurasi
            </h1>

            <p className="text-xs sm:text-sm text-[#6B7280] dark:text-slate-400 leading-relaxed">
              Arsitektur SiEpang menggunakan prinsip <strong>1 Instalasi = 1 Kegiatan</strong>.
              Aplikasi belum dapat beroperasi karena <strong>Script Properties</strong> pada Google Apps Script belum lengkap. Sistem tidak menggunakan data sembarang secara otomatis.
            </p>
          </div>

          {/* Quick Actions Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={handleRetryClick}
              disabled={isRetrying}
              className="px-4 py-2.5 bg-[#171717] hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#171717] rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Memeriksa...' : 'Periksa Ulang Koneksi'}</span>
            </button>

            {onOpenInstallationCenter && (
              <button
                onClick={onOpenInstallationCenter}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[#171717] dark:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Pusat Pengaturan Instalasi</span>
              </button>
            )}
          </div>
        </div>

        {/* Required Script Properties Checklist */}
        <div className="rounded-[32px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#171717] dark:text-white uppercase tracking-wider">
                Script Properties Wajib di Google Apps Script
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Nilai authoritative yang harus disetel di <em>Project Settings → Script Properties</em>
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold border border-rose-200 dark:border-rose-900">
              Belum Lengkap ({missingProperties.length})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {scriptPropertiesList.map((item) => {
              const Icon = item.icon;
              const isMissing = missingProperties.includes(item.key);

              return (
                <div
                  key={item.key}
                  className={`p-4 rounded-2xl border transition-all ${
                    isMissing
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40'
                      : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isMissing
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-mono text-xs font-bold text-[#171717] dark:text-white">
                        {item.key}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(item.key, item.key)}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Salin nama property"
                    >
                      {copiedKey === item.key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-2">
                    {item.desc}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Contoh Nilai:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                      {item.example}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step-by-Step Configuration Guide */}
        <div className="rounded-[32px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-6 sm:p-8 shadow-xs space-y-4">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowGuide(!showGuide)}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#208C60] dark:text-pink-400" />
              <h3 className="text-sm font-bold text-[#171717] dark:text-white">
                Panduan Menyetel Script Properties di Google Apps Script
              </h3>
            </div>
            {showGuide ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {showGuide && (
            <div className="space-y-3 pt-2 text-xs text-[#6B7280] dark:text-slate-400 leading-relaxed border-t border-black/5 dark:border-white/5">
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Buka proyek backend Google Apps Script Anda di <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-[#208C60] dark:text-pink-400 font-semibold underline inline-flex items-center gap-0.5">Google Apps Script <ExternalLink className="w-3 h-3" /></a>.
                </li>
                <li>
                  Klik menu <strong>Project Settings</strong> (ikon roda gigi di bilah navigasi sebelah kiri).
                </li>
                <li>
                  Gulir ke bawah hingga bagian <strong>Script Properties</strong>, kemudian klik <strong>Add script property</strong>.
                </li>
                <li>
                  Tambahkan masing-masing properti berikut:
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                    <li><strong className="text-amber-600 dark:text-amber-400">SIEPANG_INSTALLATION_ID</strong> = ID instalasi Anda</li>
                    <li><strong className="text-amber-600 dark:text-amber-400">SIEPANG_ACTIVE_WORKSPACE_ID</strong> = ID kwartir Anda</li>
                    <li><strong className="text-amber-600 dark:text-amber-400">SIEPANG_ACTIVE_EVENT_ID</strong> = ID kegiatan perkemahan Anda</li>
                    <li><strong className="text-amber-600 dark:text-amber-400">SPREADSHEET_ID</strong> = ID Spreadsheet database</li>
                  </ul>
                </li>
                <li>
                  Klik <strong>Save script properties</strong>, lalu lakukan <strong>Deploy → Manage deployments → Edit → New version → Deploy</strong>.
                </li>
                <li>
                  Salin Web App URL hasil deployment ke konfigurasi SiEpang dan klik <strong>Periksa Ulang Koneksi</strong> di atas.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
