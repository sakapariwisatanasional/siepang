import React, { useEffect, useRef, useState } from 'react';
import { Camera, Save, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiTransport } from '../../services/apiTransport';
import { authService } from '../../services/authService';

type Profile = { user_id: string; email: string; name: string; avatar: string; phone: string; institution: string; address: string; notes: string };
const empty: Profile = { user_id: '', email: '', name: '', avatar: '', phone: '', institution: '', address: '', notes: '' };
const normalize = (value: Partial<Profile>): Profile => ({
  user_id: String(value.user_id || ''), email: String(value.email || ''),
  name: String(value.name || ''), avatar: String(value.avatar || ''),
  phone: String(value.phone || ''), institution: String(value.institution || ''),
  address: String(value.address || ''), notes: String(value.notes || ''),
});
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('') || 'U';

export const MyProfile: React.FC = () => {
  const [profile, setProfile] = useState<Profile>(empty);
  const [draft, setDraft] = useState<Profile>(empty);
  const [photo, setPhoto] = useState('');
  const [photoBroken, setPhotoBroken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const load = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await apiTransport.send<{profile: Profile}>('profile.me.get', {}, { timeoutMs: 45000 });
      if (!res.ok || !res.data?.profile) throw new Error(res.error?.message || 'Profil tidak tersedia dari GAS.');
      if (!mounted.current) return;
      const confirmed = normalize(res.data.profile);
      setProfile(confirmed); setDraft(confirmed); setPhoto(''); setPhotoBroken(false);
      authService.applyConfirmedProfile(confirmed);
    } catch (e: any) { if (mounted.current) setError(e?.message || 'Gagal membaca profil dari GAS.'); }
    finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, []);

  const selectPhoto = async (file?: File) => {
    if (!file) return;
    setMessage(''); setError('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setError('Gunakan JPG, PNG, atau WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran foto maksimal 5 MB.'); return; }
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        const url = URL.createObjectURL(file);
        element.onload = () => { URL.revokeObjectURL(url); resolve(element); };
        element.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak dapat dibuka.')); };
        element.src = url;
      });
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Browser tidak mendukung pemrosesan foto.');
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
      const encoded = canvas.toDataURL('image/webp', 0.8);
      if (encoded.length > 1500000) throw new Error('Foto setelah diproses masih terlalu besar untuk GAS.');
      if (mounted.current) { setPhoto(encoded); setPhotoBroken(false); }
    } catch (e: any) { setError(e?.message || 'Gagal memproses foto.'); }
  };

  const changed = Boolean(photo) || (['name','phone','institution','address','notes'] as const).some(key => draft[key] !== profile[key]);
  const update = (field: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft(previous => ({ ...previous, [field]: e.target.value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || loading || !changed) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const res = await apiTransport.send<{profile: Profile}>('profile.me.save', {
        name: draft.name.trim(), phone: draft.phone.trim(), institution: draft.institution.trim(),
        address: draft.address.trim(), notes: draft.notes.trim(), photo_data_url: photo || undefined,
      }, { timeoutMs: 60000 });
      if (!res.ok || !res.data?.profile) throw new Error(res.error?.message || 'GAS belum mengonfirmasi penyimpanan.');
      if (!mounted.current) return;
      const confirmed = normalize(res.data.profile);
      setProfile(confirmed); setDraft(confirmed); setPhoto(''); setPhotoBroken(false);
      authService.applyConfirmedProfile(confirmed);
      setMessage('Perubahan profil sudah dikonfirmasi dan disimpan oleh GAS.');
    } catch (e: any) { if (mounted.current) setError(e?.message || 'Gagal menyimpan profil. Jika timeout, muat ulang untuk memeriksa data GAS sebelum mencoba lagi.'); }
    finally { if (mounted.current) setSaving(false); }
  };

  const imageUrl = photo || draft.avatar;
  return (
    <div className="max-w-3xl mx-auto space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Profil Saya</h1><p className="text-sm opacity-70">Perbarui biodata dan foto akun SiEpang yang tersimpan di GAS.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading || saving} className="rounded-xl border px-3 py-2 flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16}/> Muat Ulang</button>
      </div>
      {error && <div role="alert" className="rounded-xl bg-red-100 text-red-900 p-3 text-sm flex gap-2 items-start"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
      {message && <div role="status" className="rounded-xl bg-emerald-100 text-emerald-900 p-3 text-sm">{message}</div>}
      {loading ? <p>Memuat biodata dari GAS…</p> : (
        <form onSubmit={save} className="rounded-2xl border bg-white dark:bg-[#19191e] p-5 space-y-5 shadow-sm">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="w-24 h-24 rounded-2xl bg-slate-200 dark:bg-slate-700 border overflow-hidden flex items-center justify-center text-slate-700 dark:text-white text-2xl font-bold" aria-label="Avatar profil">
              {imageUrl && !photoBroken
                ? <img key={imageUrl} src={imageUrl} alt={`Foto ${draft.name || 'pengguna'}`} className="w-full h-full object-cover" onError={() => setPhotoBroken(true)}/>
                : <span aria-label="Inisial pengguna">{initials(draft.name)}</span>}
            </div>
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value = ''; }}/>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"><Camera size={16}/> Ganti Foto</button>
              <p className="text-xs opacity-70">JPG, PNG, atau WebP · maksimal 5 MB · dipotong otomatis menjadi persegi.</p>
              {photoBroken && !photo && <p className="text-xs text-amber-700 dark:text-amber-400">URL foto dari GAS belum dapat ditampilkan. Anda dapat mengganti foto atau meminta Admin memeriksa akses Drive.</p>}
              {photo && <p className="text-xs text-emerald-700 dark:text-emerald-400">Foto baru belum tersimpan. Klik Simpan Perubahan.</p>}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">Nama lengkap<input required minLength={2} maxLength={120} value={draft.name} onChange={update('name')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label>
            <label className="block text-sm font-semibold">Email login (tidak dapat diubah)<input value={draft.email} readOnly className="mt-1 w-full rounded-xl border p-3 opacity-60 text-slate-900"/></label>
            <label className="block text-sm font-semibold">Nomor telepon<input maxLength={32} value={draft.phone} onChange={update('phone')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label>
            <label className="block text-sm font-semibold">Instansi / Pangkalan<input maxLength={180} value={draft.institution} onChange={update('institution')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label>
          </div>
          <label className="block text-sm font-semibold">Alamat<textarea rows={2} maxLength={400} value={draft.address} onChange={update('address')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label>
          <label className="block text-sm font-semibold">Informasi tambahan<textarea rows={3} maxLength={500} value={draft.notes} onChange={update('notes')} className="mt-1 w-full rounded-xl border p-3 text-slate-900"/></label>
          <p className="flex gap-2 text-xs opacity-70 items-center"><ShieldCheck size={15}/> Role, permission, email, dan status akun tidak dapat diubah dari halaman ini.</p>
          <button disabled={saving || !changed} type="submit" className="px-5 py-3 rounded-xl bg-emerald-700 disabled:opacity-50 text-white font-semibold flex items-center gap-2"><Save size={17}/>{saving ? 'Menyimpan ke GAS…' : 'Simpan Perubahan'}</button>
        </form>
      )}
    </div>
  );
};
