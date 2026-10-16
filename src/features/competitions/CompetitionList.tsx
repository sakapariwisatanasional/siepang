/**
 * @license
 * SiEpang - Competitions & Digital Gallery (RC1 Global Design System)
 * Includes competition cards with Jury + Public Vote combo weighting,
 * and social digital gallery with interactive heart voting.
 * Standardized to Light-First, Instagram-inspired accent system, and 44px touch targets.
 */

import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Heart,
  ExternalLink,
  Share2,
  Plus,
  Play,
  Image,
  Video,
  FileText,
  CheckCircle2,
  X,
  Flame,
  Scale,
  Sparkles,
} from 'lucide-react';
import { competitionService } from '../../services/competitionService';
import { votingService } from '../../services/votingService';
import { authService } from '../../services/authService';
import { Competition, DigitalWork } from '../../types';

export const CompetitionList: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'competitions'>('gallery');
  const [digitalWorks, setDigitalWorks] = useState<DigitalWork[]>(competitionService.getDigitalWorks());
  const [competitions, setCompetitions] = useState<Competition[]>(competitionService.getCompetitions());
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [voteToast, setVoteToast] = useState<string | null>(null);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [submittingWork, setSubmittingWork] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingWorks(true);
    Promise.all([
      competitionService.refreshPublicDigitalWorks()
    ])
      .catch((error: any) => {
        if (!cancelled) setVoteToast(`❌ Karya dari GAS belum dapat dimuat: ${error?.message || 'Terjadi kesalahan.'}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingWorks(false);
      });
    return () => { cancelled = true; };
  }, []);



  // New submission state
  const [newWork, setNewWork] = useState({
    title: '',
    competitionId: competitions.find(c => c.type === 'digital')?.id || competitions[0]?.id || '',
    competitionTitle: competitions.find(c => c.type === 'digital')?.title || competitions[0]?.title || '',
    creatorName: '',
    contingentName: '',
    mediaType: 'photo' as 'photo' | 'video' | 'poster',
    thumbnailUrl: '',
    originalUrl: '',
    description: '',
  });

  const handleVoteToggle = async (workId: string) => {
    try {
      const res = await votingService.toggleVote(workId);
      setDigitalWorks(competitionService.getDigitalWorks());
      setVoteToast(
        res.voted
          ? res.isProvisional
            ? '🗳️ Vote tersimpan dan sedang divalidasi oleh GAS.'
            : '❤️ Suara voting kamu berhasil dicatat!'
          : 'Suara voting dibatalkan.'
      );
      setTimeout(() => setVoteToast(null), 2500);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingWork) return;

    const user = authService.getCurrentUser();
    if (!user) {
      setVoteToast('❌ Silakan masuk menggunakan akun peserta terlebih dahulu.');
      return;
    }
    if (!newWork.competitionId || !newWork.title.trim() || !newWork.originalUrl.trim()) {
      setVoteToast('❌ Lengkapi cabang, judul karya, dan tautan karya.');
      return;
    }

    setSubmittingWork(true);
    try {
      await competitionService.submitDigitalWork({
        ...newWork,
        thumbnailUrl: '',
      });
      await competitionService.refreshPublicDigitalWorks();
      setDigitalWorks(competitionService.getDigitalWorks());
      setShowSubmitModal(false);
      setNewWork(prev => ({
        ...prev,
        title: '',
        originalUrl: '',
        description: '',
        thumbnailUrl: '',
      }));
      setVoteToast('✅ Karya tersimpan di GAS dan menunggu publikasi panitia.');
    } catch (err: any) {
      setVoteToast(`❌ Gagal mengirim karya: ${err?.message || 'Terjadi kesalahan.'}`);
    } finally {
      setSubmittingWork(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-8">
      {/* Header with Segmented Navigation */}
      <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0F4] border border-[#FFE0E8] text-xs font-semibold text-[#F47743] mb-1.5">
              <Flame className="w-3.5 h-3.5" />
              <span>Ajang Prestasi & Kreativitas Kepramukaan</span>
            </div>
            <h1 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">
              Unjuk Karya
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
              Saksikan karya peserta dan berikan dukungan melalui voting.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center justify-center gap-1.5 p-2.5 sm:px-4 sm:py-2.5 bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-500/20 shrink-0 min-w-[44px] min-h-[44px] cursor-pointer"
            title="Kirim Unjuk Karya"
            aria-label="Kirim Unjuk Karya"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Kirim Unjuk Karya</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'gallery'
                ? 'bg-white dark:bg-[#1C1C1E] text-[#F47743] font-bold shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            📸 Photo dan Video ({digitalWorks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('competitions')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'competitions'
                ? 'bg-white dark:bg-[#1C1C1E] text-[#F47743] font-bold shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            🏆 Unjuk Karya & Penilaian ({competitions.length})
          </button>
        </div>
      </div>

      {/* Floating Vote Toast */}
      {voteToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
          {voteToast}
        </div>
      )}

      {/* TAB 1: INSTAGRAM/TIKTOK LIKE DIGITAL GALLERY */}
      {activeTab === 'gallery' &&
        (digitalWorks.length === 0 ? (
          <div className="p-12 text-center rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
            <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-[#171717] dark:text-white">Belum ada karya yang dipublikasikan</h4>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Karya peserta akan muncul di sini setelah dipublikasikan oleh panitia.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {digitalWorks.map(work => {
              const hasVoted = votingService.hasVoted(work.id);
              return (
                <div
                  key={work.id}
                  className="rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 overflow-hidden hover:border-[#F47743]/30 transition-all flex flex-col group shadow-2xs"
                >
                  {/* Media Thumbnail with Aspect Ratio */}
                  <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                    {work.thumbnailUrl ? (
                      <img
                        src={work.thumbnailUrl}
                        alt={work.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('[data-thumbnail-fallback]');
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      data-thumbnail-fallback
                      className={`${work.thumbnailUrl ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center bg-gradient-to-br from-[#B51218] to-[#D71920] text-white`}
                    >
                      <div className="text-center px-6">
                        <ExternalLink className="w-9 h-9 mx-auto mb-2 opacity-80" />
                        <p className="text-xs font-semibold">Preview tidak tersedia</p>
                        <p className="text-[10px] opacity-75 mt-1">Buka karya untuk melihat posting asli</p>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                    {/* Media Type Badge */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-white flex items-center gap-1.5">
                      {work.mediaType === 'video' && <Play className="w-3 h-3 fill-current text-amber-400" />}
                      {work.mediaType === 'photo' && <Image className="w-3 h-3 text-sky-400" />}
                      {work.mediaType === 'poster' && <FileText className="w-3 h-3 text-purple-400" />}
                      <span>{work.competitionTitle}</span>
                    </div>

                    {/* Open Link Icon */}
                    <a
                      href={work.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-white hover:text-black transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                      title="Buka Link Asli"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Floating Creator info over bottom of media */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="text-sm font-bold truncate drop-shadow-md">{work.title}</h3>
                      <p className="text-[11px] text-slate-300 truncate">
                        {work.creatorName} · {work.contingentName}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer with Heart Vote Button */}
                  <div className="p-4 flex items-center justify-between mt-auto bg-white dark:bg-[#141418]">
                    <p className="text-xs text-[#6B7280] dark:text-slate-400 line-clamp-2 pr-3">
                      {work.description}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleVoteToggle(work.id)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-90 min-h-[44px] min-w-[44px] cursor-pointer ${
                        hasVoted
                          ? 'bg-[#FFF0F4] text-[#F47743] border border-[#FFE0E8] shadow-xs'
                          : 'bg-[#FAFAFA] hover:bg-slate-100 text-[#6B7280] border border-[#ECECEF] dark:bg-white/5 dark:text-slate-300'
                      }`}
                      title={hasVoted ? 'Batal Sukai' : 'Sukai & Vote Karya'}
                      aria-label={hasVoted ? 'Batal Sukai Karya' : 'Sukai dan Vote Karya'}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform ${
                          hasVoted ? 'fill-current text-[#F47743] scale-110' : 'text-slate-400'
                        }`}
                      />
                      <span className="font-mono font-bold">{work.votesCount}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* TAB 2: COMPETITIONS OVERVIEW WITH JURY + PUBLIC WEIGHTING */}
      {activeTab === 'competitions' &&
        (competitions.length === 0 ? (
          <div className="p-12 text-center rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
            <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-[#171717] dark:text-white">Belum ada kompetisi</h4>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">Cabang Unjuk Karya belum diumumkan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {competitions.map(c => (
              <div
                key={c.id}
                className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors shadow-2xs"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-amber-600 border border-[#FED7AA] flex items-center justify-center text-xl shrink-0">
                    {c.category === 'Pioneering' && '⛺'}
                    {c.category === 'LKBB' && '🎖️'}
                    {c.category === 'Fotografi' && '📷'}
                    {c.category === 'Video Kreatif' && '🎬'}
                    {c.category === 'Reels/TikTok' && '📱'}
                    {c.category === 'Poster Digital' && '🎨'}
                    {c.category === 'Semboyan & Isyarat' && '🚩'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#171717] dark:text-white">{c.title}</h3>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-full capitalize">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#6B7280] dark:text-slate-400 mt-1">
                      {c.scheduleTime} · Lokasi: {c.location}
                    </div>

                    {/* Jury + Public Weighting breakdown tag */}
                    <div className="flex items-center gap-1.5 text-[11px] text-[#F47743] mt-2 font-semibold">
                      <Scale className="w-3.5 h-3.5" />
                      <span>
                        Bobot Nilai: Juri Dewan ({c.juryWeight}%)
                        {c.publicWeight > 0 ? ` + Voting Publik (${c.publicWeight}%)` : ' (100% Lapangan)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#ECECEF] dark:border-white/5">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-[#171717] dark:text-white font-mono">
                      {c.registeredEntries} Karya/Regu
                    </div>
                    <div className="text-[10px] text-[#6B7280] dark:text-slate-400">
                      Maks {c.maxEntriesPerContingent} per ranting
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('gallery')}
                    className="px-3.5 py-2 bg-[#FFF0F4] hover:bg-[#FFE0E8] text-[#F47743] rounded-xl text-xs font-bold border border-[#FFE0E8] transition-colors min-h-[44px] cursor-pointer"
                  >
                    Lihat Karya
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* Submit Digital Work Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleSubmitWork}
            className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div className="text-sm font-bold text-[#171717] dark:text-white">Kirim Unjuk Karya</div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1">Kategori Unjuk Karya</label>
                <select
                  value={newWork.competitionId}
                  onChange={e => {
                    const comp = competitions.find(c => c.id === e.target.value);
                    setNewWork({
                      ...newWork,
                      competitionId: e.target.value,
                      competitionTitle: comp?.title || '',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white shadow-2xs outline-none focus:border-[#F47743]"
                >
                  {competitions
                    .filter(c => c.type === 'digital')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1">Judul Karya</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Senja Menggema di Bumi Perkemahan"
                  value={newWork.title}
                  onChange={e => setNewWork({ ...newWork, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white shadow-2xs outline-none focus:border-[#F47743]"
                />
              </div>

              <div>
                <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1">Tautan Media (Instagram / TikTok / Facebook / YouTube)</label>
                <input
                  type="url"
                  required
                  placeholder="https://instagram.com/reel/... atau https://tiktok.com/..."
                  value={newWork.originalUrl}
                  onChange={e => setNewWork({ ...newWork, originalUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white shadow-2xs outline-none focus:border-[#F47743] font-mono"
                />
              </div>

              <div>
                <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1">Deskripsi Singkat Karya</label>
                <textarea
                  rows={3}
                  placeholder="Ceritakan pesan kepramukaan di balik karyamu..."
                  value={newWork.description}
                  onChange={e => setNewWork({ ...newWork, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white shadow-2xs outline-none focus:border-[#F47743]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#ECECEF] dark:border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white rounded-xl min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingWork}
                className="px-5 py-2.5 bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 min-h-[44px]"
              >
                Kirim Karya
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
