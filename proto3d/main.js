// 準時下班防衛戰｜3D 微縮場景樣張
// 夜裡加班的辦公室浮島：像素同事站在 3D 場景裡，檯燈是主角。
// 後製流程（半解析度 → 環境遮蔽與光霧 → 移軸景深 → 泛光 → 抖色 → 放大加顆粒）
// 做法參考 Cinderwatch（MIT，kevintngo/cinderwatch），程式為本專案自寫。
import * as THREE from 'three';
import { makePost } from './post.js';
import { buildOffice, W } from './office.js';
import { makeChar, pose, faceTo, CAST } from './chars.js';

const Q = new URLSearchParams((location.hash || location.search).slice(1));
const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const RAD = Math.PI / 180;
const cam0 = { yaw: num('yaw', 18) * RAD, pitch: num('pitch', 34) * RAD, fit: num('fit', 35) };
let yaw = cam0.yaw;
const USE3D = Q.get('chars') !== 'spr';
const PITCH = cam0.pitch, STRETCH = 1 / Math.cos(PITCH), PPU = 40;
const TARGET = new THREE.Vector3(num('tx', 2.7), 0.6, num('tz', -1.5));

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(new THREE.Color(0.0035, 0.005, 0.012), 1);
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
scene.add(cam);
const post = makePost(renderer, scene, cam);

function placeCam() {
  const D = 90, cp = Math.cos(PITCH);
  cam.position.set(TARGET.x + Math.sin(yaw) * cp * D, TARGET.y + Math.sin(PITCH) * D, TARGET.z + Math.cos(yaw) * cp * D);
  cam.lookAt(TARGET); cam.updateMatrixWorld();
  post.focusDist = D;
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const dw = Math.max(8, Math.floor(innerWidth * dpr)), dh = Math.max(8, Math.floor(innerHeight * dpr));
  const viewH = cam0.fit * dh / dw;
  cam.left = -cam0.fit / 2; cam.right = cam0.fit / 2; cam.top = viewH / 2; cam.bottom = -viewH / 2; cam.updateProjectionMatrix();
  let iw = Math.round(cam0.fit * PPU), ih = Math.round(viewH * PPU);
  const k = Math.min(1, dw / iw, 1500 / iw) * num('q', 1);
  iw = Math.max(8, Math.round(iw * k)); ih = Math.max(8, Math.round(ih * k));
  post.resize(dw, dh, iw, ih);
}

// ── 場景 ──
const office = buildOffice(scene, num('seed', 7));
const pathPts = office.path.map(p => new THREE.Vector3(p[0], 0, p[1]));
const segLen = []; let pathLen = 0;
for (let i = 1; i < pathPts.length; i++) { const l = pathPts[i].distanceTo(pathPts[i - 1]); segLen.push(l); pathLen += l; }
function pathAt(d, out, dir) {
  let i = 0; while (i < segLen.length - 1 && d > segLen[i]) { d -= segLen[i]; i++; }
  const a = pathPts[i], b = pathPts[i + 1], t = Math.min(1, Math.max(0, d / segLen[i]));
  out.lerpVectors(a, b, t); if (dir) dir.subVectors(b, a).normalize();
}

// ── 像素小人：直立的面板，永遠正對鏡頭水平方向，高度拉長抵消俯角 ──
const IMG = {}, META = {};
const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const TEX = {};
function tex(key) {
  if (TEX[key] !== undefined) return TEX[key];
  const im = IMG[key]; if (!im) return (TEX[key] = null);
  const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return (TEX[key] = t);
}
const blobGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
class Spr {
  constructor(id, size = 1) {
    this.id = id; const m = this.meta = META[id]; const [cw, ch] = m.cell, [fx, fy] = m.foot, s = size / PPU;
    const x0 = -fx * s, x1 = (cw - fx) * s, y0 = -(ch - fy) * s * STRETCH, y1 = fy * s * STRETCH;
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0]), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, .8, .6, 0, .8, .6, 0, .8, .6, 0, .8, .6]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(8), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.mat = new THREE.MeshLambertMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.16 });
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.customDepthMaterial = this.dmat; this.mesh.castShadow = true;
    this.blob = new THREE.Mesh(blobGeo, blobMat); this.blob.scale.set(cw * s * 0.2, 1, cw * s * 0.11); this.blob.renderOrder = 2;
    this.g = new THREE.Group(); this.g.add(this.mesh, this.blob); this.blob.position.y = 0.03; scene.add(this.g);
    this.key = '';
  }
  set(anim, dir, flip, frame) {
    let key = `${this.id}_${anim}_${dir}`;
    if (!IMG[key]) key = `${this.id}_${anim}_${dir === 'dside' || dir === 'uside' ? 'side' : 'down'}`;
    const t = tex(key); if (!t) return;
    if (key !== this.key) { this.key = key; this.mat.map = t; this.mat.emissiveMap = t; this.dmat.map = t; this.mat.needsUpdate = true; this.dmat.needsUpdate = true; }
    const n = Math.max(1, Math.round(t.image.width / this.meta.cell[0])), f = frame % n;
    let u0 = f / n, u1 = (f + 1) / n; if (flip) [u0, u1] = [u1, u0];
    const uv = this.geo.attributes.uv; uv.setXY(0, u0, 0); uv.setXY(1, u1, 0); uv.setXY(2, u1, 1); uv.setXY(3, u0, 1); uv.needsUpdate = true;
  }
  place(x, z) { this.g.position.set(x, 0, z); this.mesh.rotation.y = yaw; }
  act(mode, dx, dz, ph, p) {
    const a = screenAngle(dx, dz), [dir, flip] = mode === 'walk' ? dir4(a) : dir8(a);
    this.set(mode, dir, flip, mode === 'atk' ? Math.min(7, Math.floor(p * 8)) : Math.floor(ph));
  }
  flash(v) { this.mat.emissiveIntensity = 0.16 + v * 9; }
  dispose() { scene.remove(this.g); this.geo.dispose(); this.mat.dispose(); this.dmat.dispose(); }
}
// 3D 方塊小人：真的會轉身、被燈照亮、有影子
class Fig {
  constructor(id) {
    this.c = makeChar(CAST[id]); this.g = this.c.root; const k = (CAST[id].scale || 1) * (CAST[id].fat || 1);
    this.blob = new THREE.Mesh(blobGeo, blobMat); this.blob.scale.set(.52 * k, 1, .4 * k); this.blob.position.y = .03; this.blob.renderOrder = 2;
    this.w = new THREE.Group(); this.w.add(this.g, this.blob); scene.add(this.w);
  }
  place(x, z) { this.w.position.set(x, 0, z); }
  act(mode, dx, dz, ph, p, dt) { faceTo(this.c, Math.atan2(dx, dz), dt, mode === 'walk' ? 9 : 14); pose(this.c, mode, mode === 'walk' ? ph * .8 : ph / 5, p); }
  flash(v) { this.c.mat.emissive.setScalar(v * 6); }
  dispose() { scene.remove(this.w); this.w.traverse(o => { if (o.isMesh && o !== this.blob) o.geometry.dispose(); }); this.c.mat.dispose(); }
}
const mkUnit = id => (USE3D && CAST[id] ? new Fig(id) : new Spr(id));
// 世界方向 → 畫面方向 → 用哪一張圖
function screenAngle(dx, dz) { const sx = dx * Math.cos(yaw) - dz * Math.sin(yaw), sy = dx * Math.sin(yaw) + dz * Math.cos(yaw); return Math.atan2(sy, sx); }
const DIR8 = [['side', 0], ['dside', 0], ['down', 0], ['dside', 1], ['side', 1], ['uside', 1], ['up', 0], ['uside', 0]];
const dir8 = a => DIR8[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
function dir4(a) { const d = a / RAD; if (d > 50 && d < 130) return ['down', 0]; if (d < -50 && d > -130) return ['up', 0]; return ['side', Math.abs(d) > 90 ? 1 : 0]; }

// ── 粒子：光裡的灰塵、火花 ──
const NP = 700, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP), pBase = new Float32Array(NP * 3);
const NDUST = 380; let sparkI = NDUST;
const rnd = (() => { let s = 99; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
for (let i = 0; i < NDUST; i++) { pPos[i * 3] = office.bounds.x0 + rnd() * (office.bounds.x1 - office.bounds.x0); pPos[i * 3 + 1] = 0.3 + rnd() * 2.6; pPos[i * 3 + 2] = office.bounds.z0 + rnd() * (office.bounds.z1 - office.bounds.z0); pLife[i] = rnd() * 6.28; }
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
points.frustumCulled = false; scene.add(points);
function spark(x, y, z, col, n, sp = 3) {
  for (let k = 0; k < n; k++) {
    const i = sparkI; sparkI = sparkI + 1 >= NP ? NDUST : sparkI + 1;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    const a = rnd() * 6.28, u = rnd() * 2 - .3, v = sp * (.4 + rnd());
    pVel[i * 3] = Math.cos(a) * v; pVel[i * 3 + 1] = u * v + 1.5; pVel[i * 3 + 2] = Math.sin(a) * v;
    pBase[i * 3] = col[0]; pBase[i * 3 + 1] = col[1]; pBase[i * 3 + 2] = col[2]; pLife[i] = .35 + rnd() * .35;
  }
}

// ── 會動的光：出手的光彈、命中的閃光 ──
const dyn = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 7, 2); scene.add(l); dyn.push({ l, t: 0, dur: 1, peak: 0 }); }
let dynI = 0;
function flash(x, y, z, col, peak, dur) { const d = dyn[dynI++ % dyn.length]; d.l.position.set(x, y, z); d.l.color.setRGB(col[0], col[1], col[2]); d.peak = peak; d.dur = dur; d.t = dur; }
const boltGeo = new THREE.BoxGeometry(.16, .16, .16);
const bolts = [];

// ── 樣張用的簡單戰況（正式版會接 core.js）──
const HEROES = [['kui', 0, [3.2, 1.9, 0.7]], ['jie', 2, [0.6, 1.9, 3.2]], ['kevin', 4, [3.0, 1.2, 0.4]], ['yan', 5, [2.4, 0.7, 3.0]], ['zhe', 7, [0.7, 2.8, 1.5]], ['mi', 8, [3.2, 2.4, 0.8]], ['vivi', 10, [3.0, 0.8, 1.8]]];
const FOES = ['foe_minion', 'foe_courier', 'foe_intern', 'foe_minion', 'foe_knight', 'foe_clerk', 'foe_auntie', 'foe_minion', 'foe_ghost', 'foe_cart', 'foe_patcher', 'foe_chief'];
const heroes = [], foes = [];
let spawnT = 0, spawnN = 0, T = 0;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

function stepWorld(dt) {
  T += dt;
  spawnT -= dt;
  if (spawnT <= 0) {
    const id = FOES[spawnN++ % FOES.length]; spawnT = id === 'foe_chief' ? 2.4 : 1.15;
    if (META[id]) foes.push({ s: mkUnit(id), d: 0, sp: id === 'foe_courier' ? 2.6 : id === 'foe_chief' ? 1.1 : 1.6, hp: id === 'foe_chief' ? 16 : id === 'foe_knight' ? 7 : 4, hit: 0, ph: rnd() * 8 });
  }
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i]; f.d += f.sp * dt; f.hit = Math.max(0, f.hit - dt);
    if (f.d >= pathLen || f.hp <= 0) { if (f.hp <= 0) spark(f.s.g.position.x, .9, f.s.g.position.z, [1.6, 1.4, 1.0], 14, 2.6); f.s.dispose(); foes.splice(i, 1); continue; }
    pathAt(f.d, v1, v2); f.x = v1.x; f.z = v1.z;
    f.s.act('walk', v2.x, v2.z, f.ph + T * 6.2 * f.sp, 0, dt); f.s.place(v1.x, v1.z); f.s.flash(f.hit);
  }
  for (const h of heroes) {
    let best = null, bd = 5.6 * 5.6;
    for (const f of foes) { const dx = f.x - h.x, dz = f.z - h.z, dd = dx * dx + dz * dz; if (dd < bd && f.d > 1.2) { bd = dd; best = f; } }
    if (best) { h.dx = best.x - h.x; h.dz = best.z - h.z; }
    h.cd -= dt;
    if (h.atk < 0 && best && h.cd <= 0) { h.atk = 0; h.fired = false; h.tgt = best; h.cd = 1.5 + rnd() * .9; }
    if (h.atk >= 0) {
      h.atk += dt * 1000; const pr = h.atk / 600;
      if (pr >= .5 && !h.fired) {
        h.fired = true; const m = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(h.col[0] * 3, h.col[1] * 3, h.col[2] * 3) })); scene.add(m);
        bolts.push({ m, x: h.x, y: 1.5, z: h.z, tgt: h.tgt, col: h.col }); flash(h.x, 1.6, h.z + .3, h.col, 9, .16);
      }
      if (pr >= 1) { h.atk = -1; h.rest = .5; } else h.s.act('atk', h.dx, h.dz, 0, pr, dt);
    }
    if (h.atk < 0) { h.rest = Math.max(0, (h.rest || 0) - dt); const fr = USE3D && h.rest <= 0; h.s.act('idle', fr ? Math.sin(yaw + .25) : h.dx, fr ? Math.cos(yaw + .25) : h.dz, T * 5 + h.ph, 0, dt * (fr ? .45 : 1)); }
    h.s.place(h.x, h.z);
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i], f = b.tgt, tx = f.x ?? b.x, tz = f.z ?? b.z;
    const dx = tx - b.x, dy = .9 - b.y, dz = tz - b.z, d = Math.hypot(dx, dy, dz), st = 17 * dt;
    if (d <= st || f.hp <= 0) {
      if (f.hp > 0) { f.hp--; f.hit = .1; }
      flash(tx, 1.1, tz, b.col, 16, .22); spark(tx, 1, tz, b.col, 9); scene.remove(b.m); b.m.material.dispose(); bolts.splice(i, 1); continue;
    }
    b.x += dx / d * st; b.y += dy / d * st; b.z += dz / d * st; b.m.position.set(b.x, b.y, b.z); b.m.rotation.set(T * 9, T * 7, 0);
    if (rnd() < .6) spark(b.x, b.y, b.z, [b.col[0] * .5, b.col[1] * .5, b.col[2] * .5], 1, .5);
  }
  for (const d of dyn) { d.t = Math.max(0, d.t - dt); d.l.intensity = d.peak * (d.t / d.dur) ** 2; }
  // 檯燈輕微閃動、打卡機呼吸
  for (const L of office.lamps) L.light.intensity = L.base * (1 + .05 * Math.sin(T * 13 + L.ph) + .03 * Math.sin(T * 31 + L.ph * 2));
  office.clockLight.intensity = office.clockBase * (1 + .25 * Math.sin(T * 2.4));
  // 灰塵：只有飄進光裡才看得見
  const LP = office.lamps;
  for (let i = 0; i < NDUST; i++) {
    const j = i * 3; pLife[i] += dt * .5;
    pPos[j] += Math.sin(pLife[i] * 1.3 + i) * .06 * dt + .05 * dt; pPos[j + 1] += Math.cos(pLife[i] + i * .7) * .05 * dt; pPos[j + 2] += Math.sin(pLife[i] * .8 + i * 1.9) * .05 * dt;
    if (pPos[j] > office.bounds.x1) pPos[j] = office.bounds.x0;
    let r = 0, g = 0, b = 0;
    for (const L of LP) { const dx = L.x - pPos[j], dy = L.y - pPos[j + 1], dz = L.z - pPos[j + 2], a = L.k / (dx * dx + dy * dy + dz * dz + .5); r += L.c[0] * a; g += L.c[1] * a; b += L.c[2] * a; }
    pCol[j] = Math.min(r, 1.6); pCol[j + 1] = Math.min(g, 1.6); pCol[j + 2] = Math.min(b, 1.6);
  }
  for (let i = NDUST; i < NP; i++) {
    const j = i * 3; if (pLife[i] <= 0) { pCol[j] = pCol[j + 1] = pCol[j + 2] = 0; continue; }
    pLife[i] -= dt; pVel[j + 1] -= 9 * dt; pPos[j] += pVel[j] * dt; pPos[j + 1] = Math.max(.04, pPos[j + 1] + pVel[j + 1] * dt); pPos[j + 2] += pVel[j + 2] * dt;
    const a = Math.min(1, pLife[i] * 4); pCol[j] = pBase[j] * a; pCol[j + 1] = pBase[j + 1] * a; pCol[j + 2] = pBase[j + 2] * a;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

// ── 拖曳可以轉動場景（證明是真的 3D）──
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw }; });
addEventListener('pointermove', e => { if (!drag) return; yaw = Math.max(cam0.yaw - 34 * RAD, Math.min(cam0.yaw + 34 * RAD, drag.yaw - (e.clientX - drag.x) * .004)); placeCam(); });
addEventListener('pointerup', () => { drag = null; });

async function boot() {
  const ids = [...HEROES.map(h => h[0]), ...new Set(FOES)];
  await Promise.all(ids.map(async id => { try { META[id] = await (await fetch(`../art/q/${id}.json`)).json(); } catch (e) { /* 沒有這個角色就跳過 */ } }));
  const jobs = [];
  for (const id of ids) {
    if (!META[id]) continue;
    const foe = id.startsWith('foe_');
    for (const an of foe ? ['walk'] : ['idle', 'atk']) for (const d of foe ? ['down', 'side', 'up'] : ['down', 'dside', 'side', 'uside', 'up'])
      jobs.push(loadImg(`../art/q/${id}_${an}_${d}.png`).then(im => { if (im) IMG[`${id}_${an}_${d}`] = im; }));
  }
  await Promise.all(jobs);
  for (const [id, slot, col] of HEROES) {
    if (!META[id]) continue; const p = office.slots[slot];
    heroes.push({ s: mkUnit(id), x: p[0], z: p[1], col, dx: .3, dz: 1, atk: -1, cd: rnd() * 1.5, ph: rnd() * 4 });
  }
  resize(); placeCam(); addEventListener('resize', resize);
  for (let i = 0; i < num('ff', 14) * 30; i++) stepWorld(1 / 30);
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!Q.has('freeze')) stepWorld(dt);
    post.lights(office.pointLights.concat(dyn.map(d => d.l)));
    post.render(now / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__p = { scene, cam, post, office, heroes, foes, renderer, ready: true };
}
boot();
