import React, { useEffect, useRef, useState } from 'react';
import { Camera, Save, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiTransport } from '../../services/apiTransport';
import { authService } from '../../services/authService';

type Profile = { user_id: string; email: string; name: string; avatar: string; phone: string; institution: string; address: string; notes: string };
const empty: Profile = { user_id: '', email: '', name: '', avatar: '', phone: '', institution: '', address: '', notes: '' };
export const MyProfile: React.FC = () => {
  const [profile, setProfile] = useState<Profile>(empty);
  const [draft, setDraft] = useState<Profile>(empty);
  const [photo, setPhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiTransport.send<{profile: Profile}>('profile.me.get', {});
      if (!res.ok || !res.data?.profile) throw new Error(res.error?.message || 'Profil tidak tersedia dari GAS.');
      setProfile(res.data.profile); setDraft(res.data.profile); setPhoto('');
    } catch (e: any) { setError(e?.message || 'Gagal membaca profil.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const selectPhoto = async (file?: File) => {
    if (!file) return;
    setMessage(''); setError('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setError('Gunakan JPG, PNG, atau WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran foto maksimal 5 MB.'); return; }
    try {
      const img = await new Promise<HTMLImageElement>((resolve,reject) => {
        const el = new Image(); const url = URL.createObjectURL(file);
        el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
        el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak dapat dibuka.')); };
        el.src = url;
      });
      const c = document.createElement('canvas'); c.width = 512; c.height = 512;
      const ctx = c.getContext('2d'); if (!ctx) throw new Error('Canvas tidak didukung.');
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth-s)/2, (img.naturalHeight-s)/2, s, s, 0, 0, 512, 512);
      setPhoto(c.toDataURL('image/webp', .8));
    } catch (e:any) { setError(e.message || 'Gagal memproses foto.'); }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const res = await apiTransport.send<{profile: Profile}>('profile.me.save', {
        name: draft.name.trim(), phone: draft.phone.trim(), institution: draft.institution.trim(),
        address: draft.address.trim(), notes: draft.notes.trim(), photo_data_url: photo || undefined,
      }, {timeoutMs: 60000});
      if (!res.ok || !res.data?.profile) throw new Error(res.error?.message || 'GAS belum mengonfirmasi penyimpanan.');
      setProfile(res.data.profile); setDraft(res.data.profile); setPhoto('');
      authService.applyConfirmedProfile(res.data.profile);
      setMessage('Profil berhasil disimpan ke Spreadsheet dan Google Drive.');
    } catch (e:any) { setError(e.message || 'Gagal menyimpan profil.'); }
    finally { setSaving(false); }
  };
  const update = (field: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(prev => ({ ...prev, [field]: e.target.value }));
  return <div className="max-w-3xl mx-auto space-y-5 p-4 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Profil Saya</h1><p className="text-sm opacity-70">Kelola biodata dan foto akun SiEpang Anda.</p></div><button type="button" onClick={() => void load()} disabled={loading||saving} className="rounded-xl border px-3 py-2 flex items-center gap-2"><RefreshCw size={16}/> Muat Ulang</button></div>
    {error && <div role="alert" className="rounded-xl bg-red-100 text-red-900 p-3 text-sm">{error}</div>}
    {message && <div role="status" className="rounded-xl bg-emerald-100 text-emerald-900 p-3 text-sm">{message}</div>}
    {loading ? <p>Memuat biodata dari GAS…</p> : <form onSubmit={save} className="rounded-2xl border bg-white dark:bg-[#19191e] p-5 space-y-5 shadow-sm">
      <div className="flex gap-4 items-center flex-wrap"><img src={photo || draft.avatar || undefined} alt="Foto profil" className="w-24 h-24 rounded-2xl object-cover bg-slate-200 border" onError={e => { e.currentTarget.style.visibility='hidden'; }}/><div className="space-y-2"><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{void selectPhoto(e.target.files?.[0]);e.target.value='';}}/><button type="button" onClick={()=>fileRef.current?.click()} className="px-4 py-2 rounded-xl bg-emerald-700 text-white flex items-center gap-2"><Camera size={16}/> Ganti Foto</button><p className="text-xs opacity-70">JPG/PNG/WebP · maksimal 5 MB · otomatis dipotong persegi.</p></div></div>
      <div className="grid sm:grid-cols-2 gap-4"><label className="block text-sm font-semibold">Nama lengkap<input required minLength={2} maxLength={120} value={draft.name} onChange={update('name')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label><label className="block text-sm font-semibold">Email login (tidak dapat diubah)<input value={draft.email} readOnly className="mt-1 w-full rounded-xl border p-3 opacity-60 text-slate-900"/></label><label className="block text-sm font-semibold">Nomor telepon<input maxLength={32} value={draft.phone} onChange={update('phone')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label><label className="block text-sm font-semibold">Instansi / Pangkalan<input maxLength={180} value={draft.institution} onChange={update('institution')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label></div>
      <label className="block text-sm font-semibold">Alamat<textarea rows={2} maxLength={400} value={draft.address} onChange={update('address')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label><label className="block text-sm font-semibold">Informasi tambahan<textarea rows={3} maxLength={500} value={draft.notes} onChange={update('notes')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label>
      <p className="flex gap-2 text-xs opacity-70 items-center"><ShieldCheck size={15}/> Role, permission, email, dan status akun tidak dapat diubah melalui halaman ini.</p>
      <button disabled={saving} type="submit" className="px-5 py-3 rounded-xl bg-emerald-700 disabled:opacity-50 text-white font-semibold flex items-center gap-2"><Save size={17}/>{saving?'Menyimpan ke GAS…':'Simpan Perubahan'}</button>
    </form>}
  </div>;
};
