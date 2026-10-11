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

  public getLeaderboard(): LeaderboardEntry[] {
    const participants = participantService.getParticipants();
    const sorted = [...participants].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    return sorted.map((p, index) => ({
      rank: index + 1,
      id: p.id,
      name: p.name,
      contingentName: p.contingentName,
      avatar: p.photoUrl,
      role: p.role,
      xp: p.xp || 0,
      level: Math.floor((p.xp || 0) / 200) + 1,
      isCurrentUser: false,
    }));
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
    this.transactions = res.data.records.map((r: any) => ({
      id: String(r.id || ''),
      participantId: String(r.participant_id || ''),
      participantName: names.get(String(r.participant_id || '')) || '',
      amount: Number(r.amount || 0),
      reason: String(r.reason || ''),
      category: (['attendance', 'competition', 'peer_appreciation', 'bonus', 'activity'].includes(String(r.source_type))
        ? String(r.source_type) : 'bonus') as XPTransaction['category'],
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
      const referenceId = category === 'peer_appreciation'
        ? `peer:${actor.id}:${participantId}:${now.slice(0, 10)}` : '';
      if (category === 'peer_appreciation') {
        const existing = await apiTransport.send<{ records: any[] }>('admin.entity.list', {
          entity: 'pointTransactions', filters: { reference_id: referenceId },
        });
        if (!existing.ok || !Array.isArray(existing.data?.records)) {
          throw new Error(existing.error?.message || 'Tidak dapat memeriksa apresiasi sebelumnya.');
        }
        if (existing.data.records.length) throw new Error('Anda sudah memberikan apresiasi kepada peserta ini hari ini.');
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
      this.transactions.unshift(tx);
      this.notify();
      return tx;
    } finally {
      this.inFlight.delete(key);
    }
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
