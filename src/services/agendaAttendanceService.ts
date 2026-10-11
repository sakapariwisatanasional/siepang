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
  async issue(scheduleId: string): Promise<{schedule_id: string; title: string; xp_reward: number; qr_token: string}> {
    if (!scheduleId.trim()) throw new Error('Pilih agenda terlebih dahulu.');
    const response = await apiTransport.send<{schedule_id:string;title:string;xp_reward:number;qr_token:string}>('agenda.qr.issue', {schedule_id: scheduleId.trim()});
    if (!response.ok || !response.data?.qr_token) throw new Error(response.error?.message || 'GAS belum menerbitkan QR agenda.');
    return response.data;
  },
};
