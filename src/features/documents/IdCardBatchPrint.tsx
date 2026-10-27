import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { apiTransport } from '../../services/apiTransport';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { resolveGoogleDriveImageUrl } from '../../utils/googleDriveImage';

type Element = { id: string; field: string; x: number; y: number; w: number; h: number; fontSize: number; color: string; align: 'left' | 'center' | 'right'; text: string };
type Template = { id: string; name: string; category: string; status: string; widthMm: number; heightMm: number; backgroundUrl: string; elements: Element[] };
type RecordRow = Record<string, unknown>;
type DataSource = 'participants' | 'committee';
type PrintOrientation = 'portrait' | 'landscape';

const get = (r: RecordRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = r[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
};
const extractImage = (url: string, cacheKey?: number) => {
  const resolved = resolveGoogleDriveImageUrl(url, '', 1600);
  if (!resolved || !cacheKey) return resolved;
  // Cache-bust only the resolved image URL; keep existing parameters intact.
  return `${resolved}${resolved.includes('?') ? '&' : '?'}siepang_photo_v=${cacheKey}`;
};
const getId = (r: RecordRow) => get(r, 'id', 'participant_id', 'user_id', 'userId');
const getName = (r: RecordRow) => get(r, 'name', 'fullName', 'full_name', 'displayName');
const getGudep = (r: RecordRow) => get(r, 'gudep_name', 'gudepName', 'contingentName', 'contingent_name', 'institution', 'schoolPangkalan', 'organizationName');
const getRegu = (r: RecordRow) => get(r, 'regu_name', 'reguName', 'team_name', 'teamName');
const getRole = (r: RecordRow) => {
  const direct = get(r, 'role', 'scout_level', 'scoutLevel', 'position', 'jabatan');
  if (direct && direct.toLowerCase() !== 'viewer') return direct;
  const roles = r.roles;
  if (Array.isArray(roles)) return roles.map(String).filter(Boolean).join(', ');
  return direct;
};
// For participants, the Participants sheet `id` is the canonical identifier
// used for selection, QR generation, validation, and printing. `pramuka_id`
// is a separate membership number and must not replace the participant ID.
const getSerial = (r: RecordRow, source: DataSource) => source === 'committee'
  ? get(r, 'staff_number', 'employee_number', 'serial_number', 'serialNumber', 'user_id', 'userId', 'id', 'email')
  : get(r, 'id', 'participant_id', 'serial_number', 'serialNumber', 'participant_number', 'participantNumber', 'code', 'participant_code');
const isInactive = (r: RecordRow) => ['inactive', 'archived', 'disabled', 'suspended', 'deleted', 'blocked'].includes(get(r, 'status', 'active_status', 'activeStatus').toLowerCase());
const COMMITTEE_ROLES = new Set(['committee', 'organizer', 'event_admin', 'workspace_admin', 'registration_officer', 'verification_officer', 'attendance_officer', 'health_officer', 'logistic_officer', 'ceremony_officer', 'documentation_officer', 'publication_officer']);
const isCommitteeUser = (r: RecordRow) => {
  const roles = Array.isArray(r.roles) ? r.roles.map(value => String(value).toLowerCase()) : [get(r, 'role').toLowerCase()];
  return roles.some(role => COMMITTEE_ROLES.has(role));
};

export const IdCardBatchPrint: React.FC<{ template: Template; onBack: () => void }> = ({ template, onBack }) => {
  const defaultSource: DataSource = template.category === 'ID_CARD_COMMITTEE' ? 'committee' : 'participants';
  const [source, setSource] = useState<DataSource>(defaultSource);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gudep, setGudep] = useState('');
  const [regu, setRegu] = useState('');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [photoCacheKey, setPhotoCacheKey] = useState<number>(() => Date.now());
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('portrait');

  // Keep the data source synchronized whenever the selected template changes.
  // useState(defaultSource) only initializes once, so it cannot handle switching
  // from a participant template to a committee template in the same mounted view.
  useEffect(() => {
    const nextSource: DataSource = template.category === 'ID_CARD_COMMITTEE' ? 'committee' : 'participants';
    setSource(current => current === nextSource ? current : nextSource);
    setGudep('');
    setRegu('');
    setRole('');
    setQuery('');
    setSelected([]);
    setQr({});
  }, [template.id, template.category]);

  const refresh = async (requestedSource: DataSource = source) => {
    // Invalidate cached Google Drive thumbnails whenever the user reloads data from GAS.
    setPhotoCacheKey(Date.now());
    setLoading(true);
    setError('');
    try {
      if (requestedSource === 'committee') {
        // GAS users.list reads Users + active UserRoleAssignments; it is admin-protected.
        const response = await apiTransport.send<unknown>('users.list', {}, { timeoutMs: 45000 });
        if (!response.ok) throw new Error(response.error?.message || 'GAS gagal membaca database akun panitia.');
        const data = response.data as unknown;
        const list = Array.isArray(data)
          ? data
          : data && typeof data === 'object' && Array.isArray((data as { users?: unknown[] }).users)
            ? (data as { users: unknown[] }).users
            : null;
        if (!list) throw new Error('Respons users.list tidak berbentuk daftar akun. Periksa kontrak respons GAS.');
        // Jangan cetak akun yang dinonaktifkan. Role diambil dari penugasan aktif di GAS.
        setRows((list as RecordRow[]).filter(user => getId(user) && getName(user) && !isInactive(user) && isCommitteeUser(user)));
      } else {
        const response = await apiTransport.send<{ participants: RecordRow[] }>('participants.list', {}, { timeoutMs: 45000 });
        if (!response.ok || !Array.isArray(response.data?.participants)) throw new Error(response.error?.message || 'GAS tidak mengembalikan daftar peserta.');
        setRows(response.data.participants.filter(person => getId(person) && getName(person) && !isInactive(person)));
      }
      setSelected([]);
      setQr({});
    } catch (e: unknown) {
      setRows([]);
      setSelected([]);
      setQr({});
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(source); }, [source]);

  const unique = (field: (person: RecordRow) => string) => Array.from(new Set(rows.map(field).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id'));
  const filtered = useMemo(() => rows.filter(person =>
    (source === 'committee' || !gudep || getGudep(person) === gudep) &&
    (source === 'committee' || !regu || getRegu(person) === regu) &&
    (!role || getRole(person) === role) &&
    (!query || [getName(person), getId(person), getSerial(person, source), get(person, 'email')].some(value => value.toLowerCase().includes(query.toLowerCase())))
  ), [rows, source, gudep, regu, role, query]);
  const selectedRows = filtered.filter(person => selected.includes(getId(person)));
  const selectedSerials = selectedRows.map(person => getSerial(person, source));
  const uniqueSerials = new Set(selectedSerials.filter(Boolean));
  const serialOk = selectedRows.every(person => !!getSerial(person, source)) && uniqueSerials.size === selectedRows.length;
  const qrReady = selectedRows.every(person => !!qr[getId(person)]);
  // A4 layout: always paginate in groups of 10. Landscape uses 5x2; portrait uses 2x5.
  const printPages = useMemo(() => {
    const pages: RecordRow[][] = [];
    for (let i = 0; i < selectedRows.length; i += 10) pages.push(selectedRows.slice(i, i + 10));
    return pages;
  }, [selectedRows]);
  const cardRatio = template.widthMm > 0 && template.heightMm > 0 ? template.widthMm / template.heightMm : 0.67;
  const printCardWidthMm = printOrientation === 'landscape'
    ? Math.min((287 - 4) / 5, ((200 - 1) / 2) * cardRatio)
    : Math.min((200 - 1) / 2, ((287 - 4) / 5) * cardRatio);
  const printColumns = printOrientation === 'landscape' ? 5 : 2;

  useEffect(() => {
    let canceled = false;
    const ids = selectedRows.map(getId).filter(id => !qr[id]);
    if (!ids.length) return;
    Promise.all(ids.map(id => QRCode.toDataURL(id, { width: 320, margin: 1, errorCorrectionLevel: 'M' }).then(data => ({ id, data }))))
      .then(all => { if (!canceled) setQr(previous => ({ ...previous, ...Object.fromEntries(all.map(item => [item.id, item.data])) })); })
      .catch(() => { if (!canceled) setError('QR tidak berhasil disiapkan. Jangan cetak sebelum QR lengkap.'); });
    return () => { canceled = true; };
  }, [selected.join('|'), source, rows]);

  const field = (element: Element, person: RecordRow): React.ReactNode => {
    switch (element.field) {
      case 'participant.full_name': return getName(person);
      case 'participant.nta': return get(person, 'pramuka_id', 'pramukaId', 'membershipNumber', 'nta', 'staff_number', 'employee_number', 'email');
      case 'participant.participant_number': return getSerial(person, source);
      case 'participant.contingent': return getGudep(person);
      case 'participant.regu': return getRegu(person);
      case 'participant.role': return getRole(person);
      case 'participant.gender': return get(person, 'gender');
      case 'participant.photo': {
        const imageUrl = get(person, 'profile_photo_url', 'photoUrl', 'photo_url', 'avatar');
        return imageUrl ? <img key={`${getId(person)}-${get(person, 'profile_photo_file_id', 'profilePhotoFileId', 'photo_file_id')}-${photoCacheKey}`} src={extractImage(imageUrl, photoCacheKey)} className="block w-full h-full object-cover" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} alt={source === 'committee' ? 'Foto panitia' : 'Foto resmi peserta'} loading="eager" draggable={false} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /> : null;
      }
      case 'participant.qr': return qr[getId(person)] ? <img src={qr[getId(person)]} className="w-full h-full object-contain" alt={`QR ${getId(person)}`} /> : null;
      case 'text.static': return element.text;
      default: return '';
    }
  };
  const toggle = (id: string) => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);

  return <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 text-slate-900 dark:text-white">
    <style>{`
      /* Physical A4 dimensions and a deterministic 10-card grid prevent browser PDF reflow. */
      @page {
         size: ${printOrientation === 'landscape' ? '297mm 210mm' : '210mm 297mm'};
         margin: 5mm 5mm 5mm 5mm;
       }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; width: auto !important; height: auto !important; }
        body * { visibility: hidden !important; }
        #siepang-idcard-print, #siepang-idcard-print * { visibility: visible !important; }
        #siepang-idcard-print {
          position: static !important; display: block !important; width: ${printOrientation === 'landscape' ? '287mm' : '200mm'} !important;
          padding: 0 !important; margin: 0 !important; background: #fff !important;
          overflow: visible !important;
        }
        .siepang-print-page {
          box-sizing: border-box !important; width: ${printOrientation === 'landscape' ? '287mm' : '200mm'} !important;
          height: ${printOrientation === 'landscape' ? '200mm' : '287mm'} !important;
          min-height: 0 !important; max-height: ${printOrientation === 'landscape' ? '200mm' : '287mm'} !important;
          display: grid !important;
          grid-template-columns: repeat(${printColumns}, ${printCardWidthMm.toFixed(2)}mm) !important;
          grid-template-rows: repeat(${printOrientation === 'landscape' ? 2 : 5}, ${((printOrientation === 'landscape' ? 200 - 1 : 287 - 4) / (printOrientation === 'landscape' ? 2 : 5)).toFixed(2)}mm) !important;
          gap: 1mm !important; justify-content: center !important; align-content: center !important;
          break-after: page !important; page-break-after: always !important; overflow: hidden !important;
        }
        .siepang-print-page:last-child { break-after: auto !important; page-break-after: auto !important; }
        .siepang-print-card {
          box-sizing: border-box !important; width: ${printCardWidthMm.toFixed(2)}mm !important;
          height: auto !important; aspect-ratio: ${cardRatio.toFixed(5)} !important;
          min-width: 0 !important; max-width: ${printCardWidthMm.toFixed(2)}mm !important;
          position: relative !important; align-self: center !important; flex: none !important; overflow: hidden !important;
          break-inside: avoid !important; page-break-inside: avoid !important;
          print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important;
        }
        .siepang-print-card > img { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: fill !important; }
      }
      @media screen {
        #siepang-idcard-print { display: flex; flex-wrap: wrap; align-items: flex-start; align-content: flex-start; gap: 2mm; }
        .siepang-print-page { display: contents; }
      }
    `}</style>
    <div className="print:hidden flex flex-wrap justify-between gap-3 items-center">
      <div><h1 className="font-bold text-xl">Cetak ID Card Massal</h1><p className="text-sm text-slate-500">Template: {template.name} · Pilih sumber data dari GAS.</p></div>
      <div className="flex gap-2"><button type="button" onClick={onBack} className="border rounded-xl px-4 py-2 flex gap-2 items-center"><ArrowLeft size={16}/> Kembali</button><button type="button" onClick={() => void refresh()} disabled={loading} className="border rounded-xl px-4 py-2 flex gap-2 items-center disabled:opacity-50"><RefreshCw size={16}/> Muat Ulang GAS</button></div>
    </div>
    <div className="print:hidden rounded-xl border p-3 bg-white dark:bg-[#17181C]">
      <label className="block text-sm font-semibold">Sumber database
        <select className="mt-1 w-full sm:max-w-md rounded-lg p-2 border bg-white text-slate-900" value={source} onChange={event => { setSource(event.target.value as DataSource); setGudep(''); setRegu(''); setRole(''); setQuery(''); setSelected([]); setQr({}); }}>
          <option value="participants">Peserta terdaftar — Participants</option>
          <option value="committee">Panitia / petugas — Users + UserRoleAssignments</option>
        </select>
      </label>
      <p className="mt-1 text-xs text-slate-500">{source === 'committee' ? 'Mengambil akun dan penugasan peran dari GAS. Akses mengikuti hak Administrator; QR berisi ID akun, bukan QR peserta.' : 'Mengambil daftar peserta dari GAS. QR berisi ID peserta.'}</p>
    </div>
    {error && <p role="alert" className="print:hidden p-3 rounded-xl border border-rose-400 text-rose-600">{error}</p>}
    <div className={`print:hidden grid sm:grid-cols-2 ${source === 'committee' ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-3`}>
      {source === 'participants' && <>
        <label className="text-sm">Gudep / Pangkalan<select className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={gudep} onChange={event => { setGudep(event.target.value); setRegu(''); setSelected([]); }}><option value="">Semua Gudep</option>{unique(getGudep).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm">Regu<select className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={regu} onChange={event => { setRegu(event.target.value); setSelected([]); }}><option value="">Semua Regu</option>{unique(getRegu).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </>}
      <label className="text-sm">{source === 'committee' ? 'Peran panitia / petugas' : 'Golongan / Jabatan'}<select className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={role} onChange={event => { setRole(event.target.value); setSelected([]); }}><option value="">Semua peran</option>{unique(getRole).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="text-sm">Cari nama / nomor / email<input className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama, ID, atau email" /></label>
    </div>
    <div className="print:hidden border rounded-xl p-3">
      <div className="flex gap-2 justify-between flex-wrap items-center"><span className="text-sm">{loading ? `Memuat ${source === 'committee' ? 'akun panitia/petugas' : 'peserta'} dari GAS...` : `${filtered.length} ${source === 'committee' ? 'akun' : 'peserta'} ditemukan · ${selectedRows.length} dipilih`}</span><div className="flex gap-2"><button type="button" disabled={loading || !filtered.length} className="text-sm border rounded-lg px-3 py-1.5 disabled:opacity-50" onClick={() => setSelected(Array.from(new Set(filtered.map(getId))))}>Pilih Semua Hasil</button><button type="button" className="text-sm border rounded-lg px-3 py-1.5" onClick={() => setSelected([])}>Batalkan</button></div></div>
      <div className="max-h-60 overflow-y-auto mt-3 space-y-1">{filtered.map(person => <label key={getId(person)} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/10 p-2 text-sm"><input type="checkbox" checked={selected.includes(getId(person))} onChange={() => toggle(getId(person))}/><span className="flex-1">{getName(person)} <span className="text-slate-500">· {source === 'committee' ? getRole(person) : `${getGudep(person)} · ${getRegu(person)} · ${getRole(person)}`}</span>{source === 'committee' && get(person, 'email') && <span className="block text-xs text-slate-500">{get(person, 'email')}</span>}</span><span className="font-mono text-xs">{getSerial(person, source) || 'Nomor belum tersedia'}</span></label>)}</div>
      {!loading && !error && filtered.length === 0 && <p className="mt-3 text-sm text-slate-500">Tidak ada data pada sumber ini atau akun tidak memenuhi filter.</p>}
    </div>
    {!serialOk && selectedRows.length > 0 && <p role="alert" className="print:hidden text-amber-600 text-sm">Satu atau beberapa nomor identitas tidak tersedia/duplikat di GAS. Cetak ditahan agar tidak menghasilkan nomor palsu.</p>}
    <div className="print:hidden flex flex-wrap items-end gap-3 rounded-xl border p-3">
      <label className="text-sm font-semibold">Orientasi kertas
        <select aria-label="Orientasi kertas cetak" className="mt-1 block min-w-48 rounded-lg p-2 border bg-white text-slate-900" value={printOrientation} onChange={event => setPrintOrientation(event.target.value as PrintOrientation)}>
          <option value="portrait">Portrait (tegak)</option>
          <option value="landscape">Landscape (mendatar)</option>
        </select>
      </label>
      <p className="text-xs text-slate-500">Ukuran A4, 10 kartu per halaman. Landscape memakai susunan 5×2; portrait 2×5 dengan skala kartu menyesuaikan. Margin cetak diatur 5 mm (0,5 cm) pada semua sisi. Pilih A4 dan skala 100%; bila dialog browser menimpa margin CSS, pilih Margins > Custom lalu isi 0,2 inci (≈ 0,5 cm) pada keempat sisi. Matikan Headers and footers.</p>
      <button type="button" disabled={!selectedRows.length || !serialOk || !qrReady || !!error || loading} onClick={() => window.print()} className="px-5 py-3 rounded-xl bg-emerald-600 text-white disabled:opacity-50 flex gap-2 items-center"><Printer size={18}/> Cetak {selectedRows.length} Kartu A4</button>
    </div>
    <div id="siepang-idcard-print" className="bg-white text-black">{printPages.map((page, pageIndex) => <div key={`print-page-${pageIndex}`} className="siepang-print-page" style={{ gridTemplateColumns: `repeat(${printColumns}, ${printCardWidthMm}mm)` }}>{page.map(person => <div key={getId(person)} className="siepang-print-card relative border border-slate-300 overflow-hidden bg-white" style={{ width: `${template.widthMm}mm`, height: `${template.heightMm}mm`, aspectRatio: `${template.widthMm} / ${template.heightMm}` }}>{template.backgroundUrl && <img src={extractImage(template.backgroundUrl)} alt="Latar kartu" className="absolute inset-0 w-full h-full"/>}{template.elements.map(element => <div key={element.id} className="absolute flex items-center justify-center overflow-hidden whitespace-pre-wrap" style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%`, fontSize: `${element.fontSize}pt`, color: element.color, textAlign: element.align }}>{field(element, person)}</div>)}</div>)}</div>)}</div>
    <p className="print:hidden text-xs text-slate-500">Nomor identitas dan QR dibaca/dibuat berdasarkan ID sumber yang dipilih. Untuk panitia, pastikan template memakai field yang sesuai; field Gudep/Regu dapat kosong jika akun panitia tidak memiliki data tersebut.</p>
  </div>;
};
