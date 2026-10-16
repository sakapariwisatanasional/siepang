/**
 * @license
 * SiEpang - Schedule & Activity Visual Editor
 * Full visual schedule builder supporting Day, Timeline, and Card views,
 * add/edit/duplicate/reorder/move-day, XP rewards, attendance toggles,
 * and custom activity type definitions.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Zap,
  Plus,
  Copy,
  Trash2,
  Edit2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  ArrowUpDown,
  Radio,
  Archive,
  Bell,
  QrCode,
  Printer,
  Filter,
  CheckSquare,
  Square,
} from 'lucide-react';
import { eventStudioService } from '../../services/eventStudioService';
import { eventService } from '../../services/eventService';
import { activityQrService } from '../../services/activityQrService';
import { ScheduleItem, CampActivity, ActivityType, ScheduleConflict, ActivityQrConfig } from '../../types';
import { ActivityQrModal } from '../activities/ActivityQrModal';
import { ActivityQrSignPrint } from '../activities/ActivityQrSignPrint';


// Dates are read only from the active event. No synthetic event or sample dates.
const parseEventDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

const eventDayOptions = (startValue: string, endValue: string) => {
  const start = parseEventDate(startValue);
  const end = parseEventDate(endValue);
  if (!start || !end || end.getTime() < start.getTime()) return [];
  const duration = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (duration > 366) return []; // Prevent accidental unbounded UI if event dates are invalid.
  return Array.from({ length: duration }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000);
    return {
      day: index + 1,
      date: date.toISOString().slice(0, 10),
      label: `Hari ${index + 1} (${new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(date)})`,
    };
  });
};

export const ScheduleActivityEditor: React.FC = () => {
  const [eventVersion, setEventVersion] = useState(0);
  useEffect(() => eventStudioService.subscribe(() => setEventVersion(version => version + 1)), []);
  const activeEvent = eventStudioService.getEvent();
  const eventDays = eventDayOptions(activeEvent.startDate, activeEvent.endDate);
  const eventLoadStatus = eventStudioService.getEventLoadStatus();
  const [reloadingEvent, setReloadingEvent] = useState(false);
  const [dateLoadError, setDateLoadError] = useState<string | null>(null);
  // If the global initial sync did not return an event, retry ONLY events.get.
  // This never writes to GAS, and never supplies sample dates.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (eventStudioService.getEventLoadStatus().ready) return;
      setReloadingEvent(true);
      eventStudioService.refreshGeneralEvent()
        .then(() => { if (!cancelled) setDateLoadError(null); })
        .catch((error: unknown) => {
          if (!cancelled) setDateLoadError(error instanceof Error ? error.message : 'Tidak dapat membaca tanggal event dari GAS.');
        })
        .finally(() => { if (!cancelled) setReloadingEvent(false); });
    }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  const retryEventLoad = async () => {
    if (reloadingEvent) return;
    setReloadingEvent(true);
    setDateLoadError(null);
    try {
      await eventStudioService.refreshGeneralEvent();
    } catch (error: unknown) {
      setDateLoadError(error instanceof Error ? error.message : 'Tidak dapat membaca tanggal event dari GAS.');
    } finally {
      setReloadingEvent(false);
    }
  };
  void eventVersion;
  const [subTab, setSubTab] = useState<'schedule' | 'activities'>('schedule');
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [scheduleList, setScheduleList] = useState<ScheduleItem[]>(eventStudioService.getSchedule());
  const [activityList, setActivityList] = useState<CampActivity[]>(eventStudioService.getActivities());
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>(eventStudioService.listActivityTypes());
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);

  // Activity QR Management state (Requirements 1-7)
  const [selectedQrActivity, setSelectedQrActivity] = useState<{
    id: string;
    title: string;
    category?: string;
    location?: string;
    scheduleTime?: string;
  } | null>(null);
  const [printSignConfigs, setPrintSignConfigs] = useState<ActivityQrConfig[] | null>(null);

  // Batch Print QR State (Requirement 5)
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [batchFilterDay, setBatchFilterDay] = useState<number | 'all'>('all');
  const [batchFilterCategory, setBatchFilterCategory] = useState<string>('all');
  const [batchFilterLocation, setBatchFilterLocation] = useState<string>('all');
  const [selectedBatchItemIds, setSelectedBatchItemIds] = useState<string[]>([]);

  // Schedule change notification prompt state (Requirement 19)
  const [scheduleChangePrompt, setScheduleChangePrompt] = useState<{
    title: string;
    oldTime: string;
    newTime: string;
    location: string;
  } | null>(null);

  useEffect(() => {
    eventStudioService.detectScheduleConflicts().then(setConflicts);
  }, [scheduleList]);

  // Dynamic activity type modal
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({
    name: '',
    category: 'scout_craft',
    description: '',
    defaultXp: 25,
  });

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  // Prevent duplicate submissions while GAS is processing the save request.
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Omit<ScheduleItem, 'id'>>({
    title: '',
    category: 'pioneering',
    time: '',
    date: '',
    dayNumber: 1,
    location: '',
    description: '',
    mandatoryFor: [],
    xpReward: 0,
    status: 'upcoming',
  });

  // Activity modal state
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState<Omit<CampActivity, 'id'>>({
    name: '',
    type: activityTypes[0]?.name || 'Pioneering',
    description: '',
    targetGroup: 'Penggalang & Penegak',
    location: '',
    startTime: '08:00',
    endTime: '11:00',
    dayNumber: 1,
    attendanceRequired: true,
    pointRule: 20,
    capacity: 200,
    status: 'active',
  });

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenAddSchedule = () => {
    if (!eventDays.length) {
      showToast('Atur Tanggal Mulai dan Tanggal Selesai event terlebih dahulu di Pengaturan Umum Event.');
      return;
    }
    const selected = eventDays.find(day => day.day === selectedDay) || eventDays[0];
    setEditingScheduleId(null);
    setScheduleForm({
      title: '',
      category: 'pioneering',
      time: '',
      date: selected.date,
      dayNumber: selected.day,
      location: '',
      description: '',
      mandatoryFor: [],
      xpReward: 0,
      status: 'upcoming',
    });
    setShowScheduleModal(true);
  };

  const handleEditSchedule = (item: ScheduleItem) => {
    setEditingScheduleId(item.id);
    setScheduleForm({
      title: item.title,
      category: item.category,
      time: item.time,
      date: item.date,
      dayNumber: item.dayNumber,
      location: item.location,
      description: item.description,
      mandatoryFor: item.mandatoryFor,
      xpReward: item.xpReward,
      status: item.status,
    });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSchedule) return;
    if (!scheduleForm.title.trim()) return;
    const selectedDate = eventDays.find(day => day.day === scheduleForm.dayNumber);
    if (!selectedDate) {
      showToast('Tanggal event belum valid atau hari agenda berada di luar rentang event.');
      return;
    }
    const payload = { ...scheduleForm, date: selectedDate.date };
    setSavingSchedule(true);
    try {
      if (editingScheduleId) {
        const prevItem = scheduleList.find(s => s.id === editingScheduleId);
        await eventStudioService.updateSchedule(editingScheduleId, payload);
        showToast('✅ Agenda jadwal berhasil diperbarui!');
        if (
          prevItem &&
          prevItem.isPublished !== false &&
          (prevItem.time !== scheduleForm.time || prevItem.location !== scheduleForm.location)
        ) {
          setScheduleChangePrompt({
            title: scheduleForm.title,
            oldTime: prevItem.time,
            newTime: scheduleForm.time,
            location: scheduleForm.location,
          });
        }
      } else {
        await eventStudioService.addSchedule(payload);
        showToast('✅ Agenda jadwal baru berhasil ditambahkan!');
      }
      setScheduleList([...eventStudioService.getSchedule()]);
      setShowScheduleModal(false);
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await eventStudioService.duplicateSchedule(id);
      setScheduleList([...eventStudioService.getSchedule()]);
      showToast('📋 Agenda berhasil diduplikasi!');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin membatalkan/menghapus agenda ini?')) {
      try {
        await eventStudioService.deleteSchedule(id);
        setScheduleList([...eventStudioService.getSchedule()]);
        showToast('🗑 Agenda jadwal telah dihapus.');
      } catch (err: any) {
        showToast(`❌ Gagal: ${err.message}`);
      }
    }
  };

  const handleTogglePublish = async (item: ScheduleItem) => {
    try {
      const nextState = item.isPublished === false ? true : false;
      const itemConflicts = conflicts.filter(c => c.scheduleAId === item.id || c.scheduleBId === item.id);

      if (nextState && itemConflicts.length > 0) {
        const proceed = confirm(
          `⚠️ Peringatan Bentrok Operasional:\n\n` +
          itemConflicts.map(c => `• ${c.conflictDetail}`).join('\n') +
          `\n\nApakah Anda yakin ingin tetap mempublikasikan agenda ini ke peserta (Override Panitia)?`
        );
        if (!proceed) return;
      }

      await eventStudioService.publishSchedule(item.id, nextState);
      setScheduleList([...eventStudioService.getSchedule()]);
      showToast(nextState ? '📡 Agenda berhasil disiarkan ke Portal Publik' : '↩️ Siaran agenda ditarik kembali menjadi draf internal');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleArchiveSchedule = async (id: string) => {
    if (confirm('Arsipkan agenda jadwal ini? Agenda akan dipindahkan ke arsip perkemahan.')) {
      try {
        await eventStudioService.archiveSchedule(id);
        setScheduleList([...eventStudioService.getSchedule()]);
        showToast('📦 Agenda jadwal berhasil diarsipkan.');
      } catch (err: any) {
        showToast(`❌ Gagal: ${err.message}`);
      }
    }
  };

  const handleMoveDay = async (id: string, newDay: number) => {
    const target = eventDays.find(day => day.day === newDay);
    if (!target) return;
    try {
      await eventStudioService.updateSchedule(id, { dayNumber: newDay, date: target.date });
      setScheduleList([...eventStudioService.getSchedule()]);
      showToast(`📅 Jadwal dipindahkan ke Hari ke-${newDay}`);
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.name) return;
    try {
      await eventStudioService.addActivity(activityForm);
      setActivityList([...eventStudioService.getActivities()]);
      setShowActivityModal(false);
      showToast('✅ Jenis aktivitas baru berhasil dibuat!');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeForm.name.trim()) return;
    try {
      const created = await eventStudioService.createActivityType(newTypeForm);
      const updated = eventStudioService.listActivityTypes();
      setActivityTypes([...updated]);
      setActivityForm(prev => ({ ...prev, type: created.name }));
      setShowAddTypeModal(false);
      setNewTypeForm({ name: '', category: 'scout_craft', description: '', defaultXp: 25 });
      showToast(`✅ Tipe aktivitas '${created.name}' berhasil ditambahkan!`);
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const filteredSchedule = scheduleList.filter(s =>
    selectedDay === 'all' ? true : s.dayNumber === selectedDay
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-xs text-emerald-300 font-semibold flex items-center justify-between shadow-lg">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-[#171717] dark:text-white tracking-tight">Manajemen Jadwal & Aktivitas Kemah</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Atur agenda harian, alokasi zona kegiatan, presensi QR, dan poin reward XP peserta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="p-1 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 flex">
            <button
              onClick={() => setSubTab('schedule')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'schedule' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📅 Agenda Jadwal
            </button>
            <button
              onClick={() => setSubTab('activities')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'activities' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ⛺ Master Aktivitas
            </button>
          </div>

          {subTab === 'schedule' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchItemIds(scheduleList.map(s => s.id));
                  setShowBatchPrintModal(true);
                }}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                title="Cetak Massal QR Kegiatan & Pos (A4 Sign & Grid)"
              >
                <Printer className="w-4 h-4 text-amber-200" />
                <span>Cetak Batch QR</span>
              </button>
              <button
                onClick={handleOpenAddSchedule}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Tambah Jadwal</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowActivityModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Tambah Aktivitas</span>
            </button>
          )}
        </div>
      </div>

      {!eventDays.length && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200 space-y-3">
          <p>
            {reloadingEvent
              ? 'Sedang membaca tanggal event resmi dari GAS…'
              : !eventLoadStatus.ready
                ? `Data tanggal event belum berhasil dimuat dari GAS.${dateLoadError || eventLoadStatus.error ? ` ${dateLoadError || eventLoadStatus.error}` : ''}`
                : 'Tanggal mulai atau selesai event tidak valid. Periksa Pengaturan Umum Event.'}
            {' '}Agenda yang sudah tersimpan tetap bisa dilihat melalui Semua Hari.
          </p>
          <button type="button" onClick={retryEventLoad} disabled={reloadingEvent} className="inline-flex items-center rounded-xl bg-amber-700 px-4 py-2 font-semibold text-white disabled:opacity-50 hover:bg-amber-800">
            {reloadingEvent ? 'Memuat…' : 'Muat Ulang Tanggal dari GAS'}
          </button>
        </div>
      )}

      {/* SUB-TAB 1: SCHEDULE MANAGEMENT */}
      {subTab === 'schedule' && (
        <div className="space-y-4">
          {/* Day & View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#141418] rounded-[24px] border border-[#ECECEF] dark:border-white/10 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[...eventDays, { day: 'all' as const, label: 'Semua Hari', date: '' }].map(d => (
                <button
                  key={d.day.toString()}
                  onClick={() => setSelectedDay(d.day as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    selectedDay === d.day
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
              >
                Kartu
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${viewMode === 'timeline' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
              >
                Garis Waktu
              </button>
            </div>
          </div>

          {/* Operational Conflicts Warning Banner */}
          {conflicts.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
              <span className="text-base mt-0.5">⚠️</span>
              <div className="space-y-0.5 flex-1">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Terdeteksi {conflicts.length} Potensi Bentrok Agenda Lapangan</span>
                  <span className="text-[10px] text-amber-300 font-mono">Integritas Jadwal</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Periksa tumpang tindih waktu, tempat, atau golongan peserta. Peringatan akan muncul bila Anda mempublikasikan jadwal yang bentrok.
                </div>
              </div>
            </div>
          )}

          {/* Cards / List View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSchedule.map(item => {
                const itemConflict = conflicts.find(c => c.scheduleAId === item.id || c.scheduleBId === item.id);

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-[24px] border flex flex-col justify-between gap-3 transition-all group shadow-xs ${
                      itemConflict
                        ? 'bg-amber-50/50 dark:bg-[#18231a] border-amber-300 dark:border-amber-500/40 hover:border-amber-400 dark:hover:border-amber-500/60'
                        : 'bg-white dark:bg-[#141418] border-[#ECECEF] dark:border-white/10 hover:border-emerald-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-bold border border-emerald-200 dark:border-transparent">
                            {item.time}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Hari ke-{item.dayNumber}</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-transparent">
                          <Zap className="w-3 h-3" />
                          <span>+{item.xpReward} XP</span>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-[#171717] dark:text-white mt-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{item.description}</p>

                      {/* Conflict Notification Badge */}
                      {itemConflict && (
                        <div className="mt-2 p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-500/30 text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span className="truncate">{itemConflict.conflictDetail}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-[#ECECEF] dark:border-white/5">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                        <span>{item.location}</span>
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <Users className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                        <span>{item.mandatoryFor.join(', ')}</span>
                      </span>
                    </div>
                  </div>

                  {/* Operational Action Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                    {/* Move Day quick dropdown */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>Pindah:</span>
                      {eventDays.filter(d => d.day !== item.dayNumber).map(({ day: d }) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleMoveDay(item.id, d)}
                          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                          title={`Pindah ke Hari ${d}`}
                        >
                          H{d}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedQrActivity({
                          id: item.id,
                          title: item.title,
                          category: item.category,
                          location: item.location,
                          scheduleTime: item.time,
                        })}
                        className="px-2.5 py-1 rounded-xl bg-red-700/30 hover:bg-red-700/50 text-red-300 border border-red-500/40 text-[11px] font-bold flex items-center gap-1 shadow transition-all"
                        title="Kelola QR Kegiatan, Presensi & Pos Tantangan"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-300" />
                        <span>QR Pos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(item)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          item.isPublished !== false
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                        title={item.isPublished !== false ? 'Agenda sudah disiarkan ke Portal Publik. Klik untuk menarik kembali menjadi draf.' : 'Agenda belum disiarkan. Klik untuk menyiarkan ke Portal Publik.'}
                        aria-label={item.isPublished !== false ? 'Tarik siaran agenda' : 'Siarkan agenda'}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>{item.isPublished !== false ? 'Disiarkan' : 'Siarkan'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(item.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                        title="Duplikasi Agenda"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSchedule(item)}
                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400"
                        title="Edit Agenda"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="ml-1 text-[11px] font-semibold">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveSchedule(item.id)}
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                        title="Arsipkan Agenda"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                        title="Hapus Agenda"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-500/30">
                {filteredSchedule.map(item => (
                  <div key={item.id} className="relative group">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#141418] shadow" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{item.time}</span>
                        <span className="text-sm font-bold text-[#171717] dark:text-white">{item.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">+{item.xpReward} XP</span>
                        <span>·</span>
                        <span>{item.location}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ACTIVITY DEFINITIONS */}
      {subTab === 'activities' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activityList.map(act => (
              <div key={act.id} className="p-4 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/30">
                    {act.type}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
                    <Zap className="w-3.5 h-3.5" />
                    <span>+{act.pointRule} XP</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[#171717] dark:text-white">{act.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{act.description}</p>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-[#ECECEF] dark:border-white/5">
                  <div>Sasaran: <span className="text-slate-800 dark:text-white font-medium">{act.targetGroup}</span></div>
                  <div>Lokasi: <span className="text-slate-800 dark:text-white font-medium">{act.location}</span></div>
                  <div>Waktu: <span className="text-slate-800 dark:text-white font-medium">{act.startTime} - {act.endTime}</span></div>
                  <div>Kapasitas: <span className="text-slate-800 dark:text-white font-medium">{act.capacity} Orang</span></div>
                </div>

                <div className="flex justify-end pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setSelectedQrActivity({
                      id: act.id,
                      title: act.name || act.title || '',
                      category: act.type,
                      location: act.location,
                      scheduleTime: `${act.startTime} - ${act.endTime}`,
                    })}
                    className="px-3 py-1.5 rounded-xl bg-red-700/80 hover:bg-red-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Kelola QR Pos & Tantangan</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL (ADD / EDIT) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] dark:text-white">
                {editingScheduleId ? 'Edit Agenda Jadwal' : '+ Tambah Agenda Jadwal Baru'}
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-sm">
              <div>
                <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Judul Kegiatan / Agenda:</label>
                <input
                  type="text"
                  value={scheduleForm.title}
                  onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  placeholder="Contoh: Apel Senja & Penurunan Bendera"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Hari ke-:</label>
                  <select
                    value={scheduleForm.dayNumber}
                    onChange={e => setScheduleForm({ ...scheduleForm, dayNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {!eventDays.length && <option value={scheduleForm.dayNumber}>Tanggal event belum diatur</option>}
                    {eventDays.map(day => <option key={day.date} value={day.day}>{day.label} · {day.date}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Rentang Waktu:</label>
                  <input
                    type="text"
                    value={scheduleForm.time}
                    onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    placeholder="08:00 - 10:00 WIB"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Lokasi Kegiatan / Venue:</label>
                <input
                  type="text"
                  value={scheduleForm.location}
                  onChange={e => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                  placeholder="Masukkan lokasi kegiatan"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  required
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Sasaran / Peserta Wajib:</label>
                <input
                  type="text"
                  value={scheduleForm.mandatoryFor.join(', ')}
                  onChange={e => setScheduleForm({ ...scheduleForm, mandatoryFor: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="Semua Peserta, Penegak, Pembina Pendamping"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Reward XP Peserta:</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={scheduleForm.xpReward}
                      onChange={e => setScheduleForm({ ...scheduleForm, xpReward: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-amber-700 dark:text-amber-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 font-bold">XP</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Kategori Agenda:</label>
                  <select
                    value={scheduleForm.category}
                    onChange={e => setScheduleForm({ ...scheduleForm, category: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="ceremony">Upacara / Apel</option>
                    <option value="pioneering">Pioneering</option>
                    <option value="competition">Lomba</option>
                    <option value="scout_craft">Keterampilan</option>
                    <option value="social">Bakti & Seni</option>
                    <option value="night_camp">Malam Api Unggun</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Keterangan & Petunjuk Teknis:</label>
                <textarea
                  rows={2}
                  value={scheduleForm.description}
                  onChange={e => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  placeholder="Petunjuk pakaian, perlengkapan yang dibawa, dan formasi apel..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  disabled={savingSchedule}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSchedule}
                  aria-busy={savingSchedule}
                  className="min-w-[150px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-wait transition-all"
                >
                  {savingSchedule ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/35 border-t-white animate-spin" aria-hidden="true" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan Agenda</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVITY MODAL */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] dark:text-white">+ Tambah Jenis Aktivitas Kemah</h3>
              <button
                onClick={() => setShowActivityModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4 text-sm">
              <div>
                <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Nama Aktivitas:</label>
                <input
                  type="text"
                  value={activityForm.name}
                  onChange={e => setActivityForm({ ...activityForm, name: e.target.value })}
                  placeholder="Contoh: Wide Game Penjelajahan Rimba"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-slate-200 font-semibold block">Tipe Kegiatan:</label>
                    <button
                      type="button"
                      onClick={() => setShowAddTypeModal(true)}
                      className="text-[10px] text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold underline"
                    >
                      + Buat Tipe
                    </button>
                  </div>
                  <select
                    value={activityForm.type}
                    onChange={e => setActivityForm({ ...activityForm, type: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-medium"
                  >
                    {activityTypes.map(t => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Poin XP Reward:</label>
                  <input
                    type="number"
                    value={activityForm.pointRule}
                    onChange={e => setActivityForm({ ...activityForm, pointRule: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-amber-700 dark:text-amber-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Deskripsi Singkat:</label>
                <textarea
                  rows={2}
                  value={activityForm.description}
                  onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                >
                  Simpan Aktivitas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ACTIVITY TYPE MODAL */}
      {showAddTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] dark:text-white">+ Buat Tipe Aktivitas Baru</h3>
              <button
                type="button"
                onClick={() => setShowAddTypeModal(false)}
                aria-label="Tutup form tipe aktivitas"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-4 text-sm">
              <div>
                <label htmlFor="new-activity-type-name" className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Nama Tipe Aktivitas:</label>
                <input
                  id="new-activity-type-name"
                  type="text"
                  value={newTypeForm.name}
                  onChange={e => setNewTypeForm({ ...newTypeForm, name: e.target.value })}
                  placeholder="Contoh: Survival Laut, Drone Scouting..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-activity-type-category" className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Kategori Utama:</label>
                  <select
                    id="new-activity-type-category"
                    value={newTypeForm.category}
                    onChange={e => setNewTypeForm({ ...newTypeForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="scout_craft">Keterampilan</option>
                    <option value="adventure">Petualangan</option>
                    <option value="ceremony">Upacara</option>
                    <option value="social">Sosial & Bakti</option>
                    <option value="education">Pendidikan</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="new-activity-type-xp" className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Default XP:</label>
                  <input
                    id="new-activity-type-xp"
                    type="number"
                    min={0}
                    value={newTypeForm.defaultXp}
                    onChange={e => setNewTypeForm({ ...newTypeForm, defaultXp: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-amber-700 dark:text-amber-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="new-activity-type-description" className="text-slate-700 dark:text-slate-200 font-semibold block mb-1">Deskripsi Ringkas:</label>
                <textarea
                  id="new-activity-type-description"
                  rows={3}
                  value={newTypeForm.description}
                  onChange={e => setNewTypeForm({ ...newTypeForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  placeholder="Penjelasan sasaran dan materi..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTypeModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan Tipe</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE CHANGE NOTIFICATION MODAL (Requirement 19) */}
      {scheduleChangePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Bell className="w-5 h-5" />
              <h3 className="text-base font-bold text-[#171717] dark:text-white">Kirim Pengumuman Perubahan Jadwal?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Agenda yang diperbarui telah dipublikasikan ke peserta. Apakah Anda ingin menyiarkan pengumuman pembaruan ini ke seluruh peserta dan pembina?
            </p>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
              <div className="font-bold text-white uppercase text-[10px]">Pratinjau Pengumuman:</div>
              <div className="font-bold text-amber-300">📢 Jadwal Berubah</div>
              <div className="font-semibold text-white">{scheduleChangePrompt.title}</div>
              <div className="font-mono text-emerald-300">{scheduleChangePrompt.oldTime} → {scheduleChangePrompt.newTime}</div>
              <div className="text-slate-300">📍 {scheduleChangePrompt.location}</div>
            </div>
            <div className="pt-2 border-t border-white/8 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setScheduleChangePrompt(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400"
              >
                Tidak Perlu
              </button>
              <button
                type="button"
                onClick={() => {
                  eventService.addAnnouncement({
                    title: `Jadwal Berubah: ${scheduleChangePrompt.title}`,
                    content: `${scheduleChangePrompt.title} mengalami penyesuaian waktu dari ${scheduleChangePrompt.oldTime} menjadi ${scheduleChangePrompt.newTime} bertempat di ${scheduleChangePrompt.location}.`,
                    priority: 'important',
                    targetGroup: 'everyone',
                  });
                  showToast('📢 Pengumuman perubahan jadwal berhasil disiarkan ke seluruh peserta!');
                  setScheduleChangePrompt(null);
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow"
              >
                Kirim Pengumuman
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY QR CONFIGURATION & PREVIEW MODAL (Req 1-7) */}
      {selectedQrActivity && (
        <ActivityQrModal
          activityId={selectedQrActivity.id}
          activityTitle={selectedQrActivity.title}
          category={selectedQrActivity.category}
          location={selectedQrActivity.location}
          scheduleTime={selectedQrActivity.scheduleTime}
          onClose={() => setSelectedQrActivity(null)}
          onOpenPrintSign={config => {
            setPrintSignConfigs([config]);
          }}
        />
      )}

      {/* PRINTABLE ACTIVITY SIGN (Req 5, 6, 7) */}
      {printSignConfigs && (
        <ActivityQrSignPrint
          configs={printSignConfigs}
          onClose={() => setPrintSignConfigs(null)}
        />
      )}

      {/* BATCH PRINT QR FILTER MODAL (Requirement 5) */}
      {showBatchPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ECECEF] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#171717] dark:text-white tracking-tight">Cetak Batch QR Kegiatan & Pos</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pilih filter dan agenda yang akan dicetak massal (Sign A4 & Grid Kartu).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter Bar (Day, Category, Location) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-black/40 rounded-2xl border border-white/5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Filter Hari:</label>
                <select
                  value={batchFilterDay.toString()}
                  onChange={e => setBatchFilterDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#0e1711] border border-white/10 rounded-xl text-white font-medium"
                >
                  <option value="all">Semua Hari Perkemahan</option>
                  {eventDays.map(d => (
                    <option key={d.date} value={d.day}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Filter Kategori:</label>
                <select
                  value={batchFilterCategory}
                  onChange={e => setBatchFilterCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0e1711] border border-white/10 rounded-xl text-white font-medium capitalize"
                >
                  <option value="all">Semua Kategori</option>
                  {Array.from(new Set(scheduleList.map(s => s.category))).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Filter Lokasi / Zona:</label>
                <select
                  value={batchFilterLocation}
                  onChange={e => setBatchFilterLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0e1711] border border-white/10 rounded-xl text-white font-medium truncate"
                >
                  <option value="all">Semua Lokasi / Zona</option>
                  {Array.from(new Set(scheduleList.map(s => s.location))).map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Checkbox Activity List */}
            {(() => {
              const matchedItems = scheduleList.filter(s => {
                if (batchFilterDay !== 'all' && s.dayNumber !== batchFilterDay) return false;
                if (batchFilterCategory !== 'all' && s.category !== batchFilterCategory) return false;
                if (batchFilterLocation !== 'all' && s.location !== batchFilterLocation) return false;
                return true;
              });

              const allMatchedSelected = matchedItems.length > 0 && matchedItems.every(s => selectedBatchItemIds.includes(s.id));

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-400">
                      Menampilkan <strong className="text-white">{matchedItems.length}</strong> agenda ({selectedBatchItemIds.length} dipilih)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ids = Array.from(new Set([...selectedBatchItemIds, ...matchedItems.map(m => m.id)]));
                          setSelectedBatchItemIds(ids);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        Pilih Semua Tampil
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          const matchedSet = new Set(matchedItems.map(m => m.id));
                          setSelectedBatchItemIds(prev => prev.filter(id => !matchedSet.has(id)));
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        Hapus Pilihan
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {matchedItems.map(item => {
                      const isChecked = selectedBatchItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedBatchItemIds(prev =>
                              isChecked ? prev.filter(id => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                            isChecked
                              ? 'bg-red-950/30 border-red-500/50 text-white'
                              : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="accent-red-600 rounded"
                            />
                            <div>
                              <div className="font-bold text-white">{item.title}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>Hari {item.dayNumber} · {item.time}</span>
                                <span>·</span>
                                <span>📍 {item.location}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.xpReward > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                                +{item.xpReward} XP
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-[10px] uppercase font-mono">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {selectedBatchItemIds.length} QR Code agenda siap dicetak
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowBatchPrintModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={selectedBatchItemIds.length === 0}
                  onClick={() => {
                    const selectedItems = scheduleList.filter(s => selectedBatchItemIds.includes(s.id));
                    const configs: ActivityQrConfig[] = selectedItems.map(s => {
                      const existing = activityQrService.getConfigByActivityId(s.id);
                      if (existing) return existing;
                      return activityQrService.configureActivityQr(s.id, {
                        title: s.title,
                        category: s.category,
                        location: s.location,
                        rewardXp: s.xpReward || 20,
                        scanOpens: s.time.split('-')[0]?.trim() || '07:30',
                        scanCloses: s.time.split('-')[1]?.trim() || '11:00',
                      });
                    });
                    setShowBatchPrintModal(false);
                    setPrintSignConfigs(configs);
                  }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-red-950/50"
                >
                  <Printer className="w-4 h-4" />
                  <span>Buka Lembar Cetak ({selectedBatchItemIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
