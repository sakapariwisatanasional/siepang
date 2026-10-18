import React, { useEffect, useMemo, useState } from 'react';
import { Participant } from '../../types';
import { gudepRegistrationService, GudepRecord, GudepRegu } from '../../services/gudepRegistrationService';
import { participantAdminService } from '../../services/participantAdminService';
import { participantService } from '../../services/participantService';
import { ProfilePhotoUploader } from '../../components/media/ProfilePhotoUploader';

type Props = {
  mode: 'assign' | 'edit' | 'archive';
  participants: Participant[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

export const ParticipantAdminDialog: React.FC<Props> = ({mode, participants, onClose, onSaved}) => {
  const [gudep, setGudep] = useState<GudepRecord[]>([]);
  const [regu, setRegu] = useState<GudepRegu[]>([]);
  const [gudepId,setGudepId] = useState('');
  const [reguId,setReguId] = useState('');
  const [name,setName] = useState(participants[0]?.name || '');
  const [nta,setNta] = useState(participants[0]?.membershipNumber || '');
  const [email,setEmail] = useState(participants[0]?.email || '');
  const [phone,setPhone] = useState(participants[0]?.phone || '');
  const [saving,setSaving] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [confirmText,setConfirmText] = useState('');
  const ids = useMemo(() => participants.map(p=>p.id),[participants]);
  useEffect(() => {
    if(mode !== 'assign') return;
    let open = true; setLoading(true);
    gudepRegistrationService.list().then(res=>{
      if(open) setGudep((res.gudep||[]).filter(x=>x.verification_status==='VERIFIED' && x.activation_status==='ACTIVE'));
    }).catch(e=>{if(open)setError(e.message || 'Gagal memuat Gudep.');})
      .finally(()=>{if(open)setLoading(false);});
    return ()=>{open=false;};
  },[mode]);
  useEffect(()=>{
    if(!gudepId){setRegu([]);setReguId('');return;}
    let open=true;setLoading(true);
    gudepRegistrationService.detail(gudepId).then(res=>{
      if(open) setRegu((res.regu||[]).filter(r=>r.activation_status==='ACTIVE' && r.verification_status==='VERIFIED'));
    }).catch(e=>{if(open)setError(e.message||'Gagal memuat Regu.');})
      .finally(()=>{if(open)setLoading(false);});
    return ()=>{open=false;};
  },[gudepId]);
  const genders = [...new Set(participants.map(p=>p.gender))];
  const allowedRegu = regu.filter(r=>genders.length===1 && (genders[0]==='M' ? r.gender==='PUTRA' : r.gender==='PUTRI'));
  const selected = allowedRegu.find(r=>r.regu_id===reguId);
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');
    if(mode==='assign' && (!gudepId || !selected)){setError('Pilih Gudep dan Regu yang sesuai.');return;}
    if(mode==='archive' && confirmText !== 'ARSIP'){setError('Ketik ARSIP untuk konfirmasi.');return;}
    if(mode==='edit' && !name.trim()){setError('Nama tidak boleh kosong.');return;}
    setSaving(true);
    try {
      if(mode==='assign') await participantAdminService.assignRegu(ids,gudepId,reguId);
      if(mode==='edit') await participantAdminService.update(ids[0],{name:name.trim(),pramuka_id:nta.trim(),email:email.trim(),phone:phone.trim()});
      if(mode==='archive') await participantAdminService.archive(ids);
      await participantService.loadParticipants();
      onSaved(mode==='assign' ? `${ids.length} peserta berhasil dialokasikan di GAS.` : mode==='edit' ? 'Perubahan peserta berhasil disimpan di GAS.' : `${ids.length} peserta berhasil diarsipkan.`);
      onClose();
    } catch(e:any) {setError(e?.message || 'Perubahan gagal.');}
    finally{setSaving(false);}
  }
  return <div className="fixed inset-0 z-[90] bg-black/70 p-3 flex items-center justify-center" onClick={e=>{if(e.target===e.currentTarget && !saving)onClose();}}>
    <form onSubmit={submit} className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#17171B] text-white p-6 space-y-4 shadow-2xl max-h-[95vh] overflow-y-auto">
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-lg">{mode==='assign'?'Alokasikan ke Gugus Depan & Regu':mode==='edit'?'Edit Data Peserta':'Arsipkan Peserta'}</h3><button type="button" onClick={onClose} disabled={saving} className="text-slate-300 px-2">✕</button></div>
      <p className="text-sm text-slate-300">{participants.length} peserta dipilih. Semua perubahan disimpan oleh GAS setelah validasi hak Admin/Superadmin.</p>
      {mode==='assign' && <>
        <label className="text-xs block">Gugus Depan tujuan<select value={gudepId} onChange={e=>{setGudepId(e.target.value);setReguId('');}} className="mt-1 w-full rounded-xl p-3 bg-[#24242A] border border-white/20 text-white" required><option value="">-- Pilih Gudep Aktif --</option>{gudep.map(g=><option key={g.gudep_id} value={g.gudep_id}>{g.gudep_name} · {g.gudep_number}</option>)}</select></label>
        <label className="text-xs block">Regu tujuan<select value={reguId} onChange={e=>setReguId(e.target.value)} className="mt-1 w-full rounded-xl p-3 bg-[#24242A] border border-white/20 text-white" required disabled={!gudepId||genders.length!==1}><option value="">-- Pilih Regu --</option>{allowedRegu.map(r=><option key={r.regu_id} value={r.regu_id}>{r.regu_name} · {r.gender} · Kuota {r.quota}</option>)}</select></label>
        {genders.length>1&&<p className="text-amber-400 text-xs">Pilihan peserta campuran Putra/Putri. Pilih peserta satu jenis kelamin terlebih dahulu.</p>}
        <p className="text-xs text-slate-400">GAS akan memastikan Regu aktif, jenis kelamin sesuai, dan kuota masih mencukupi. QR dan XP peserta tetap memakai ID yang sama.</p>
      </>}
      {mode==='edit' && <div className="grid gap-4">
        {([['Nama Peserta',name,setName],['Nomor Pramuka / NTA',nta,setNta],['Email',email,setEmail],['Telepon',phone,setPhone]] as const).map(([label,value,setValue])=><label key={label} className="text-xs">{label}<input value={value} onChange={e=>setValue(e.target.value)} className="mt-1 w-full rounded-xl p-3 bg-[#24242A] border border-white/20 text-white"/></label>)}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <h4 className="text-sm font-bold">Foto Profil Peserta</h4>
          <p className="text-xs text-slate-400">Ganti atau unggah foto resmi peserta. Foto akan dihubungkan ke ID peserta ini melalui GAS.</p>
          <ProfilePhotoUploader
            entityType={(participants[0]?.role === 'Pembina Pendamping' || participants[0]?.role === 'Pimpinan Kontingen') ? 'OFFICIAL' : 'PARTICIPANT'}
            entityId={participants[0]?.id || ''}
            entityName={participants[0]?.name || name || 'Peserta'}
            currentPhotoUrl={participants[0]?.photoUrl || undefined}
            required
            onPhotoSaved={() => {
              void participantService.loadParticipants()
                .then(() => onSaved('Foto profil peserta berhasil diperbarui dari GAS.'))
                .catch((e: any) => setError(e?.message || 'Foto tersimpan, tetapi daftar peserta gagal dimuat ulang.'));
            }}
          />
        </section>
        <p className="text-xs text-slate-400">Pemindahan Gudep/Regu dilakukan melalui menu Alokasikan. ID peserta, saldo XP, dan riwayat QR tidak berubah.</p>
      </div>}
      {mode==='archive' && <><p className="text-sm text-amber-300">Peserta akan dinonaktifkan dan hubungan Regu aktifnya diarsipkan. Data utama, QR, dan catatan XP tidak dihapus secara fisik.</p><label className="text-xs">Ketik ARSIP untuk mengonfirmasi<input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="mt-1 w-full rounded-xl p-3 bg-[#24242A] border border-white/20 text-white" placeholder="ARSIP"/></label></>}
      {loading&&<p className="text-slate-400 text-xs">Memuat data Gudep/Regu…</p>}
      {error&&<p role="alert" className="text-red-300 bg-red-900/25 rounded-xl p-3 text-sm">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl bg-white/10">Batal</button><button type="submit" disabled={saving||loading} className="px-4 py-2 rounded-xl bg-[#F47743] font-bold disabled:opacity-40">{saving?'Menyimpan…':mode==='archive'?'Arsipkan':'Simpan ke GAS'}</button></div>
    </form>
  </div>;
};
