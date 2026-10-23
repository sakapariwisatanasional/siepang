/**
 * SiEpang — Inventaris Logistik Perkemahan
 * UI-only extension over the existing GAS-authoritative logistics service.
 * Keep this component scoped to inventory presentation and existing service calls.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  PackageCheck,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  Tent,
  Warehouse,
  CheckCircle2,
  X,
  LoaderCircle,
  Info,
} from 'lucide-react';
import { logisticsService } from '../../services/logisticsService';
import { eventStudioService } from '../../services/eventStudioService';
import { LogisticItem } from '../../types';

type NewItemForm = {
  name: string;
  category: string;
  totalStock: string;
  unit: string;
  condition: string;
  location: string;
};

const EMPTY_FORM: NewItemForm = {
  name: '',
  category: 'TENDA',
  totalStock: '1',
  unit: 'unit',
  condition: 'Baik',
  location: '',
};

const numberValue = (value: unknown): number => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? Math.max(0, result) : 0;
};

export const LogisticsInventory: React.FC = () => {
  const [items, setItems] = useState<LogisticItem[]>(() => logisticsService.getItems());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('SEMUA');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      await logisticsService.refreshFromBackend();
      setItems(logisticsService.getItems());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal memuat inventaris dari GAS.';
      setLoadError(message || 'Gagal memuat inventaris dari GAS.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = logisticsService.subscribe(() => {
      if (mounted) setItems(logisticsService.getItems());
    });
    void refresh();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refresh]);

  const totals = useMemo(() => items.reduce((summary, item) => {
    summary.itemTypes += 1;
    summary.total += numberValue(item.totalStock);
    summary.available += numberValue(item.availableStock);
    summary.borrowed += numberValue(item.borrowedStock);
    return summary;
  }, { itemTypes: 0, total: 0, available: 0, borrowed: 0 }), [items]);

  const categories = useMemo(() => ['SEMUA', ...Array.from(new Set(
    items.map(item => String(item.category || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'id'))], [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
    return items.filter(item => {
      const matchesCategory = categoryFilter === 'SEMUA' || item.category === categoryFilter;
      const searchable = [item.name, item.category, item.location, item.condition]
        .filter(Boolean).join(' ').toLocaleLowerCase('id-ID');
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [items, query, categoryFilter]);

  const handleQuickBorrow = async (id: string) => {
    setBusyItemId(id);
    setLoadError('');
    setNotice('');
    try {
      const changed = await logisticsService.recordLoan(id);
      if (!changed) throw new Error('Peminjaman tidak dapat dilakukan. Periksa stok tersedia.');
      setItems(logisticsService.getItems());
      setNotice('Peminjaman berhasil disimpan ke GAS.');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Peminjaman gagal disimpan melalui GAS.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleQuickReturn = async (id: string) => {
    setBusyItemId(id);
    setLoadError('');
    setNotice('');
    try {
      const changed = await logisticsService.recordReturn(id);
      if (!changed) throw new Error('Pengembalian tidak dapat dilakukan. Tidak ada stok yang sedang dipinjam.');
      setItems(logisticsService.getItems());
      setNotice('Pengembalian berhasil disimpan ke GAS.');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Pengembalian gagal disimpan melalui GAS.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleAddItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setLoadError('');
    setNotice('');

    const name = form.name.trim();
    const stock = Number(form.totalStock);
    if (!name) return setFormError('Nama perlengkapan wajib diisi.');
    if (!Number.isInteger(stock) || stock < 1) return setFormError('Jumlah stok harus berupa bilangan bulat minimal 1.');
    if (!form.category) return setFormError('Pilih kategori perlengkapan.');

    const activeEvent = eventStudioService.getEvent();
    const eventId = String(activeEvent?.id || '');
    if (!eventId) {
      setFormError('Event aktif belum terdeteksi. Buka event yang benar terlebih dahulu; data tidak dikirim tanpa event_id.');
      return;
    }

    setSaving(true);
    try {
      await logisticsService.addItem({
        name,
        category: form.category as LogisticItem['category'],
        totalStock: stock,
        availableStock: stock,
        borrowedStock: 0,
        unit: form.unit.trim() || 'unit',
        condition: form.condition.trim() || 'Belum diperiksa',
        location: form.location.trim(),
        event_id: eventId,
      } as Omit<LogisticItem, 'id' | 'borrowedStock'> & Record<string, any>, eventId);
      setItems(logisticsService.getItems());
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      setNotice('Inventaris berhasil disimpan ke spreadsheet melalui GAS.');
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Gagal menyimpan inventaris ke GAS.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                <Warehouse className="h-3.5 w-3.5" /> Manajemen Alat & Sarpras Buper
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Inventaris Logistik Perkemahan</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Halaman ini digunakan untuk mendata perlengkapan bumi perkemahan, memantau jumlah tersedia dan dipinjam,
                serta mencatat peminjaman dan pengembalian. Perubahan disimpan melalui backend GAS ke spreadsheet event aktif.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Memuat…' : 'Muat ulang'}
            </button>
            <button type="button" onClick={() => { setShowAddForm(true); setFormError(''); }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800">
              <Plus className="h-4 w-4" /> Tambah inventaris
            </button>
          </div>
        </div>
      </section>

      {loadError && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="font-bold">Data inventaris belum berhasil dimuat/disimpan</div><div className="mt-1 break-words">{loadError}</div></div>
      </div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        <CheckCircle2 className="h-5 w-5 shrink-0" />{notice}
      </div>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Boxes className="h-5 w-5" />} label="Jenis perlengkapan" value={totals.itemTypes} note="Item berbeda yang terdata" tone="violet" />
        <SummaryCard icon={<PackageCheck className="h-5 w-5" />} label="Total stok" value={totals.total} note="Seluruh unit perlengkapan" tone="slate" />
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="Tersedia" value={totals.available} note="Siap digunakan atau dipinjam" tone="emerald" />
        <SummaryCard icon={<ArrowUpRight className="h-5 w-5" />} label="Sedang dipinjam" value={totals.borrowed} note="Perlu dipantau pengembaliannya" tone="amber" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Daftar perlengkapan</h2>
            <p className="mt-1 text-sm text-slate-500">Pilih item untuk mencatat satu unit dipinjam atau dikembalikan.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_180px]">
            <label className="relative block">
              <span className="sr-only">Cari perlengkapan</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama, kategori, lokasi…"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
            </label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Filter kategori"
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
              {categories.map(category => <option key={category} value={category}>{category === 'SEMUA' ? 'Semua kategori' : category}</option>)}
            </select>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-slate-500">
            <LoaderCircle className="h-8 w-8 animate-spin text-violet-600" />
            <p className="text-sm font-semibold">Mengambil data inventaris dari GAS…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-violet-300 bg-violet-50/70 px-5 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm"><Tent className="h-7 w-7" /></div>
            <h3 className="mt-4 text-lg font-extrabold text-slate-900">Belum ada inventaris untuk ditampilkan</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Halaman ini sudah siap digunakan, tetapi daftar barang dari spreadsheet GAS masih kosong atau belum tersedia untuk event aktif.
              Tambahkan data awal seperti tenda, tali, tongkat, perlengkapan P3K, listrik, dan sound system.
            </p>
            <div className="mx-auto mt-5 grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <HintCard title="1. Data barang" text="Isi nama, kategori, jumlah, satuan, dan lokasi penyimpanan." />
              <HintCard title="2. Pantau stok" text="Stok tersedia dan dipinjam dihitung dari data yang tersimpan." />
              <HintCard title="3. Catat transaksi" text="Gunakan tombol Pinjam/Kembalikan untuk memperbarui stok melalui GAS." />
            </div>
            <button type="button" onClick={() => { setShowAddForm(true); setFormError(''); }}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white hover:bg-violet-800">
              <Plus className="h-4 w-4" /> Tambahkan barang pertama
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <Search className="mx-auto h-7 w-7 text-slate-400" />
            <h3 className="mt-3 font-bold text-slate-800">Tidak ada hasil yang cocok</h3>
            <p className="mt-1 text-sm text-slate-500">Ubah kata pencarian atau filter kategori.</p>
            <button type="button" onClick={() => { setQuery(''); setCategoryFilter('SEMUA'); }} className="mt-4 text-sm font-bold text-violet-700 hover:underline">Reset filter</button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredItems.map(item => {
              const total = numberValue(item.totalStock);
              const available = numberValue(item.availableStock);
              const borrowed = numberValue(item.borrowedStock);
              const availablePct = total > 0 ? Math.min(100, available / total * 100) : 0;
              const borrowedPct = total > 0 ? Math.min(100, borrowed / total * 100) : 0;
              const isBusy = busyItemId === item.id;
              return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Boxes className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <h3 className="break-words font-extrabold text-slate-900">{item.name || 'Barang tanpa nama'}</h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-violet-700">{item.category || 'Tanpa kategori'}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.location || 'Lokasi belum dicatat'}{(item as any).condition ? ` · Kondisi: ${(item as any).condition}` : ''}</p>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-right">
                    <div className="text-[11px] font-semibold text-slate-500">Total stok</div>
                    <div className="text-lg font-extrabold text-slate-900">{total} <span className="text-xs font-semibold">{item.unit || 'unit'}</span></div>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-emerald-700">Tersedia: {available}</span>
                    <span className="font-semibold text-amber-700">Dipinjam: {borrowed}</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label={`Stok tersedia ${available} dan dipinjam ${borrowed}`}>
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${availablePct}%` }} />
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${borrowedPct}%` }} />
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => void handleQuickBorrow(item.id)} disabled={isBusy || available <= 0}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45">
                    {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Pinjam
                  </button>
                  <button type="button" onClick={() => void handleQuickReturn(item.id)} disabled={isBusy || borrowed <= 0}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45">
                    {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownLeft className="h-4 w-4" />} Kembalikan
                  </button>
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <GuideCard title="Inventaris" text="Catat barang yang dikelola panitia dan lokasi penyimpanannya." />
        <GuideCard title="Peminjaman" text="Tekan Pinjam saat barang keluar. Stok tersedia turun dan stok dipinjam naik setelah GAS mengonfirmasi penyimpanan." />
        <GuideCard title="Pengembalian" text="Tekan Kembalikan setelah barang kembali. Periksa kondisi barang sebelum mencatatnya." />
      </section>

      {showAddForm && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setShowAddForm(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="add-logistics-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Data inventaris baru</p><h2 id="add-logistics-title" className="mt-1 text-xl font-extrabold text-slate-900">Tambah perlengkapan</h2><p className="mt-1 text-sm text-slate-500">Data dikirim ke GAS dan mengikuti event aktif.</p></div>
            <button type="button" disabled={saving} onClick={() => setShowAddForm(false)} aria-label="Tutup form" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
          </div>
          {formError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{formError}</div>}
          <form onSubmit={handleAddItem} className="mt-5 space-y-4">
            <div><label htmlFor="log-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Nama barang *</label><input id="log-name" required maxLength={120} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="Contoh: Tenda regu 8 orang" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label htmlFor="log-category" className="mb-1.5 block text-sm font-semibold text-slate-700">Kategori *</label><select id="log-category" value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">{['TENDA','PERLENGKAPAN','TALI_TEMALI','BAMBU','LISTRIK','SOUND','P3K','LAINNYA'].map(category => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></div>
              <div><label htmlFor="log-stock" className="mb-1.5 block text-sm font-semibold text-slate-700">Jumlah stok *</label><input id="log-stock" required type="number" min="1" step="1" value={form.totalStock} onChange={e => setForm(v => ({ ...v, totalStock: e.target.value }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></div>
              <div><label htmlFor="log-unit" className="mb-1.5 block text-sm font-semibold text-slate-700">Satuan</label><input id="log-unit" maxLength={30} value={form.unit} onChange={e => setForm(v => ({ ...v, unit: e.target.value }))} placeholder="unit, set, roll" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></div>
              <div><label htmlFor="log-condition" className="mb-1.5 block text-sm font-semibold text-slate-700">Kondisi</label><select id="log-condition" value={form.condition} onChange={e => setForm(v => ({ ...v, condition: e.target.value }))} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">{['Baik','Perlu diperiksa','Perlu perbaikan','Rusak'].map(condition => <option key={condition}>{condition}</option>)}</select></div>
            </div>
            <div><label htmlFor="log-location" className="mb-1.5 block text-sm font-semibold text-slate-700">Lokasi penyimpanan</label><input id="log-location" maxLength={120} value={form.location} onChange={e => setForm(v => ({ ...v, location: e.target.value }))} placeholder="Contoh: Gudang utama" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />Jumlah tersedia akan dimulai sama dengan total stok, sedangkan jumlah dipinjam dimulai dari nol. Pastikan event aktif sudah benar.</div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={() => setShowAddForm(false)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? 'Menyimpan…' : 'Simpan inventaris'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
};

function SummaryCard({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: number; note: string; tone: 'violet' | 'slate' | 'emerald' | 'amber' }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tones[tone]}`}>{icon}</div><div className="text-sm font-semibold text-slate-600">{label}</div></div><div className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">{value.toLocaleString('id-ID')}</div><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}

function HintCard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-violet-100 bg-white p-3"><div className="text-sm font-bold text-slate-800">{title}</div><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>;
}

function GuideCard({ title, text }: { title: string; text: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm font-extrabold text-slate-800">{title}</div><p className="mt-1 text-sm leading-5 text-slate-600">{text}</p></article>;
}
