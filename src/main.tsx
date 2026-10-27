import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { dynamicManifestService } from './services/dynamicManifestService';
import { authService } from './services/authService';
import './index.css';
import { AndroidInstallBanner } from './components/pwa/AndroidInstallBanner';

type BoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Diagnostics are local to this browser; no user profile, OTP, or session is sent.
    console.error('[SiEpang] Application render error', error, info.componentStack);
  }

  render() {
    const error = this.state.error;
    if (!error) return this.props.children;

    return (
      <main style={{ minHeight: '100dvh', background: '#f8fafc', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Arial, sans-serif' }}>
        <section role="alert" style={{ width: '100%', maxWidth: 480, borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', padding: 24, boxShadow: '0 12px 36px rgba(0,0,0,.08)' }}>
          <div style={{ fontWeight: 900, fontSize: 24, color: '#b91c1c' }}>SiEpang perlu dipulihkan</div>
          <p style={{ lineHeight: 1.6 }}>Halaman tidak dapat ditampilkan. Data peserta dan Spreadsheet tidak dihapus. Anda dapat mencoba memuat ulang atau kembali ke halaman login.</p>
          <details style={{ marginBottom: 20, overflowWrap: 'anywhere' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Detail masalah (untuk pemeriksaan)</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, padding: 12, background: '#f1f5f9', borderRadius: 8 }}>{error.name}: {error.message}</pre>
          </details>
          <button type="button" onClick={() => window.location.reload()} style={{ width: '100%', minHeight: 48, background: '#b91c1c', border: 0, color: '#fff', borderRadius: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>Muat Ulang</button>
          <button type="button" onClick={() => {
            try { authService.logout(); } catch (e) { console.error('[SiEpang] Logout failed', e); }
            window.location.assign('/login');
          }} style={{ width: '100%', minHeight: 48, background: '#fff', border: '1px solid #9ca3af', color: '#111827', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Keluar dan Kembali ke Login</button>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 0 }}>Tombol kembali ke login akan mengakhiri sesi pada perangkat ini saja.</p>
        </section>
      </main>
    );
  }
}

try {
  dynamicManifestService.initDynamicManifest();
} catch (error) {
  console.warn('[SiEpang] PWA manifest initialization failed', error);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemen root SiEpang tidak ditemukan pada index.html');
}

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
    <AndroidInstallBanner />
  </AppErrorBoundary>
);
