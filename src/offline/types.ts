/**
 * @license
 * SiEpang - Offline, Synchronization & Operational Integrity Types
 */

import { UserRole } from '../types';
export type { UserRole };

export type SyncStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED'
  | 'CONFLICT'
  | 'REJECTED';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export type NetworkConnectionState = 'online' | 'offline' | 'reconnecting' | 'syncing' | 'sync_error';

export type ThreeTierSyncState = 'DEVICE_ONLY' | 'EDGE_ACCEPTED' | 'CLOUD_ACCEPTED';

export type JudgeScoreStatus = 'DRAFT_LOCAL' | 'EDGE_SAVED' | 'CLOUD_SAVED' | 'LOCKED';

export interface OfflineTransaction {
  transaction_id: string; // Pre-generated UUID
  workspace_id: string;
  event_id: string;
  device_id: string;
  user_id: string;
  entity: string; // 'attendance' | 'check_in' | 'points' | 'votes' | 'checkpoint' | 'scoring' | 'logistics' | 'schedule' | 'campsite' | 'event'
  action: string; // 'CREATE' | 'UPDATE' | 'DELETE' | 'SCAN' | 'VOTE' | 'SCORE'
  record_id: string;
  payload: any;
  client_created_at: string;
  edge_received_at?: string;
  cloud_received_at?: string;
  three_tier_state?: ThreeTierSyncState;
  sync_status: SyncStatus;
  retry_count: number;
  last_error?: string;
  expected_version?: number;
  server_version?: number;
  result_code?: string; // 'ALREADY_PROCESSED' | 'ACCEPTED' | 'VERSION_CONFLICT' | 'VOTE_QUOTA_EXCEEDED' | etc.
}

export interface BatchSyncResult {
  transaction_id: string;
  status: 'accepted' | 'duplicate' | 'rejected' | 'conflict' | 'failed';
  resultCode: string;
  message?: string;
  data?: any;
  server_version?: number;
}

export interface RegisteredDevice {
  device_id: string;
  workspace_id: string;
  user_id: string;
  device_name: string;
  device_type: DeviceType;
  registration_timestamp: string;
  last_seen: string;
  last_sync: string;
  last_sync_version: number;
  pending_transaction_count: number;
  status: 'active' | 'revoked';
}

export interface ChangeLogEntry {
  change_id: string;
  sync_version: number;
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  record_id: string;
  data?: any;
  timestamp: string;
}

export interface IncrementalPullResult {
  current_sync_version: number;
  changes: ChangeLogEntry[];
  has_more: boolean;
}

export interface RoleScopedSnapshot {
  role: UserRole;
  sync_version: number;
  generated_at: string;
  scope_description: string;
  participants?: any[];
  schedules?: any[];
  activities?: any[];
  announcements?: any[];
  badges?: any[];
  campsiteLots?: any[];
  healthData?: any[];
  competitions?: any[];
}

export type StandardErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'WORKSPACE_FORBIDDEN'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'RECORD_NOT_FOUND'
  | 'RECORD_ALREADY_EXISTS'
  | 'VERSION_CONFLICT'
  | 'VOTE_QUOTA_EXCEEDED'
  | 'POINT_LIMIT_EXCEEDED'
  | 'SCORE_LOCKED'
  | 'SYNC_CONFLICT'
  | 'DEVICE_REVOKED';

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: StandardErrorCode | string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    syncVersion?: number;
    idempotency?: string;
  };
}

export type ApiResponse<T = any> = StandardApiResponse<T>;

export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ScheduleConflict {
  id: string;
  type: 'participant_group' | 'venue' | 'judge' | 'officer';
  scheduleAId: string;
  scheduleATitle: string;
  scheduleBId: string;
  scheduleBTitle: string;
  conflictDetail: string;
  timeSlot: string;
  dayNumber: number;
  location?: string;
  severity: 'warning' | 'blocking';
  isOverridden?: boolean;
}

export interface CampsiteCapacityReport {
  totalCapacity: number;
  totalAssigned: number;
  remainingCapacity: number;
  isOverflow: boolean;
  overflowCount: number;
  contingentsWithoutCampsite: { id: string; name: string; count: number }[];
  subcampReports: {
    subcampName: string;
    capacity: number;
    assigned: number;
    remaining: number;
    isOverflow: boolean;
  }[];
}

export interface CompetitionReadiness {
  competitionId: string;
  competitionTitle: string;
  isReady: boolean;
  completionPercentage: number;
  checks: {
    identity: boolean;
    participantMode: boolean;
    criteriaValid: boolean;
    totalWeight: number; // must be 100
    judgesAssigned: boolean;
    judgeCount: number;
    scheduleAndVenue: boolean;
    votingConfigValid: boolean;
  };
  issues: string[];
}

export interface EventReadinessReport {
  scorePercentage: number;
  calculatedAt: string;
  status: 'optimal' | 'ready_with_warnings' | 'needs_attention';
  sections: {
    identity: { ready: boolean; summary: string };
    registration: { ready: boolean; summary: string };
    schedule: { ready: boolean; summary: string; conflictCount: number };
    campsite: { ready: boolean; summary: string; unassignedCount: number; overflowCount: number };
    activities?: { ready: boolean; summary: string };
    competitions: { ready: boolean; summary: string; incompleteCount: number };
    certificates?: { ready: boolean; summary: string };
    contacts: { ready: boolean; summary: string };
    features: { ready: boolean; summary: string; dependencyWarnings: string[] };
  };
  actionableWarnings: {
    id: string;
    title: string;
    message: string;
    severity: 'warning' | 'error';
    targetTab: string;
  }[];
}

// ==================== LOCAL CAMP SERVER & EDGE ARCHITECTURE ====================

export type LocalServerOperationalMode = 'cloud' | 'local' | 'hybrid';

export interface LocalServerConfig {
  mode: LocalServerOperationalMode;
  serverUrl: string; // e.g. 'http://192.168.10.1:8080'
  lanSsid: string; // e.g. 'SIEPANG_CAMP_OFFICER_WIFI'
  edgeNodeId: string; // e.g. 'EDGE-NODE-01'
  secretKey: string;
  autoSyncIntervalSeconds: number;
}

export interface LocalServerHealth {
  connected: boolean;
  latencyMs: number;
  status: 'online' | 'degraded' | 'offline';
  uptimeSeconds: number;
  edgeNodeId: string;
  databaseType: 'SQLite (Camp Edge DB)' | 'In-Memory Edge Store';
  databaseSizeBytes: number;
  connectedDevicesCount: number;
  localPendingUpstreamCount: number;
  localSyncedUpstreamCount: number;
  localConflictCount: number;
  lastUpstreamPush: string;
  lastDownstreamPull: string;
  lastHeartbeat: string;
  syncWorkerState: 'idle' | 'pushing' | 'pulling' | 'error';
}

export type BundleValidationStatus =
  | 'VALID'
  | 'EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'WRONG_WORKSPACE'
  | 'WRONG_EVENT'
  | 'UNSUPPORTED_VERSION'
  | 'ALREADY_IMPORTED'
  | 'QUARANTINED';

export interface SneakernetSyncBundle {
  bundle_id: string; // e.g. BND-BWI-2026-0012
  bundle_version: string; // e.g. "1.1"
  workspace_id: string;
  event_id: string;
  source_server_id: string;
  source_device_id?: string;
  created_at: string;
  expires_at: string; // Shorter validity for air-gapped bundles (e.g. 48h)
  from_sync_version: number;
  to_sync_version: number;
  transaction_count: number;
  payload_hash: string; // SHA-256 of canonical JSON
  signature_algorithm: 'HMAC-SHA256' | 'ED25519-SIM';
  signature: string;
  key_id: string;
  transactions: OfflineTransaction[];

  // Backward compatibility alias properties
  bundleId?: string;
  edgeNodeId?: string;
  workspaceId?: string;
  eventId?: string;
  exportedAt?: string;
  exportSyncVersion?: number;
  checksum?: string;
  totalRecords?: number;
}

export interface BundleImportRecord {
  bundle_id: string;
  source: string;
  imported_at: string;
  imported_by: string;
  result: BundleValidationStatus;
  accepted_count: number;
  duplicate_count: number;
  conflict_count: number;
  rejected_count: number;
  notes?: string;
}

export interface OfflineCredential {
  credential_id: string;
  user_id: string;
  user_name: string;
  workspace_id: string;
  event_id: string;
  device_id: string;
  role_id: UserRole;
  permission_snapshot_version: number;
  permission_snapshot: string[];
  credential_hash: string; // Salted SHA-256 / PBKDF2 hash
  salt: string;
  issued_at: string;
  expires_at: string;
  max_attempts: number; // e.g. 5 attempts
  failed_attempts: number;
  locked_until: string | null;
  status: 'active' | 'revoked' | 'locked' | 'expired';
}

export interface OfflineEmergencySession {
  token: string;
  user_id: string;
  user_name: string;
  device_id: string;
  workspace_id: string;
  event_id: string;
  role_id: UserRole;
  permission_snapshot: string[];
  issued_at: string;
  expires_at: string;
  authentication_mode: 'OFFLINE_EMERGENCY';
}

export interface LocalAuthSession {
  token: string;
  userId: string;
  userName: string;
  role: UserRole;
  expiresAt: string;
  issuedByEdgeNode: string;
  isEmergencySession: boolean;
  authentication_mode?: 'OFFLINE_EMERGENCY';
  deviceId?: string;
}

export interface EdgeAcknowledgement {
  transaction_id: string;
  edge_server_id: string;
  accepted_at: string;
  local_sequence: number;
  status: 'accepted' | 'duplicate' | 'rejected' | 'conflict';
  data_state: 'EDGE_ACCEPTED';
}

export interface AuthorizedEdgeServer {
  edge_server_id: string;
  workspace_id: string;
  event_id: string;
  server_name: string;
  device_fingerprint: string;
  created_at: string;
  last_seen: string;
  software_version: string;
  schema_version: string;
  status: 'ACTIVE' | 'REVOKED' | 'MAINTENANCE' | 'EXPIRED';
}

export interface DatastoreIntegrityReport {
  status: 'healthy' | 'warning' | 'critical';
  sqliteIntegrity: boolean;
  schemaVersionMatch: boolean;
  requiredTablesPresent: boolean;
  diskStorageState: 'healthy' | 'low' | 'critical';
  diskUsageBytes: number;
  diskAvailableBytes: number;
  diskPercentageUsed: number;
  queueConsistency: boolean;
  orphanTransactionCount: number;
  lastIntegrityCheck: string;
}

export interface DatastoreBackupRecord {
  backup_id: string;
  created_at: string;
  size_bytes: number;
  type: 'sqlite' | 'config' | 'full';
  item_count: number;
  hash: string;
  filename: string;
}

export interface SecurityEventRecord {
  id: string;
  timestamp: string;
  event_type:
    | 'failed_pin_attempt'
    | 'credential_locked'
    | 'revoked_device_attempt'
    | 'invalid_usb_bundle'
    | 'signature_failure'
    | 'revoked_edge_server_attempt'
    | 'credential_issued'
    | 'credential_revoked'
    | 'privileged_override'
    | 'bundle_replay_blocked';
  severity: 'info' | 'warning' | 'critical';
  details: string;
  actor_id: string;
  device_id: string;
  workspace_id: string;
  synced_to_cloud: boolean;
}

export interface ProductionConfig {
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'LOCAL_CAMP';
  flags: {
    enableTestQrPresets: boolean;
    allowDemoData: boolean;
    verboseErrorDetails: boolean;
    allowUnsafeLocalDevelopment: boolean;
  };
  versions: {
    frontendVersion: string;
    cloudApiVersion: string;
    schemaVersion: string;
    serverBuperVersion: string;
    localDbSchemaVersion: string;
  };
  domain: {
    hostname: string;
    resolvedWorkspaceId: string;
    tlsEnforced: boolean;
    isCustomDomain: boolean;
  };
}

export type ProductionReadinessCategory =
  | 'Security'
  | 'Authentication'
  | 'RBAC'
  | 'Workspace Isolation'
  | 'Database'
  | 'Offline Sync'
  | 'Server Buper'
  | 'Air-Gapped Sync'
  | 'Backup'
  | 'Custom Domain'
  | 'API Version'
  | 'Schema Version'
  | 'Emergency Contacts'
  | 'Device Registry';

export interface ProductionReadinessCheck {
  id: string;
  category: ProductionReadinessCategory;
  title: string;
  status: 'READY' | 'WARNING' | 'CRITICAL';
  description: string;
  recommendation: string;
}


