/**
 * @license
 * SiEpang - Canonical Feature Control Service & FeatureResolver (Sections 21-35)
 * Hierarchical resolution: SYSTEM -> WORKSPACE -> EVENT -> DEPENDENCIES -> EFFECTIVE STATE
 * Lower levels cannot override parent locks.
 * Never deletes underlying data when features are toggled off.
 */

import { SystemFeatureKey, FeatureScope, FeatureDefinition } from '../types';
import { apiTransport } from './apiTransport';
import { eventService } from './eventService';
import { workspaceService } from './workspaceService';
import {
  spreadsheetRepository,
  FeatureConfigRecord,
} from '../backend/repositories/spreadsheetRepository';

export const CANONICAL_FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // 1. Registrasi & Kontingen
  {
    key: 'REGISTRATION',
    name: 'Pendaftaran Peserta',
    category: 'Registrasi & Kontingen',
    icon: 'UserPlus',
    description: 'Pendaftaran mandiri peserta, pendamping, dan pembina kontingen.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'PARTICIPANT_MANAGEMENT',
    name: 'Kelola Peserta',
    category: 'Registrasi & Kontingen',
    icon: 'Users',
    description: 'Manajemen biodata, kontingen ranting, dan penetapan regu.',
    dependencies: ['REGISTRATION'],
    defaultEnabled: true,
  },
  {
    key: 'PARTICIPANT_VERIFICATION',
    name: 'Verifikasi Berkas',
    category: 'Registrasi & Kontingen',
    icon: 'ShieldCheck',
    description: 'Validasi surat tugas kwartir, surat izin ortu, dan asuransi.',
    dependencies: ['PARTICIPANT_MANAGEMENT'],
    defaultEnabled: true,
  },
  {
    key: 'CONTINGENT_MANAGEMENT',
    name: 'Manajemen Kontingen',
    category: 'Registrasi & Kontingen',
    icon: 'Layers',
    description: 'Pengelompokan pangkalan sekolah, kwarran, dan pimpinan kontingen.',
    dependencies: ['REGISTRATION'],
    defaultEnabled: true,
  },

  // 2. Kegiatan & Jadwal
  {
    key: 'SCHEDULE',
    name: 'Jadwal & Agenda',
    category: 'Kegiatan & Jadwal',
    icon: 'Calendar',
    description: 'Kalender giat harian, alokasi waktu lapangan, dan info materi.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'ACTIVITY_MANAGEMENT',
    name: 'Manajemen Giat',
    category: 'Kegiatan & Jadwal',
    icon: 'Compass',
    description: 'Rincian instruktur, pos kegiatan, dan syarat kecakapan giat.',
    dependencies: ['SCHEDULE'],
    defaultEnabled: true,
  },
  {
    key: 'CHECK_IN',
    name: 'Kedatangan (Check-In)',
    category: 'Kegiatan & Jadwal',
    icon: 'LogIn',
    description: 'Registrasi ulang kedatangan kontingen di pos registrasi utama.',
    dependencies: ['REGISTRATION'],
    defaultEnabled: true,
  },
  {
    key: 'ATTENDANCE',
    name: 'Presensi Lapangan',
    category: 'Kegiatan & Jadwal',
    icon: 'CheckCircle2',
    description: 'Perekaman kehadiran peserta dalam apel pembukaan dan giat materi.',
    dependencies: ['SCHEDULE'],
    defaultEnabled: true,
  },
  {
    key: 'ACTIVITY_QR',
    name: 'QR Kegiatan',
    category: 'Kegiatan & Jadwal',
    icon: 'QrCode',
    description: 'Kode QR unik per jadwal kegiatan untuk scan presensi peserta.',
    dependencies: ['SCHEDULE'], // Section 35: does NOT require POINTS_XP
    defaultEnabled: true,
  },
  {
    key: 'QR_CHECKPOINT',
    name: 'Pos QR Rimba',
    category: 'Kegiatan & Jadwal',
    icon: 'MapPin',
    description: 'Titik pos penjelajahan alam dengan QR statis berpassword sandi.',
    dependencies: ['SCHEDULE'],
    defaultEnabled: true,
  },

  // 3. Tata Ruang
  {
    key: 'CAMPSITE',
    name: 'Kavling Buper',
    category: 'Fasilitas & Penunjang',
    icon: 'Tent',
    description: 'Alokasi tapak kemah putra/putri, zona MCK, dan denah interaktif.',
    dependencies: [],
    defaultEnabled: true,
  },

  // 4. Lomba & Penjurian
  {
    key: 'COMPETITION',
    name: 'Giat Prestasi / Lomba',
    category: 'Lomba & Penjurian',
    icon: 'Trophy',
    description: 'Kompetisi keterampilan kepramukaan (pioneering, semboyan, yel-yel).',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'JUDGING',
    name: 'Penjurian Digital',
    category: 'Lomba & Penjurian',
    icon: 'Scale',
    description: 'Penginputan nilai juri berbasis rubrik terstandar 100% dan kunci skor.',
    dependencies: ['COMPETITION'],
    defaultEnabled: true,
  },
  {
    key: 'DIGITAL_SUBMISSION',
    name: 'Unggah Karya Digital',
    category: 'Lomba & Penjurian',
    icon: 'UploadCloud',
    description: 'Pengumpulan tautan video TikTok/Reels atau poster regu.',
    dependencies: ['COMPETITION'],
    defaultEnabled: true,
  },
  {
    key: 'COMPETITION_GALLERY',
    name: 'Galeri Karya Lomba',
    category: 'Lomba & Penjurian',
    icon: 'LayoutGrid',
    description: 'Display karya video, artikel, dan foto lomba untuk dinilai juri.',
    dependencies: ['COMPETITION'],
    defaultEnabled: true,
  },
  {
    key: 'VOTING',
    name: 'Voting Karya Publik',
    category: 'Lomba & Penjurian',
    icon: 'Heart',
    description: 'Polling online apresiasi regu terfavorit oleh umum dan peserta.',
    dependencies: ['COMPETITION'],
    defaultEnabled: true,
  },

  // 5. Poin & Prestasi
  {
    key: 'POINTS_XP',
    name: 'Poin & Gamifikasi XP',
    category: 'Poin & Prestasi',
    icon: 'Zap',
    description: 'Mesin perhitungan XP keaktifan giat dan apresiasi sesama peserta.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'BADGES',
    name: 'Lencana / Badges',
    category: 'Poin & Prestasi',
    icon: 'Award',
    description: 'Koleksi tanda penghargaan digital atas pencapaian milestone kemah.',
    dependencies: ['POINTS_XP'],
    defaultEnabled: true,
  },
  {
    key: 'PARTICIPANT_LEADERBOARD',
    name: 'Peringkat Peserta',
    category: 'Poin & Prestasi',
    icon: 'BarChart3',
    description: 'Klasemen individu peserta teraktif dengan raihan XP tertinggi.',
    dependencies: ['POINTS_XP'],
    defaultEnabled: true,
  },
  {
    key: 'CONTINGENT_LEADERBOARD',
    name: 'Peringkat Kontingen',
    category: 'Poin & Prestasi',
    icon: 'Medal',
    description: 'Klasemen regu dan kontingen tergiat dengan normalisasi adil.',
    dependencies: ['POINTS_XP'],
    defaultEnabled: true,
  },

  // 6. Kunjungan & Tamu
  {
    key: 'VISITOR_MANAGEMENT',
    name: 'Manajemen Pengunjung',
    category: 'Kunjungan & Tamu',
    icon: 'UserCheck',
    description: 'Monitoring kuota besuk harian orang tua, pembina, dan tamu umum.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'VISITOR_REGISTRATION',
    name: 'Registrasi Tiket Tamu',
    category: 'Kunjungan & Tamu',
    icon: 'Ticket',
    description: 'Pendaftaran visitor pass online dengan tiket QR digital instan.',
    dependencies: ['VISITOR_MANAGEMENT'],
    defaultEnabled: true,
  },
  {
    key: 'VISITOR_GATE',
    name: 'Pemindai Gerbang Tamu',
    category: 'Kunjungan & Tamu',
    icon: 'ScanLine',
    description: 'Validasi tiket masuk dan keluar pos gerbang buper oleh petugas.',
    dependencies: ['VISITOR_MANAGEMENT'],
    defaultEnabled: true,
  },

  // 7. Publikasi & Media
  {
    key: 'PUBLIC_EVENT_PAGE',
    name: 'Portal Publik Acara',
    category: 'Publikasi & Media',
    icon: 'Globe',
    description: 'Laman microsite perkemahan terbuka untuk umum tanpa wajib login.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'PUBLIC_DOCUMENTATION',
    name: 'Galeri Dokumentasi',
    category: 'Publikasi & Media',
    icon: 'Images',
    description: 'Pusat publikasi foto dan video resmi liputan giat perkemahan.',
    dependencies: ['PUBLIC_EVENT_PAGE'],
    defaultEnabled: true,
  },
  {
    key: 'PHOTO_DOCUMENTATION',
    name: 'Dokumentasi Foto',
    category: 'Publikasi & Media',
    icon: 'Image',
    description: 'Album foto perkemahan tersinkronisasi otomatis dengan Google Drive.',
    dependencies: ['PUBLIC_DOCUMENTATION'],
    defaultEnabled: true,
  },
  {
    key: 'VIDEO_DOCUMENTATION',
    name: 'Video Highlight',
    category: 'Publikasi & Media',
    icon: 'Film',
    description: 'Koleksi video apel pembukaan, pensi, dan siaran api unggun.',
    dependencies: ['PUBLIC_DOCUMENTATION'],
    defaultEnabled: true,
  },
  {
    key: 'HERO_BANNER',
    name: 'Hero Banner Rotator',
    category: 'Publikasi & Media',
    icon: 'Sparkles',
    description: 'Rotator banner 970×250 promosi tema acara di halaman beranda.',
    dependencies: ['PUBLIC_EVENT_PAGE'],
    defaultEnabled: true,
  },
  {
    key: 'INFORMATION_BANNER',
    name: 'Banner Pengumuman',
    category: 'Publikasi & Media',
    icon: 'Bell',
    description: 'Banner pengumuman darurat, jam besuk, dan info cuaca lapangan.',
    dependencies: ['PUBLIC_EVENT_PAGE'],
    defaultEnabled: true,
  },
  {
    key: 'SPONSOR_DISPLAY',
    name: 'Carousel Sponsor',
    category: 'Publikasi & Media',
    icon: 'HeartHandshake',
    description: 'Running logo marquee mitra pendukung resmi perkemahan.',
    dependencies: ['PUBLIC_EVENT_PAGE'],
    defaultEnabled: true,
  },
  {
    key: 'ANNOUNCEMENTS',
    name: 'Warta Buper',
    category: 'Publikasi & Media',
    icon: 'Megaphone',
    description: 'Pemberitahuan resmi panitia kepada seluruh kontingen.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'PUBLIC_CONTACTS',
    name: 'Kontak Darurat Publik',
    category: 'Publikasi & Media',
    icon: 'PhoneCall',
    description: 'Daftar nomor posko kesehatan, sekretariat, dan pengaduan buper.',
    dependencies: ['PUBLIC_EVENT_PAGE'],
    defaultEnabled: true,
  },

  // 8. Dokumen & Sertifikat
  {
    key: 'ID_CARD',
    name: 'ID Card Digital',
    category: 'Fasilitas & Penunjang',
    icon: 'Contact',
    description: 'Kartu tanda peserta dan panitia dengan QR digital berdesain kustom.',
    dependencies: ['REGISTRATION'],
    defaultEnabled: true,
  },
  {
    key: 'CERTIFICATE',
    name: 'E-Sertifikat / Piagam',
    category: 'Fasilitas & Penunjang',
    icon: 'FileCheck2',
    description: 'Penerbitan piagam penghargaan otomatis dengan nomor seri kwartir.',
    dependencies: ['REGISTRATION'],
    defaultEnabled: true,
  },
  {
    key: 'CERTIFICATE_VERIFICATION',
    name: 'Verifikasi Keaslian Piagam',
    category: 'Fasilitas & Penunjang',
    icon: 'SearchCheck',
    description: 'Pemindaian kode verifikasi sertifikat untuk memeriksa keaslian.',
    dependencies: ['CERTIFICATE'],
    defaultEnabled: true,
  },
  {
    key: 'DOCUMENT_TEMPLATE_STUDIO',
    name: 'Studio Desain Dokumen & ID Card',
    category: 'Fasilitas & Penunjang',
    icon: 'LayoutTemplate',
    description: 'Editor visual dokumen (ID Card, Piagam, Sertifikat, Surat Tugas) drag & drop Canva-like.',
    dependencies: ['ID_CARD'],
    defaultEnabled: true,
  },

  // 9. Medis & Logistik
  {
    key: 'HEALTH',
    name: 'Posko Medis & Triase',
    category: 'Fasilitas & Penunjang',
    icon: 'Stethoscope',
    description: 'Pencatatan rawat jalan peserta, alergi, dan riwayat rujukan RS.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'INCIDENT',
    name: 'Pelaporan Insiden',
    category: 'Fasilitas & Penunjang',
    icon: 'AlertOctagon',
    description: 'Pencatatan laporan kehilangan, evakuasi cuaca, dan insiden buper.',
    dependencies: ['HEALTH'],
    defaultEnabled: true,
  },
  {
    key: 'LOGISTICS',
    name: 'Logistik & Sarpras',
    category: 'Fasilitas & Penunjang',
    icon: 'Package',
    description: 'Peminjaman dan pengembalian sarana tenda, tongkat, dan kelistrikan.',
    dependencies: [],
    defaultEnabled: true,
  },

  // 10. Sistem & Operasional
  {
    key: 'BACKUP',
    name: 'Cadangan Data (Backup)',
    category: 'Sistem & Operasional',
    icon: 'Database',
    description: 'Ekspor database lokal, snapshot spreadsheet, dan arsip berkas.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'SYSTEM_HEALTH',
    name: 'Kesehatan Sistem Buper',
    category: 'Sistem & Operasional',
    icon: 'Activity',
    description: 'Pemantauan latensi sinkronisasi, memori peramban, dan service worker.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'AUDIT',
    name: 'Log Audit Keamanan',
    category: 'Sistem & Operasional',
    icon: 'Shield',
    description: 'Perekaman jejak digital seluruh aksi staf untuk kepatuhan enterprise.',
    dependencies: [],
    defaultEnabled: true,
  },
  {
    key: 'SYNC',
    name: 'Sinkronisasi Offline',
    category: 'Sistem & Operasional',
    icon: 'RefreshCw',
    description: 'Mesin sinkronisasi IndexedDB dua arah saat koneksi internet pulih.',
    dependencies: [],
    defaultEnabled: true,
  },
];

export interface FeatureStateRecord {
  enabled: boolean;
  lockedBy?: 'SYSTEM' | 'WORKSPACE';
  lockReason?: string;
  updatedAt: string;
}

class FeatureControlService {
  // Layer 1: System-wide feature states (Super Admin managed)
  private systemStates: Map<SystemFeatureKey, FeatureStateRecord> = new Map();

  // Layer 2: Workspace-level feature states (Admin Daerah managed)
  private workspaceStates: Map<string, Map<SystemFeatureKey, FeatureStateRecord>> = new Map();

  // Layer 3: Event-level feature states (Event Admin managed)
  private eventStates: Map<string, Map<SystemFeatureKey, FeatureStateRecord>> = new Map();

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultFeatureStates();
    // Browser data must never override the authoritative Spreadsheet.
  }

  /** Reload one scope from GAS. Called after login and before editing settings. */
  public async refreshFromSpreadsheet(scopeType: 'SYSTEM' | 'WORKSPACE' | 'EVENT' = 'EVENT'): Promise<void> {
    const response = await apiTransport.send<{ items: FeatureConfigRecord[]; scope_id: string }>(
      'feature.control.list', { scope_type: scopeType }
    );
    if (!response.ok || !response.data || !Array.isArray(response.data.items)) {
      throw new Error(response.error?.message || 'Tidak dapat membaca FeatureConfigs dari Spreadsheet.');
    }
    const scopeId = String(response.data.scope_id || '');
    if (!scopeId) throw new Error('GAS tidak mengembalikan scope_id yang valid.');
    const next = new Map<SystemFeatureKey, FeatureStateRecord>();
    for (const rec of response.data.items) {
      if (rec.scope_type !== scopeType || rec.scope_id !== scopeId) continue;
      if (rec.configured_state !== 'ENABLED' && rec.configured_state !== 'DISABLED') continue;
      next.set(rec.feature_key as SystemFeatureKey, {
        enabled: rec.configured_state === 'ENABLED', updatedAt: rec.updated_at,
      });
    }
    if (scopeType === 'SYSTEM') {
      this.seedDefaultFeatureStates();
      next.forEach((v, k) => this.systemStates.set(k, v));
    } else if (scopeType === 'WORKSPACE') this.workspaceStates.set(scopeId, next);
    else this.eventStates.set(scopeId, next);
    this.notify();
  }

  /** Read all three layers. Failed reads must be surfaced, not silently cached. */
  public async refreshAllFromSpreadsheet(): Promise<void> {
    for (const scope of ['SYSTEM', 'WORKSPACE', 'EVENT'] as const) {
      await this.refreshFromSpreadsheet(scope);
    }
  }

  private async saveFeatureToSpreadsheet(
    scope_type: 'SYSTEM' | 'WORKSPACE' | 'EVENT',
    key: SystemFeatureKey,
    enabled: boolean,
    scopeId?: string,
  ): Promise<boolean> {
    const payload: Record<string, string> = {
      scope_type, feature_key: key, configured_state: enabled ? 'ENABLED' : 'DISABLED',
    };
    if (scopeId) payload.scope_id = scopeId;
    const response = await apiTransport.send<{ saved: boolean; record: FeatureConfigRecord }>(
      'feature.control.set', payload
    );
    if (!response.ok || !response.data?.saved || !response.data.record) {
      throw new Error(response.error?.message || 'GAS belum mengonfirmasi penyimpanan Feature Control.');
    }
    const row = response.data.record;
    if (row.feature_key !== key || row.scope_type !== scope_type ||
        row.configured_state !== payload.configured_state ||
        (scopeId && row.scope_id !== scopeId)) {
      throw new Error('Data verifikasi GAS tidak sesuai permintaan penyimpanan.');
    }
    await this.refreshFromSpreadsheet(scope_type);
    return row.configured_state === 'ENABLED';
  }

  private seedDefaultFeatureStates(): void {
    CANONICAL_FEATURE_DEFINITIONS.forEach(def => {
      this.systemStates.set(def.key, {
        enabled: def.defaultEnabled,
        updatedAt: '',
      });
    });
  }

  // ==================== HIERARCHICAL RESOLUTION (Section 22 & 23) ====================

  /**
   * Resolves the effective feature state taking into account:
   * System State -> Workspace State -> Event State -> Dependencies
   */
  public isFeatureEnabled(
    key: SystemFeatureKey,
    eventId = eventService.getCurrentEvent().id,
    workspaceId = workspaceService.getCurrentWorkspace().id
  ): boolean {
    const detail = this.resolveFeatureDetail(key, eventId, workspaceId);
    return detail.effectiveEnabled;
  }

  public resolveFeatureDetail(
    key: SystemFeatureKey,
    eventId = eventService.getCurrentEvent().id,
    workspaceId = workspaceService.getCurrentWorkspace().id
  ): {
    key: SystemFeatureKey;
    definition: FeatureDefinition;
    effectiveEnabled: boolean;
    isLocked: boolean;
    lockedBy?: 'SYSTEM' | 'WORKSPACE';
    lockReason?: string;
    missingDependencies: SystemFeatureKey[];
    usedBy: FeatureDefinition[];
  } {
    const def =
      CANONICAL_FEATURE_DEFINITIONS.find(d => d.key === key) || {
        key,
        name: key,
        category: 'Sistem & Operasional' as const,
        icon: 'Sliders',
        description: '',
        dependencies: [],
        defaultEnabled: true,
      };

    // 1. Check System Level
    const sysState = this.systemStates.get(key);
    if (sysState && !sysState.enabled) {
      return {
        key,
        definition: def,
        effectiveEnabled: false,
        isLocked: true,
        lockedBy: 'SYSTEM',
        lockReason: 'Dikunci oleh Super Admin (Tingkat Sistem)',
        missingDependencies: [],
        usedBy: this.findDependents(key),
      };
    }

    // 2. Check Workspace Level
    const wsMap = this.workspaceStates.get(workspaceId);
    const wsState = wsMap?.get(key);
    if (wsState && !wsState.enabled) {
      return {
        key,
        definition: def,
        effectiveEnabled: false,
        isLocked: true,
        lockedBy: 'WORKSPACE',
        lockReason: 'Dikunci oleh Workspace (Admin Daerah)',
        missingDependencies: [],
        usedBy: this.findDependents(key),
      };
    }

    // 3. Check Event Level
    const evMap = this.eventStates.get(eventId);
    const evState = evMap?.get(key);
    const eventEnabled = evState !== undefined ? evState.enabled : def.defaultEnabled;

    if (!eventEnabled) {
      return {
        key,
        definition: def,
        effectiveEnabled: false,
        isLocked: false,
        missingDependencies: [],
        usedBy: this.findDependents(key),
      };
    }

    // 4. Check Dependencies (Section 35)
    const missingDeps: SystemFeatureKey[] = [];
    for (const depKey of def.dependencies) {
      if (!this.isFeatureEnabled(depKey, eventId, workspaceId)) {
        missingDeps.push(depKey);
      }
    }

    const effective = eventEnabled && missingDeps.length === 0;

    return {
      key,
      definition: def,
      effectiveEnabled: effective,
      isLocked: false,
      missingDependencies: missingDeps,
      usedBy: this.findDependents(key),
    };
  }

  private findDependents(parentKey: SystemFeatureKey): FeatureDefinition[] {
    return CANONICAL_FEATURE_DEFINITIONS.filter(d => d.dependencies.includes(parentKey));
  }

  // ==================== STATE MUTATIONS (Section 28 & 34) ====================

  /**
   * Toggles feature at event scope without deleting existing records
   */
  public async toggleEventFeature(
    key: SystemFeatureKey,
    eventId?: string,
    workspaceId?: string,
  ): Promise<boolean> {
    const actualEvent = eventService.getCurrentEvent()?.id;
    const actualWorkspace = workspaceService.getCurrentWorkspace()?.id;
    if (!actualEvent || !actualWorkspace) throw new Error('Event/workspace aktif belum dipilih.');
    if (eventId && eventId !== actualEvent) throw new Error('Event tidak sesuai sesi aktif.');
    if (workspaceId && workspaceId !== actualWorkspace) throw new Error('Workspace tidak sesuai sesi aktif.');
    await this.refreshAllFromSpreadsheet();
    const detail = this.resolveFeatureDetail(key, actualEvent, actualWorkspace);
    if (detail.isLocked) throw new Error(`Fitur '${detail.definition.name}' ${detail.lockReason}.`);
    const current = this.eventStates.get(actualEvent)?.get(key)?.enabled ?? detail.definition.defaultEnabled;
    return this.saveFeatureToSpreadsheet('EVENT', key, !current, actualEvent);
  }

  public async setWorkspaceFeature(workspaceId: string, key: SystemFeatureKey, enabled: boolean): Promise<void> {
    if (workspaceId !== workspaceService.getCurrentWorkspace()?.id) throw new Error('Workspace tidak sesuai sesi aktif.');
    await this.saveFeatureToSpreadsheet('WORKSPACE', key, enabled, workspaceId);
  }

  public async setSystemFeature(key: SystemFeatureKey, enabled: boolean): Promise<void> {
    await this.saveFeatureToSpreadsheet('SYSTEM', key, enabled, 'SYSTEM');
  }

  /**
   * Export all active feature configs as canonical FeatureConfigs table records (Req 4)
   */
  public exportCanonicalFeatureConfigs(): FeatureConfigRecord[] {
    const records: FeatureConfigRecord[] = [];
    const nowIso = new Date().toISOString();

    this.systemStates.forEach((state, key) => {
      records.push({
        id: `ft_sys_${key}`,
        feature_key: key,
        scope_type: 'SYSTEM',
        scope_id: 'SYSTEM',
        configured_state: state.enabled ? 'ENABLED' : 'DISABLED',
        updated_at: state.updatedAt || nowIso,
        updated_by: 'superadmin',
      });
    });

    this.workspaceStates.forEach((map, wsId) => {
      map.forEach((state, key) => {
        records.push({
          id: `ft_ws_${wsId}_${key}`,
          feature_key: key,
          scope_type: 'WORKSPACE',
          scope_id: wsId,
          configured_state: state.enabled ? 'ENABLED' : 'DISABLED',
          updated_at: state.updatedAt || nowIso,
          updated_by: 'workspace_admin',
        });
      });
    });

    this.eventStates.forEach((map, evId) => {
      map.forEach((state, key) => {
        records.push({
          id: `ft_ev_${evId}_${key}`,
          feature_key: key,
          scope_type: 'EVENT',
          scope_id: evId,
          configured_state: state.enabled ? 'ENABLED' : 'DISABLED',
          updated_at: state.updatedAt || nowIso,
          updated_by: 'event_admin',
        });
      });
    });

    return records;
  }

  /**
   * Import feature configurations from canonical FeatureConfigs records (survives reload & cross-device)
   */
  public importCanonicalFeatureConfigs(records: FeatureConfigRecord[]): void {
    records.forEach(rec => {
      const isEnabled = rec.configured_state === 'ENABLED';
      if (rec.scope_type === 'SYSTEM') {
        this.systemStates.set(rec.feature_key as SystemFeatureKey, {
          enabled: isEnabled,
          updatedAt: rec.updated_at,
        });
      } else if (rec.scope_type === 'WORKSPACE') {
        if (!this.workspaceStates.has(rec.scope_id)) {
          this.workspaceStates.set(rec.scope_id, new Map());
        }
        this.workspaceStates.get(rec.scope_id)!.set(rec.feature_key as SystemFeatureKey, {
          enabled: isEnabled,
          updatedAt: rec.updated_at,
        });
      } else if (rec.scope_type === 'EVENT') {
        if (!this.eventStates.has(rec.scope_id)) {
          this.eventStates.set(rec.scope_id, new Map());
        }
        this.eventStates.get(rec.scope_id)!.set(rec.feature_key as SystemFeatureKey, {
          enabled: isEnabled,
          updatedAt: rec.updated_at,
        });
      }
      // Imported snapshots are only for in-memory compatibility; never write to browser.
    });
    this.notify();
  }

  // ==================== SUBSCRIBER ====================

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb());
  }
}

export const featureControlService = new FeatureControlService();
