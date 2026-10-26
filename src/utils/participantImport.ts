import * as XLSX from 'xlsx';

const key = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
const aliases: Record<string, string[]> = {
  name: ['nama lengkap','nama peserta','nama anggota','nama','name','full name'],
  gender: ['jenis kelamin','gender','kelamin','jk','putra putri','putra/putri'],
  role: ['tingkatan','golongan','role','kategori','jenjang'],
  membershipNumber: ['nta','kta','nta/kta','nta / kta','nomor nta','no nta','nomor kta','nomor anggota','nomor pramuka','id anggota','membership number'],
  email: ['email','e-mail','alamat email'],
  phone: ['telepon','nomor telepon','no telepon','no hp','nomor hp','hp','phone','whatsapp','wa','nomor telepon orang tua'],
  schoolPangkalan: ['sekolah','nama sekolah','pangkalan','nama pangkalan','school pangkalan','institution','institution name'],
  contingentName: ['kontingen','nama kontingen','contingent','contingent name'],
  contingentId: ['contingent id','id kontingen'],
  birthPlace: ['tempat lahir','birth place','birthplace'],
  birthDate: ['tanggal lahir','tgl lahir','birth date','birthdate','tanggal lahir (dd/mm/yy)'],
};
const fieldFor = (v: unknown) => Object.keys(aliases).find(f => aliases[f].some(a => key(a) === key(v)));

export function importRowIssues(row: Record<string, any>): string[] {
  const issues: string[] = [];
  if (String(row.name || '').trim().length < 2) issues.push('Nama wajib minimal 2 karakter.');
  if (!['M','F'].includes(row.gender)) issues.push('Jenis kelamin harus L/Putra/M atau P/Putri/F.');
  if (row.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.birthDate)) issues.push('Tanggal lahir tidak valid; gunakan YYYY-MM-DD atau DD/MM/YYYY.');
  return issues;
}

function dateValue(value: string, monthFirst: boolean): string {
  if (!value) return '';
  let y: number, m: number, d: number;
  let parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (parts) [, y, m, d] = parts.map(Number);
  else {
    parts = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(value);
    if (!parts) return value;
    const a = Number(parts[1]), b = Number(parts[2]);
    y = Number(parts[3]);
    if (parts[3].length === 2) y += y <= 30 ? 2000 : 1900;
    m = monthFirst ? a : b; d = monthFirst ? b : a;
  }
  const test = new Date(Date.UTC(y, m - 1, d));
  if (test.getUTCFullYear() !== y || test.getUTCMonth() !== m - 1 || test.getUTCDate() !== d) return `Tidak valid: ${value}`;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export function parseParticipantImport(sheet: XLSX.WorkSheet): {rows: Record<string,string>[]; notes: string[]} {
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {header:1, defval:'', raw:false, blankrows:true});
  const header = matrix.findIndex(row => row.some(v => fieldFor(v) === 'name') && row.some(v => fieldFor(v) === 'gender'));
  if (header < 0) throw new Error('Header Nama Lengkap dan Jenis Kelamin tidak ditemukan. Pilih sheet peserta atau periksa nama kolom.');
  const fields = matrix[header].map(fieldFor);
  const mapped = fields.filter(Boolean);
  if (new Set(mapped).size !== mapped.length) throw new Error('Ada kolom ganda untuk data yang sama. Hapus atau ubah nama kolom sebelum impor.');
  let school = '';
  for (const row of matrix.slice(0,header)) {
    const i = row.findIndex(v => fieldFor(v) === 'schoolPangkalan');
    if (i >= 0) school = row.slice(i+1).map(v => String(v).replace(/^\s*:\s*/, '').trim()).find(Boolean) || school;
  }
  const dateCol = fields.indexOf('birthDate');
  const dateCells = matrix.slice(header+1).map(r => String(r[dateCol] || '').trim());
  const monthFirst = dateCells.some(v => {const m=/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(v); return m && Number(m[2]) > 12;});
  const dayFirst = dateCells.some(v => {const m=/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(v); return m && Number(m[1]) > 12;});
  if (monthFirst && dayFirst) throw new Error('Format tanggal bercampur MM/DD dan DD/MM. Ubah seluruh tanggal ke YYYY-MM-DD agar tidak tertukar.');
  const rows: Record<string,string>[] = [];
  let skipped = 0;
  for (let i=header+1; i<matrix.length; i++) {
    const cells = matrix[i];
    // Skip empty template lines and the second address header, retain malformed participant rows.
    if (!cells.some(v => String(v).trim())) continue;
    if (cells.some(v => key(v) === 'jalan') && cells.some(v => key(v) === 'kelurahan') && !String(cells[fields.indexOf('name')] || '').trim()) {skipped++; continue;}
    if (!fields.some((field,j) => field && String(cells[j] || '').trim())) {skipped++; continue;}
    const row: Record<string,string> = {source_row:String(i+1)};
    fields.forEach((field,j) => {if(field) row[field] = String(cells[j] ?? '').trim();});
    row.gender = ['L','LAKI-LAKI','LAKI LAKI','PUTRA','PRIA','MALE','M'].includes((row.gender || '').toUpperCase()) ? 'M' : ['P','PEREMPUAN','PUTRI','WANITA','FEMALE','F'].includes((row.gender || '').toUpperCase()) ? 'F' : row.gender;
    row.schoolPangkalan ||= school || row.contingentName || '';
    row.contingentName ||= row.schoolPangkalan;
    row.role ||= 'Penggalang';
    row.birthDate = dateValue(row.birthDate || '',monthFirst);
    rows.push(row);
  }
  const ignored = matrix[header].filter((v,j) => String(v).trim() && !fields[j]);
  return {rows, notes:[`Header ditemukan di baris ${header+1}. ${rows.length} baris data; ${skipped} baris nonpeserta dilewati.`, ...(school ? [`Sekolah dari identitas file: ${school}.`] : []), ...(dateCol>=0 ? [`Tanggal dibaca sebagai ${monthFirst ? 'MM/DD/YYYY' : 'DD/MM/YYYY'}; tanggal ISO tetap YYYY-MM-DD. Periksa tanggal pada pratinjau. Tahun dua digit 00–30 = 2000–2030, 31–99 = 1931–1999.`] : []), ...(ignored.length ? [`Kolom belum didukung endpoint impor GAS dan tidak disimpan: ${ignored.join(', ')}. Foto tetap melalui unggah profil resmi.`] : [])]};
}

export function parseParticipantImportText(text: string) {
  if (!text.trim()) throw new Error('Pilih file atau tempel data CSV terlebih dahulu.');
  const book = XLSX.read(text, {type:'string',raw:true});
  return parseParticipantImport(book.Sheets[book.SheetNames[0]]);
}
