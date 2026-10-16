/**
 * @license
 * SiEpang - Backend API Router & Controller
 * Processes all requests through Authentication, Workspace Guard, RBAC Checks,
 * Business Service, and Repository layers.
 */

import { AuthGuard, RequestSecurityContext, BackendSecurityError } from '../auth/authGuard';
import { BackendPermission } from '../rbac/permissions';
import { eventStudioBusinessService, BusinessValidationError } from '../services/eventStudioBusinessService';
import { spreadsheetRepository } from '../repositories/spreadsheetRepository';
import { visitorManagementService } from '../../services/visitorManagementService';
import { documentStudioService } from '../../services/documentStudioService';
import { documentationService } from '../../services/documentationService';
import { customerInstallationService } from '../../services/customerInstallationService';
import { bootstrapService } from '../../services/bootstrapService';
import { StandardApiResponse, StandardErrorCode } from '../../types';

export const PUBLIC_API_ALLOWLIST = new Set<string>([
  'public.current',
  '/api/public/current',
  'bootstrap.status',
  '/api/bootstrap/status',
  'bootstrap.initialize',
  '/api/bootstrap/initialize',
  '/api/public/event-info',
  '/api/public/schedules',
  '/api/public/documentation',
  '/api/public/visitor/register',
  '/api/public/certificate/verify',
]);

export interface BackendApiRequest<T = any> {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: T;
  context: RequestSecurityContext;
}

export interface BackendApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: StandardErrorCode | string;
    message: string;
    details?: unknown;
  } | any;
  message?: string;
  statusCode: number;
  meta?: {
    requestId: string;
    timestamp: string;
    syncVersion?: number;
    idempotency?: string;
  };
}

export class SiepangBackendApi {
  /**
   * Dispatches an incoming API request through the security guard and business service.
   */
  public async handleRequest<T = any>(req: BackendApiRequest): Promise<BackendApiResponse<T>> {
    const { endpoint, payload, context } = req;
    const installRecord = customerInstallationService.getInstallationRecord();
    const isConfigured = customerInstallationService.isConfigured();
    const eventId = context.eventId || installRecord.active_event_id || '';
    const defaultWorkspaceId = context.workspaceId || installRecord.workspace_id || '';

    try {
      // 0. Public API Gate enforcement (Requirements 8, 9, 24)
      const isPublicEndpoint = PUBLIC_API_ALLOWLIST.has(endpoint);
      if (!isPublicEndpoint) {
        // Any non-allowlisted endpoint strictly requires valid authentication
        AuthGuard.verifyAuthentication(context);
      }

      // 1. Route dispatch with explicit RBAC permission check
      switch (endpoint) {
        // ==================== BOOTSTRAP ENDPOINTS (Zero Deadlock) ====================
        case 'bootstrap.status':
        case '/api/bootstrap/status': {
          const status = await bootstrapService.getStatus();
          return this.success(status as unknown as T);
        }

        case 'bootstrap.initialize':
        case '/api/bootstrap/initialize': {
          const initRes = await bootstrapService.initialize(payload?.bootstrap_token);
          if (!initRes.success) {
            const statusCode = initRes.error?.code === 'BOOTSTRAP_ALREADY_COMPLETED' ? 403 : 401;
            return {
              success: false,
              statusCode,
              error: {
                code: initRes.error?.code || 'BOOTSTRAP_FAILED',
                message: initRes.error?.message || 'Gagal melakukan inisialisasi awal.',
              },
            };
          }
          return this.success(initRes.data as unknown as T);
        }

        // ==================== PUBLIC API ALLOWLIST (Req 8 & 9) ====================
        case 'public.current':
        case '/api/public/current': {
          if (!isConfigured) {
            return {
              success: false,
              statusCode: 503,
              error: {
                code: 'PORTAL_NOT_READY',
                message: 'Portal kegiatan sedang dipersiapkan oleh panitia.',
              },
            };
          }

          const rawEvent = eventStudioBusinessService.getEvent(
            { userId: 'public', userRole: 'viewer', workspaceId: defaultWorkspaceId },
            eventId
          );
          return this.success({
            workspace: {
              name: installRecord.organization_name || 'Kwartir Penyelenggara',
              organization: installRecord.organization_name || 'Kwartir Penyelenggara',
            },
            event: {
              name: rawEvent.name,
              short_name: rawEvent.shortName,
              status: rawEvent.status,
              theme: rawEvent.theme,
              category: rawEvent.category,
              startDate: rawEvent.startDate,
              endDate: rawEvent.endDate,
              location: rawEvent.location,
              venue: rawEvent.venue,
              campGround: rawEvent.campGround,
              participantCapacity: rawEvent.participantCapacity,
              registeredCount: rawEvent.registeredCount,
              checkedInCount: rawEvent.checkedInCount,
              bannerUrl: rawEvent.bannerUrl,
              logoUrl: rawEvent.logoUrl,
              features: rawEvent.features,
            },
          } as unknown as T);
        }

        case '/api/public/event-info': {
          const rawEvent = eventStudioBusinessService.getEvent(
            { userId: 'public', userRole: 'viewer', workspaceId: defaultWorkspaceId },
            payload?.eventId || eventId
          );
          // Data minimization (Requirement 9): expose only safe public event metadata
          return this.success({
            name: rawEvent.name,
            shortName: rawEvent.shortName,
            theme: rawEvent.theme,
            startDate: rawEvent.startDate,
            endDate: rawEvent.endDate,
            location: rawEvent.location,
            venue: rawEvent.venue,
            campGround: rawEvent.campGround,
            participantCapacity: rawEvent.participantCapacity,
          } as unknown as T);
        }

        case '/api/public/schedules': {
          const schedules = eventStudioBusinessService.listSchedules(
            { userId: 'public', userRole: 'viewer', workspaceId: defaultWorkspaceId },
            eventId
          );
          const publicSchedules = schedules
            .filter((s: any) => s.isPublished !== false)
            .map((s: any) => ({
              id: s.id,
              title: s.title,
              time: s.time,
              day: s.day,
              location: s.location,
              category: s.category,
              description: s.description,
            }));
          return this.success(publicSchedules as unknown as T);
        }

        case '/api/public/documentation': {
          const items = documentationService.getMediaItems().filter(m => m.publication_status === 'PUBLISHED' && m.metadata_status === 'ACCESSIBLE');
          const publicItems = items.map(m => ({
            id: m.media_id,
            title: m.title,
            caption: m.caption,
            mediaType: m.media_type,
            previewUrl: m.thumbnail_url,
            eventDate: m.event_date,
          }));
          return this.success(publicItems as unknown as T);
        }

        case '/api/public/visitor/register': {
          if (!payload?.name || !payload?.phone) {
            throw new BusinessValidationError('Nama dan nomor telepon wajib diisi untuk pendaftaran visitor pass.');
          }
          const reg = visitorManagementService.registerVisitor(payload);
          return this.success({
            registrationCode: reg.registrationCode,
            name: reg.name,
            qrToken: reg.qrToken,
            category: reg.category,
            visitDate: reg.visitDate,
            status: reg.status,
          } as unknown as T, 'Pendaftaran visitor pass berhasil.');
        }

        case '/api/public/certificate/verify': {
          const query = payload?.documentNumber || payload?.query || '';
          const result = documentStudioService.verifyPublicDocument(query);
          return this.success(result as unknown as T);
        }

        // ==================== EVENT ====================
        case '/api/events/get': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.getEvent(context, payload?.eventId || eventId);
          return this.success(data as unknown as T);
        }

        case '/api/events/update': {
          this.guard(context, 'event.update');
          const data = eventStudioBusinessService.updateEvent(context, payload.eventId || eventId, payload.updates);
          return this.success(data as unknown as T, 'Pengaturan umum event berhasil disimpan.');
        }

        case '/api/events/archive': {
          this.guard(context, 'event.archive');
          const data = eventStudioBusinessService.archiveEvent(context, payload.eventId || eventId);
          return this.success(data as unknown as T, 'Event berhasil diarsipkan.');
        }

        // ==================== SCHEDULE ====================
        case '/api/schedules/list': {
          this.guard(context, 'schedule.view');
          const data = eventStudioBusinessService.listSchedules(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/schedules/create': {
          this.guard(context, 'schedule.create');
          const data = eventStudioBusinessService.createSchedule(context, eventId, payload.schedule);
          return this.success(data as unknown as T, 'Agenda jadwal berhasil ditambahkan.');
        }

        case '/api/schedules/update': {
          this.guard(context, 'schedule.update');
          const data = eventStudioBusinessService.updateSchedule(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Jadwal berhasil diperbarui.');
        }

        case '/api/schedules/duplicate': {
          this.guard(context, 'schedule.duplicate');
          const data = eventStudioBusinessService.duplicateSchedule(context, eventId, payload.id);
          return this.success(data as unknown as T, 'Jadwal berhasil digandakan.');
        }

        case '/api/schedules/move': {
          this.guard(context, 'schedule.move');
          const data = eventStudioBusinessService.moveSchedule(context, eventId, payload.id, payload.newDay);
          return this.success(data as unknown as T, `Jadwal dipindahkan ke Hari ke-${payload.newDay}.`);
        }

        case '/api/schedules/publish': {
          this.guard(context, 'schedule.publish');
          const data = eventStudioBusinessService.publishSchedule(context, eventId, payload.id, payload.isPublished);
          return this.success(data as unknown as T, payload.isPublished ? 'Jadwal dipublikasikan.' : 'Jadwal ditarik.');
        }

        case '/api/schedules/archive': {
          this.guard(context, 'schedule.archive');
          const data = eventStudioBusinessService.archiveSchedule(context, eventId, payload.id);
          return this.success(data as unknown as T, 'Jadwal diarsipkan.');
        }

        // ==================== ACTIVITIES ====================
        case '/api/activities/list': {
          this.guard(context, 'schedule.view');
          const data = eventStudioBusinessService.listActivities(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/activities/create': {
          this.guard(context, 'activity.manage');
          const data = eventStudioBusinessService.createActivity(context, eventId, payload.activity);
          return this.success(data as unknown as T, 'Jenis aktivitas berhasil dibuat.');
        }

        case '/api/activities/update': {
          this.guard(context, 'activity.manage');
          const data = eventStudioBusinessService.updateActivity(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Aktivitas berhasil diperbarui.');
        }

        case '/api/activities/archive': {
          this.guard(context, 'activity.manage');
          const data = eventStudioBusinessService.archiveActivity(context, eventId, payload.id);
          return this.success(data as unknown as T, 'Aktivitas diarsipkan.');
        }

        case '/api/activities/types/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listActivityTypes();
          return this.success(data as unknown as T);
        }

        case '/api/activities/types/create': {
          this.guard(context, 'activity.manage');
          const data = eventStudioBusinessService.createActivityType(context, payload.activityType);
          return this.success(data as unknown as T, 'Tipe aktivitas baru berhasil didaftarkan.');
        }

        // ==================== CAMPSITE ====================
        case '/api/campsite/subcamps/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listSubcamps(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/campsite/subcamps/create': {
          this.guard(context, 'campsite.manage');
          const data = eventStudioBusinessService.createSubcamp(context, eventId, payload.subcamp);
          return this.success(data as unknown as T, 'Sub Camp berhasil ditambahkan.');
        }

        case '/api/campsite/zones/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listZones(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/campsite/zones/create': {
          this.guard(context, 'campsite.manage');
          const data = eventStudioBusinessService.createZone(context, eventId, payload.zone);
          return this.success(data as unknown as T, 'Zona kemah berhasil ditambahkan.');
        }

        case '/api/campsite/blocks/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listBlocks(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/campsite/blocks/create': {
          this.guard(context, 'campsite.manage');
          const data = eventStudioBusinessService.createBlock(context, eventId, payload.block);
          return this.success(data as unknown as T, 'Blok kavling berhasil ditambahkan.');
        }

        case '/api/campsite/lots/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listLots(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/campsite/lots/create': {
          this.guard(context, 'campsite.manage');
          const data = eventStudioBusinessService.createLot(context, eventId, payload.lot);
          return this.success(data as unknown as T, 'Kavling tenda berhasil ditambahkan.');
        }

        case '/api/campsite/lots/update': {
          this.guard(context, 'campsite.manage');
          const data = eventStudioBusinessService.updateLot(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Kavling tenda diperbarui.');
        }

        case '/api/campsite/lots/assign': {
          this.guard(context, 'campsite.manage');
          const data = eventStudioBusinessService.assignContingentToLot(
            context,
            eventId,
            payload.lotId,
            payload.contingentId,
            payload.contingentName
          );
          return this.success(data as unknown as T, 'Penetapan kontingen ke kavling berhasil.');
        }

        case '/api/campsite/facilities/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listFacilities(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/campsite/facilities/create': {
          this.guard(context, 'facility.manage');
          const data = eventStudioBusinessService.createFacility(context, eventId, payload.facility);
          return this.success(data as unknown as T, 'Fasilitas perkemahan berhasil ditambahkan.');
        }

        case '/api/campsite/facilities/update': {
          this.guard(context, 'facility.manage');
          const data = eventStudioBusinessService.updateFacility(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Fasilitas diperbarui.');
        }

        // ==================== COMPETITIONS & JUDGING ====================
        case '/api/competitions/types/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listCompetitionTypes();
          return this.success(data as unknown as T);
        }

        case '/api/competitions/types/create': {
          this.guard(context, 'competition.manage');
          const data = eventStudioBusinessService.createCompetitionType(context, payload.competitionType);
          return this.success(data as unknown as T, 'Tipe kompetisi baru berhasil didaftarkan.');
        }

        case '/api/competitions/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listCompetitions(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/competitions/create': {
          this.guard(context, 'competition.manage');
          const data = eventStudioBusinessService.createCompetition(context, eventId, payload.competition);
          return this.success(data as unknown as T, 'Cabang lomba berhasil dibuat.');
        }

        case '/api/competitions/update': {
          this.guard(context, 'competition.manage');
          const data = eventStudioBusinessService.updateCompetition(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Data lomba berhasil diperbarui.');
        }

        case '/api/competitions/criteria/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listJudgingCriteria(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/competitions/criteria/configure': {
          this.guard(context, 'competition.manage');
          const result = eventStudioBusinessService.configureCriteria(context, eventId, payload.criteria);
          return this.success(result as unknown as T, 'Rubrik penilaian juri berhasil dikonfigurasi.');
        }

        case '/api/competitions/judges/list': {
          this.guard(context, 'competition.manage');
          const data = eventStudioBusinessService.listJudges(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/competitions/judges/assign': {
          this.guard(context, 'judge.manage');
          const data = eventStudioBusinessService.assignJudges(context, eventId, payload.judge);
          return this.success(data as unknown as T, 'Penugasan dewan juri berhasil disimpan.');
        }

        case '/api/competitions/judges/toggle-lock': {
          this.guard(context, 'judge.manage');
          const data = eventStudioBusinessService.toggleJudgeLock(context, eventId, payload.judgeId);
          return this.success(data as unknown as T, data.isLocked ? 'Nilai juri dikunci.' : 'Kunci nilai dibuka.');
        }

        case '/api/competitions/voting/get': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.getVotingConfig(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/competitions/voting/configure': {
          this.guard(context, 'voting.manage');
          const data = eventStudioBusinessService.configureVoting(context, eventId, payload.config);
          return this.success(data as unknown as T, 'Konfigurasi voting digital berhasil disimpan.');
        }

        // ==================== REGISTRATION ====================
        case '/api/registration/settings/get': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.getRegistrationSettings(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/registration/settings/update': {
          this.guard(context, 'registration.manage');
          const data = eventStudioBusinessService.updateRegistrationSettings(context, eventId, payload.settings);
          return this.success(data as unknown as T, 'Pengaturan pendaftaran & kuota diperbarui.');
        }

        case '/api/registration/fields/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listDynamicFields(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/registration/fields/create': {
          this.guard(context, 'registration.manage');
          const data = eventStudioBusinessService.createDynamicField(context, eventId, payload.field);
          return this.success(data as unknown as T, 'Kolom formulir dinamis berhasil ditambahkan.');
        }

        case '/api/registration/fields/update': {
          this.guard(context, 'registration.manage');
          const data = eventStudioBusinessService.updateDynamicField(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Kolom formulir diperbarui.');
        }

        // ==================== GAMIFICATION ====================
        case '/api/gamification/points/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listPointRules(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/gamification/points/create': {
          this.guard(context, 'point.manage');
          const data = eventStudioBusinessService.createPointRule(context, eventId, payload.rule);
          return this.success(data as unknown as T, 'Aturan XP berhasil dibuat.');
        }

        case '/api/gamification/points/update': {
          this.guard(context, 'point.manage');
          const data = eventStudioBusinessService.updatePointRule(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Aturan XP diperbarui.');
        }

        case '/api/gamification/badges/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listBadges(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/gamification/badges/create': {
          this.guard(context, 'badge.manage');
          const data = eventStudioBusinessService.createBadge(context, eventId, payload.badge);
          return this.success(data as unknown as T, 'Lencana prestasi berhasil dibuat.');
        }

        case '/api/gamification/badges/update': {
          this.guard(context, 'badge.manage');
          const data = eventStudioBusinessService.updateBadge(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Lencana diperbarui.');
        }

        case '/api/gamification/checkpoints/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listCheckpoints(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/gamification/checkpoints/create': {
          this.guard(context, 'checkpoint.manage');
          const data = eventStudioBusinessService.createCheckpoint(context, eventId, payload.checkpoint);
          return this.success(data as unknown as T, 'Pos QR Checkpoint berhasil dibuat.');
        }

        case '/api/gamification/checkpoints/update': {
          this.guard(context, 'checkpoint.manage');
          const data = eventStudioBusinessService.updateCheckpoint(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Pos Checkpoint diperbarui.');
        }

        case '/api/gamification/checkpoints/regenerate': {
          this.guard(context, 'checkpoint.manage');
          const qr = eventStudioBusinessService.regenerateCheckpointQr(context, eventId, payload.id);
          return this.success({ qrCode: qr } as unknown as T, 'Kode QR berhasil diregenerasi.');
        }

        // ==================== FEATURES ====================
        case '/api/features/get': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.getEventFeatures(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/features/update': {
          this.guard(context, 'event.update');
          const data = eventStudioBusinessService.updateEventFeature(context, eventId, payload.featureKey, payload.enabled);
          return this.success(data as unknown as T, `Status fitur berhasil diubah.`);
        }

        case '/api/features/home-sections/reorder': {
          this.guard(context, 'event.update');
          const data = eventStudioBusinessService.reorderHomepageSections(context, eventId, payload.sections);
          return this.success(data as unknown as T, 'Susunan beranda peserta diperbarui.');
        }

        // ==================== CONTENT & CONTACTS ====================
        case '/api/content/pages/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listEventPages(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/content/pages/create': {
          this.guard(context, 'content.manage');
          const data = eventStudioBusinessService.createEventPage(context, eventId, payload.page);
          return this.success(data as unknown as T, 'Halaman informasi berhasil dibuat.');
        }

        case '/api/content/pages/update': {
          this.guard(context, 'content.manage');
          const data = eventStudioBusinessService.updateEventPage(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Halaman diperbarui.');
        }

        case '/api/content/contacts/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listEventContacts(context, eventId);
          return this.success(data as unknown as T);
        }

        case '/api/content/contacts/create': {
          this.guard(context, 'contact.manage');
          const data = eventStudioBusinessService.createEventContact(context, eventId, payload.contact);
          return this.success(data as unknown as T, 'Kontak posko berhasil didaftarkan.');
        }

        case '/api/content/contacts/update': {
          this.guard(context, 'contact.manage');
          const data = eventStudioBusinessService.updateEventContact(context, eventId, payload.id, payload.updates);
          return this.success(data as unknown as T, 'Kontak posko diperbarui.');
        }

        // ==================== AUDIT ====================
        case '/api/audit/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listAuditLog(context, payload?.eventId || eventId);
          return this.success(data as unknown as T);
        }

        // ==================== ORGANIZATIONS ====================
        case '/api/organizations/list': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.listOrganizations();
          return this.success(data as unknown as T);
        }

        case '/api/organizations/create': {
          this.guard(context, 'event.update');
          const data = eventStudioBusinessService.createOrganization(context, payload.organization);
          return this.success(data as unknown as T, 'Organisasi kepramukaan baru berhasil didaftarkan.');
        }

        // ==================== SYNC & INTEGRITY ENGINE ====================
        case '/api/sync/batch': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.processBatchTransactions(context, payload.deviceId, payload.transactions || []);
          return this.success(data as unknown as T, 'Batch transaksi offline berhasil diproses.', spreadsheetRepository.getCurrentSyncVersion());
        }

        case '/api/sync/changes': {
          this.guard(context, 'event.view');
          const data = spreadsheetRepository.getChangesSince(payload?.sinceVersion || 0);
          return this.success(data as unknown as T, undefined, data.current_sync_version);
        }

        case '/api/sync/snapshot': {
          this.guard(context, 'event.view');
          const data = spreadsheetRepository.getRoleScopedSnapshot(context.userRole, eventId);
          return this.success(data as unknown as T, 'Snapshot basis data offline berhasil diunduh.', data.sync_version);
        }

        case '/api/devices/list': {
          this.guard(context, 'event.view');
          const data = spreadsheetRepository.listDevices();
          return this.success(data as unknown as T);
        }

        case '/api/devices/register': {
          const data = spreadsheetRepository.registerOrUpdateDevice({
            device_id: payload.device_id,
            workspace_id: context.workspaceId || defaultWorkspaceId,
            user_id: context.userId,
            device_name: payload.device_name,
            device_type: payload.device_type,
            last_sync: payload.last_sync,
            last_sync_version: payload.last_sync_version,
            pending_transaction_count: payload.pending_transaction_count,
          });
          return this.success(data as unknown as T, 'Perangkat berhasil terdaftar dalam Device Registry.');
        }

        case '/api/devices/revoke': {
          this.guard(context, 'event.update');
          const data = spreadsheetRepository.revokeDevice(payload.deviceId);
          return this.success(data as unknown as T, 'Akses perangkat berhasil dicabut.');
        }

        case '/api/devices/activate': {
          this.guard(context, 'event.update');
          const data = spreadsheetRepository.activateDevice(payload.deviceId);
          return this.success(data as unknown as T, 'Akses perangkat berhasil diaktifkan kembali.');
        }

        case '/api/readiness/get': {
          this.guard(context, 'event.view');
          const data = eventStudioBusinessService.getEventReadiness(eventId);
          return this.success(data as unknown as T);
        }

        case '/api/conflicts/schedules': {
          this.guard(context, 'schedule.view');
          const data = eventStudioBusinessService.detectScheduleConflicts(eventId);
          return this.success(data as unknown as T);
        }

        case '/api/campsite/capacity-check': {
          this.guard(context, 'campsite.view');
          const data = eventStudioBusinessService.validateCampsiteCapacity(eventId);
          return this.success(data as unknown as T);
        }

        case '/api/competitions/readiness': {
          this.guard(context, 'competition.view');
          const data = eventStudioBusinessService.validateCompetitionReadiness(eventId, payload?.competitionId);
          return this.success(data as unknown as T);
        }

        // ==================== LOCAL CAMP SERVER (SERVER BUPER) ====================
        case '/api/local/health': {
          const data = {
            connected: false,
            status: 'offline',
            uptimeSeconds: 0,
            edgeNodeId: payload?.edgeNodeId || '',
            databaseType: 'SQLite Local Datastore',
            connectedDevicesCount: 0,
            localPendingUpstreamCount: Array.isArray(payload?.pendingTransactions) ? payload.pendingTransactions.length : 0,
            lastHeartbeat: '',
          };
          return this.success(data as unknown as T, 'Status Server Buper lokal belum dikonfigurasi.');
        }

        case '/api/local/edge/upstream-sync': {
          this.guard(context, 'event.update');
          const data = eventStudioBusinessService.processBatchTransactions(
            context,
            payload?.edgeNodeId || '',
            payload?.transactions || []
          );
          return this.success(data as unknown as T, 'Sinkronisasi Upstream Server Buper ke Cloud selesai.');
        }

        case '/api/local/edge/downstream-pull': {
          this.guard(context, 'event.view');
          const data = spreadsheetRepository.getChangesSince(payload?.sinceVersion || 0);
          return this.success(data as unknown as T, 'Replikasi Downstream Cloud ke Server Buper selesai.');
        }

        case '/api/local/edge/import-bundle': {
          this.guard(context, 'event.update');
          const txs = payload?.bundle?.transactions || [];
          const data = eventStudioBusinessService.processBatchTransactions(
            context,
            payload?.bundle?.edgeNodeId || 'USB-SNEAKERNET',
            txs
          );
          return this.success(data as unknown as T, `Paket darurat USB berhasil diproses ke Cloud: ${txs.length} transaksi.`);
        }

        case '/api/production/readiness': {
          this.guard(context, 'event.view');
          const readiness = eventStudioBusinessService.getEventReadiness(eventId);
          return this.success(readiness as unknown as T, 'Laporan kesiapan produksi berhasil diambil.');
        }

        // ==================== INSTALLATION & SYSTEM CONFIGURATION (ADMIN ONLY) ====================
        case '/api/installation/config': {
          this.guard(context, 'installation.read');
          const data = customerInstallationService.getInstallationRecord();
          return this.success(data as unknown as T, 'Data konfigurasi instalasi berhasil diambil.');
        }

        case '/api/installation/diagnostics': {
          this.guard(context, 'installation.manage');
          const data = customerInstallationService.getSafeDiagnosticsJson();
          return this.success(data as unknown as T, 'Diagnostik instalasi.');
        }

        case '/api/installation/health': {
          this.guard(context, 'installation.read');
          const data = customerInstallationService.getSystemHealth();
          return this.success(data as unknown as T, 'Laporan kesehatan sistem.');
        }

        case '/api/installation/update': {
          this.guard(context, 'installation.manage');
          const data = customerInstallationService.updateInstallationRecord(payload || {});
          return this.success(data as unknown as T, 'Konfigurasi instalasi berhasil diperbarui.');
        }

        case '/api/installation/recovery': {
          this.guard(context, 'installation.recovery');
          const data = customerInstallationService.generateRecoveryPayload();
          return this.success(data as unknown as T, 'Payload pemulihan bencana berhasil dibuat.');
        }

        case '/api/installation/handshake': {
          this.guard(context, 'installation.manage');
          const nonce = customerInstallationService.generateHandshakeNonce();
          const data = await customerInstallationService.validateBackendEndpoint(payload?.webAppUrl, nonce);
          return this.success(data as unknown as T, data.message);
        }

        case '/api/installation/bootstrap-superadmin': {
          this.guard(context, 'installation.manage');
          const data = await customerInstallationService.ensureBootstrapSuperAdmin();
          return this.success(data as unknown as T, data.message);
        }

        default:

          return {
            success: false,
            error: {
              code: 'RECORD_NOT_FOUND',
              message: `Rute API '${endpoint}' tidak dikenal oleh server SiEpang.`,
            },
            statusCode: 404,
            meta: {
              requestId: `req_${Date.now()}`,
              timestamp: new Date().toISOString(),
            },
          };
      }
    } catch (err: any) {
      const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const timestamp = new Date().toISOString();

      if (err instanceof BackendSecurityError) {
        return {
          success: false,
          error: {
            code: err.statusCode === 401 ? 'AUTH_REQUIRED' : 'PERMISSION_DENIED',
            message: err.message,
          },
          statusCode: err.statusCode,
          meta: { requestId: reqId, timestamp },
        };
      }
      if (err instanceof BusinessValidationError) {
        return {
          success: false,
          error: {
            code: err.statusCode === 404 ? 'RECORD_NOT_FOUND' : 'VALIDATION_ERROR',
            message: err.message,
          },
          statusCode: err.statusCode,
          meta: { requestId: reqId, timestamp },
        };
      }
      return {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: err?.message || 'Terjadi kendala operasional pada sistem SiEpang.',
        },
        statusCode: 500,
        meta: { requestId: reqId, timestamp },
      };
    }
  }

  private guard(context: RequestSecurityContext, permission: BackendPermission, targetWorkspaceId?: string): void {
    AuthGuard.verifyWorkspaceGuard(context, targetWorkspaceId);
    AuthGuard.verifyPermission(context, permission);
  }

  private success<T>(data: T, message?: string, syncVersion?: number): BackendApiResponse<T> {
    return {
      success: true,
      data,
      message,
      statusCode: 200,
      meta: {
        requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        syncVersion: syncVersion !== undefined ? syncVersion : spreadsheetRepository.getCurrentSyncVersion(),
      },
    };
  }
}

export const siepangBackendApi = new SiepangBackendApi();
