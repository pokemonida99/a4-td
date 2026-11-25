// 準時下班防衛戰 3D 版｜畫面與操作
// 夜裡加班的辦公室浮島：同事是 3D 方塊小人，檯燈是主角。規則在 core.js、數值在 rules.js、介面在 ui.js。
// 後製流程做法參考 Cinderwatch（MIT，kevintngo/cinderwatch），程式為本專案自寫。
import * as THREE from 'three';
import { makePost } from './post.js';
import { buildOffice } from './office.js';
import { makeChar, makeRat, pose, poseRat, faceTo, CAST } from './chars.js';
import * as C from './core.js';
import { HERO, FOE, ELEM, MAP, statsOf } from './rules.js';
import { makeFX } from './fx.js';
import { makeUI } from './ui.js';
import { sfx, bgm, jingle, loaded as sndLoaded } from './audio.js';

const Q = new URLSearchParams((location.hash || location.search).slice(1));
const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const RAD = Math.PI / 180;
const cam0 = { yaw: num('yaw', 12) * RAD, pitch: num('pitch', 42) * RAD, fit: num('fit', 36.5) };   // 俯角 42°：三條走道都看得到
let yaw = cam0.yaw, quality = num('q', 1);
const PITCH = cam0.pitch, PPU = 40;
const TARGET = new THREE.Vector3(num('tx', 2.6), 0.6, num('tz', -1.9));

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
const BG = new THREE.Color(0.0035, 0.005, 0.012);
renderer.setClearColor(BG, 1);
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
scene.add(cam);
const post = makePost(renderer, scene, cam);
let vw = 1, vh = 1, viewH0 = 1, lift = 0;

function placeCam() {
  const D = 90, cp = Math.cos(PITCH);
  cam.position.set(TARGET.x + Math.sin(yaw) * cp * D, TARGET.y + Math.sin(PITCH) * D, TARGET.z + Math.cos(yaw) * cp * D);
  cam.lookAt(TARGET); cam.updateMatrixWorld(); post.focusDist = D;
}
function resize() {
  // 用畫布實際排出來的大小，不用 innerWidth／innerHeight：手機轉向時那兩個值常常還是舊的，畫面會被壓扁
  const dpr = Math.min(window.devicePixelRatio || 1, 3); vw = canvas.clientWidth || innerWidth; vh = canvas.clientHeight || innerHeight;
  const dw = Math.max(8, Math.floor(vw * dpr)), dh = Math.max(8, Math.floor(vh * dpr));
  // 畫面比較方（或直放）的時候改用高度去配，至少看得到整個場景
  const fit = Math.max(cam0.fit, 17.6 * dw / dh), viewH = fit * dh / dw;
  viewH0 = viewH; cam.left = -fit / 2; cam.right = fit / 2; cam.top = viewH / 2 - lift * viewH; cam.bottom = -viewH / 2 - lift * viewH; cam.updateProjectionMatrix();
  let iw = Math.round(fit * PPU), ih = Math.round(viewH * PPU);
  const k = Math.min(1, dw / iw, 1500 / iw) * quality;
  iw = Math.max(8, Math.round(iw * k)); ih = Math.max(8, Math.round(ih * k));
  post.resize(dw, dh, iw, ih);
}
const _v = new THREE.Vector3();
function project(x, y, z) { _v.set(x, y, z).project(cam); return [(_v.x * .5 + .5) * vw, (-_v.y * .5 + .5) * vh]; }

// ── 場景與戰況 ──
const office = buildOffice(scene, num('seed', 7));
let s = C.newGame(MAP, (Math.random() * 1e9) | 0);
const rnd = Math.random;

// ── 地上的標記：空位、選取、射程 ──
const ringGeo = (r0, r1) => new THREE.RingGeometry(r0, r1, 48).rotateX(-Math.PI / 2);
const addMat = (rgb, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
const markers = MAP.slots.map(([x, z]) => {
  const g = new THREE.Group(), m = addMat([0.3, 1.0, 0.85], .7);
  g.add(new THREE.Mesh(ringGeo(.6, .72), m), new THREE.Mesh(new THREE.PlaneGeometry(.46, .12).rotateX(-Math.PI / 2), m), new THREE.Mesh(new THREE.PlaneGeometry(.12, .46).rotateX(-Math.PI / 2), m));
  g.position.set(x, .05, z); scene.add(g); return { g, m };
});
const selRing = new THREE.Mesh(ringGeo(.78, .96), addMat([1.8, 1.25, 0.4], 1)); selRing.visible = false; scene.add(selRing);
const rangeRing = new THREE.Mesh(ringGeo(.975, 1), addMat([1.2, 1.2, 1.3], .9)), rangeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), addMat([0.5, 0.6, 0.9], .1));
rangeRing.visible = rangeFill.visible = false; scene.add(rangeRing, rangeFill);
rangeRing.material.depthTest = false; rangeRing.renderOrder = 5; selRing.material.depthTest = false; selRing.renderOrder = 6;   // 射程圈不被桌子擋住
function showRange(i, r, rgb) {
  if (i == null) { rangeRing.visible = rangeFill.visible = false; return; }
  const [x, z] = MAP.slots[i]; rangeRing.visible = rangeFill.visible = true; rangeRing.position.set(x, .06, z); rangeFill.position.set(x, .055, z); rangeRing.scale.set(r, 1, r); rangeFill.scale.set(r, 1, r);
  if (rgb) { rangeRing.material.color.setRGB(rgb[0], rgb[1], rgb[2]); rangeFill.material.color.setRGB(rgb[0] * .4, rgb[1] * .4, rgb[2] * .4); }
}
// 走道上的方向箭頭（電梯 → 打卡機），備戰時還有一顆光點沿路跑一遍
{
  const pos = []; let d = 1.6; const probe = C.newGame(MAP, 1);
  for (; d < probe.len - .6; d += 1.7) { const p = C.posAt(probe, d), nx = -p.dz, nz = p.dx; pos.push(p.x + p.dx * .3, .035, p.z + p.dz * .3, p.x - p.dx * .2 + nx * .26, .035, p.z - p.dz * .2 + nz * .26, p.x - p.dx * .2 - nx * .26, .035, p.z - p.dz * .2 - nz * .26); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const m = addMat([0.55, 0.75, 1.1], .3); m.side = THREE.DoubleSide; scene.add(new THREE.Mesh(g, m));
}
const runner = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.0, 2.6) })); runner.visible = false; scene.add(runner);
let selected = null;
function select(i) { selected = i; selRing.visible = i != null; if (i != null) selRing.position.set(MAP.slots[i][0], .07, MAP.slots[i][1]); if (i == null) showRange(null); }

// ── 小人 ──
const blobGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
const barGeo = new THREE.BoxGeometry(1, .1, .04), barBg = new THREE.MeshBasicMaterial({ color: 0x05070c }), gemGeo = new THREE.BoxGeometry(.28, .28, .28);
const EMAT = {}; const emat = e => (EMAT[e] ??= new THREE.MeshBasicMaterial({ color: new THREE.Color(...ELEM[e].rgb.map(v => v * 1.5)) }));
const foeRingGeo = new THREE.RingGeometry(.42, .56, 20).rotateX(-Math.PI / 2), foeRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .28, .2), transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false });
const iceGeo = new THREE.BoxGeometry(1.25, 2.1, 1.25), iceMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.8, 1.3), transparent: true, opacity: .42, depthWrite: false });
const buffMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.7, 1.3) });
const pipGeo = new THREE.BoxGeometry(.13, .13, .13), pipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.4) });
const auraGeo = new THREE.RingGeometry(.84, 1, 6).rotateX(-Math.PI / 2), auraGeo2 = new THREE.RingGeometry(.94, 1, 40).rotateX(-Math.PI / 2), auraGeo3 = new THREE.RingGeometry(.7, 1, 3).rotateX(-Math.PI / 2);
const AURA = { buff: ELEM.sup.rgb, haste: [1.7, 1.2, .5], slow: [.4, .9, 1.7], cure: ELEM.cure.rgb, summon: ELEM.summon.rgb };
class Fig {
  constructor(spec, rat) {
    this.c = rat ? makeRat(rat) : makeChar(spec); this.rat = !!rat; const k = rat ? .7 : (spec.scale || 1) * (spec.fat || 1);
    this.h = rat ? .9 : (1.75 + (spec.hat === 'wizard' ? .9 : spec.hat ? .3 : 0)) * (spec.scale || 1);
    this.blob = new THREE.Mesh(blobGeo, blobMat); this.blob.scale.set(.52 * k, 1, .4 * k); this.blob.position.y = .03; this.blob.renderOrder = 2;
    this.w = new THREE.Group(); this.w.add(this.c.root, this.blob); scene.add(this.w); this.top = new THREE.Group(); this.top.position.y = this.h + .32; this.w.add(this.top);
  }
  place(x, z) { this.w.position.set(x, 0, z); this.top.rotation.y = yaw; }
  act(mode, dx, dz, ph, p, dt) { faceTo(this.c, Math.atan2(dx, dz), dt, mode === 'walk' ? 9 : 14); if (this.rat) poseRat(this.c, ph); else pose(this.c, mode, mode === 'walk' ? ph * .8 : ph / 5, p); }
  flash(v) { this.c.mat.emissive.setScalar(v * 6); }
  bar(elem) {
    this.bg = new THREE.Mesh(barGeo, barBg); this.fg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x66e07a })); this.fg.position.z = .03; this.fg.scale.y = .7; this.bg.scale.x = 1.06; this.bg.visible = this.fg.visible = false; this.top.add(this.bg, this.fg);
    if (elem && elem !== 'none') { const g = new THREE.Mesh(gemGeo, emat(elem)); g.rotation.z = Math.PI / 4; g.position.x = -.8; this.top.add(g); }
    // 腳下一圈紅光：燈還沒亮的地方也看得出哪裡有敵人
    const r = new THREE.Mesh(foeRingGeo, foeRingMat); r.position.y = .045; this.w.add(r);
  }
  hp(r) { if (!this.fg) return; const v = r < .999; this.bg.visible = this.fg.visible = v; if (v) { r = Math.max(.02, r); this.fg.scale.x = r; this.fg.position.x = -(1 - r) / 2; this.fg.material.color.setRGB(r < .35 ? 1.3 : .4, r < .35 ? .35 : 1.1, .35); } }
  pips(n) { if (this.pg) this.top.remove(this.pg); this.pg = new THREE.Group(); for (let i = 0; i < n; i++) { const m = new THREE.Mesh(pipGeo, pipMat); m.position.x = (i - (n - 1) / 2) * .2; m.rotation.z = Math.PI / 4; this.pg.add(m); } this.top.add(this.pg); }
  buff(on) { if (on && !this.bp) { this.bp = new THREE.Mesh(pipGeo, buffMat); this.bp.position.set(.62, -.02, 0); this.bp.scale.setScalar(1.3); this.top.add(this.bp); this.br = new THREE.Mesh(auraGeo2, addMat(ELEM.sup.rgb, .75)); this.br.position.y = .055; this.br.scale.setScalar(.72); this.w.add(this.br); } if (this.bp) { this.bp.visible = this.br.visible = on; this.bp.rotation.y += .08; } }
  // 輔助同事腳下常駐的光陣：一眼看得出他正在發揮作用
  aura(rgb) { this.au = [[auraGeo, .98, .9], [auraGeo3, .6, .7], [auraGeo2, 1.22, .8]].map(([g, sc, op], k) => { const m = new THREE.Mesh(g, addMat(rgb, op)); m.position.y = .06 + k * .004; m.scale.setScalar(sc); m.userData.op = op; this.w.add(m); return m; }); this.auc = rgb; }
  auraTick(T, on, ph) { if (!this.au) return; const [a, b, c] = this.au; a.visible = b.visible = c.visible = on; if (!on) return; a.rotation.y = T * 1.1; b.rotation.y = -T * 1.7; const p = .5 + .5 * Math.sin(T * 2.6 + ph); a.material.opacity = a.userData.op * (.65 + .35 * p); c.scale.setScalar(1.18 + .12 * p); c.material.opacity = c.userData.op * (1 - p * .6); }
  ice(on) { if (on && !this.iceM) { this.iceM = new THREE.Mesh(iceGeo, iceMat); this.iceM.position.y = 1.05; this.w.add(this.iceM); } if (this.iceM) this.iceM.visible = on; }
  dispose() { scene.remove(this.w); this.c.root.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); this.c.mat.dispose(); if (this.fg) this.fg.material.dispose(); }
}
const heroFig = Array(12).fill(null), foeFig = new Map(), ratFig = new Map();
const heroAnim = Array(12).fill(null).map(() => ({ atk: -1, ph: rnd() * 9, pop: 0 }));

// ── 粒子：光裡的灰塵、火花 ──
const NP = 760, NDUST = 300, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP), pBase = new Float32Array(NP * 3); let sparkI = NDUST;
const B0 = office.bounds;
for (let i = 0; i < NDUST; i++) { pPos[i * 3] = B0.x0 + rnd() * (B0.x1 - B0.x0); pPos[i * 3 + 1] = 0.3 + rnd() * 2.6; pPos[i * 3 + 2] = B0.z0 + rnd() * (B0.z1 - B0.z0); pLife[i] = rnd() * 6.28; }
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
points.frustumCulled = false; scene.add(points);
function spark(x, y, z, col, n, sp = 3, up = 1.5) {
  for (let k = 0; k < n; k++) {
    const i = sparkI; sparkI = sparkI + 1 >= NP ? NDUST : sparkI + 1;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    const a = rnd() * 6.28, u = rnd() * 2 - .3, v = sp * (.4 + rnd());
    pVel[i * 3] = Math.cos(a) * v; pVel[i * 3 + 1] = u * v + up; pVel[i * 3 + 2] = Math.sin(a) * v;
    pBase[i * 3] = col[0]; pBase[i * 3 + 1] = col[1]; pBase[i * 3 + 2] = col[2]; pLife[i] = .35 + rnd() * .35;
  }
}
// ── 會動的光、光束、擴散圈 ──
const dyn = []; for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffffff, 0, 7, 2); scene.add(l); dyn.push({ l, t: 0, dur: 1, peak: 0 }); } let dynI = 0;
function flash(x, y, z, col, peak, dur) { const d = dyn[dynI++ % dyn.length]; if (d.t > 0 && d.peak > peak * 1.5) return; d.l.position.set(x, y, z); d.l.color.setRGB(col[0], col[1], col[2]); d.peak = peak; d.dur = dur; d.t = dur; }
// 飛行道具：每位同事丟的東西長得不一樣（形狀、大小、拋多高、尾巴）
const ballGeo = new THREE.IcosahedronGeometry(1, 1), boxGeo = new THREE.BoxGeometry(1, 1, 1), bolts = new Map();
const bmat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const BOLT = {
  jie: { geo: ballGeo, s: [.27, .27, .27], mat: bmat(2.6, 1.1, .3), arc: .5, trail: .24 },
  xu: { geo: boxGeo, s: [.17, .28, .17], mat: bmat(.7, 1.9, .9), arc: 1.5, spin: 1 },
  yan: { geo: ballGeo, s: [.21, .21, .21], mat: bmat(.5, 1.5, 2.8), arc: .4, trail: .17 },
  heilun: { geo: boxGeo, s: [.36, .03, .24], mat: bmat(1.6, 2.0, 1.6), arc: .3, spin: 2 },
  senpai: { geo: ballGeo, s: [.15, .15, .15], mat: bmat(3, 2.8, 1.6), arc: 0, trail: .12 },
};
let shake = 0;
const fx = makeFX(scene, cam, { spark, flash, shake: v => { shake = Math.max(shake, v); }, project });

// ── 把規則的事件變成畫面 ──
let ui, T = 0, critN = 0;
function onEvents() {
  for (const e of s.ev) {
    const col = e.elem ? ELEM[e.elem].rgb : [1.4, 1.2, 1];
    if (e.k === 'place') { const f = heroFig[e.i] = new Fig(CAST[e.id]); const [x, z] = MAP.slots[e.i]; f.place(x, z); f.c.face = yaw + .2; f.c.root.rotation.y = f.c.face; f.pips(1); office.desks[e.i].set(true); heroAnim[e.i].pop = 1; heroAnim[e.i].atk = -1; heroAnim[e.i].pulse = .4; fx.place(x, z); const au = AURA[HERO[e.id].kind]; if (au) f.aura(au); }
    else if (e.k === 'sell') { heroFig[e.i]?.dispose(); heroFig[e.i] = null; office.desks[e.i].set(false); }
    else if (e.k === 'up') { heroFig[e.i].pips(e.lv); heroAnim[e.i].pop = 1; heroAnim[e.i].pulse = .5; const [x, z] = MAP.slots[e.i]; fx.levelUp(x, z, e.lv); }
    else if (e.k === 'spawn') { const f = new Fig(CAST[e.f.type]); f.bar(e.f.elem); if (!CAST[e.f.type].ghost) f.c.mat.userData.self.value = .8; f.c.face = Math.atan2(e.f.dx, e.f.dz); f.place(e.f.x, e.f.z); foeFig.set(e.f.id, f); e.f.ph = rnd() * 8; if (FOE[e.f.type].leak) { ui.toast(`<b>${FOE[e.f.type].name}</b> 來了！漏掉會扣 ${FOE[e.f.type].leak} 條命`, 3.5); shake = .3; } }
    else if (e.k === 'atk') {
      const a = heroAnim[e.i], [x, z] = MAP.slots[e.i], h = s.slots[e.i].h, id = h ? h.id : ''; a.atk = 0;
      if (e.kind === 'melee') for (const [tx, tz] of e.to) { if (id === 'qiang') fx.punch(x, z, tx, tz, col, e.stun); else if (id === 'you') fx.stab(tx, tz, col, e.ex); else fx.slash(x, z, tx, tz, col, h ? h.lv : 1); }
      else if (e.kind === 'pierce') { const [tx, tz] = e.to[0]; fx.lance(x, z, tx, tz, col, e.hit); }
      else if (e.kind === 'blast') { const [tx, tz] = e.to[0]; fx.circle(x, z, tx, tz, e.r, col); }
      else if (e.kind === 'bolt') { const B = BOLT[id] || BOLT.jie, m = new THREE.Mesh(B.geo, B.mat); m.scale.set(B.s[0], B.s[1], B.s[2]); m.position.set(x, 1.5, z); scene.add(m); bolts.set(e.shot.id, { m, sh: e.shot, col, x0: x, z0: z, B, tr: 0 }); if (id === 'senpai') fx.tracer(x, z, e.shot.tx, e.shot.tz, col); }
      else if (e.kind === 'summon') fx.summon(x, z, col);
    }
    else if (e.k === 'boom') {
      if (e.id) { const b = bolts.get(e.id); if (b) { scene.remove(b.m); bolts.delete(e.id); } }
      if (e.blast) { if (e.elem === 'light') fx.lightBlast(e.x, e.z, e.r, col); else fx.darkBlast(e.x, e.z, e.r, col, e.r > 2 ? 3 : e.r > 1.5 ? 2 : 1); }
      else if (e.src === 'jie') fx.fireHit(e.x, e.z, e.r, col);
      else if (e.src === 'xu') fx.poolFire(e.x, e.z, e.r, col);
      else if (e.src === 'yan') fx.waterHit(e.x, e.z, col, e.lv >= 2);
      else if (e.src === 'senpai') fx.snipeHit(e.x, e.z, col);
      else fx.cardHit(e.x, e.z, col);
    }
    else if (e.k === 'dmg') { const p = project(e.x, 2.2, e.z); ui.float(p[0], p[1], e.v, e.mul > 1 ? 'crit' : e.mul < 1 ? 'weak' : '', e.elem); if (e.mul > 1 && critN < 2) { critN++; fx.crit(e.x, e.z, col); } }
    else if (e.k === 'die') { const f = foeFig.get(e.f.id), big = e.f.max > 600; if (f) { spark(e.f.x, .9, e.f.z, [1.6, 1.4, 1.0], big ? 40 : 8, 2.8); fx.papers(e.f.x, e.f.z, big ? 40 : e.f.type === 'foe_mini' ? 3 : 7, !!FOE[e.f.type].ghost); if (big) { fx.wave(e.f.x, e.f.z, 7, [1.8, 1.5, .8]); flash(e.f.x, 1.5, e.f.z, [1.8, 1.5, .8], 30, .4); } f.dispose(); foeFig.delete(e.f.id); } const p = project(e.f.x, 1.2, e.f.z); ui.coinFly(p[0], p[1], e.coin); if (big) shake = .4; }
    else if (e.k === 'leak') { const f = foeFig.get(e.f.id); if (f) { f.dispose(); foeFig.delete(e.f.id); } shake = .35; flash(office.clockPos[0], 1.8, office.clockPos[1], [1.8, .25, .2], 40, .5); fx.wave(office.clockPos[0], office.clockPos[1], 3.5, [2, .3, .2]); ui.leak(e.n, e.f.type); }
    else if (e.k === 'rat') { const f = new Fig(null, e.r.kind); f.place(e.r.x, e.r.z); ratFig.set(e.r.id, f); fx.summon(e.r.x, e.r.z, ELEM.summon.rgb); }
    else if (e.k === 'ratEnd') { const f = ratFig.get(e.r.id); if (f) { spark(e.r.x, .4, e.r.z, [1, 1, 1], 6, 1.5); f.dispose(); ratFig.delete(e.r.id); } }
    else if (e.k === 'ratBite') fx.bite(e.x, e.z);
    else if (e.k === 'cast') { const ice = e.kind === 'freeze', c = ice ? [0.4, 0.9, 1.6] : [1.7, 1.5, 0.3]; for (const i of e.to) { const [x, z] = MAP.slots[i]; fx.curse(e.f.x, e.f.z, x, z, c, ice); } ui.status(e.kind, e.to); }
    else if (e.k === 'cure') { const [x0, z0] = MAP.slots[e.from], [x, z] = MAP.slots[e.to]; fx.cure(x0, z0, x, z, ELEM.cure.rgb); }
    else if (e.k === 'skill') { for (let i = 0; i < 12; i++) if (heroFig[i]) { const [x, z] = MAP.slots[i]; fx.cheer(x, z); heroAnim[i].pop = .6; } fx.wave(TARGET.x, TARGET.z + 1.4, 15, [1.7, 1.25, .4]); shake = .15; ui.phase(e); }
    else if (e.k === 'wave' || e.k === 'clear' || e.k === 'won' || e.k === 'lost') ui.phase(e);
    sound(e);
  }
  s.ev.length = 0;
}

// 事件 → 音效（全部是專案自己合成的聲音）
const ATK_SFX = { slash: 'slash', fist: 'hit', fire: 'explosion', water: 'break', wind: 'whoosh', light: 'holy_cast', dark: 'dark_blast' };
function sound(e) {
  if (e.k === 'atk') { if (e.kind === 'melee' || e.kind === 'pierce') sfx(ATK_SFX[e.elem] || 'hit', e.kind === 'pierce' ? .25 : .32, 1, .09); else if (e.kind === 'summon') sfx(Math.random() < .5 ? 'squeak_1' : 'squeak_2', .4); }
  else if (e.k === 'boom') sfx(e.r > 1.2 ? 'explosion_big' : ATK_SFX[e.elem] || 'hit', e.r > .8 ? .4 : .28, 1, .1);
  else if (e.k === 'die') sfx(e.f.max > 600 ? 'boss_down' : 'pop', e.f.max > 600 ? .7 : .35, 1, .05);
  else if (e.k === 'leak') sfx('weak', .8);
  else if (e.k === 'place') sfx('card', .6);
  else if (e.k === 'cast') sfx('stun', .6);
  else if (e.k === 'cure') sfx('heal', .5);
  else if (e.k === 'wave') { sfx(e.boss ? 'boss_appear' : 'encounter', .6); bgm(e.n === 12 ? 'boss' : 'battle'); }
  else if (e.k === 'clear') { sfx('fanfare', .5); bgm('map'); }
  else if (e.k === 'won') jingle('victory');
  else if (e.k === 'lost') jingle('lose');
}

// ── 每一格畫面 ──
function draw(dt, sim) {
  T += dt;
  for (let i = 0; i < 12; i++) {
    const f = heroFig[i], h = s.slots[i].h, mk = markers[i]; mk.g.visible = !h && s.phase !== 'won' && s.phase !== 'lost'; mk.m.opacity = (.55 + .3 * Math.sin(T * 3 + i)) * (selected != null && selected !== i ? .3 : 1);
    if (!f || !h) continue; const a = heroAnim[i], [x, z] = MAP.slots[i], frozen = h.fz > 0;
    f.ice(frozen); f.buff(h.bAtk > 0 || h.bSpd > 0); a.pop = Math.max(0, a.pop - dt * 3);
    let px = x; if (h.pz > 0 && !frozen) { px += Math.sin(T * 60) * .04; if (rnd() < dt * 8) spark(x, 1.6, z, [1.7, 1.5, .3], 2, 1.5); }
    f.place(px, z); f.w.scale.setScalar(1 + a.pop * .25); f.auraTick(T, !frozen, a.ph); f.flash((s.skillT > 0 ? .012 + .006 * Math.sin(T * 12) : 0) + (f.au && !frozen ? .012 + .008 * Math.sin(T * 2.6 + a.ph) : 0)); if (f.au && !frozen && rnd() < dt * 5) spark(x + (rnd() - .5) * 1.1, .15, z + (rnd() - .5) * 1.1, f.auc, 1, .25, 2.4); if (s.skillT > 0 && rnd() < dt * 5) spark(x, 1.8, z, [1.6, 1.2, .4], 1, .8, 2.5);
    if (frozen) continue;
    // 輔助：開打時每隔一下往外送一圈，看得出罩到哪裡、罩到誰
    const K = HERO[h.id].kind;
    if ((K === 'buff' || K === 'haste' || K === 'slow') && sim > 0 && (s.phase === 'fight' || a.pulse < 1)) {
      a.pulse = (a.pulse ?? 1) - sim; if (a.pulse <= 0) { a.pulse = 2.4; const r = statsOf(h.id, h.lv).range, al = []; if (K !== 'slow') s.slots.forEach((o, j) => { if (o.h && j !== i && (o.x - x) ** 2 + (o.z - z) ** 2 <= r * r) al.push([o.x, o.z]); }); fx.pulse(x, z, r, K === 'slow' ? [.4, .9, 1.7] : ELEM.sup.rgb, al); }
    }
    const idle = !s.foes.length, dx = idle ? Math.sin(yaw + .25) : h.fx || .3, dz = idle ? Math.cos(yaw + .25) : h.fz2 || 1;
    if (a.atk >= 0) { a.atk += sim / (HERO[h.id].cd < .45 ? .3 : .52); if (a.atk >= 1) a.atk = -1; }
    if (a.atk >= 0) f.act('atk', dx, dz, 0, a.atk, dt); else f.act('idle', dx, dz, T * 5 + a.ph, 0, dt * (idle ? .5 : 1));
  }
  for (const e of s.foes) { const f = foeFig.get(e.id); if (!f) continue; const hit = Math.max(0, .12 - (s.t - e.last)); f.act('walk', e.dx, e.dz, e.stun > 0 || e.block ? e.ph : e.ph + e.d * 3.9, 0, dt); f.place(e.x, e.z); f.flash(hit * 4); f.hp(e.hp / e.max); if (e.burnT > 0 && rnd() < dt * 10) spark(e.x, 1.2, e.z, [1.7, .6, .2], 1, .8, 2.5); if ((e.aura > 0 || e.slowK > 0) && rnd() < dt * 6) spark(e.x, .3, e.z, [.3, .8, 1.6], 1, .5, .3); if (e.stun > 0 && rnd() < dt * 12) spark(e.x, f.h + .3, e.z, [1.7, 1.5, .3], 1, 1.2, .5); }
  for (const r of s.rats) { const f = ratFig.get(r.id); if (f) { f.act('walk', r.dx, r.dz, T + r.id, 0, dt); f.place(r.x, r.z); } }
  for (const b of bolts.values()) {
    const sh = b.sh, B = b.B, tot = Math.hypot(sh.tx - b.x0, sh.tz - b.z0) || 1, k = Math.min(1, Math.hypot(sh.x - b.x0, sh.z - b.z0) / tot), y = 1.5 - .6 * k + Math.sin(k * Math.PI) * B.arc;
    b.m.position.set(sh.x, y, sh.z); if (B.spin) b.m.rotation.set(T * (B.spin === 1 ? 11 : 2), T * (B.spin === 1 ? 3 : 16), 0);
    if (sim > 0) { if (B.trail) { fx.trail(sh.x, y, sh.z, b.col, B.trail); if (rnd() < .5) spark(sh.x, y, sh.z, b.col.map(v => v * .5), 1, .6, 0); } else if (rnd() < .3) spark(sh.x, y, sh.z, b.col.map(v => v * .4), 1, .5, 0); }
    if (sh.done) { scene.remove(b.m); bolts.delete(sh.id); }
  }
  if (!G.fxHold) fx.update(dt); critN = 0;
  for (const d of dyn) { d.t = Math.max(0, d.t - dt); d.l.intensity = d.peak * (d.t / d.dur) ** 2; }
  // 檯燈開越多，每盞就收一點：不然滿編時整間辦公室亮到發白，招式的光反而看不見
  let lit = 0; for (const L of office.lamps) if (L.base) lit++; const lampK = 1 / (1 + Math.max(0, lit - 3) * .085);
  for (const L of office.lamps) if (L.base) L.light.intensity = L.base * lampK * (1 + .025 * Math.sin(T * 2.1 + L.ph));
  office.clockLight.intensity = office.clockBase * (1 + .2 * Math.sin(T * 2.4)) * (s.lives <= 3 ? 1.5 : 1);
  if (s.lives <= 3) office.clockLight.color.setRGB(1, .3 + .2 * Math.sin(T * 6), .2);
  const LP = office.lamps;
  for (let i = 0; i < NDUST; i++) {
    const j = i * 3; pLife[i] += dt * .5;
    pPos[j] += Math.sin(pLife[i] * 1.3 + i) * .06 * dt + .05 * dt; pPos[j + 1] += Math.cos(pLife[i] + i * .7) * .05 * dt; pPos[j + 2] += Math.sin(pLife[i] * .8 + i * 1.9) * .05 * dt;
    if (pPos[j] > B0.x1) pPos[j] = B0.x0;
    let r = 0, g = 0, b = 0;
    for (const L of LP) { if (!L.k) continue; const dx = L.x - pPos[j], dy = L.y - pPos[j + 1], dz = L.z - pPos[j + 2], a = L.k / (dx * dx + dy * dy + dz * dz + .5); r += L.c[0] * a; g += L.c[1] * a; b += L.c[2] * a; }
    pCol[j] = Math.min(r, 1.4); pCol[j + 1] = Math.min(g, 1.4); pCol[j + 2] = Math.min(b, 1.4);
  }
  for (let i = NDUST; i < NP; i++) {
    const j = i * 3; if (pLife[i] <= 0) { pCol[j] = pCol[j + 1] = pCol[j + 2] = 0; continue; }
    pLife[i] -= dt; pVel[j + 1] -= 9 * dt; pPos[j] += pVel[j] * dt; pPos[j + 1] = Math.max(.04, pPos[j + 1] + pVel[j + 1] * dt); pPos[j + 2] += pVel[j + 2] * dt;
    const a = Math.min(1, pLife[i] * 4); pCol[j] = pBase[j] * a; pCol[j + 1] = pBase[j + 1] * a; pCol[j + 2] = pBase[j + 2] * a;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  selRing.rotation.y = T * .8;
  { const on = s.phase === 'prep' && !s.foes.length, d = ((T * 11) % (s.len + 30)); runner.visible = on && d < s.len - .5; if (runner.visible) { const p = C.posAt(s, d); runner.position.set(p.x, .5, p.z); runner.rotation.set(T * 5, T * 4, 0); if (rnd() < .7) spark(p.x, .5, p.z, [.4, .8, 1.1], 1, .4, 0); } }
  if (shake > 0) { shake = Math.max(0, shake - dt); const k = shake * .35; cam.position.x += (rnd() - .5) * k; cam.position.y += (rnd() - .5) * k; cam.updateMatrixWorld(); }
}

// ── 大頭照：直接拿 3D 小人拍一張，選單和波次預告用 ──
function portraits() {
  const out = {}, S = 72, rt = new THREE.WebGLRenderTarget(S, S), sc = new THREE.Scene(), oc = new THREE.OrthographicCamera(-.62, .62, .62, -.62, .1, 20), buf = new Uint8Array(S * S * 4);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8aa0, 2.6)); const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(2, 3, 5); sc.add(d);
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'), img = cx.createImageData(S, S);
  renderer.setClearColor(0x000000, 0);
  for (const id of [...Object.keys(HERO), ...Object.keys(FOE)]) {
    const sp = CAST[id]; if (!sp) continue; const c = makeChar(sp), k = sp.scale || 1; c.root.rotation.y = .42; sc.add(c.root);
    const hy = ((sp.legH || .4) + .56 * (sp.tall || 1) + .36) * k + (sp.hat === 'wizard' ? .22 : sp.hat ? .08 : 0), z = sp.hat === 'wizard' ? 1.35 : 1;
    oc.left = oc.bottom = -.62 * k * z; oc.right = oc.top = .62 * k * z; oc.updateProjectionMatrix(); oc.position.set(1.6, hy + 1.1, 4); oc.lookAt(0, hy, 0);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, oc); renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const a = ((S - 1 - y) * S + x) * 4, b = (y * S + x) * 4; for (let q = 0; q < 3; q++) img.data[b + q] = 255 * Math.pow(buf[a + q] / 255, 1 / 2.2); img.data[b + 3] = buf[a + 3]; }
    cx.putImageData(img, 0, 0); out[id] = cv.toDataURL(); sc.remove(c.root); c.root.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); c.mat.dispose();
  }
  renderer.setRenderTarget(null); renderer.setClearColor(BG, 1); rt.dispose(); return out;
}

// ── 操作：點一下選工位，拖曳轉場景 ──
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw, moved: false }; });
addEventListener('pointermove', e => { if (!drag) return; if (Math.abs(e.clientX - drag.x) > 10) drag.moved = true; if (drag.moved) { yaw = Math.max(cam0.yaw - 30 * RAD, Math.min(cam0.yaw + 30 * RAD, drag.yaw - (e.clientX - drag.x) * .004)); placeCam(); } });
let wasDrag = false;
addEventListener('pointerup', () => { wasDrag = !!(drag && drag.moved); drag = null; });
// 用 click 來選位子：手指放開後瀏覽器還會補一個 click，如果在放開那一刻就開選單，那個 click 會點到剛冒出來的按鈕
canvas.addEventListener('click', e => {
  if (wasDrag) return;
  let best = -1, bd = Math.max(34, vh * .1) ** 2;
  MAP.slots.forEach(([x, z], i) => { const p = project(x, .9, z), dd = (p[0] - e.clientX) ** 2 + (p[1] - e.clientY) ** 2; if (dd < bd) { bd = dd; best = i; } });
  ui.tapSlot(best);
});

const G = {
  get s() { return s; }, C, project, select, showRange, get selected() { return selected; }, speed: 1, paused: false, hold: false, tutHold: false, lift: 0,
  fx, ELEM, fxHold: false,
  restart(diff = 'normal') {
    for (let i = 0; i < 12; i++) { heroFig[i]?.dispose(); heroFig[i] = null; office.desks[i].set(false); }
    for (const f of foeFig.values()) f.dispose(); foeFig.clear(); for (const f of ratFig.values()) f.dispose(); ratFig.clear(); for (const b of bolts.values()) scene.remove(b.m); bolts.clear(); fx.clear();
    s = C.newGame(MAP, (Math.random() * 1e9) | 0, diff); select(null); office.clockLight.color.set(0xffb14a);
  },
  sndLoaded,
  view: () => ({ aspect: (cam.right - cam.left) / (cam.top - cam.bottom), slab: [[B0.x0, B0.z0], [B0.x1, B0.z0], [B0.x1, B0.z1], [B0.x0, B0.z1]].map(([x, z]) => project(x, 0, z)) }),
  slotScreen: i => project(MAP.slots[i][0], 1.0, MAP.slots[i][1]), elevScreen: () => project(MAP.path[0][0], 1.4, MAP.path[0][1] + 1.6), clockScreen: () => project(office.clockPos[0], 1.8, office.clockPos[1]),
};
window.__g = G;

function boot() {
  G.portraits = portraits(); ui = makeUI(G);
  resize(); placeCam(); addEventListener('resize', () => { resize(); placeCam(); });
  let last = performance.now(), acc = 0, slow = 0, frames = 0;
  const loop = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now; let sim = 0;
    if (canvas.clientWidth !== vw || canvas.clientHeight !== vh) { resize(); placeCam(); }   // 每一格都對一次尺寸，不靠 resize 事件
    // 選單開著、教學在講話的時候時間先停（手機上一邊看卡片一邊顧戰場太忙）
    if (!G.paused && !G.hold && !G.tutHold) { acc += dt * G.speed; while (acc >= C.DT) { C.step(s, C.DT); acc -= C.DT; sim += C.DT; onEvents(); } } else onEvents();
    // 下面的面板打開時，把場景往上推，選到的位子才不會被蓋住
    if (Math.abs(G.lift - lift) > .001) { lift += (G.lift - lift) * Math.min(1, dt * 9); cam.top = viewH0 / 2 - lift * viewH0; cam.bottom = -viewH0 / 2 - lift * viewH0; cam.updateProjectionMatrix(); }
    placeCam(); draw(dt, sim); ui.update(dt);
    post.lights(office.pointLights.concat(dyn.map(d => d.l)));
    post.render(now / 1000);
    // 太慢就自動降一點解析度（只降不升，免得忽大忽小）
    frames++; if (dt > .034) slow++; if (frames >= 90) { if (slow > 45) { if (quality > .55) { quality = Math.max(.55, quality - .15); resize(); } else { post.nodof = true; fx.lite = true; } } frames = slow = 0; }   // 降到底還是慢，就關掉景深模糊
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  G.ready = true;
}
boot();
