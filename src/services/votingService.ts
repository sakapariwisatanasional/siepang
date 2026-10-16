/**
 * @license
 * SiEpang - Digital Works Voting Service
 */

import { competitionService } from './competitionService';
import { syncQueueService } from '../offline/syncQueueService';
import { localCampServerService } from './localCampServerService';

class VotingService {
  private votedIds: Set<string> = new Set(); // No fabricated prior votes; session-only UI state until server voting is integrated.
  private listeners: Set<() => void> = new Set();

  public hasVoted(workId: string): boolean {
    return this.votedIds.has(workId);
  }

  public async toggleVote(workId: string): Promise<{ voted: boolean; newCount: number; isProvisional: boolean }> {
    const works = competitionService.getDigitalWorks();
    const work = works.find(w => w.id === workId);
    if (!work) throw new Error('Karya tidak ditemukan');

    const currentlyVoted = this.votedIds.has(workId);
    const isOffline = syncQueueService.getConnectionState() === 'offline';
    const isProvisional = isOffline || localCampServerService.getOperationalMode() !== 'cloud';

    if (currentlyVoted) {
      this.votedIds.delete(workId);
      work.votesCount = Math.max(0, work.votesCount - 1);
      work.hasVoted = false;
    } else {
      this.votedIds.add(workId);
      work.votesCount += 1;
      work.hasVoted = true;

      // Add to centralized offline transaction engine with UUID and provisional mark
      syncQueueService.enqueueTransaction({
        entity: 'vote',
        action: 'VOTE',
        record_id: workId,
        payload: {
          workId,
          workTitle: work.title,
          currentVoteCount: this.votedIds.size,
          maxVotes: 3,
          isProvisional,
          timestamp: new Date().toISOString(),
        },
      });
    }

    this.notify();
    return { voted: !currentlyVoted, newCount: work.votesCount, isProvisional };
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

export const votingService = new VotingService();
