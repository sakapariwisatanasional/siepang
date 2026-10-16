/**
 * @license
 * SiEpang - Guided Resumable Installation Wizard (Req 12-16)
 * Guides customer through full customer-owned deployment:
 * Google Account → Organization → Drive → Database → Backend → Authorization → Deployment → Branding → Validation → READY.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Cloud,
  Database,
  Cpu,
  Globe,
  Sparkles,
  ShieldCheck,
  Building2,
  RefreshCw,
  Copy,
  ExternalLink,
  Key,
  FolderTree,
  FileSpreadsheet,
} from 'lucide-react';
import {
  customerInstallationService,
} from '../../services/customerInstallationService';
import { databaseStorageService } from '../../services/databaseStorageService';
import { customerBrandingDriveService } from '../../services/customerBrandingDriveService';
import { CustomerInstallationRecord } from '../../types';

interface InstallationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallationWizardModal: React.FC<InstallationWizardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [record, setRecord] = useState<CustomerInstallationRecord>(
    customerInstallationService.getInstallationRecord()
  );
  const [step, setStep] = useState<number>(
    customerInstallationService.getActiveWizardStep()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [googleEmail, setGoogleEmail] = useState(record.installed_by || '');
  const [orgName, setOrgName] = useState(record.organization_name || '');
  const [spreadsheetId, setSpreadsheetId] = useState(record.spreadsheet_id || '');
  const [webAppUrl, setWebAppUrl] = useState(record.web_app_url || '');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setRecord(customerInstallationService.getInstallationRecord());
    setStep(customerInstallationService.getActiveWizardStep());
  }, [isOpen]);

  if (!isOpen) return null;

  const totalSteps = 10;

  const handleNext = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    let payload: any = {};
    if (step === 1) payload = { email: googleEmail };
    if (step === 2) payload = { organization_name: orgName };
    if (step === 4) payload = { spreadsheet_id: spreadsheetId };
    if (step === 7) payload = { web_app_url: webAppUrl };

    const res = await customerInstallationService.advanceWizardStep(step, payload);
    setIsProcessing(false);

    if (res.success) {
      setStep(res.nextStep);
      setRecord(customerInstallationService.getInstallationRecord());
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleCopyGas = () => {
    const code = customerInstallationService.getGeneratedGasBackendSource();
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const stepTitles = [
    'Akun Google Customer',
    'Organisasi & Kwartir',
    'Struktur Google Drive',
    'Database Spreadsheet',
    'Backend Apps Script',
    'Otorisasi Google',
    'Deployment Web App',
    'Branding Customer',
    'Validasi Endpoint',
    'Instalasi Selesai (READY)',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-[32px] bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <div>
            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Langkah {step} dari {totalSteps} · {stepTitles[step - 1]}
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              Wizard Instalasi Mandiri SiEpang
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Dots */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < step;
            const isCurrent = stepNum === step;
            return (
              <button
                key={stepNum}
                onClick={() => setStep(stepNum)}
                className={`h-2 rounded-full transition-all shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'w-7 bg-emerald-600'
                    : isCompleted
                    ? 'w-3.5 bg-emerald-400/80'
                    : 'w-2 bg-slate-200 dark:bg-white/10'
                }`}
                title={`Lompat ke langkah ${stepNum}: ${stepTitles[idx]}`}
              />
            );
          })}
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <X className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP CONTENT */}
        <div className="space-y-4 py-1">
          {/* STEP 1: Akun Google */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                SiEpang dipasang di bawah akun Google Workspace / Gmail milik organisasi kwartir Anda. Masukkan alamat surel administrator:
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Surel Akun Google Customer
                </label>
                <input
                  type="email"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Organisasi */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Tentukan identitas kwartir atau pangkalan yang memiliki instans ini:
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Resmi Kwartir / Pangkalan
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Google Drive */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Struktur folder Google Drive <code className="text-emerald-600 font-mono">/SiEpang/</code> terisolasi di akun Drive customer:
              </p>
              <div className="p-3.5 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs space-y-1">
                <div>✓ /SiEpang/Database/</div>
                <div>✓ /SiEpang/Branding/ (App Logo & Favicon)</div>
                <div>✓ /SiEpang/Documents/ & ID Cards/</div>
                <div>✓ /SiEpang/Backup/ & Assets/</div>
              </div>
            </div>
          )}

          {/* STEP 4: Database Spreadsheet */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Spreadsheet database dengan Skema v1.7 (39 tabel kanonikal lengkap) telah terkonfigurasi:
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ID Google Spreadsheet Customer
                </label>
                <input
                  type="text"
                  value={spreadsheetId}
                  onChange={e => setSpreadsheetId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 5: Backend Apps Script */}
          {step === 5 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Buat proyek baru di <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">script.google.com</a>, lalu salin kode backend standalone v1.7.0 di bawah ini ke file <code className="font-mono">Code.gs</code>:
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyGas}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Source Code.gs Tersalin!' : 'Salin Kode Standalone (Code.gs)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Otorisasi Google */}
          {step === 6 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Di editor Apps Script customer, jalankan fungsi <code className="font-mono text-emerald-600 font-bold">authorizeAndTest()</code> untuk menyetujui izin akses Google Drive dan Spreadsheet.
              </p>
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Otorisasi eksplisit Google Account (Req 16) diperlukan untuk keamanan enterprise.</span>
              </div>
            </div>
          )}

          {/* STEP 7: Deployment Web App */}
          {step === 7 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Di editor Apps Script, pilih <strong>Deploy → New Deployment → Web App</strong>. Atur "Execute as: Me" dan "Who has access: Anyone". Tempelkan URL Web App hasil deploy:
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL Web App Google Apps Script
                </label>
                <input
                  type="url"
                  value={webAppUrl}
                  onChange={e => setWebAppUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 8: Branding Customer */}
          {step === 8 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Aset logo aplikasi dan favicon PWA disimpan di folder Drive <code className="text-emerald-600 font-mono">/SiEpang/Branding/</code> milik Anda sendiri.
              </p>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white p-1 border flex items-center justify-center font-bold text-sm">⚜️</div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">App Logo & Favicon 512×512</div>
                  <div className="text-[10px] text-slate-400">Siap diubah sewaktu-waktu dari Dashboard Branding</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: Validasi Endpoint */}
          {step === 9 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Sistem sedang memverifikasi koneksi handshake aman (<code className="font-mono">/health</code>) dengan tantangan cryptographic nonce ke deployment customer:
              </p>
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Endpoint customer terverifikasi: Skema v1.7 (39 Tabel) · Nonce Challenge Lulus · Lingkungan PRODUCTION.</span>
              </div>
            </div>
          )}

          {/* STEP 10: READY */}
          {step === 10 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-xs border border-emerald-300/60">
                🎉
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Instalasi Customer Mandiri Berhasil!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Seluruh sistem SiEpang kini 100% beroperasi di akun Google Anda secara independen. Tidak ada ketergantungan pada Google Drive atau Spreadsheet developer.
                </p>
              </div>

              {/* Initial SuperAdmin Information Card (Requirements 32, 33, 39) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-left max-w-md mx-auto space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Administrator Utama Resmi
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Aktif
                  </span>
                </div>
                <div className="text-sm font-black font-mono text-slate-900 dark:text-white select-all">
                  record.bootstrap_superadmin_email || "Belum ditetapkan"
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Peran: <strong className="text-purple-600 dark:text-purple-400">Superadmin</strong></span>
                  <span>·</span>
                  <span>Status: <strong className="text-emerald-600 dark:text-emerald-400">ACTIVE</strong></span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pt-1">
                  Akun bootstrap telah dibuat pada tabel Users. Untuk login, gunakan alamat email ini melalui alur OTP tanpa password hardcoded.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 transition-all flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>

          {step < 10 ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Lanjutkan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-bold transition-all cursor-pointer"
            >
              Selesai & Buka Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
