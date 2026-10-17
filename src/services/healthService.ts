/**
 * SiEpang — Health & incident service. Spreadsheet/GAS is the only source of truth.
 * Local arrays are display caches only and are updated after GAS confirms each operation.
 */
import { HealthIncident, OperationalIncident } from '../types';
import { adminPersistenceService } from './adminPersistenceService';
import { eventService } from './eventService';

const toHealth = (r: any): HealthIncident => ({
  id: String(r.id || ''), participantCode: String(r.participant_code || r.participantCode || ''),
  participantName: String(r.participant_name || r.participantName || ''), contingentName: String(r.contingent_name || r.contingentName || ''),
  severity: r.severity, type: r.type, location: String(r.location || ''), reportedAt: String(r.reported_at || r.reportedAt || ''),
  reportedBy: String(r.reported_by || r.reportedBy || ''), treatment: String(r.treatment || ''), status: r.status,
});
const toIncident = (r: any): OperationalIncident => ({
  id: String(r.id || ''), title: String(r.title || ''), category: r.category, location: String(r.location || ''),
  reportedAt: String(r.reported_at || r.reportedAt || ''), reportedBy: String(r.reported_by || r.reportedBy || ''),
  severity: r.severity, description: String(r.description || ''), status: r.status,
});
const requireEvent = () => { const id = eventService.getCurrentEvent()?.id; if (!id) throw new Error('Event aktif belum dikonfigurasi dari GAS.'); return id; };

class HealthService {
  private healthIncidents: HealthIncident[] = [];
  private operationalIncidents: OperationalIncident[] = [];
  private listeners = new Set<() => void>();
  public subscribe(cb: () => void): () => void { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  private notify(): void { this.listeners.forEach(cb => cb()); }
  public getHealthIncidents(): HealthIncident[] { return [...this.healthIncidents]; }
  public getOperationalIncidents(): OperationalIncident[] { return [...this.operationalIncidents]; }

  public async refresh(): Promise<void> {
    const event_id = requireEvent();
    const [health, incidents] = await Promise.all([
      adminPersistenceService.list<any>('healthRecords', { event_id }),
      adminPersistenceService.list<any>('incidents', { event_id }),
    ]);
    this.healthIncidents = health.map(toHealth);
    this.operationalIncidents = incidents.map(toIncident);
    this.notify();
  }

  public async recordHealthIncident(incident: Omit<HealthIncident, 'id' | 'status'> & { id?: string; status?: HealthIncident['status'] }): Promise<HealthIncident> {
    const event_id = requireEvent();
    const saved = await adminPersistenceService.upsert<any>('healthRecords', { event_id, participant_code: incident.participantCode, participant_name: incident.participantName, contingent_name: incident.contingentName, severity: incident.severity, type: incident.type, location: incident.location, reported_at: incident.reportedAt || new Date().toISOString(), reported_by: incident.reportedBy, treatment: incident.treatment, status: incident.status || 'dirawat' });
    const row = toHealth(saved); if (!row.id) throw new Error('GAS tidak mengembalikan ID catatan kesehatan.');
    this.healthIncidents = [row, ...this.healthIncidents.filter(x => x.id !== row.id)]; this.notify(); return row;
  }
  public async recordOperationalIncident(incident: Omit<OperationalIncident, 'id' | 'status'> & { id?: string; status?: OperationalIncident['status'] }): Promise<OperationalIncident> {
    const event_id = requireEvent();
    const saved = await adminPersistenceService.upsert<any>('incidents', { event_id, title: incident.title, category: incident.category, location: incident.location, reported_at: incident.reportedAt || new Date().toISOString(), reported_by: incident.reportedBy, severity: incident.severity, description: incident.description, status: incident.status || 'terbuka' });
    const row = toIncident(saved); if (!row.id) throw new Error('GAS tidak mengembalikan ID insiden.');
    this.operationalIncidents = [row, ...this.operationalIncidents.filter(x => x.id !== row.id)]; this.notify(); return row;
  }
  public async updateHealthStatus(id: string, status: HealthIncident['status']): Promise<void> {
    const existing = this.healthIncidents.find(x => x.id === id); if (!existing) throw new Error('Catatan kesehatan tidak ditemukan. Muat ulang data dari GAS.');
    const saved = await adminPersistenceService.upsert<any>('healthRecords', { ...existing, id, event_id: requireEvent(), participant_code: existing.participantCode, participant_name: existing.participantName, contingent_name: existing.contingentName, reported_at: existing.reportedAt, reported_by: existing.reportedBy, status });
    const row = toHealth(saved); this.healthIncidents = this.healthIncidents.map(x => x.id === id ? row : x); this.notify();
  }
  public async updateOperationalStatus(id: string, status: OperationalIncident['status']): Promise<void> {
    const existing = this.operationalIncidents.find(x => x.id === id); if (!existing) throw new Error('Insiden tidak ditemukan. Muat ulang data dari GAS.');
    const saved = await adminPersistenceService.upsert<any>('incidents', { ...existing, id, event_id: requireEvent(), reported_at: existing.reportedAt, reported_by: existing.reportedBy, status });
    const row = toIncident(saved); this.operationalIncidents = this.operationalIncidents.map(x => x.id === id ? row : x); this.notify();
  }
}
export const healthService = new HealthService();
