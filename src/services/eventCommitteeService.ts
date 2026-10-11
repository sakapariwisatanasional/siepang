/** SiEpang Model A — susunan panitia formal event aktif.
 * Penyimpanan menggunakan admin.config.get/set (FeatureConfigs) yang sudah ada.
 * Jabatan adalah informasi publik/administratif, BUKAN perubahan otorisasi akun.
 */
import { apiTransport } from './apiTransport';
import { eventService } from './eventService';

export type CommitteeMember = {
  id: string;
  name: string;
  position: string;
  division: string;
  phone: string;
  notes: string;
  userId: string;
};
export type CommitteeDocument = { eventId: string; members: CommitteeMember[]; updatedAt: string };
const KEY = 'model_a_event_committee_v1';
const str = (v: unknown) => String(v ?? '').trim();
const normalize = (raw: unknown): CommitteeDocument => {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const members = Array.isArray(value.members) ? value.members : [];
  return {
    eventId: str(value.eventId),
    updatedAt: str(value.updatedAt),
    members: members.filter(v => !!v && typeof v === 'object').map(v => {
      const m = v as Record<string, unknown>;
      return { id: str(m.id), name: str(m.name), position: str(m.position), division: str(m.division), phone: str(m.phone), notes: str(m.notes), userId: str(m.userId) };
    }).filter(m => m.id && m.name && m.position),
  };
};
const activeEventId = () => str(eventService.getCurrentEvent()?.id);
const empty = (eventId: string): CommitteeDocument => ({ eventId, members: [], updatedAt: '' });

export const eventCommitteeService = {
  async load(): Promise<CommitteeDocument> {
    const eventId = activeEventId();
    if (!eventId) throw new Error('Event aktif belum tersedia.');
    const response = await apiTransport.send<{ value: unknown }>('admin.config.get', { key: KEY }, { timeoutMs: 45000 });
    if (!response.ok) throw new Error(response.error?.message || 'Gagal membaca susunan panitia.');
    if (response.data?.value == null) return empty(eventId);
    const doc = normalize(response.data.value);
    // FeatureConfigs lama mungkin memuat konfigurasi event sebelumnya: jangan tampilkan di event baru.
    return doc.eventId === eventId ? doc : empty(eventId);
  },
  async save(members: CommitteeMember[]): Promise<CommitteeDocument> {
    const eventId = activeEventId();
    if (!eventId) throw new Error('Event aktif belum tersedia.');
    const cleaned = normalize({ eventId, members, updatedAt: new Date().toISOString() });
    if (cleaned.members.length !== members.length) throw new Error('Setiap petugas harus memiliki nama dan jabatan.');
    if (new Set(cleaned.members.map(m => m.id)).size !== cleaned.members.length) throw new Error('ID entri panitia harus unik.');
    const result = await apiTransport.send<{value:unknown}>('admin.config.set', { key: KEY, value: cleaned }, { timeoutMs: 45000 });
    if (!result.ok) throw new Error(result.error?.message || 'Penyimpanan susunan panitia belum terkonfirmasi.');
    return normalize(result.data?.value ?? cleaned);
  },
};
