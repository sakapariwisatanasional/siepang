/**
 * @license
 * SiEpang - Customer Drive Branding & Asset Manager (Req 51-64)
 * Admin Dashboard: Pengaturan → Branding → Logo Aplikasi & Favicon
 * Light-theme first, icon-first UI with immediate validation, preview, and drive folder architecture.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  Upload,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Layers,
  Eye,
  Info,
  Check,
  X,
  FileCheck,
} from 'lucide-react';
import {
  customerBrandingDriveService,
} from '../../services/customerBrandingDriveService';
import {
  CustomerBrandingAsset,
  BrandingAssetType,
  CustomerDriveFolderStructure,
  BrandingValidationResult,
  BrandingHealthReport,
} from '../../types';

export const AdminBrandingManager: React.FC = () => {
  const [folderStructure, setFolderStructure] = useState<CustomerDriveFolderStructure>(
    customerBrandingDriveService.getFolderStructure()
  );
  const [health, setHealth] = useState<BrandingHealthReport>(
    customerBrandingDriveService.getBrandingHealth()
  );
  const [activeLogo, setActiveLogo] = useState<CustomerBrandingAsset | null>(
    customerBrandingDriveService.getActiveAsset('APP_LOGO')
  );
  const [activeFavicon, setActiveFavicon] = useState<CustomerBrandingAsset | null>(
    customerBrandingDriveService.getActiveAsset('FAVICON')
  );
  const [allAssets, setAllAssets] = useState<CustomerBrandingAsset[]>(
    customerBrandingDriveService.getBrandingAssets()
  );
  const [brandingVersion, setBrandingVersion] = useState<number>(
    customerBrandingDriveService.getBrandingVersion()
  );

  // Modal / Form state for Ganti Logo or Favicon
  const [modalType, setModalType] = useState<BrandingAssetType | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [inputFileName, setInputFileName] = useState('');
  const [validationResult, setValidationResult] = useState<BrandingValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const unsub = customerBrandingDriveService.subscribe(() => {
      setFolderStructure(customerBrandingDriveService.getFolderStructure());
      setHealth(customerBrandingDriveService.getBrandingHealth());
      setActiveLogo(customerBrandingDriveService.getActiveAsset('APP_LOGO'));
      setActiveFavicon(customerBrandingDriveService.getActiveAsset('FAVICON'));
      setAllAssets(customerBrandingDriveService.getBrandingAssets());
      setBrandingVersion(customerBrandingDriveService.getBrandingVersion());
    });
    return () => unsub();
  }, []);

  const openReplaceModal = (type: BrandingAssetType) => {
    setModalType(type);
    setInputUrl('');
    setInputFileName(type === 'APP_LOGO' ? 'Logo_SiEpang_Baru.png' : 'Favicon_512x512.png');
    setValidationResult(null);
  };

  const handleUrlChange = async (url: string) => {
    setInputUrl(url);
    if (!url.trim()) {
      setValidationResult(null);
      return;
    }

    if (modalType) {
      setIsValidating(true);
      const res = await customerBrandingDriveService.validateBrandingFile(url, modalType);
      setValidationResult(res);
      setIsValidating(false);
    }
  };

  const handleSaveAsset = async () => {
    if (!modalType || !inputUrl.trim() || !validationResult?.valid) return;

    await customerBrandingDriveService.uploadBrandingAsset({
      workspace_id: 'ws_banyuwangi',
      asset_type: modalType,
      file_name: inputFileName.trim() || `${modalType.toLowerCase()}_asset.png`,
      mime_type: 'image/png',
      public_render_url: inputUrl.trim(),
      dimensions: validationResult.dimensions,
    });

    setModalType(null);
    setNotification(
      `${modalType === 'APP_LOGO' ? 'Logo Aplikasi' : 'Favicon'} berhasil diperbarui ke Google Drive customer (v${brandingVersion + 1}).`
    );
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSelectExisting = (asset: CustomerBrandingAsset) => {
    customerBrandingDriveService.setActiveAsset(asset.branding_asset_id);
    setNotification(`${asset.file_name} diaktifkan sebagai aset utama.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRestoreDefault = (type: BrandingAssetType) => {
    customerBrandingDriveService.restoreDefaultAsset(type);
    setNotification(`Standar default ${type === 'APP_LOGO' ? 'Logo Aplikasi' : 'Favicon'} dipulihkan.`);
    setTimeout(() => setNotification(null), 3000);
  };

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

      {/* Header Card */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200/60 dark:border-red-800/40 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-red-700 dark:text-red-300" />
              <span>Branding & Identitas Customer Drive</span>
              <span>·</span>
              <span className="font-mono text-[11px]">v{brandingVersion}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Logo Aplikasi & Favicon PWA
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Seluruh aset visual disimpan di Google Drive milik customer sendiri (<code className="text-red-700 dark:text-red-300 font-mono">/SiEpang/Branding/</code>) tanpa memerlukan pengeditan kode sumber.
            </p>
          </div>

          <button
            onClick={() => setShowFolderModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <FolderTree className="w-4 h-4 text-red-700 dark:text-red-300" />
            <span>Struktur Folder Drive</span>
          </button>
        </div>

        {/* Priority Hierarchy Banner (Req 59) */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-2 font-medium">
          <span className="font-bold text-slate-900 dark:text-white">Hierarki Prioritas:</span>
          <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 font-semibold">1. Event Branding</span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-slate-200 font-semibold">2. Workspace Branding</span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-slate-200 font-semibold">3. Installation Branding</span>
          <span>→</span>
          <span className="text-slate-400">4. SiEpang Default</span>
        </div>
      </div>

      {/* System Health Card (Req 62) */}
      <div className="p-4 sm:p-5 rounded-[24px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              System Health · Branding
            </h2>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              health.status === 'HEALTHY'
                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60'
                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300/60'
            }`}
          >
            {health.status === 'HEALTHY' ? '✓ Sehat' : '! Periksa Asset'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${health.appLogo.ok ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 text-rose-600'}`}>
              {health.appLogo.ok ? '✓' : '!'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white">App Logo</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{health.appLogo.message}</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${health.favicon.ok ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 text-rose-600'}`}>
              {health.favicon.ok ? '✓' : '!'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Favicon (512x512)</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{health.favicon.message}</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${health.driveAccess.ok ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 text-rose-600'}`}>
              {health.driveAccess.ok ? '✓' : '!'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Drive Access</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{health.driveAccess.message}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Cards: Logo Aplikasi (Req 53) & Favicon (Req 56) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CARD 1: Logo Aplikasi */}
        <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-red-700 dark:text-red-300" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Logo Aplikasi
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
              {activeLogo ? 'Status: Aktif' : 'Standar Default'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Digunakan pada header aplikasi, kartu identitas, dan beranda publik. Disimpan di folder customer: <code className="text-red-700 dark:text-red-300 font-mono">/SiEpang/Branding/App Logo/</code>.
          </p>

          {/* Logo Preview Container (Req 60) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-2 min-h-[140px]">
            <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-xs border border-slate-200/60 flex items-center justify-center overflow-hidden">
              {activeLogo?.public_render_url ? (
                <img
                  src={activeLogo.public_render_url}
                  alt="Logo Aplikasi SiEpang"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-3xl">⚜️</span>
              )}
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {activeLogo?.file_name || 'Logo_Pramuka_Kwarnas.png'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {activeLogo?.dimensions ? `${activeLogo.dimensions.width}×${activeLogo.dimensions.height} px` : 'Vector HD'} · Drive ID: {activeLogo?.drive_file_id || 'Canonical'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => openReplaceModal('APP_LOGO')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#A61B1B] to-[#C62828] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Ganti Logo</span>
            </button>
            <button
              onClick={() => handleRestoreDefault('APP_LOGO')}
              className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Kembalikan ke logo standar Pramuka"
            >
              Default
            </button>
          </div>
        </div>

        {/* CARD 2: Favicon PWA */}
        <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-700 dark:text-red-300" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Favicon Browser & PWA
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
              {activeFavicon ? 'Status: Aktif' : 'Standar Default'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Ikon tab peramban, shortcut layar utama ponsel (PWA), dan bookmark. Disimpan di folder: <code className="text-red-700 dark:text-red-300 font-mono">/SiEpang/Branding/Favicon/</code>.
          </p>

          {/* Favicon Preview Container (Req 60) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-2 min-h-[140px]">
            <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-xs border border-slate-200/60 flex items-center justify-center overflow-hidden">
              {activeFavicon?.public_render_url ? (
                <img
                  src={activeFavicon.public_render_url}
                  alt="Favicon PWA"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-2xl">🏕️</span>
              )}
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {activeFavicon?.file_name || 'Favicon_SiEpang_512.png'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {activeFavicon?.dimensions ? `${activeFavicon.dimensions.width}×${activeFavicon.dimensions.height} px (1:1)` : '512×512 px'} · Drive ID: {activeFavicon?.drive_file_id || 'Canonical'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => openReplaceModal('FAVICON')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#A61B1B] to-[#C62828] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Ganti Favicon</span>
            </button>
            <button
              onClick={() => handleRestoreDefault('FAVICON')}
              className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Kembalikan ke favicon standar SiEpang"
            >
              Default
            </button>
          </div>
        </div>
      </div>

      {/* Available Assets in Customer Drive Table */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-red-700 dark:text-red-300" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Koleksi Aset di Google Drive Customer
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {allAssets.length} file terdaftar
          </span>
        </div>

        <div className="space-y-2">
          {allAssets.map(asset => {
            const isActive = asset.status === 'ACTIVE';
            return (
              <div
                key={asset.branding_asset_id}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-300/80 dark:border-red-800/40 shadow-xs'
                    : 'bg-slate-50/50 dark:bg-white/5 border-slate-200/60 dark:border-white/5 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white p-1 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={asset.public_render_url}
                      alt={asset.file_name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {asset.file_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                        {asset.asset_type === 'APP_LOGO' ? 'Logo' : 'Favicon'}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                      Drive File ID: {asset.drive_file_id} · v{asset.version}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!isActive && (
                    <button
                      onClick={() => handleSelectExisting(asset)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-bold transition-all"
                    >
                      Aktifkan
                    </button>
                  )}
                  <a
                    href={asset.public_render_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    title="Buka asset"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REPLACE / UPLOAD MODAL (Req 53, 56, 61) */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {modalType === 'APP_LOGO' ? 'Ganti Logo Aplikasi' : 'Ganti Favicon PWA'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Aset akan disimpan di folder Drive: <code className="text-red-700 dark:text-red-300 font-mono">/SiEpang/Branding/{modalType === 'APP_LOGO' ? 'App Logo' : 'Favicon'}/</code>
                </p>
              </div>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama File di Drive
                </label>
                <input
                  type="text"
                  value={inputFileName}
                  onChange={e => setInputFileName(e.target.value)}
                  placeholder="Contoh: Logo_Kwarcab_Banyuwangi_2026.png"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL Gambar (Google Drive Direct / CDN HTTPS)
                </label>
                <input
                  type="url"
                  value={inputUrl}
                  onChange={e => handleUrlChange(e.target.value)}
                  placeholder="https://drive.google.com/uc?id=... atau https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Validation Feedback & Preview (Req 61) */}
              {isValidating && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Memvalidasi resolusi gambar dan akses file…</span>
                </div>
              )}

              {validationResult && !isValidating && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                    validationResult.valid
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300/80 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300/80 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {validationResult.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{validationResult.valid ? 'Gambar Valid & Terverifikasi' : 'Validasi Gagal'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{validationResult.message}</p>

                  {validationResult.warnings && validationResult.warnings.length > 0 && (
                    <div className="p-2 rounded-xl bg-amber-100/60 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] space-y-1">
                      {validationResult.warnings.map((warn, i) => (
                        <div key={i} className="flex items-start gap-1">
                          <span>⚠️</span>
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {validationResult.valid && (
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white p-1 border border-emerald-300 flex items-center justify-center shrink-0">
                        <img
                          src={customerBrandingDriveService.getRenderableImageUrl(inputUrl)}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-[11px]">
                        <div>Dimensi: <strong>{validationResult.dimensions?.width}×{validationResult.dimensions?.height} px</strong></div>
                        <div>Format: <strong>PNG / Auto-Optimized</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!validationResult?.valid}
                onClick={handleSaveAsset}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A61B1B] to-[#C62828] text-white text-xs font-bold shadow-xs hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                Simpan & Aktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLDER STRUCTURE MODAL (Req 51-52) */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-red-700 dark:text-red-300" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Struktur Folder Google Drive Customer
                </h3>
              </div>
              <button onClick={() => setShowFolderModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Arsitektur folder standar SiEpang di Google Drive milik organisasi customer. Folder ini terisolasi dan tidak mengekspos isi internal ke publik sembarangan (Req 64).
            </p>

            <div className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs space-y-1.5 overflow-x-auto leading-relaxed shadow-inner">
              <div className="text-white font-bold">SiEpang/</div>
              <div>├── Database/ <span className="text-slate-500">({folderStructure.database_folder_id})</span></div>
              <div>├── Branding/ <span className="text-slate-500">({folderStructure.branding_folder_id})</span></div>
              <div>│   ├── App Logo/ <span className="text-slate-500">({folderStructure.app_logo_folder_id})</span></div>
              <div>│   ├── Favicon/ <span className="text-slate-500">({folderStructure.favicon_folder_id})</span></div>
              <div>│   ├── Event Logo/ <span className="text-slate-500">({folderStructure.event_logo_folder_id})</span></div>
              <div>│   └── Hero/ <span className="text-slate-500">({folderStructure.hero_folder_id})</span></div>
              <div>├── Documents/ <span className="text-slate-500">({folderStructure.documents_folder_id})</span></div>
              <div>├── Certificates/ <span className="text-slate-500">({folderStructure.certificates_folder_id})</span></div>
              <div>├── ID Cards/ <span className="text-slate-500">({folderStructure.id_cards_folder_id})</span></div>
              <div>├── Backup/ <span className="text-slate-500">({folderStructure.backup_folder_id})</span></div>
              <div>└── Assets/ <span className="text-slate-500">({folderStructure.assets_folder_id})</span></div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-bold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
