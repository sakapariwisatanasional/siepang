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
import { apiTransport } from './apiTransport';

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
    // No bundled activity/QR records. Data is loaded from GAS or created explicitly by an operator.
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
    workspaceId: string,
    eventId: string
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
      pointRuleId: params.pointRuleId || existing?.pointRuleId || '',
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
    const token = tokenInput.trim();
    if (/^SIEPANG-CP-[A-Z0-9]+$/i.test(token)) {
      const result = await apiTransport.send<any>('checkpoint.attendance.scan', { qr_code: token });
      if (!result.ok || !result.data?.success || !result.data?.attendance_recorded) {
        throw new Error(result.error?.message || 'GAS belum mengonfirmasi scan pos.');
      }
      return {
        success: true,
        message: result.data.duplicate
          ? 'Kehadiran di pos ini sudah tercatat. XP tidak ditambahkan lagi.'
          : `Pos berhasil dicatat. Anda memperoleh ${Number(result.data.xp_awarded || 0)} XP.`,
        activityTitle: String(result.data.activity_title || 'Pos kegiatan'),
        xpAwarded: Number(result.data.xp_awarded || 0),
        isDuplicate: Boolean(result.data.duplicate),
        attendanceRecorded: Boolean(result.data.attendance_recorded),
      };
    }
    if (!/^AGENDA_[a-f0-9]{64}$/i.test(token)) {
      throw new Error('Gunakan QR agenda atau QR pos resmi yang diterbitkan panitia dari GAS.');
    }
    const result = await agendaAttendanceService.scan(token);
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
