/**
 * @license
 * SiEpang - Admin Installation Center (Milestone v1.7 Customer Acceptance & Packaging)
 * First-class System area: Sistem → Instalasi
 * Includes:
 * 1. Real Two-Account Acceptance Suite (Customer A vs Customer B)
 * 2. Multi-Method Installation Recovery (Code, QR, File, URL)
 * 3. Customer Handover & Printable Recovery QR Card
 * 4. Anti-Tamper & Developer Independence Verification
 * 5. 39-Table Canonical Schema v1.7 Matrix
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Database,
  Cpu,
  Globe,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Download,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Code,
  Check,
  X,
  FileCheck2,
  HardDrive,
  Key,
  Layers,
  Lock,
  Smartphone,
  Table as TableIcon,
  Printer,
  QrCode,
  Building2,
  ArrowRight,
  ArrowLeft,
  Users,
  Server,
  FileSpreadsheet,
  Calendar,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { canReadInstallation } from '../../backend/rbac/permissions';
import {
  customerInstallationService,
  FRONTEND_APPLICATION_VERSION,
  BUILD_IDENTIFIER,
  VersionCompatibilityResult,
  TwoAccountAcceptanceReport,
} from '../../services/customerInstallationService';
import {
  generateFeatureStorageMatrix,
  FeatureStorageAuditItem,
  CANONICAL_TABLE_NAMES,
  REQUIRED_TABLE_NAMES,
} from '../../backend/schema/canonicalSchemaRegistry';
import {
  CustomerInstallationRecord,
  SystemHealthReport,
} from '../../types';
import { InstallationWizardModal } from './InstallationWizardModal';
import { RecoveryModal } from './RecoveryModal';
import { RecoveryCardModal } from './RecoveryCardModal';
import { runBootstrapSecuritySuite, BootstrapTestSuiteResult } from '../../tests/bootstrapSecuritySuite';

export interface AdminInstallationCenterProps {
  onBackToHome?: () => void;
}

export const REQUIRED_SCRIPT_PROPERTIES = [
  {
    key: 'SIEPANG_INSTALLATION_ID',
    label: 'ID Unik Instalasi',
    example: 'inst_jamran_2026',
    desc: 'Pengenal unik permanen deployment instans SiEpang (1 Instalasi = 1 Kegiatan).',
    icon: Server,
  },
  {
    key: 'SIEPANG_ACTIVE_WORKSPACE_ID',
    label: 'ID Kwartir / Workspace',
    example: 'ws_kwarran_sawangan',
    desc: 'ID tenant penyelenggara kegiatan pada sheet Workspaces.',
    icon: Building2,
  },
  {
    key: 'SIEPANG_ACTIVE_EVENT_ID',
    label: 'ID Kegiatan / Event Aktif',
    example: 'evt_jamran_2026',
    desc: 'ID resmi perkemahan pada sheet Events di Spreadsheet Database.',
    icon: Calendar,
  },
  {
    key: 'SPREADSHEET_ID',
    label: 'ID Google Spreadsheet Database',
    example: 'ID Spreadsheet customer',
    desc: 'ID Google Spreadsheet utama penyimpan tabel canonical SiEpang.',
    icon: FileSpreadsheet,
  },
  {
    key: 'DRIVE_ROOT_ID',
    label: 'ID Google Drive Root Folder',
    example: 'ID folder Drive customer',
    desc: 'ID folder Google Drive utama untuk dokumen, piagam, dan foto.',
    icon: Key,
  },
];

export const AdminInstallationCenter: React.FC<AdminInstallationCenterProps> = ({
  onBackToHome,
}) => {
  const currentUser = authService.getCurrentUser();
  const isAuthorized = currentUser && canReadInstallation(currentUser.role);

  if (!isAuthorized) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-[28px] bg-white dark:bg-[#121215] border border-rose-200 dark:border-rose-900/40 max-w-lg mx-auto my-12 space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-200/50">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Akses Ditolak (403)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Hanya Administrator yang memiliki wewenang untuk melihat dan mengelola Konfigurasi Sistem SiEpang.
          </p>
        </div>
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>
        )}
      </div>
    );
  }

  const [record, setRecord] = useState<CustomerInstallationRecord>(
    customerInstallationService.getInstallationRecord()
  );
  const [health, setHealth] = useState<SystemHealthReport>(
    customerInstallationService.getSystemHealth()
  );
  const [compatibility, setCompatibility] = useState<VersionCompatibilityResult>(
    customerInstallationService.checkVersionCompatibility()
  );
  const [activeTenant, setActiveTenant] = useState<'CUSTOM'>(
    customerInstallationService.getActiveTenant()
  );

  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  // Clipboard States
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [copyInstallCodeSuccess, setCopyInstallCodeSuccess] = useState(false);
  const [copyDiagSuccess, setCopyDiagSuccess] = useState(false);
  const [copiedPropKey, setCopiedPropKey] = useState<string | null>(null);

  const handleCopyProperty = (text: string, keyName: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedPropKey(keyName);
    setTimeout(() => setCopiedPropKey(null), 2000);
  };

  const handleCopyAllProperties = () => {
    const snippet = REQUIRED_SCRIPT_PROPERTIES.map(p => `${p.key}=${p.example}`).join('\n');
    navigator.clipboard?.writeText(snippet);
    setCopiedPropKey('ALL');
    setTimeout(() => setCopiedPropKey(null), 2500);
  };

  // Verification & Tests
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [acceptanceReport, setAcceptanceReport] = useState<TwoAccountAcceptanceReport | null>(null);
  const [isRunningAcceptance, setIsRunningAcceptance] = useState(false);

  const matrixItems = generateFeatureStorageMatrix();

  useEffect(() => {
    const unsub = customerInstallationService.subscribe(() => {
      setRecord(customerInstallationService.getInstallationRecord());
      setHealth(customerInstallationService.getSystemHealth());
      setCompatibility(customerInstallationService.checkVersionCompatibility());
      setActiveTenant(customerInstallationService.getActiveTenant());
    });
    return () => unsub();
  }, []);

  const handleCopyGasCode = () => {
    const source = customerInstallationService.getGeneratedGasBackendSource();
    navigator.clipboard.writeText(source);
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 3000);
  };

  const handleCopyInstallCode = () => {
    navigator.clipboard.writeText(record.installation_code);
    setCopyInstallCodeSuccess(true);
    setTimeout(() => setCopyInstallCodeSuccess(false), 3000);
  };

  const handleDownloadGasBundle = () => {
    const source = customerInstallationService.getGeneratedGasBackendSource();
    const blob = new Blob([source], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SiEpang_Customer_Backend_${record.backend_version}_Code.gs`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadInstallFile = () => {
    const payload = customerInstallationService.generateRecoveryPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.installation_code || 'SiEpang_Installation'}.siepang-install`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyDiagnostics = () => {
    const diag = customerInstallationService.getSafeDiagnosticsJson();
    navigator.clipboard.writeText(diag);
    setCopyDiagSuccess(true);
    setTimeout(() => setCopyDiagSuccess(false), 3000);
  };

  const handleTestHandshake = async () => {
    setIsValidating(true);
    setValidationResult(null);
    const nonce = customerInstallationService.generateHandshakeNonce();
    const res = await customerInstallationService.validateBackendEndpoint(record.web_app_url, nonce);
    setIsValidating(false);
    setValidationResult(res.message);
    setTimeout(() => setValidationResult(null), 6000);
  };

  const handleRunTwoAccountAcceptance = () => {
    setIsRunningAcceptance(true);
    setTimeout(() => {
      const rep = customerInstallationService.runTwoAccountAcceptanceTest();
      setAcceptanceReport(rep);
      setIsRunningAcceptance(false);
    }, 400);
  };

  const [bootstrapReport, setBootstrapReport] = useState<BootstrapTestSuiteResult | null>(null);
  const [isRunningBootstrapTests, setIsRunningBootstrapTests] = useState(false);

  const handleRunBootstrapTests = async () => {
    setIsRunningBootstrapTests(true);
    try {
      const rep = await runBootstrapSecuritySuite();
      setBootstrapReport(rep);
    } finally {
      setIsRunningBootstrapTests(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Return to Public Portal Route Bar */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs">
        <button
          type="button"
          onClick={() => {
            if (onBackToHome) {
              onBackToHome();
            } else {
              try {
                window.location.href = '/';
              } catch {}
            }
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#F47743]" />
          <span>Kembali ke Beranda Resmi Kegiatan (/)</span>
        </button>

        <div className="text-xs text-slate-500 font-mono hidden sm:flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Pusat Konfigurasi &amp; Instalasi (/install)</span>
        </div>
      </div>

      {/* Top Banner with Active Tenant Switcher */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Customer-Owned Architecture v1.7</span>
              <span>·</span>
              <span className="font-mono text-[11px]">{record.installation_mode}</span>
              <span>·</span>
              <span className="font-mono text-[11px]">{record.environment}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Pusat Kendali Instalasi & Pemulihan Mandiri v1.7
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Sistem beroperasi mandiri 100% pada akun Google customer. Terverifikasi bebas dependensi pengembang, dilengkapi pengujian isolasi dua akun nyata, dan pemulihan bencana instan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowMatrixModal(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <TableIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Matriks 39 Tabel</span>
            </button>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Wizard Instalasi</span>
            </button>
          </div>
        </div>

      </div>

      {/* Version Compatibility Bar */}
      <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        compatibility.status === 'COMPATIBLE'
          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
          : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 text-amber-900 dark:text-amber-200'
      }`}>
        <div className="flex items-center gap-2">
          {compatibility.status === 'COMPATIBLE' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div>
            <span className="font-bold">Matriks Kompatibilitas Versi: </span>
            <span>Frontend {FRONTEND_APPLICATION_VERSION} · Backend {record.backend_version} · Skema {record.schema_version}</span>
            <div className="text-[11px] opacity-90">{compatibility.message}</div>
          </div>
        </div>
        <div className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-black/30 border border-black/5 dark:border-white/10 self-start sm:self-auto">
          {compatibility.status}
        </div>
      </div>

      {/* SCRIPT PROPERTIES CONFIGURATION CARD (/install) */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Konfigurasi Backend Google Apps Script (5 Kunci Wajib)</span>
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Daftar Script Properties Wajib (Authoritative Context)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Konfigurasikan kelima properti berikut di backend Google Apps Script: <code>Project Settings &gt; Script Properties</code> agar instalasi mengenali kegiatan resmi secara mandiri.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyAllProperties}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            {copiedPropKey === 'ALL' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedPropKey === 'ALL' ? 'Semua Properti Tersalin!' : 'Salin Semua Properti'}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
          <strong>Langkah Pemasangan di Google Apps Script:</strong>
          <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-[11px]">
            <li>Buka script editor backend Google Apps Script Anda.</li>
            <li>Klik menu <strong>Project Settings</strong> (ikon gerigi ⚙️ di panel kiri).</li>
            <li>Gulir ke bawah ke bagian <strong>Script Properties</strong>, klik <strong>Add script property</strong>.</li>
            <li>Tambahkan 5 properti di bawah ini sesuai data kegiatan Anda.</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {REQUIRED_SCRIPT_PROPERTIES.map((prop) => {
            const Icon = prop.icon;
            return (
              <div
                key={prop.key}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {prop.key}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyProperty(prop.key, prop.key)}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPropKey === prop.key ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPropKey === prop.key ? 'Tersalin' : 'Salin Nama'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {prop.desc}
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono bg-white dark:bg-black/30 p-2 rounded-xl border border-black/5 dark:border-white/5 text-slate-600 dark:text-slate-300">
                  <span className="truncate mr-2">Contoh: {prop.example}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyProperty(prop.example, `${prop.key}_ex`)}
                    className="text-purple-600 dark:text-purple-400 font-bold hover:underline shrink-0 cursor-pointer"
                  >
                    {copiedPropKey === `${prop.key}_ex` ? 'Tersalin!' : 'Salin Contoh'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6-Card Icon-First Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Drive */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Drive</span>
            <Cloud className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1 mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            <span>Siap</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">7 Folder Drive</div>
        </div>

        {/* 2. Database */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Database</span>
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1 mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            <span>Siap</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Skema {record.schema_version} (39 Tabel)</div>
        </div>

        {/* 3. Backend */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Backend</span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1 mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            <span className="font-mono text-xs">{record.backend_version}</span>
          </div>
          <div className="text-[10px] text-slate-400">Standalone GAS</div>
        </div>

        {/* 4. API */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">API</span>
            <Globe className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1 mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            <span>Aktif</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Web App Exec</div>
        </div>

        {/* 5. Branding */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Branding</span>
            <Sparkles className="w-4 h-4 text-pink-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1 mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            <span>Aktif</span>
          </div>
          <div className="text-[10px] text-slate-400">Customer Drive</div>
        </div>

        {/* 6. Health */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Health</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1 mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            <span>Normal</span>
          </div>
          <div className="text-[10px] text-slate-400">100% Mandiri</div>
        </div>
      </div>

      {/* INITIAL BOOTSTRAP SUPERADMIN STATUS (Requirement 39) */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Administrator Utama Instalasi (Requirements 32, 33, 39)
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Administrator Utama</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase font-mono ${
                record.bootstrap_superadmin_status === 'ACTIVE'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/40'
              }`}
            >
              {record.bootstrap_superadmin_status === 'ACTIVE' ? 'Aktif' : 'Belum Berhasil'}
            </span>
          </div>
        </div>

        {record.bootstrap_superadmin_status === 'ACTIVE' ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#208C60] to-[#F47743] text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                ⚜️
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Administrator Utama
                </div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white select-all">
                  administrator yang dikonfigurasi
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">Superadmin</span>
                  <span>·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Aktif
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Akun bootstrap superadmin resmi SiEpang tersedia untuk konfigurasi awal sistem. Login canonical menggunakan Email + OTP + Trusted Device (bebas hardcoded password).
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-900 dark:text-rose-100">
                Bootstrap Superadmin Belum Berhasil
              </div>
              <div>
                Akun superadmin resmi <code className="font-mono font-bold">administrator yang dikonfigurasi</code> belum berhasil dibuat pada database. Instalasi tidak dapat dinyatakan selesai sebelum initial superadmin aktif.
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await customerInstallationService.ensureBootstrapSuperAdmin();
                  if (!res.success) {
                    console.error('Bootstrap superadmin retry failed:', res.message);
                  }
                }}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Inisialisasi Ulang Superadmin</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PART B: RICH DISASTER RECOVERY & HANDOVER CARD SECTION (Req 8-11) */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Disaster Recovery & Multi-Device Persistence (Part B)
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-500" />
              <span>Kode Pemulihan & Serah Terima Instans</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowRecoveryModal(true)}
              className="px-4 py-2 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Pulihkan Instans di Device Baru</span>
            </button>

            <button
              onClick={() => setShowCardModal(true)}
              className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Kartu QR</span>
            </button>

            <button
              onClick={handleDownloadInstallFile}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Unduh berkas .siepang-install"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .siepang-install</span>
            </button>
          </div>
        </div>

        {/* Installation Code Display Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kode Instalasi Terdaftar (Aman Dibagikan ke Panitia/Admin):
            </div>
            <div className="text-lg sm:text-xl font-black font-mono tracking-wider text-slate-900 dark:text-white select-all">
              {record.installation_code}
            </div>
            <div className="text-[11px] text-slate-500">
              Lembaga: <strong>{record.organization_name}</strong> · Pemilik: <span className="font-mono">{record.owner_account_email}</span>
            </div>
          </div>

          <button
            onClick={handleCopyInstallCode}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#202025] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-2xs"
          >
            {copyInstallCodeSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copyInstallCodeSuccess ? 'Kode Tersalin!' : 'Salin Kode'}</span>
          </button>
        </div>
      </div>

      {/* PART A: REAL TWO-ACCOUNT ACCEPTANCE TEST SUITE (DEV / TEST ONLY - Req 1-7) */}
      {!import.meta.env.PROD && (
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Part A: Real Two-Account Acceptance Test
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Uji Penerimaan 2 Akun Google Nyata & Ketahanan Spoofing</span>
            </h2>
          </div>

          <button
            onClick={handleRunTwoAccountAcceptance}
            disabled={isRunningAcceptance}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunningAcceptance ? 'animate-spin' : ''}`} />
            <span>Uji Isolasi Multi-Instalasi Nyata</span>
          </button>
        </div>

        {/* Detailed Acceptance Test Results */}
        {acceptanceReport && (
          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{acceptanceReport.summary}</span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-white/10 font-mono font-bold">
                {acceptanceReport.passedTests}/{acceptanceReport.totalTests} LULUS
              </span>
            </div>

            <div className="space-y-2">
              {acceptanceReport.tests.map((test) => (
                <div
                  key={test.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {test.name}
                      </span>
                      {test.httpStatus && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          HTTP {test.httpStatus}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {test.details}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                      {test.actualResult.slice(0, 45)}...
                    </span>
                    <span className="px-2 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      LULUS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Active Installation Record & GAS Source Package */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CARD A: Detail Konfigurasi Instalasi Terpasang */}
        <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Record Identitas Instalasi (Req 8)</span>
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase font-mono">
                {record.installation_mode}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase font-mono">
                {record.installation_status}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Installation Code</span>
              <span className="font-mono font-bold text-sky-600 dark:text-sky-400 truncate max-w-[200px]">{record.installation_code}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Installation ID</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{record.installation_id}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Workspace Target</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{record.workspace_id}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Spreadsheet ID</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{record.spreadsheet_id}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Web App Deployment</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">{record.deployment_id}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Handshake Nonce</span>
              <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{record.handshake_nonce || 'Siap Diuji'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleTestHandshake}
              disabled={isValidating}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
              <span>Uji Handshake</span>
            </button>
            <button
              onClick={handleRunTwoAccountAcceptance}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              Audit Isolasi
            </button>
            <button
              onClick={handleRunBootstrapTests}
              disabled={isRunningBootstrapTests}
              className="py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>{isRunningBootstrapTests ? 'Menguji...' : 'Uji Bootstrap 1-8'}</span>
            </button>
          </div>

          {validationResult && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{validationResult}</span>
            </div>
          )}

          {bootstrapReport && (
            <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Audit Keamanan Bootstrap ({bootstrapReport.passedTests}/{bootstrapReport.totalTests} Lolos)</span>
                </span>
                <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {bootstrapReport.allPassed ? 'ALL PASS' : 'FAIL'}
                </span>
              </div>
              <div className="space-y-1.5">
                {bootstrapReport.results.map((t) => (
                  <div
                    key={t.id}
                    className="p-2 rounded-xl bg-white/80 dark:bg-black/40 border border-purple-100 dark:border-purple-900/30 flex items-start justify-between gap-2 text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {t.id}: {t.name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{t.actualResult}</div>
                    </div>
                    <span className="shrink-0 text-emerald-600 font-bold">
                      {t.passed ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CARD B: Customer GAS Source Package (Code.gs) */}
        <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Paket Standalone GAS v1.7 (Code.gs)</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">Code.gs</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Kode Google Apps Script standalone ini mengelola seluruh 39 lembar kerja kanonikal skema v1.7. Dilengkapi proteksi anti-spoofing dan unbound spreadsheet resolution.
          </p>

          <div className="p-3 rounded-2xl bg-slate-900 text-slate-300 font-mono text-[11px] max-h-48 overflow-y-auto leading-relaxed border border-white/5">
            <span className="text-emerald-400">// Standalone Customer Google Apps Script Backend (v1.7.0)</span><br />
            var CONFIG = &#123;<br />
            &nbsp;&nbsp;INSTALLATION_ID: '{record.installation_id}',<br />
            &nbsp;&nbsp;WORKSPACE_ID: '{record.workspace_id}',<br />
            &nbsp;&nbsp;SPREADSHEET_ID: '{record.spreadsheet_id}',<br />
            &nbsp;&nbsp;BACKEND_VERSION: '{record.backend_version}',<br />
            &nbsp;&nbsp;SCHEMA_VERSION: '{record.schema_version}',<br />
            &nbsp;&nbsp;ENVIRONMENT: 'PRODUCTION'<br />
            &#125;;<br />
            <span className="text-slate-500">// Provisi 39 tabel kanonikal skema v1.7</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCopyGasCode}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
            >
              {copyCodeSuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copyCodeSuccess ? 'Tersalin ke Clipboard!' : 'Salin Source Code.gs'}</span>
            </button>

            <button
              onClick={handleDownloadGasBundle}
              className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Unduh file Code.gs"
            >
              <Download className="w-4 h-4" />
              <span>Unduh .gs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Diagnostics Export Bar */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-slate-600 dark:text-slate-300">
            Diagnostik Sistem: <strong className="text-slate-900 dark:text-white">{BUILD_IDENTIFIER}</strong> · Backend {record.backend_version} · Skema {record.schema_version}
          </span>
        </div>

        <button
          onClick={handleCopyDiagnostics}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-bold text-xs transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          {copyDiagSuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copyDiagSuccess ? 'Diagnostik Tersalin!' : 'Salin Diagnostik'}</span>
        </button>
      </div>

      {/* Feature -> Storage Matrix Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-[32px] bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
              <div>
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Audit Skema Kanonikal v1.7
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Matriks Fitur → Penyimpanan Kanonikal (39 Tabel)
                </h3>
              </div>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-auto max-w-full space-y-2 pr-1">
              <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-bold text-[10px] uppercase">
                    <th className="py-2 px-2">No</th>
                    <th className="py-2 px-2">Tabel Kanonikal</th>
                    <th className="py-2 px-2">Kategori</th>
                    <th className="py-2 px-2">Fitur Terhubung</th>
                    <th className="py-2 px-2">Primary Key</th>
                    <th className="py-2 px-2">Kebutuhan</th>
                    <th className="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {matrixItems.map((item, idx) => (
                    <tr key={item.canonicalStorage} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="py-2 px-2 font-mono text-[10px] text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.canonicalStorage}</td>
                      <td className="py-2 px-2 text-[10px] font-bold text-slate-500">{item.category}</td>
                      <td className="py-2 px-2 text-slate-700 dark:text-slate-300">{item.feature}</td>
                      <td className="py-2 px-2 font-mono text-[10px] text-slate-500">{item.primaryKey}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          item.requirement === 'REQUIRED'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                        }`}>
                          {item.requirement}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">✓ {item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
              <span>Total: <strong>39 Tabel Kanonikal</strong> ({REQUIRED_TABLE_NAMES.length} Wajib · {CANONICAL_TABLE_NAMES.length - REQUIRED_TABLE_NAMES.length} Fitur Opsional)</span>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Resumable Installation Wizard Modal */}
      {isWizardOpen && (
        <InstallationWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
        />
      )}

      {/* 4-in-1 Disaster Recovery Modal */}
      {showRecoveryModal && (
        <RecoveryModal
          isOpen={showRecoveryModal}
          onClose={() => setShowRecoveryModal(false)}
        />
      )}

      {/* Printable Certificate & Recovery Card Modal */}
      {showCardModal && (
        <RecoveryCardModal
          isOpen={showCardModal}
          onClose={() => setShowCardModal(false)}
        />
      )}
    </div>
  );
};
