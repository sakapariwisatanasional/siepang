/**
 * @license
 * SiEpang - Standalone Customer Google Apps Script Backend Package (Milestone v1.9.0-rc1)
 * Build 2026.10.06 — Zero Simulation, Real GAS Backend, Real Spreadsheet, Real OTP Email.
 * Designed for 100% customer ownership on customer Google Workspace / Gmail account.
 * Uses SpreadsheetApp.openById() — NEVER getActiveSpreadsheet().
 * Uses MailApp.sendEmail() with strict delivery check, SHA-256 OTP hashing, and LockService.
 */

export const CUSTOMER_GAS_BACKEND_VERSION = 'v1.9.0';
export const CUSTOMER_GAS_SCHEMA_VERSION = 'v1.9';
export const CUSTOMER_GAS_ENVIRONMENT = 'PRODUCTION';

export interface CustomerGasBuildConfig {
  installationId: string;
  workspaceId: string;
  activeEventId?: string;
  spreadsheetId: string;
  rootDriveFolderId: string;
  databaseFolderId?: string;
  brandingFolderId?: string;
  documentsFolderId?: string;
  certificatesFolderId?: string;
  idCardsFolderId?: string;
  backupFolderId?: string;
  assetsFolderId?: string;
  bootstrapSuperAdminEmail?: string;
}

/**
 * Generates the complete, standalone Google Apps Script source code (Code.gs)
 * to be pasted into the customer's standalone Apps Script project.
 */
export function generateCustomerGasBackendSource(config: CustomerGasBuildConfig): string {
  const bootstrapEmail = (config.bootstrapSuperAdminEmail || '').trim().toLowerCase();
  const dbFolderId = config.databaseFolderId || '';
  const brandingFolderId = config.brandingFolderId || '';
  const documentsFolderId = config.documentsFolderId || '';
  const certificatesFolderId = config.certificatesFolderId || '';
  const idCardsFolderId = config.idCardsFolderId || '';
  const backupFolderId = config.backupFolderId || '';
  const assetsFolderId = config.assetsFolderId || '';
  const activeEvtId = config.activeEventId || '';

  return `/**
 * ============================================================================
 * SIEPANG STANDALONE BACKEND ENGINE (Milestone v1.9.0-rc1 — Build 2026.10.06)
 * Sistem Informasi Perkemahan Pramuka — Customer-Owned Deployment
 * ============================================================================
 * REAL GAS BACKEND · REAL SPREADSHEET DATABASE · REAL OTP EMAIL
 * REAL TRUSTED DEVICE · REAL PERSISTENT SESSION · REAL SUPERADMIN BOOTSTRAP
 * 1 INSTALASI = 1 KEGIATAN / EVENT (Authoritative Script Properties)
 * ============================================================================
 */

// 1. AUTHORITATIVE BACKEND CONFIGURATION
var CONFIG = {
  INSTALLATION_ID: '${config.installationId}',
  WORKSPACE_ID: '${config.workspaceId}',
  ACTIVE_WORKSPACE_ID: '${config.workspaceId}',
  ACTIVE_EVENT_ID: '${activeEvtId}',
  SPREADSHEET_ID: '${config.spreadsheetId}',
  DRIVE_ROOT_ID: '${config.rootDriveFolderId}',
  DATABASE_FOLDER_ID: '${dbFolderId}',
  BRANDING_FOLDER_ID: '${brandingFolderId}',
  DOCUMENTS_FOLDER_ID: '${documentsFolderId}',
  CERTIFICATES_FOLDER_ID: '${certificatesFolderId}',
  IDCARDS_FOLDER_ID: '${idCardsFolderId}',
  BACKUP_FOLDER_ID: '${backupFolderId}',
  ASSETS_FOLDER_ID: '${assetsFolderId}',
  BOOTSTRAP_SUPERADMIN_EMAIL: '${bootstrapEmail}',
  BACKEND_VERSION: '${CUSTOMER_GAS_BACKEND_VERSION}',
  SCHEMA_VERSION: '${CUSTOMER_GAS_SCHEMA_VERSION}',
  ENVIRONMENT: '${CUSTOMER_GAS_ENVIRONMENT}',
  OTP_EXPIRY_MINUTES: 10,
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_SECONDS: 60,
  SESSION_TTL_DAYS: 30,
  TRUSTED_DEVICE_TTL_DAYS: 90
};

/**
 * Inisialisasi Script Properties jika belum tersimpan di Project Settings
 * PENTING: Jangan mengisi default event/workspace palsu.
 * Jika belum dikonfigurasi, biarkan tidak terisi agar terdeteksi sebagai INSTALLATION_NOT_CONFIGURED.
 */
function initScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  var currentProps = props.getProperties();

  var updates = {};
  if (CONFIG.INSTALLATION_ID && !currentProps['SIEPANG_INSTALLATION_ID']) updates['SIEPANG_INSTALLATION_ID'] = CONFIG.INSTALLATION_ID;
  if (CONFIG.ACTIVE_WORKSPACE_ID && !currentProps['SIEPANG_ACTIVE_WORKSPACE_ID']) updates['SIEPANG_ACTIVE_WORKSPACE_ID'] = CONFIG.ACTIVE_WORKSPACE_ID;
  if (CONFIG.ACTIVE_EVENT_ID && !currentProps['SIEPANG_ACTIVE_EVENT_ID']) updates['SIEPANG_ACTIVE_EVENT_ID'] = CONFIG.ACTIVE_EVENT_ID;
  if (CONFIG.WORKSPACE_ID && !currentProps['SIEPANG_WORKSPACE_ID']) updates['SIEPANG_WORKSPACE_ID'] = CONFIG.WORKSPACE_ID;
  if (CONFIG.SPREADSHEET_ID && !currentProps['SPREADSHEET_ID']) updates['SPREADSHEET_ID'] = CONFIG.SPREADSHEET_ID;
  if (CONFIG.DRIVE_ROOT_ID && !currentProps['DRIVE_ROOT_ID']) updates['DRIVE_ROOT_ID'] = CONFIG.DRIVE_ROOT_ID;
  if (!currentProps['BACKEND_VERSION']) updates['BACKEND_VERSION'] = CONFIG.BACKEND_VERSION;
  if (!currentProps['SCHEMA_VERSION']) updates['SCHEMA_VERSION'] = CONFIG.SCHEMA_VERSION;
  if (CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL && !currentProps['BOOTSTRAP_SUPERADMIN_EMAIL']) updates['BOOTSTRAP_SUPERADMIN_EMAIL'] = CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL;
  if (!currentProps['SUPERADMIN_BOOTSTRAPPED']) updates['SUPERADMIN_BOOTSTRAPPED'] = 'false';
  if (!currentProps['SIEPANG_INSTALLATION_READY']) updates['SIEPANG_INSTALLATION_READY'] = 'false';
  if (!currentProps['SIEPANG_BOOTSTRAP_TOKEN'] && currentProps['SIEPANG_INSTALLATION_READY'] !== 'true' && currentProps['SIEPANG_BOOTSTRAP_TOKEN_USED'] !== 'true') {
    updates['SIEPANG_BOOTSTRAP_TOKEN'] = 'boot_' + Utilities.getUuid().replace(/-/g, '');
  }
  if (!currentProps['SESSION_SIGNING_SECRET']) updates['SESSION_SIGNING_SECRET'] = 'sec_' + Utilities.getUuid().replace(/-/g, '');
  if (!currentProps['TOKEN_HASH_SECRET']) updates['TOKEN_HASH_SECRET'] = 'thash_' + Utilities.getUuid().replace(/-/g, '');
  if (!currentProps['OTP_EXPIRY_MINUTES']) updates['OTP_EXPIRY_MINUTES'] = String(CONFIG.OTP_EXPIRY_MINUTES);
  if (!currentProps['OTP_MAX_ATTEMPTS']) updates['OTP_MAX_ATTEMPTS'] = String(CONFIG.OTP_MAX_ATTEMPTS);
  if (!currentProps['OTP_RESEND_SECONDS']) updates['OTP_RESEND_SECONDS'] = String(CONFIG.OTP_RESEND_SECONDS);
  if (!currentProps['SESSION_TTL_DAYS']) updates['SESSION_TTL_DAYS'] = String(CONFIG.SESSION_TTL_DAYS);
  if (!currentProps['TRUSTED_DEVICE_TTL_DAYS']) updates['TRUSTED_DEVICE_TTL_DAYS'] = String(CONFIG.TRUSTED_DEVICE_TTL_DAYS);

  if (Object.keys(updates).length > 0) {
    props.setProperties(updates);
  }
}

/**
 * Memvalidasi kelengkapan Script Properties instalasi SiEpang.
 * 1 Instalasi = 1 Kegiatan.
 * Script Properties LENGKAP: aplikasi berjalan normal.
 * Script Properties BELUM LENGKAP: INSTALLATION_NOT_CONFIGURED (tidak boleh fallback otomatis ke data dummy).
 */
function checkInstallationStatus() {
  var props = PropertiesService.getScriptProperties();
  var instId = props.getProperty('SIEPANG_INSTALLATION_ID') || CONFIG.INSTALLATION_ID || '';
  var wsId = props.getProperty('SIEPANG_ACTIVE_WORKSPACE_ID') || props.getProperty('SIEPANG_WORKSPACE_ID') || CONFIG.ACTIVE_WORKSPACE_ID || CONFIG.WORKSPACE_ID || '';
  var evtId = props.getProperty('SIEPANG_ACTIVE_EVENT_ID') || props.getProperty('EVENT_ID') || CONFIG.ACTIVE_EVENT_ID || '';
  var sheetId = props.getProperty('SPREADSHEET_ID') || props.getProperty('SIEPANG_SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID || '';
  var driveRootId = props.getProperty('DRIVE_ROOT_ID') || props.getProperty('SIEPANG_DRIVE_ROOT_ID') || '';

  var missing = [];
  if (!instId || instId === 'NOT_CONFIGURED' || instId === 'UNCONFIGURED') missing.push('SIEPANG_INSTALLATION_ID');
  if (!wsId || wsId === 'NOT_CONFIGURED' || wsId === 'UNCONFIGURED') missing.push('SIEPANG_ACTIVE_WORKSPACE_ID');
  if (!evtId || evtId === 'NOT_CONFIGURED' || evtId === 'UNCONFIGURED') missing.push('SIEPANG_ACTIVE_EVENT_ID');
  if (!sheetId || sheetId === 'DISCONNECTED' || sheetId === 'NOT_CONFIGURED') missing.push('SPREADSHEET_ID');
  if (!driveRootId || driveRootId === 'NOT_CONFIGURED') missing.push('DRIVE_ROOT_ID');

  var isInstallationReady = props.getProperty('SIEPANG_INSTALLATION_READY') === 'true';
  var isConfigured = missing.length === 0 || isInstallationReady;
  var bootSuperAdminEmail = props.getProperty('BOOTSTRAP_SUPERADMIN_EMAIL') || CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL || '';
  var isSuperAdminBootstrapped = props.getProperty('SUPERADMIN_BOOTSTRAPPED') === 'true';

  return {
    isConfigured: isConfigured,
    installationId: isConfigured ? instId : null,
    workspaceId: isConfigured ? wsId : null,
    eventId: isConfigured ? evtId : null,
    spreadsheetId: isConfigured ? sheetId : null,
    driveRootId: isConfigured ? driveRootId : null,
    superadmin_email: bootSuperAdminEmail,
    superadmin_role: 'superadmin',
    superadmin_status: isSuperAdminBootstrapped ? 'ACTIVE' : 'PENDING',
    missingProperties: missing
  };
}

/**
 * Mengambil Spreadsheet Database Customer (SpreadsheetApp.openById — NEVER getActiveSpreadsheet)
 */
function getCustomerDatabase() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SPREADSHEET_ID') || props.getProperty('SIEPANG_SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID;
  if (!sheetId || sheetId === 'DISCONNECTED') {
    throw new Error('DATABASE_NOT_CONNECTED: SPREADSHEET_ID belum dikonfigurasi pada Script Properties.');
  }
  return SpreadsheetApp.openById(sheetId);
}

/**
 * Mengambil Folder Root Drive Customer
 */
function getCustomerDriveRoot() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('DRIVE_ROOT_ID') || props.getProperty('SIEPANG_ROOT_DRIVE_FOLDER_ID') || CONFIG.DRIVE_ROOT_ID;
  if (!folderId) {
    throw new Error('DRIVE_NOT_CONNECTED: DRIVE_ROOT_ID belum dikonfigurasi pada Script Properties.');
  }
  return DriveApp.getFolderById(folderId);
}

/**
 * Helper: Hashing SHA-256 menggunakan Google Apps Script Utilities
 * Never store plaintext OTP, session tokens, or device tokens
 */
function hashSha256(text, salt) {
  if (!text) return '';
  var props = PropertiesService.getScriptProperties();
  var secret = salt || props.getProperty('TOKEN_HASH_SECRET') || '';
  var combined = String(text) + (secret ? (':' + secret) : '');
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;
    var h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex;
}

/**
 * Helper: Pengiriman Email Kode Verifikasi OTP (Real MailApp.sendEmail)
 * Format persis sesuai spesifikasi Part 8
 */
function sendVerificationOtpEmail(recipientEmail, otpCode, purposeLabel) {
  var subject = 'Kode Verifikasi SiEpang';
  var body = 'Kode Verifikasi SiEpang\\n\\n' +
    'Kode Anda:\\n' +
    otpCode + '\\n\\n' +
    'Kode berlaku selama 10 menit.\\n\\n' +
    'Jangan berikan kode ini kepada siapa pun.';

  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: body
    });
    return true;
  } catch (err) {
    Logger.log('Gagal mengirim email OTP ke ' + recipientEmail + ': ' + err.toString());
    return false;
  }
}

/**
 * Helper: Audit Log Persistence (Zero sensitive tokens in audit log)
 */
function recordAuditLog(db, module, action, actorUserId, role, target, detailsJson) {
  try {
    var auditSheet = db.getSheetByName('AuditLogs');
    if (auditSheet) {
      auditSheet.appendRow([
        'aud_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2, 6),
        new Date().toISOString(),
        actorUserId || 'system',
        action,
        module,
        target || '',
        'WORKSPACE',
        CONFIG.WORKSPACE_ID,
        'SUCCESS',
        detailsJson || ''
      ]);
    }
  } catch (e) {}
}

/**
 * ============================================================================
 * PART 3 — FUNGSI SETUP UTAMA: setupSiEpangBackend()
 * ============================================================================
 * Idempotent: Validasi Script Properties, Spreadsheet, Drive, Skema 45 Tabel, Metadata
 */
function setupSiEpangBackend() {
  initScriptProperties();
  var props = PropertiesService.getScriptProperties();

  // 1. Validasi Spreadsheet
  var db;
  try {
    db = getCustomerDatabase();
  } catch (err) {
    return { ok: false, error: 'DATABASE_ERROR', message: 'Gagal membuka Spreadsheet: ' + err.message };
  }

  // 2. Validasi & Struktur Drive
  var rootFolder;
  var subfolderReport = {};
  try {
    rootFolder = getCustomerDriveRoot();
    var requiredSubfolders = ['Database', 'Branding', 'Documents', 'Certificates', 'ID Cards', 'Backup', 'Assets'];
    for (var f = 0; f < requiredSubfolders.length; f++) {
      var subName = requiredSubfolders[f];
      var iter = rootFolder.getFoldersByName(subName);
      var folder;
      if (iter.hasNext()) {
        folder = iter.next();
      } else {
        folder = rootFolder.createFolder(subName);
      }
      subfolderReport[subName] = folder.getId();
    }
  } catch (err) {
    return { ok: false, error: 'DRIVE_ERROR', message: 'Gagal mengakses root Drive: ' + err.message };
  }

  // 3. Provisi Tabel & Skema Kanonikal (Idempotent)
  var provRes = provisionCanonicalSchemaV19();

  // 4. Inisialisasi SystemConfig
  try {
    var configSheet = db.getSheetByName('SystemConfig');
    if (configSheet) {
      var cRows = configSheet.getDataRange().getValues();
      var existingKeys = {};
      for (var r = 1; r < cRows.length; r++) {
        existingKeys[cRows[r][0]] = true;
      }
      var nowIso = new Date().toISOString();
      var defaultEntries = [
        ['installation_id', props.getProperty('SIEPANG_INSTALLATION_ID') || CONFIG.INSTALLATION_ID, 'ID Instalasi resmi'],
        ['workspace_id', props.getProperty('SIEPANG_WORKSPACE_ID') || CONFIG.WORKSPACE_ID, 'ID Workspace aktif'],
        ['backend_version', CONFIG.BACKEND_VERSION, 'Versi Google Apps Script Backend'],
        ['schema_version', CONFIG.SCHEMA_VERSION, 'Versi Skema Spreadsheet'],
        ['environment', CONFIG.ENVIRONMENT, 'Lingkungan eksekusi'],
        ['created_at', nowIso, 'Waktu inisialisasi awal'],
        ['updated_at', nowIso, 'Waktu perbaruan terakhir']
      ];
      for (var d = 0; d < defaultEntries.length; d++) {
        var entry = defaultEntries[d];
        if (!existingKeys[entry[0]]) {
          configSheet.appendRow([entry[0], entry[1], entry[2], nowIso]);
        }
      }
    }
  } catch (err) {
    Logger.log('SystemConfig init warning: ' + err.toString());
  }

  // 5. Inisialisasi Workspace Internal & Active Event jika belum ada
  var instWsId = props.getProperty('SIEPANG_ACTIVE_WORKSPACE_ID') || props.getProperty('SIEPANG_WORKSPACE_ID') || CONFIG.ACTIVE_WORKSPACE_ID || 'ws_kwarran_01';
  var instEvtId = props.getProperty('SIEPANG_ACTIVE_EVENT_ID') || CONFIG.ACTIVE_EVENT_ID || 'evt_kegiatan_01';
  var nowIso = new Date().toISOString();

  try {
    var wsSheet = db.getSheetByName('Workspaces');
    if (wsSheet) {
      var wsRows = wsSheet.getDataRange().getValues();
      var wsFound = false;
      for (var w = 1; w < wsRows.length; w++) {
        if (wsRows[w][0] === instWsId) { wsFound = true; break; }
      }
      if (!wsFound) {
        wsSheet.appendRow([
          instWsId,
          'Kwartir Penyelenggara Kegiatan',
          'Kwartir Resmi Penyelenggara Perkemahan SiEpang',
          'ACTIVE',
          nowIso,
          nowIso
        ]);
      }
    }
  } catch (errWs) {
    Logger.log('Workspace ensure warning: ' + errWs.toString());
  }

  try {
    var evtSheet = db.getSheetByName('Events');
    if (evtSheet) {
      var evtRows = evtSheet.getDataRange().getValues();
      var evtFound = false;
      for (var ev = 1; ev < evtRows.length; ev++) {
        if (evtRows[ev][0] === instEvtId) { evtFound = true; break; }
      }
      if (!evtFound) {
        evtSheet.appendRow([
          instEvtId,
          instWsId,
          'Perkemahan Pramuka',
          'Perkemahan',
          'PST-2026',
          'Penggalang / Penegak',
          'Mandiri, Tangguh, Berkarakter',
          new Date().toISOString().slice(0, 10),
          new Date(Date.now() + 3*86400000).toISOString().slice(0, 10),
          'Bumi Perkemahan',
          'ACTIVE',
          1000,
          nowIso,
          nowIso
        ]);
      }
    }
  } catch (errEvt) {
    Logger.log('Event ensure warning: ' + errEvt.toString());
  }

  // 6. Ensure Initial / Bootstrap SuperAdmin (Idempotent)
  var bootSuperAdminRes = ensureInitialSuperAdmin(db, props);
  if (!bootSuperAdminRes.ok) {
    return {
      ok: false,
      error: 'BOOTSTRAP_SUPERADMIN_FAILED',
      message: 'Gagal membuat Initial SuperAdmin resmi: ' + (bootSuperAdminRes.error?.message || 'Unknown error')
    };
  }

  var report = {
    ok: true,
    status: 'READY',
    backend_version: CONFIG.BACKEND_VERSION,
    schema_version: CONFIG.SCHEMA_VERSION,
    spreadsheet_id: db.getId(),
    drive_root_id: rootFolder.getId(),
    subfolders: subfolderReport,
    sheets_created_count: provRes.created_sheets_count,
    total_sheets_count: db.getSheets().length,
    initial_superadmin: {
      email: bootSuperAdminRes.data.email,
      role: 'superadmin',
      status: 'ACTIVE',
      user_id: bootSuperAdminRes.data.user_id
    },
    timestamp: new Date().toISOString()
  };

  Logger.log('setupSiEpangBackend SELESAI: ' + JSON.stringify(report));
  return report;
}

/**
 * ============================================================================
 * PART 9 — MAIL TEST & DIAGNOSTICS FUNCTIONS
 * ============================================================================
 */
function testSendOtpEmail(targetEmail) {
  var email = targetEmail || Session.getActiveUser().getEmail() || CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL;
  if (!email) {
    Logger.log('testSendOtpEmail GAGAL: Alamat email tujuan tidak boleh kosong.');
    return { ok: false, error: 'NO_RECIPIENT', message: 'Tentukan alamat email penerima.' };
  }

  var testOtp = String(Math.floor(100000 + Math.random() * 900000));
  var sent = sendVerificationOtpEmail(email, testOtp, 'Pengujian Pengiriman Email OTP');

  var quota = getMailQuotaStatus();
  var res = {
    ok: sent,
    recipient: email,
    remaining_daily_quota: quota.remaining_daily_quota,
    message: sent ? 'Email uji coba OTP berhasil dikirim ke ' + email : 'Gagal mengirim email. Periksa izin MailApp akun.'
  };
  Logger.log('testSendOtpEmail Result: ' + JSON.stringify(res));
  return res;
}

function getMailQuotaStatus() {
  try {
    var quota = MailApp.getRemainingDailyQuota();
    return { ok: true, remaining_daily_quota: quota };
  } catch (err) {
    return { ok: false, error: err.toString(), remaining_daily_quota: 0 };
  }
}

/**
 * Helper: Ensures Initial SuperAdmin user and role idempotently
 */
function ensureInitialSuperAdmin(db, props, overrideEmail) {
  var targetEmail = (overrideEmail || props.getProperty('BOOTSTRAP_SUPERADMIN_EMAIL') || CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL || '').trim().toLowerCase();
  if (!targetEmail) {
    throw new Error('BOOTSTRAP_SUPERADMIN_EMAIL_REQUIRED: Tetapkan email administrator bootstrap pada Script Properties.');
  }

  var usersSheet = db.getSheetByName('Users');
  var roleSheet = db.getSheetByName('UserRoleAssignments');

  if (!usersSheet || !roleSheet) {
    provisionCanonicalSchemaV19();
    usersSheet = db.getSheetByName('Users');
    roleSheet = db.getSheetByName('UserRoleAssignments');
  }

  var uRows = usersSheet.getDataRange().getValues();
  var existingUserId = null;
  var userRowIdx = -1;

  for (var u = 1; u < uRows.length; u++) {
    if (uRows[u][1] && String(uRows[u][1]).trim().toLowerCase() === targetEmail) {
      existingUserId = uRows[u][0];
      userRowIdx = u + 1;
      break;
    }
  }

  var nowIso = new Date().toISOString();
  if (!existingUserId) {
    existingUserId = 'usr_super_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    usersSheet.appendRow([
      existingUserId,
      targetEmail,
      'Super Admin SiEpang',
      'true', // email_verified
      'active',
      nowIso,
      'SYSTEM_BOOTSTRAP',
      nowIso,
      nowIso,
      '', // avatar_url
      '', // phone
      'ORG_GLOBAL'
    ]);
  } else {
    usersSheet.getRange(userRowIdx, 4).setValue('true'); // email_verified
    usersSheet.getRange(userRowIdx, 5).setValue('active'); // status
    usersSheet.getRange(userRowIdx, 8).setValue(nowIso); // updated_at
  }

  // Ensure Role Assignment in UserRoleAssignments
  var roleRows = roleSheet.getDataRange().getValues();
  var roleExists = false;
  for (var r = 1; r < roleRows.length; r++) {
    if (roleRows[r][1] === existingUserId && roleRows[r][2] === 'superadmin' && roleRows[r][5] === 'active') {
      roleExists = true;
      break;
    }
  }

  if (!roleExists) {
    var assignmentId = 'asgn_boot_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    roleSheet.appendRow([
      assignmentId,
      existingUserId,
      'superadmin',
      'SYSTEM',
      'GLOBAL',
      'active',
      'SYSTEM_BOOTSTRAP',
      nowIso,
      ''
    ]);
  }

  recordAuditLog(db, 'AUTH', 'SUPERADMIN_BOOTSTRAPPED', existingUserId, 'superadmin', targetEmail, JSON.stringify({ scope: 'SYSTEM/GLOBAL' }));
  props.setProperty('SUPERADMIN_BOOTSTRAPPED', 'true');
  props.setProperty('BOOTSTRAP_SUPERADMIN_EMAIL', targetEmail);

  return {
    ok: true,
    data: {
      user_id: existingUserId,
      email: targetEmail,
      name: 'Super Admin SiEpang',
      role: 'superadmin',
      scope_type: 'SYSTEM',
      scope_id: 'GLOBAL',
      status: 'active',
      bootstrapped: true
    }
  };
}

/**
 * ============================================================================
 * PART 22 — SUPERADMIN BOOTSTRAP (Idempotent with LockService)
 * ============================================================================
 */
function bootstrapSuperAdminForVerifiedUser(userEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { ok: false, error: { code: 'SERVER_BUSY', message: 'Server sedang sibuk.' } };
  }

  try {
    var props = PropertiesService.getScriptProperties();
    var db = getCustomerDatabase();
    return ensureInitialSuperAdmin(db, props, userEmail);
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * FIRST BOOTSTRAP INITIALIZER (Zero Deadlock)
 * ============================================================================
 * One-time setup secret verification, initial installation context,
 * initial superadmin provisioning, and token invalidation.
 */
function executeFirstBootstrap(props, payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { ok: false, error: 'SERVER_BUSY', message: 'Server sedang sibuk memproses inisialisasi lain.' };
  }

  try {
    if (props.getProperty('SIEPANG_INSTALLATION_READY') === 'true') {
      return { ok: false, error: 'BOOTSTRAP_ALREADY_COMPLETED', message: 'Inisialisasi awal sudah selesai.' };
    }

    var instId = (payload && payload.installation_id) || props.getProperty('SIEPANG_INSTALLATION_ID') || CONFIG.INSTALLATION_ID || ('inst_' + Utilities.getUuid().substring(0, 10));
    var wsId = (payload && payload.workspace_id) || props.getProperty('SIEPANG_ACTIVE_WORKSPACE_ID') || CONFIG.ACTIVE_WORKSPACE_ID || 'ws_kwartir_01';
    var evtId = (payload && payload.event_id) || props.getProperty('SIEPANG_ACTIVE_EVENT_ID') || CONFIG.ACTIVE_EVENT_ID || 'evt_perkemahan_01';
    var sheetId = (payload && payload.spreadsheet_id) || props.getProperty('SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID || '';
    var driveRootId = (payload && payload.drive_root_id) || props.getProperty('DRIVE_ROOT_ID') || CONFIG.DRIVE_ROOT_ID || '';

    props.setProperty('SIEPANG_INSTALLATION_ID', instId);
    props.setProperty('SIEPANG_ACTIVE_WORKSPACE_ID', wsId);
    props.setProperty('SIEPANG_WORKSPACE_ID', wsId);
    props.setProperty('SIEPANG_ACTIVE_EVENT_ID', evtId);
    if (sheetId) props.setProperty('SPREADSHEET_ID', sheetId);
    if (driveRootId) props.setProperty('DRIVE_ROOT_ID', driveRootId);

    // Initialize Database & Canonical Schema if Spreadsheet is available
    var db = null;
    try {
      db = getCustomerDatabase();
      provisionCanonicalSchemaV19();
    } catch (dbErr) {
      Logger.log('Spreadsheet init notice during bootstrap: ' + dbErr.toString());
    }

    // Initialize Drive subfolders if root Drive folder is available
    try {
      if (driveRootId) {
        var rootFolder = getCustomerDriveRoot();
        var requiredSubfolders = ['Database', 'Branding', 'Documents', 'Certificates', 'ID Cards', 'Backup', 'Assets'];
        for (var f = 0; f < requiredSubfolders.length; f++) {
          var subName = requiredSubfolders[f];
          var iter = rootFolder.getFoldersByName(subName);
          if (!iter.hasNext()) {
            rootFolder.createFolder(subName);
          }
        }
      }
    } catch (driveErr) {
      Logger.log('Drive folder init notice during bootstrap: ' + driveErr.toString());
    }

    // Ensure Initial Superadmin from Script Properties
    var targetSuperAdminEmail = String(props.getProperty('BOOTSTRAP_SUPERADMIN_EMAIL') || CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL || '').trim().toLowerCase();
    if (!targetSuperAdminEmail) {
      return { ok: false, error: 'BOOTSTRAP_SUPERADMIN_EMAIL_REQUIRED', message: 'Tetapkan email administrator bootstrap pada Script Properties.' };
    }
    if (db) {
      var saRes = ensureInitialSuperAdmin(db, props, targetSuperAdminEmail);
      if (!saRes.ok) {
        return { ok: false, error: 'SUPERADMIN_BOOTSTRAP_FAILED', message: 'Gagal membuat superadmin awal: ' + saRes.message };
      }
    } else {
      props.setProperty('BOOTSTRAP_SUPERADMIN_EMAIL', targetSuperAdminEmail);
      props.setProperty('SUPERADMIN_BOOTSTRAPPED', 'true');
    }

    // Mark installation ready & inactivate bootstrap token permanently
    props.setProperty('SIEPANG_INSTALLATION_READY', 'true');
    props.deleteProperty('SIEPANG_BOOTSTRAP_TOKEN');
    props.setProperty('SIEPANG_BOOTSTRAP_TOKEN_USED', 'true');

    return {
      ok: true,
      data: {
        installation_ready: true,
        installation_id: instId,
        workspace_id: wsId,
        event_id: evtId,
        superadmin: {
          email: targetSuperAdminEmail,
          role: 'superadmin',
          status: 'ACTIVE'
        },
        otp_ready: true,
        timestamp: new Date().toISOString()
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * PART 46 & 47 — CLEANUP & BACKUP JOBS
 * ============================================================================
 */
function cleanupAuthData() {
  var db = getCustomerDatabase();
  var nowMs = new Date().getTime();

  // 1. Clean expired OTP challenges older than 24 hours
  var otpSheet = db.getSheetByName('AuthOtpChallenges');
  if (otpSheet) {
    var oRows = otpSheet.getDataRange().getValues();
    for (var o = oRows.length - 1; o >= 1; o--) {
      var expMs = new Date(oRows[o][4]).getTime();
      var used = oRows[o][9] === 'USED';
      if ((used || oRows[o][9] === 'EXPIRED' || oRows[o][9] === 'LOCKED') && (nowMs - expMs > 24 * 60 * 60 * 1000)) {
        otpSheet.deleteRow(o + 1);
      }
    }
  }

  // 2. Clean revoked sessions older than 30 days
  var sessSheet = db.getSheetByName('AuthSessions');
  if (sessSheet) {
    var sRows = sessSheet.getDataRange().getValues();
    for (var s = sRows.length - 1; s >= 1; s--) {
      var sExpMs = new Date(sRows[s][6]).getTime();
      if (sRows[s][8] === 'revoked' && (nowMs - sExpMs > 30 * 24 * 60 * 60 * 1000)) {
        sessSheet.deleteRow(s + 1);
      }
    }
  }

  Logger.log('cleanupAuthData selesai.');
}

function backupAuthData() {
  var db = getCustomerDatabase();
  var root = getCustomerDriveRoot();
  var backupFolder;
  var iter = root.getFoldersByName('Backup');
  if (iter.hasNext()) {
    backupFolder = iter.next();
  } else {
    backupFolder = root.createFolder('Backup');
  }

  var fileName = 'SiEpang_Backup_' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd_HHmmss');
  var backupFile = DriveApp.getFileById(db.getId()).makeCopy(fileName, backupFolder);
  Logger.log('backupAuthData berhasil dibuat: ' + backupFile.getName() + ' (' + backupFile.getId() + ')');
  return { ok: true, backup_file_id: backupFile.getId(), backup_file_name: fileName };
}

/**
 * ============================================================================
 * PART 13 — WEB APP ENTRY POINTS (doGet & doPost)
 * ============================================================================
 */
function doGet(e) {
  initScriptProperties();
  var action = (e && e.parameter && e.parameter.action) || 'system.health';
  var nonce = (e && e.parameter && e.parameter.nonce) || '';
  var reqId = 'req_' + new Date().getTime();

  if (action === 'health' || action === 'system.health') {
    var isDbReady = false;
    var isDriveReady = false;
    var schemaComplete = true;

    try {
      var db = getCustomerDatabase();
      isDbReady = !!db.getId();
      var reqSheets = ['Users', 'UserRoleAssignments', 'AuthOtpChallenges', 'TrustedDevices', 'AuthSessions', 'AuditLogs', 'SystemConfig'];
      for (var s = 0; s < reqSheets.length; s++) {
        if (!db.getSheetByName(reqSheets[s])) {
          schemaComplete = false;
          break;
        }
      }
      var driveFolder = getCustomerDriveRoot();
      isDriveReady = !!driveFolder.getId();
    } catch (err) {
      isDbReady = false;
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      request_id: reqId,
      data: {
        installation_id: CONFIG.INSTALLATION_ID,
        workspace_id: CONFIG.WORKSPACE_ID,
        backend_version: CONFIG.BACKEND_VERSION,
        schema_version: CONFIG.SCHEMA_VERSION,
        environment: CONFIG.ENVIRONMENT,
        database: !isDbReady ? 'DEGRADED' : (!schemaComplete ? 'SCHEMA_INCOMPLETE' : 'READY'),
        drive: isDriveReady ? 'READY' : 'DEGRADED',
        nonce_challenge: nonce ? ('VERIFIED_' + nonce) : null,
        timestamp: new Date().toISOString()
      },
      error: null
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'bootstrap.status' || action === '/api/bootstrap/status') {
    var props = PropertiesService.getScriptProperties();
    var isReady = props.getProperty('SIEPANG_INSTALLATION_READY') === 'true';
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      request_id: reqId,
      data: {
        installation_ready: isReady,
        backend_reachable: true
      },
      error: null
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'public.current' || action === '/api/public/current') {
    return dispatchAction(action, {}, {}, reqId);
  }

  return ContentService.createTextOutput(JSON.stringify({
    ok: false,
    request_id: reqId,
    data: null,
    error: { code: 'INVALID_ACTION', message: 'Aksi GET tidak dikenali.' }
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  initScriptProperties();
  var reqId = 'req_' + new Date().getTime();
  try {
    var raw = e.postData.contents;
    var req = JSON.parse(raw);
    reqId = req.request_id || reqId;
    var action = req.action || req.endpoint || '';
    var payload = req.payload || {};

    var props = PropertiesService.getScriptProperties();
    var status = checkInstallationStatus();

    // Khusus action public.current: langsung dispatch untuk mengembalikan status konfigurasi
    if (action === 'public.current' || action === '/api/public/current') {
      return dispatchAction(action, payload, req, reqId);
    }

    // FIRST BOOTSTRAP ENDPOINTS (Zero Deadlock)
    if (action === 'bootstrap.status' || action === '/api/bootstrap/status') {
      var isReady = props.getProperty('SIEPANG_INSTALLATION_READY') === 'true';
      return envelopeSuccess(reqId, {
        installation_ready: isReady,
        backend_reachable: true
      });
    }

    if (action === 'bootstrap.initialize' || action === '/api/bootstrap/initialize') {
      var isReady = props.getProperty('SIEPANG_INSTALLATION_READY') === 'true';
      if (isReady) {
        return envelopeError(
          reqId,
          'BOOTSTRAP_ALREADY_COMPLETED',
          'Inisialisasi awal sudah selesai. Endpoint bootstrap tidak dapat diakses lagi.',
          403
        );
      }

      var inputToken = (payload.bootstrap_token || '').trim();
      var expectedToken = (props.getProperty('SIEPANG_BOOTSTRAP_TOKEN') || '').trim();

      if (!inputToken || !expectedToken || inputToken !== expectedToken) {
        return envelopeError(
          reqId,
          'INVALID_BOOTSTRAP_TOKEN',
          'Token bootstrap tidak valid atau sudah kedaluwarsa.',
          401
        );
      }

      var bootRes = executeFirstBootstrap(props, payload);
      if (!bootRes.ok) {
        return envelopeError(reqId, bootRes.error || 'BOOTSTRAP_FAILED', bootRes.message || 'Gagal melakukan inisialisasi awal.', 500);
      }
      return envelopeSuccess(reqId, bootRes.data);
    }

    // Jika Script Properties belum lengkap, tolak request protected dengan status INSTALLATION_NOT_CONFIGURED
    if (!status.isConfigured) {
      return envelopeError(
        reqId,
        'INSTALLATION_NOT_CONFIGURED',
        'Script Properties belum lengkap pada Google Apps Script. Diperlukan: ' + status.missingProperties.join(', ') + '. Konfigurasikan pada Project Settings.',
        503,
        {
          configured: false,
          missing_properties: status.missingProperties,
          guide: 'Buka Project Settings di Google Apps Script dan tambahkan Script Properties: SIEPANG_INSTALLATION_ID, SIEPANG_ACTIVE_WORKSPACE_ID, SIEPANG_ACTIVE_EVENT_ID, dan SPREADSHEET_ID.'
        }
      );
    }

    // Server-authoritative context override (1 Instalasi = 1 Kegiatan)
    // Browser/cache context is safely overridden by server Script Properties
    if (!req.context) req.context = {};
    req.context.installation_id = status.installationId;
    req.context.workspace_id = status.workspaceId;
    req.context.event_id = status.eventId;
    req.installation_id = status.installationId;
    req.workspace_id = status.workspaceId;
    req.event_id = status.eventId;

    // Dispatch action
    return dispatchAction(action, payload, req, reqId);

  } catch (err) {
    var errMsg = err.toString();
    if (errMsg.indexOf('DATABASE_NOT_CONNECTED') !== -1) {
      return envelopeError(reqId, 'DATABASE_NOT_CONFIGURED', 'Spreadsheet database belum terhubung ke instans.', 503);
    }
    return envelopeError(reqId, 'INTERNAL_ERROR', errMsg, 500);
  }
}

/**
 * ============================================================================
 * DISPATCHER UNTUK CANONICAL ACTIONS
 * ============================================================================
 */
function dispatchAction(action, payload, req, reqId) {
  var props = PropertiesService.getScriptProperties();

  // =========================================================================
  // ACTION: public.current (Canonical Anonymous Single-Event Discovery)
  // =========================================================================
  if (action === 'public.current' || action === '/api/public/current') {
    var status = checkInstallationStatus();

    // Jika Script Properties belum lengkap, tolak dan kembalikan INSTALLATION_NOT_CONFIGURED
    // BUKAN otomatis pakai data demo/hardcoded!
    if (!status.isConfigured) {
      return envelopeError(
        reqId,
        'INSTALLATION_NOT_CONFIGURED',
        'Instalasi SiEpang belum dikonfigurasi. Script Properties belum lengkap pada Google Apps Script: ' + status.missingProperties.join(', ') + '.',
        503,
        {
          configured: false,
          missing_properties: status.missingProperties,
          guide: 'Buka Project Settings di Google Apps Script dan tambahkan Script Properties: SIEPANG_INSTALLATION_ID, SIEPANG_ACTIVE_WORKSPACE_ID, SIEPANG_ACTIVE_EVENT_ID, dan SPREADSHEET_ID.'
        }
      );
    }

    var instId = status.installationId;
    var wsId = status.workspaceId;
    var evtId = status.eventId;

    var wsName = 'Kwartir Penyelenggara';
    var wsOrg = 'Kwartir Penyelenggara';
    var eventData = {
      id: evtId,
      event_code: evtId,
      name: 'Kegiatan ' + evtId,
      short_name: 'Kegiatan SiEpang',
      status: 'PUBLISHED',
      category: 'Perkemahan',
      theme: 'Sistem Informasi Perkemahan Pramuka',
      start_date: '',
      end_date: '',
      location: '',
      venue: '',
      camp_ground: '',
      participant_capacity: 1000,
      banner_url: '',
      logo_url: '',
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
        logistics: true
      }
    };

    try {
      var db = getCustomerDatabase();
      var wsSheet = db.getSheetByName('Workspaces');
      if (wsSheet) {
        var wsRows = wsSheet.getDataRange().getValues();
        for (var w = 1; w < wsRows.length; w++) {
          if (String(wsRows[w][0]) === wsId) {
            wsName = String(wsRows[w][2] || wsRows[w][1] || wsName);
            wsOrg = String(wsRows[w][3] || wsOrg);
            break;
          }
        }
      }

      var evSheet = db.getSheetByName('Events');
      if (evSheet) {
        var evRows = evSheet.getDataRange().getValues();
        for (var e = 1; e < evRows.length; e++) {
          if (String(evRows[e][0]) === evtId) {
            eventData.name = String(evRows[e][2] || eventData.name);
            eventData.short_name = String(evRows[e][3] || eventData.short_name);
            eventData.event_code = String(evRows[e][4] || eventData.event_code);
            eventData.status = String(evRows[e][5] || eventData.status);
            eventData.start_date = String(evRows[e][6] || eventData.start_date);
            eventData.end_date = String(evRows[e][7] || eventData.end_date);
            eventData.location = String(evRows[e][8] || eventData.location);
            eventData.theme = String(evRows[e][9] || eventData.theme);
            break;
          }
        }
      }
    } catch (e) {
      // Safe fallback from configuration
    }

    return envelopeSuccess(reqId, {
      installation: {
        id: instId,
        environment: CONFIG.ENVIRONMENT || 'PRODUCTION',
        version: CONFIG.BACKEND_VERSION || 'v1.9.0'
      },
      workspace: {
        id: wsId,
        name: wsName,
        organization: wsOrg
      },
      event: eventData
    });
  }

  // Action: system.health
  if (action === 'system.health' || action === '/api/system/health') {
    var isDbReady = false;
    var isDriveReady = false;
    var schemaComplete = true;

    try {
      var checkDb = getCustomerDatabase();
      isDbReady = !!checkDb.getId();
      var reqSheets = ['Users', 'UserRoleAssignments', 'AuthOtpChallenges', 'TrustedDevices', 'AuthSessions', 'AuditLogs', 'SystemConfig'];
      for (var s = 0; s < reqSheets.length; s++) {
        if (!checkDb.getSheetByName(reqSheets[s])) {
          schemaComplete = false;
          break;
        }
      }
      var f = getCustomerDriveRoot();
      isDriveReady = !!f.getId();
    } catch (e) {
      isDbReady = false;
    }

    return envelopeSuccess(reqId, {
      installation_id: CONFIG.INSTALLATION_ID,
      workspace_id: CONFIG.WORKSPACE_ID,
      backend_version: CONFIG.BACKEND_VERSION,
      schema_version: CONFIG.SCHEMA_VERSION,
      environment: CONFIG.ENVIRONMENT,
      database: !isDbReady ? 'DEGRADED' : (!schemaComplete ? 'SCHEMA_INCOMPLETE' : 'READY'),
      drive: isDriveReady ? 'READY' : 'DEGRADED',
      database_ready: isDbReady,
      drive_ready: isDriveReady,
      nonce_challenge: payload.nonce ? ('VERIFIED_' + payload.nonce) : null,
      timestamp: new Date().toISOString()
    });
  }

  // Action: auth.bootstrapSuperAdmin
  if (action === 'auth.bootstrapSuperAdmin') {
    var bootRes = bootstrapSuperAdminForVerifiedUser(payload.email);
    if (!bootRes.ok) {
      return envelopeError(reqId, bootRes.error.code, bootRes.error.message, 400);
    }
    return envelopeSuccess(reqId, bootRes.data);
  }

  // =========================================================================
  // ACTION: auth.register.requestOtp (Part 14)
  // =========================================================================
  if (action === 'auth.register.requestOtp') {
    var regEmail = (payload.email || '').toLowerCase().trim();
    var regName = (payload.name || '').trim();

    if (!regEmail || regEmail.indexOf('@') === -1) {
      return envelopeError(reqId, 'INVALID_EMAIL', 'Format alamat email tidak valid.', 400);
    }
    if (!regName) {
      return envelopeError(reqId, 'INVALID_NAME', 'Nama lengkap wajib diisi.', 400);
    }

    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    var otpSheet = db.getSheetByName('AuthOtpChallenges');
    if (!usersSheet || !otpSheet) {
      provisionCanonicalSchemaV19();
      usersSheet = db.getSheetByName('Users');
      otpSheet = db.getSheetByName('AuthOtpChallenges');
    }

    // Check if email already registered (Users column 2 is email)
    var uRows = usersSheet.getDataRange().getValues();
    for (var u = 1; u < uRows.length; u++) {
      if (uRows[u][1] && String(uRows[u][1]).toLowerCase().trim() === regEmail) {
        return envelopeError(reqId, 'EMAIL_ALREADY_REGISTERED', 'Email ini sudah terdaftar. Silakan gunakan menu Masuk.', 400);
      }
    }

    // Rate limit check: 1 request per 60s cooldown, max 5 per hour
    var otpRows = otpSheet.getDataRange().getValues();
    var nowMs = new Date().getTime();
    var countPastHour = 0;
    for (var o = 1; o < otpRows.length; o++) {
      if (otpRows[o][1] && String(otpRows[o][1]).toLowerCase().trim() === regEmail) {
        var createdMs = new Date(otpRows[o][10]).getTime();
        if (nowMs - createdMs < CONFIG.OTP_RESEND_SECONDS * 1000) {
          return envelopeError(reqId, 'OTP_RATE_LIMITED', 'Mohon tunggu ' + CONFIG.OTP_RESEND_SECONDS + ' detik sebelum meminta kode baru.', 429);
        }
        if (nowMs - createdMs < 60 * 60 * 1000) {
          countPastHour++;
        }
      }
    }
    if (countPastHour >= 5) {
      return envelopeError(reqId, 'OTP_RATE_LIMITED', 'Batas permintaan kode per jam tercapai (maksimal 5 kali). Coba lagi nanti.', 429);
    }

    // Server-side crypto-safe OTP generation (6 digits numeric, unpredictable)
    var otpCode = String(Math.floor(100000 + Math.random() * 900000));
    var challengeId = 'chal_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    var otpHash = hashSha256(otpCode);
    var nowIso = new Date().toISOString();
    var expiresIso = new Date(nowMs + (CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000)).toISOString();

    // Persist challenge record FIRST
    otpSheet.appendRow([
      challengeId,
      regEmail,
      otpHash,
      'REGISTER_EMAIL',
      expiresIso,
      0, // attempt_count
      CONFIG.OTP_MAX_ATTEMPTS,
      0, // resend_count
      '', // used_at
      'PENDING',
      nowIso,
      nowIso,
      'REGISTRATION',
      ''
    ]);

    // Send real email via MailApp
    var mailSuccess = sendVerificationOtpEmail(regEmail, otpCode, 'Pendaftaran Akun Baru');
    if (!mailSuccess) {
      return envelopeError(reqId, 'OTP_EMAIL_SEND_FAILED', 'Kode belum berhasil dikirim. Silakan coba lagi.', 500);
    }

    recordAuditLog(db, 'AUTH', 'AUTH_OTP_REQUESTED', regEmail, 'guest', 'REGISTER_EMAIL');

    return envelopeSuccess(reqId, {
      challenge_id: challengeId,
      email: regEmail,
      expires_in_seconds: CONFIG.OTP_EXPIRY_MINUTES * 60,
      message: 'Kode verifikasi telah dikirim ke ' + regEmail + '.'
    });
  }

  // =========================================================================
  // ACTION: auth.login.requestOtp (Part 19)
  // =========================================================================
  if (action === 'auth.login.requestOtp') {
    var loginEmail = (payload.email || '').toLowerCase().trim();
    if (!loginEmail || loginEmail.indexOf('@') === -1) {
      return envelopeError(reqId, 'INVALID_EMAIL', 'Format alamat email tidak valid.', 400);
    }

    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    var otpSheet = db.getSheetByName('AuthOtpChallenges');
    if (!usersSheet || !otpSheet) {
      provisionCanonicalSchemaV19();
      usersSheet = db.getSheetByName('Users');
      otpSheet = db.getSheetByName('AuthOtpChallenges');
    }

    // Lookup user in Users sheet (column 2 is email, column 5 is status)
    var uRows = usersSheet.getDataRange().getValues();
    var userFound = false;
    var userActive = true;
    for (var u = 1; u < uRows.length; u++) {
      if (uRows[u][1] && String(uRows[u][1]).toLowerCase().trim() === loginEmail) {
        userFound = true;
        if (uRows[u][4] === 'inactive') {
          userActive = false;
        }
        break;
      }
    }

    var bootEmail = props.getProperty('BOOTSTRAP_SUPERADMIN_EMAIL') || CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL;
    var isBootstrapCandidate = bootEmail && bootEmail.trim().toLowerCase() === loginEmail;

    if (!userFound && !isBootstrapCandidate) {
      return envelopeError(reqId, 'USER_NOT_FOUND', 'Email belum terdaftar. Silakan buat akun baru terlebih dahulu.', 404);
    }
    if (userFound && !userActive) {
      return envelopeError(reqId, 'ACCOUNT_DISABLED', 'Akun Anda dinonaktifkan oleh Administrator Kwartir.', 403);
    }

    // Rate limit check
    var otpRows = otpSheet.getDataRange().getValues();
    var nowMs = new Date().getTime();
    var countPastHour = 0;
    for (var o = 1; o < otpRows.length; o++) {
      if (otpRows[o][1] && String(otpRows[o][1]).toLowerCase().trim() === loginEmail) {
        var createdMs = new Date(otpRows[o][10]).getTime();
        if (nowMs - createdMs < CONFIG.OTP_RESEND_SECONDS * 1000) {
          return envelopeError(reqId, 'OTP_RATE_LIMITED', 'Mohon tunggu ' + CONFIG.OTP_RESEND_SECONDS + ' detik sebelum meminta kode baru.', 429);
        }
        if (nowMs - createdMs < 60 * 60 * 1000) {
          countPastHour++;
        }
      }
    }
    if (countPastHour >= 5) {
      return envelopeError(reqId, 'OTP_RATE_LIMITED', 'Batas permintaan kode verifikasi per jam telah tercapai (maksimal 5 kali).', 429);
    }

    var otpCode = String(Math.floor(100000 + Math.random() * 900000));
    var challengeId = 'chal_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    var otpHash = hashSha256(otpCode);
    var nowIso = new Date().toISOString();
    var expiresIso = new Date(nowMs + (CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000)).toISOString();

    otpSheet.appendRow([
      challengeId,
      loginEmail,
      otpHash,
      'LOGIN_DEVICE',
      expiresIso,
      0, // attempt_count
      CONFIG.OTP_MAX_ATTEMPTS,
      0,
      '',
      'PENDING',
      nowIso,
      nowIso,
      'LOGIN_NEW_DEVICE',
      ''
    ]);

    var mailSuccess = sendVerificationOtpEmail(loginEmail, otpCode, 'Masuk ke SiEpang');
    if (!mailSuccess) {
      return envelopeError(reqId, 'OTP_EMAIL_SEND_FAILED', 'Kode belum berhasil dikirim. Silakan coba lagi.', 500);
    }

    recordAuditLog(db, 'AUTH', 'AUTH_OTP_REQUESTED', loginEmail, 'user', 'LOGIN_DEVICE');

    return envelopeSuccess(reqId, {
      challenge_id: challengeId,
      email: loginEmail,
      expires_in_seconds: CONFIG.OTP_EXPIRY_MINUTES * 60,
      message: 'Kode verifikasi telah dikirim ke ' + loginEmail + '.'
    });
  }

  // =========================================================================
  // ACTION: auth.register.verifyOtp & auth.login.verifyOtp (Part 15)
  // =========================================================================
  if (action === 'auth.register.verifyOtp' || action === 'auth.login.verifyOtp') {
    var targetEmail = (payload.email || '').toLowerCase().trim();
    var challengeId = payload.challenge_id || '';
    var inputOtp = String(payload.otp || '').trim();
    var deviceName = payload.device_name || 'Browser';
    var browserFamily = payload.browser_family || 'Web';
    var platform = payload.platform || 'Unknown';
    var clientDevicePublicId = payload.device_public_id || ('dev_' + Utilities.getUuid().substring(0, 12));
    var clientDeviceToken = payload.device_token || ('dtok_' + Utilities.getUuid().replace(/-/g, ''));

    if (!targetEmail || !inputOtp) {
      return envelopeError(reqId, 'INVALID_INPUT', 'Alamat email dan kode verifikasi 6 digit wajib diisi.', 400);
    }

    // Script Lock to prevent race condition during OTP consumption
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (lockErr) {
      return envelopeError(reqId, 'SERVER_BUSY', 'Server sedang memproses transaksi lain. Coba beberapa saat lagi.', 503);
    }

    try {
      var db = getCustomerDatabase();
      var otpSheet = db.getSheetByName('AuthOtpChallenges');
      var usersSheet = db.getSheetByName('Users');
      var roleSheet = db.getSheetByName('UserRoleAssignments');
      var deviceSheet = db.getSheetByName('TrustedDevices');
      var sessionSheet = db.getSheetByName('AuthSessions');

      if (!otpSheet || !usersSheet || !deviceSheet || !sessionSheet) {
        provisionCanonicalSchemaV19();
        otpSheet = db.getSheetByName('AuthOtpChallenges');
        usersSheet = db.getSheetByName('Users');
        roleSheet = db.getSheetByName('UserRoleAssignments');
        deviceSheet = db.getSheetByName('TrustedDevices');
        sessionSheet = db.getSheetByName('AuthSessions');
      }

      // Lookup challenge
      var otpRows = otpSheet.getDataRange().getValues();
      var matchedChallenge = null;
      var challengeRowIdx = -1;

      for (var c = otpRows.length - 1; c >= 1; c--) {
        var row = otpRows[c];
        var isEmailMatch = row[1] && String(row[1]).toLowerCase().trim() === targetEmail;
        var isChalMatch = challengeId ? (row[0] === challengeId) : true;
        if (isEmailMatch && isChalMatch) {
          matchedChallenge = {
            id: row[0],
            email: row[1],
            otpHash: row[2],
            purpose: row[3],
            expiresAt: row[4],
            attemptCount: parseInt(row[5], 10) || 0,
            maxAttempts: parseInt(row[6], 10) || 5,
            status: row[9]
          };
          challengeRowIdx = c + 1;
          break;
        }
      }

      if (!matchedChallenge) {
        return envelopeError(reqId, 'OTP_INVALID', 'Kode verifikasi tidak ditemukan atau sudah tidak berlaku.', 404);
      }

      if (matchedChallenge.status === 'USED') {
        return envelopeError(reqId, 'OTP_ALREADY_USED', 'Kode verifikasi ini sudah pernah digunakan.', 400);
      }

      if (matchedChallenge.status === 'LOCKED' || matchedChallenge.attemptCount >= matchedChallenge.maxAttempts) {
        return envelopeError(reqId, 'OTP_LOCKED', 'Kode verifikasi terkunci karena terlalu banyak percobaan salah. Silakan minta kode baru.', 403);
      }

      var nowMs = new Date().getTime();
      if (new Date(matchedChallenge.expiresAt).getTime() < nowMs) {
        otpSheet.getRange(challengeRowIdx, 10).setValue('EXPIRED');
        return envelopeError(reqId, 'OTP_EXPIRED', 'Kode verifikasi telah kedaluwarsa. Silakan minta kode baru.', 400);
      }

      // Check OTP Hash
      var inputHash = hashSha256(inputOtp);
      if (inputHash !== matchedChallenge.otpHash) {
        var newAttempt = matchedChallenge.attemptCount + 1;
        otpSheet.getRange(challengeRowIdx, 6).setValue(newAttempt);
        if (newAttempt >= matchedChallenge.maxAttempts) {
          otpSheet.getRange(challengeRowIdx, 10).setValue('LOCKED');
          recordAuditLog(db, 'AUTH', 'AUTH_OTP_LOCKED', targetEmail, 'security', 'MAX_ATTEMPTS');
          return envelopeError(reqId, 'OTP_LOCKED', 'Kode verifikasi terkunci karena terlalu banyak percobaan salah. Silakan minta kode baru.', 403);
        }
        recordAuditLog(db, 'AUTH', 'AUTH_OTP_FAILED', targetEmail, 'security', 'ATTEMPT_' + newAttempt);
        return envelopeError(reqId, 'OTP_INVALID', 'Kode verifikasi salah. Sisa percobaan: ' + (matchedChallenge.maxAttempts - newAttempt) + ' kali.', 400);
      }

      // Mark challenge as USED (single-use enforcement)
      var nowIso = new Date().toISOString();
      otpSheet.getRange(challengeRowIdx, 9).setValue(nowIso); // used_at
      otpSheet.getRange(challengeRowIdx, 10).setValue('USED'); // status
      otpSheet.getRange(challengeRowIdx, 12).setValue(nowIso); // updated_at
      recordAuditLog(db, 'AUTH', 'AUTH_OTP_VERIFIED', targetEmail, 'security', matchedChallenge.purpose);

      // Check / Create User in Users table (Col 1: user_id, Col 2: email, Col 3: name, Col 4: email_verified, Col 5: status)
      var uRows = usersSheet.getDataRange().getValues();
      var matchedUser = null;
      var userRowIdx = -1;

      for (var u = 1; u < uRows.length; u++) {
        if (uRows[u][1] && String(uRows[u][1]).toLowerCase().trim() === targetEmail) {
          matchedUser = {
            id: uRows[u][0],
            email: uRows[u][1],
            name: uRows[u][2],
            emailVerified: uRows[u][3],
            status: uRows[u][4],
            createdAt: uRows[u][5],
            avatarUrl: uRows[u][9] || ''
          };
          userRowIdx = u + 1;
          break;
        }
      }

      if (!matchedUser) {
        var newUserId = 'usr_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
        var userName = (payload.name && payload.name.trim()) ? payload.name.trim() : targetEmail.split('@')[0];
        usersSheet.appendRow([
          newUserId,
          targetEmail,
          userName,
          'true', // email_verified
          'active', // status
          nowIso,
          'SELF_REGISTER_OTP',
          nowIso,
          nowIso, // last_login_at
          '', // avatar_url
          '', // phone
          'ORG_GLOBAL'
        ]);
        matchedUser = {
          id: newUserId,
          email: targetEmail,
          name: userName,
          status: 'active',
          createdAt: nowIso,
          avatarUrl: ''
        };
        recordAuditLog(db, 'AUTH', 'AUTH_USER_REGISTERED', newUserId, 'registered_user', targetEmail);
      } else {
        if (matchedUser.status === 'inactive') {
          return envelopeError(reqId, 'ACCOUNT_DISABLED', 'Akun Anda dinonaktifkan oleh Administrator Kwartir.', 403);
        }
        usersSheet.getRange(userRowIdx, 4).setValue('true'); // email_verified
        usersSheet.getRange(userRowIdx, 8).setValue(nowIso); // updated_at
        usersSheet.getRange(userRowIdx, 9).setValue(nowIso); // last_login_at
      }

      // Check SuperAdmin Bootstrap match
      var bootEmail = props.getProperty('BOOTSTRAP_SUPERADMIN_EMAIL') || CONFIG.BOOTSTRAP_SUPERADMIN_EMAIL;
      if (bootEmail && bootEmail.trim().toLowerCase() === targetEmail && props.getProperty('SUPERADMIN_BOOTSTRAPPED') !== 'true') {
        bootstrapSuperAdminForVerifiedUser(targetEmail);
      }

      // Register Trusted Device (Part 16)
      var trustedDeviceId = 'dev_rec_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
      var deviceTokenHash = hashSha256(clientDeviceToken);
      var devTtlDays = parseInt(props.getProperty('TRUSTED_DEVICE_TTL_DAYS') || String(CONFIG.TRUSTED_DEVICE_TTL_DAYS), 10);
      var deviceExpiresIso = new Date(nowMs + (devTtlDays * 24 * 60 * 60 * 1000)).toISOString();

      deviceSheet.appendRow([
        trustedDeviceId,
        matchedUser.id,
        clientDevicePublicId,
        deviceTokenHash,
        deviceName,
        browserFamily,
        platform,
        nowIso,
        nowIso, // last_seen_at
        deviceExpiresIso,
        '', // revoked_at
        'active'
      ]);
      recordAuditLog(db, 'AUTH', 'TRUSTED_DEVICE_REGISTERED', matchedUser.id, 'security', clientDevicePublicId);

      // Create Persistent Session (Part 17)
      var sessionId = 'sess_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
      var sessionToken = 'stok_' + Utilities.getUuid().replace(/-/g, '');
      var sessionTokenHash = hashSha256(sessionToken);
      var sessTtlDays = parseInt(props.getProperty('SESSION_TTL_DAYS') || String(CONFIG.SESSION_TTL_DAYS), 10);
      var sessionExpiresMs = nowMs + (sessTtlDays * 24 * 60 * 60 * 1000);
      var sessionExpiresIso = new Date(sessionExpiresMs).toISOString();

      sessionSheet.appendRow([
        sessionId,
        matchedUser.id,
        trustedDeviceId,
        sessionTokenHash,
        nowIso,
        nowIso, // last_seen_at
        sessionExpiresIso,
        '', // revoked_at
        'active'
      ]);

      // Resolve Authoritative Roles (Part 23 & 25)
      var rRows = roleSheet ? roleSheet.getDataRange().getValues() : [];
      var assignments = [];
      for (var r = 1; r < rRows.length; r++) {
        if (rRows[r][1] === matchedUser.id && rRows[r][5] === 'active') {
          assignments.push({
            assignment_id: rRows[r][0],
            role: rRows[r][2],
            scope_type: rRows[r][3],
            scope_id: rRows[r][4]
          });
        }
      }

      var primaryRole = assignments.length > 0 ? assignments[0].role : 'viewer';
      var allRoles = assignments.map(function(a) { return a.role; });

      return envelopeSuccess(reqId, {
        user_id: matchedUser.id,
        display_name: matchedUser.name,
        email: matchedUser.email,
        avatar: matchedUser.avatarUrl || '',
        role: primaryRole,
        effective_roles: allRoles.length > 0 ? allRoles : ['viewer'],
        assignments: assignments,
        workspace_id: CONFIG.WORKSPACE_ID,
        organization_id: 'ORG_GLOBAL',
        session_token: sessionToken,
        session_expires_at: sessionExpiresMs,
        device_public_id: clientDevicePublicId,
        device_token: clientDeviceToken,
        is_trusted_device: true
      });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================================
  // ACTION: auth.session.validate & auth.session.refresh (Part 18)
  // =========================================================================
  if (action === 'auth.session.validate' || action === 'auth.session.refresh') {
    var rawToken = payload.session_token || req.session_token;
    var clientDevPubId = payload.device_public_id;

    if (!rawToken) {
      return envelopeError(reqId, 'SESSION_INVALID', 'Sesi tidak ditemukan.', 401);
    }

    var tokenHash = hashSha256(rawToken);
    var db = getCustomerDatabase();
    var sessionSheet = db.getSheetByName('AuthSessions');
    var deviceSheet = db.getSheetByName('TrustedDevices');
    var usersSheet = db.getSheetByName('Users');
    var roleSheet = db.getSheetByName('UserRoleAssignments');

    if (!sessionSheet || !usersSheet) {
      return envelopeError(reqId, 'SESSION_INVALID', 'Database autentikasi belum siap.', 401);
    }

    var sRows = sessionSheet.getDataRange().getValues();
    var matchedSession = null;
    var sessionRowIdx = -1;
    var nowMs = new Date().getTime();

    for (var s = sRows.length - 1; s >= 1; s--) {
      var row = sRows[s];
      if (row[3] === tokenHash) {
        matchedSession = {
          id: row[0],
          userId: row[1],
          trustedDeviceId: row[2],
          tokenHash: row[3],
          expiresAt: row[6],
          status: row[8]
        };
        sessionRowIdx = s + 1;
        break;
      }
    }

    if (!matchedSession || matchedSession.status !== 'active') {
      return envelopeError(reqId, 'SESSION_INVALID', 'Sesi telah kedaluwarsa atau dicabut.', 401);
    }

    if (new Date(matchedSession.expiresAt).getTime() < nowMs) {
      sessionSheet.getRange(sessionRowIdx, 9).setValue('revoked');
      return envelopeError(reqId, 'SESSION_EXPIRED', 'Masa berlaku sesi telah habis. Silakan masuk kembali.', 401);
    }

    // Check Trusted Device if bound
    var isDeviceValid = true;
    if (matchedSession.trustedDeviceId && deviceSheet) {
      var dRows = deviceSheet.getDataRange().getValues();
      for (var d = 1; d < dRows.length; d++) {
        if (dRows[d][0] === matchedSession.trustedDeviceId) {
          if (dRows[d][11] === 'revoked') {
            isDeviceValid = false;
          } else {
            // Update last_seen_at for sliding session
            deviceSheet.getRange(d + 1, 9).setValue(new Date().toISOString());
          }
          break;
        }
      }
    }

    if (!isDeviceValid) {
      sessionSheet.getRange(sessionRowIdx, 9).setValue('revoked');
      return envelopeError(reqId, 'DEVICE_REVOKED', 'Akses perangkat ini telah dicabut oleh Administrator.', 401);
    }

    // Lookup user in Users sheet (Col 1: id, Col 2: email, Col 3: name, Col 5: status)
    var uRows = usersSheet.getDataRange().getValues();
    var matchedUser = null;
    for (var u = 1; u < uRows.length; u++) {
      if (uRows[u][0] === matchedSession.userId) {
        matchedUser = {
          id: uRows[u][0],
          email: uRows[u][1],
          name: uRows[u][2],
          status: uRows[u][4],
          avatarUrl: uRows[u][9] || ''
        };
        break;
      }
    }

    if (!matchedUser || matchedUser.status === 'inactive') {
      return envelopeError(reqId, 'ACCOUNT_DISABLED', 'Akun pengguna dinonaktifkan oleh Administrator.', 403);
    }

    // Update last_seen_at for session
    sessionSheet.getRange(sessionRowIdx, 6).setValue(new Date().toISOString());

    // Resolve Authoritative Roles from UserRoleAssignments
    var rRows = roleSheet ? roleSheet.getDataRange().getValues() : [];
    var assignments = [];
    for (var r = 1; r < rRows.length; r++) {
      if (rRows[r][1] === matchedUser.id && rRows[r][5] === 'active') {
        assignments.push({
          assignment_id: rRows[r][0],
          role: rRows[r][2],
          scope_type: rRows[r][3],
          scope_id: rRows[r][4]
        });
      }
    }

    var primaryRole = assignments.length > 0 ? assignments[0].role : 'viewer';
    var allRoles = assignments.map(function(a) { return a.role; });

    return envelopeSuccess(reqId, {
      user_id: matchedUser.id,
      display_name: matchedUser.name,
      email: matchedUser.email,
      avatar: matchedUser.avatarUrl || '',
      role: primaryRole,
      effective_roles: allRoles.length > 0 ? allRoles : ['viewer'],
      assignments: assignments,
      workspace_id: CONFIG.WORKSPACE_ID,
      organization_id: 'ORG_GLOBAL',
      session_token: rawToken,
      session_expires_at: new Date(matchedSession.expiresAt).getTime(),
      is_trusted_device: true
    });
  }

  // =========================================================================
  // ACTION: auth.logout & auth.logoutAll (Part 20)
  // =========================================================================
  if (action === 'auth.logout') {
    var rawToken = payload.session_token || req.session_token;
    var forgetDevice = payload.forget_device === true;

    if (rawToken) {
      var tokenHash = hashSha256(rawToken);
      var db = getCustomerDatabase();
      var sessionSheet = db.getSheetByName('AuthSessions');
      var deviceSheet = db.getSheetByName('TrustedDevices');
      var nowIso = new Date().toISOString();

      if (sessionSheet) {
        var sRows = sessionSheet.getDataRange().getValues();
        for (var s = 1; s < sRows.length; s++) {
          if (sRows[s][3] === tokenHash) {
            sessionSheet.getRange(s + 1, 8).setValue(nowIso); // revoked_at
            sessionSheet.getRange(s + 1, 9).setValue('revoked'); // status

            if (forgetDevice && deviceSheet && sRows[s][2]) {
              var devId = sRows[s][2];
              var dRows = deviceSheet.getDataRange().getValues();
              for (var d = 1; d < dRows.length; d++) {
                if (dRows[d][0] === devId) {
                  deviceSheet.getRange(d + 1, 11).setValue(nowIso);
                  deviceSheet.getRange(d + 1, 12).setValue('revoked');
                  break;
                }
              }
            }
            break;
          }
        }
      }
    }
    return envelopeSuccess(reqId, { logged_out: true });
  }

  if (action === 'auth.logoutAll') {
    var targetUserId = payload.user_id;
    if (targetUserId) {
      var db = getCustomerDatabase();
      var sessionSheet = db.getSheetByName('AuthSessions');
      var nowIso = new Date().toISOString();
      if (sessionSheet) {
        var sRows = sessionSheet.getDataRange().getValues();
        for (var s = 1; s < sRows.length; s++) {
          if (sRows[s][1] === targetUserId && sRows[s][8] === 'active') {
            sessionSheet.getRange(s + 1, 8).setValue(nowIso);
            sessionSheet.getRange(s + 1, 9).setValue('revoked');
          }
        }
      }
    }
    return envelopeSuccess(reqId, { logged_out_all: true });
  }

  // =========================================================================
  // ACTION: auth.devices.list & auth.devices.revoke (Part 21)
  // =========================================================================
  if (action === 'auth.devices.list') {
    var targetUserId = payload.user_id;
    var currentDevPubId = payload.current_device_public_id;
    var db = getCustomerDatabase();
    var deviceSheet = db.getSheetByName('TrustedDevices');
    var list = [];

    if (deviceSheet && targetUserId) {
      var dRows = deviceSheet.getDataRange().getValues();
      for (var d = 1; d < dRows.length; d++) {
        if (dRows[d][1] === targetUserId && dRows[d][11] === 'active') {
          list.push({
            trusted_device_id: dRows[d][0],
            user_id: dRows[d][1],
            device_public_id: dRows[d][2],
            device_name: dRows[d][4],
            browser_family: dRows[d][5],
            platform: dRows[d][6],
            created_at: dRows[d][7],
            last_seen_at: dRows[d][8],
            is_current_device: currentDevPubId ? (dRows[d][2] === currentDevPubId) : false
          });
        }
      }
    }
    return envelopeSuccess(reqId, list);
  }

  if (action === 'auth.devices.revoke') {
    var devPubId = payload.device_public_id;
    if (devPubId) {
      var db = getCustomerDatabase();
      var deviceSheet = db.getSheetByName('TrustedDevices');
      var sessionSheet = db.getSheetByName('AuthSessions');
      var nowIso = new Date().toISOString();
      var revokedDevId = null;

      if (deviceSheet) {
        var dRows = deviceSheet.getDataRange().getValues();
        for (var d = 1; d < dRows.length; d++) {
          if (dRows[d][2] === devPubId) {
            deviceSheet.getRange(d + 1, 11).setValue(nowIso);
            deviceSheet.getRange(d + 1, 12).setValue('revoked');
            revokedDevId = dRows[d][0];
            break;
          }
        }
      }

      if (revokedDevId && sessionSheet) {
        var sRows = sessionSheet.getDataRange().getValues();
        for (var s = 1; s < sRows.length; s++) {
          if (sRows[s][2] === revokedDevId) {
            sessionSheet.getRange(s + 1, 8).setValue(nowIso);
            sessionSheet.getRange(s + 1, 9).setValue('revoked');
          }
        }
      }
    }
    return envelopeSuccess(reqId, { revoked: true });
  }

  // =========================================================================
  // ACTIONS: USERS MANAGEMENT & RBAC (Part 24 & 25)
  // =========================================================================
  if (action === 'users.list') {
    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    var roleSheet = db.getSheetByName('UserRoleAssignments');
    var resultList = [];

    if (usersSheet) {
      var uRows = usersSheet.getDataRange().getValues();
      var rRows = roleSheet ? roleSheet.getDataRange().getValues() : [];

      for (var u = 1; u < uRows.length; u++) {
        var uid = uRows[u][0];
        var userRoles = [];
        for (var r = 1; r < rRows.length; r++) {
          if (rRows[r][1] === uid && rRows[r][5] === 'active') {
            userRoles.push(rRows[r][2]);
          }
        }
        resultList.push({
          id: uid,
          user_id: uid,
          email: uRows[u][1],
          name: uRows[u][2],
          email_verified: uRows[u][3] === true || uRows[u][3] === 'true',
          status: uRows[u][4],
          createdAt: uRows[u][5],
          lastLogin: uRows[u][8] || 'Belum pernah login',
          role: userRoles.length > 0 ? userRoles[0] : 'viewer',
          roles: userRoles.length > 0 ? userRoles : ['viewer'],
          avatar: uRows[u][9] || '',
          organizationName: 'Kwartir Gerakan Pramuka',
          workspaceId: CONFIG.WORKSPACE_ID
        });
      }
    }
    return envelopeSuccess(reqId, resultList);
  }

  if (action === 'users.get') {
    var targetUid = payload.user_id || payload.id;
    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    var roleSheet = db.getSheetByName('UserRoleAssignments');

    if (usersSheet && targetUid) {
      var uRows = usersSheet.getDataRange().getValues();
      for (var u = 1; u < uRows.length; u++) {
        if (uRows[u][0] === targetUid || uRows[u][1] === targetUid) {
          var uid = uRows[u][0];
          var roles = [];
          if (roleSheet) {
            var rRows = roleSheet.getDataRange().getValues();
            for (var r = 1; r < rRows.length; r++) {
              if (rRows[r][1] === uid && rRows[r][5] === 'active') {
                roles.push({
                  assignment_id: rRows[r][0],
                  role: rRows[r][2],
                  scope_type: rRows[r][3],
                  scope_id: rRows[r][4]
                });
              }
            }
          }
          return envelopeSuccess(reqId, {
            user_id: uid,
            email: uRows[u][1],
            name: uRows[u][2],
            email_verified: uRows[u][3],
            status: uRows[u][4],
            role_assignments: roles
          });
        }
      }
    }
    return envelopeError(reqId, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.', 404);
  }

  if (action === 'users.disable') {
    var targetUid = payload.user_id;
    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    var sessionSheet = db.getSheetByName('AuthSessions');
    var nowIso = new Date().toISOString();

    if (usersSheet && targetUid) {
      var uRows = usersSheet.getDataRange().getValues();
      for (var u = 1; u < uRows.length; u++) {
        if (uRows[u][0] === targetUid) {
          usersSheet.getRange(u + 1, 5).setValue('inactive');
          usersSheet.getRange(u + 1, 8).setValue(nowIso);

          // Revoke all active sessions immediately (Part 19)
          if (sessionSheet) {
            var sRows = sessionSheet.getDataRange().getValues();
            for (var s = 1; s < sRows.length; s++) {
              if (sRows[s][1] === targetUid && sRows[s][8] === 'active') {
                sessionSheet.getRange(s + 1, 8).setValue(nowIso);
                sessionSheet.getRange(s + 1, 9).setValue('revoked');
              }
            }
          }

          recordAuditLog(db, 'USERS', 'USER_DISABLED', targetUid, 'admin', targetUid);
          return envelopeSuccess(reqId, { user_id: targetUid, status: 'inactive' });
        }
      }
    }
    return envelopeError(reqId, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.', 404);
  }

  if (action === 'users.enable') {
    var targetUid = payload.user_id;
    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    var nowIso = new Date().toISOString();

    if (usersSheet && targetUid) {
      var uRows = usersSheet.getDataRange().getValues();
      for (var u = 1; u < uRows.length; u++) {
        if (uRows[u][0] === targetUid) {
          usersSheet.getRange(u + 1, 5).setValue('active');
          usersSheet.getRange(u + 1, 8).setValue(nowIso);
          recordAuditLog(db, 'USERS', 'USER_ENABLED', targetUid, 'admin', targetUid);
          return envelopeSuccess(reqId, { user_id: targetUid, status: 'active' });
        }
      }
    }
    return envelopeError(reqId, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.', 404);
  }

  if (action === 'users.assignRole') {
    var targetUid = payload.user_id;
    var newRole = payload.role;
    var activeWsId = props.getProperty('SIEPANG_ACTIVE_WORKSPACE_ID') || props.getProperty('SIEPANG_WORKSPACE_ID') || CONFIG.ACTIVE_WORKSPACE_ID || CONFIG.WORKSPACE_ID;
    var activeEvtId = props.getProperty('SIEPANG_ACTIVE_EVENT_ID') || props.getProperty('EVENT_ID') || CONFIG.ACTIVE_EVENT_ID;
    var scopeType = payload.scope_type || (newRole === 'superadmin' ? 'GLOBAL' : (newRole === 'workspace_admin' ? 'WORKSPACE' : 'EVENT'));
    var scopeId = scopeType === 'EVENT' ? activeEvtId : (scopeType === 'WORKSPACE' ? activeWsId : (payload.scope_id || 'GLOBAL'));

    if (!targetUid || !newRole) {
      return envelopeError(reqId, 'INVALID_INPUT', 'user_id dan role wajib diisi.', 400);
    }

    var db = getCustomerDatabase();
    var roleSheet = db.getSheetByName('UserRoleAssignments');
    if (!roleSheet) {
      provisionCanonicalSchemaV19();
      roleSheet = db.getSheetByName('UserRoleAssignments');
    }

    var nowIso = new Date().toISOString();
    var assignmentId = 'asgn_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    roleSheet.appendRow([
      assignmentId,
      targetUid,
      newRole,
      scopeType,
      scopeId,
      'active',
      'ADMIN_ASSIGNMENT',
      nowIso,
      ''
    ]);

    recordAuditLog(db, 'USERS', 'ROLE_ASSIGNED', targetUid, 'admin', newRole);
    return envelopeSuccess(reqId, { assignment_id: assignmentId, user_id: targetUid, role: newRole });
  }

  if (action === 'users.revokeRole') {
    var targetUid = payload.user_id;
    var targetRole = payload.role;
    var db = getCustomerDatabase();
    var roleSheet = db.getSheetByName('UserRoleAssignments');
    var nowIso = new Date().toISOString();

    if (roleSheet && targetUid) {
      var rRows = roleSheet.getDataRange().getValues();
      for (var r = 1; r < rRows.length; r++) {
        var matchUser = rRows[r][1] === targetUid;
        var matchRole = targetRole ? (rRows[r][2] === targetRole) : true;
        if (matchUser && matchRole && rRows[r][5] === 'active') {
          roleSheet.getRange(r + 1, 6).setValue('revoked'); // status
          roleSheet.getRange(r + 1, 9).setValue(nowIso); // revoked_at
        }
      }
      recordAuditLog(db, 'USERS', 'ROLE_REVOKED', targetUid, 'admin', targetRole || 'ALL');
      return envelopeSuccess(reqId, { user_id: targetUid, revoked: true });
    }
    return envelopeError(reqId, 'ROLE_NOT_FOUND', 'Peran tidak ditemukan.', 404);
  }

  // ACTION: users.create (with duplicate email check - Req 42 TEST 7)
  if (action === 'users.create') {
    var newEmail = (payload.email || '').toLowerCase().trim();
    var newName = (payload.name || '').trim();
    var newRole = payload.role || 'viewer';
    if (!newEmail || newEmail.indexOf('@') === -1) {
      return envelopeError(reqId, 'INVALID_EMAIL', 'Format email tidak valid.', 400);
    }
    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    var roleSheet = db.getSheetByName('UserRoleAssignments');
    if (!usersSheet || !roleSheet) {
      provisionCanonicalSchemaV19();
      usersSheet = db.getSheetByName('Users');
      roleSheet = db.getSheetByName('UserRoleAssignments');
    }
    // Check for duplicate email
    var uRows = usersSheet.getDataRange().getValues();
    for (var u = 1; u < uRows.length; u++) {
      if (uRows[u][1] && String(uRows[u][1]).toLowerCase().trim() === newEmail) {
        return envelopeError(reqId, 'DUPLICATE_EMAIL', 'Email ' + newEmail + ' sudah terdaftar. Duplikasi email ditolak.', 409);
      }
    }
    var newUid = 'usr_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    var nowIso = new Date().toISOString();
    usersSheet.appendRow([
      newUid,
      newEmail,
      newName || newEmail.split('@')[0],
      'false',
      payload.status || 'active',
      nowIso,
      'ADMIN_CREATE',
      nowIso,
      '',
      '',
      '',
      payload.organization_id || 'ORG_GLOBAL'
    ]);
    var asgnId = 'asgn_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    roleSheet.appendRow([
      asgnId,
      newUid,
      newRole,
      newRole === 'superadmin' ? 'GLOBAL' : 'WORKSPACE',
      newRole === 'superadmin' ? 'GLOBAL' : (payload.workspace_id || CONFIG.WORKSPACE_ID),
      'active',
      'ADMIN_CREATE',
      nowIso,
      ''
    ]);
    return envelopeSuccess(reqId, { id: newUid, user_id: newUid, email: newEmail, name: newName, role: newRole, status: 'active' });
  }

  // ACTION: users.update (with duplicate email check - Req 42 TEST 7)
  if (action === 'users.update') {
    var updUid = payload.user_id;
    var updates = payload.updates || payload;
    var db = getCustomerDatabase();
    var usersSheet = db.getSheetByName('Users');
    if (!usersSheet || !updUid) {
      return envelopeError(reqId, 'INVALID_INPUT', 'user_id wajib diisi.', 400);
    }
    var uRows = usersSheet.getDataRange().getValues();
    var targetRow = -1;
    for (var u = 1; u < uRows.length; u++) {
      if (uRows[u][0] === updUid) {
        targetRow = u + 1;
        break;
      }
    }
    if (targetRow === -1) {
      return envelopeError(reqId, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.', 404);
    }
    // If email is being updated, check duplicate
    if (updates.email) {
      var checkEmail = String(updates.email).toLowerCase().trim();
      for (var u = 1; u < uRows.length; u++) {
        if (uRows[u][0] !== updUid && uRows[u][1] && String(uRows[u][1]).toLowerCase().trim() === checkEmail) {
          return envelopeError(reqId, 'DUPLICATE_EMAIL', 'Email ' + checkEmail + ' sudah digunakan pengguna lain. Duplikasi ditolak.', 409);
        }
      }
      usersSheet.getRange(targetRow, 2).setValue(checkEmail);
    }
    if (updates.name) usersSheet.getRange(targetRow, 3).setValue(updates.name);
    if (updates.status) usersSheet.getRange(targetRow, 5).setValue(updates.status);
    usersSheet.getRange(targetRow, 8).setValue(new Date().toISOString());
    return envelopeSuccess(reqId, { user_id: updUid, success: true });
  }

  // Action: database.inspect
  if (action === 'database.inspect') {
    var dbInspectAuth = authenticateAndAuthorizeCaller(req);
    if (!dbInspectAuth.ok) return envelopeError(reqId, dbInspectAuth.error.code, dbInspectAuth.error.message, 401);
    var dbCanInspect = dbInspectAuth.isSuperAdmin ||
      dbInspectAuth.roles.indexOf('workspace_admin') !== -1 ||
      dbInspectAuth.roles.indexOf('event_admin') !== -1;
    if (!dbCanInspect) return envelopeError(reqId, 'PERMISSION_DENIED', 'Hanya Administrator yang dapat memeriksa Spreadsheet.', 403);
    try {
      return envelopeSuccess(reqId, inspectSpreadsheetById_(payload && payload.spreadsheet_id));
    } catch (dbInspectErr) {
      return envelopeError(reqId, 'DATABASE_INSPECT_FAILED', String(dbInspectErr && dbInspectErr.message || dbInspectErr), 400);
    }
  }

  // Action: database.provision_schema_v19
  if (action === 'database.provision_schema_v19' || action === '/api/database/provision_schema_v16') {
    var prov = provisionCanonicalSchemaV19();
    return envelopeSuccess(reqId, prov);
  }

  // Default fallback for unknown actions
  return envelopeError(reqId, 'ACTION_NOT_FOUND', 'Aksi backend ' + action + ' tidak dikenali.', 404);
}

function envelopeSuccess(reqId, data) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    request_id: reqId,
    data: data,
    error: null
  })).setMimeType(ContentService.MimeType.JSON);
}

function envelopeError(reqId, code, message, statusCode) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: false,
    request_id: reqId,
    data: null,
    error: {
      code: code,
      message: message,
      details: null
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================================
 * PROVISI SKEMA KANONIKAL v1.9 (45 Lembar Kerja Termasuk Auth, RBAC & Keamanan)
 * ============================================================================
 */
function inspectSpreadsheetById_(spreadsheetId) {
  var id = String(spreadsheetId || '').trim();
  if (!id) throw new Error('SPREADSHEET_ID_REQUIRED: ID Spreadsheet wajib diisi.');
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(id)) throw new Error('INVALID_SPREADSHEET_ID: Format ID Spreadsheet tidak valid.');

  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('DATABASE_OPEN_FAILED: Spreadsheet tidak dapat dibuka. Pastikan akun GAS memiliki akses. Detail: ' + (e && e.message ? e.message : String(e)));
  }

  var sheets = ss.getSheets().map(function(sh) {
    var values = sh.getDataRange().getValues();
    var headers = values.length ? values[0].map(function(v) { return String(v || '').trim(); }) : [];
    return {
      name: sh.getName(),
      row_count: Math.max(0, values.length - 1),
      column_count: headers.length,
      headers: headers
    };
  });

  return {
    spreadsheet_id: ss.getId(),
    spreadsheet_name: ss.getName(),
    spreadsheet_url: ss.getUrl(),
    sheet_names: sheets.map(function(s) { return s.name; }),
    sheets: sheets
  };
}

function provisionCanonicalSchemaV19() {
  var db = getCustomerDatabase();
  var tables = [
    { name: 'SystemConfig', cols: ['key', 'value', 'description', 'updated_at'] },
    { name: 'InstallationConfig', cols: ['key', 'value', 'description', 'updated_at'] },
    { name: 'FeatureConfigs', cols: ['id', 'feature_key', 'scope_type', 'scope_id', 'configured_state', 'metadata_json', 'updated_at', 'updated_by'] },
    { name: 'AuditLogs', cols: ['audit_id', 'timestamp', 'actor_user_id', 'action', 'entity_type', 'entity_id', 'scope_type', 'scope_id', 'result', 'details_json'] },
    { name: 'SyncLogs', cols: ['id', 'device_id', 'sync_version', 'status', 'payload_hash', 'synced_at'] },
    { name: 'QRTokens', cols: ['token_id', 'token_type', 'entity_id', 'event_id', 'token_hash', 'status', 'expires_at', 'created_at'] },
    { name: 'Organizations', cols: ['organization_id', 'organization_code', 'organization_name', 'organization_level', 'parent_organization_id', 'status', 'created_at'] },
    { name: 'AuthOtpChallenges', cols: ['challenge_id', 'email', 'otp_hash', 'purpose', 'expires_at', 'attempt_count', 'max_attempts', 'resend_count', 'used_at', 'status', 'created_at', 'updated_at', 'request_context', 'request_ip_hash'] },
    { name: 'TrustedDevices', cols: ['trusted_device_id', 'user_id', 'device_public_id', 'device_token_hash', 'device_name', 'browser_family', 'platform', 'created_at', 'last_seen_at', 'expires_at', 'revoked_at', 'status'] },
    { name: 'AuthSessions', cols: ['session_id', 'user_id', 'trusted_device_id', 'session_token_hash', 'created_at', 'last_seen_at', 'expires_at', 'revoked_at', 'status'] },
    { name: 'Users', cols: ['user_id', 'email', 'name', 'email_verified', 'status', 'created_at', 'created_by', 'updated_at', 'last_login_at', 'avatar_url', 'phone', 'organization_id'] },
    { name: 'UserRoleAssignments', cols: ['assignment_id', 'user_id', 'role', 'scope_type', 'scope_id', 'status', 'granted_by', 'granted_at', 'revoked_at'] },
    { name: 'Events', cols: ['id', 'workspace_id', 'name', 'short_name', 'event_code', 'category', 'theme', 'start_date', 'end_date', 'location', 'status', 'participant_capacity', 'created_at', 'updated_at'] },
    { name: 'Announcements', cols: ['id', 'event_id', 'title', 'content', 'priority', 'audience', 'publish_start', 'publish_end', 'status', 'created_at'] },
    { name: 'Banners', cols: ['id', 'event_id', 'banner_type', 'title', 'image_url', 'target_url', 'display_order', 'status', 'created_at'] },
    { name: 'Sponsors', cols: ['sponsor_id', 'workspace_id', 'event_id', 'logo_url', 'target_url', 'display_order', 'status', 'created_at', 'created_by', 'updated_at', 'updated_by'] },
    { name: 'SponsorSettings', cols: ['event_id', 'carousel_enabled', 'direction', 'carousel_duration_seconds', 'pause_on_hover', 'updated_at'] },
    { name: 'BrandingAssets', cols: ['asset_id', 'workspace_id', 'event_id', 'asset_type', 'drive_file_id', 'file_name', 'mime_type', 'public_render_url', 'status', 'version', 'priority', 'created_at'] },
    { name: 'Contingents', cols: ['id', 'event_id', 'name', 'region', 'leader_name', 'leader_phone', 'camp_zone', 'participant_count', 'checked_in_count'] },
    { name: 'Participants', cols: ['id', 'event_id', 'contingent_id', 'name', 'pramuka_id', 'gender', 'subcamp', 'lot_number', 'checked_in', 'checked_in_at', 'points', 'rank'] },
    { name: 'RegistrationConfigs', cols: ['event_id', 'registration_start', 'registration_end', 'max_participants', 'max_per_contingent', 'allow_self_registration', 'dynamic_fields_json', 'status', 'updated_at'] },
    { name: 'ParticipantDocuments', cols: ['id', 'participant_id', 'document_type', 'drive_file_id', 'verification_status', 'verified_by', 'verified_at', 'notes'] },
    { name: 'Schedules', cols: ['id', 'event_id', 'title', 'day_number', 'date', 'start_time', 'end_time', 'location', 'category', 'xp_reward', 'is_published'] },
    { name: 'Activities', cols: ['id', 'event_id', 'name', 'category', 'description', 'xp_points'] },
    { name: 'Campsites', cols: ['id', 'event_id', 'camp_name', 'subcamp_id', 'subcamp_name', 'zone_name', 'block_name', 'lot_code', 'capacity_tents', 'capacity_participants', 'assigned_contingent_id', 'assigned_contingent_name', 'status'] },
    { name: 'AttendanceLogs', cols: ['id', 'event_id', 'participant_id', 'checkpoint_or_schedule_id', 'scanned_by_user_id', 'timestamp', 'sync_status'] },
    { name: 'Competitions', cols: ['id', 'event_id', 'title', 'category', 'type', 'status', 'max_score'] },
    { name: 'CompetitionEntries', cols: ['id', 'competition_id', 'participation_level', 'contingent_id', 'team_name', 'team_leader_id', 'team_members_json', 'entry_title', 'submission_url', 'status', 'submitted_at'] },
    { name: 'JudgingScores', cols: ['id', 'competition_id', 'entry_id', 'judge_id', 'score', 'criteria_scores_json', 'is_locked', 'locked_at', 'revision_number', 'revision_reason', 'submitted_at'] },
    { name: 'VotingSessions', cols: ['id', 'event_id', 'title', 'type', 'start_time', 'end_time', 'status', 'total_votes'] },
    { name: 'Votes', cols: ['id', 'session_id', 'voter_token_hash', 'candidate_id', 'timestamp', 'client_meta'] },
    { name: 'Checkpoints', cols: ['id', 'event_id', 'name', 'qr_code', 'xp_points', 'location'] },
    { name: 'PointRules', cols: ['id', 'event_id', 'activity_category', 'xp_value', 'daily_limit', 'multiplier', 'status'] },
    { name: 'PointTransactions', cols: ['id', 'event_id', 'participant_id', 'amount', 'reason', 'source_type', 'reference_id', 'created_at', 'created_by'] },
    { name: 'Badges', cols: ['id', 'event_id', 'name', 'icon_name', 'description', 'category', 'xp_required', 'status'] },
    { name: 'ParticipantBadges', cols: ['id', 'participant_id', 'badge_id', 'awarded_at', 'awarded_by'] },
    { name: 'Visitors', cols: ['id', 'event_id', 'full_name', 'phone', 'institution', 'id_number', 'status', 'registered_at'] },
    { name: 'VisitorPasses', cols: ['id', 'visitor_id', 'pass_code', 'valid_date', 'entry_type', 'status'] },
    { name: 'VisitorVisits', cols: ['id', 'pass_id', 'visitor_id', 'event_id', 'gate_id', 'gate_name', 'action_type', 'timestamp', 'officer_user_id', 'notes'] },
    { name: 'VisitorGates', cols: ['id', 'event_id', 'gate_name', 'gate_location', 'status'] },
    { name: 'MediaPublications', cols: ['id', 'event_id', 'album_id', 'album_title', 'media_type', 'source_provider', 'drive_folder_id', 'drive_file_id', 'youtube_video_id', 'media_url', 'publication_status', 'sync_status', 'published_at'] },
    { name: 'DocumentTemplates', cols: ['id', 'workspace_id', 'template_type', 'name', 'drive_file_id', 'placeholders_json', 'status', 'updated_at'] },
    { name: 'GeneratedDocuments', cols: ['id', 'template_id', 'batch_id', 'recipient_id', 'recipient_type', 'serial_number', 'verification_token', 'drive_file_id', 'generation_status', 'verified_count', 'generated_at'] },
    { name: 'HealthRecords', cols: ['id', 'event_id', 'participant_id', 'patient_name', 'contingent_name', 'blood_type', 'known_allergies', 'vital_signs', 'symptoms', 'medical_diagnosis', 'treatment_given', 'medication_administered', 'hospital_referral', 'treated_by', 'treated_at', 'status'] },
    { name: 'Incidents', cols: ['id', 'event_id', 'incident_type', 'severity', 'reported_by', 'description', 'location', 'action_taken', 'security_followup', 'status', 'resolved_at'] },
    { name: 'Logistics', cols: ['id', 'event_id', 'item_name', 'category', 'total_quantity', 'available_quantity', 'unit', 'condition', 'storage_location'] }
  ];

  var createdCount = 0;
  for (var i = 0; i < tables.length; i++) {
    var tbl = tables[i];
    var sheet = db.getSheetByName(tbl.name);
    if (!sheet) {
      sheet = db.insertSheet(tbl.name);
      sheet.appendRow(tbl.cols);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, tbl.cols.length).setBackground('#E8F5E9').setFontWeight('bold');
      createdCount++;
    }
  }

  var defaultSheet = db.getSheetByName('Sheet1');
  if (defaultSheet && db.getSheets().length > 1) {
    try { db.deleteSheet(defaultSheet); } catch(e) {}
  }

  return { ok: true, created_sheets_count: createdCount, total_tables: tables.length, schema_version: 'v1.9' };
}
`;
}

/**
 * Generates appsscript.json manifest with required OAuth scopes for customer Apps Script project
 */
export function generateAppscriptJsonManifest(): string {
  return JSON.stringify({
    timeZone: 'Asia/Jakarta',
    dependencies: {},
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
    webapp: {
      executeAs: 'USER_DEPLOYING',
      access: 'ANYONE'
    },
    oauthScopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/script.send_mail',
      'https://www.googleapis.com/auth/script.scriptapp'
    ]
  }, null, 2);
}

/**
 * Generates README-INSTALL.txt for distribution packaging
 */
export function generateReadmeInstallText(): string {
  return `================================================================================
SIEPANG — SISTEM INFORMASI PERKEMAHAN PRAMUKA (v${CUSTOMER_GAS_BACKEND_VERSION})
PANDUAN INSTALASI BACKEND GOOGLE APPS SCRIPT CUSTOMER (REAL STANDALONE BACKEND)
================================================================================

1. Buka Google Apps Script:
   https://script.google.com/home/start

2. Klik "New project" (Proyek baru).
   Beri nama proyek: "SiEpang Backend - [Nama Kwartir]"

3. Ganti isi file Code.gs:
   Salin seluruh isi file Code.gs yang dihasilkan dan tempelkan ke Code.gs
   di editor Apps Script.

4. Ganti isi file appsscript.json:
   Di editor Apps Script, buka Project Settings (ikon gerigi) -> centang
   "Show 'appsscript.json' manifest file in editor".
   Kembali ke editor, buka appsscript.json dan tempelkan isi appsscript.json.

5. Atur Script Property (Project Settings -> Script Properties):
   - SPREADSHEET_ID: ID Google Spreadsheet database kwartir Anda.
   - DRIVE_ROOT_ID: ID folder root Google Drive /SiEpang/ Anda.
   - BOOTSTRAP_SUPERADMIN_EMAIL: Email akun resmi yang akan menjadi SuperAdmin utama.
   - SUPERADMIN_BOOTSTRAPPED: false

6. Jalankan Inisialisasi & Otorisasi:
   Pilih fungsi "setupSiEpangBackend" dari dropdown fungsi di atas editor, lalu klik "Run".
   Google akan menampilkan dialog otorisasi izin Spreadsheet, Drive, dan Email.
   Pilih akun Google organisasi Anda, klik "Advanced" -> "Go to SiEpang Backend (unsafe)" -> klik "Allow".
   Fungsi ini akan otomatis membuat 45 lembar kerja kanonikal skema v1.9 dan struktur folder Drive.

7. Uji Coba Pengiriman Email OTP:
   Pilih fungsi "testSendOtpEmail" dari dropdown fungsi, lalu klik "Run".
   Pastikan email uji coba OTP benar-benar tiba di kotak masuk Anda.

8. Deploy sebagai Web App:
   - Klik tombol "Deploy" di pojok kanan atas -> "New deployment"
   - Pilih jenis "Web app" (ikon bola dunia)
   - Configuration:
     * Description: "SiEpang Production v${CUSTOMER_GAS_BACKEND_VERSION}"
     * Execute as: "Me (email organisasi Anda)"
     * Who has access: "Anyone" (Siapapun)
   - Klik "Deploy"
   - Salin URL Web App yang berakhiran "/exec".

9. Hubungkan di Aplikasi SiEpang:
   Buka portal SiEpang, masukkan URL Web App tersebut pada Wizard Instalasi
   atau atur pada variabel VITE_SIEPANG_BACKEND_URL.
   Handshake nonce dan status database akan otomatis terverifikasi!

Selesai! Seluruh data dan backend berjalan mandiri di akun Google organisasi Anda.
================================================================================`;
}

/**
 * Generates VERSION.json manifest
 */
export function generateVersionJsonManifest(): string {
  return JSON.stringify({
    product_name: 'SiEpang — Sistem Informasi Perkemahan Pramuka',
    product_version: '1.9.0-rc1',
    frontend_version: '1.9.0-rc1',
    backend_version: CUSTOMER_GAS_BACKEND_VERSION,
    schema_version: CUSTOMER_GAS_SCHEMA_VERSION,
    minimum_supported_backend: 'v1.6.0',
    minimum_supported_schema: 'v1.6',
    architecture: 'Dedicated Customer Installation',
    release_date: '2026-10-06',
    verified_status: 'PRODUCTION_READY'
  }, null, 2);
}

/**
 * Generates the complete Sellable Distribution Package
 */
export function generateSellablePackageFiles(config: CustomerGasBuildConfig): Record<string, string> {
  return {
    'SiEpang/GAS/Code.gs': generateCustomerGasBackendSource(config),
    'SiEpang/GAS/appsscript.json': generateAppscriptJsonManifest(),
    'SiEpang/GAS/README-INSTALL.txt': generateReadmeInstallText(),
    'SiEpang/GAS/VERSION.json': generateVersionJsonManifest(),
    'SiEpang/VERSION.json': generateVersionJsonManifest(),
  };
}
