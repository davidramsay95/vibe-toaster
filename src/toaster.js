import * as THREE from 'three';
import {
  brushedTexture,
  grainTexture,
  pcbTextures,
  chipTexture,
  labelTexture,
  psuLabelTexture,
  toastFaceTexture,
  makeCanvas,
  rng,
} from './textures.js';

/* ------------------------------------------------------------------ */
/*  Dimensions (1 unit ≈ 10 cm)                                        */
/* ------------------------------------------------------------------ */
const W = 3.1;
const D = 1.7;
const R = 0.5;
const SLOT_Z = 0.42;
const TOAST_W = 1.5;
const TOAST_H = 1.0;
const TOAST_T = 0.14;

export const COLORWAYS = {
  titanium: { name: 'Titanium', body: 0xc4c8ce, metal: 1, rough: 0.33, brushed: true, bg: 0x0a0b0d, swatch: ['#e1e4e8', '#8e949c'] },
  obsidian: { name: 'Obsidian', body: 0x202225, metal: 1, rough: 0.42, brushed: false, bg: 0x08090b, swatch: ['#3a3d42', '#0e0f11'] },
  oat: { name: 'Oat', body: 0xe4d9c6, metal: 0.1, rough: 0.52, brushed: false, bg: 0x100e0b, swatch: ['#f2eadc', '#c9bba3'] },
  ember: { name: 'Ember', body: 0xc4592c, metal: 0.95, rough: 0.36, brushed: true, bg: 0x110a07, swatch: ['#f08a55', '#8f3512'] },
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */
function rrPath(path, w, h, r, cx = 0, cy = 0) {
  r = Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005);
  const x = cx - w / 2;
  const y = cy - h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - r);
  path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + h);
  path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

/**
 * Rounded-rectangle slab, Y-up, bottom at y=0, top at y=h. Outer dims are exact.
 * holes: [{w, d, r, x, z}] are *final* opening sizes.
 */
function slab({ w, d, h, r = 0.1, bevel = 0.04, holes = [], segs = 5 }) {
  const shape = new THREE.Shape();
  rrPath(shape, w - 2 * bevel, d - 2 * bevel, Math.max(r - bevel, 0.01));
  holes.forEach((o) => {
    const p = new THREE.Path();
    rrPath(p, o.w + 2 * bevel, o.d + 2 * bevel, o.r ?? Math.min(o.w, o.d) / 2, o.x ?? 0, -(o.z ?? 0));
    shape.holes.push(p);
  });
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segs,
    curveSegments: 20,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return geo;
}

function breadShape(w, h) {
  const hw = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + 0.12, 0);
  s.lineTo(hw - 0.12, 0);
  s.quadraticCurveTo(hw, 0, hw, 0.12);
  s.lineTo(hw, h * 0.56);
  s.bezierCurveTo(hw, h * 0.64, hw + 0.07, h * 0.68, hw + 0.07, h * 0.77);
  s.bezierCurveTo(hw + 0.07, h * 0.93, hw * 0.55, h, 0, h);
  s.bezierCurveTo(-hw * 0.55, h, -hw - 0.07, h * 0.93, -hw - 0.07, h * 0.77);
  s.bezierCurveTo(-hw - 0.07, h * 0.68, -hw, h * 0.64, -hw, h * 0.56);
  s.lineTo(-hw, 0.12);
  s.quadraticCurveTo(-hw, 0, -hw + 0.12, 0);
  return s;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0, r = 0.01) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(rad, h, mat, x = 0, y = 0, z = 0, axis = 'y', seg = 32) {
  const g = new THREE.CylinderGeometry(rad, rad, h, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  return m;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t, s = 1.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/*  Display (OLED) canvas                                              */
/* ------------------------------------------------------------------ */
const DW = 1024;
const DH = 320;

function drawDisplay(g, s) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, DW, DH);
  const mono = '"Geist Mono Variable", ui-monospace, monospace';
  const sans = '"Geist Variable", Inter, system-ui, sans-serif';
  const ember = '#ff8a4c';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';

  const dots = () => {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(s.time * 5 - i * 0.9));
      g.fillStyle = `rgba(150,230,255,${a})`;
      g.beginPath();
      g.arc(70 + i * 34, 210, 9, 0, 7);
      g.fill();
    }
  };

  if (s.mode === 'greet' || s.mode === 'idle') {
    g.fillStyle = '#f2f2f4';
    g.font = `300 108px ${sans}`;
    g.fillText(s.title || 'Good morning.', 52, 168);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = `500 28px ${mono}`;
    g.fillText((s.sub || 'MAILLARD ONE  ·  READY').toUpperCase(), 56, 238);
    // breathing orb
    const a = 0.55 + 0.45 * Math.sin(s.time * 2);
    const gr = g.createRadialGradient(900, 160, 0, 900, 160, 90);
    gr.addColorStop(0, `rgba(150,230,255,${0.9 * a})`);
    gr.addColorStop(0.4, `rgba(120,200,255,${0.25 * a})`);
    gr.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = gr;
    g.fillRect(780, 40, 240, 240);
    g.fillStyle = '#eaffff';
    g.beginPath();
    g.arc(900, 160, 11, 0, 7);
    g.fill();
  } else if (s.mode === 'scan') {
    g.fillStyle = 'rgba(150,230,255,0.9)';
    g.font = `500 26px ${mono}`;
    g.fillText('CRUMB VISION', 56, 70);
    g.fillStyle = '#f2f2f4';
    g.font = `300 96px ${sans}`;
    g.fillText('Reading bread', 52, 170);
    dots();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = `500 26px ${mono}`;
    g.fillText(s.sub || 'MOISTURE · DENSITY · SUGAR · AGE', 56, 270);
    // scan bars
    for (let i = 0; i < 28; i++) {
      const hh = 14 + 70 * Math.abs(Math.sin(s.time * 3 + i * 0.7)) * Math.abs(Math.cos(i * 0.31));
      g.fillStyle = 'rgba(150,230,255,0.55)';
      g.fillRect(680 + i * 11, 250 - hh, 6, hh);
    }
  } else if (s.mode === 'toast') {
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = `500 24px ${mono}`;
    g.fillText('BROWNING', 56, 66);
    g.fillStyle = '#f6f6f8';
    g.font = `200 190px ${sans}`;
    g.fillText(s.level.toFixed(1), 46, 236);
    g.font = `500 26px ${mono}`;
    g.fillStyle = ember;
    g.fillText('/ 7', 336, 236);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = `500 24px ${mono}`;
    g.fillText((s.bread || 'SOURDOUGH') + '  ' + (s.conf || '97.1%'), 968, 66);
    g.fillStyle = '#f6f6f8';
    g.font = `300 100px ${sans}`;
    g.fillText(s.clock || '01:52', 968, 200);
    g.textAlign = 'left';
    // progress
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(56, 274, 912, 6);
    const grd = g.createLinearGradient(56, 0, 968, 0);
    grd.addColorStop(0, '#ffb067');
    grd.addColorStop(1, '#ff5a1f');
    g.fillStyle = grd;
    g.fillRect(56, 274, 912 * clamp01(s.progress), 6);
  } else if (s.mode === 'ready') {
    g.fillStyle = ember;
    g.font = `500 26px ${mono}`;
    g.fillText('DONE  ·  ' + (s.level || 3.7).toFixed(1) + ' / 7', 56, 70);
    g.fillStyle = '#f6f6f8';
    g.font = `300 112px ${sans}`;
    g.fillText(s.title || 'Golden.', 52, 190);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = `400 34px ${sans}`;
    g.fillText(s.sub || 'Exactly how you like it. Probably.', 56, 250);
    g.strokeStyle = '#8be9ff';
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(840, 170);
    g.lineTo(886, 214);
    g.lineTo(960, 118);
    g.stroke();
  } else if (s.mode === 'anatomy') {
    g.fillStyle = 'rgba(150,230,255,0.9)';
    g.font = `500 24px ${mono}`;
    g.fillText('MAILLARD OS 3.2', 56, 66);
    g.fillStyle = '#f6f6f8';
    g.font = `300 88px ${sans}`;
    g.fillText('Please do not', 52, 160);
    g.fillText('panic.', 52, 250);
  }
}

/* ------------------------------------------------------------------ */
/*  Build                                                              */
/* ------------------------------------------------------------------ */
export function buildToaster({ maxAniso = 8 } = {}) {
  const root = new THREE.Group();
  root.name = 'maillard-one';

  /* ---- shared textures & materials ---- */
  const brushed = brushedTexture();
  const grain = grainTexture();
  brushed.repeat.set(1.5, 1.5);
  grain.repeat.set(2, 2);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: COLORWAYS.titanium.body,
    metalness: 1,
    roughness: 0.34,
    roughnessMap: brushed,
    bumpMap: brushed,
    bumpScale: 0.35,
    clearcoat: 0,
  });
  const lidMat = new THREE.MeshPhysicalMaterial({
    color: 0x050506,
    metalness: 0.0,
    roughness: 0.12,
    clearcoat: 0.3,
    clearcoatRoughness: 0.12,
    reflectivity: 0.4,
    envMapIntensity: 0.16,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa5a8ae, metalness: 1, roughness: 0.36, roughnessMap: brushed });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x4a4d53, metalness: 1, roughness: 0.42, roughnessMap: brushed });
  const alu = new THREE.MeshStandardMaterial({ color: 0xd2d5da, metalness: 1, roughness: 0.22 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, metalness: 0.3, roughness: 0.55 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x08080a, metalness: 0, roughness: 0.9 });
  const glassDark = new THREE.MeshPhysicalMaterial({ color: 0x020305, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc07a45, metalness: 1, roughness: 0.28 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 1, roughness: 0.25 });
  const micaMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.85, metalness: 0 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x3a1608, emissive: 0xff5412, emissiveIntensity: 0.15, metalness: 0.4, roughness: 0.5 });
  const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.8), toneMapped: false });
  const aiGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.9, 2.6), toneMapped: false });

  const pcb = pcbTextures();
  pcb.map.anisotropy = maxAniso;
  const pcbMat = new THREE.MeshStandardMaterial({
    map: pcb.map,
    emissiveMap: pcb.emissive,
    emissive: 0xffffff,
    emissiveIntensity: 1.1,
    roughness: 0.45,
    metalness: 0.25,
  });
  const chipMat = new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.4, metalness: 0.5 });
  const chipTop = new THREE.MeshStandardMaterial({ map: chipTexture(), roughness: 0.3, metalness: 0.6 });

  /* ---- parts registry ---- */
  const parts = [];
  const byName = {};
  function part(name, center, cfg) {
    const outer = new THREE.Group();
    outer.name = name;
    outer.position.set(...center);
    const inner = new THREE.Group();
    outer.add(inner);
    root.add(outer);
    const p = {
      name,
      outer,
      inner,
      home: new THREE.Vector3(...center),
      target: new THREE.Vector3(...cfg.target),
      rot: new THREE.Euler(...(cfg.rot || [0, 0, 0])),
      start: cfg.start ?? 0,
      dur: cfg.dur ?? 0.55,
      anchor: new THREE.Vector3(...(cfg.anchor || [0, 0, 0])),
      side: cfg.side || 'right',
      title: cfg.title,
      text: cfg.text,
      tag: cfg.tag,
      e: 0,
    };
    parts.push(p);
    byName[name] = p;
    return p;
  }
  const add = (p, mesh, shadow = true) => {
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    p.inner.add(mesh);
    return mesh;
  };
  const meshOf = (geo, mat) => new THREE.Mesh(geo, mat);

  /* ============ LID ============ */
  {
    const p = part('lid', [0, 1.44, 0], {
      target: [0, 10.0, 0],
      rot: [0.0, -0.22, 0],
      start: 0.0,
      dur: 0.5,
      anchor: [1.3, 0.16, 0.78],
      side: 'right',
      tag: '01',
      title: 'Obsidian-glass lid',
      text: 'Gloss ceramic glass with laser-cut slots, hand polished for six hours by someone named Anders.',
    });
    const g = slab({
      w: W,
      d: D,
      h: 0.32,
      r: R,
      bevel: 0.07,
      holes: [
        { w: 2.0, d: 0.2, z: SLOT_Z },
        { w: 2.0, d: 0.2, z: -SLOT_Z },
      ],
      segs: 8,
    });
    g.translate(0, -0.16, 0);
    add(p, meshOf(g, lidMat));
    // chrome slot liners
    [SLOT_Z, -SLOT_Z].forEach((z) => {
      const liner = slab({
        w: 2.04,
        d: 0.24,
        h: 0.02,
        r: 0.12,
        bevel: 0.006,
        holes: [{ w: 1.98, d: 0.18, r: 0.09 }],
        segs: 2,
      });
      liner.translate(0, 0.152, z);
      add(p, meshOf(liner, alu), false);
    });
  }

  /* ============ CRUMB VISION ARRAY ============ */
  {
    const p = part('camera', [0, 1.2, 0], {
      target: [0, 8.55, 0],
      rot: [0, 0.16, 0],
      start: 0.04,
      dur: 0.5,
      anchor: [-0.95, 0, 0.16],
      side: 'left',
      tag: '02',
      title: 'Crumb Vision™ array',
      text: 'Four 12 MP hyperspectral sensors. Reads moisture, density and sugar in 14 ms. Judges nothing. Records everything.',
    });
    const barG = slab({ w: 1.9, d: 0.34, h: 0.14, r: 0.07, bevel: 0.025 });
    barG.translate(0, -0.07, 0);
    add(p, meshOf(barG, darkSteel));
    const strip = box(1.4, 0.012, 0.06, aiGlowMat, 0, 0.074, 0);
    add(p, strip, false);
    [-1, 1].forEach((sz) => {
      [-0.55, 0.55].forEach((x) => {
        const barrel = cyl(0.068, 0.07, black, x, 0, sz * 0.19, 'z');
        add(p, barrel);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.052, 0.066, 40), aiGlowMat);
        ring.position.set(x, 0, sz * (0.19 + 0.036));
        if (sz < 0) ring.rotation.y = Math.PI;
        add(p, ring, false);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 40), glassDark);
        lens.position.set(x, 0, sz * (0.19 + 0.037));
        if (sz < 0) lens.rotation.y = Math.PI;
        add(p, lens, false);
      });
    });
    // mounting ears
    [-0.9, 0.9].forEach((x) => add(p, box(0.1, 0.05, 0.5, steel, x, -0.04, 0)));
  }

  /* ============ SLEEVE (CHASSIS) ============ */
  {
    const p = part('sleeve', [0, 0.71, 0], {
      target: [0, 7.05, 0],
      rot: [0, 0.14, 0],
      start: 0.08,
      dur: 0.5,
      anchor: [1.5, 0.15, 0.3],
      side: 'right',
      tag: '03',
      title: 'Monocoque chassis',
      text: 'Milled from one block of 6063 aluminium. 11 hours of machining. 94% of the block becomes crumbs.',
    });
    const wall = 0.075;
    const g = slab({
      w: W,
      d: D,
      h: 1.14,
      r: R,
      bevel: 0.03,
      holes: [{ w: W - 2 * wall, d: D - 2 * wall, r: R - wall }],
      segs: 4,
    });
    g.translate(0, -0.57, 0);
    add(p, meshOf(g, bodyMat));
    // inner liner so interior reads dark
    const lg = slab({ w: W - 2 * wall + 0.002, d: D - 2 * wall + 0.002, h: 1.1, r: R - wall, bevel: 0.01, holes: [{ w: W - 2 * wall - 0.05, d: D - 2 * wall - 0.05, r: R - wall - 0.02 }], segs: 2 });
    lg.translate(0, -0.55, 0);
    add(p, meshOf(lg, black), false);
    // wordmark decal
    const markMat = new THREE.MeshBasicMaterial({
      map: labelTexture('MAILLARD', { w: 1024, h: 128, size: 54, spacing: 22, color: '#ffffff', weight: 500 }),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      toneMapped: false,
    });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.1375), markMat);
    mark.position.set(0, -0.36, D / 2 + 0.002);
    mark.userData.decal = true;
    p.inner.add(mark);
    p.markMat = markMat;
  }

  /* ============ DISPLAY ============ */
  const dispCanvas = makeCanvas(DW, DH);
  const dispCtx = dispCanvas.getContext('2d');
  const dispTex = new THREE.CanvasTexture(dispCanvas);
  dispTex.colorSpace = THREE.SRGBColorSpace;
  dispTex.anisotropy = maxAniso;
  const dispMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: dispTex,
    emissiveIntensity: 1.0,
    roughness: 0.08,
    metalness: 0.3,
  });
  {
    const p = part('display', [-0.28, 0.77, D / 2 + 0.006], {
      target: [-0.9, 6.5, 3.4],
      rot: [-0.1, 0.0, 0.0],
      start: 0.1,
      dur: 0.5,
      anchor: [-0.4, 0.15, 0.02],
      side: 'left',
      tag: '04',
      title: 'Maillard display',
      text: '1.3″ micro-OLED, 3,200 nits. Shows browning level, bread type and the occasional affirmation.',
    });
    const bezel = slab({ w: 1.26, d: 0.48, h: 0.02, r: 0.08, bevel: 0.006, segs: 3 });
    bezel.rotateX(Math.PI / 2);
    // slab is Y-up thickness; after rotateX it lies in XY with thickness along +z
    add(p, meshOf(bezel, black), false);
    const shape = new THREE.Shape();
    rrPath(shape, 1.18, 0.4, 0.06);
    const glassGeo = new THREE.ShapeGeometry(shape, 16);
    // map UVs 0..1
    const pos = glassGeo.attributes.position;
    const uv = glassGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.18 + 0.5, pos.getY(i) / 0.4 + 0.5);
    const glass = meshOf(glassGeo, dispMat);
    glass.position.z = 0.0215;
    add(p, glass, false);
    p.displayMesh = glass;
  }

  /* ============ SLIDER ============ */
  {
    const p = part('slider', [0.78, 0.74, D / 2 + 0.006], {
      target: [1.4, 6.3, 3.7],
      rot: [-0.1, 0.0, 0.0],
      start: 0.12,
      dur: 0.5,
      anchor: [0, 0.2, 0.06],
      side: 'right',
      tag: '04',
      title: 'Haptic slider',
      text: '',
    });
    const groove = slab({ w: 0.12, d: 0.78, h: 0.02, r: 0.06, bevel: 0.006, segs: 3 });
    groove.rotateX(Math.PI / 2);
    add(p, meshOf(groove, black), false);
    const kn = new THREE.Group();
    kn.add(cyl(0.09, 0.07, alu, 0, 0, 0.055, 'z', 48));
    const cap = cyl(0.062, 0.012, darkSteel, 0, 0, 0.096, 'z', 36);
    kn.add(cap);
    kn.children.forEach((c) => {
      c.castShadow = true;
    });
    p.knob = kn;
    p.inner.add(kn);
  }

  /* ============ TOAST ============ */
  const crustMat = new THREE.MeshStandardMaterial({ color: 0xa5702f, roughness: 0.85 });
  const toastTexA = toastFaceTexture('smile', 7);
  const toastTexB = toastFaceTexture('mark', 13);
  [toastTexA, toastTexB].forEach((t) => {
    t.repeat.set(1 / TOAST_W, 1 / TOAST_H);
    t.offset.set(0.5, 0);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });
  const faceMatA = new THREE.MeshStandardMaterial({ map: toastTexA, roughness: 0.92, bumpMap: toastTexA, bumpScale: 0.6 });
  const faceMatB = new THREE.MeshStandardMaterial({ map: toastTexB, roughness: 0.92, bumpMap: toastTexB, bumpScale: 0.6 });
  {
    const p = part('toast', [0, 1.0, 0], {
      target: [0, 5.45, 0],
      rot: [0, 0, 0.0],
      start: 0.14,
      dur: 0.5,
      anchor: [0.72, 0.2, 0.5],
      side: 'right',
      tag: '05',
      title: 'Bread (not included)',
      text: 'We tried to include it. Legal said no. Compatible with 340 varieties, most of which we have named.',
    });
    const makeSlice = (z, mats) => {
      const bevel = 0.04;
      const geo = new THREE.ExtrudeGeometry(breadShape(TOAST_W - 0.0, TOAST_H - bevel), {
        depth: TOAST_T - 2 * bevel,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 4,
        curveSegments: 20,
      });
      geo.translate(0, bevel / 2 - TOAST_H / 2, -(TOAST_T - 2 * bevel) / 2);
      const m = new THREE.Mesh(geo, mats);
      m.position.z = z;
      return m;
    };
    p.slices = [makeSlice(SLOT_Z, [faceMatA, crustMat]), makeSlice(-SLOT_Z, [faceMatB, crustMat])];
    p.slices.forEach((m) => add(p, m));
  }

  /* ============ CARRIAGE ============ */
  {
    const p = part('carriage', [0, 1.0, 0], {
      target: [0, 4.1, 0],
      rot: [0, -0.1, 0],
      start: 0.18,
      dur: 0.5,
      anchor: [0.86, -0.3, 0.42],
      side: 'left',
      tag: '06',
      title: 'Servo carriage',
      text: 'Dual-slot lift with 0.1 mm positioning. Lowers your bread like it is a sleeping infant.',
    });
    [SLOT_Z, -SLOT_Z].forEach((z) => {
      add(p, box(1.7, 0.03, 0.17, darkSteel, 0, -0.49, z));
      [-0.86, 0.86].forEach((x) => {
        add(p, box(0.035, 0.7, 0.1, steel, x, -0.14, z));
      });
    });
    add(p, box(0.04, 0.04, 2 * SLOT_Z + 0.12, steel, 0.86, -0.38, 0));
    add(p, box(0.04, 0.04, 2 * SLOT_Z + 0.12, steel, -0.86, -0.38, 0));
    add(p, box(0.05, 0.05, 0.5, darkSteel, 0.86, -0.3, SLOT_Z + 0.3));
  }

  /* ============ HEATING ELEMENTS ============ */
  {
    const p = part('elements', [0, 1.0, 0], {
      target: [0, 2.95, 0],
      rot: [0, 0.08, 0],
      start: 0.22,
      dur: 0.5,
      anchor: [0.95, 0.33, 0.66],
      side: 'right',
      tag: '07',
      title: 'Quad-zone element matrix',
      text: '2,400 W nichrome mesh across four independently driven zones. 8 ms thermal response. Mildly terrifying.',
    });
    // serpentine wire
    const rows = 14;
    const pts = [];
    const X = 0.86;
    const Y0 = -0.4;
    const dy = 0.8 / (rows - 1);
    for (let i = 0; i < rows; i++) {
      const y = Y0 + i * dy;
      const dir = i % 2 === 0 ? 1 : -1;
      const x0 = -X * dir;
      const x1 = X * dir;
      pts.push(new THREE.Vector3(x0, y, 0), new THREE.Vector3(x1, y, 0));
      if (i < rows - 1) {
        // U-turn
        for (let a = 1; a < 6; a++) {
          const th = (a / 6) * Math.PI;
          pts.push(new THREE.Vector3(x1 + dir * Math.sin(th) * dy * 0.5, y + (1 - Math.cos(th)) * dy * 0.5, 0));
        }
      }
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const wireGeo = new THREE.TubeGeometry(curve, 900, 0.0095, 6, false);
    p.panels = [];
    [-0.62, -0.22, 0.22, 0.62].forEach((zc) => {
      const g = new THREE.Group();
      g.position.z = zc;
      const mica = box(1.95, 0.94, 0.02, micaMat, 0, 0, 0);
      mica.castShadow = true;
      g.add(mica);
      const frame = box(2.0, 0.025, 0.04, darkSteel, 0, 0.47, 0);
      const frame2 = frame.clone();
      frame2.position.y = -0.47;
      g.add(frame, frame2);
      const side = zc > 0 ? -1 : 1;
      const dir = Math.sign(zc) * SLOT_Z - zc;
      const wire = new THREE.Mesh(wireGeo, wireMat);
      wire.position.z = Math.sign(dir) * 0.022;
      g.add(wire);
      g.userData.zc = zc;
      p.inner.add(g);
      p.panels.push(g);
    });
  }

  /* ============ PSU ============ */
  {
    const p = part('psu', [-0.8, 0.3, 0], {
      target: [-2.3, 1.85, 0.3],
      rot: [0.0, 0.22, 0.0],
      start: 0.28,
      dur: 0.5,
      anchor: [-0.5, 0.18, 0.5],
      side: 'left',
      tag: '08',
      title: 'GaN power core',
      text: '1,800 W gallium-nitride supply at 96.2% efficiency. Quiet, except in the one scenario we cannot discuss.',
    });
    const caseG = slab({ w: 1.3, d: 1.05, h: 0.14, r: 0.07, bevel: 0.02 });
    caseG.translate(0, -0.07, 0);
    add(p, meshOf(caseG, darkSteel));
    for (let i = 0; i < 12; i++) add(p, box(0.04, 0.035, 0.7, steel, -0.56 + i * 0.045, 0.082, -0.1));
    [-0.1, 0.05, 0.2].forEach((x, i) => {
      add(p, cyl(0.075, 0.13, black, 0.38 + (i % 2) * 0.0 + 0.0, 0.14, -0.3 + i * 0.28, 'y', 28));
      add(p, cyl(0.062, 0.004, gold, 0.38, 0.206, -0.3 + i * 0.28, 'y', 28), false);
    });
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 20, 48), copper);
    tor.rotation.x = Math.PI / 2;
    tor.position.set(-0.28, 0.12, 0.3);
    add(p, tor);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23), new THREE.MeshStandardMaterial({ map: psuLabelTexture(), roughness: 0.6 }));
    lab.rotation.x = -Math.PI / 2;
    lab.position.set(-0.28, 0.088, -0.28);
    lab.rotation.z = Math.PI / 2;
    lab.scale.set(0.9, 0.9, 0.9);
    add(p, lab, false);
  }

  /* ============ NEURAL CORE ============ */
  {
    const p = part('core', [0.8, 0.26, 0], {
      target: [2.3, 1.85, 0.3],
      rot: [0.0, -0.22, 0.0],
      start: 0.28,
      dur: 0.5,
      anchor: [0.5, 0.06, 0.5],
      side: 'right',
      tag: '09',
      title: 'Neural Browning Engine',
      text: 'M1-N silicon: 4.2 B parameters, 38 TOPS, entirely on-device. Trained on 11 million slices. It has opinions.',
    });
    const board = box(1.3, 0.04, 1.05, pcbMat, 0, 0, 0);
    // box UVs: top face uses full 0..1 → good
    add(p, board);
    add(p, box(0.46, 0.03, 0.46, steel, 0, 0.035, 0.0));
    const chip = box(0.4, 0.075, 0.4, chipTop, 0, 0.0875, 0);
    chip.material = [chipMat, chipMat, chipTop, chipMat, chipMat, chipMat];
    add(p, chip);
    // memory + misc packages
    const r = rng(21);
    [
      [-0.46, -0.34],
      [0.46, -0.34],
      [-0.46, 0.34],
      [0.46, 0.34],
    ].forEach(([x, z]) => add(p, box(0.22, 0.045, 0.22, chipMat, x, 0.042, z)));
    for (let i = 0; i < 22; i++) {
      const x = -0.58 + r() * 1.16;
      const z = -0.46 + r() * 0.92;
      if (Math.abs(x) < 0.28 && Math.abs(z) < 0.28) continue;
      add(p, box(0.04 + r() * 0.04, 0.025, 0.025, i % 3 ? black : gold, x, 0.03, z), false);
    }
    // edge connector
    for (let i = 0; i < 16; i++) add(p, box(0.022, 0.006, 0.07, gold, -0.35 + i * 0.047, 0.023, 0.5), false);
    add(p, box(0.8, 0.025, 0.05, black, 0, 0.032, 0.5), false);
  }

  /* ============ TRAY ============ */
  {
    const p = part('tray', [0, 0.175, 0], {
      target: [0, 0.95, 0.15],
      rot: [0, 0, 0],
      start: 0.32,
      dur: 0.5,
      anchor: [-1.0, 0.0, 0.62],
      side: 'left',
      tag: '10',
      title: 'Crumb tray',
      text: 'Self-diagnosing. Notifies your phone when full, and, we suspect, your mother.',
    });
    const g = slab({ w: 2.7, d: 1.4, h: 0.035, r: 0.35, bevel: 0.012, segs: 3 });
    g.translate(0, -0.0175, 0);
    add(p, meshOf(g, steel));
    const rim = slab({ w: 2.7, d: 1.4, h: 0.07, r: 0.35, bevel: 0.012, holes: [{ w: 2.58, d: 1.28, r: 0.28 }], segs: 3 });
    rim.translate(0, -0.0175, 0);
    add(p, meshOf(rim, steel));
    add(p, box(0.6, 0.03, 0.1, alu, 0, 0, 0.72));
  }

  /* ============ BASE ============ */
  {
    const p = part('base', [0, 0.07, 0], {
      target: [0, 0.07, 0],
      start: 0,
      dur: 0.01,
      anchor: [1.2, 0.05, 0.62],
      side: 'right',
      tag: '11',
      title: 'Halo base',
      text: 'Twelve-LED ambient halo. Pulses softly when it is thinking. Please do not ask what about.',
    });
    const g = slab({ w: 2.9, d: 1.5, h: 0.14, r: 0.45, bevel: 0.04, segs: 4 });
    g.translate(0, -0.07, 0);
    add(p, meshOf(g, black));
    const ring = slab({ w: 3.04, d: 1.64, h: 0.03, r: 0.5, bevel: 0.006, holes: [{ w: 2.96, d: 1.56, r: 0.46 }], segs: 2 });
    ring.translate(0, 0.055, 0);
    const halo = meshOf(ring, haloMat);
    p.inner.add(halo);
    p.halo = halo;
    [-1.05, 1.05].forEach((x) => [-0.5, 0.5].forEach((z) => add(p, cyl(0.1, 0.07, rubber, x, -0.105, z, 'y', 24))));
  }

  /* ---------------------------------------------------------------- */
  /*  State                                                            */
  /* ---------------------------------------------------------------- */
  const state = {
    explode: 0,
    pop: 0, // 0 = toast down, 1 = popped
    heat: 0, // glow of elements
    level: 0, // toast browning 0..1
    halo: 1,
    display: { mode: 'greet', time: 0 },
  };
  let lastDisp = '';
  let dispT = 0;

  const toastDown = 1.0; // centre y when lowered
  const toastUp = 1.56;

  const tmpV = new THREE.Vector3();
  const pale = new THREE.Color(0xe9d9b7);
  const golden = new THREE.Color(0xf0b45e);
  const brown = new THREE.Color(0xa05a22);
  const burnt = new THREE.Color(0x3a1d0c);
  const tint = new THREE.Color();
  const wireOff = new THREE.Color(0x3a1608);
  const wireOn = new THREE.Color(0xff5412);

  function apply(time, dt) {
    const p = state.explode;
    const pop = state.pop;
    const popY = lerp(toastDown, toastUp, easeOutBack(clamp01(pop), 1.1));
    const popDelta = popY - toastDown;

    parts.forEach((pt) => {
      const e = easeInOut(clamp01((p - pt.start) / pt.dur));
      pt.e = e;
      pt.outer.position.lerpVectors(pt.home, pt.target, e);
      pt.outer.rotation.set(pt.rot.x * e, pt.rot.y * e, pt.rot.z * e);
      // subtle float when exploded
      if (e > 0.99) pt.outer.position.y += Math.sin(time * 0.9 + pt.start * 20) * 0.025;
    });

    // pop animation lives on inner groups so it composes with the explosion
    byName.toast.inner.position.y = popDelta;
    byName.carriage.inner.position.y = popDelta;
    byName.slider.knob.position.y = lerp(-0.2, 0.2, clamp01(pop));

    // sleeve-wordmark visible only while assembled-ish
    byName.sleeve.markMat.opacity = 0.55;

    // panel spread
    const pe = byName.elements.e;
    byName.elements.panels.forEach((g) => {
      g.position.z = g.userData.zc * (1 + pe * 1.35);
      g.rotation.y = 0;
    });

    // toast browning
    const L = state.level;
    if (L < 0.5) tint.copy(pale).lerp(golden, L / 0.5);
    else if (L < 0.85) tint.copy(golden).lerp(brown, (L - 0.5) / 0.35);
    else tint.copy(brown).lerp(burnt, (L - 0.85) / 0.15);
    faceMatA.color.copy(tint);
    faceMatB.color.copy(tint);
    crustMat.color.setRGB(0.42, 0.24, 0.09).lerp(new THREE.Color(0x3d2108), L * 0.5);

    // heat
    const h = state.heat;
    wireMat.emissiveIntensity = 0.08 + h * 3.4;
    wireMat.color.copy(wireOff).lerp(wireOn, h);

    // halo breathing
    const hb = state.halo * (0.75 + 0.25 * Math.sin(time * 1.8));
    haloMat.color.setRGB(1.6 * hb, 1.15 * hb, 0.8 * hb);

    // display
    dispT += dt;
    const d = state.display;
    d.time = time;
    const key = d.mode + '|' + (d.title || '') + '|' + (d.clock || '') + '|' + (d.level ? d.level.toFixed(1) : '') + '|' + (d.progress ? d.progress.toFixed(2) : '');
    const animated = d.mode === 'idle' || d.mode === 'greet' || d.mode === 'scan';
    if ((animated && dispT > 1 / 24) || (!animated && key !== lastDisp)) {
      dispT = 0;
      lastDisp = key;
      drawDisplay(dispCtx, d);
      dispTex.needsUpdate = true;
    }
  }

  function setColorway(key) {
    const c = COLORWAYS[key] || COLORWAYS.titanium;
    bodyMat.color.setHex(c.body);
    bodyMat.metalness = c.metal;
    bodyMat.roughness = c.rough;
    if (c.brushed) {
      bodyMat.roughnessMap = brushed;
      bodyMat.bumpMap = brushed;
      bodyMat.bumpScale = 0.35;
    } else {
      bodyMat.roughnessMap = grain;
      bodyMat.bumpMap = grain;
      bodyMat.bumpScale = 0.12;
    }
    bodyMat.clearcoat = key === 'oat' ? 0.35 : 0;
    bodyMat.clearcoatRoughness = 0.4;
    bodyMat.needsUpdate = true;
    // wordmark contrast
    byName.sleeve.markMat.color.set(key === 'oat' || key === 'titanium' ? 0x1a1a1d : 0xffffff);
    return c;
  }
  setColorway('titanium');

  /** Project a part's anchor to NDC for label placement */
  function anchorWorld(pt, out = new THREE.Vector3()) {
    out.copy(pt.anchor);
    pt.outer.updateWorldMatrix(true, false);
    return pt.outer.localToWorld(out);
  }

  return { root, parts, byName, state, apply, setColorway, anchorWorld, COLORWAYS, lidMat };
}
