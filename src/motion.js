/* Torre de Controle WTA — camada de motion (reveal + count-up + sweep) */
window.MOTION = function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.body.classList.add('motion');

  // ---- count-up de números "limpos" (ignora textos com múltiplos números) ----
  function countUp(el) {
    if (el.dataset.cu) return;
    var txt = el.textContent.trim();
    var m = txt.match(/^(\D*?)(\d[\d.]*(?:,\d+)?)(\D*)$/);
    if (!m) { el.dataset.cu = '1'; return; }
    el.dataset.cu = '1';
    var pre = m[1], numStr = m[2], suf = m[3];
    var dec = (numStr.split(',')[1] || '').length;
    var target = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(target)) { el.textContent = txt; return; }
    var fmt = function (v) { return pre + v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
    var dur = 1000, t0 = null;
    function tick(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = txt;
    }
    el.textContent = fmt(0);
    requestAnimationFrame(tick);
  }
  var CU = '.hero .val, .kpi .val, .signal .big, .ckpi .v';

  // ---- re-dispara o sweep do donut (novo × renovação) ----
  function sweepDonut(card) {
    var d = card.querySelector && card.querySelector('.donut');
    if (!d || d.dataset.sw) return;
    d.dataset.sw = '1';
    var target = (d.style.getPropertyValue('--p') || '0%').trim() || '0%';
    d.style.setProperty('--p', '0%');
    void d.offsetWidth;
    requestAnimationFrame(function () { d.style.setProperty('--p', target); });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      io.unobserve(el);
      var sib = [].slice.call(el.parentNode.children).filter(function (c) { return c.matches && c.matches('.card,.ckpi'); });
      var idx = sib.indexOf(el);
      var delay = idx > 0 ? Math.min(idx, 6) * 55 : 0;
      setTimeout(function () {
        el.classList.add('reveal');
        if (el.matches(CU)) countUp(el);
        el.querySelectorAll(CU).forEach(countUp);
        sweepDonut(el);
      }, delay);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('.card, .ckpi, .sec-title, .lead').forEach(function (el) { io.observe(el); });
};
