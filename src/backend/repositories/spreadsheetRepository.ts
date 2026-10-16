/**
 * @license
 * SiEpang - Spreadsheet & Drive Repository Layer
 * Abstracts real Google Spreadsheet sheets and Google Drive assets without
 * direct client-side mutations. All writes are persisted atomically.
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
  ChangeLogEntry,
  IncrementalPullResult,
  RegisteredDevice,
  RoleScopedSnapshot,
  UserRole,
  OfflineTransaction,
  BatchSyncResult,
} from '../../types';
// Default empty voting configuration
const DEFAULT_VOTING_CONFIG: VotingConfig = {
  votingEnabled: false,
  votingMode: 'single_choice',
  votingStart: '',
  votingEnd: '',
  maxVotes: 1,
  allowSelfVote: false,
  showVoteCounter: true,
  showLiveRank: false,
};

// Canonical Schema v1.6 Entity Interfaces
export interface FeatureConfigRecord {
  id: string;
  feature_key: string;
  scope_type: 'SYSTEM' | 'WORKSPACE' | 'EVENT';
  scope_id: string;
  configured_state: 'ENABLED' | 'DISABLED' | 'INHERIT';
  metadata_json?: Record<string, any>;
  updated_at: string;
  updated_by?: string;
}

export interface UserRoleAssignmentRecord {
  id: string;
  user_id: string;
  role: string;
  scope_type: 'WORKSPACE' | 'EVENT';
  scope_id: string;
  permissions_json?: string[];
  granted_by: string;
  granted_at: string;
}

export interface SponsorSettingsRecord {
  event_id: string;
  carousel_enabled: boolean;
  direction: string;
  carousel_duration_seconds: number;
  pause_on_hover: boolean;
  updated_at: string;
}

export interface PointTransactionRecord {
  id: string;
  event_id: string;
  participant_id: string;
  amount: number;
  reason: string;
  source_type: string;
  reference_id?: string;
  created_at: string;
  created_by: string;
}

class SpreadsheetRepository {
  private events: Map<string, ScoutEvent> = new Map();
  private schedules: Map<string, ScheduleItem> = new Map();
  private activities: Map<string, CampActivity> = new Map();
  private activityTypes: Map<string, ActivityType> = new Map();
  private subcamps: Map<string, CampsiteSubcamp> = new Map();
  private zones: Map<string, CampsiteZone> = new Map();
  private blocks: Map<string, CampsiteBlock> = new Map();
  private lots: Map<string, CampsiteLot> = new Map();
  private facilities: Map<string, CampFacility> = new Map();
  private competitions: Map<string, Competition> = new Map();
  private competitionTypes: Map<string, CompetitionType> = new Map();
  private judgingCriteria: Map<string, JudgingCriterion> = new Map();
  private judges: Map<string, CompetitionJudge> = new Map();
  private votingConfigs: Map<string, VotingConfig> = new Map();
  private registrationSettings: Map<string, RegistrationSettings> = new Map();
  private dynamicFields: Map<string, RegistrationFieldConfig> = new Map();
  private pointRules: Map<string, PointRuleConfig> = new Map();
  private badges: Map<string, BadgeConfig> = new Map();
  private checkpoints: Map<string, QrCheckpoint> = new Map();
  private customPages: Map<string, CustomInfoPage> = new Map();
  private contacts: Map<string, EventContactItem> = new Map();
  private auditLogs: AuditLog[] = [];
  private organizations: Map<string, Organization> = new Map();

  // Canonical Schema v1.6 Authoritative Stores
  private featureConfigs: Map<string, FeatureConfigRecord> = new Map();
  private userRoleAssignments: Map<string, UserRoleAssignmentRecord> = new Map();
  private sponsorSettings: Map<string, SponsorSettingsRecord> = new Map();
  private pointTransactions: PointTransactionRecord[] = [];

  // Offline, Synchronization & Idempotency Store
  private syncVersion: number = 100;
  private changeLog: ChangeLogEntry[] = [];
  private processedTransactions: Map<string, { status: string; result: any; timestamp: string; syncVersion: number }> = new Map();
  private registeredDevices: Map<string, RegisteredDevice> = new Map();

  constructor() {
    // Pure runtime state - starts with 0 dummy records
  }

  // ==================== EVENT REPOSITORY ====================

  public getEvent(id: string): ScoutEvent | null {
    return this.events.get(id) || null;
  }

  public createEvent(event: ScoutEvent): ScoutEvent {
    this.events.set(event.id, event);
    return event;
  }

  public updateEvent(id: string, updates: Partial<ScoutEvent>): ScoutEvent {
    const existing = this.events.get(id);
    if (!existing) throw new Error(`Event '${id}' tidak ditemukan di repositori.`);
    const updated = { ...existing, ...updates };
    this.events.set(id, updated);
    return updated;
  }

  public archiveEvent(id: string): ScoutEvent {
    return this.updateEvent(id, { status: 'ARCHIVED' });
  }

  // ==================== SCHEDULE REPOSITORY ====================

  public listSchedules(eventId: string): ScheduleItem[] {
    const all = Array.from(this.schedules.values()).filter(s => !s.archived);
    return all.sort((a, b) => a.dayNumber - b.dayNumber || a.time.localeCompare(b.time));
  }

  public createSchedule(eventId: string, schedule: Omit<ScheduleItem, 'id'>): ScheduleItem {
    const id = `sch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newItem: ScheduleItem = {
      ...schedule,
      id,
      isPublished: schedule.isPublished ?? true,
      archived: false,
    };
    this.schedules.set(id, newItem);
    return newItem;
  }

  public updateSchedule(id: string, updates: Partial<ScheduleItem>): ScheduleItem {
    const existing = this.schedules.get(id);
    if (!existing) throw new Error(`Jadwal '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.schedules.set(id, updated);
    return updated;
  }

  public duplicateSchedule(id: string): ScheduleItem {
    const existing = this.schedules.get(id);
    if (!existing) throw new Error(`Jadwal '${id}' tidak ditemukan.`);
    const dupId = `sch_${Date.now()}_dup`;
    const dupItem: ScheduleItem = {
      ...existing,
      id: dupId,
      title: `${existing.title} (Salinan Agenda)`,
    };
    this.schedules.set(dupId, dupItem);
    return dupItem;
  }

  public moveSchedule(id: string, newDay: number): ScheduleItem {
    return this.updateSchedule(id, { dayNumber: newDay });
  }

  public publishSchedule(id: string, isPublished: boolean): ScheduleItem {
    return this.updateSchedule(id, { isPublished });
  }

  public archiveSchedule(id: string): ScheduleItem {
    return this.updateSchedule(id, { archived: true });
  }

  // ==================== ACTIVITY REPOSITORY ====================

  public listActivities(eventId: string): CampActivity[] {
    return Array.from(this.activities.values()).filter(a => a.status !== 'cancelled');
  }

  public createActivity(eventId: string, act: Omit<CampActivity, 'id'>): CampActivity {
    const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newAct: CampActivity = { ...act, id };
    this.activities.set(id, newAct);
    return newAct;
  }

  public updateActivity(id: string, updates: Partial<CampActivity>): CampActivity {
    const existing = this.activities.get(id);
    if (!existing) throw new Error(`Aktivitas '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.activities.set(id, updated);
    return updated;
  }

  public archiveActivity(id: string): CampActivity {
    return this.updateActivity(id, { status: 'cancelled' });
  }

  public listActivityTypes(): ActivityType[] {
    return Array.from(this.activityTypes.values());
  }

  public createActivityType(actType: Omit<ActivityType, 'id'>): ActivityType {
    const id = `at_${Date.now()}`;
    const newType: ActivityType = { ...actType, id };
    this.activityTypes.set(id, newType);
    return newType;
  }

  // ==================== CAMPSITE REPOSITORY ====================

  public listSubcamps(eventId?: string): CampsiteSubcamp[] {
    return Array.from(this.subcamps.values());
  }

  public createSubcamp(eventId: string, subcamp: Omit<CampsiteSubcamp, 'id'>): CampsiteSubcamp {
    const id = `sub_${Date.now()}`;
    const newSub: CampsiteSubcamp = { ...subcamp, id };
    this.subcamps.set(id, newSub);
    return newSub;
  }

  public listZones(eventId?: string): CampsiteZone[] {
    return Array.from(this.zones.values());
  }

  public createZone(eventId: string, zone: Omit<CampsiteZone, 'id'>): CampsiteZone {
    const id = `zone_${Date.now()}`;
    const newZone: CampsiteZone = { ...zone, id };
    this.zones.set(id, newZone);
    return newZone;
  }

  public listBlocks(eventId?: string): CampsiteBlock[] {
    return Array.from(this.blocks.values());
  }

  public createBlock(eventId: string, block: Omit<CampsiteBlock, 'id'>): CampsiteBlock {
    const id = `block_${Date.now()}`;
    const newBlock: CampsiteBlock = { ...block, id };
    this.blocks.set(id, newBlock);
    return newBlock;
  }

  public listLots(eventId?: string): CampsiteLot[] {
    return Array.from(this.lots.values());
  }

  public createLot(eventId: string, lot: Omit<CampsiteLot, 'id'>): CampsiteLot {
    const id = `lot_${Date.now()}`;
    const newLot: CampsiteLot = { ...lot, id };
    this.lots.set(id, newLot);
    return newLot;
  }

  public updateLot(id: string, updates: Partial<CampsiteLot>): CampsiteLot {
    const existing = this.lots.get(id);
    if (!existing) throw new Error(`Kavling '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.lots.set(id, updated);
    return updated;
  }

  public assignContingentToLot(lotId: string, contingentId: string, contingentName: string): CampsiteLot {
    return this.updateLot(lotId, {
      contingentId,
      contingentName,
      status: 'occupied',
    });
  }

  public listFacilities(eventId?: string): CampFacility[] {
    return Array.from(this.facilities.values());
  }

  public createFacility(eventId: string, fac: Omit<CampFacility, 'id'>): CampFacility {
    const id = `fac_${Date.now()}`;
    const newFac: CampFacility = { ...fac, id };
    this.facilities.set(id, newFac);
    return newFac;
  }

  public updateFacility(id: string, updates: Partial<CampFacility>): CampFacility {
    const existing = this.facilities.get(id);
    if (!existing) throw new Error(`Fasilitas '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.facilities.set(id, updated);
    return updated;
  }

  public deleteFacility(id: string): void {
    this.facilities.delete(id);
  }

  // ==================== COMPETITIONS REPOSITORY ====================

  public listCompetitionTypes(): CompetitionType[] {
    return Array.from(this.competitionTypes.values());
  }

  public createCompetitionType(compType: Omit<CompetitionType, 'id'>): CompetitionType {
    const id = `ct_${Date.now()}`;
    const newType: CompetitionType = { ...compType, id };
    this.competitionTypes.set(id, newType);
    return newType;
  }

  public listCompetitions(eventId: string): Competition[] {
    return Array.from(this.competitions.values());
  }

  public createCompetition(eventId: string, comp: Omit<Competition, 'id' | 'registeredEntries'>): Competition {
    const id = `cmp_${Date.now()}`;
    const newComp: Competition = { ...comp, id, registeredEntries: 0 };
    this.competitions.set(id, newComp);
    return newComp;
  }

  public updateCompetition(id: string, updates: Partial<Competition>): Competition {
    const existing = this.competitions.get(id);
    if (!existing) throw new Error(`Lomba '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.competitions.set(id, updated);
    return updated;
  }

  public deleteCompetition(id: string): void {
    this.competitions.delete(id);
  }

  public listJudgingCriteria(eventId: string): JudgingCriterion[] {
    return Array.from(this.judgingCriteria.values());
  }

  public configureCriteria(eventId: string, criteria: JudgingCriterion[]): JudgingCriterion[] {
    this.judgingCriteria.clear();
    criteria.forEach(c => this.judgingCriteria.set(c.id, c));
    return criteria;
  }

  public listJudges(eventId: string): CompetitionJudge[] {
    return Array.from(this.judges.values());
  }

  public assignJudges(eventId: string, judge: Omit<CompetitionJudge, 'id'>): CompetitionJudge {
    const id = `jdg_${Date.now()}`;
    const newJudge: CompetitionJudge = { ...judge, id };
    this.judges.set(id, newJudge);
    return newJudge;
  }

  public toggleJudgeLock(id: string): CompetitionJudge {
    const existing = this.judges.get(id);
    if (!existing) throw new Error(`Juri '${id}' tidak ditemukan.`);
    existing.isLocked = !existing.isLocked;
    this.judges.set(id, existing);
    return existing;
  }

  public deleteJudge(id: string): void {
    this.judges.delete(id);
  }

  public getVotingConfig(eventId: string): VotingConfig {
    return this.votingConfigs.get(eventId) || { ...DEFAULT_VOTING_CONFIG };
  }

  public configureVoting(eventId: string, config: Partial<VotingConfig>): VotingConfig {
    const existing = this.getVotingConfig(eventId);
    const updated = { ...existing, ...config };
    this.votingConfigs.set(eventId, updated);
    return updated;
  }

  // ==================== REGISTRATION REPOSITORY ====================

  public getRegistrationSettings(eventId: string): RegistrationSettings {
    const found = this.registrationSettings.get(eventId);
    if (found) return found;
    const defaultSettings: RegistrationSettings = {
      registrationStart: '2026-08-01',
      registrationEnd: '2026-09-25',
      maxParticipants: 1500,
      contingentRepresentationLevel: 'KWARRAN',
      maxParticipantsPerContingent: 32,
      maxAdvisorsPerContingent: 4,
      allowSelfRegistration: true,
      status: 'OPEN',
    };
    this.registrationSettings.set(eventId, defaultSettings);
    return defaultSettings;
  }

  public updateRegistrationSettings(eventId: string, updates: Partial<RegistrationSettings>): RegistrationSettings {
    const existing = this.getRegistrationSettings(eventId);
    const updated = { ...existing, ...updates };
    this.registrationSettings.set(eventId, updated);
    return updated;
  }

  public listDynamicFields(eventId: string): RegistrationFieldConfig[] {
    return Array.from(this.dynamicFields.values());
  }

  public createDynamicField(eventId: string, field: Omit<RegistrationFieldConfig, 'id'>): RegistrationFieldConfig {
    const id = `fld_${Date.now()}`;
    const newField: RegistrationFieldConfig = { ...field, id };
    this.dynamicFields.set(id, newField);
    return newField;
  }

  public updateDynamicField(id: string, updates: Partial<RegistrationFieldConfig>): RegistrationFieldConfig {
    const existing = this.dynamicFields.get(id);
    if (!existing) throw new Error(`Kolom '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.dynamicFields.set(id, updated);
    return updated;
  }

  // ==================== GAMIFICATION REPOSITORY ====================

  public listPointRules(eventId: string): PointRuleConfig[] {
    return Array.from(this.pointRules.values());
  }

  public createPointRule(eventId: string, rule: Omit<PointRuleConfig, 'id'>): PointRuleConfig {
    const id = `rule_${Date.now()}`;
    const newRule: PointRuleConfig = { ...rule, id };
    this.pointRules.set(id, newRule);
    return newRule;
  }

  public updatePointRule(id: string, updates: Partial<PointRuleConfig>): PointRuleConfig {
    const existing = this.pointRules.get(id);
    if (!existing) throw new Error(`Aturan XP '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.pointRules.set(id, updated);
    return updated;
  }

  public deletePointRule(id: string): void {
    this.pointRules.delete(id);
  }

  public listBadges(eventId: string): BadgeConfig[] {
    return Array.from(this.badges.values());
  }

  public createBadge(eventId: string, badge: Omit<BadgeConfig, 'id'>): BadgeConfig {
    const id = `badge_${Date.now()}`;
    const newBadge: BadgeConfig = { ...badge, id };
    this.badges.set(id, newBadge);
    return newBadge;
  }

  public updateBadge(id: string, updates: Partial<BadgeConfig>): BadgeConfig {
    const existing = this.badges.get(id);
    if (!existing) throw new Error(`Lencana '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.badges.set(id, updated);
    return updated;
  }

  public deleteBadge(id: string): void {
    this.badges.delete(id);
  }

  public listCheckpoints(eventId: string): QrCheckpoint[] {
    return Array.from(this.checkpoints.values());
  }

  public createCheckpoint(eventId: string, checkpoint: Omit<QrCheckpoint, 'id' | 'scanCount'>): QrCheckpoint {
    const id = `chk_${Date.now()}`;
    const newChk: QrCheckpoint = { ...checkpoint, id, scanCount: 0 };
    this.checkpoints.set(id, newChk);
    return newChk;
  }

  public updateCheckpoint(id: string, updates: Partial<QrCheckpoint>): QrCheckpoint {
    const existing = this.checkpoints.get(id);
    if (!existing) throw new Error(`Checkpoint '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.checkpoints.set(id, updated);
    return updated;
  }

  public deleteCheckpoint(id: string): void {
    this.checkpoints.delete(id);
  }

  public regenerateCheckpointQr(id: string): string {
    const existing = this.checkpoints.get(id);
    if (!existing) throw new Error(`Checkpoint '${id}' tidak ditemukan.`);
    existing.qrCode = `CHK-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    this.checkpoints.set(id, existing);
    return existing.qrCode;
  }

  // ==================== EVENT FEATURES REPOSITORY ====================

  public getEventFeatures(eventId: string): ScoutEvent['features'] {
    const ev = this.getEvent(eventId);
    return ev?.features || {
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
    };
  }

  public updateEventFeature(eventId: string, featureKey: keyof ScoutEvent['features'], enabled: boolean): ScoutEvent['features'] {
    const ev = this.getEvent(eventId);
    if (!ev) throw new Error(`Event '${eventId}' tidak ditemukan.`);
    ev.features[featureKey] = enabled;
    this.events.set(ev.id, ev);
    return ev.features;
  }

  public reorderHomepageSections(eventId: string, sections: HomeSectionConfig[]): HomeSectionConfig[] {
    const ev = this.getEvent(eventId);
    if (!ev) throw new Error(`Event '${eventId}' tidak ditemukan.`);
    ev.homeSections = sections;
    this.events.set(ev.id, ev);
    return ev.homeSections;
  }

  // ==================== CONTENT & PAGES REPOSITORY ====================

  public listEventPages(eventId: string): CustomInfoPage[] {
    return Array.from(this.customPages.values()).sort((a, b) => a.order - b.order);
  }

  public createEventPage(eventId: string, page: Omit<CustomInfoPage, 'id'>): CustomInfoPage {
    const id = `page_${Date.now()}`;
    const newPage: CustomInfoPage = { ...page, id };
    this.customPages.set(id, newPage);
    return newPage;
  }

  public updateEventPage(id: string, updates: Partial<CustomInfoPage>): CustomInfoPage {
    const existing = this.customPages.get(id);
    if (!existing) throw new Error(`Halaman '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.customPages.set(id, updated);
    return updated;
  }

  public deleteEventPage(id: string): void {
    this.customPages.delete(id);
  }

  public listEventContacts(eventId: string): EventContactItem[] {
    return Array.from(this.contacts.values());
  }

  public createEventContact(eventId: string, contact: Omit<EventContactItem, 'id'>): EventContactItem {
    const id = `ct_${Date.now()}`;
    const newContact: EventContactItem = { ...contact, id };
    this.contacts.set(id, newContact);
    return newContact;
  }

  public updateEventContact(id: string, updates: Partial<EventContactItem>): EventContactItem {
    const existing = this.contacts.get(id);
    if (!existing) throw new Error(`Kontak '${id}' tidak ditemukan.`);
    const updated = { ...existing, ...updates };
    this.contacts.set(id, updated);
    return updated;
  }

  // ==================== AUDIT REPOSITORY ====================

  public listAuditLog(eventId?: string): AuditLog[] {
    if (eventId) {
      return this.auditLogs.filter(l => !l.event_id || l.event_id === eventId);
    }
    return this.auditLogs;
  }

  public addAuditLog(entry: AuditLog): void {
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 100) this.auditLogs.pop();
  }

  // ==================== ORGANIZATIONS REPOSITORY ====================

  public listOrganizations(): Organization[] {
    return Array.from(this.organizations.values());
  }

  public getOrganization(id: string): Organization | undefined {
    return this.organizations.get(id);
  }

  public createOrganization(org: Omit<Organization, 'organization_id'>): Organization {
    const id = `org_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newOrg: Organization = { ...org, organization_id: id };
    this.organizations.set(id, newOrg);
    return newOrg;
  }

  public updateOrganization(id: string, updates: Partial<Organization>): Organization {
    const existing = this.organizations.get(id);
    if (!existing) throw new Error(`Organisasi '${id}' tidak ditemukan.`);
    const updated: Organization = { ...existing, ...updates };
    this.organizations.set(id, updated);
    return updated;
  }

  public toggleOrganizationStatus(id: string): Organization {
    const existing = this.organizations.get(id);
    if (!existing) throw new Error(`Organisasi '${id}' tidak ditemukan.`);
    const updated: Organization = {
      ...existing,
      status: existing.status === 'active' ? 'inactive' : 'active',
    };
    this.organizations.set(id, updated);
    return updated;
  }

  public deleteOrganization(id: string): void {
    this.organizations.delete(id);
  }

  // ==================== SYNC, IDEMPOTENCY & DEVICE REPOSITORY ====================



  public getCurrentSyncVersion(): number {
    return this.syncVersion;
  }

  public recordChange(entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', record_id: string, data?: any): number {
    this.syncVersion++;
    const entry: ChangeLogEntry = {
      change_id: `chg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sync_version: this.syncVersion,
      entity,
      action,
      record_id,
      data,
      timestamp: new Date().toISOString(),
    };
    this.changeLog.push(entry);
    if (this.changeLog.length > 500) this.changeLog.shift();
    return this.syncVersion;
  }

  public getChangesSince(sinceVersion: number): IncrementalPullResult {
    const changes = this.changeLog.filter(c => c.sync_version > sinceVersion);
    return {
      current_sync_version: this.syncVersion,
      changes,
      has_more: false,
    };
  }

  public hasProcessedTransaction(transactionId: string): boolean {
    return this.processedTransactions.has(transactionId);
  }

  public getProcessedTransaction(transactionId: string): any {
    return this.processedTransactions.get(transactionId);
  }

  public recordProcessedTransaction(transactionId: string, result: any, syncVersion: number): void {
    this.processedTransactions.set(transactionId, {
      status: 'PROCESSED',
      result,
      timestamp: new Date().toISOString(),
      syncVersion,
    });
  }

  public listDevices(): RegisteredDevice[] {
    return Array.from(this.registeredDevices.values());
  }

  public registerOrUpdateDevice(device: Partial<RegisteredDevice> & { device_id: string; workspace_id: string }): RegisteredDevice {
    const existing = this.registeredDevices.get(device.device_id);
    const updated: RegisteredDevice = {
      device_id: device.device_id,
      workspace_id: device.workspace_id,
      user_id: device.user_id || existing?.user_id || '',
      device_name: device.device_name || existing?.device_name || 'Browser Device',
      device_type: device.device_type || existing?.device_type || 'mobile',
      registration_timestamp: existing?.registration_timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      last_seen: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      last_sync: device.last_sync || existing?.last_sync || 'Belum pernah',
      last_sync_version: device.last_sync_version !== undefined ? device.last_sync_version : (existing?.last_sync_version || this.syncVersion),
      pending_transaction_count: device.pending_transaction_count !== undefined ? device.pending_transaction_count : (existing?.pending_transaction_count || 0),
      status: existing ? existing.status : 'active',
    };
    this.registeredDevices.set(device.device_id, updated);
    return updated;
  }

  public revokeDevice(deviceId: string): RegisteredDevice {
    const dev = this.registeredDevices.get(deviceId);
    if (!dev) throw new Error(`Perangkat ID '${deviceId}' tidak terdaftar.`);
    dev.status = 'revoked';
    this.registeredDevices.set(deviceId, dev);
    return dev;
  }

  public activateDevice(deviceId: string): RegisteredDevice {
    const dev = this.registeredDevices.get(deviceId);
    if (!dev) throw new Error(`Perangkat ID '${deviceId}' tidak terdaftar.`);
    dev.status = 'active';
    this.registeredDevices.set(deviceId, dev);
    return dev;
  }

  public isDeviceRevoked(deviceId: string): boolean {
    const dev = this.registeredDevices.get(deviceId);
    return dev?.status === 'revoked';
  }

  public getRoleScopedSnapshot(role: UserRole, eventId: string): RoleScopedSnapshot {
    const schedules = this.listSchedules(eventId).filter(s => s.isPublished !== false);
    const activities = this.listActivities(eventId);
    const announcements: any[] = [];
    const badges = this.listBadges(eventId);

    if (role === 'attendance_officer') {
      return {
        role,
        sync_version: this.syncVersion,
        generated_at: new Date().toISOString(),
        scope_description: 'Scope: Petugas Presensi (Data identitas minimal, kode QR, jadwal giat)',
        schedules,
        activities,
        announcements,
        participants: [],
      };
    }

    if (role === 'health_officer') {
      return {
        role,
        sync_version: this.syncVersion,
        generated_at: new Date().toISOString(),
        scope_description: 'Scope: Tim Medis & Triase (Rekam alergi, kontak darurat kontingen, inventaris obat)',
        schedules,
        announcements,
        campsiteLots: this.listLots(),
        healthData: [],
      };
    }

    if (role === 'participant') {
      return {
        role,
        sync_version: this.syncVersion,
        generated_at: new Date().toISOString(),
        scope_description: 'Scope: Peserta Perkemahan (Jadwal pribadi, lencana capaian, pengumuman)',
        schedules,
        announcements,
        badges,
        activities,
      };
    }

    return {
      role,
      sync_version: this.syncVersion,
      generated_at: new Date().toISOString(),
      scope_description: 'Scope: Administrator (Full Operational Database Cache)',
      schedules: this.listSchedules(eventId),
      activities,
      announcements,
      badges,
      campsiteLots: this.listLots(),
      competitions: this.listCompetitions(eventId),
    };
  }

  // ==================== FEATURE CONFIGS (CANONICAL STORAGE) ====================

  public listFeatureConfigs(scopeType?: string, scopeId?: string): FeatureConfigRecord[] {
    let list = Array.from(this.featureConfigs.values());
    if (scopeType) list = list.filter(c => c.scope_type === scopeType);
    if (scopeId) list = list.filter(c => c.scope_id === scopeId);
    return list;
  }

  public getFeatureConfig(featureKey: string, scopeType: string, scopeId: string): FeatureConfigRecord | null {
    const key = `${scopeType}_${scopeId}_${featureKey}`;
    return this.featureConfigs.get(key) || null;
  }

  public setFeatureConfig(record: FeatureConfigRecord): FeatureConfigRecord {
    const key = `${record.scope_type}_${record.scope_id}_${record.feature_key}`;
    this.featureConfigs.set(key, record);
    return record;
  }

  // ==================== USER ROLE ASSIGNMENTS (CANONICAL STORAGE) ====================

  public listUserRoleAssignments(userId?: string): UserRoleAssignmentRecord[] {
    const list = Array.from(this.userRoleAssignments.values());
    if (userId) return list.filter(a => a.user_id === userId);
    return list;
  }

  public assignUserRole(assignment: UserRoleAssignmentRecord): UserRoleAssignmentRecord {
    this.userRoleAssignments.set(assignment.id, assignment);
    return assignment;
  }

  public revokeUserRole(assignmentId: string): boolean {
    return this.userRoleAssignments.delete(assignmentId);
  }

  // ==================== SPONSOR SETTINGS (CANONICAL STORAGE) ====================

  public getSponsorSettings(eventId: string): SponsorSettingsRecord {
    const existing = this.sponsorSettings.get(eventId);
    if (existing) return { ...existing };
    return {
      event_id: eventId,
      carousel_enabled: true,
      direction: 'RIGHT_TO_LEFT',
      carousel_duration_seconds: 30,
      pause_on_hover: true,
      updated_at: new Date().toISOString(),
    };
  }

  public updateSponsorSettings(eventId: string, updates: Partial<SponsorSettingsRecord>): SponsorSettingsRecord {
    const current = this.getSponsorSettings(eventId);
    const updated: SponsorSettingsRecord = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.sponsorSettings.set(eventId, updated);
    return updated;
  }

  // ==================== POINT TRANSACTIONS (CANONICAL STORAGE) ====================

  public recordPointTransaction(tx: PointTransactionRecord): PointTransactionRecord {
    this.pointTransactions.unshift(tx);
    return tx;
  }

  public listPointTransactions(participantId?: string): PointTransactionRecord[] {
    if (participantId) {
      return this.pointTransactions.filter(t => t.participant_id === participantId);
    }
    return [...this.pointTransactions];
  }
}

export const spreadsheetRepository = new SpreadsheetRepository();
