// 塔防的規則核心：純計算、不碰畫面（node 的 tools/sim.mjs 直接拿來跑）。
// 固定步長 step(s, DT)；同一個種子、同一串操作 → 同一個結果（s.log 可以 replay 重演）。
//
// ===== API（main.js 用）=====
//   newGame({ seed, team, map })   開局。team 預設 DEFAULT_TEAM（6 人）；map 預設 'office'
//   step(s, dt=DT)                 推進一格（DT＝1/30 秒；倍速就多跑幾格）
//   setMap(name, json)             換地圖（office.json：{ path, slots, gate, clock }，1096×442 座標）
//   --- 玩家操作：成功回傳真值、失敗回傳 false／null，成功的都記進 s.log ---
//   canSummon(s) / summon(s)       緊急調派：花 s.sumCost 人力，抽一位放進「報到中」s.pending={id,lv}
//   canPlace(s, i) / place(s, i)   報到中 → 空工位；點到場上同名同級＝直接合併升級
//   discard(s)                     報到中轉派：退回 RULE.discardBack 人力
//   canMerge(s, a, b)              a、b 兩格同名同級且未滿級
//   canDrop(s, a, b) / drop(s,a,b) 拖 a 到 b：能合併＝合併（免費）；否則搬過去／互換＝調位（花 moveCost(s) 預算）
//   moveCost(s)                    這次調位要花多少預算（波間第一次 0）
//   sell(s, i)                     場上同事轉派：退回人力（依職級 RULE.sellBack）
//   callWave(s)                    波間提早開波（每省 1 秒給 1 預算）
//   canUnite(s, key) / useUnite(s, key, x?, y?)   合體技（不給 x,y 就自動挑敵人最多的地方）
//   canSuper(s, i) / useSuper(s, i)               超級化：氣勢 100，指定一人 12 秒
//   replay(opts, log, steps?)      用 newGame 的 opts 和 s.log 重演，回傳最後的 s
//   lvK(lv)、rangeOf(tw)、posAt(lane, d)、dirOf(sl, x, y)
//
// ===== 狀態（view 讀）=====
//   s.state 'play'|'win'|'lose'　s.phase 'break'（波間，s.waveT 倒數）|'fight'（s.waveT=0）
//   s.wave 已開的波數（WAVES[s.wave] 是下一波）　s.lives / s.livesMax　s.res / s.resMax / s.sumCost
//   s.coin 部門預算　s.kills　s.momentum（0～100）　s.freeMove（波間免費調位還在）　s.cds[key] 合體技冷卻
//   s.pending {id, lv} | null　s.unites 這隊能用的合體技（UNITES 的子集）
//   s.slots[i] = { i, x, y, tw }　tw = { uid, id, lv, fatigue(0～3), shield, super(剩餘秒), haste, star, kills }
//   s.foes[]  = { uid, kind, x, y, hp, max, boss, final, hitT, slow, burnT, stun, mark,
//                 guard（舉鍋減傷中）, broken（理虧中）, charge（客訴長卷蓄力 0～1，0＝沒在蓄）, down（續命實習生倒地中的秒數） }
//   s.mice[]  = { uid, x, y }（鼠仙女的老鼠）　s.cones[] = { x, y, t }（小安的三角錐）
//
// ===== 事件 s.ev（view 每格取走、清空）=====
//   shot   { slot, id, uid, x, y, elem, kind, radius, dir:'down'|'side'|'up', flip:敵人在左, x2,y2:直線終點, heavy:重擊 }
//   dmg    { x, y, v, weak, elem }　　die { x, y, kind, boss, uid }　　down { x, y, uid }（倒下會復起）　revive { x, y, uid }
//   leak   { kind, v, final }　　pending { id }　　summon { slot, id }（放上工位）　　merge { slot, id, lv }
//   discard { id }　　sell { slot, id }　　move { from, to, cost }
//   wave   { n, boss, name }　　boss { kind }　　clear { n, coin }　　win　　lose
//   fatigue { slot, n, x, y }（x,y 來源）　shield { slot }（護盾擋掉一次）　cleanse { slot, to:[格] }
//   buff   { slot, to, kind:'haste'|'star'|'potion'|'dance' }　　cone { x, y }　　mouse { x, y }
//   guard { uid }　throw { uid, slot }（丟鍋砸到的工位）　broken { uid }　charge { uid }　interrupt { uid }　complain { uid, v }（扣底氣）
//   unite  { key, x, y, x2, y2, r }　　super { slot, id }　　stun { x, y }　　freeze { x, y }
import { TOWERS, FOES, WAVES, RULE, MAPS, UNITES, DEFAULT_TEAM } from './data.js';

export const DT = 1 / 30;
export const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const lvK = lv => RULE.lvK[lv - 1] || 1;
export const rangeOf = tw => TOWERS[tw.id].range * (1 + RULE.lvRange * (tw.lv - 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ell = (ax, ay, bx, by) => Math.hypot(ax - bx, (ay - by) * 1.25);

// ---------- 地圖 ----------
function bake(path) {      // 折線 → 每段長度，之後用走過的距離換座標
  const seg = []; let L = 0;
  for (let i = 1; i < path.length; i++) { const [ax, ay] = path[i - 1], [bx, by] = path[i], l = Math.hypot(bx - ax, by - ay); seg.push({ ax, ay, bx, by, l, L0: L }); L += l; }
  return { seg, L };
}
export function posAt(lane, d) {
  const { seg } = lane; let k = seg.length - 1;
  for (let i = 0; i < seg.length; i++) if (d <= seg[i].L0 + seg[i].l) { k = i; break; }
  const g = seg[k], t = clamp((d - g.L0) / g.l, 0, 1);
  return { x: g.ax + (g.bx - g.ax) * t, y: g.ay + (g.by - g.ay) * t, dir: Math.sign(g.bx - g.ax) || 0, seg: k };
}
export function setMap(name, json) {
  const m = { ...(MAPS[name] || {}), ...json };
  if (!m.path && m.lanes) m.path = m.lanes[0];
  MAPS[name] = m; return m;
}

// ---------- 開局 ----------
export function newGame(o = {}) {
  const mapKey = o.map || 'office', map = MAPS[mapKey], seed = o.seed ?? (Date.now() & 0xffffff);
  const team = (o.team && o.team.length ? o.team : DEFAULT_TEAM).filter(id => TOWERS[id]);
  const lanes = (map.lanes || [map.path]).map(bake);
  const s = {
    opts: { seed, team, map: mapKey }, rnd: mulberry(seed), n: 0, t: 0,
    map, lanes, slots: map.slots.map((p, i) => ({ i, x: p[0], y: p[1], tw: null })),
    foes: [], mice: [], cones: [], spawnQ: [], ev: [], log: [], uid: 1,
    res: RULE.res0, resMax: RULE.resMax, sumCost: RULE.sumCost, sums: 0, miss: 0, pending: null,
    lives: RULE.lives, livesMax: RULE.lives, coin: 0, kills: 0, leaks: 0,
    wave: 0, phase: 'break', waveT: RULE.firstDelay, freeMove: true, state: 'play',
    momentum: 0, momCd: 0, cds: {}, team, pool: team,
    unites: UNITES.filter(u => u.who.every(w => team.includes(w))),
    stat: { dmg: {}, sums: 0, merges: 0, discards: 0, moves: 0, unites: 0, supers: 0, complains: 0 },
  };
  return s;
}
const mom = (s, v) => { s.momentum = clamp(s.momentum + v, 0, RULE.momMax); };
const ok = (s, name, args) => { s.log.push([s.n, name, ...args]); return true; };

// ---------- 玩家操作 ----------
export const canSummon = s => s.state === 'play' && !s.pending && s.res >= s.sumCost;
const mergeable = s => new Set(s.slots.filter(x => x.tw && x.tw.lv === 1).map(x => x.tw.id));
export function summon(s) {
  if (!canSummon(s)) return null;
  const mg = mergeable(s), hit = s.pool.filter(id => mg.has(id));
  const from = s.miss >= RULE.pity && hit.length ? hit : s.pool;
  const id = from[Math.floor(s.rnd() * from.length)];
  s.miss = mg.has(id) ? 0 : s.miss + 1;
  s.res -= s.sumCost; s.sums++; s.stat.sums++;
  s.pending = { id, lv: 1 }; s.ev.push({ k: 'pending', id });
  ok(s, 'summon', []); return s.pending;
}
export function canPlace(s, i) {
  const sl = s.slots[i], p = s.pending; if (!p || !sl || s.state !== 'play') return false;
  return !sl.tw || (sl.tw.id === p.id && sl.tw.lv === p.lv && p.lv < RULE.maxLv);
}
export function place(s, i) {
  if (!canPlace(s, i)) return false;
  const sl = s.slots[i], p = s.pending; s.pending = null;
  if (!sl.tw) { sl.tw = newTower(s, p.id, p.lv); s.ev.push({ k: 'summon', slot: i, id: p.id }); }
  else mergeInto(s, sl, p.id, p.lv + 1);
  return ok(s, 'place', [i]);
}
export function discard(s) {
  if (!s.pending || s.state !== 'play') return false;
  s.ev.push({ k: 'discard', id: s.pending.id }); s.pending = null; s.stat.discards++;
  s.res = Math.min(s.resMax, s.res + RULE.discardBack); return ok(s, 'discard', []);
}
function newTower(s, id, lv) {
  return { uid: s.uid++, id, lv, cd: .3 + s.rnd() * .3, skT: 0, fatigue: 0, fatT: 0, shield: false, super: 0, haste: 0, hasteK: 0, star: 0, starK: 0,
    iceShots: 0, iceDmg: 0, danceT: 99, hitN: 0, comboUid: 0, comboN: 0, markUid: 0, kills: 0 };
}
function mergeInto(s, sl, id, lv) {
  sl.tw = newTower(s, id, lv); s.ev.push({ k: 'merge', slot: sl.i, id, lv }); mom(s, RULE.mom.merge); s.stat.merges++;
}
export const canMerge = (s, a, b) => { const A = s.slots[a]?.tw, B = s.slots[b]?.tw; return a !== b && !!A && !!B && A.id === B.id && A.lv === B.lv && A.lv < RULE.maxLv; };
export const moveCost = s => (s.phase === 'break' && s.freeMove ? 0 : RULE.moveCost);
export const canDrop = (s, a, b) => s.state === 'play' && a !== b && !!s.slots[a]?.tw && !!s.slots[b] && (canMerge(s, a, b) || s.coin >= moveCost(s));
export function drop(s, a, b) {
  if (!canDrop(s, a, b)) return false;
  const A = s.slots[a], B = s.slots[b];
  if (canMerge(s, a, b)) { A.tw = null; mergeInto(s, B, B.tw.id, B.tw.lv + 1); }
  else {
    const cost = moveCost(s); s.coin -= cost; if (s.phase === 'break') s.freeMove = false;
    [A.tw, B.tw] = [B.tw, A.tw]; s.stat.moves++; s.ev.push({ k: 'move', from: a, to: b, cost });
  }
  return ok(s, 'drop', [a, b]);
}
export function sell(s, i) {
  const sl = s.slots[i], T = sl?.tw; if (!T || s.state !== 'play') return false;
  s.res = Math.min(s.resMax, s.res + RULE.sellBack[T.lv - 1]); sl.tw = null; s.ev.push({ k: 'sell', slot: i, id: T.id });
  return ok(s, 'sell', [i]);
}
export function callWave(s) {
  if (s.state !== 'play' || s.phase !== 'break' || s.wave >= WAVES.length) return false;
  s.coin += Math.floor(s.waveT) * RULE.callBonus; startWave(s); return ok(s, 'callWave', []);
}

// ---------- 合體技、超級化 ----------
const onField = (s, id) => s.slots.filter(x => x.tw && x.tw.id === id);
const bestLv = (s, id) => Math.max(0, ...onField(s, id).map(x => x.tw.lv));
export function canUnite(s, key) {
  const u = UNITES.find(x => x.key === key);
  return !!u && s.state === 'play' && s.unites.includes(u) && s.momentum >= u.cost && !(s.cds[key] > 0) && u.who.every(w => bestLv(s, w) > 0);
}
export function useUnite(s, key, x, y) {
  if (!canUnite(s, key)) return false;
  const u = UNITES.find(q => q.key === key), k = u.who.reduce((a, w) => a + lvK(bestLv(s, w)), 0) / u.who.length;
  const live = s.foes.filter(alive);
  mom(s, -u.cost); s.cds[key] = u.cd; s.stat.unites++;
  if (u.kind === 'line' || u.kind === 'wall') {
    const L = s.lanes[0]; let gi = 0;
    if (x != null) { let bd = 1e9; L.seg.forEach((g, i) => { const d = segDist(g, x, y); if (d < bd) { bd = d; gi = i; } }); }
    else { const w = L.seg.map(() => 0); for (const f of live) w[posAt(L, f.d).seg] += f.hp + (f.boss ? 2000 : 0); gi = w.indexOf(Math.max(...w)); }
    const g = L.seg[gi], on = live.filter(f => posAt(L, f.d).seg === gi);
    s.ev.push({ k: 'unite', key, x: g.ax, y: g.ay, x2: g.bx, y2: g.by });
    if (u.kind === 'line') u.dmg.forEach((d, j) => on.forEach(f => hurt(s, f, d * k, u.elem[j], null)));
    else on.forEach(f => { if (f.boss) slowFoe(f, u.bossSlow, u.stunT); else f.stun = Math.max(f.stun, u.stunT * Math.min(1.5, k)); });
  } else if (u.kind === 'area') {
    let cx = x, cy = y;
    if (cx == null) { let best = -1; for (const c of live) { let v = 0; for (const f of live) if (ell(f.x, f.y, c.x, c.y) <= u.radius) v += f.hp; if (v > best) { best = v; cx = c.x; cy = c.y; } } }
    if (cx == null) { const p = posAt(s.lanes[0], s.lanes[0].L / 2); cx = p.x; cy = p.y; }
    s.ev.push({ k: 'unite', key, x: cx, y: cy, r: u.radius });
    for (const f of live) if (ell(f.x, f.y, cx, cy) <= u.radius) {
      hurt(s, f, u.dmg * k, u.elem, null); if (!alive(f)) continue;
      slowFoe(f, u.slow, u.slowT); burnFoe(f, u.burn * k, u.burnT, u.elem); if (!f.boss) f.stun = Math.max(f.stun, u.freezeT);
    }
  } else if (u.kind === 'team') {
    s.ev.push({ k: 'unite', key });
    for (const sl of s.slots) if (sl.tw) { sl.tw.fatigue = Math.max(0, sl.tw.fatigue - 1); sl.tw.haste = u.hasteT; sl.tw.hasteK = Math.max(sl.tw.hasteK, u.haste * k); }
  }
  return ok(s, 'unite', x != null ? [key, x, y] : [key]);
}
const segDist = (g, x, y) => { const vx = g.bx - g.ax, vy = g.by - g.ay, t = clamp(((x - g.ax) * vx + (y - g.ay) * vy) / (g.l * g.l), 0, 1); return Math.hypot(g.ax + vx * t - x, g.ay + vy * t - y); };
export const canSuper = (s, i) => s.state === 'play' && !!s.slots[i]?.tw && s.momentum >= RULE.superCost;
export function useSuper(s, i) {
  if (!canSuper(s, i)) return false;
  const T = s.slots[i].tw; mom(s, -RULE.superCost); T.super = RULE.superT; T.fatigue = 0; s.stat.supers++;
  s.ev.push({ k: 'super', slot: i, id: T.id }); return ok(s, 'super', [i]);
}

// ---------- 重演 ----------
const OPS = { summon, place, discard, drop, sell, callWave, unite: useUnite, super: useSuper };
export function replay(opts, log, steps = Infinity) {
  const s = newGame(opts); let i = 0;
  while (s.state === 'play' && s.n < steps) {
    while (i < log.length && log[i][0] === s.n) { const [, name, ...a] = log[i++]; OPS[name](s, ...a); }
    step(s); s.ev.length = 0;
  }
  return s;
}

// ---------- 波次 ----------
function startWave(s) {
  const W = WAVES[s.wave]; if (!W) return;
  s.wave++; s.phase = 'fight'; s.waveT = 0; s.freeMove = false;
  const mul = RULE.hpK * (1 + RULE.hpGrow * (s.wave - 1)) * (W.hpK || 1), bmul = RULE.bossHpK * (W.bossK || 1);
  let cur = 0; const K = RULE.spawnK;
  for (const g of W.groups) {
    const st = (g.at ?? cur / K) * K, gap = (g.gap ?? 1) * K;
    for (let n = 0; n < g.n; n++) s.spawnQ.push({ at: s.t + st + n * gap, kind: g.kind, mul: FOES[g.kind].boss ? bmul : mul });
    cur = st + g.n * gap;
  }
  s.spawnQ.sort((a, b) => a.at - b.at);
  s.ev.push({ k: 'wave', n: s.wave, boss: !!W.boss, name: W.name });
}
function endWave(s) {
  if (s.wave >= WAVES.length) { s.state = 'win'; s.ev.push({ k: 'win' }); return; }
  const c = RULE.waveCoin[0] + RULE.waveCoin[1] * s.wave; s.coin += c; mom(s, RULE.mom.wave);
  s.phase = 'break'; s.waveT = RULE.breakT; s.freeMove = true; s.ev.push({ k: 'clear', n: s.wave, coin: c });
}

// ---------- 敵人 ----------
const alive = f => !f.gone && f.hp > 0 && !(f.down > 0);
function spawn(s, kind, mul) {
  const F = FOES[kind], hp = Math.round(F.hp * mul), p = posAt(s.lanes[0], 0);
  const f = { uid: s.uid++, kind, lane: 0, d: 0, hp, max: hp, spd: F.spd, armor: F.armor || 0, weak: F.weak || [], boss: !!F.boss, final: !!F.final,
    x: p.x, y: p.y, dir: p.dir, ph: s.rnd() * 6, hitT: 0, slow: 0, slowT: 0, stun: 0, burn: 0, burnT: 0, burnE: 'dark', burnAcc: 0, mark: 0, sold: 0,
    iceN: 0, iceT: 0, revived: false, down: 0, fatT: 0, bState: 'walk', bT: 0, guard: false, broken: false, charge: 0, chargeDmg: 0, gone: false };
  s.foes.push(f); if (f.boss) s.ev.push({ k: 'boss', kind });
  return f;
}
const slowFoe = (f, k, t) => { const v = f.boss ? k * .5 : k; if (v >= f.slow) { f.slow = v; f.slowT = Math.max(f.slowT, t); } else f.slowT = Math.max(f.slowT, t * .5); };
const burnFoe = (f, v, t, e) => { if (v >= f.burn || f.burnT <= 0) { f.burn = v; f.burnE = e; } f.burnT = Math.max(f.burnT, t); };

export function hurt(s, f, dmg, elem, T, o = {}) {
  if (!alive(f)) return 0;
  const D = T ? TOWERS[T.id] : null; let k = 1;
  if (f.weak.includes(elem)) k *= f.mark > 0 ? RULE.markWeakK : RULE.weakK;
  if (f.armor) k *= D && D.pierceArmor ? D.pierceArmor : 1 - f.armor;
  if (f.guard) k *= FOES[f.kind].pot.guardK;
  if (f.broken) k *= (FOES[f.kind].pot || FOES[f.kind].scroll).brokenK;
  if (D && D.execute && f.hp < f.max * D.execute) k *= D.executeK;
  const d = Math.max(1, Math.round(dmg * k));
  f.hp -= d; f.hitT = .15; if (f.charge > 0) f.chargeDmg += d;
  const who = T ? T.id : o.src || 'unite'; s.stat.dmg[who] = (s.stat.dmg[who] || 0) + Math.min(d, d + f.hp);
  s.ev.push({ k: 'dmg', x: f.x, y: f.y, v: d, weak: f.weak.includes(elem), elem });
  if (f.hp <= 0) {
    const F = FOES[f.kind];
    if (F.revive && !f.revived) { f.revived = true; f.hp = 0; f.down = F.reviveT; f.burnT = 0; f.slowT = 0; f.slow = 0; s.ev.push({ k: 'down', x: f.x, y: f.y, uid: f.uid }); return d; }
    f.hp = 0; f.gone = true; s.kills++; s.coin += (F.coin || 1) + f.sold; mom(s, f.boss ? RULE.mom.boss : RULE.mom.kill);
    if (T) T.kills++;
    s.ev.push({ k: 'die', x: f.x, y: f.y, kind: f.kind, boss: f.boss, uid: f.uid });
  }
  return d;
}
function addFatigue(s, sl, x, y) {
  const T = sl.tw; if (!T) return;
  if (T.super > 0) return;
  if (T.shield) { T.shield = false; s.ev.push({ k: 'shield', slot: sl.i }); return; }
  if (T.fatigue >= RULE.fatMax) return;
  T.fatigue++; T.fatT = 0; s.ev.push({ k: 'fatigue', slot: sl.i, n: T.fatigue, x, y });
}
const nearSlots = (s, x, y, r) => s.slots.filter(sl => sl.tw && ell(sl.x, sl.y, x, y) <= r).sort((a, b) => ell(a.x, a.y, x, y) - ell(b.x, b.y, x, y));

function foeStep(s, f, dt) {
  const F = FOES[f.kind];
  f.hitT = Math.max(0, f.hitT - dt);
  if (f.down > 0) { f.down -= dt; if (f.down <= 0) { f.down = 0; f.hp = Math.round(f.max * F.revive); s.ev.push({ k: 'revive', x: f.x, y: f.y, uid: f.uid }); } return; }
  if (f.burnT > 0) { f.burnT -= dt; f.burnAcc += dt; if (f.burnAcc >= .5) { f.burnAcc -= .5; hurt(s, f, f.burn, f.burnE, null, { src: 'burn' }); if (!alive(f)) return; } } else f.burnAcc = 0;
  if (f.slowT > 0) { f.slowT -= dt; if (f.slowT <= 0) f.slow = 0; }
  if (f.mark > 0) f.mark = Math.max(0, f.mark - dt);
  if (f.iceT > 0) { f.iceT -= dt; if (f.iceT <= 0) f.iceN = 0; }
  // 大媽：定期讓附近同事疲勞（被暗焰燒著時變慢）
  if (F.fatigue) { f.fatT += dt * (f.burnT > 0 && f.burnE === 'dark' ? .5 : 1); if (f.fatT >= F.fatigue.every) { f.fatT = 0; for (const sl of nearSlots(s, f.x, f.y, F.fatigue.r).slice(0, F.fatigue.n)) addFatigue(s, sl, f.x, f.y); } }
  // 頭目
  let halt = false;
  if (F.pot) {        // 甩鍋課長：走 → 舉鍋（減傷）→ 丟鍋（砸一位同事疲勞）→ 理虧（停下、易傷）
    const P = F.pot; f.bT += dt;
    if (f.bState === 'walk' && f.bT >= P.walk) { f.bState = 'guard'; f.bT = 0; f.guard = true; s.ev.push({ k: 'guard', uid: f.uid }); }
    else if (f.bState === 'guard' && f.bT >= P.guard) {
      f.bState = 'broken'; f.bT = 0; f.guard = false; f.broken = true;
      const sl = nearSlots(s, f.x, f.y, P.throwR)[0]; if (sl) addFatigue(s, sl, f.x, f.y);
      s.ev.push({ k: 'throw', uid: f.uid, slot: sl ? sl.i : -1 }); s.ev.push({ k: 'broken', uid: f.uid });
    } else if (f.bState === 'broken' && f.bT >= P.broken) { f.bState = 'walk'; f.bT = 0; f.broken = false; }
    halt = f.bState === 'broken';
  }
  if (F.scroll) {     // 奧客總經理：走 → 客訴長卷蓄力（停下）→ 受到足量傷害就打斷（理虧），沒打斷就扣底氣
    const P = F.scroll; f.bT += dt;
    if (f.bState === 'walk' && f.bT >= (f.casts ? P.walk : P.first ?? P.walk)) { f.casts = (f.casts || 0) + 1; f.bState = 'charge'; f.bT = 0; f.charge = .001; f.chargeDmg = 0; s.ev.push({ k: 'charge', uid: f.uid }); }
    else if (f.bState === 'charge') {
      f.charge = Math.max(.001, f.bT / P.charge);
      if (f.chargeDmg >= f.max * P.breakK) { f.bState = 'broken'; f.bT = 0; f.charge = 0; f.broken = true; s.ev.push({ k: 'interrupt', uid: f.uid }); s.ev.push({ k: 'broken', uid: f.uid }); }
      else if (f.bT >= P.charge) { f.bState = 'walk'; f.bT = 0; f.charge = 0; s.lives -= P.hit; s.stat.complains++; s.ev.push({ k: 'complain', uid: f.uid, v: P.hit }); }
    } else if (f.bState === 'broken' && f.bT >= P.broken) { f.bState = 'walk'; f.bT = 0; f.broken = false; }
    halt = f.bState !== 'walk';
  }
  if (f.stun > 0) { f.stun = Math.max(0, f.stun - dt); return; }
  if (halt) return;
  let slow = f.slow;
  for (const c of s.cones) if (Math.hypot(c.x - f.x, c.y - f.y) <= 24) slow = Math.max(slow, f.boss ? c.slow * .5 : c.slow);
  f.d += f.spd * (1 - slow) * dt;
  const L = s.lanes[f.lane], p = posAt(L, f.d); f.x = p.x; f.y = p.y; if (p.dir) f.dir = p.dir;
  if (f.d >= L.L) {
    f.gone = true; s.leaks++;
    if (f.final) { s.lives = 0; s.ev.push({ k: 'leak', kind: f.kind, v: s.livesMax, final: true }); return; }
    const v = f.boss ? RULE.bossLeak : RULE.leak; s.lives -= v; s.ev.push({ k: 'leak', kind: f.kind, v });
  }
}

// ---------- 同事 ----------
export const dirOf = (sl, x, y) => { const dx = x - sl.x, dy = y - sl.y; return Math.abs(dy) > Math.abs(dx) * .9 ? (dy > 0 ? 'down' : 'up') : 'side'; };
const shotEv = (s, sl, T, x, y, more = {}) => s.ev.push({ k: 'shot', slot: sl.i, id: T.id, uid: T.uid, x, y, elem: TOWERS[T.id].elem, kind: TOWERS[T.id].kind, dir: dirOf(sl, x, y), flip: x < sl.x, ...more });
const isDealer = T => !['support'].includes(TOWERS[T.id].kind);
const atkOf = T => lvK(T.lv) * (1 + (T.star > 0 ? T.starK : 0)) * (T.super > 0 ? RULE.superDmg : 1);
const spdOf = T => (1 - RULE.fatK * T.fatigue) * (1 + (T.haste > 0 ? T.hasteK : 0)) * (T.super > 0 ? RULE.superSpd : 1);

function pick(s, sl, T, D, r) {      // 蓄力中的頭目優先（集火打斷）；其他照 target
  let best = null, bv = -Infinity;
  for (const f of s.foes) {
    if (!alive(f) || ell(f.x, f.y, sl.x, sl.y) > r) continue;
    const v = f.charge > 0 ? 1e9 : D.target === 'strong' ? f.hp + (f.boss ? 1e6 : 0) : D.target === 'weak' ? -f.hp : f.d;
    if (v > bv) { bv = v; best = f; }
  }
  return best;
}
function onHit(s, sl, T, D, f, dmg) {
  hurt(s, f, dmg, D.elem, T);
  if (T.iceShots > 0) hurt(s, f, T.iceDmg, 'ice', T);
  if (!alive(f)) return;
  if (D.slow) slowFoe(f, D.slow, D.slowT);
  if (D.burn) burnFoe(f, D.burn * atkOf(T), D.burnT, D.elem);
  if (D.freezeN) {
    f.iceN++; f.iceT = 1.2;
    if (f.iceN >= (T.super > 0 ? 2 : D.freezeN)) { f.iceN = 0; if (f.boss) slowFoe(f, .6, 1.5); else { f.stun = Math.max(f.stun, D.freezeT); s.ev.push({ k: 'freeze', x: f.x, y: f.y }); } }
  }
  if (D.deal && !f.sold) f.sold = Math.round(D.deal * lvK(T.lv));
}
function fire(s, sl, T, D) {
  const r = rangeOf(T), tgt = pick(s, sl, T, D, r); if (!tgt) return false;
  const dmg = D.dmg * atkOf(T);
  if (D.kind === 'single') {
    let k = 1, heavy = false;
    if (D.combo) { if (T.comboUid === tgt.uid) T.comboN++; else { T.comboUid = tgt.uid; T.comboN = 1; } if (T.comboN % D.combo === 0) { k = D.comboK; heavy = true; } }
    if (D.markT) { if (T.markUid && T.markUid !== tgt.uid) { const o = s.foes.find(f => f.uid === T.markUid); if (o) o.mark = 0; } T.markUid = tgt.uid; tgt.mark = D.markT; }
    shotEv(s, sl, T, tgt.x, tgt.y, heavy ? { heavy } : {});
    onHit(s, sl, T, D, tgt, dmg * k);
  } else if (D.kind === 'splash' || D.kind === 'aura') {
    const R = D.kind === 'aura' ? r : D.radius * (T.super > 0 ? 1.3 : 1), cx = D.kind === 'aura' ? sl.x : tgt.x, cy = D.kind === 'aura' ? sl.y : tgt.y;
    shotEv(s, sl, T, tgt.x, tgt.y, { radius: R });
    const hit = s.foes.filter(f => alive(f) && ell(f.x, f.y, cx, cy) <= R);
    T.hitN++; const stun = D.stunEvery && T.hitN % (T.super > 0 ? 2 : D.stunEvery) === 0;
    hit.forEach((f, j) => {
      onHit(s, sl, T, D, f, dmg);
      if (stun && j < D.stunN + T.lv - 1 && alive(f)) { if (f.boss) slowFoe(f, .5, 1); else { f.stun = Math.max(f.stun, D.stunT); s.ev.push({ k: 'stun', x: f.x, y: f.y }); } }
    });
  } else if (D.kind === 'line') {
    const ox = sl.x, oy = sl.y - 20, len = Math.hypot(tgt.x - ox, tgt.y - oy) || 1, ux = (tgt.x - ox) / len, uy = (tgt.y - oy) / len, L = r * 1.05;
    const w = D.width * (T.super > 0 ? 1.6 : 1), n = D.pierce + (T.lv - 1) + (T.super > 0 ? 2 : 0);
    const hit = [];
    for (const f of s.foes) { if (!alive(f)) continue; const px = f.x - ox, py = f.y - oy, t = px * ux + py * uy; if (t < 0 || t > L) continue; if (Math.abs(px * uy - py * ux) <= w) hit.push([t, f]); }
    hit.sort((a, b) => a[0] - b[0]);
    shotEv(s, sl, T, tgt.x, tgt.y, { x2: ox + ux * L, y2: oy + uy * L });
    hit.slice(0, n).forEach(([, f]) => onHit(s, sl, T, D, f, dmg));
  } else if (D.kind === 'summon') {
    const mine = s.mice.filter(m => m.owner === T.uid).length; if (mine >= D.mice + T.lv - 1) return false;
    const L = s.lanes[0]; let bd = 1e9, bestD = 0;
    for (let d = 0; d <= L.L; d += 12) { const p = posAt(L, d), e = ell(p.x, p.y, sl.x, sl.y); if (e < bd) { bd = e; bestD = d; } }
    if (bd > r) return false;
    const p = posAt(L, bestD); s.mice.push({ uid: s.uid++, owner: T.uid, d: bestD, x: p.x, y: p.y, t: D.miceT, dmg: D.dmg * atkOf(T), stun: D.miceStun });
    shotEv(s, sl, T, p.x, p.y); s.ev.push({ k: 'mouse', x: p.x, y: p.y });
  }
  return true;
}
// 定期的支援：小米解疲勞／護盾、Vivi 本月之星、茶茶珍奶、許許藥瓶、小安三角錐、小蝶跳舞
function support(s, sl, T, D) {
  const r = rangeOf(T), near = s.slots.filter(o => o.tw && ell(o.x, o.y, sl.x, sl.y) <= r);
  const fast = T.super > 0 ? .5 : 1;
  if (D.heal != null) {
    if (T.skT < D.heal * fast) return; T.skT = 0;
    const tired = near.filter(o => o.tw.fatigue > 0), to = [];
    if (tired.length) { for (const o of tired) { o.tw.fatigue = Math.max(0, o.tw.fatigue - T.lv); to.push(o.i); } if (s.momCd <= 0) { mom(s, RULE.mom.cleanse); s.momCd = RULE.mom.cleanseCd; } }
    else for (const o of near.filter(o => !o.tw.shield).slice(0, 1 + T.lv)) { o.tw.shield = true; to.push(o.i); }
    if (to.length) s.ev.push({ k: 'cleanse', slot: sl.i, to });
  } else if (D.star) {
    if (T.skT < D.star * fast) return;
    const c = near.filter(o => o !== sl && isDealer(o.tw) && !(o.tw.star > 0)).sort((a, b) => TOWERS[b.tw.id].dmg * lvK(b.tw.lv) / TOWERS[b.tw.id].rate - TOWERS[a.tw.id].dmg * lvK(a.tw.lv) / TOWERS[a.tw.id].rate)[0];
    if (!c) return; T.skT = 0; c.tw.star = D.starT; c.tw.starK = D.starK * lvK(T.lv); s.ev.push({ k: 'buff', slot: sl.i, to: c.i, kind: 'star' }); shotEv(s, sl, T, c.x, c.y);
  } else if (D.haste) {
    if (T.skT < D.rate * fast) return;
    const cs = near.filter(o => o !== sl && isDealer(o.tw)).sort((a, b) => (a.tw.haste > 0) - (b.tw.haste > 0) || b.tw.lv - a.tw.lv).slice(0, D.hasteN || 1);
    if (!cs.length) return; T.skT = 0;
    for (const c of cs) { c.tw.haste = D.hasteT; c.tw.hasteK = D.haste * (1 + .4 * (T.lv - 1)); s.ev.push({ k: 'buff', slot: sl.i, to: c.i, kind: 'haste' }); }
    shotEv(s, sl, T, cs[0].x, cs[0].y);
  } else if (D.potion) {
    if (T.skT < D.potion * fast) return;
    const c = near.filter(o => o !== sl).sort((a, b) => b.tw.fatigue - a.tw.fatigue || b.tw.lv - a.tw.lv)[0];
    if (!c) return; T.skT = 0; if (c.tw.fatigue > 0 && s.momCd <= 0) { mom(s, RULE.mom.cleanse); s.momCd = RULE.mom.cleanseCd; }
    c.tw.fatigue = 0; c.tw.iceShots = D.potionShots; c.tw.iceDmg = D.potionDmg * lvK(T.lv); s.ev.push({ k: 'buff', slot: sl.i, to: c.i, kind: 'potion' });
  } else if (D.cone) {
    if (T.skT < D.cone * fast) return;
    const L = s.lanes[0], pts = []; for (let d = 0; d <= L.L; d += 10) { const p = posAt(L, d); if (ell(p.x, p.y, sl.x, sl.y) <= r) pts.push(p); }
    if (!pts.length) return; T.skT = 0;
    const mine = s.cones.filter(c => c.owner === T.uid); if (mine.length >= T.lv) s.cones.splice(s.cones.indexOf(mine[0]), 1);
    const p = pts[Math.floor(pts.length / 2)]; s.cones.push({ owner: T.uid, x: p.x, y: p.y, t: D.coneT, slow: D.coneSlow }); s.ev.push({ k: 'cone', x: p.x, y: p.y });
  } else if (D.dance) {
    if (T.skT < D.dance * fast) return; T.skT = 0;
    for (const o of s.slots) if (o.tw && o !== sl && ell(o.x, o.y, sl.x, sl.y) <= D.danceR && o.tw.danceT >= D.dance - .1) { o.tw.cd -= D.danceCut * (1 + .5 * (T.lv - 1)); o.tw.danceT = 0; }
    s.ev.push({ k: 'buff', slot: sl.i, to: sl.i, kind: 'dance' });
  }
}
function towerStep(s, sl, dt) {
  const T = sl.tw, D = TOWERS[T.id];
  T.skT += dt; T.danceT += dt;
  if (T.super > 0) T.super = Math.max(0, T.super - dt);
  if (T.haste > 0) T.haste = Math.max(0, T.haste - dt); else T.hasteK = 0;
  if (T.star > 0) T.star = Math.max(0, T.star - dt); else T.starK = 0;
  if (T.fatigue > 0) { T.fatT += dt; if (T.fatT >= RULE.fatDecay) { T.fatigue--; T.fatT = 0; } }
  support(s, sl, T, D);
  if (D.kind === 'support') return;
  T.cd -= dt * spdOf(T);
  if (T.cd <= 0) { if (fire(s, sl, T, D)) { T.cd += D.rate; if (T.iceShots > 0) T.iceShots--; } else T.cd = 0; }
}

// ---------- 一步 ----------
export function step(s, dt = DT) {
  if (s.state !== 'play') return;
  s.n++; s.t += dt;
  s.res = Math.min(s.resMax, s.res + (RULE.resPerSec + RULE.resWave * s.wave) * dt);
  s.momCd = Math.max(0, s.momCd - dt);
  for (const k in s.cds) s.cds[k] = Math.max(0, s.cds[k] - dt);
  if (s.phase === 'break') { s.waveT -= dt; if (s.waveT <= 0) startWave(s); }
  while (s.spawnQ.length && s.spawnQ[0].at <= s.t) { const q = s.spawnQ.shift(); spawn(s, q.kind, q.mul); }
  for (const f of s.foes) if (!f.gone) foeStep(s, f, dt);
  // 老鼠往入口方向衝，撞到第一隻敵人就造成傷害
  for (const m of s.mice) {
    m.t -= dt; m.d -= TOWERS.fairy.miceSpd * dt; if (m.d < 0) m.t = 0;
    const p = posAt(s.lanes[0], Math.max(0, m.d)); m.x = p.x; m.y = p.y;
    const f = s.foes.find(f => alive(f) && Math.hypot(f.x - m.x, f.y - m.y) < 20);
    if (f && m.t > 0) { const T = s.slots.find(x => x.tw && x.tw.uid === m.owner)?.tw; hurt(s, f, m.dmg, 'holy', T || null, { src: 'fairy' }); if (alive(f) && !f.boss) f.stun = Math.max(f.stun, m.stun); m.t = 0; }
  }
  s.mice = s.mice.filter(m => m.t > 0);
  for (const c of s.cones) c.t -= dt; s.cones = s.cones.filter(c => c.t > 0);
  for (const sl of s.slots) if (sl.tw) towerStep(s, sl, dt);
  s.foes = s.foes.filter(f => !f.gone);
  if (s.lives <= 0) { s.lives = 0; s.state = 'lose'; s.ev.push({ k: 'lose' }); return; }
  if (s.phase === 'fight' && !s.spawnQ.length && !s.foes.length) endWave(s);
}
