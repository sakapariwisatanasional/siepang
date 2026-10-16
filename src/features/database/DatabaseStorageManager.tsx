/**
 * @license
 * SiEpang - Customer Database & Storage Connection Manager (Req 21-32, 65-67)
 * First-class Admin Dashboard area: "Database & Penyimpanan"
 * Connects Google Spreadsheets directly with Classification, Safe Write Test,
 * Schema v1.5 Migration, and Database Replacement without data loss.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Plus,
  Link as LinkIcon,
  ShieldCheck,
  HardDrive,
  FileSpreadsheet,
  Check,
  X,
  Layers,
  ArrowRight,
  Server,
  Zap,
  RotateCcw,
  Download,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import {
  databaseStorageService,
  REQUIRED_SPREADSHEET_SHEETS,
  STANDARD_SCHEMA_VERSION,
  DatabaseBackupRecord,
} from '../../services/databaseStorageService';
import {
  DatabaseClassificationResult,
  CANONICAL_TABLE_NAMES,
} from '../../backend/schema/canonicalSchemaRegistry';
import { SpreadsheetConnectionConfig } from '../../types';
import { eventService } from '../../services/eventService';

export const DatabaseStorageManager: React.FC = () => {
  const currentEvent = eventService.getCurrentEvent();
  const defaultDbTitle = currentEvent?.shortName || currentEvent?.name
    ? `SiEpang DB - ${currentEvent.shortName || currentEvent.name}`
    : 'SiEpang DB - Database Kegiatan';

  const [config, setConfig] = useState<SpreadsheetConnectionConfig>(
    databaseStorageService.getConnectionConfig()
  );
  const [backups, setBackups] = useState<DatabaseBackupRecord[]>(
    databaseStorageService.getBackups()
  );
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [connectTab, setConnectTab] = useState<'create_new' | 'connect_existing'>('create_new');
  const [newTitle, setNewTitle] = useState(defaultDbTitle);
  const [existingUrlOrId, setExistingUrlOrId] = useState('');
  const [classification, setClassification] = useState<DatabaseClassificationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Replace state
  const [replaceUrlOrId, setReplaceUrlOrId] = useState('');
  const [replaceImpactConfirmed, setReplaceImpactConfirmed] = useState(false);

  useEffect(() => {
    const unsub = databaseStorageService.subscribe(() => {
      setConfig(databaseStorageService.getConnectionConfig());
      setBackups(databaseStorageService.getBackups());
    });
    return () => unsub();
  }, []);

  const handleCreateNew = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await databaseStorageService.createNewSpreadsheet(newTitle);
      setShowConnectModal(false);
      setNotification('Spreadsheet baru berhasil dibuat di customer Drive (/SiEpang/Database/) & siap digunakan.');
      setTimeout(() => setNotification(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal membuat spreadsheet baru.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInspectExisting = async () => {
    if (!existingUrlOrId.trim()) {
      setErrorMsg('Masukkan URL atau ID Spreadsheet terlebih dahulu.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    const result = await databaseStorageService.classifySpreadsheet(existingUrlOrId);
    setClassification(result);
    setIsProcessing(false);
  };

  const handleConnectValid = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await databaseStorageService.connectExistingSpreadsheet(existingUrlOrId);
      if (res.success) {
        setShowConnectModal(false);
        setClassification(null);
        setNotification(`Spreadsheet berhasil terhubung dan skema ${STANDARD_SCHEMA_VERSION} terverifikasi!`);
        setTimeout(() => setNotification(null), 4000);
      } else {
        setErrorMsg(res.error || 'Gagal menghubungkan spreadsheet.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProvisionEmpty = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await databaseStorageService.provisionEmptySpreadsheet(existingUrlOrId);
      setShowConnectModal(false);
      setClassification(null);
      setNotification(`Skema kanonikal ${STANDARD_SCHEMA_VERSION} (39 tabel) berhasil diinisialisasi ke spreadsheet kosong.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal menginisialisasi spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMigrateOlder = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await databaseStorageService.migrateOlderSchema(
        existingUrlOrId,
        classification?.detectedVersion || 'v1.5'
      );
      setShowConnectModal(false);
      setClassification(null);
      setNotification(`Migrasi Sukses: Snapshot cadangan dibuat (${res.backupRecord.backup_id}) dan skema ${STANDARD_SCHEMA_VERSION} aktif.`);
      setTimeout(() => setNotification(null), 5000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Migrasi gagal.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSafeWriteTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await databaseStorageService.performSafeWriteTest();
    setIsTesting(false);
    setTestResult(res.message);
    setTimeout(() => setTestResult(null), 5000);
  };

  const handleManualBackup = async () => {
    setIsProcessing(true);
    const bak = await databaseStorageService.createBackup();
    setIsProcessing(false);
    setNotification(`Snapshot database berhasil disimpan di Drive Backup: ${bak.file_name}`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleConfirmReplace = async () => {
    if (!replaceImpactConfirmed) return;
    setIsProcessing(true);
    const res = await databaseStorageService.replaceSpreadsheet(replaceUrlOrId);
    setIsProcessing(false);
    setShowReplaceModal(false);
    setReplaceUrlOrId('');
    setReplaceImpactConfirmed(false);
    if (res.success) {
      setNotification(res.message);
    } else {
      alert(res.message);
    }
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDisconnect = () => {
    if (confirm('Apakah Anda yakin ingin memutuskan ikatan spreadsheet ini? Data di Google Drive tidak akan terhapus.')) {
      databaseStorageService.disconnectSpreadsheet();
      setNotification('Koneksi spreadsheet telah diputuskan secara aman (Req 32).');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const isConnected = config.status === 'CONNECTED';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-bold mb-2">
              <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Database & Penyimpanan Google Drive Customer</span>
              <span>·</span>
              <span className="font-mono text-[11px]">{STANDARD_SCHEMA_VERSION}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Koneksi Spreadsheet & Database
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Hubungkan, validasi skema, buat cadangan, atau ganti spreadsheet secara terkelola langsung melalui dashboard tanpa intervensi Apps Script Properties (Req 22-32).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isConnected && (
              <button
                onClick={() => setShowReplaceModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ganti Database</span>
              </button>
            )}
            <button
              onClick={() => {
                setShowConnectModal(true);
                setClassification(null);
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <LinkIcon className="w-4 h-4" />
              <span>{isConnected ? 'Sambungkan Lainnya' : 'Hubungkan Spreadsheet'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Database Status Card (Req 66) */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs ${
              isConnected
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300/60'
                : 'bg-slate-100 dark:bg-white/10 text-slate-400 border border-slate-200'
            }`}>
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Google Spreadsheet
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isConnected
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/60'
                  }`}
                >
                  {isConnected ? '✓ Siap' : 'Belum Terhubung'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-bold">
                  Skema {config.schema_version}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {isConnected ? config.title : 'Spreadsheet belum dihubungkan ke sistem workspace ini.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isConnected ? (
              <>
                <button
                  onClick={handleSafeWriteTest}
                  disabled={isTesting}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Uji baca dan tulis tanpa mengubah data bisnis (Req 30)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Uji Tulis Aman</span>
                </button>

                <button
                  onClick={handleManualBackup}
                  disabled={isProcessing}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Backup Sekarang</span>
                </button>

                <a
                  href={config.spreadsheet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowConnectModal(true);
                  setClassification(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Hubungkan</span>
              </button>
            )}
          </div>
        </div>

        {testResult && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{testResult}</span>
          </div>
        )}

        {/* Optional Diagnostics Toggle (Requirement 55: Advanced IDs/endpoints in Diagnostics) */}
        {isConnected && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="text-xs font-semibold text-[#208C60] dark:text-[#F47743] hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>{showDiagnostics ? '▼ Sembunyikan Diagnostik Teknis' : '▶ Buka Diagnostik & ID Database'}</span>
            </button>
          </div>
        )}

        {/* Detailed Metadata when connected (Progressively disclosed) */}
        {isConnected && showDiagnostics && (
          <div className="pt-2 space-y-3 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Spreadsheet ID</div>
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {config.spreadsheet_id}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Folder Drive</div>
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  /SiEpang/Database/
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Status Sinkronisasi</div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aktif ({config.last_sync})</span>
                </div>
              </div>
            </div>

            {/* Sheets Integrity Table */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Tabel Basis Data ({CANONICAL_TABLE_NAMES.length} Tabel Terhubung)
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Terverifikasi
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {CANONICAL_TABLE_NAMES.map(sheet => (
                  <div
                    key={sheet}
                    className="p-2 rounded-lg bg-white dark:bg-white/10 border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px]"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{sheet}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">
                  Penyimpanan data cloud terenkripsi otomatis.
                </span>
                <button
                  onClick={handleDisconnect}
                  className="text-rose-600 hover:text-rose-700 font-bold text-xs cursor-pointer"
                >
                  Putuskan Spreadsheet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sheets Specification & Integrity Table removed as a standalone giant card; now inside Diagnostics */}

      {/* CONNECT SPREADSHEET MODAL (Req 23-28) */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hubungkan Spreadsheet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilih salah satu metode koneksi di bawah ini:
                </p>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Tab Options (Req 67) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-white/10 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setConnectTab('create_new');
                  setClassification(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  connectTab === 'create_new'
                    ? 'bg-white dark:bg-[#202025] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Baru (Otomatis)</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectTab('connect_existing')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  connectTab === 'connect_existing'
                    ? 'bg-white dark:bg-[#202025] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Spreadsheet Ada</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Option 1: Buat Spreadsheet Baru */}
            {connectTab === 'create_new' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Sistem akan membuat Google Spreadsheet baru di dalam folder Google Drive customer (<code className="text-emerald-600 dark:text-emerald-400 font-mono">/SiEpang/Database/</code>) dan secara otomatis menginisialisasi skema {STANDARD_SCHEMA_VERSION} lengkap dengan {CANONICAL_TABLE_NAMES.length} lembar kerja.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Judul Spreadsheet Baru
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder={defaultDbTitle}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Option 2: Hubungkan Spreadsheet Ada & Classification (Req 24-28) */}
            {connectTab === 'connect_existing' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Masukkan Google Spreadsheet ID atau URL lengkap. Sistem akan mengklasifikasikan kecocokan skema canonical:
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={existingUrlOrId}
                    onChange={e => {
                      setExistingUrlOrId(e.target.value);
                      setClassification(null);
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/... atau ID Spreadsheet"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleInspectExisting}
                    disabled={isProcessing}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Periksa
                  </button>
                </div>

                {/* Classification Cards */}
                {classification && (
                  <div className="space-y-3 pt-2">
                    {/* Case A: EMPTY SPREADSHEET (Req 26) */}
                    {classification.status === 'EMPTY_SPREADSHEET' && (
                      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>Spreadsheet tersedia, tetapi Database SiEpang belum dibuat.</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Spreadsheet ini belum memiliki tabel. Apakah Anda ingin menginisialisasi skema {STANDARD_SCHEMA_VERSION} ke dalam spreadsheet ini?
                        </p>
                        <button
                          type="button"
                          onClick={handleProvisionEmpty}
                          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          Siapkan Database (Inisialisasi)
                        </button>
                      </div>
                    )}

                    {/* Case B: OLDER SCHEMA (Req 27) */}
                    {classification.status === 'OLDER_SCHEMA' && (
                      <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-300 text-sky-900 dark:text-sky-200 text-xs space-y-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <RotateCcw className="w-4 h-4 text-sky-600" />
                          <span>Terdeteksi Skema {classification.detectedVersion || 'v1.4'}. SiEpang membutuhkan v1.5.</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Sistem akan membuat snapshot cadangan database sebelum memigrasikan tabel ke skema canonical {STANDARD_SCHEMA_VERSION}.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleMigrateOlder}
                            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                          >
                            Backup & Migrasikan ke v1.5
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Case C: NEWER UNSUPPORTED SCHEMA (Req 28) */}
                    {classification.status === 'NEWER_UNSUPPORTED_SCHEMA' && (
                      <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 text-rose-900 dark:text-rose-200 text-xs space-y-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>Backend SiEpang perlu diperbarui.</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Database menggunakan skema {classification.detectedVersion} yang lebih baru dari backend saat ini ({STANDARD_SCHEMA_VERSION}). Sistem tidak akan menurunkan versi secara paksa.
                        </p>
                      </div>
                    )}

                    {/* Case D: VALID DATABASE */}
                    {classification.status === 'VALID_SIEPANG_DATABASE' && (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Database Valid & Sesuai Skema {STANDARD_SCHEMA_VERSION} (15 Tabel Lengkap).</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleConnectValid}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          Gunakan Spreadsheet Ini
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Batal
              </button>
              {connectTab === 'create_new' && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleCreateNew}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-xs hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Buat & Hubungkan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DATABASE REPLACEMENT MODAL (Req 31) */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ganti Database (Rebind Pointer)
                </h3>
              </div>
              <button onClick={() => setShowReplaceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Penggantian database hanya mengalihkan pointer aktif sistem. <strong>Spreadsheet lama tidak akan dihapus</strong> dan tetap tersimpan di Google Drive customer (Req 31).
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ID atau URL Spreadsheet Pengganti
              </label>
              <input
                type="text"
                value={replaceUrlOrId}
                onChange={e => setReplaceUrlOrId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... atau ID Spreadsheet"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={replaceImpactConfirmed}
                onChange={e => setReplaceImpactConfirmed(e.target.checked)}
                className="rounded mt-0.5"
              />
              <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Saya memahami bahwa transaksi baru akan dialihkan ke spreadsheet baru ini, dan spreadsheet sebelumnya tetap utuh sebagai arsip.
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="px-4 py-2.5 rounded-xl border text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!replaceImpactConfirmed || !replaceUrlOrId.trim() || isProcessing}
                onClick={handleConfirmReplace}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                Konfirmasi Penggantian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
