// 3D 方塊小人：三頭身，零件用方塊堆出來，有骨架可以走路、出手、轉身。
// 造型照上班旅人原本的角色（髮型、帽子、服裝、武器），沒有自己加配件。
import * as THREE from 'three';
import { Build, rng } from './office.js';

const rnd = rng(31);
const EMI = new THREE.MeshBasicMaterial({ vertexColors: true });
function litMat() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.userData.self = { value: 0.3 };
  m.onBeforeCompile = sh => { sh.uniforms.uSelf = m.userData.self; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSelf;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uSelf;'); };
  return m;
}
const SKIN = 0xf4c9a4, DARK = 0x2a1c18, WHITE = 0xffffff, STEEL = 0xc3ccd6, WOOD = 0x8a5a34, GOLD = 0xe0aa3e, PAPER = 0xf0ead8;

function part(parent, mat, x, y, z, fn) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const B = new Build(rnd), E = new Build(rnd); fn(B, E);
  if (B.p.length) { const m = new THREE.Mesh(B.geo(), mat); m.castShadow = true; g.add(m); }
  if (E.p.length) g.add(new THREE.Mesh(E.geo(), EMI));
  return g;
}
const J0 = { jit: 0 }, G1 = { jit: 0, grad: 1 };

function hair(B, s, hw, hh, hd) {
  const c = s.hair, st = s.hairStyle || 'short';
  if (st === 'bald') { B.box(-hw / 2 - .02, .28, -.08, .08, .3, hd - .2, c); B.box(hw / 2 + .02, .28, -.08, .08, .3, hd - .2, c); B.box(0, .22, -hd / 2 - .02, hw, .34, .08, c); return; }
  B.box(0, hh - .2, -.03, hw + .1, .24, hd + .12, c); B.box(0, hh + .04, -.03, hw - .12, .09, hd - .1, c);   // 頭頂（兩層，圓一點）
  B.box(0, .12, -hd / 2 - .03, hw + .1, hh - .25, .16, c);                              // 後腦
  B.box(-hw / 2 - .03, .3, -.06, .12, hh - .45, hd - .08, c); B.box(hw / 2 + .03, .3, -.06, .12, hh - .45, hd - .08, c);
  B.box(0, hh - .32, hd / 2 + .02, hw + .04, .18, .1, c);                               // 瀏海
  B.box(-.34, hh - .5, hd / 2 + .02, .2, .22, .08, c); B.box(.34, hh - .5, hd / 2 + .02, .2, .22, .08, c);
  if (st === 'bob') { B.box(-hw / 2 - .03, .02, -.04, .13, .34, hd - .04, c); B.box(hw / 2 + .03, .02, -.04, .13, .34, hd - .04, c); B.box(0, -.02, -hd / 2 - .03, hw + .1, .2, .16, c); }
  if (st === 'long') { B.box(0, -.62, -hd / 2 - .06, hw + .06, .78, .2, c); B.box(-hw / 2 - .04, -.3, -.1, .14, .66, .34, c); B.box(hw / 2 + .04, -.3, -.1, .14, .66, .34, c); }
  if (st === 'pony') { B.box(0, .42, -hd / 2 - .16, .2, .18, .2, s.tie || 0xd0452f, J0); B.box(0, -.02, -hd / 2 - .3, .3, .52, .3, c); B.box(0, -.26, -hd / 2 - .34, .22, .3, .22, c); }
  if (st === 'curly') for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28, r = hw / 2 + .06; B.box(Math.cos(a) * r, .34 + (i % 3) * .2, Math.sin(a) * r * .95 - .04, .26, .26, .26, c, { ry: a, jit: .1 }); }
  if (st === 'spiky') for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; B.box(Math.cos(a) * .3, hh + .02 + (i % 2) * .05, Math.sin(a) * .3 - .03, .2, .2 + (i % 3) * .06, .2, c, { ry: a + .5, jit: .08 }); }
}
function hat(B, E, s, hw, hh, hd) {
  const h = s.hat, c = s.hatCol;
  if (h === 'beret') { B.box(0, hh + .02, -.02, hw + .24, .14, hd + .24, c); B.box(.08, hh + .14, -.04, hw - .06, .12, hd - .06, c); B.box(.1, hh + .26, -.04, .12, .08, .12, c); }
  if (h === 'wizard') { B.box(0, hh - .04, 0, hw + .7, .08, hd + .7, c); B.box(0, hh + .04, 0, .84, .3, .84, c); B.box(0, hh + .04, 0, .88, .1, .88, s.hatBand || GOLD, J0); B.box(.04, hh + .34, -.04, .6, .28, .6, c); B.box(.1, hh + .62, -.1, .38, .26, .38, c); B.box(.2, hh + .86, -.18, .2, .2, .2, c); }
  if (h === 'crown') { B.box(0, hh + .04, 0, .56, .1, .56, GOLD, J0); for (const [x, z] of [[-.22, .22], [.22, .22], [-.22, -.22], [.22, -.22], [0, .26]]) { B.box(x, hh + .14, z, .12, .14, .12, GOLD, J0); E.box(x, hh + .28, z, .06, .06, .06, [1.5, 0.35, 0.4], { mul: 2.2, ...G1 }); } }
  if (h === 'cap') { B.box(0, hh + .02, -.02, hw + .12, .22, hd + .12, c); B.box(0, hh + .02, hd / 2 + .14, hw - .1, .06, .3, c); }
  if (h === 'feather') { B.box(0, hh + .02, -.02, hw + .14, .18, hd + .14, c); B.box(0, hh + .02, hd / 2 + .12, hw - .2, .06, .24, c); B.box(.34, hh + .16, -.1, .08, .5, .22, 0xf3efe2, { ry: .3, jit: 0 }); }
  if (h === 'headband') { B.box(0, hh - .36, 0, hw + .14, .13, hd + .16, c, J0); B.box(.2, hh - .5, -hd / 2 - .16, .1, .34, .1, c, J0); B.box(-.05, hh - .56, -hd / 2 - .2, .1, .4, .1, c, J0); }
  if (h === 'halo') for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; E.box(Math.cos(a) * .36, hh + .34, Math.sin(a) * .36, .14, .06, .14, [0.7, 1.0, 1.5], { mul: 2.4, ry: -a, ...G1 }); }
  if (h === 'phones') { B.box(0, hh + .04, 0, hw + .2, .08, .16, 0x30343c, J0); B.box(-hw / 2 - .09, .26, 0, .12, .34, .34, 0x30343c, J0); B.box(hw / 2 + .09, .26, 0, .12, .34, .34, 0x30343c, J0); }
}
function weapon(B, E, s, side) {
  const w = side > 0 ? s.weapon : s.offhand; if (!w) return;
  const col = s.glow || [1.4, 1.1, 0.5];
  if (w === 'dagger') { B.box(0, -.6, .1, .07, .1, .2, 0x4a3524, J0); B.box(0, -.59, .42, .05, .09, .46, STEEL, G1); }
  if (w === 'staff') { B.box(0, -.92, .16, .08, 1.9, .08, WOOD); B.box(0, .98, .16, .26, .08, .26, GOLD, J0); E.box(0, 1.06, .16, .22, .22, .22, col, { mul: 2.6, ...G1 }); }
  if (w === 'wand') { B.box(0, -.7, .16, .07, 1.25, .07, GOLD); E.box(0, .55, .16, .2, .2, .2, col, { mul: 2.4, ...G1 }); B.box(0, .5, .16, .3, .06, .12, GOLD, J0); }
  if (w === 'spear') { B.box(0, -.94, .16, .07, 2.2, .07, WOOD); E.box(0, 1.26, .16, .12, .34, .12, col, { mul: 2.0, ...G1 }); B.box(0, 1.16, .16, .2, .1, .2, 0xd0452f, J0); }
  if (w === 'sword') { B.box(0, -.6, .1, .08, .1, .2, 0x23262d, J0); B.box(0, -.6, .2, .3, .08, .06, 0x23262d, J0); E.box(0, -.59, .7, .07, .14, .95, col, { mul: 1.9, ...G1 }); }
  if (w === 'shield') { B.box(-.14 * side, -.62, .06, .09, .62, .5, 0x2c313a); E.box(-.2 * side, -.5, .06, .02, .36, .08, s.glow || col, { mul: 1.6, ...G1 }); }
  if (w === 'book') { B.box(0, -.6, .2, .36, .08, .3, s.bookCol || 0x9a2f3c); B.box(0, -.56, .2, .32, .05, .26, PAPER, J0); }
  if (w === 'umbrella') { B.box(0, -.6, .14, .05, 1.75, .05, 0x8a93a1, J0); for (const [x, z, y] of [[0, 0, 0], [-.4, 0, -.07], [.4, 0, -.07], [0, -.4, -.07], [0, .4, -.07], [-.38, -.38, -.13], [.38, -.38, -.13], [-.38, .38, -.13], [.38, .38, -.13]]) B.box(x, 1.12 + y, .14 + z, .44, .06, .44, 0xcfe4f6, { jit: .03, grad: 1 }); }
  if (w === 'hammer') { B.box(0, -.9, .16, .09, 1.6, .09, WOOD); B.box(0, .62, .16, .62, .4, .42, s.hammerCol || 0xc8372d); B.box(0, .56, .16, .68, .08, .48, GOLD, J0); }
  if (w === 'pan') { B.box(0, -.7, .16, .07, .9, .07, 0x30343c, J0); B.box(0, .2, .16, .5, .5, .06, 0x3a3f48); }
  if (w === 'scroll') { B.box(0, -.6, .12, .12, .12, .5, 0xcdb98a, J0); B.box(0, -1.2, .12, .03, .62, .44, PAPER, { jit: 0, grad: .9 }); }
  if (w === 'paper') { B.box(0, -.72, .14, .03, .4, .32, PAPER, { jit: 0, grad: .95 }); }
  if (w === 'stamp') { B.box(0, -.72, .14, .2, .2, .2, WOOD); B.box(0, -.84, .14, .28, .12, .28, 0xc8372d, J0); }
}

export function makeChar(s) {
  const root = new THREE.Group(), mat = litMat(), body = new THREE.Group(); root.add(body); body.scale.setScalar(s.scale || 1);
  const fat = s.fat || 1, legH = s.legH || .4, torH = .56 * (s.tall || 1), torW = .6 * fat, torD = .4 * fat, hw = .8, hh = .74, hd = .76;
  const sleeve = s.sleeve || s.top, bottom = s.bottom || s.top;
  const leg = sx => part(body, mat, sx * .16 * fat, legH, 0, B => { B.box(0, -legH + .08, 0, .23, legH - .08, .25, bottom); B.box(0, -legH, .04, .25, .11, .34, s.shoe || 0x3a2a22, J0); });
  const legL = leg(-1), legR = leg(1);
  const torso = part(body, mat, 0, legH, 0, (B, E) => {
    B.box(0, 0, 0, torW, torH, torD, s.top);
    if (s.robe) { B.box(0, -legH + .1, 0, torW + .16, legH, torD + .14, s.robe); B.box(0, -legH + .1, 0, torW + .2, .08, torD + .18, s.trim || s.robe, J0); }
    if (s.skirt) B.box(0, -.16, 0, torW + .14, .22, torD + .12, s.skirt);
    if (s.belt) B.box(0, .02, 0, torW + .04, .1, torD + .04, s.belt, J0);
    if (s.trim && !s.robe) B.box(0, torH - .3, torD / 2, .12, .3, .03, s.trim, J0);
    if (s.scarf) { B.box(0, torH - .13, 0, torW + .1, .15, torD + .12, s.scarf, J0); B.box(-.2, torH - .5, -torD / 2 - .08, .14, .42, .07, s.scarf, J0); }
    if (s.cape) B.box(0, -legH * .5, -torD / 2 - .06, torW + .16, torH + legH * .5, .07, s.cape);
    if (s.pack) { B.box(0, .06, -torD / 2 - .2, torW - .04, torH - .04, .32, s.pack); B.box(0, torH - .06, -torD / 2 - .2, torW + .02, .16, .2, 0x7fb07a); }
    if (s.tie) B.box(0, torH - .34, torD / 2, .09, .32, .03, s.tieCol || 0xc8372d, J0);
    if (s.armor) { B.box(0, torH - .22, 0, torW + .1, .2, torD + .1, s.armor); B.box(-torW / 2 - .1, torH - .16, 0, .22, .2, .34, s.armor); B.box(torW / 2 + .1, torH - .16, 0, .22, .2, .34, s.armor); }
    if (s.cabinet) for (let i = 0; i < 2; i++) { B.box(0, .04 + i * .3, torD / 2 + .04, torW + .14, .26, .1, 0x8b6b45); B.box(0, .15 + i * .3, torD / 2 + .1, .2, .04, .03, 0x2c2f36, J0); }
  });
  const shY = legH + torH - .05, arm = sx => part(body, mat, sx * (torW / 2 + .11), shY, 0, (B, E) => { B.box(0, -.44, 0, .19, .44, .21, sleeve); B.box(0, -.54, 0, .17, .11, .19, s.glove || SKIN, J0); weapon(B, E, s, sx); });
  const armL = arm(-1), armR = arm(1);
  const head = part(body, mat, 0, legH + torH - .03, 0, (B, E) => {
    B.box(0, .09, 0, hw, hh - .09, hd, s.skin || SKIN, { jit: 0, grad: .95 }); B.box(0, 0, 0, hw - .16, .1, hd - .14, s.skin || SKIN, { jit: 0, grad: .9 });
    if (!s.faceless) {
      for (const sx of [-1, 1]) { B.box(sx * .19, .25, hd / 2, .14, .22, .03, DARK, G1); B.box(sx * .19 + .03, .39, hd / 2 + .014, .06, .07, .02, WHITE, G1); B.box(sx * .31, .16, hd / 2, .12, .06, .02, 0xf0a295, G1); }
      B.box(0, .14, hd / 2, .1, .035, .02, 0x9a5046, G1);
    }
    if (s.glasses) { for (const sx of [-1, 1]) { B.box(sx * .2, .24, hd / 2 + .03, .24, .03, .02, DARK, G1); B.box(sx * .2, .46, hd / 2 + .03, .24, .03, .02, DARK, G1); } B.box(0, .36, hd / 2 + .03, .1, .03, .02, DARK, G1); }
    if (s.beard) { B.box(0, -.14, hd / 2 - .04, .62, .3, .16, s.beard); B.box(0, -.3, hd / 2 - .02, .36, .2, .12, s.beard); B.box(0, .1, hd / 2 + .01, .34, .07, .04, s.beard); }
    hair(B, s, hw, hh, hd); hat(B, E, s, hw, hh, hd);
  });
  if (s.cart) part(body, mat, 0, 0, .95, B => { B.box(0, .2, 0, .9, .5, .8, 0x7a8696); B.box(0, .12, 0, .96, .08, .86, 0x4a4f5a, J0); for (const [x, z] of [[-.4, -.3], [.4, -.3], [-.4, .3], [.4, .3]]) B.box(x, 0, z, .1, .2, .2, 0x1c1f26, J0); for (let i = 0; i < 5; i++) B.box(rnd() * .4 - .2, .7 + i * .07, rnd() * .3 - .15, .42, .07, .5, PAPER, { ry: rnd() - .5 }); B.box(0, .7, -.42, .8, .06, .06, 0x4a4f5a, J0); });
  if (s.ghost) { mat.transparent = true; mat.opacity = .62; mat.userData.self.value = .5; }
  return { root, body, mat, legL, legR, armL, armR, head, torso, spec: s, face: 0 };
}

// mode：'idle'、'walk'、'atk'（p 是 0～1 的出手進度）
export function pose(c, mode, t, p = 0) {
  const s = c.spec, k = s.scale || 1; let by = 0, lean = 0, aL = 0, aR = 0, lL = 0, lR = 0, hz = 0, hx = 0, sq = 1;
  if (mode === 'walk') { const w = Math.sin(t); lL = w * .75; lR = -w * .75; aL = -w * .6; aR = w * (s.weapon ? .22 : .6); by = Math.abs(Math.cos(t)) * .07; hz = w * .04; lean = .1; if (s.cart) { aL = aR = -1.1; lean = .2; } }
  else if (mode === 'idle') { by = Math.sin(t * 2.3) * .025; aL = Math.sin(t * 2.3) * .06; aR = -aL; hz = Math.sin(t * 1.1) * .03; }
  else {
    const up = Math.min(1, p / .38), hit = Math.min(1, Math.max(0, (p - .38) / .14)), back = Math.max(0, (p - .6) / .4);
    aR = -2.7 * (1 - (1 - up) ** 2) + hit * 1.9 + back * .8; lean = -.16 * up + hit * .42 - back * .26; by = Math.sin(Math.min(1, p / .6) * Math.PI) * .16; aL = .5 * up - back * .5; hx = -lean * .5; sq = 1 + .1 * hit * (1 - back);
    if (s.offhand === 'dagger') aL = aR * .9;
  }
  c.body.position.y = by * k; c.body.rotation.x = lean; c.armL.rotation.x = aL; c.armR.rotation.x = aR; c.legL.rotation.x = lL; c.legR.rotation.x = lR; c.head.rotation.z = hz; c.head.rotation.x = hx; c.body.scale.set(k * (2 - sq), k * sq, k * (2 - sq));
}
export function faceTo(c, ang, dt, rate = 12) { let d = ang - c.face; d = Math.atan2(Math.sin(d), Math.cos(d)); c.face += d * Math.min(1, dt * rate); c.root.rotation.y = c.face; }

export const CAST = {
  // 同事
  kui: { hair: 0xe8863a, hairStyle: 'short', hat: 'beret', hatCol: 0xd96a2a, top: 0xb5763a, sleeve: 0xf0e2c8, bottom: 0x6a4a34, belt: 0x4a3324, scarf: 0xc8372d, weapon: 'dagger', offhand: 'dagger', glow: [1.5, 0.8, 0.3] },
  jie: { hair: 0x6a4630, hairStyle: 'short', beard: 0x6a4630, hat: 'wizard', hatCol: 0x6b3a8a, top: 0x7a4a2e, robe: 0x7a4a2e, trim: 0xd9a441, cape: 0x5a2f78, weapon: 'staff', glow: [0.7, 0.9, 1.6] },
  kevin: { hair: 0x1f2026, hairStyle: 'spiky', top: 0x2c313a, armor: 0x444b58, bottom: 0x23262d, shoe: 0x15171c, glove: 0x23262d, weapon: 'sword', offhand: 'shield', glow: [0.3, 1.4, 1.4] },
  yan: { hair: 0x8a3a30, hairStyle: 'pony', tie: 0xe0aa3e, top: 0x2c3a6a, skirt: 0x25305a, bottom: 0xf0e2c8, trim: 0xe0aa3e, weapon: 'wand', glow: [1.5, 1.2, 0.4] },
  zhe: { hair: 0x9a5a30, hairStyle: 'short', top: 0xf2ede2, sleeve: 0xf2ede2, bottom: 0xc8372d, belt: 0xc8372d, trim: 0xc8372d, weapon: 'spear', glow: [1.6, 0.5, 0.3] },
  mi: { hair: 0x23232a, hairStyle: 'bob', hat: 'phones', top: 0xf4efe0, robe: 0xf4efe0, trim: 0xe0aa3e, weapon: 'wand', glow: [0.6, 1.5, 0.9] },
  vivi: { hair: 0xf2c84b, hairStyle: 'long', hat: 'crown', top: 0xd9506a, robe: 0xe0607a, trim: 0xf6d6dc, sleeve: 0xf6d6dc, weapon: 'wand', glow: [1.6, 0.6, 0.9] },
  // 敵人
  foe_minion: { hair: 0x23232a, hairStyle: 'spiky', hat: 'headband', hatCol: 0xc8372d, top: 0x3a3340, bottom: 0x2a2630, belt: 0xc8372d, offhand: 'paper', scale: .86 },
  foe_courier: { hair: 0x8a5a34, hairStyle: 'short', hat: 'feather', hatCol: 0x9a6a3a, top: 0xb5763a, bottom: 0x6a4a34, pack: 0xcdb98a, weapon: 'paper', scale: .84 },
  foe_intern: { hair: 0x8a5a34, hairStyle: 'short', top: 0x5f7a4a, bottom: 0x6a4a34, pack: 0x9a6a3a, scale: .84 },
  foe_knight: { hair: 0x5a5a5a, hairStyle: 'short', hat: 'cap', hatCol: 0x6b5a3a, top: 0x8b6b45, cabinet: true, armor: 0x7a5c3a, bottom: 0x4a3a2a, weapon: 'hammer', hammerCol: 0x8b6b45, fat: 1.25, scale: .98 },
  foe_clerk: { hair: 0x23232a, hairStyle: 'short', top: 0x3a3f4a, bottom: 0x2c3038, tie: true, weapon: 'umbrella', scale: .84 },
  foe_auntie: { hair: 0x9a5a9a, hairStyle: 'curly', top: 0xb03a4a, robe: 0x8a2f3c, weapon: 'book', glasses: true, fat: 1.12, scale: .88 },
  foe_ghost: { hair: 0x23232a, hairStyle: 'short', hat: 'halo', top: 0x2c3038, bottom: 0x23262d, tie: true, tieCol: 0x9fd0e8, ghost: true, scale: .84 },
  foe_cart: { hair: 0x6a4630, hairStyle: 'short', hat: 'cap', hatCol: 0x5f7a4a, top: 0x6f7a4a, bottom: 0x5a4a34, cart: true, scale: .88 },
  foe_patcher: { hair: 0x9a5a30, hairStyle: 'short', top: 0xf2ede2, bottom: 0xcdb98a, weapon: 'paper', offhand: 'paper', scale: .8 },
  foe_chief: { hair: 0x4a4a4a, hairStyle: 'bald', glasses: true, top: 0x7a4a34, sleeve: 0xf2ede2, bottom: 0x3a3028, tie: true, weapon: 'pan', fat: 1.4, scale: 1.15 },
  foe_boss: { hair: 0x6a6a6a, hairStyle: 'bald', beard: 0x8a8a8a, top: 0xb0282a, robe: 0xb0282a, trim: 0xe0aa3e, cape: 0x7a1a20, weapon: 'hammer', offhand: 'scroll', fat: 1.6, scale: 1.5 },
};
