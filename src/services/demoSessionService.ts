/**
 * SiEpang — Demo Session Store
 * Install: src/services/demoSessionService.ts
 * Isolated, in-memory simulation. NEVER imports API/GAS, production services,
 * auth, localStorage or sessionStorage. Not a replacement for server permissions.
 * The UI must only call these functions while its demo route is active.
 */

export type DemoLevel = 'public' | 'participant' | 'committee';
export type DemoMediaType = 'PHOTO' | 'VIDEO';
export type DemoReviewStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';
export type DemoResult<T> = { ok: true; simulated: true; data: T; message: string };

export interface DemoAlbum {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  folderUrl: string;
  createdAt: string;
}

export interface DemoMedia {
  id: string;
  albumId: string | null;
  type: DemoMediaType;
  title: string;
  url: string;
  thumbnailUrl: string;
  caption: string;
  status: DemoReviewStatus;
  voteCount: number;
  createdAt: string;
}

export interface DemoRegistration {
  id: string;
  name: string;
  unit: string;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED';
}

export type DemoOperationKind = 'TASK' | 'SCHEDULE' | 'CAMPSITE' | 'HEALTH' | 'LOGISTICS' | 'ANNOUNCEMENT' | 'EVALUATION' | 'FINANCE';
export type DemoOperationStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';
export interface DemoOperation {
  id: string;
  kind: DemoOperationKind;
  title: string;
  detail: string;
  status: DemoOperationStatus;
  createdByPosition: string;
  createdAt: string;
  updatedAt: string;
}

/** Each committee position may demonstrate only its associated workflows.
 * This is demo UI scoping only; backend authorization remains independent. */
export const DEMO_COMMITTEE_OPERATIONS: Record<string, readonly DemoOperationKind[]> = {
  'Pelindung': ['EVALUATION'],
  'Penasehat': ['EVALUATION'],
  'Ketua Pelaksana': ['TASK','SCHEDULE','EVALUATION','ANNOUNCEMENT'],
  'Sekretaris': ['TASK','ANNOUNCEMENT'],
  'Bendahara': ['FINANCE'],
  'Koordinator Lapangan': ['TASK','SCHEDULE','CAMPSITE'],
  'Bid. Kesekretariatan, Kerjasama dan Pameran': ['TASK','ANNOUNCEMENT'],
  'Bid. Kegiatan': ['SCHEDULE','TASK'],
  'Bid. Perkemahan': ['CAMPSITE','TASK'],
  'Bid. Keagamaan': ['SCHEDULE','ANNOUNCEMENT'],
  'Bid. Sarana, Prasarana dan Keamanan': ['LOGISTICS','TASK'],
  'Bid. Kesehatan': ['HEALTH','TASK'],
  'Bid. Pengawasan dan Evaluasi': ['EVALUATION'],
  'Bid. Konsumsi': ['LOGISTICS'],
  'Bid. Humas': ['ANNOUNCEMENT'],
  'Bid. Dokumentasi dan Publikasi': ['ANNOUNCEMENT','TASK'],
  'Sangga Kerja': ['TASK','SCHEDULE'],
};

export interface DemoSession {
  id: string;
  level: DemoLevel;
  committeePosition: string | null;
  operations: DemoOperation[];
  albums: DemoAlbum[];
  media: DemoMedia[];
  registrations: DemoRegistration[];
  votedMediaIds: string[];
  activity: string[];
  revision: number;
}

export const DEMO_COMMITTEE_POSITIONS = [
  'Pelindung',
  'Penasehat',
  'Ketua Pelaksana',
  'Sekretaris',
  'Bendahara',
  'Koordinator Lapangan',
  'Bid. Kesekretariatan, Kerjasama dan Pameran',
  'Bid. Kegiatan',
  'Bid. Perkemahan',
  'Bid. Keagamaan',
  'Bid. Sarana, Prasarana dan Keamanan',
  'Bid. Kesehatan',
  'Bid. Pengawasan dan Evaluasi',
  'Bid. Konsumsi',
  'Bid. Humas',
  'Bid. Dokumentasi dan Publikasi',
  'Sangga Kerja',
] as const;

const DEMO_MARKER = 'DEMO_';
const ALLOWED_HTTPS = /^https:\/\//i;
const safeText = (value: unknown, label: string, max = 240): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${label} wajib diisi (maksimal ${max} karakter).`);
  }
  return value.trim();
};
const optionalUrl = (value: string): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!ALLOWED_HTTPS.test(text) || text.length > 2048) throw new Error('Gunakan URL HTTPS yang valid.');
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('URL tidak valid.');
  } catch { throw new Error('URL tidak valid.'); }
  return text;
};
const requiredUrl = (value: string): string => {
  const url = optionalUrl(value);
  if (!url) throw new Error('URL media wajib diisi.');
  return url;
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class DemoSessionStore {
  private active: DemoSession | null = null;
  private serial = 0;
  private listeners = new Set<() => void>();

  private nextId(prefix: string): string {
    this.serial += 1;
    return `${DEMO_MARKER}${prefix}_${this.serial}`;
  }
  private requireSession(): DemoSession {
    if (!this.active) throw new Error('Mode Demo belum dimulai.');
    return this.active;
  }
  private change(message: string): void {
    const session = this.requireSession();
    session.revision += 1;
    session.activity.unshift(message);
    session.activity = session.activity.slice(0, 30);
    this.listeners.forEach((fn) => fn());
  }
  private result<T>(data: T, message: string): DemoResult<T> {
    return { ok: true, simulated: true, data: clone(data), message: `${message} (SIMULASI — tidak tersimpan di GAS).` };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  public snapshot(): DemoSession | null {
    return this.active ? clone(this.active) : null;
  }
  public isActive(): boolean { return this.active !== null; }

  public start(level: DemoLevel, committeePosition?: string): DemoSession {
    if (!['public', 'participant', 'committee'].includes(level)) throw new Error('Level demo tidak valid.');
    if (level === 'committee' && committeePosition && !DEMO_COMMITTEE_POSITIONS.some(p => p === committeePosition)) {
      throw new Error('Jabatan panitia tidak dikenal.');
    }
    this.active = {
      id: this.nextId('SESSION'), level,
      committeePosition: level === 'committee' ? committeePosition || 'Bid. Dokumentasi dan Publikasi' : null,
      operations: [], albums: [], media: [], registrations: [], votedMediaIds: [], activity: [], revision: 0,
    };
    this.change(`Sesi simulasi ${level} dimulai`);
    return clone(this.active);
  }
  public switchView(level: DemoLevel, committeePosition?: string): DemoSession {
    const current = this.requireSession();
    if (!['public', 'participant', 'committee'].includes(level)) throw new Error('Level demo tidak valid.');
    if (level === 'committee' && committeePosition && !DEMO_COMMITTEE_POSITIONS.some(p => p === committeePosition)) {
      throw new Error('Jabatan panitia tidak dikenal.');
    }
    current.level = level;
    current.committeePosition = level === 'committee' ? committeePosition || current.committeePosition || 'Bid. Dokumentasi dan Publikasi' : null;
    this.change(`Pratinjau dialihkan ke ${level}`);
    return clone(current);
  }
  public reset(): DemoSession {
    const session = this.requireSession();
    return this.start(session.level, session.committeePosition || undefined);
  }
  public end(): void {
    this.active = null;
    this.listeners.forEach((fn) => fn());
  }

  /** Generic committee workflows remain in-memory, never GAS or localStorage. */
  public createOperation(input: { kind: DemoOperationKind; title: string; detail?: string }): DemoResult<DemoOperation> {
    const session = this.requireSession();
    if (session.level !== 'committee' || !session.committeePosition) throw new Error('Pilih level Panitia terlebih dahulu.');
    const allowed = DEMO_COMMITTEE_OPERATIONS[session.committeePosition] || [];
    if (!allowed.includes(input.kind)) throw new Error('Simulasi fitur tidak tersedia untuk jabatan ini.');
    const now = new Date().toISOString();
    const operation: DemoOperation = {
      id: this.nextId('OPERATION'), kind: input.kind,
      title: safeText(input.title, 'Judul', 160),
      detail: String(input.detail || '').trim().slice(0, 1200),
      status: 'OPEN', createdByPosition: session.committeePosition,
      createdAt: now, updatedAt: now,
    };
    session.operations.push(operation);
    this.change(`Simulasi ${input.kind}: ${operation.title}`);
    return this.result(operation, 'Catatan demo dibuat');
  }

  public updateOperationStatus(id: string, status: DemoOperationStatus): DemoResult<DemoOperation> {
    const session = this.requireSession();
    if (session.level !== 'committee' || !session.committeePosition) throw new Error('Pilih level Panitia terlebih dahulu.');
    if (!['OPEN','IN_PROGRESS','DONE'].includes(status)) throw new Error('Status simulasi tidak valid.');
    const operation = session.operations.find(item => item.id === id);
    if (!operation) throw new Error('Catatan demo tidak ditemukan.');
    if (!(DEMO_COMMITTEE_OPERATIONS[session.committeePosition] || []).includes(operation.kind)) {
      throw new Error('Jabatan saat ini tidak memiliki akses simulasi ke catatan ini.');
    }
    operation.status = status;
    operation.updatedAt = new Date().toISOString();
    this.change(`Status demo ${operation.title} → ${status}`);
    return this.result(operation, 'Status catatan demo diperbarui');
  }

  public listOperations(kind?: DemoOperationKind): DemoOperation[] {
    const session = this.requireSession();
    if (session.level !== 'committee' || !session.committeePosition) return [];
    const allowed = DEMO_COMMITTEE_OPERATIONS[session.committeePosition] || [];
    return clone(session.operations.filter(item => allowed.includes(item.kind) && (!kind || item.kind === kind)));
  }

  public createAlbum(input: { name: string; description?: string; coverUrl?: string; folderUrl?: string }): DemoResult<DemoAlbum> {
    const session = this.requireSession();
    const name = safeText(input.name, 'Nama album', 120);
    if (session.albums.some(a => a.name.toLowerCase() === name.toLowerCase())) throw new Error('Nama album demo sudah ada.');
    const album: DemoAlbum = {
      id: this.nextId('ALBUM'), name, description: String(input.description || '').slice(0, 1000),
      coverUrl: optionalUrl(input.coverUrl || ''), folderUrl: optionalUrl(input.folderUrl || ''),
      createdAt: new Date().toISOString(),
    };
    session.albums.push(album);
    // Deliberately NO media creation, NO auto-sync, NO cover extraction.
    this.change(`Album kosong dibuat: ${name}`);
    return this.result(album, 'Album kosong dibuat');
  }
  public updateAlbum(id: string, patch: Partial<Pick<DemoAlbum, 'name' | 'description' | 'coverUrl' | 'folderUrl'>>): DemoResult<DemoAlbum> {
    const session = this.requireSession();
    const album = session.albums.find(a => a.id === id);
    if (!album) throw new Error('Album demo tidak ditemukan.');
    if (patch.name !== undefined) album.name = safeText(patch.name, 'Nama album', 120);
    if (patch.description !== undefined) album.description = String(patch.description).slice(0, 1000);
    if (patch.coverUrl !== undefined) album.coverUrl = optionalUrl(patch.coverUrl);
    if (patch.folderUrl !== undefined) album.folderUrl = optionalUrl(patch.folderUrl);
    this.change(`Album diperbarui: ${album.name}`);
    return this.result(album, 'Perubahan album diterapkan');
  }
  public addMedia(input: { type: DemoMediaType; title: string; url: string; thumbnailUrl?: string; albumId?: string | null; caption?: string }): DemoResult<DemoMedia> {
    const session = this.requireSession();
    if (input.type !== 'PHOTO' && input.type !== 'VIDEO') throw new Error('Jenis media tidak valid.');
    if (input.albumId && !session.albums.some(a => a.id === input.albumId)) throw new Error('Album demo tidak ditemukan.');
    const media: DemoMedia = {
      id: this.nextId('MEDIA'), albumId: input.albumId || null, type: input.type,
      title: safeText(input.title, 'Judul media', 160), url: requiredUrl(input.url),
      thumbnailUrl: optionalUrl(input.thumbnailUrl || ''), caption: String(input.caption || '').slice(0, 1200),
      status: 'DRAFT', voteCount: 0, createdAt: new Date().toISOString(),
    };
    session.media.push(media);
    this.change(`Media ${media.type} ditambahkan sebagai DRAFT: ${media.title}`);
    return this.result(media, 'Media ditambahkan ke sesi demo');
  }
  public setMediaStatus(id: string, status: DemoReviewStatus): DemoResult<DemoMedia> {
    const session = this.requireSession();
    const item = session.media.find(m => m.id === id);
    if (!item) throw new Error('Media demo tidak ditemukan.');
    if (!['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'].includes(status)) throw new Error('Status tidak valid.');
    item.status = status;
    this.change(`Status media ${item.title} → ${status}`);
    return this.result(item, 'Status media diperbarui');
  }
  public vote(mediaId: string): DemoResult<{ mediaId: string; voteCount: number }> {
    const session = this.requireSession();
    const media = session.media.find(m => m.id === mediaId && m.status === 'PUBLISHED');
    if (!media) throw new Error('Hanya karya demo terbit yang dapat dipilih.');
    if (session.votedMediaIds.includes(mediaId)) throw new Error('Satu sesi hanya dapat memilih karya yang sama sekali.');
    session.votedMediaIds.push(mediaId);
    media.voteCount += 1;
    this.change(`Vote demo diberikan untuk ${media.title}`);
    return this.result({ mediaId, voteCount: media.voteCount }, 'Vote percobaan diterima');
  }
  public register(input: { name: string; unit: string }): DemoResult<DemoRegistration> {
    const session = this.requireSession();
    const item: DemoRegistration = {
      id: this.nextId('PARTICIPANT'), name: safeText(input.name, 'Nama'),
      unit: safeText(input.unit, 'Pangkalan'), status: 'SUBMITTED',
    };
    session.registrations.push(item);
    this.change(`Pendaftaran demo: ${item.name}`);
    return this.result(item, 'Pendaftaran percobaan dikirim');
  }
  public verifyRegistration(id: string): DemoResult<DemoRegistration> {
    const session = this.requireSession();
    const item = session.registrations.find(r => r.id === id);
    if (!item) throw new Error('Pendaftaran demo tidak ditemukan.');
    item.status = 'VERIFIED';
    this.change(`Pendaftaran demo diverifikasi: ${item.name}`);
    return this.result(item, 'Pendaftaran percobaan diverifikasi');
  }
}

/** Only for the demo UI. No state is persisted across full page refreshes. */
export const demoSessionService = new DemoSessionStore();
