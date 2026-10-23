/**
 * @license
 * SiEpang - Printable Activity QR Layouts & Sign Generator (Req 5, 6, 7)
 * Implements:
 * - A4 Single QR (Large format for gate, stage, checkpoint, station)
 * - A4 Multiple QR (Sheet of cards)
 * - Activity Sign (Full event branding, activity, time, venue, XP badge, instructions)
 * - Dynamic scout crimson branding (no hardcoded organizations)
 */

import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  Zap,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Sliders,
  Check,
} from 'lucide-react';
import { ActivityQrConfig } from '../../types';
import { QrImage } from '../../components/qr/QrImage';
import { eventStudioService } from '../../services/eventStudioService';
import { brandingService } from '../../services/brandingService';

interface ActivityQrSignPrintProps {
  configs: ActivityQrConfig[];
  onClose: () => void;
}

export const ActivityQrSignPrint: React.FC<ActivityQrSignPrintProps> = ({
  configs,
  onClose,
}) => {
  const event = eventStudioService.getEvent();
  const branding = brandingService.getBranding();

  const [layoutMode, setLayoutMode] = useState<'single_sign' | 'multi_card'>('single_sign');
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [printAll, setPrintAll] = useState<boolean>(configs.length > 1);
  const [showLogo, setShowLogo] = useState<boolean>(true);
  const [showXpBadge, setShowXpBadge] = useState<boolean>(true);
  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  const activeConfig = configs[selectedIdx] || configs[0];

  const handlePrint = () => {
    window.print();
  };

  if (!activeConfig) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-4xl bg-[#1c0c0f] border-2 border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto text-slate-100 flex flex-col">
        {/* Header Controls (Hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 print:hidden">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Printer className="w-4 h-4 text-red-400" />
              <span>Pusat Cetak QR Kegiatan & Pos (Activity Sign)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Format siap cetak A4 untuk ditempel pada tenda pos, panggung, dan stasiun kegiatan buper.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-red-950/50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Print / PDF)</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Layout & Customizer Settings (Hidden during print) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-black/40 rounded-2xl border border-white/5 text-xs print:hidden">
          {/* Layout Mode */}
          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Format Lembar Cetak:</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setLayoutMode('single_sign')}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all ${
                  layoutMode === 'single_sign' ? 'bg-red-700 text-white' : 'bg-white/5 text-slate-400'
                }`}
              >
                A4 Sign Tunggal
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('multi_card')}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all ${
                  layoutMode === 'multi_card' ? 'bg-red-700 text-white' : 'bg-white/5 text-slate-400'
                }`}
              >
                Kartu Pos (Grid)
              </button>
            </div>
          </div>

          {/* Activity Selector & Pagination */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 text-[11px]">Pratinjau Agenda:</label>
              <span className="text-[10px] text-amber-400 font-mono font-bold">
                {selectedIdx + 1} / {configs.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={selectedIdx <= 0}
                onClick={() => setSelectedIdx(prev => Math.max(0, prev - 1))}
                className="px-2 py-1.5 bg-black/50 border border-white/10 rounded-xl text-slate-300 disabled:opacity-30"
              >
                ◀
              </button>
              <select
                value={selectedIdx}
                onChange={e => setSelectedIdx(Number(e.target.value))}
                className="flex-1 px-2 py-1.5 bg-black/50 border border-white/10 rounded-xl text-white font-medium text-xs truncate"
              >
                {configs.map((c, idx) => (
                  <option key={c.id || idx} value={idx}>
                    {idx + 1}. {c.title} (+{c.rewardXp} XP)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selectedIdx >= configs.length - 1}
                onClick={() => setSelectedIdx(prev => Math.min(configs.length - 1, prev + 1))}
                className="px-2 py-1.5 bg-black/50 border border-white/10 rounded-xl text-slate-300 disabled:opacity-30"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Batch Print Scope */}
          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Cakupan Cetak (Print Target):</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPrintAll(false)}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-[11px] ${
                  !printAll ? 'bg-amber-600 text-slate-950 font-black' : 'bg-white/5 text-slate-400'
                }`}
              >
                Item Ini Saja
              </button>
              <button
                type="button"
                onClick={() => setPrintAll(true)}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-[11px] ${
                  printAll ? 'bg-emerald-600 text-white font-black' : 'bg-white/5 text-slate-400'
                }`}
              >
                Semua ({configs.length})
              </button>
            </div>
          </div>

          {/* Display Toggles */}
          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Elemen Visual:</label>
            <div className="flex gap-2 text-[11px] pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLogo}
                  onChange={e => setShowLogo(e.target.checked)}
                  className="accent-red-500 rounded"
                />
                <span>Logo</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showXpBadge}
                  onChange={e => setShowXpBadge(e.target.checked)}
                  className="accent-red-500 rounded"
                />
                <span>XP</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInstructions}
                  onChange={e => setShowInstructions(e.target.checked)}
                  className="accent-red-500 rounded"
                />
                <span>Instruksi</span>
              </label>
            </div>
          </div>
        </div>

        {/* PRINTABLE CANVAS CONTAINER */}
        <div className="flex-1 flex justify-center items-center py-4 bg-black/30 rounded-2xl border border-white/5 overflow-y-auto">
          {layoutMode === 'single_sign' ? (
            /* A4 SINGLE ACTIVITY SIGN LAYOUT (Req 6, 7) */
            <div className="w-full flex flex-col items-center">
              {/* On screen preview: render activeConfig */}
              <div className="w-full max-w-[420px] min-h-[580px] bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-red-800 flex flex-col justify-between text-center select-none print:hidden mx-auto">
                {/* Event Top Banner */}
                <div className="border-b-2 border-red-800 pb-4 space-y-1">
                  {showLogo && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-red-800 text-white font-black flex items-center justify-center text-sm shadow">
                        ⚜️
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-red-900">
                        {event.organizer || branding.organizationName || 'Gerakan Pramuka'}
                      </span>
                    </div>
                  )}
                  <h2 className="text-base font-black tracking-tight text-slate-950 uppercase">
                    {event.name || 'JAMBORE PRAMUKA'}
                  </h2>
                  <div className="text-[11px] font-semibold text-slate-600">
                    {event.venue || 'Bumi Perkemahan'}
                  </div>
                </div>

                {/* Activity Main Subject */}
                <div className="py-4 space-y-1.5">
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-black uppercase tracking-wide">
                    {activeConfig.category}
                  </span>
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight leading-tight uppercase">
                    {activeConfig.title}
                  </h1>
                  <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-700 pt-1">
                    <span>⏰ {activeConfig.scanOpens} - {activeConfig.scanCloses} WIB</span>
                    <span>·</span>
                    <span>📍 {activeConfig.location}</span>
                  </div>
                </div>

                {/* Large High-Contrast QR Code */}
                <div className="my-auto py-2">
                  <div className="w-56 h-56 mx-auto p-3 bg-white border-4 border-slate-900 rounded-2xl shadow-xl flex items-center justify-center">
                    <QrImage value={activeConfig.qrToken} size={188} className="h-full w-full rounded-xl" imageClassName="p-1" />
                  </div>
                </div>

                {/* Instructions & XP Reward */}
                <div className="space-y-3 pt-3 border-t-2 border-slate-200">
                  {showInstructions && (
                    <p className="text-xs font-bold text-slate-700 leading-snug">
                      Buka aplikasi <span className="text-red-800 font-extrabold">SiEpang</span> & scan QR untuk mencatat keikutsertaan kegiatan
                    </p>
                  )}

                  {showXpBadge && activeConfig.rewardXp > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-slate-950 rounded-full font-black text-sm shadow">
                      <Zap className="w-4 h-4 fill-current" />
                      <span>+{activeConfig.rewardXp} XP POIN PRAMUKA</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between px-2 pt-1">
                    <span>SiEpang Online Engine v1.1</span>
                    <span>Token: {activeConfig.qrToken.slice(0, 26)}...</span>
                  </div>
                </div>
              </div>

              {/* During print: render either activeConfig or all configs based on printAll */}
              <div className="hidden print:block w-full">
                {(printAll ? configs : [activeConfig]).map((cfg, pIdx) => (
                  <div
                    key={cfg.id || pIdx}
                    className="w-full min-h-screen bg-white text-slate-900 p-12 border-none flex flex-col justify-between text-center select-none"
                    style={{ pageBreakAfter: pIdx < (printAll ? configs.length - 1 : 0) ? 'always' : 'auto' }}
                  >
                    <div className="border-b-4 border-red-900 pb-6 space-y-2">
                      {showLogo && (
                        <div className="flex items-center justify-center gap-3">
                          <span className="w-10 h-10 rounded-full bg-red-900 text-white font-black flex items-center justify-center text-lg shadow">
                            ⚜️
                          </span>
                          <span className="text-sm font-black uppercase tracking-wider text-red-900">
                            {event.organizer || branding.organizationName || 'Gerakan Pramuka'}
                          </span>
                        </div>
                      )}
                      <h2 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                        {event.name || 'JAMBORE PRAMUKA'}
                      </h2>
                      <div className="text-sm font-bold text-slate-700">
                        {event.venue || 'Bumi Perkemahan'}
                      </div>
                    </div>

                    <div className="py-8 space-y-3">
                      <span className="px-4 py-1.5 rounded-full bg-red-100 text-red-900 text-sm font-black uppercase tracking-wide">
                        {cfg.category}
                      </span>
                      <h1 className="text-4xl font-black text-slate-950 tracking-tight leading-tight uppercase">
                        {cfg.title}
                      </h1>
                      <div className="flex items-center justify-center gap-4 text-base font-bold text-slate-800 pt-2">
                        <span>⏰ {cfg.scanOpens} - {cfg.scanCloses} WIB</span>
                        <span>·</span>
                        <span>📍 {cfg.location}</span>
                      </div>
                    </div>

                    <div className="my-auto py-6">
                      <div className="w-80 h-80 mx-auto p-4 bg-white border-8 border-slate-950 rounded-3xl shadow-2xl flex items-center justify-center">
                        <QrImage value={cfg.qrToken} size={272} className="h-full w-full rounded-2xl" imageClassName="p-2" />
                      </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t-4 border-slate-300">
                      {showInstructions && (
                        <p className="text-base font-bold text-slate-800 leading-snug">
                          Buka aplikasi <span className="text-red-900 font-extrabold">SiEpang</span> & scan QR untuk mencatat keikutsertaan kegiatan
                        </p>
                      )}

                      {showXpBadge && cfg.rewardXp > 0 && (
                        <div className="inline-flex items-center gap-2 px-6 py-2 bg-amber-400 text-slate-950 rounded-full font-black text-lg shadow-md">
                          <Zap className="w-5 h-5 fill-current" />
                          <span>+{cfg.rewardXp} XP POIN PRAMUKA</span>
                        </div>
                      )}

                      <div className="text-xs text-slate-500 font-mono flex items-center justify-between px-4 pt-2">
                        <span>SiEpang Online Engine v1.1</span>
                        <span>Token: {cfg.qrToken.slice(0, 32)}...</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* MULTI-CARD GRID LAYOUT (Req 6) */
            <div className="w-full max-w-3xl flex flex-col items-center">
              {/* Screen Preview: First 4 or current chunk */}
              <div className="grid grid-cols-2 gap-4 w-full bg-white text-slate-900 p-6 rounded-3xl border-2 border-slate-300 print:hidden">
                {configs.slice(selectedIdx, selectedIdx + 4).map(cfg => (
                  <div
                    key={cfg.id}
                    className="border-2 border-red-800 rounded-2xl p-4 text-center space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase text-red-800">
                        {cfg.category}
                      </span>
                      <h4 className="text-xs font-black text-slate-950 truncate">{cfg.title}</h4>
                      <div className="text-[10px] text-slate-600">
                        {cfg.scanOpens} - {cfg.scanCloses} WIB · {cfg.location}
                      </div>
                    </div>

                    <div className="w-32 h-32 mx-auto p-2 bg-white border-2 border-slate-900 rounded-xl">
                      <QrImage value={cfg.qrToken} size={112} className="h-full w-full rounded-lg" imageClassName="p-1" />
                    </div>

                    <div className="space-y-1">
                      {cfg.rewardXp > 0 && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                          +{cfg.rewardXp} XP
                        </span>
                      )}
                      <div className="text-[9px] text-slate-500 font-mono truncate">
                        {cfg.qrToken.slice(0, 20)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* During print: Group into chunks of 4 cards per A4 sheet */}
              <div className="hidden print:block w-full">
                {Array.from({ length: Math.ceil((printAll ? configs.length : Math.min(4, configs.length)) / 4) }).map((_, sheetIdx) => {
                  const chunk = (printAll ? configs : configs.slice(selectedIdx, selectedIdx + 4)).slice(sheetIdx * 4, (sheetIdx + 1) * 4);
                  return (
                    <div
                      key={sheetIdx}
                      className="w-full min-h-screen bg-white text-slate-900 p-8 grid grid-cols-2 gap-6 content-start"
                      style={{ pageBreakAfter: sheetIdx < Math.ceil(configs.length / 4) - 1 ? 'always' : 'auto' }}
                    >
                      {chunk.map(cfg => (
                        <div
                          key={cfg.id}
                          className="border-4 border-red-900 rounded-3xl p-5 text-center space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-black uppercase text-red-900">
                              {cfg.category}
                            </span>
                            <h4 className="text-base font-black text-slate-950 truncate">{cfg.title}</h4>
                            <div className="text-xs font-bold text-slate-600">
                              ⏰ {cfg.scanOpens} - {cfg.scanCloses} WIB · 📍 {cfg.location}
                            </div>
                          </div>

                          <div className="w-44 h-44 mx-auto p-3 bg-white border-4 border-slate-950 rounded-2xl shadow">
                            <QrImage value={cfg.qrToken} size={152} className="h-full w-full rounded-xl" imageClassName="p-1" />
                          </div>

                          <div className="space-y-1.5">
                            {cfg.rewardXp > 0 && (
                              <span className="inline-block px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                                +{cfg.rewardXp} XP PRAMUKA
                              </span>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono">
                              SiEpang · {cfg.qrToken.slice(0, 24)}...
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
