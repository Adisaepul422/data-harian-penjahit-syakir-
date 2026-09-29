/* admin.js — khusus untuk admin.html */

// Pastikan yang buka halaman ini sudah login sebagai admin, kalau tidak, dilempar ke login.html
requireRole('admin');

/* ═══════════════════════════════
   NOTIFIKASI DATA BARU
═══════════════════════════════ */
let unreadCount = 0;
let titleFlashInterval = null;
const originalTitle = document.title;

// Timpa hook dari shared.js: dipanggil setiap ada entri baru dari tim produksi
onNewDataAdded = function (entries) {
  unreadCount += entries.length;
  updateNotifBadge();
  playNotifSound();
  ringBell();

  entries.forEach(e => {
    showBrowserNotification(
      '📦 Data Produksi Baru!',
      `${e.nama} • ${e.barang} (${e.warna}) — ${e.jumlah} ${e.satuan || 'Lusin'}`,
      () => { showAdminTab('data'); clearNotifBadge(); }
    );
  });

  if (document.hidden) startTitleFlash();
};

function updateNotifBadge() {
  const el = document.getElementById('notif-count');
  if (!el) return;
  if (unreadCount > 0) {
    el.textContent = unreadCount > 99 ? '99+' : unreadCount;
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

function clearNotifBadge() {
  unreadCount = 0;
  updateNotifBadge();
  stopTitleFlash();
}

function ringBell() {
  const bell = document.getElementById('notif-bell');
  if (!bell) return;
  bell.classList.remove('ringing');
  void bell.offsetWidth; // restart animasi kalau notif beruntun
  bell.classList.add('ringing');
}

function startTitleFlash() {
  if (titleFlashInterval) return;
  let showAlert = true;
  titleFlashInterval = setInterval(() => {
    document.title = showAlert ? `🔴 (${unreadCount}) Data Baru Masuk!` : originalTitle;
    showAlert = !showAlert;
  }, 1000);
}
function stopTitleFlash() {
  if (titleFlashInterval) { clearInterval(titleFlashInterval); titleFlashInterval = null; }
  document.title = originalTitle;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) stopTitleFlash();
});

function mintaIzinNotifikasi() {
  if (!('Notification' in window)) {
    toast('Browser ini tidak mendukung notifikasi.', 'danger');
    return;
  }
  Notification.requestPermission().then(perm => {
    document.getElementById('notif-banner').style.display = 'none';
    if (perm === 'granted') {
      toast('Notifikasi diaktifkan! 🔔', 'success');
      new Notification('Notifikasi Aktif ✅', { body: 'Anda akan diberitahu setiap ada data produksi baru masuk.' });
    } else {
      toast('Notifikasi tidak diizinkan. Bisa diaktifkan lagi lewat pengaturan browser.', 'danger');
    }
  });
}

function checkNotifBanner() {
  const banner = document.getElementById('notif-banner');
  if (!banner) return;
  if ('Notification' in window && Notification.permission === 'default') {
    banner.style.display = 'flex';
  }
}

// Timpa hook dari shared.js: refresh tampilan admin setiap data/barang berubah real-time
onDataChanged = function () {
  renderAdminTable();
  renderTanggalSummary();
  renderStokMingguan();
  // Rekap Totalan Barang & Slip Gaji ikut diperbarui otomatis kalau tabnya sedang terbuka & sudah ada rentang tanggal
  if (document.getElementById('rekap-hasil') && document.getElementById('rekap-hasil').style.display !== 'none') tampilkanRekap();
  if (document.getElementById('slip-list-wrap') && document.getElementById('slip-list-wrap').style.display !== 'none') tampilkanSlipList();
  if (document.getElementById('stok-wrap') && document.getElementById('stok-wrap').style.display !== 'none') tampilkanStok();
};

// Timpa hook dari shared.js: refresh daftar slip gaji setiap ada potongan baru disimpan (real-time)
onPotonganChanged = function () {
  if (document.getElementById('slip-list-wrap') && document.getElementById('slip-list-wrap').style.display !== 'none') tampilkanSlipList();
};
onBarangChanged = function () {
  loadFilterBarangSelect();
  renderBarangTable();
  loadStokTambahBarangSelect();
  if (document.getElementById('stok-wrap') && document.getElementById('stok-wrap').style.display !== 'none') tampilkanStok();
};

// Timpa hook dari shared.js: refresh tabel Stok Barang setiap ada penyesuaian baru disimpan (real-time)
onStokPenyesuaianChanged = function () {
  if (document.getElementById('stok-wrap') && document.getElementById('stok-wrap').style.display !== 'none') tampilkanStok();
};

function initAdmin() {
  const d = new Date();
  document.getElementById('admin-date').textContent =
    d.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  document.getElementById('f-tanggal').value = todayStr();

  loadFilterBarangSelect();
  loadFilterUsernameSelect();
  renderAdminTable();
  renderBarangTable();
  renderTanggalSummary();
  renderStokMingguan();
  loadStokTambahBarangSelect();

  showAdminTab('data');
}

function showAdminTab(tabId) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-subnav-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  document.querySelector(`.admin-subnav-btn[data-tab="${tabId}"]`).classList.add('active');

  // Buka tab Data Produksi = admin dianggap sudah "mengecek" data baru
  if (tabId === 'data') clearNotifBadge();

  // Buka tab Stok Barang = langsung tampilkan stok semua barang dari Kelola Barang
  if (tabId === 'stok') tampilkanStok();

  // Scroll ke atas konten setiap ganti tab supaya tidak nyangkut di posisi scroll lama
  window.scrollTo({ top: document.querySelector('.admin-subnav').offsetTop - 56, behavior: 'smooth' });
}

function loadFilterBarangSelect() {
  const sel = document.getElementById('f-barang');
  const current = sel.value;
  sel.innerHTML = '<option value="">Semua Barang</option>';
  getBarang().forEach(b => {
    const o = document.createElement('option');
    o.value = b.nama; o.textContent = b.nama;
    sel.appendChild(o);
  });
  sel.value = current;
}

function loadFilterUsernameSelect() {
  const sel = document.getElementById('f-username');
  if (!sel) return;
  const current = sel.value;
  const usernames = [...new Set(getData().map(d => d.username).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'id'));
  sel.innerHTML = '<option value="">Semua Username</option>' +
    usernames.map(u => `<option value="${u}">${u}</option>`).join('');
  sel.value = current;
}

function loadingStateHTML(colspan) {
  return `<tr><td colspan="${colspan}"><div class="loading-state"><div class="dot-flash"><span></span><span></span><span></span></div><p>Memuat data dari cloud...</p></div></td></tr>`;
}

function renderTanggalSummary() {
  const tbody = document.getElementById('tgl-tbody');
  const empty = document.getElementById('tgl-empty');
  if (!tbody) return;

  if (!dataLoaded) {
    tbody.innerHTML = loadingStateHTML(4);
    empty.style.display = 'none';
    return;
  }

  const all = getData();
  if (all.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const map = {};
  all.forEach(d => {
    if (!map[d.tanggal]) map[d.tanggal] = { entri: 0, lusin: 0, pcs: 0 };
    map[d.tanggal].entri += 1;
    if ((d.satuan || 'Lusin') === 'Lusin') map[d.tanggal].lusin += d.jumlah;
    else map[d.tanggal].pcs += d.jumlah;
  });

  const tanggalList = Object.keys(map).sort((a,b) => b.localeCompare(a));

  tbody.innerHTML = tanggalList.map(tgl => `
    <tr class="tgl-row" onclick="filterByTanggal('${tgl}')">
      <td><strong>${formatDate(tgl)}</strong>${tgl === todayStr() ? ' <span class="badge badge-qty">Hari Ini</span>' : ''}</td>
      <td>${map[tgl].entri} entri</td>
      <td><span class="badge badge-qty">${map[tgl].lusin} Lusin</span></td>
      <td><span class="badge badge-qty">${map[tgl].pcs} Pcs</span></td>
    </tr>
  `).join('');
}

function filterByTanggal(tgl) {
  document.getElementById('f-tanggal').value = tgl;
  renderAdminTable();
  showAdminTab('data');
  toast(`Menampilkan data tanggal ${formatDate(tgl)}`, 'success');
}

function getRekapFiltered() {
  const dari    = document.getElementById('rk-dari').value;
  const sampai  = document.getElementById('rk-sampai').value;

  // Rekap Totalan Barang selalu menggabungkan SEMUA pekerja/user — tidak difilter per orang,
  // karena tujuannya melihat total keseluruhan input tim produksi pada suatu periode.
  let data = getData();
  if (dari)    data = data.filter(d => d.tanggal >= dari);
  if (sampai)  data = data.filter(d => d.tanggal <= sampai);
  return { data, dari, sampai };
}

function ringkasRekap(data) {
  const map = {};
  data.forEach(d => {
    const satuan = d.satuan || 'Lusin';
    const key = d.barang + '|' + d.warna + '|' + satuan;
    if (!map[key]) map[key] = { barang: d.barang, warna: d.warna, satuan, pola: 0, produksi: 0 };
    if ((d.tim || 'penjahit') === 'pola') map[key].pola += d.jumlah;
    else map[key].produksi += d.jumlah;
  });
  return Object.values(map).sort((a,b) =>
    a.barang.localeCompare(b.barang, 'id') || a.warna.localeCompare(b.warna, 'id') || a.satuan.localeCompare(b.satuan, 'id')
  );
}

function tampilkanRekap() {
  const dari   = document.getElementById('rk-dari').value;
  const sampai = document.getElementById('rk-sampai').value;
  const { data } = getRekapFiltered();

  if (dari && sampai && dari > sampai) return toast('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"!', 'danger');

  const hasil = document.getElementById('rekap-hasil');
  const empty = document.getElementById('rekap-empty');
  const tbody = document.getElementById('rekap-tbody');

  if (data.length === 0) {
    hasil.style.display = 'none';
    empty.style.display = 'block';
    document.getElementById('rekap-slip-pola').style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  hasil.style.display = 'block';

  const rows = ringkasRekap(data);

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.barang}</strong></td>
      <td><span class="badge badge-color">${r.warna}</span></td>
      <td>${r.satuan}</td>
      <td>${r.pola > 0 ? `<span class="badge badge-user">${formatQty(r.pola)} ${r.satuan}</span>` : '—'}</td>
      <td>${r.produksi > 0 ? `<span class="badge badge-qty">${formatQty(r.produksi)} ${r.satuan}</span>` : '—'}</td>
    </tr>
  `).join('');

  // Total dihitung terpisah per satuan (Lusin & Pcs tidak bisa dijumlah jadi satu angka), dan
  // terpisah juga antara Tim Pola vs Tim Produksi supaya mudah dibaca admin.
  const totalPola = {};
  const totalProduksi = {};
  rows.forEach(r => {
    totalPola[r.satuan]     = (totalPola[r.satuan]     || 0) + r.pola;
    totalProduksi[r.satuan] = (totalProduksi[r.satuan] || 0) + r.produksi;
  });
  const fmtTotal = obj => {
    const parts = Object.keys(obj).filter(s => obj[s] > 0).map(s => `${formatQty(obj[s])} ${s}`);
    return parts.length ? parts.join(' + ') : '0';
  };
  document.getElementById('rekap-total-pola').textContent = fmtTotal(totalPola);
  document.getElementById('rekap-total-produksi').textContent = fmtTotal(totalProduksi);

  renderSlipPolaRekap(dari, sampai);
}

// Panel "Gaji Tim Pola" langsung di dalam tab Rekap Totalan Barang — supaya admin tidak perlu
// pindah ke tab Slip Gaji lagi untuk mencetak slip gaji tim pola.
function renderSlipPolaRekap(dari, sampai) {
  const wrap = document.getElementById('rekap-slip-pola');
  const listEl = document.getElementById('rekap-slip-pola-list');
  if (!wrap || !listEl) return;

  if (!dari || !sampai) {
    wrap.style.display = 'none';
    return;
  }

  // Anggota tim pola (mis. "cutting") — gajinya = total Tim Produksi di atas.
  const pekerjaPola = Object.keys(USERS)
    .filter(uname => USERS[uname] && USERS[uname].tim === 'pola')
    .map(uname => {
      const contoh = getData().find(d => d.username === uname);
      const nama = contoh ? contoh.nama : (uname.charAt(0).toUpperCase() + uname.slice(1));
      return { username: uname, nama };
    });

  if (pekerjaPola.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  listEl.innerHTML = pekerjaPola.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;flex-wrap:wrap;">
      <span style="font-weight:700;color:var(--brand);">${p.nama}</span>
      <button class="btn btn-accent" style="padding:8px 16px;font-size:13px;" onclick="bukaSlipModal('${p.username.replace(/'/g,"\\'")}', '${p.nama.replace(/'/g,"\\'")}', '${dari}', '${sampai}')">🖨️ Cetak Slip Gaji</button>
    </div>
  `).join('');
}

function resetRekap() {
  document.getElementById('rk-dari').value = '';
  document.getElementById('rk-sampai').value = '';
  document.getElementById('rekap-hasil').style.display = 'none';
  document.getElementById('rekap-empty').style.display = 'none';
  document.getElementById('rekap-slip-pola').style.display = 'none';
}

function exportRekapExcel() {
  const { data, dari, sampai } = getRekapFiltered();
  if (data.length === 0) return toast('Tidak ada data untuk diekspor!', 'danger');

  const ringkas = ringkasRekap(data);
  const rows = ringkas.map(r => ({
    'Barang': r.barang,
    'Warna': r.warna,
    'Satuan': r.satuan,
    'Tim Pola': r.pola,
    'Tim Produksi': r.produksi
  }));

  const totalPola = {};
  const totalProduksi = {};
  ringkas.forEach(r => {
    totalPola[r.satuan]     = (totalPola[r.satuan]     || 0) + r.pola;
    totalProduksi[r.satuan] = (totalProduksi[r.satuan] || 0) + r.produksi;
  });
  Object.keys({ ...totalPola, ...totalProduksi }).forEach(s => {
    rows.push({ 'Barang': '', 'Warna': '', 'Satuan': `Total ${s}`, 'Tim Pola': totalPola[s] || 0, 'Tim Produksi': totalProduksi[s] || 0 });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap');

  const rangeLabel = dari && sampai ? `${dari}_sd_${sampai}`
                    : dari ? `dari-${dari}`
                    : sampai ? `sampai-${sampai}`
                    : 'semua-tanggal';
  XLSX.writeFile(wb, `rekap-totalan-barang-${rangeLabel}.xlsx`);
  toast('Rekap berhasil diekspor! 📥', 'success');
}

/* ═══════════════════════════════
   SLIP GAJI (Admin)
═══════════════════════════════ */
function resetSlipList() {
  document.getElementById('sg-dari').value = '';
  document.getElementById('sg-sampai').value = '';
  document.getElementById('slip-list-wrap').style.display = 'none';
  document.getElementById('slip-list-empty').style.display = 'none';
}

// Hitung baris barang (qty & subtotal per barang) untuk satu pekerja pada rentang tanggal.
// Selalu mengembalikan SEMUA barang di HARGA_LUSIN (walau qty 0), sesuai format slip kertas asli.
// Tentukan tim seorang pekerja: cek dari entri data mereka sendiri (paling akurat &
// sesuai histori), fallback ke data USERS saat ini, fallback terakhir 'penjahit'.
function getWorkerTim(username, nama) {
  const entry = getData().find(d => (d.username || d.nama) === (username || nama) && d.tim);
  if (entry) return entry.tim;
  if (username && USERS[username] && USERS[username].tim) return USERS[username].tim;
  return 'penjahit';
}

function hitungBarisSlip(dataPekerja, dari, sampai, tim) {
  const daftarHarga = getDaftarHargaByTim(tim);

  // Tim POLA (cutting) digaji mengikuti TOTAL SELURUH pendapatan/hasil tim produksi
  // (penjahit) pada periode yang sama — BUKAN dari input milik pola itu sendiri —
  // karena pola menyiapkan potongan bahan untuk seluruh tim produksi.
  const sumberData = tim === 'pola'
    ? getData().filter(d => (d.tim || 'penjahit') !== 'pola')
    : dataPekerja;

  const filtered = sumberData.filter(d => d.tanggal >= dari && d.tanggal <= sampai);
  const qtyByKey = {};
  const barangTanpaHarga = new Set();
  filtered.forEach(d => {
    const key = (d.barang || '').trim().toLowerCase();
    if (!daftarHarga.hasOwnProperty(key)) { barangTanpaHarga.add(d.barang); return; }
    const lusinEq = toLusinEquivalent(d.jumlah, d.satuan || 'Lusin');
    qtyByKey[key] = (qtyByKey[key] || 0) + lusinEq;
  });

  const rows = Object.keys(daftarHarga).map(key => {
    const qty = qtyByKey[key] || 0;
    const harga = daftarHarga[key];
    return { key, label: titleCase(key), harga, qty, subtotal: qty * harga };
  });

  return { rows, barangTanpaHarga: [...barangTanpaHarga] };
}

function tampilkanSlipList() {
  const dari   = document.getElementById('sg-dari').value;
  const sampai = document.getElementById('sg-sampai').value;
  if (!dari || !sampai) return toast('Pilih dari & sampai tanggal terlebih dahulu!', 'danger');
  if (dari > sampai) return toast('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"!', 'danger');

  const all = getData().filter(d => d.tanggal >= dari && d.tanggal <= sampai);
  const wrap  = document.getElementById('slip-list-wrap');
  const empty = document.getElementById('slip-list-empty');
  const tbody = document.getElementById('slip-list-tbody');

  if (all.length === 0) {
    wrap.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  wrap.style.display = 'block';

  // Kumpulkan pekerja unik (by username, fallback nama kalau username kosong)
  const pekerjaMap = {};
  all.forEach(d => {
    const uname = d.username || d.nama;
    if (!pekerjaMap[uname]) pekerjaMap[uname] = { username: d.username || '', nama: d.nama };
  });

  // Anggota tim POLA (mis. "cutting") tetap wajib muncul di daftar slip meski mereka sendiri
  // tidak input data pada periode ini — karena gaji pola dihitung dari TOTAL hasil seluruh
  // tim produksi (penjahit), bukan dari input mereka sendiri.
  Object.keys(USERS).forEach(uname => {
    const u = USERS[uname];
    if (u && u.tim === 'pola' && !pekerjaMap[uname]) {
      const contoh = getData().find(d => d.username === uname);
      const namaTampilan = contoh ? contoh.nama : (uname.charAt(0).toUpperCase() + uname.slice(1));
      pekerjaMap[uname] = { username: uname, nama: namaTampilan };
    }
  });

  const daftarPekerja = Object.values(pekerjaMap).sort((a,b) => a.nama.localeCompare(b.nama, 'id'));

  let grandTotal = 0;
  const barisPekerja = daftarPekerja.map(p => {
    const dataPekerja = getData().filter(d => (d.username || d.nama) === (p.username || p.nama));
    const tim = getWorkerTim(p.username, p.nama);
    const { rows } = hitungBarisSlip(dataPekerja, dari, sampai, tim);
    const totalQty = rows.reduce((a,r) => a + r.qty, 0);
    const totalRp  = rows.reduce((a,r) => a + r.subtotal, 0);
    grandTotal += totalRp;
    const potongan = getPotongan(p.username || p.nama, dari, sampai);
    const totalPotongan = potongan ? potongan.totalPotongan : 0;
    return `
      <tr>
        <td><strong>${p.nama}</strong></td>
        <td>${p.username ? `<span class="badge badge-user">${p.username}</span>` : '—'}</td>
        <td>${formatQty(totalQty)} Lsn</td>
        <td><span class="badge badge-qty">${formatRupiah(totalRp)}</span></td>
        <td>${totalPotongan > 0 ? `<span class="badge badge-qty" style="background:var(--danger);color:#fff;">${formatRupiah(totalPotongan)}</span>` : '—'}</td>
        <td><button class="btn btn-accent" style="padding:6px 12px;font-size:12px;" onclick="bukaSlipModal('${(p.username||'').replace(/'/g,"\\'")}', '${p.nama.replace(/'/g,"\\'")}', '${dari}', '${sampai}')">🖨️ Cetak Slip</button></td>
      </tr>`;
  }).join('');

  const barisTotal = `
    <tr style="background:var(--brand-light);">
      <td colspan="3" style="text-align:right;font-weight:800;">TOTAL KESELURUHAN</td>
      <td colspan="3"><span class="badge badge-qty" style="font-size:13px;font-weight:800;">${formatRupiah(grandTotal)}</span></td>
    </tr>`;

  tbody.innerHTML = barisPekerja + barisTotal;
}

// Menyimpan konteks slip yang sedang dibuka (dipakai oleh simpanPotonganSlip, hitungTotalSlip)
let currentSlipContext = null;

function bukaSlipModal(username, nama, dari, sampai) {
  const dataPekerja = getData().filter(d => (d.username || d.nama) === (username || nama));
  const tim = getWorkerTim(username, nama);
  const { rows, barangTanpaHarga } = hitungBarisSlip(dataPekerja, dari, sampai, tim);

  const totalBarangQty = rows.reduce((a,r) => a + r.qty, 0);
  const totalBarangRp  = rows.reduce((a,r) => a + r.subtotal, 0);

  const periodeLabel = `${formatDate(dari)} - ${formatDate(sampai)}`;
  const timLabel = tim === 'pola' ? 'Pola (Cutting)' : 'Penjahit';

  currentSlipContext = { username, nama, dari, sampai };

  // Kalau potongan untuk pekerja + periode ini sudah pernah disimpan sebelumnya, tampilkan nilai itu.
  const potonganTersimpan = getPotongan(username || nama, dari, sampai);
  const pgTabungan = potonganTersimpan ? potonganTersimpan.tabungan   : 0;
  const pgKoperasi = potonganTersimpan ? potonganTersimpan.koperasi  : 0;
  const pgLainKet  = potonganTersimpan ? potonganTersimpan.lainKet   : '';
  const pgLain     = potonganTersimpan ? potonganTersimpan.lainNominal : 0;

  // Semua baris QTY & HPP dibuat jadi <input> supaya admin bisa mengedit
  // langsung, dan Jumlah otomatis dihitung ulang saat diketik (lihat hitungTotalSlip).
  const rowsHTML = rows.map((r, idx) => `
    <tr>
      <td class="slip-center">
        <input type="number" class="slip-row-qty" data-idx="${idx}" value="${formatQty(r.qty)}" min="0" step="0.5"
               oninput="hitungTotalSlip()" style="width:44px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px;">
      </td>
      <td>${r.label}</td>
      <td class="slip-center">
        <input type="number" class="slip-row-hpp" data-idx="${idx}" value="${Math.round(r.harga/1000)}" min="0"
               oninput="hitungTotalSlip()" style="width:52px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px;">
      </td>
      <td class="slip-right slip-row-jumlah" data-idx="${idx}">${formatRupiah(r.subtotal)}</td>
    </tr>`).join('');

  const peringatanHarga = barangTanpaHarga.length > 0
    ? `<div class="no-print" style="background:#fef3c7;color:#92400e;font-size:11px;padding:6px 8px;border-radius:6px;margin-top:8px;">⚠️ Barang belum ada harga: ${barangTanpaHarga.join(', ')} — tidak dihitung di slip ini.</div>`
    : '';

  document.getElementById('slip-print-area').innerHTML = `
    <div class="slip-header">
      <h2>SLIP GAJI</h2>
    </div>
    <div class="slip-body">
      <div class="slip-info">
        <div><span class="lbl">Perusahaan</span>: <strong>SYAKIRFAMILIA GROUP</strong></div>
        <div><span class="lbl">Periode</span>: <strong>${periodeLabel}</strong></div>
        <div><span class="lbl">Alamat</span>: Jl. Anyar Bojong Kukun, Bandung 40382</div>
        <div><span class="lbl">Nama Karyawan</span>: <input type="text" id="slip-nama" value="${nama.toUpperCase()}"></div>
        <div><span class="lbl">Tim</span>: <strong>${timLabel}</strong></div>
        <div><span class="lbl">Jabatan</span>: <input type="text" id="slip-jabatan" value="${tim === 'pola' ? 'POLA/CUTTING' : 'PRODUKSI'}"></div>
      </div>

      <table class="slip-table">
        <thead>
          <tr>
            <th class="slip-center" style="width:44px;">Qty</th>
            <th>Nama Barang</th>
            <th class="slip-center" style="width:56px;">HPP</th>
            <th class="slip-right" style="width:90px;">Jumlah</th>
          </tr>
        </thead>
        <tbody id="slip-barang-tbody">
          ${rowsHTML}
          <tr class="slip-lembur-row">
            <td></td>
            <td>Lembur <input type="number" id="slip-lembur-qty" value="0" min="0" oninput="hitungTotalSlip()"> × <input type="number" id="slip-lembur-rate" value="5000" min="0" oninput="hitungTotalSlip()" style="width:70px;"></td>
            <td></td>
            <td class="slip-right" id="slip-lembur-jumlah">Rp0</td>
          </tr>
        </tbody>
      </table>

      <div class="no-print" style="font-size:10.5px;color:var(--muted);margin-top:4px;">💡 Qty & HPP di atas bisa diedit langsung kalau perlu koreksi — totalnya otomatis update. Data satuan Pcs otomatis dikonversi (1 Lusin = 12 Pcs).</div>

      <hr class="slip-divider">
      <div class="slip-total-row">
        <span id="slip-total-penghasilan-label">Total Penghasilan (${formatQty(totalBarangQty)} Lusin)</span>
        <span id="slip-total-penghasilan">${formatRupiah(totalBarangRp)}</span>
      </div>
      ${peringatanHarga}

      <div class="slip-pengurangan">
        <h4>Pengurangan</h4>
        <div class="slip-pengurangan-row">
          <label>Tabungan</label>
          <input type="number" id="slip-tabungan" value="${pgTabungan}" min="0" oninput="hitungTotalSlip()">
        </div>
        <div class="slip-pengurangan-row">
          <label>Pinjaman Koperasi</label>
          <input type="number" id="slip-koperasi" value="${pgKoperasi}" min="0" oninput="hitungTotalSlip()">
        </div>
        <div class="slip-pengurangan-row">
          <label>Pinjaman Lainnya (<input type="text" id="slip-lain-ket" placeholder="keterangan" style="width:80px;display:inline;" value="${(pgLainKet||'').replace(/"/g,'&quot;')}">)</label>
          <input type="number" id="slip-lain-nominal" value="${pgLain}" min="0" oninput="hitungTotalSlip()">
        </div>
        <div class="no-print" id="slip-potongan-status" style="font-size:11px;color:var(--muted);margin-top:6px;">${potonganTersimpan ? '✅ Potongan tersimpan untuk periode ini.' : '⚠️ Potongan belum disimpan. Isi lalu klik "💾 Simpan Potongan" sebelum mencetak.'}</div>
        <div class="slip-total-row" style="font-size:12.5px;margin-top:4px;">
          <span>Total Pengurangan</span>
          <span id="slip-total-pengurangan" style="color:var(--danger)">Rp0</span>
        </div>
      </div>

      <div class="slip-final">
        <div class="slip-total-row">
          <span>TOTAL DITERIMA KARYAWAN</span>
          <span id="slip-total-diterima">${formatRupiah(totalBarangRp)}</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('slip-modal').style.display = 'flex';
  hitungTotalSlip();
}

// Hitung ulang SEMUA total di slip — dipanggil tiap kali admin mengedit
// input apa pun di dalam slip (Qty, HPP, Lembur, atau Pengurangan).
function hitungTotalSlip() {
  const area = document.getElementById('slip-print-area');
  if (!area) return;

  let totalBarangQty = 0, totalBarang = 0;
  area.querySelectorAll('.slip-row-qty').forEach(input => {
    const idx = input.dataset.idx;
    const qty = parseFloat(input.value) || 0;
    const hppInput = area.querySelector(`.slip-row-hpp[data-idx="${idx}"]`);
    const hpp = (parseFloat(hppInput.value) || 0) * 1000;
    const jumlah = qty * hpp;
    const jumlahCell = area.querySelector(`.slip-row-jumlah[data-idx="${idx}"]`);
    if (jumlahCell) jumlahCell.textContent = formatRupiah(jumlah);
    totalBarangQty += qty;
    totalBarang += jumlah;
  });

  const lemburQty  = parseFloat(document.getElementById('slip-lembur-qty').value) || 0;
  const lemburRate = parseFloat(document.getElementById('slip-lembur-rate').value) || 0;
  const lemburJumlah = lemburQty * lemburRate;
  document.getElementById('slip-lembur-jumlah').textContent = formatRupiah(lemburJumlah);

  const totalPenghasilan = totalBarang + lemburJumlah;
  document.getElementById('slip-total-penghasilan').textContent = formatRupiah(totalPenghasilan);
  const labelEl = document.getElementById('slip-total-penghasilan-label');
  if (labelEl) labelEl.textContent = `Total Penghasilan (${formatQty(totalBarangQty)} Lusin)`;

  const tabungan = parseFloat(document.getElementById('slip-tabungan').value) || 0;
  const koperasi = parseFloat(document.getElementById('slip-koperasi').value) || 0;
  const lain     = parseFloat(document.getElementById('slip-lain-nominal').value) || 0;
  const totalPengurangan = tabungan + koperasi + lain;
  document.getElementById('slip-total-pengurangan').textContent = formatRupiah(totalPengurangan);

  const totalDiterima = totalPenghasilan - totalPengurangan;
  document.getElementById('slip-total-diterima').textContent = formatRupiah(totalDiterima);
}

function tutupSlipModal() {
  document.getElementById('slip-modal').style.display = 'none';
  currentSlipContext = null;
}

function cetakSlip() {
  window.print();
}

// Simpan potongan (Tabungan, Pinjaman Koperasi, Pinjaman Lainnya) untuk pekerja + periode
// yang sedang dibuka di modal slip. Setelah tersimpan, angkanya langsung muncul di kolom
// "Total Potongan" pada daftar Slip Gaji.
async function simpanPotonganSlip() {
  if (!currentSlipContext) return;
  const { username, nama, dari, sampai } = currentSlipContext;

  const tabungan = parseFloat(document.getElementById('slip-tabungan').value) || 0;
  const koperasi = parseFloat(document.getElementById('slip-koperasi').value) || 0;
  const lainKet  = document.getElementById('slip-lain-ket').value.trim();
  const lain     = parseFloat(document.getElementById('slip-lain-nominal').value) || 0;

  const btn = document.getElementById('btn-simpan-potongan');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

  try {
    await savePotongan(username || nama, nama, dari, sampai, tabungan, koperasi, lainKet, lain);
    toast('Potongan berhasil disimpan! 💾', 'success');
    const status = document.getElementById('slip-potongan-status');
    if (status) status.textContent = '✅ Potongan tersimpan untuk periode ini.';
  } catch (e) {
    console.error(e);
    toast('Gagal menyimpan potongan. Cek koneksi internet!', 'danger');
  }

  if (btn) { btn.disabled = false; btn.textContent = '💾 Simpan Potongan'; }
}

function getFiltered() {
  let data = getData();
  const fTgl      = document.getElementById('f-tanggal').value;
  const fPekerja  = document.getElementById('f-pekerja').value.trim().toLowerCase();
  const fBarang   = document.getElementById('f-barang').value;
  const fUsername = document.getElementById('f-username') ? document.getElementById('f-username').value : '';

  if (fTgl)      data = data.filter(d => d.tanggal === fTgl);
  if (fPekerja)  data = data.filter(d => d.nama.toLowerCase().includes(fPekerja));
  if (fBarang)   data = data.filter(d => d.barang === fBarang);
  if (fUsername) data = data.filter(d => d.username === fUsername);

  return data;
}

function renderAdminTable() {
  const all      = getData();
  const filtered = getFiltered();
  const tbody    = document.getElementById('admin-tbody');
  const empty    = document.getElementById('admin-empty');

  if (!dataLoaded) {
    tbody.innerHTML = loadingStateHTML(10);
    empty.style.display = 'none';
    return;
  }

  document.getElementById('a-total').textContent   = all.length;
  document.getElementById('a-lusin').textContent   = all.filter(d => (d.satuan || 'Lusin') === 'Lusin').reduce((a,b)=>a+b.jumlah,0);
  document.getElementById('a-pcs').textContent     = all.filter(d => d.satuan === 'Pcs').reduce((a,b)=>a+b.jumlah,0);
  document.getElementById('a-hari').textContent    = all.filter(d=>d.tanggal===todayStr()).length;
  document.getElementById('a-pekerja').textContent = [...new Set(all.map(d=>d.nama))].length;

  loadFilterUsernameSelect();

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const sorted = sortByWaktuDesc(filtered);
  tbody.innerHTML = sorted.map((d,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${formatDate(d.tanggal)}</td>
      <td>${d.waktu}</td>
      <td><strong>${d.nama}</strong></td>
      <td>${d.username ? `<span class="badge badge-user">${d.username}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
      <td>${d.barang}</td>
      <td><span class="badge badge-color">${d.warna}</span></td>
      <td><span class="badge badge-qty">${d.jumlah} ${d.satuan || 'Lusin'}</span></td>
      <td>${d.bahan ? `<span style="font-size:11px;color:var(--muted);">🧵 ${d.bahan}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
      <td>
        <button class="action-btn" onclick="bukaModalEdit('${d._docId}')" title="Edit">✏️</button>
        <button class="action-btn" onclick="hapusRowByIndex('${d._docId}')" title="Hapus">🗑️</button>
      </td>
    </tr>`).join('');
}

function resetFilter() {
  document.getElementById('f-tanggal').value = todayStr();
  document.getElementById('f-pekerja').value = '';
  document.getElementById('f-barang').value  = '';
  if (document.getElementById('f-username')) document.getElementById('f-username').value = '';
  renderAdminTable();
}

async function hapusRowByIndex(docId) {
  if (!confirm('Hapus data ini?')) return;
  try {
    await db.collection('produksi_data').doc(docId).delete();
    toast('Data dihapus.', 'danger');
  } catch (e) {
    console.error(e);
    toast('Gagal menghapus data. Cek koneksi internet!', 'danger');
  }
}

async function hapusSemuaData() {
  if (!confirm('HAPUS SEMUA DATA? Tindakan ini tidak dapat dibatalkan!')) return;
  try {
    const snap = await db.collection('produksi_data').get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    toast('Semua data telah dihapus.', 'danger');
  } catch (e) {
    console.error(e);
    toast('Gagal menghapus data. Cek koneksi internet!', 'danger');
  }
}

function renderBarangTable() {
  const list  = getBarang();
  const tbody = document.getElementById('barang-tbody');
  if (!tbody) return;

  if (!barangLoaded) {
    tbody.innerHTML = loadingStateHTML(3);
    return;
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:16px;">Belum ada barang.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((b, i) => `
    <tr>
      <td><strong>${b.nama}</strong></td>
      <td>${b.warna.map(w => `<span class="badge badge-color">${w}</span>`).join(' ')}</td>
      <td>
        <button class="action-btn" onclick="editBarang(${i})" title="Edit">✏️</button>
        <button class="action-btn" onclick="hapusBarang(${i})" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function simpanBarang() {
  const nama  = document.getElementById('bg-nama').value.trim();
  const warnaRaw = document.getElementById('bg-warna').value.trim();
  const editIdxRaw = document.getElementById('bg-edit-index').value;
  const editIdx = editIdxRaw === '' ? -1 : parseInt(editIdxRaw);

  if (!nama)     return toast('Nama barang wajib diisi!', 'danger');
  if (!warnaRaw) return toast('Daftar warna wajib diisi!', 'danger');

  const warna = warnaRaw.split(',').map(w => w.trim()).filter(w => w.length > 0);
  if (warna.length === 0) return toast('Daftar warna tidak valid!', 'danger');

  const list = [...getBarang()];

  const dup = list.findIndex(b => b.nama.toLowerCase() === nama.toLowerCase());
  if (dup !== -1 && dup !== editIdx) return toast('Nama barang sudah ada!', 'danger');

  if (editIdx === -1) {
    list.push({ nama, warna });
  } else {
    list[editIdx] = { nama, warna };
  }

  const btn = document.getElementById('bg-submit-btn');
  const btnOriginalText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-dark"></span>Menyimpan...'; }

  try {
    await saveBarang(list);
  } catch (e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.innerHTML = btnOriginalText; }
    return toast('Gagal menyimpan barang. Cek koneksi internet!', 'danger');
  }

  toast(editIdx === -1 ? 'Barang baru berhasil ditambahkan! ✅' : 'Barang berhasil diperbarui! ✅', 'success');
  batalEditBarang();
}

function editBarang(index) {
  const list = getBarang();
  const b = list[index];
  if (!b) return;

  document.getElementById('bg-nama').value  = b.nama;
  document.getElementById('bg-warna').value = b.warna.join(', ');
  document.getElementById('bg-edit-index').value = index;
  document.getElementById('bg-submit-btn').textContent = '💾 Simpan Perubahan';
  document.getElementById('bg-cancel-btn').style.display = 'inline-flex';

  document.getElementById('bg-nama').scrollIntoView({behavior:'smooth', block:'center'});
}

function batalEditBarang() {
  document.getElementById('bg-nama').value  = '';
  document.getElementById('bg-warna').value = '';
  document.getElementById('bg-edit-index').value = '';
  const btn = document.getElementById('bg-submit-btn');
  btn.disabled = false;
  btn.textContent = '➕ Tambah Barang';
  document.getElementById('bg-cancel-btn').style.display = 'none';
}

async function hapusBarang(index) {
  const list = [...getBarang()];
  const b = list[index];
  if (!b) return;
  if (!confirm(`Hapus barang "${b.nama}"? Data produksi yang sudah ada untuk barang ini tidak akan terhapus, tapi barang ini tidak akan muncul lagi di pilihan tim produksi.`)) return;

  list.splice(index, 1);
  try {
    await saveBarang(list);
    toast('Barang dihapus.', 'danger');
  } catch (e) {
    console.error(e);
    toast('Gagal menghapus barang. Cek koneksi internet!', 'danger');
  }
}

function bukaModalEdit(docId) {
  const d = getData().find(x => x._docId === docId);
  if (!d) return toast('Data tidak ditemukan!', 'danger');

  document.getElementById('em-index').value = docId;
  document.getElementById('em-nama').value   = d.nama;
  document.getElementById('em-jumlah').value = d.jumlah;
  document.getElementById('em-satuan').value = d.satuan || 'Lusin';

  const selBarang = document.getElementById('em-barang');
  selBarang.innerHTML = '<option value="">-- Pilih Barang --</option>';
  getBarang().forEach(b => {
    const o = document.createElement('option');
    o.value = b.nama; o.textContent = b.nama;
    selBarang.appendChild(o);
  });
  selBarang.value = d.barang;

  loadWarnaModal();
  document.getElementById('em-warna').value = d.warna;

  document.getElementById('edit-modal').classList.add('show');
}

function loadWarnaModal() {
  const barangNama = document.getElementById('em-barang').value;
  const warnaEl = document.getElementById('em-warna');
  warnaEl.innerHTML = '<option value="">-- Pilih Warna --</option>';
  if (!barangNama) return;
  const found = getBarang().find(b => b.nama === barangNama);
  if (found) {
    found.warna.forEach(w => {
      const o = document.createElement('option');
      o.value = w; o.textContent = w;
      warnaEl.appendChild(o);
    });
  }
}

async function simpanEditData() {
  const docId  = document.getElementById('em-index').value;
  const nama   = document.getElementById('em-nama').value.trim();
  const barang = document.getElementById('em-barang').value;
  const warna  = document.getElementById('em-warna').value;
  const jumlah = parseInt(document.getElementById('em-jumlah').value);
  const satuan = document.getElementById('em-satuan').value;

  if (!nama)        return toast('Nama pekerja wajib diisi!', 'danger');
  if (!barang)      return toast('Pilih nama barang!', 'danger');
  if (!warna)       return toast('Pilih warna barang!', 'danger');
  if (!jumlah || jumlah < 1) return toast('Jumlah harus lebih dari 0!', 'danger');
  if (!satuan)      return toast('Pilih satuan (Lusin/Pcs)!', 'danger');

  const btn = document.getElementById('btn-simpan-edit');
  const btnOriginalText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Menyimpan...'; }

  try {
    await db.collection('produksi_data').doc(docId).update({ nama, barang, warna, jumlah, satuan });
  } catch (e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.innerHTML = btnOriginalText; }
    return toast('Gagal memperbarui data. Cek koneksi internet!', 'danger');
  }

  if (btn) { btn.disabled = false; btn.innerHTML = btnOriginalText; }
  tutupModalEdit();
  toast('Data berhasil diperbarui! ✅', 'success');
}

function tutupModalEdit() {
  document.getElementById('edit-modal').classList.remove('show');
}

function exportExcel() {
  const data = getFiltered();
  if (data.length === 0) return toast('Tidak ada data untuk diekspor!', 'danger');

  const rows = sortByWaktuAsc(data).map((d, i) => ({
    'No': i + 1,
    'Tanggal': formatDate(d.tanggal),
    'Waktu': d.waktu,
    'Nama Pekerja': d.nama,
    'Username': d.username || '',
    'Barang': d.barang,
    'Warna': d.warna,
    'Jumlah': d.jumlah,
    'Satuan': d.satuan || 'Lusin',
    'Bahan': d.bahan || ''
  }));

  const totalPerSatuan = {};
  data.forEach(d => {
    const s = d.satuan || 'Lusin';
    totalPerSatuan[s] = (totalPerSatuan[s] || 0) + d.jumlah;
  });
  Object.keys(totalPerSatuan).forEach(s => {
    rows.push({ 'No': '', 'Tanggal': '', 'Waktu': '', 'Nama Pekerja': '', 'Username': '', 'Barang': '', 'Warna': `Total ${s}`, 'Jumlah': totalPerSatuan[s], 'Satuan': '', 'Bahan': '' });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Produksi');

  XLSX.writeFile(wb, `data-produksi-${todayStr()}.xlsx`);
  toast('File Excel (.xlsx) berhasil diunduh! 📥', 'success');
}

/* ═══════════════════════════════
   STOK BARANG (Admin)
   Membandingkan hasil input tim POLA (barang yang sudah dipotong / siap jahit)
   dengan hasil input tim PRODUKSI/PENJAHIT (barang yang sudah selesai dijahit),
   per Barang + Warna, pada rentang tanggal tertentu.
═══════════════════════════════ */
function hitungStokBarang(dari, sampai) {
  let data = getData();
  if (dari)   data = data.filter(d => d.tanggal >= dari);
  if (sampai) data = data.filter(d => d.tanggal <= sampai);

  const map = {}; // key: barang|warna → { barang, warna, pola, produksi }
  data.forEach(d => {
    const key = d.barang + '|' + d.warna;
    if (!map[key]) map[key] = { barang: d.barang, warna: d.warna, pola: 0, produksi: 0 };
    const lusinEq = toLusinEquivalent(d.jumlah, d.satuan || 'Lusin');
    if ((d.tim || 'penjahit') === 'pola') map[key].pola += lusinEq;
    else map[key].produksi += lusinEq;
  });

  // Gabungkan dengan penyesuaian manual admin: baik untuk mengoreksi angka
  // yang salah maupun untuk memunculkan barang yang ditambahkan admin sendiri
  // walau belum ada data produksinya sama sekali.
  const penyesuaianMap = getStokPenyesuaian();
  Object.values(penyesuaianMap).forEach(p => {
    const key = p.barang + '|' + p.warna;
    if (!map[key]) map[key] = { barang: p.barang, warna: p.warna, pola: 0, produksi: 0 };
  });

  // Semua barang & warna dari Kelola Barang otomatis masuk daftar stok
  // (walau belum ada data produksinya, tampil dengan angka 0 / HABIS).
  getBarang().forEach(b => {
    (b.warna || []).forEach(w => {
      const key = b.nama + '|' + w;
      if (!map[key]) map[key] = { barang: b.nama, warna: w, pola: 0, produksi: 0 };
    });
  });

  // Urutan mengikuti urutan di Kelola Barang (barang yang sudah tidak ada di sana taruh paling bawah)
  const urutan = getBarang().map(b => b.nama);
  const idx = nama => { const i = urutan.indexOf(nama); return i === -1 ? 9999 : i; };
  const idxW = r => { const b = getBarang().find(x => x.nama === r.barang); const i = b ? (b.warna || []).indexOf(r.warna) : -1; return i === -1 ? 9999 : i; };

  return Object.values(map)
    .map(r => {
      const pDoc = penyesuaianMap[stokPenyesuaianDocId(r.barang, r.warna)];
      const penyesuaian = pDoc ? (pDoc.penyesuaian || 0) : 0;
      return { ...r, penyesuaian, sisa: r.pola - r.produksi + penyesuaian };
    })
    .sort((a,b) => idx(a.barang) - idx(b.barang) || a.barang.localeCompare(b.barang, 'id') || idxW(a) - idxW(b));
}

function resetStok() {
  document.getElementById('sb-dari').value = '';
  document.getElementById('sb-sampai').value = '';
  document.getElementById('stok-wrap').style.display = 'none';
  document.getElementById('stok-empty').style.display = 'none';
}

function tampilkanStok() {
  const dari   = document.getElementById('sb-dari').value;
  const sampai = document.getElementById('sb-sampai').value;
  if (dari && sampai && dari > sampai) return toast('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"!', 'danger');

  const rows  = hitungStokBarang(dari, sampai);
  const wrap  = document.getElementById('stok-wrap');
  const empty = document.getElementById('stok-empty');
  const tbody = document.getElementById('stok-tbody');

  if (rows.length === 0) {
    wrap.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  wrap.style.display = 'block';

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.barang}</strong></td>
      <td><span class="badge badge-color">${r.warna}</span></td>
      <td>${formatQty(r.pola)} Lsn</td>
      <td>${formatQty(r.produksi)} Lsn</td>
      <td><span class="badge badge-qty" style="${r.sisa < 0 ? 'background:var(--danger);color:#fff;' : ''}">${formatQty(r.sisa)} Lsn</span>${r.penyesuaian ? ` <span style="font-size:11px;color:var(--muted);">(disesuaikan)</span>` : ''}</td>
      <td><button class="action-btn" onclick="bukaModalEditStok('${r.barang.replace(/'/g, "\\'")}', '${r.warna.replace(/'/g, "\\'")}')" title="Edit Sisa Stok">✏️</button></td>
    </tr>
  `).join('');

  renderUpdateStokText(rows);
}

/* ── Rekap per minggu: masuk (tim pola) vs keluar (tim produksi) ── */
function renderStokMingguan() {
  const tbody = document.getElementById('stok-minggu-tbody');
  const empty = document.getElementById('stok-minggu-empty');
  if (!tbody) return;

  if (!dataLoaded) {
    tbody.innerHTML = loadingStateHTML(4);
    empty.style.display = 'none';
    return;
  }

  const all = getData();
  if (all.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const map = {}; // key: tanggal Senin → { pola, produksi } dalam Lusin
  all.forEach(d => {
    const monday = getMondayOf(d.tanggal);
    if (!map[monday]) map[monday] = { pola: 0, produksi: 0 };
    const lusinEq = toLusinEquivalent(d.jumlah, d.satuan || 'Lusin');
    if ((d.tim || 'penjahit') === 'pola') map[monday].pola += lusinEq;
    else map[monday].produksi += lusinEq;
  });

  const mondayNow = getMondayOf(todayStr());
  const mingguList = Object.keys(map).sort((a,b) => b.localeCompare(a));

  tbody.innerHTML = mingguList.map(monday => {
    const sunday = addDaysStr(monday, 6);
    const m = map[monday];
    const selisih = m.pola - m.produksi;
    return `
    <tr class="tgl-row" onclick="pilihMingguStok('${monday}')">
      <td><strong>${formatDate(monday)} - ${formatDate(sunday)}</strong>${monday === mondayNow ? ' <span class="badge badge-qty">Minggu Ini</span>' : ''}</td>
      <td><span class="badge badge-qty">${formatQty(m.pola)} Lsn</span></td>
      <td><span class="badge badge-qty">${formatQty(m.produksi)} Lsn</span></td>
      <td><span class="badge badge-qty" style="${selisih < 0 ? 'background:var(--danger);color:#fff;' : ''}">${formatQty(selisih)} Lsn</span></td>
    </tr>`;
  }).join('');
}

function pilihMingguStok(monday) {
  document.getElementById('sb-dari').value   = monday;
  document.getElementById('sb-sampai').value = addDaysStr(monday, 6);
  tampilkanStok();
  document.getElementById('stok-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Teks "UPDATE POLA PRODUKSI TERAKHIR" untuk dibagikan ke grup ── */
function buatTeksUpdateStok(rows) {
  const grup = {};
  rows.forEach(r => {
    if (!grup[r.barang]) grup[r.barang] = [];
    grup[r.barang].push(r);
  });

  const blok = Object.keys(grup).map(barang => {
    const baris = grup[barang].map(r =>
      r.sisa > 0 ? `• ${r.warna} ${formatQty(r.sisa)} lsn` : `• ${r.warna} HABIS`
    );
    return `${barang.toUpperCase()}\n${baris.join('\n')}`;
  });

  return `UPDATE POLA PRODUKSI TERAKHIR\n\n${blok.join('\n\n')}`;
}

function renderUpdateStokText(rows) {
  const el = document.getElementById('stok-update-text');
  if (el) el.value = buatTeksUpdateStok(rows);
}

async function salinUpdateStok() {
  const el = document.getElementById('stok-update-text');
  try {
    await navigator.clipboard.writeText(el.value);
  } catch (e) {
    el.select();
    document.execCommand('copy');
  }
  toast('Teks update stok berhasil disalin! 📋', 'success');
}

function bagikanUpdateStokWA() {
  const teks = document.getElementById('stok-update-text').value;
  window.open('https://wa.me/?text=' + encodeURIComponent(teks), '_blank');
}

/* ── Tambah barang baru ke daftar Stok Barang (dari daftar Kelola Barang) ── */
function loadStokTambahBarangSelect() {
  const selBarang = document.getElementById('sb-tambah-barang');
  if (!selBarang) return;
  selBarang.innerHTML = '<option value="">-- Pilih Barang --</option>' +
    getBarang().map(b => `<option value="${b.nama}">${b.nama}</option>`).join('');
  document.getElementById('sb-tambah-warna').innerHTML = '<option value="">-- Pilih Warna --</option>';
}

function loadStokTambahWarnaSelect() {
  const namaBarang = document.getElementById('sb-tambah-barang').value;
  const selWarna   = document.getElementById('sb-tambah-warna');
  const found = getBarang().find(b => b.nama === namaBarang);
  selWarna.innerHTML = '<option value="">-- Pilih Warna --</option>' +
    (found ? found.warna.map(w => `<option value="${w}">${w}</option>`).join('') : '');
}

async function tambahBarangStok() {
  const barang = document.getElementById('sb-tambah-barang').value;
  const warna  = document.getElementById('sb-tambah-warna').value;
  if (!barang) return toast('Pilih barang terlebih dahulu!', 'danger');
  if (!warna)  return toast('Pilih warna terlebih dahulu!', 'danger');

  const rows = hitungStokBarang(document.getElementById('sb-dari').value, document.getElementById('sb-sampai').value);
  if (rows.find(r => r.barang === barang && r.warna === warna)) {
    return toast('Barang & warna ini sudah ada di daftar Stok Barang.', 'danger');
  }

  const btn = document.getElementById('sb-tambah-btn');
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-dark"></span>Menambahkan...';

  try {
    await saveStokPenyesuaian(barang, warna, 0);
  } catch (e) {
    console.error(e);
    btn.disabled = false; btn.innerHTML = orig;
    const pesan = (e && e.code === 'permission-denied')
      ? 'Gagal menambahkan barang: akses database ditolak (bukan soal koneksi internet). Minta developer menambahkan izin akses koleksi "stok_penyesuaian" di Firestore Rules.'
      : 'Gagal menambahkan barang. Cek koneksi internet!';
    return toast(pesan, 'danger');
  }

  btn.disabled = false; btn.innerHTML = orig;
  document.getElementById('sb-tambah-barang').value = '';
  document.getElementById('sb-tambah-warna').innerHTML = '<option value="">-- Pilih Warna --</option>';
  toast('Barang berhasil ditambahkan ke daftar Stok Barang! ✅', 'success');
  tampilkanStok();
}

/* ── Edit angka Sisa Stok (koreksi manual oleh admin) ── */
function bukaModalEditStok(barang, warna) {
  const rows = hitungStokBarang(document.getElementById('sb-dari').value, document.getElementById('sb-sampai').value);
  const row = rows.find(r => r.barang === barang && r.warna === warna);
  if (!row) return toast('Barang tidak ditemukan di tabel Stok Barang!', 'danger');

  document.getElementById('es-barang-label').textContent = barang;
  document.getElementById('es-warna-label').textContent  = warna;
  document.getElementById('es-barang-key').value = barang;
  document.getElementById('es-warna-key').value  = warna;
  document.getElementById('es-nilai').value = formatQty(row.sisa);
  document.getElementById('stok-edit-modal').style.display = 'flex';
}

function tutupModalEditStok() {
  document.getElementById('stok-edit-modal').style.display = 'none';
}

async function simpanEditStok() {
  const barang = document.getElementById('es-barang-key').value;
  const warna  = document.getElementById('es-warna-key').value;
  const nilaiBaru = parseFloat(document.getElementById('es-nilai').value);
  if (isNaN(nilaiBaru)) return toast('Nilai Sisa Stok tidak valid!', 'danger');

  // Penyesuaian dihitung ulang dari basis (Dipotong - Dikerjakan) rentang tanggal
  // yang sedang ditampilkan, supaya angka Sisa Stok yang tampil persis sesuai
  // yang dimasukkan admin.
  const rows = hitungStokBarang(document.getElementById('sb-dari').value, document.getElementById('sb-sampai').value);
  const row = rows.find(r => r.barang === barang && r.warna === warna);
  const basis = row ? (row.pola - row.produksi) : 0;
  const penyesuaianBaru = nilaiBaru - basis;

  const btn = document.getElementById('btn-simpan-edit-stok');
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-dark"></span>Menyimpan...';

  try {
    await saveStokPenyesuaian(barang, warna, penyesuaianBaru);
  } catch (e) {
    console.error(e);
    btn.disabled = false; btn.innerHTML = orig;
    const pesan = (e && e.code === 'permission-denied')
      ? 'Gagal menyimpan: akses database ditolak (bukan soal koneksi internet). Minta developer menambahkan izin akses koleksi "stok_penyesuaian" di Firestore Rules.'
      : 'Gagal menyimpan. Cek koneksi internet!';
    return toast(pesan, 'danger');
  }

  btn.disabled = false; btn.innerHTML = orig;
  toast('Sisa Stok berhasil diperbarui! ✅', 'success');
  tutupModalEditStok();
  tampilkanStok();
}

function exportStokExcel() {
  const dari   = document.getElementById('sb-dari').value;
  const sampai = document.getElementById('sb-sampai').value;
  const rows = hitungStokBarang(dari, sampai);
  if (rows.length === 0) return toast('Tidak ada data untuk diekspor!', 'danger');

  const sheetRows = rows.map(r => ({
    'Barang': r.barang,
    'Warna': r.warna,
    'Dipotong Tim Pola (Lusin)': formatQty(r.pola),
    'Dikerjakan Tim Produksi (Lusin)': formatQty(r.produksi),
    'Sisa Stok (Lusin)': formatQty(r.sisa)
  }));

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stok Barang');

  const rangeLabel = dari && sampai ? `${dari}_sd_${sampai}`
                    : dari ? `dari-${dari}`
                    : sampai ? `sampai-${sampai}`
                    : 'semua-tanggal';
  XLSX.writeFile(wb, `stok-barang-${rangeLabel}.xlsx`);
  toast('Stok Barang berhasil diekspor! 📥', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
  checkNotifBanner();
});