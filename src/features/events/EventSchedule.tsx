/**
 * @license
 * SiEpang - Camp Event Schedule Screen
 *
 * Public schedule is data-driven:
 * - eventService.refreshPublicSchedule() remains the GAS refresh entry point.
 * - Schedule tabs are generated from the schedule records returned by GAS.
 * - No operational dates are hardcoded in the frontend.
 * - Public view only renders records with isPublished === true.
 *
 * The event sheet remains the source for the event date range through the
 * existing GAS/eventService contract; schedules supplies the actual daily
 * agenda and date/day_number association.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Bookmark,
} from 'lucide-react';
import { eventService } from '../../services/eventService';
import { ScheduleItem } from '../../types';

type ScheduleViewItem = ScheduleItem & {
  date?: string;
  dayNumber?: number;
  day_number?: number;
};

type DayTab = {
  id: number;
  label: string;
  date?: string;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const parseDateOnly = (value?: string): Date | null => {
  if (!value) return null;

  // GAS commonly returns YYYY-MM-DD. Parse it as local date to avoid
  // the UTC-minus-one-day issue in Indonesian time zones.
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDayDate = (value?: string) => {
  const date = parseDateOnly(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
  }).format(date);
};

const getScheduleDayNumber = (item: ScheduleViewItem): number | null => {
  const raw = item.dayNumber ?? item.day_number;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getScheduleDate = (item: ScheduleViewItem): string | undefined => {
  const value = item.date;
  return value ? String(value).trim() : undefined;
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

export const EventSchedule: React.FC = () => {
  const [, setScheduleRevision] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = eventService.subscribe(() => setScheduleRevision(n => n + 1));

    // Keep the existing GAS/service contract untouched.
    void eventService.refreshPublicSchedule();

    return unsubscribe;
  }, []);

  /*
   * Read the complete public schedule once from the existing service.
   * The service is responsible for obtaining the records from GAS/Spreadsheet.
   */
  const publicSchedule = useMemo(
    () =>
      eventService
        .getSchedule()
        .filter(item => item.isPublished === true) as ScheduleViewItem[],
    // setScheduleRevision intentionally forces this component to re-read the
    // service store after GAS refreshes; the service itself remains unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setScheduleRevision]
  );

  /*
   * Build the day tabs from GAS schedule data.
   *
   * IMPORTANT:
   * There are deliberately no literals such as "10 Okt" or "11 Okt" here.
   * `dayNumber`/`date` come from the normalized schedules response.
   */
  const dayTabs = useMemo<DayTab[]>(() => {
    const byDay = new Map<number, string | undefined>();

    publicSchedule.forEach(item => {
      const dayNumber = getScheduleDayNumber(item);
      if (dayNumber === null) return;

      const date = getScheduleDate(item);
      if (!byDay.has(dayNumber) || (!byDay.get(dayNumber) && date)) {
        byDay.set(dayNumber, date);
      }
    });

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a - b)
      .map(([id, date]) => ({
        id,
        label: date
          ? `Hari ${id} (${formatDayDate(date)})`
          : `Hari ${id}`,
        date,
      }));
  }, [publicSchedule]);

  // Once GAS data arrives, select the first real schedule day.
  useEffect(() => {
    if (selectedDay !== 'all') {
      const exists = dayTabs.some(tab => tab.id === selectedDay);
      if (exists) return;
    }

    if (dayTabs.length > 0) {
      setSelectedDay(dayTabs[0].id);
    }
  }, [dayTabs, selectedDay]);

  const scheduleItems = useMemo(() => {
    if (selectedDay === 'all') return publicSchedule;

    return publicSchedule.filter(item => {
      const dayNumber = getScheduleDayNumber(item);
      return dayNumber === selectedDay;
    });
  }, [publicSchedule, selectedDay]);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-8">
      {/* Header */}
      <div className="bg-white dark:bg-[#141418] border border-[#F1D9D9] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF1F1] border border-[#FFDADA] text-xs font-semibold text-[#C51F1F]">
          <Calendar className="w-3.5 h-3.5" />
          <span>Agenda & Waktu Giat Buper</span>
        </div>

        <h1 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">
          Jadwal Perkemahan
        </h1>

        <p className="text-xs text-[#6B7280] dark:text-slate-400">
          Agenda kegiatan yang dipublikasikan oleh panitia.
        </p>

        {/* Dynamic day selector */}
        {dayTabs.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-[#FAFAFA] dark:bg-white/5 rounded-2xl border border-[#ECECEF] dark:border-white/5 mt-3 overflow-x-auto">
            {dayTabs.map(day => (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDay(day.id)}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition-all min-h-[38px] cursor-pointer ${
                  selectedDay === day.id
                    ? 'bg-white dark:bg-[#1C1C1E] text-[#C51F1F] font-bold shadow-xs'
                    : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
                }`}
              >
                {day.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelectedDay('all')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition-all min-h-[38px] cursor-pointer ${
                selectedDay === 'all'
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#C51F1F] font-bold shadow-xs'
                  : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
              }`}
            >
              Semua Hari
            </button>
          </div>
        )}

        {dayTabs.length === 0 && (
          <div className="mt-3 rounded-2xl border border-dashed border-[#E8D4D4] bg-[#FFF9F9] px-4 py-3 text-xs text-[#7A5B5B] dark:bg-white/5 dark:border-white/10 dark:text-slate-400">
            Menunggu jadwal resmi dari server.
          </div>
        )}
      </div>

      {/* Schedule Items List */}
      <div className="space-y-3">
        {scheduleItems.length === 0 ? (
          <div className="p-8 text-center rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-[#171717] dark:text-white">
              Belum ada jadwal
            </h4>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              {eventService.getPublicScheduleError() ||
                'Belum ada agenda resmi yang dipublikasikan.'}
            </p>
          </div>
        ) : (
          scheduleItems.map(item => {
            const isSaved = bookmarkedIds.has(item.id);

            return (
              <div
                key={item.id}
                className="p-5 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#C51F1F]/30 space-y-3 transition-colors shadow-2xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF1F1] text-[#C51F1F] border border-[#FFDADA] flex items-center justify-center text-xl shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#C51F1F] font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.time} WIB</span>

                        {item.status === 'completed' && (
                          <span className="text-[10px] text-emerald-600 font-sans font-bold">
                            · Selesai
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[#171717] dark:text-white mt-0.5">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleBookmark(item.id)}
                    className={`p-2.5 rounded-xl border transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer shrink-0 ${
                      isSaved
                        ? 'bg-[#FEFCE8] text-amber-600 border-[#FEF08A]'
                        : 'bg-white hover:bg-[#FAFAFA] text-[#9CA3AF] border-[#ECECEF] dark:bg-white/5'
                    }`}
                    title={isSaved ? 'Hapus dari Jadwal Saya' : 'Simpan ke Jadwal Saya'}
                    aria-label={
                      isSaved
                        ? `Hapus jadwal ${item.title}`
                        : `Simpan jadwal ${item.title}`
                    }
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {item.description && (
                  <p className="text-xs text-[#6B7280] dark:text-slate-300 leading-relaxed pl-1">
                    {item.description}
                  </p>
                )}

                <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-[#6B7280] dark:text-slate-400 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>

                  <span className="text-[11px] font-bold text-amber-700 bg-[#FEFCE8] border border-[#FEF08A] px-2.5 py-0.5 rounded-full shrink-0">
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
