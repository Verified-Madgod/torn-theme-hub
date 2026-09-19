/* Fixture audit helpers. Loaded only by test/fixture.html, never by the extension.
 *
 *   fxAudit('#some-scope')   -> { coverage, contrast }
 *
 * coverage: renders the scope under Midnight and under Paper, in both Torn dark
 *   and light mode, and lists every visible element whose text colour,
 *   background, gradient or border is IDENTICAL under both themes - i.e. it is
 *   not following the theme. (Semantic bar fills are exempt.)
 * contrast: every text element, every theme, both Torn modes, must be >= 3:1
 *   against its effective (composited) background.
 */
(function () {
  const sel = () => document.getElementById('fx-theme');
  const dm = () => document.getElementById('fx-dark');
  function setT(theme, dark) {
    dm().checked = dark; sel().value = theme; sel().dispatchEvent(new Event('change'));
  }
  const trans = v => v === 'rgba(0, 0, 0, 0)' || v === 'none';
  const hasText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const label = e => e.tagName.toLowerCase() + ([...e.classList].length ? '.' + [...e.classList].slice(0, 2).join('.') : '');

  const parse = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const firstGrad = img => { const m = img.match(/rgba?\([^)]+\)/); return m ? parse(m[0]) : null; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const blend = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  function effBg(el) {
    const st = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e); let c = parse(cs.backgroundColor);
      const g = cs.backgroundImage !== 'none' ? firstGrad(cs.backgroundImage) : null;
      if (g && g.a > 0) c = g;
      if (c && c.a > 0) { st.push(c); if (c.a >= .99) break; }
    }
    let b = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = st.length - 1; i >= 0; i--) b = blend(st[i], b);
    return b;
  }

  window.fxAudit = function (scope, opts) {
    opts = opts || {};
    const root = document.querySelector(scope);
    if (!root) return { error: 'scope not found: ' + scope };
    const els = [root, ...root.querySelectorAll('*')].filter(visible);
    const exempt = e => /progressLine___/.test(e.className) || (opts.exempt && e.matches(opts.exempt));
    const snap = () => els.map(e => { const c = getComputedStyle(e);
      return { color: c.color, bg: c.backgroundColor, img: c.backgroundImage, bt: c.borderTopColor, btw: c.borderTopWidth, fill: c.fill }; });

    const coverage = {};
    for (const d of [true, false]) {
      setT('midnight', d); const a = snap(); setT('paper', d); const b = snap();
      const miss = [];
      els.forEach((e, i) => {
        if (exempt(e)) return;
        const n = label(e);
        // accent-text is #fff in both reference themes by design; skip those
        const onAccent = a[i].color === 'rgb(255, 255, 255)' && b[i].color === 'rgb(255, 255, 255)' &&
                         (e.closest('.active, .torn-btn') !== null);
        if (hasText(e) && a[i].color === b[i].color && !onAccent) miss.push(n + ' color ' + a[i].color);
        if (!trans(a[i].bg) && a[i].bg === b[i].bg) miss.push(n + ' bg ' + a[i].bg);
        if (/gradient/.test(a[i].img) && a[i].img === b[i].img) miss.push(n + ' gradient');
        if (parseFloat(a[i].btw) > 0 && !trans(a[i].bt) && a[i].bt === b[i].bt) miss.push(n + ' border ' + a[i].bt);
        if (e instanceof SVGElement && opts.svg && a[i].fill === b[i].fill && a[i].fill !== 'none') miss.push(n + ' fill ' + a[i].fill);
      });
      coverage[d ? 'torn-dark' : 'torn-light'] = miss.length ? [...new Set(miss)] : 'fully themed (' + els.length + ' elements)';
    }

    const texts = els.filter(hasText);
    const fails = [];
    for (const t of TORN_THEME_ORDER) for (const d of [true, false]) {
      setT(t, d);
      texts.forEach(e => {
        const fg = parse(getComputedStyle(e).color); if (!fg) return;
        const bg = effBg(e), f = blend(fg, bg);
        const L1 = lum(f), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        if (cr < 3) fails.push(t + (d ? '/dark ' : '/light ') + label(e) + ' "' + e.textContent.trim().slice(0, 16) + '" ' + cr.toFixed(2));
      });
    }
    setT('midnight', true);
    return { coverage, contrast: { texts: texts.length, failures: fails.length ? fails.slice(0, 30) : 'none (' + TORN_THEME_ORDER.length + ' themes x 2 modes)' } };
  };
})();
