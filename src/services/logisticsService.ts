/** SiEpang — Logistics inventory. GAS Spreadsheet is the only source of truth. */
import { LogisticItem } from '../types';
import { adminPersistenceService } from './adminPersistenceService';
import { eventService } from './eventService';
import { apiClient } from './apiClient';

const mapItem = (r: any): LogisticItem => ({ id: String(r.id || ''), name: String(r.name || ''), category: r.category, totalStock: Number(r.total_stock ?? r.totalStock ?? 0), availableStock: Number(r.available_stock ?? r.availableStock ?? 0), borrowedStock: Number(r.borrowed_stock ?? r.borrowedStock ?? 0), unit: String(r.unit || ''), location: String(r.location || '') });
const eventId = () => { const id = eventService.getCurrentEvent()?.id; if (!id) throw new Error('Event aktif belum dikonfigurasi dari GAS.'); return id; };
class LogisticsService {
  private items: LogisticItem[] = []; private listeners = new Set<() => void>();
  public subscribe(cb: () => void): () => void { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  private notify(): void { this.listeners.forEach(cb => cb()); }
  public getItems(): LogisticItem[] { return [...this.items]; }
  public async refreshItems(): Promise<LogisticItem[]> { const rows = await adminPersistenceService.list<any>('logistics', { event_id: eventId() }); this.items = rows.map(mapItem); this.notify(); return this.getItems(); }
  public async addItem(item: Omit<LogisticItem, 'id' | 'borrowedStock'>): Promise<LogisticItem> {
    if (!item.name.trim() || !Number.isFinite(item.totalStock) || item.totalStock < 0) throw new Error('Nama barang dan stok yang valid wajib diisi.');
    const result = await apiClient.request<any>('logistics/add', { data: { ...item, event_id: eventId(), totalStock: item.totalStock, availableStock: item.totalStock, borrowedStock: 0 } });
    if (!result.success || !result.data) throw new Error(result.error?.message || 'GAS belum mengonfirmasi penyimpanan logistik.');
    await this.refreshItems(); const row = mapItem(result.data.record || result.data); if (!row.id) throw new Error('GAS menyimpan permintaan tetapi tidak mengembalikan ID barang.'); return row;
  }
  public async updateItem(id: string, updates: Partial<LogisticItem>): Promise<void> {
    const result = await apiClient.request<any>('logistics/update', { data: { id, updates } });
    if (!result.success) throw new Error(result.error?.message || 'GAS belum mengonfirmasi perubahan barang.'); await this.refreshItems();
  }
  public async recordLoan(id: string): Promise<boolean> {
    const result = await apiClient.request<any>('logistics/loan', { data: { id, count: 1 } });
    if (!result.success) throw new Error(result.error?.message || 'GAS belum mengonfirmasi peminjaman.'); await this.refreshItems(); return true;
  }
  public async recordReturn(id: string): Promise<boolean> {
    const result = await apiClient.request<any>('logistics/return', { data: { id, count: 1 } });
    if (!result.success) throw new Error(result.error?.message || 'GAS belum mengonfirmasi pengembalian.'); await this.refreshItems(); return true;
  }
}
export const logisticsService = new LogisticsService();
