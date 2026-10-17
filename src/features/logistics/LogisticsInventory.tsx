/**
 * @license
 * SiEpang - Logistik & Inventaris Tenda/Alat Perkemahan (RC1 Global Design System)
 * Standardized to Light-First, Instagram-inspired accent system, and 44px touch targets.
 */

import React, { useState, useEffect } from 'react';
import { Boxes, PackageCheck, AlertCircle, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { logisticsService } from '../../services/logisticsService';
import { LogisticItem } from '../../types';

export const LogisticsInventory: React.FC = () => {
  const [items, setItems] = useState<LogisticItem[]>(logisticsService.getItems());

  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let mounted = true;
    const unsub = logisticsService.subscribe(() => { if (mounted) setItems(logisticsService.getItems()); });
    logisticsService.refreshItems().then(() => { if (mounted) setLoadError(''); })
      .catch((err: any) => { if (mounted) setLoadError(err?.message || 'Gagal memuat inventaris dari GAS.'); });
    return () => { mounted = false; unsub(); };
  }, []);

  const handleQuickBorrow = async (id: string) => {
    try { await logisticsService.recordLoan(id); setLoadError(''); }
    catch (err: any) { setLoadError(err?.message || 'Peminjaman gagal disimpan melalui GAS.'); }
  };

  const handleQuickReturn = async (id: string) => {
    try { await logisticsService.recordReturn(id); setLoadError(''); }
    catch (err: any) { setLoadError(err?.message || 'Pengembalian gagal disimpan melalui GAS.'); }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-8">
      {loadError && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div>}
      {/* Header */}
      <div className="bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-xs font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/30 mb-1.5">
              <Boxes className="w-3.5 h-3.5" />
              <span>Manajemen Alat & Sarpras Buper</span>
            </div>
            <h1 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">
              Inventaris Logistik Perkemahan
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Pantau ketersediaan tenda, tongkat bambu, tali temali, dan perangkat sound system lapangan.
            </p>
          </div>
        </div>
      </div>

      {/* Item List / Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map(item => (
          <div
            key={item.id}
            className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/30 space-y-4 transition-colors shadow-2xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#171717] dark:text-white">{item.name}</h3>
                <div className="text-xs text-emerald-600 font-medium mt-0.5">{item.category}</div>
                <div className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-1">{item.location}</div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-[#171717] dark:text-slate-200">
                  Total: {item.totalStock} {item.unit}
                </span>
              </div>
            </div>

            {/* Stock Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-emerald-600 font-mono font-semibold">Tersedia: {item.availableStock}</span>
                <span className="text-amber-600 font-mono font-semibold">Dipinjam: {item.borrowedStock}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${(item.availableStock / item.totalStock) * 100}%` }}
                />
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${(item.borrowedStock / item.totalStock) * 100}%` }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleQuickBorrow(item.id)}
                disabled={item.availableStock === 0}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#FFF0F4] hover:bg-[#FFE0E8] text-[#F47743] border border-[#FFE0E8] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
                title="Catat Peminjaman"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Pinjam</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickReturn(item.id)}
                disabled={item.borrowedStock === 0}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#ECFDF5] hover:bg-[#D1FAE5] text-emerald-700 border border-[#A7F3D0] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
                title="Catat Pengembalian"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Kembalikan</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
