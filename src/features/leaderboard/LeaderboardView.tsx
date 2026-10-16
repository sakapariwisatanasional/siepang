/**
 * @license
 * SiEpang - Gamified Leaderboard & XP Ranking (RC1 Global Design System)
 * Highlight Top 3 on podium (🥇, 🥈, 🥉), sticky highlight for current participant,
 * and configurable contingent leaderboard with fair normalized ranking (Avg XP = Total ÷ Headcount).
 * Standardized to Light-First, Instagram-inspired accent system, and 44px touch targets.
 */

import React, { useState } from 'react';
import { Trophy, Medal, Zap, Users, Flame, ChevronRight, Calculator, SlidersHorizontal } from 'lucide-react';
import { pointService } from '../../services/pointService';
import { participantService } from '../../services/participantService';
import { LeaderboardEntry } from '../../types';

export const LeaderboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'individual' | 'contingent'>('individual');
  const [contingentRankingMethod, setContingentRankingMethod] = useState<'normalized' | 'total'>('normalized');

  const leaderboard = pointService.getLeaderboard();
  const contingents = participantService.getContingents();

  // Top 3 Podium
  const rank1 = leaderboard[0];
  const rank2 = leaderboard[1];
  const rank3 = leaderboard[2];
  const otherRanks = leaderboard.slice(3);

  // Find current user's entry
  const currentUserEntry = leaderboard.find(e => e.isCurrentUser) || leaderboard[0];

  // Process contingent ranking based on method
  const sortedContingents = [...contingents]
    .map(c => {
      const avgXp = c.participantCount > 0 ? Math.round(c.totalXp / c.participantCount) : 0;
      return {
        ...c,
        avgXp,
      };
    })
    .sort((a, b) => {
      if (contingentRankingMethod === 'normalized') {
        return b.avgXp - a.avgXp;
      }
      return b.totalXp - a.totalXp;
    });

  // Never dereference currentUserEntry when the leaderboard is empty.
  // This keeps the page usable during an empty/first-load state instead of
  // sending the entire application to the recovery screen.
  if (leaderboard.length === 0) {
    return (
      <div className="space-y-5 max-w-xl mx-auto pb-8">
        <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-6 rounded-[28px] shadow-xs text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300 mb-4">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-[#171717] dark:text-white">
            Peringkat & XP
          </h1>
          <p className="mt-2 text-sm text-[#6B7280] dark:text-slate-400">
            Belum ada data peringkat peserta.
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF] dark:text-slate-500">
            Peringkat akan tampil setelah data peserta dan perolehan XP tersedia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-8">
      {/* Header */}
      <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs space-y-3">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFBEB] border border-[#FEF08A] text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30">
            <Zap className="w-3.5 h-3.5" />
            <span>Perolehan XP & Peringkat Perkemahan</span>
          </div>
          <h1 className="text-2xl font-black text-[#171717] dark:text-white tracking-tight">
            Leaderboard Pramuka
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-slate-400">
            Kumpulkan XP melalui keaktifan kegiatan, presensi apel, karya digital, dan apresiasi kawan.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'individual'
                ? 'bg-white dark:bg-[#1C1C1E] text-[#F47743] font-bold shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            👤 Individu Peserta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contingent')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all min-h-[38px] cursor-pointer ${
              activeTab === 'contingent'
                ? 'bg-white dark:bg-[#1C1C1E] text-[#F47743] font-bold shadow-xs'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
            }`}
          >
            ⛺ Kontingen Ranting
          </button>
        </div>
      </div>

      {activeTab === 'individual' ? (
        <>
          {/* GAMIFIED TOP 3 PODIUM */}
          <div className="pt-8 pb-4 px-3 bg-white dark:bg-[#141418] rounded-[28px] border border-[#ECECEF] dark:border-white/10 shadow-xs">
            <div className="grid grid-cols-3 gap-2 items-end max-w-sm mx-auto text-center">
              {/* 2nd Place */}
              {rank2 && (
                <div className="flex flex-col items-center space-y-2">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md">
                      <img src={rank2.avatar} alt={rank2.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -top-2.5 -right-2 text-xl drop-shadow">🥈</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#171717] dark:text-white truncate max-w-[90px]">
                      {rank2.name.split(' ')[0]}
                    </div>
                    <div className="text-[11px] font-mono text-[#6B7280] dark:text-slate-400 font-semibold">
                      {rank2.xp.toLocaleString()} XP
                    </div>
                  </div>
                  <div className="w-full h-20 bg-slate-100 dark:bg-slate-800/60 rounded-t-2xl flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-base border-t border-slate-200 dark:border-slate-700">
                    #2
                  </div>
                </div>
              )}

              {/* 1st Place (Center & Tallest) */}
              {rank1 && (
                <div className="flex flex-col items-center space-y-2 -mt-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-lg ring-4 ring-amber-400/20">
                      <img src={rank1.avatar} alt={rank1.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -top-3.5 -right-2.5 text-2xl drop-shadow">🥇</span>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-[#171717] dark:text-white truncate max-w-[100px]">
                      {rank1.name.split(' ')[0]}
                    </div>
                    <div className="text-xs font-mono font-bold text-[#F47743]">{rank1.xp.toLocaleString()} XP</div>
                  </div>
                  <div className="w-full h-28 bg-gradient-to-t from-amber-200 to-amber-100 dark:from-amber-950/60 dark:to-amber-900/30 rounded-t-2xl flex items-center justify-center font-black text-amber-700 dark:text-amber-300 text-xl border-t border-amber-300 dark:border-amber-500/40">
                    #1
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {rank3 && (
                <div className="flex flex-col items-center space-y-2">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-600/60 shadow-md">
                      <img src={rank3.avatar} alt={rank3.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -top-2.5 -right-2 text-xl drop-shadow">🥉</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#171717] dark:text-white truncate max-w-[90px]">
                      {rank3.name.split(' ')[0]}
                    </div>
                    <div className="text-[11px] font-mono text-[#6B7280] dark:text-slate-400 font-semibold">
                      {rank3.xp.toLocaleString()} XP
                    </div>
                  </div>
                  <div className="w-full h-16 bg-orange-100 dark:bg-orange-950/40 rounded-t-2xl flex items-center justify-center font-black text-amber-800 dark:text-amber-400 text-base border-t border-orange-200 dark:border-orange-500/30">
                    #3
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CURRENT USER STICKY POSITION HIGHLIGHT */}
          <div className="p-4 rounded-[24px] bg-[#FFF0F4] dark:bg-[#1A151C] border border-[#FFE0E8] dark:border-pink-500/20 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#208C60] to-[#F47743] text-white flex items-center justify-center font-black text-xs font-mono shadow-xs">
                #{currentUserEntry.rank}
              </div>
              <img
                src={currentUserEntry.avatar}
                alt={currentUserEntry.name}
                className="w-10 h-10 rounded-xl object-cover border border-[#ECECEF] dark:border-white/20"
              />
              <div>
                <div className="text-xs font-bold text-[#171717] dark:text-white flex items-center gap-1.5">
                  <span>{currentUserEntry.name}</span>
                  <span className="text-[10px] text-[#F47743] font-semibold">(Posisi Kamu)</span>
                </div>
                <div className="text-[10px] text-[#6B7280] dark:text-slate-400">Level {currentUserEntry.level} Scout Explorer</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-black text-[#F47743] font-mono">
                {currentUserEntry.xp.toLocaleString()} XP
              </div>
            </div>
          </div>

          {/* RANKS 4 AND BELOW */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-wider px-1">
              Peringkat Peserta Lainnya
            </div>

            {otherRanks.map(entry => (
              <div
                key={entry.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 flex items-center justify-between gap-3 text-xs hover:border-[#F47743]/30 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center font-mono font-bold text-[#6B7280] dark:text-slate-400">
                    {entry.rank}
                  </span>
                  <img
                    src={entry.avatar}
                    alt={entry.name}
                    className="w-9 h-9 rounded-xl object-cover border border-[#ECECEF] dark:border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-[#171717] dark:text-white truncate">{entry.name}</div>
                    <div className="text-[11px] text-[#6B7280] dark:text-slate-400 truncate">{entry.contingentName}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-[#F47743]">{entry.xp.toLocaleString()} XP</div>
                  <div className="text-[10px] text-[#9CA3AF]">Lv {entry.level}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* KONTINGEN LEADERBOARD WITH NORMALIZED RANKING OPTION */
        <div className="space-y-4">
          {/* Configurable Ranking Method Selector */}
          <div className="p-3.5 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-[#171717] dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#F47743]" />
                <span>Metode Peringkat Kontingen:</span>
              </span>
              <span className="text-[11px] font-mono text-[#F47743] font-semibold">
                {contingentRankingMethod === 'normalized' ? 'Normalisasi Adil' : 'Total Akumulasi'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContingentRankingMethod('normalized')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-left min-h-[44px] cursor-pointer ${
                  contingentRankingMethod === 'normalized'
                    ? 'bg-[#FFF0F4] text-[#F47743] border-[#FFE0E8] shadow-xs font-bold'
                    : 'bg-[#FAFAFA] dark:bg-white/5 text-[#6B7280] dark:text-slate-400 border-[#ECECEF] dark:border-white/5 hover:border-slate-300'
                }`}
              >
                <div className="font-bold">⚖️ Rata-rata per Peserta</div>
                <div className="text-[10px] text-[#9CA3AF] mt-0.5">Total XP ÷ Jumlah Peserta</div>
              </button>

              <button
                type="button"
                onClick={() => setContingentRankingMethod('total')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-left min-h-[44px] cursor-pointer ${
                  contingentRankingMethod === 'total'
                    ? 'bg-[#FFF0F4] text-[#F47743] border-[#FFE0E8] shadow-xs font-bold'
                    : 'bg-[#FAFAFA] dark:bg-white/5 text-[#6B7280] dark:text-slate-400 border-[#ECECEF] dark:border-white/5 hover:border-slate-300'
                }`}
              >
                <div className="font-bold">📊 Total Akumulasi</div>
                <div className="text-[10px] text-[#9CA3AF] mt-0.5">Penjumlahan seluruh regu</div>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {sortedContingents.map((c, index) => (
              <div
                key={c.id}
                className="p-4 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/30 flex items-center justify-between gap-3 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black font-mono text-sm ${
                      index === 0
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-400/40'
                        : index === 1
                        ? 'bg-slate-200 text-slate-800'
                        : index === 2
                        ? 'bg-orange-300 text-orange-950'
                        : 'bg-[#FAFAFA] dark:bg-white/5 text-[#6B7280] dark:text-slate-400 border border-[#ECECEF] dark:border-white/10'
                    }`}
                  >
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#171717] dark:text-white">{c.name}</h3>
                    <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                      {c.region} · {c.participantCount} Pramuka ({c.campZone.split(' ')[0]})
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-[#F47743] font-mono">
                    {contingentRankingMethod === 'normalized'
                      ? `${c.avgXp.toLocaleString()} XP / org`
                      : `${c.totalXp.toLocaleString()} XP`}
                  </div>
                  <div className="text-[10px] text-[#9CA3AF]">
                    {contingentRankingMethod === 'normalized'
                      ? `Total: ${c.totalXp.toLocaleString()} XP`
                      : `Rata-rata: ${c.avgXp} XP`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
