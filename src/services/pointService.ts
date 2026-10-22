/**
 * @license
 * SiEpang - Gamification, XP & Peer Appreciation Service
 */

import { XPTransaction, LeaderboardEntry, Badge, PeerAppreciationType } from '../types';
import { apiTransport } from './apiTransport';
import { eventService } from './eventService';
import { authService } from './authService';
import { participantService } from './participantService';

export const PEER_APPRECIATIONS: { type: PeerAppreciationType; xp: number; icon: string; label: string }[] = [
  { type: 'Helpful', xp: 25, icon: 'Handshake', label: 'Siaga Menolong' },
  { type: 'Friendly', xp: 20, icon: 'Smile', label: 'Ramah & Bersahabat' },
  { type: 'Scout Spirit', xp: 35, icon: 'Flame', label: 'Semangat Tri Satya' },
  { type: 'Inspiring', xp: 30, icon: 'Lightbulb', label: 'Kreatif & Inspiratif' },
  { type: 'Eco Action', xp: 30, icon: 'Leaf', label: 'Peduli Lingkungan' },
];

class PointService {
  private transactions: XPTransaction[] = [];
  private leaderboardEntries: LeaderboardEntry[] = [];
  private badges: Badge[] = [];
  private listeners: Set<() => void> = new Set();
  private inFlight = new Set<string>();

  public getBadges(): Badge[] {
    return this.badges;
  }

  public getTransactions(participantId?: string): XPTransaction[] {
    if (participantId) {
      return this.transactions.filter(t => t.participantId === participantId);
    }
    return this.transactions;
  }

  /**
   * Primary source of truth calculated from authoritative ledger transactions (Req 10)
   */
  public getParticipantTotalXP(participantId: string): number {
    return this.transactions
      .filter(t => t.participantId === participantId)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /** Leaderboard cache is populated only by the authenticated GAS ledger endpoint. */
  public getLeaderboard(): LeaderboardEntry[] {
    return [...this.leaderboardEntries];
  }

  public async refreshLeaderboard(): Promise<LeaderboardEntry[]> {
    const res = await apiTransport.send<{ entries: any[] }>('points.leaderboard', {});
    if (!res.ok || !Array.isArray(res.data?.entries)) {
      throw new Error(res.error?.message || 'Gagal memuat leaderboard dari GAS.');
    }
    const currentUser = authService.getCurrentUser();
    const currentCode = String(currentUser?.participantCode || '');
    this.leaderboardEntries = res.data.entries.map((entry: any, index: number): LeaderboardEntry => ({
      rank: Number(entry.rank || index + 1),
      id: String(entry.id || ''),
      name: String(entry.name || 'Peserta'),
      contingentName: String(entry.contingentName || ''),
      avatar: String(entry.avatar || ''),
      role: String(entry.role || 'Peserta'),
      xp: Number(entry.xp || 0),
      level: Number(entry.level || (Math.floor(Number(entry.xp || 0) / 200) + 1)),
      isCurrentUser: !!currentCode && String(entry.code || '') === currentCode,
    }));
    this.notify();
    return this.getLeaderboard();
  }

  /** Refresh the point ledger from GAS, rather than treating local XP as proof. */
  public async refreshTransactions(): Promise<XPTransaction[]> {
    const res = await apiTransport.send<{ records: any[] }>('admin.entity.list', {
      entity: 'pointTransactions', filters: {},
    });
    if (!res.ok || !Array.isArray(res.data?.records)) {
      throw new Error(res.error?.message || 'Gagal membaca PointTransactions dari GAS.');
    }
    const names = new Map(participantService.getParticipants().map(p => [p.id, p.name]));
    const seen = new Set<string>();
    const uniqueRows = res.data.records.filter((r: any) => {
      if (String(r.source_type) !== 'peer_appreciation') return true;
      const giver = String(r.created_by || '');
      const reason = String(r.reason || '');
      const key = `${r.event_id}|${giver}|${r.participant_id}|${reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.transactions = uniqueRows.map((r: any) => ({
      id: String(r.id || ''),
      participantId: String(r.participant_id || ''),
      participantName: names.get(String(r.participant_id || '')) || '',
      amount: Number(r.amount || 0),
      reason: String(r.reason || ''),
      category: (['attendance', 'competition', 'peer_appreciation', 'bonus', 'activity'].includes(String(r.source_type))
        ? String(r.source_type) : 'bonus') as XPTransaction['category'],
      sourceType: String(r.source_type || ''),
      timestamp: String(r.created_at || ''),
    }));
    this.notify();
    return this.getTransactions();
  }

  public async awardXP(
    participantId: string,
    participantName: string,
    amount: number,
    reason: string,
    category: XPTransaction['category']
  ): Promise<XPTransaction> {
    if (!participantId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Identitas peserta atau nilai XP tidak valid.');
    }
    if (!eventService.getCurrentEvent()?.id) throw new Error('Event aktif tidak tersedia.');
    const actor = authService.getCurrentUser();
    if (!actor?.id) throw new Error('Petugas harus login sebelum memberikan XP.');
    const key = `${participantId}:${category}:${reason}:${actor.id}`;
    if (this.inFlight.has(key)) throw new Error('Pemberian XP sedang diproses.');
    this.inFlight.add(key);
    try {
      const now = new Date().toISOString();
      const peerKind = PEER_APPRECIATIONS.find(a => `Apresiasi Kawan: ${a.label}` === reason)?.type;
      if (category === 'peer_appreciation' && !peerKind) throw new Error('Jenis apresiasi tidak dikenal.');
      const referenceId = category === 'peer_appreciation'
        ? `peer:${eventService.getCurrentEvent()?.id}:${actor.id}:${participantId}:${peerKind}` : '';
      if (category === 'peer_appreciation') {
        // List all transactions so legacy (date-scoped) references are checked too.
        const existing = await apiTransport.send<{ records: any[] }>('admin.entity.list', {
          entity: 'pointTransactions', filters: { participant_id: participantId },
        });
        if (!existing.ok || !Array.isArray(existing.data?.records)) {
          throw new Error(existing.error?.message || 'Tidak dapat memeriksa apresiasi sebelumnya.');
        }
        if (existing.data.records.some(r =>
          r.source_type === 'peer_appreciation' && String(r.created_by) === actor.id &&
          String(r.reason) === reason
        )) throw new Error('Apresiasi ini sudah pernah Anda berikan kepada peserta tersebut.');
        if (actor.participantCode) {
          const target = participantService.getParticipants().find(p => p.id === participantId);
          if (target?.code === actor.participantCode) throw new Error('Tidak boleh memberikan apresiasi kepada diri sendiri.');
        }
      }
      const saved = await apiTransport.send<{ record: any }>('admin.entity.upsert', {
        entity: 'pointTransactions',
        record: {
          event_id: eventService.getCurrentEvent()?.id,
          participant_id: participantId,
          amount,
          reason,
          source_type: category,
          reference_id: referenceId,
          created_at: now,
          created_by: actor.id,
        },
      });
      const row = saved.data?.record;
      if (!saved.ok || !row?.id || String(row.participant_id) !== participantId || Number(row.amount) !== amount) {
        throw new Error(saved.error?.message || 'GAS belum mengonfirmasi transaksi XP.');
      }
      const tx: XPTransaction = {
        id: String(row.id), participantId, participantName,
        amount: Number(row.amount), reason: String(row.reason || reason),
        category, timestamp: String(row.created_at || now),
      };
      await this.refreshTransactions();
      return tx;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Read the server ledger and return types already granted by the logged-in giver. */
  public async getGivenAppreciationTypes(participantId: string): Promise<PeerAppreciationType[]> {
    const actor = authService.getCurrentUser();
    if (!actor?.id) throw new Error('Silakan login sebelum memberi apresiasi.');
    const result = await apiTransport.send<{ records: any[] }>('admin.entity.list', {
      entity: 'pointTransactions', filters: { participant_id: participantId },
    });
    if (!result.ok || !Array.isArray(result.data?.records)) {
      throw new Error(result.error?.message || 'Riwayat apresiasi belum berhasil dibaca dari GAS.');
    }
    return PEER_APPRECIATIONS.filter(a => result.data!.records.some((r: any) =>
      String(r.source_type) === 'peer_appreciation' && String(r.created_by) === actor.id &&
      String(r.reason) === `Apresiasi Kawan: ${a.label}`
    )).map(a => a.type);
  }

  public async givePeerAppreciation(
    targetParticipantId: string,
    targetParticipantName: string,
    type: PeerAppreciationType
  ): Promise<XPTransaction> {
    const config = PEER_APPRECIATIONS.find(a => a.type === type);
    if (!config) throw new Error('Jenis apresiasi tidak dikenal.');
    return this.awardXP(
      targetParticipantId,
      targetParticipantName,
      config.xp,
      `Apresiasi Kawan: ${config.label}`,
      'peer_appreciation'
    );
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

export const pointService = new PointService();
