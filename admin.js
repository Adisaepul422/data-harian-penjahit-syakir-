/* admin.js — khusus untuk admin.html */

// Pastikan yang buka halaman ini sudah login sebagai admin, kalau tidak, dilempar ke login.html
requireRole('admin');

// Timpa hook dari shared.js: refresh tampilan admin setiap data/barang berubah real-time
onDataChanged = function () {
  renderAdminTable();
  loadRekapPekerjaSelect();
  renderTanggalSummary();
};
onBarangChanged = function () {
  loadFilterBarangSelect();
  renderBarangTable();
};

function initAdmin() {
  const d = new Date();
  document.getElementById('admin-date').textContent =
    d.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  document.getElementById('f-tanggal').value = todayStr();

  loadFilterBarangSelect();
  loadFilterUsernameSelect();
  loadRekapPekerjaSelect();
  renderAdminTable();
  renderBarangTable();
  renderTanggalSummary();

  showAdminTab('data');
}

function showAdminTab(tabId) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-subnav-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  document.querySelector(`.admin-subnav-btn[data-tab="${tabId}"]`).classList.add('active');

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

function loadRekapPekerjaSelect() {
  const sel = document.getElementById('rk-pekerja');
  if (!sel) return;
  const current = sel.value;
  const names = [...new Set(getData().map(d => d.nama))].sort((a,b) => a.localeCompare(b, 'id'));
  sel.innerHTML = '<option value="">-- Pilih Pekerja --</option>' +
    '<option value="__ALL__">🔷 Semua Pekerja</option>' +
    names.map(n => `<option value="${n}">${n}</option>`).join('');
  sel.value = current;
}

function getRekapFiltered() {
  const dari    = document.getElementById('rk-dari').value;
  const sampai  = document.getElementById('rk-sampai').value;
  const pekerja = document.getElementById('rk-pekerja').value;

  let data = getData();
  if (pekerja && pekerja !== '__ALL__') data = data.filter(d => d.nama === pekerja);
  if (dari)    data = data.filter(d => d.tanggal >= dari);
  if (sampai)  data = data.filter(d => d.tanggal <= sampai);
  return { data, pekerja, dari, sampai };
}

function ringkasRekap(data) {
  const map = {};
  data.forEach(d => {
    const satuan = d.satuan || 'Lusin';
    const key = d.barang + '|' + d.warna + '|' + satuan;
    if (!map[key]) map[key] = { barang: d.barang, warna: d.warna, satuan, jumlah: 0 };
    map[key].jumlah += d.jumlah;
  });
  return Object.values(map).sort((a,b) =>
    a.barang.localeCompare(b.barang, 'id') || a.warna.localeCompare(b.warna, 'id') || a.satuan.localeCompare(b.satuan, 'id')
  );
}

function tampilkanRekap() {
  const dari   = document.getElementById('rk-dari').value;
  const sampai = document.getElementById('rk-sampai').value;
  const { data, pekerja } = getRekapFiltered();

  if (!pekerja) return toast('Pilih nama pekerja terlebih dahulu!', 'danger');
  if (dari && sampai && dari > sampai) return toast('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"!', 'danger');

  const hasil = document.getElementById('rekap-hasil');
  const empty = document.getElementById('rekap-empty');
  const tbody = document.getElementById('rekap-tbody');

  if (data.length === 0) {
    hasil.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  hasil.style.display = 'block';

  const rows = ringkasRekap(data);

  const gabunganNote = document.getElementById('rekap-gabungan-note');
  if (gabunganNote) gabunganNote.style.display = pekerja === '__ALL__' ? 'block' : 'none';

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.barang}</strong></td>
      <td><span class="badge badge-color">${r.warna}</span></td>
      <td>${r.satuan}</td>
      <td><span class="badge badge-qty">${r.jumlah} ${r.satuan}</span></td>
    </tr>
  `).join('');

  // Total dihitung terpisah per satuan (Lusin & Pcs tidak bisa dijumlah jadi satu angka)
  const totalPerSatuan = {};
  rows.forEach(r => { totalPerSatuan[r.satuan] = (totalPerSatuan[r.satuan] || 0) + r.jumlah; });
  const totalText = Object.keys(totalPerSatuan).map(s => `${totalPerSatuan[s]} ${s}`).join(' + ');
  document.getElementById('rekap-total').textContent = totalText;
}

function resetRekap() {
  document.getElementById('rk-dari').value = '';
  document.getElementById('rk-sampai').value = '';
  document.getElementById('rk-pekerja').value = '';
  document.getElementById('rekap-hasil').style.display = 'none';
  document.getElementById('rekap-empty').style.display = 'none';
}

function exportRekapExcel() {
  const { data, pekerja, dari, sampai } = getRekapFiltered();
  if (!pekerja) return toast('Pilih nama pekerja terlebih dahulu!', 'danger');
  if (data.length === 0) return toast('Tidak ada data untuk diekspor!', 'danger');

  const ringkas = ringkasRekap(data);
  const rows = ringkas.map(r => ({
    'Barang': r.barang,
    'Warna': r.warna,
    'Satuan': r.satuan,
    'Jumlah': r.jumlah
  }));

  const totalPerSatuan = {};
  ringkas.forEach(r => { totalPerSatuan[r.satuan] = (totalPerSatuan[r.satuan] || 0) + r.jumlah; });
  Object.keys(totalPerSatuan).forEach(s => {
    rows.push({ 'Barang': '', 'Warna': '', 'Satuan': `Total ${s}`, 'Jumlah': totalPerSatuan[s] });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap');

  const rangeLabel = dari && sampai ? `${dari}_sd_${sampai}`
                    : dari ? `dari-${dari}`
                    : sampai ? `sampai-${sampai}`
                    : 'semua-tanggal';
  const pekerjaLabel = pekerja === '__ALL__' ? 'semua-pekerja' : pekerja;
  XLSX.writeFile(wb, `rekap-${pekerjaLabel}-${rangeLabel}.xlsx`);
  toast('Rekap berhasil diekspor! 📥', 'success');
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
    tbody.innerHTML = loadingStateHTML(9);
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

async function migrasiDataLama() {
  const oldData   = JSON.parse(localStorage.getItem('produksi_data') || '[]');
  const oldBarang = JSON.parse(localStorage.getItem('produksi_barang') || 'null');

  if (oldData.length === 0 && !oldBarang) {
    return toast('Tidak ada data lama tersimpan di perangkat ini.', 'danger');
  }
  if (!confirm(`Migrasikan ${oldData.length} data produksi lama dari perangkat ini ke cloud? Lakukan ini HANYA SEKALI, dan hanya dari satu perangkat (misalnya laptop admin).`)) return;

  try {
    if (oldBarang) {
      await db.collection('config').doc('barang').set({ list: oldBarang });
    }
    if (oldData.length > 0) {
      const batch = db.batch();
      oldData.forEach(d => {
        const ref = db.collection('produksi_data').doc();
        batch.set(ref, d);
      });
      await batch.commit();
    }
    toast(`Migrasi berhasil! ${oldData.length} data lama dipindahkan ke cloud. ✅`, 'success');
  } catch (e) {
    console.error(e);
    toast('Migrasi gagal. Cek koneksi internet!', 'danger');
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
    'Satuan': d.satuan || 'Lusin'
  }));

  const totalPerSatuan = {};
  data.forEach(d => {
    const s = d.satuan || 'Lusin';
    totalPerSatuan[s] = (totalPerSatuan[s] || 0) + d.jumlah;
  });
  Object.keys(totalPerSatuan).forEach(s => {
    rows.push({ 'No': '', 'Tanggal': '', 'Waktu': '', 'Nama Pekerja': '', 'Username': '', 'Barang': '', 'Warna': `Total ${s}`, 'Jumlah': totalPerSatuan[s], 'Satuan': '' });
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

document.addEventListener('DOMContentLoaded', initAdmin);
