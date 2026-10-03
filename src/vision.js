import { rng } from './textures.js';

const BREADS = {
  sourdough: {
    name: 'SOURDOUGH', conf: 94.2, shape: 'boule', crumb: ['#f3dfb2', '#dcb577'], crust: '#7f4b1d', pores: 'large',
    moisture: 41.7, density: 0.38, sugar: 2.1, age: 1.8, shade: 3.7, time: '1:52', quip: 'day-old; once ambitious',
    note: 'Golden, with a hint of regret.', box: [0.1, 0.14, 0.8, 0.72],
  },
  rye: {
    name: 'RYE', conf: 97.8, shape: 'loaf', crumb: ['#b08a5e', '#85613b'], crust: '#3f2410', pores: 'small',
    moisture: 46.3, density: 0.61, sugar: 1.4, age: 2.4, shade: 4.4, time: '2:20', quip: 'dense, principled',
    note: 'Needs conviction. Applying 4.4.', box: [0.17, 0.1, 0.66, 0.8],
  },
  brioche: {
    name: 'BRIOCHE', conf: 99.1, shape: 'domed', crumb: ['#f8e5a9', '#f0cc72'], crust: '#b46a24', pores: 'tiny',
    moisture: 33.9, density: 0.29, sugar: 7.8, age: 0.6, shade: 2.9, time: '1:24', quip: 'rich, high sugar, will burn',
    note: 'Handle with care. Sugars are volatile.', box: [0.16, 0.1, 0.68, 0.8],
  },
  bagel: {
    name: 'BAGEL', conf: 92.6, shape: 'ring', crumb: ['#f1dcae', '#d8b274'], crust: '#9a5f26', pores: 'tiny',
    moisture: 38.5, density: 0.52, sugar: 3.2, age: 1.1, shade: 4.1, time: '2:05', quip: 'circular, undecided',
    note: 'Bagel Mode requires Maillard+. We’ll toast it anyway. This once.', box: [0.1, 0.1, 0.8, 0.8],
  },
  gf: {
    name: 'GLUTEN-FREE', conf: 88.3, shape: 'loaf', crumb: ['#f5ecd8', '#e5d6b4'], crust: '#c49a5a', pores: 'cracked',
    moisture: 29.4, density: 0.33, sugar: 1.9, age: 3.9, shade: 3.2, time: '1:41', quip: 'fragile, doing its best',
    note: 'Fragile structure detected. Proceeding gently.', box: [0.17, 0.1, 0.66, 0.8],
  },
};

function shapePath(ctx, type, S) {
  const cx = S / 2;
  const cy = S / 2 + 6;
  ctx.beginPath();
  if (type === 'boule') {
    const rx = 292;
    const ry = 262;
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const wob = 1 + 0.025 * Math.sin(a * 3 + 1) + 0.015 * Math.sin(a * 5);
      const x = cx + Math.cos(a) * rx * wob;
      const y = cy + Math.sin(a) * ry * wob - (Math.sin(a) < 0 ? 10 : 0);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  } else if (type === 'ring') {
    ctx.arc(cx, cy, 290, 0, Math.PI * 2);
    ctx.moveTo(cx + 96, cy);
    ctx.arc(cx, cy, 96, 0, Math.PI * 2, true);
  } else {
    const dome = type === 'domed' ? 1.18 : 1;
    const w = 236;
    const top = cy - 280 * dome;
    const bot = cy + 270;
    ctx.moveTo(cx - w + 40, bot);
    ctx.lineTo(cx + w - 40, bot);
    ctx.quadraticCurveTo(cx + w, bot, cx + w, bot - 40);
    ctx.lineTo(cx + w, cy - 20);
    ctx.bezierCurveTo(cx + w, cy - 70, cx + w + 50, cy - 90, cx + w + 50, cy - 140 * dome);
    ctx.bezierCurveTo(cx + w + 50, top + 30, cx + 150, top, cx, top);
    ctx.bezierCurveTo(cx - 150, top, cx - w - 50, top + 30, cx - w - 50, cy - 140 * dome);
    ctx.bezierCurveTo(cx - w - 50, cy - 90, cx - w, cy - 70, cx - w, cy - 20);
    ctx.lineTo(cx - w, bot - 40);
    ctx.quadraticCurveTo(cx - w, bot, cx - w + 40, bot);
  }
  ctx.closePath();
}

export function drawBread(canvas, key) {
  const b = BREADS[key];
  const S = canvas.width;
  const ctx = canvas.getContext('2d');
  const r = rng(key.length * 97 + key.charCodeAt(0));
  ctx.clearRect(0, 0, S, S);

  // board shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = '#000';
  shapePath(ctx, b.shape, S);
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  shapePath(ctx, b.shape, S);
  ctx.clip('evenodd');

  const g = ctx.createRadialGradient(S * 0.45, S * 0.4, 20, S / 2, S / 2, S * 0.55);
  g.addColorStop(0, b.crumb[0]);
  g.addColorStop(1, b.crumb[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // mottling
  for (let i = 0; i < 90; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 30 + r() * 80;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() > 0.5 ? '255,245,215' : '120,80,40';
    gr.addColorStop(0, `rgba(${c},0.13)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // pores
  const cfg = { large: [52, 5, 30], small: [220, 2, 8], tiny: [640, 1, 3.6], cracked: [160, 2, 9] }[b.pores];
  for (let i = 0; i < cfg[0]; i++) {
    const x = 80 + r() * (S - 160);
    const y = 60 + r() * (S - 120);
    const rx = cfg[1] + Math.pow(r(), 2.2) * (cfg[2] - cfg[1]);
    const ry = rx * (0.55 + r() * 0.6);
    const rot = r() * 3;
    ctx.fillStyle = `rgba(70,42,16,${0.25 + r() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,248,225,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.12, y + ry * 0.35, rx * 0.8, ry * 0.5, rot, 0, 7);
    ctx.fill();
    ctx.fillStyle = `rgba(40,22,6,${0.35 + r() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.1, y - ry * 0.2, rx * 0.65, ry * 0.55, rot, 0, 7);
    ctx.fill();
  }
  if (b.pores === 'cracked') {
    ctx.strokeStyle = 'rgba(90,60,28,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      let x = 100 + r() * 520;
      let y = 90 + r() * 520;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 60;
        y += (r() - 0.3) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  if (b.shape === 'ring') {
    // everything seasoning
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2;
      const rad = 110 + r() * 170;
      const x = S / 2 + Math.cos(a) * rad;
      const y = S / 2 + 6 + Math.sin(a) * rad;
      ctx.fillStyle = r() > 0.3 ? 'rgba(250,238,205,0.95)' : 'rgba(40,24,10,0.9)';
      ctx.beginPath();
      ctx.ellipse(x, y, 5 + r() * 3, 2.6 + r() * 1.4, r() * 3, 0, 7);
      ctx.fill();
    }
  }
  // speckle
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '40,20,0'},${0.03 + r() * 0.07})`;
    ctx.fillRect(r() * S, r() * S, 1.6, 1.6);
  }

  // crust (inner stroke) + inner shadow
  shapePath(ctx, b.shape, S);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = b.crust;
  ctx.lineWidth = b.shape === 'ring' ? 46 : 36;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 62;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.restore();
}

const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');

export function initVision() {
  const vp = document.getElementById('vp');
  if (!vp) return;
  const canvas = document.getElementById('breadCanvas');
  const term = document.getElementById('term');
  const box = document.getElementById('vpBox');
  const boxLabel = document.getElementById('vpBoxLabel');
  const stateEl = document.getElementById('vpState');
  const clockEl = document.getElementById('vpClock');
  const btn = document.getElementById('analyseBtn');
  const vShade = document.getElementById('vShade');
  const vTime = document.getElementById('vTime');
  const vConf = document.getElementById('vConf');
  const vNote = document.getElementById('vNote');
  const chips = [...document.querySelectorAll('#breadChips .chip')];

  let current = 'sourdough';
  let runId = 0;
  let clockTimer = 0;

  const setBox = (b) => {
    box.style.left = b.box[0] * 100 + '%';
    box.style.top = b.box[1] * 100 + '%';
    box.style.width = b.box[2] * 100 + '%';
    box.style.height = b.box[3] * 100 + '%';
  };

  const line = (html, cls = '') => {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    term.appendChild(d);
    while (term.children.length > 14) term.removeChild(term.firstChild);
    return d;
  };

  const idle = () => {
    term.innerHTML = '';
    line('<span class="t">00:00.000</span>maillard_os 3.2 · crumb_vision ready', '');
    line('<span class="t">00:00.000</span>select a slice, then press analyse', 'cur');
    vp.classList.remove('scanning', 'found');
    stateEl.textContent = 'STANDBY';
    vShade.textContent = vTime.textContent = vConf.textContent = '—';
    vNote.textContent = 'Press analyse to begin.';
    setBox(BREADS[current]);
  };

  const select = (key) => {
    runId++;
    clearInterval(clockTimer);
    current = key;
    chips.forEach((c) => c.classList.toggle('on', c.dataset.bread === key));
    drawBread(canvas, key);
    btn.disabled = false;
    btn.textContent = 'Analyse slice';
    idle();
  };

  chips.forEach((c) => c.addEventListener('click', () => select(c.dataset.bread)));

  const countTo = (el, to, dec, ms, suffix = '') => {
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  btn.addEventListener('click', async () => {
    const id = ++runId;
    const b = BREADS[current];
    btn.disabled = true;
    btn.textContent = 'Analysing…';
    term.innerHTML = '';
    vp.classList.remove('found');
    vp.classList.add('scanning');
    stateEl.textContent = 'SCANNING';
    vShade.textContent = vTime.textContent = vConf.textContent = '—';
    vNote.textContent = 'Thinking…';
    setBox(b);

    const t0 = performance.now();
    clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      const ms = performance.now() - t0;
      clockEl.textContent = `${pad(ms / 3600000)}:${pad((ms / 60000) % 60)}:${pad((ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
    }, 31);

    const stamp = (ms) => `<span class="t">00:00.${pad(ms, 3)}</span>`;
    const script = [
      [0, 'wake crumb_vision v3.2 <span class="ok">[M1-N · 38 TOPS]</span>'],
      [260, 'cam[0..3] hyperspectral 940nm <span class="ok">ok</span>'],
      [520, 'object detected: bread-like <span class="ok">(0.998)</span>'],
      [820, `classify → <span class="em">${b.name}</span> <span class="ok">(${b.conf}%)</span>`],
      [1120, `moisture ${b.moisture}% · density ${b.density} g/cm³ · sugar ${b.sugar} g`],
      [1420, `age estimate ${b.age} d — “${b.quip}”`],
      [1760, 'user_profile: palate=3.7 sleep=5h12m <span class="em">→ +0.1 browning, no judgement</span>'],
      [2060, 'neural_browning(4.2B) … sampling 4 zones'],
      [2400, `plan: ramp 78% · ${b.time} · target <span class="em">${b.shade.toFixed(1)}/7</span>`],
      [2680, 'confidence <span class="ok">96.4%</span> — ready.'],
    ];
    for (let i = 0; i < script.length; i++) {
      const [at, html] = script[i];
      const wait = at - (performance.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (id !== runId) return;
      term.querySelectorAll('.cur').forEach((n) => n.classList.remove('cur'));
      line(stamp(Math.round(at / 10) + 12) + html, i === script.length - 1 ? 'cur' : '');
      if (i === 3) {
        vp.classList.add('found');
        boxLabel.textContent = `${b.name} ${b.conf}%`;
      }
    }
    await new Promise((r) => setTimeout(r, 350));
    if (id !== runId) return;
    clearInterval(clockTimer);
    vp.classList.remove('scanning');
    stateEl.textContent = 'READY';
    boxLabel.textContent = `${b.name} ${b.conf}%`;
    countTo(vShade, b.shade, 1, 700, ' / 7');
    vTime.textContent = b.time;
    countTo(vConf, 96.4, 1, 900, '%');
    vNote.textContent = b.note;
    btn.disabled = false;
    btn.textContent = 'Analyse again';
  });

  select('sourdough');
}
