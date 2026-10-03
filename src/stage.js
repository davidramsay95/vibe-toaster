import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildToaster, COLORWAYS } from './toaster.js';
import { radialTexture, rng } from './textures.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Photographic-studio environment for PBR reflections (strip lights & softboxes) */
function buildStudioEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(40, 22, 40), new THREE.MeshBasicMaterial({ color: 0x0a0b0e, side: THREE.BackSide })));
  const panel = (w, h, pos, intensity, tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity * tint[0], intensity * tint[1], intensity * tint[2]), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(0, 1, 0);
    s.add(m);
  };
  panel(16, 9, [0, 10.5, 1], 3.2, [1, 0.98, 0.95]); // top softbox
  panel(2.4, 13, [-11, 3, 3], 3.6, [0.85, 0.93, 1]); // left cool strip
  panel(2.4, 13, [11, 3, -2], 4.2, [1, 0.88, 0.75]); // right warm strip
  panel(18, 3.5, [0, 3, -14], 1.8, [1, 1, 1]); // back kicker
  panel(14, 3, [0, 0.5, 14], 0.9, [1, 0.97, 0.94]); // front fill
  panel(30, 30, [0, -9, 0], 0.2, [1, 1, 1]); // ground bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.015);
  pm.dispose();
  return rt.texture;
}

const CRUMB_VS = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  attribute float aSize;
  attribute float aPhase;
  varying float vA;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.25 + aPhase * 6.28) * 0.6;
    p.y += sin(uTime * 0.18 + aPhase * 12.0) * 0.5 + mod(uTime * 0.05 * (0.4 + aPhase), 1.0) * 0.0;
    p.z += cos(uTime * 0.2 + aPhase * 9.0) * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.2 + aPhase * 30.0));
  }
`;
const CRUMB_FS = /* glsl */ `
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * 1.4, a * a * vA * 0.3);
  }
`;

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = 0;
    this.running = true;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.quality = 1;
    this.fpsAcc = 0;
    this.fpsN = 0;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true });
    this.renderer = renderer;
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.bg = new THREE.Color(0x0a0b0d);
    this.scene.background = this.bg.clone();
    this.scene.fog = new THREE.Fog(this.bg.clone(), 30, 70);
    this.scene.environment = buildStudioEnv(renderer);
    this.scene.environmentIntensity = 0.85;
    this.envTex = this.scene.environment;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

    // lights
    const key = new THREE.DirectionalLight(0xfff1e0, 1.5);
    key.position.set(4, 15, 6);
    key.target.position.set(0, 3, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 8;
    sc.bottom = -8;
    sc.near = 1;
    sc.far = 40;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 5;
    this.scene.add(key, key.target);
    this.key = key;

    const rim = new THREE.DirectionalLight(0x9fd6ff, 0.35);
    rim.position.set(-8, 5, -8);
    this.scene.add(rim);

    // toaster
    this.toaster = buildToaster({ maxAniso: renderer.capabilities.getMaxAnisotropy() });
    this.scene.add(this.toaster.root);
    this.toaster.lidMat.envMap = this.envTex;

    // slot glow lights (heat)
    this.slotLights = [0.42, -0.42].map((z) => {
      const l = new THREE.PointLight(0xff6a2a, 0, 3.2, 1.6);
      l.position.set(0, 1.15, z);
      this.toaster.root.add(l);
      return l;
    });
    // halo light (under toaster)
    this.haloLight = new THREE.PointLight(0xffc89a, 1.2, 6, 1.8);
    this.haloLight.position.set(0, 0.3, 0);
    this.toaster.root.add(this.haloLight);

    // floor
    const floorAlpha = radialTexture([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,0.75)'], [1, 'rgba(0,0,0,1)']], 512);
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(26, 96),
      new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.78, metalness: 0.0, transparent: true, alphaMap: floorAlpha, envMapIntensity: 0.12 })
    );
    this.floor.material.envMap = this.envTex;
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.071;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // ground glow pool
    const glowTex = radialTexture([[0, 'rgba(255,190,130,0.55)'], [0.4, 'rgba(255,150,80,0.16)'], [1, 'rgba(255,120,40,0)']], 512);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.5 }));
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = -0.06;
    this.scene.add(this.pool);

    // crumbs
    this.crumbs = this.makeCrumbs();
    this.scene.add(this.crumbs);

    // post
    this.makeComposer();

    // state
    const defaults = { az: 0, el: 0.2, dist: 8, tx: 0, ty: 0.85, shift: 0, shiftY: 0, fit: 1, spin: -0.5, explode: 0, pop: 0, heat: 0, level: 0, halo: 1, tilt: 0 };
    this.target = { ...defaults };
    this.cur = { ...defaults };
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.userSpin = 0;
    this.display = { mode: 'greet' };
    this.mood = new THREE.Color(0x0a0b0d);
    this.moodTarget = new THREE.Color(0x0a0b0d);
    this.resize();
  }

  makeCrumbs() {
    const N = 380;
    const r = rng(99);
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (r() - 0.5) * 34;
      pos[i * 3 + 1] = -0.5 + r() * 16;
      pos[i * 3 + 2] = -14 + r() * 24;
      size[i] = 0.5 + Math.pow(r(), 4) * 2.4;
      phase[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.crumbMat = new THREE.ShaderMaterial({
      vertexShader: CRUMB_VS,
      fragmentShader: CRUMB_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    });
    const pts = new THREE.Points(g, this.crumbMat);
    pts.frustumCulled = false;
    return pts;
  }

  makeComposer() {
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.5, 1.5);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(this.pixelRatio * this.quality);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio * this.quality);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.crumbMat.uniforms.uScale.value = h * this.pixelRatio * this.quality * 0.32;
  }

  setPointer(nx, ny) {
    this.pointer.x = nx;
    this.pointer.y = ny;
  }

  /** Hard-set the current state to target (no smoothing) – used for stills */
  snap() {
    Object.assign(this.cur, this.target);
    this.moodTarget.copy(this.mood);
  }

  setColorway(key) {
    const c = this.toaster.setColorway(key);
    this.moodTarget.setHex(c.bg);
    return c;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const c = this.cur;
    const g = this.target;
    const k = 5.5;
    for (const key of ['az', 'el', 'dist', 'tx', 'ty', 'shift', 'shiftY', 'fit', 'spin', 'explode', 'halo', 'tilt']) c[key] = damp(c[key], g[key], key === 'explode' ? 7 : k, dt);
    // timeline-controlled values are applied directly
    c.pop = g.pop;
    c.heat = g.heat;
    c.level = g.level;

    this.pointer.sx = damp(this.pointer.sx, this.pointer.x, 3, dt);
    this.pointer.sy = damp(this.pointer.sy, this.pointer.y, 3, dt);

    // mood (background) tint
    this.mood.lerp(this.moodTarget, 1 - Math.exp(-3 * dt));
    this.scene.background.copy(this.mood);
    this.scene.fog.color.copy(this.mood);

    // toaster state
    const ts = this.toaster.state;
    ts.explode = c.explode;
    ts.pop = c.pop;
    ts.heat = c.heat;
    ts.level = c.level;
    ts.halo = c.halo;
    ts.display = this.display;
    this.toaster.apply(t, dt);
    this.toaster.root.rotation.y = c.spin + this.userSpin + this.pointer.sx * 0.14;
    this.toaster.root.rotation.x = c.tilt;

    // lights & glow tied to heat/halo
    this.slotLights.forEach((l) => (l.intensity = c.heat * 3.2 * (1 - c.explode * 0.8)));
    this.haloLight.intensity = 0.9 * c.halo * (1 - c.explode * 0.5);
    this.pool.material.opacity = 0.1 + 0.12 * c.halo + c.heat * 0.15;
    this.pool.scale.setScalar(1 + c.explode * 0.5);

    // camera rig
    const aspect = this.camera.aspect;
    const dist = c.dist * (aspect < 1.1 ? 1 + (1.1 - aspect) * 1.05 * c.fit : 1);
    const az = c.az + this.pointer.sx * 0.05;
    const el = c.el - this.pointer.sy * 0.025;
    this.camera.position.set(
      c.tx + Math.sin(az) * Math.cos(el) * dist,
      c.ty + Math.sin(el) * dist,
      Math.cos(az) * Math.cos(el) * dist
    );
    this.camera.lookAt(c.tx, c.ty, 0);
    const shift = aspect < 1.1 ? 0 : c.shift;
    if (Math.abs(shift) > 1e-4 || Math.abs(c.shiftY) > 1e-4) this.camera.setViewOffset(this.w, this.h, -shift * this.w, -c.shiftY * this.h, this.w, this.h);
    else this.camera.clearViewOffset();

    this.crumbMat.uniforms.uTime.value = t;
    this.crumbs.position.y = -c.ty * 0.2;
    this.crumbs.rotation.y = c.spin * 0.15;
  }

  render() {
    this.composer.render();
  }

  /** Adaptive resolution: drop DPR if we can't hold ~45fps */
  perf(dt) {
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 2.5) {
      const fps = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsN = 0;
      if (fps < 40 && this.quality > 0.55) {
        this.quality = Math.max(0.55, this.quality - 0.2);
        this.resize();
      }
    }
  }

  /** Screen-space position of a part's anchor, in CSS px */
  project(part, out = { x: 0, y: 0, z: 0 }) {
    const v = this.toaster.anchorWorld(part, this._v || (this._v = new THREE.Vector3()));
    this.camera.updateMatrixWorld();
    v.project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.w;
    out.y = (-v.y * 0.5 + 0.5) * this.h;
    out.z = v.z;
    return out;
  }
}

export { COLORWAYS };
