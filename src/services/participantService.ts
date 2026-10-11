/**
 * @license
 * SiEpang - Participant & Contingent Service
 */

import { Participant, Contingent, ParticipantStatus } from '../types';
import { syncQueue } from '../offline/syncQueue';
import { eventService } from './eventService';
import { apiTransport } from './apiTransport';

/**
 * Resolve legacy Drive photo URLs without changing source records.
 * If a permanent Drive file_id exists, the canonical Googleusercontent URL wins.
 * Empty or invalid sources are left blank so the UI can show initials.
 */
function resolveParticipantPhotoUrl(raw: any): string {
  const fileId = String(raw?.profile_photo_file_id || '').trim();
  if (/^[A-Za-z0-9_-]{15,}$/.test(fileId)) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
  }
  const candidate = String(raw?.profile_photo_url || raw?.photoUrl || raw?.photo_url || '').trim();
  if (!candidate || candidate.startsWith('data:') || candidate.startsWith('blob:')) return '';
  if (!/^https:\/\//i.test(candidate)) return '';
  // Convert former Drive sharing links to a canonical image URL, if possible.
  try {
    const parsed = new URL(candidate);
    if (parsed.hostname === 'drive.google.com') {
      const match = parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{15,})/);
      const oldId = match?.[1] || parsed.searchParams.get('id') || '';
      return /^[A-Za-z0-9_-]{15,}$/.test(oldId)
        ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(oldId)}`
        : '';
    }
    if (parsed.hostname === 'lh3.googleusercontent.com' || parsed.hostname === 'googleusercontent.com') return candidate;
    // Preserve existing HTTPS image URLs used in other modules.
    return candidate;
  } catch { return ''; }
}

class ParticipantService {
  private participants: Participant[] = [];
  private contingents: Contingent[] = [];
  private listeners: Set<() => void> = new Set();
  private participantsLoadInFlight: Promise<void> | null = null;
  // Hanya mempercepat tampilan identitas QR. Operasi tulis tetap divalidasi GAS.
  private scannerLastLoadedAt = 0;
  private scannerLoadedEventId = '';

  /** Gunakan hasil pembacaan baru untuk scanner; setelah TTL, periksa kembali GAS. */
  public ensureScannerParticipantsFresh(maxAgeMs = 90000): Promise<void> {
    const eventId = eventService.getCurrentEvent()?.id || '';
    if (this.participantsLoadInFlight) return this.participantsLoadInFlight;
    if (this.scannerLastLoadedAt > 0 &&
        this.scannerLoadedEventId === eventId &&
        Date.now() - this.scannerLastLoadedAt < maxAgeMs) {
      return Promise.resolve();
    }
    return this.loadParticipants();
  }

  /** Load daftar peserta dari GAS; jangan menganggap array lokal sebagai sumber data utama. */
  public loadParticipants(): Promise<void> {
    if (this.participantsLoadInFlight) return this.participantsLoadInFlight;
    const pending = this.fetchParticipantsFromGas();
    this.participantsLoadInFlight = pending;
    void pending.finally(() => {
      if (this.participantsLoadInFlight === pending) this.participantsLoadInFlight = null;
    }).catch(() => {});
    return pending;
  }

  private async fetchParticipantsFromGas(): Promise<void> {
    const result = await apiTransport.send<any>('participants.list', {});
    if (!result.ok) {
      throw new Error(result.error?.message || 'Gagal membaca peserta dari GAS.');
    }
    const rows = result.data?.participants;
    if (!Array.isArray(rows)) {
      throw new Error('Respons participants.list tidak memuat array participants.');
    }
    this.participants = rows.filter((r:any) => String(r.active_status || r.activeStatus || '').toUpperCase() !== 'ARCHIVED').map((r: any, index: number): Participant => {
      const rawStatus = String(r.verification_status || r.verificationStatus || 'SUBMITTED').toUpperCase();
      const status: ParticipantStatus = rawStatus === 'APPROVED' ? 'approved'
        : rawStatus === 'VERIFIED' ? 'verified'
        : rawStatus === 'REJECTED' ? 'rejected'
        : rawStatus === 'REVISION' || rawStatus === 'NEEDS_REVISION' ? 'revision'
        : rawStatus === 'DRAFT' ? 'draft' : 'submitted';
      const code = String(r.code || r.participantCode || r.pramuka_id || r.pramukaId || r.id);
      return {
        id: String(r.id),
        eventId: String(r.eventId || r.event_id || ''),
        code,
        name: String(r.name || r.fullName || ''),
        gender: String(r.gender || 'M').toUpperCase() === 'F' ? 'F' : 'M',
        role: (r.scoutLevel || r.scout_level || 'Penggalang') as Participant['role'],
        contingentId: String(r.contingentId || r.contingent_id || ''),
        contingentName: String(r.contingentName || r.institution || '-'),
        subCamp: String(r.subcamp || r.subCamp || '-'),
        tentNumber: String(r.lotNumber || r.lot_number || '-'),
        photoUrl: resolveParticipantPhotoUrl(r),
        profile_photo_file_id: String(r.profile_photo_file_id || ''),
        profile_photo_url: resolveParticipantPhotoUrl(r),
        profile_photo_status: r.profile_photo_status || 'NOT_UPLOADED',
        status,
        checkedIn: r.checkedIn === true || r.checked_in === true,
        checkInTime: r.checkedInAt || r.checked_in_at || undefined,
        xp: Number(r.points || 0),
        level: 1,
        rank: Number(r.rank || index + 1),
        attendanceCount: 0,
        badges: [],
        membershipNumber: String(r.pramukaId || r.pramuka_id || ''),
        email: String(r.email || ''),
        phone: String(r.phone || ''),
        schoolPangkalan: String(r.institution || ''),
      };
    });
    this.scannerLastLoadedAt = Date.now();
    this.scannerLoadedEventId = eventService.getCurrentEvent()?.id || '';
    this.notify();
  }

  public getParticipants(filters?: {
    search?: string;
    contingentId?: string;
    status?: ParticipantStatus | 'all';
    checkedIn?: boolean;
  }): Participant[] {
    let result = [...this.participants];

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.contingentName.toLowerCase().includes(q)
      );
    }

    if (filters?.contingentId && filters.contingentId !== 'all') {
      result = result.filter(p => p.contingentId === filters.contingentId);
    }

    if (filters?.status && filters.status !== 'all') {
      result = result.filter(p => p.status === filters.status);
    }

    if (filters?.checkedIn !== undefined) {
      result = result.filter(p => p.checkedIn === filters.checkedIn);
    }

    return result;
  }

  public getParticipantByCode(code: string): Participant | undefined {
    return this.participants.find(p => p.code.toLowerCase() === code.toLowerCase().trim());
  }

  public getContingents(): Contingent[] {
    return this.contingents;
  }

  public getContingentById(id: string): Contingent | undefined {
    return this.contingents.find(c => c.id === id || c.contingent_id === id);
  }

  public createContingent(data: Partial<Contingent>): Contingent {
    const id = data.id || `ctg_${Date.now()}`;
    const newContingent: Contingent = {
      id,
      contingent_id: id,
      name: data.name || 'Kontingen Baru',
      contingent_name: data.name || 'Kontingen Baru',
      region: data.region || 'Wilayah Penyelenggara',
      leaderName: data.leaderName || data.leader || 'Pembina Kontingen',
      leader: data.leaderName || data.leader || 'Pembina Kontingen',
      leaderPhone: data.leaderPhone || data.contact || '0812-0000-0000',
      contact: data.leaderPhone || data.contact || '0812-0000-0000',
      participantCount: 0,
      participant_count: 0,
      quota: data.quota || 32,
      maleCount: 0,
      femaleCount: 0,
      advisorCount: 2,
      verifiedCount: 0,
      checkedInCount: 0,
      campZone: data.campZone || 'Zona A',
      subCamp: data.subCamp || 'Kavling A-01',
      campsite_assignment: data.campsite_assignment || 'Kavling A-01',
      verification_status: 'VERIFIED',
      totalXp: 0,
      organization_id: data.organization_id || 'org_kwarran_glagah',
      contingent_level: data.contingent_level || 'KWARRAN',
    };
    this.contingents.push(newContingent);
    this.notify();
    return newContingent;
  }

  public updateContingent(id: string, updates: Partial<Contingent>): Contingent {
    const ctg = this.contingents.find(c => c.id === id || c.contingent_id === id);
    if (!ctg) throw new Error(`Kontingen '${id}' tidak ditemukan`);
    Object.assign(ctg, updates);
    this.notify();
    return ctg;
  }

  // ==================== VERIFICATION & STATUS HISTORY ====================

  public verifyParticipant(participantId: string, verifiedBy: string): Participant {
    const p = this.participants.find(part => part.id === participantId);
    if (!p) throw new Error('Peserta tidak ditemukan');

    const prev = p.status;
    p.status = 'verified';
    this.recordStatusHistory(p, prev, 'verified', verifiedBy, 'Dokumen KTA, asuransi, dan izin orang tua lengkap.');
    this.notify();
    return p;
  }

  public approveParticipant(participantId: string, approvedBy: string): Participant {
    const p = this.participants.find(part => part.id === participantId);
    if (!p) throw new Error('Peserta tidak ditemukan');

    const prev = p.status;
    p.status = 'approved';
    this.recordStatusHistory(p, prev, 'approved', approvedBy, 'Persetujuan akhir kepesertaan perkemahan.');
    this.notify();
    return p;
  }

  public requestRevision(participantId: string, reason: string, officerName: string): Participant {
    const p = this.participants.find(part => part.id === participantId);
    if (!p) throw new Error('Peserta tidak ditemukan');

    const prev = p.status;
    p.status = 'revision';
    p.revisionReason = reason;
    this.recordStatusHistory(p, prev, 'revision', officerName, reason);
    this.notify();
    return p;
  }

  public rejectParticipant(participantId: string, reason: string, officerName: string): Participant {
    const p = this.participants.find(part => part.id === participantId);
    if (!p) throw new Error('Peserta tidak ditemukan');

    const prev = p.status;
    p.status = 'rejected';
    p.revisionReason = reason;
    this.recordStatusHistory(p, prev, 'rejected', officerName, reason);
    this.notify();
    return p;
  }

  private recordStatusHistory(
    participant: Participant,
    previous: string,
    next: string,
    actor: string,
    reason?: string
  ): void {
    if (!participant.statusHistory) {
      participant.statusHistory = [];
    }
    participant.statusHistory.unshift({
      participant_id: participant.id,
      previous_status: previous,
      new_status: next,
      changed_by: actor,
      reason,
      timestamp: new Date().toLocaleString('id-ID'),
    });
  }

  public getStatusHistory(participantId: string) {
    const p = this.participants.find(part => part.id === participantId);
    return p?.statusHistory || [];
  }

  // ==================== DUPLICATE DETECTION ====================

  public detectDuplicates(candidate: Partial<Participant>): {
    isDuplicate: boolean;
    reason?: string;
    matchedParticipant?: Participant;
  } {
    // 1. By membership number / NTA
    if (candidate.membershipNumber) {
      const match = this.participants.find(
        p => p.id !== candidate.id && p.membershipNumber && p.membershipNumber.trim() === candidate.membershipNumber?.trim()
      );
      if (match) {
        return { isDuplicate: true, reason: `Nomor KTA/NTA '${candidate.membershipNumber}' sudah digunakan oleh ${match.name}`, matchedParticipant: match };
      }
    }

    // 2. By Name + Contingent
    if (candidate.name && candidate.contingentName) {
      const match = this.participants.find(
        p =>
          p.id !== candidate.id &&
          p.name.trim().toLowerCase() === candidate.name?.trim().toLowerCase() &&
          p.contingentName.trim().toLowerCase() === candidate.contingentName?.trim().toLowerCase()
      );
      if (match) {
        return { isDuplicate: true, reason: `Nama '${candidate.name}' sudah terdaftar dalam kontingen ${candidate.contingentName}`, matchedParticipant: match };
      }
    }

    // 3. By Email or Phone
    if (candidate.email) {
      const match = this.participants.find(
        p => p.id !== candidate.id && p.email && p.email.trim().toLowerCase() === candidate.email?.trim().toLowerCase()
      );
      if (match) {
        return { isDuplicate: true, reason: `Email '${candidate.email}' sudah terdaftar pada ${match.name}`, matchedParticipant: match };
      }
    }

    return { isDuplicate: false };
  }

  // ==================== CSV / SPREADSHEET IMPORT ====================

  public importParticipants(
    rows: any[],
    importedBy: string
  ): {
    accepted: number;
    needsReview: number;
    rejected: number;
    duplicatesCount: number;
    importedList: Participant[];
  } {
    let accepted = 0;
    let needsReview = 0;
    let rejected = 0;
    let duplicatesCount = 0;
    const importedList: Participant[] = [];

    rows.forEach((row, idx) => {
      const name = row.name || row.Nama || row['Nama Lengkap'];
      if (!name || name.trim().length < 2) {
        rejected++;
        return;
      }

      const dupCheck = this.detectDuplicates({
        name,
        membershipNumber: row.membershipNumber || row.NTA || row.KTA,
        contingentName: row.contingentName || row.Kontingen || 'Kontingen',
        email: row.email || row.Email,
      });

      const isDuplicate = dupCheck.isDuplicate;
      if (isDuplicate) {
        duplicatesCount++;
        needsReview++;
      } else {
        accepted++;
      }

      const activeEvent = eventService.getCurrentEvent();
      const eventCodePrefix = activeEvent.eventCode || 'PST';

      const newP: Participant = {
        id: `p_imp_${Date.now()}_${idx}`,
        code: `${eventCodePrefix}-${String(this.participants.length + 1).padStart(4, '0')}`,
        name: name.trim(),
        gender: (row.gender || row['Jenis Kelamin'] || 'M').toUpperCase().startsWith('P') ? 'F' : 'M',
        role: row.role || row.Tingkatan || 'Penggalang',
        contingentId: row.contingentId || `ctg_${Date.now()}`,
        contingentName: row.contingentName || row.Kontingen || 'Kontingen',
        subCamp: row.subCamp || 'Bumi Perkemahan',
        tentNumber: row.tentNumber || 'Tenda 1',
        photoUrl: row.photoUrl || '',
        status: isDuplicate ? 'revision' : 'submitted',
        checkedIn: false,
        xp: 100,
        level: 1,
        rank: this.participants.length + 1,
        attendanceCount: 0,
        badges: ['badge_spirit'],
        membershipNumber: row.membershipNumber || row.NTA || row.KTA || `NTA-${Date.now()}`,
        email: row.email || row.Email || '',
        phone: row.phone || row.Telepon || '',
        isPossibleDuplicate: isDuplicate,
        revisionReason: isDuplicate ? dupCheck.reason : undefined,
      };

      this.participants.unshift(newP);
      importedList.push(newP);
    });

    this.notify();
    return { accepted, needsReview, rejected, duplicatesCount, importedList };
  }

  // ==================== BULK ACTIONS ====================

  public bulkApprove(ids: string[], actor: string): number {
    let count = 0;
    ids.forEach(id => {
      const p = this.participants.find(part => part.id === id);
      if (p) {
        const prev = p.status;
        p.status = 'approved';
        this.recordStatusHistory(p, prev, 'approved', actor, 'Bulk approval oleh administrator');
        count++;
      }
    });
    this.notify();
    return count;
  }

  public bulkAssignContingent(ids: string[], contingentId: string, contingentName: string): number {
    let count = 0;
    ids.forEach(id => {
      const p = this.participants.find(part => part.id === id);
      if (p) {
        p.contingentId = contingentId;
        p.contingentName = contingentName;
        count++;
      }
    });
    this.notify();
    return count;
  }

  public bulkAssignCategory(ids: string[], role: Participant['role']): number {
    let count = 0;
    ids.forEach(id => {
      const p = this.participants.find(part => part.id === id);
      if (p) {
        p.role = role;
        count++;
      }
    });
    this.notify();
    return count;
  }

  public bulkArchive(ids: string[]): number {
    this.participants = this.participants.filter(p => !ids.includes(p.id));
    this.notify();
    return ids.length;
  }

  // ==================== CONTINGENT CHECK-IN ====================

  public contingentCheckIn(
    contingentId: string,
    officerName: string,
    exceptionIds: string[] = []
  ): { checkedInCount: number; exceptionsCount: number } {
    let checkedInCount = 0;
    let exceptionsCount = 0;

    this.participants.forEach(p => {
      if (p.contingentId === contingentId) {
        if (exceptionIds.includes(p.id)) {
          exceptionsCount++;
        } else {
          p.checkedIn = true;
          p.checkInTime = new Date().toISOString();
          checkedInCount++;
        }
      }
    });

    const ctg = this.contingents.find(c => c.id === contingentId || c.contingent_id === contingentId);
    if (ctg) {
      ctg.checkedInCount = checkedInCount;
    }

    this.notify();
    return { checkedInCount, exceptionsCount };
  }

  private checkInInFlight = new Set<string>();

  /** Check-in is successful only after GAS confirms the updated Participants row. */
  public async checkIn(participantId: string): Promise<Participant> {
    if (!participantId) throw new Error('ID peserta tidak valid.');
    if (this.checkInInFlight.has(participantId)) throw new Error('Check-in peserta ini sedang diproses.');
    this.checkInInFlight.add(participantId);
    try {
      // Never trust a potentially stale browser cache for a gate operation.
      await this.loadParticipants();
      const participant = this.participants.find(p => p.id === participantId);
      if (!participant) throw new Error('Peserta tidak ditemukan di GAS.');
      if (participant.checkedIn) throw new Error(`Peserta ${participant.name} sudah check-in sebelumnya.`);
      const eventId = eventService.getCurrentEvent()?.id || participant.eventId;
      if (!eventId || (participant.eventId && participant.eventId !== eventId)) {
        throw new Error('Event aktif tidak sesuai dengan event peserta.');
      }
      const when = new Date().toISOString();
      const response = await apiTransport.send<{ record: any }>('admin.entity.upsert', {
        entity: 'participants',
        record: { id: participantId, event_id: eventId, checked_in: true, checked_in_at: when },
      });
      if (!response.ok || !response.data?.record ||
          String(response.data.record.id) !== participantId ||
          !(['true','1'].includes(String(response.data.record.checked_in).toLowerCase()) || response.data.record.checked_in === true)) {
        throw new Error(response.error?.message || 'GAS belum mengonfirmasi check-in peserta.');
      }
      participant.checkedIn = true;
      participant.checkInTime = String(response.data.record.checked_in_at || when);
      this.notify();
      return participant;
    } finally {
      this.checkInInFlight.delete(participantId);
    }
  }

  /** Jalur lama dimatikan agar pemanggil tidak mengirim participants.create yang tidak dikenal GAS. */
  public async addParticipant(_data: Omit<Participant, 'id' | 'code' | 'xp' | 'level' | 'rank' | 'attendanceCount' | 'badges'>): Promise<Participant> {
    throw new Error('Registrasi peserta harus melalui Gudep dan Regu. Gunakan gudepRegistrationService.registerParticipant(), bukan participants.create.');
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

export const participantService = new ParticipantService();
