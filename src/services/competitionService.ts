/**
 * @license
 * SiEpang - Competition, Team & Judging Service v1.1
 * Authoritative scoring calculation, rubric weights, score locking,
 * admin reopen with audit, team member registration, and winner confirmation.
 */

import { Competition, DigitalWork } from '../types';
import { pointService } from './pointService';
import { documentService } from './documentService';
import { apiTransport } from './apiTransport';

export type ScoreLifecycleStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

export interface JudgeScoreRecord {
  id: string;
  competitionId: string;
  entryId: string;
  judgeId: string;
  judgeName: string;
  contingentName: string;
  scores: Record<string, number>;
  totalScore: number;
  notes: string;
  status: ScoreLifecycleStatus;
  updatedAt: string;
  lockedAt?: string;
  reopenedBy?: string;
  reopenedReason?: string;
}

export interface CompetitionTeam {
  teamId: string;
  competitionId: string;
  contingentId: string;
  contingentName: string;
  teamName: string;
  memberIds: string[];
  memberNames: string[];
  registeredAt: string;
}

export interface CompetitionWinnerResult {
  competitionId: string;
  competitionTitle: string;
  winner1: { entryId: string; title: string; contingent: string; score: number };
  winner2?: { entryId: string; title: string; contingent: string; score: number };
  winner3?: { entryId: string; title: string; contingent: string; score: number };
  specialAward?: { entryId: string; awardName: string; contingent: string };
  isPublished: boolean;
  finalizedAt: string;
  finalizedBy: string;
}

// Backwards compatibility alias
export interface JudgeScoreSubmission extends JudgeScoreRecord {}

class CompetitionService {
  private competitions: Competition[] = [];
  private digitalWorks: DigitalWork[] = [];
  private scores: JudgeScoreRecord[] = [];
  private teams: CompetitionTeam[] = [];
  private winnerResults: Map<string, CompetitionWinnerResult> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.scores = [];
  }

  public getCompetitions(): Competition[] {
    return this.competitions;
  }

  public getDigitalWorks(filterCategory?: string): DigitalWork[] {
    if (filterCategory && filterCategory !== 'all') {
      return this.digitalWorks.filter(w => w.competitionId === filterCategory);
    }
    return this.digitalWorks;
  }


  /**
   * Public Unjuk Karya feed.
   *
   * The browser never fabricates entries. GAS returns only entries that are
   * explicitly published for the authoritative active event.
   */
  public async refreshPublicDigitalWorks(): Promise<DigitalWork[]> {
    const response = await apiTransport.send<{ works: any[] }>(
      'competitions.public.works.list',
      {},
      { skipAuth: true, timeoutMs: 30000 }
    );

    if (!response.ok || !Array.isArray(response.data?.works)) {
      throw new Error(
        response.error?.message || 'Karya peserta belum dapat dimuat dari GAS.'
      );
    }

    this.digitalWorks = response.data.works.map((raw: any): DigitalWork => ({
      id: String(raw.id || ''),
      competitionId: String(raw.competitionId || raw.competition_id || ''),
      competitionTitle: String(raw.competitionTitle || raw.competition_title || ''),
      title: String(raw.title || raw.entry_title || 'Karya Peserta'),
      creatorName: String(raw.creatorName || raw.creator_name || ''),
      contingentName: String(raw.contingentName || raw.contingent_name || ''),
      mediaType: (
        ['photo', 'video', 'poster'].includes(String(raw.mediaType || raw.media_type))
          ? String(raw.mediaType || raw.media_type)
          : 'video'
      ) as DigitalWork['mediaType'],
      thumbnailUrl: String(raw.thumbnailUrl || raw.thumbnail_url || ''),
      originalUrl: String(raw.originalUrl || raw.original_url || raw.submission_url || ''),
      description: String(raw.description || ''),
      votesCount: Number(raw.votesCount ?? raw.votes_count ?? 0) || 0,
      hasVoted: Boolean(raw.hasVoted ?? raw.has_voted ?? false),
      submittedAt: String(raw.submittedAt || raw.submitted_at || ''),
    })).filter(work => work.id && work.originalUrl);

    this.notify();
    return this.getDigitalWorks();
  }

  public async submitDigitalWork(work: Omit<DigitalWork, 'id' | 'votesCount' | 'hasVoted' | 'submittedAt'>): Promise<DigitalWork> {
    const newWork: DigitalWork = {
      ...work,
      id: `work_${Date.now()}`,
      votesCount: 0,
      hasVoted: false,
      submittedAt: new Date().toISOString(),
    };
    this.digitalWorks.unshift(newWork);
    this.notify();
    return newWork;
  }

  // ==================== SCORING & WEIGHTED CALCULATION ====================

  public submitJudgeScore(scoreData: {
    competitionId: string;
    entryId: string;
    judgeId?: string;
    judgeName?: string;
    contingentName: string;
    scores: Record<string, number>;
    totalScore?: number;
    notes: string;
    status?: ScoreLifecycleStatus;
  }): JudgeScoreRecord {
    // Authoritative weighted calculation
    const values = Object.values(scoreData.scores);
    const sum = values.reduce((a, b) => a + (Number(b) || 0), 0);
    const weightedTotal = scoreData.totalScore !== undefined
      ? scoreData.totalScore
      : (values.length > 0 ? Math.round((sum / values.length) * 10) / 10 : 0);

    const existingIdx = this.scores.findIndex(
      s => s.competitionId === scoreData.competitionId && s.entryId === scoreData.entryId
    );

    const record: JudgeScoreRecord = {
      id: existingIdx !== -1 ? this.scores[existingIdx].id : `scr_${Date.now()}`,
      competitionId: scoreData.competitionId,
      entryId: scoreData.entryId,
      judgeId: scoreData.judgeId || 'jdg_current',
      judgeName: scoreData.judgeName || 'Dewan Juri',
      contingentName: scoreData.contingentName,
      scores: scoreData.scores,
      totalScore: weightedTotal,
      notes: scoreData.notes || '',
      status: scoreData.status || 'SUBMITTED',
      updatedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    if (existingIdx !== -1) {
      this.scores[existingIdx] = record;
    } else {
      this.scores.unshift(record);
    }

    this.notify();
    return record;
  }

  public lockScore(scoreId: string): void {
    const s = this.scores.find(score => score.id === scoreId);
    if (!s) throw new Error('Nilai juri tidak ditemukan');
    s.status = 'LOCKED';
    s.lockedAt = new Date().toLocaleString('id-ID');
    this.notify();
  }

  public reopenScore(scoreId: string, reason: string, adminName: string): void {
    const s = this.scores.find(score => score.id === scoreId);
    if (!s) throw new Error('Nilai juri tidak ditemukan');
    s.status = 'DRAFT';
    s.reopenedBy = adminName;
    s.reopenedReason = reason;
    this.notify();
  }

  public getAllScores(): JudgeScoreRecord[] {
    return this.scores;
  }

  public getJudgeScores(competitionId: string): JudgeScoreRecord[] {
    return this.scores.filter(s => s.competitionId === competitionId);
  }

  // ==================== TEAM REGISTRATION ====================

  public registerTeam(teamData: {
    competitionId: string;
    contingentId: string;
    contingentName: string;
    teamName: string;
    memberIds: string[];
    memberNames: string[];
  }): CompetitionTeam {
    if (teamData.memberIds.length < 2) {
      throw new Error('Regu/Tim lomba minimal harus beranggotakan 2 orang peserta.');
    }

    const team: CompetitionTeam = {
      teamId: `tm_${Date.now()}`,
      ...teamData,
      registeredAt: new Date().toLocaleDateString('id-ID'),
    };

    this.teams.push(team);
    this.notify();
    return team;
  }

  public getTeams(competitionId?: string): CompetitionTeam[] {
    if (competitionId) {
      return this.teams.filter(t => t.competitionId === competitionId);
    }
    return this.teams;
  }

  // ==================== WINNER FINALIZATION ====================

  public finalizeWinners(result: CompetitionWinnerResult): void {
    this.winnerResults.set(result.competitionId, result);

    // If published, trigger points & certificates eligibility
    if (result.isPublished) {
      // Award Winner 1 XP
      pointService.awardXP(
        result.winner1.entryId,
        result.winner1.contingent,
        150,
        `Juara 1: ${result.competitionTitle}`,
        'competition'
      );
    }

    this.notify();
  }

  public getWinnerResult(competitionId: string): CompetitionWinnerResult | undefined {
    return this.winnerResults.get(competitionId);
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

export const competitionService = new CompetitionService();
