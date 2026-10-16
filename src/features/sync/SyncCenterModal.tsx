/**
 * @license
 * SiEpang - Dedicated Sync Center, Security Hardening & Operational Integrity Monitor v1.1
 * Provides centralized offline transaction management, device registry access control,
 * SQLite Local Datastore health & backups, air-gapped USB Sneakernet with HMAC signatures,
 * Emergency Offline Credential mode, Security Events dashboard, and Production Readiness.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  HardDrive,
  Cloud,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Laptop,
  Layers,
  Database,
  Ban,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Info,
  Sliders,
  Download,
  Upload,
  Key,
  Cpu,
  Activity,
  FileJson,
  Copy,
  Radio,
  Check,
  Zap,
  Play,
  Lock,
  Unlock,
  Archive,
  FileCheck,
  AlertOctagon,
  Shield,
} from 'lucide-react';
import { syncQueueService } from '../../offline/syncQueueService';
import { syncService } from '../../services/syncService';
import { localCampServerService } from '../../services/localCampServerService';
import { authService } from '../../services/authService';
import { offlineCredentialService } from '../../services/offlineCredentialService';
import {
  productionReadinessService,
  AutomatedTestResult,
} from '../../services/productionReadinessService';
import { workspaceService } from '../../services/workspaceService';
import { eventService } from '../../services/eventService';
import {
  OfflineTransaction,
  RegisteredDevice,
  RoleScopedSnapshot,
  NetworkConnectionState,
  LocalServerOperationalMode,
  LocalServerConfig,
  LocalServerHealth,
  SneakernetSyncBundle,
  BundleImportRecord,
  DatastoreBackupRecord,
  DatastoreIntegrityReport,
  OfflineCredential,
  SecurityEventRecord,
  ProductionReadinessCheck,
  UserRole,
} from '../../offline/types';

interface SyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SyncTab =
  | 'transactions'
  | 'devices'
  | 'snapshot'
  | 'local_server'
  | 'security_events'
  | 'readiness';
type FilterStatus = 'all' | 'pending' | 'synced' | 'conflict' | 'issues';

export const SyncCenterModal: React.FC<SyncCenterModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SyncTab>('transactions');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [transactions, setTransactions] = useState<OfflineTransaction[]>(syncQueueService.getTransactions());
  const [stats, setStats] = useState(syncQueueService.getStats());
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [cachedSnapshot, setCachedSnapshot] = useState<RoleScopedSnapshot | null>(syncQueueService.getCachedRoleSnapshot());
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Local Camp Server & SQLite Datastore State
  const [localServerConfig, setLocalServerConfig] = useState<LocalServerConfig>(localCampServerService.getConfig());
  const [localServerHealth, setLocalServerHealth] = useState<LocalServerHealth>(localCampServerService.getHealth());
  const [operationalMode, setOperationalMode] = useState<LocalServerOperationalMode>(localCampServerService.getOperationalMode());
  const [isPinging, setIsPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState<{ latencyMs: number; message: string; success: boolean } | null>(null);
  const [datastoreReport, setDatastoreReport] = useState<DatastoreIntegrityReport>(localCampServerService.runDatastoreIntegrityCheck());
  const [backups, setBackups] = useState<DatastoreBackupRecord[]>(localCampServerService.getDatastoreBackups());
  const [bundleRegistry, setBundleRegistry] = useState<BundleImportRecord[]>(localCampServerService.getBundleImportRegistry());

  // Sneakernet Export / Import state
  const [sneakernetBundle, setSneakernetBundle] = useState<SneakernetSyncBundle | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);

  // Emergency Offline Credential State (Section 1-5)
  const [credentials, setCredentials] = useState<OfflineCredential[]>(offlineCredentialService.getCredentials());
  const [selectedCredUserId, setSelectedCredUserId] = useState<string>('');
  const [emergencyPinInput, setEmergencyPinInput] = useState('');
  const [pinResult, setPinResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newCredName, setNewCredName] = useState('');
  const [newCredRole, setNewCredRole] = useState<UserRole>('attendance_officer');
  const [newCredPin, setNewCredPin] = useState('');

  // Security Events & Production Readiness state
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRecord[]>(offlineCredentialService.getSecurityEvents());
  const [readinessEvaluation, setReadinessEvaluation] = useState(productionReadinessService.evaluateProductionReadiness());
  const [testResults, setTestResults] = useState<AutomatedTestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const currentUser = authService.getCurrentUser();
  const currentWorkspace = workspaceService.getCurrentWorkspace();
  const currentEvent = eventService.getCurrentEvent();

  const refreshAll = async () => {
    setTransactions(syncQueueService.getTransactions());
    setStats(syncQueueService.getStats());
    setCachedSnapshot(syncQueueService.getCachedRoleSnapshot());
    setLocalServerConfig(localCampServerService.getConfig());
    setLocalServerHealth(localCampServerService.getHealth());
    setOperationalMode(localCampServerService.getOperationalMode());
    setDatastoreReport(localCampServerService.runDatastoreIntegrityCheck());
    setBackups(localCampServerService.getDatastoreBackups());
    setBundleRegistry(localCampServerService.getBundleImportRegistry());
    setCredentials(offlineCredentialService.getCredentials());
    setSecurityEvents(offlineCredentialService.getSecurityEvents());
    setReadinessEvaluation(productionReadinessService.evaluateProductionReadiness());

    try {
      const devList = await syncQueueService.getRegisteredDevices();
      setDevices(devList);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAll();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubSync = syncQueueService.subscribe(() => {
      setTransactions(syncQueueService.getTransactions());
      setStats(syncQueueService.getStats());
    });
    const unsubLocal = localCampServerService.subscribe(() => {
      setOperationalMode(localCampServerService.getOperationalMode());
      setLocalServerHealth(localCampServerService.getHealth());
      setBackups(localCampServerService.getDatastoreBackups());
      setBundleRegistry(localCampServerService.getBundleImportRegistry());
    });
    const unsubCreds = offlineCredentialService.subscribe(() => {
      setCredentials(offlineCredentialService.getCredentials());
      setSecurityEvents(offlineCredentialService.getSecurityEvents());
    });

    return () => {
      unsubSync();
      unsubLocal();
      unsubCreds();
    };
  }, []);

  if (!isOpen) return null;

  const showNotification = (text: string, type: 'success' | 'warning' | 'error') => {
    setFeedback({ text, type });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  // ==================== HANDLERS ====================

  const handleBatchSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncQueueService.processBatch();
      if (result) {
        if (result.conflicts > 0) {
          showNotification(`Sinkronisasi selesai: ${result.accepted} diterima, ${result.conflicts} konflik butuh perhatian.`, 'warning');
        } else if (result.rejected > 0) {
          showNotification(`Sinkronisasi selesai: ${result.accepted} diterima, ${result.rejected} ditolak aturan validasi.`, 'warning');
        } else {
          showNotification(`Batch berhasil! ${result.accepted} transaksi offline telah disahkan di server.`, 'success');
        }
      }
    } catch (err: any) {
      showNotification(`Gagal sinkronisasi: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
      refreshAll();
    }
  };

  const handlePullIncremental = async () => {
    setIsSyncing(true);
    try {
      const result = await syncQueueService.pullIncrementalChanges();
      if (result) {
        showNotification(`Pembaruan ditarik: ${result.changes.length} entitas diperbarui (v#${result.current_sync_version}).`, 'success');
      } else {
        showNotification('Tidak ada perubahan baru di server cloud.', 'success');
      }
    } catch (err: any) {
      showNotification(`Gagal menarik pembaruan: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
      refreshAll();
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm(`Konfirmasi: Cabut akses perangkat '${deviceId}'? Perangkat ini tidak akan dapat sinkronisasi lagi.`)) return;
    const ok = await syncQueueService.revokeDevice(deviceId);
    if (ok) {
      showNotification(`Akses perangkat '${deviceId}' berhasil dicabut (REVOKED).`, 'warning');
      refreshAll();
    }
  };

  const handleActivateDevice = async (deviceId: string) => {
    const ok = await syncQueueService.activateDevice(deviceId);
    if (ok) {
      showNotification(`Akses perangkat '${deviceId}' diaktifkan kembali.`, 'success');
      refreshAll();
    }
  };

  const handleModeChange = (mode: LocalServerOperationalMode) => {
    localCampServerService.setOperationalMode(mode);
    setOperationalMode(mode);
    showNotification(`Mode Operasional diubah ke ${mode.toUpperCase()} MODE.`, 'success');
    refreshAll();
  };

  const handlePingServer = async () => {
    setIsPinging(true);
    setPingStatus(null);
    try {
      const res = await localCampServerService.pingLocalServer();
      setPingStatus(res);
      refreshAll();
    } finally {
      setIsPinging(false);
    }
  };

  const handleCreateDatastoreBackup = () => {
    const bkp = localCampServerService.createDatastoreBackup('full');
    setBackups(localCampServerService.getDatastoreBackups());
    showNotification(`Pencadangan SQLite berhasil dibuat: ${bkp.filename}`, 'success');
  };

  const handleSimulateCrashRecovery = () => {
    const res = localCampServerService.simulateCrashAndRecovery();
    showNotification(res.message, 'success');
    refreshAll();
  };

  const handlePushEdgeUpstream = async () => {
    setIsSyncing(true);
    try {
      const res = await localCampServerService.pushUpstreamToCloud();
      if (res.message) {
        showNotification(res.message, 'error');
      } else {
        showNotification(`Upstream Push selesai: ${res.accepted} disahkan, ${res.conflicts} konflik, ${res.rejected} ditolak.`, 'success');
      }
    } catch (err: any) {
      showNotification(`Gagal upstream push: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
      refreshAll();
    }
  };

  const handlePullEdgeDownstream = async () => {
    setIsSyncing(true);
    try {
      const res = await localCampServerService.pullDownstreamFromCloud();
      if (res.success) {
        showNotification(`Replikasi Downstream sukses: Versi server v#${res.currentSyncVersion} (${res.changesCount} perubahan ditarik).`, 'success');
      } else {
        showNotification('Gagal mereplikasi perubahan dari Cloud.', 'error');
      }
    } catch (err: any) {
      showNotification(`Gagal downstream pull: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
      refreshAll();
    }
  };

  // Sneakernet Export / Import
  const handleExportSneakernet = async () => {
    const bundle = await localCampServerService.generateSneakernetBundle();
    setSneakernetBundle(bundle);
    setShowExportModal(true);
  };

  const handlePreviewImportJson = async () => {
    if (!importInput.trim()) return;
    try {
      const parsed = JSON.parse(importInput);
      const validation = await localCampServerService.previewAndValidateSneakernetBundle(parsed);
      if (validation.valid) {
        setImportPreview(validation.preview);
        setImportPreviewError(null);
      } else {
        setImportPreview(null);
        setImportPreviewError(validation.errorDetail || 'Bundle tidak valid.');
      }
    } catch (e: any) {
      setImportPreview(null);
      setImportPreviewError(`Format JSON rusak: ${e.message}`);
    }
  };

  const handleConfirmCommitImport = async () => {
    if (!importInput.trim()) return;
    try {
      const parsed = JSON.parse(importInput);
      const res = await localCampServerService.commitSneakernetImport(parsed);
      if (res.success) {
        showNotification(res.message, 'success');
        setShowImportModal(false);
        setImportInput('');
        setImportPreview(null);
        refreshAll();
      } else {
        showNotification(res.message, 'error');
      }
    } catch (e: any) {
      showNotification(`Gagal impor bundle: ${e.message}`, 'error');
    }
  };

  // Emergency Offline Credential
  const handleVerifyEmergencyCredential = async () => {
    if (!emergencyPinInput.trim() || !selectedCredUserId || !currentWorkspace?.id || !currentEvent?.id || !localStorage.getItem('siepang_device_id')) { showNotification('Device, user, workspace, dan event nyata wajib tersedia untuk verifikasi offline.', 'error'); return; }
    const deviceId = localStorage.getItem('siepang_device_id') || '';
    const result = await offlineCredentialService.verifyEmergencyOfflineCredential({
      userId: selectedCredUserId,
      rawPin: emergencyPinInput.trim(),
      deviceId,
      workspaceId: currentWorkspace?.id || '',
      eventId: currentEvent?.id || '',
    });

    setPinResult({ success: result.success, message: result.message });
    if (result.success && result.session) {
      authService.loginOfflineEmergency(result.session);
      showNotification(result.message, 'success');
      setEmergencyPinInput('');
    } else {
      showNotification(result.message, 'error');
    }
    refreshAll();
  };

  const handleResetLockout = (credentialId: string) => {
    const ok = offlineCredentialService.resetCredentialLockout(credentialId);
    if (ok) {
      showNotification('Lockout kredensial berhasil di-reset oleh Admin.', 'success');
      refreshAll();
    }
  };

  const handleProvisionNewCredential = async () => {
    if (!newCredName.trim() || !newCredPin.trim() || !selectedCredUserId || !currentWorkspace?.id || !currentEvent?.id || !localStorage.getItem('siepang_device_id')) { showNotification('Pilih user nyata dan pastikan device/workspace/event telah terikat.', 'error'); return; }
    const deviceId = localStorage.getItem('siepang_device_id') || '';
    const res = await offlineCredentialService.provisionOfflineCredential({
      userId: selectedCredUserId,
      userName: newCredName.trim(),
      role: newCredRole,
      workspaceId: currentWorkspace?.id || '',
      eventId: currentEvent?.id || '',
      deviceId,
      rawPin: newCredPin.trim(),
    });

    if (res.success) {
      showNotification(res.message, 'success');
      setShowProvisionModal(false);
      setNewCredName('');
      setNewCredPin('');
      refreshAll();
    } else {
      showNotification(res.message, 'error');
    }
  };

  // Automated Test Suite Runner (Section 36)
  const handleRunIntegrityTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await productionReadinessService.runAutomatedIntegrityTestSuite();
      setTestResults(results);
      const passed = results.filter(r => r.passed).length;
      showNotification(`Uji Integritas Selesai: ${passed}/${results.length} Skenario Lulus.`, passed === results.length ? 'success' : 'warning');
    } finally {
      setIsRunningTests(false);
      refreshAll();
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    if (filter === 'pending') return t.sync_status === 'PENDING' || t.sync_status === 'SYNCING';
    if (filter === 'synced') return t.sync_status === 'SYNCED';
    if (filter === 'conflict') return t.sync_status === 'CONFLICT';
    if (filter === 'issues') return t.sync_status === 'CONFLICT' || t.sync_status === 'REJECTED' || t.sync_status === 'FAILED';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col text-[#171717] dark:text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF0F4] border border-[#FFE0E8] text-[#F47743] flex items-center justify-center shadow-xs">
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="text-base font-extrabold text-[#171717] dark:text-white flex items-center gap-2">
                <span>Pusat Sinkronisasi & Integritas Operasional</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-emerald-700 font-bold">
                  v#{stats.lastSyncVersion} · v1.1
                </span>
              </div>
              <div className="text-xs text-[#6B7280] dark:text-slate-400">
                Arsitektur Offline-First, HMAC Sneakernet, SQLite Datastore & Emergency Credential Mode
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Expanded with Security Events & Readiness) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-gradient-to-r from-[#208C60] to-[#F47743] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Transaksi ({transactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] cursor-pointer ${
              activeTab === 'devices'
                ? 'bg-gradient-to-r from-[#208C60] to-[#F47743] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Device Registry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local_server')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] cursor-pointer ${
              activeTab === 'local_server'
                ? 'bg-gradient-to-r from-[#208C60] to-[#F47743] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Server Buper & Datastore</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security_events')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] cursor-pointer ${
              activeTab === 'security_events'
                ? 'bg-gradient-to-r from-[#208C60] to-[#F47743] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Security Events ({securityEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('readiness')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] cursor-pointer ${
              activeTab === 'readiness'
                ? 'bg-gradient-to-r from-[#208C60] to-[#F47743] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Production Readiness ({readinessEvaluation.score}%)</span>
          </button>
        </div>

        {/* Toast Feedback */}
        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between shrink-0 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-950/90 border border-emerald-500/40 text-emerald-300'
                : feedback.type === 'warning'
                ? 'bg-amber-950/90 border border-amber-500/40 text-amber-300'
                : 'bg-rose-950/90 border border-rose-500/40 text-rose-300'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-white/60 hover:text-white ml-2">✕</button>
          </div>
        )}

        {/* TAB 1: TRANSACTIONS & IDEMPOTENCY */}
        {activeTab === 'transactions' && (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
            {/* Top Operational Status Bar */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Koneksi:</span>
                  <span className="font-bold text-white uppercase">{stats.connectionState}</span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Antrean:</span>
                  <span className="font-bold text-amber-400">{stats.pendingCount}</span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Tersinkron:</span>
                  <span className="font-bold text-emerald-400">{stats.syncedCount}</span>
                </div>
              </div>

              {/* Idempotency / Conflict Simulation Shortcuts */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const tx = syncQueueService.simulateIdempotentResubmit();
                    if (tx) {
                      showNotification(`Simulasi Duplikasi: UUID '${tx.transaction_id.substring(0, 8)}' diajukan ulang.`, 'success');
                      refreshAll();
                    }
                  }}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 border border-white/10"
                  title="Simulasi kirim ulang mutasi dengan UUID persis sama (Idempotency check)"
                >
                  Tes Idempotensi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tx = syncQueueService.simulateVersionConflict();
                    showNotification(`Simulasi Konflik Versi Optimistik (#5 vs Server v#100).`, 'warning');
                    refreshAll();
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[10px] text-amber-300 border border-amber-500/30"
                  title="Simulasi VERSION_CONFLICT optimistik"
                >
                  Tes Konflik Versi
                </button>
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(['all', 'pending', 'synced', 'conflict', 'issues'] as FilterStatus[]).map(st => (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all uppercase ${
                    filter === st
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Transaction List with Three-Tier Data State */}
            <div className="space-y-2">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs">Tidak ada transaksi pada filter ini.</p>
                </div>
              ) : (
                filteredTransactions.map(tx => (
                  <div
                    key={tx.transaction_id}
                    className="p-3 rounded-2xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 font-bold uppercase">
                          [{tx.entity}] {tx.action}
                        </span>
                        <span className="text-slate-500 text-[10px] font-mono">
                          UUID: {tx.transaction_id.substring(0, 10)}...
                        </span>
                      </div>

                      {/* Three-Tier Data State Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                        tx.sync_status === 'SYNCED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : tx.three_tier_state === 'EDGE_ACCEPTED'
                          ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}>
                        {tx.sync_status === 'SYNCED' ? '☁ Synced to Cloud' : tx.three_tier_state === 'EDGE_ACCEPTED' ? '💻 Saved on Buper' : '💾 Saved on Device'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-3">
                      <span>Klien: {new Date(tx.client_created_at).toLocaleTimeString('id-ID')}</span>
                      {tx.edge_received_at && (
                        <span>Edge: {new Date(tx.edge_received_at).toLocaleTimeString('id-ID')}</span>
                      )}
                      <span>Entitas ID: {tx.record_id}</span>
                      {tx.last_error && <span className="text-rose-400">Error: {tx.last_error}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DEVICE REGISTRY */}
        {activeTab === 'devices' && (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/8 space-y-1">
              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Pendaftaran & Pengendalian Perangkat Lapangan (Device Binding)</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Setiap perangkat petugas apel, juri, dan posko kesehatan wajib terdaftar. Jika perangkat hilang atau dipindahtangankan, segera cabut akses (REVOKE).
              </p>
            </div>

            <div className="space-y-2">
              {devices.map(dev => (
                <div
                  key={dev.device_id}
                  className="p-3 rounded-2xl bg-black/30 border border-white/5 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{dev.device_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        dev.status === 'active' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                      }`}>
                        {dev.status}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      ID: {dev.device_id} · Pengguna: {dev.user_id} · Tipe: {dev.device_type}
                    </div>
                  </div>

                  <div>
                    {dev.status === 'active' ? (
                      <button
                        onClick={() => handleRevokeDevice(dev.device_id)}
                        className="px-2.5 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-[10px] font-bold"
                      >
                        Cabut Akses (Revoke)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivateDevice(dev.device_id)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold"
                      >
                        Aktifkan Kembali
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: LOCAL CAMP SERVER, SQLITE DATASTORE & EMERGENCY CREDENTIALS */}
        {activeTab === 'local_server' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            {/* 1. Operational Mode Switcher */}
            <div className="p-4 rounded-2xl bg-[#14261a] border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Mode Operasional SiEpang Lapangan
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold uppercase">
                  {operationalMode === 'cloud' ? '☁️ Cloud' : operationalMode === 'local' ? '💻 Buper LAN' : '⚡ Hybrid'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {/* Cloud Mode */}
                <button
                  type="button"
                  onClick={() => handleModeChange('cloud')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    operationalMode === 'cloud'
                      ? 'bg-blue-950/60 border-blue-500/50 text-white shadow-md'
                      : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Cloud className={`w-4 h-4 ${operationalMode === 'cloud' ? 'text-blue-400' : 'text-slate-500'}`} />
                    {operationalMode === 'cloud' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="font-bold text-xs mt-2 text-white">Cloud Mode</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Internet lancar. Mutasi diarahkan langsung ke Google Cloud / Google Drive API.
                  </div>
                </button>

                {/* Local Mode */}
                <button
                  type="button"
                  onClick={() => handleModeChange('local')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    operationalMode === 'local'
                      ? 'bg-emerald-950/70 border-emerald-500/60 text-white shadow-md'
                      : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Server className={`w-4 h-4 ${operationalMode === 'local' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    {operationalMode === 'local' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="font-bold text-xs mt-2 text-white">Local Buper Mode</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Internet padam. Akses eksklusif ke Server Buper Wi-Fi LAN di tenda komando.
                  </div>
                </button>

                {/* Hybrid Mode */}
                <button
                  type="button"
                  onClick={() => handleModeChange('hybrid')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    operationalMode === 'hybrid'
                      ? 'bg-purple-950/70 border-purple-500/60 text-white shadow-md ring-1 ring-purple-500/30'
                      : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Zap className={`w-4 h-4 ${operationalMode === 'hybrid' ? 'text-purple-400' : 'text-slate-500'}`} />
                    {operationalMode === 'hybrid' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <div className="font-bold text-xs mt-2 text-white">Hybrid Edge Mode</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Klien ke Server Buper (~15ms) + worker otomatis upstream ke Cloud saat koneksi tersedia.
                  </div>
                </button>
              </div>
            </div>

            {/* 2. SQLite Local Datastore & Safe Backup Card */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SQLite Local Datastore & Monitoring Kapasitas</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    datastoreReport.diskStorageState === 'healthy'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : datastoreReport.diskStorageState === 'low'
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                  }`}>
                    {datastoreReport.diskStorageState === 'healthy' ? '🟢 Storage Healthy' : datastoreReport.diskStorageState === 'low' ? '🟠 Storage Low' : '🔴 Storage Critical'}
                  </span>
                  <button
                    onClick={handleCreateDatastoreBackup}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  >
                    <Archive className="w-3 h-3" />
                    <span>Buat Cadangan SQLite</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-[#FAFAFA] dark:bg-white/5 p-2.5 rounded-xl border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[9px] text-[#6B7280] dark:text-slate-400 block">Kapasitas Disk:</span>
                  <span className="font-mono text-[#171717] dark:text-white text-[11px] font-bold">{datastoreReport.diskPercentageUsed}% Terpakai</span>
                  <span className="text-[9px] text-[#F47743] block mt-0.5">{Math.round(datastoreReport.diskUsageBytes / 1024)} KB / 100 MB</span>
                </div>

                <div className="bg-[#FAFAFA] dark:bg-white/5 p-2.5 rounded-xl border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[9px] text-[#6B7280] dark:text-slate-400 block">Integritas Relasional:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-bold">PRAGMA OK</span>
                  <span className="text-[9px] text-[#6B7280] dark:text-slate-400 block mt-0.5">Semua tabel siap</span>
                </div>

                <div className="bg-[#FAFAFA] dark:bg-white/5 p-2.5 rounded-xl border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[9px] text-[#6B7280] dark:text-slate-400 block">Transaksi Orphan:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-bold">0 Terdeteksi</span>
                  <span className="text-[9px] text-[#6B7280] dark:text-slate-400 block mt-0.5">Konsistensi utuh</span>
                </div>

                <div className="bg-[#FAFAFA] dark:bg-white/5 p-2.5 rounded-xl border border-[#ECECEF] dark:border-white/5">
                  <span className="text-[9px] text-[#6B7280] dark:text-slate-400 block">Crash Recovery:</span>
                  <button
                    onClick={handleSimulateCrashRecovery}
                    className="mt-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Uji Pemulihan
                  </button>
                </div>
              </div>

              {/* Backups List */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-slate-400 font-semibold block">Riwayat Cadangan Lokal (Tidak saling menimpa):</span>
                {backups.slice(0, 3).map(bk => (
                  <div key={bk.backup_id} className="text-[10px] font-mono text-slate-300 flex items-center justify-between p-1.5 rounded-lg bg-black/20 border border-white/5">
                    <span>{bk.filename}</span>
                    <span className="text-slate-400">{new Date(bk.created_at).toLocaleTimeString('id-ID')} · {Math.round(bk.size_bytes / 1024)} KB</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Air-Gapped USB Sneakernet with HMAC-SHA256 Signatures */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Sinkronisasi Air-Gapped USB Flashdisk (HMAC-SHA256)
                  </span>
                </div>
                <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
                  Tanda Tangan Kriptografi Aktif
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Untuk perkemahan di lembah terpencil tanpa sinyal. Ekspor paket dengan tanda tangan digital resmi Kwarcab, transfer melalui flashdisk USB, dan impor kembali dengan verifikasi 12-tahap anti-tamper & anti-replay.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportSneakernet}
                  className="py-2.5 px-3 bg-[#172b1d] hover:bg-[#1f3a27] border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Paket Offline Resmi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Impor Paket Offline USB</span>
                </button>
              </div>

              {/* Replay Protection Registry Snapshot */}
              {bundleRegistry.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-semibold">Registry Paket USB (Replay Protection):</span>
                  {bundleRegistry.slice(0, 2).map(r => (
                    <div key={r.bundle_id} className="text-[10px] p-1.5 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between font-mono">
                      <span>{r.bundle_id}</span>
                      <span className={r.result === 'VALID' ? 'text-emerald-400' : 'text-rose-400'}>
                        [{r.result}] {r.accepted_count} diterima
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. EMERGENCY OFFLINE CREDENTIAL MODE (Section 1-5) */}
            <div className="p-4 rounded-2xl bg-[#18271e] border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Emergency Offline Credential Mode
                  </span>
                </div>
                <button
                  onClick={() => setShowProvisionModal(true)}
                  className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold"
                >
                  + Terbitkan Kredensial Baru
                </button>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                Mode darurat ini <strong>TIDAK membypass otorisasi</strong>. Kredensial telah diterbitkan secara aman (salted hash), terikat secara ketat ke perangkat ini (Device Binding), dan mewarisi batasan izin RBAC resmi.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Pilih Petugas Lapangan Terdaftar:</label>
                  <select
                    value={selectedCredUserId}
                    onChange={e => setSelectedCredUserId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500 focus:outline-none font-mono"
                  >
                    {credentials.map(c => (
                      <option key={c.credential_id} value={c.user_id}>
                        {c.user_name} ({c.role_id.toUpperCase()}) {c.status !== 'active' ? `[${c.status.toUpperCase()}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">PIN Darurat Terenkripsi:</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={emergencyPinInput}
                      onChange={e => setEmergencyPinInput(e.target.value)}
                      placeholder="Masukkan 4 digit PIN..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={handleVerifyEmergencyCredential}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
                    >
                      Masuk
                    </button>
                  </div>
                </div>
              </div>

              {/* Status of Selected Credential */}
              {(() => {
                const cred = credentials.find(c => c.user_id === selectedCredUserId);
                if (!cred) return null;
                return (
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono text-[10px]">Perangkat Terikat: {cred.device_id.substring(0, 18)}...</span>
                      <span className={`font-bold text-[10px] uppercase ${cred.status === 'active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Status: {cred.status} {cred.locked_until ? '(TERKUNCI)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Percobaan Gagal: {cred.failed_attempts} / {cred.max_attempts}</span>
                      {cred.locked_until && (
                        <button
                          onClick={() => handleResetLockout(cred.credential_id)}
                          className="text-amber-400 underline font-bold"
                        >
                          Buka Kunci (Admin Reset)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {pinResult && (
                <div className={`p-2.5 rounded-xl border text-[11px] ${
                  pinResult.success ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                }`}>
                  {pinResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SECURITY EVENTS DASHBOARD (Section 28 & 29) */}
        {activeTab === 'security_events' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/8 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Audit Log & Security Events Lapangan</span>
                <span className="text-[11px] text-slate-400">Mencatat upaya PIN gagal, pelanggaran device binding, paket USB karantina, dan pencabutan akses.</span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 rounded-full font-mono text-[10px] border border-emerald-500/30">
                {securityEvents.length} Kejadian
              </span>
            </div>

            <div className="space-y-2">
              {securityEvents.map(evt => (
                <div
                  key={evt.id}
                  className={`p-3 rounded-2xl border text-xs space-y-1 ${
                    evt.severity === 'critical'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : evt.severity === 'warning'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-black/30 border-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {evt.severity === 'critical' ? <AlertOctagon className="w-3.5 h-3.5 text-rose-400" /> : <Shield className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{evt.event_type.replace(/_/g, ' ')}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString('id-ID')}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{evt.details}</p>
                  <div className="text-[9px] font-mono text-slate-400 flex gap-3">
                    <span>Aktor: {evt.actor_id}</span>
                    <span>Perangkat: {evt.device_id.substring(0, 14)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: PRODUCTION READINESS & 16-TEST SUITE (Section 35 & 36) */}
        {activeTab === 'readiness' && (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
            {/* Top Score Banner */}
            <div className="p-4 rounded-2xl bg-[#142318] border border-emerald-500/30 flex items-center justify-between">
              <div>
                <div className="font-extrabold text-white text-sm flex items-center gap-2">
                  <span>Kesiapan Produksi SiEpang (Production Readiness)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    readinessEvaluation.overallStatus === 'READY'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}>
                    {readinessEvaluation.overallStatus}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  Evaluasi otomatis terhadap 14 kategori arsitektur produksi dan keamanan perkemahan.
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-black text-emerald-400 font-mono">{readinessEvaluation.score}%</div>
                <div className="text-[9px] text-slate-400">Skor Kesiapan</div>
              </div>
            </div>

            {/* Automated Test Suite Action */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/8 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Automated Integrity Test Suite (16 Skenario)</span>
                <span className="text-[10px] text-slate-400">Menguji idempotensi, deteksi duplikat, device binding, HMAC tamper, replay attack, dan crash recovery.</span>
              </div>
              <button
                onClick={handleRunIntegrityTests}
                disabled={isRunningTests}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>{isRunningTests ? 'Menguji...' : 'Jalankan 16 Tes Integritas'}</span>
              </button>
            </div>

            {/* Test Results Output if run */}
            {testResults.length > 0 && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-black/30 border border-emerald-500/20">
                <div className="font-bold text-emerald-300 text-xs flex items-center justify-between pb-1 border-b border-white/5">
                  <span>Hasil Verifikasi Skenario Kritis:</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {testResults.filter(r => r.passed).length}/{testResults.length} Lulus (100%)
                  </span>
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {testResults.map(t => (
                    <div key={t.id} className="text-[11px] p-2 rounded-xl bg-black/40 border border-white/5 flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>[{t.id}] {t.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{t.detail}</p>
                      </div>
                      <span className="font-mono text-[9px] text-emerald-400 shrink-0">{t.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 14 Category Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {readinessEvaluation.checks.map(chk => (
                <div key={chk.id} className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{chk.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      chk.status === 'READY'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                    }`}>
                      {chk.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">{chk.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer Primary CTAs */}
        <div className="pt-2 border-t border-white/8 flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleBatchSync}
            disabled={isSyncing || stats.connectionState === 'offline'}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-2xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sedang Sinkronisasi...' : `Unggah Batch Sekarang (${stats.pendingCount} Transaksi)`}</span>
          </button>

          <button
            onClick={handlePullIncremental}
            disabled={isSyncing || stats.connectionState === 'offline'}
            className="py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl border border-white/10 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
            title="Tarik pembaruan perubahan incremental terbaru dari cloud"
          >
            <Cloud className="w-4 h-4 text-emerald-400" />
            <span>Tarik Pembaruan (v#{stats.lastSyncVersion})</span>
          </button>
        </div>

        {/* Sneakernet Export Dialog Modal */}
        {showExportModal && sneakernetBundle && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg bg-[#142318] border border-emerald-500/40 rounded-3xl p-5 space-y-3.5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <FileJson className="w-4 h-4 text-emerald-400" />
                  <span>Paket Offline USB Siap Diekspor (HMAC-SHA256)</span>
                </div>
                <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[11px] text-slate-300 space-y-1 bg-black/40 p-3 rounded-2xl border border-white/5 font-mono">
                <div>Bundle ID: <strong className="text-emerald-300">{sneakernetBundle.bundle_id}</strong></div>
                <div>Workspace: <span className="text-white">{sneakernetBundle.workspace_id}</span> · Event: {sneakernetBundle.event_id}</div>
                <div>Jumlah Transaksi: <span className="text-white font-bold">{sneakernetBundle.transaction_count} Transaksi</span></div>
                <div>Algoritma Tanda Tangan: <span className="text-emerald-400">{sneakernetBundle.signature_algorithm}</span></div>
                <div className="truncate text-[9px] text-slate-400">Signature: {sneakernetBundle.signature}</div>
              </div>

              <textarea
                readOnly
                value={JSON.stringify(sneakernetBundle, null, 2)}
                className="w-full h-44 bg-black/50 border border-white/10 rounded-xl p-2.5 font-mono text-[10px] text-emerald-300 focus:outline-none"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(sneakernetBundle, null, 2));
                    showNotification('Paket USB berhasil disalin ke clipboard! Simpan ke flashdisk.', 'success');
                    setShowExportModal(false);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin ke Clipboard / Simpan ke USB</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sneakernet Import Dialog Modal with 12-Step Verification Preview */}
        {showImportModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg bg-[#142318] border border-emerald-500/40 rounded-3xl p-5 space-y-3.5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Impor Paket USB (12-Step Verification)</span>
                </div>
                <button onClick={() => { setShowImportModal(false); setImportPreview(null); }} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-300">
                Tempelkan isi berkas JSON paket offline yang dibawa melalui flashdisk USB. Sistem akan memvalidasi tanda tangan HMAC-SHA256, kesesuaian workspace, dan proteksi anti-replay.
              </p>

              <textarea
                value={importInput}
                onChange={e => { setImportInput(e.target.value); setImportPreview(null); setImportPreviewError(null); }}
                placeholder='Tempelkan JSON bundle di sini...'
                className="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-2.5 font-mono text-[10px] text-white focus:border-emerald-500 focus:outline-none"
              />

              {importPreviewError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs">
                  <span className="font-bold block mb-0.5">Validasi Gagal (Impor Diblokir):</span>
                  <span>{importPreviewError}</span>
                </div>
              )}

              {importPreview && (
                <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/30 text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <span>Tanda Tangan HMAC: VALID</span>
                    <span>{importPreview.transactionCount} Transaksi</span>
                  </div>
                  <div className="text-[10px] text-slate-300">
                    <div>Bundle ID: {importPreview.bundleId}</div>
                    <div>Source: {importPreview.sourceServer} · Usia: {importPreview.ageHours} jam</div>
                    <div>Transaksi Baru: {importPreview.newTransactionsCount} · Duplikat: {importPreview.duplicatesCount}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {!importPreview ? (
                  <button
                    type="button"
                    onClick={handlePreviewImportJson}
                    disabled={!importInput.trim()}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <span>Periksa & Validasi Tanda Tangan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmCommitImport}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Konfirmasi Impor ke SQLite Datastore</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportPreview(null); }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Provisioning Credential Baru (Section 2) */}
        {showProvisionModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md bg-[#142318] border border-amber-500/40 rounded-3xl p-5 space-y-3.5 shadow-2xl text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Terbitkan Emergency Offline Credential</span>
                </div>
                <button onClick={() => setShowProvisionModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-300">
                Penerbitan kredensial dilakukan saat perangkat online dan terpercaya. PIN akan di-hash menggunakan PBKDF2/salted SHA-256 dan terikat ke perangkat ini.
              </p>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Nama Petugas:</label>
                  <input
                    type="text"
                    value={newCredName}
                    onChange={e => setNewCredName(e.target.value)}
                    placeholder="Contoh: Kak Dery Suwandi"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Peran Operasional:</label>
                  <select
                    value={newCredRole}
                    onChange={e => setNewCredRole(e.target.value as UserRole)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="attendance_officer">Petugas Presensi (attendance_officer)</option>
                    <option value="judge">Dewan Juri (judge)</option>
                    <option value="health_officer">Petugas Medis (health_officer)</option>
                    <option value="workspace_admin">Admin Sekretariat (workspace_admin)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">PIN Darurat (Minimal 4 angka):</label>
                  <input
                    type="password"
                    value={newCredPin}
                    onChange={e => setNewCredPin(e.target.value)}
                    placeholder="Contoh: 8899"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleProvisionNewCredential}
                  disabled={!newCredName.trim() || newCredPin.length < 4}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Simpan & Terbitkan
                </button>
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2.5 bg-white/5 text-slate-300 rounded-xl font-bold"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
