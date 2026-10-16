/**
 * @license
 * SiEpang - Camp Event Schedule Screen (RC1 Global Design System)
 * Modern mobile-native calendar feel: Today, Tomorrow, All Days, My Schedule filter.
 * Standardized to Light-First, Instagram-inspired accent system, and 44px touch targets.
 */

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Bookmark,
  Users,
  Award,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { eventService } from '../../services/eventService';
import { ScheduleItem } from '../../types';

export const EventSchedule: React.FC = () => {
  const [, setScheduleRevision] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = eventService.subscribe(() => setScheduleRevision(n => n + 1));
    void eventService.refreshPublicSchedule();
    return unsubscribe;
  }, []);
  // Seluruh jadwal publik berasal dari sheet `schedules` melalui GAS.
  // Jangan gunakan tanggal/tab hardcoded karena tanggal kegiatan dapat berubah
  // dari administrasi event. Tab dibentuk otomatis dari day_number + date.
  const allScheduleItems = eventService
    .getSchedule()
    .filter(item => item.isPublished === true && item.archived !== true);

  const formatScheduleDate = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${day} ${months[month - 1]}`;
      }
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return `${parsed.getDate()} ${months[parsed.getMonth()]}`;
  };

  const byDay = new Map<number, ScheduleItem>();
  allScheduleItems.forEach(item => {
    const dayNumber = Number(item.dayNumber);
    if (!Number.isFinite(dayNumber)) return;
    if (!byDay.has(dayNumber)) byDay.set(dayNumber, item);
  });

  const dayOptions = Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayNumber, item]) => ({
      id: dayNumber,
      label: `Hari ${dayNumber}`,
      dateLabel: formatScheduleDate(item.date),
    }));

  useEffect(() => {
    if (selectedDay !== 'all' && !dayOptions.some(day => day.id === selectedDay)) {
      setSelectedDay(dayOptions[0]?.id ?? 'all');
    }
  }, [dayOptions, selectedDay]);

  const scheduleItems = selectedDay === 'all'
    ? allScheduleItems
    : allScheduleItems.filter(item => Number(item.dayNumber) === selectedDay);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCategoryIcon = (category: ScheduleItem['category']) => {
    switch (category) {
      case 'ceremony':
        return '⚜️';
      case 'pioneering':
        return '⛺';
      case 'competition':
        return '🏆';
      case 'social':
        return '🌱';
      case 'night_camp':
        return '🔥';
      default:
        return '📅';
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-8">
      {/* Header */}
      <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0F4] border border-[#FFE0E8] text-xs font-semibold text-[#F47743]">
          <Calendar className="w-3.5 h-3.5" />
          <span>Agenda & Waktu Giat Buper</span>
        </div>
        <h1 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">
          Jadwal Perkemahan
        </h1>
        <p className="text-xs text-[#6B7280] dark:text-slate-400">
          Agendakan kegiatan harian, apel kedisiplinan, dan kompetisi kepramukaanmu.
        </p>

        {/* Day Selector Tabs (Functional segmented controls) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5 mt-3 overflow-x-auto">
          {[
            ...dayOptions,
            { id: 'all' as const, label: 'Semua Hari', dateLabel: '' },
          ].map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDay(d.id as any)}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition-all min-h-[48px] cursor-pointer flex flex-col items-center justify-center leading-tight ${
                selectedDay === d.id
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#F47743] font-bold shadow-xs'
                  : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
              }`}
            >
              <span>{d.label}</span>
              {d.dateLabel && <span className="text-[10px] opacity-70">{d.dateLabel}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Items List */}
      <div className="space-y-3">
        {scheduleItems.length === 0 ? (
          <div className="p-8 text-center rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-[#171717] dark:text-white">Belum ada jadwal</h4>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              {eventService.getPublicScheduleError() || 'Belum ada agenda resmi yang dipublikasikan untuk hari ini.'}
            </p>
          </div>
        ) : (
          scheduleItems.map(item => {
            const isSaved = bookmarkedIds.has(item.id);
            return (
              <div
                key={item.id}
                className="p-5 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/30 space-y-3 transition-colors shadow-2xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF0F4] text-[#F47743] border border-[#FFE0E8] flex items-center justify-center text-xl shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#F47743] font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.time} WIB</span>
                        {item.status === 'completed' && (
                          <span className="text-[10px] text-emerald-600 font-sans font-bold">· Selesai</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#171717] dark:text-white mt-0.5">{item.title}</h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleBookmark(item.id)}
                    className={`p-2.5 rounded-xl border transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer ${
                      isSaved
                        ? 'bg-[#FEFCE8] text-amber-600 border-[#FEF08A]'
                        : 'bg-white hover:bg-[#FAFAFA] text-[#9CA3AF] border-[#ECECEF] dark:bg-white/5'
                    }`}
                    title={isSaved ? 'Hapus dari Jadwal Saya' : 'Simpan ke Jadwal Saya'}
                    aria-label={isSaved ? `Hapus jadwal ${item.title}` : `Simpan jadwal ${item.title}`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <p className="text-xs text-[#6B7280] dark:text-slate-300 leading-relaxed pl-1">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#6B7280] dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{item.location}</span>
                  </div>

                  <span className="text-[11px] font-bold text-amber-700 bg-[#FEFCE8] border border-[#FEF08A] px-2.5 py-0.5 rounded-full">
                    +{item.xpReward} XP
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
