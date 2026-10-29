/**
 * SiEpang — Klien Gudep Tahap 2 untuk registrasi hybrid.
 * File BARU: src/services/gudepRegistrationService.ts
 * Tidak memberi hak akses pada sisi klien. Seluruh validasi izin dilakukan GAS.
 * Tahap 5: registrasi peserta BARU melalui gudep.participant.register di GAS.
 * Jangan memanggil participants.create + gudep.participant.link secara terpisah.
 */
import { apiTransport } from './apiTransport';

export type ContingentRecord = { id: string; event_id?: string; name: string; region?: string; leader_name?: string; verification_status?: string; participant_count?: number; };
export type GudepRecord = {
  contingent_id?: string;
  gudep_id: string; event_id: string; gudep_name: string; gudep_number: string;
  institution_name?: string; registration_status: string; verification_status: string; activation_status?: 'ACTIVE' | 'INACTIVE';
  contingent_verification_status?: string; contingent_verification_notes?: string;
};
export type GudepRegu = {
  regu_id: string; event_id: string; gudep_id: string; regu_name: string;
  gender: 'PUTRA' | 'PUTRI'; quota: number; registration_status?: string; verification_status?: string; activation_status?: 'ACTIVE' | 'INACTIVE';
};
export type GudepAdvisor = {
  advisor_id: string; gudep_id: string; full_name: string; gender?: string;
  verification_status?: string; activation_status?: 'ACTIVE' | 'INACTIVE';
};
export type GudepOperator = {
  user_id: string; name: string; email: string; status: string; assigned_at?: string;
};
export type GudepDetail = {
  gudep: GudepRecord; regu: GudepRegu[]; advisors: GudepAdvisor[]; operators: GudepOperator[];
  participantLinks: Array<{ id: string; participant_id: string; regu_id: string; gudep_id: string; status: string }>;
  advisorRegu: unknown[];
  gudepParticipants?: Array<{ id: string; name: string; gender: string; regu_id: string; gudep_id?: string; membership_number?: string; profile_photo_url?: string; profile_photo_file_id?: string; status?: string }>;
  participants?: Array<{ id: string; name: string; gender: string; regu_id: string; gudep_id?: string; membership_number?: string; profile_photo_url?: string; profile_photo_file_id?: string; status?: string }>;
  eligibleParticipants?: Array<{ id: string; name: string; gender: string; membership_number?: string; profile_photo_url?: string; profile_photo_file_id?: string; institution?: string; contingent_id?: string; status?: string }>;
};
export type GudepParticipantCandidate = { id: string; name: string; gender: string; membership_number?: string; profile_photo_url?: string; profile_photo_file_id?: string; institution?: string; contingent_id?: string; status?: string };

const send = async <T>(action: string, payload: Record<string, unknown>): Promise<T> => {
  const result = await apiTransport.send<T>(action, payload, { timeoutMs: 45000 });
  if (!result.ok || !result.data) throw new Error(result.error?.message || `Gagal menjalankan ${action}`);
  return result.data;
};

export const gudepRegistrationService = {
  list: () => send<{ gudep: GudepRecord[]; contingents: ContingentRecord[] }>('gudep.registration.list', {}),
  // Khusus pilihan pada formulir pendaftaran peserta. Tidak mengubah daftar Gudep
  // pada panel pengelolaan/administrasi yang tetap menggunakan list().
  listForParticipantRegistration: () => send<{ gudep: GudepRecord[] }>('gudep.participant.registration.options', {}),
  detail: (gudep_id: string) => send<GudepDetail>('gudep.registration.detail', { gudep_id }),
  updateGudep: (data: {
    gudep_id: string; gudep_number: string; gudep_name: string; institution_name?: string;
  }) => send<{ gudep: GudepRecord; contingent_id: string }>('gudep.registration.update', data),
  updateRegu: (data: {
    gudep_id: string; regu_id: string; regu_name: string;
  }) => send<{ regu: GudepRegu }>('gudep.regu.update', data),
  syncContingent: (gudep_id: string) => send<{ gudep_id: string; contingent_id: string; created: boolean; participant_count: number }>('gudep.registration.syncContingent', { gudep_id }),
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
  participantCandidates: (data: { gudep_id: string; regu_id: string }) =>
    send<{ candidates: GudepParticipantCandidate[] }>('gudep.participant.candidates', data),
  assignExistingUser: (data: { gudep_id: string; user_id: string }) =>
    send<{ assignment_id: string; status: string }>('gudep.operator.assign', data),
  activateGudep: (gudep_id: string, activation_status: 'ACTIVE' | 'INACTIVE') => send<{gudep_id:string;activation_status:string;regu_updated:number}>('gudep.registration.activate',{gudep_id,activation_status}),
  activateRegu: (gudep_id: string, regu_id: string, activation_status: 'ACTIVE' | 'INACTIVE') => send<{regu_id:string;activation_status:string}>('gudep.regu.setActivation',{gudep_id,regu_id,activation_status}),
  // Kept only for backward compatibility; the backend deliberately rejects auto-approval.
  syncReguVerification: (gudep_id: string) => send<never>('gudep.registration.syncReguVerification', { gudep_id }),
  submit: (gudep_id: string) => send<unknown>('gudep.registration.submit', { gudep_id }),
  submitRegu: (gudep_id: string, regu_id: string) => send<unknown>('gudep.regu.submit', { gudep_id, regu_id }),
  verifyRegu: (gudep_id: string, regu_id: string, decision: 'VERIFIED' | 'REVISION' | 'REJECTED', notes = '') => send<unknown>('gudep.regu.verify', { gudep_id, regu_id, decision, notes }),
  verifyContingent: (gudep_id: string, decision: 'VERIFIED' | 'REVISION' | 'REJECTED', notes = '') => send<unknown>('contingent.registration.verify', { gudep_id, decision, notes }),
  verify: (gudep_id: string, decision: 'VERIFIED' | 'REVISION' | 'REJECTED', notes = '') =>
    send<unknown>('gudep.registration.verify', { gudep_id, decision, notes }),
};
