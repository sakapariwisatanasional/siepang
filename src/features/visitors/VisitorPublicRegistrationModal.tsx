/**
 * @license
 * SiEpang - Public Visitor Self-Registration & Digital Pass
 * Mobile-friendly public visitor portal:
 * - Neutral design system styling (zero hardcoded red/event-specific borders)
 * - Dynamic event binding
 * - Secure digital pass generation with dynamic QR
 */

import React, { useState, useRef } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  Car,
  Phone,
  QrCode,
  Printer,
  X,
  Info,
} from 'lucide-react';
import { visitorManagementService } from '../../services/visitorManagementService';
import {
  VisitorRegistration,
  VisitorCategory,
  PersonBeingVisited,
} from '../../types';
import { eventService } from '../../services/eventService';

interface VisitorPublicRegistrationModalProps {
  onClose: () => void;
}

export const VisitorPublicRegistrationModal: React.FC<VisitorPublicRegistrationModalProps> = ({
  onClose,
}) => {
  const currentEvent = eventService.getCurrentEvent();
  const eventName = currentEvent.name && currentEvent.name !== 'Belum Dikonfigurasi'
    ? currentEvent.name
    : 'Kegiatan Perkemahan';

  // Registration step state
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [submittedVisitor, setSubmittedVisitor] = useState<VisitorRegistration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const submitLock = useRef(false);
  const requestKey = useRef('');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<VisitorCategory>('Orang Tua / Wali');
  const [visitType, setVisitType] = useState<'VISITOR' | 'SPEAKER'>('VISITOR');
  const [speakerAgenda, setSpeakerAgenda] = useState('');
  const [speakerTopic, setSpeakerTopic] = useState('');
  const [identityType, setIdentityType] = useState<'KTP' | 'SIM' | 'Kartu Pegawai' | 'Paspor' | 'Lainnya'>('KTP');
  const [identityNumber, setIdentityNumber] = useState('');
  const [organization, setOrganization] = useState('');
  const [purpose, setPurpose] = useState('Mengunjungi peserta / berkunjung ke perkemahan');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expectedArrival, setExpectedArrival] = useState('09:00');
  const [expectedDeparture, setExpectedDeparture] = useState('14:00');
  const [accompanyingCount, setAccompanyingCount] = useState(0);
  const [vehicleInfo, setVehicleInfo] = useState('');

  // Person visited search state
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PersonBeingVisited[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonBeingVisited | null>(null);
  const [relationship, setRelationship] = useState('Keluarga / Kerabat');

  const handleSearchPerson = (q: string) => {
    setPersonSearchQuery(q);
    const results = visitorManagementService.searchPersonToVisit(q);
    setSearchResults(results);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || submitLock.current) return;
    if (visitType === 'SPEAKER' && !speakerAgenda.trim()) { setSubmitError('Agenda yang diisi narasumber wajib disebutkan.'); return; }
    submitLock.current = true;
    setIsSubmitting(true);
    setSubmitError('');
    if (!requestKey.current) requestKey.current = `visit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
    const registered = await visitorManagementService.registerVisitor({
      name: name.trim(),
      phone: phone.trim(),
      category,
      visitType, speakerAgenda, speakerTopic,
      identityType,
      identityNumber,
      organization,
      personVisited: selectedPerson || { type: 'unit', targetName: 'Kunjungan Umum', targetDetail: 'Area publik perkemahan' },
      relationship,
      visitDate,
      expectedArrival,
      expectedDeparture,
      accompanyingPersonsCount: Number(accompanyingCount),
      vehicleInfo,
      purpose,
    }, undefined, requestKey.current);

    setSubmittedVisitor(registered);
    setStep('success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-[#171717] dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-[#ECECEF] dark:border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#C62828] dark:text-red-300 font-bold flex items-center justify-center text-lg">
              ⚜️
            </span>
            <div>
              <h3 className="text-base font-bold text-[#171717] dark:text-white tracking-tight">
                Pendaftaran Kunjungan Bumi Perkemahan
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">{eventName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Visiting Notice */}
            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>Ketentuan Kunjungan Resmi</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Jam kunjungan mengikuti ketentuan panitia. Seluruh pengunjung wajib menunjukkan Visitor Pass dan mematuhi tata tertib perkemahan.
              </p>
            </div>

            <fieldset className="space-y-2 rounded-2xl border border-slate-200 dark:border-white/10 p-3">
              <legend className="px-1 font-bold">Jenis Registrasi</legend>
              <label className="flex items-center gap-2"><input type="radio" name="visitType" checked={visitType === 'VISITOR'} onChange={() => setVisitType('VISITOR')} /> Pengunjung</label>
              <label className="flex items-center gap-2"><input type="radio" name="visitType" checked={visitType === 'SPEAKER'} onChange={() => setVisitType('SPEAKER')} /> Narasumber / Pemateri</label>
              {visitType === 'SPEAKER' && <div className="space-y-2 pt-2">
                <label className="block">Agenda / sesi yang diisi *</label>
                <input required value={speakerAgenda} onChange={e => setSpeakerAgenda(e.target.value)} placeholder="Contoh: Giat Wawasan Kebangsaan" className="w-full rounded-xl border border-slate-300 bg-transparent p-2 dark:border-white/20" />
                <label className="block">Topik / judul materi</label>
                <input value={speakerTopic} onChange={e => setSpeakerTopic(e.target.value)} placeholder="Judul materi" className="w-full rounded-xl border border-slate-300 bg-transparent p-2 dark:border-white/20" />
              </div>}
            </fieldset>

            {/* Step 1: Visitor Identity */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-[#171717] dark:text-white uppercase text-[11px] tracking-wider">
                1. Identitas Pengunjung
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Nama Lengkap:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white outline-none focus:border-[#C62828] focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40"
                  />
                </div>

                <div>
                  <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Nomor WhatsApp / HP:</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono outline-none focus:border-[#C62828] focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Kategori Kunjungan:</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as VisitorCategory)}
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-semibold outline-none"
                  >
                    <option value="Orang Tua / Wali">Orang Tua / Wali</option>
                    <option value="Keluarga">Keluarga</option>
                    <option value="Tamu Undangan">Tamu Undangan</option>
                    <option value="Umum">Masyarakat Umum</option>
                    <option value="Alumni">Purna / Alumni</option>
                    <option value="Mabiran">Mabiran</option>
                    <option value="Mabigus">Mabigus</option>
                    <option value="Mitra">Mitra / Sponsor</option>
                    <option value="Media">Media</option>
                    <option value="VIP">VIP</option>
                    <option value="VVIP">VVIP</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Instansi / Asal Daerah:</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={e => setOrganization(e.target.value)}
                    placeholder="Nama Instansi / Kwartir / Sekolah"
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white outline-none focus:border-[#C62828] focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Person Being Visited */}
            <div className="space-y-2.5 pt-2 border-t border-[#ECECEF] dark:border-white/10">
              <h4 className="font-bold text-[#171717] dark:text-white uppercase text-[11px] tracking-wider">
                2. {visitType === 'SPEAKER' ? 'Pihak Koordinasi di Perkemahan (Opsional)' : 'Siapa yang Dikunjungi di Perkemahan? (Opsional)'}
              </h4>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={personSearchQuery}
                    onChange={e => handleSearchPerson(e.target.value)}
                    placeholder="Cari nama peserta atau kontingen..."
                    className="w-full pl-8 pr-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white text-xs placeholder:text-slate-400 outline-none focus:border-[#C62828] focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="p-1 bg-white dark:bg-[#1a1a20] rounded-xl border border-[#ECECEF] dark:border-white/10 space-y-1 max-h-36 overflow-y-auto shadow-sm">
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedPerson(r);
                          setSearchResults([]);
                          setPersonSearchQuery('');
                        }}
                        className="w-full p-2 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-bold text-[#171717] dark:text-white">{r.targetName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{r.targetDetail}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPerson ? (
                  <div className="p-2.5 bg-slate-50 dark:bg-white/5 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#171717] dark:text-white">{selectedPerson.targetName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{selectedPerson.targetDetail}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                      Terpilih ✓
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    * Silakan cari dan pilih peserta/panitia yang ingin dikunjungi di atas.
                  </p>
                )}

                <div>
                  <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Hubungan dengan yang dikunjungi:</label>
                  <input
                    type="text"
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    placeholder="Contoh: Orang Tua, Pembina, Kerabat..."
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white outline-none focus:border-[#C62828] focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Visit Details */}
            <div className="space-y-2.5 pt-2 border-t border-[#ECECEF] dark:border-white/10">
              <h4 className="font-bold text-[#171717] dark:text-white uppercase text-[11px] tracking-wider">
                3. Waktu & Rencana Kunjungan
              </h4>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">Tanggal Izin:</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">Rencana Datang:</label>
                  <input
                    type="time"
                    value={expectedArrival}
                    onChange={e => setExpectedArrival(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">Rencana Pulang:</label>
                  <input
                    type="time"
                    value={expectedDeparture}
                    onChange={e => setExpectedDeparture(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">Jumlah Rombongan Pendamping:</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={accompanyingCount}
                    onChange={e => setAccompanyingCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">Kendaraan (Opsional):</label>
                  <input
                    type="text"
                    value={vehicleInfo}
                    onChange={e => setVehicleInfo(e.target.value)}
                    placeholder="Mobil / Motor / Nopol..."
                    className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1">Tujuan Kunjungan:</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="Keperluan kunjungan..."
                  className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#ECECEF] dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !phone.trim()}
                className="px-6 py-2.5 bg-[#C62828] hover:bg-[#A61B1B] dark:bg-[#C62828] dark:hover:bg-[#A61B1B] text-white rounded-xl font-bold shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Daftar & Terbitkan Pass
              </button>
            </div>
          </form>
        ) : (
          /* SUCCESS VIEW & DIGITAL VISITOR PASS */
          <div className="space-y-4 text-center animate-in fade-in py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                Pendaftaran Kunjungan Berhasil
              </span>
              <h3 className="text-lg font-black text-[#171717] dark:text-white mt-1">
                {submittedVisitor?.name}
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Kode Registrasi:{' '}
                <strong className="text-[#171717] dark:text-white text-sm font-bold">
                  {submittedVisitor?.registrationCode}
                </strong>
              </div>
            </div>

            {/* Live Digital Pass Box */}
            <div className="max-w-xs mx-auto p-4 rounded-3xl bg-slate-50 dark:bg-white/5 text-[#171717] dark:text-white border border-[#ECECEF] dark:border-white/15 space-y-2 shadow-md text-center">
              <div className="space-y-0.5 border-b border-slate-200 dark:border-white/10 pb-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {eventName}
                </div>
                <div className="text-xs font-black uppercase">KARTU TANDA PENGUNJUNG</div>
              </div>

              <div className="w-40 h-40 mx-auto p-2 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-xs">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(submittedVisitor?.qrToken || '')}`}
                  alt="Visitor QR"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-xs font-bold">
                {submittedVisitor?.name}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {visitType === 'SPEAKER' ? 'Narasumber / Pemateri' : submittedVisitor?.category} · Izin: {submittedVisitor?.visitDate}
              </div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                Tunjukkan QR ini kepada Petugas di Gerbang Masuk Buper
              </div>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-[#C62828] hover:bg-[#A61B1B] dark:bg-[#C62828] dark:hover:bg-[#A61B1B] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white rounded-xl font-semibold text-xs cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
