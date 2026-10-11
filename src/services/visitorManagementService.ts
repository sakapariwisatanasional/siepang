/**
 * @license
 * SiEpang - Visitor / Camp Guest Management Service (Req 21-56)
 * Authoritative visitor lifecycle management:
 * - Dedicated DB entities (DB_VISITORS, DB_VISITOR_REGISTRATIONS, DB_VISITOR_VISITS, DB_VISITOR_GATES, DB_VISITOR_RULES)
 * - Self & Admin registration with person visited lookup (minimum exposure)
 * - Configurable categories, visiting hours, daily quota, access zones
 * - Approval modes: AUTO_APPROVED, REQUIRE_APPROVAL, INVITATION_ONLY
 * - Gate check-in and check-out with immutable Visit Logs
 * - Dynamic occupancy computation (Inside Camp count)
 * - Overdue visitor detection
 * - Single vs Multiple Entry visit sessions
 * - Revocation & watchlist with audit trail
 */

import {
  VisitorRegistration,
  VisitorGate,
  VisitorVisitLog,
  VisitorRulesConfig,
  VisitorCategory,
  VisitorStatus,
  VisitorApprovalMode,
  VisitorAccessZone,
  PersonBeingVisited,
} from '../types';
import { qrResolverService } from './qrResolverService';
import { apiTransport } from './apiTransport';
import { eventStudioService } from './eventStudioService';
import { eventService } from './eventService';
import { workspaceService } from './workspaceService';
import { participantService } from './participantService';

export interface GateScanResult {
  success: boolean;
  action: 'CHECKED_IN' | 'CHECKED_OUT' | 'REJECTED';
  message: string;
  visitor?: VisitorRegistration;
  visitLog?: VisitorVisitLog;
  insideCampCount: number;
  errorCode?:
    | 'NOT_FOUND'
    | 'NOT_APPROVED'
    | 'EXPIRED'
    | 'TOO_EARLY'
    | 'OUTSIDE_VISITING_HOURS'
    | 'ALREADY_CHECKED_IN'
    | 'CHECKED_OUT'
    | 'REVOKED'
    | 'QUOTA_EXCEEDED'
    | 'WRONG_EVENT'
    | 'ZONE_DISALLOWED';
}

class VisitorManagementService {
  private visitors: Map<string, VisitorRegistration> = new Map();
  private gates: Map<string, VisitorGate> = new Map();
  private visitLogs: VisitorVisitLog[] = [];
  private rules: VisitorRulesConfig;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.rules = this.initDefaultRules();
  }

  private initDefaultRules(): VisitorRulesConfig {
    return {
      visitingHours: [
        { dayName: 'Sabtu', openTime: '08:00', closeTime: '17:00', enabled: true },
        { dayName: 'Minggu', openTime: '08:00', closeTime: '14:00', enabled: true },
        { dayName: 'Senin', openTime: '09:00', closeTime: '16:00', enabled: true },
        { dayName: 'Selasa', openTime: '09:00', closeTime: '16:00', enabled: true },
      ],
      dailyQuota: 500,
      approvalMode: 'AUTO_APPROVED',
      entryTypeDefault: 'SINGLE_ENTRY',
      allowedZonesDefault: ['PUBLIC_AREA', 'VISITOR_AREA', 'MAIN_STAGE'],
      rulesAndGuidelines: [
        'Wajib mengenakan kartu tanda pengenal pengunjung (Visitor Pass) selama berada di area bumi perkemahan.',
        'Dilarang memasuki area perkemahan tenda peserta tanpa didampingi oleh Pembina Pendamping.',
        'Wajib menjaga kebersihan, ketertiban, dan mematuhi norma kesusilaan kepramukaan.',
        'Wajib memarkir kendaraan pada kantong parkir resmi yang telah ditentukan panitia.',
        'Wajib melakukan check-out di gerbang pos saat hendak meninggalkan area bumi perkemahan.',
      ],
      prohibitedItems: [
        'Senjata tajam, senjata api, dan benda berbahaya lainnya.',
        'Minuman keras, alkohol, narkoba, dan zat adiktif.',
        'Rokok / rokok elektrik di area perkemahan utama.',
        'Pengeras suara pribadi / sound system liar.',
      ],
      parkingInfo: 'Area parkir resmi yang telah ditentukan panitia.',
      emergencyContact: 'Posko Keamanan & Kesehatan Bumi Perkemahan', 
    };
  }

  // ==================== GETTERS & METRICS ====================

  public getVisitors(): VisitorRegistration[] {
    return Array.from(this.visitors.values());
  }

  public getVisitorById(id: string): VisitorRegistration | undefined {
    return this.visitors.get(id);
  }

  public getVisitorByCode(code: string): VisitorRegistration | undefined {
    const cleaned = code.trim().toUpperCase();
    return Array.from(this.visitors.values()).find(
      v => v.registrationCode.toUpperCase() === cleaned || v.id === code
    );
  }

  public getVisitorByToken(token: string): VisitorRegistration | undefined {
    return Array.from(this.visitors.values()).find(v => v.qrToken === token);
  }

  public getGates(): VisitorGate[] {
    return Array.from(this.gates.values());
  }

  public getVisitLogs(): VisitorVisitLog[] {
    return this.visitLogs;
  }

  public getRules(): VisitorRulesConfig {
    return this.rules;
  }

  /**
   * Authoritative calculation of Visitors Inside Camp (Req 43)
   * Derived strictly from CHECKED_IN records without subsequent CHECKED_OUT.
   */
  public getInsideCampCount(): number {
    return Array.from(this.visitors.values()).filter(v => v.status === 'CHECKED_IN').length;
  }

  /**
   * Detects overdue visitors (Req 44)
   * Expected departure has passed but visitor remains CHECKED_IN.
   */
  public getOverdueVisitors(): VisitorRegistration[] {
    const now = new Date();
    const currentHourMin = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    return Array.from(this.visitors.values()).filter(v => {
      if (v.status !== 'CHECKED_IN') return false;
      if (!v.expectedDeparture) return false;
      return currentHourMin > v.expectedDeparture;
    });
  }

  public getVisitorMetrics() {
    const all = Array.from(this.visitors.values());
    const insideCamp = all.filter(v => v.status === 'CHECKED_IN').length;
    const checkedOutToday = all.filter(v => v.status === 'CHECKED_OUT').length;
    const pendingApproval = all.filter(v => v.status === 'PENDING').length;
    const approvedToday = all.filter(v => v.status === 'APPROVED').length;
    const overdueList = this.getOverdueVisitors();

    return {
      totalRegistered: all.length,
      insideCamp,
      checkedOutToday,
      pendingApproval,
      approvedToday,
      overdueCount: overdueList.length,
      dailyQuota: this.rules.dailyQuota,
      remainingQuota: Math.max(0, this.rules.dailyQuota - all.length),
    };
  }

  // ==================== SEARCH & PERSON LOOKUP (Req 24, 45) ====================

  /**
   * Search potential persons to visit (participant, committee, unit)
   * Returns minimum necessary info without exposing private participant data!
   */
  public searchPersonToVisit(query: string): PersonBeingVisited[] {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();

    const results: PersonBeingVisited[] = [];

    // Search participants (expose ONLY name and contingent)
    const participants = participantService.getParticipants();
    const matchedParts = participants.filter(
      p => p.name.toLowerCase().includes(q) || p.contingentName.toLowerCase().includes(q)
    ).slice(0, 5);

    matchedParts.forEach(p => {
      results.push({
        type: 'participant',
        targetId: p.id,
        targetName: p.name,
        targetDetail: `Peserta · ${p.contingentName}`,
      });
    });

    // Static camp units
    const campUnits = [
      { name: 'Pimpinan Perkemahan (Pinkon)', detail: 'Posko Induk Panitia' },
      { name: 'Dewan Kerja Cabang (DKC)', detail: 'Sanggar Bhakti Kwarcab' },
      { name: 'Posko Kesehatan & Medis', detail: 'Tenda Medis Lapangan' },
      { name: 'Posko Keamanan & Ketertiban', detail: 'Pos Induk Keamanan' },
      { name: 'Pusat Informasi & Humas', detail: 'Gedung Media Center' },
    ];

    campUnits.filter(u => u.name.toLowerCase().includes(q) || u.detail.toLowerCase().includes(q)).forEach(u => {
      results.push({
        type: 'unit',
        targetName: u.name,
        targetDetail: u.detail,
      });
    });

    return results;
  }

  // ==================== REGISTRATION WORKFLOW (Req 22-26) ====================

  /**
   * Registers a new visitor (self or admin)
   */
  /** Registrasi publik: server menjadi satu-satunya sumber identitas QR. */
  public async registerVisitor(
    data: {
      name: string; phone: string; category: VisitorCategory;
      visitType?: 'VISITOR' | 'SPEAKER'; speakerAgenda?: string; speakerTopic?: string;
      identityType: 'KTP' | 'SIM' | 'Kartu Pegawai' | 'Paspor' | 'Lainnya';
      identityNumber?: string; organization?: string;
      personVisited: PersonBeingVisited; relationship: string;
      visitDate: string; expectedArrival: string; expectedDeparture: string;
      accompanyingPersonsCount?: number; vehicleInfo?: string; purpose: string;
      emergencyContact?: string;
      entryType?: 'SINGLE_ENTRY' | 'MULTIPLE_ENTRY';
      allowedZones?: VisitorAccessZone[];
    },
    registeredByAdmin?: string,
    requestKey?: string
  ): Promise<VisitorRegistration> {
    // The public route must work without an SiEpang login; GAS enforces validation.
    const res = await apiTransport.send<{ visitor: any }>(
      'public.visitors.register',
      {
        name: data.name.trim(), phone: data.phone.trim(), category: data.category,
        visit_type: data.visitType || 'VISITOR', speaker_agenda: data.speakerAgenda || '', speaker_topic: data.speakerTopic || '',
        identityType: data.identityType, id_number: data.identityNumber || '',
        institution: data.organization || '', personVisited: data.personVisited,
        relationship: data.relationship, visitDate: data.visitDate,
        expectedArrival: data.expectedArrival, expectedDeparture: data.expectedDeparture,
        accompanyingPersonsCount: data.accompanyingPersonsCount || 0,
        vehicleInfo: data.vehicleInfo || '', purpose: data.purpose,
        entryType: data.entryType || 'SINGLE_ENTRY',
        allowedZones: data.allowedZones || this.rules.allowedZonesDefault,
        request_key: requestKey || '',
      },
      { skipAuth: !registeredByAdmin, timeoutMs: 45000 }
    );
    if (!res.ok || !res.data?.visitor) {
      throw new Error(res.error?.message || 'Registrasi pengunjung belum dikonfirmasi oleh database.');
    }
    const raw = res.data.visitor;
    if (!raw.id || !raw.qr_token || !raw.registration_code) {
      throw new Error('Server belum mengembalikan QR pengunjung yang valid.');
    }
    const visitor: VisitorRegistration = {
      id: String(raw.id), registrationCode: String(raw.registration_code),
      name: String(raw.full_name || data.name), phone: data.phone,
      category: data.category, identityType: data.identityType,
      identityNumber: data.identityNumber, organization: data.organization,
      personVisited: data.personVisited, relationship: data.relationship,
      visitDate: data.visitDate, expectedArrival: data.expectedArrival,
      expectedDeparture: data.expectedDeparture,
      accompanyingPersonsCount: data.accompanyingPersonsCount || 0,
      vehicleInfo: data.vehicleInfo, purpose: data.purpose,
      status: String(raw.status || 'PENDING') as VisitorStatus,
      approvalMode: 'AUTO_APPROVED', qrToken: String(raw.qr_token),
      entryType: data.entryType || 'SINGLE_ENTRY',
      allowedZones: data.allowedZones || this.rules.allowedZonesDefault,
      createdAt: String(raw.registered_at || new Date().toISOString()),
    };
    this.visitors.set(visitor.id, visitor);
    this.notify();
    return visitor;
  }

  /**
   * Approves a pending visitor registration
   */
  public approveVisitor(id: string, approverName: string): VisitorRegistration {
    const visitor = this.visitors.get(id);
    if (!visitor) throw new Error('Data pengunjung tidak ditemukan.');

    visitor.status = 'APPROVED';
    visitor.approvedBy = approverName;
    visitor.approvedAt = new Date().toLocaleString('id-ID');
    visitor.rejectionReason = undefined;

    eventStudioService.addAuditLogEntry(
      'VISITOR_APPROVAL',
      `Pendaftaran kunjungan '${visitor.name}' (${visitor.registrationCode}) disetujui oleh ${approverName}.`,
      approverName
    );

    this.notify();
    return visitor;
  }

  /**
   * Rejects a visitor registration with reason
   */
  public rejectVisitor(id: string, rejectorName: string, reason: string): VisitorRegistration {
    const visitor = this.visitors.get(id);
    if (!visitor) throw new Error('Data pengunjung tidak ditemukan.');

    visitor.status = 'REJECTED';
    visitor.rejectionReason = reason;

    eventStudioService.addAuditLogEntry(
      'VISITOR_REJECTION',
      `Pendaftaran kunjungan '${visitor.name}' ditolak oleh ${rejectorName}. Alasan: ${reason}`,
      rejectorName
    );

    this.notify();
    return visitor;
  }

  /**
   * Revoke visitor access / watchlist (Req 41)
   */
  public revokeVisitor(id: string, revokedBy: string, reason: string): VisitorRegistration {
    const visitor = this.visitors.get(id);
    if (!visitor) throw new Error('Data pengunjung tidak ditemukan.');

    visitor.status = 'REVOKED';
    visitor.revokedBy = revokedBy;
    visitor.revokedReason = reason;

    // Revoke token in unified resolver
    qrResolverService.revokeToken(visitor.qrToken, revokedBy, reason);

    eventStudioService.addAuditLogEntry(
      'VISITOR_REVOKE',
      `Akses kunjungan '${visitor.name}' (${visitor.registrationCode}) DICABUT (REVOKED) oleh ${revokedBy}. Alasan: ${reason}`,
      revokedBy
    );

    this.notify();
    return visitor;
  }

  // ==================== GATE CHECK-IN & CHECK-OUT SCANNER (Req 31, 32, 39, 40) ====================

  /**
   * High-frequency gate check-in & check-out processor
   */
  /** Load data from GAS; memory is only a read-through cache. */
  public async loadVisitors(): Promise<void> {
    const res = await apiTransport.send<{ visitors: any[]; visits: any[]; gates: any[] }>('visitors.gate.list', {}, { timeoutMs: 45000 });
    if (!res.ok || !res.data) throw new Error(res.error?.message || 'Gagal memuat Buku Tamu dari GAS.');
    const result = res.data;
    this.visitors.clear();
    for (const v of result.visitors || []) {
      const person = (() => { try { return JSON.parse(v.person_visited_json || '{}'); } catch { return {}; } })();
      const mapped: VisitorRegistration = {
        id: String(v.id), registrationCode: String(v.registration_code || ''),
        name: String(v.full_name || ''), phone: String(v.phone || ''),
        category: String(v.category || 'Umum') as VisitorCategory, identityType: 'Lainnya',
        organization: String(v.institution || ''),
        personVisited: { type: 'unit', targetName: String(person.targetName || (v.visit_type === 'SPEAKER' ? 'Narasumber / Pemateri' : 'Kunjungan umum')), targetDetail: String(person.targetDetail || '') },
        relationship: '', visitDate: String(v.visit_date || ''), expectedArrival: '08:00',
        expectedDeparture: '17:00', accompanyingPersonsCount: 0,
        purpose: String(v.purpose || ''),
        status: String(v.status || 'APPROVED') as VisitorStatus,
        approvalMode: 'AUTO_APPROVED', qrToken: String(v.qr_token || ''),
        entryType: String(v.entry_type || 'SINGLE_ENTRY') as 'SINGLE_ENTRY' | 'MULTIPLE_ENTRY',
        allowedZones: ['PUBLIC_AREA','VISITOR_AREA'], createdAt: String(v.registered_at || ''),
      };
      this.visitors.set(mapped.id, mapped);
    }
    this.gates.clear();
    for (const g of result.gates || []) {
      this.gates.set(String(g.id), { id: String(g.id), eventId: String(g.event_id || ''), gateName: String(g.gate_name || ''),
        location: String(g.gate_location || ''), operatingHours: '08:00 - 17:00', allowedCategories: [], status: 'active' });
    }
    if (!this.gates.size) this.gates.set('gate_utama', { id: 'gate_utama', eventId: '', gateName: 'Gerbang Utama', location: 'Pos utama', operatingHours: '08:00 - 17:00', allowedCategories: [], status: 'active' });
    this.visitLogs = (result.visits || []).map((l: any): VisitorVisitLog => ({
      visitLogId: String(l.id), visitorId: String(l.visitor_id), visitorName: String(l.visitor_name || ''),
      visitorCategory: String(l.visitor_category || 'Umum') as VisitorCategory,
      registrationCode: String(l.registration_code || ''), eventId: String(l.event_id || ''),
      gateId: String(l.gate_id || ''), gateName: String(l.gate_name || ''),
      checkinAt: String(l.checkin_at || ''), checkoutAt: l.checkout_at ? String(l.checkout_at) : undefined,
      verifiedBy: String(l.officer_name || ''), deviceId: 'GAS',
      status: String(l.status || 'CHECKED_IN') as 'CHECKED_IN' | 'CHECKED_OUT',
    }));
    this.notify();
  }

  /** Explicit direction prevents accidental checkout when scanner retries a check-in. */
  public async processGateScan(
    qrTokenOrCode: string, gateId: string, officerName: string,
    options?: { overrideHours?: boolean; overrideReason?: string; forceCheckout?: boolean }
  ): Promise<GateScanResult> {
    const res = await apiTransport.send<{ scan: any }>('visitors.gate.scan', {
      token: qrTokenOrCode.trim(), gate_id: gateId,
      direction: options?.forceCheckout ? 'CHECK_OUT' : 'CHECK_IN',
    }, { timeoutMs: 45000 });
    if (!res.ok || !res.data?.scan) {
      return { success: false, action: 'REJECTED', message: res.error?.message || 'Scan gagal divalidasi oleh GAS.',
        insideCampCount: this.getInsideCampCount(), errorCode: (res.error?.code || 'NOT_FOUND') as GateScanResult['errorCode'] };
    }
    const raw = res.data.scan;
    await this.loadVisitors();
    const visitor = this.getVisitorById(String(raw.visitor_id));
    return { success: true, action: raw.action === 'CHECK_OUT' ? 'CHECKED_OUT' : 'CHECKED_IN',
      message: String(raw.message || 'Pencatatan gerbang berhasil.'), visitor,
      insideCampCount: this.getInsideCampCount() };
  }

  // ==================== CONFIGURATION UPDATES ====================

  public updateRules(updated: Partial<VisitorRulesConfig>, adminName: string): VisitorRulesConfig {
    this.rules = { ...this.rules, ...updated };
    eventStudioService.addAuditLogEntry(
      'UPDATE_VISITOR_RULES',
      `Kebijakan & jam kunjungan diperbarui oleh ${adminName}.`,
      adminName
    );
    this.notify();
    return this.rules;
  }

  public addGate(gate: Omit<VisitorGate, 'id'>, adminName: string): VisitorGate {
    const id = `gate_${Date.now()}`;
    const newGate: VisitorGate = { id, ...gate };
    this.gates.set(id, newGate);
    eventStudioService.addAuditLogEntry(
      'CREATE_VISITOR_GATE',
      `Pos gerbang baru '${newGate.gateName}' ditambahkan oleh ${adminName}.`,
      adminName
    );
    this.notify();
    return newGate;
  }

  public updateGate(id: string, updates: Partial<VisitorGate>): VisitorGate {
    const gate = this.gates.get(id);
    if (!gate) throw new Error('Gerbang tidak ditemukan.');
    const updated = { ...gate, ...updates };
    this.gates.set(id, updated);
    this.notify();
    return updated;
  }

  public deleteGate(id: string): void {
    this.gates.delete(id);
    this.notify();
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const visitorManagementService = new VisitorManagementService();
