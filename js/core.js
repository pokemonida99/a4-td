// 塔防的規則核心：純計算、不碰畫面（node 的 tools/sim.mjs 也直接拿來跑）。
// 固定步長 step(s, DT)；同一個種子、同一串操作 → 同一個結果。
// 畫面要演的東西（出招、命中、倒下、漏怪）都推進 s.ev，view 每格取走。
import { TOWERS, FOES, WAVES, RULE, MAPS } from './data.js';

export const DT = 1 / 30;
export const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---------- 路線 ----------
function bake(path) {      // 折線 → 每段長度，之後用走過的距離換座標
  const seg = []; let L = 0;
  for (let i = 1; i < path.length; i++) { const [ax, ay] = path[i - 1], [bx, by] = path[i], l = Math.hypot(bx - ax, by - ay); seg.push({ ax, ay, bx, by, l, L0: L }); L += l; }
  return { seg, L };
}
export function posAt(lane, d) {
  const { seg } = lane; let k = seg[seg.length - 1];
  for (const g of seg) if (d <= g.L0 + g.l) { k = g; break; }
  const t = Math.max(0, Math.min(1, (d - k.L0) / k.l));
  return { x: k.ax + (k.bx - k.ax) * t, y: k.ay + (k.by - k.ay) * t, dir: Math.sign(k.bx - k.ax) || 0 };
}

// ---------- 開局 ----------
export function newGame(o = {}) {
  const map = MAPS[o.map || 'office'], rnd = mulberry(o.seed ?? (Date.now() & 0xffffff));
  const s = {
    map, rnd, t: 0, seed: o.seed, speed: 1,
    lanes: map.lanes.map(bake),
    slots: map.slots.map((p, i) => ({ i, x: p[0], y: p[1], tw: null })),
    foes: [], ev: [], uid: 1,
    res: RULE.startRes, resT: 0, lives: RULE.lives, livesMax: RULE.lives,
    sumCost: RULE.sumCost, sums: 0, kills: 0, coin: 0,
    wave: 0, waveT: RULE.firstDelay, spawnQ: [], state: 'play',
    momentum: 0, cds: {}, buffs: [], log: [],
    pool: o.pool || TOWERS.pool,
  };
  return s;
}

// ---------- 玩家操作（每一個都會記到 s.log，重演用） ----------
export function canSummon(s) { return s.state === 'play' && s.res >= s.sumCost && s.slots.some(x => !x.tw); }
export function summon(s, slotI = -1) {
  if (!canSummon(s)) return null;
  const empty = s.slots.filter(x => !x.tw), sl = slotI >= 0 && !s.slots[slotI].tw ? s.slots[slotI] : empty[Math.floor(s.rnd() * empty.length)];
  const id = s.pool[Math.floor(s.rnd() * s.pool.length)];
  s.res -= s.sumCost; s.sums++; s.sumCost = Math.round(RULE.sumCost + RULE.sumStep * s.sums);
  sl.tw = newTower(s, id, 1); s.log.push([s.t, 'summon', sl.i]); s.ev.push({ k: 'summon', slot: sl.i, id });
  return sl;
}
const newTower = (s, id, lv) => ({ uid: s.uid++, id, lv, cd: .4 + s.rnd() * .3, act: 0, face: 1, kills: 0 });

export const canMerge = (s, a, b) => { const A = s.slots[a].tw, B = s.slots[b].tw; return a !== b && A && B && A.id === B.id && A.lv === B.lv && A.lv < RULE.maxLv; };
export function drop(s, a, b) {      // 把 a 拖到 b：同名同級＝合併升級；b 空的＝搬過去；不同的人＝互換
  if (a === b || !s.slots[a].tw) return false;
  const A = s.slots[a], B = s.slots[b];
  if (canMerge(s, a, b)) {
    const lv = B.tw.lv + 1, id = RULE.mergeRandom && lv >= 2 ? B.tw.id : B.tw.id;
    B.tw = newTower(s, id, lv); A.tw = null; s.ev.push({ k: 'merge', slot: b, id, lv }); s.momentum = Math.min(100, s.momentum + RULE.momMerge);
  } else { [A.tw, B.tw] = [B.tw, A.tw]; s.ev.push({ k: 'move', from: a, to: b }); }
  s.log.push([s.t, 'drop', a, b]); return true;
}
export function sell(s, a) {
  const T = s.slots[a].tw; if (!T) return;
  s.res += Math.round(RULE.sellBack * RULE.sumCost * 2 ** (T.lv - 1)); s.slots[a].tw = null; s.ev.push({ k: 'sell', slot: a }); s.log.push([s.t, 'sell', a]);
}

// ---------- 敵人 ----------
function spawn(s, kind, lane, mul) {
  const F = FOES[kind], hp = Math.round(F.hp * mul.hp);
  const f = { uid: s.uid++, kind, lane, d: 0, hp, max: hp, spd: F.spd, armor: F.armor || 0, slow: 0, slowT: 0, burn: 0, burnT: 0, stun: 0, mark: 0, boss: !!F.boss, flags: F.flags || [], hitT: 0, x: 0, y: 0, dir: 1, ph: s.rnd() * 6 };
  const p = posAt(s.lanes[lane], 0); f.x = p.x; f.y = p.y; s.foes.push(f); if (f.boss) s.ev.push({ k: 'boss', kind });
  return f;
}
function nextWave(s) {
  const W = WAVES[s.wave]; if (!W) return;
  const mul = { hp: (W.hpK || 1) * RULE.hpK * (1 + RULE.hpGrow * s.wave) };
  let at = 0;
  for (const g of W.groups) for (let n = 0; n < g.n; n++) { s.spawnQ.push({ at: s.t + at + (g.delay || 0), kind: g.kind, lane: g.lane ?? (n % s.lanes.length), mul }); at += g.gap ?? .8; }
  s.wave++; s.waveT = (W.len || RULE.waveLen); s.ev.push({ k: 'wave', n: s.wave, boss: !!W.boss, name: W.name });
}

export function hurt(s, f, dmg, elem, src) {
  if (f.hp <= 0) return 0;
  const F = FOES[f.kind]; let k = 1;
  if (F.weak && F.weak.includes(elem)) k *= RULE.weakK; else if (F.resist && F.resist.includes(elem)) k *= RULE.resistK;
  if (f.mark > 0) k *= 1 + RULE.markK;
  const d = Math.max(1, Math.round(dmg * k * (1 - f.armor)));
  f.hp -= d; f.hitT = .15; s.ev.push({ k: 'dmg', x: f.x, y: f.y, v: d, weak: k > 1.05, elem });
  if (f.hp <= 0) {
    f.hp = 0; s.kills++; s.coin += F.coin || 1; s.res += F.res || 0; s.momentum = Math.min(100, s.momentum + (f.boss ? 25 : RULE.momKill));
    if (src) src.kills++; s.ev.push({ k: 'die', x: f.x, y: f.y, kind: f.kind, boss: f.boss });
  }
  return d;
}

// ---------- 同事出手 ----------
const inRange = (T, sl, f, r) => (f.x - sl.x) ** 2 + ((f.y - sl.y) * 1.25) ** 2 <= r * r;
function buffOf(s, sl) {      // 旁邊的輔助型同事給的加成
  let atk = 1, spd = 1;
  for (const o of s.slots) { const B = o.tw; if (!B || o === sl) continue; const D = TOWERS[B.id]; if (D.kind !== 'buff') continue; if (Math.hypot(o.x - sl.x, o.y - sl.y) > D.range) continue; atk += D.atkUp * lvK(B.lv); spd += (D.spdUp || 0) * lvK(B.lv); }
  for (const b of s.buffs) { atk += b.atk || 0; spd += b.spd || 0; }
  return { atk, spd };
}
export const lvK = lv => RULE.lvK[lv - 1];
function fire(s, sl) {
  const T = sl.tw, D = TOWERS[T.id];
  if (D.kind === 'buff') return false;
  if (D.kind === 'gen') { s.res += D.gen * lvK(T.lv); s.ev.push({ k: 'gen', slot: sl.i, v: D.gen * lvK(T.lv) }); return true; }
  const B = buffOf(s, sl), r = D.range * (1 + .06 * (T.lv - 1));
  const cand = s.foes.filter(f => f.hp > 0 && inRange(T, sl, f, r) && !(f.flags.includes('fly') && D.ground));
  if (!cand.length) return false;
  cand.sort((a, b) => (D.target === 'strong' ? b.hp - a.hp : b.d - a.d));
  const tgt = cand[0], dmg = D.dmg * lvK(T.lv) * B.atk * RULE.atkK;
  T.face = tgt.x >= sl.x ? 1 : -1; T.act = .45;
  const hitAll = list => list.forEach(f => { hurt(s, f, dmg * (D.splashK ?? 1), D.elem, T); applyFx(s, f, D, T); });
  if (D.kind === 'single') { hurt(s, tgt, dmg, D.elem, T); applyFx(s, tgt, D, T); }
  else if (D.kind === 'splash') hitAll(s.foes.filter(f => f.hp > 0 && Math.hypot(f.x - tgt.x, f.y - tgt.y) <= D.radius));
  else if (D.kind === 'multi') cand.slice(0, D.n + (T.lv - 1)).forEach(f => { hurt(s, f, dmg, D.elem, T); applyFx(s, f, D, T); });
  else if (D.kind === 'aura') hitAll(cand);
  s.ev.push({ k: 'shot', slot: sl.i, id: T.id, x: tgt.x, y: tgt.y, elem: D.elem, kind: D.kind, radius: D.radius });
  return true;
}
function applyFx(s, f, D, T) {
  if (f.hp <= 0) return;
  if (D.slow) { f.slow = Math.max(f.slow, D.slow * (f.boss ? .5 : 1)); f.slowT = Math.max(f.slowT, D.slowT || 1.5); }
  if (D.burn) { f.burn = Math.max(f.burn, D.burn * lvK(T.lv)); f.burnT = 3; }
  if (D.mark) f.mark = Math.max(f.mark, D.mark);
  if (D.stun && !f.boss && s.rnd() < D.stun) f.stun = Math.max(f.stun, .8);
}

// ---------- 一步 ----------
export function step(s, dt = DT) {
  if (s.state !== 'play') return;
  s.t += dt;
  s.resT += dt; while (s.resT >= 1) { s.resT -= 1; s.res += RULE.resPerSec + Math.floor(s.wave / RULE.resRampEvery); }
  // 波次
  if (s.wave < WAVES.length) { s.waveT -= dt; if (s.waveT <= 0 || (s.foes.length === 0 && s.spawnQ.length === 0 && s.wave > 0 && s.waveT < RULE.waveLen - 4)) nextWave(s); }
  for (let i = s.spawnQ.length - 1; i >= 0; i--) if (s.spawnQ[i].at <= s.t) { const q = s.spawnQ[i]; spawn(s, q.kind, q.lane, q.mul); s.spawnQ.splice(i, 1); }
  // 敵人走路
  for (const f of s.foes) {
    if (f.hp <= 0) continue;
    if (f.burnT > 0) { f.burnT -= dt; f.burnAcc = (f.burnAcc || 0) + dt; if (f.burnAcc >= .5) { f.burnAcc = 0; hurt(s, f, f.burn, 'fire'); } }
    if (f.slowT > 0) { f.slowT -= dt; if (f.slowT <= 0) f.slow = 0; }
    if (f.mark > 0) f.mark = Math.max(0, f.mark - dt * 0);
    f.hitT = Math.max(0, f.hitT - dt);
    if (f.stun > 0) { f.stun -= dt; continue; }
    const v = f.spd * (1 - f.slow) * RULE.spdK; f.d += v * dt;
    const L = s.lanes[f.lane]; const p = posAt(L, f.d); f.x = p.x; f.y = p.y; if (p.dir) f.dir = p.dir;
    if (f.d >= L.L) { f.hp = 0; f.leak = true; const F = FOES[f.kind]; s.lives -= F.leak || 1; s.ev.push({ k: 'leak', kind: f.kind, v: F.leak || 1 }); }
  }
  s.foes = s.foes.filter(f => f.hp > 0);
  // 同事
  for (const sl of s.slots) {
    const T = sl.tw; if (!T) continue; const D = TOWERS[T.id];
    T.act = Math.max(0, T.act - dt); T.cd -= dt * buffOf(s, sl).spd;
    if (T.cd <= 0) { if (fire(s, sl)) T.cd += D.rate; else T.cd = 0; }
  }
  for (const b of s.buffs) b.t -= dt; s.buffs = s.buffs.filter(b => b.t > 0);
  for (const k in s.cds) s.cds[k] = Math.max(0, s.cds[k] - dt);
  // 勝負
  if (s.lives <= 0) { s.lives = 0; s.state = 'lose'; s.ev.push({ k: 'lose' }); }
  else if (s.wave >= WAVES.length && !s.spawnQ.length && !s.foes.length) { s.state = 'win'; s.ev.push({ k: 'win' }); }
}
