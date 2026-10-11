/**
 * @license
 * SiEpang - Activity & Agenda QR Check-in & Point Service (Req 1-20)
 * Fully implements:
 * - Requirement 1: QR for every event schedule/activity
 * - Requirement 2: Configurable QR purpose (Attendance, Check-in, Checkpoint, Participation, XP Reward)
 * - Requirement 3: Opaque secure tokens resolved via qrResolverService
 * - Requirement 4: Management actions (Generate, Preview, Download, Print, Rotate, Disable, Analytics)
 * - Requirement 8-10: Participant scan flow, server-side validation, friendly success UX
 * - Requirement 11: Scan window (scanOpens, scanCloses) validation
 * - Requirement 12: Duplicate scan protection ("Kegiatan sudah tercatat", no duplicate XP)
 * - Requirement 13-15: Multi-checkpoint activities (Wide Game, Penjelajahan) with ordered/unordered progression
 * - Requirement 16-17: Configured point rules & Point Ledger transactions
 * - Requirement 18: Activity QR analytics
 * - Requirement 19: Direct link to attendance service
 * - Requirement 20: Token rotation with audit trail
 */

import {
  ActivityQrConfig,
  ActivityQrMode,
  ActivityCheckpointItem,
  ActivityScanRecord,
  Participant,
} from '../types';
import { qrResolverService } from './qrResolverService';
import { pointService } from './pointService';
import { attendanceService } from './attendanceService';
import { participantService } from './participantService';
import { eventStudioService } from './eventStudioService';
import { authService } from './authService';
import { agendaAttendanceService } from './agendaAttendanceService';

export interface ScanResult {
  success: boolean;
  message: string;
  activityTitle: string;
  scheduleTime?: string;
  location?: string;
  xpAwarded: number;
  isDuplicate: boolean;
  scanRecord?: ActivityScanRecord;
  attendanceRecorded: boolean;
  checkpointProgress?: {
    current: number;
    total: number;
    completed: boolean;
    checkpointName?: string;
  };
}

class ActivityQrService {
  private configs: Map<string, ActivityQrConfig> = new Map();
  private scanLogs: ActivityScanRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultConfigs();
  }

  private seedDefaultConfigs(): void {
    // 1. Pioneering Activity QR
    const pionToken = 'SIEPANG:QR:v1:ACT_pioneering_8941f2';
    const pionConfig: ActivityQrConfig = {
      id: 'qr_act_pioneering',
      activityId: 'act_01',
      scheduleId: 'sch_pioneering',
      title: 'Pioneering Menara Kaki Tiga',
      category: 'Pioneering & Tali Temali',
      location: 'Lapangan Utama Selogiri',
      mode: 'PARTICIPATION',
      enabled: true,
      qrToken: pionToken,
      pointRuleId: 'prule_pioneering',
      rewardXp: 25,
      scanOpens: '07:30',
      scanCloses: '11:00',
      isMultiCheckpoint: false,
      checkpointOrder: 'unordered',
      maxScansPerParticipant: 1,
      totalScanCount: 48,
      uniqueParticipantCount: 48,
      createdAt: '2026-10-04 08:00',
    };
    this.configs.set('act_01', pionConfig);

    // 2. Wide Game & Penjelajahan (Multi-checkpoint activity - Req 14, 15)
    const wideToken = 'SIEPANG:QR:v1:ACT_widegame_5521ab';
    const wideConfig: ActivityQrConfig = {
      id: 'qr_act_widegame',
      activityId: 'act_wide_game',
      scheduleId: 'sch_widegame',
      title: 'Wide Game & Penjelajahan Rimba',
      category: 'Penjelajahan & Survival',
      location: 'Rute Bukit Selogiri',
      mode: 'CHECKPOINT',
      enabled: true,
      qrToken: wideToken,
      pointRuleId: 'prule_widegame',
      rewardXp: 40,
      scanOpens: '08:00',
      scanCloses: '14:00',
      isMultiCheckpoint: true,
      checkpointOrder: 'ordered',
      checkpoints: [
        {
          checkpointId: 'cp_01',
          name: 'Pos 1: Sandi & Morse',
          orderIndex: 1,
          location: 'Gerbang Hutan Pinus',
          rewardXp: 10,
          qrToken: 'SIEPANG:QR:v1:CP_wide_pos1_a831',
          hint: 'Pecahkan sandi rumput di bawah pohon cemara',
        },
        {
          checkpointId: 'cp_02',
          name: 'Pos 2: Menaksir Tinggi & Lebar',
          orderIndex: 2,
          location: 'Tepi Sungai Kali Klatak',
          rewardXp: 10,
          qrToken: 'SIEPANG:QR:v1:CP_wide_pos2_b942',
          hint: 'Gunakan tongkat pramuka dan metode segitiga sebangun',
        },
        {
          checkpointId: 'cp_03',
          name: 'Pos 3: P3K & Tandu Darurat',
          orderIndex: 3,
          location: 'Lembah Sumber Waras',
          rewardXp: 10,
          qrToken: 'SIEPANG:QR:v1:CP_wide_pos3_c153',
          hint: 'Balut bidai korban patah tulang dan evakuasi',
        },
        {
          checkpointId: 'cp_04',
          name: 'Pos 4 (Finish): Peta Pita & Simpul Rimba',
          orderIndex: 4,
          location: 'Posko Induk Buper',
          rewardXp: 10,
          qrToken: 'SIEPANG:QR:v1:CP_wide_pos4_d264',
          hint: 'Kumpulkan laporan peta kompas dan registrasi kepulangan regu',
        },
      ],
      maxScansPerParticipant: 1,
      totalScanCount: 32,
      uniqueParticipantCount: 32,
      createdAt: '2026-10-04 08:30',
    };
    this.configs.set('act_wide_game', wideConfig);

    // Register checkpoints in QR resolver
    wideConfig.checkpoints?.forEach(cp => {
      qrResolverService.generateSecureToken(
        'CHECKPOINT',
        'ws_kwarcab_bwi',
        'ev_jamcab_bwi_2026',
        cp.checkpointId,
        {
          activityId: wideConfig.activityId,
          checkpointName: cp.name,
          orderIndex: cp.orderIndex,
          rewardXp: cp.rewardXp,
        }
      );
    });

    // 3. Upacara Pembukaan (Attendance & Check-in mode - Req 2, 19)
    const upacaraConfig: ActivityQrConfig = {
      id: 'qr_act_upacara',
      activityId: 'sch_apel_pagi',
      scheduleId: 'sch_apel_pagi',
      title: 'Upacara Pembukaan & Apel Pagi',
      category: 'Upacara & Protokoler',
      location: 'Lapangan Utama Selogiri',
      mode: 'ATTENDANCE',
      enabled: true,
      qrToken: 'SIEPANG:QR:v1:ACT_upacara_7719cc',
      pointRuleId: 'prule_ceremony',
      rewardXp: 15,
      scanOpens: '06:45',
      scanCloses: '08:15',
      isMultiCheckpoint: false,
      checkpointOrder: 'unordered',
      maxScansPerParticipant: 1,
      totalScanCount: 112,
      uniqueParticipantCount: 112,
      createdAt: '2026-10-04 07:00',
    };
    this.configs.set('sch_apel_pagi', upacaraConfig);
  }

  // ==================== CONFIGURATION MANAGEMENT ====================

  public getConfigs(): ActivityQrConfig[] {
    return Array.from(this.configs.values());
  }

  public getConfigByActivityId(activityId: string): ActivityQrConfig | undefined {
    return this.configs.get(activityId);
  }

  public getConfigByToken(tokenString: string): ActivityQrConfig | undefined {
    return Array.from(this.configs.values()).find(
      c => c.qrToken === tokenString || c.checkpoints?.some(cp => cp.qrToken === tokenString)
    );
  }

  /**
   * Generates or updates Activity QR configuration
   */
  public configureActivityQr(
    activityId: string,
    params: {
      title: string;
      category?: string;
      scheduleId?: string;
      location?: string;
      mode?: ActivityQrMode;
      rewardXp?: number;
      pointRuleId?: string;
      scanOpens?: string;
      scanCloses?: string;
      enabled?: boolean;
      isMultiCheckpoint?: boolean;
      checkpointOrder?: 'ordered' | 'unordered';
      checkpoints?: ActivityCheckpointItem[];
    },
    workspaceId: string = 'ws_kwarcab_bwi',
    eventId: string = 'ev_jamcab_bwi_2026'
  ): ActivityQrConfig {
    const existing = this.configs.get(activityId);

    let tokenString = existing?.qrToken;
    if (!tokenString) {
      const generated = qrResolverService.generateSecureToken(
        'ACTIVITY',
        workspaceId,
        eventId,
        activityId,
        {
          activityTitle: params.title,
          rewardXp: params.rewardXp || 20,
          mode: params.mode || 'PARTICIPATION',
        }
      );
      tokenString = generated.tokenString;
    }

    const config: ActivityQrConfig = {
      id: existing?.id || `qr_act_${Date.now()}`,
      activityId,
      scheduleId: params.scheduleId || existing?.scheduleId,
      title: params.title || existing?.title || 'Kegiatan Kepramukaan',
      category: params.category || existing?.category || 'Kegiatan Umum',
      location: params.location || existing?.location || 'Bumi Perkemahan',
      mode: params.mode || existing?.mode || 'PARTICIPATION',
      enabled: params.enabled !== undefined ? params.enabled : true,
      qrToken: tokenString,
      pointRuleId: params.pointRuleId || existing?.pointRuleId || 'prule_activity_generic',
      rewardXp: params.rewardXp !== undefined ? params.rewardXp : (existing?.rewardXp || 20),
      scanOpens: params.scanOpens || existing?.scanOpens || '07:00',
      scanCloses: params.scanCloses || existing?.scanCloses || '18:00',
      isMultiCheckpoint: params.isMultiCheckpoint || false,
      checkpointOrder: params.checkpointOrder || 'unordered',
      checkpoints: params.checkpoints || existing?.checkpoints,
      maxScansPerParticipant: existing?.maxScansPerParticipant || 1,
      totalScanCount: existing?.totalScanCount || 0,
      uniqueParticipantCount: existing?.uniqueParticipantCount || 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    this.configs.set(activityId, config);
    this.notify();
    return config;
  }

  /**
   * Rotate / regenerate token for security (Req 20)
   */
  public rotateActivityToken(
    activityId: string,
    adminName: string,
    reason: string
  ): ActivityQrConfig {
    const config = this.configs.get(activityId);
    if (!config) throw new Error('Konfigurasi QR kegiatan tidak ditemukan.');

    const oldToken = config.qrToken;
    const rotated = qrResolverService.rotateToken(oldToken, adminName, reason);

    config.qrToken = rotated.tokenString;
    config.tokenRotatedAt = new Date().toLocaleString('id-ID');
    config.tokenRotatedBy = adminName;
    config.rotationReason = reason;

    // Log to Event Studio Audit Log
    eventStudioService.addAuditLogEntry(
      'ROTATE_ACTIVITY_QR',
      `Token QR kegiatan '${config.title}' diregenerasi oleh ${adminName}. Alasan: ${reason}`,
      adminName
    );

    this.notify();
    return config;
  }

  /**
   * Toggle enabled status
   */
  public toggleActivityQr(activityId: string, enabled: boolean): void {
    const config = this.configs.get(activityId);
    if (config) {
      config.enabled = enabled;
      this.notify();
    }
  }

  // ==================== PARTICIPANT SCAN & VALIDATION ENGINE (Req 8-12, 16-19) ====================

  /**
   * Helper scan method defaulting to active logged-in participant
   */
  public async scanActivityQr(tokenInput: string, _participantIdOrCode?: string): Promise<ScanResult> {
    // Production agenda attendance: ignore browser-supplied participant IDs.
    // Legacy ACT_ / CP_ sample tokens do not authorize attendance or XP.
    if (!/^AGENDA_[a-f0-9]{64}$/i.test(tokenInput.trim())) {
      throw new Error('Gunakan QR agenda resmi yang diterbitkan panitia dari GAS.');
    }
    const result = await agendaAttendanceService.scan(tokenInput);
    return {
      success: true,
      message: result.duplicate ? 'Kehadiran sudah tercatat. XP tidak ditambahkan lagi.' :
        `Presensi berhasil. Anda memperoleh ${result.xp_awarded} XP.`,
      activityTitle: result.activity_title,
      xpAwarded: result.xp_awarded,
      isDuplicate: result.duplicate,
      attendanceRecorded: result.attendance_recorded,
    };
  }

  /**
   * Authoritative scan processor called when participant scans an Activity QR
   */
  public async processActivityScan(
    tokenInput: string,
    participantIdOrCode: string,
    options?: {
      overrideWindow?: boolean;
      overrideReason?: string;
      adminBypass?: boolean;
    }
  ): Promise<ScanResult> {
    const tokenClean = tokenInput.trim();

    // 1. Resolve QR token authoritatively
    const resolution = qrResolverService.resolveToken(tokenClean);
    if (!resolution.isValid) {
      return {
        success: false,
        message: resolution.errorMessage || 'Kode QR Kegiatan tidak valid.',
        activityTitle: 'Tidak Dikenal',
        xpAwarded: 0,
        isDuplicate: false,
        attendanceRecorded: false,
      };
    }

    // 2. Identify target activity / checkpoint config
    let config = this.getConfigByToken(tokenClean);

    // If resolved through entity ID
    if (!config && resolution.token) {
      config = this.getConfigByActivityId(resolution.token.entityId);
    }

    // Check if it is a specific checkpoint under an activity
    let targetCheckpoint: ActivityCheckpointItem | undefined;
    if (!config) {
      for (const c of this.configs.values()) {
        const cp = c.checkpoints?.find(p => p.qrToken === tokenClean || p.checkpointId === resolution.token?.entityId);
        if (cp) {
          config = c;
          targetCheckpoint = cp;
          break;
        }
      }
    }

    if (!config) {
      return {
        success: false,
        message: 'Kegiatan terkait Kode QR ini tidak ditemukan dalam jadwal aktif.',
        activityTitle: 'Tidak Ditemukan',
        xpAwarded: 0,
        isDuplicate: false,
        attendanceRecorded: false,
      };
    }

    if (!config.enabled) {
      return {
        success: false,
        message: 'QR Kegiatan ini sedang dinonaktifkan sementara oleh Panitia.',
        activityTitle: config.title,
        xpAwarded: 0,
        isDuplicate: false,
        attendanceRecorded: false,
      };
    }

    // 3. Resolve participant
    const allParticipants = participantService.getParticipants();
    const currentUser = authService.getCurrentUser();
    const participant =
      allParticipants.find(
        p => p.id === participantIdOrCode || p.code === participantIdOrCode
      ) || (currentUser ? allParticipants.find(p => p.id === currentUser.id || p.name === currentUser.name) : undefined);

    if (!participant) {
      return {
        success: false,
        message: 'Data peserta tidak ditemukan atau sesi akun belum terverifikasi.',
        activityTitle: config.title,
        xpAwarded: 0,
        isDuplicate: false,
        attendanceRecorded: false,
      };
    }

    // Check registration verification status
    if (participant.status !== 'verified' && participant.status !== 'approved') {
      return {
        success: false,
        message: 'Peserta belum lolos verifikasi administrasi posko perkemahan.',
        activityTitle: config.title,
        xpAwarded: 0,
        isDuplicate: false,
        attendanceRecorded: false,
      };
    }

    // 4. Validate scan window (Req 11)
    if (!options?.overrideWindow && !options?.adminBypass) {
      const now = new Date();
      const currentHourMin = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

      // Simple time compare if formatted "HH:MM"
      if (config.scanOpens && currentHourMin < config.scanOpens) {
        return {
          success: false,
          message: `QR belum aktif. Waktu pemindaian dibuka pukul ${config.scanOpens} WIB.`,
          activityTitle: config.title,
          scheduleTime: `${config.scanOpens} - ${config.scanCloses} WIB`,
          location: config.location,
          xpAwarded: 0,
          isDuplicate: false,
          attendanceRecorded: false,
        };
      }

      if (config.scanCloses && currentHourMin > config.scanCloses) {
        return {
          success: false,
          message: `Waktu scan telah berakhir (ditutup pukul ${config.scanCloses} WIB).`,
          activityTitle: config.title,
          scheduleTime: `${config.scanOpens} - ${config.scanCloses} WIB`,
          location: config.location,
          xpAwarded: 0,
          isDuplicate: false,
          attendanceRecorded: false,
        };
      }
    }

    // 5. Multi-checkpoint progression validation (Req 14, 15)
    if (config.isMultiCheckpoint && targetCheckpoint && config.checkpointOrder === 'ordered') {
      if (targetCheckpoint.orderIndex > 1) {
        // Must have completed previous checkpoint
        const prevCompleted = this.scanLogs.some(
          l =>
            l.activityId === config!.activityId &&
            l.participantId === participant.id &&
            l.status === 'SUCCESS' &&
            l.checkpointId === config!.checkpoints?.find(cp => cp.orderIndex === targetCheckpoint!.orderIndex - 1)?.checkpointId
        );

        if (!prevCompleted) {
          return {
            success: false,
            message: `Harap selesaikan Pos ${targetCheckpoint.orderIndex - 1} terlebih dahulu sebelum memindai Pos ${targetCheckpoint.orderIndex}.`,
            activityTitle: `${config.title} - ${targetCheckpoint.name}`,
            xpAwarded: 0,
            isDuplicate: false,
            attendanceRecorded: false,
          };
        }
      }
    }

    // 6. Duplicate scan check (Req 12)
    const existingScan = this.scanLogs.find(
      l =>
        l.activityId === config!.activityId &&
        l.participantId === participant.id &&
        l.status === 'SUCCESS' &&
        (targetCheckpoint ? l.checkpointId === targetCheckpoint.checkpointId : true)
    );

    if (existingScan) {
      // Record duplicate attempt for analytics
      this.scanLogs.push({
        scanId: `scan_dup_${Date.now()}`,
        activityId: config.activityId,
        scheduleId: config.scheduleId,
        checkpointId: targetCheckpoint?.checkpointId,
        participantId: participant.id,
        participantCode: participant.code,
        participantName: participant.name,
        contingentName: participant.contingentName,
        mode: config.mode,
        scannedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: 'DUPLICATE',
        xpAwarded: 0,
        attendanceRecorded: false,
        notes: 'Percobaan scan ulang',
      });

      return {
        success: true,
        message: 'Kegiatan sudah tercatat sebelumnya. Semangat melanjutkan aktivitas kepramukaan!',
        activityTitle: targetCheckpoint ? `${config.title} (${targetCheckpoint.name})` : config.title,
        scheduleTime: `${config.scanOpens} - ${config.scanCloses} WIB`,
        location: targetCheckpoint?.location || config.location,
        xpAwarded: 0,
        isDuplicate: true,
        attendanceRecorded: false,
      };
    }

    // 7. Calculate XP Reward based on configured Point Rule (Req 16, 17)
    const xpReward = targetCheckpoint?.rewardXp || config.rewardXp || 20;

    let transactionId: string | undefined;
    if (xpReward > 0) {
      // Create Point Transaction in the official Point Ledger
      const noteLabel = targetCheckpoint
        ? `${config.title} - ${targetCheckpoint.name}`
        : config.title;

      const tx = await pointService.awardXP(
        participant.id,
        participant.name,
        xpReward,
        noteLabel,
        'activity'
      );
      transactionId = tx.id;
    }

    // 8. Link to Attendance Service if attendance mode enabled (Req 19)
    let attendanceRecorded = false;
    if (config.mode === 'ATTENDANCE' || config.mode === 'CHECK_IN') {
      try {
        await attendanceService.recordAttendance(
          participant.code,
          config.scheduleId || config.activityId,
          config.title
        );
        attendanceRecorded = true;
      } catch (err) {
        // Attendance might already exist or log error; non-blocking for XP
      }
    }

    // 9. Store Immutable Scan Log (Req 18)
    const scanRecord: ActivityScanRecord = {
      scanId: `scan_${Date.now()}`,
      activityId: config.activityId,
      scheduleId: config.scheduleId,
      checkpointId: targetCheckpoint?.checkpointId,
      participantId: participant.id,
      participantCode: participant.code,
      participantName: participant.name,
      contingentName: participant.contingentName,
      mode: config.mode,
      scannedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      status: 'SUCCESS',
      xpAwarded: xpReward,
      transactionId,
      attendanceRecorded,
      notes: targetCheckpoint ? `Check-in ${targetCheckpoint.name}` : 'Check-in kegiatan',
    };
    this.scanLogs.unshift(scanRecord);

    // Update config metrics
    config.totalScanCount += 1;
    const uniqueParticipants = new Set(
      this.scanLogs.filter(l => l.activityId === config!.activityId && l.status === 'SUCCESS').map(l => l.participantId)
    );
    config.uniqueParticipantCount = uniqueParticipants.size;

    // Check multi-checkpoint completion progress
    let checkpointProgress;
    if (config.isMultiCheckpoint && config.checkpoints) {
      const completedCount = config.checkpoints.filter(cp =>
        this.scanLogs.some(
          l => l.activityId === config!.activityId && l.participantId === participant.id && l.checkpointId === cp.checkpointId && l.status === 'SUCCESS'
        )
      ).length;

      checkpointProgress = {
        current: completedCount,
        total: config.checkpoints.length,
        completed: completedCount === config.checkpoints.length,
        checkpointName: targetCheckpoint?.name,
      };

      // Perfect completion bonus (Req 16)
      if (checkpointProgress.completed && targetCheckpoint?.orderIndex === config.checkpoints.length) {
        pointService.awardXP(
          participant.id,
          participant.name,
          15,
          `Bonus Tuntas Sempurna: ${config.title}`,
          'activity'
        );
      }
    }

    this.notify();

    return {
      success: true,
      message: '✅ Kegiatan berhasil tercatat!',
      activityTitle: targetCheckpoint ? `${config.title} (${targetCheckpoint.name})` : config.title,
      scheduleTime: `${config.scanOpens} - ${config.scanCloses} WIB`,
      location: targetCheckpoint?.location || config.location,
      xpAwarded: xpReward,
      isDuplicate: false,
      scanRecord,
      attendanceRecorded,
      checkpointProgress,
    };
  }

  // ==================== ANALYTICS & SCAN LOGS (Req 18) ====================

  public getScanLogs(activityId?: string): ActivityScanRecord[] {
    if (activityId) {
      return this.scanLogs.filter(l => l.activityId === activityId);
    }
    return this.scanLogs;
  }

  public getActivityAnalytics(activityId: string) {
    const logs = this.scanLogs.filter(l => l.activityId === activityId);
    const validScans = logs.filter(l => l.status === 'SUCCESS');
    const duplicateAttempts = logs.filter(l => l.status === 'DUPLICATE');
    const rejectedScans = logs.filter(l => l.status !== 'SUCCESS' && l.status !== 'DUPLICATE');
    const totalXp = validScans.reduce((sum, l) => sum + l.xpAwarded, 0);

    const uniqueParticipants = new Set(validScans.map(l => l.participantId)).size;

    return {
      totalScans: logs.length,
      validScansCount: validScans.length,
      uniqueParticipants,
      duplicateAttemptsCount: duplicateAttempts.length,
      rejectedScansCount: rejectedScans.length,
      totalXpDistributed: totalXp,
      recentScans: logs.slice(0, 10),
    };
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const activityQrService = new ActivityQrService();
