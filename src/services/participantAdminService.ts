import { apiTransport } from './apiTransport';

export type ParticipantAdminChanges = {
  name?: string; pramuka_id?: string; email?: string; phone?: string;
  birth_place?: string; birth_date?: string; scout_level?: string;
};

async function sendAdmin<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const res = await apiTransport.send<T>(action, payload);
  if (!res.ok || !res.data) throw new Error(res.error?.message || 'GAS tidak mengonfirmasi perubahan peserta.');
  return res.data;
}

export const participantAdminService = {
  update: (participantId: string, changes: ParticipantAdminChanges) =>
    sendAdmin<{updated:number}>('participants.admin.update', { participant_id:participantId, changes }),
  assignRegu: (participantIds: string[], gudepId: string, reguId: string) =>
    sendAdmin<{updated:number}>('participants.admin.assignRegu', { participant_ids:participantIds, gudep_id:gudepId, regu_id:reguId }),
  archive: (participantIds: string[]) =>
    sendAdmin<{archived:number}>('participants.admin.archive', { participant_ids:participantIds, confirm:'ARCHIVE' }),
};
