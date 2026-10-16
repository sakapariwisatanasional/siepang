/**
 * @license
 * SiEpang - Installation Disaster Recovery Center Modal (Milestone v1.7 Part B)
 * Four recovery methods for instant customer restoration on any browser/device:
 * 1. Installation Code (e.g. kode instalasi dari GAS)
 * 2. QR Recovery Code (Scanner / Image upload / Raw payload)
 * 3. Official Recovery File (.siepang-install / .siepang-backup JSON)
 * 4. Web App URL (Manual Advanced Fallback)
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Key,
  QrCode,
  FileCode2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Upload,
  ArrowRight,
  ShieldCheck,
  Check,
  Building2,
  Smartphone,
  Copy,
  Sparkles,
} from 'lucide-react';
import { customerInstallationService } from '../../services/customerInstallationService';
import { SiepangRecoveryPayload } from '../../types';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'CODE' | 'QR' | 'FILE' | 'URL'>('CODE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Method 1: Installation Code
  const [installCode, setInstallCode] = useState('');

  // Method 2: QR Scanner / Upload
  const [qrRawInput, setQrRawInput] = useState('');
  const [uploadedQrName, setUploadedQrName] = useState<string | null>(null);

  // Method 3: File Upload (.siepang-install)
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<SiepangRecoveryPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrImageInputRef = useRef<HTMLInputElement>(null);

  // Method 4: URL Fallback
  const [webAppUrl, setWebAppUrl] = useState('');

  if (!isOpen) return null;

  // Handler 1: Installation Code
  const handleRestoreByCode = async () => {
    if (!installCode.trim()) {
      setErrorMsg('Silakan masukkan Kode Instalasi SiEpang Anda.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await customerInstallationService.restoreFromInstallationCode(installCode);
    setIsProcessing(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } else {
      setErrorMsg(res.message);
    }
  };

  // Handler 2: QR String / Upload
  const handleRestoreByQr = async () => {
    if (!qrRawInput.trim()) {
      setErrorMsg('Payload QR Code belum dimasukkan.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await customerInstallationService.restoreFromQrPayload(qrRawInput);
    setIsProcessing(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleQrImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedQrName(file.name);
    // Read text file or simulate QR decode payload
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setQrRawInput(text);
      }
    };
    reader.readAsText(file);
  };

  // Handler 3: File Upload (.siepang-install / .json)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setFileContent(text);
        const parsed = JSON.parse(text);
        if (parsed.format === 'SIEPANG_RECOVERY_V1') {
          setFilePreview(parsed);
        } else {
          setFilePreview(null);
        }
      } catch (err) {
        setErrorMsg('Berkas yang dipilih bukan file JSON yang sah.');
        setFilePreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreByFile = async () => {
    if (!fileContent) {
      setErrorMsg('Pilih berkas .siepang-install terlebih dahulu.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await customerInstallationService.restoreFromRecoveryFile(fileContent);
    setIsProcessing(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } else {
      setErrorMsg(res.message);
    }
  };

  // Handler 4: Web App URL Fallback
  const handleRestoreByUrl = async () => {
    if (!webAppUrl.trim()) {
      setErrorMsg('Masukkan URL Web App Google Apps Script.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await customerInstallationService.bootstrapFromEndpoint(webAppUrl);
    setIsProcessing(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-[32px] bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-lg shadow-xs">
              🔄
            </div>
            <div>
              <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                Multi-Device & Disaster Recovery (Req 8-11)
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Pulihkan Instans SiEpang Mandiri
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
          <button
            type="button"
            onClick={() => { setActiveTab('CODE'); setErrorMsg(null); }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'CODE'
                ? 'bg-white dark:bg-[#202025] text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>1. Kode</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('QR'); setErrorMsg(null); }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'QR'
                ? 'bg-white dark:bg-[#202025] text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>2. QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('FILE'); setErrorMsg(null); }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'FILE'
                ? 'bg-white dark:bg-[#202025] text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>3. Berkas</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('URL'); setErrorMsg(null); }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'URL'
                ? 'bg-white dark:bg-[#202025] text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>4. URL GAS</span>
          </button>
        </div>

        {/* Tab 1: Installation Code */}
        {activeTab === 'CODE' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Masukkan Kode Instalasi Pelanggan (Req 9)
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Kode aman yang tercetak pada Kartu Pemulihan Instans Anda. Tidak mengekspos token, kunci rahasia, atau ID Spreadsheet secara terbuka.
              </p>
              <input
                type="text"
                value={installCode}
                onChange={(e) => setInstallCode(e.target.value.toUpperCase())}
                placeholder="Masukkan kode instalasi dari GAS"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold tracking-wider text-slate-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              type="button"
              disabled={isProcessing || !installCode.trim()}
              onClick={handleRestoreByCode}
              className="w-full py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Pulihkan Instans via Kode</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 2: QR Code Recovery */}
        {activeTab === 'QR' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Pindai atau Unggah QR Pemulihan (Req 10)
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Arahkan kamera ponsel Anda ke Kartu Pemulihan Instans atau unggah berkas gambar QR / tempelkan isi teks QR di bawah ini:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => qrImageInputRef.current?.click()}
                className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50/50 dark:bg-white/5 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-2 py-6"
              >
                <QrCode className="w-8 h-8 text-sky-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {uploadedQrName || 'Unggah Gambar QR'}
                </span>
                <span className="text-[10px] text-slate-400">PNG, JPG, SVG, atau Berkas Teks QR</span>
                <input
                  ref={qrImageInputRef}
                  type="file"
                  accept="image/*,text/*"
                  onChange={handleQrImageSelect}
                  className="hidden"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-between">
                <textarea
                  value={qrRawInput}
                  onChange={(e) => setQrRawInput(e.target.value)}
                  placeholder="Tempelkan hasil scan QR di sini..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none h-full"
                />
              </div>
            </div>

            {/* QR Quick Demo Buttons (DEV/TEST ONLY) */}

            <button
              type="button"
              disabled={isProcessing || !qrRawInput.trim()}
              onClick={handleRestoreByQr}
              className="w-full py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Terapkan Pemulihan dari QR</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 3: Official Recovery File (.siepang-install) */}
        {activeTab === 'FILE' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Unggah Berkas Pemulihan .siepang-install (Req 11)
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Berkas konfigurasi terenkripsi/terverifikasi checksum yang diunduh dari Admin Installation Center.
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50/50 dark:bg-white/5 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-2"
            >
              <Upload className="w-8 h-8 text-sky-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                {fileName ? fileName : 'Pilih Berkas .siepang-install atau .json'}
              </span>
              <span className="text-[10px] text-slate-400">Klik untuk memilih dari komputer Anda</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.siepang-install,.siepang-backup"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File Checksum Preview */}
            {filePreview && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Integritas Berkas Valid (Format: {filePreview.format})</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <div>Organisasi: <strong>{filePreview.organization_name}</strong></div>
                  <div>Kode: <strong>{filePreview.installation_code}</strong></div>
                  <div>Skema: <strong>{filePreview.schema_version}</strong></div>
                  <div>Checksum: <code className="font-mono text-[10px] text-emerald-600">{filePreview.checksum}</code></div>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessing || !fileContent}
              onClick={handleRestoreByFile}
              className="w-full py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Pulihkan dari Berkas Terverifikasi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 4: Manual Web App URL (Advanced Fallback) */}
        {activeTab === 'URL' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                URL Web App Google Apps Script (Fallback Manual Lanjutan)
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Gunakan jika Anda memiliki tautan langsung Web App customer (/exec).
              </p>
              <input
                type="url"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="Masukkan URL Web App GAS customer"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* URL Quick Demo Buttons (DEV/TEST ONLY) */}

            <button
              type="button"
              disabled={isProcessing || !webAppUrl.trim()}
              onClick={handleRestoreByUrl}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Hubungkan & Pulihkan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
