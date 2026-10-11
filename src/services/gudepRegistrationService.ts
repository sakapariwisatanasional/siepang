/**
 * SiEpang — Klien Gudep Tahap 2 untuk registrasi hybrid.
 * File BARU: src/services/gudepRegistrationService.ts
 * Tidak memberi hak akses pada sisi klien. Seluruh validasi izin dilakukan GAS.
 * Tahap 5: registrasi peserta BARU melalui gudep.participant.register di GAS.
 * Jangan memanggil participants.create + gudep.participant.link secara terpisah.
 */
import { apiTransport } from './apiTransport';

export type GudepRecord = {
  gudep_id: string; event_id: string; gudep_name: string; gudep_number: string;
  institution_name?: string; registration_status: string; verification_status: string;
};
export type GudepRegu = {
  regu_id: string; event_id: string; gudep_id: string; regu_name: string;
  gender: 'PUTRA' | 'PUTRI'; quota: number; verification_status?: string;
};
export type GudepAdvisor = {
  advisor_id: string; gudep_id: string; full_name: string; gender?: string;
  verification_status?: string;
};
export type GudepDetail = {
  gudep: GudepRecord; regu: GudepRegu[]; advisors: GudepAdvisor[];
  participantLinks: Array<{ id: string; participant_id: string; regu_id: string; gudep_id: string; status: string }>;
  advisorRegu: unknown[];
};

const send = async <T>(action: string, payload: Record<string, unknown>): Promise<T> => {
  const result = await apiTransport.send<T>(action, payload, { timeoutMs: 45000 });
  if (!result.ok || !result.data) throw new Error(result.error?.message || `Gagal menjalankan ${action}`);
  return result.data;
};

export const gudepRegistrationService = {
  list: () => send<{ gudep: GudepRecord[] }>('gudep.registration.list', {}),
  detail: (gudep_id: string) => send<GudepDetail>('gudep.registration.detail', { gudep_id }),
  create: (data: {
    request_key: string; gudep_number: string; gudep_name: string;
    institution_name?: string; address?: string; contact_name?: string;
    contact_phone?: string; contact_email?: string;
  }) => send<{ gudep: GudepRecord; alreadyExists?: boolean }>('gudep.registration.create', data),
  createRegu: (data: {
    request_key: string; gudep_id: string; regu_name: string;
    gender: 'PUTRA' | 'PUTRI'; quota: number;
  }) => send<{ regu: GudepRegu; alreadyExists?: boolean }>('gudep.regu.create', data),
  createAdvisor: (data: {
    request_key: string; gudep_id: string; full_name: string;
    gender?: string; phone?: string; email?: string;
  }) => send<{ advisor: GudepAdvisor; alreadyExists?: boolean }>('gudep.advisor.create', data),
  registerParticipant: (data: {
    request_key: string; gudep_id: string; regu_id: string;
    name: string; gender: 'M' | 'F'; role?: string;
    membershipNumber?: string; email?: string; phone?: string;
    profile_photo_file_id?: string; profile_photo_url?: string;
  }) => send<{ participant: { id: string }; link: { id: string; gudep_id: string; regu_id: string; participant_id: string }; alreadyExists?: boolean }>(
    'gudep.participant.register', data),
  linkExistingParticipant: (data: { gudep_id: string; regu_id: string; participant_id: string }) =>
    send<{ link: { id: string; gudep_id: string; regu_id: string; participant_id: string }; alreadyExists?: boolean }>(
      'gudep.participant.link', data),
  assignExistingUser: (data: { gudep_id: string; user_id: string }) =>
    send<{ assignment_id: string; status: string }>('gudep.operator.assign', data),
  syncReguVerification: (gudep_id: string) => send<{ gudep_id: string; verification_status: string; regu_updated: number }>('gudep.registration.syncReguVerification', { gudep_id }),
  submit: (gudep_id: string) => send<unknown>('gudep.registration.submit', { gudep_id }),
  verify: (gudep_id: string, decision: 'VERIFIED' | 'REVISION' | 'REJECTED', notes = '') =>
    send<unknown>('gudep.registration.verify', { gudep_id, decision, notes }),
};
