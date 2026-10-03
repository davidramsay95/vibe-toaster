import * as THREE from 'three';

// Deterministic PRNG so renders are reproducible
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(canvas, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/** Fine horizontal brushing – used as roughness + bump map */
export function brushedTexture(seed = 3) {
  const r = rng(seed);
  const c = makeCanvas(1024, 1024);
  const g = c.getContext('2d');
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) {
    const y = r() * 1024;
    const x = r() * 1024;
    const len = 60 + r() * 500;
    const v = 150 + r() * 105;
    g.strokeStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.25})`;
    g.lineWidth = 0.5 + r() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y + (r() - 0.5) * 1.2);
    g.stroke();
  }
  return tex(c, { srgb: false, repeat: true });
}

/** Tiny stipple noise for matte / anodised finish */
export function grainTexture(seed = 5) {
  const r = rng(seed);
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40000; i++) {
    const v = 170 + r() * 85;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.fillRect(r() * 512, r() * 512, 1.5, 1.5);
  }
  return tex(c, { srgb: false, repeat: true });
}

/** PCB colour map + emissive trace map */
export function pcbTextures(seed = 11) {
  const r = rng(seed);
  const S = 1024;
  const base = makeCanvas(S, S);
  const glow = makeCanvas(S, S);
  const b = base.getContext('2d');
  const e = glow.getContext('2d');
  b.fillStyle = '#071311';
  b.fillRect(0, 0, S, S);
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);

  // subtle soldermask gradient
  const gr = b.createLinearGradient(0, 0, S, S);
  gr.addColorStop(0, 'rgba(20,60,52,0.35)');
  gr.addColorStop(1, 'rgba(0,0,0,0.2)');
  b.fillStyle = gr;
  b.fillRect(0, 0, S, S);

  const trace = (x, y, dir, steps) => {
    const hot = r() > 0.72;
    const w = hot ? 2.4 : 1.6 + r() * 1.2;
    b.strokeStyle = 'rgba(190,150,70,0.75)';
    b.lineWidth = w;
    e.strokeStyle = hot ? 'rgba(120,235,255,1)' : 'rgba(40,120,140,0.55)';
    e.lineWidth = w;
    b.beginPath();
    e.beginPath();
    b.moveTo(x, y);
    e.moveTo(x, y);
    for (let i = 0; i < steps; i++) {
      const len = 20 + r() * 70;
      x += Math.cos((dir * Math.PI) / 4) * len;
      y += Math.sin((dir * Math.PI) / 4) * len;
      b.lineTo(x, y);
      e.lineTo(x, y);
      dir += r() > 0.5 ? 1 : -1;
      if (r() > 0.4) dir = Math.round(dir / 2) * 2;
    }
    b.stroke();
    e.stroke();
    b.fillStyle = 'rgba(210,170,90,0.95)';
    b.beginPath();
    b.arc(x, y, 4, 0, 7);
    b.fill();
    e.fillStyle = hot ? 'rgba(160,245,255,1)' : 'rgba(60,150,170,0.7)';
    e.beginPath();
    e.arc(x, y, 3.5, 0, 7);
    e.fill();
  };
  // radiate traces from the centre (where the chip sits)
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const rad = 130 + r() * 60;
    trace(S / 2 + Math.cos(a) * rad, S / 2 + Math.sin(a) * rad, Math.round((a / Math.PI) * 4), 3 + Math.floor(r() * 5));
  }
  for (let i = 0; i < 90; i++) trace(r() * S, r() * S, Math.floor(r() * 8), 2 + Math.floor(r() * 4));
  // via holes
  for (let i = 0; i < 260; i++) {
    const x = r() * S,
      y = r() * S;
    b.fillStyle = '#c9a050';
    b.beginPath();
    b.arc(x, y, 3, 0, 7);
    b.fill();
    b.fillStyle = '#031210';
    b.beginPath();
    b.arc(x, y, 1.2, 0, 7);
    b.fill();
  }
  // silkscreen
  b.fillStyle = 'rgba(235,235,235,0.55)';
  b.font = '500 22px "Geist Mono Variable", monospace';
  b.fillText('MAILLARD  M1-N  REV C', 40, S - 40);
  b.font = '500 14px "Geist Mono Variable", monospace';
  b.fillText('NEURAL BROWNING ENGINE', 40, S - 68);
  return { map: tex(base, { repeat: false }), emissive: tex(glow) };
}

/** Laser-etched chip top */
export function chipTexture(line1 = 'M1-N', line2 = 'NEURAL ENGINE', logo = true) {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#0d0e10';
  g.fillRect(0, 0, 512, 512);
  const gr = g.createLinearGradient(0, 0, 512, 512);
  gr.addColorStop(0, 'rgba(255,255,255,0.10)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(255,255,255,0.06)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.arc(50, 50, 9, 0, 7);
  g.fill();
  g.textAlign = 'center';
  g.fillStyle = 'rgba(235,240,245,0.92)';
  g.font = '600 78px "Geist Variable", Inter, sans-serif';
  g.fillText(line1, 256, 270);
  g.font = '500 24px "Geist Mono Variable", monospace';
  g.fillStyle = 'rgba(200,210,220,0.7)';
  g.fillText(line2, 256, 320);
  g.font = '500 17px "Geist Mono Variable", monospace';
  g.fillText('4.2B  ·  38 TOPS  ·  ON-DEVICE', 256, 360);
  if (logo) {
    g.strokeStyle = 'rgba(235,240,245,0.5)';
    g.lineWidth = 3;
    g.strokeRect(24, 24, 464, 464);
  }
  return tex(c);
}

/** Plain label canvas texture (transparent bg) */
export function labelTexture(text, { w = 512, h = 128, size = 44, color = '#e9e9ec', weight = 600, spacing = 8, font = 'Geist Variable' } = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${weight} ${size}px "${font}", Inter, sans-serif`;
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  g.fillText(text, w / 2, h / 2 + 2);
  return tex(c);
}

/** Warning label for the PSU */
export function psuLabelTexture() {
  const c = makeCanvas(512, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#e9e1cf';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#16161a';
  g.font = '700 34px "Geist Variable", sans-serif';
  g.fillText('MAILLARD PSU-GaN 1800', 24, 58);
  g.font = '500 20px "Geist Mono Variable", monospace';
  ['IN  100–240V ~ 50/60Hz 15A', 'OUT 48V ⎓ 37.5A  1800W', 'EFFICIENCY 96.2%   TEMP 38°C', 'DO NOT OPEN. WE MEAN IT.'].forEach((t, i) => g.fillText(t, 24, 100 + i * 32));
  g.fillStyle = '#16161a';
  for (let i = 0; i < 38; i++) g.fillRect(24 + i * 12, 224, i % 3 === 0 ? 6 : 3, 20);
  return tex(c);
}

/** Bread crumb face for toast, with optional etched art */
export function toastFaceTexture(etch = 'none', seed = 7) {
  const r = rng(seed);
  const S = 768;
  const WW = 1152;
  const c = makeCanvas(WW, S);
  const g = c.getContext('2d');
  g.fillStyle = '#f4dba8';
  g.fillRect(0, 0, WW, S);
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const x = r() * WW,
      y = r() * S,
      rad = 30 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() > 0.5 ? '255,236,190' : '222,178,108';
    gr.addColorStop(0, `rgba(${v},0.22)`);
    gr.addColorStop(1, `rgba(${v},0)`);
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // pores
  for (let i = 0; i < 3800; i++) {
    const x = r() * WW,
      y = r() * S,
      rx = 1.2 + r() * 5,
      ry = rx * (0.6 + r() * 0.6);
    g.fillStyle = `rgba(120,78,30,${0.1 + r() * 0.28})`;
    g.beginPath();
    g.ellipse(x, y, rx, ry, r() * 3, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(255,240,200,0.35)';
    g.beginPath();
    g.ellipse(x - 0.8, y - 0.8, rx * 0.7, ry * 0.5, r() * 3, 0, 7);
    g.fill();
  }
  if (etch !== 'none') {
    g.save();
    g.translate(WW / 2, S * 0.36);
    g.scale(0.8, 0.8);
    g.strokeStyle = 'rgba(70,32,6,0.82)';
    g.fillStyle = 'rgba(70,32,6,0.82)';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (etch === 'smile') {
      g.lineWidth = 16;
      g.beginPath();
      g.arc(0, 0, 150, 0, 7);
      g.stroke();
      g.beginPath();
      g.arc(-55, -40, 15, 0, 7);
      g.arc(55, -40, 15, 0, 7);
      g.fill();
      g.beginPath();
      g.arc(0, 10, 85, 0.25, Math.PI - 0.25);
      g.stroke();
    } else if (etch === 'mark') {
      g.lineWidth = 22;
      g.beginPath();
      g.moveTo(-110, 90);
      g.lineTo(-110, -90);
      g.lineTo(0, 20);
      g.lineTo(110, -90);
      g.lineTo(110, 90);
      g.stroke();
    }
    g.restore();
  }
  const t = tex(c);
  return t;
}

/** Radial falloff for floor alpha / glow decals */
export function radialTexture(stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], size = 512) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return tex(c, { srgb: true });
}

export function dotTexture() {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}
