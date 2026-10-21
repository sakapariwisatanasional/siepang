export type UserRole =
  | 'superadmin'
  | 'workspace_admin'
  | 'event_admin'
  | 'kontingen_admin'
  | 'registration_officer'
  | 'participant'
  | 'judge'
  | 'attendance_officer'
  | 'health_officer'
  | 'logistic_officer'
  | 'viewer'
  | 'committee'
  | 'ceremony_officer'
  | 'documentation_officer'
  | 'publication_officer';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  workspaceId: string;
  eventId?: string;
  contingentId?: string;
  contingentName?: string;
  participantCode?: string;
  xp?: number;
  level?: number;
  rank?: number;
  phone?: string;
  appreciationQuotaRemaining?: number;
  profile_photo_file_id?: string;
  profile_photo_thumbnail_file_id?: string;
  profile_photo_url?: string;
  profile_photo_thumbnail_url?: string;
  profile_photo_status?: ProfilePhotoStatus;
  photo_rejection_reason?: string;
  is_trusted_device?: boolean;
}

export interface TrustedDeviceRecord {
  trusted_device_id: string;
  user_id: string;
  device_public_id: string;
  device_name: string;
  browser_family: string;
  platform: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at?: string;
  status: 'active' | 'revoked';
  is_current_device?: boolean;
}

export interface AuthOtpChallengeRecord {
  challenge_id: string;
  email: string;
  purpose: 'REGISTER_EMAIL' | 'LOGIN_DEVICE' | 'HIGH_RISK_REAUTH';
  expires_at: string;
  attempt_count: number;
  max_attempts: number;
  resend_count: number;
  status: 'PENDING' | 'USED' | 'EXPIRED' | 'LOCKED';
  created_at: string;
}

export type ProfilePhotoStatus = 'NOT_UPLOADED' | 'UPLOADED' | 'VALID' | 'REJECTED' | 'NEEDS_REPLACEMENT';
export type PhotoEntityType = 'PARTICIPANT' | 'OFFICIAL' | 'COMMITTEE' | 'JUDGE';
export type PhotoRequiredPolicy = 'REQUIRED' | 'OPTIONAL';
export type PhotoReplacementPolicy = 'ALLOW' | 'REQUIRE_REAPPROVAL' | 'ADMIN_ONLY';

export interface PhotoRequiredConfig {
  PARTICIPANT: PhotoRequiredPolicy;
  OFFICIAL: PhotoRequiredPolicy;
  COMMITTEE: PhotoRequiredPolicy;
  JUDGE: PhotoRequiredPolicy;
}

export interface ProfilePhotoRecord {
  id: string;
  entity_type: PhotoEntityType;
  entity_id: string;
  entity_name: string;
  profile_photo_file_id: string;
  profile_photo_thumbnail_file_id?: string;
  profile_photo_original_file_id?: string;
  profile_photo_url: string;
  profile_photo_thumbnail_url: string;
  profile_photo_status: ProfilePhotoStatus;
  photo_rejection_reason?: string;
  customer_drive_path: string;
  width: number;
  height: number;
  file_size_bytes: number;
  mime_type: string;
  lifecycle_state: 'TEMPORARY' | 'ATTACHED' | 'ORPHANED';
  uploaded_at: string;
  verified_at?: string;
  verified_by?: string;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  logoUrl: string;
  bannerUrl: string;
  organizationName: string;
  eventShortName: string;
  faviconUrl?: string;
  brandingVersion?: number;
}

/** Standard Customer-Owned Drive Folder Structure (Req 51-52) */
export interface CustomerDriveFolderStructure {
  root_drive_folder_id: string;
  database_folder_id: string;
  branding_folder_id: string;
  app_logo_folder_id: string;
  favicon_folder_id: string;
  event_logo_folder_id: string;
  hero_folder_id: string;
  documents_folder_id: string;
  certificates_folder_id: string;
  id_cards_folder_id: string;
  backup_folder_id: string;
  assets_folder_id: string;
}

export type BrandingAssetType = 'APP_LOGO' | 'FAVICON' | 'EVENT_LOGO' | 'HERO';

/** Active Customer Branding Asset Model (Req 55) */
export interface CustomerBrandingAsset {
  branding_asset_id: string;
  workspace_id: string;
  asset_type: BrandingAssetType;
  drive_file_id: string;
  file_name: string;
  mime_type: string;
  public_render_url: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  dimensions?: { width: number; height: number };
  file_size_bytes?: number;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

export interface BrandingValidationResult {
  valid: boolean;
  state: 'CHECKING' | 'ACCESSIBLE' | 'INVALID_URL' | 'PRIVATE' | 'NOT_FOUND' | 'BROKEN_SOURCE' | 'UNSUPPORTED';
  message: string;
  warnings?: string[];
  dimensions?: { width: number; height: number };
  aspectRatio?: number;
  fileSizeBytes?: number;
}

export interface BrandingHealthReport {
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
  appLogo: { ok: boolean; message: string; url?: string; fileId?: string; version?: number };
  favicon: { ok: boolean; message: string; url?: string; fileId?: string; version?: number };
  driveAccess: { ok: boolean; message: string; folderId?: string };
}

/** Admin Database Connection & Spreadsheet Model (Req 65-67) */
export interface SpreadsheetConnectionConfig {
  workspace_id: string;
  spreadsheet_id: string;
  spreadsheet_url: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR';
  schema_version: string; // e.g. "v1.5"
  connected_at: string;
  last_sync: string;
  title: string;
  sheet_names: string[];
  drive_folder_id: string;
  health: {
    can_read: boolean;
    can_write: boolean;
    missing_sheets: string[];
    schema_matched: boolean;
    latency_ms: number;
  };
}

/** Customer-Owned Installation Lifecycle Status (Req 9) */
export type InstallationStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURING'
  | 'AUTHORIZATION_REQUIRED'
  | 'DATABASE_READY'
  | 'BACKEND_READY'
  | 'DEPLOYMENT_REQUIRED'
  | 'VALIDATING'
  | 'READY'
  | 'DEGRADED'
  | 'UPDATE_REQUIRED'
  | 'ERROR';

/** Normalized Customer Installation Entity (Milestone v1.7) */
export interface CustomerInstallationRecord {
  installation_id: string;
  installation_code: string; // e.g. "SIEPANG-KWCB-BWI-7F92K" (Req 9)
  workspace_id: string;
  active_event_id?: string; // Authoritative single-event installation context
  organization_id: string;
  organization_name?: string;
  spreadsheet_id: string;
  root_drive_folder_id: string;
  database_folder_id: string;
  branding_folder_id: string;
  script_id: string;
  deployment_id: string;
  web_app_url: string;
  frontend_version: string; // e.g. "v1.7.0"
  backend_version: string;  // e.g. "v1.7.0"
  schema_version: string;   // e.g. "v1.7"
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  installation_status: InstallationStatus;
  installation_mode: 'GUIDED_INSTALLATION' | 'AUTOMATED_INSTALLATION';
  installed_at: string;
  installed_by: string; // Account email that created installation
  owner_account_email: string; // Current owner email
  owner_status: 'VERIFIED' | 'TRANSFER_PENDING' | 'UNAVAILABLE';
  owner_transferred_at?: string;
  last_health_check: string;
  authorization_granted: boolean;
  handshake_nonce?: string;
  bootstrap_superadmin_email?: string;
  bootstrap_superadmin_status?: 'ACTIVE' | 'PENDING' | 'FAILED';
}

/** Canonical Public Current Response (Single Installation = Single Event) */
export interface PublicCurrentResponse {
  installation: {
    id: string;
    environment?: string;
    version?: string;
  };
  workspace: {
    id: string;
    name: string;
    organization?: string;
  };
  event: {
    id: string;
    event_code?: string;
    name: string;
    short_name?: string;
    status: string;
    theme?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    venue?: string;
    camp_ground?: string;
    campGround?: string;
    participant_capacity?: number;
    participantCapacity?: number;
    registeredCount?: number;
    checkedInCount?: number;
    banner_url?: string;
    bannerUrl?: string;
    logo_url?: string;
    logoUrl?: string;
    features?: any;
    [key: string]: any;
  };
}

/** Safe Recovery File Payload (Req 11) - Zero secrets or tokens */
export interface SiepangRecoveryPayload {
  format: 'SIEPANG_RECOVERY_V1';
  installation_code: string;
  installation_id: string;
  workspace_id: string;
  organization_name: string;
  web_app_url: string;
  frontend_compatibility: string;
  backend_version: string;
  schema_version: string;
  environment: string;
  generated_at: string;
  checksum: string;
  signature: string; // Cryptographic HMAC authenticity signature (Req 58)
}

/** Ownership Transfer Payload (Req 14-16) */
export interface InstallationOwnerTransferPayload {
  current_owner_email: string;
  new_owner_email: string;
  reason: string;
  transfer_timestamp: string;
  transfer_authorized_by: string;
}

/** Comprehensive System Health Report (Req 51 & Req 15) */
export interface SystemHealthReport {
  status: 'READY' | 'WARNING' | 'ERROR';
  google_drive: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; folder_id: string };
  database: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; schema_version: string; spreadsheet_id: string };
  schema: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; version: string; tables_count: number };
  backend: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; version: string; script_id: string };
  deployment: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; deployment_id: string; url: string };
  ownership: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; owner_email: string; owner_status: 'VERIFIED' | 'TRANSFER_PENDING' | 'UNAVAILABLE' };
  branding: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; version: number };
  feature_registry: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; active_features_count: number };
  rbac: { status: 'READY' | 'WARNING' | 'ERROR'; message: string; roles_count: number };
  timestamp: string;
}

export interface WorkspaceInfrastructure {
  spreadsheetId: string;
  spreadsheetUrl: string;
  driveRootFolderId: string;
  driveFolders: {
    branding: string;
    idCardTemplates: string;
    idCardGenerated: string;
    certificatesTemplates: string;
    certificatesGenerated: string;
    submissions: string;
  };
  apiEndpoint: string;
  offlineSyncEnabled: boolean;
  autoBackupInterval: string;
}

export type EventCategory =
  | 'Jambore'
  | 'Raimuna'
  | 'Lomba Tingkat'
  | 'Perkemahan Wirakarya'
  | 'Persami'
  | 'Kemah Bakti';

export type EventStatus =
  | 'DRAFT'
  | 'REGISTRATION'
  | 'UPCOMING'
  | 'ONGOING'
  | 'COMPLETED'
  | 'ARCHIVED';

export type OrganizationLevel =
  | 'KWARNAS'
  | 'KWARDA'
  | 'KWARCAB'
  | 'KWARRAN'
  | 'GUDEP';

// Backwards-compatibility alias
export type OrganizationalLevel = OrganizationLevel | 'Nasional' | 'Kwarda' | 'Kwarcab' | 'Kwarran' | 'Gudep';

export interface Organization {
  organization_id: string;
  organization_code: string;
  organization_name: string;
  organization_level: OrganizationLevel;
  parent_organization_id: string | null;
  province_code?: string;
  province_name?: string;
  city_code?: string;
  city_name?: string;
  district_code?: string;
  district_name?: string;
  gudep_number?: string;
  base_institution?: string; // Pangkalan (e.g. SMAN 1 Giri)
  pangkalan?: string;
  status: 'active' | 'inactive';
}

export type ParticipationScope =
  | 'OWN_ORGANIZATION'
  | 'CHILD_ORGANIZATIONS'
  | 'SELECTED_ORGANIZATIONS'
  | 'OPEN_INVITATION'
  | 'CUSTOM';

export type ParticipantRegistrationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVISION'
  | 'VERIFIED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHECKED_IN'
  | 'ARCHIVED';

export interface CustomDomainConfig {
  domain_id: string;
  hostname: string;
  workspace_id: string;
  is_primary: boolean;
  ssl_status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'ERROR';
  verification_token: string;
  is_verified: boolean;
  created_at: string;
  status: 'active' | 'inactive';
}

export interface OnlineAuthSession {
  sessionId: string;
  userId: string;
  user: User;
  workspaceId: string;
  organizationId: string;
  role: UserRole;
  permissions: string[];
  activeEventId: string;
  issuedAt: string;
  expiresAt: string;
  isValid: boolean;
}

export interface CampsiteSubcamp {
  id: string;
  name: string;
  campArea?: string;
  description?: string;
  leaderName?: string;
}

export interface CampsiteZone {
  id: string;
  subcampId?: string;
  subCampName?: string;
  name: string;
  genderAllocation?: 'male' | 'female' | 'mixed';
  color?: string;
}

export interface CampsiteBlock {
  id: string;
  zoneId?: string;
  zoneName?: string;
  name: string;
}

export interface ActivityType {
  id: string;
  name: string;
  category: string;
  description?: string;
  defaultXp?: number;
}

export interface CompetitionType {
  id: string;
  name: string;
  category: string;
  description?: string;
  defaultJuryWeight?: number;
  defaultPublicWeight?: number;
}

export interface RegistrationSettings {
  registrationStart: string;
  registrationEnd: string;
  maxParticipants: number;
  contingentRepresentationLevel: OrganizationLevel;
  maxParticipantsPerContingent: number;
  maxAdvisorsPerContingent: number;
  allowSelfRegistration: boolean;
  status: 'OPEN' | 'CLOSED' | 'VERIFICATION';
}

export interface EventContactItem {
  id: string;
  role: string;
  name: string;
  phone: string;
  location?: string;
  isEmergency: boolean;
}

export interface EventContacts {
  medical?: string;
  security?: string;
  info?: string;
  emergency?: string;
  helpdesk?: string;
  secretariat?: string;
  health?: string;
  [key: string]: string | undefined;
}

export interface EventFeaturesConfig {
  attendance: boolean;
  qrCheckpoint: boolean;
  competition: boolean;
  voting: boolean;
  xp: boolean;
  leaderboard: boolean;
  digitalGallery: boolean;
  certificate: boolean;
  healthPost: boolean;
  logistics: boolean;
  visitorManagement?: boolean;
  activityQr?: boolean;
  publicDocumentation?: boolean;
  photoGallery?: boolean;
  videoGallery?: boolean;
  publicHeroBanner?: boolean;
  sponsorDisplay?: boolean;
  informationBanner?: boolean;
}

export interface HomeSectionConfig {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

export interface ScoutEvent {
  id: string;
  event_id?: string;
  workspaceId: string;
  name: string;
  shortName: string;
  eventCode: string;
  category: EventCategory;
  organizationalLevel: OrganizationalLevel;
  organizer_organization_id?: string;
  organizer_level?: OrganizationLevel;
  contingent_representation_level?: OrganizationLevel;
  organizer: string;
  description: string;
  theme: string;
  startDate: string;
  endDate: string;
  registrationStart: string;
  registrationEnd: string;
  location: string;
  venue: string;
  campGround: string;
  participantCapacity: number;
  bannerUrl: string;
  logoUrl: string;
  status: EventStatus;
  participation_scope?: ParticipationScope;
  allowed_organization_ids?: string[];
  contacts: EventContacts;
  features: EventFeaturesConfig;
  homeSections: HomeSectionConfig[];
  maxParticipants: number;
  registeredCount: number;
  checkedInCount: number;
  contingentCount: number;
  competitionCount: number;
}

export interface Workspace {
  id: string;
  workspace_id?: string;
  code: string;
  name: string;
  workspace_name?: string;
  workspace_code?: string;
  workspace_status?: 'active' | 'provisioning' | 'suspended';
  schema_version?: string;
  branding_version?: string;
  default_event_id?: string;
  organization: string;
  organization_id?: string;
  organization_level?: OrganizationLevel;
  parent_workspace_id?: string | null;
  region: string;
  province: string;
  city: string;
  customDomain?: string;
  status: 'active' | 'provisioning' | 'suspended';
  schemaVersion: string;
  databaseStatus: 'connected' | 'syncing' | 'error';
  driveStatus: 'connected' | 'quota_warning' | 'error';
  branding: BrandingConfig;
  infrastructure: WorkspaceInfrastructure;
  activeEventId: string;
  events: ScoutEvent[];
  createdAt: string;
  adminName: string;
  adminEmail: string;
}

export type ParticipantStatus =
  | 'draft'
  | 'submitted'
  | 'revision'
  | 'verified'
  | 'approved'
  | 'rejected';

export interface ParticipantStatusHistoryItem {
  participant_id: string;
  previous_status: string;
  new_status: string;
  changed_by: string;
  reason?: string;
  timestamp: string;
}

export interface Participant {
  id: string;
  workspaceId?: string;
  workspace_id?: string;
  eventId?: string;
  event_id?: string;
  code: string;
  participantCode?: string;
  name: string;
  gender: 'M' | 'F' | 'L' | 'P';
  role: 'Penggalang' | 'Penegak' | 'Pandega' | 'Pembina Pendamping' | 'Pimpinan Kontingen';
  contingentId: string;
  contingentName: string;
  subCamp: string;
  tentNumber: string;
  photoUrl: string;
  status: ParticipantStatus;
  checkedIn: boolean;
  checkInTime?: string;
  xp: number;
  level: number;
  rank: number;
  bloodType?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  attendanceCount: number;
  badges: string[];
  home_organization_id?: string;
  membershipNumber?: string;
  email?: string;
  phone?: string;
  schoolPangkalan?: string;
  revisionReason?: string;
  statusHistory?: ParticipantStatusHistoryItem[];
  isPossibleDuplicate?: boolean;
  profile_photo_file_id?: string;
  profile_photo_thumbnail_file_id?: string;
  profile_photo_url?: string;
  profile_photo_thumbnail_url?: string;
  profile_photo_status?: ProfilePhotoStatus;
  photo_rejection_reason?: string;
}

export interface Contingent {
  id: string;
  workspaceId?: string;
  workspace_id?: string;
  contingent_id?: string;
  name: string;
  contingent_name?: string;
  region: string;
  leaderName: string;
  leader?: string;
  leaderPhone: string;
  contact?: string;
  quota?: number;
  participantCount: number;
  participant_count?: number;
  maleCount: number;
  femaleCount: number;
  advisorCount: number;
  verifiedCount: number;
  checkedInCount: number;
  campZone: string;
  subCamp?: string;
  campsite_assignment?: string;
  verification_status?: string;
  totalXp: number;
  organization_id?: string;
  contingent_level?: OrganizationLevel;
}

export interface ScheduleItem {
  id: string;
  title: string;
  category: 'ceremony' | 'pioneering' | 'competition' | 'scout_craft' | 'social' | 'night_camp' | string;
  time: string;
  date: string;
  dayNumber: number;
  location: string;
  description: string;
  mandatoryFor: string[];
  xpReward: number;
  status: 'upcoming' | 'ongoing' | 'completed' | string;
  isPublished?: boolean;
  archived?: boolean;
  workspaceId?: string;
  eventId?: string;
  startTime?: string;
  endTime?: string;
  color?: string;
  speaker?: string;
}

export interface Competition {
  id: string;
  workspaceId?: string;
  workspace_id?: string;
  eventId?: string;
  event_id?: string;
  title: string;
  name?: string;
  level?: string;
  /** Existing competition-type name; retained for backward compatibility and judge assignment. */
  category: string;
  /** Parent category stored in metadata_json by GAS; optional for legacy records. */
  categoryGroup?: string;
  /** Participation format stored in metadata_json; optional for legacy records. */
  participantMode?: 'INDIVIDUAL' | 'TEAM' | 'CONTINGENT';
  /** Competition scoring path stored in metadata_json; optional for legacy records. */
  judgingMode?: 'JURY' | 'PUBLIC_VOTE' | 'HYBRID' | 'PARTICIPATION';
  type: 'field' | 'digital';
  scheduleTime: string;
  location: string;
  maxEntriesPerContingent: number;
  registeredEntries: number;
  votingEnabled: boolean;
  juryWeight: number;    // e.g. 80 for 80%
  publicWeight: number;  // e.g. 20 for 20%
  status: 'registration' | 'ongoing' | 'judging' | 'completed' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | string;
}

export interface DigitalWork {
  id: string;
  competitionId: string;
  competitionTitle: string;
  title: string;
  creatorName: string;
  contingentName: string;
  mediaType: 'photo' | 'video' | 'poster';
  thumbnailUrl: string;
  originalUrl: string;
  description: string;
  votesCount: number;
  hasVoted?: boolean;
  submittedAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconName?: string;
  icon?: string;
  rarity?: string;
  category: 'spirit' | 'skill' | 'eco' | 'social' | 'honor' | string;
  unlocked?: boolean;
  unlockedAt?: string;
  xpRequired?: number;
  xpReward?: number;
}

export type PeerAppreciationType = 'Helpful' | 'Friendly' | 'Scout Spirit' | 'Inspiring' | 'Eco Action';

export interface XPTransaction {
  id: string;
  participantId: string;
  participantName: string;
  amount: number;
  reason: string;
  category: 'attendance' | 'competition' | 'peer_appreciation' | 'bonus' | 'activity';
  timestamp: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  contingentName: string;
  avatar: string;
  role: string;
  xp: number;
  level: number;
  isCurrentUser?: boolean;
}

export interface IDCardTemplate {
  id: string;
  name: string;
  backgroundUrl: string;
  width: number;
  height: number;
  fields: {
    photo: { x: number; y: number; width: number; height: number; visible: boolean };
    name: { x: number; y: number; fontSize: number; color: string; visible: boolean };
    code: { x: number; y: number; fontSize: number; color: string; visible: boolean };
    contingent: { x: number; y: number; fontSize: number; color: string; visible: boolean };
    role: { x: number; y: number; fontSize: number; color: string; visible: boolean };
    qr: { x: number; y: number; size: number; visible: boolean };
  };
}

export type CertificateRecipientCategory =
  | 'Peserta'
  | 'Panitia'
  | 'Juara'
  | 'Pemateri'
  | 'Pembina Pendamping';

export interface IssuedCertificate {
  id: string;
  certificateNumber: string;
  recipientName: string;
  contingentName: string;
  eventName: string;
  awardTitle: string;
  role: CertificateRecipientCategory;
  issueDate: string;
  signatoryName: string;
  signatoryRole: string;
  valid: boolean;
  verificationHash: string;
}

export interface HealthIncident {
  id: string;
  participantCode: string;
  participantName: string;
  contingentName: string;
  severity: 'ringan' | 'sedang' | 'darurat';
  type: 'Keletihan' | 'Luka Ringan' | 'Demam' | 'Alergi' | 'Terkilir' | 'Lainnya';
  location: string;
  reportedAt: string;
  reportedBy: string;
  treatment: string;
  status: 'dirawat' | 'pulih' | 'rujuk_rs';
}

export interface OperationalIncident {
  id: string;
  title: string;
  category: 'Barang Hilang / Temuan' | 'Keamanan Buper' | 'Fasilitas & Tenda' | 'Darurat Lingkungan';
  location: string;
  reportedAt: string;
  reportedBy: string;
  severity: 'rendah' | 'sedang' | 'tinggi';
  description: string;
  status: 'terbuka' | 'diproses' | 'selesai';
}

export interface LogisticItem {
  id: string;
  name: string;
  category: 'Tenda & Perlengkapan' | 'Tali & Tongkat' | 'Sound & Kelistrikan' | 'Medis & P3K' | 'Alat Upacara';
  totalStock: number;
  availableStock: number;
  borrowedStock: number;
  unit: string;
  location: string;
}

export interface SyncItem {
  id: string;
  actionType: 'check_in' | 'attendance' | 'xp_grant' | 'vote' | 'peer_appreciation' | 'incident_report' | 'update_event';
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  createdAt: string;
  retryCount: number;
  errorMessage?: string;
  transaction_id?: string;
}

export * from '../offline/types';

export interface LocalCampStatus {
  connected: boolean;
  serverIp: string;
  networkType: 'Local Wi-Fi' | 'Camp LAN';
  cloudSyncAvailable: boolean;
  connectedDevices: number;
  pendingTransactions: number;
  localAttendanceCount: number;
  localPointTransactions: number;
  lastHeartbeat: string;
}

export interface Announcement {
  id: string;
  workspaceId?: string;
  workspace_id?: string;
  eventId?: string;
  event_id?: string;
  title: string;
  category?: string;
  content: string;
  priority: 'urgent' | 'important' | 'info' | 'HIGH' | 'NORMAL' | 'LOW' | string;
  timestamp: string;
  date?: string;
  targetGroup: string;
  authorRole?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  workspace_id?: string;
  event_id?: string;
  module?: string;
  action: string;
  entity_id?: string;
  old_data?: any;
  new_data?: any;
  timestamp: string;
  actorName?: string;
  actorRole?: string;
  user?: string;
  details?: string;
  target?: string;
  oldValue?: string;
  newValue?: string;
  status?: 'success' | 'warning' | 'error';
}

// ==================== EVENT MANAGEMENT STUDIO TYPES ====================

export type FacilityCategory =
  | 'toilet'
  | 'bath'
  | 'health'
  | 'kitchen'
  | 'campfire'
  | 'competition'
  | 'info'
  | 'prayer'
  | 'parking'
  | 'security'
  | 'water'
  | 'other';

export interface CampFacility {
  id: string;
  name: string;
  category: FacilityCategory;
  description: string;
  location: string;
  openingHours: string;
  status: 'active' | 'maintenance' | 'closed';
  coordinates: { x: number; y: number }; // percentage 0-100 on map canvas
  icon: string;
}

export interface CampsiteLot {
  id: string;
  workspaceId?: string;
  workspace_id?: string;
  subCamp: string;
  subcamp?: string;
  subcampId?: string;
  zone: string;
  block: string;
  lotNumber: string;
  capacity: number;
  currentOccupancy?: number;
  gender: 'male' | 'female' | 'mixed';
  contingentId?: string;
  contingentName?: string;
  status: 'available' | 'occupied' | 'reserved' | 'OCCUPIED' | 'AVAILABLE' | 'RESERVED' | string;
  coordinates: { x: number; y: number };
  notes?: string;
}

export interface CampActivity {
  id: string;
  name?: string;
  title?: string;
  type: string;
  description: string;
  targetGroup: string;
  location: string;
  startTime?: string;
  endTime?: string;
  start_time?: string;
  end_time?: string;
  dayNumber: number;
  attendanceRequired: boolean;
  pointRule: number;
  points_awarded?: number;
  qr_mode?: string;
  capacity: number;
  status: 'active' | 'draft' | 'cancelled' | 'ACTIVE' | 'DRAFT' | 'CANCELLED' | string;
  workspace_id?: string;
  event_id?: string;
  category?: string;
  icon?: string;
  xp_reward?: number;
}

export interface JudgingCriterion {
  id: string;
  name: string;
  weight: number; // percentage (e.g. 30 for 30%)
  maxScore: number;
}

export interface CompetitionJudge {
  id: string;
  name: string;
  email: string;
  phone: string;
  assignedCompetitions: string[];
  categories: string[];
  isLocked: boolean;
}

export interface VotingConfig {
  votingEnabled: boolean;
  votingMode: 'single_choice' | 'multiple_work' | 'quota';
  votingStart: string;
  votingEnd: string;
  maxVotes: number;
  allowSelfVote: boolean;
  showVoteCounter: boolean;
  showLiveRank: boolean;
  votingOpen?: boolean;
}

export interface RegistrationFieldConfig {
  id: string;
  name: string;
  label: string;
  fieldType: 'text' | 'number' | 'select' | 'file';
  options?: string[];
  status: 'required' | 'optional' | 'hidden';
  restricted: boolean;
}

export interface PointRuleConfig {
  id: string;
  code?: string;
  name: string;
  xp: number;
  xpAward?: number;
  category: string;
  dailyLimit: number;
  maxDaily?: number;
  enabled: boolean;
  description: string;
}

export interface BadgeConfig {
  id: string;
  name: string;
  icon?: string;
  description: string;
  condition: string;
  xpRequired: number;
  activityRequired?: string;
  status: 'active' | 'draft';
}

export interface QrCheckpoint {
  id: string;
  workspaceId?: string;
  workspace_id?: string;
  eventId?: string;
  event_id?: string;
  name: string;
  location: string;
  rewardXp?: number;
  points?: number;
  scan_limit?: number;
  activeHours: string;
  qrCode: string;
  status: 'active' | 'inactive' | 'ACTIVE' | 'INACTIVE' | string;
  scanCount: number;
}

export interface CustomInfoPage {
  id: string;
  title: string;
  category: 'rules' | 'guidelines' | 'emergency' | 'prayer' | 'faq' | 'facilities' | 'other';
  content: string;
  icon: string;
  published: boolean;
  order: number;
  attachments?: { name: string; url: string; size: string }[];
}

// ==================== UNIFIED QR INFRASTRUCTURE (Req 57, 58) ====================

export type QrTokenPurpose =
  | 'PARTICIPANT'
  | 'ACTIVITY'
  | 'CHECKPOINT'
  | 'VISITOR'
  | 'CERTIFICATE';

export type QrTokenStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'REVOKED';

export interface UnifiedQrToken {
  tokenId: string;
  tokenString: string;
  purpose: QrTokenPurpose;
  workspaceId: string;
  eventId: string;
  entityId: string;
  version: number;
  status: QrTokenStatus;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  metadata?: Record<string, any>;
}

export interface ResolvedQrToken {
  isValid: boolean;
  errorCode?:
    | 'NOT_FOUND'
    | 'INACTIVE'
    | 'EXPIRED'
    | 'REVOKED'
    | 'WRONG_EVENT'
    | 'WRONG_WORKSPACE'
    | 'MALFORMED';
  errorMessage?: string;
  purpose?: QrTokenPurpose;
  token?: UnifiedQrToken;
  resolvedData?: any;
}

// ==================== ACTIVITY / AGENDA QR SYSTEM (Req 1-20) ====================

export type ActivityQrMode =
  | 'ATTENDANCE'
  | 'CHECK_IN'
  | 'CHECKPOINT'
  | 'PARTICIPATION'
  | 'CHALLENGE';

export interface ActivityCheckpointItem {
  checkpointId: string;
  name: string;
  orderIndex: number;
  location: string;
  rewardXp: number;
  qrToken: string;
  hint?: string;
}

export interface ActivityQrConfig {
  id: string;
  activityId: string;
  scheduleId?: string;
  title: string;
  category: string;
  location: string;
  mode: ActivityQrMode;
  enabled: boolean;
  qrToken: string;
  pointRuleId: string;
  rewardXp: number;
  scanOpens: string;      // e.g. "07:45"
  scanCloses: string;     // e.g. "10:15"
  isMultiCheckpoint: boolean;
  checkpointOrder: 'ordered' | 'unordered';
  checkpoints?: ActivityCheckpointItem[];
  maxScansPerParticipant: number;
  totalScanCount: number;
  uniqueParticipantCount: number;
  createdAt: string;
  tokenRotatedAt?: string;
  tokenRotatedBy?: string;
  rotationReason?: string;
}

export interface ActivityScanRecord {
  scanId: string;
  activityId: string;
  scheduleId?: string;
  checkpointId?: string;
  participantId: string;
  participantCode: string;
  participantName: string;
  contingentName: string;
  mode: ActivityQrMode;
  scannedAt: string;
  status: 'SUCCESS' | 'DUPLICATE' | 'OUTSIDE_WINDOW' | 'INELIGIBLE' | 'CHECKPOINT_OUT_OF_ORDER';
  xpAwarded: number;
  transactionId?: string;
  attendanceRecorded: boolean;
  notes?: string;
}

// ==================== VISITOR / CAMP GUEST MANAGEMENT (Req 21-56) ====================

export type VisitorCategory =
  | 'Orang Tua / Wali'
  | 'Keluarga'
  | 'Tamu Undangan'
  | 'Umum'
  | 'Alumni'
  | 'Mabiran'
  | 'Mabigus'
  | 'Mitra'
  | 'Media'
  | 'VIP'
  | 'VVIP'
  | 'Lainnya';

export type VisitorStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REGISTERED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REVOKED';

export type VisitorApprovalMode = 'AUTO_APPROVED' | 'REQUIRE_APPROVAL' | 'INVITATION_ONLY';

export type VisitorAccessZone =
  | 'PUBLIC_AREA'
  | 'VISITOR_AREA'
  | 'PARTICIPANT_CAMP'
  | 'MAIN_STAGE'
  | 'EXHIBITION'
  | 'VIP_AREA'
  | 'RESTRICTED';

export interface PersonBeingVisited {
  type: 'participant' | 'committee' | 'official' | 'unit' | 'contingent';
  targetId?: string;
  targetName: string;
  targetDetail?: string; // e.g. "Kontingen - Regu"
}

export interface VisitorRegistration {
  id: string;
  registrationCode: string; // e.g. "VIS-8492"
  name: string;
  phone: string;
  category: VisitorCategory;
  identityType: 'KTP' | 'SIM' | 'Kartu Pegawai' | 'Paspor' | 'Lainnya';
  identityNumber?: string;
  organization?: string;
  personVisited: PersonBeingVisited;
  relationship: string;
  visitDate: string;
  expectedArrival: string;
  expectedDeparture: string;
  accompanyingPersonsCount: number;
  vehicleInfo?: string;
  purpose: string;
  emergencyContact?: string;
  status: VisitorStatus;
  rejectionReason?: string;
  revokedReason?: string;
  revokedBy?: string;
  approvalMode: VisitorApprovalMode;
  approvedBy?: string;
  approvedAt?: string;
  qrToken: string;
  entryType: 'SINGLE_ENTRY' | 'MULTIPLE_ENTRY';
  allowedZones: VisitorAccessZone[];
  createdAt: string;
  currentVisitSession?: {
    visitLogId: string;
    gateId: string;
    gateName: string;
    checkinAt: string;
  };
}

export interface VisitorGate {
  id: string;
  eventId: string;
  gateName: string; // e.g. "Gate Utama", "Gate Barat", "VIP Gate"
  location: string;
  allowedCategories: VisitorCategory[];
  operatingHours: string; // e.g. "08:00 - 17:00"
  status: 'active' | 'inactive';
}

export interface VisitorVisitLog {
  visitLogId: string;
  visitorId: string;
  visitorName: string;
  visitorCategory: VisitorCategory;
  registrationCode: string;
  eventId: string;
  gateId: string;
  gateName: string;
  checkinAt: string;
  checkoutAt?: string;
  verifiedBy: string;
  deviceId: string;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | 'OVERDUE';
}

export interface VisitingHoursDay {
  dayName: string;
  openTime: string;
  closeTime: string;
  enabled: boolean;
}

export interface VisitorRulesConfig {
  visitingHours: VisitingHoursDay[];
  dailyQuota: number;
  approvalMode: VisitorApprovalMode;
  entryTypeDefault: 'SINGLE_ENTRY' | 'MULTIPLE_ENTRY';
  allowedZonesDefault: VisitorAccessZone[];
  rulesAndGuidelines: string[];
  prohibitedItems: string[];
  parkingInfo: string;
  emergencyContact: string;
}

// ==================== PUBLIC CONTENT, DOCUMENTATION & SPONSOR MEDIA (Req 1-69) ====================

export type MediaSourceType =
  | 'GOOGLE_DRIVE_FOLDER'
  | 'GOOGLE_DRIVE_FILE'
  | 'YOUTUBE'
  | 'PUBLIC_IMAGE_URL'
  | 'PUBLIC_VIDEO_URL';

export type MediaProviderType = 'GOOGLE_DRIVE' | 'YOUTUBE' | 'DIRECT_URL' | 'EXTERNAL';

export type MediaAccessStatus =
  | 'CHECKING'
  | 'ACCESSIBLE'
  | 'PRIVATE'
  | 'INVALID_URL'
  | 'NOT_FOUND'
  | 'UNSUPPORTED'
  | 'BROKEN_SOURCE';

export type MediaType = 'PHOTO' | 'VIDEO';

export type MediaPublicationStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export type DownloadControlMode = 'VIEW_ONLY' | 'ALLOW_ORIGINAL_LINK';

export interface MediaResolvedResult {
  isValid: boolean;
  provider: MediaProviderType;
  sourceType: MediaSourceType;
  accessStatus: MediaAccessStatus;
  providerResourceId?: string;
  thumbnailUrl: string;
  previewUrl?: string;
  embedUrl?: string;
  canEmbed: boolean;
  title?: string;
  duration?: string;
  errorMessage?: string;
  originalUrl: string;
}

export interface MediaItem {
  media_id: string;
  workspace_id: string;
  event_id: string;
  album_id?: string;
  media_type: MediaType;
  provider: MediaProviderType;
  source_type: MediaSourceType;
  source_url: string;
  source_page_url?: string;
  provider_resource_id?: string;
  thumbnail_url: string;
  original_url?: string;
  title: string;
  caption?: string;
  event_date: string;
  display_order: number;
  publication_status: MediaPublicationStatus;
  metadata_status: MediaAccessStatus;
  download_control: DownloadControlMode;
  duration?: string;
  can_embed?: boolean;
  embed_url?: string;
  views_count?: number;
  plays_count?: number;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

export interface PhotoAlbum {
  album_id: string;
  workspace_id: string;
  event_id: string;
  album_name: string;
  description?: string;
  cover_media_id?: string;
  cover_image_url?: string;
  source_folder_url?: string;
  folder_access_status?: MediaAccessStatus;
  photo_count: number;
  display_order: number;
  publication_status: MediaPublicationStatus;
  created_at: string;
  updated_at?: string;
}

export type BannerType =
  | 'HERO'
  | 'SPONSOR'
  | 'INFORMATION'
  | 'PARTNER'
  | 'PROMOTION'
  | 'PUBLIC_SERVICE'
  | 'CUSTOM';

export type BannerPreset =
  | 'LEADERBOARD' // 728 × 90
  | 'LARGE_LEADERBOARD' // 970 × 90
  | 'BILLBOARD' // 970 × 250
  | 'MEDIUM_RECTANGLE' // 300 × 250
  | 'LARGE_RECTANGLE' // 336 × 280
  | 'HALF_PAGE' // 300 × 600
  | 'MOBILE_BANNER' // 320 × 50
  | 'LARGE_MOBILE_BANNER' // 320 × 100
  | 'WIDE_RESPONSIVE' // 16:5
  | 'HERO_WIDE' // 16:6
  | 'HERO_CINEMATIC'; // 16:9

export type BannerFitMode = 'COVER' | 'CONTAIN' | 'AUTO';

export type BannerTargetType = 'NONE' | 'INTERNAL_ROUTE' | 'EXTERNAL_URL';

export type BannerDisplayLocation =
  | 'PUBLIC_HOME_TOP'
  | 'PUBLIC_HOME_MIDDLE'
  | 'PUBLIC_HOME_BOTTOM'
  | 'GALLERY_TOP'
  | 'VISITOR_PAGE'
  | 'SCHEDULE_PAGE'
  | 'COMPETITION_PAGE'
  | 'CUSTOM';

export type BannerPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';

export interface BannerItem {
  banner_id: string;
  workspace_id: string;
  event_id: string;
  banner_type: BannerType;
  title: string;
  subtitle?: string;
  image_url: string;
  source_type: MediaSourceType;
  source_reference?: string;
  desktop_preset: BannerPreset;
  mobile_preset: BannerPreset;
  mobile_image_url?: string;
  fit_mode: BannerFitMode;
  focal_x: number; // 0-100 percentage
  focal_y: number; // 0-100 percentage
  target_type: BannerTargetType;
  target_url?: string;
  cta_label?: string;
  display_location: BannerDisplayLocation;
  display_order: number;
  priority: BannerPriority;
  publish_start?: string;
  publish_end?: string;
  publication_status: MediaPublicationStatus;
  click_tracking_enabled: boolean;
  impressions_count: number;
  clicks_count: number;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

export type SponsorTier =
  | 'PLATINUM'
  | 'GOLD'
  | 'SILVER'
  | 'BRONZE'
  | 'PARTNER'
  | 'SUPPORTER'
  | 'CUSTOM';

export interface SponsorItem {
  sponsor_id: string;
  workspace_id: string;
  event_id: string;
  sponsor_name?: string; // Optional for backward compatibility, not rendered publicly
  sponsor_tier?: SponsorTier; // Optional for backward compatibility, not rendered publicly
  logo_url: string;
  target_url?: string;
  website_url?: string; // Alias for target_url
  banner_id?: string;
  display_order: number;
  status?: 'ACTIVE' | 'INACTIVE';
  publication_status: MediaPublicationStatus;
  start_date?: string;
  end_date?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface SponsorCarouselConfig {
  enabled: boolean;
  direction: 'RIGHT_TO_LEFT' | 'LEFT_TO_RIGHT';
  carousel_duration_seconds: number; // Suggested presets: FAST = 15, NORMAL = 30, SLOW = 60
  pauseOnHover: boolean;
  pauseOnTouch: boolean;
}

export interface BannerRotatorConfig {
  mode: 'STATIC' | 'CAROUSEL' | 'AUTO_ROTATE';
  rotationIntervalSeconds: number;
  showNavigationDots: boolean;
  enableMobileSwipe: boolean;
  pauseOnHover: boolean;
}

// ==================== CANONICAL SYSTEM FEATURE REGISTRY (Section 24) ====================
export type SystemFeatureKey =
  | 'REGISTRATION'
  | 'PARTICIPANT_MANAGEMENT'
  | 'PARTICIPANT_VERIFICATION'
  | 'CONTINGENT_MANAGEMENT'
  | 'CHECK_IN'
  | 'ATTENDANCE'
  | 'SCHEDULE'
  | 'ACTIVITY_MANAGEMENT'
  | 'ACTIVITY_QR'
  | 'QR_CHECKPOINT'
  | 'CAMPSITE'
  | 'COMPETITION'
  | 'JUDGING'
  | 'DIGITAL_SUBMISSION'
  | 'COMPETITION_GALLERY'
  | 'VOTING'
  | 'POINTS_XP'
  | 'BADGES'
  | 'PARTICIPANT_LEADERBOARD'
  | 'CONTINGENT_LEADERBOARD'
  | 'VISITOR_MANAGEMENT'
  | 'VISITOR_REGISTRATION'
  | 'VISITOR_GATE'
  | 'PUBLIC_EVENT_PAGE'
  | 'PHOTO_DOCUMENTATION'
  | 'VIDEO_DOCUMENTATION'
  | 'PUBLIC_DOCUMENTATION'
  | 'HERO_BANNER'
  | 'INFORMATION_BANNER'
  | 'SPONSOR_DISPLAY'
  | 'ANNOUNCEMENTS'
  | 'PUBLIC_CONTACTS'
  | 'ID_CARD'
  | 'CERTIFICATE'
  | 'CERTIFICATE_VERIFICATION'
  | 'DOCUMENT_TEMPLATE_STUDIO'
  | 'HEALTH'
  | 'INCIDENT'
  | 'LOGISTICS'
  | 'BACKUP'
  | 'SYSTEM_HEALTH'
  | 'AUDIT'
  | 'SYNC';

export type FeatureScope = 'SYSTEM' | 'WORKSPACE' | 'EVENT';

export interface FeatureDefinition {
  key: SystemFeatureKey;
  name: string;
  category:
    | 'Registrasi & Kontingen'
    | 'Kegiatan & Jadwal'
    | 'Lomba & Penjurian'
    | 'Poin & Prestasi'
    | 'Kunjungan & Tamu'
    | 'Publikasi & Media'
    | 'Fasilitas & Penunjang'
    | 'Sistem & Operasional';
  icon: string;
  description: string;
  dependencies: SystemFeatureKey[];
  defaultEnabled: boolean;
}

// ==================== DOCUMENT TEMPLATE STUDIO CANONICAL SCHEMA (Requirements 123-200) ====================

export type DocumentType =
  | 'ID_CARD_PARTICIPANT'
  | 'ID_CARD_COMMITTEE'
  | 'ID_CARD_OFFICIAL'
  | 'ID_CARD_JUDGE'
  | 'ID_CARD_VISITOR'
  | 'CERTIFICATE_PARTICIPANT'
  | 'CERTIFICATE_COMMITTEE'
  | 'CERTIFICATE_JUDGE'
  | 'CERTIFICATE_WINNER'
  | 'CERTIFICATE_SPEAKER'
  | 'CERTIFICATE_VOLUNTEER'
  | 'PIAGAM_PENGHARGAAN'
  | 'SURAT_TUGAS'
  | 'BADGE_CARD'
  | 'CUSTOM_DOCUMENT';

export type PageSize = 'CR80' | 'A6' | 'A5' | 'A4' | 'CUSTOM';
export type PageOrientation = 'PORTRAIT' | 'LANDSCAPE';
export type BackgroundBehavior = 'cover' | 'contain' | 'stretch' | 'original';

export type DocumentElementType =
  | 'TEXT'
  | 'DYNAMIC_TEXT'
  | 'STATIC_TEXT'
  | 'PHOTO'
  | 'QR_CODE'
  | 'LOGO'
  | 'IMAGE'
  | 'SIGNATURE_IMAGE'
  | 'STAMP_IMAGE'
  | 'SIGNATORY_BLOCK'
  | 'LINE'
  | 'BOX'
  | 'SHAPE'
  | 'DATE'
  | 'DOCUMENT_NUMBER';

export type DynamicFieldSource =
  | 'participant.full_name'
  | 'participant.participant_number'
  | 'participant.nta'
  | 'participant.photo'
  | 'participant.gender'
  | 'participant.role'
  | 'participant.contingent'
  | 'participant.subcamp'
  | 'contingent.name'
  | 'organization.name'
  | 'organization.code'
  | 'event.name'
  | 'event.short_name'
  | 'event.location'
  | 'event.start_date'
  | 'event.end_date'
  | 'event.year'
  | 'event.theme'
  | 'document.number'
  | 'document.issue_date'
  | 'document.role'
  | 'document.award_title'
  | 'document.verification_url'
  | 'signatory.1.name'
  | 'signatory.1.title'
  | 'signatory.2.name'
  | 'signatory.2.title'
  | 'custom';

export type QrCodeType =
  | 'PARTICIPANT_QR'
  | 'CERTIFICATE_VERIFY'
  | 'VISITOR_QR'
  | 'CUSTOM_VERIFY';

export interface ElementCondition {
  field?: string;
  operator?: 'equals' | 'not_equals' | 'exists' | 'not_empty';
  value?: any;
}

export interface TemplateElement {
  id: string;
  name: string;
  page: 'FRONT' | 'BACK';
  type: DocumentElementType;
  x: number; // percentage (0-100) or normalized document units
  y: number; // percentage (0-100)
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
  rotation: number; // degrees 0-360
  zIndex: number;
  
  // Data binding
  dataSource?: DynamicFieldSource | string;
  staticValue?: string;
  fallbackValue?: string;
  templateString?: string; // e.g. "Sebagai {{document.role}} dalam {{event.name}}"

  // Typography
  fontFamily?: string;
  fontSize?: number; // pt or px
  fontWeight?: 'normal' | 'bold' | '600' | '800';
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  italic?: boolean;
  underline?: boolean;

  // Media / Photo / Logo / QR specific
  photoCrop?: 'square' | 'circle' | 'rounded' | 'original';
  qrType?: QrCodeType;
  customUrl?: string;
  imageUrl?: string;
  logoType?: 'installation' | 'workspace' | 'event' | 'custom';
  
  // Signatory & Stamp specific
  signatoryId?: string; // Reference to Signatory
  signatoryRole?: 'CHAIRPERSON' | 'COMMITTEE_HEAD' | 'OFFICIAL' | 'CUSTOM';
  showSignatureImage?: boolean;
  showSignatoryName?: boolean;
  showSignatoryTitle?: boolean;
  showSignatoryOrganization?: boolean;
  showStamp?: boolean;

  // Visual Styling
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  backgroundColor?: string;
  opacity?: number;

  // Control state
  visible: boolean;
  locked: boolean;
  condition?: ElementCondition;
}

export interface DocumentTemplate {
  id: string;
  workspaceId: string;
  eventId?: string;
  name: string;
  documentType: DocumentType;
  pageSize: PageSize;
  orientation: PageOrientation;
  widthMm: number;
  heightMm: number;
  unit: 'mm' | 'cm' | 'px' | 'inch';
  
  // Front page
  backgroundUrl: string;
  backgroundFileId?: string;
  backgroundBehavior: BackgroundBehavior;
  
  // Back page (ID Card two-sided support)
  hasBackPage?: boolean;
  backBackgroundUrl?: string;
  backBackgroundFileId?: string;
  backBackgroundBehavior?: BackgroundBehavior;

  // Layout elements
  elements: TemplateElement[];

  // Document Numbering Rule
  numberingRule?: DocumentNumberRule;

  // Print Guidelines
  safeMarginMm?: number;
  bleedMm?: number;
  showCropMarks?: boolean;

  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface DocumentNumberRule {
  id: string;
  prefix: string; // e.g. "PIAGAM", "CERT", "ID"
  eventCodePattern?: string; // e.g. "EVENT"
  includeYear: boolean;
  separator: '/' | '-' | '.';
  sequenceLength: number; // e.g. 4 -> 0001
  currentSequence: number;
}

export interface Signatory {
  id: string;
  workspaceId: string;
  eventId?: string;
  fullName: string;
  positionTitle: string;
  organizationName: string;
  nta?: string;
  signatureUrl: string;
  signatureFileId?: string;
  stampUrl?: string;
  stampFileId?: string;
  roleType?: 'CHAIRPERSON' | 'COMMITTEE_HEAD' | 'OFFICIAL' | 'CUSTOM';
  status: 'ACTIVE' | 'INACTIVE';
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedDocumentSnapshot {
  id: string;
  documentNumber: string;
  verificationToken: string;
  templateId: string;
  templateVersion: number;
  documentType: DocumentType;
  recipientId: string;
  recipientName: string;
  recipientCategory: string;
  contingentName?: string;
  eventId: string;
  eventName: string;
  issueDate: string;
  outputFileUrl: string;
  outputFileId?: string;
  outputDrivePath: string;
  generatedBy: string;
  generatedAt: string;
  signatoriesSnapshot: {
    fullName: string;
    positionTitle: string;
    organizationName: string;
  }[];
  isValid: boolean;
}

export interface DocumentGenerationBatch {
  id: string;
  title: string;
  documentType: DocumentType;
  templateId: string;
  targetCount: number;
  processedCount: number;
  failedCount: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  createdAt: string;
  completedAt?: string;
  outputDriveFolder: string;
  errorLog?: string[];
}


