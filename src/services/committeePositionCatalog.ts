/** Katalog jabatan resmi kepanitiaan. Role adalah rekomendasi, bukan otomatis pemberian izin. */
import type { UserRole } from '../types';
export interface CommitteePosition { title: string; roles: readonly UserRole[]; division: string }
export const OFFICIAL_COMMITTEE_POSITIONS: readonly CommitteePosition[] = [
  { title: 'Pelindung', roles: ["viewer"], division: 'Pembina' },
  { title: 'Penasehat', roles: ["viewer"], division: 'Pembina' },
  { title: 'Ketua Pelaksana', roles: ["event_admin"], division: 'Inti' },
  { title: 'Sekretaris', roles: ["committee"], division: 'Inti' },
  { title: 'Bendahara', roles: ["committee"], division: 'Inti' },
  { title: 'Koordinator Lapangan', roles: ["committee", "attendance_officer"], division: 'Lapangan' },
  { title: 'Bid. Kesekretariatan, Kerjasama dan Pameran', roles: ["committee", "publication_officer"], division: 'Kesekretariatan' },
  { title: 'Bid. Kegiatan', roles: ["committee", "attendance_officer"], division: 'Kegiatan' },
  { title: 'Bid. Perkemahan', roles: ["committee"], division: 'Perkemahan' },
  { title: 'Bid. Keagamaan', roles: ["committee"], division: 'Keagamaan' },
  { title: 'Bid. Sarana, Prasarana dan Keamanan', roles: ["logistic_officer"], division: 'Sarana, Prasarana dan Keamanan' },
  { title: 'Bid. Kesehatan', roles: ["health_officer"], division: 'Kesehatan' },
  { title: 'Bid. Pengawasan dan Evaluasi', roles: ["viewer"], division: 'Pengawasan dan Evaluasi' },
  { title: 'Bid. Konsumsi', roles: ["logistic_officer"], division: 'Konsumsi' },
  { title: 'Bid. Humas', roles: ["publication_officer"], division: 'Humas' },
  { title: 'Bid. Dokumentasi dan Publikasi', roles: ["documentation_officer", "publication_officer"], division: 'Dokumentasi dan Publikasi' },
  { title: 'Sangga Kerja', roles: ["committee"], division: 'Sangga Kerja' },
];
export function normalizeOfficialPosition(value: string): string {
  return value.toLocaleLowerCase('id-ID').trim().replace(/\s+/g, ' ').replace(/[,]/g, '');
}
export function getCommitteePosition(title: string): CommitteePosition | undefined {
  return OFFICIAL_COMMITTEE_POSITIONS.find(item => normalizeOfficialPosition(item.title) === normalizeOfficialPosition(title));
}
