import { apiTransport } from './apiTransport';
import { bootstrapService } from './bootstrapService';

export interface HomepageContent { title: string; description: string; ctaLabel: string; }
export interface HomepageSnapshot { event_id: string; draft: HomepageContent | null; published: HomepageContent | null; }

export const homepageContentService = {
  async getPublished(): Promise<HomepageContent | null> {
    const backend = bootstrapService.getBackendUrl();
    if (!backend) throw new Error('Backend Beranda belum tersedia.');
    const url = new URL(backend);
    url.searchParams.set('action','homepage.public.get');
    const response = await fetch(url.toString(),{method:'GET',redirect:'follow'});
    if(!response.ok) throw new Error(`Gagal membaca Beranda (${response.status}).`);
    const body = await response.json();
    if(!body.ok) throw new Error(body.error?.message || 'Gagal membaca konten Beranda.');
    return body.data?.content || null;
  },
  async getAdmin(): Promise<HomepageSnapshot> {
    const res=await apiTransport.send<HomepageSnapshot>('homepage.admin.get',{});
    if(!res.ok||!res.data) throw new Error(res.error?.message||'Tidak dapat membaca pengaturan Beranda.');
    return res.data;
  },
  async save(content:HomepageContent,publish:boolean):Promise<HomepageSnapshot> {
    const res=await apiTransport.send<HomepageSnapshot>(publish?'homepage.admin.publish':'homepage.admin.save',{content});
    if(!res.ok||!res.data) throw new Error(res.error?.message||'Penyimpanan tidak dikonfirmasi GAS.');
    const verified = await this.getAdmin();
    const item=publish?verified.published:verified.draft;
    if(!item || item.title!==content.title || item.description!==content.description || item.ctaLabel!==content.ctaLabel) throw new Error('Data belum terverifikasi setelah dibaca ulang dari Spreadsheet.');
    return verified;
  }
};
