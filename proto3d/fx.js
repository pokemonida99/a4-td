// 準時下班防衛戰 3D 版｜攻擊特效
// 做法：只有十來種簡單形狀（圈、圓片、光柱、球、月牙、星芒、尖刺、紙張），每個特效是幾個形狀照時間放大、淡掉。
// 形狀用完就收回去重用，不會越打越慢。每位同事的招式長什麼樣子寫在下面的「招式」那一段。
import * as THREE from 'three';

const rnd = Math.random, TAU = Math.PI * 2;
const flat = g => g.rotateX(-Math.PI / 2);
function shape(pts) {            // 把一圈點（XY 平面）接成一片，中心在原點
  const pos = [0, 0, 0], idx = []; for (const [x, y] of pts) pos.push(x, y, 0);
  for (let i = 1; i <= pts.length; i++) idx.push(0, i, i % pts.length + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
function crescent(A = 1.15, W = .36, N = 14) {   // 月牙：鼓起來的那一面朝 +x，最厚的地方在原點
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const a = -A + 2 * A * i / N, w = W * Math.cos(Math.PI / 2 * a / A) ** .7; pos.push(Math.cos(a) - .84, Math.sin(a), 0, (1 - w) * Math.cos(a) - .84, (1 - w) * Math.sin(a), 0); }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
const spikes = (n, r0, vary) => shape(Array.from({ length: n * 2 }, (_, i) => { const a = i / (n * 2) * TAU, r = i % 2 ? r0 : 1 - (vary ? (i * 7 % 5) * .07 : 0); return [Math.cos(a) * r, Math.sin(a) * r]; }));
const GEO = {
  ring: flat(new THREE.RingGeometry(.8, 1, 40)), thin: flat(new THREE.RingGeometry(.93, 1, 40)), disc: flat(new THREE.CircleGeometry(1, 28)),
  hex: flat(new THREE.RingGeometry(.86, 1, 6)), tri: flat(new THREE.RingGeometry(.8, 1, 3)),
  pillar: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, .5, 0), ball: new THREE.IcosahedronGeometry(1, 1),
  spike: new THREE.ConeGeometry(.5, 1, 4).translate(0, .5, 0), box: new THREE.BoxGeometry(1, 1, 1),
  cres: crescent(), star: spikes(4, .2), burst: spikes(8, .32, true), paper: new THREE.PlaneGeometry(.34, .44),
};
const EASE = { out: k => 1 - (1 - k) * (1 - k), lin: k => k, in: k => k * k, back: k => Math.sin(Math.min(1, k * 1.25) * Math.PI * .5) * (k > .8 ? 1 - (k - .8) * 2.5 : 1) };
const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
const v3 = v => (typeof v === 'number' ? [v, v, v] : v);

// hooks：{ spark(x,y,z,col,n,sp,up), flash(x,y,z,col,peak,dur), shake(v), project(x,y,z) }
export function makeFX(scene, cam, hooks) {
  const pool = {}, live = [], { spark, flash, shake } = hooks;
  const F = { lite: false, max: 260 };
  // 放一個形狀。o：s0/s1 起訖大小、op 起始濃度、pw 淡掉的快慢、hold 前幾成不淡、delay 晚幾秒、ease、
  //   bill 永遠面向鏡頭（roll 角度、rollV 轉速）、rot/spin、vel/grav/drag、look 朝向某一點、quat、norm 一般混色（紙）、floor 落地就停
  function add(g, x, y, z, col, life, o = {}) {
    if (live.length >= F.max && !o.must) return null;
    const key = g + (o.norm ? 'n' : 'a'); let m = (pool[key] ??= []).pop();
    if (!m) {
      m = new THREE.Mesh(GEO[g], new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: o.norm ? THREE.NormalBlending : THREE.AdditiveBlending }));
      m.frustumCulled = false; m.renderOrder = o.norm ? 3 : 4; scene.add(m);
    }
    m.material.color.setRGB(col[0], col[1], col[2]); m.position.set(x, y, z); m.rotation.set(0, 0, 0); m.visible = false;
    if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    if (o.look) m.lookAt(o.look[0], o.look[1], o.look[2]);
    if (o.quat) m.quaternion.copy(o.quat);
    const e = { m, key, t: -(o.delay || 0), life, s0: v3(o.s0 ?? 1), s1: v3(o.s1 ?? o.s0 ?? 1), op: o.op ?? 1, pw: o.pw ?? 1, hold: o.hold || 0, ease: EASE[o.ease || 'out'], bill: !!o.bill, roll: o.roll || 0, rollV: o.rollV || 0, spin: o.spin, vel: o.vel && o.vel.slice(), grav: o.grav || 0, drag: o.drag || 0, floor: !!o.floor };
    live.push(e); return e;
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i], m = e.m; e.t += dt; if (e.t < 0) continue;
      const k = e.t / e.life; if (k >= 1) { m.visible = false; pool[e.key].push(m); live[i] = live[live.length - 1]; live.pop(); continue; }
      const q = e.ease(k), a = e.s0, b = e.s1; m.visible = true;
      m.scale.set(Math.max(1e-4, a[0] + (b[0] - a[0]) * q), Math.max(1e-4, a[1] + (b[1] - a[1]) * q), Math.max(1e-4, a[2] + (b[2] - a[2]) * q));
      m.material.opacity = e.op * (k <= e.hold ? 1 : Math.pow(1 - (k - e.hold) / (1 - e.hold), e.pw));
      if (e.vel) {
        const v = e.vel; v[1] -= e.grav * dt; if (e.drag) { const d = Math.max(0, 1 - e.drag * dt); v[0] *= d; v[2] *= d; if (v[1] < 0) v[1] *= d; }
        m.position.x += v[0] * dt; m.position.y += v[1] * dt; m.position.z += v[2] * dt;
        if (e.floor && m.position.y < .06) { m.position.y = .06; e.vel = null; e.spin = null; m.rotation.set(-Math.PI / 2, 0, m.rotation.z); }
      }
      if (e.bill) { e.roll += e.rollV * dt; m.quaternion.copy(cam.quaternion); _q.setFromAxisAngle(_z, e.roll); m.quaternion.multiply(_q); }
      else if (e.spin) { m.rotation.x += e.spin[0] * dt; m.rotation.y += e.spin[1] * dt; m.rotation.z += e.spin[2] * dt; }
    }
  }
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k], WHITE = [2.6, 2.6, 2.8];
  // 兩點在畫面上的方向（月牙要朝著飛的方向鼓起來）
  function screenAng(x0, z0, x1, z1) { const a = hooks.project(x0, 1, z0), b = hooks.project(x1, 1, z1); return Math.atan2(-(b[1] - a[1]), b[0] - a[0]); }
  function line(x0, y0, z0, x1, y1, z1, col, w, life, o = {}) {
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0); return add('box', (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, col, life, { look: [x1, y1, z1], s0: [w, w, L], s1: [w * .05, w * .05, L], ease: 'lin', ...o });
  }

  // 大招落下時地上先壓一片暗影，亮的東西才跳得出來（辦公室燈全開時地板很亮）
  const shade = (x, z, r, life = .55, op = .45) => add('disc', x, .065, z, [0, 0, 0], life, { norm: true, s0: r * .8, s1: r, op, pw: 1.5 });

  // ── 招式 ──
  // 小葵：斬擊波飛過去，到了再砍一刀（三級交叉兩刀）
  F.slash = (x, z, tx, tz, col, lv = 1) => {
    const ang = screenAng(x, z, tx, tz), T = .11, dx = tx - x, dz = tz - z;
    add('cres', x + dx * .12, 1.2, z + dz * .12, mul(col, 1.3), T, { bill: true, roll: ang, s0: [.7, 1.2, 1], s1: [1.1, 1.9, 1], vel: [dx * .8 / T, 0, dz * .8 / T], pw: .4, ease: 'lin' });
    const r = ang + 1.2 + rnd() * .6;
    add('cres', tx, 1.15, tz, mul(col, 1.5), .26, { bill: true, roll: r, rollV: -6, s0: 1.3, s1: 2.4, delay: T * .8, pw: 1.4 });
    add('cres', tx, 1.15, tz, WHITE, .15, { bill: true, roll: r + .2, rollV: -6, s0: 1.1, s1: 1.8, delay: T * .8 });
    if (lv >= 2) add('cres', tx, 1.15, tz, mul(col, 1.5), .2, { bill: true, roll: r + 1.7, rollV: 6, s0: 1.3, s1: 2.4, delay: T * .8 + .07, pw: 1.4 });
    spark(tx, 1, tz, col, 4, 2.6);
  };
  // 老油條：出手很快，小小兩道；補刀成功是紅色大叉
  F.stab = (tx, tz, col, ex) => {
    const r = rnd() * TAU;
    add('cres', tx, 1.05, tz, ex ? [3, .5, .35] : mul(col, 1.2), ex ? .24 : .11, { bill: true, roll: r, rollV: -9, s0: ex ? 1.5 : .8, s1: ex ? 2.8 : 1.3, pw: 1.3 });
    if (ex) { add('cres', tx, 1.05, tz, [3, .5, .35], .24, { bill: true, roll: r + 1.57, rollV: 9, s0: 1.5, s1: 2.8, delay: .05, pw: 1.3 }); shade(tx, tz, 1.4, .35); add('ring', tx, .08, tz, [2.2, .35, .25], .3, { s0: .3, s1: 1.6 }); spark(tx, 1, tz, [2, .5, .3], 10, 3.4); }
    else spark(tx, 1, tz, col, 2, 2);
  };
  // 阿強：一拳的衝擊波＋地面震波＋碎塊
  F.punch = (x, z, tx, tz, col, stun) => {
    line(x, 1.2, z, tx, 1.1, tz, mul(col, 1.4), .42, .14); shade(tx, tz, 1.7, .4);
    add('burst', tx, 1.15, tz, mul(col, 1.7), .2, { bill: true, roll: rnd() * TAU, s0: .7, s1: 2.7, delay: .04, pw: 1.3 });
    add('burst', tx, 1.15, tz, WHITE, .12, { bill: true, roll: rnd() * TAU, s0: .4, s1: 1.6, delay: .04 });
    add('ring', tx, .08, tz, mul(col, 1.4), .36, { s0: .3, s1: 2.0, delay: .04 });
    for (let i = 0; i < (F.lite ? 3 : 6); i++) { const a = rnd() * TAU, v = 2 + rnd() * 2.5; add('box', tx, .5, tz, mul(col, .9), .5, { s0: .14, s1: .06, vel: [Math.cos(a) * v, 4 + rnd() * 3, Math.sin(a) * v], grav: 18, spin: [9, 7, 5], delay: .04, hold: .6 }); }
    if (stun) for (let i = 0; i < 3; i++) add('star', tx + (i - 1) * .45, 2.3 + (i % 2) * .2, tz, [2.4, 2.1, .5], .55, { bill: true, rollV: 6, s0: .1, s1: .34, ease: 'back', delay: .08 + i * .06, hold: .6 });
    shake(.1); flash(tx, 1.2, tz, col, 9, .16);
  };
  // 阿哲：風槍一路穿過去，沿路一圈一圈的風
  F.lance = (x, z, ex, ez, col, hits = []) => {
    const dx = ex - x, dz = ez - z, L = Math.hypot(dx, dz) || 1; _d.set(dx / L, -.06, dz / L).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(UP, _d);
    line(x, 1.3, z, ex, 1.0, ez, mul(col, 1.5), .32, .26); line(x, 1.3, z, ex, 1.0, ez, WHITE, .12, .16);
    const n = F.lite ? 3 : 6; for (let i = 0; i < n; i++) { const k = (i + .6) / n; add('thin', x + dx * k, 1.3 - .3 * k, z + dz * k, mul(col, 1.4), .36, { quat: q, s0: .15, s1: .8 + .5 * k, delay: i * .022, pw: 1.3 }); }
    add('spike', ex, 1.0, ez, mul(col, 1.4), .2, { quat: q, s0: [.3, .9, .3], s1: [.05, 1.6, .05] });
    for (const [hx, hz] of hits) { add('star', hx, 1.15, hz, mul(col, 1.6), .2, { bill: true, roll: rnd() * TAU, s0: .4, s1: 1.6 }); spark(hx, 1.1, hz, col, 4, 2.6); }
  };
  // 飛行道具拖的尾巴（火球、水彈）
  F.trail = (x, y, z, col, s = .2) => { if (!F.lite) add('ball', x, y, z, col, .2, { s0: s, s1: .02, ease: 'lin', op: .8 }); };
  // 阿傑：火球炸開；升級後有火柱和一片焦痕
  F.fireHit = (x, z, r, col) => {
    const big = r > .8, R = Math.max(.8, r);
    if (big) shade(x, z, r * 1.25, .7);
    add('ball', x, .9, z, [2.2, .7, .12], .22, { norm: true, s0: .3, s1: R * .8, op: .85, pw: 1.2 });
    add('ball', x, .9, z, mul(col, 1.3), .3, { s0: .4, s1: R * 1.2, pw: 1.7 }); add('ball', x, .9, z, [2.8, 2.3, 1.2], .16, { s0: .2, s1: R * .6 });
    add('ring', x, .08, z, mul(col, 1.2), .34, { s0: .3, s1: R * 1.15 });
    if (big) {
      add('pillar', x, 0, z, mul(col, 1.1), .36, { s0: [r * .55, .5, r * .55], s1: [r * .18, 4.2, r * .18], pw: 1.2 });
      add('disc', x, .07, z, [.9, .26, .08], 1.0, { s0: r * .85, s1: r, op: .5, pw: 2 });
      for (let i = 0; i < (F.lite ? 2 : 5); i++) { const a = rnd() * TAU, d = rnd() * r * .8; add('spike', x + Math.cos(a) * d, 0, z + Math.sin(a) * d, mul(col, 1.3), .4, { s0: [.3, 0, .3], s1: [.24, 1.1 + rnd() * 1.1, .24], ease: 'back', delay: .04 + rnd() * .1, pw: .5 }); }
      spark(x, .8, z, col, 16, 4, 3.5); shake(.05 + r * .03); flash(x, 1.2, z, col, 16, .22);
    } else { spark(x, 1, z, col, 6, 2.8, 2); flash(x, 1.1, z, col, 6, .12); }
  };
  // 許許：燃燒瓶砸地，留一灘火
  F.poolFire = (x, z, r, col) => {
    add('ball', x, .5, z, mul(col, 1.2), .2, { s0: .25, s1: r * .8, pw: 1.6 });
    add('disc', x, .07, z, [1.1, .4, .1], 1.5, { s0: r * .5, s1: r, op: .5, pw: 2.2 }); add('thin', x, .08, z, mul(col, 1.1), .35, { s0: .3, s1: r * 1.1 });
    for (let i = 0; i < (F.lite ? 3 : 7); i++) { const a = rnd() * TAU, d = rnd() * r * .85; add('spike', x + Math.cos(a) * d, 0, z + Math.sin(a) * d, mul(col, 1.25), .45, { s0: [.26, 0, .26], s1: [.16, .6 + rnd() * .7, .16], ease: 'back', delay: rnd() * 1.0, pw: .5 }); }
    spark(x, .5, z, [.7, 1.5, .8], 5, 3, 2); flash(x, .8, z, col, 6, .15);
  };
  // 小燕：水彈濺開，水柱、水珠、漣漪
  F.waterHit = (x, z, col, wet) => {
    add('pillar', x, 0, z, mul(col, 1.2), .28, { s0: [.4, .2, .4], s1: [.12, 2.6, .12], pw: 1.2 });
    add('ring', x, .08, z, mul(col, 1.4), .32, { s0: .2, s1: 1.3 }); add('thin', x, .08, z, mul(col, 1.0), .46, { s0: .3, s1: 2.0, delay: .08 });
    for (let i = 0; i < (F.lite ? 3 : 7); i++) { const a = rnd() * TAU, v = 1.2 + rnd() * 2; add('ball', x, .8, z, mul(col, 1.3), .5, { s0: .1, s1: .05, vel: [Math.cos(a) * v, 3 + rnd() * 3, Math.sin(a) * v], grav: 15, hold: .6 }); }
    if (wet) add('disc', x, .07, z, mul(col, .45), .7, { s0: .5, s1: .95, op: .6, pw: 1.6 });
    flash(x, 1, z, col, 5, .12);
  };
  // 黑輪：名片打中，掉幾個金光
  F.cardHit = (x, z, col) => { add('star', x, 1.2, z, mul(col, 1.5), .16, { bill: true, roll: rnd() * TAU, s0: .25, s1: .85 }); spark(x, 1.2, z, [1.7, 1.4, .4], 3, 2.2, 2.5); };
  // 學姊：狙擊。開槍先有一條瞄準線，打中是大十字閃光
  F.tracer = (x, z, tx, tz, col) => { line(x, 1.5, z, tx, 1.1, tz, mul(col, 1.6), .07, .16); add('star', x, 1.6, z, WHITE, .14, { bill: true, s0: .3, s1: .9 }); };
  F.snipeHit = (x, z, col) => {
    shade(x, z, 1.6, .4);
    add('star', x, 1.2, z, WHITE, .26, { bill: true, s0: [.5, .5, 1], s1: [3.6, 3.6, 1], pw: 1.6 }); add('star', x, 1.2, z, mul(col, 1.6), .2, { bill: true, roll: .785, s0: .3, s1: 1.5 });
    add('pillar', x, 0, z, mul(col, 1.3), .2, { s0: [.16, 5, .16], s1: [.02, 5, .02] }); add('thin', x, .08, z, mul(col, 1.3), .32, { s0: .3, s1: 1.7 });
    spark(x, 1.1, z, col, 10, 3.6); flash(x, 1.2, z, col, 14, .16); shake(.07);
  };
  // 小米、Kevin：出手前地上先出現魔法陣（讓玩家知道要炸哪裡），0.4 秒後落下
  F.circle = (x, z, tx, tz, r, col) => {
    add('hex', tx, .08, tz, mul(col, .95), .44, { s0: r * .96, s1: r * .96, spin: [0, 4, 0], pw: .25, must: true });
    add('tri', tx, .085, tz, mul(col, .8), .44, { s0: r * .62, s1: r * .62, spin: [0, -6, 0], pw: .25 });
    add('thin', tx, .09, tz, mul(col, 1.1), .42, { s0: r * 1.6, s1: r, ease: 'lin', op: .9, pw: .2 });
    add('thin', x, .08, z, mul(col, 1.1), .36, { s0: 1.0, s1: .3, ease: 'lin' }); spark(x, 1.7, z, col, 6, 1.2, 3);
  };
  F.lightBlast = (x, z, r, col) => {
    shade(x, z, r * 1.5, .7, .5);
    add('pillar', x, 0, z, mul(col, 1.15), .36, { s0: [r * .62, 11, r * .62], s1: [r * .06, 11, r * .06], ease: 'in', pw: .7, must: true });
    add('pillar', x, 0, z, [3, 3, 2.5], .26, { s0: [r * .3, 11, r * .3], s1: [.02, 11, .02], ease: 'in', pw: .6 });
    add('disc', x, .08, z, mul(col, 1.1), .24, { s0: r * .9, s1: r, op: .8 }); add('ring', x, .09, z, mul(col, 1.4), .42, { s0: r * .4, s1: r * 1.25 }); add('thin', x, .09, z, mul(col, 1.0), .5, { s0: r * .5, s1: r * 1.7, delay: .08 });
    for (let i = 0; i < (F.lite ? 2 : 5); i++) { const a = rnd() * TAU, d = rnd() * r * .9; add('star', x + Math.cos(a) * d, .6 + rnd() * 1.4, z + Math.sin(a) * d, WHITE, .32, { bill: true, s0: .05, s1: .5 + rnd() * .4, ease: 'back', delay: .05 + rnd() * .2, rollV: 3 }); }
    spark(x, .6, z, col, 16, 3, 5); flash(x, 1.6, z, col, 18, .24); shake(.05 + r * .04);
  };
  F.darkBlast = (x, z, r, col, lv = 1) => {
    shade(x, z, r * 1.5, .9, .55);
    add('ball', x, 1, z, mul(col, 1.0), .2, { s0: r * 1.15, s1: .12, ease: 'in', op: .75, pw: .3 });
    add('disc', x, .08, z, mul(col, .5), .8, { s0: r * .9, s1: r, op: .7, pw: 1.6 }); add('ring', x, .09, z, mul(col, 1.3), .42, { s0: r * .3, s1: r * 1.25, delay: .12 });
    add('spike', x, 0, z, mul(col, 1.6), .55, { s0: [.8, 0, .8], s1: [.55, 3.0 + r * .7, .55], ease: 'back', delay: .1, pw: .45, must: true });
    const n = F.lite ? 3 : 4 + lv * 2;
    for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd() * .5, d = r * (.35 + rnd() * .5); add('spike', x + Math.cos(a) * d, 0, z + Math.sin(a) * d, mul(col, 1.4), .5, { s0: [.5, 0, .5], s1: [.32, 1.6 + rnd() * 1.5, .32], ease: 'back', delay: .12 + rnd() * .12, pw: .45, rot: [Math.sin(a) * .35, 0, -Math.cos(a) * .35] }); }
    spark(x, .8, z, col, 14, 3.4, 3); flash(x, 1.3, z, col, 16, .26); shake(.05 + r * .04);
  };
  // 敵人倒下：文件飛得滿地都是（幽靈是一縷煙往上飄）
  F.papers = (x, z, n, ghost) => {
    add('thin', x, .08, z, [1.3, 1.2, 1], .26, { s0: .3, s1: 1.0 + n * .02 });
    if (ghost) { for (let i = 0; i < 4; i++) add('ball', x + (rnd() - .5) * .5, .8, z + (rnd() - .5) * .5, [.9, .45, 1.6], .6 + rnd() * .3, { s0: .3, s1: .05, vel: [(rnd() - .5) * .8, 2 + rnd() * 1.5, (rnd() - .5) * .8], op: .7 }); return; }
    if (F.lite) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = rnd() * TAU, v = 1 + rnd() * 2.6 + n * .03; add('paper', x, .9 + rnd() * .5, z, i % 4 ? [.95, .93, .86] : [.98, .86, .5], .9 + rnd() * .6, { norm: true, vel: [Math.cos(a) * v, 3.5 + rnd() * 3.5, Math.sin(a) * v], grav: 12, drag: 2.4, rot: [rnd() * 6, rnd() * 6, rnd() * 6], spin: [6 + rnd() * 8, 4 + rnd() * 8, rnd() * 8], floor: true, hold: .75, op: .95 }); }
  };
  // 鼠仙女：召喚陣；老鼠咬人是兩排牙
  F.summon = (x, z, col) => { add('hex', x, .08, z, mul(col, 1.3), .5, { s0: .3, s1: 1.0, spin: [0, 5, 0] }); add('pillar', x, 0, z, mul(col, 1.1), .4, { s0: [.5, .1, .5], s1: [.3, 1.8, .3] }); spark(x, .4, z, col, 8, 1.6, 3); };
  F.bite = (x, z) => { for (const s of [1, -1]) add('cres', x, .75 + s * .2, z, [2.4, 2.2, 1.9], .13, { bill: true, roll: s * 1.57, s0: .6, s1: .36, ease: 'lin', hold: .5 }); spark(x, .7, z, [1.5, 1.3, 1], 3, 1.8); };
  // 輔助：一圈往外擴的波（玩家看得出罩到哪裡），被罩到的人腳下亮一圈
  F.pulse = (x, z, r, col, allies = []) => { add('thin', x, .075, z, mul(col, .8), 1.1, { s0: .5, s1: r, op: .7, pw: 1.4 }); for (const [ax, az] of allies) add('thin', ax, .3, az, mul(col, 1.1), .6, { s0: .75, s1: .55, vel: [0, 1.8, 0], delay: .25 + rnd() * .2, op: .8 }); };
  // 升級、派駐、解除異常、喊話
  F.levelUp = (x, z, lv) => {
    const c = [1.7, 1.35, .4]; add('pillar', x, 0, z, c, .55, { s0: [.85, .2, .85], s1: [.55, 3.6, .55], pw: 1.3 });
    for (let i = 0; i < lv; i++) add('ring', x, .08 + i * .02, z, c, .45, { s0: .4, s1: 1.3 + i * .5, delay: i * .1 });
    for (let i = 0; i < lv; i++) add('star', x + (i - (lv - 1) / 2) * .6, 2.6, z, [2.8, 2.3, .8], .7, { bill: true, s0: .1, s1: .55, ease: 'back', delay: .15 + i * .1, vel: [0, .8, 0], hold: .6, rollV: 4 });
    spark(x, 1.2, z, c, 22, 2.8, 3); flash(x, 1.5, z, c, 16, .35);
  };
  F.place = (x, z) => { const c = [1.5, 1.1, .5]; add('ring', x, .08, z, c, .36, { s0: .3, s1: 1.2 }); add('pillar', x, 0, z, c, .32, { s0: [.7, 2.2, .7], s1: [.2, 2.2, .2] }); spark(x, 1, z, c, 16, 2.4); flash(x, 1.4, z, c, 12, .3); };
  F.cure = (x0, z0, x, z, col) => { line(x0, 1.5, z0, x, 1.3, z, mul(col, 1.3), .1, .3); add('ring', x, .08, z, col, .4, { s0: .3, s1: 1.0 }); add('pillar', x, 0, z, col, .45, { s0: [.7, .2, .7], s1: [.5, 2.6, .5] }); spark(x, 1.2, z, col, 16, 2.2, 3); };
  F.cheer = (x, z) => { const c = [1.7, 1.25, .4]; add('ring', x, .08, z, c, .45, { s0: .4, s1: 1.25 }); add('pillar', x, 0, z, mul(c, .8), .5, { s0: [.75, .2, .75], s1: [.6, 2.8, .6] }); spark(x, 1.4, z, c, 8, 2, 3); };
  F.wave = (x, z, r, col) => add('thin', x, .1, z, col, .8, { s0: 1, s1: r, op: .8, pw: 1.3, must: true });
  // 剋屬性打中：多一個十字閃光
  F.crit = (x, z, col) => add('star', x, 1.75, z, mul(col, 1.7), .2, { bill: true, roll: rnd() * .6, s0: .4, s1: 1.6, pw: 1.2 });
  // 敵人放異常
  F.curse = (x0, z0, x, z, col, ice) => { line(x0, 1.6, z0, x, 1.2, z, mul(col, 1.2), .12, .3); add(ice ? 'hex' : 'burst', x, ice ? .08 : 1.4, z, mul(col, 1.3), .4, ice ? { s0: .3, s1: 1.2 } : { bill: true, s0: .3, s1: 1.2 }); spark(x, 1.2, z, col, 14, 2.4); };
  F.line = line; F.add = add; F.update = update;
  F.clear = () => { for (const e of live) { e.m.visible = false; pool[e.key].push(e.m); } live.length = 0; };
  Object.defineProperty(F, 'count', { get: () => live.length });
  return F;
}
