/**
 * @license
 * SiEpang - Single-Event Installation Event & Schedule Service
 * 1 Instalasi = 1 Kegiatan / Event.
 * Authoritative installation event hydrated directly from public.current.
 * Zero event switchers, zero fake events, zero multi-event selection.
 */

import { ScoutEvent, ScheduleItem, Announcement, PublicCurrentResponse } from '../types';
import { brandingService } from './brandingService';
import { apiTransport } from './apiTransport';
import { customerInstallationService } from './customerInstallationService';
export const EMPTY_EVENT: ScoutEvent = {
  id: '',
  workspaceId: '',
  name: 'Belum Dikonfigurasi',
  shortName: 'SiEpang',
  eventCode: 'NONE',
  category: 'Jambore',
  organizationalLevel: 'Kwarran',
  organizer: 'Kwartir Gerakan Pramuka',
  description: 'Instalasi SiEpang belum dikonfigurasi dengan Script Properties.',
  theme: 'Sistem Informasi Perkemahan Pramuka',
  startDate: '',
  endDate: '',
  registrationStart: '',
  registrationEnd: '',
  location: '',
  venue: '',
  campGround: '',
  participantCapacity: 0,
  registeredCount: 0,
  checkedInCount: 0,
  contingentCount: 0,
  competitionCount: 0,
  bannerUrl: '',
  logoUrl: '',
  status: 'UPCOMING',
  maxParticipants: 0,
  features: {
    attendance: true,
    qrCheckpoint: true,
    competition: true,
    voting: true,
    xp: true,
    leaderboard: true,
    digitalGallery: true,
    certificate: true,
    healthPost: true,
    logistics: true,
  },
  homeSections: [],
  contacts: { medical: '', security: '', secretariat: '', logistics: '' },
};

class EventService {
  // Authoritative single installation event
  private currentEvent: ScoutEvent = {
    ...EMPTY_EVENT,
  };
  private schedule: ScheduleItem[] = [];
  private publicScheduleRequest: Promise<void> | null = null;
  private publicScheduleEventId = '';
  private publicScheduleError: string | null = null;
  private announcements: Announcement[] = [];
  private listeners: Set<() => void> = new Set();
  private isLoading = false;
  private hasHydrated = false;
  private isConfigured = false;
  private configError: string | null = null;
  private lastErrorCode: string | null = null;

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb());
  }

  /**
   * Loads the authoritative installation event via public.current with detailed state
   */
  public async loadCurrentInstallationEventWithResult(): Promise<{
    state: 'CONFIGURED' | 'NOT_CONFIGURED' | 'BACKEND_UNREACHABLE';
    event: ScoutEvent;
    error: string | null;
    errorCode?: string;
  }> {
    if (this.isLoading) {
      const isUnreachable = this.lastErrorCode === 'NETWORK_ERROR' || this.lastErrorCode === 'TIMEOUT' || (this.lastErrorCode && this.lastErrorCode.startsWith('HTTP_'));
      return {
        state: this.isConfigured ? 'CONFIGURED' : (isUnreachable ? 'BACKEND_UNREACHABLE' : 'NOT_CONFIGURED'),
        event: this.currentEvent,
        error: this.configError,
        errorCode: this.lastErrorCode || undefined,
      };
    }
    this.isLoading = true;

    try {
      const res = await apiTransport.send<PublicCurrentResponse>('public.current');
      if (res.ok && res.data?.event) {
        this.isConfigured = true;
        this.configError = null;
        this.lastErrorCode = null;
        const raw = res.data.event;
        const normalized: ScoutEvent = {
          ...this.currentEvent,
          id: raw.id || this.currentEvent.id,
          workspaceId: res.data.workspace?.id || this.currentEvent.workspaceId,
          name: raw.name || this.currentEvent.name,
          shortName: raw.short_name || raw.shortName || this.currentEvent.shortName,
          eventCode: raw.event_code || raw.eventCode || this.currentEvent.eventCode,
          status: (raw.status as any) || this.currentEvent.status,
          category: (raw.category as any) || this.currentEvent.category,
          theme: raw.theme || this.currentEvent.theme,
          startDate: raw.start_date || raw.startDate || this.currentEvent.startDate,
          endDate: raw.end_date || raw.endDate || this.currentEvent.endDate,
          location: raw.location || this.currentEvent.location,
          venue: raw.venue || this.currentEvent.venue,
          campGround: raw.camp_ground || raw.campGround || this.currentEvent.campGround,
          participantCapacity: raw.participant_capacity ?? raw.participantCapacity ?? this.currentEvent.participantCapacity,
          registeredCount: raw.registeredCount ?? this.currentEvent.registeredCount,
          checkedInCount: raw.checkedInCount ?? this.currentEvent.checkedInCount,
          bannerUrl: raw.banner_url || raw.bannerUrl || this.currentEvent.bannerUrl,
          logoUrl: raw.logo_url || raw.logoUrl || this.currentEvent.logoUrl,
          features: raw.features ? { ...this.currentEvent.features, ...raw.features } : this.currentEvent.features,
        };

        this.setInstallationEvent(normalized);
        this.hasHydrated = true;
        return {
          state: 'CONFIGURED',
          event: this.currentEvent,
          error: null,
        };
      } else {
        this.isConfigured = false;
        const code = res.error?.code || 'INSTALLATION_NOT_CONFIGURED';
        this.lastErrorCode = code;
        this.configError = res.error?.message || 'Script Properties belum lengkap.';
        this.notify();

        const isUnreachable = code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code.startsWith('HTTP_');
        return {
          state: isUnreachable ? 'BACKEND_UNREACHABLE' : 'NOT_CONFIGURED',
          event: this.currentEvent,
          error: this.configError,
          errorCode: code,
        };
      }
    } catch (err: any) {
      this.isConfigured = false;
      this.lastErrorCode = 'NETWORK_ERROR';
      this.configError = err?.message || 'Gagal menghubungi backend instalasi.';
      this.notify();
      return {
        state: 'BACKEND_UNREACHABLE',
        event: this.currentEvent,
        error: this.configError,
        errorCode: 'NETWORK_ERROR',
      };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Loads the authoritative installation event via public.current
   */
  public async loadCurrentInstallationEvent(): Promise<ScoutEvent> {
    const res = await this.loadCurrentInstallationEventWithResult();
    return res.event;
  }

  public getIsConfigured(): boolean {
    return this.isConfigured;
  }

  public getConfigError(): string | null {
    return this.configError;
  }

  public getLastErrorCode(): string | null {
    return this.lastErrorCode;
  }

  /**
   * Authoritatively sets the single installation event
   */
  public setInstallationEvent(event: ScoutEvent): void {
    if (this.currentEvent.id !== event.id) {
      this.schedule = [];
      this.publicScheduleError = null;
    }
    this.currentEvent = { ...event };
    brandingService.applyBranding({
      eventShortName: event.shortName,
      logoUrl: event.logoUrl,
      bannerUrl: event.bannerUrl,
    });
    this.notify();
  }

  /**
   * Returns the single authoritative event for this installation
   */
  public getCurrentEvent(): ScoutEvent {
    return this.currentEvent;
  }

  /**
   * Refreshes the installation event from the server
   */
  public async refreshCurrentEvent(): Promise<ScoutEvent> {
    return this.loadCurrentInstallationEvent();
  }

  /**
   * Backward compatibility: Returns single event array (1 installation = 1 event)
   */
  public getEvents(): ScoutEvent[] {
    return [this.currentEvent];
  }

  /** Public read only. Never expose draft agendas, even if GAS returns them. */
  public async refreshPublicSchedule(): Promise<void> {
    const eventId = String(this.currentEvent.id || '').trim();
    if (!eventId) { this.publicScheduleError = null; this.setSchedule([]); return; }
    if (this.publicScheduleRequest && this.publicScheduleEventId === eventId) return this.publicScheduleRequest;
    this.publicScheduleEventId = eventId;
    const pending = (async () => {
      const res = await apiTransport.send<ScheduleItem[]>('schedules.list', { event_id: eventId }, { skipAuth: true });
      if (!res.ok || !Array.isArray(res.data)) {
        throw new Error(res.error?.message || 'Gagal mengambil jadwal publik dari GAS.');
      }
      // Avoid stale responses when installation/event context changes mid-flight.
      if (String(this.currentEvent.id || '').trim() !== eventId) return;
      const published = res.data
        .filter(item => item && item.isPublished === true && item.archived !== true)
        .filter(item => !item.eventId || String(item.eventId) === eventId)
        .sort((a, b) => (a.dayNumber - b.dayNumber) || String(a.startTime || a.time || '').localeCompare(String(b.startTime || b.time || '')));
      this.publicScheduleError = null;
      this.setSchedule(published);
    })().catch(error => {
      if (String(this.currentEvent.id || '').trim() === eventId) {
        this.publicScheduleError = error instanceof Error ? error.message : 'Jadwal publik tidak dapat dimuat.';
        // Never display old-event entries or private draft data on network failure.
        this.setSchedule([]);
      }
    }).finally(() => {
      if (this.publicScheduleRequest === pending) this.publicScheduleRequest = null;
    });
    this.publicScheduleRequest = pending;
    return pending;
  }

  public getPublicScheduleError(): string | null { return this.publicScheduleError; }

  public getSchedule(dayNumber?: number): ScheduleItem[] {
    if (dayNumber) {
      return this.schedule.filter(s => s.dayNumber === dayNumber);
    }
    return this.schedule;
  }

  public setSchedule(items: ScheduleItem[]): void {
    this.schedule = items;
    this.notify();
  }

  public getAnnouncements(): Announcement[] {
    return this.announcements;
  }

  public addAnnouncement(announcement: Omit<Announcement, 'id' | 'timestamp'>): Announcement {
    const newAnc: Announcement = {
      ...announcement,
      id: `anc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: 'Baru saja',
    };
    this.announcements.unshift(newAnc);
    this.notify();
    return newAnc;
  }
}

export const eventService = new EventService();
