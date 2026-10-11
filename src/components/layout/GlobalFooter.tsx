/**
 * @license
 * SiEpang - Reusable Global Footer Component
 * Global footer: "SiEpang 2026 © Rohadi Wijaya | Dery Suandi"
 * Standardized across all views without hardcoding in individual page bodies.
 */

import React from 'react';
import { Tent } from 'lucide-react';

interface GlobalFooterProps {
  className?: string;
  variant?: 'inline' | 'sidebar';
}

export const GlobalFooter: React.FC<GlobalFooterProps> = ({ className = '', variant = 'inline' }) => {
  if (variant === 'sidebar') {
    return (
      <footer className={`px-4 py-3 border-t border-white/5 text-[11px] text-slate-500 ${className}`}>
        <div className="flex items-center gap-1.5 font-medium text-slate-400 mb-0.5">
          <Tent className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>SiEpang Camp System</span>
        </div>
        <p className="text-slate-500 leading-tight">
          SiEpang 2026 © Rohadi Wijaya | Dery Suandi
        </p>
      </footer>
    );
  }

  return (
    <footer className={`w-full py-6 px-4 mt-auto text-center border-t border-white/5 pb-24 md:pb-8 ${className}`}>
      <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-1 text-slate-500">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>SiEpang</span>
          <span className="text-slate-600">·</span>
          <span className="font-normal text-slate-400">Sistem Informasi Perkemahan Pramuka</span>
        </div>
        <p className="text-[11px] text-slate-500 tracking-wide font-normal">
          SiEpang 2026 © Rohadi Wijaya | Dery Suandi
        </p>
      </div>
    </footer>
  );
};
