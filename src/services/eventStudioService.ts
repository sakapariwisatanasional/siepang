/**
 * @license
 * SiEpang - Event Management Studio Service
 * Central service layer connecting React components to the SiEpang Backend API.
 * All mutations pass through:
 * Component -> Service -> apiTransport -> GAS -> Auth/Session/RBAC -> Spreadsheet/Drive
 */

import {
  ScoutEvent,
  ScheduleItem,
  CampActivity,
  ActivityType,
  CampsiteSubcamp,
  CampsiteZone,
  CampsiteBlock,
  CampsiteLot,
  CampFacility,
  Competition,
  CompetitionType,
  JudgingCriterion,
  CompetitionJudge,
  VotingConfig,
  RegistrationSettings,
  RegistrationFieldConfig,
  PointRuleConfig,
  BadgeConfig,
  QrCheckpoint,
  CustomInfoPage,
  EventContactItem,
  AuditLog,
  Organization,
  HomeSectionConfig,
  ScheduleConflict,
  CampsiteCapacityReport,
  CompetitionReadiness,
  EventReadinessReport,
  RegisteredDevice,
  RoleScopedSnapshot,
} from '../types';
import { apiTransport } from './apiTransport';
import { workspaceService } from './workspaceService';
import { EMPTY_EVENT } from './eventService';

export type SaveStatusType = 'Saved ✓' | 'Saving…' | 'Unsaved Changes' | 'Save Failed';

export interface StudioSaveState {
  hasUnsaved: boolean;
  status: SaveStatusType;
  lastSaved: string;
  errorMessage?: string;
}

class EventStudioService {
  // Local cache for immediate UI responsiveness and offline hydration
  private event: ScoutEvent = { ...EMPTY_EVENT };
  private eventLoadReady = false;
  private eventLoadError: string | null = null;
  private eventConfirmedMissing = false;
  private schedules: ScheduleItem[] = [];
  private activities: CampActivity[] = [];
  private activityTypes: ActivityType[] = [];
  private subcamps: CampsiteSubcamp[] = [];
  private zones: CampsiteZone[] = [];
  private blocks: CampsiteBlock[] = [];
  private lots: CampsiteLot[] = [];
  private facilities: CampFacility[] = [];
  private competitions: Competition[] = [];
  private competitionTypes: CompetitionType[] = [];
  private criteria: JudgingCriterion[] = [];
  private judges: CompetitionJudge[] = [];
  private votingConfig: VotingConfig = {
    votingEnabled: false,
    votingMode: 'single_choice',
    votingStart: '',
    votingEnd: '',
    maxVotes: 1,
    allowSelfVote: false,
    showVoteCounter: false,
    showLiveRank: false,
    votingOpen: false,
  };
  private registrationSettings: RegistrationSettings = {
    registrationStart: '',
    registrationEnd: '',
    maxParticipants: 0,
    contingentRepresentationLevel: 'KWARRAN',
    maxParticipantsPerContingent: 0,
    maxAdvisorsPerContingent: 0,
    allowSelfRegistration: false,
    status: 'CLOSED',
  };
  private dynamicFields: RegistrationFieldConfig[] = [];
  private pointRules: PointRuleConfig[] = [];
  private badges: BadgeConfig[] = [];
  private checkpoints: QrCheckpoint[] = [];
  private customPages: CustomInfoPage[] = [];
  private contacts: EventContactItem[] = [];
  private auditLogs: AuditLog[] = [];
  private organizations: Organization[] = [];

  // Autosave / Debounce State Management
  private saveState: StudioSaveState = {
    hasUnsaved: false,
    status: 'Saved ✓',
    lastSaved: 'Baru saja',
  };
  private pendingDraft: any = null;
  private debounceTimer: any = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Defer initial sync to next macrotask so all ESM singletons are fully initialized
    setTimeout(() => {
      this.initialSync();
    }, 0);
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  private normalizeEvent(raw?: Partial<ScoutEvent> | null): ScoutEvent {
    const source: any = raw || {};
    const fallback = EMPTY_EVENT;

    const pickString = (...values: any[]): string => {
      for (const value of values) {
        if (typeof value === 'string') return value;
        if (value !== undefined && value !== null) return String(value);
      }
      return '';
    };

    const pickNumber = (...values: any[]): number => {
      for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
      }
      return 0;
    };

    return {
      ...fallback,
      ...source,
      id: pickString(source.id, source.event_id, fallback.id),
      event_id: pickString(source.event_id, source.id, fallback.id),
      workspaceId: pickString(source.workspaceId, source.workspace_id, fallback.workspaceId),
      name: pickString(source.name, fallback.name),
      shortName: pickString(source.shortName, source.short_name, fallback.shortName),
      eventCode: pickString(source.eventCode, source.event_code, fallback.eventCode),
      category: (pickString(source.category, fallback.category) || 'Jambore') as ScoutEvent['category'],
      organizationalLevel: (
        pickString(
          source.organizationalLevel,
          source.organizational_level,
          fallback.organizationalLevel
        ) || 'Kwarcab'
      ) as ScoutEvent['organizationalLevel'],
      organizer: pickString(source.organizer, fallback.organizer),
      description: pickString(source.description, fallback.description),
      theme: pickString(source.theme, fallback.theme),
      startDate: pickString(source.startDate, source.start_date, fallback.startDate),
      endDate: pickString(source.endDate, source.end_date, fallback.endDate),
      registrationStart: pickString(
        source.registrationStart,
        source.registration_start,
        fallback.registrationStart
      ),
      registrationEnd: pickString(
        source.registrationEnd,
        source.registration_end,
        fallback.registrationEnd
      ),
      location: pickString(source.location, fallback.location),
      venue: pickString(source.venue, source.location, fallback.venue),
      campGround: pickString(
        source.campGround,
        source.camp_ground,
        source.venue,
        source.location,
        fallback.campGround
      ),
      participantCapacity: pickNumber(
        source.participantCapacity,
        source.participant_capacity,
        source.maxParticipants,
        fallback.participantCapacity
      ),
      maxParticipants: pickNumber(
        source.maxParticipants,
        source.participantCapacity,
        source.participant_capacity,
        fallback.maxParticipants
      ),
      bannerUrl: pickString(source.bannerUrl, source.banner_url, fallback.bannerUrl),
      logoUrl: pickString(source.logoUrl, source.logo_url, fallback.logoUrl),
      status: (
        pickString(source.status, fallback.status) || 'UPCOMING'
      ) as ScoutEvent['status'],
      contacts: {
        ...(fallback.contacts || {}),
        ...(source.contacts && typeof source.contacts === 'object' ? source.contacts : {}),
      },
      features: {
        ...(fallback.features || {}),
        ...(source.features && typeof source.features === 'object' ? source.features : {}),
      },
      homeSections: Array.isArray(source.homeSections)
        ? source.homeSections
        : Array.isArray(source.home_sections)
          ? source.home_sections
          : fallback.homeSections,
      registeredCount: pickNumber(source.registeredCount, fallback.registeredCount),
      checkedInCount: pickNumber(source.checkedInCount, fallback.checkedInCount),
      contingentCount: pickNumber(source.contingentCount, fallback.contingentCount),
      competitionCount: pickNumber(source.competitionCount, fallback.competitionCount),
    };
  }

  private normalizeRegistrationSettings(
    raw?: Partial<RegistrationSettings> | null
  ): RegistrationSettings {
    const source: any = raw || {};
    return {
      registrationStart: String(source.registrationStart ?? source.registration_start ?? ''),
      registrationEnd: String(source.registrationEnd ?? source.registration_end ?? ''),
      maxParticipants: Number(source.maxParticipants ?? source.max_participants ?? 0) || 0,
      contingentRepresentationLevel: (
        source.contingentRepresentationLevel ??
        source.contingent_representation_level ??
        'KWARRAN'
      ) as RegistrationSettings['contingentRepresentationLevel'],
      maxParticipantsPerContingent:
        Number(source.maxParticipantsPerContingent ?? source.max_participants_per_contingent ?? 0) || 0,
      maxAdvisorsPerContingent:
        Number(source.maxAdvisorsPerContingent ?? source.max_advisors_per_contingent ?? 0) || 0,
      allowSelfRegistration: Boolean(
        source.allowSelfRegistration ?? source.allow_self_registration ?? false
      ),
      status: (String(source.status ?? 'CLOSED') || 'CLOSED') as RegistrationSettings['status'],
    };
  }

  private normalizeVotingConfig(raw?: Partial<VotingConfig> | null): VotingConfig {
    const source: any = raw || {};
    return {
      votingEnabled: Boolean(source.votingEnabled ?? source.voting_enabled ?? false),
      votingMode: (
        source.votingMode ?? source.voting_mode ?? 'single_choice'
      ) as VotingConfig['votingMode'],
      votingStart: String(source.votingStart ?? source.voting_start ?? ''),
      votingEnd: String(source.votingEnd ?? source.voting_end ?? ''),
      maxVotes: Number(source.maxVotes ?? source.max_votes ?? 1) || 1,
      allowSelfVote: Boolean(source.allowSelfVote ?? source.allow_self_vote ?? false),
      showVoteCounter: Boolean(source.showVoteCounter ?? source.show_vote_counter ?? false),
      showLiveRank: Boolean(source.showLiveRank ?? source.show_live_rank ?? false),
      votingOpen: Boolean(source.votingOpen ?? source.voting_open ?? false),
    };
  }

  /**
   * Compatibility bridge:
   * keeps every existing Event Studio method signature intact while routing
   * legacy /api/... calls through the production GAS transport.
   */
  private readonly endpointActionMap: Record<string, string> = {
    '/api/events/archive': 'events.archive',
    '/api/schedules/list': 'schedules.list',
    '/api/schedules/create': 'schedules.create',
    '/api/schedules/update': 'schedules.update',
    '/api/schedules/duplicate': 'schedules.duplicate',
    '/api/schedules/move': 'schedules.move',
    '/api/schedules/publish': 'schedules.publish',
    '/api/schedules/archive': 'schedules.archive',
    '/api/activities/list': 'activities.list',
    '/api/activities/create': 'activities.create',
    '/api/activities/update': 'activities.update',
    '/api/activities/archive': 'activities.archive',
    '/api/activities/types/list': 'activities.types.list',
    '/api/activities/types/create': 'activities.types.create',
    '/api/campsite/subcamps/list': 'campsite.subcamps.list',
    '/api/campsite/subcamps/create': 'campsite.subcamps.create',
    '/api/campsite/zones/list': 'campsite.zones.list',
    '/api/campsite/zones/create': 'campsite.zones.create',
    '/api/campsite/blocks/list': 'campsite.blocks.list',
    '/api/campsite/blocks/create': 'campsite.blocks.create',
    '/api/campsite/lots/list': 'campsite.lots.list',
    '/api/campsite/lots/create': 'campsite.lots.create',
    '/api/campsite/lots/update': 'campsite.lots.update',
    '/api/campsite/lots/assign': 'campsite.lots.assign',
    '/api/campsite/lots/archive': 'campsite.lots.archive',
    '/api/campsite/facilities/list': 'campsite.facilities.list',
    '/api/campsite/facilities/create': 'campsite.facilities.create',
    '/api/campsite/facilities/update': 'campsite.facilities.update',
    '/api/campsite/facilities/archive': 'campsite.facilities.archive',
    '/api/campsite/capacity-check': 'campsite.capacity-check',
    '/api/competitions/types/list': 'competitions.types.list',
    '/api/competitions/types/create': 'competitions.types.create',
    '/api/competitions/list': 'competitions.list',
    '/api/competitions/create': 'competitions.create',
    '/api/competitions/update': 'competitions.update',
    '/api/competitions/officialize': 'competitions.officialize',
    '/api/competitions/archive': 'competitions.archive',
    '/api/competitions/criteria/list': 'competitions.criteria.list',
    '/api/competitions/criteria/configure': 'competitions.criteria.configure',
    '/api/competitions/judges/list': 'competitions.judges.list',
    '/api/competitions/judges/assign': 'competitions.judges.assign',
    '/api/competitions/judges/toggle-lock': 'competitions.judges.toggle-lock',
    '/api/competitions/judges/archive': 'competitions.judges.archive',
    '/api/competitions/voting/get': 'competitions.voting.get',
    '/api/competitions/voting/configure': 'competitions.voting.configure',
    '/api/competitions/readiness': 'competitions.readiness',
    '/api/registration/settings/get': 'registration.settings.get',
    '/api/registration/settings/update': 'registration.settings.update',
    '/api/registration/fields/list': 'registration.fields.list',
    '/api/registration/fields/create': 'registration.fields.create',
    '/api/registration/fields/update': 'registration.fields.update',
    '/api/gamification/points/list': 'gamification.points.list',
    '/api/gamification/points/create': 'gamification.points.create',
    '/api/gamification/points/update': 'gamification.points.update',
    '/api/gamification/points/archive': 'gamification.points.archive',
    '/api/gamification/badges/list': 'gamification.badges.list',
    '/api/gamification/badges/create': 'gamification.badges.create',
    '/api/gamification/badges/update': 'gamification.badges.update',
    '/api/gamification/badges/archive': 'gamification.badges.archive',
    '/api/gamification/checkpoints/list': 'gamification.checkpoints.list',
    '/api/gamification/checkpoints/create': 'gamification.checkpoints.create',
    '/api/gamification/checkpoints/update': 'gamification.checkpoints.update',
    '/api/gamification/checkpoints/archive': 'gamification.checkpoints.archive',
    '/api/gamification/checkpoints/regenerate': 'gamification.checkpoints.regenerate',
    '/api/features/update': 'features.update',
    '/api/features/home-sections/reorder': 'features.home-sections.reorder',
    '/api/content/pages/list': 'content.pages.list',
    '/api/content/pages/create': 'content.pages.create',
    '/api/content/pages/update': 'content.pages.update',
    '/api/content/pages/archive': 'content.pages.archive',
    '/api/content/contacts/list': 'content.contacts.list',
    '/api/content/contacts/create': 'content.contacts.create',
    '/api/content/contacts/update': 'content.contacts.update',
    '/api/audit/list': 'audit.list',
    '/api/audit/create': 'audit.create',
    '/api/organizations/list': 'organizations.list',
    '/api/organizations/create': 'organizations.create',
    '/api/readiness/get': 'readiness.get',
    '/api/conflicts/schedules': 'conflicts.schedules',
    '/api/devices/list': 'devices.list',
    '/api/devices/revoke': 'devices.revoke',
    '/api/devices/activate': 'devices.activate',
    '/api/sync/snapshot': 'sync.snapshot',
  };

  private async request<T>(
    path: string,
    options?: { data?: Record<string, any> }
  ): Promise<{ success: boolean; data: T | null; error?: string }> {
    const action = this.endpointActionMap[path];

    if (!action) {
      return {
        success: false,
        data: null,
        error: `Endpoint Event Studio belum dipetakan ke GAS: ${path}`,
      };
    }

    const res = await apiTransport.send<T>(
      action,
      options?.data || {},
      { timeoutMs: 30000 }
    );

    return {
      success: res.ok,
      data: res.data ?? null,
      error: res.error?.message,
    };
  }

  /**
   * Initializes cache by pulling live data through the API Client.
   */
  /** Limit GAS calls during initial sync to avoid flooding the proxy and Apps Script. */
  private async runLimitedSync_<T extends readonly (() => Promise<any>)[]>(tasks: T): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
    const results: any[] = new Array(tasks.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < tasks.length) {
        const index = nextIndex++;
        results[index] = await tasks[index]();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, () => worker()));
    return results as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
  }

  public async initialSync(): Promise<void> {
    try {
      const [
        evRes,
        schRes,
        actRes,
        actTypeRes,
        subRes,
        zoneRes,
        blockRes,
        lotRes,
        facRes,
        compTypeRes,
        compRes,
        critRes,
        jdgRes,
        voteRes,
        regRes,
        fldRes,
        ptRes,
        bdgRes,
        chkRes,
        pageRes,
        cntRes,
        audRes,
        orgRes,
      ] = await this.runLimitedSync_([
        () => apiTransport.send<ScoutEvent>('events.get', {}, { timeoutMs: 30000 }),
        () => this.request<ScheduleItem[]>('/api/schedules/list'),
        () => this.request<CampActivity[]>('/api/activities/list'),
        () => this.request<ActivityType[]>('/api/activities/types/list'),
        () => this.request<CampsiteSubcamp[]>('/api/campsite/subcamps/list'),
        () => this.request<CampsiteZone[]>('/api/campsite/zones/list'),
        () => this.request<CampsiteBlock[]>('/api/campsite/blocks/list'),
        () => this.request<CampsiteLot[]>('/api/campsite/lots/list'),
        () => this.request<CampFacility[]>('/api/campsite/facilities/list'),
        () => this.request<CompetitionType[]>('/api/competitions/types/list'),
        () => this.request<Competition[]>('/api/competitions/list'),
        () => this.request<JudgingCriterion[]>('/api/competitions/criteria/list'),
        () => this.request<CompetitionJudge[]>('/api/competitions/judges/list'),
        () => this.request<VotingConfig>('/api/competitions/voting/get'),
        () => this.request<RegistrationSettings>('/api/registration/settings/get'),
        () => this.request<RegistrationFieldConfig[]>('/api/registration/fields/list'),
        () => this.request<PointRuleConfig[]>('/api/gamification/points/list'),
        () => this.request<BadgeConfig[]>('/api/gamification/badges/list'),
        () => this.request<QrCheckpoint[]>('/api/gamification/checkpoints/list'),
        () => this.request<CustomInfoPage[]>('/api/content/pages/list'),
        () => this.request<EventContactItem[]>('/api/content/contacts/list'),
        () => this.request<AuditLog[]>('/api/audit/list'),
        () => this.request<Organization[]>('/api/organizations/list'),
      ]);

      if (evRes.ok && evRes.data) {
        this.event = this.normalizeEvent(evRes.data);
        this.eventLoadReady = true;
        this.eventLoadError = null;
      } else {
        // Preserve the last confirmed event; an API failure is not an empty event.
        this.eventLoadError = evRes.error?.message || 'Gagal memuat pengaturan event dari GAS.';
      }
      if (schRes.success && schRes.data) this.schedules = schRes.data;
      if (actRes.success && actRes.data) this.activities = actRes.data;
      if (actTypeRes.success && actTypeRes.data) this.activityTypes = actTypeRes.data;
      if (subRes.success && subRes.data) this.subcamps = subRes.data;
      if (zoneRes.success && zoneRes.data) this.zones = zoneRes.data;
      if (blockRes.success && blockRes.data) this.blocks = blockRes.data;
      if (lotRes.success && lotRes.data) this.lots = lotRes.data;
      if (facRes.success && facRes.data) this.facilities = facRes.data;
      if (compTypeRes.success && compTypeRes.data) this.competitionTypes = compTypeRes.data;
      if (compRes.success && compRes.data) this.competitions = compRes.data;
      if (critRes.success && critRes.data) this.criteria = critRes.data;
      if (jdgRes.success && jdgRes.data) this.judges = jdgRes.data;
      if (voteRes.success) this.votingConfig = this.normalizeVotingConfig(voteRes.data);
      if (regRes.success) this.registrationSettings = this.normalizeRegistrationSettings(regRes.data);
      if (fldRes.success && fldRes.data) this.dynamicFields = fldRes.data;
      if (ptRes.success && ptRes.data) this.pointRules = ptRes.data;
      if (bdgRes.success && bdgRes.data) this.badges = bdgRes.data;
      if (chkRes.success && chkRes.data) this.checkpoints = chkRes.data;
      if (pageRes.success && pageRes.data) this.customPages = pageRes.data;
      if (cntRes.success && cntRes.data) this.contacts = cntRes.data;
      if (audRes.success && audRes.data) this.auditLogs = audRes.data;
      if (orgRes.success && orgRes.data) this.organizations = orgRes.data;

      this.notify();
    } catch (err) {
      console.error('Initial sync error:', err);
    }
  }

  // ==================== AUTOSAVE & STATE ENGINE ====================

  public getSaveState(): StudioSaveState {
    return this.saveState;
  }

  public markDirty(draftPayload?: any, autosave = true) {
    this.pendingDraft = draftPayload || { event: this.event };
    this.saveState = {
      ...this.saveState,
      hasUnsaved: true,
      status: 'Unsaved Changes',
    };
    this.notify();

    // Debounced safe autosave (2000ms delay to avoid spreadsheet throttling)
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    if (autosave) {
      this.debounceTimer = setTimeout(() => {
        this.saveAll();
      }, 2500);
    }
  }

  public async saveAll(): Promise<boolean> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.saveState = {
      ...this.saveState,
      status: 'Saving…',
    };
    this.notify();

    try {
      if (!this.eventLoadReady) {
        throw new Error('Pengaturan event belum berhasil dimuat dari GAS.');
      }
      const eventId = String(this.event.id || '').trim();

      if (!eventId) {
        throw new Error(
          'Event aktif belum terhubung ke backend. Muat ulang Event Studio lalu coba lagi.'
        );
      }

      const res = await apiTransport.send<ScoutEvent>(
        'events.update',
        {
          eventId,
          updates: this.event,
        },
        {
          timeoutMs: 30000,
        }
      );

      if (res.ok && res.data) {
        this.event = this.normalizeEvent(res.data);
        this.pendingDraft = null;
        this.saveState = {
          hasUnsaved: false,
          status: 'Saved ✓',
          lastSaved: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
        this.notify();
        return true;
      }

      this.saveState = {
        hasUnsaved: true,
        status: 'Save Failed',
        lastSaved: this.saveState.lastSaved,
        errorMessage:
          res.error?.message || 'Gagal menyimpan ke backend Google Apps Script.',
      };
      this.notify();
      return false;
    } catch (err: any) {
      this.saveState = {
        hasUnsaved: true,
        status: 'Save Failed',
        lastSaved: this.saveState.lastSaved,
        errorMessage:
          err?.message || 'Gagal menyimpan pengaturan event.',
      };
      this.notify();
      return false;
    }
  }

  // ==================== EVENT CONTRACT ====================

  public getEvent(): ScoutEvent {
    return this.event;
  }

  public getEventLoadStatus(): { ready: boolean; error: string | null } {
    return { ready: this.eventLoadReady, error: this.eventLoadError, notFound: this.eventConfirmedMissing };
  }

  public async refreshGeneralEvent(): Promise<void> {
    const res = await apiTransport.send<ScoutEvent>('events.get', {}, { timeoutMs: 30000 });
    if (!res.ok || !res.data) {
      this.eventConfirmedMissing = false;
      this.eventLoadError = res.error?.message || 'Gagal membaca pengaturan event dari GAS.';
      // An absent specific event is not proof that the workspace has no events.
      // Only an authoritative empty events.list can enable event creation.
      if (res.error?.code === 'EVENT_NOT_FOUND') {
        const ws = workspaceService.getCurrentWorkspace()?.id;
        if (ws) {
          const listing = await apiTransport.send<ScoutEvent[]>('events.list', { workspace_id: ws }, { timeoutMs: 30000 });
          this.eventConfirmedMissing = Boolean(listing.ok && Array.isArray(listing.data) && listing.data.length === 0);
        }
      }
      this.notify();
      throw new Error(this.eventLoadError);
    }
    const normalized = this.normalizeEvent(res.data);
    if (!String(normalized.id || '').trim()) {
      this.eventLoadError = 'Respons events.get tidak memiliki ID event.';
      this.notify();
      throw new Error(this.eventLoadError);
    }
    this.event = normalized;
    this.eventLoadReady = true;
    this.eventConfirmedMissing = false;
    this.eventLoadError = null;
    this.notify();
  }

  public async createNewEvent(input: { name: string; shortName?: string; startDate: string; endDate: string; location?: string }): Promise<ScoutEvent> {
    if (this.eventLoadReady || !this.eventConfirmedMissing) {
      throw new Error('Pembuatan event hanya tersedia setelah GAS memastikan workspace belum memiliki event.');
    }
    const workspaceId = workspaceService.getCurrentWorkspace()?.id;
    if (!workspaceId) throw new Error('Workspace aktif tidak ditemukan.');
    const name = input.name.trim();
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) || input.endDate < input.startDate) {
      throw new Error('Nama dan rentang tanggal kegiatan wajib diisi dengan benar.');
    }
    // Recheck immediately before mutation to avoid duplicate events from stale UI state.
    const check = await apiTransport.send<ScoutEvent[]>('events.list', { workspace_id: workspaceId }, { timeoutMs: 30000 });
    if (!check.ok || !Array.isArray(check.data)) throw new Error(check.error?.message || 'Gagal memastikan daftar event dari GAS.');
    if (check.data.length !== 0) {
      this.eventConfirmedMissing = false;
      this.eventLoadError = 'Workspace sudah memiliki event. Muat ulang halaman dan pilih event yang tersedia.';
      this.notify();
      throw new Error(this.eventLoadError);
    }
    const created = await apiTransport.send<ScoutEvent>('events.create', {
      event: { workspace_id: workspaceId, name, shortName: input.shortName?.trim() || name, startDate: input.startDate, endDate: input.endDate, location: input.location?.trim() || '', status: 'DRAFT' },
    }, { timeoutMs: 30000 });
    if (!created.ok || !created.data) throw new Error(created.error?.message || 'Gagal membuat event baru di GAS.');
    const normalized = this.normalizeEvent(created.data);
    if (!normalized.id || normalized.workspaceId !== workspaceId) throw new Error('GAS tidak mengembalikan identitas event yang sesuai. Periksa daftar Events sebelum mencoba lagi.');
    this.event = normalized;
    this.eventLoadReady = true;
    this.eventConfirmedMissing = false;
    this.eventLoadError = null;
    this.notify();
    return normalized;
  }

  public async updateEvent(updates: Partial<ScoutEvent>): Promise<ScoutEvent> {
    // Manual save supersedes a pending autosave of an earlier draft.
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.saveState = { ...this.saveState, status: 'Saving…' };
    this.notify();

    // Recover authoritative event identity before saving. A transient initialSync
    // failure must not make a valid Spreadsheet event permanently unsaveable.
    // Do not synthesize an ID or write the locally edited form as the source.
    if (!this.eventLoadReady || !String(this.event.id || '').trim()) {
      try {
        await this.refreshGeneralEvent();
      } catch (error: any) {
        const message = `Gagal membaca event aktif dari GAS. Perubahan belum disimpan. ${error?.message || ''}`.trim();
        this.saveState = { ...this.saveState, hasUnsaved: true, status: 'Save Failed', errorMessage: message };
        this.notify();
        throw new Error(message);
      }
    }

    const eventId = String(this.event.id || '').trim();
    if (!eventId) {
      const message = 'Respons events.get tidak berisi ID event valid. Penyimpanan dibatalkan untuk melindungi data.';
      this.saveState = { ...this.saveState, hasUnsaved: true, status: 'Save Failed', errorMessage: message };
      this.notify();
      throw new Error(message);
    }

    const res = await apiTransport.send<ScoutEvent>(
      'events.update',
      {
        eventId,
        updates,
      },
      {
        timeoutMs: 30000,
      }
    );

    if (res.ok && res.data) {
      this.event = this.normalizeEvent(res.data);
      this.pendingDraft = null;
      this.saveState = {
        hasUnsaved: false,
        status: 'Saved ✓',
        lastSaved: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      // Audit refresh is intentionally not allowed to turn a successful
      // event mutation into "Save Failed". GAS event update already records
      // its authoritative audit entry server-side.
      this.notify();
      return this.event;
    }

    const message =
      res.error?.message || 'Gagal memperbarui event di backend Google Apps Script.';

    this.saveState = {
      hasUnsaved: true,
      status: 'Save Failed',
      lastSaved: this.saveState.lastSaved,
      errorMessage: message,
    };
    this.notify();
    throw new Error(message);
  }

  public updateGeneralSettings(updates: Partial<ScoutEvent>): Promise<ScoutEvent> {
    return this.updateEvent(updates);
  }

  public async archiveEvent(eventId?: string): Promise<ScoutEvent> {
    const res = await this.request<ScoutEvent>('/api/events/archive', {
      data: { eventId: eventId || this.event.id },
    });
    if (res.success && res.data) {
      this.event = res.data;
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mengarsipkan event.');
  }

  // ==================== SCHEDULE CONTRACT ====================

  public listSchedules(): ScheduleItem[] {
    return this.schedules;
  }

  public getSchedule(): ScheduleItem[] {
    return this.listSchedules();
  }

  public async createSchedule(schedule: Omit<ScheduleItem, 'id'>): Promise<ScheduleItem> {
    this.saveState = { ...this.saveState, status: 'Saving…' };
    this.notify();

    const res = await this.request<ScheduleItem>('/api/schedules/create', {
      data: { schedule },
    });

    if (res.success && res.data) {
      this.schedules.push(res.data);
      this.schedules.sort((a, b) => ((a.dayNumber ?? 0) - (b.dayNumber ?? 0)) || (a.time || '').localeCompare(b.time || ''));
      this.saveState = {
        hasUnsaved: false,
        status: 'Saved ✓',
        lastSaved: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    this.saveState = { ...this.saveState, status: 'Save Failed', errorMessage: res.error };
    this.notify();
    throw new Error(res.error || 'Gagal menambah jadwal.');
  }

  public addSchedule(schedule: Omit<ScheduleItem, 'id'>): Promise<ScheduleItem> {
    return this.createSchedule(schedule);
  }

  public async updateSchedule(id: string, updates: Partial<ScheduleItem>): Promise<ScheduleItem> {
    this.saveState = { ...this.saveState, status: 'Saving…' };
    this.notify();

    const res = await this.request<ScheduleItem>('/api/schedules/update', {
      data: { id, updates },
    });

    if (res.success && res.data) {
      this.schedules = this.schedules.map(s => s.id === id ? res.data! : s);
      this.saveState = {
        hasUnsaved: false,
        status: 'Saved ✓',
        lastSaved: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    this.saveState = { ...this.saveState, status: 'Save Failed', errorMessage: res.error };
    this.notify();
    throw new Error(res.error || 'Gagal memperbarui jadwal.');
  }

  public async duplicateSchedule(id: string): Promise<ScheduleItem> {
    const res = await this.request<ScheduleItem>('/api/schedules/duplicate', {
      data: { id },
    });
    if (res.success && res.data) {
      this.schedules.push(res.data);
      this.schedules.sort((a, b) => ((a.dayNumber ?? 0) - (b.dayNumber ?? 0)) || (a.time || '').localeCompare(b.time || ''));
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal menduplikasi jadwal.');
  }

  public async moveSchedule(id: string, newDay: number): Promise<ScheduleItem> {
    const res = await this.request<ScheduleItem>('/api/schedules/move', {
      data: { id, newDay },
    });
    if (res.success && res.data) {
      this.schedules = this.schedules.map(s => s.id === id ? res.data! : s);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memindahkan jadwal.');
  }

  public moveScheduleDay(id: string, newDay: number): Promise<ScheduleItem> {
    return this.moveSchedule(id, newDay);
  }

  public async publishSchedule(id: string, isPublished: boolean): Promise<ScheduleItem> {
    const res = await this.request<ScheduleItem>('/api/schedules/publish', {
      data: { id, isPublished },
    });
    if (res.success && res.data) {
      this.schedules = this.schedules.map(s => s.id === id ? res.data! : s);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mengubah status publikasi jadwal.');
  }

  public async archiveSchedule(id: string): Promise<ScheduleItem> {
    const res = await this.request<ScheduleItem>('/api/schedules/archive', {
      data: { id },
    });
    if (res.success && res.data) {
      this.schedules = this.schedules.filter(s => s.id !== id);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mengarsipkan jadwal.');
  }

  public deleteSchedule(id: string): Promise<ScheduleItem> {
    return this.archiveSchedule(id);
  }

  // ==================== ACTIVITIES CONTRACT ====================

  public listActivities(): CampActivity[] {
    return this.activities;
  }

  public getActivities(): CampActivity[] {
    return this.listActivities();
  }

  public async createActivity(activity: Omit<CampActivity, 'id'>): Promise<CampActivity> {
    const res = await this.request<CampActivity>('/api/activities/create', {
      data: { activity },
    });
    if (res.success && res.data) {
      this.activities.unshift(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat aktivitas.');
  }

  public addActivity(act: Omit<CampActivity, 'id'>): Promise<CampActivity> {
    return this.createActivity(act);
  }

  public async updateActivity(id: string, updates: Partial<CampActivity>): Promise<CampActivity> {
    const res = await this.request<CampActivity>('/api/activities/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.activities = this.activities.map(a => a.id === id ? res.data! : a);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui aktivitas.');
  }

  public async archiveActivity(id: string): Promise<CampActivity> {
    const res = await this.request<CampActivity>('/api/activities/archive', {
      data: { id },
    });
    if (res.success && res.data) {
      this.activities = this.activities.filter(a => a.id !== id);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mengarsipkan aktivitas.');
  }

  public deleteActivity(id: string): Promise<CampActivity> {
    return this.archiveActivity(id);
  }

  public listActivityTypes(): ActivityType[] {
    return this.activityTypes;
  }

  public async createActivityType(activityType: Omit<ActivityType, 'id'>): Promise<ActivityType> {
    const res = await this.request<ActivityType>('/api/activities/types/create', {
      data: { activityType },
    });
    if (res.success && res.data) {
      this.activityTypes.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat tipe aktivitas.');
  }

  // ==================== CAMPSITE CONTRACT ====================

  public listSubcamps(): CampsiteSubcamp[] {
    return this.subcamps;
  }

  public async createSubcamp(subcamp: Omit<CampsiteSubcamp, 'id'>): Promise<CampsiteSubcamp> {
    const res = await this.request<CampsiteSubcamp>('/api/campsite/subcamps/create', {
      data: { subcamp },
    });
    if (res.success && res.data) {
      this.subcamps.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat sub camp.');
  }

  public listZones(): CampsiteZone[] {
    return this.zones;
  }

  public async createZone(zone: Omit<CampsiteZone, 'id'>): Promise<CampsiteZone> {
    const res = await this.request<CampsiteZone>('/api/campsite/zones/create', {
      data: { zone },
    });
    if (res.success && res.data) {
      this.zones.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat zona kemah.');
  }

  public listBlocks(): CampsiteBlock[] {
    return this.blocks;
  }

  public async createBlock(block: Omit<CampsiteBlock, 'id'>): Promise<CampsiteBlock> {
    const res = await this.request<CampsiteBlock>('/api/campsite/blocks/create', {
      data: { block },
    });
    if (res.success && res.data) {
      this.blocks.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat blok tenda.');
  }

  public listLots(): CampsiteLot[] {
    return this.lots;
  }

  public getCampsiteLots(): CampsiteLot[] {
    return this.listLots();
  }

  public async createLot(lot: Omit<CampsiteLot, 'id'>): Promise<CampsiteLot> {
    const res = await this.request<CampsiteLot>('/api/campsite/lots/create', {
      data: { lot },
    });
    if (res.success && res.data) {
      this.lots.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal menambah kavling.');
  }

  public addCampsiteLot(lot: Omit<CampsiteLot, 'id'>): Promise<CampsiteLot> {
    return this.createLot(lot);
  }

  public async updateLot(id: string, updates: Partial<CampsiteLot>): Promise<CampsiteLot> {
    const res = await this.request<CampsiteLot>('/api/campsite/lots/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.lots = this.lots.map(l => l.id === id ? res.data! : l);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui kavling.');
  }

  public updateCampsiteLot(id: string, updates: Partial<CampsiteLot>): Promise<CampsiteLot> {
    return this.updateLot(id, updates);
  }

  public async deleteCampsiteLot(id: string): Promise<void> {
    const res = await this.request<CampsiteLot>('/api/campsite/lots/archive', {
      data: { id },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan kavling.');
    this.lots = this.lots.filter(l => l.id !== id);
    await this.refreshAudit();
    this.notify();
  }

  public async assignContingentToLot(lotId: string, contingentId: string, contingentName: string): Promise<CampsiteLot> {
    const res = await this.request<CampsiteLot>('/api/campsite/lots/assign', {
      data: { lotId, contingentId, contingentName },
    });
    if (res.success && res.data) {
      this.lots = this.lots.map(l => l.id === lotId ? res.data! : l);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal menetapkan kontingen ke kavling.');
  }

  public listFacilities(): CampFacility[] {
    return this.facilities;
  }

  public getFacilities(): CampFacility[] {
    return this.listFacilities();
  }

  public async createFacility(facility: Omit<CampFacility, 'id'>): Promise<CampFacility> {
    const res = await this.request<CampFacility>('/api/campsite/facilities/create', {
      data: { facility },
    });
    if (res.success && res.data) {
      this.facilities.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal menambah fasilitas.');
  }

  public addFacility(fac: Omit<CampFacility, 'id'>): Promise<CampFacility> {
    return this.createFacility(fac);
  }

  public async updateFacility(id: string, updates: Partial<CampFacility>): Promise<CampFacility> {
    const res = await this.request<CampFacility>('/api/campsite/facilities/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.facilities = this.facilities.map(f => f.id === id ? res.data! : f);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui fasilitas.');
  }

  public async deleteFacility(id: string): Promise<void> {
    const res = await this.request<CampFacility>('/api/campsite/facilities/archive', {
      data: { id },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan fasilitas.');
    this.facilities = this.facilities.filter(f => f.id !== id);
    await this.refreshAudit();
    this.notify();
  }

  // ==================== COMPETITIONS & JUDGING CONTRACT ====================

  public listCompetitionTypes(): CompetitionType[] {
    return this.competitionTypes;
  }

  public async createCompetitionType(competitionType: Omit<CompetitionType, 'id'>): Promise<CompetitionType> {
    const res = await this.request<CompetitionType>('/api/competitions/types/create', {
      data: { competitionType },
    });
    if (res.success && res.data) {
      this.competitionTypes.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat tipe kompetisi.');
  }

  /** Reload authoritative competition & judge lists after mutations. */
  public async refreshCompetitionManagement(): Promise<void> {
    const [comps, judges] = await Promise.all([
      this.request<Competition[]>('/api/competitions/list'),
      this.request<CompetitionJudge[]>('/api/competitions/judges/list'),
    ]);
    if (!comps.success || !Array.isArray(comps.data)) throw new Error(comps.error || 'Gagal membaca ulang lomba dari GAS.');
    if (!judges.success || !Array.isArray(judges.data)) throw new Error(judges.error || 'Gagal membaca ulang juri dari GAS.');
    this.competitions = comps.data;
    this.judges = judges.data;
    this.notify();
  }

  public listCompetitions(): Competition[] {
    return this.competitions;
  }

  public getCompetitions(): Competition[] {
    return this.listCompetitions();
  }

  public async createCompetition(competition: Omit<Competition, 'id' | 'registeredEntries'>): Promise<Competition> {
    const res = await this.request<Competition>('/api/competitions/create', {
      data: { competition },
    });
    if (res.success && res.data) {
      this.competitions.unshift(res.data);
      await this.refreshCompetitionManagement();
      if (!(this.competitions.some(c => c.id === res.data!.id))) throw new Error('GAS merespons sukses, tetapi data belum ditemukan pada pembacaan ulang.');
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat lomba.');
  }

  public addCompetition(comp: Omit<Competition, 'id' | 'registeredEntries'>): Promise<Competition> {
    return this.createCompetition(comp);
  }

  public async updateCompetition(id: string, updates: Partial<Competition>): Promise<Competition> {
    const res = await this.request<Competition>('/api/competitions/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.competitions = this.competitions.map(c => c.id === id ? res.data! : c);
      await this.refreshCompetitionManagement();
      if (!(this.competitions.some(c => c.id === id))) throw new Error('GAS merespons sukses, tetapi data belum ditemukan pada pembacaan ulang.');
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui lomba.');
  }

  public async officializeCompetition(id: string): Promise<void> {
    const res = await this.request<{id:string; publicationStatus:string}>('/api/competitions/officialize', {data:{id}});
    if (!res.success || res.data?.publicationStatus !== 'OFFICIAL') throw new Error(res.error || 'GAS belum mengonfirmasi pengesahan.');
    await this.refreshCompetitionManagement();
    const verified = this.competitions.find(c => c.id === id) as (Competition & {publicationStatus?:string}) | undefined;
    if (verified?.publicationStatus !== 'OFFICIAL') throw new Error('Status OFFICIAL belum terbaca kembali dari Spreadsheet.');
    this.notify();
  }

  public async deleteCompetition(id: string): Promise<void> {
    const res = await this.request<Competition>('/api/competitions/archive', {
      data: { id },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan lomba.');
    this.competitions = this.competitions.filter(c => c.id !== id);
    await this.refreshCompetitionManagement();
    if (this.competitions.some(c => c.id === id)) throw new Error('Lomba masih ditemukan setelah pengarsipan.');
    await this.refreshAudit();
    this.notify();
  }

  public listJudgingCriteria(): JudgingCriterion[] {
    return this.criteria;
  }

  public getJudgingCriteria(): JudgingCriterion[] {
    return this.listJudgingCriteria();
  }

  public async configureCriteria(criteria: JudgingCriterion[]): Promise<{ valid: boolean; totalWeight: number }> {
    const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
    const valid = totalWeight === 100;
    this.criteria = criteria;

    const res = await this.request<{ valid: boolean; totalWeight: number; criteria: JudgingCriterion[] }>('/api/competitions/criteria/configure', {
      data: { criteria },
    });

    if (res.success && res.data) {
      this.criteria = res.data.criteria;
      await this.refreshAudit();
      this.notify();
      return { valid: res.data.valid, totalWeight: res.data.totalWeight };
    }
    return { valid, totalWeight };
  }

  public updateJudgingCriteria(criteria: JudgingCriterion[]): { valid: boolean; totalWeight: number } {
    const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
    void this.configureCriteria(criteria).catch((err: any) => {
      this.saveState = {
        ...this.saveState,
        hasUnsaved: true,
        status: 'Save Failed',
        errorMessage: err?.message || 'Gagal menyimpan kriteria penilaian.',
      };
      this.notify();
    });
    return { valid: totalWeight === 100, totalWeight };
  }

  public listJudges(): CompetitionJudge[] {
    return this.judges;
  }

  public getJudges(): CompetitionJudge[] {
    return this.listJudges();
  }

  public async assignJudges(judge: Omit<CompetitionJudge, 'id'>): Promise<CompetitionJudge> {
    const res = await this.request<CompetitionJudge>('/api/competitions/judges/assign', {
      data: { judge },
    });
    if (res.success && res.data) {
      this.judges.push(res.data);
      await this.refreshCompetitionManagement();
      if (!(this.judges.some(j => j.id === res.data!.id))) throw new Error('GAS merespons sukses, tetapi data belum ditemukan pada pembacaan ulang.');
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal menugaskan juri.');
  }

  public async updateJudge(id: string, changes: Partial<CompetitionJudge>): Promise<CompetitionJudge> {
    const existing = this.judges.find(j => j.id === id);
    if (!existing) throw new Error('Juri belum ada dalam database yang dimuat.');
    const response = await this.request<CompetitionJudge>('/api/competitions/judges/assign', {
      data: { judge: { ...existing, ...changes, id } },
    });
    if (!response.success || !response.data) throw new Error(response.error || 'Gagal mengubah juri.');
    await this.refreshCompetitionManagement();
    const persisted = this.judges.find(j => j.id === id);
    if (!persisted) throw new Error('Juri belum ditemukan pada pembacaan ulang GAS.');
    return persisted;
  }

  public addJudge(judge: Omit<CompetitionJudge, 'id'>): Promise<CompetitionJudge> {
    return this.assignJudges(judge);
  }

  public async toggleJudgeLock(judgeId: string): Promise<CompetitionJudge> {
    const res = await this.request<CompetitionJudge>('/api/competitions/judges/toggle-lock', {
      data: { judgeId },
    });
    if (res.success && res.data) {
      this.judges = this.judges.map(j => j.id === judgeId ? res.data! : j);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mengubah kunci juri.');
  }

  public async deleteJudge(judgeId: string): Promise<void> {
    const res = await this.request<CompetitionJudge>('/api/competitions/judges/archive', {
      data: { id: judgeId },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan juri.');
    this.judges = this.judges.filter(j => j.id !== judgeId);
    await this.refreshCompetitionManagement();
    if (this.judges.some(j => j.id === judgeId)) throw new Error('Juri masih ditemukan setelah pengarsipan.');
    await this.refreshAudit();
    this.notify();
  }

  public getVotingConfig(): VotingConfig {
    return this.votingConfig;
  }

  public async configureVoting(config: Partial<VotingConfig>): Promise<VotingConfig> {
    const res = await this.request<VotingConfig>('/api/competitions/voting/configure', {
      data: { config },
    });
    if (res.success && res.data) {
      this.votingConfig = res.data;
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mengonfigurasi voting.');
  }

  public updateVotingConfig(updates: Partial<VotingConfig>): Promise<VotingConfig> {
    return this.configureVoting(updates);
  }

  // ==================== REGISTRATION CONTRACT ====================

  public getRegistrationSettings(): RegistrationSettings {
    return this.registrationSettings;
  }

  public async updateRegistrationSettings(settings: Partial<RegistrationSettings>): Promise<RegistrationSettings> {
    const res = await this.request<RegistrationSettings>('/api/registration/settings/update', {
      data: { settings },
    });
    if (res.success && res.data) {
      this.registrationSettings = res.data;
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui pengaturan registrasi.');
  }

  public listDynamicFields(): RegistrationFieldConfig[] {
    return this.dynamicFields;
  }

  public getRegistrationFields(): RegistrationFieldConfig[] {
    return this.listDynamicFields();
  }

  public async createDynamicField(field: Omit<RegistrationFieldConfig, 'id'>): Promise<RegistrationFieldConfig> {
    const res = await this.request<RegistrationFieldConfig>('/api/registration/fields/create', {
      data: { field },
    });
    if (res.success && res.data) {
      this.dynamicFields.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat kolom formulir dinamis.');
  }

  public addRegistrationField(field: Omit<RegistrationFieldConfig, 'id'>): Promise<RegistrationFieldConfig> {
    return this.createDynamicField(field);
  }

  public async updateDynamicField(id: string, updates: Partial<RegistrationFieldConfig>): Promise<RegistrationFieldConfig> {
    const res = await this.request<RegistrationFieldConfig>('/api/registration/fields/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.dynamicFields = this.dynamicFields.map(f => f.id === id ? res.data! : f);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui kolom formulir.');
  }

  public updateRegistrationField(id: string, updates: Partial<RegistrationFieldConfig>): Promise<RegistrationFieldConfig> {
    return this.updateDynamicField(id, updates);
  }

  // ==================== GAMIFICATION CONTRACT ====================

  public listPointRules(): PointRuleConfig[] {
    return this.pointRules;
  }

  public getPointRules(): PointRuleConfig[] {
    return this.listPointRules();
  }

  public async createPointRule(rule: Omit<PointRuleConfig, 'id'>): Promise<PointRuleConfig> {
    const res = await this.request<PointRuleConfig>('/api/gamification/points/create', {
      data: { rule },
    });
    if (res.success && res.data) {
      this.pointRules.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat aturan XP.');
  }

  public addPointRule(rule: Omit<PointRuleConfig, 'id'>): Promise<PointRuleConfig> {
    return this.createPointRule(rule);
  }

  public async updatePointRule(id: string, updates: Partial<PointRuleConfig>): Promise<PointRuleConfig> {
    const res = await this.request<PointRuleConfig>('/api/gamification/points/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.pointRules = this.pointRules.map(r => r.id === id ? res.data! : r);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui aturan XP.');
  }

  public async deletePointRule(id: string): Promise<void> {
    const res = await this.request<PointRuleConfig>('/api/gamification/points/archive', {
      data: { id },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan aturan XP.');
    this.pointRules = this.pointRules.filter(r => r.id !== id);
    await this.refreshAudit();
    this.notify();
  }

  public listBadges(): BadgeConfig[] {
    return this.badges;
  }

  public getBadges(): BadgeConfig[] {
    return this.listBadges();
  }

  public async createBadge(badge: Omit<BadgeConfig, 'id'>): Promise<BadgeConfig> {
    const res = await this.request<BadgeConfig>('/api/gamification/badges/create', {
      data: { badge },
    });
    if (res.success && res.data) {
      this.badges.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat lencana.');
  }

  public addBadge(badge: Omit<BadgeConfig, 'id'>): Promise<BadgeConfig> {
    return this.createBadge(badge);
  }

  public async updateBadge(id: string, updates: Partial<BadgeConfig>): Promise<BadgeConfig> {
    const res = await this.request<BadgeConfig>('/api/gamification/badges/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.badges = this.badges.map(b => b.id === id ? res.data! : b);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui lencana.');
  }

  public async deleteBadge(id: string): Promise<void> {
    const res = await this.request<BadgeConfig>('/api/gamification/badges/archive', {
      data: { id },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan lencana.');
    this.badges = this.badges.filter(b => b.id !== id);
    await this.refreshAudit();
    this.notify();
  }

  public listCheckpoints(): QrCheckpoint[] {
    return this.checkpoints;
  }

  public getCheckpoints(): QrCheckpoint[] {
    return this.listCheckpoints();
  }

  public async createCheckpoint(checkpoint: Omit<QrCheckpoint, 'id' | 'scanCount'>): Promise<QrCheckpoint> {
    const res = await this.request<QrCheckpoint>('/api/gamification/checkpoints/create', {
      data: { checkpoint },
    });
    if (res.success && res.data) {
      this.checkpoints.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat checkpoint.');
  }

  public addCheckpoint(chk: Omit<QrCheckpoint, 'id' | 'scanCount'>): Promise<QrCheckpoint> {
    return this.createCheckpoint(chk);
  }

  public async updateCheckpoint(id: string, updates: Partial<QrCheckpoint>): Promise<QrCheckpoint> {
    const res = await this.request<QrCheckpoint>('/api/gamification/checkpoints/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.checkpoints = this.checkpoints.map(c => c.id === id ? res.data! : c);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui checkpoint.');
  }

  public async deleteCheckpoint(id: string): Promise<void> {
    const res = await this.request<QrCheckpoint>('/api/gamification/checkpoints/archive', {
      data: { id },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan checkpoint.');
    this.checkpoints = this.checkpoints.filter(c => c.id !== id);
    await this.refreshAudit();
    this.notify();
  }

  public async regenerateCheckpointQr(id: string): Promise<string> {
    const res = await this.request<{ qrCode: string }>('/api/gamification/checkpoints/regenerate', {
      data: { id },
    });
    if (res.success && res.data) {
      this.checkpoints = this.checkpoints.map(c => c.id === id ? { ...c, qrCode: res.data!.qrCode } : c);
      await this.refreshAudit();
      this.notify();
      return res.data!.qrCode;
    }
    throw new Error(res.error || 'Gagal regenerasi kode QR.');
  }

  // ==================== EVENT FEATURES CONTRACT ====================

  public getEventFeatures(): ScoutEvent['features'] {
    return this.event.features;
  }

  public async updateEventFeature(featureKey: keyof ScoutEvent['features'], enabled: boolean): Promise<ScoutEvent['features']> {
    const res = await this.request<ScoutEvent['features']>('/api/features/update', {
      data: { featureKey, enabled },
    });
    if (res.success && res.data) {
      this.event.features = res.data;
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui sakelar fitur.');
  }

  public toggleFeature(featureKey: keyof ScoutEvent['features']): Promise<ScoutEvent['features']> {
    const curr = this.event.features[featureKey];
    return this.updateEventFeature(featureKey, !curr);
  }

  public async reorderHomepageSections(sections: HomeSectionConfig[]): Promise<HomeSectionConfig[]> {
    const res = await this.request<HomeSectionConfig[]>('/api/features/home-sections/reorder', {
      data: { sections },
    });
    if (res.success && res.data) {
      this.event.homeSections = res.data;
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui susunan seksi beranda.');
  }

  public updateHomeSections(sections: HomeSectionConfig[]): Promise<HomeSectionConfig[]> {
    return this.reorderHomepageSections(sections);
  }

  // ==================== CONTENT & CONTACTS CONTRACT ====================

  public listEventPages(): CustomInfoPage[] {
    return this.customPages;
  }

  public getCustomPages(): CustomInfoPage[] {
    return this.listEventPages();
  }

  public async createEventPage(page: Omit<CustomInfoPage, 'id'>): Promise<CustomInfoPage> {
    const res = await this.request<CustomInfoPage>('/api/content/pages/create', {
      data: { page },
    });
    if (res.success && res.data) {
      this.customPages.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal membuat halaman informasi.');
  }

  public addCustomPage(page: Omit<CustomInfoPage, 'id'>): Promise<CustomInfoPage> {
    return this.createEventPage(page);
  }

  public async updateEventPage(id: string, updates: Partial<CustomInfoPage>): Promise<CustomInfoPage> {
    const res = await this.request<CustomInfoPage>('/api/content/pages/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.customPages = this.customPages.map(p => p.id === id ? res.data! : p);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui halaman.');
  }

  public updateCustomPage(id: string, updates: Partial<CustomInfoPage>): Promise<CustomInfoPage> {
    return this.updateEventPage(id, updates);
  }

  public async deleteCustomPage(id: string): Promise<void> {
    const res = await this.request<CustomInfoPage>('/api/content/pages/archive', {
      data: { id },
    });
    if (!res.success) throw new Error(res.error || 'Gagal mengarsipkan halaman informasi.');
    this.customPages = this.customPages.filter(p => p.id !== id);
    await this.refreshAudit();
    this.notify();
  }

  public listEventContacts(): EventContactItem[] {
    return this.contacts;
  }

  public async createEventContact(contact: Omit<EventContactItem, 'id'>): Promise<EventContactItem> {
    const res = await this.request<EventContactItem>('/api/content/contacts/create', {
      data: { contact },
    });
    if (res.success && res.data) {
      this.contacts.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal menambah kontak posko.');
  }

  public async updateEventContact(id: string, updates: Partial<EventContactItem>): Promise<EventContactItem> {
    const res = await this.request<EventContactItem>('/api/content/contacts/update', {
      data: { id, updates },
    });
    if (res.success && res.data) {
      this.contacts = this.contacts.map(c => c.id === id ? res.data! : c);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal memperbarui kontak.');
  }

  // ==================== AUDIT CONTRACT ====================

  public listAuditLog(): AuditLog[] {
    return this.auditLogs;
  }

  public getAuditLogs(): AuditLog[] {
    return this.listAuditLog();
  }

  public addAuditLogEntry(action: string, details: string, user: string = 'Administrator Sistem'): void {
    // Preserve the existing synchronous UI contract, but persist the entry
    // authoritatively and refresh from Spreadsheet after success.
    void this.request<{ saved: boolean }>('/api/audit/create', {
      data: { action, details, user, target: this.event.id },
    }).then(async (res) => {
      if (!res.success) {
        this.saveState = {
          ...this.saveState,
          hasUnsaved: true,
          status: 'Save Failed',
          errorMessage: res.error || 'Gagal menyimpan audit log.',
        };
        this.notify();
        return;
      }
      await this.refreshAudit();
      this.notify();
    });
  }

  private async refreshAudit(): Promise<void> {
    const res = await this.request<AuditLog[]>('/api/audit/list', {
      data: { eventId: this.event.id },
    });
    if (res.success && res.data) {
      this.auditLogs = res.data;
    }
  }

  // ==================== ORGANIZATIONS CONTRACT ====================

  public listOrganizations(): Organization[] {
    return this.organizations;
  }

  public async createOrganization(organization: Omit<Organization, 'organization_id'>): Promise<Organization> {
    const res = await this.request<Organization>('/api/organizations/create', {
      data: { organization },
    });
    if (res.success && res.data) {
      this.organizations.push(res.data);
      await this.refreshAudit();
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mendaftarkan organisasi.');
  }

  // ==================== OPERATIONAL INTEGRITY & READINESS ====================

  public async getEventReadiness(): Promise<EventReadinessReport> {
    const res = await this.request<EventReadinessReport>('/api/readiness/get');
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error || 'Gagal menghitung skor kesiapan event.');
  }

  public async detectScheduleConflicts(): Promise<ScheduleConflict[]> {
    const res = await this.request<ScheduleConflict[]>('/api/conflicts/schedules');
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }

  public async validateCampsiteCapacity(): Promise<CampsiteCapacityReport> {
    const res = await this.request<CampsiteCapacityReport>('/api/campsite/capacity-check');
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error || 'Gagal memvalidasi daya tampung perkemahan.');
  }

  public async validateCompetitionReadiness(competitionId?: string): Promise<CompetitionReadiness[]> {
    const res = await this.request<CompetitionReadiness[]>('/api/competitions/readiness', {
      data: { competitionId },
    });
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }

  public async listDevices(): Promise<RegisteredDevice[]> {
    const res = await this.request<RegisteredDevice[]>('/api/devices/list');
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }

  public async revokeDevice(deviceId: string): Promise<RegisteredDevice> {
    const res = await this.request<RegisteredDevice>('/api/devices/revoke', {
      data: { deviceId },
    });
    if (res.success && res.data) {
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mencabut akses perangkat.');
  }

  public async activateDevice(deviceId: string): Promise<RegisteredDevice> {
    const res = await this.request<RegisteredDevice>('/api/devices/activate', {
      data: { deviceId },
    });
    if (res.success && res.data) {
      this.notify();
      return res.data;
    }
    throw new Error(res.error || 'Gagal mengaktifkan kembali perangkat.');
  }

  public async downloadRoleScopedSnapshot(): Promise<RoleScopedSnapshot | null> {
    const res = await this.request<RoleScopedSnapshot>('/api/sync/snapshot');
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }
}

export const eventStudioService = new EventStudioService();
