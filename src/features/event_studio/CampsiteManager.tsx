/**
 * @license
 * SiEpang - Campsite & Facility Visual Management
 * Visual campsite management with interactive map preview, flexible hierarchy
 * (Sub Camp -> Zone -> Block -> Lot), lot occupancy tracking, gender allocation,
 * contingent assignment, and buper facilities catalog.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Tent,
  MapPin,
  Users,
  Compass,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  Shield,
  Eye,
} from 'lucide-react';
import { eventStudioService } from '../../services/eventStudioService';
import { CampsiteLot, CampFacility, FacilityCategory, Contingent } from '../../types';
import { participantService } from '../../services/participantService';
import { apiTransport } from '../../services/apiTransport';

type PlotShape = { width: number; height: number; rotation: number; locked: boolean; hidden?: boolean; zoneId?: string };
type PlotZone = { id: string; name: string; gender: 'male' | 'female'; points: {x:number;y:number}[] };
const DEFAULT_PLOT: PlotShape = { width: 5, height: 5, rotation: 0, locked: false };
const clampPct = (n:number) => Math.max(1, Math.min(99, n));

export const CampsiteManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'lots' | 'assignment' | 'facilities'>('map');
  const [lots, setLots] = useState<CampsiteLot[]>(eventStudioService.getCampsiteLots());
  const [facilities, setFacilities] = useState<CampFacility[]>(eventStudioService.getFacilities());
  const [selectedLot, setSelectedLot] = useState<CampsiteLot | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<CampFacility | null>(null);

  // Auto-Assign Wizard state (Requirement 17)
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [autoAssignRule, setAutoAssignRule] = useState({
    respectGender: true,
    fitCapacity: true,
    sameDistrictProximity: true,
  });
  const [suggestedAssignments, setSuggestedAssignments] = useState<
    Array<{ contingent: Contingent; lot: CampsiteLot; reason: string }>
  >([]);

  // Assignment search filter (Requirement 16)
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Modal state
  const [showAddLotModal, setShowAddLotModal] = useState(false);
  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false);

  const contingents = participantService.getContingents();

  const [lotForm, setLotForm] = useState<Omit<CampsiteLot, 'id'>>({
    subCamp: '',
    zone: '',
    block: '',
    lotNumber: '',
    capacity: 0,
    gender: 'male',
    contingentId: '',
    contingentName: '',
    status: 'available',
    coordinates: { x: 30, y: 50 },
    notes: '',
  });

  const [facilityForm, setFacilityForm] = useState<Omit<CampFacility, 'id'>>({
    name: '',
    category: 'toilet',
    description: '',
    location: 'Sektor Lapangan',
    openingHours: '24 Jam',
    status: 'active',
    coordinates: { x: 50, y: 50 },
    icon: '🚻',
  });

  const [toast, setToast] = useState<string | null>(null);
  const eventId = String(eventStudioService.getEvent()?.id || 'unassigned');
  const [mapImage, setMapImage] = useState<string>('');
  const [mapEditing, setMapEditing] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; kind: 'lot' | 'facility' } | null>(null);
  const [draftPoint, setDraftPoint] = useState<{ x: number; y: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapError, setMapError] = useState('');
  // Layout is persisted by campsite.layout.get/save (backend module added separately).
  const [plotShapes, setPlotShapes] = useState<Record<string, PlotShape>>({});
  const [plotZones, setPlotZones] = useState<PlotZone[]>([]);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [drawingZone, setDrawingZone] = useState<'male' | 'female' | null>(null);
  const [zonePoints, setZonePoints] = useState<{x:number;y:number}[]>([]);
  const [zoneLabel, setZoneLabel] = useState('');
  const [layoutError, setLayoutError] = useState('');
  const [removingLot, setRemovingLot] = useState(false);
  const getShape = (id: string): PlotShape => plotShapes[id] || DEFAULT_PLOT;
  const patchShape = (id: string, changes: Partial<PlotShape>) => {
    setPlotShapes(old => ({...old, [id]: {...(old[id] || DEFAULT_PLOT), ...changes}}));
    setLayoutDirty(true);
  };
  const loadLayout = async () => {
    setLayoutReady(false);
    setLayoutError('');
    try {
      const res = await apiTransport.send<{ shapes?: Record<string, PlotShape>; zones?: PlotZone[] }>('campsite.layout.get', {}, {timeoutMs:45000});
      if (!res.ok) throw new Error(res.error?.message || 'Backend layout belum aktif.');
      setPlotShapes(res.data?.shapes || {});
      setPlotZones(res.data?.zones || []);
      setLayoutDirty(false);
      setLayoutReady(true);
    } catch (e:any) {
      setLayoutError(e?.message || 'Gagal membaca tata letak kavling.');
    }
  };
  useEffect(() => { void loadLayout(); }, [eventId]);
  const saveLayout = async (shapes = plotShapes, zones = plotZones) => {
    setLayoutBusy(true);
    try {
      const res = await apiTransport.send('campsite.layout.save', {shapes, zones}, {timeoutMs:60000});
      if (!res.ok) throw new Error(res.error?.message || 'Backend menolak penyimpanan layout.');
      setLayoutDirty(false);
      setLayoutError('');
      showToast('Ukuran, rotasi, zona, dan kunci kavling tersimpan.');
    } catch (e:any) {
      setLayoutError(e?.message || 'Gagal menyimpan layout di GAS.');
    } finally { setLayoutBusy(false); }
  };
  const mapPoint = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {x:Math.round(clampPct(100*(e.clientX-rect.left)/rect.width)*100)/100,y:Math.round(clampPct(100*(e.clientY-rect.top)/rect.height)*100)/100};
  };
  const pointInPolygon = (p:{x:number;y:number}, poly:{x:number;y:number}[]) => {
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const a=poly[i], b=poly[j];
      if (((a.y>p.y)!==(b.y>p.y)) && (p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)) inside=!inside;
    }
    return inside;
  };
  const finishZone = () => {
    if(zonePoints.length<3) {showToast('Zona memerlukan minimal 3 titik.');return;}
    const zone:PlotZone={id:`zone_${Date.now()}`,name:zoneLabel.trim() || `Zona ${drawingZone==='male'?'Putra':'Putri'} ${plotZones.length+1}`,gender:drawingZone || 'male',points:zonePoints};
    setPlotZones(z=>[...z,zone]);setLayoutDirty(true);setZonePoints([]);setDrawingZone(null);setZoneLabel('');
  };

  useEffect(() => eventStudioService.subscribe(() => {
    setLots([...eventStudioService.listLots()]);
    setFacilities([...eventStudioService.listFacilities()]);
  }), []);

  const loadMap = async () => {
    setMapBusy(true);
    setMapError('');
    try {
      const res = await apiTransport.send<{ exists: boolean; imageDataUrl?: string }>(
        'campsite.map.get', {}, { timeoutMs: 60000 }
      );
      if (!res.ok) throw new Error(res.error?.message || 'Gagal membaca denah GAS.');
      setMapImage(res.data?.exists ? (res.data.imageDataUrl || '') : '');
    } catch (error: any) {
      setMapImage('');
      setMapError(error?.message || 'Gagal memuat denah dari GAS.');
    } finally {
      setMapBusy(false);
    }
  };

  useEffect(() => { void loadMap(); }, [eventId]);

  const onMapUpload = async (file?: File) => {
    if (!file || mapBusy) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      showToast('Pilih gambar JPG, PNG, atau WebP.'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran denah maksimal 2 MB.'); return;
    }
    setMapBusy(true);
    setMapError('');
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
      });
      const base64 = imageDataUrl.split(',')[1];
      if (!base64) throw new Error('Data gambar tidak valid.');
      const res = await apiTransport.send('campsite.map.upload', {
        filename: file.name, mime_type: file.type, base64,
      }, { timeoutMs: 90000 });
      if (!res.ok) throw new Error(res.error?.message || 'Gagal menyimpan gambar ke Google Drive.');
      // The Drive write is confirmed; display this same image immediately.
      setMapImage(imageDataUrl);
      showToast('Denah berhasil disimpan ke Google Drive.');
    } catch (error: any) {
      setMapError(error?.message || 'Gagal mengunggah denah.');
      showToast('Gagal menyimpan denah ke GAS.');
    } finally {
      setMapBusy(false);
    }
  };

  const removeMap = async () => {
    if (mapBusy || !confirm('Lepaskan denah event ini? Kavling dan koordinat tidak akan dihapus.')) return;
    setMapBusy(true);
    setMapError('');
    try {
      const res = await apiTransport.send('campsite.map.remove', {}, { timeoutMs: 60000 });
      if (!res.ok) throw new Error(res.error?.message || 'Gagal menghapus tautan denah.');
      setMapImage('');
      showToast('Denah event dilepas. Data kavling tetap tersedia.');
    } catch (error: any) {
      setMapError(error?.message || 'Gagal melepas denah.');
    } finally {
      setMapBusy(false);
    }
  };

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, id: string, kind: 'lot' | 'facility') => {
    if (!mapEditing || savingPosition || (kind === 'lot' && getShape(id).locked) || drawingZone) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ id, kind });
    const current = kind === 'lot' ? lots.find(l => l.id === id) : facilities.find(f => f.id === id);
    setDraftPoint(current?.coordinates || { x: 50, y: 50 });
  };
  const moveDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || !mapRef.current) return;
    const bounds = mapRef.current.getBoundingClientRect();
    setDraftPoint({
      x: Math.round(Math.max(1, Math.min(99, ((e.clientX - bounds.left) / bounds.width) * 100)) * 100) / 100,
      y: Math.round(Math.max(1, Math.min(99, ((e.clientY - bounds.top) / bounds.height) * 100)) * 100) / 100,
    });
  };
  const finishDrag = async () => {
    if (!dragging || !draftPoint || savingPosition) return;
    const moved = dragging;
    const point = draftPoint;
    if (moved.kind === 'lot' && plotZones.length) {
      const lot = lots.find(l => l.id === moved.id);
      const shape = getShape(moved.id);
      const matching = plotZones.find(z => z.gender === lot?.gender && pointInPolygon(point,z.points));
      if (!matching) { setDragging(null);setDraftPoint(null);showToast('Kavling harus berada di dalam zona sesuai golongan.');return; }
      if (shape.zoneId !== matching.id) patchShape(moved.id,{zoneId:matching.id});
    }
    setDragging(null);
    setDraftPoint(null);
    setSavingPosition(true);
    try {
      if (moved.kind === 'lot') {
        await eventStudioService.updateLot(moved.id, { coordinates: point });
        setLots([...eventStudioService.listLots()]);
      } else {
        await eventStudioService.updateFacility(moved.id, { coordinates: point });
        setFacilities([...eventStudioService.listFacilities()]);
      }
      showToast('Posisi berhasil disimpan ke backend.');
    } catch (err: any) {
      showToast(`Gagal menyimpan posisi: ${err?.message || 'Periksa koneksi GAS.'}`);
    } finally { setSavingPosition(false); }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const selCont = contingents.find(c => c.id === lotForm.contingentId);
    try {
      await eventStudioService.createLot({
        ...lotForm,
        contingentName: selCont ? selCont.name : undefined,
      });
      setLots([...eventStudioService.listLots()]);
      setShowAddLotModal(false);
      showToast('✅ Kavling tenda baru berhasil ditambahkan!');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityForm.name) return;
    try {
      await eventStudioService.createFacility(facilityForm);
      setFacilities([...eventStudioService.listFacilities()]);
      setShowAddFacilityModal(false);
      showToast('✅ Fasilitas perkemahan berhasil didaftarkan!');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  const handleHideLot = async (id: string, hidden: boolean) => {
    if (!layoutReady || layoutBusy || layoutDirty) {
      showToast('Simpan perubahan tata letak yang tertunda terlebih dahulu.');
      return;
    }
    const next = {...plotShapes, [id]: {...getShape(id), hidden}};
    setLayoutBusy(true);
    try {
      const res = await apiTransport.send('campsite.layout.save', {shapes: next, zones: plotZones}, {timeoutMs:60000});
      if (!res.ok) throw new Error(res.error?.message || 'Backend menolak perubahan pin.');
      setPlotShapes(next);
      setSelectedLot(null);
      showToast(hidden ? 'Pin disembunyikan dari denah; data kavling tetap ada.' : 'Pin kavling kembali tampil di denah.');
    } catch (err: any) {
      showToast(`Gagal menyimpan tampilan pin: ${err?.message || 'Periksa GAS.'}`);
    } finally { setLayoutBusy(false); }
  };

  const handleDeleteLot = async (id: string) => {
    const lot = lots.find(l => l.id === id);
    if (!lot) return;
    if (lot.contingentId || lot.status === 'occupied') {
      showToast('Tidak boleh mengarsipkan kavling yang sudah dialokasikan/terisi. Kosongkan alokasi terlebih dahulu.');
      return;
    }
    if (!confirm(`Arsipkan kavling ${lot.lotNumber}? Data akan diproses melalui backend; tindakan ini berbeda dari menyembunyikan pin.`)) return;
    setRemovingLot(true);
    try {
      await eventStudioService.deleteCampsiteLot(id);
      setLots([...eventStudioService.listLots()]);
      setSelectedLot(null);
      if (plotShapes[id]) {
        const next = {...plotShapes};
        delete next[id];
        setPlotShapes(next);
        setLayoutDirty(true);
      }
      showToast('Permintaan arsip kavling berhasil diproses. Simpan Tata Letak untuk membersihkan geometri lama.');
    } catch (err: any) {
      showToast(`Gagal mengarsipkan kavling: ${err?.message || 'Endpoint backend mungkin belum tersedia.'}`);
    } finally { setRemovingLot(false); }
  };

  const handleAssignContingent = async (lotId: string, contingentId: string) => {
    try {
      const c = contingents.find(x => x.id === contingentId);
      const cName = c ? c.name : '';
      const updated = await eventStudioService.assignContingentToLot(lotId, contingentId, cName);
      setLots([...eventStudioService.listLots()]);
      setSelectedLot(updated);
      showToast(contingentId ? `✅ Alokasi kavling untuk '${cName}' berhasil disimpan!` : 'Alokasi kontingen dibatalkan.');
    } catch (err: any) {
      showToast(`❌ Gagal: ${err.message}`);
    }
  };

  // ==================== AUTO-ASSIGN WIZARD (Requirement 17) ====================
  const handleGenerateAutoAssignSuggestions = () => {
    const unassigned = contingents.filter(c => !lots.some(l => l.contingentId === c.id));
    const availableLots = lots.filter(l => !l.contingentId && l.status !== 'occupied');

    const suggestions: Array<{ contingent: Contingent; lot: CampsiteLot; reason: string }> = [];
    const usedLotIds = new Set<string>();

    unassigned.forEach(c => {
      const match = availableLots.find(l => {
        if (usedLotIds.has(l.id)) return false;
        if (autoAssignRule.fitCapacity && l.capacity < (c.quota || 32)) return false;
        return true;
      });

      if (match) {
        usedLotIds.add(match.id);
        suggestions.push({
          contingent: c,
          lot: match,
          reason: `Kapasitas lot (${match.capacity}) sesuai kuota kontingen (${c.quota || 32}) di ${match.zone || match.block}`,
        });
      }
    });

    setSuggestedAssignments(suggestions);
  };

  const handleApplyAutoAssign = async () => {
    if (suggestedAssignments.length === 0) return;
    for (const item of suggestedAssignments) {
      await eventStudioService.assignContingentToLot(item.lot.id, item.contingent.id, item.contingent.name);
    }
    setLots([...eventStudioService.listLots()]);
    setShowAutoAssignModal(false);
    showToast(`✅ ${suggestedAssignments.length} kontingen berhasil dialokasikan otomatis ke kavling!`);
  };

  const handleResetAllAssignments = async () => {
    if (!confirm('Batalkan seluruh penetapan kavling kontingen? Semua kavling akan kembali berstatus tersedia.')) return;
    for (const lot of lots) {
      if (lot.contingentId) {
        await eventStudioService.assignContingentToLot(lot.id, '', '');
      }
    }
    setLots([...eventStudioService.listLots()]);
    showToast('Seluruh penetapan kavling buper berhasil di-reset.');
  };

  const totalCapacity = lots.reduce((sum, l) => sum + l.capacity, 0);
  const occupiedCount = lots.filter(l => l.status === 'occupied').length;
  const assignedPopulation = lots.filter(l => l.contingentId).reduce((sum, l) => sum + (l.capacity || 0), 0);
  const remainingCapacity = totalCapacity - assignedPopulation;
  const isOverflow = remainingCapacity < 0;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-xs text-emerald-300 font-semibold flex items-center justify-between shadow-lg">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Overflow Warning Banner */}
      {isOverflow && (
        <div className="p-4 rounded-3xl bg-rose-950/40 border-2 border-rose-500/40 flex items-start justify-between gap-3 text-xs text-rose-200 shadow-xl">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-extrabold text-white text-sm">
                Peringatan: Populasi Kontingen Melebihi Daya Tampung Buper ({Math.abs(remainingCapacity)} Peserta Melebihi Kuota)
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Total populasi kontingen yang terdaftar ({assignedPopulation}) melampaui kapasitas kavling tenda ({totalCapacity}).
                Perlu penambahan blok kavling baru atau izin override khusus administrator.
              </p>
            </div>
          </div>
          <button
            onClick={() => showToast('Override belum tersedia; hubungi administrator untuk meninjau kapasitas.')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-[11px] shrink-0"
          >
            Override Panitia
          </button>
        </div>
      )}

      {/* Top Banner & Quick Metrics */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
              <Tent className="w-4 h-4 text-emerald-500" />
              <span>Manajemen Tata Ruang Bumi Perkemahan (Campsite)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola hierarki Sub Camp, Zona, Blok, Kavling Tenda, serta titik fasilitas umum buper.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddLotModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Kavling Tenda</span>
            </button>
            <button
              onClick={() => setShowAddFacilityModal(true)}
              className="px-3.5 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-[#ECECEF] dark:border-white/10 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Fasilitas</span>
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
            <div className="text-slate-500 dark:text-slate-400 text-[10px]">Total Kapasitas Buper</div>
            <div className="text-base font-black text-[#171717] dark:text-white mt-0.5 font-mono">{totalCapacity} Kuota</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
            <div className="text-slate-500 dark:text-slate-400 text-[10px]">Populasi Terisi</div>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">{assignedPopulation} Peserta</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
            <div className="text-slate-500 dark:text-slate-400 text-[10px]">Sisa Kuota / Overflow</div>
            <div className={`text-base font-black mt-0.5 font-mono ${isOverflow ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {isOverflow ? `Overflow +${Math.abs(remainingCapacity)}` : `${remainingCapacity} Sisa`}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
            <div className="text-slate-500 dark:text-slate-400 text-[10px]">Kavling & Fasilitas</div>
            <div className="text-base font-black text-sky-600 dark:text-sky-400 mt-0.5 font-mono">{lots.length} Lot · {facilities.length} Faskes</div>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex flex-wrap p-1 rounded-2xl bg-[#F7F7F8] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 gap-1">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 min-w-[120px] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'map' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🗺️ Peta Interaktif Buper
          </button>
          <button
            onClick={() => setActiveTab('lots')}
            className={`flex-1 min-w-[120px] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'lots' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ⛺ Daftar Kavling & Kontingen
          </button>
          <button
            onClick={() => setActiveTab('assignment')}
            className={`flex-1 min-w-[140px] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'assignment' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📋 Papan Alokasi ({contingents.filter(c => !lots.some(l => l.contingentId === c.id)).length} Belum)
          </button>
          <button
            onClick={() => setActiveTab('facilities')}
            className={`flex-1 min-w-[120px] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'facilities' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🏥 Katalog Fasilitas Buper
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE 2D CAMPSITE MAP PREVIEW */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="p-4 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Denah Lokasi Bumi Perkemahan</span>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { void onMapUpload(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" onClick={() => uploadRef.current?.click()} disabled={mapBusy} className="rounded-xl bg-slate-100 dark:bg-white/10 px-3 py-2 font-bold text-slate-800 dark:text-white">{mapBusy ? 'Memproses...' : 'Unggah Denah'}</button>
                <button type="button" onClick={() => setMapEditing(v => !v)} disabled={savingPosition} className={`rounded-xl px-3 py-2 font-bold ${mapEditing ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white'}`}>
                  {mapEditing ? 'Selesai Atur Posisi' : 'Atur Posisi Pin'}
                </button>
                {mapImage && <button type="button" className="rounded-xl px-3 py-2 bg-rose-50 text-rose-700 font-bold" onClick={() => { void removeMap(); }} disabled={mapBusy}>Hapus Denah</button>}
                <button type="button" disabled={!layoutReady || layoutBusy || !layoutDirty} onClick={() => void saveLayout()} className="rounded-xl px-3 py-2 bg-sky-700 text-white font-bold disabled:opacity-40">{layoutBusy?'Menyimpan...':'Simpan Tata Letak'}</button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{mapEditing ? 'Tarik pin kavling atau fasilitas ke posisi yang sesuai pada denah. Posisi disimpan ke GAS saat dilepas.' : 'Unggah denah, lalu aktifkan Atur Posisi Pin. Klik pin untuk melihat informasi.'}</p>
            {mapError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{mapError}</p>}
            {layoutError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">Penyimpanan area belum tersedia: {layoutError}. Pasang backend campsite.layout.get/save sebelum menggunakan editor area.</p>}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button type="button" disabled={!layoutReady} onClick={() => {setDrawingZone('male');setZonePoints([]);}} className="px-3 py-2 rounded-lg bg-blue-100 text-blue-800 disabled:opacity-40">+ Gambar Zona Putra</button>
              <button type="button" disabled={!layoutReady} onClick={() => {setDrawingZone('female');setZonePoints([]);}} className="px-3 py-2 rounded-lg bg-pink-100 text-pink-800 disabled:opacity-40">+ Gambar Zona Putri</button>
              {drawingZone && <><input value={zoneLabel} onChange={e=>setZoneLabel(e.target.value)} placeholder="Nama zona" className="p-2 border rounded-lg text-slate-900" /><button type="button" onClick={finishZone} className="px-3 py-2 bg-emerald-700 text-white rounded-lg">Selesai Zona ({zonePoints.length} titik)</button><button type="button" onClick={()=>{setDrawingZone(null);setZonePoints([]);}} className="px-3 py-2 rounded-lg border">Batal</button></>}
              {plotZones.map(z=><button key={z.id} type="button" onClick={()=>{setPlotZones(old=>old.filter(x=>x.id!==z.id));setLayoutDirty(true);}} className="px-2 py-1 border rounded-lg" title="Hapus zona">{z.name} ×</button>)}
            </div>
            {drawingZone && <p className="text-xs text-blue-800">Klik beberapa titik pada gambar denah untuk menggambar batas zona. Minimal tiga titik, lalu tekan Selesai Zona.</p>}
            <div ref={mapRef} onClick={e=>{if(drawingZone){setZonePoints(pts=>[...pts,mapPoint(e)]);}}} className="relative w-full h-[400px] sm:h-[480px] rounded-3xl bg-slate-100 dark:bg-[#102318] border border-slate-200 dark:border-emerald-500/30 overflow-hidden select-none touch-none" style={mapImage ? { backgroundImage: `url(${mapImage})`, backgroundSize: '100% 100%', backgroundPosition: 'center' } : undefined}>
              {!mapImage && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-300 text-sm pointer-events-none"><span className="text-3xl">🗺️</span><span>{mapBusy ? 'Memuat denah dari GAS...' : 'Belum ada denah lokasi'}</span><span className="text-xs">Admin dapat mengunggah denah JPG, PNG, atau WebP</span></div>}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {plotZones.map(z=><polygon key={z.id} points={z.points.map(p=>`${p.x},${p.y}`).join(' ')} fill={z.gender==='male'?'rgba(37,99,235,.15)':'rgba(219,39,119,.15)'} stroke={z.gender==='male'?'#2563eb':'#db2777'} strokeWidth=".5" vectorEffect="non-scaling-stroke"/>)}
                {zonePoints.length>0 && <polyline points={zonePoints.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#f97316" strokeWidth=".6" vectorEffect="non-scaling-stroke"/>}
              </svg>
              {facilities.map(fac => {
                const pos = dragging?.id === fac.id && dragging.kind === 'facility' ? draftPoint || fac.coordinates : fac.coordinates;
                return <button key={fac.id} type="button" onPointerDown={e => startDrag(e, fac.id, 'facility')} onPointerMove={moveDrag} onPointerUp={() => void finishDrag()} onPointerCancel={() => { setDragging(null); setDraftPoint(null); }} onClick={() => { if (!mapEditing) { setSelectedFacility(fac); setSelectedLot(null); } }} className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg z-20 bg-amber-400 border-2 border-white ${mapEditing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`} style={{ left: `${pos?.x ?? 50}%`, top: `${pos?.y ?? 50}%`, touchAction: 'none' }} title={fac.name}>{fac.icon}</button>;
              })}
              {lots.filter(lot => !getShape(lot.id).hidden).map(lot => {
                const pos = dragging?.id === lot.id && dragging.kind === 'lot' ? draftPoint || lot.coordinates : lot.coordinates;
                const shape = getShape(lot.id);
                return <button key={lot.id} type="button" onPointerDown={e => startDrag(e, lot.id, 'lot')} onPointerMove={moveDrag} onPointerUp={() => void finishDrag()} onPointerCancel={() => { setDragging(null); setDraftPoint(null); }} onClick={e => {e.stopPropagation(); if (!mapEditing) { setSelectedLot(lot); setSelectedFacility(null); } }} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-md shadow-lg z-10 text-[10px] font-bold text-white border-2 ${shape.locked?'border-yellow-400':'border-white/70'} ${lot.gender === 'female' ? 'bg-pink-600/80' : 'bg-blue-700/80'} ${mapEditing && !shape.locked ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`} style={{ left: `${pos?.x ?? 50}%`, top: `${pos?.y ?? 50}%`, width:`${shape.width}%`,height:`${shape.height}%`,minWidth:24,minHeight:24,transform:`translate(-50%, -50%) rotate(${shape.rotation}deg)`,touchAction:'none' }} title={lot.lotNumber}>{shape.locked?'🔒 ':''}{lot.lotNumber}</button>;
              })}
            </div>
            {savingPosition && <p className="text-xs text-amber-600">Menyimpan posisi ke GAS...</p>}
            {lots.some(lot => getShape(lot.id).hidden) && <div className="flex flex-wrap items-center gap-2 mt-3 text-xs"><span className="font-semibold text-slate-600 dark:text-slate-300">Pin tersembunyi:</span>{lots.filter(lot => getShape(lot.id).hidden).map(lot => <button key={lot.id} type="button" disabled={!layoutReady || layoutBusy || layoutDirty} onClick={() => void handleHideLot(lot.id, false)} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-emerald-700 dark:text-emerald-300 disabled:opacity-40">Tampilkan {lot.lotNumber}</button>)}</div>}
            {/* Selected Pin Detail Sheet */}
            {selectedLot && (
              <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{selectedLot.subCamp} · {selectedLot.lotNumber}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      {selectedLot.gender === 'male' ? 'Sektor Putra' : 'Sektor Putri'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px]">
                      {selectedLot.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1">
                    Kontingen Penghuni: <strong className="text-amber-300">{selectedLot.contingentName || 'Belum Ditugaskan'}</strong>
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-400">Tugaskan:</span>
                    <select
                      value={selectedLot.contingentId || ''}
                      onChange={(e) => handleAssignContingent(selectedLot.id, e.target.value)}
                      className="px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-white text-[11px] focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Kosongkan / Cadangan --</option>
                      {contingents.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1">{selectedLot.notes}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-white">
                    <label>Lebar (%)<input type="number" min="2" max="30" step="1" value={getShape(selectedLot.id).width} onChange={e=>patchShape(selectedLot.id,{width:Math.max(2,Math.min(30,Number(e.target.value)||2))})} className="mt-1 w-full rounded bg-white/15 p-2" /></label>
                    <label>Tinggi (%)<input type="number" min="2" max="30" step="1" value={getShape(selectedLot.id).height} onChange={e=>patchShape(selectedLot.id,{height:Math.max(2,Math.min(30,Number(e.target.value)||2))})} className="mt-1 w-full rounded bg-white/15 p-2" /></label>
                    <label>Rotasi (°)<input type="number" min="0" max="359" step="5" value={getShape(selectedLot.id).rotation} onChange={e=>patchShape(selectedLot.id,{rotation:((Number(e.target.value)||0)%360+360)%360})} className="mt-1 w-full rounded bg-white/15 p-2" /></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={getShape(selectedLot.id).locked} onChange={e=>patchShape(selectedLot.id,{locked:e.target.checked})}/> Kunci kavling</label>
                  </div>
                  <p className="text-[10px] text-amber-200 mt-2">Perubahan dimensi/zona/kunci harus disimpan dengan tombol Simpan Tata Letak.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" disabled={!layoutReady || layoutBusy || layoutDirty} onClick={() => void handleHideLot(selectedLot.id, true)} className="px-3 py-1.5 bg-sky-500/20 text-sky-100 rounded-xl disabled:opacity-40">Sembunyikan dari Denah</button>
                  <button
                    disabled={removingLot || Boolean(selectedLot.contingentId) || selectedLot.status === 'occupied'}
                    onClick={() => void handleDeleteLot(selectedLot.id)}
                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl"
                  >
                    {removingLot ? 'Mengarsipkan...' : 'Arsipkan Kavling'}
                  </button>
                  <button
                    onClick={() => setSelectedLot(null)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            {selectedFacility && (
              <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-500/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{selectedFacility.icon}</span>
                    <span className="font-bold text-white text-sm">{selectedFacility.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold capitalize">
                      {selectedFacility.category}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1">{selectedFacility.description}</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Lokasi: {selectedFacility.location} · Jam Operasional: {selectedFacility.openingHours}</p>
                </div>

                <button
                  onClick={() => setSelectedFacility(null)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: LOTS LIST */}
      {activeTab === 'lots' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lots.map(lot => (
              <div key={lot.id} className="p-4 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#171717] dark:text-white text-sm">{lot.lotNumber}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">({lot.block})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    lot.status === 'occupied' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}>
                    {lot.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Kontingen: </span>
                  <span className="font-semibold text-[#171717] dark:text-white">{lot.contingentName || 'Belum dialokasikan'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-[#ECECEF] dark:border-white/5">
                  <div>Sub Camp: <span className="text-slate-800 dark:text-white font-medium">{lot.subCamp}</span></div>
                  <div>Sektor: <span className="text-slate-800 dark:text-white font-medium">{lot.gender === 'male' ? 'Putra' : 'Putri'}</span></div>
                  <div>Kapasitas: <span className="text-slate-800 dark:text-white font-medium">{lot.capacity} Peserta</span></div>
                  <div>Posisi Map: <span className="font-mono text-emerald-600 dark:text-emerald-400">X:{lot.coordinates.x}%, Y:{lot.coordinates.y}%</span></div>
                </div>

                {lot.notes && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">{lot.notes}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#ECECEF] dark:border-white/10">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono" title="Identitas unik kavling">ID: {lot.id}</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!layoutReady || layoutBusy || layoutDirty || removingLot}
                      onClick={() => void handleHideLot(lot.id, !getShape(lot.id).hidden)}
                      className="rounded-xl border border-sky-300 text-sky-700 dark:text-sky-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"
                      title={layoutDirty ? 'Simpan Tata Letak dahulu' : 'Hanya mengubah tampilan pin, bukan menghapus data kavling'}
                    >
                      {getShape(lot.id).hidden ? 'Tampilkan Pin' : 'Sembunyikan Pin'}
                    </button>
                    <button
                      type="button"
                      disabled={removingLot || Boolean(lot.contingentId) || lot.status === 'occupied'}
                      onClick={() => void handleDeleteLot(lot.id)}
                      className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      title={lot.contingentId || lot.status === 'occupied' ? 'Kavling dialokasikan/terisi: hapus alokasi terlebih dahulu' : 'Arsipkan kavling ini dari database melalui GAS'}
                    >
                      <Trash2 size={13} className="inline-block mr-1" />
                      {removingLot ? 'Memproses...' : 'Arsipkan Kavling'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: FACILITIES CATALOG */}
      {activeTab === 'facilities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {facilities.map(fac => (
            <div key={fac.id} className="p-4 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{fac.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-[#171717] dark:text-white">{fac.name}</h3>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold">{fac.category}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
                  {fac.status}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">{fac.description}</p>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-[#ECECEF] dark:border-white/5 flex justify-between">
                <span>📍 {fac.location}</span>
                <span>⏰ {fac.openingHours}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 4: CAMPSITE ASSIGNMENT BOARD (Requirements 16 & 17) */}
      {activeTab === 'assignment' && (
        <div className="space-y-4">
          {/* Top Control Bar */}
          <div className="p-4 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>Papan Penetapan Kavling Tenda (Campsite Assignment Board)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tetapkan kontingen ke kavling buper dengan cek kapasitas, pembagian gender, dan opsi asisten auto-assign.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleGenerateAutoAssignSuggestions();
                  setShowAutoAssignModal(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bantuan Auto-Assign</span>
              </button>

              <button
                onClick={handleResetAllAssignments}
                className="px-3 py-2 bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-900/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-[#ECECEF] dark:border-white/10 rounded-xl text-xs font-semibold cursor-pointer"
                title="Batalkan semua alokasi kavling"
              >
                Reset Alokasi
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT COLUMN: UNASSIGNED CONTINGENTS */}
            <div className="p-4 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Kontingen Belum Memiliki Kavling</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold">
                  {contingents.filter(c => !lots.some(l => l.contingentId === c.id)).length} Antre
                </span>
              </div>

              <input
                type="text"
                placeholder="Cari kontingen..."
                value={assignmentSearch}
                onChange={e => setAssignmentSearch(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-xs text-[#171717] dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {contingents
                  .filter(c => !lots.some(l => l.contingentId === c.id))
                  .filter(c => (assignmentSearch ? c.name.toLowerCase().includes(assignmentSearch.toLowerCase()) : true))
                  .map(ctg => (
                    <div
                      key={ctg.id}
                      className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 hover:border-emerald-500/30 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#171717] dark:text-white text-xs">{ctg.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{ctg.region} · Pimpinan: {ctg.leaderName}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono font-bold text-[10px]">
                          {ctg.quota || 32} Kuota
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#ECECEF] dark:border-white/5 flex items-center justify-between gap-2 text-xs">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Pilih Kavling:</span>
                        <select
                          onChange={e => {
                            if (e.target.value) {
                              handleAssignContingent(e.target.value, ctg.id);
                            }
                          }}
                          defaultValue=""
                          className="flex-1 px-2 py-1 bg-white dark:bg-black/50 border border-emerald-500/40 rounded-lg text-emerald-700 dark:text-emerald-300 text-[11px] focus:outline-none"
                        >
                          <option value="">-- Tetapkan ke Kavling --</option>
                          {lots
                            .filter(l => !l.contingentId)
                            .map(l => (
                              <option key={l.id} value={l.id}>
                                {l.lotNumber} ({l.block} · {l.gender === 'male' ? 'Putra' : l.gender === 'female' ? 'Putri' : 'Mix'} · Kap: {l.capacity})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ))}

                {contingents.filter(c => !lots.some(l => l.contingentId === c.id)).length === 0 && (
                  <div className="text-center py-10 text-xs text-slate-500 dark:text-slate-400 bg-[#FAFAFA] dark:bg-black/20 rounded-2xl p-4 border border-[#ECECEF] dark:border-transparent">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <span>Semua kontingen telah mendapatkan kavling tenda buper!</span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: LOTS OCCUPANCY BOARD */}
            <div className="p-4 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171717] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Tent className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Kavling Buper & Status Keterisian</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                  {lots.filter(l => l.contingentId).length} / {lots.length} Terisi
                </span>
              </div>

              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {lots.map(lot => {
                  const assignedCtg = contingents.find(c => c.id === lot.contingentId);

                  return (
                    <div
                      key={lot.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        assignedCtg
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                          : 'bg-[#FAFAFA] dark:bg-white/5 border-[#ECECEF] dark:border-white/5 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#171717] dark:text-white text-xs flex items-center gap-1.5">
                            <span>{lot.lotNumber}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">({lot.block} · {lot.subCamp})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Kapasitas: <strong className="text-slate-800 dark:text-white">{lot.capacity} Orang</strong> · Sektor: {lot.gender === 'male' ? 'Putra' : lot.gender === 'female' ? 'Putri' : 'Campuran'}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            assignedCtg
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {assignedCtg ? 'Terisi' : 'Tersedia'}
                        </span>
                      </div>

                      {assignedCtg ? (
                        <div className="pt-2 mt-2 border-t border-[#ECECEF] dark:border-white/5 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Kontingen Penghuni:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">{assignedCtg.name}</span>
                          </div>
                          <button
                            onClick={() => handleAssignContingent(lot.id, '')}
                            className="px-2.5 py-1 bg-white dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-900/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg text-[10px] border border-[#ECECEF] dark:border-white/10 cursor-pointer"
                          >
                            Lepas Alokasi
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-ASSIGN WIZARD MODAL (Requirement 17) */}
      {showAutoAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h3 className="text-base font-bold text-[#171717] dark:text-white">Bantuan Alokasi Massal Otomatis</h3>
              </div>
              <button onClick={() => setShowAutoAssignModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Sistem menghitung kecocokan kapasitas kavling dan pemisahan gender kontingen secara otomatis.
              </p>

              {/* Rules Selector */}
              <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aturan Alokasi Cerdas:</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAssignRule.fitCapacity}
                    onChange={e => setAutoAssignRule({ ...autoAssignRule, fitCapacity: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-200">Kapasitas kavling harus mencukupi kuota kontingen</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAssignRule.respectGender}
                    onChange={e => setAutoAssignRule({ ...autoAssignRule, respectGender: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-200">Pisahkan zona perkemahan putra dan putri</span>
                </label>
              </div>

              {/* Suggested Pairs Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Saran Pasangan Alokasi:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{suggestedAssignments.length} Kontingen</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {suggestedAssignments.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#171717] dark:text-white">{item.contingent.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.reason}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                        → {item.lot.lotNumber}
                      </span>
                    </div>
                  ))}

                  {suggestedAssignments.length === 0 && (
                    <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-xs">
                      Tidak ada kontingen unassigned atau kavling kosong yang cocok.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[10px] text-amber-800 dark:text-amber-300">
                Catatan: Penetapan ini dapat dibatalkan atau di-override kapan saja oleh administrator (tidak permanen/irreversible).
              </div>
            </div>

            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/8 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAutoAssignModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={suggestedAssignments.length === 0}
                onClick={handleApplyAutoAssign}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-40 shadow-xs cursor-pointer"
              >
                Konfirmasi & Terapkan Alokasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LOT MODAL */}
      {showAddLotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] dark:text-white">+ Tambah Alokasi Kavling Tenda</h3>
              <button onClick={() => setShowAddLotModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveLot} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Sub Camp:</label>
                  <input
                    type="text"
                    value={lotForm.subCamp}
                    onChange={e => setLotForm({ ...lotForm, subCamp: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Zona & Sektor:</label>
                  <input
                    type="text"
                    value={lotForm.zone}
                    onChange={e => setLotForm({ ...lotForm, zone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Blok Kavling:</label>
                  <input
                    type="text"
                    value={lotForm.block}
                    onChange={e => setLotForm({ ...lotForm, block: e.target.value })}
                    placeholder="Contoh: Blok A-04"
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Nomor Kavling:</label>
                  <input
                    type="text"
                    value={lotForm.lotNumber}
                    onChange={e => setLotForm({ ...lotForm, lotNumber: e.target.value })}
                    placeholder="Contoh: Kavling 12"
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Sektor Peserta:</label>
                  <select
                    value={lotForm.gender}
                    onChange={e => setLotForm({ ...lotForm, gender: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white"
                  >
                    <option value="male">Putra</option>
                    <option value="female">Putri</option>
                    <option value="mixed">Campuran / Pembina</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Kapasitas Orang:</label>
                  <input
                    type="number"
                    value={lotForm.capacity}
                    onChange={e => setLotForm({ ...lotForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Kontingen Penghuni:</label>
                <select
                  value={lotForm.contingentId}
                  onChange={e => setLotForm({ ...lotForm, contingentId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white"
                >
                  <option value="">-- Belum Ditugaskan / Cadangan --</option>
                  {contingents.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Catatan Tambahan:</label>
                <input
                  type="text"
                  value={lotForm.notes}
                  onChange={e => setLotForm({ ...lotForm, notes: e.target.value })}
                  placeholder="Kondisi tanah, dekat kran air, dsb."
                  className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddLotModal(false)} className="px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer">Simpan Kavling</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD FACILITY MODAL */}
      {showAddFacilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] dark:text-white">+ Tambah Titik Fasilitas Buper</h3>
              <button onClick={() => setShowAddFacilityModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveFacility} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Nama Fasilitas:</label>
                <input
                  type="text"
                  value={facilityForm.name}
                  onChange={e => setFacilityForm({ ...facilityForm, name: e.target.value })}
                  placeholder="Contoh: Pos Pengisian Air Bersih Sektor Timur"
                  className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Kategori Fasilitas:</label>
                  <select
                    value={facilityForm.category}
                    onChange={e => {
                      const cat = e.target.value as FacilityCategory;
                      let icon = '📍';
                      if (cat === 'toilet') icon = '🚻';
                      else if (cat === 'health') icon = '🏥';
                      else if (cat === 'kitchen') icon = '🍽';
                      else if (cat === 'prayer') icon = '🕌';
                      else if (cat === 'parking') icon = '🅿';
                      else if (cat === 'campfire') icon = '🔥';
                      else if (cat === 'competition') icon = '🏆';
                      else if (cat === 'info') icon = '📢';
                      setFacilityForm({ ...facilityForm, category: cat, icon });
                    }}
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white"
                  >
                    <option value="health">🏥 Medis & P3K</option>
                    <option value="toilet">🚻 Toilet & MCK</option>
                    <option value="kitchen">🍽 Dapur & Logistik</option>
                    <option value="prayer">🕌 Musholla & Ibadah</option>
                    <option value="parking">🅿 Parkir & Muatan</option>
                    <option value="campfire">🔥 Api Unggun</option>
                    <option value="competition">🏆 Lapangan Lomba</option>
                    <option value="info">📢 Informasi & Sekretariat</option>
                    <option value="security">🛡 Pos Keamanan</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Jam Operasional:</label>
                  <input
                    type="text"
                    value={facilityForm.openingHours}
                    onChange={e => setFacilityForm({ ...facilityForm, openingHours: e.target.value })}
                    placeholder="24 Jam / 06:00 - 22:00"
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Deskripsi & Petunjuk:</label>
                <textarea
                  rows={2}
                  value={facilityForm.description}
                  onChange={e => setFacilityForm({ ...facilityForm, description: e.target.value })}
                  placeholder="Kapasitas, fasilitas kran, penanggung jawab posko..."
                  className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white placeholder-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddFacilityModal(false)} className="px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer">Simpan Fasilitas</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
