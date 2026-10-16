/**
 * @license
 * SiEpang - Public Digital Works Voting Service
 *
 * Anonymous public voting is persisted by GAS. The browser only keeps a
 * voter token so the UI can immediately reflect a vote already made from
 * this browser. The Votes sheet remains the authoritative source.
 */

import { competitionService } from './competitionService';

const VOTER_TOKEN_KEY = 'siepang_public_voter_token_v1';

function createVoterToken(): string {
  try {
    const existing = localStorage.getItem(VOTER_TOKEN_KEY);
    if (existing && existing.length >= 24) return existing;

    const token =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `vtr_${crypto.randomUUID().replace(/-/g, '')}`
        : `vtr_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(VOTER_TOKEN_KEY, token);
    return token;
  } catch {
    return `vtr_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }
}

class VotingService {
  private votedIds: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.hydrateLocalVotes();
  }

  private hydrateLocalVotes() {
    try {
      const raw = localStorage.getItem(`${VOTER_TOKEN_KEY}:votes`);
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        ids.filter((id): id is string => typeof id === 'string').forEach(id => this.votedIds.add(id));
      }
    } catch {}
  }

  private persistLocalVotes() {
    try {
      localStorage.setItem(`${VOTER_TOKEN_KEY}:votes`, JSON.stringify([...this.votedIds]));
    } catch {}
  }

  private getVoterToken(): string {
    return createVoterToken();
  }

  public hasVoted(workId: string): boolean {
    const work = competitionService.getDigitalWorks().find(item => item.id === workId);
    return Boolean(work?.hasVoted || this.votedIds.has(workId));
  }

  /**
   * A public vote is intentionally one-way. There is no client-side "unvote"
   * because removing a vote would make the XP ledger reversible from the
   * browser and would undermine the server-side audit trail.
   */
  public async vote(workId: string): Promise<{
    voted: boolean;
    newCount: number;
    xpAwarded: number;
    isAlreadyVoted?: boolean;
  }> {
    const work = competitionService.getDigitalWorks().find(item => item.id === workId);
    if (!work) throw new Error('Karya tidak ditemukan.');

    if (this.hasVoted(workId)) {
      return {
        voted: false,
        newCount: work.votesCount,
        xpAwarded: 0,
        isAlreadyVoted: true,
      };
    }

    const { apiTransport } = await import('./apiTransport');
    const response = await apiTransport.send<{
      vote: {
        id: string;
        candidate_id: string;
        new_count: number;
        xp_awarded: number;
      };
    }>(
      'votes.public.submit',
      {
        candidate_id: workId,
        voter_token: this.getVoterToken(),
      },
      { skipAuth: true, timeoutMs: 30000 }
    );

    if (!response.ok || !response.data?.vote) {
      throw new Error(response.error?.message || 'Voting belum berhasil disimpan ke GAS.');
    }

    const result = response.data.vote;
    const newCount = Number(result.new_count ?? work.votesCount) || 0;
    work.votesCount = newCount;
    work.hasVoted = true;
    this.votedIds.add(workId);
    this.persistLocalVotes();
    this.notify();

    return {
      voted: true,
      newCount,
      xpAwarded: Number(result.xp_awarded ?? 0) || 0,
    };
  }

  // Backwards-compatible alias for existing callers. Public voting is
  // intentionally one-way; a second click returns "already voted".
  public async toggleVote(workId: string) {
    return this.vote(workId);
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const votingService = new VotingService();
