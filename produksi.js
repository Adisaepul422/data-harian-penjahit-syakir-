/* produksi.js — khusus untuk produksi.html */

// Pastikan yang buka halaman ini sudah login sebagai produksi, kalau tidak, dilempar ke login.html
const currentUsername = requireRole('produksi');

// Timpa hook dari shared.js: saat daftar barang berubah (real-time), refresh dropdown barang
onBarangChanged = function () {
  loadBarangSelect();
};

// Timpa hook dari shared.js: setiap data produksi berubah (real-time), hitung ulang pendapatan
onDataChanged = function () {
  if (dataLoaded) renderPendapatanMingguan();
};

/* ═══════════════════════════════
   PENDAPATAN SAYA (mingguan + riwayat)
═══════════════════════════════ */
function hitungPendapatanPeriode(dataSaya, dari, sampai) {
  const filtered = dataSaya.filter(d => d.tanggal >= dari && d.tanggal <= sampai);
  let total = 0, qty = 0;
  const missingHarga = new Set();
  filtered.forEach(d => {
    const harga = getHargaLusin(d.barang);
    if (harga === null) { missingHarga.add(d.barang); return; }
    const lusinEq = toLusinEquivalent(d.jumlah, d.satuan || 'Lusin');
    total += lusinEq * harga;
    qty += lusinEq;
  });
  return { total, qty, missingHarga: [...missingHarga] };
}

function renderPendapatanMingguan() {
  const dataSaya = getData().filter(d => d.username === currentUsername);
  const mondayNow = getMondayOf(todayStr());
  const sundayNow = addDaysStr(mondayNow, 6);

  const { total, qty, missingHarga } = hitungPendapatanPeriode(dataSaya, mondayNow, sundayNow);

  document.getElementById('pendapatan-periode').textContent =
    `Minggu Ini • ${formatDate(mondayNow)} - ${formatDate(sundayNow)}`;
  document.getElementById('pendapatan-total').textContent = formatRupiah(total);
  document.getElementById('pendapatan-qty').textContent = `${formatQty(qty)} Lusin diproduksi`;

  const warnEl = document.getElementById('pendapatan-warning');
  if (missingHarga.length > 0) {
    warnEl.style.display = 'block';
    warnEl.textContent = `⚠️ Barang ini belum ada harganya, belum dihitung: ${missingHarga.join(', ')}. Hubungi admin ya.`;
  } else {
    warnEl.style.display = 'none';
  }

  document.getElementById('pendapatan-loading').style.display = 'none';
  document.getElementById('pendapatan-content').style.display = 'block';

  renderRiwayatPendapatan(dataSaya, mondayNow);
}

function renderRiwayatPendapatan(dataSaya, mondayIni) {
  const mingguSet = new Set(dataSaya.map(d => getMondayOf(d.tanggal)));
  mingguSet.delete(mondayIni); // minggu ini sudah ditampilkan terpisah di atas
  const mingguList = [...mingguSet].sort((a,b) => b.localeCompare(a));

  const tbody = document.getElementById('riwayat-tbody');
  if (mingguList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:16px;">Belum ada riwayat minggu sebelumnya.</td></tr>`;
    return;
  }

  tbody.innerHTML = mingguList.map(monday => {
    const sunday = addDaysStr(monday, 6);
    const { total, qty } = hitungPendapatanPeriode(dataSaya, monday, sunday);
    return `<tr>
      <td>${formatDate(monday)} - ${formatDate(sunday)}</td>
      <td>${formatQty(qty)} Lsn</td>
      <td><strong>${formatRupiah(total)}</strong></td>
    </tr>`;
  }).join('');
}

function toggleRiwayatPendapatan() {
  const el = document.getElementById('riwayat-pendapatan');
  const btnText = document.getElementById('riwayat-toggle-text');
  const showing = el.style.display !== 'none';
  el.style.display = showing ? 'none' : 'block';
  btnText.textContent = showing ? 'Lihat Riwayat Minggu Lalu' : 'Sembunyikan Riwayat';
}

function initProduksi() {
  const d = new Date();
  document.getElementById('prod-date').textContent =
    d.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  // Nama pekerja otomatis mengikuti akun yang login, tidak perlu diketik ulang
  const namaOtomatis = currentUsername ? currentUsername.charAt(0).toUpperCase() + currentUsername.slice(1) : '';
  document.getElementById('inp-nama').value = namaOtomatis;

  loadBarangSelect();
}

function loadBarangSelect() {
  const sel = document.getElementById('inp-barang');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Barang --</option>';
  getBarang().forEach(b => {
    const o = document.createElement('option');
    o.value = b.nama; o.textContent = b.nama;
    sel.appendChild(o);
  });
}

function loadWarna() {
  const barangNama = document.getElementById('inp-barang').value;
  const warnaEl = document.getElementById('inp-warna');
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

let previewBuffer = [];

function tambahKePreview() {
  const nama   = document.getElementById('inp-nama').value.trim();
  const barang = document.getElementById('inp-barang').value;
  const warna  = document.getElementById('inp-warna').value;
  const jumlah = parseInt(document.getElementById('inp-jumlah').value);
  const satuan = document.getElementById('inp-satuan').value;

  if (!nama)        return toast('Nama pekerja wajib diisi!', 'danger');
  if (!barang)      return toast('Pilih nama barang!', 'danger');
  if (!warna)       return toast('Pilih warna barang!', 'danger');
  if (!jumlah || jumlah < 1) return toast('Jumlah harus lebih dari 0!', 'danger');
  if (!satuan)      return toast('Pilih satuan (Lusin/Pcs)!', 'danger');

  previewBuffer.push({
    tempId: Date.now() + Math.random(),
    nama, barang, warna, jumlah, satuan
  });

  document.getElementById('inp-barang').value = '';
  document.getElementById('inp-warna').innerHTML = '<option value="">-- Pilih Warna --</option>';
  document.getElementById('inp-jumlah').value = '';
  document.getElementById('inp-satuan').value = 'Lusin';

  renderPreview();
  toast('Item ditambahkan ke preview!', 'success');
}

function renderPreview() {
  const section = document.getElementById('preview-section');
  const list    = document.getElementById('preview-list');

  if (previewBuffer.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = previewBuffer.map((item, i) => `
    <div class="preview-item">
      <div class="pi-info">
        <div class="pi-name">${item.nama}</div>
        <div class="pi-detail">${item.barang} · <span class="badge badge-color">${item.warna}</span> · <span class="badge badge-qty">${item.jumlah} ${item.satuan}</span></div>
      </div>
      <button class="pi-del" onclick="hapusPreview(${i})" title="Hapus item ini">✕</button>
    </div>
  `).join('');
}

function hapusPreview(index) {
  previewBuffer.splice(index, 1);
  renderPreview();
  toast('Item dihapus dari preview.', 'danger');
}

async function simpanSemua() {
  if (previewBuffer.length === 0) return toast('Tidak ada data di preview!', 'danger');

  const waktu = nowStr();
  const tanggal = todayStr();
  const btn = document.getElementById('btn-simpan-semua');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

  try {
    const batch = db.batch();
    previewBuffer.forEach(item => {
      const ref = db.collection('produksi_data').doc();
      batch.set(ref, {
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        tanggal, waktu,
        nama: item.nama,
        username: currentUsername || '',
        barang: item.barang,
        warna: item.warna,
        jumlah: item.jumlah,
        satuan: item.satuan || 'Lusin'
      });
    });
    await batch.commit();
  } catch (e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.textContent = '✅ Simpan Semua'; }
    return toast('Gagal menyimpan data. Cek koneksi internet!', 'danger');
  }

  previewBuffer = [];

  document.getElementById('inp-barang').value = '';
  document.getElementById('inp-warna').innerHTML = '<option value="">-- Pilih Warna --</option>';
  document.getElementById('inp-jumlah').value = '';
  document.getElementById('inp-satuan').value = 'Lusin';
  if (btn) { btn.disabled = false; btn.textContent = '✅ Simpan Semua'; }

  renderPreview();
  toast('Semua data berhasil disimpan! ✅', 'success');
}

function batalSemua() {
  if (!confirm('Batalkan semua item di preview? Data tidak akan disimpan.')) return;
  previewBuffer = [];
  renderPreview();
  toast('Preview dibatalkan.', 'danger');
}

document.addEventListener('DOMContentLoaded', () => {
  initProduksi();
  if (barangLoaded) loadBarangSelect();
});