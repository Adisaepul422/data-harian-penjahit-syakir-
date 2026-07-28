/* produksi.js — khusus untuk produksi.html */

// Pastikan yang buka halaman ini sudah login sebagai produksi, kalau tidak, dilempar ke login.html
const currentUsername = requireRole('produksi');

// Timpa hook dari shared.js: saat daftar barang berubah (real-time), refresh dropdown barang
onBarangChanged = function () {
  loadBarangSelect();
};

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
