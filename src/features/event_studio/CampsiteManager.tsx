/**
 * @license
 * SiEpang - Campsite & Facility Visual Management
 * Visual campsite management with interactive map preview, flexible hierarchy
 * (Sub Camp -> Zone -> Block -> Lot), lot occupancy tracking, gender allocation,
 * regu-based occupancy, participant visibility, and buper facilities catalog.
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
  Shield,
  Eye,
  RefreshCw,
  UserRound,
  UserCheck,
  Save,
} from 'lucide-react';
import { eventStudioService } from '../../services/eventStudioService';
import { CampsiteLot, CampFacility, FacilityCategory } from '../../types';
import { apiTransport } from '../../services/apiTransport';

type PlotShape = { width: number; height: number; rotation: number; locked: boolean; hidden?: boolean; zoneId?: string };
type PlotZone = { id: string; name: string; gender: 'male' | 'female'; points: {x:number;y:number}[] };
const DEFAULT_PLOT: PlotShape = { width: 5, height: 5, rotation: 0, locked: false };
const clampPct = (n:number) => Math.max(1, Math.min(99, n));
const normalizeCampGender = (value: unknown): 'male' | 'female' | 'mixed' | 'unknown' => {
  const v = String(value || '').trim().toUpperCase();
  if (['M','MALE','PUTRA','L'].includes(v)) return 'male';
  if (['F','FEMALE','PUTRI','P'].includes(v)) return 'female';
  if (['MIXED','MIX','CAMPURAN','ALL'].includes(v)) return 'mixed';
  return 'unknown';
};

export const CampsiteManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'lots' | 'assignment' | 'facilities' | 'generator'>('map');
  const [lots, setLots] = useState<CampsiteLot[]>(eventStudioService.getCampsiteLots());
  const [facilities, setFacilities] = useState<CampFacility[]>(eventStudioService.getFacilities());
  // GAS is the sole source of truth. No generated demo records are inserted locally.
  type StructurePreview = {eventId?: string; requestedLots: number; newLots: number; existingLots: number; conflicts: string[]; canGenerate: boolean};
  type StructureResult = {eventId?: string; createdLots: number; createdNodes: number; message?: string};
  const [structureKabupaten, setStructureKabupaten] = useState('');
  const [structurePutraVillages, setStructurePutraVillages] = useState('0');
  const [structurePutraLots, setStructurePutraLots] = useState('0');
  const [structurePutriVillages, setStructurePutriVillages] = useState('0');
  const [structurePutriLots, setStructurePutriLots] = useState('0');
  const [structurePreview, setStructurePreview] = useState<StructurePreview | null>(null);
  const [structureNodes, setStructureNodes] = useState<Array<{id: string; code: string; name: string; node_type: string}>>([]);
  const [structureBusy, setStructureBusy] = useState(false);
  const [structureError, setStructureError] = useState('');
  const [structureMessage, setStructureMessage] = useState('');
  const structurePlan = () => {
    const integer = (raw: string, label: string) => {
      if (!/^\d+$/.test(raw.trim())) throw new Error(label + ' harus bilangan bulat 0 atau lebih.');
      const n = Number(raw);
      if (n > 100) throw new Error(label + ' maksimal 100.');
      return n;
    };
    if (!structureKabupaten.trim()) throw new Error('Nama Kabupaten wajib diisi.');
    return {
      kabupaten: structureKabupaten.trim(),
      putra: {kelurahanCount: integer(structurePutraVillages, 'Kelurahan Putra'), lotsPerVillage: integer(structurePutraLots, 'Kavling Putra')},
      putri: {kelurahanCount: integer(structurePutriVillages, 'Kelurahan Putri'), lotsPerVillage: integer(structurePutriLots, 'Kavling Putri')},
    };
  };
  const loadStructure = async () => {
    setStructureError('');
    try {
      const response = await apiTransport.send<{nodes: Array<{id:string;code:string;name:string;node_type:string}>}>('campsite.structure.get', {}, {timeoutMs:45000});
      if (!response.ok) throw new Error(response.error?.message || 'Gagal memuat struktur GAS.');
      setStructureNodes(response.data?.nodes || []);
      const kab = response.data?.nodes?.find(n => n.node_type === 'KABUPATEN');
      if (kab) setStructureKabupaten(kab.name);
    } catch (error: any) { setStructureError(error?.message || 'Gagal memuat struktur.'); }
  };
  const previewStructure = async () => {
    setStructureBusy(true); setStructureError(''); setStructureMessage(''); setStructurePreview(null);
    try {
      const plan = structurePlan();
      const response = await apiTransport.send<StructurePreview>('campsite.structure.preview', {plan}, {timeoutMs:60000});
      if (!response.ok || !response.data) throw new Error(response.error?.message || 'Gagal membaca pratinjau GAS.');
      setStructurePreview(response.data);
    } catch (error: any) { setStructureError(error?.message || 'Gagal memeriksa rencana.'); }
    finally { setStructureBusy(false); }
  };
  const generateStructure = async () => {
    if (!structurePreview?.canGenerate || structureBusy) return;
    if (!window.confirm(`Buat ${structurePreview.newLots} kavling baru di GAS? Data yang sudah ada tidak akan ditimpa.`)) return;
    setStructureBusy(true); setStructureError(''); setStructureMessage('');
    try {
      const plan = structurePlan();
      // Recheck immediately before writing; layout or other admins may have changed.
      const fresh = await apiTransport.send<StructurePreview>('campsite.structure.preview', {plan}, {timeoutMs:60000});
      if (!fresh.ok || !fresh.data?.canGenerate) throw new Error(fresh.error?.message || 'Rencana berubah atau memiliki konflik. Ulangi pratinjau.');
      const result = await apiTransport.send<StructureResult>('campsite.structure.generate', {plan}, {timeoutMs:120000});
      if (!result.ok || !result.data) throw new Error(result.error?.message || 'Generator tidak mengembalikan konfirmasi GAS. Periksa sebelum mencoba ulang.');
      setStructureMessage(`${result.data.createdLots || 0} kavling dan ${result.data.createdNodes || 0} node wilayah dibuat di GAS. ${result.data.message || ''}`);
      setStructurePreview(null);
      await loadStructure();
      await eventStudioService.initialSync();
      setLots([...eventStudioService.listLots()]);
    } catch (error: any) { setStructureError(error?.message || 'Generator gagal. Periksa data GAS sebelum mencoba ulang.'); }
    finally { setStructureBusy(false); }
  };
  const [selectedLot, setSelectedLot] = useState<CampsiteLot | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<CampFacility | null>(null);
  type OccupancyRegu = {regu_id: string; regu_name: string; gudep_id: string; gudep_name: string; gender: string; quota: number; member_count: number};
  type OccupancyLot = {id: string; lot_code: string; subcamp_name: string; capacity: number; gender: string; status: string; assigned_regu_id: string; assigned_regu_name: string; assigned_gudep_id: string};
  const [occupancyLots, setOccupancyLots] = useState<OccupancyLot[]>([]);
  const [occupancyRegus, setOccupancyRegus] = useState<OccupancyRegu[]>([]);
  const [occupancyParticipants, setOccupancyParticipants] = useState<any[]>([]);
  const [occupancyLoading, setOccupancyLoading] = useState(false);
  const [occupancySaving, setOccupancySaving] = useState(false);
  const [occupancyError, setOccupancyError] = useState('');
  const [occupancyReguId, setOccupancyReguId] = useState('');
  const [assignmentReguId, setAssignmentReguId] = useState('');
  const [assignmentLotId, setAssignmentLotId] = useState('');

  // Assignment search filter (Requirement 16)
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Modal state
  const [showAddLotModal, setShowAddLotModal] = useState(false);
  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false);

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
  const loadOccupancyData = async () => {
    setOccupancyLoading(true);
    setOccupancyError('');
    try {
      const [options, participants] = await Promise.all([
        apiTransport.send<{lots: OccupancyLot[]; regus: OccupancyRegu[]}>('participants.admin.campsiteOptions', {}, {timeoutMs:45000}),
        apiTransport.send<{participants: any[]}>('participants.list', {}, {timeoutMs:45000}),
      ]);
      if (!options.ok || !options.data) throw new Error(options.error?.message || 'Gagal memuat data kavling dan regu dari GAS.');
      if (!participants.ok || !Array.isArray(participants.data?.participants)) throw new Error(participants.error?.message || 'Gagal memuat daftar peserta dari GAS.');
      setOccupancyLots(options.data.lots || []);
      setOccupancyRegus(options.data.regus || []);
      setOccupancyParticipants(participants.data.participants);
      const current = options.data.lots?.find(l => l.id === selectedLot?.id);
      setOccupancyReguId(current?.assigned_regu_id || '');
    } catch (error: any) {
      setOccupancyError(error?.message || 'Data penghuni kavling tidak dapat dimuat.');
    } finally { setOccupancyLoading(false); }
  };
  const assignReguToLot = async (lotId: string, reguId: string) => {
    if (!lotId || !reguId) throw new Error('Pilih regu dan kavling terlebih dahulu.');
    const response = await apiTransport.send<any>('participants.admin.assignCampsite', {
      lot_id: lotId,
      regu_id: reguId,
    }, {timeoutMs:60000});
    if (!response.ok || !response.data) throw new Error(response.error?.message || 'Gagal menyimpan penempatan regu.');
    await loadOccupancyData();
    await eventStudioService.initialSync();
    setLots([...eventStudioService.listLots()]);
    const refreshed = eventStudioService.listLots().find(l => l.id === lotId);
    if (refreshed && selectedLot?.id === lotId) setSelectedLot(refreshed);
    showToast(`Penempatan regu tersimpan di GAS. ${response.data.assigned_count || 0} anggota diperbarui.`);
  };
  const saveReguOccupancy = async () => {
    if (!selectedLot || !occupancyReguId || occupancySaving) return;
    setOccupancySaving(true);
    setOccupancyError('');
    try {
      await assignReguToLot(selectedLot.id, occupancyReguId);
    } catch (error: any) {
      setOccupancyError(error?.message || 'Gagal menyimpan penempatan regu.');
    } finally { setOccupancySaving(false); }
  };
  const saveAssignmentBoard = async () => {
    if (!assignmentLotId || !assignmentReguId || occupancySaving) return;
    setOccupancySaving(true);
    setOccupancyError('');
    try {
      await assignReguToLot(assignmentLotId, assignmentReguId);
      setAssignmentReguId('');
      setAssignmentLotId('');
    } catch (error: any) {
      setOccupancyError(error?.message || 'Gagal menyimpan penempatan regu.');
    } finally { setOccupancySaving(false); }
  };
  useEffect(() => { void loadOccupancyData(); }, []);
  useEffect(() => {
    if (!selectedLot) return;
    const current = occupancyLots.find(l => l.id === selectedLot.id);
    setOccupancyReguId(current?.assigned_regu_id || '');
  }, [selectedLot?.id, occupancyLots]);
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
    try {
      await eventStudioService.createLot({
        ...lotForm,
        contingentId: '',
        contingentName: '',
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
    if (lot.contingentId || String(lot.status || '').toLowerCase() === 'occupied') {
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

  const totalCapacity = lots.reduce((sum, l) => sum + l.capacity, 0);
  const assignedPopulation = occupancyParticipants.filter(p => String(p.active_status || '').toUpperCase() !== 'ARCHIVED' && String(p.lot_number || p.lotNumber || '').trim()).length;
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
            onClick={() => { setActiveTab('generator'); void loadStructure(); }}
            className={`flex-1 min-w-[140px] py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === 'generator' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            🏕️ Generator Kavling
          </button>
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
            ⛺ Daftar Kavling
          </button>
          <button
            onClick={() => setActiveTab('assignment')}
            className={`flex-1 min-w-[140px] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'assignment' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📋 Penempatan Regu ({occupancyRegus.filter(r => !occupancyLots.some(l => l.assigned_regu_id === r.regu_id)).length} Belum)
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

      {activeTab === 'generator' && (
        <section className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-5">
          <header>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Generator Kabupaten → Kecamatan Putra/Putri → Kelurahan → Kavling</h3>
            <p className="text-xs text-slate-500 mt-1">Setiap kavling untuk satu regu. Struktur dan nomor dibuat di GAS; posisi kavling di denah diatur setelah pembuatan.</p>
          </header>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Nama Kabupaten
            <input value={structureKabupaten} maxLength={100} onChange={e => {setStructureKabupaten(e.target.value);setStructurePreview(null);}} placeholder="Contoh: Kabupaten ..." className="mt-1 w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-900 dark:bg-slate-900 dark:text-white dark:border-slate-600" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([{key:'putra',title:'Kecamatan Putra',v:structurePutraVillages,setV:setStructurePutraVillages,l:structurePutraLots,setL:setStructurePutraLots}, {key:'putri',title:'Kecamatan Putri',v:structurePutriVillages,setV:setStructurePutriVillages,l:structurePutriLots,setL:setStructurePutriLots}] as const).map(d => (
              <div key={d.key} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{d.title}</h4>
                <label className="block text-xs text-slate-600 dark:text-slate-300">Jumlah Kelurahan
                  <input type="number" min="0" max="100" value={d.v} onChange={e => {d.setV(e.target.value);setStructurePreview(null);}} className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 dark:bg-slate-900 dark:text-white dark:border-slate-600" />
                </label>
                <label className="block text-xs text-slate-600 dark:text-slate-300">Jumlah kavling per Kelurahan
                  <input type="number" min="0" max="100" value={d.l} onChange={e => {d.setL(e.target.value);setStructurePreview(null);}} className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 dark:bg-slate-900 dark:text-white dark:border-slate-600" />
                </label>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={structureBusy} onClick={() => void previewStructure()} className="px-4 py-2 rounded-xl bg-sky-700 text-white text-xs font-bold disabled:opacity-50">{structureBusy?'Memproses...':'Pratinjau dari GAS'}</button>
            <button type="button" disabled={structureBusy || !structurePreview?.canGenerate || structurePreview.newLots===0} onClick={() => void generateStructure()} className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold disabled:opacity-40">Generate Kavling di GAS</button>
            <button type="button" disabled={structureBusy} onClick={() => void loadStructure()} className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold dark:text-white">Muat Ulang Struktur</button>
          </div>
          {structureError && <p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">{structureError}</p>}
          {structureMessage && <p role="status" className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs">{structureMessage}</p>}
          {structurePreview && <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-white space-y-1">
            <p>Direncanakan: <strong>{structurePreview.requestedLots}</strong> kavling · Sudah ada: <strong>{structurePreview.existingLots}</strong> · Baru: <strong>{structurePreview.newLots}</strong></p>
            <p>Status: {structurePreview.canGenerate ? 'Siap dibuat di GAS' : 'Perlu diperbaiki sebelum generate'}</p>
            {structurePreview.conflicts?.map((c,i) => <p key={i} className="text-rose-600">{c}</p>)}
          </div>}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="font-semibold text-xs text-slate-700 dark:text-white">Struktur tersimpan di GAS: {structureNodes.length} node</p>
            <div className="mt-2 max-h-52 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 space-y-1">
              {structureNodes.map(n => <p key={n.id}>{n.code} · {n.node_type} · {n.name}</p>)}
              {!structureNodes.length && <p>Belum ada struktur. Gunakan pratinjau untuk memulai.</p>}
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">Pembuatan tidak menetapkan regu dan tidak menempatkan posisi pin otomatis. Gunakan Papan Alokasi dan Peta Interaktif sesudahnya. Jangan mengulang permintaan ketika status GAS belum diketahui.</p>
        </section>
      )}

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
                  {(() => {
                    const lotAssignment = occupancyLots.find(l => l.id === selectedLot.id);
                    const assignedRegu = occupancyRegus.find(r => r.regu_id === lotAssignment?.assigned_regu_id);
                    return <div className="mt-1 space-y-1">
                      <p className="text-slate-300">Regu: <strong className="text-amber-300">{assignedRegu?.regu_name || lotAssignment?.assigned_regu_name || 'Belum ditempatkan'}</strong></p>
                      <p className="text-slate-400 text-[11px]">Gudep: {assignedRegu?.gudep_name || 'Belum tersedia'} · Penempatan dikelola berdasarkan regu, bukan alokasi kontingen langsung.</p>
                    </div>;
                  })()}
                  <p className="text-slate-400 text-[11px] mt-1">{selectedLot.notes}</p>
                  <section className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3" aria-label="Penempatan regu dan peserta">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-white font-semibold text-sm"><Users size={16}/> Regu & penghuni kavling</div>
                      <button type="button" onClick={() => void loadOccupancyData()} disabled={occupancyLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-slate-200 disabled:opacity-50"><RefreshCw size={13} className={occupancyLoading ? 'animate-spin' : ''}/> Muat ulang</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <label className="text-[11px] text-slate-300">Tempatkan satu regu ke kavling ini
                        <select value={occupancyReguId} onChange={e => setOccupancyReguId(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white" disabled={occupancyLoading || occupancySaving}>
                          <option value="">Pilih regu terverifikasi dan aktif…</option>
                          {occupancyRegus.map(r => <option key={r.regu_id} value={r.regu_id}>{r.regu_name} · {r.gudep_name} · {r.member_count}/{r.quota} anggota</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={() => void saveReguOccupancy()} disabled={!occupancyReguId || occupancySaving || occupancyLoading} className="self-end inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 disabled:opacity-40"><Save size={15}/>{occupancySaving ? 'Menyimpan…' : 'Simpan penempatan'}</button>
                    </div>
                    <p className="text-[11px] text-slate-400">Satu kavling hanya dapat ditempati satu regu. Penyimpanan akan memperbarui lokasi peserta anggota regu di backend GAS.</p>
                    {occupancyError && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-950/40 p-2 text-xs text-rose-200">{occupancyError}</p>}
                    {occupancyLoading ? <p className="text-xs text-slate-300">Memuat penghuni dari GAS…</p> : (() => {
                      const canonicalLot = occupancyLots.find(l => l.id === selectedLot.id);
                      const lotCode = canonicalLot?.lot_code || selectedLot.lotNumber;
                      const occupants = occupancyParticipants.filter(p => String(p.active_status || '').toUpperCase() !== 'ARCHIVED' && String(p.lot_number || p.lotNumber || '').trim() === String(lotCode || '').trim());
                      const assignedRegu = occupancyRegus.find(r => r.regu_id === (canonicalLot?.assigned_regu_id || ''));
                      return <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="rounded-xl bg-white/5 p-2"><div className="text-[10px] uppercase tracking-wide text-slate-400">Regu</div><div className="mt-1 text-sm font-semibold text-white">{canonicalLot?.assigned_regu_name || assignedRegu?.regu_name || 'Belum ditempatkan'}</div></div>
                          <div className="rounded-xl bg-white/5 p-2"><div className="text-[10px] uppercase tracking-wide text-slate-400">Jumlah peserta</div><div className="mt-1 text-sm font-semibold text-white">{occupants.length}</div></div>
                          <div className="rounded-xl bg-white/5 p-2"><div className="text-[10px] uppercase tracking-wide text-slate-400">Kapasitas</div><div className="mt-1 text-sm font-semibold text-white">{canonicalLot?.capacity || selectedLot.capacity || '—'}</div></div>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-white/10">
                          <div className="flex items-center justify-between bg-white/5 px-3 py-2"><span className="text-xs font-semibold text-white">Daftar peserta di {lotCode}</span><span className="text-[10px] text-slate-400">Data GAS</span></div>
                          {occupants.length ? <div className="max-h-48 overflow-y-auto divide-y divide-white/10">{occupants.map((p, i) => <div key={String(p.id || p.participant_id || i)} className="flex items-center gap-2 px-3 py-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><UserRound size={14}/></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-white">{p.name || p.fullName || 'Tanpa nama'}</div><div className="truncate text-[10px] text-slate-400">{p.pramuka_id || p.pramukaId || p.id} · {p.institution || p.contingent_name || p.contingent_id || 'Kontingen belum tersedia'}</div></div><UserCheck size={14} className="text-emerald-300"/></div>)}</div> : <div className="px-3 py-4 text-center text-xs text-slate-400">Belum ada peserta yang tercatat pada kavling ini.</div>}
                        </div>
                      </div>;
                    })()}
                  </section>
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
                    disabled={removingLot || Boolean(selectedLot.contingentId) || String(selectedLot.status || '').toLowerCase() === 'occupied'}
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
            {lots.map(lot => {
              const assignedLot = occupancyLots.find(item => item.id === lot.id);
              const assignedRegu = occupancyRegus.find(item => item.regu_id === assignedLot?.assigned_regu_id);
              const occupantCount = occupancyParticipants.filter(p => String(p.active_status || '').toUpperCase() !== 'ARCHIVED' && String(p.lot_number || p.lotNumber || '').trim() === String(assignedLot?.lot_code || lot.lotNumber || '').trim()).length;
              return <div key={lot.id} className="p-4 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#171717] dark:text-white text-sm">{lot.lotNumber}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">({lot.block})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    String(lot.status || '').toLowerCase() === 'occupied' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}>
                    {lot.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div><span className="text-slate-500 dark:text-slate-400">Regu: </span><span className="font-semibold text-[#171717] dark:text-white">{assignedRegu?.regu_name || assignedLot?.assigned_regu_name || 'Belum ditempatkan'}</span></div>
                  <div><span className="text-slate-500 dark:text-slate-400">Gudep: </span><span className="font-semibold text-[#171717] dark:text-white">{assignedRegu?.gudep_name || '—'}</span></div>
                  <div><span className="text-slate-500 dark:text-slate-400">Peserta di kavling: </span><span className="font-semibold text-[#171717] dark:text-white">{occupantCount}</span><span className="text-slate-500"> / {lot.capacity || '—'}</span></div>
                  {lot.contingentName && <div><span className="text-slate-500 dark:text-slate-400">Kontingen: </span><span className="font-semibold text-[#171717] dark:text-white">{lot.contingentName}</span></div>}
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
                      disabled={removingLot || Boolean(lot.contingentId) || String(lot.status || '').toLowerCase() === 'occupied'}
                      onClick={() => void handleDeleteLot(lot.id)}
                      className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      title={lot.contingentId || String(lot.status || '').toLowerCase() === 'occupied' ? 'Kavling dialokasikan/terisi: hapus alokasi terlebih dahulu' : 'Arsipkan kavling ini dari database melalui GAS'}
                    >
                      <Trash2 size={13} className="inline-block mr-1" />
                      {removingLot ? 'Memproses...' : 'Arsipkan Kavling'}
                    </button>
                  </div>
                </div>
              </div>;
            })}
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

      {/* VIEW 4: REGU & PARTICIPANT OCCUPANCY BOARD */}
      {activeTab === 'assignment' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#ECECEF] bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#141418]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#171717] dark:text-white"><Users className="h-4 w-4 text-emerald-500"/> Penempatan Regu & Penghuni Kavling</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Satu kavling untuk satu regu. Daftar anggota mengikuti keanggotaan regu yang tersimpan di GAS.</p>
              </div>
              <button type="button" onClick={() => void loadOccupancyData()} disabled={occupancyLoading || occupancySaving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ECECEF] px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-white/10 dark:text-slate-200"><RefreshCw size={14} className={occupancyLoading ? 'animate-spin' : ''}/> Muat ulang data</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><div className="text-[11px] text-slate-500">Total kavling</div><div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{occupancyLots.length}</div></div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div className="text-[11px] text-emerald-700 dark:text-emerald-300">Kavling terisi</div><div className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200">{occupancyLots.filter(l => l.assigned_regu_id).length}</div></div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><div className="text-[11px] text-amber-700 dark:text-amber-300">Regu belum ditempatkan</div><div className="mt-1 text-xl font-bold text-amber-800 dark:text-amber-200">{occupancyRegus.filter(r => !occupancyLots.some(l => l.assigned_regu_id === r.regu_id)).length}</div></div>
              <div className="rounded-xl bg-sky-50 p-3 dark:bg-sky-950/30"><div className="text-[11px] text-sky-700 dark:text-sky-300">Peserta di kavling</div><div className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-200">{occupancyParticipants.filter(p => String(p.active_status || '').toUpperCase() !== 'ARCHIVED' && String(p.lot_number || p.lotNumber || '').trim()).length}</div></div>
            </div>
            {occupancyError && <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">{occupancyError}</p>}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Regu terverifikasi
                <select value={assignmentReguId} onChange={e => setAssignmentReguId(e.target.value)} disabled={occupancyLoading || occupancySaving} className="mt-1 w-full rounded-xl border border-[#ECECEF] bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white">
                  <option value="">Pilih regu…</option>
                  {occupancyRegus.map(r => <option key={r.regu_id} value={r.regu_id}>{r.regu_name} · {r.gudep_name} · {r.member_count} anggota</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Kavling tujuan
                <select value={assignmentLotId} onChange={e => setAssignmentLotId(e.target.value)} disabled={occupancyLoading || occupancySaving} className="mt-1 w-full rounded-xl border border-[#ECECEF] bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white">
                  <option value="">Pilih kavling tersedia…</option>
                  {occupancyLots.filter(l => {
                    if (l.assigned_regu_id && l.assigned_regu_id !== assignmentReguId) return false;
                    const regu = occupancyRegus.find(r => r.regu_id === assignmentReguId);
                    if (!regu) return true;
                    const rg = normalizeCampGender(regu.gender);
                    const lg = normalizeCampGender(l.gender);
                    if (rg !== 'unknown' && lg !== 'unknown' && lg !== 'mixed' && rg !== lg) return false;
                    if (Number(l.capacity || 0) > 0 && Number(regu.member_count || 0) > Number(l.capacity)) return false;
                    return true;
                  }).map(l => <option key={l.id} value={l.id}>{l.lot_code} · {l.subcamp_name || 'Wilayah belum ditentukan'} · kapasitas {l.capacity || '—'}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void saveAssignmentBoard()} disabled={!assignmentReguId || !assignmentLotId || occupancyLoading || occupancySaving} className="self-end inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Save size={15}/>{occupancySaving ? 'Menyimpan…' : 'Simpan penempatan'}</button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Pemindahan regu akan memperbarui lokasi seluruh anggota regu melalui backend GAS. Pilihan kavling tetap divalidasi ulang oleh backend saat disimpan.</p>
          </section>

          <section className="rounded-2xl border border-[#ECECEF] bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#141418]">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kavling & daftar penghuni</h3>
              <input value={assignmentSearch} onChange={e => setAssignmentSearch(e.target.value)} placeholder="Cari kode kavling, regu, Gudep, atau peserta…" className="w-full rounded-xl border border-[#ECECEF] bg-slate-50 px-3 py-2 text-xs sm:max-w-sm dark:border-white/10 dark:bg-black/30 dark:text-white"/>
            </div>
            {occupancyLoading ? <div className="py-8 text-center text-sm text-slate-500">Memuat data dari GAS…</div> : <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {occupancyLots.filter(l => {
                const regu = occupancyRegus.find(r => r.regu_id === l.assigned_regu_id);
                const occupants = occupancyParticipants.filter(p => String(p.active_status || '').toUpperCase() !== 'ARCHIVED' && String(p.lot_number || p.lotNumber || '').trim() === String(l.lot_code || '').trim());
                const q = assignmentSearch.trim().toLowerCase();
                return !q || [l.lot_code, l.subcamp_name, regu?.regu_name, regu?.gudep_name, ...occupants.map(p => p.name || p.fullName || '')].some(v => String(v || '').toLowerCase().includes(q));
              }).map(l => {
                const regu = occupancyRegus.find(r => r.regu_id === l.assigned_regu_id);
                const occupants = occupancyParticipants.filter(p => String(p.active_status || '').toUpperCase() !== 'ARCHIVED' && String(p.lot_number || p.lotNumber || '').trim() === String(l.lot_code || '').trim());
                return <article key={l.id} className="overflow-hidden rounded-xl border border-[#ECECEF] dark:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-2 bg-slate-50 p-3 dark:bg-white/5">
                    <div><div className="text-sm font-bold text-slate-900 dark:text-white">{l.lot_code || 'Kavling tanpa kode'}</div><div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{l.subcamp_name || 'Wilayah belum ditentukan'} · kapasitas {l.capacity || '—'}</div></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${l.assigned_regu_id ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>{l.assigned_regu_id ? 'Terisi' : 'Tersedia'}</span>
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{regu?.regu_name || l.assigned_regu_name || 'Belum ada regu'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Gudep: {regu?.gudep_name || '—'} · {occupants.length} peserta terdaftar di kavling</div>
                    {occupants.length ? <div className="max-h-36 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100 dark:divide-white/5 dark:border-white/10">{occupants.map((p, i) => <div key={String(p.id || p.participant_id || i)} className="flex items-center justify-between gap-2 px-2.5 py-2"><div className="min-w-0"><div className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{p.name || p.fullName || 'Tanpa nama'}</div><div className="truncate text-[10px] text-slate-500 dark:text-slate-400">{p.pramuka_id || p.pramukaId || p.id || ''}</div></div><span className="shrink-0 text-[10px] text-slate-500">{p.gender || 'Gender belum diisi'}</span></div>)}</div> : <div className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">Belum ada peserta yang tercatat pada kavling ini.</div>}
                    <button type="button" onClick={() => { const mapped = lots.find(x => x.id === l.id); if (mapped) { setSelectedLot(mapped); setSelectedFacility(null); setActiveTab('map'); } }} disabled={!lots.some(x => x.id === l.id)} className="w-full rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40 dark:text-emerald-300">Lihat pada peta</button>
                  </div>
                </article>;
              })}
            </div>}
          </section>
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
