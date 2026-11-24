/* ═══════════════════════════════════════════════════
   MOTION.JS — animasi GSAP + ScrollTrigger
   • Kartu masuk dengan fade + naik halus (yang di bawah layar menunggu di-scroll)
   • Hover kartu: terangkat sedikit + bayangan membesar (hanya di perangkat dengan mouse)
   • Login: satu "momen" pembuka; modal slip: muncul dengan pop kecil
   Aman: kalau GSAP gagal dimuat atau pengguna memilih "kurangi gerakan" di
   perangkatnya, semua animasi dilewati dan halaman tampil normal.
   Dimuat di <head> setelah GSAP & ScrollTrigger, sebelum shared.js.
═══════════════════════════════════════════════════ */
(function () {
  const adaGsap = typeof window.gsap !== 'undefined';
  const kurangiGerak = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const aktif = adaGsap && !kurangiGerak;

  // API kosong supaya pemanggil di admin.js / produksi.js tidak perlu cek apa-apa
  const kosong = { aktif: false, revealTab() {}, pop() {}, init() {} };
  if (!aktif) { window.Motion = kosong; return; }

  const adaST = typeof window.ScrollTrigger !== 'undefined';
  if (adaST) gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  // Menandai <html> supaya CSS tahu animasi CSS lama (fadeIn, hover transform) harus dimatikan
  document.documentElement.classList.add('motion-on');

  const AWAL = { opacity: 0, y: 22 };
  let triggers = [];

  function masuk(els, delay) {
    gsap.fromTo(els, AWAL, {
      opacity: 1, y: 0, duration: 0.55, stagger: 0.07, delay: delay || 0,
      overwrite: 'auto', clearProps: 'opacity,transform'
    });
  }

  // Kartu yang sudah terlihat di layar langsung masuk; yang masih di bawah menunggu di-scroll.
  function reveal(els) {
    const batasBawah = window.innerHeight * 0.92;
    const langsung = [];
    els.forEach(el => {
      if (el.getBoundingClientRect().top < batasBawah || !adaST) { langsung.push(el); return; }
      gsap.set(el, AWAL);
      triggers.push(ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => masuk(el)
      }));
    });
    if (langsung.length) masuk(langsung);
  }

  // Dipanggil admin.js setiap pindah tab: kartu di tab itu masuk lagi (menggantikan fadeIn CSS lama)
  function revealTab(tabEl) {
    if (!tabEl) return;
    triggers.forEach(t => t.kill());
    triggers = [];
    reveal([...tabEl.querySelectorAll('.card, .stat-card')]);
  }

  // Pop kecil untuk elemen yang muncul karena aksi pengguna (modal, item preview baru)
  function pop(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    gsap.fromTo(el, { opacity: 0, y: 24, scale: 0.97 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.4)',
      overwrite: 'auto', clearProps: 'opacity,transform'
    });
  }

  /* ───────── Hover kartu (delegasi event, jadi kartu dinamis ikut kena) ───────── */
  const SEL_HOVER = '.card, .stat-card';
  const SHADOW_HOVER = 'rgba(15, 30, 64, 0.16) 0px 14px 30px 0px';

  function targetHover(e) {
    const el = e.target.closest && e.target.closest(SEL_HOVER);
    if (!el || el.closest('[id$="modal"]')) return null;     // kartu di dalam modal tidak ikut
    if (el.contains(e.relatedTarget)) return null;           // pindah antar-anak di kartu yang sama
    return el;
  }

  function pasangHover() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.addEventListener('mouseover', e => {
      const el = targetHover(e);
      if (!el) return;
      if (!el._shadowAwal) el._shadowAwal = getComputedStyle(el).boxShadow;
      gsap.to(el, { y: -3, boxShadow: SHADOW_HOVER, duration: 0.25, overwrite: 'auto' });
    });
    document.addEventListener('mouseout', e => {
      const el = targetHover(e);
      if (!el) return;
      gsap.to(el, {
        y: 0, boxShadow: el._shadowAwal || 'none', duration: 0.35, overwrite: 'auto',
        clearProps: 'boxShadow,transform'
      });
    });
  }

  /* ───────── Animasi saat halaman dibuka ───────── */
  function init() {
    const topbar = document.querySelector('.topbar');
    if (topbar) gsap.from(topbar, { y: -48, opacity: 0, duration: 0.5, clearProps: 'opacity,transform' });

    const subnav = document.querySelector('.admin-subnav');
    if (subnav) gsap.from(subnav, { y: -12, opacity: 0, duration: 0.45, delay: 0.1, clearProps: 'opacity,transform' });

    // Login: satu momen pembuka — kartu naik, lalu isinya menyusul satu per satu
    const login = document.querySelector('.login-card');
    if (login) {
      gsap.from(login, { y: 32, opacity: 0, scale: 0.96, duration: 0.7, clearProps: 'opacity,transform' });
      gsap.from('.login-card .login-logo, .login-card .form-group, .login-card .btn', {
        y: 14, opacity: 0, duration: 0.45, stagger: 0.08, delay: 0.25, clearProps: 'opacity,transform'
      });
    }

    // Kartu statistik admin (selalu terlihat di atas tab)
    const stats = document.querySelectorAll('.admin-stats-bar .stat-card');
    if (stats.length) masuk([...stats], 0.15);

    // Halaman tim produksi (tanpa tab): kartu masuk, yang di bawah menunggu scroll
    if (!document.querySelector('.admin-tab-content')) {
      reveal([...document.querySelectorAll('.main-wrap .card')]);
    }

    pasangHover();
    if (adaST) window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  window.Motion = { aktif: true, revealTab, pop, init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
