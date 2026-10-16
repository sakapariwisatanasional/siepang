/**
 * @license
 * SiEpang - Event Studio Backend Business Service
 * Encapsulates business validation, organization hierarchy consistency,
 * and mandatory enterprise audit logging across all event operations.
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
  OfflineTransaction,
  BatchSyncResult,
} from '../../types';
import { spreadsheetRepository } from '../repositories/spreadsheetRepository';
import { RequestSecurityContext } from '../auth/authGuard';

export class BusinessValidationError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = 'BusinessValidationError';
    this.statusCode = statusCode;
  }
}

export class EventStudioBusinessService {
  private createAuditLog(
    context: RequestSecurityContext,
    module: string,
    action: string,
    entity_id: string,
    old_data?: any,
    new_data?: any
  ): void {
    const entry: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      user_id: context.userId,
      workspace_id: context.workspaceId || undefined,
      event_id: context.eventId || '',
      module,
      action,
      entity_id,
      old_data: old_data ? JSON.stringify(old_data) : undefined,
      new_data: new_data ? JSON.stringify(new_data) : undefined,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorName: context.userId.replace('usr_', 'Kak ').replace(/_/g, ' '),
      actorRole: context.userRole,
      target: entity_id,
      status: 'success',
    };
    spreadsheetRepository.addAuditLog(entry);
  }

  // ==================== EVENT ====================

  public getEvent(context: RequestSecurityContext, eventId: string): ScoutEvent {
    const event = spreadsheetRepository.getEvent(eventId);
    if (!event) throw new BusinessValidationError(`Event dengan ID '${eventId}' tidak ditemukan.`, 404);
    return event;
  }

  public updateEvent(context: RequestSecurityContext, eventId: string, updates: Partial<ScoutEvent>): ScoutEvent {
    const oldEvent = spreadsheetRepository.getEvent(eventId);
    if (!oldEvent) throw new BusinessValidationError(`Event dengan ID '${eventId}' tidak ditemukan.`, 404);

    // Business validation: Start Date <= End Date
    const start = updates.startDate || oldEvent.startDate;
    const end = updates.endDate || oldEvent.endDate;
    if (start && end && start > end) {
      throw new BusinessValidationError('Tanggal mulai event tidak boleh melebihi tanggal selesai kegiatan.');
    }

    const updated = spreadsheetRepository.updateEvent(eventId, updates);
    this.createAuditLog(context, 'Event Settings', `Pembaruan Informasi Event: ${updated.name}`, eventId, oldEvent, updated);
    return updated;
  }

  public archiveEvent(context: RequestSecurityContext, eventId: string): ScoutEvent {
    const oldEvent = spreadsheetRepository.getEvent(eventId);
    const updated = spreadsheetRepository.archiveEvent(eventId);
    this.createAuditLog(context, 'Event Lifecycle', `Arsipkan Event: ${updated.name}`, eventId, oldEvent, updated);
    return updated;
  }

  // ==================== SCHEDULE ====================

  public listSchedules(context: RequestSecurityContext, eventId: string): ScheduleItem[] {
    return spreadsheetRepository.listSchedules(eventId);
  }

  public createSchedule(context: RequestSecurityContext, eventId: string, schedule: Omit<ScheduleItem, 'id'>): ScheduleItem {
    if (!schedule.title?.trim()) {
      throw new BusinessValidationError('Judul agenda jadwal wajib diisi.');
    }
    const created = spreadsheetRepository.createSchedule(eventId, schedule);
    this.createAuditLog(context, 'Schedule', `Tambah Jadwal: ${created.title}`, created.id, undefined, created);
    return created;
  }

  public updateSchedule(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<ScheduleItem>): ScheduleItem {
    const old = spreadsheetRepository.listSchedules(eventId).find(s => s.id === id);
    const updated = spreadsheetRepository.updateSchedule(id, updates);
    this.createAuditLog(context, 'Schedule', `Perbarui Jadwal: ${updated.title}`, id, old, updated);
    return updated;
  }

  public duplicateSchedule(context: RequestSecurityContext, eventId: string, id: string): ScheduleItem {
    const duplicated = spreadsheetRepository.duplicateSchedule(id);
    this.createAuditLog(context, 'Schedule', `Duplikasi Jadwal: ${duplicated.title}`, duplicated.id, { originalId: id }, duplicated);
    return duplicated;
  }

  public moveSchedule(context: RequestSecurityContext, eventId: string, id: string, newDay: number): ScheduleItem {
    if (newDay < 1) throw new BusinessValidationError('Nomor hari jadwal harus minimal 1.');
    const old = spreadsheetRepository.listSchedules(eventId).find(s => s.id === id);
    const updated = spreadsheetRepository.moveSchedule(id, newDay);
    this.createAuditLog(context, 'Schedule', `Pindah Hari Jadwal: ${updated.title} ke Hari ${newDay}`, id, { oldDay: old?.dayNumber }, { newDay });
    return updated;
  }

  public publishSchedule(context: RequestSecurityContext, eventId: string, id: string, isPublished: boolean): ScheduleItem {
    const updated = spreadsheetRepository.publishSchedule(id, isPublished);
    this.createAuditLog(context, 'Schedule', `${isPublished ? 'Publikasikan' : 'Tarik'} Jadwal: ${updated.title}`, id, undefined, { isPublished });
    return updated;
  }

  public archiveSchedule(context: RequestSecurityContext, eventId: string, id: string): ScheduleItem {
    const updated = spreadsheetRepository.archiveSchedule(id);
    this.createAuditLog(context, 'Schedule', `Arsipkan Jadwal: ${updated.title}`, id, undefined, { archived: true });
    return updated;
  }

  // ==================== ACTIVITIES ====================

  public listActivities(context: RequestSecurityContext, eventId: string): CampActivity[] {
    return spreadsheetRepository.listActivities(eventId);
  }

  public createActivity(context: RequestSecurityContext, eventId: string, act: Omit<CampActivity, 'id'>): CampActivity {
    if (!act.name?.trim()) throw new BusinessValidationError('Nama aktivitas wajib diisi.');
    const created = spreadsheetRepository.createActivity(eventId, act);
    this.createAuditLog(context, 'Activity', `Tambah Aktivitas: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public updateActivity(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<CampActivity>): CampActivity {
    const old = spreadsheetRepository.listActivities(eventId).find(a => a.id === id);
    const updated = spreadsheetRepository.updateActivity(id, updates);
    this.createAuditLog(context, 'Activity', `Perbarui Aktivitas: ${updated.name}`, id, old, updated);
    return updated;
  }

  public archiveActivity(context: RequestSecurityContext, eventId: string, id: string): CampActivity {
    const updated = spreadsheetRepository.archiveActivity(id);
    this.createAuditLog(context, 'Activity', `Arsipkan Aktivitas: ${updated.name}`, id, undefined, { status: 'cancelled' });
    return updated;
  }

  public listActivityTypes(): ActivityType[] {
    return spreadsheetRepository.listActivityTypes();
  }

  public createActivityType(context: RequestSecurityContext, actType: Omit<ActivityType, 'id'>): ActivityType {
    if (!actType.name?.trim()) throw new BusinessValidationError('Nama tipe aktivitas wajib diisi.');
    const created = spreadsheetRepository.createActivityType(actType);
    this.createAuditLog(context, 'Activity Type', `Tambah Tipe Aktivitas: ${created.name}`, created.id, undefined, created);
    return created;
  }

  // ==================== CAMPSITE ====================

  public listSubcamps(context: RequestSecurityContext, eventId: string): CampsiteSubcamp[] {
    return spreadsheetRepository.listSubcamps(eventId);
  }

  public createSubcamp(context: RequestSecurityContext, eventId: string, subcamp: Omit<CampsiteSubcamp, 'id'>): CampsiteSubcamp {
    if (!subcamp.name?.trim()) throw new BusinessValidationError('Nama Sub Camp wajib diisi.');
    const created = spreadsheetRepository.createSubcamp(eventId, subcamp);
    this.createAuditLog(context, 'Campsite', `Tambah Sub Camp: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public listZones(context: RequestSecurityContext, eventId: string): CampsiteZone[] {
    return spreadsheetRepository.listZones(eventId);
  }

  public createZone(context: RequestSecurityContext, eventId: string, zone: Omit<CampsiteZone, 'id'>): CampsiteZone {
    if (!zone.name?.trim()) throw new BusinessValidationError('Nama Zona wajib diisi.');
    const created = spreadsheetRepository.createZone(eventId, zone);
    this.createAuditLog(context, 'Campsite', `Tambah Zona Tenda: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public listBlocks(context: RequestSecurityContext, eventId: string): CampsiteBlock[] {
    return spreadsheetRepository.listBlocks(eventId);
  }

  public createBlock(context: RequestSecurityContext, eventId: string, block: Omit<CampsiteBlock, 'id'>): CampsiteBlock {
    if (!block.name?.trim()) throw new BusinessValidationError('Nama Blok wajib diisi.');
    const created = spreadsheetRepository.createBlock(eventId, block);
    this.createAuditLog(context, 'Campsite', `Tambah Blok Tenda: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public listLots(context: RequestSecurityContext, eventId: string): CampsiteLot[] {
    return spreadsheetRepository.listLots(eventId);
  }

  public createLot(context: RequestSecurityContext, eventId: string, lot: Omit<CampsiteLot, 'id'>): CampsiteLot {
    if (!lot.lotNumber?.trim()) throw new BusinessValidationError('Nomor kavling tenda wajib diisi.');
    const created = spreadsheetRepository.createLot(eventId, lot);
    this.createAuditLog(context, 'Campsite', `Tambah Kavling: ${created.lotNumber} (${created.subCamp})`, created.id, undefined, created);
    return created;
  }

  public updateLot(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<CampsiteLot>): CampsiteLot {
    const old = spreadsheetRepository.listLots(eventId).find(l => l.id === id);
    const updated = spreadsheetRepository.updateLot(id, updates);
    this.createAuditLog(context, 'Campsite', `Perbarui Kavling: ${updated.lotNumber}`, id, old, updated);
    return updated;
  }

  public assignContingentToLot(context: RequestSecurityContext, eventId: string, lotId: string, contingentId: string, contingentName: string): CampsiteLot {
    const updated = spreadsheetRepository.assignContingentToLot(lotId, contingentId, contingentName);
    this.createAuditLog(context, 'Campsite', `Tetapkan Kontingen '${contingentName}' ke Kavling ${updated.lotNumber}`, lotId, undefined, { contingentId, contingentName });
    return updated;
  }

  public listFacilities(context: RequestSecurityContext, eventId: string): CampFacility[] {
    return spreadsheetRepository.listFacilities(eventId);
  }

  public createFacility(context: RequestSecurityContext, eventId: string, fac: Omit<CampFacility, 'id'>): CampFacility {
    if (!fac.name?.trim()) throw new BusinessValidationError('Nama fasilitas wajib diisi.');
    const created = spreadsheetRepository.createFacility(eventId, fac);
    this.createAuditLog(context, 'Facility', `Tambah Fasilitas: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public updateFacility(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<CampFacility>): CampFacility {
    const updated = spreadsheetRepository.updateFacility(id, updates);
    this.createAuditLog(context, 'Facility', `Perbarui Fasilitas: ${updated.name}`, id, undefined, updates);
    return updated;
  }

  // ==================== COMPETITIONS & JUDGING ====================

  public listCompetitionTypes(): CompetitionType[] {
    return spreadsheetRepository.listCompetitionTypes();
  }

  public createCompetitionType(context: RequestSecurityContext, compType: Omit<CompetitionType, 'id'>): CompetitionType {
    if (!compType.name?.trim()) throw new BusinessValidationError('Nama tipe kompetisi wajib diisi.');
    const created = spreadsheetRepository.createCompetitionType(compType);
    this.createAuditLog(context, 'Competition Type', `Tambah Tipe Kompetisi: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public listCompetitions(context: RequestSecurityContext, eventId: string): Competition[] {
    return spreadsheetRepository.listCompetitions(eventId);
  }

  public createCompetition(context: RequestSecurityContext, eventId: string, comp: Omit<Competition, 'id' | 'registeredEntries'>): Competition {
    if (!comp.title?.trim()) throw new BusinessValidationError('Nama cabang lomba wajib diisi.');
    const created = spreadsheetRepository.createCompetition(eventId, comp);
    this.createAuditLog(context, 'Competition', `Tambah Cabang Lomba: ${created.title}`, created.id, undefined, created);
    return created;
  }

  public updateCompetition(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<Competition>): Competition {
    const updated = spreadsheetRepository.updateCompetition(id, updates);
    this.createAuditLog(context, 'Competition', `Perbarui Lomba: ${updated.title}`, id, undefined, updates);
    return updated;
  }

  public listJudgingCriteria(context: RequestSecurityContext, eventId: string): JudgingCriterion[] {
    return spreadsheetRepository.listJudgingCriteria(eventId);
  }

  public configureCriteria(context: RequestSecurityContext, eventId: string, criteria: JudgingCriterion[]): { valid: boolean; totalWeight: number; criteria: JudgingCriterion[] } {
    const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
    const valid = totalWeight === 100;
    const configured = spreadsheetRepository.configureCriteria(eventId, criteria);
    this.createAuditLog(context, 'Judging Criteria', `Konfigurasi Rubrik Penilaian (${criteria.length} kriteria, Total: ${totalWeight}%)`, eventId, undefined, { totalWeight, valid });
    return { valid, totalWeight, criteria: configured };
  }

  public listJudges(context: RequestSecurityContext, eventId: string): CompetitionJudge[] {
    return spreadsheetRepository.listJudges(eventId);
  }

  public assignJudges(context: RequestSecurityContext, eventId: string, judge: Omit<CompetitionJudge, 'id'>): CompetitionJudge {
    if (!judge.name?.trim()) throw new BusinessValidationError('Nama dewan juri wajib diisi.');
    const created = spreadsheetRepository.assignJudges(eventId, judge);
    this.createAuditLog(context, 'Judges', `Penugasan Juri: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public toggleJudgeLock(context: RequestSecurityContext, eventId: string, judgeId: string): CompetitionJudge {
    const updated = spreadsheetRepository.toggleJudgeLock(judgeId);
    this.createAuditLog(context, 'Judges', `${updated.isLocked ? 'Kunci' : 'Buka Kunci'} Penilaian Juri: ${updated.name}`, judgeId, undefined, { isLocked: updated.isLocked });
    return updated;
  }

  public getVotingConfig(context: RequestSecurityContext, eventId: string): VotingConfig {
    return spreadsheetRepository.getVotingConfig(eventId);
  }

  public configureVoting(context: RequestSecurityContext, eventId: string, config: Partial<VotingConfig>): VotingConfig {
    const updated = spreadsheetRepository.configureVoting(eventId, config);
    this.createAuditLog(context, 'Voting', `Pembaruan Konfigurasi Voting (Status: ${updated.votingEnabled ? 'Aktif' : 'Nonaktif'})`, eventId, undefined, updated);
    return updated;
  }

  // ==================== REGISTRATION ====================

  public getRegistrationSettings(context: RequestSecurityContext, eventId: string): RegistrationSettings {
    return spreadsheetRepository.getRegistrationSettings(eventId);
  }

  public updateRegistrationSettings(context: RequestSecurityContext, eventId: string, updates: Partial<RegistrationSettings>): RegistrationSettings {
    const updated = spreadsheetRepository.updateRegistrationSettings(eventId, updates);
    this.createAuditLog(context, 'Registration', `Pembaruan Pengaturan Pendaftaran & Kuota`, eventId, undefined, updated);
    return updated;
  }

  public listDynamicFields(context: RequestSecurityContext, eventId: string): RegistrationFieldConfig[] {
    return spreadsheetRepository.listDynamicFields(eventId);
  }

  public createDynamicField(context: RequestSecurityContext, eventId: string, field: Omit<RegistrationFieldConfig, 'id'>): RegistrationFieldConfig {
    if (!field.label?.trim()) throw new BusinessValidationError('Label form dinamis wajib diisi.');
    const created = spreadsheetRepository.createDynamicField(eventId, field);
    this.createAuditLog(context, 'Registration Fields', `Tambah Kolom Dinamis: ${created.label}`, created.id, undefined, created);
    return created;
  }

  public updateDynamicField(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<RegistrationFieldConfig>): RegistrationFieldConfig {
    const updated = spreadsheetRepository.updateDynamicField(id, updates);
    this.createAuditLog(context, 'Registration Fields', `Perbarui Kolom Dinamis: ${updated.label}`, id, undefined, updates);
    return updated;
  }

  // ==================== GAMIFICATION ====================

  public listPointRules(context: RequestSecurityContext, eventId: string): PointRuleConfig[] {
    return spreadsheetRepository.listPointRules(eventId);
  }

  public createPointRule(context: RequestSecurityContext, eventId: string, rule: Omit<PointRuleConfig, 'id'>): PointRuleConfig {
    if (!rule.name?.trim()) throw new BusinessValidationError('Nama aturan perolehan XP wajib diisi.');
    const created = spreadsheetRepository.createPointRule(eventId, rule);
    this.createAuditLog(context, 'Points', `Tambah Aturan XP: ${created.name} (+${created.xp} XP)`, created.id, undefined, created);
    return created;
  }

  public updatePointRule(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<PointRuleConfig>): PointRuleConfig {
    const updated = spreadsheetRepository.updatePointRule(id, updates);
    this.createAuditLog(context, 'Points', `Perbarui Aturan XP: ${updated.name}`, id, undefined, updates);
    return updated;
  }

  public listBadges(context: RequestSecurityContext, eventId: string): BadgeConfig[] {
    return spreadsheetRepository.listBadges(eventId);
  }

  public createBadge(context: RequestSecurityContext, eventId: string, badge: Omit<BadgeConfig, 'id'>): BadgeConfig {
    if (!badge.name?.trim()) throw new BusinessValidationError('Nama lencana wajib diisi.');
    const created = spreadsheetRepository.createBadge(eventId, badge);
    this.createAuditLog(context, 'Badges', `Tambah Lencana Prestasi: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public updateBadge(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<BadgeConfig>): BadgeConfig {
    const updated = spreadsheetRepository.updateBadge(id, updates);
    this.createAuditLog(context, 'Badges', `Perbarui Lencana: ${updated.name}`, id, undefined, updates);
    return updated;
  }

  public listCheckpoints(context: RequestSecurityContext, eventId: string): QrCheckpoint[] {
    return spreadsheetRepository.listCheckpoints(eventId);
  }

  public createCheckpoint(context: RequestSecurityContext, eventId: string, chk: Omit<QrCheckpoint, 'id' | 'scanCount'>): QrCheckpoint {
    if (!chk.name?.trim()) throw new BusinessValidationError('Nama Pos QR Checkpoint wajib diisi.');
    const created = spreadsheetRepository.createCheckpoint(eventId, chk);
    this.createAuditLog(context, 'QR Checkpoint', `Tambah Pos Checkpoint: ${created.name}`, created.id, undefined, created);
    return created;
  }

  public updateCheckpoint(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<QrCheckpoint>): QrCheckpoint {
    const updated = spreadsheetRepository.updateCheckpoint(id, updates);
    this.createAuditLog(context, 'QR Checkpoint', `Perbarui Checkpoint: ${updated.name}`, id, undefined, updates);
    return updated;
  }

  public regenerateCheckpointQr(context: RequestSecurityContext, eventId: string, id: string): string {
    const newQr = spreadsheetRepository.regenerateCheckpointQr(id);
    this.createAuditLog(context, 'QR Checkpoint', `Regenerasi Kode QR Checkpoint: ${id}`, id, undefined, { qrCode: newQr });
    return newQr;
  }

  // ==================== EVENT FEATURES & HOME ====================

  public getEventFeatures(context: RequestSecurityContext, eventId: string): ScoutEvent['features'] {
    return spreadsheetRepository.getEventFeatures(eventId);
  }

  public updateEventFeature(context: RequestSecurityContext, eventId: string, featureKey: keyof ScoutEvent['features'], enabled: boolean): ScoutEvent['features'] {
    const updated = spreadsheetRepository.updateEventFeature(eventId, featureKey, enabled);
    this.createAuditLog(context, 'Feature Flags', `Ubah Status Fitur '${featureKey}': ${enabled ? 'Aktif' : 'Nonaktif'}`, eventId, undefined, { featureKey, enabled });
    return updated;
  }

  public reorderHomepageSections(context: RequestSecurityContext, eventId: string, sections: HomeSectionConfig[]): HomeSectionConfig[] {
    const updated = spreadsheetRepository.reorderHomepageSections(eventId, sections);
    this.createAuditLog(context, 'Home Sections', `Penyusunan Ulang Tata Letak Beranda Peserta`, eventId, undefined, sections);
    return updated;
  }

  // ==================== CONTENT & CONTACTS ====================

  public listEventPages(context: RequestSecurityContext, eventId: string): CustomInfoPage[] {
    return spreadsheetRepository.listEventPages(eventId);
  }

  public createEventPage(context: RequestSecurityContext, eventId: string, page: Omit<CustomInfoPage, 'id'>): CustomInfoPage {
    if (!page.title?.trim()) throw new BusinessValidationError('Judul halaman informasi wajib diisi.');
    const created = spreadsheetRepository.createEventPage(eventId, page);
    this.createAuditLog(context, 'Custom Pages', `Tambah Halaman Informasi: ${created.title}`, created.id, undefined, created);
    return created;
  }

  public updateEventPage(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<CustomInfoPage>): CustomInfoPage {
    const updated = spreadsheetRepository.updateEventPage(id, updates);
    this.createAuditLog(context, 'Custom Pages', `Perbarui Halaman Informasi: ${updated.title}`, id, undefined, updates);
    return updated;
  }

  public listEventContacts(context: RequestSecurityContext, eventId: string): EventContactItem[] {
    return spreadsheetRepository.listEventContacts(eventId);
  }

  public createEventContact(context: RequestSecurityContext, eventId: string, contact: Omit<EventContactItem, 'id'>): EventContactItem {
    if (!contact.name?.trim() || !contact.phone?.trim()) {
      throw new BusinessValidationError('Nama dan nomor telepon kontak wajib diisi.');
    }
    const created = spreadsheetRepository.createEventContact(eventId, contact);
    this.createAuditLog(context, 'Contacts', `Tambah Kontak Posko: ${created.name} (${created.role})`, created.id, undefined, created);
    return created;
  }

  public updateEventContact(context: RequestSecurityContext, eventId: string, id: string, updates: Partial<EventContactItem>): EventContactItem {
    const updated = spreadsheetRepository.updateEventContact(id, updates);
    this.createAuditLog(context, 'Contacts', `Perbarui Kontak Posko: ${updated.name}`, id, undefined, updates);
    return updated;
  }

  // ==================== AUDIT ====================

  public listAuditLog(context: RequestSecurityContext, eventId?: string): AuditLog[] {
    return spreadsheetRepository.listAuditLog(eventId);
  }

  // ==================== ORGANIZATIONS HIERARCHY ====================

  public listOrganizations(): Organization[] {
    return spreadsheetRepository.listOrganizations();
  }

  public createOrganization(context: RequestSecurityContext, org: Omit<Organization, 'organization_id'>): Organization {
    // Validate organization hierarchy
    if (org.organization_level !== 'KWARNAS' && !org.parent_organization_id) {
      throw new BusinessValidationError(`Tingkat ${org.organization_level} wajib memiliki organisasi induk (parent organization).`);
    }

    const created = spreadsheetRepository.createOrganization(org);
    this.createAuditLog(context, 'Organization Hierarchy', `Tambah Organisasi Pramuka: ${created.organization_name} (${created.organization_level})`, created.organization_id, undefined, created);
    return created;
  }

  // ==================== OPERATIONAL INTEGRITY & VALIDATION ENGINE ====================

  /**
   * Validates feature dependencies across the event
   */
  public validateFeatureDependencies(eventId: string): string[] {
    const event = spreadsheetRepository.getEvent(eventId);
    if (!event) return [];
    const f = event.features;
    const warnings: string[] = [];

    if (!f.xp && f.leaderboard) {
      warnings.push('Modul Papan Peringkat (Leaderboard) aktif, tetapi Gamifikasi & Poin XP dinonaktifkan. Peringkat tidak akan terbarui.');
    }
    if (!f.competition && f.voting) {
      warnings.push('Fitur Voting Digital Publik aktif, tetapi Modul Kompetisi utama dinonaktifkan.');
    }
    if (!f.attendance && f.qrCheckpoint) {
      warnings.push('Fitur Pos QR Checkpoint aktif, tetapi modul Presensi Kehadiran dinonaktifkan.');
    }
    if (!f.healthPost && event.contacts?.medical && event.contacts.medical.length > 5) {
      warnings.push('Nomor darurat posko medis terpasang, tetapi Modul Triase & Kesehatan Buper dalam kondisi nonaktif.');
    }
    return warnings;
  }

  /**
   * Detects schedule conflicts across participant groups, venues, and judges
   */
  public detectScheduleConflicts(eventId: string): ScheduleConflict[] {
    const schedules = spreadsheetRepository.listSchedules(eventId).filter(s => !s.archived);
    const conflicts: ScheduleConflict[] = [];

    // Helper to extract rough start/end minutes for time overlap comparison
    const parseTimeRange = (timeStr: string) => {
      const parts = timeStr.split('-').map(p => p.trim());
      if (parts.length < 2) return { start: 480, end: 600 }; // default 08:00 - 10:00
      const parseMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
      };
      return { start: parseMinutes(parts[0]), end: parseMinutes(parts[1]) };
    };

    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const a = schedules[i];
        const b = schedules[j];

        // Same day check
        if (a.dayNumber === b.dayNumber) {
          const tA = parseTimeRange(a.time);
          const tB = parseTimeRange(b.time);

          // Check overlap
          const overlaps = Math.max(tA.start, tB.start) < Math.min(tA.end, tB.end);
          if (overlaps) {
            // 1. Venue conflict
            if (a.location && b.location && a.location.toLowerCase().trim() === b.location.toLowerCase().trim()) {
              conflicts.push({
                id: `cnf_venue_${a.id}_${b.id}`,
                type: 'venue',
                scheduleAId: a.id,
                scheduleATitle: a.title,
                scheduleBId: b.id,
                scheduleBTitle: b.title,
                conflictDetail: `Bentrok Lokasi: '${a.location}' digunakan bersamaan oleh 2 agenda pada Hari ke-${a.dayNumber}.`,
                timeSlot: `${a.time} vs ${b.time}`,
                dayNumber: a.dayNumber,
                location: a.location,
                severity: 'warning',
              });
            }

            // 2. Participant group conflict
            const sharedGroups = a.mandatoryFor.filter(g => b.mandatoryFor.includes(g) || g === 'Semua Peserta' || b.mandatoryFor.includes('Semua Peserta'));
            if (sharedGroups.length > 0 && a.location !== b.location) {
              conflicts.push({
                id: `cnf_grp_${a.id}_${b.id}`,
                type: 'participant_group',
                scheduleAId: a.id,
                scheduleATitle: a.title,
                scheduleBId: b.id,
                scheduleBTitle: b.title,
                conflictDetail: `Bentrok Peserta: Golongan '${sharedGroups.join(', ')}' dijadwalkan pada 2 agenda bersamaan (${a.title} & ${b.title}).`,
                timeSlot: `${a.time} vs ${b.time}`,
                dayNumber: a.dayNumber,
                severity: 'warning',
              });
            }

            // 3. Judge & Officer Conflict check
            const allJudges = spreadsheetRepository.listJudges(eventId);
            for (const j of allJudges) {
              const inA = a.title.toLowerCase().includes(j.categories[0]?.toLowerCase() || '___');
              const inB = b.title.toLowerCase().includes(j.categories[0]?.toLowerCase() || '___');
              if (inA && inB) {
                conflicts.push({
                  id: `cnf_jdg_${j.id}_${a.id}_${b.id}`,
                  type: 'judge',
                  scheduleAId: a.id,
                  scheduleATitle: a.title,
                  scheduleBId: b.id,
                  scheduleBTitle: b.title,
                  conflictDetail: `Bentrok Dewan Juri: ${j.name} ditugaskan pada 2 agenda lomba yang berlangsung bersamaan.`,
                  timeSlot: `${a.time} vs ${b.time}`,
                  dayNumber: a.dayNumber,
                  severity: 'warning',
                });
              }
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Validates campsite lot occupancy, overall capacity vs registered contingents
   */
  public validateCampsiteCapacity(eventId: string): CampsiteCapacityReport {
    const lots = spreadsheetRepository.listLots();
    const event = spreadsheetRepository.getEvent(eventId);
    const totalCapacity = lots.reduce((sum, l) => sum + (l.capacity || 0), 0);
    const assignedLots = lots.filter(l => l.contingentId && l.contingentId.trim().length > 0);
    const totalAssigned = assignedLots.reduce((sum, l) => sum + (l.capacity || 0), 0);
    const isOverflow = totalAssigned > totalCapacity;

    // Dynamic Contingents check from repository organizations
    const orgs = spreadsheetRepository.listOrganizations();
    const activeContingents = orgs
      .filter(o => o.organization_level === 'KWARRAN' || o.organization_level === 'GUDEP')
      .map(o => ({ id: o.organization_id, name: o.organization_name, count: 32 }));

    const assignedContingentIds = new Set(lots.map(l => l.contingentId).filter(Boolean));
    const contingentsWithoutCampsite = activeContingents.filter(c => !assignedContingentIds.has(c.id));

    // Subcamp breakdown
    const subcamps = spreadsheetRepository.listSubcamps();
    const subcampReports = subcamps.map(sc => {
      const scLots = lots.filter(l => l.subCamp.toLowerCase().includes(sc.name.toLowerCase()) || sc.name.toLowerCase().includes(l.subCamp.toLowerCase()));
      const scCap = scLots.reduce((sum, l) => sum + l.capacity, 0);
      const scAssigned = scLots.filter(l => l.contingentId).reduce((sum, l) => sum + l.capacity, 0);
      return {
        subcampName: sc.name,
        capacity: scCap,
        assigned: scAssigned,
        remaining: Math.max(0, scCap - scAssigned),
        isOverflow: scAssigned > scCap,
      };
    });

    return {
      totalCapacity: totalCapacity || event?.participantCapacity || 1500,
      totalAssigned,
      remainingCapacity: Math.max(0, (totalCapacity || 1500) - totalAssigned),
      isOverflow,
      overflowCount: isOverflow ? totalAssigned - totalCapacity : 0,
      contingentsWithoutCampsite,
      subcampReports,
    };
  }

  /**
   * Validates competition configuration readiness
   */
  public validateCompetitionReadiness(eventId: string, compId?: string): CompetitionReadiness[] {
    const competitions = spreadsheetRepository.listCompetitions(eventId);
    const targetComps = compId ? competitions.filter(c => c.id === compId) : competitions;
    const allCriteria = spreadsheetRepository.listJudgingCriteria(eventId);
    const allJudges = spreadsheetRepository.listJudges(eventId);
    const votingConfig = spreadsheetRepository.getVotingConfig(eventId);

    return targetComps.map(comp => {
      const issues: string[] = [];
      const criteria = allCriteria; // Shared or specific rubric
      const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
      const criteriaValid = criteria.length > 0 && totalWeight === 100;
      if (!criteriaValid) {
        issues.push(`Bobot kriteria penjurian belum 100% (saat ini ${totalWeight}%).`);
      }

      const assignedJudges = allJudges.filter(j => j.assignedCompetitions.includes(comp.id) || j.categories.includes(comp.category));
      const judgesAssigned = assignedJudges.length > 0;
      if (!judgesAssigned) {
        issues.push('Belum ada dewan juri resmi yang ditugaskan untuk cabang lomba ini.');
      }

      const scheduleAndVenue = Boolean(comp.scheduleTime && comp.location);
      if (!scheduleAndVenue) {
        issues.push('Waktu pelaksanaan dan lokasi arena lomba belum ditentukan.');
      }

      let votingConfigValid = true;
      if (comp.votingEnabled) {
        if (!votingConfig.votingOpen) {
          issues.push('Voting publik diaktifkan tetapi sistem voting belum dibuka secara global.');
        }
      }

      const totalChecks = 5;
      let passedChecks = 0;
      if (comp.title) passedChecks++;
      if (comp.type) passedChecks++;
      if (criteriaValid) passedChecks++;
      if (judgesAssigned) passedChecks++;
      if (scheduleAndVenue) passedChecks++;

      const completionPercentage = Math.round((passedChecks / totalChecks) * 100);

      return {
        competitionId: comp.id,
        competitionTitle: comp.title,
        isReady: issues.length === 0,
        completionPercentage,
        checks: {
          identity: Boolean(comp.title),
          participantMode: Boolean(comp.type),
          criteriaValid,
          totalWeight,
          judgesAssigned,
          judgeCount: assignedJudges.length,
          scheduleAndVenue,
          votingConfigValid,
        },
        issues,
      };
    });
  }

  /**
   * Generates comprehensive Event Readiness Center assessment report
   */
  public getEventReadiness(eventId: string): EventReadinessReport {
    const event = spreadsheetRepository.getEvent(eventId);
    const depWarnings = this.validateFeatureDependencies(eventId);
    const scheduleConflicts = this.detectScheduleConflicts(eventId);
    const campsiteReport = this.validateCampsiteCapacity(eventId);
    const compReadiness = this.validateCompetitionReadiness(eventId);
    const regSettings = spreadsheetRepository.getRegistrationSettings(eventId);

    const actionableWarnings: EventReadinessReport['actionableWarnings'] = [];

    // Check 1: Identity & General
    const identityReady = Boolean(event?.name && event?.startDate && event?.endDate && event?.location);
    if (!identityReady) {
      actionableWarnings.push({
        id: 'warn_identity',
        title: 'Konfigurasi Identitas & Tanggal',
        message: 'Nama resmi atau tanggal perkemahan belum lengkap.',
        severity: 'error',
        targetTab: 'general',
      });
    }

    // Check 2: Emergency contacts
    const hasEmergency = Boolean(event?.contacts?.emergency && event.contacts.emergency.length > 5);
    if (!hasEmergency) {
      actionableWarnings.push({
        id: 'warn_contacts',
        title: 'Kontak Darurat Buper Belum Lengkap',
        message: 'Nomor piket darurat 24 jam belum dikonfigurasi.',
        severity: 'warning',
        targetTab: 'pages_contacts',
      });
    }

    // Check 3: Schedule conflicts
    if (scheduleConflicts.length > 0) {
      actionableWarnings.push({
        id: 'warn_sched_conflicts',
        title: `${scheduleConflicts.length} Konflik Jadwal Terdeteksi`,
        message: 'Terdapat tumpang tindih lokasi atau golongan peserta pada waktu yang bersamaan.',
        severity: 'warning',
        targetTab: 'schedule',
      });
    }

    // Check 4: Campsite unassigned
    if (campsiteReport.contingentsWithoutCampsite.length > 0) {
      actionableWarnings.push({
        id: 'warn_campsite_unassigned',
        title: `${campsiteReport.contingentsWithoutCampsite.length} Kontingen Belum Memiliki Kavling Tenda`,
        message: `Kontingen: ${campsiteReport.contingentsWithoutCampsite.map(c => c.name).join(', ')} belum dialokasikan kavling.`,
        severity: 'warning',
        targetTab: 'campsite',
      });
    }

    // Check 5: Competition judges
    const unreadyComps = compReadiness.filter(c => !c.isReady);
    if (unreadyComps.length > 0) {
      actionableWarnings.push({
        id: 'warn_comp_unready',
        title: `${unreadyComps.length} Cabang Lomba Belum Siap Operasional`,
        message: `Lomba: ${unreadyComps.map(c => c.competitionTitle).join(', ')} memerlukan penetapan juri atau perbaikan rubrik kriteria 100%.`,
        severity: 'warning',
        targetTab: 'competitions',
      });
    }

    // Check 6: Certificate template readiness
    const certActive = false; // Demo default: cert template needs review
    if (!certActive) {
      actionableWarnings.push({
        id: 'warn_cert_template',
        title: 'Templat Sertifikat Belum Aktif',
        message: 'Desain sertifikat penghargaan digital belum dikonfigurasi aktif untuk cetak massal.',
        severity: 'warning',
        targetTab: 'templates',
      });
    }

    // Check 7: Feature dependencies
    if (depWarnings.length > 0) {
      depWarnings.forEach((w, idx) => {
        actionableWarnings.push({
          id: `warn_dep_${idx}`,
          title: 'Ketidaksesuaian Dependensi Modul',
          message: w,
          severity: 'warning',
          targetTab: 'features',
        });
      });
    }

    const activities = spreadsheetRepository.listActivities(eventId);
    const activitiesReady = activities.length > 0;

    // Dynamic scoring calculation (0-100%)
    let score = 100;
    if (!identityReady) score -= 20;
    if (!hasEmergency) score -= 10;
    if (!certActive) score -= 5;
    if (scheduleConflicts.length > 0) score -= Math.min(15, scheduleConflicts.length * 5);
    if (campsiteReport.contingentsWithoutCampsite.length > 0) score -= Math.min(20, campsiteReport.contingentsWithoutCampsite.length * 5);
    if (unreadyComps.length > 0) score -= Math.min(20, unreadyComps.length * 6);
    if (depWarnings.length > 0) score -= depWarnings.length * 4;
    score = Math.max(10, Math.min(100, score));

    const status: EventReadinessReport['status'] =
      score >= 90 ? 'optimal' : score >= 70 ? 'ready_with_warnings' : 'needs_attention';

    return {
      scorePercentage: score,
      calculatedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      status,
      sections: {
        identity: { ready: identityReady, summary: identityReady ? 'Identitas lengkap & terverifikasi' : 'Perlu kelengkapan' },
        registration: { ready: Boolean(regSettings), summary: `Struktur kontingen: ${regSettings.contingentRepresentationLevel}` },
        schedule: { ready: scheduleConflicts.length === 0, summary: `${spreadsheetRepository.listSchedules(eventId).length} Agenda aktif`, conflictCount: scheduleConflicts.length },
        campsite: { ready: campsiteReport.contingentsWithoutCampsite.length === 0, summary: `${campsiteReport.totalCapacity} Kapasitas daya tampung`, unassignedCount: campsiteReport.contingentsWithoutCampsite.length, overflowCount: campsiteReport.overflowCount },
        activities: { ready: activitiesReady, summary: `${activities.length} Giat aktif terdaftar` },
        competitions: { ready: unreadyComps.length === 0, summary: `${compReadiness.length} Cabang lomba terdaftar`, incompleteCount: unreadyComps.length },
        certificates: { ready: certActive, summary: certActive ? 'Templat aktif' : 'Belum aktif' },
        contacts: { ready: hasEmergency, summary: hasEmergency ? 'Nomor darurat 24 jam siap' : 'Nomor darurat belum ada' },
        features: { ready: depWarnings.length === 0, summary: '10 Modul perkemahan terintegrasi', dependencyWarnings: depWarnings },
      },
      actionableWarnings,
    };
  }

  // ==================== OFFLINE BATCH TRANSACTION PROCESSOR ====================

  /**
   * Processes a batch of offline mutations with Idempotency, Concurrency & Conflict Checks
   */
  public processBatchTransactions(
    context: RequestSecurityContext,
    deviceId: string,
    transactions: OfflineTransaction[]
  ): BatchSyncResult[] {
    // 1. Validate device registration and revocation
    if (spreadsheetRepository.isDeviceRevoked(deviceId)) {
      throw new BusinessValidationError('Izin sinkronisasi untuk perangkat ini telah dicabut oleh Administrator.', 403);
    }

    const results: BatchSyncResult[] = [];

    for (const tx of transactions) {
      // 2. Idempotency Check: Pre-generated UUID resubmission recognition
      if (spreadsheetRepository.hasProcessedTransaction(tx.transaction_id)) {
        const prev = spreadsheetRepository.getProcessedTransaction(tx.transaction_id);
        results.push({
          transaction_id: tx.transaction_id,
          status: 'duplicate',
          resultCode: 'ALREADY_PROCESSED',
          message: 'Transaksi telah diproses sebelumnya (Idempotensi Terpenuhi).',
          data: prev?.result,
          server_version: spreadsheetRepository.getCurrentSyncVersion(),
        });
        continue;
      }

      try {
        // 3. Entity-specific Conflict Resolution Rules
        let processedResult: any = null;

        // Rule A: Attendance Duplicate -> Idempotent Success
        if (tx.entity === 'attendance') {
          processedResult = {
            attendanceId: tx.record_id || `att_${Date.now()}`,
            participantId: tx.payload?.participantId || 'unknown',
            status: 'PRESENT',
            recordedAt: tx.client_created_at,
          };
        }

        // Rule B: Vote Quota Exceeded -> REJECTED
        else if (tx.entity === 'vote') {
          const userVoteCount = tx.payload?.currentVoteCount || 1;
          const maxVotes = tx.payload?.maxVotes || 1;
          if (userVoteCount > maxVotes) {
            results.push({
              transaction_id: tx.transaction_id,
              status: 'rejected',
              resultCode: 'VOTE_QUOTA_EXCEEDED',
              message: 'Batas kuota voting apresiasi karya telah terlampaui.',
            });
            continue;
          }
          processedResult = { voteId: `v_${Date.now()}`, mediaId: tx.record_id, voterId: tx.user_id };
        }

        // Rule C: Point Rule Exceeded -> REJECTED
        else if (tx.entity === 'points') {
          const dailyTotal = tx.payload?.currentDailyTotal || 0;
          const dailyLimit = tx.payload?.dailyLimit || 50;
          const requestedXp = tx.payload?.amount || 10;
          if (dailyTotal + requestedXp > dailyLimit) {
            results.push({
              transaction_id: tx.transaction_id,
              status: 'rejected',
              resultCode: 'POINT_LIMIT_EXCEEDED',
              message: `Batas perolehan XP harian (${dailyLimit} XP) telah tercapai.`,
            });
            continue;
          }
          processedResult = { xpTransactionId: `xp_${Date.now()}`, grantedXp: requestedXp };
        }

        // Rule D: Locked Score Update -> CONFLICT
        else if (tx.entity === 'scoring') {
          const isLocked = tx.payload?.isLocked || false;
          if (isLocked) {
            results.push({
              transaction_id: tx.transaction_id,
              status: 'conflict',
              resultCode: 'SCORE_LOCKED',
              message: 'Nilai lomba tidak dapat diubah karena telah dikunci oleh Ketua Dewan Juri.',
            });
            continue;
          }
          processedResult = { scoreId: tx.record_id, finalScore: tx.payload?.score };
        }

        // Rule E: Version Conflict (Optimistic Concurrency)
        else if (tx.expected_version !== undefined && tx.expected_version < spreadsheetRepository.getCurrentSyncVersion()) {
          results.push({
            transaction_id: tx.transaction_id,
            status: 'conflict',
            resultCode: 'VERSION_CONFLICT',
            message: 'Data di server telah diperbarui oleh pengguna lain (Konflik Versi Optimistik). Silakan muat ulang versi terbaru.',
            server_version: spreadsheetRepository.getCurrentSyncVersion(),
          });
          continue;
        }

        // Standard mutation execution
        else {
          processedResult = {
            recordId: tx.record_id,
            entity: tx.entity,
            action: tx.action,
            acknowledged: true,
          };
        }

        // Record change in server change log & increment sync version
        const newSyncVersion = spreadsheetRepository.recordChange(
          tx.entity,
          (tx.action as any) || 'CREATE',
          tx.record_id,
          tx.payload
        );

        // Record processed transaction for idempotency
        spreadsheetRepository.recordProcessedTransaction(tx.transaction_id, processedResult, newSyncVersion);

        // Audit log for critical actions
        if (['scoring', 'vote', 'attendance', 'campsite', 'schedule'].includes(tx.entity)) {
          this.createAuditLog(
            context,
            'Sync Engine',
            `Offline Sync Mutation: [${tx.entity.toUpperCase()}] ${tx.action}`,
            tx.record_id,
            undefined,
            { txId: tx.transaction_id, deviceId }
          );
        }

        results.push({
          transaction_id: tx.transaction_id,
          status: 'accepted',
          resultCode: 'ACCEPTED',
          message: 'Transaksi offline berhasil disinkronkan ke server.',
          data: processedResult,
          server_version: newSyncVersion,
        });
      } catch (err: any) {
        results.push({
          transaction_id: tx.transaction_id,
          status: 'failed',
          resultCode: 'SYNC_ERROR',
          message: err.message || 'Gagal memproses transaksi di backend.',
        });
      }
    }

    return results;
  }
}

export const eventStudioBusinessService = new EventStudioBusinessService();
