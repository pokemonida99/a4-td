// 夜間辦公室浮島：所有模型都用程式的方塊堆出來，沒有外部模型檔。
import * as THREE from 'three';
import { MAP } from './rules.js';

export const W = (x, y) => [(x - 640) / 40, (y - 295) / 40];
const X0 = -11, X1 = 16, Z0 = -8.6, Z1 = 5;

export function rng(seed) { let s = seed >>> 0; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lin = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

export class Build {
  constructor(rnd) { this.p = []; this.n = []; this.c = []; this.rnd = rnd; }
  // 底部中心 (cx, y0, cz)，寬 w（x）高 h 深 d（z）
  box(cx, y0, cz, w, h, d, col, { ry = 0, jit = 0.05, grad = 0.8, mul = 1 } = {}) {
    const c = Array.isArray(col) ? col : lin(col), j = (1 + (this.rnd() - .5) * 2 * jit) * mul;
    const hw = w / 2, hd = d / 2, cs = Math.cos(ry), sn = Math.sin(ry);
    const F = [
      [[0, 1, 0], [-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd]],
      [[0, -1, 0], [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]],
      [[0, 0, 1], [-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd]],
      [[0, 0, -1], [hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd]],
      [[1, 0, 0], [hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd]],
      [[-1, 0, 0], [-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd]],
    ];
    for (const [n, ...q] of F) {
      const nx = n[0] * cs + n[2] * sn, nz = -n[0] * sn + n[2] * cs;
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const v = q[k], g = v[1] === 0 ? grad : 1;
        this.p.push(cx + v[0] * cs + v[2] * sn, y0 + v[1], cz - v[0] * sn + v[2] * cs); this.n.push(nx, n[1], nz); this.c.push(c[0] * j * g, c[1] * j * g, c[2] * j * g);
      }
    }
    return this;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.c), 3));
    return g;
  }
}

function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}

export function buildOffice(scene, seed) {
  const rnd = rng(seed), B = new Build(rnd), E = new Build(rnd), S = new Build(rnd);
  const out = { lamps: [], pointLights: [], bounds: { x0: X0, x1: X1, z0: Z0, z1: Z1 } };
  out.path = MAP.path; out.slots = MAP.slots;
  const point = (hex, I, dist, x, y, z, haze = 0.02) => { const l = new THREE.PointLight(hex, I, dist, 2); l.position.set(x, y, z); scene.add(l); out.pointLights.push(l); l.userData.haze = haze; return l; };

  // ── 環境光：窗外的月光與城市光 ──
  scene.add(new THREE.HemisphereLight(0x6a86de, 0x1e1a2c, 0.72));
  const fill = new THREE.DirectionalLight(0xc8d4ff, 0.5); fill.position.set(9, 5, 22); fill.target.position.set(3, 0, -1); scene.add(fill, fill.target); // 鏡頭這一側的補光，讓臉看得清楚
  const moon = new THREE.DirectionalLight(0x86a8ff, 1.25);
  moon.position.set(-6, 16, -22); moon.target.position.set(3, 0, -1); scene.add(moon, moon.target);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 14; sc.bottom = -14; sc.near = 2; sc.far = 60; moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;

  // ── 地板：方塊地毯 ──
  const carpet = canvasTex(256, 256, (c, w, h) => {
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      const v = rnd() * 14 - 7, alt = (tx + ty) % 2 ? 6 : 0;
      c.fillStyle = `rgb(${(62 + v + alt) | 0},${(74 + v + alt) | 0},${(98 + v + alt) | 0})`; c.fillRect(tx * 64, ty * 64, 64, 64);
      c.fillStyle = 'rgba(20,26,40,.5)'; c.fillRect(tx * 64, ty * 64, 64, 1); c.fillRect(tx * 64, ty * 64, 1, 64);
    }
    for (let i = 0; i < 9000; i++) { const a = rnd(); c.fillStyle = a > .5 ? `rgba(190,205,230,${.03 + rnd() * .06})` : `rgba(10,14,26,${.05 + rnd() * .1})`; c.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1); }
  }, (X1 - X0) / 8, (Z1 - Z0) / 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: carpet }));
  floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); floor.receiveShadow = true; scene.add(floor);

  // ── 走道：磨亮的塑膠地磚 ──
  const vinyl = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#aab4c4'; c.fillRect(0, 0, w, h);
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) { const v = rnd() * 18 - 9; c.fillStyle = `rgb(${(176 + v) | 0},${(186 + v) | 0},${(204 + v) | 0})`; c.fillRect(tx * 32 + 1, ty * 32 + 1, 31, 31); }
    for (let i = 0; i < 900; i++) { c.fillStyle = rnd() > .5 ? `rgba(255,250,235,${rnd() * .12})` : `rgba(60,50,40,${rnd() * .16})`; c.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1 + (rnd() * 3 | 0), 1); }
  });
  const PW = 0.62, pp = [], pu = [], pn = [];
  for (let i = 1; i < out.path.length; i++) {
    const a = out.path[i - 1], b = out.path[i];
    const x0 = Math.min(a[0], b[0]) - PW, x1 = Math.max(a[0], b[0]) + PW, z0 = Math.max(Z0, Math.min(a[1], b[1]) - PW), z1 = Math.max(a[1], b[1]) + PW;
    for (const [x, z] of [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]]) { pp.push(x, 0.012, z); pu.push(x / 2, -z / 2); pn.push(0, 1, 0); }
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pp), 3)); pg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pu), 2)); pg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pn), 3));
  const road = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ map: vinyl, emissive: 0xffffff, emissiveMap: vinyl, emissiveIntensity: 0.07 })); road.receiveShadow = true; scene.add(road);

  // ── 浮島的切面：地板、樓板、鋼樑、管線 ──
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, sw = X1 - X0, sd = Z1 - Z0;
  S.box(cx, -0.2, cz, sw, 0.16, sd, 0xb9c4d4, { jit: 0, grad: .9 });   // 頂面比地板低一點，兩個面才不會搶著顯示
  S.box(cx, -0.75, cz, sw - .12, 0.59, sd - .12, 0xd0cdc6, { jit: 0, grad: .75 });
  S.box(cx, -1.0, cz, sw - .5, 0.25, sd - .5, 0x7a6a62, { jit: 0, grad: .6 });
  for (let x = X0 + 1.2; x < X1; x += 3.1) S.box(x, -1.32, cz, .34, .34, sd - .3, 0x5b4a44, { grad: .6 });            // 鋼樑
  S.box(cx, -1.55, Z1 - 1.1, sw - 2.4, .42, .7, 0x9aa3ad, { grad: .6 });                                              // 風管
  S.box(X1 - 1.2, -1.6, cz, .6, .4, sd - 3, 0x9aa3ad, { grad: .6 });
  for (let x = X0 + 2; x < X1 - 1; x += 4.3) S.box(x, -1.9, Z1 - 1.1, .5, .35, .5, 0x868f99, { grad: .6 });
  S.box(cx + 2, -1.25, Z1 - .45, sw - 6, .09, .09, 0x9c5a3a, { grad: .8 });                                            // 銅水管
  S.box(cx - 3, -1.42, Z1 - .32, sw - 9, .07, .07, 0x3b6ea5, { grad: .8 });
  for (let i = 0; i < 46; i++) {                                                                                       // 崩落的碎塊
    const side = rnd() < .62, x = side ? X0 + rnd() * sw : X1 - rnd() * 1.6, z = side ? Z1 - rnd() * 1.8 : Z0 + rnd() * sd, s = .25 + rnd() * .7, dep = 1.25 + rnd() * 1.9;
    S.box(x, -dep - s, z, s, s * (0.6 + rnd()), s, rnd() < .5 ? 0x4c4f58 : 0x6a6d74, { ry: rnd() * 1.5, mul: Math.max(.25, 1.1 - dep * .3), grad: .6 });
  }
  for (let x = X0 + 3; x < X1 - 2; x += 6.5) E.box(x, -1.16, Z1 - 2.2, 1.6, .05, .12, [0.75, 0.95, 1.2], { mul: 1.3, jit: 0, grad: 1 }); // 樓下還亮著的燈管

  // ── 後牆：一排落地窗＋電梯 ──
  const WZ = Z0 + .15, WT = .3, wins = [[-9.4, -6.6], [-5.5, -2.7], [-1.6, 1.2], [2.3, 5.1], [6.2, 9.0]], EL = [12.55, 14.95];
  const inWin = x => wins.find(w => x > w[0] && x < w[1]);
  for (let x = X0; x < X1 - .01; x += .5) {
    const c = x + .25, top = c > 15.5 ? 1.9 : c > 15 ? 2.9 : 3.8 + (rnd() < .2 ? .12 : 0);
    if (c > EL[0] && c < EL[1]) { B.box(c, 2.75, WZ, .5, top - 2.75, WT, 0x9099a6); continue; }
    if (inWin(c)) { B.box(c, 0, WZ, .5, 1.0, WT, 0x8a93a1); if (top > 2.95) B.box(c, 2.95, WZ, .5, top - 2.95, WT, 0x9099a6); } else B.box(c, 0, WZ, .5, top, WT, 0x9099a6);
  }
  B.box(cx, 0, WZ + .17, sw, .14, .05, 0x3a3f4a, { jit: 0 });                                                         // 踢腳板
  const city = canvasTex(512, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1030'); g.addColorStop(.7, '#2a2a5e'); g.addColorStop(1, '#5b3b6e'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(220,230,255,${.3 + rnd() * .6})`; c.fillRect((rnd() * w) | 0, (rnd() * h * .5) | 0, 1, 1); }
    for (let x = 0; x < w;) {
      const bw = 14 + (rnd() * 26 | 0), bh = 30 + (rnd() * 78 | 0); c.fillStyle = `rgb(${10 + rnd() * 10 | 0},${14 + rnd() * 10 | 0},${34 + rnd() * 14 | 0})`; c.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 4; yy < h - 3; yy += 5) for (let xx = x + 3; xx < x + bw - 3; xx += 4) if (rnd() < .34) { c.fillStyle = rnd() < .75 ? '#ffd98a' : '#9fe6ff'; c.fillRect(xx, yy, 2, 2); }
      x += bw + (rnd() * 3 | 0);
    }
  });
  city.magFilter = THREE.NearestFilter;
  wins.forEach((w, i) => {
    const ww = w[1] - w[0], g = new THREE.PlaneGeometry(ww, 1.95), uv = g.attributes.uv, u0 = i / wins.length, u1 = (i + 1) / wins.length;
    for (let k = 0; k < 4; k++) uv.setX(k, uv.getX(k) ? u1 : u0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: city, color: new THREE.Color(1.5, 1.5, 1.7) })); m.position.set((w[0] + w[1]) / 2, 1.975, WZ - .1); scene.add(m);
    B.box((w[0] + w[1]) / 2, 0.98, WZ + .08, ww + .2, .07, .5, 0x2e333d, { jit: 0 });
    B.box((w[0] + w[1]) / 2, 2.93, WZ, ww + .2, .07, .36, 0x2e333d, { jit: 0 });
    for (const mx of [w[0], (w[0] + w[1]) / 2, w[1]]) B.box(mx, 1.0, WZ, .08, 1.95, .34, 0x2e333d, { jit: 0 });
    B.box((w[0] + w[1]) / 2, 1.95, WZ, ww, .05, .3, 0x2e333d, { jit: 0 });
  });
  // 電梯：光從門裡灑出來，敵人從這裡進場
  const ex = (EL[0] + EL[1]) / 2;
  B.box(ex, -1.0, Z0 - 1.25, 3.3, 5.1, 2.5, 0x6f7783, { grad: .55 });
  B.box(ex, 0.0, Z0 - 1.15, 2.4, 0.03, 2.3, 0xaab3bd);
  // （電梯箱體是實心的，門口用一塊發光的面板做出「裡面很亮」）
  E.box(ex, 0.02, WZ - .12, EL[1] - EL[0] - .5, 2.7, .04, [0.78, 0.95, 1.25], { mul: 2.6, jit: 0, grad: .75 });
  B.box(EL[0] + .16, 0, WZ + .02, .34, 2.7, .12, 0xb9c1ca); B.box(EL[1] - .16, 0, WZ + .02, .34, 2.7, .12, 0xb9c1ca);
  B.box(ex, 2.7, WZ + .1, EL[1] - EL[0] + .3, .12, .5, 0x39404b, { jit: 0 }); B.box(EL[0] - .1, 0, WZ + .1, .12, 2.8, .5, 0x39404b, { jit: 0 }); B.box(EL[1] + .1, 0, WZ + .1, .12, 2.8, .5, 0x39404b, { jit: 0 });
  E.box(ex, 2.98, WZ + .17, .62, .2, .03, [1.3, 0.55, 0.15], { mul: 2.6, jit: 0, grad: 1 });
  point(0xbfe2ff, 34, 13, ex, 1.7, Z0 + 1.0, 0.03);

  // ── 左牆：白板、販賣機、下班的門 ──
  const LX = X0 + .15;
  for (let z = Z0 + .3; z < Z1 - .01; z += .5) {
    const c = z + .25, top = c < -4.2 ? 3.8 : c < -1 ? 3.2 : c < 1.9 ? 2.7 : c < 4.2 ? 3.0 : c < 4.6 ? 1.7 : 1.0;
    if (c > 2.5 && c < 3.9) { B.box(LX, 2.3, c, WT, top - 2.3, .5, 0x8f98a5); continue; }
    B.box(LX, 0, c, WT, top, .5, 0x8f98a5);
  }
  B.box(LX + .17, 0, cz, .05, .14, sd, 0x3a3f4a, { jit: 0 });
  B.box(LX + .2, 1.1, -2.6, .06, 1.25, 2.3, 0xe4e9ee, { jit: 0, grad: .95 }); B.box(LX + .2, 1.04, -2.6, .1, .06, 2.4, 0x7b838f, { jit: 0 });
  for (let i = 0; i < 7; i++) B.box(LX + .24, 1.35 + rnd() * .8, -3.5 + rnd() * 1.8, .02, .04, .25 + rnd() * .5, [0x2f6fd0, 0xd0452f, 0x2e9a57, 0x333333][i % 4], { jit: 0 });
  for (let i = 0; i < 4; i++) B.box(LX + .2, 1.2 + (i % 2) * .55, .1 + i * .42 - .6, .04, .46, .36, [0xf2d06b, 0xe98a6a, 0x9fd0e8, 0xcfe3a0][i], { jit: .03 });
  E.box(LX - .02, 0.02, 3.2, .04, 2.26, 1.3, [0.75, 1.15, 0.9], { mul: 1.5, jit: 0, grad: .8 });                      // 門外走廊的光
  B.box(LX + .1, 0, 2.48, .2, 2.36, .1, 0x39404b, { jit: 0 }); B.box(LX + .1, 0, 3.92, .2, 2.36, .1, 0x39404b, { jit: 0 }); B.box(LX + .1, 2.28, 3.2, .2, .1, 1.5, 0x39404b, { jit: 0 }); B.box(LX + .1, 0, 3.2, .12, 2.3, .05, 0x39404b, { jit: 0 });
  E.box(LX + .22, 2.5, 3.2, .05, .26, .86, [0.25, 1.4, 0.55], { mul: 2.4, jit: 0, grad: 1 });                         // EXIT
  // 販賣機
  B.box(X0 + .85, 0, -6.3, 1.0, 2.15, 1.3, 0xa63a34); B.box(X0 + 1.33, 0.1, -6.3, .06, .35, 1.0, 0x2a2d35, { jit: 0 });
  E.box(X0 + 1.37, 0.62, -6.42, .03, 1.38, .92, [1.25, 1.0, 0.78], { mul: 1.7, jit: 0, grad: .9 });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) B.box(X0 + 1.4, 0.72 + r * .32, -6.78 + k * .24, .03, .2, .12, [0xd0452f, 0x2f6fd0, 0x2e9a57, 0xf2c84b, 0xffffff][(r * 3 + k) % 5], { jit: .1 });
  // 飲水機
  B.box(X0 + .7, 0, -7.75, .55, 1.15, .55, 0xe6e9ec); B.box(X0 + .7, 1.15, -7.75, .4, .5, .4, 0x7fb5e6, { jit: 0 });

  // ── 12 個工位 ──
  const LM = new THREE.MeshLambertMaterial({ vertexColors: true }), EM = new THREE.MeshBasicMaterial({ vertexColors: true }); out.desks = [];
  const desk = (sx, sz, k) => {
    const On = new Build(rnd), Off = new Build(rnd);
    const z = sz - .82, wood = k % 2 ? 0xb07a48 : 0xa56f40;
    B.box(sx, 0, sz - 1.22, 2.36, .8, .08, 0x5b7391); B.box(sx, .8, sz - 1.22, 2.4, .05, .12, 0xc9d2dc, { jit: 0 });     // 隔板（矮一點，才不會擋到後面的走道）
    B.box(sx - 1.2, 0, z - .02, .08, .8, .86, 0x5b7391);
    B.box(sx, .74, z, 1.95, .07, .78, wood, { grad: 1 }); B.box(sx - .93, 0, z, .06, .74, .72, 0x7a5232); B.box(sx + .93, 0, z, .06, .74, .72, 0x7a5232);
    B.box(sx + .62, .06, z, .5, .62, .66, 0x8b939e);
    B.box(sx + .42, .81, z - .2, .1, .16, .08, 0x1c1f26, { jit: 0 }); B.box(sx + .42, .95, z - .18, .76, .5, .05, 0x15171d, { jit: 0, grad: 1 });
    On.box(sx + .42, .99, z - .15, .68, .42, .012, [0.5, 0.82, 1.5], { mul: 1.25 + rnd() * .5, jit: 0, grad: .8 });
    B.box(sx + .42, .81, z + .16, .52, .03, .17, 0x2c3038, { jit: 0 });
    B.box(sx - .68, .81, z - .16, .22, .03, .22, 0x23262d, { jit: 0 }); B.box(sx - .68, .84, z - .16, .045, .5, .045, 0xb99a4a, { jit: 0 });
    B.box(sx - .62, 1.3, z - .1, .46, .13, .28, 0x1f7a60, { jit: .02, grad: 1 });
    On.box(sx - .62, 1.275, z - .1, .38, .03, .2, [1.5, 1.05, 0.5], { mul: 4.2, jit: 0, grad: 1 });
    Off.box(sx, .44, sz - .05, .56, .1, .54, 0x2f3540); Off.box(sx, .54, sz + .2, .56, .62, .08, 0x2f3540); Off.box(sx, 0, sz - .05, .1, .44, .1, 0x1c1f26, { jit: 0 }); Off.box(sx, 0, sz - .05, .5, .05, .5, 0x1c1f26, { jit: 0 });
    const mOn = new THREE.Mesh(On.geo(), EM), mOff = new THREE.Mesh(Off.geo(), LM); mOn.visible = false; mOff.castShadow = true; scene.add(mOn, mOff);
    const l = point(0xffb866, 0, 10, sx - .55, 1.12, z + .08, 0.035), lamp = { light: l, base: 0, ph: rnd() * 9, x: sx - .55, y: 1.2, z: z + .3, c: [1.0, 0.72, 0.36], k: 0 };
    out.lamps.push(lamp);
    out.desks.push({ set(v) { mOn.visible = v; mOff.visible = !v; lamp.base = v ? 23 : 0; lamp.k = v ? .5 : 0; l.intensity = lamp.base; } });
    B.box(sx - .2 + rnd() * .16, .81, z + .05, .3, .03 + rnd() * .12, .4, 0xece6d4, { ry: rnd() * .5 - .25 });
    if (rnd() < .7) B.box(sx + .02, .81, z - .22, .11, .13, .11, [0xd0452f, 0xf2c84b, 0x4fa3d9, 0xe9e2d0][k % 4], { jit: 0 });
    if (rnd() < .5) { B.box(sx - .3, .81, z - .24, .16, .12, .16, 0xb5653a); for (let i = 0; i < 5; i++) B.box(sx - .3 + rnd() * .14 - .07, .93 + rnd() * .1, z - .24 + rnd() * .14 - .07, .1, .14, .1, 0x4f9a55, { ry: rnd() * 3 }); }
  };
  out.slots.forEach((s, i) => desk(s[0], s[1], i));

  // ── 打卡機：全場最亮的一盞（大家要守住的東西）──
  const [kx, kz] = W(322, 425);
  B.box(kx, 0, kz, 1.1, .12, .9, 0x39404b); B.box(kx, .12, kz, .62, 1.3, .46, 0x4a5362); B.box(kx, 1.42, kz, .98, .84, .56, 0x262a33, { grad: 1 });
  E.box(kx, 1.52, kz + .285, .78, .62, .02, [1.5, 0.95, 0.3], { mul: 3.2, jit: 0, grad: .85 });
  E.box(kx + .495, 1.52, kz, .02, .62, .4, [1.5, 0.95, 0.3], { mul: 2.2, jit: 0, grad: .85 });
  B.box(kx, 2.26, kz, .07, .4, .07, 0x8a93a1, { jit: 0 }); E.box(kx, 2.62, kz, .26, .26, .26, [0.4, 1.5, 0.6], { mul: 4, jit: 0, grad: 1 });
  out.clockPos = [kx, kz]; out.clockBase = 20; out.clockLight = point(0xffb14a, out.clockBase, 10, kx + .7, 1.7, kz + .9, 0.05);
  out.lamps.push({ light: { intensity: 0 }, base: 0, ph: 0, x: kx, y: 1.8, z: kz + .5, c: [1.0, 0.65, 0.25], k: 0.8 });

  // ── 其他擺設 ──
  const plant = (x, z, s = 1) => {
    B.box(x, 0, z, .55 * s, .5 * s, .55 * s, 0xb5653a); B.box(x, .5 * s, z, .47 * s, .05, .47 * s, 0x3b2a20, { jit: 0 });
    for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, r = rnd() * .42 * s, h = .5 * s + rnd() * 1.25 * s; B.box(x + Math.cos(a) * r, h, z + Math.sin(a) * r, (.2 + rnd() * .22) * s, (.16 + rnd() * .2) * s, (.2 + rnd() * .22) * s, rnd() < .5 ? 0x3f8a4c : 0x57a85e, { ry: rnd() * 3, jit: .14 }); }
    B.box(x, .5 * s, z, .07, .9 * s, .07, 0x5a4630, { jit: 0 });
  };
  plant(11.7, -7.7, 1.1); plant(X0 + .8, 4.3, 1.15); plant(15.2, 4.3, 1.2); plant(9.5, 4.3, .9); plant(-9.9, -4.6, .9);
  for (const [fx, fw] of [[-4.1, 2.4], [-.2, 1.6], [3.7, 2.4], [7.6, 1.6]]) {                                          // 窗下的檔案櫃
    for (let x = fx - fw / 2 + .4; x < fx + fw / 2; x += .8) { B.box(x, 0, Z0 + .75, .78, .92, .6, 0x8b95a2); B.box(x, .55, Z0 + 1.06, .3, .04, .03, 0x4a4f5a, { jit: 0 }); B.box(x, .22, Z0 + 1.06, .3, .04, .03, 0x4a4f5a, { jit: 0 }); }
    if (rnd() < .8) B.box(fx + rnd() * .6 - .3, .92, Z0 + .75, .4, .1 + rnd() * .25, .32, 0xece6d4, { ry: rnd() * .4 });
    if (rnd() < .6) B.box(fx - fw / 2 + .5, .92, Z0 + .72, .3, .34, .26, 0xb08a57);
  }
  B.box(10.6, 0, -7.55, 1.15, 1.02, .85, 0xd9dde2); B.box(10.6, 1.02, -7.6, 1.2, .14, .8, 0xbfc5cc); B.box(10.6, .5, -7.1, .7, .06, .12, 0x3a3f4a, { jit: 0 }); // 影印機
  E.box(10.95, 1.17, -7.3, .16, .02, .08, [0.3, 1.5, 0.5], { mul: 2.5, jit: 0, grad: 1 });
  const [mx, mz] = [13.7, 1.9];                                                                                       // 會議桌
  B.box(mx, .72, mz, 2.7, .09, 1.35, 0xc28a55, { grad: 1 }); for (const [dx, dz] of [[-1.2, -.5], [1.2, -.5], [-1.2, .5], [1.2, .5]]) B.box(mx + dx, 0, mz + dz, .1, .72, .1, 0x3a3f4a, { jit: 0 });
  for (const [dx, dz, ry] of [[-.7, -1.05, 0], [.7, -1.05, 0], [-.7, 1.05, Math.PI], [.7, 1.05, Math.PI]]) { B.box(mx + dx, .42, mz + dz, .52, .09, .52, 0x394150); B.box(mx + dx, .51, mz + dz - Math.cos(ry) * .24, .52, .6, .08, 0x394150); B.box(mx + dx, 0, mz + dz, .09, .42, .09, 0x1c1f26, { jit: 0 }); }
  B.box(mx - .5, .81, mz, .5, .02, .34, 0x9aa3ad, { ry: .2 }); E.box(mx - .5, .83, mz - .17, .46, .3, .012, [0.5, 0.82, 1.5], { mul: .9, jit: 0, grad: .8, ry: .2 });
  B.box(mx + .5, .81, mz + .1, .34, .05, .44, 0xece6d4, { ry: -.3 });
  for (const [bx, bz, n] of [[15.2, -2.4, 3], [14.5, -2.9, 2], [15.3, -3.4, 1], [-9.9, 1.2, 2], [11.9, 4.2, 2]]) for (let i = 0; i < n; i++) B.box(bx + rnd() * .1, i * .5, bz + rnd() * .1, .72, .5, .56, 0xb48d5a, { ry: rnd() * .3 - .15 }); // 紙箱
  B.box(-9.85, 0, 2.2, .36, .5, .36, 0x4a5362); B.box(15.3, 0, -.6, .36, .5, .36, 0x4a5362);                           // 垃圾桶
  for (let i = 0; i < 26; i++) { const x = X0 + 1 + rnd() * (sw - 2), z = Z0 + 1.4 + rnd() * (sd - 2); B.box(x, 0.02, z, .22, .008, .3, 0xece6d4, { ry: rnd() * 3, jit: .04, grad: 1 }); } // 掉在地上的公文

  const stat = new THREE.Mesh(B.geo(), new THREE.MeshLambertMaterial({ vertexColors: true })); stat.castShadow = stat.receiveShadow = true; scene.add(stat);
  const sm = new THREE.MeshLambertMaterial({ vertexColors: true });
  sm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vec3(0.05, 0.065, 0.11);'); };
  const strata = new THREE.Mesh(S.geo(), sm); strata.receiveShadow = true; scene.add(strata);
  const emis = new THREE.Mesh(E.geo(), new THREE.MeshBasicMaterial({ vertexColors: true })); scene.add(emis);
  return out;
}
