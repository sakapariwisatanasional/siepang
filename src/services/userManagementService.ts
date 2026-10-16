/**
 * @license
 * SiEpang - Online User & Role Management Service
 * Manages user accounts, invitations, role assignments, activation status,
 * and structured permission matrices grouped into 13 operational domains.
 * All mutations persist directly to the customer-owned Google Spreadsheet.
 */

import { User, UserRole, TrustedDeviceRecord } from '../types';
import { apiTransport } from './apiTransport';

export interface ManagedUser extends User {
  status: 'active' | 'inactive';
  lastLogin: string;
  organizationName?: string;
  createdAt: string;
}

export interface PermissionGroup {
  id: string;
  title: string;
  description: string;
  permissions: {
    code: string;
    label: string;
    description: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'grp_event',
    title: 'Pengelolaan Event Aktif',
    description: 'Pengaturan identitas event, siklus hidup, dan konfigurasi fitur.',
    permissions: [
      { code: 'event.view', label: 'Lihat Informasi Event', description: 'Melihat detail publik dan jadwal event' },
      { code: 'event.update', label: 'Ubah Pengaturan Event', description: 'Memperbarui tema, tanggal, dan deskripsi event' },
      { code: 'event.archive', label: 'Arsipkan Event', description: 'Menutup dan mengarsipkan seluruh data event' },
    ],
  },
  {
    id: 'grp_participants',
    title: 'Peserta & Kontingen',
    description: 'Verifikasi biodata pramuka, pengelompokan regu/sangga, dan cetak kartu.',
    permissions: [
      { code: 'participant.view', label: 'Lihat Daftar Peserta', description: 'Melihat data anggota kontingen' },
      { code: 'participant.verify', label: 'Verifikasi Berkas Peserta', description: 'Memeriksa keabsahan KTA dan surat izin' },
      { code: 'participant.approve', label: 'Persetujuan Akhir Peserta', description: 'Mengesahkan status kepesertaan' },
      { code: 'contingent.manage', label: 'Kelola Regu / Kontingen Event', description: 'Menetapkan pimpinan kontingen dan kuota' },
    ],
  },
  {
    id: 'grp_registration',
    title: 'Pendaftaran & Formulir Dinamis',
    description: 'Konfigurasi formulir dinamis, kuota pendaftaran, dan gelombang registrasi.',
    permissions: [
      { code: 'registration.config', label: 'Konfigurasi Formulir', description: 'Menambah dan mengubah kolom formulir' },
      { code: 'registration.open_close', label: 'Buka / Tutup Registrasi', description: 'Mengatur periode pendaftaran' },
    ],
  },
  {
    id: 'grp_schedule',
    title: 'Jadwal & Agenda Kegiatan',
    description: 'Penyusunan jadwal kegiatan perkemahan dan deteksi bentrok jadwal.',
    permissions: [
      { code: 'schedule.view', label: 'Lihat Jadwal', description: 'Melihat agenda perkemahan' },
      { code: 'schedule.create', label: 'Tambah Agenda', description: 'Membuat jadwal baru di timeline' },
      { code: 'schedule.update', label: 'Ubah & Pindah Jadwal', description: 'Menggeser jam atau hari kegiatan' },
      { code: 'schedule.publish', label: 'Publikasikan Jadwal', description: 'Menampilkan jadwal ke aplikasi peserta' },
    ],
  },
  {
    id: 'grp_campsite',
    title: 'Kavling Tenda & Bumi Perkemahan',
    description: 'Pemetaan sub-camp, zona putra/putri, blok kavling, dan fasilitas MCK/air.',
    permissions: [
      { code: 'campsite.view', label: 'Lihat Denah Kavling', description: 'Melihat pembagian kavling tenda' },
      { code: 'campsite.assign', label: 'Penetapan Kavling', description: 'Menempatkan kontingen ke kavling tertentu' },
      { code: 'facility.manage', label: 'Kelola Fasilitas Buper', description: 'Menandai posko medis, MCK, dan musholla' },
    ],
  },
  {
    id: 'grp_competition',
    title: 'Lomba & Penjurian',
    description: 'Kriteria rubrik penilaian, penugasan dewan juri, dan penguncian nilai.',
    permissions: [
      { code: 'competition.view', label: 'Lihat Daftar Lomba', description: 'Melihat cabang lomba yang aktif' },
      { code: 'competition.manage', label: 'Kelola Kriteria Lomba', description: 'Menyusun rubrik bobot nilai 100%' },
      { code: 'judge.assign', label: 'Tugaskan Dewan Juri', description: 'Menunjuk juri pada cabang lomba' },
      { code: 'judge.score', label: 'Input Nilai Juri', description: 'Memberikan skor pada karya peserta' },
      { code: 'judge.lock', label: 'Kunci Nilai Resmi', description: 'Mengunci nilai agar tidak bisa diubah' },
    ],
  },
  {
    id: 'grp_voting',
    title: 'Voting Apresiasi Karya',
    description: 'Apresiasi karya video/foto favorit oleh peserta dan publik.',
    permissions: [
      { code: 'voting.vote', label: 'Berikan Suara Voting', description: 'Memilih karya favorit sesuai kuota' },
      { code: 'voting.manage', label: 'Konfigurasi Voting', description: 'Mengatur batas suara dan bobot publik' },
    ],
  },
  {
    id: 'grp_points',
    title: 'Poin XP & Lencana Pramuka',
    description: 'Buku besar gamifikasi XP, scan presensi apel, dan klaim lencana digital.',
    permissions: [
      { code: 'points.award', label: 'Anugerahkan Poin XP', description: 'Memberi XP dari giat prestasi' },
      { code: 'attendance.scan', label: 'Scan QR Presensi', description: 'Mencatat kehadiran apel dan giat' },
      { code: 'badge.manage', label: 'Kelola Lencana Digital', description: 'Menerbitkan lencana pencapaian' },
    ],
  },
  {
    id: 'grp_documents',
    title: 'Dokumen & Sertifikat Digital',
    description: 'Desain templat ID Card, nomor piagam penghargaan, dan verifikasi QR publik.',
    permissions: [
      { code: 'document.id_card', label: 'Cetak Massal ID Card', description: 'Menghasilkan kartu tanda peserta' },
      { code: 'document.certificate', label: 'Terbitkan Piagam', description: 'Menghasilkan e-sertifikat ber-QR' },
      { code: 'document.verify', label: 'Verifikasi Keaslian', description: 'Memvalidasi QR piagam penghargaan' },
    ],
  },
  {
    id: 'grp_health',
    title: 'Posko Kesehatan & Medis',
    description: 'Pencatatan insiden medis, riwayat alergi, dan rujukan darurat.',
    permissions: [
      { code: 'health.manage', label: 'Kelola Catatan Medis', description: 'Mencatat triase dan rekam medis pasien' },
      { code: 'health.emergency', label: 'Panggilan Darurat', description: 'Mengaktifkan sirene siaga posko' },
    ],
  },
  {
    id: 'grp_logistics',
    title: 'Logistik & Inventaris Tenda',
    description: 'Peminjaman perlengkapan pioneering, sound system, dan konsumsi.',
    permissions: [
      { code: 'logistics.manage', label: 'Kelola Barang Buper', description: 'Mencatat stok dan sirkulasi peminjaman' },
    ],
  },
  {
    id: 'grp_audit',
    title: 'Audit Trail & Keamanan',
    description: 'Pemeriksaan jejak rekam mutasi administratif dan keamanan sistem.',
    permissions: [
      { code: 'audit.view', label: 'Lihat Audit Trail', description: 'Memantau log aktivitas administrator' },
    ],
  },
  {
    id: 'grp_settings',
    title: 'Pengaturan Aplikasi & Akun',
    description: 'Identitas penyelenggara, konfigurasi sistem, dan pengelolaan akun panitia.',
    permissions: [
      { code: 'settings.workspace', label: 'Pengaturan Konteks Aplikasi', description: 'Mengelola konfigurasi sistem dan Google Drive yang digunakan event' },
      { code: 'settings.users', label: 'Kelola Hak Akses Panitia', description: 'Menambah dan menetapkan peran panitia' },
    ],
  },
];

export const ROLE_PERMISSION_MAP: Record<UserRole, string[]> = {
  superadmin: [
    'event.view', 'event.update', 'event.archive',
    'participant.view', 'participant.verify', 'participant.approve', 'contingent.manage',
    'registration.config', 'registration.open_close',
    'schedule.view', 'schedule.create', 'schedule.update', 'schedule.publish',
    'campsite.view', 'campsite.assign', 'facility.manage',
    'competition.view', 'competition.manage', 'judge.assign', 'judge.score', 'judge.lock',
    'voting.vote', 'voting.manage',
    'points.award', 'attendance.scan', 'badge.manage',
    'document.id_card', 'document.certificate', 'document.verify',
    'health.manage', 'health.emergency',
    'logistics.manage',
    'audit.view',
    'settings.workspace', 'settings.users',
  ],
  workspace_admin: [
    'event.view', 'event.update',
    'participant.view', 'participant.verify', 'participant.approve', 'contingent.manage',
    'registration.config', 'registration.open_close',
    'schedule.view', 'schedule.create', 'schedule.update', 'schedule.publish',
    'campsite.view', 'campsite.assign', 'facility.manage',
    'competition.view', 'competition.manage', 'judge.assign', 'judge.score', 'judge.lock',
    'voting.manage',
    'points.award', 'attendance.scan', 'badge.manage',
    'document.id_card', 'document.certificate', 'document.verify',
    'health.manage',
    'logistics.manage',
    'audit.view',
    'settings.workspace', 'settings.users',
  ],
  event_admin: [
    'event.view', 'event.update',
    'participant.view', 'participant.verify', 'contingent.manage',
    'schedule.view', 'schedule.create', 'schedule.update', 'schedule.publish',
    'campsite.view', 'campsite.assign', 'facility.manage',
    'competition.view', 'competition.manage', 'judge.assign',
    'voting.manage',
    'points.award', 'attendance.scan', 'badge.manage',
    'document.id_card', 'document.verify',
    'health.manage',
    'logistics.manage',
  ],
  kontingen_admin: [
    'event.view',
    'participant.view', 'contingent.manage',
    'schedule.view',
    'campsite.view',
    'competition.view',
    'voting.vote',
    'document.verify',
  ],
  registration_officer: [
    'event.view',
    'participant.view', 'participant.verify', 'participant.approve',
    'document.id_card', 'document.verify',
    'schedule.view',
  ],
  judge: [
    'event.view',
    'competition.view', 'judge.score', 'judge.lock',
    'schedule.view',
  ],
  attendance_officer: [
    'event.view',
    'attendance.scan', 'points.award',
    'participant.view',
    'schedule.view',
  ],
  health_officer: [
    'event.view',
    'health.manage', 'health.emergency',
    'participant.view',
    'schedule.view',
  ],
  logistic_officer: [
    'event.view',
    'logistics.manage',
    'campsite.view',
  ],
  ceremony_officer: [
    'event.view',
    'schedule.view',
    'attendance.scan',
  ],
  committee: [
    'event.view',
    'schedule.view',
    'attendance.scan',
    'points.award',
  ],
  viewer: [
    'event.view',
    'schedule.view',
    'competition.view',
  ],
  participant: [
    'event.view',
    'schedule.view',
    'competition.view',
    'voting.vote',
    'document.verify',
  ],
  documentation_officer: [
    'event.view',
    'schedule.view',
    'documentation.read',
    'documentation.create',
    'documentation.update',
    'documentation.publish',
    'documentation.archive',
    'documentation.manage',
  ],
  publication_officer: [
    'event.view',
    'schedule.view',
    'banner.read',
    'banner.create',
    'banner.update',
    'banner.publish',
    'banner.archive',
    'banner.manage',
    'sponsor.read',
    'sponsor.create',
    'sponsor.update',
    'sponsor.publish',
    'sponsor.manage',
  ],
};

export class UserManagementService {
  private users: ManagedUser[] = [];
  private listeners: Set<() => void> = new Set();
  private isLoading = false;

  constructor() {
    // Tidak request users.list pada saat import modul.
    // Muat hanya saat layar pengguna atau aksi admin benar-benar memerlukannya.
  }

  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem('siepang_users_cache');
      if (cached) {
        this.users = JSON.parse(cached);
      }
    } catch {
      this.users = [];
    }
  }

  private saveToCache(): void {
    try {
      localStorage.setItem('siepang_users_cache', JSON.stringify(this.users));
    } catch {
      // Ignore storage errors
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb());
  }

  public async refreshUsers(): Promise<ManagedUser[]> {
    if (this.isLoading) return this.users;
    this.isLoading = true;

    try {
      if (typeof apiTransport === 'undefined' || !apiTransport?.send) {
        throw new Error('Transport GAS tidak tersedia.');
      }

      const res = await apiTransport.send<ManagedUser[]>('users.list', {}, { timeoutMs: 45000 });
      if (!res.ok) throw new Error(res.error?.message || 'Gagal mengambil pengguna dari Google Apps Script.');
      if (!Array.isArray(res.data)) throw new Error('Format users.list dari GAS tidak valid (data bukan array).');
      if (res.ok && Array.isArray(res.data)) {
        this.users = res.data.map(u => ({
          ...u,
          avatar: u.avatar || '',
          organizationName: u.organizationName || 'Gerakan Pramuka',
          status: u.status || 'active',
          lastLogin: u.lastLogin || 'Belum pernah login',
          createdAt: u.createdAt || new Date().toISOString().split('T')[0],
        }));
        // Jangan injeksikan akun bootstrap lokal ke daftar pengguna GAS.
        this.notify();
      }
    } catch (e) {
      console.warn('Failed to load users from backend:', e);
      throw e;
    } finally {
      this.isLoading = false;
    }

    return [...this.users];
  }

  /**
   * Idempotent Initial SuperAdmin Seeding (Requirements 32, 33, 36, 37)
   * Verifies the configured bootstrap administrator from authoritative GAS data.
   * Prevents duplicates, normalizes email, and ties to authoritative workspace.
   */
  /**
   * Verify the bootstrap administrator from the authoritative GAS Users/roles data.
   * This method never creates or injects a browser-local superadmin.
   */
  public async ensureBootstrapSuperadmin(workspaceId?: string): Promise<ManagedUser> {
    const users = await this.refreshUsers();
    const active = users.find(user =>
      user.status === 'active' &&
      user.role === 'superadmin' &&
      (!workspaceId || user.workspaceId === workspaceId)
    );
    if (!active) {
      throw new Error('BOOTSTRAP_SUPERADMIN_NOT_FOUND: Administrator awal belum aktif pada data GAS.');
    }
    return active;
  }

  public getUsers(): ManagedUser[] {
    return [...this.users];
  }

  public listUsers(workspaceId?: string): ManagedUser[] {
    if (workspaceId) {
      return this.users.filter(u => u.workspaceId === workspaceId);
    }
    return [...this.users];
  }

  /**
   * Pembuatan akun memerlukan endpoint GAS berizin yang belum tersedia pada Code.gs terverifikasi.
   * Jangan menciptakan akun palsu pada cache atau memberikan role dari browser.
   */
  public async addUser(_data: {
    name: string;
    email: string;
    role: UserRole;
    workspaceId: string;
    organizationName?: string;
    status?: 'active' | 'inactive';
  }): Promise<ManagedUser> {
    throw new Error('Pembuatan akun melalui dashboard belum tersedia di backend GAS aktif. Gunakan alur undangan/OTP yang sudah terotorisasi sampai endpoint admin dibuat.');
  }

  /** Jangan mengubah cache untuk operasi yang backend-nya belum ada. */
  public async updateUser(_userId: string, _updates: Partial<ManagedUser>): Promise<ManagedUser> {
    throw new Error('users.update belum tersedia di router GAS aktif. Data user tidak diubah.');
  }

  /** Read authoritative active assignments for this installation from GAS. */
  public async listActiveRoleAssignments(userId: string): Promise<Array<{assignment_id:string;role:UserRole;scope_type:string;scope_id:string}>> {
    const res = await apiTransport.send<{user_id:string;assignments:Array<{assignment_id:string;role:UserRole;scope_type:string;scope_id:string}>}>('users.roles.list', {user_id:userId},{timeoutMs:45000});
    if (!res.ok || res.data?.user_id !== userId || !Array.isArray(res.data.assignments))
      throw new Error(res.error?.message || 'Gagal membaca penugasan aktif dari GAS.');
    return res.data.assignments;
  }

  /** Additive grant. Never revokes old roles; confirms the exact assignment by readback. */
  public async grantAdditionalRoles(userId:string, roles:UserRole[], scopeType:'EVENT'|'WORKSPACE'='EVENT'): Promise<void> {
    const unique = Array.from(new Set(roles));
    if (!unique.length) throw new Error('Pilih minimal satu role.');
    for (const role of unique) {
      const res = await apiTransport.send<{assignment_id:string;user_id:string;role:UserRole;scope_type:string;scope_id:string;verified:boolean}>('users.assignRole',
        {user_id:userId,role,scope_type:scopeType}, {timeoutMs:60000});
      if (!res.ok || res.data?.user_id !== userId || res.data?.role !== role || res.data?.verified !== true)
        throw new Error(`Role ${role} belum dapat diverifikasi: ${res.error?.message || 'Periksa Spreadsheet sebelum mencoba ulang.'}`);
      const current = await this.listActiveRoleAssignments(userId);
      if (!current.some(a=>a.role===role && a.scope_type===scopeType))
        throw new Error(`Penugasan ${role} belum ditemukan saat pembacaan ulang. Jangan ulangi sebelum memeriksa GAS.`);
    }
    await this.refreshUsers();
  }

  /** Role diberikan server-side, kemudian daftar dibaca ulang. */
  public async updateUserRole(userId: string, newRole: UserRole): Promise<ManagedUser> {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    // GAS can wait for a script lock and then write to Sheets. A client timeout
    // does not mean the write was rolled back. Never blindly retry this mutation.
    const res = await apiTransport.send<{ assignment_id: string; user_id: string; role: UserRole }>('users.assignRole', {
      user_id: userId,
      role: newRole,
      permissions: ROLE_PERMISSION_MAP[newRole] || [],
    }, { timeoutMs: 60000 });
    if (!res.ok || res.data?.user_id !== userId || res.data?.role !== newRole || !res.data?.assignment_id) {
      throw new Error(res.error?.message || 'Backend tidak mengonfirmasi penugasan role.');
    }
    await this.refreshUsers();
    const confirmed = this.users.find(u => u.id === userId);
    if (!confirmed || confirmed.role !== newRole) throw new Error('GAS mengonfirmasi penugasan, tetapi daftar pengguna belum mencerminkan role baru. Periksa UserRoleAssignments.');
    return confirmed;
  }

  /** Status akun hanya berubah sesudah GAS mengonfirmasi enable/disable. */
  public async toggleUserStatus(userId: string): Promise<ManagedUser> {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    const target = user.status === 'active' ? 'inactive' : 'active';
    const action = target === 'active' ? 'users.enable' : 'users.disable';
    const res = await apiTransport.send<{ user_id: string; status: string }>(action, { user_id: userId });
    if (!res.ok || res.data?.user_id !== userId || res.data?.status !== target) {
      throw new Error(res.error?.message || 'Backend tidak mengonfirmasi perubahan status user.');
    }
    user.status = target;
    this.notify();
    return user;
  }

  /** Mencabut semua role yang aktif (bukan mengubah label lokal saja). */
  public async revokeUserRole(userId: string): Promise<ManagedUser> {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    const res = await apiTransport.send<{ user_id: string; revoked: boolean }>('users.revokeRole', { user_id: userId });
    if (!res.ok || res.data?.user_id !== userId || res.data?.revoked !== true) {
      throw new Error(res.error?.message || 'Backend tidak mengonfirmasi pencabutan role.');
    }
    await this.refreshUsers();
    return this.users.find(u => u.id === userId) || { ...user, role: 'viewer' };
  }

  public async logoutUserFromAllDevices(userId: string): Promise<boolean> {
    try {
      const res = await apiTransport.send('auth.logoutAll', { user_id: userId });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async listUserTrustedDevices(userId: string): Promise<TrustedDeviceRecord[]> {
    try {
      const res = await apiTransport.send<TrustedDeviceRecord[]>('auth.devices.list', { user_id: userId });
      return res.ok && Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  public async revokeUserDevice(devicePublicId: string): Promise<boolean> {
    try {
      const res = await apiTransport.send('auth.devices.revoke', { device_public_id: devicePublicId });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Nonaktifkan akun, jangan pernah menghapus record Users dari daftar lokal sebelum konfirmasi GAS. */
  public async removeUser(userId: string): Promise<void> {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    const res = await apiTransport.send<{ user_id: string; status: string }>('users.disable', { user_id: userId });
    if (!res.ok || res.data?.user_id !== userId || res.data?.status !== 'inactive') {
      throw new Error(res.error?.message || 'GAS gagal menonaktifkan akun. Data tetap dipertahankan.');
    }
    user.status = 'inactive';
    this.notify();
  }

  public getPermissionGroups(): PermissionGroup[] {
    return PERMISSION_GROUPS;
  }
}

export const userManagementService = new UserManagementService();
