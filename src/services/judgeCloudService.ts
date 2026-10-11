/** SiEpang — Cloud judging persistence. All writes confirmed by GAS. */
import { apiTransport } from './apiTransport';
import { authService } from './authService';

export type EntryRecord = {
  id: string; competition_id: string; contingent_id?: string; team_name?: string;
  team_leader_id?: string; team_members_json?: string | string[];
  entry_title?: string; status?: string;
};
export type ScoreRecord = {
  id: string; competition_id: string; entry_id: string; judge_id: string;
  score: number; criteria_scores_json: Record<string, number> | string;
  is_locked: boolean | string; locked_at?: string; submitted_at?: string;
  revision_number?: number; revision_reason?: string;
};
export type Criteria = { kreativitas: number; kesesuaianTema: number; teknikPramuka: number; kerapian: number };
const unwrap = <T>(result: any, name: string): T[] => {
  if (!result.ok) throw new Error(result.error?.message || `Gagal mengambil ${name} dari GAS.`);
  const rows = result.data?.records;
  if (!Array.isArray(rows)) throw new Error(`Format data ${name} dari GAS tidak sesuai.`);
  return rows as T[];
};
const stableId = (competitionId: string, entryId: string, judgeId: string) =>
  `score_${[competitionId, entryId, judgeId].map(x => encodeURIComponent(x)).join('_')}`;
const locked = (x: ScoreRecord) => x.is_locked === true || String(x.is_locked).toLowerCase() === 'true';
export const judgeCloudService = {
  async load() {
    const [entriesResult, scoresResult] = await Promise.all([
      apiTransport.send('admin.entity.list', { entity: 'competitionEntries', filters: {} }),
      apiTransport.send('admin.entity.list', { entity: 'judgingScores', filters: {} }),
    ]);
    return { entries: unwrap<EntryRecord>(entriesResult, 'entri lomba'), scores: unwrap<ScoreRecord>(scoresResult, 'penilaian') };
  },
  currentJudgeId(): string {
    const user = authService.getCurrentUser();
    if (!user?.id) throw new Error('Sesi juri tidak ditemukan. Silakan login kembali.');
    return user.id;
  },
  getOwnScore(scores: ScoreRecord[], competitionId: string, entryId: string): ScoreRecord | undefined {
    const judgeId = this.currentJudgeId();
    return scores.find(s => String(s.competition_id) === competitionId && String(s.entry_id) === entryId && String(s.judge_id) === judgeId);
  },
  async save(entry: EntryRecord, criteria: Criteria, existing?: ScoreRecord): Promise<ScoreRecord> {
    if (!entry.id || !entry.competition_id) throw new Error('Entri dan lomba wajib dipilih dari database.');
    const judgeId = this.currentJudgeId();
    if (existing && locked(existing)) throw new Error('Nilai sudah dikunci dan tidak dapat diubah.');
    for (const value of Object.values(criteria)) {
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Nilai kriteria harus antara 0 dan 100.');
    }
    const score = Math.round(criteria.kreativitas * .3 + criteria.kesesuaianTema * .25 + criteria.teknikPramuka * .3 + criteria.kerapian * .15);
    const record = {
      id: existing?.id || stableId(entry.competition_id, entry.id, judgeId),
      competition_id: entry.competition_id,
      entry_id: entry.id,
      judge_id: judgeId,
      score,
      criteria_scores_json: criteria,
      is_locked: false,
      revision_number: existing ? Number(existing.revision_number || 0) + 1 : 1,
      submitted_at: new Date().toISOString(),
    };
    const res = await apiTransport.send('admin.entity.upsert', { entity: 'judgingScores', record }, { timeoutMs: 60000 });
    if (!res.ok || !res.data) throw new Error(res.error?.message || 'Server tidak mengonfirmasi penyimpanan nilai.');
    const saved = res.data as ScoreRecord;
    if (String(saved.id) !== String(record.id) || String(saved.entry_id) !== entry.id || String(saved.judge_id) !== judgeId || Number(saved.score) !== score) {
      throw new Error('Respons GAS tidak cocok dengan nilai yang dikirim; periksa Spreadsheet sebelum mengulang.');
    }
    return saved;
  },
};
