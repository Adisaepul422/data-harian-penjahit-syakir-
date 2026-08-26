/* ═══════════════════════════════════════════════════
   SHARED.JS
   Dipakai bersama oleh login.html, produksi.html, admin.html
   Berisi: koneksi Firebase, data barang default, autentikasi
   berbasis localStorage (karena sekarang 3 file HTML terpisah,
   bukan lagi satu halaman yang di-toggle), dan helper umum.
═══════════════════════════════════════════════════ */

// Harga per LUSIN tiap jenis barang — dipakai untuk Slip Gaji (admin)
// dan Pendapatan Mingguan (produksi). Key HARUS huruf kecil semua
// (pencocokan dengan nama barang dilakukan case-insensitive).
const HARGA_LUSIN = {
  "arsha":              80000,
  "marlinda":           70000,
  "arliwi":             45000,
  "famela":             80000,
  "sikamaru":           75000,
  "melody":             80000,
  "leora":              50000,
  "hinata":             77000,
  "ransel mini":        87000,
  "revana":             80000,
  "zaskia":             75000,
  "dinara":             75000,
  "azzura":             75000,
  "ananda":             75000,
  "fairi":              75000,
  "parsya":             80000,
  "ransel mini pack":   95000,
  "ransel besar":       115000,
};

// Cari harga per lusin suatu barang (case-insensitive). null = harga belum diatur.
function getHargaLusin(namaBarang) {
  const key = (namaBarang || '').trim().toLowerCase();
  return HARGA_LUSIN.hasOwnProperty(key) ? HARGA_LUSIN[key] : null;
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

// Tanggal SENIN (awal minggu) dari sebuah tanggal (default: hari ini).
// Dipakai supaya "pendapatan minggu ini" otomatis mulai dari 0 tiap Senin baru,
// tanpa perlu menghapus data apa pun — cuma soal rentang tanggal yang dihitung.
function getMondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const day = d.getDay(); // 0=Minggu, 1=Senin, ... 6=Sabtu
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const BARANG_DEFAULT = [
  { nama: "Arliwi",         warna: ["Hitam","Merah","Coklat","Biru"] },
  { nama: "Sikamaru",       warna: ["Hitam","Coklat","Merah"] },
  { nama: "Hinata",         warna: ["Hitam","Coklat","Merah","Putih","Pink"] },
  { nama: "Arsha",          warna: ["Merah","Coklat","Hitam"] },
  { nama: "Famela",         warna: ["Coklat","Biru"] },
  { nama: "Melody",         warna: ["Biru"] },
  { nama: "Leora",          warna: ["Coklat","Biru"] },
  { nama: "Marlinda",       warna: ["Coklat","Hitam"] },
  { nama: "Fairi",          warna: ["Coklat","Hitam","Merah"] },
  { nama: "Dinara",         warna: ["Hitam","Merah","Abu","Pink"] },
  { nama: "Ananda",         warna: ["Hitam","Coklat","Putih","Abu","Pink", "Merah"] },
  { nama: "Azzura",         warna: ["Coklat","Cream"] },
  { nama: "Revana",         warna: ["Hitam","Mint","Navy","Merah","Putih","Hijau Tua"] },
  { nama: "Parsya",         warna: ["Merah","Hitam","Navy"] },
  { nama: "Zaskia",         warna: ["Hitam","Coklat","Navy","Merah"] },
  { nama: "Ransel Mini",    warna: ["Pink", "Biru", "Hitam", "Bw"] },
  { nama: "Ransel Besar",   warna: ["Pink", "Biru", "Hitam", "Bw"] },
  { nama: "Ransel Mini Pack",warna: ["Pink", "Biru", "Hitam", "Bw"] },
];

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
let cachedBarang = JSON.parse(JSON.stringify(BARANG_DEFAULT));
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
  if (doc.exists) {
    cachedBarang = doc.data().list || [];
  } else {
    db.collection('config').doc('barang').set({ list: BARANG_DEFAULT });
    cachedBarang = JSON.parse(JSON.stringify(BARANG_DEFAULT));
  }
  barangLoaded = true;
  onBarangChanged();
}, err => {
  console.error(err);
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

function getBarang() {
  return cachedBarang;
}
function saveBarang(list) {
  return db.collection('config').doc('barang').set({ list });
}
function getData() {
  return cachedData;
}

const USERS = {
  adi:     { pass: "produksi123", role: "produksi" },
  ecep:    { pass: "produksi123", role: "produksi" },
  ujang:   { pass: "produksi123", role: "produksi" },
  agus:    { pass: "produksi123", role: "produksi" },
  riki:    { pass: "produksi123", role: "produksi" },
  ade:     { pass: "produksi123", role: "produksi" },
  deden:   { pass: "produksi123", role: "produksi" },
  enjang:  { pass: "produksi123", role: "produksi" },
  baaecep: { pass: "produksi123", role: "produksi" },
  cana: { pass: "produksi123", role: "produksi" },
  ucu: { pass: "produksi123", role: "produksi" },
  dendi: { pass: "produksi123", role: "produksi" },
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
  return new Date().toISOString().slice(0,10);
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