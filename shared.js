/* ═══════════════════════════════════════════════════
   SHARED.JS
   Dipakai bersama oleh login.html, produksi.html, admin.html
   Berisi: koneksi Firebase, sinkronisasi barang & harga dari Firestore, autentikasi
   berbasis localStorage (karena sekarang 3 file HTML terpisah,
   bukan lagi satu halaman yang di-toggle), dan helper umum.
═══════════════════════════════════════════════════ */

// Harga per LUSIN tiap jenis barang — dipakai untuk Slip Gaji (admin) dan Pendapatan Mingguan (produksi).
// TIDAK ADA angka harga di kode. Semua harga disimpan di Firestore (config/harga) dan diatur admin
// lewat tab "Harga Barang", jadi deploy ulang kode tidak pernah mengubah/mereset harga.
// Key = nama barang huruf kecil (pencocokan nama barang dilakukan case-insensitive).
// Objek di bawah ini diisi (ditimpa di tempat) oleh listener Firestore di bawah.
const HARGA_LUSIN_PENJAHIT = {};   // Tim Penjahit (pekerjaan menjahit)
const HARGA_LUSIN_POLA     = {};   // Tim Pola (pekerjaan cutting/pola)

// Dipertahankan supaya kode lama yang masih memanggil HARGA_LUSIN (tanpa embel tim)
// tetap jalan — default-nya mengikuti harga Tim Penjahit.
const HARGA_LUSIN = HARGA_LUSIN_PENJAHIT;

// Pilih daftar harga yang sesuai berdasarkan tim ('pola' atau 'penjahit'/lainnya)
function getDaftarHargaByTim(tim) {
  return tim === 'pola' ? HARGA_LUSIN_POLA : HARGA_LUSIN_PENJAHIT;
}

// Cari harga per lusin suatu barang (case-insensitive). null = harga belum diatur.
function getHargaLusin(namaBarang, tim) {
  const daftar = getDaftarHargaByTim(tim);
  const key = (namaBarang || '').trim().toLowerCase();
  return daftar.hasOwnProperty(key) ? daftar[key] : null;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatRupiah(n) {
  return 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
}

// 1 Lusin = 12 Pcs — dipakai supaya data satuan Pcs tetap ikut terhitung
// di Slip Gaji & Pendapatan Mingguan (dikonversi ke Lusin-setara).
const PCS_PER_LUSIN = 12;
function toLusinEquivalent(jumlah, satuan) {
  return (satuan === 'Pcs') ? jumlah / PCS_PER_LUSIN : jumlah;
}
// Format angka qty supaya rapi: buang desimal kalau bulat, sisakan max 2 desimal kalau pecahan
function formatQty(n) {
  const rounded = Math.round(n * 100) / 100;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}

function titleCase(s) {
  return (s || '').replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1));
}

// Ubah objek Date jadi teks "YYYY-MM-DD" berdasarkan tanggal LOKAL (bukan UTC).
// PENTING: jangan pakai d.toISOString().slice(0,10) untuk ini — toISOString()
// selalu mengonversi ke UTC, dan karena Indonesia UTC+7, itu bikin tanggalnya
// mundur 1 hari (misalnya Sabtu bisa kebaca sebagai Jumat). Bug ini dulu bikin
// "Pendapatan Minggu Ini" di halaman Tim Produksi tidak ikut menghitung hari Sabtu.
function dateToLocalStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Tanggal SENIN (awal minggu) dari sebuah tanggal (default: hari ini).
// Dipakai supaya "pendapatan minggu ini" otomatis mulai dari 0 tiap Senin baru,
// tanpa perlu menghapus data apa pun — cuma soal rentang tanggal yang dihitung.
function getMondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const day = d.getDay(); // 0=Minggu, 1=Senin, ... 6=Sabtu
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return dateToLocalStr(d);
}
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateToLocalStr(d);
}

// Daftar barang & warna TIDAK ditulis di kode. Disimpan di Firestore (config/barang),
// diatur admin lewat tab "Kelola Barang".

const firebaseConfig = {
  apiKey: "AIzaSyDTC7injv2Q8JJ-PnYcpCfV8c_-u_9QFcU",
  authDomain: "data-harian-syaakir.firebaseapp.com",
  projectId: "data-harian-syaakir",
  storageBucket: "data-harian-syaakir.firebasestorage.app",
  messagingSenderId: "679349279012",
  appId: "1:679349279012:web:1ea8718e6315cf90c83bb1",
  measurementId: "G-LCXZ3JBB1N"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

db.settings({
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});

let cachedData   = [];
let cachedBarang = [];
let dataLoaded   = false;   // false = masih memuat data pertama kali dari cloud
let barangLoaded = false;

let isFirstSnapshot = true; // supaya load pertama kali TIDAK dianggap "data baru masuk"

db.collection('produksi_data').onSnapshot(snap => {
  cachedData = snap.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
  dataLoaded = true;

  if (!isFirstSnapshot) {
    const entriesBaru = snap.docChanges()
      .filter(change => change.type === 'added')
      .map(change => ({ _docId: change.doc.id, ...change.doc.data() }));
    if (entriesBaru.length > 0) onNewDataAdded(entriesBaru);
  }
  isFirstSnapshot = false;

  onDataChanged();
}, err => {
  toast('Gagal terhubung ke database. Cek koneksi internet / konfigurasi Firebase.', 'danger');
  console.error(err);
});

// Hook notifikasi data baru — default kosong, ditimpa oleh admin.js
function onNewDataAdded(entries) {}

// Bunyi "ting" notifikasi memakai Web Audio API (tidak perlu file suara eksternal)
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1175, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch (e) { /* abaikan kalau browser tidak mendukung */ }
}

// Notifikasi browser (perlu izin dari user). Aman dipanggil walau izin belum diberikan.
function showBrowserNotification(title, body, onClick) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'produksi-baru' });
    n.onclick = () => {
      window.focus();
      if (onClick) onClick();
      n.close();
    };
  } catch (e) { /* abaikan */ }
}

db.collection('config').doc('barang').onSnapshot(doc => {
  cachedBarang = doc.exists ? (doc.data().list || []) : [];
  barangLoaded = true;
  onBarangChanged();
}, err => {
  console.error('Gagal memuat config/barang:', err);
  barangLoaded = true;
  toast('Gagal memuat daftar barang dari database. Cek koneksi internet / izin Firestore.', 'danger');
  onBarangChanged();
});

/* ═══════════════════════════════
   HARGA PER LUSIN — disimpan di Firestore (config/harga), diatur admin
   lewat tab "Harga Barang". Daftar harga di bagian atas file ini hanya
   nilai awal/cadangan. Begitu data Firestore masuk, isi objek
   HARGA_LUSIN_PENJAHIT & HARGA_LUSIN_POLA DITIMPA di tempat (bukan dibuat
   ulang), sehingga semua kode lama tetap otomatis memakai harga terbaru.
═══════════════════════════════ */
let hargaLoaded = false;
let hargaError  = null;   // terisi kalau Firestore menolak / gagal memuat config/harga

function terapkanHarga(daftar, target) {
  Object.keys(target).forEach(k => delete target[k]);
  (daftar || []).forEach(item => {
    const key = ((item && item.nama) || '').toString().trim().toLowerCase();
    const harga = Number(item && item.harga);
    if (key && isFinite(harga) && harga >= 0) target[key] = harga;
  });
}

// Hook — ditimpa oleh admin.js / produksi.js
function onHargaChanged() {}

db.collection('config').doc('harga').onSnapshot(doc => {
  const d = doc.exists ? doc.data() : {};
  terapkanHarga(d.penjahit, HARGA_LUSIN_PENJAHIT);   // dokumen belum ada = daftar kosong (belum ada harga)
  terapkanHarga(d.pola, HARGA_LUSIN_POLA);
  hargaError = null;
  hargaLoaded = true;
  onHargaChanged();
}, err => {
  // Jangan biarkan layar "memuat" selamanya: tampilkan penyebabnya.
  console.error('Gagal memuat config/harga:', err);
  hargaError = err;
  hargaLoaded = true;
  onHargaChanged();
});

// Indikator status koneksi internet (online/offline) di topbar
function updateConnBadge() {
  const online = navigator.onLine;
  ['conn-badge-produksi', 'conn-badge-admin'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('offline', !online);
    el.querySelector('.conn-text').textContent = online ? 'Online' : 'Offline';
  });
}
window.addEventListener('online', updateConnBadge);
window.addEventListener('offline', updateConnBadge);
document.addEventListener('DOMContentLoaded', updateConnBadge);

// onDataChanged / onBarangChanged: nilai default kosong di sini.
// Masing-masing halaman (produksi.js / admin.js) akan MENIMPA ulang
// fungsi ini sesuai kebutuhan halamannya masing-masing.
function onDataChanged() {}
function onBarangChanged() {}

/* ═══════════════════════════════
   POTONGAN SLIP GAJI (tabungan, pinjaman koperasi, pinjaman lainnya)
   Disimpan per (pekerja + periode tanggal) supaya "Total Potongan" di
   daftar Slip Gaji tetap muncul walau admin membuka tab lain / login ulang.
═══════════════════════════════ */
let cachedPotongan  = {};   // key: docId → { username, nama, dari, sampai, tabungan, koperasi, lainKet, lainNominal, totalPotongan }
let potonganLoaded  = false;

db.collection('potongan_slip').onSnapshot(snap => {
  const map = {};
  snap.docs.forEach(doc => { map[doc.id] = doc.data(); });
  cachedPotongan = map;
  potonganLoaded = true;
  onPotonganChanged();
}, err => {
  console.error(err);
});

// Hook — ditimpa oleh admin.js supaya tabel Slip Gaji auto-refresh saat potongan berubah
function onPotonganChanged() {}

function potonganDocId(usernameOrNama, dari, sampai) {
  const safe = (usernameOrNama || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${safe}__${dari}__${sampai}`;
}

// Ambil data potongan tersimpan untuk pekerja + periode tertentu. null kalau belum pernah disimpan.
function getPotongan(usernameOrNama, dari, sampai) {
  return cachedPotongan[potonganDocId(usernameOrNama, dari, sampai)] || null;
}

// Simpan potongan (dipanggil admin setelah mengisi Tabungan/Koperasi/Pinjaman Lainnya di slip).
async function savePotongan(usernameOrNama, nama, dari, sampai, tabungan, koperasi, lainKet, lainNominal, lainKet2, lainNominal2) {
  const totalPotongan = (tabungan || 0) + (koperasi || 0) + (lainNominal || 0) + (lainNominal2 || 0);
  const id = potonganDocId(usernameOrNama, dari, sampai);
  await db.collection('potongan_slip').doc(id).set({
    username: usernameOrNama || '',
    nama: nama || '',
    dari, sampai,
    tabungan: tabungan || 0,
    koperasi: koperasi || 0,
    lainKet: lainKet || '',
    lainNominal: lainNominal || 0,
    lainKet2: lainKet2 || '',
    lainNominal2: lainNominal2 || 0,
    totalPotongan,
    updatedAt: Date.now()
  });
  return totalPotongan;
}

function getBarang() {
  return cachedBarang;
}
function saveBarang(list) {
  return db.collection('config').doc('barang').set({ list });
}
function getData() {
  return cachedData;
}

/* ═══════════════════════════════
   PENYESUAIAN STOK BARANG
   Supaya admin bisa mengoreksi angka Stok Barang kalau ada kesalahan input
   dari tim pola/produksi, dan juga menambahkan barang ke daftar Stok Barang
   walau belum ada data produksinya sama sekali.
   Disimpan per (barang + warna) sebagai angka penyesuaian (boleh +/-) dalam
   satuan Lusin, yang nanti ditambahkan ke hasil hitungan otomatis
   (Dipotong Tim Pola - Dikerjakan Tim Produksi) di admin.js.
═══════════════════════════════ */
let cachedStokPenyesuaian = {};   // key: docId → { barang, warna, penyesuaian, updatedAt }
let stokPenyesuaianLoaded = false;

db.collection('stok_penyesuaian').onSnapshot(snap => {
  const map = {};
  snap.docs.forEach(doc => { map[doc.id] = doc.data(); });
  cachedStokPenyesuaian = map;
  stokPenyesuaianLoaded = true;
  onStokPenyesuaianChanged();
}, err => {
  console.error(err);
});

// Hook — ditimpa oleh admin.js supaya tabel Stok Barang auto-refresh saat penyesuaian berubah
function onStokPenyesuaianChanged() {}

function stokPenyesuaianDocId(barang, warna) {
  // PENTING: jangan toLowerCase() di sini. Barang/warna dengan ejaan beda huruf besar-
  // kecil (mis. "Merah" vs "merah") harus dianggap baris yang BEDA di Stok Barang, supaya
  // masing-masing punya penyesuaian sendiri-sendiri dan tidak saling menimpa saat diedit
  // atau dihapus salah satunya.
  const safe = s => (s || '').toString().trim().replace(/[^a-zA-Z0-9]+/g, '_');
  return `${safe(barang)}__${safe(warna)}`;
}

function getStokPenyesuaian() {
  return cachedStokPenyesuaian;
}

// Cari id dokumen stok_penyesuaian yang field barang+warna-nya PERSIS sama (case-sensitive)
// dengan yang diminta. Dipakai supaya simpan/hapus selalu mengenai dokumen yang benar,
// walau dulu sempat tersimpan dengan skema id lama (huruf kecil semua).
function findStokPenyesuaianDocIds(barang, warna) {
  return Object.entries(cachedStokPenyesuaian)
    .filter(([, p]) => p.barang === barang && p.warna === warna)
    .map(([id]) => id);
}

// Simpan/ubah penyesuaian (Lusin) untuk kombinasi barang+warna tertentu. `updates` boleh
// berisi salah satu atau kedua field berikut (yang tidak disebut, nilai lamanya dipertahankan):
//   - polaPenyesuaian: koreksi pada "Dipotong Tim Pola"
//   - penyesuaian:     koreksi pada "Sisa Stok" (di atas hasil pola-produksi yang sudah final)
// Dipakai untuk mengoreksi angka Stok Barang, maupun menambahkan baris barang baru ke
// tabel Stok Barang (panggil dengan updates = {} untuk barang baru, keduanya mulai dari 0).
// Kalau sudah ada dokumen untuk kombinasi ini, dokumen itu yang di-update (bukan bikin baru),
// supaya tidak menumpuk duplikat.
async function saveStokPenyesuaian(barang, warna, updates) {
  updates = updates || {};
  const idLama   = findStokPenyesuaianDocIds(barang, warna)[0];
  const existing = idLama ? cachedStokPenyesuaian[idLama] : null;
  const id = idLama || stokPenyesuaianDocId(barang, warna);
  await db.collection('stok_penyesuaian').doc(id).set({
    barang, warna,
    penyesuaian:     'penyesuaian'     in updates ? (updates.penyesuaian     || 0) : (existing ? (existing.penyesuaian     || 0) : 0),
    polaPenyesuaian: 'polaPenyesuaian' in updates ? (updates.polaPenyesuaian || 0) : (existing ? (existing.polaPenyesuaian || 0) : 0),
    updatedAt: Date.now()
  });
}

// Hapus SEMUA dokumen penyesuaian untuk kombinasi barang+warna ini (dipakai saat admin
// menghapus baris dari daftar Stok Barang). Dicari lewat isi field, bukan lewat id, supaya
// dokumen lama dengan skema id apa pun tetap ikut terhapus.
async function deleteStokPenyesuaian(barang, warna) {
  const ids = findStokPenyesuaianDocIds(barang, warna);
  await Promise.all(ids.map(id => db.collection('stok_penyesuaian').doc(id).delete()));
}

const USERS = {
  adi:     { pass: "produksi123", role: "produksi", tim: "penjahit" },
  ecep:    { pass: "produksi123", role: "produksi", tim: "penjahit" },
  ujang:   { pass: "produksi123", role: "produksi", tim: "penjahit" },
  agus:    { pass: "produksi123", role: "produksi", tim: "penjahit" },
  riki:    { pass: "produksi123", role: "produksi", tim: "penjahit" },
  ade:     { pass: "produksi123", role: "produksi", tim: "penjahit" },
  deden:   { pass: "produksi123", role: "produksi", tim: "penjahit" },
  enjang:  { pass: "produksi123", role: "produksi", tim: "penjahit" },
  baaecep: { pass: "produksi123", role: "produksi", tim: "penjahit" },
  cana:    { pass: "produksi123", role: "produksi", tim: "penjahit" },
  ucu:     { pass: "produksi123", role: "produksi", tim: "penjahit" },
  dendi:   { pass: "produksi123", role: "produksi", tim: "penjahit" },
  cana:    { pass: "produksi123", role: "produksi", tim: "penjahit" },
  cutting: { pass: "Potong123",   role: "produksi", tim: "pola" },
  admin:   { pass: "admin123",    role: "admin" },
};

/* ═══════════════════════════════
   AUTH BERBASIS localStorage
   Sengaja pakai localStorage (bukan sessionStorage) supaya status login
   TETAP TERSIMPAN walau browser/aplikasi ditutup total dan dibuka lagi
   nanti — user tidak perlu login ulang tiap buka link, sampai mereka
   sendiri klik tombol "Keluar".
═══════════════════════════════ */

// Dipanggil di paling atas produksi.html / admin.html untuk memastikan
// yang buka halaman itu memang sudah login dengan role yang sesuai.
// Kalau tidak, langsung dilempar balik ke login.html.
function requireRole(expectedRole) {
  const role = localStorage.getItem('role');
  if (role !== expectedRole) {
    window.location.href = 'login.html';
  }
  return localStorage.getItem('username') || '';
}

function doLogout() {
  localStorage.removeItem('role');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

function todayStr() {
  return dateToLocalStr(new Date());
}
function nowStr() {
  return new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
}
function formatDate(iso) {
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Firestore TIDAK menjamin urutan dokumen sesuai waktu input kalau tidak diminta eksplisit.
// Jadi urutan data selalu dihitung ulang di sini berdasarkan tanggal+waktu (dan id sebagai
// tie-breaker kalau tanggal+waktu-nya sama persis), bukan mengandalkan urutan array mentah.
function sortByWaktuAsc(arr) {
  return [...arr].sort((a, b) => {
    const keyA = `${a.tanggal || ''} ${a.waktu || ''}`;
    const keyB = `${b.tanggal || ''} ${b.waktu || ''}`;
    if (keyA !== keyB) return keyA < keyB ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
}
function sortByWaktuDesc(arr) {
  return sortByWaktuAsc(arr).reverse();
}

function toast(msg, type='success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}