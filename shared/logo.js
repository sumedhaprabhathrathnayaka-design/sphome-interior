// ═══════════════════════════════════════════════════
//  SP HOME INTERIOR — LOGO INJECTOR
//  Injects logo.png into all logo <img> tags safely.
//  Falls back gracefully if logo.png is missing.
// ═══════════════════════════════════════════════════

(function () {
  const LOGO_SRC = '../shared/logo.png';
  const ids = ['loginLogo', 'tbLogo', 'wLogo'];

  function applyLogo() {
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (el && !el.src) {
        el.src = LOGO_SRC;
        el.onerror = function () { el.style.display = 'none'; };
      }
    });
    // also any img with class .logo-img
    document.querySelectorAll('img.logo-img').forEach(function (el) {
      if (!el.src) {
        el.src = LOGO_SRC;
        el.onerror = function () { el.style.display = 'none'; };
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLogo);
  } else {
    applyLogo();
  }
})();
