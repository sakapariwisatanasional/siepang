import React from 'react';
import { Eye, X } from 'lucide-react';
import { eventService } from '../../services/eventService';

interface ParticipantPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Production-safe preview shell.
 * The previous implementation used a demo session with in-memory registrations,
 * media and voting records. Preview now shows only the authoritative active event.
 */
export const ParticipantPreviewModal: React.FC<ParticipantPreviewModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const event = eventService.getCurrentEvent();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#16161A] border border-black/10 dark:border-white/10 shadow-2xl p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Preview Peserta</h3>
              <p className="text-[11px] text-slate-500">Data berasal dari event aktif.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Event aktif</div>
          <div className="font-bold text-slate-900 dark:text-white">
            {event.name || 'Belum ada event yang dikonfigurasi'}
          </div>
          {event.id ? (
            <div className="mt-1 text-[11px] font-mono text-slate-500">{event.id}</div>
          ) : (
            <p className="mt-2 text-xs text-amber-600">
              Preview detail peserta belum tersedia karena event belum dimuat dari GAS.
            </p>
          )}
        </div>

        <div className="mt-4 text-xs leading-relaxed text-slate-500">
          Preview tidak lagi membuat peserta, album, media, voting, atau status fiktif di browser.
          Detail preview akan menggunakan data aktual setelah modul GAS terkait tersedia.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
