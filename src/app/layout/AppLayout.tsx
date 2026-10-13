/**
 * @license
 * SiEpang - Main Responsive App Layout Shell
 * Integrates GlobalHeader, DesktopSidebar, MobileNavigation, and GlobalFooter.
 */

import React from 'react';
import { GlobalHeader } from '../../components/layout/GlobalHeader';
import { DesktopSidebar } from '../../components/navigation/DesktopSidebar';
import { MobileNavigation, NavTab } from '../../components/navigation/MobileNavigation';
import { GlobalFooter } from '../../components/layout/GlobalFooter';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  role: string;
  onOpenScanner: () => void;
  onOpenSyncCenter: () => void;
  onLogout?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  role,
  onOpenScanner,
  onOpenSyncCenter,
  onLogout,
}) => {
  const [isMobileMoreOpen, setIsMobileMoreOpen] = React.useState(false);
  const isPublicView = activeTab === 'public_home' || activeTab === 'public_gallery';

  if (isPublicView) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 transition-colors">
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 transition-colors">
      {/* Top Header */}
      <GlobalHeader
        onOpenScanner={onOpenScanner}
        onOpenSyncCenter={onOpenSyncCenter}
        onNavigateProfile={() => onTabChange('profile')}
        onNavigatePublic={() => onTabChange('public_home')}
        onOpenMore={() => setIsMobileMoreOpen(true)}
        onLogout={onLogout}
      />

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex w-full">
        {/* Desktop Collapsible Sidebar */}
        <DesktopSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          role={role}
          onOpenScanner={onOpenScanner}
          onLogout={onLogout}
        />

        {/* Primary Content Viewport */}
        <main className="flex-1 flex flex-col min-w-0 p-3 sm:p-5 lg:p-8 pb-24 md:pb-8 overflow-x-hidden">
          <div className="flex-1 w-full max-w-7xl mx-auto min-w-0">{children}</div>

          {/* Reusable Global Footer */}
          <div className="hidden md:block mt-8">
            <GlobalFooter />
          </div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Part 7, 8, 9) */}
      <MobileNavigation
        activeTab={activeTab}
        onTabChange={onTabChange}
        onOpenScanner={onOpenScanner}
        role={role}
        isMoreMenuOpen={isMobileMoreOpen}
        onToggleMoreMenu={setIsMobileMoreOpen}
        onLogout={onLogout}
      />
    </div>
  );
};
