/**
 * @license
 * SiEpang - Public Digital Works Voting Service
 *
 * Votes are authoritative in GAS/Spreadsheet. The browser does not persist
 * vote records in browser storage and never changes a vote count
 * without a successful GAS response.
 */

import { competitionService } from './competitionService';

function createVoterToken(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj && 'randomUUID' in cryptoObj) {
    return `vtr_${cryptoObj.randomUUID().replace(/-/g, '')}`;
  }
  return `vtr_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

class VotingService {
  private voterToken = createVoterToken();
  private votedIds: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();

  public hasVoted(workId: string): boolean {
    const work = competitionService.getDigitalWorks().find(item => item.id === workId);
    return Boolean(work?.hasVoted || this.votedIds.has(workId));
  }

  /**
   * GAS is authoritative. The token only lives in memory for this page
   * lifetime; it is never written to browser storage.
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
        voter_token: this.voterToken,
      },
      { skipAuth: true, timeoutMs: 30000 }
    );

    if (!response.ok || !response.data?.vote) {
      throw new Error(response.error?.message || 'Voting belum berhasil disimpan ke GAS.');
    }

    const result = response.data.vote;
    const newCount = Number(result.new_count ?? work.votesCount) || 0;

    // Do not fabricate the count; it comes from GAS.
    work.votesCount = newCount;
    work.hasVoted = true;
    this.votedIds.add(workId);
    this.notify();

    return {
      voted: true,
      newCount,
      xpAwarded: Number(result.xp_awarded ?? 0) || 0,
    };
  }

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
