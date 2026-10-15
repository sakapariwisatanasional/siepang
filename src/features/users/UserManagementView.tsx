/**
 * @license
 * SiEpang - Online User Management & RBAC Permissions Matrix
 * Manages authorized users, role assignments, activation status,
 * and structured permission matrices across 13 operational domains.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Key,
  Lock,
  Layers,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  Info,
  Smartphone,
  Laptop,
  Trash2,
  LogOut,
  Eye,
  UserCheck,
} from 'lucide-react';
import { UserRole, Workspace, TrustedDeviceRecord } from '../../types';
import {
  userManagementService,
  ManagedUser,
  PERMISSION_GROUPS,
  ROLE_PERMISSION_MAP,
} from '../../services/userManagementService';
import { workspaceService } from '../../services/workspaceService';
import { organizationService } from '../../services/organizationService';
import { onlineSessionService } from '../../services/onlineSessionService';
import { profilePhotoService } from '../../services/profilePhotoService';
import { eventCommitteeService, type CommitteeMember } from '../../services/eventCommitteeService';
import { ProfilePhotoUploader } from '../../components/media/ProfilePhotoUploader';

/**
 * Avatar is rendered only from the URL returned by GAS. If the remote
 * Drive image is inaccessible, show initials instead of a broken <img>.
 * No placeholder URL, localStorage, or simulated user photo is used.
 */
const ManagedUserAvatar: React.FC<{ name: string; src?: string | null; size?: 'small' | 'large' }> = ({ name, src, size = 'small' }) => {
  const [failed, setFailed] = useState(false);
  const imageUrl = typeof src === 'string' && /^https:\/\//i.test(src.trim()) ? src.trim() : '';
  useEffect(() => { setFailed(false); }, [imageUrl]);
  const initials = (name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
  const dimensions = size === 'large' ? 'w-12 h-12' : 'w-10 h-10';
  const classes = `${dimensions} rounded-2xl border border-[#ECECEF] dark:border-white/10 shrink-0`;
  if (!imageUrl || failed) {
    return <div className={`${classes} flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 font-bold text-xs`} role="img" aria-label={`Foto profil ${name} tidak tersedia`}>{initials}</div>;
  }
  return <img key={imageUrl} src={imageUrl} alt={`Foto profil ${name}`} className={`${classes} object-cover bg-[#FAFAFA] dark:bg-slate-800`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
};

const ROLE_LABELS: Record<UserRole, { label: string; badge: string; desc: string }> = {
  superadmin: {
    label: 'Administrator Sistem',
    badge: 'bg-red-950/80 text-red-300 border-red-500/30',
    desc: 'Pengelola tertinggi sistem SiEpang dan konfigurasi event aktif.',
  },
  workspace_admin: {
    label: 'Administrator Operasional',
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30',
    desc: 'Mengelola akun petugas dan operasional event aktif.',
  },
  event_admin: {
    label: 'Admin Event / Panitia Inti',
    badge: 'bg-sky-950/80 text-sky-300 border-sky-500/30',
    desc: 'Pengatur jadwal, kavling tenda, pendaftaran, dan aktivitas.',
  },
  kontingen_admin: {
    label: 'Pembina / Pinkon',
    badge: 'bg-amber-950/80 text-amber-300 border-amber-500/30',
    desc: 'Mengelola peserta atau regu yang ditugaskan dalam event.',
  },
  registration_officer: {
    label: 'Petugas Verifikasi Berkas',
    badge: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/30',
    desc: 'Verifikator dokumen KTA, asuransi, dan mandat peserta.',
  },
  attendance_officer: {
    label: 'Petugas Presensi Buper',
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30',
    desc: 'Pindai barcode QR check-in gapura & checkpoint.',
  },
  judge: {
    label: 'Dewan Juri Lomba',
    badge: 'bg-purple-950/80 text-purple-300 border-purple-500/30',
    desc: 'Penilai karya, rubrik skor lomba, dan pengunci nilai.',
  },
  health_officer: {
    label: 'Petugas Medis / P3K',
    badge: 'bg-rose-950/80 text-rose-300 border-rose-500/30',
    desc: 'Catatan rekam medis, rujukan, dan insiden posko kesehatan.',
  },
  logistic_officer: {
    label: 'Petugas Gudang Logistik',
    badge: 'bg-orange-950/80 text-orange-300 border-orange-500/30',
    desc: 'Penerimaan dan distribusi perlengkapan perkemahan.',
  },
  ceremony_officer: {
    label: 'Petugas Upacara & Protokoler',
    badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30',
    desc: 'Pengatur apel pagi/sore dan penataan barisan kontingen.',
  },
  documentation_officer: {
    label: 'Petugas Dokumentasi & Media',
    badge: 'bg-violet-950/80 text-violet-300 border-violet-500/30',
    desc: 'Pengunggah dan kurator foto album Drive serta video kegiatan.',
  },
  publication_officer: {
    label: 'Petugas Publikasi & Sponsor',
    badge: 'bg-amber-950/80 text-amber-300 border-amber-500/30',
    desc: 'Pengelola hero banner, pengumuman publik, dan logo sponsor.',
  },
  committee: {
    label: 'Panitia Lapangan',
    badge: 'bg-teal-950/80 text-teal-300 border-teal-500/30',
    desc: 'Fasilitator pos kegiatan dan giat perkemahan.',
  },
  viewer: {
    label: 'Pengamat / Tamu Kehormatan',
    badge: 'bg-slate-900 text-slate-300 border-slate-700',
    desc: 'Akses lihat jadwal publik dan papan perolehan nilai.',
  },
  participant: {
    label: 'Peserta Pramuka Aktif',
    badge: 'bg-green-950/80 text-green-300 border-green-500/30',
    desc: 'Pramuka Penggalang, Penegak, atau Pandega peserta kegiatan.',
  },
};

// Jabatan organisasi tidak sama dengan role GAS. Rekomendasi di bawah tidak otomatis
// memberikan izin, agar akun yang ada tidak berubah tanpa tindakan admin.
const COMMITTEE_ROLE_GUIDANCE: ReadonlyArray<{ title: string; roles: UserRole[] }> = [
  { title: 'Pelindung', roles: ['viewer'] },
  { title: 'Penasehat', roles: ['viewer'] },
  { title: 'Ketua pelaksana', roles: ['event_admin'] },
  { title: 'Sekretaris', roles: ['committee'] },
  { title: 'Bendahara', roles: ['committee'] },
  { title: 'Koordinator lapangan', roles: ['committee'] },
  { title: 'Bid. Kesekretariatan, kerjasama dan pameran', roles: ['committee'] },
  { title: 'Bid. Kegiatan', roles: ['committee', 'judge', 'attendance_officer'] },
  { title: 'Bid. Perkemahan', roles: ['committee'] },
  { title: 'Bid. Keagamaan', roles: ['committee'] },
  { title: 'Bid. Sarana, prasarana dan keamanan', roles: ['logistic_officer'] },
  { title: 'Bid. Kesehatan', roles: ['health_officer'] },
  { title: 'Bid. Pengawasan dan Evaluasi', roles: ['viewer'] },
  { title: 'Bid. Konsumsi', roles: ['logistic_officer'] },
  { title: 'Bid. Humas', roles: ['publication_officer'] },
  { title: 'Bid. Dokumentasi dan publikasi', roles: ['documentation_officer', 'publication_officer'] },
  { title: 'Sangga kerja', roles: ['committee'] },
];
const normalizeCommitteeTitle = (value: string) => value.toLocaleLowerCase('id-ID').trim().replace(/\s+/g, ' ');

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>(userManagementService.getUsers());
  const [workspaces, setWorkspaces] = useState<Workspace[]>(workspaceService.getWorkspaces());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'session'>('users');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [editingUser, setEditingUser] = useState<Partial<ManagedUser> | null>(null);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [committeeError, setCommitteeError] = useState('');

  // User Detail Modal State (Requirement 15)
  const [detailUser, setDetailUser] = useState<ManagedUser | null>(null);
  const [detailDevices, setDetailDevices] = useState<TrustedDeviceRecord[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  const handleOpenDetail = async (user: ManagedUser) => {
    setDetailUser(user);
    setIsLoadingDevices(true);
    const devs = await userManagementService.listUserTrustedDevices(user.id);
    setDetailDevices(devs);
    setIsLoadingDevices(false);
  };

  const handleRevokeDeviceFromDetail = async (devicePublicId: string) => {
    if (confirm('Cabut akses untuk perangkat terpercaya ini?')) {
      await userManagementService.revokeUserDevice(devicePublicId);
      if (detailUser) {
        const devs = await userManagementService.listUserTrustedDevices(detailUser.id);
        setDetailDevices(devs);
      }
    }
  };

  // Selected Role for Matrix inspector
  const [matrixRole, setMatrixRole] = useState<UserRole>('workspace_admin');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('grp_event');

  type UserSubTab = 'ALL' | 'NEW' | 'UNASSIGNED' | 'OFFICERS' | 'ADMINS' | 'DISABLED';
  const [userSubTab, setUserSubTab] = useState<UserSubTab>('ALL');

  useEffect(() => {
    const unsub = userManagementService.subscribe(() => {
      setUsers(userManagementService.getUsers());
    });
    void loadRegisteredUsers();
    return () => unsub();
  }, []);

  const loadRegisteredUsers = async () => {
    setIsLoadingUsers(true);
    setUsersError('');
    try {
      const fetched = await userManagementService.refreshUsers();
      setUsers(fetched);
    } catch (error: any) {
      setUsersError(error?.message || 'Gagal mengambil daftar pengguna dari GAS.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const registeredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    return users.filter(user => user.id && user.status === 'active' &&
      (!q || `${user.name} ${user.email} ${user.organizationName || ''}`.toLowerCase().includes(q)));
  }, [users, candidateSearch]);

  const filteredUsers = useMemo(() => {
    let result = users;

    // Filter by Sub-Tab (Requirement 15)
    if (userSubTab === 'NEW') {
      result = result.filter(u => u.lastLogin === 'Belum pernah' || u.lastLogin === 'Belum pernah login');
    } else if (userSubTab === 'UNASSIGNED') {
      result = result.filter(u => u.role === 'viewer');
    } else if (userSubTab === 'OFFICERS') {
      const officerRoles: UserRole[] = [
        'registration_officer',
        'attendance_officer',
        'judge',
        'health_officer',
        'logistic_officer',
        'ceremony_officer',
        'documentation_officer',
        'publication_officer',
        'committee',
        'kontingen_admin',
      ];
      result = result.filter(u => officerRoles.includes(u.role));
    } else if (userSubTab === 'ADMINS') {
      const adminRoles: UserRole[] = ['superadmin', 'workspace_admin', 'event_admin'];
      result = result.filter(u => adminRoles.includes(u.role));
    } else if (userSubTab === 'DISABLED') {
      result = result.filter(u => u.status === 'inactive');
    }

    if (selectedRoleFilter !== 'ALL') {
      result = result.filter(u => u.role === selectedRoleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        u =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.organizationName && u.organizationName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [users, userSubTab, selectedRoleFilter, searchQuery]);

  const handleToggleStatus = async (userId: string) => {
    try { await userManagementService.toggleUserStatus(userId); await userManagementService.refreshUsers(); }
    catch (e: any) { alert('Gagal mengubah status: ' + (e?.message || String(e))); }
  };

  const handleRevokeRole = async (userId: string) => {
    if (confirm('Cabut seluruh peran khusus pengguna ini? Pengguna akan kembali menjadi akun standar tanpa hak akses operasional.')) {
      await userManagementService.revokeUserRole(userId);
    }
  };

  const handleLogoutAllDevices = async (userId: string) => {
    if (confirm('Keluarkan pengguna ini dari semua perangkat terpercaya? Sesi aktif di seluruh browser akan dicabut.')) {
      await userManagementService.logoutUserFromAllDevices(userId);
      alert('Pengguna berhasil dikeluarkan dari semua perangkat.');
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setCandidateSearch('');
    setIsModalOpen(true);
    void loadRegisteredUsers();
  };

  useEffect(() => {
    if (!isModalOpen) return;
    let active = true;
    setCommitteeError('');
    void eventCommitteeService.load().then(doc => {
      if (active) setCommitteeMembers(doc.members);
    }).catch(error => {
      if (active) { setCommitteeMembers([]); setCommitteeError(error instanceof Error ? error.message : 'Tidak dapat membaca jabatan dari GAS.'); }
    });
    return () => { active = false; };
  }, [isModalOpen]);

  const linkedCommitteePositions = editingUser?.id
    ? committeeMembers.filter(member => member.userId === editingUser.id).map(member => member.position)
    : [];
  const linkedRoleRecommendations = Array.from(new Set(linkedCommitteePositions.flatMap(position =>
    COMMITTEE_ROLE_GUIDANCE.find(entry => normalizeCommitteeTitle(entry.title) === normalizeCommitteeTitle(position))?.roles || []
  )));

  const handleSelectRegisteredUser = (user: ManagedUser) => {
    setEditingUser({ ...user });
  };

  const handleOpenEdit = (user: ManagedUser) => {
    setEditingUser({ ...user });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingUser || !editingUser) return;
    if (!editingUser.id) {
      alert('Pembuatan akun belum tersedia pada endpoint GAS terverifikasi. Gunakan proses undangan/OTP; tidak ada akun lokal dibuat.');
      return;
    }
    const previous = users.find(u => u.id === editingUser.id);
    if (!previous) { alert('Pengguna tidak ditemukan dalam daftar GAS.'); return; }
    // Form ini khusus perubahan role; perubahan profil memerlukan endpoint sendiri.
    if (editingUser.name !== previous.name || editingUser.email !== previous.email ||
        editingUser.organizationName !== previous.organizationName ||
        editingUser.status !== previous.status ||
        (editingUser.profile_photo_file_id || '') !== (previous.profile_photo_file_id || '')) {
      alert('Form Ubah Peran hanya menyimpan role. Nama, email, foto, instansi dan status akun jangan diubah di sini; perubahan profil belum mempunyai endpoint tersendiri.');
      return;
    }
    if (!editingUser.role) { alert('Pilih role yang valid.'); return; }
    setIsSavingUser(true);
    try {
      const saved = await userManagementService.updateUserRole(previous.id, editingUser.role);
      if (saved.role !== editingUser.role) throw new Error('Role hasil refresh berbeda dari yang dipilih.');
      setIsModalOpen(false);
      setEditingUser(null);
      alert('Role berhasil disimpan di GAS dan dikonfirmasi setelah pembacaan ulang.');
    } catch (error: any) {
      alert('Gagal menyimpan role ke GAS: ' + (error?.message || String(error)));
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0F4] border border-[#FFE0E8] text-xs font-semibold text-[#F47743] mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Akun dan Hak Akses Panitia</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#171717] dark:text-white tracking-tight">
            Akses Panitia Event
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Kelola akun panitia, petugas lapangan, juri, dan tim pendukung untuk satu event aktif.
            Izin operasional tetap diperiksa oleh backend (RBAC).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white font-bold text-xs shadow-md shadow-pink-500/20 transition-all min-h-[44px] cursor-pointer"
            title="Pilih akun yang sudah terdaftar"
            aria-label="Pilih Pengguna Terdaftar"
          >
            <UserPlus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Pilih Pengguna Terdaftar</span>
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar Pengguna ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Matriks Izin Operasional</span>
        </button>

        <button
          onClick={() => setActiveTab('session')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'session'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Sesi Online & Keamanan Backend</span>
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Sub-Tabs Navigation (Requirement 15) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pb-1">
            {[
              { id: 'ALL' as UserSubTab, label: 'Semua Pengguna', count: users.length },
              { id: 'NEW' as UserSubTab, label: 'Baru Terdaftar', count: users.filter(u => u.lastLogin === 'Belum pernah' || u.lastLogin === 'Belum pernah login').length },
              { id: 'UNASSIGNED' as UserSubTab, label: 'Belum Ditugaskan', count: users.filter(u => u.role === 'viewer').length },
              { id: 'OFFICERS' as UserSubTab, label: 'Petugas', count: users.filter(u => !['superadmin', 'workspace_admin', 'event_admin', 'viewer'].includes(u.role)).length },
              { id: 'ADMINS' as UserSubTab, label: 'Admin', count: users.filter(u => ['superadmin', 'workspace_admin', 'event_admin'].includes(u.role)).length },
              { id: 'DISABLED' as UserSubTab, label: 'Dinonaktifkan', count: users.filter(u => u.status === 'inactive').length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setUserSubTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-wrap justify-center items-center gap-1.5 min-h-[44px] ${
                  userSubTab === tab.id
                    ? 'bg-[#F47743] text-white shadow-xs'
                    : 'bg-white dark:bg-[#141418] text-[#6B7280] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white border border-[#ECECEF] dark:border-white/10'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  userSubTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Role Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#141418] p-3.5 rounded-2xl border border-[#ECECEF] dark:border-white/10 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama, email, atau instansi..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#F47743]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedRoleFilter}
                onChange={e => setSelectedRoleFilter(e.target.value)}
                className="p-2 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base md:text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
              >
                <option value="ALL">Semua Peran (Roles)</option>
                {Object.entries(ROLE_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredUsers.map(user => {
              const roleMeta = ROLE_LABELS[user.role] || {
                label: user.role,
                badge: 'bg-slate-800 text-slate-200 border-white/10',
                desc: '',
              };
              const ws = workspaces.find(w => w.id === user.workspaceId);

              return (
                <div
                  key={user.id}
                  className="p-5 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/40 transition-all space-y-3.5 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-3">
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ManagedUserAvatar name={user.name} src={user.avatar} />
                        <div>
                          <h3 className="text-xs font-bold text-[#171717] dark:text-white leading-tight">{user.name}</h3>
                          <div className="text-[11px] text-[#6B7280] dark:text-slate-400 truncate max-w-[170px]">{user.email}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer ${
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-500/30'
                        }`}
                      >
                        {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </div>

                    {/* Role Badge */}
                    <div className="space-y-1">
                      <div className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-block ${roleMeta.badge}`}>
                        {roleMeta.label}
                      </div>
                      <p className="text-[10px] text-[#6B7280] dark:text-slate-400">{roleMeta.desc}</p>
                    </div>

                    {/* Scope details */}
                    <div className="bg-[#FAFAFA] dark:bg-white/5 p-2.5 rounded-2xl border border-[#ECECEF] dark:border-white/5 space-y-1 text-[11px]">
                      <div className="flex justify-between text-[#6B7280] dark:text-slate-400">
                        <span>Workspace:</span>
                        <span className="text-[#208C60] dark:text-purple-400 font-medium truncate max-w-[140px]">
                          {ws ? ws.name : user.workspaceId}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#6B7280] dark:text-slate-400">
                        <span>Asal / Instansi:</span>
                        <span className="text-[#171717] dark:text-slate-200 truncate max-w-[140px]">
                          {user.organizationName || 'Belum diisi'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#6B7280] dark:text-slate-400">
                        <span>Login Terakhir:</span>
                        <span className="text-[#171717] dark:text-slate-300">{user.lastLogin}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer (Requirements 13 & 15) */}
                  <div className="pt-2 border-t border-[#ECECEF] dark:border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(user)}
                        className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[#171717] dark:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors flex-1 justify-center min-h-[38px] cursor-pointer"
                        title={`Lihat Detail & Perangkat ${user.name}`}
                      >
                        <Eye className="w-3.5 h-3.5 text-[#F47743]" />
                        <span>Detail</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(user)}
                        className="px-2.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 text-[11px] font-bold flex items-center gap-1.5 flex-1 justify-center min-h-[38px] cursor-pointer"
                        title={`Ubah / Tambah Peran ${user.name}`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Ubah Peran</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      {user.role !== 'viewer' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeRole(user.id)}
                          className="px-2 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 text-[10px] font-semibold flex-1 text-center cursor-pointer"
                          title="Cabut Peran (Reset ke Akun Terdaftar)"
                        >
                          Cabut Peran
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleLogoutAllDevices(user.id)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[10px] font-semibold flex-1 text-center cursor-pointer"
                        title="Keluar dari Semua Perangkat"
                      >
                        Logout Semua
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: RBAC PERMISSIONS MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-[#171717] dark:text-white">Inspektur Matriks Hak Akses (RBAC)</h2>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Periksa daftar izin granular yang diaktifkan untuk setiap peran pengguna pada 13 domain operasional.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-[#171717] dark:text-slate-300 font-semibold shrink-0">Pilih Peran:</label>
              <select
                value={matrixRole}
                onChange={e => setMatrixRole(e.target.value as UserRole)}
                className="p-2 bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743] font-semibold"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active role overview banner */}
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-xl">
                🛡️
              </div>
              <div>
                <div className="text-xs text-emerald-400 font-semibold">Peran Terpilih</div>
                <h3 className="text-sm font-bold text-white">{ROLE_LABELS[matrixRole]?.label}</h3>
                <p className="text-[11px] text-slate-300 mt-0.5">{ROLE_LABELS[matrixRole]?.desc}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400">Total Izin Aktif</div>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {ROLE_PERMISSION_MAP[matrixRole]?.length || 0} Izin
              </div>
            </div>
          </div>

          {/* 13 Operational Domains Accordion */}
          <div className="space-y-3">
            {PERMISSION_GROUPS.map(group => {
              const isExpanded = expandedGroup === group.id;
              const rolePerms = ROLE_PERMISSION_MAP[matrixRole] || [];
              const groupPermCodes = group.permissions.map(p => p.code);
              const grantedInGroup = groupPermCodes.filter(c => rolePerms.includes(c));

              return (
                <div
                  key={group.id}
                  className="rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 overflow-hidden transition-all shadow-xs"
                >
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xl bg-[#FFF0F4] dark:bg-white/5 border border-[#FFE0E8] dark:border-white/10 flex items-center justify-center text-xs font-bold text-[#F47743]">
                        {grantedInGroup.length}/{group.permissions.length}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#171717] dark:text-white">{group.title}</h4>
                        <p className="text-[11px] text-[#6B7280] dark:text-slate-400">{group.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        grantedInGroup.length > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-500/30'
                          : 'bg-[#FAFAFA] text-[#9CA3AF] border-[#ECECEF] dark:bg-white/5 dark:text-slate-500 dark:border-white/5'
                      }`}>
                        {grantedInGroup.length === group.permissions.length
                          ? 'Semua Diizinkan'
                          : grantedInGroup.length > 0
                          ? `${grantedInGroup.length} Diizinkan`
                          : 'Tidak Ada Akses'}
                      </span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-[#ECECEF] dark:border-white/5 space-y-2 bg-[#FAFAFA] dark:bg-black/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-3">
                        {group.permissions.map(perm => {
                          const isGranted = rolePerms.includes(perm.code);

                          return (
                            <div
                              key={perm.code}
                              className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                                isGranted
                                  ? 'bg-white dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/25 shadow-2xs'
                                  : 'bg-white/60 dark:bg-white/5 border-[#ECECEF] dark:border-white/5 opacity-60'
                              }`}
                            >
                              <div className="mt-0.5">
                                {isGranted ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-xs font-bold ${isGranted ? 'text-[#171717] dark:text-white' : 'text-[#6B7280] dark:text-slate-400'}`}>
                                    {perm.label}
                                  </span>
                                  <span className="font-mono text-[9px] text-[#6B7280] dark:text-slate-500 px-1 py-0.2 rounded bg-black/5 dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                                    {perm.code}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">{perm.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ONLINE SESSION & BACKEND SECURITY */}
      {activeTab === 'session' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Sesi Otentikasi Cloud & Integritas Backend</span>
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                  SiEpang menerapkan prinsip <em>Backend-Authoritative Security</em>. Peran dan izin tidak
                  diambil dari localStorage atau manipulasi URL.
                </p>
              </div>
            </div>

            {/* Session parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/5 space-y-1">
                <div className="text-[#6B7280] dark:text-slate-400 text-[11px]">Status Sesi Online</div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Valid & Aktif</span>
                </div>
                <div className="text-[10px] text-slate-400">TTL Durasi: 8 Jam</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/5 space-y-1">
                <div className="text-[#6B7280] dark:text-slate-400 text-[11px]">Konteks Data Aplikasi</div>
                <div className="text-[#171717] dark:text-white font-bold truncate">{workspaceService.getCurrentWorkspace()?.name || 'Konteks Aktif'}</div>
                <div className="text-[10px] text-slate-400 font-mono">{workspaceService.getCurrentWorkspace()?.id || 'GLOBAL_WS'}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/5 space-y-1">
                <div className="text-[#6B7280] dark:text-slate-400 text-[11px]">Security Context Guard</div>
                <div className="text-sky-600 dark:text-sky-400 font-bold">RequestSecurityContext</div>
                <div className="text-[10px] text-slate-400">Strict Server-side Token</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/5 space-y-1">
                <div className="text-[#6B7280] dark:text-slate-400 text-[11px]">Perlindungan Draft Formulir</div>
                <div className="text-amber-600 dark:text-amber-400 font-bold">Tersimpan Otomatis</div>
                <div className="text-[10px] text-slate-400">Aman saat sesi re-auth</div>
              </div>
            </div>

            {/* Explanatory callout */}
            <div className="p-4 rounded-2xl bg-[#EFF6FF] dark:bg-sky-950/20 border border-[#BFDBFE] dark:border-sky-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <div className="font-bold text-sky-950 dark:text-white flex items-center gap-1.5">
                <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Prinsip Keamanan Tanpa Bypass</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#6B7280] dark:text-slate-300">
                Setiap panggilan API ke SiEpang backend router (`/api/*`) diverifikasi secara ketat melalui:
                <br />
                1. <strong>Otentikasi Token</strong>: Memastikan identitas akun terverifikasi.
                <br />
                2. <strong>Workspace Guard</strong>: Memastikan pengguna terikat pada konteks sistem yang sesuai (kompatibilitas backend lama).
                <br />
                3. <strong>RBAC Guard</strong>: Memverifikasi hak akses spesifik terhadap entitas (misal: juri hanya bisa menilai lomba yang ditugaskan).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELECT REGISTERED GAS USER AND ASSIGN ROLE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <h3 className="font-bold text-[#171717] dark:text-white flex items-center gap-2"><UserCheck className="w-5 h-5 text-emerald-500" />{editingUser?.id ? 'Tetapkan Peran Pengguna' : 'Pilih Pengguna Terdaftar'}</h3>
              <button type="button" onClick={() => { setIsModalOpen(false); setEditingUser(null); }} aria-label="Tutup" className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {!editingUser?.id ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-300">Hanya akun yang sudah terdaftar dan aktif di GAS yang dapat dipilih. Tidak ada pembuatan akun manual.</p>
                <div className="flex gap-2">
                  <input aria-label="Cari nama atau email pengguna" value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} placeholder="Cari nama, email, atau instansi..." className="flex-1 min-w-0 rounded-xl px-3 py-2.5 bg-white dark:bg-[#1A1A1E] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm" />
                  <button type="button" onClick={() => void loadRegisteredUsers()} disabled={isLoadingUsers} title="Muat ulang dari GAS" className="px-3 rounded-xl border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-200"><RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} /></button>
                </div>
                {usersError && <div role="alert" className="rounded-xl bg-rose-500/10 text-rose-500 p-3 text-xs">Gagal membaca akun dari GAS: {usersError}</div>}
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {isLoadingUsers ? <p className="text-sm text-slate-500">Memuat akun dari GAS…</p> : registeredCandidates.length === 0 ? <p className="text-sm text-slate-500">Tidak ada akun aktif yang cocok. Pastikan pengguna telah mendaftar dan API users.list dapat diakses Admin.</p> : registeredCandidates.map(user => (
                    <button key={user.id} type="button" onClick={() => handleSelectRegisteredUser(user)} className="w-full text-left rounded-xl border border-slate-200 dark:border-white/10 p-3 hover:border-emerald-500 hover:bg-emerald-500/5 transition-colors">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 break-all">{user.email}</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Peran saat ini: {ROLE_LABELS[user.role]?.label || user.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
                  <div className="font-semibold text-slate-900 dark:text-white">{editingUser.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">{editingUser.email}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">{editingUser.organizationName}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Jabatan resmi kepanitiaan (dibaca dari GAS)</p>
                  {committeeError ? (
                    <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">Gagal membaca struktur panitia: {committeeError}</p>
                  ) : linkedCommitteePositions.length ? (
                    <div className="mt-2 space-y-1">{linkedCommitteePositions.map((position, index) => <p key={`${position}-${index}`} className="text-sm text-emerald-900 dark:text-emerald-200">{position}</p>)}</div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Akun ini belum tertaut pada struktur panitia event aktif. Tetapkan jabatan pada menu Susunan Panitia terlebih dahulu.</p>
                  )}
                  {linkedRoleRecommendations.length > 0 && <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Rekomendasi role teknis (tidak otomatis disimpan):</p>
                    <div className="flex flex-wrap gap-2">{linkedRoleRecommendations.map(role => <button key={role} type="button" onClick={() => setEditingUser(old => old ? { ...old, role } : old)} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-100">{ROLE_LABELS[role]?.label || role}</button>)}</div>
                    {linkedRoleRecommendations.length > 1 && <p className="text-xs text-amber-800 dark:text-amber-300">Form GAS saat ini hanya menyimpan satu role tiap tindakan. Role tambahan tidak boleh diasumsikan aktif; diperlukan pengamanan multi-role di backend.</p>}
                  </div>}
                </div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">Peran Akses
                  <select required value={editingUser.role || 'viewer'} onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })} className="block w-full mt-2 rounded-xl px-3 py-2.5 bg-white dark:bg-[#1A1A1E] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                    {Object.entries(ROLE_LABELS).filter(([role]) => role !== 'superadmin').map(([role, detail]) => <option key={role} value={role}>{detail.label}</option>)}
                  </select>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Jabatan panitia dibaca dari struktur event, bukan dari daftar role ini. Tombol Simpan hanya mengirim satu role ke GAS dan tidak mengubah jabatan. Perubahan multi-role belum diaktifkan hingga otorisasi backend diperbaiki.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingUser(null); setCandidateSearch(''); }} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200">Kembali</button>
                  <button disabled={isSavingUser} type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">{isSavingUser ? 'Menyimpan ke GAS…' : 'Simpan Peran ke GAS'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* MODAL: USER DETAIL & TRUSTED DEVICES (Requirement 15) */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#208C60] to-[#F47743] flex items-center justify-center text-white text-sm shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#171717] dark:text-white">
                    Detail Pengguna & Hak Akses
                  </h3>
                  <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                    ID Pengguna: <span className="font-mono text-purple-600 dark:text-purple-400">{detailUser.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Identity Section */}
            <div className="bg-[#F7F7F8] dark:bg-white/5 p-4 rounded-2xl border border-[#ECECEF] dark:border-white/10 space-y-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                1. Identitas Pengguna
              </div>
              <div className="flex items-center gap-3">
                <ManagedUserAvatar name={detailUser.name} src={detailUser.avatar} size="large" />
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-[#171717] dark:text-white">{detailUser.name}</h4>
                  <div className="text-xs text-[#6B7280] dark:text-slate-400">{detailUser.email}</div>
                  <div className="text-[11px] text-slate-500">
                    Terdaftar sejak: {detailUser.createdAt || 'Tidak diketahui'} · Instansi: {detailUser.organizationName || 'Pramuka'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Account Status Section */}
            <div className="bg-[#F7F7F8] dark:bg-white/5 p-4 rounded-2xl border border-[#ECECEF] dark:border-white/10 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  2. Status Akun
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    detailUser.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-500/30'
                  }`}>
                    {detailUser.status === 'active' ? '✓ Akun Aktif' : '✗ Dinonaktifkan'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Email: <span className="font-semibold text-emerald-600">Terverifikasi OTP</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleToggleStatus(detailUser.id);
                  setDetailUser({
                    ...detailUser,
                    status: detailUser.status === 'active' ? 'inactive' : 'active',
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  detailUser.status === 'active'
                    ? 'border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800'
                    : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800'
                }`}
              >
                {detailUser.status === 'active' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
              </button>
            </div>

            {/* 3. Role Assignments Section */}
            <div className="bg-[#F7F7F8] dark:bg-white/5 p-4 rounded-2xl border border-[#ECECEF] dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  3. Penugasan Peran (UserRoleAssignments)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEdit(detailUser);
                    setDetailUser(null);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-[11px] hover:bg-purple-200 transition-colors cursor-pointer"
                >
                  Tambah / Ubah Peran
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#141418] rounded-xl border border-[#ECECEF] dark:border-white/10">
                <div className="space-y-0.5">
                  <div className={`px-2 py-0.5 rounded-lg text-xs font-bold border inline-block ${
                    ROLE_LABELS[detailUser.role]?.badge || 'bg-slate-800 text-slate-200'
                  }`}>
                    {ROLE_LABELS[detailUser.role]?.label || detailUser.role}
                  </div>
                  <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                    {ROLE_LABELS[detailUser.role]?.desc || 'Akses peran operasional'}
                  </p>
                </div>

                {detailUser.role !== 'viewer' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleRevokeRole(detailUser.id);
                      setDetailUser({ ...detailUser, role: 'viewer' });
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 cursor-pointer"
                  >
                    Cabut Peran
                  </button>
                )}
              </div>
            </div>

            {/* 4. Trusted Devices Section */}
            <div className="bg-[#F7F7F8] dark:bg-white/5 p-4 rounded-2xl border border-[#ECECEF] dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  4. Perangkat Terpercaya (TrustedDevices)
                </div>
                {isLoadingDevices && (
                  <span className="text-[11px] text-slate-400 animate-pulse">Memuat...</span>
                )}
              </div>

              {detailDevices.length === 0 ? (
                <div className="p-3 bg-white dark:bg-[#141418] rounded-xl border border-[#ECECEF] dark:border-white/10 text-xs text-slate-500 text-center">
                  Belum ada perangkat terpercaya yang tercatat untuk pengguna ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {detailDevices.map(dev => (
                    <div
                      key={dev.device_public_id}
                      className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#141418] rounded-xl border border-[#ECECEF] dark:border-white/10"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                          {dev.platform?.toLowerCase().includes('android') || dev.platform?.toLowerCase().includes('ios') ? (
                            <Smartphone className="w-4 h-4" />
                          ) : (
                            <Laptop className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-white">
                            {dev.device_name || 'Browser'}
                            {dev.is_current_device && (
                              <span className="ml-1.5 text-[10px] font-bold text-emerald-600">(Perangkat ini)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {dev.browser_family} · {dev.platform} · Terakhir aktif: {dev.last_seen_at || 'Baru saja'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeDeviceFromDetail(dev.device_public_id)}
                        className="px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
                        title="Cabut akses perangkat ini"
                      >
                        Cabut Perangkat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Last Login Section */}
            <div className="bg-[#F7F7F8] dark:bg-white/5 p-4 rounded-2xl border border-[#ECECEF] dark:border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  5. Login Terakhir
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-white">
                  {detailUser.lastLogin}
                </div>
              </div>
              <Clock className="w-5 h-5 text-slate-400" />
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#ECECEF] dark:border-white/10">
              <button
                type="button"
                onClick={async () => {
                  await handleLogoutAllDevices(detailUser.id);
                  if (detailUser) {
                    const devs = await userManagementService.listUserTrustedDevices(detailUser.id);
                    setDetailDevices(devs);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 dark:bg-white/10 dark:hover:bg-rose-950/30 text-xs font-bold border border-slate-200 dark:border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar dari Semua Perangkat</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
