import './style.css';
import Lenis from 'lenis';
import { Stage, COLORWAYS } from './stage.js';
import { initVision } from './vision.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* ------------------------------------------------------------------ */
/*  Smooth scroll                                                      */
/* ------------------------------------------------------------------ */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lenis = new Lenis({ lerp: reduceMotion ? 1 : 0.085, wheelMultiplier: 0.9, smoothWheel: true });
$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = $(id);
    if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t, { offset: id === '#anatomy' ? 0 : -10, duration: 1.8 });
  })
);

/* ------------------------------------------------------------------ */
/*  Generic UI                                                         */
/* ------------------------------------------------------------------ */
function initUI() {
  // stagger + reveal
  ['.bento', '.tiers', '.quotes', '.mosaic', '.faq-list', '.spec-list'].forEach((sel) => {
    const p = $(sel);
    if (p) $$('.reveal', p).forEach((el, i) => el.style.setProperty('--d', `${(i % 4) * 0.08}s`));
  });
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  $$('.reveal').forEach((el) => io.observe(el));

  // hero counters
  $$('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || '0', 10);
    const t0 = performance.now() + 700;
    const step = (t) => {
      const p = clamp((t - t0) / 1800);
      el.textContent = (to * easeOut(p)).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // nav show/hide
  const nav = $('#nav');
  let lastY = 0;
  lenis.on('scroll', ({ scroll }) => {
    document.documentElement.style.setProperty('--sy', scroll + 'px');
    nav.classList.toggle('hide', scroll > lastY && scroll > 260);
    lastY = scroll;
  });

  // manifesto words
  const mt = $('#manifestoText');
  const words = mt.textContent.trim().split(/\s+/);
  const hl = new Set(['Maillard', 'Every', 'single', 'time.']);
  mt.innerHTML = words.map((w) => `<span class="w${hl.has(w) ? ' hl' : ''}">${w}</span>`).join(' ');
  const wEls = $$('.w', mt);
  const mEl = $('#manifesto');
  initUI.manifesto = () => {
    const r = mEl.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight));
    const n = wEls.length;
    wEls.forEach((w, i) => w.classList.toggle('on', i < p * n * 1.25 + 0.5));
  };

  // neural net viz
  const svg = $('#netSvg');
  if (svg) {
    const layers = [4, 6, 6, 3];
    const xs = [26, 112, 208, 296];
    const pts = layers.map((n, li) => Array.from({ length: n }, (_, i) => [xs[li], 14 + ((i + 0.5) * 92) / n + (li % 2) * 4]));
    let html = '';
    let k = 0;
    for (let l = 0; l < layers.length - 1; l++)
      for (const a of pts[l])
        for (const b of pts[l + 1]) {
          const pulse = (k++ * 7) % 5 === 0;
          html += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"${pulse ? ` class="pulse" style="animation-delay:${((k % 9) * 0.31).toFixed(2)}s"` : ''}/>`;
        }
    pts.flat().forEach((p, i) => (html += `<circle cx="${p[0]}" cy="${p[1]}" r="4.2"${i % 5 === 2 ? ' class="hot"' : ''}/>`));
    svg.innerHTML = html;
  }

  // FAQ: single-open
  $$('.faq-list details').forEach((d) => d.addEventListener('toggle', () => d.open && $$('.faq-list details').forEach((o) => o !== d && (o.open = false))));

  // countdown + meter
  const end = new Date();
  end.setMonth(end.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 0);
  const cd = { d: $('#cdD'), h: $('#cdH'), m: $('#cdM'), s: $('#cdS') };
  const tick = () => {
    let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const d = Math.floor(s / 86400);
    s -= d * 86400;
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const m = Math.floor(s / 60);
    s -= m * 60;
    cd.d.textContent = String(d).padStart(2, '0');
    cd.h.textContent = String(h).padStart(2, '0');
    cd.m.textContent = String(m).padStart(2, '0');
    cd.s.textContent = String(s).padStart(2, '0');
  };
  tick();
  setInterval(tick, 1000);
  const meterIO = new IntersectionObserver((e) => {
    if (e[0].isIntersecting) {
      $('#meterFill').style.width = '93.7%';
      meterIO.disconnect();
    }
  });
  meterIO.observe($('.meter'));

  // reserve buttons + waitlist
  const snack = $('#snack');
  let snackT;
  const say = (html) => {
    snack.innerHTML = html;
    snack.classList.add('show');
    clearTimeout(snackT);
    snackT = setTimeout(() => snack.classList.remove('show'), 5200);
  };
  $$('[data-reserve]').forEach((b) =>
    b.addEventListener('click', () =>
      say(`<b>${b.dataset.reserve}: reserved.</b> Except it isn’t. Maillard is a parody, nothing was charged, and no toaster is coming. It would have been golden.`)
    )
  );
  $('#waitlist').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#wlEmail').value.trim();
    const msg = $('#wlMsg');
    if (!/^\S+@\S+\.\S+$/.test(v)) {
      msg.textContent = 'That doesn’t look like an email. Maillard has checked it three times.';
      return;
    }
    msg.textContent = `You’re #${(48000 + Math.floor(Math.random() * 900)).toLocaleString()} in line. (This is a parody. Your email went absolutely nowhere.)`;
    $('#wlEmail').value = '';
  });

  // cookie
  const ck = $('#cookie');
  setTimeout(() => ck.classList.add('show'), 2600);
  $$('[data-cookie]', ck).forEach((b) => b.addEventListener('click', () => ck.classList.remove('show')));

  // announcement pct
  $('#batchPct').textContent = '93%';
}

/* ------------------------------------------------------------------ */
/*  3D stage + choreography                                            */
/* ------------------------------------------------------------------ */
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';
};

const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Hero toast cycle. Returns timeline values for the toaster. */
function heroCycle(t) {
  const T = t % 11.6;
  const out = { pop: 0, heat: 0.03, level: 0, display: { mode: 'greet', title: greeting(), sub: 'Maillard One  ·  Ready' } };
  if (T < 2.1) return out;
  if (T < 3.5) {
    out.display = { mode: 'scan', sub: 'MOISTURE · DENSITY · SUGAR · AGE' };
    return out;
  }
  if (T < 7.7) {
    const u = (T - 3.5) / 4.2;
    out.heat = easeOut(clamp(u * 2.2));
    out.level = 0.5 * u;
    out.display = { mode: 'toast', level: 3.7 * easeOut(u), progress: u, clock: fmtClock(112 * (1 - u)), bread: 'SOURDOUGH', conf: '94.2%' };
    return out;
  }
  out.level = 0.5;
  out.heat = Math.max(0, 1 - (T - 7.7) / 1.8) * 0.9;
  out.display = { mode: 'ready', level: 3.7, title: 'Golden.', sub: 'Exactly how you like it. Probably.' };
  if (T < 8.1) out.pop = (T - 7.7) / 0.4;
  else if (T < 10.7) out.pop = 1;
  else out.pop = clamp(1 - (T - 10.7) / 0.7);
  return out;
}

/* Camera keyframes for the guided teardown (u = 0..1 through the "hold" phase) */
const TEARDOWN = [
  [0.0, 23, 5.0, 0.3, -0.35],
  [0.12, 14.5, 8.7, 0.34, -0.15],
  [0.4, 14.5, 5.8, 0.3, 0.2],
  [0.7, 14.5, 2.9, 0.28, 0.45],
  [0.92, 13.5, 1.2, 0.34, 0.1],
  [1.0, 20, 4.0, 0.3, -0.2],
];
function teardownAt(u) {
  for (let i = 0; i < TEARDOWN.length - 1; i++) {
    const a = TEARDOWN[i];
    const b = TEARDOWN[i + 1];
    if (u <= b[0]) {
      const k = (u - a[0]) / (b[0] - a[0]);
      const s = k * k * (3 - 2 * k) * 0.55 + k * 0.45;
      return { dist: lerp(a[1], b[1], s), ty: lerp(a[2], b[2], s), el: lerp(a[3], b[3], s), spin: lerp(a[4], b[4], s) };
    }
  }
  const l = TEARDOWN[TEARDOWN.length - 1];
  return { dist: l[1], ty: l[2], el: l[3], spin: l[4] };
}

async function initStage() {
  const canvas = $('#stage');
  let stage;
  try {
    await Promise.all([document.fonts.load('300 40px "Geist Variable"'), document.fonts.load('500 20px "Geist Mono Variable"'), document.fonts.load('600 40px "Geist Variable"')]);
    stage = new Stage(canvas);
  } catch (err) {
    console.warn('WebGL unavailable, using static imagery', err);
    document.documentElement.classList.add('no-webgl');
    return;
  }
  window.__stage = stage;

  const heroEl = $('#hero');
  const anaEl = $('#anatomy');
  const colEl = $('#colors');
  const mobile = () => innerWidth < 760;

  /* ---- anatomy labels ---- */
  const labelsHost = $('#anaLabels');
  const linesHost = $('#anaLines');
  const labeled = stage.toaster.parts.filter((p) => p.title && p.text);
  const L = labeled.map((p, i) => {
    const el = document.createElement('div');
    el.className = `lbl ${p.side}`;
    el.innerHTML = `<span class="n">${p.tag}</span><b>${p.title}</b><p>${p.text}</p>`;
    labelsHost.appendChild(el);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4');
    linesHost.append(ln, dot);
    return { p, el, ln, dot, h: 100, vis: 0, pos: { x: 0, y: 0, z: 0 } };
  });
  // display label also describes the slider; fold slider into display
  const measure = () => L.forEach((l) => (l.h = l.el.offsetHeight || 100));
  measure();
  addEventListener('resize', measure);

  const anaHead = $('#anaHead');
  const anaHint = $('#anaHint');
  const anaBar = $('#anaBar');
  const anaPct = $('#anaPct');
  const words1 = $('.ana-words .w1');
  const words2 = $('.ana-words .w2');

  function layoutLabels(p, W, H) {
    const compact = W < 760;
    const on = p > 0.24 && p < 0.9;
    const gap = clamp(W * 0.2, 130, 380);
    const sides = { left: [], right: [] };
    L.forEach((l) => {
      stage.project(l.p, l.pos);
      const inView = l.pos.y > 80 && l.pos.y < H - 70;
      const e = l.p.e;
      l.vis = on && inView && e > 0.85 ? 1 : 0;
      sides[l.p.side].push(l);
    });
    if (compact) {
      // one label at a time, docked bottom; nearest the vertical centre
      let best = null;
      L.forEach((l) => {
        if (!l.vis) return;
        const d = Math.abs(l.pos.y - H * 0.42);
        if (!best || d < best.d) best = { l, d };
      });
      L.forEach((l) => {
        const show = best && best.l === l;
        l.el.classList.toggle("compact", true);
        l.el.style.opacity = show ? 1 : 0;
        l.ln.style.opacity = l.dot.style.opacity = show ? 1 : 0;
        if (show) {
          const w = Math.min(W - 40, 340);
          l.el.style.width = w + 'px';
          l.el.style.transform = `translate(${(W - w) / 2}px, ${H - l.h - 24}px)`;
          l.el.style.textAlign = 'left';
          l.ln.setAttribute('x1', W / 2);
          l.ln.setAttribute('y1', H - l.h - 30);
          l.ln.setAttribute('x2', l.pos.x);
          l.ln.setAttribute('y2', l.pos.y);
          l.dot.setAttribute('cx', l.pos.x);
          l.dot.setAttribute('cy', l.pos.y);
        }
      });
      return;
    }
    L.forEach((l) => l.el.classList.remove("compact"));
    const lw = Math.min(290, W * 0.34);
    for (const side of ['left', 'right']) {
      const items = sides[side].filter((l) => l.vis).sort((a, b) => a.pos.y - b.pos.y);
      let y = 70;
      items.forEach((l) => {
        l.y = Math.max(l.pos.y - 12, y);
        y = l.y + l.h + 16;
      });
      // pull back up if overflowing
      let maxY = H - 40;
      for (let i = items.length - 1; i >= 0; i--) {
        const l = items[i];
        if (l.y + l.h > maxY) l.y = maxY - l.h;
        maxY = l.y - 16;
      }
      items.forEach((l) => {
        const x = side === 'left' ? W / 2 - gap - lw : W / 2 + gap;
        l.el.style.width = lw + 'px';
        l.el.style.textAlign = side === 'left' ? 'right' : 'left';
        l.el.style.transform = `translate(${x}px, ${l.y}px)`;
        const ex = side === 'left' ? x + lw + 14 : x - 14;
        l.ln.setAttribute('x1', ex);
        l.ln.setAttribute('y1', l.y + 11);
        l.ln.setAttribute('x2', l.pos.x);
        l.ln.setAttribute('y2', l.pos.y);
        l.dot.setAttribute('cx', l.pos.x);
        l.dot.setAttribute('cy', l.pos.y);
      });
    }
    L.forEach((l) => {
      l.el.style.opacity = l.vis;
      l.ln.style.opacity = l.dot.style.opacity = l.vis;
    });
  }

  /* ---- colours ---- */
  const sw = $('#swatches');
  const descs = {
    titanium: 'Brushed aluminium with a cool, honest sheen. Looks expensive. Is.',
    obsidian: 'Matte black, fingerprint-resistant. Shows crumbs. Hides shame.',
    oat: 'A warm powder coat for people who say “oat” a lot. Pairs with oat milk, oat anything.',
    ember: 'Copper-anodised, limited run. Looks incredible next to a kettle.',
  };
  let finish = 'titanium';
  Object.entries(COLORWAYS).forEach(([key, c]) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.name);
    b.setAttribute('aria-checked', key === finish);
    b.style.background = `linear-gradient(145deg, ${c.swatch[0]}, ${c.swatch[1]})`;
    b.addEventListener('click', () => {
      finish = key;
      $$('.sw', sw).forEach((s) => s.setAttribute('aria-checked', s === b));
      $('#finishName').textContent = c.name;
      $('#finishDesc').textContent = descs[key];
      stage.setColorway(key);
    });
    sw.appendChild(b);
  });

  // drag to spin in colours
  let drag = null;
  let vel = 0;
  colEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a,button')) return;
    drag = e.clientX;
    vel = 0;
  });
  addEventListener('pointermove', (e) => {
    stage.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    if (drag !== null) {
      vel = (e.clientX - drag) * 0.009;
      stage.userSpin += vel;
      drag = e.clientX;
    }
  });
  addEventListener('pointerup', () => (drag = null));

  /* ---- main loop ---- */
  let last = performance.now();
  let spinBase = 0;
  addEventListener('resize', () => stage.resize());

  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    const vh = innerHeight;
    const W = innerWidth;
    const hr = heroEl.getBoundingClientRect();
    const ar = anaEl.getBoundingClientRect();
    const cr = colEl.getBoundingClientRect();
    const heroVis = hr.bottom > 0 && hr.top < vh;
    const anaVis = ar.top < vh && ar.bottom > 0;
    const colVis = cr.top < vh && cr.bottom > 0;
    const t = now / 1000;
    const tg = stage.target;
    const m = mobile();

    if (anaVis) {
      const p = clamp(-ar.top / (ar.height - vh));
      const pa = clamp(p / 0.3);
      const pc = clamp((p - 0.88) / 0.12);
      let explode;
      let cam;
      if (p < 0.3) {
        const k = ease(pa);
        explode = pa;
        cam = { dist: lerp(9.6, 23, k), ty: lerp(0.95, 5.0, k), el: lerp(0.2, 0.3, k), spin: lerp(-0.52, -0.35, k) };
        tg.shift = lerp(m ? 0 : 0.22, 0, k);
      } else if (p < 0.88) {
        explode = 1;
        cam = teardownAt((p - 0.3) / 0.58);
        tg.shift = 0;
      } else {
        const k = ease(pc);
        explode = 1 - pc;
        const e = teardownAt(1);
        cam = { dist: lerp(e.dist, 9.6, k), ty: lerp(e.ty, 0.9, k), el: lerp(e.el, 0.2, k), spin: lerp(e.spin, -0.52, k) };
        tg.shift = lerp(0, m ? 0 : 0.22, k);
      }
      Object.assign(tg, cam, { explode, shiftY: 0, tx: 0, fit: m ? 0.7 : 1 });
      tg.pop = 0.35;
      tg.heat = 0.6 * (1 - pc);
      tg.level = 0.5;
      tg.halo = 1;
      stage.display = { mode: 'anatomy' };

      anaHead.style.opacity = p < 0.1 ? 1 : 0;
      anaHead.style.transform = p < 0.1 ? 'none' : 'translateY(-20px)';
      anaHint.style.opacity = p < 0.04 ? 1 : 0;
      anaBar.style.height = p * 100 + '%';
      anaPct.textContent = String(Math.round(p * 100)).padStart(2, '0');
      words1.style.transform = `translateX(${-p * 34}%)`;
      words2.style.transform = `translateX(${-(1 - p) * 34}%)`;
      stage.update(dt);
      layoutLabels(p, W, vh);
      stage.moodTarget.setHex(0x0a0b0d);
      stage.render();
    } else if (colVis) {
      spinBase += dt * 0.16;
      vel *= 0.94;
      if (drag === null) stage.userSpin += vel;
      Object.assign(tg, { explode: 0, dist: 10.2, ty: 0.95, tx: 0, el: 0.17, spin: -0.5 + spinBase, shift: m ? 0 : -0.23, shiftY: m ? -0.2 : 0, fit: 1, pop: 1, heat: 0.04, level: 0.5, halo: 1 });
      stage.display = { mode: 'idle', title: COLORWAYS[finish].name + '.', sub: 'Maillard One  ·  Ready' };
      stage.moodTarget.setHex(COLORWAYS[finish].bg);
      stage.update(dt);
      stage.render();
    } else if (heroVis) {
      const p = clamp(-hr.top / hr.height);
      const c = heroCycle(t);
      Object.assign(tg, {
        explode: 0,
        dist: lerp(9.6, 7.4, p),
        ty: lerp(0.9, 1.15, p) ,
        tx: 0,
        el: lerp(0.2, 0.26, p),
        spin: -0.52 + p * 0.55 + Math.sin(t * 0.35) * 0.05,
        shift: m ? 0 : 0.22,
        shiftY: m ? -0.17 : 0,
        fit: 1,
        pop: c.pop,
        heat: c.heat,
        level: c.level,
        halo: 1,
      });
      stage.display = c.display;
      stage.moodTarget.setHex(0x0a0b0d);
      stage.update(dt);
      stage.render();
    }
    stage.perf(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

initUI();
initVision();
function uiLoop(t) {
  lenis.raf(t);
  if (initUI.manifesto) initUI.manifesto();
  requestAnimationFrame(uiLoop);
}
requestAnimationFrame(uiLoop);
initStage();
