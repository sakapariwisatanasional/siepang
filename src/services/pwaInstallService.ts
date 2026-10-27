// Installation UI only. No service worker, network interception or authentication changes.
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}
export type InstallState = {android: boolean; standalone: boolean; available: boolean; dismissed: boolean};
const KEY = 'siepang.install-offer.dismissed-until.v1';
const LATER_MS = 7 * 24 * 60 * 60 * 1000;

class PwaInstallService {
  private deferred: InstallPromptEvent | null = null;
  private listeners = new Set<() => void>();
  private busy = false;
  private state: InstallState = {android:false, standalone:false, available:false, dismissed:false};

  constructor() {
    if (typeof window === 'undefined') return;
    const display = window.matchMedia('(display-mode: standalone)');
    const fullscreen = window.matchMedia('(display-mode: fullscreen)');
    const checkDisplay = () => this.update({standalone: display.matches || fullscreen.matches});
    let dismissed = false;
    try { dismissed = Number(window.localStorage.getItem(KEY) || 0) > Date.now(); } catch { /* Optional preference storage. */ }
    this.state = {android:/Android/i.test(navigator.userAgent), standalone:display.matches || fullscreen.matches, available:false, dismissed};
    display.addEventListener?.('change', checkDisplay);
    fullscreen.addEventListener?.('change', checkDisplay);
    window.addEventListener('beforeinstallprompt', event => {
      // Let other platforms retain their default browser installation UI.
      if (!this.state.android) return;
      event.preventDefault();
      this.deferred = event as InstallPromptEvent;
      this.update({available:true});
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.update({standalone:true, available:false});
    });
    window.addEventListener('storage', event => {
      if (event.key === KEY || event.key === null) {
        let dismissed = false;
        try {dismissed = Number(window.localStorage.getItem(KEY) || 0) > Date.now();} catch { /* Optional. */ }
        this.update({dismissed});
      }
    });
  }

  private update(next: Partial<InstallState>) {
    this.state = {...this.state, ...next};
    this.listeners.forEach(listener => listener());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  dismiss = () => {
    try {window.localStorage.setItem(KEY, String(Date.now() + LATER_MS));} catch { /* Still dismiss for this visit. */ }
    this.update({dismissed:true});
  };
  async install(): Promise<'accepted' | 'dismissed' | 'manual'> {
    const event = this.deferred;
    if (!event || this.busy) return 'manual';
    this.busy = true;
    this.deferred = null;
    this.update({available:false});
    try {
      // Invoked directly from the user's click; never trigger automatically.
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') this.update({dismissed:true});
      else this.dismiss();
      return choice.outcome;
    } finally {this.busy = false;}
  }
}

export const pwaInstallService = new PwaInstallService();
