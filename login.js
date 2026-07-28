/* login.js — khusus untuk login.html */

// Kalau sebelumnya sudah login (ada session aktif), langsung lempar ke halaman yang sesuai
// supaya tidak perlu login ulang tiap buka login.html.
(function redirectIfAlreadyLoggedIn() {
  const role = localStorage.getItem('role');
  if (role === 'admin') window.location.href = 'admin.html';
  else if (role === 'produksi') window.location.href = 'produksi.html';
})();

function doLogin() {
  const u = document.getElementById('inp-user').value.trim().toLowerCase();
  const p = document.getElementById('inp-pass').value.trim();
  const err = document.getElementById('login-err');

  if (USERS[u] && USERS[u].pass === p) {
    err.style.display = 'none';
    localStorage.setItem('role', USERS[u].role);
    localStorage.setItem('username', u);
    window.location.href = USERS[u].role === 'admin' ? 'admin.html' : 'produksi.html';
  } else {
    err.style.display = 'block';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
