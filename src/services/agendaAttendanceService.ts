/** SiEpang — pemindaian QR agenda secara otoritatif di GAS. */
import { apiTransport } from './apiTransport';

export interface AgendaScanResponse {
  success: boolean;
  duplicate: boolean;
  attendance_recorded: boolean;
  xp_awarded: number;
  xp_configured: number;
  schedule_id: string;
  activity_title: string;
  participant_id: string;
}

export const agendaAttendanceService = {
  async scan(qrToken: string): Promise<AgendaScanResponse> {
    const token = qrToken.trim();
    if (!/^AGENDA_[a-f0-9]{64}$/i.test(token)) throw new Error('QR agenda tidak valid.');
    const response = await apiTransport.send<AgendaScanResponse>('agenda.attendance.scan', { qr_token: token });
    if (!response.ok || !response.data?.success || !response.data?.attendance_recorded) {
      throw new Error(response.error?.message || 'GAS belum mengonfirmasi presensi agenda.');
    }
    return response.data;
  },
  async issue(scheduleId: string, scanOpens?: string, scanCloses?: string): Promise<{schedule_id: string; title: string; xp_reward: number; qr_token: string}> {
    if (!scheduleId.trim()) throw new Error('Pilih agenda terlebih dahulu.');
    const response = await apiTransport.send<{schedule_id:string;title:string;xp_reward:number;qr_token:string}>('agenda.qr.issue', {schedule_id: scheduleId.trim(), scan_opens: scanOpens, scan_closes: scanCloses});
    if (!response.ok || !response.data?.qr_token) throw new Error(response.error?.message || 'GAS belum menerbitkan QR agenda.');
    return response.data;
  },
  async analytics(scheduleId: string): Promise<{schedule_id:string;total_scans:number;unique_participants:number;total_xp_distributed:number}> {
    if (!scheduleId.trim()) throw new Error('Pilih agenda terlebih dahulu.');
    const response = await apiTransport.send<{schedule_id:string;total_scans:number;unique_participants:number;total_xp_distributed:number}>('agenda.attendance.analytics', {schedule_id: scheduleId.trim()});
    if (!response.ok || !response.data) throw new Error(response.error?.message || 'Statistik agenda dari GAS belum tersedia.');
    return response.data;
  },
  async disable(scheduleId: string): Promise<{schedule_id: string; disabled_count: number}> {
    if (!scheduleId.trim()) throw new Error('Pilih agenda terlebih dahulu.');
    const response = await apiTransport.send<{schedule_id:string;disabled_count:number}>('agenda.qr.disable', {schedule_id: scheduleId.trim()});
    if (!response.ok || !response.data) throw new Error(response.error?.message || 'GAS belum menonaktifkan QR agenda.');
    return response.data;
  },
  async rotate(scheduleId: string, currentToken: string, reason: string, scanOpens?: string, scanCloses?: string): Promise<{schedule_id: string; title: string; xp_reward: number; qr_token: string}> {
    if (!scheduleId.trim()) throw new Error('Pilih agenda terlebih dahulu.');
    if (!reason.trim()) throw new Error('Alasan regenerasi wajib diisi.');
    const response = await apiTransport.send<{schedule_id:string;title:string;xp_reward:number;qr_token:string}>('agenda.qr.rotate', {
      schedule_id: scheduleId.trim(),
      qr_token: currentToken.trim(),
      reason: reason.trim(),
      scan_opens: scanOpens,
      scan_closes: scanCloses,
    });
    if (!response.ok || !response.data?.qr_token) throw new Error(response.error?.message || 'GAS belum meregenerasi QR agenda.');
    return response.data;
  },
};
