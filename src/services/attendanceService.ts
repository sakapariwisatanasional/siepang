/**
 * SiEpang - GAS-authoritative attendance (phase 1).
 * No local-only success; event/activity attendance is persisted to AttendanceLogs.
 */
import { apiTransport } from './apiTransport';
import { participantService } from './participantService';
import { eventService } from './eventService';

export interface AttendanceRecord {
  id: string;
  transactionId?: string;
  participantId: string;
  participantName: string;
  participantCode: string;
  contingentName: string;
  sessionId: string;
  sessionName: string;
  timestamp: string;
  xpAwarded: number;
  synced: boolean;
  syncStatus: 'Saved on Device' | 'Saved on Server Buper' | 'Synced to Cloud';
  edgeNodeId?: string;
}

class AttendanceService {
  private records: AttendanceRecord[] = [];
  private inFlight = new Set<string>();

  public getRecords(): AttendanceRecord[] {
    return [...this.records];
  }

  /** Read authoritative rows so a page refresh cannot erase attendance history. */
  public async refreshRecords(): Promise<AttendanceRecord[]> {
    const response = await apiTransport.send<{ records: any[] }>('admin.entity.list', {
      entity: 'attendance', filters: {},
    });
    if (!response.ok) {
      throw new Error(response.error?.message || 'Gagal membaca AttendanceLogs dari GAS.');
    }
    const rows = Array.isArray(response.data?.records) ? response.data.records : [];
    const participants = participantService.getParticipants();
    this.records = rows.map((raw: any) => {
      const p = participants.find(x => x.id === String(raw.participant_id || ''));
      return {
        id: String(raw.id || ''),
        participantId: String(raw.participant_id || ''),
        participantName: p?.name || String(raw.participant_name || ''),
        participantCode: p?.code || String(raw.participant_code || ''),
        contingentName: p?.contingentName || String(raw.contingent_name || ''),
        sessionId: String(raw.checkpoint_or_schedule_id || ''),
        sessionName: String(raw.session_name || raw.checkpoint_or_schedule_id || ''),
        timestamp: String(raw.timestamp || ''),
        xpAwarded: 0,
        synced: true,
        syncStatus: 'Synced to Cloud' as const,
      };
    });
    return this.getRecords();
  }

  public async recordAttendance(
    codeOrId: string,
    sessionId = '',
    sessionName = 'Kegiatan Lapangan & Apel'
  ): Promise<{ record: AttendanceRecord; offline: boolean; destination: 'device' | 'server_buper' | 'cloud' }> {
    // QR contains the existing unique participant code used across modules.
    const scanned = codeOrId.trim();
    if (!scanned) throw new Error('Kode peserta tidak boleh kosong.');
    if (!participantService.getParticipants().length) await participantService.loadParticipants();
    const participant = participantService.getParticipantByCode(scanned) ||
      participantService.getParticipants().find(p => p.id === scanned);
    if (!participant) throw new Error(`Peserta dengan kode '${scanned}' tidak terdaftar pada event aktif.`);
    const eventId = eventService.getCurrentEvent()?.id;
    if (!eventId) throw new Error('Event aktif belum tersedia.');
    if (participant.event_id && participant.event_id !== eventId) {
      throw new Error('QR peserta bukan untuk event aktif.');
    }
    const key = `${eventId}:${sessionId}:${participant.id}`;
    if (this.inFlight.has(key)) throw new Error('Presensi peserta ini sedang diproses.');
    this.inFlight.add(key);
    try {
      if (!sessionId) {
        const response = await apiTransport.send<any>('participants.checkin', { participant_id: participant.id });
        const saved = response.data;
        if (!response.ok || String(saved?.participant_id || '') !== participant.id ||
            !['true','1'].includes(String(saved?.checked_in).toLowerCase()) || !saved?.checked_in_at || !saved?.attendance_id) {
          throw new Error(response.error?.message || 'GAS belum mengonfirmasi kehadiran pada sheet Participants.');
        }
        const record: AttendanceRecord = {
          id: String(saved.attendance_id), participantId: participant.id, participantName: participant.name,
          participantCode: participant.code, contingentName: participant.contingentName,
          sessionId: 'CHECKIN', sessionName: 'Check-in kedatangan peserta',
          timestamp: String(saved.checked_in_at), xpAwarded: Number(saved.xp_awarded || 0),
          synced: true, syncStatus: 'Synced to Cloud',
        };
        this.records = [record, ...this.records.filter(r => r.id !== record.id)];
        participantService.invalidateScannerIdentityCache(participant.id);
        void participantService.loadParticipants().catch(error => console.warn('Kehadiran tersimpan; pembaruan tampilan tertunda:', error));
        return { record, offline: false, destination: 'cloud' };
      }
      const response = await apiTransport.send<any>('agenda.attendance.record', {
        schedule_id: sessionId, participant_id: participant.id,
      });
      const stored = response.data;
      if (!response.ok || !stored?.success || !stored?.attendance_recorded || !stored?.attendance_id || !stored?.attendance_at) {
        throw new Error(response.error?.message || 'GAS belum mengonfirmasi kehadiran dan poin kegiatan.');
      }
      const record: AttendanceRecord = {
        id: String(stored.attendance_id),
        participantId: String(stored.participant_id), participantName: participant.name,
        participantCode: participant.code, contingentName: participant.contingentName,
        sessionId: String(stored.schedule_id), sessionName: String(stored.activity_title || sessionName),
        timestamp: String(stored.attendance_at), xpAwarded: Number(stored.xp_awarded || 0),
        synced: true, syncStatus: 'Synced to Cloud',
      };
      this.records = [record, ...this.records.filter(r => r.id !== record.id)];
      void participantService.loadParticipants().catch(error => console.warn('Presensi tersimpan; pembaruan saldo tampilan tertunda:', error));
      return { record, offline: false, destination: 'cloud' };
    } finally {
      this.inFlight.delete(key);
    }
  }
}

export const attendanceService = new AttendanceService();
