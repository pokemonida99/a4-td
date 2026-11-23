// 塔防的規則核心：純計算、不碰畫面（node 的 tools/sim.mjs 直接拿來跑）。
// 固定步長 step(s, DT)；同一個種子、同一串操作 → 同一個結果（s.log 可以 replay 重演）。
// v0.3：同事升級路線（II 選 A／B、III 質變＋主動技能）＋敵人屬性（掛名、重甲、術抗、再生、轉寄、快遞），參考 BTD6 機制，見 design/btd6/DESIGN.md。
//
// ===== API（main.js 用）=====
//   newGame({ seed, team, map })   開局。team 預設 DEFAULT_TEAM（6 人）；map 預設 'office'
//   step(s, dt=DT)                 推進一格（DT＝1/30 秒；倍速就多跑幾格）
//   setMap(name, json)             換地圖（art/map/office.json：{ path, slots, gate, clock }；座標系跟著 json，現在是 1280×590）
//   --- 玩家操作：成功回傳真值、失敗回傳 false／null，成功的都記進 s.log ---
//   錢只有一種：部門預算 s.coin（整數）
//   canSummon(s) / summon(s)       緊急調派：花 s.sumCost（每調派一次 +RULE.sumStep），從「抽袋」s.bag 抽一位進「報到中」s.pending={id,lv,paid}
//                                  抽袋＝出勤 6 人各一張，抽完才重洗（開局前 6 抽一定都不一樣）
//   canSummonPick(s) / pickCost(s) / summonPick(s, id)   指定調派：波間一次，價錢 sumCost × RULE.pickK
//   canPlace(s, i) / place(s, i)   報到中 → 空工位；點到場上同名同級＝直接合併升級
//   discard(s)                     報到中轉派：退回這次費用 × RULE.discardBack
//   canMerge(s, a, b)              a、b 兩格同名同級且未滿級
//   canDrop(s, a, b) / drop(s,a,b) 拖 a 到 b：能合併＝合併（免費，結果沿用 b 的路線）；否則搬過去／互換＝調位（花 moveCost(s) 預算）
//   moveCost(s)                    這次調位要花多少預算（波間第一次 0）
//   sell(s, i)                     場上同事轉派：退回預算（依職級 RULE.sellBack）
//   canUpgrade(s, i) / upgradeCost(s, i) / upgrade(s, i, route?)   直接升職：花預算升一級（RULE.upCost）；升到 II 時可以順便給路線
//   needRoute(s, i)                這位是 II 以上但還沒選路線
//   chooseRoute(s, i, 'a'|'b')     選路線（只能選一次；之後要改用 reroute）
//   canReroute(s, i) / reroute(s, i, 'a'|'b')   波間改路線，花 RULE.rerouteCost，職級不變
//   canSkill(s, i) / useSkill(s, i, x?, y?)     III 主動技能（tw.skillCd 冷卻秒數；skill.aim＝可以指定位置，不給就自動挑）
//   skillOf(tw) / routeOf(tw)      這位目前的技能／路線資料（TOWERS[id].routes[route]）
//   callWave(s)                    波間提早開波（每省 1 秒給 1 預算）
//   canUnite(s, key) / useUnite(s, key, x?, y?)   合體技（不給 x,y 就自動挑敵人最多的地方）；尚未現形的掛名打不到
//   canSuper / useSuper            超級化：v0.3 拿掉（RULE.superOn＝false，canSuper 永遠 false）
//   replay(opts, log, steps?)      用 newGame 的 opts 和 s.log 重演，回傳最後的 s
//   lvK(lv)、rangeOf(tw)、eff(tw)（這位目前生效的能力＝基本＋路線 II＋III）、posAt(lane, d)、dirOf(sl, x, y)、visible(f, tw?)
//   規則重點：奧客總經理蓄力（f.charge>0）時，射程內同事自動集火他（足量傷害才打得斷）
//
// ===== 狀態（view 讀）=====
//   s.state 'play'|'win'|'lose'　s.phase 'break'（波間，s.waveT 倒數）|'fight'（s.waveT=0）
//   s.wave 已開的波數（WAVES[s.wave] 是下一波；WAVES[i].teach＝第一次登場的屬性）　s.lives / s.livesMax　s.sumCost（下一次調派的價錢）
//   s.coin 部門預算　s.kills　s.momentum（0～RULE.momMax）　s.freeMove（波間免費調位還在）　s.pickUsed（這個波間已指定調派過）　s.cds[key] 合體技冷卻
//   s.pending {id, lv, paid} | null　s.bag 這袋還沒抽到的人　s.unites 這隊能用的合體技（UNITES 的子集）
//   s.slots[i] = { i, x, y, tw }
//   tw = { uid, id, lv, route（null|'a'|'b'）, skillCd（主動技能剩幾秒）, fatigue(0～3), shield, immuneT（不會疲勞）, detectT（暫時看得到掛名）,
//          haste, star, rageT, kills }
//   s.foes[]  = { uid, kind, x, y, hp, max, boss, final, hitT, slow, burnT, stun, mark,
//                 traits（['camo','armor','magic','regen','split','fast'] 的子集）, camo, revealT（現形剩幾秒）, armor, breakT（破甲剩幾秒）,
//                 noRegenT（不能再生剩幾秒）, regenning（正在回血）,
//                 guard（舉鍋減傷中）, broken（理虧中）, charge（客訴長卷蓄力 0～1，0＝沒在蓄）, down（續命實習生倒地中的秒數） }
//   s.mice[]  = { uid, x, y }（鼠仙女的老鼠）　s.cones[] = { x, y, t }（小安的三角錐）
//
// ===== 事件 s.ev（view 每格取走、清空）=====
//   shot   { slot, id, uid, x, y, elem, kind, radius, dir:'down'|'side'|'up', flip:敵人在左, x2,y2:直線終點, heavy:重擊 }
//   dmg    { x, y, v, weak, elem, res:'magic'|'armor'|null（被術抗／重甲吃掉一大半） }
//   die { x, y, kind, boss, uid }　　down { x, y, uid }（倒下會復起）　revive { x, y, uid }
//   leak   { kind, v, final }　　pending { id, pick }　　summon { slot, id }（放上工位）　　merge { slot, id, lv, route }
//   discard { id, back }　　sell { slot, id, back }　　move { from, to, cost }　　upgrade { slot, id, lv, cost }
//   route  { slot, id, route, reroute, cost }（選了／改了路線）　　skill { slot, id, key:'a'|'b', name, kind, x, y, r, x2, y2 }
//   coin { x, y, v }（打倒敵人拿到預算）　　wave { n, boss, name, teach }　　boss { kind }　　clear { n, coin }　　win　　lose
//   fatigue { slot, n, x, y }　shield { slot }　cleanse { slot, to:[格] }　buff { slot, to, kind:'haste'|'star'|'potion'|'dance' }
//   cone { x, y }　mouse { x, y }　reveal { x, y, uid }（掛名現形）　armorBreak { x, y, uid }　split { x, y, uid, n }（轉寄吐小兵）
//   regen { x, y, uid }（開始回血）　stun { x, y }　freeze { x, y }
//   guard { uid }　throw { uid, slot }　broken { uid }　charge { uid }　interrupt { uid }　complain { uid, v }
//   unite  { key, x, y, x2, y2, r }
import { TOWERS, FOES, WAVES, RULE, MAPS, UNITES, DEFAULT_TEAM } from './data.js';

export const DT = 1 / 30;
export const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const lvK = lv => RULE.lvK[lv - 1] || 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ell = (ax, ay, bx, by) => Math.hypot(ax - bx, (ay - by) * 1.25);
const MAGIC = { fire: 1, ice: 1, holy: 1, dark: 1 };

// ---------- 路線：算出這位同事目前生效的能力 ----------
const MULT = { dmgK: 1, rateK: 1, radiusK: 1, dealK: 1 };
export const routeOf = tw => (tw && tw.route && tw.lv >= 2 ? TOWERS[tw.id].routes?.[tw.route] : null);
export const skillOf = tw => (tw && tw.lv >= 3 ? routeOf(tw)?.skill || null : null);
export function eff(tw) {
  const key = tw.lv + (tw.route || '');
  if (tw._ek === key) return tw._E;
  const E = { ...TOWERS[tw.id] }, R = routeOf(tw);
  const add = m => { for (const k in m) { if (MULT[k]) E[k] = (E[k] || 1) * m[k]; else if (k === 'vs') E.vs = { ...(E.vs || {}), ...m.vs }; else E[k] = m[k]; } };
  if (R) { add(R.ii || {}); if (tw.lv >= 3) add(R.iii || {}); }
  E.dmg = E.dmg * (E.dmgK || 1); E.rate = E.rate * (E.rateK || 1); if (E.radius) E.radius *= E.radiusK || 1; if (E.deal) E.deal *= E.dealK || 1;
  tw._ek = key; tw._E = E; return E;
}
export const rangeOf = tw => TOWERS[tw.id].range * (1 + RULE.lvRange * (tw.lv - 1));

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
    sumCost: RULE.sumCost, sums: 0, bag: [], pending: null, pickUsed: false, salT: 0,
    lives: RULE.lives, livesMax: RULE.lives, coin: RULE.coin0, kills: 0, leaks: 0,
    wave: 0, phase: 'break', waveT: RULE.firstDelay, freeMove: true, state: 'play',
    momentum: 0, momCd: 0, cds: {}, team, pool: team, coinSkillWave: {},
    unites: UNITES.filter(u => u.who.every(w => team.includes(w))),
    stat: { dmg: {}, sums: 0, merges: 0, upgrades: 0, discards: 0, moves: 0, unites: 0, supers: 0, skills: 0, routes: 0, complains: 0, earned: 0,
      leakBy: {}, spent: { summon: 0, upgrade: 0, move: 0, route: 0 } },
  };
  return s;
}
const mom = (s, v) => { s.momentum = clamp(s.momentum + v, 0, RULE.momMax); };
const ok = (s, name, args) => { s.log.push([s.n, name, ...args]); return true; };

// ---------- 調派 ----------
export const canSummon = s => s.state === 'play' && !s.pending && s.coin >= s.sumCost;
function drawBag(s) {
  if (!s.bag.length) { s.bag = s.pool.slice(); for (let i = s.bag.length - 1; i > 0; i--) { const j = Math.floor(s.rnd() * (i + 1)); [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]]; } }
  return s.bag.pop();
}
function pay(s, paid, id, pick) {
  s.coin -= paid; s.sums++; s.stat.sums++; s.stat.spent.summon += paid;
  s.sumCost = Math.min(RULE.sumMax, RULE.sumCost + RULE.sumStep * s.sums);
  s.pending = { id, lv: 1, paid }; s.ev.push({ k: 'pending', id, pick: !!pick });
}
export function summon(s) {
  if (!canSummon(s)) return null;
  pay(s, s.sumCost, drawBag(s));
  ok(s, 'summon', []); return s.pending;
}
export const pickCost = s => Math.round(s.sumCost * RULE.pickK);
export const canSummonPick = s => s.state === 'play' && s.phase === 'break' && !s.pickUsed && !s.pending && s.coin >= pickCost(s);
export function summonPick(s, id) {
  if (!canSummonPick(s) || !s.pool.includes(id)) return null;
  s.pickUsed = true; pay(s, pickCost(s), id, true);
  ok(s, 'summonPick', [id]); return s.pending;
}
export function canPlace(s, i) {
  const sl = s.slots[i], p = s.pending; if (!p || !sl || s.state !== 'play') return false;
  return !sl.tw || (sl.tw.id === p.id && sl.tw.lv === p.lv && p.lv < RULE.maxLv);
}
export function place(s, i) {
  if (!canPlace(s, i)) return false;
  const sl = s.slots[i], p = s.pending; s.pending = null;
  if (!sl.tw) { sl.tw = newTower(s, p.id, p.lv); s.ev.push({ k: 'summon', slot: i, id: p.id }); }
  else mergeInto(s, sl, sl.tw, null);
  return ok(s, 'place', [i]);
}
export function discard(s) {
  if (!s.pending || s.state !== 'play') return false;
  const back = Math.round((s.pending.paid ?? s.sumCost) * RULE.discardBack); s.coin += back;
  s.ev.push({ k: 'discard', id: s.pending.id, back }); s.pending = null; s.stat.discards++; return ok(s, 'discard', []);
}
function newTower(s, id, lv) {
  return { uid: s.uid++, id, lv, route: null, skillCd: 0, cd: .3 + s.rnd() * .3, skT: 0, revT: 0, fatigue: 0, fatT: 0, shield: false, immuneT: 0, detectT: 0,
    super: 0, haste: 0, hasteK: 0, star: 0, starK: 0, starAdd: 0, starIgn: false, starBoss: 1, rageT: 0, rageK: 1,
    iceShots: 0, iceDmg: 0, danceT: 99, hitN: 0, comboUid: 0, comboN: 0, markUid: 0, kills: 0 };
}
function mergeInto(s, sl, B, A) {      // B＝被拖到的那位（保留路線），A＝拖過來的（可能是 null＝報到中的 I）
  const T = newTower(s, B.id, B.lv + 1);
  T.route = T.lv >= 2 ? B.route || (A && A.route) || null : null;
  T.skillCd = Math.max(B.skillCd || 0, (A && A.skillCd) || 0);
  sl.tw = T; s.ev.push({ k: 'merge', slot: sl.i, id: T.id, lv: T.lv, route: T.route }); mom(s, RULE.mom.merge); s.stat.merges++;
}
export const canMerge = (s, a, b) => { const A = s.slots[a]?.tw, B = s.slots[b]?.tw; return a !== b && !!A && !!B && A.id === B.id && A.lv === B.lv && A.lv < RULE.maxLv; };
export const moveCost = s => (s.phase === 'break' && s.freeMove ? 0 : RULE.moveCost);
export const canDrop = (s, a, b) => s.state === 'play' && a !== b && !!s.slots[a]?.tw && !!s.slots[b] && (canMerge(s, a, b) || s.coin >= moveCost(s));
export function drop(s, a, b) {
  if (!canDrop(s, a, b)) return false;
  const A = s.slots[a], B = s.slots[b];
  if (canMerge(s, a, b)) { const at = A.tw; A.tw = null; mergeInto(s, B, B.tw, at); }
  else {
    const cost = moveCost(s); s.coin -= cost; s.stat.spent.move += cost; if (s.phase === 'break') s.freeMove = false;
    [A.tw, B.tw] = [B.tw, A.tw]; s.stat.moves++; s.ev.push({ k: 'move', from: a, to: b, cost });
  }
  return ok(s, 'drop', [a, b]);
}
export function sell(s, i) {
  const sl = s.slots[i], T = sl?.tw; if (!T || s.state !== 'play') return false;
  const back = RULE.sellBack[T.lv - 1]; s.coin += back; sl.tw = null; s.ev.push({ k: 'sell', slot: i, id: T.id, back });
  return ok(s, 'sell', [i]);
}
export const upgradeCost = (s, i) => { const T = s.slots[i]?.tw; return T && T.lv < RULE.maxLv ? RULE.upCost[T.lv - 1] : Infinity; };
export const canUpgrade = (s, i) => s.state === 'play' && !!s.slots[i]?.tw && s.coin >= upgradeCost(s, i);
export function upgrade(s, i, route) {      // 直接升職：同一位同事升一級（保留疲勞等狀態、技能冷卻）
  if (!canUpgrade(s, i)) return false;
  const T = s.slots[i].tw, cost = upgradeCost(s, i); s.coin -= cost; T.lv++; s.stat.upgrades++; s.stat.spent.upgrade += cost;
  s.ev.push({ k: 'upgrade', slot: i, id: T.id, lv: T.lv, cost }); mom(s, RULE.mom.merge);
  ok(s, 'upgrade', route ? [i, route] : [i]);
  if (route && !T.route && T.lv >= 2) setRoute(s, i, route, false, 0);
  return true;
}

// ---------- 路線 ----------
export const needRoute = (s, i) => { const T = s.slots[i]?.tw; return !!T && T.lv >= 2 && !T.route && !!TOWERS[T.id].routes; };
function setRoute(s, i, r, re, cost) {
  const T = s.slots[i].tw; T.route = r; s.stat.routes++;
  s.ev.push({ k: 'route', slot: i, id: T.id, route: r, reroute: re, cost });
}
export function chooseRoute(s, i, r) {
  if (s.state !== 'play' || !needRoute(s, i) || !TOWERS[s.slots[i].tw.id].routes[r]) return false;
  setRoute(s, i, r, false, 0); return ok(s, 'route', [i, r]);
}
export const canReroute = (s, i) => { const T = s.slots[i]?.tw; return s.state === 'play' && s.phase === 'break' && !!T && !!T.route && s.coin >= RULE.rerouteCost; };
export function reroute(s, i, r) {
  if (!canReroute(s, i) || s.slots[i].tw.route === r || !TOWERS[s.slots[i].tw.id].routes[r]) return false;
  s.coin -= RULE.rerouteCost; s.stat.spent.route += RULE.rerouteCost; setRoute(s, i, r, true, RULE.rerouteCost);
  return ok(s, 'reroute', [i, r]);
}

export function callWave(s) {
  if (s.state !== 'play' || s.phase !== 'break' || s.wave >= WAVES.length) return false;
  s.coin += Math.floor(s.waveT) * RULE.callBonus; startWave(s); return ok(s, 'callWave', []);
}

// ---------- 合體技、超級化 ----------
const onField = (s, id) => s.slots.filter(x => x.tw && x.tw.id === id);
const bestLv = (s, id) => Math.max(0, ...onField(s, id).map(x => x.tw.lv));
const segDist = (g, x, y) => { const vx = g.bx - g.ax, vy = g.by - g.ay, t = clamp(((x - g.ax) * vx + (y - g.ay) * vy) / (g.l * g.l), 0, 1); return Math.hypot(g.ax + vx * t - x, g.ay + vy * t - y); };
function pickSeg(s, live, x, y) {      // 指定位置就找最近的一段走廊，不然挑敵人血量（頭目加重）最多的那段
  const L = s.lanes[0]; let gi = 0;
  if (x != null) { let bd = 1e9; L.seg.forEach((g, i) => { const d = segDist(g, x, y); if (d < bd) { bd = d; gi = i; } }); }
  else { const w = L.seg.map(() => 0); for (const f of live) w[posAt(L, f.d).seg] += f.hp + (f.boss ? 2000 : 0); gi = w.indexOf(Math.max(...w)); }
  return { gi, g: L.seg[gi], on: live.filter(f => posAt(L, f.d).seg === gi) };
}
function pickDense(s, live, r, x, y, pref) {      // 指定位置，或挑一圈裡敵人血量最多的中心
  if (x != null) return [x, y];
  let best = -1, cx = null, cy = null;
  for (const c of live) { let v = 0; for (const f of live) if (ell(f.x, f.y, c.x, c.y) <= r) v += f.hp * (pref && f.traits.includes(pref) ? 3 : 1); if (v > best) { best = v; cx = c.x; cy = c.y; } }
  if (cx == null) { const p = posAt(s.lanes[0], s.lanes[0].L / 2); cx = p.x; cy = p.y; }
  return [cx, cy];
}
export function canUnite(s, key) {
  const u = UNITES.find(x => x.key === key);
  return !!u && s.state === 'play' && s.unites.includes(u) && s.momentum >= u.cost && !(s.cds[key] > 0) && u.who.every(w => bestLv(s, w) > 0);
}
export function useUnite(s, key, x, y) {
  if (!canUnite(s, key)) return false;
  const u = UNITES.find(q => q.key === key), k = u.who.reduce((a, w) => a + lvK(bestLv(s, w)), 0) / u.who.length;
  const live = s.foes.filter(f => alive(f) && visible(f));
  mom(s, -u.cost); s.cds[key] = u.cd; s.stat.unites++;
  if (u.kind === 'line' || u.kind === 'wall') {
    const { g, on } = pickSeg(s, live, x, y);
    s.ev.push({ k: 'unite', key, x: g.ax, y: g.ay, x2: g.bx, y2: g.by });
    if (u.kind === 'line') u.dmg.forEach((d, j) => on.forEach(f => hurt(s, f, d * k, u.elem[j], null)));
    else on.forEach(f => { if (f.boss) slowFoe(f, u.bossSlow, u.stunT); else f.stun = Math.max(f.stun, u.stunT * Math.min(1.5, k)); });
  } else if (u.kind === 'area') {
    const [cx, cy] = pickDense(s, live, u.radius, x, y);
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
export const canSuper = (s, i) => !!RULE.superOn && s.state === 'play' && !!s.slots[i]?.tw && s.momentum >= RULE.superCost;
export function useSuper(s, i) {
  if (!canSuper(s, i)) return false;
  const T = s.slots[i].tw; mom(s, -RULE.superCost); T.super = RULE.superT; T.fatigue = 0; s.stat.supers++;
  s.ev.push({ k: 'super', slot: i, id: T.id }); return ok(s, 'super', [i]);
}

// ---------- III 主動技能 ----------
export function canSkill(s, i) {
  const T = s.slots[i]?.tw, K = skillOf(T); if (!K || s.state !== 'play' || T.skillCd > 0) return false;
  if (K.kind === 'coin' && s.coinSkillWave[T.uid] === s.wave) return false;
  return true;
}
export function useSkill(s, i, x, y) {
  if (!canSkill(s, i)) return false;
  const sl = s.slots[i], T = sl.tw, K = skillOf(T), E = eff(T), D = E.dmg * atkOf(T), elem = K.elem || E.elem;
  const live = s.foes.filter(f => alive(f) && visible(f, T)), ev = { k: 'skill', slot: i, id: T.id, key: T.route, name: K.name, kind: K.kind };
  const hitF = (f, k) => { if (k > 0) hurt(s, f, D * k * (K.splitK && f.traits.includes('split') ? K.splitK : 1), elem, T, { skill: true }); if (!alive(f)) return;
    if (K.stun) ctl(s, f, K.stun); if (K.slow) slowFoe(f, K.slow, K.slowT || 3); if (K.noRegen) f.noRegenT = Math.max(f.noRegenT, K.noRegen);
    if (K.breakT) breakArmor(s, f, K.breakT); if (K.reveal) revealFoe(s, f, K.reveal); if (K.burn) burnFoe(f, (E.burn || 5) * atkOf(T), (E.burnT || 3) + 3, E.elem, E.burnNoRegen || !!K.noRegen);
    if (K.burnK != null && K.burnT) burnFoe(f, D * K.burnK, K.burnT, elem, true); };
  if (K.kind === 'nuke') {
    const [cx, cy] = K.at === 'self' ? [sl.x, sl.y] : pickDense(s, live, K.r, x, y, K.at === 'split' ? 'split' : null);
    Object.assign(ev, { x: cx, y: cy, r: K.r });
    live.filter(f => ell(f.x, f.y, cx, cy) <= K.r).sort((a, b) => b.d - a.d).slice(0, K.n).forEach(f => hitF(f, K.k));
  } else if (K.kind === 'single') {
    const f = live.slice().sort((a, b) => (b.boss - a.boss) || b.hp - a.hp)[0]; if (!f) return false;
    Object.assign(ev, { x: f.x, y: f.y }); hitF(f, K.k);
  } else if (K.kind === 'line') {
    const { g, on } = pickSeg(s, live, x, y); Object.assign(ev, { x: g.ax, y: g.ay, x2: g.bx, y2: g.by });
    on.sort((a, b) => b.d - a.d).slice(0, K.n).forEach(f => hitF(f, K.k));
  } else if (K.kind === 'nearEnd') {
    const fs = s.foes.filter(alive).sort((a, b) => b.d - a.d).slice(0, K.n); if (!fs.length) return false;
    Object.assign(ev, { x: fs[0].x, y: fs[0].y }); fs.forEach(f => { revealFoe(s, f, K.reveal || 0); hitF(f, K.k); });
  } else if (K.kind === 'global') {
    for (const f of s.foes) if (alive(f)) { if (K.reveal && f.camo) revealFoe(s, f, K.reveal); if (K.noRegen) f.noRegenT = Math.max(f.noRegenT, K.noRegen); }
    if (K.hitN) s.foes.filter(f => alive(f) && visible(f)).sort((a, b) => (b.camo - a.camo) || b.d - a.d).slice(0, K.hitN).forEach(f => hitF(f, K.k));
    if (K.cleanse) teamCleanse(s, sl, 0);
    if (K.haste) for (const o of s.slots) if (o.tw && ell(o.x, o.y, sl.x, sl.y) <= rangeOf(T)) giveHaste(o.tw, K.haste.k, K.haste.t);
  } else if (K.kind === 'haste') {
    for (const o of s.slots) if (o.tw && (K.scope === 'all' || ell(o.x, o.y, sl.x, sl.y) <= rangeOf(T))) { giveHaste(o.tw, K.k, K.t); if (K.cleanse) o.tw.fatigue = 0; }
  } else if (K.kind === 'cleanse') teamCleanse(s, sl, K.immuneT || 0);
  else if (K.kind === 'slowAll') { for (const f of s.foes) if (alive(f)) { f.slow = Math.max(f.slow, f.boss ? K.bossK : K.k); f.slowT = Math.max(f.slowT, K.t); } }
  else if (K.kind === 'rage') { T.rageT = K.t; T.rageK = K.k; }
  else if (K.kind === 'mice') { for (let j = 0; j < K.n; j++) spawnMouse(s, sl, T, E, s.lanes[0].L * (.15 + .7 * j / Math.max(1, K.n - 1)), { k: K.k || 1, reveal: K.reveal, noRegen: K.noRegen, hits: 4, detect: true }); }
  else if (K.kind === 'coin') { s.coin += K.v; s.coinSkillWave[T.uid] = s.wave; s.stat.earned += K.v; s.ev.push({ k: 'coin', x: sl.x, y: sl.y - 40, v: K.v }); }
  else if (K.kind === 'star') {
    const cs = s.slots.filter(o => o.tw && o !== sl && isDealer(o.tw)).sort((a, b) => dps(b.tw) - dps(a.tw)).slice(0, K.n);
    for (const c of cs) { c.tw.star = K.t; c.tw.starK = Math.max(c.tw.starK, K.k); if (K.add) { c.tw.starAdd = Math.max(c.tw.starAdd, K.add * E.dmg * lvK(T.lv)); c.tw.starIgn = !!E.starAddIgnore; } }
  }
  if (K.rage) { T.rageT = K.rage.t; T.rageK = K.rage.k; }
  T.skillCd = K.cd; s.stat.skills++; s.ev.push(ev);
  return ok(s, 'skill', x != null ? [i, x, y] : [i]);
}
function teamCleanse(s, sl, immune) {
  const to = []; for (const o of s.slots) if (o.tw) { if (o.tw.fatigue) to.push(o.i); o.tw.fatigue = 0; if (immune) o.tw.immuneT = Math.max(o.tw.immuneT, immune); }
  s.ev.push({ k: 'cleanse', slot: sl.i, to });
}
const giveHaste = (tw, k, t) => { tw.haste = Math.max(tw.haste, t); tw.hasteK = Math.max(tw.hasteK, k); };

// ---------- 重演 ----------
const OPS = { summon, summonPick, place, discard, drop, sell, upgrade, route: chooseRoute, reroute, skill: useSkill, callWave, unite: useUnite, super: useSuper };
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
    for (let n = 0; n < g.n; n++) s.spawnQ.push({ at: s.t + st + n * gap, kind: g.kind, mul: FOES[g.kind].boss ? bmul : mul, more: g.more });
    cur = st + g.n * gap;
  }
  s.spawnQ.sort((a, b) => a.at - b.at);
  s.ev.push({ k: 'wave', n: s.wave, boss: !!W.boss, name: W.name, teach: W.teach || [] });
}
function endWave(s) {
  if (s.wave >= WAVES.length) { s.state = 'win'; s.ev.push({ k: 'win' }); return; }
  const c = RULE.waveCoin[0] + RULE.waveCoin[1] * s.wave; s.coin += c; mom(s, RULE.mom.wave);
  s.phase = 'break'; s.waveT = RULE.breakT; s.freeMove = true; s.pickUsed = false; s.ev.push({ k: 'clear', n: s.wave, coin: c });
}

// ---------- 敵人 ----------
const alive = f => !f.gone && f.hp > 0 && !(f.down > 0);
export const visible = (f, T) => !f.camo || f.revealT > 0 || (!!T && (eff(T).detect || T.detectT > 0));
function spawn(s, kind, mul, more, at) {
  const F = FOES[kind], hp = Math.round(F.hp * mul), d = at ? at.d : 0, p = posAt(s.lanes[0], d);
  const armor = more?.armor ?? F.armor ?? 0, traits = [...(F.traits || []), ...(more?.traits || [])];
  if (armor > 0 && !traits.includes('armor')) traits.push('armor');
  const f = { uid: s.uid++, kind, lane: 0, d, hp, max: hp, spd: F.spd, armor, weak: F.weak || [], boss: !!F.boss, final: !!F.final, traits,
    camo: traits.includes('camo'), magic: traits.includes('magic'), regen: traits.includes('regen'), revealT: 0, breakT: 0, noRegenT: 0, quietT: 0, healed: 0, regenning: false,
    x: p.x, y: p.y, dir: p.dir, ph: s.rnd() * 6, hitT: 0, slow: 0, slowT: 0, stun: 0, burn: 0, burnT: 0, burnE: 'dark', burnAcc: 0, burnBlock: false, burnSpread: 0,
    mark: 0, markK: 1, sold: 0, iceN: 0, iceT: 0, revived: false, down: 0, fatT: 0, bState: 'walk', bT: 0, guard: false, broken: false, charge: 0, chargeDmg: 0, gone: false };
  s.foes.push(f); if (f.boss) s.ev.push({ k: 'boss', kind });
  return f;
}
const slowFoe = (f, k, t) => { const v = f.boss ? k * .5 : k; if (v >= f.slow) { f.slow = v; f.slowT = Math.max(f.slowT, t); } else f.slowT = Math.max(f.slowT, t * .5); };
const burnFoe = (f, v, t, e, block) => { if (v >= f.burn || f.burnT <= 0) { f.burn = v; f.burnE = e; } f.burnT = Math.max(f.burnT, t); if (block) f.burnBlock = true; };
const ctl = (s, f, t) => { if (f.boss) slowFoe(f, RULE.bossCtlK * 2, t); else { f.stun = Math.max(f.stun, t); s.ev.push({ k: 'stun', x: f.x, y: f.y }); } };
function revealFoe(s, f, t) { if (!f.camo || !t) return; if (f.revealT <= 0) s.ev.push({ k: 'reveal', x: f.x, y: f.y, uid: f.uid }); f.revealT = Math.max(f.revealT, t); }
function breakArmor(s, f, t) { if (!f.armor || !t) return; if (f.breakT <= 0) s.ev.push({ k: 'armorBreak', x: f.x, y: f.y, uid: f.uid }); f.breakT = Math.max(f.breakT, t); }

export function hurt(s, f, dmg, elem, T, o = {}) {
  if (!alive(f)) return 0;
  const E = T ? eff(T) : null; let k = 1, res = null;
  if (f.weak.includes(elem)) k *= f.mark > 0 ? RULE.markWeakK : RULE.weakK;
  if (f.magic && MAGIC[elem]) { k *= RULE.magicK; res = 'magic'; }
  if (f.armor && f.breakT <= 0) {
    if (E && E.pierceArmor) k *= E.pierceArmor;
    else if (!(E && (E.ignoreArmor || o.ignoreArmor))) { k *= 1 - f.armor; res = res || 'armor'; }
  }
  if (f.mark > 0) k *= f.markK;
  if (f.guard) k *= FOES[f.kind].pot.guardK;
  if (f.broken) k *= (FOES[f.kind].pot || FOES[f.kind].scroll).brokenK;
  if (E) {
    if (E.execute && f.hp < f.max * E.execute) k *= E.executeK;
    const vs = E.vs; if (vs) {
      if (vs.half && f.hp < f.max * .5) k *= vs.half; if (vs.boss && f.boss) k *= vs.boss; if (vs.camo && f.camo) k *= vs.camo;
      for (const tr of ['fast', 'split', 'regen']) if (vs[tr] && f.traits.includes(tr)) k *= vs[tr];
      if (vs.mini && f.kind === 'mini') k *= vs.mini;
    }
    if (T.star > 0 && T.starBossK > 1 && f.boss) k *= T.starBossK;
  }
  const d = Math.max(1, Math.round(dmg * k));
  f.hp -= d; f.hitT = .15; f.quietT = 0; if (f.charge > 0) f.chargeDmg += d;
  const who = T ? T.id : o.src || 'unite'; s.stat.dmg[who] = (s.stat.dmg[who] || 0) + Math.min(d, d + f.hp);
  s.ev.push({ k: 'dmg', x: f.x, y: f.y, v: d, weak: f.weak.includes(elem), elem, res });
  if (f.hp <= 0) killFoe(s, f, T);
  return d;
}
function killFoe(s, f, T) {
  const F = FOES[f.kind];
  if (F.revive && !f.revived) { f.revived = true; f.hp = 0; f.down = F.reviveT; f.burnT = 0; f.slowT = 0; f.slow = 0; s.ev.push({ k: 'down', x: f.x, y: f.y, uid: f.uid }); return; }
  f.hp = 0; f.gone = true; s.kills++; const cv = (F.coin || 1) + f.sold; s.coin += cv; s.stat.earned += cv; s.ev.push({ k: 'coin', x: f.x, y: f.y, v: cv }); mom(s, f.boss ? RULE.mom.boss : RULE.mom.kill);
  if (T) T.kills++;
  s.ev.push({ k: 'die', x: f.x, y: f.y, kind: f.kind, boss: f.boss, uid: f.uid });
  if (F.split) {      // 轉寄：原地吐出小兵
    const n = F.split.n; s.ev.push({ k: 'split', x: f.x, y: f.y, uid: f.uid, n });
    for (let j = 0; j < n; j++) { const m = spawn(s, F.split.kind, 1, null, { d: Math.max(0, f.d - 14 * j) }); m.hp = m.max = Math.max(1, Math.round(f.max * F.split.hpK)); }
    if (T) { const E = eff(T); if (E.splitShock) { const sh = E.splitShock; s.foes.filter(o => alive(o) && visible(o, T) && ell(o.x, o.y, f.x, f.y) <= sh.r).slice(0, sh.n).forEach(o => hurt(s, o, E.dmg * atkOf(T) * sh.k, E.elem, T)); } }
  }
  if (f.burnT > 0 && f.burnSpread > 0) {      // 阿傑 A：被燒的人倒下傳火
    s.foes.filter(o => alive(o) && o !== f && o.burnT <= 0 && ell(o.x, o.y, f.x, f.y) <= 90).slice(0, f.burnSpread).forEach(o => burnFoe(o, f.burn, 3, f.burnE, f.burnBlock));
  }
}
function addFatigue(s, sl, x, y) {
  const T = sl.tw; if (!T) return;
  if (T.super > 0 || T.immuneT > 0) return;
  if (T.shield) { T.shield = false; s.ev.push({ k: 'shield', slot: sl.i }); return; }
  if (T.fatigue >= RULE.fatMax) return;
  T.fatigue++; T.fatT = 0; s.ev.push({ k: 'fatigue', slot: sl.i, n: T.fatigue, x, y });
}
const nearSlots = (s, x, y, r) => s.slots.filter(sl => sl.tw && ell(sl.x, sl.y, x, y) <= r).sort((a, b) => ell(a.x, a.y, x, y) - ell(b.x, b.y, x, y));

function foeStep(s, f, dt) {
  const F = FOES[f.kind];
  f.hitT = Math.max(0, f.hitT - dt);
  if (f.revealT > 0) f.revealT = Math.max(0, f.revealT - dt);
  if (f.breakT > 0) f.breakT = Math.max(0, f.breakT - dt);
  if (f.noRegenT > 0) f.noRegenT = Math.max(0, f.noRegenT - dt);
  if (f.down > 0) { f.down -= dt; if (f.down <= 0) { f.down = 0; f.hp = Math.round(f.max * F.revive); s.ev.push({ k: 'revive', x: f.x, y: f.y, uid: f.uid }); } return; }
  if (f.burnT > 0) { f.burnT -= dt; f.burnAcc += dt; if (f.burnAcc >= .5) { f.burnAcc -= .5; hurt(s, f, f.burn, f.burnE, null, { src: 'burn' }); if (!alive(f)) return; } if (f.burnT <= 0) f.burnBlock = false; } else f.burnAcc = 0;
  // 再生：3 秒沒挨打就回血；不能再生（或燒著被封住）時重新計時
  if (f.regen) {
    const R = RULE.regen, blocked = f.noRegenT > 0 || (f.burnT > 0 && f.burnBlock);
    if (blocked) f.quietT = 0; else f.quietT += dt;
    const can = !blocked && f.quietT >= R.quiet && f.hp < f.max && f.healed < f.max * R.cap;
    if (can && !f.regenning) s.ev.push({ k: 'regen', x: f.x, y: f.y, uid: f.uid });
    f.regenning = can;
    if (can) { const h = Math.min(f.max * R.per * dt, f.max - f.hp, f.max * R.cap - f.healed); f.hp += h; f.healed += h; }
  }
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
  for (const c of s.cones) if (Math.hypot(c.x - f.x, c.y - f.y) <= 24) {
    slow = Math.max(slow, f.boss ? c.slow * .5 : c.slow);
    if (!c.hit.has(f.uid)) { c.hit.add(f.uid); const T = s.slots.find(x => x.tw && x.tw.uid === c.owner)?.tw;
      if (c.stun && !f.boss) f.stun = Math.max(f.stun, c.stun);
      if (c.dmg && visible(f, null)) { hurt(s, f, c.dmg, 'blunt', T || null, { src: 'an' }); if (alive(f)) breakArmor(s, f, c.brk); } }
  }
  f.d += f.spd * (1 - slow) * dt;
  const L = s.lanes[f.lane], p = posAt(L, f.d); f.x = p.x; f.y = p.y; if (p.dir) f.dir = p.dir;
  if (f.d >= L.L) {
    f.gone = true; s.leaks++; s.stat.leakBy[f.kind] = (s.stat.leakBy[f.kind] || 0) + 1;
    if (f.final) { s.lives = 0; s.ev.push({ k: 'leak', kind: f.kind, v: s.livesMax, final: true }); return; }
    const v = f.boss ? RULE.bossLeak : F.leak || RULE.leak; s.lives -= v; s.ev.push({ k: 'leak', kind: f.kind, v });
  }
}

// ---------- 同事 ----------
export const dirOf = (sl, x, y) => { const dx = x - sl.x, dy = y - sl.y; return Math.abs(dy) > Math.abs(dx) * .9 ? (dy > 0 ? 'down' : 'up') : 'side'; };
const shotEv = (s, sl, T, x, y, more = {}) => s.ev.push({ k: 'shot', slot: sl.i, id: T.id, uid: T.uid, x, y, elem: TOWERS[T.id].elem, kind: TOWERS[T.id].kind, dir: dirOf(sl, x, y), flip: x < sl.x, ...more });
const isDealer = T => !['support'].includes(TOWERS[T.id].kind);
const atkOf = T => lvK(T.lv) * (1 + (T.star > 0 ? T.starK : 0)) * (T.super > 0 ? RULE.superDmg : 1);
const spdOf = T => (1 - RULE.fatK * T.fatigue * (T.haste > 0 && T.fatHalf ? .5 : 1)) * (1 + (T.haste > 0 ? T.hasteK : 0)) * (T.super > 0 ? RULE.superSpd : 1) * (T.rageT > 0 ? T.rageK : 1);
const dps = T => { const E = eff(T); return E.dmg * lvK(T.lv) / E.rate; };

function pick(s, sl, T, E, r) {      // 蓄力中的頭目優先（集火打斷）；看不到的掛名跳過；其他照 target
  let best = null, bv = -Infinity;
  for (const f of s.foes) {
    if (!alive(f) || !visible(f, T) || ell(f.x, f.y, sl.x, sl.y) > r) continue;
    let v = f.charge > 0 ? 1e9 : E.target === 'strong' ? f.hp + (f.boss ? 1e6 : 0) : E.target === 'weak' ? -f.hp : f.d;
    if (E.preferCamo && f.camo) v += 1e7;
    if (v > bv) { bv = v; best = f; }
  }
  return best;
}
function onHit(s, sl, T, E, f, dmg, o = {}) {
  hurt(s, f, dmg, E.elem, T, o);
  if (T.iceShots > 0) hurt(s, f, T.iceDmg, 'ice', T);
  if (T.star > 0 && T.starAdd > 0) hurt(s, f, T.starAdd, 'blunt', T, { ignoreArmor: T.starIgn });
  if (!alive(f)) return;
  if (E.slow) slowFoe(f, E.slow, E.slowT);
  if (E.burn) burnFoe(f, E.burn * atkOf(T), E.burnT, E.elem, !!E.burnNoRegen);
  if (E.burnSpread && f.burnT > 0) f.burnSpread = Math.max(f.burnSpread, E.burnSpread);
  if (E.freezeN) {
    f.iceN++; f.iceT = 1.2;
    if (f.iceN >= (T.super > 0 ? 2 : E.freezeN)) { f.iceN = 0; if (f.boss) slowFoe(f, .6, 1.5); else { f.stun = Math.max(f.stun, E.freezeT); s.ev.push({ k: 'freeze', x: f.x, y: f.y }); } }
  }
  if (E.deal && !f.sold) f.sold = Math.round(E.deal * lvK(T.lv));
  if (E.revealOnHit) revealFoe(s, f, E.revealOnHit);
  if (E.noRegenOnHit) f.noRegenT = Math.max(f.noRegenT, E.noRegenOnHit);
  if (E.breakOnHit) breakArmor(s, f, E.breakOnHit);
  if (o.brk) breakArmor(s, f, o.brk);
}
function fire(s, sl, T, E) {
  const r = rangeOf(T), tgt = pick(s, sl, T, E, r); if (!tgt) return false;
  const dmg = E.dmg * atkOf(T);
  if (E.kind === 'single') {
    let k = 1, heavy = false;
    if (E.combo) { if (T.comboUid === tgt.uid) T.comboN++; else { T.comboUid = tgt.uid; T.comboN = 1; } if (T.comboN % E.combo === 0) { k = E.comboK; heavy = true; } }
    if (E.markT) {
      if (T.markUid && T.markUid !== tgt.uid) { const o = s.foes.find(f => f.uid === T.markUid); if (o) { o.mark = 0; o.markK = 1; } }
      T.markUid = tgt.uid; tgt.mark = E.markT; tgt.markK = E.markK || 1; if (E.markBreak) breakArmor(s, tgt, E.markT);
    }
    shotEv(s, sl, T, tgt.x, tgt.y, heavy ? { heavy } : {});
    const o = heavy ? { ignoreArmor: !!E.comboIgnoreArmor, brk: E.comboBreak } : {};
    onHit(s, sl, T, E, tgt, dmg * k, o);
    if (heavy && E.comboSplash) { const cs = E.comboSplash;      // 小葵 B：第三刀橫掃
      s.foes.filter(f => f !== tgt && alive(f) && visible(f, T) && ell(f.x, f.y, tgt.x, tgt.y) <= cs.r).slice(0, cs.n - 1).forEach(f => onHit(s, sl, T, E, f, dmg * cs.k)); }
  } else if (E.kind === 'splash' || E.kind === 'aura') {
    const R = E.kind === 'aura' ? r : E.radius * (T.super > 0 ? 1.3 : 1), cx = E.kind === 'aura' ? sl.x : tgt.x, cy = E.kind === 'aura' ? sl.y : tgt.y;
    shotEv(s, sl, T, tgt.x, tgt.y, { radius: R });
    const hit = s.foes.filter(f => alive(f) && visible(f, T) && ell(f.x, f.y, cx, cy) <= R);
    T.hitN++; const stun = E.stunEvery && T.hitN % (T.super > 0 ? 2 : E.stunEvery) === 0;
    hit.forEach((f, j) => {
      onHit(s, sl, T, E, f, dmg);
      if (stun && j < E.stunN + T.lv - 1 && alive(f)) { if (f.boss) slowFoe(f, .5, 1); else { f.stun = Math.max(f.stun, E.stunT); s.ev.push({ k: 'stun', x: f.x, y: f.y }); } if (E.stunBreak) breakArmor(s, f, E.stunBreak); }
    });
  } else if (E.kind === 'line') {
    const ox = sl.x, oy = sl.y - 20, len = Math.hypot(tgt.x - ox, tgt.y - oy) || 1, ux = (tgt.x - ox) / len, uy = (tgt.y - oy) / len, L = r * 1.05;
    const w = E.width * (T.super > 0 ? 1.6 : 1), n = E.pierce + (T.lv - 1) + (T.super > 0 ? 2 : 0);
    const hit = [];
    for (const f of s.foes) { if (!alive(f) || !visible(f, T)) continue; const px = f.x - ox, py = f.y - oy, t = px * ux + py * uy; if (t < 0 || t > L) continue; if (Math.abs(px * uy - py * ux) <= w) hit.push([t, f]); }
    hit.sort((a, b) => a[0] - b[0]);
    shotEv(s, sl, T, tgt.x, tgt.y, { x2: ox + ux * L, y2: oy + uy * L });
    hit.slice(0, n).forEach(([, f]) => onHit(s, sl, T, E, f, dmg));
  } else if (E.kind === 'summon') {
    const mine = s.mice.filter(m => m.owner === T.uid).length; if (mine >= E.mice + T.lv - 1) return false;
    const L = s.lanes[0]; let bd = 1e9, bestD = 0;
    for (let d = 0; d <= L.L; d += 12) { const p = posAt(L, d), e = ell(p.x, p.y, sl.x, sl.y); if (e < bd) { bd = e; bestD = d; } }
    if (bd > r) return false;
    spawnMouse(s, sl, T, E, bestD, {}); shotEv(s, sl, T, s.mice[s.mice.length - 1].x, s.mice[s.mice.length - 1].y);
  }
  return true;
}
function spawnMouse(s, sl, T, E, d, o) {
  const p = posAt(s.lanes[0], d);
  s.mice.push({ uid: s.uid++, owner: T.uid, d, x: p.x, y: p.y, t: E.miceT || 5, dmg: E.dmg * atkOf(T) * (o.k || 1), stun: E.miceStun || .4,
    hits: o.hits || E.miceHits || 1, hit: new Set(), detect: o.detect || !!E.miceDetect, reveal: o.reveal || E.miceReveal || 0, noRegen: o.noRegen || E.miceNoRegen || 0 });
  s.ev.push({ k: 'mouse', x: p.x, y: p.y });
}
// 定期的支援：小米解疲勞／護盾、Vivi 本月之星、茶茶珍奶、許許藥瓶、小安三角錐、小蝶跳舞、揭露掛名
function support(s, sl, T, E) {
  const r = rangeOf(T), near = s.slots.filter(o => o.tw && ell(o.x, o.y, sl.x, sl.y) <= r);
  const fast = T.super > 0 ? .5 : 1;
  if (E.revealAura && T.revT >= 1) {      // 揭露：每秒讓射程內的掛名現形
    T.revT = 0; for (const f of s.foes) if (f.camo && alive(f) && ell(f.x, f.y, sl.x, sl.y) <= r) revealFoe(s, f, E.revealAura);
  }
  if (E.heal != null) {
    if (T.skT < E.heal * fast) return; T.skT = 0;
    const tired = near.filter(o => o.tw.fatigue > 0), to = [];
    if (tired.length) { for (const o of tired) { o.tw.fatigue = Math.max(0, o.tw.fatigue - T.lv); to.push(o.i); if (E.healShield) o.tw.shield = true; } if (s.momCd <= 0) { mom(s, RULE.mom.cleanse); s.momCd = RULE.mom.cleanseCd; } }
    else for (const o of near.filter(o => !o.tw.shield).slice(0, 1 + T.lv)) { o.tw.shield = true; to.push(o.i); }
    if (E.grantDetect) for (const o of near) o.tw.detectT = Math.max(o.tw.detectT, E.grantDetect);
    if (to.length) s.ev.push({ k: 'cleanse', slot: sl.i, to });
  } else if (E.star) {
    if (T.skT < E.star * fast) return;
    const c = near.filter(o => o !== sl && isDealer(o.tw) && !(o.tw.star > 0)).sort((a, b) => dps(b.tw) - dps(a.tw))[0];
    if (!c) return; T.skT = 0; c.tw.star = E.starT; c.tw.starK = E.starK * lvK(T.lv); c.tw.starBossK = E.starBoss || 1;
    if (E.starAdd) { c.tw.starAdd = E.starAdd * E.dmg * lvK(T.lv); c.tw.starIgn = !!E.starAddIgnore; }
    s.ev.push({ k: 'buff', slot: sl.i, to: c.i, kind: 'star' }); shotEv(s, sl, T, c.x, c.y);
  } else if (E.haste) {
    if (T.skT < E.rate * fast) return;
    const cs = near.filter(o => o !== sl && isDealer(o.tw)).sort((a, b) => (a.tw.haste > 0) - (b.tw.haste > 0) || b.tw.lv - a.tw.lv).slice(0, E.hasteN || 1);
    if (!cs.length) return; T.skT = 0;
    for (const c of cs) { c.tw.haste = E.hasteT; c.tw.hasteK = E.haste * (1 + .4 * (T.lv - 1)); c.tw.fatHalf = !!E.hasteFatHalf; if (E.grantDetect) c.tw.detectT = Math.max(c.tw.detectT, E.grantDetect); s.ev.push({ k: 'buff', slot: sl.i, to: c.i, kind: 'haste' }); }
    shotEv(s, sl, T, cs[0].x, cs[0].y);
  } else if (E.potion) {
    if (T.skT < E.potion * fast) return;
    const cs = near.filter(o => o !== sl).sort((a, b) => b.tw.fatigue - a.tw.fatigue || b.tw.lv - a.tw.lv).slice(0, E.potionN || 1);
    if (!cs.length) return; T.skT = 0;
    for (const c of cs) { if (c.tw.fatigue > 0 && s.momCd <= 0) { mom(s, RULE.mom.cleanse); s.momCd = RULE.mom.cleanseCd; }
      c.tw.fatigue = 0; c.tw.iceShots = E.potionShots; c.tw.iceDmg = E.potionDmg * lvK(T.lv); if (E.potionHaste) giveHaste(c.tw, E.potionHaste, 5); s.ev.push({ k: 'buff', slot: sl.i, to: c.i, kind: 'potion' }); }
  } else if (E.cone) {
    if (T.skT < E.cone * fast) return;
    const L = s.lanes[0], pts = []; for (let d = 0; d <= L.L; d += 10) { const p = posAt(L, d); if (ell(p.x, p.y, sl.x, sl.y) <= r) pts.push(p); }
    if (!pts.length) return; T.skT = 0;
    const mine = s.cones.filter(c => c.owner === T.uid), maxN = Math.max(T.lv, E.coneN || 1); if (mine.length >= maxN) s.cones.splice(s.cones.indexOf(mine[0]), 1);
    const p = pts[Math.floor(pts.length * (mine.length % 2 ? .3 : .6))];
    s.cones.push({ owner: T.uid, x: p.x, y: p.y, t: E.coneT, slow: E.coneSlow, stun: E.coneStun || 0, dmg: E.coneDmg ? E.coneDmg * E.dmg * atkOf(T) : 0, brk: E.coneBreak || 0, hit: new Set() });
    s.ev.push({ k: 'cone', x: p.x, y: p.y });
  } else if (E.dance) {
    if (T.skT < E.dance * fast) return; T.skT = 0;
    for (const o of s.slots) if (o.tw && o !== sl && ell(o.x, o.y, sl.x, sl.y) <= E.danceR && o.tw.danceT >= E.dance - .1) { o.tw.cd -= E.danceCut * (1 + .5 * (T.lv - 1)); o.tw.danceT = 0; if (E.danceCleanse) o.tw.fatigue = 0; }
    s.ev.push({ k: 'buff', slot: sl.i, to: sl.i, kind: 'dance' });
  }
}
function towerStep(s, sl, dt) {
  const T = sl.tw, E = eff(T);
  T.skT += dt; T.danceT += dt; T.revT += dt;
  if (T.skillCd > 0) T.skillCd = Math.max(0, T.skillCd - dt);
  if (T.super > 0) T.super = Math.max(0, T.super - dt);
  if (T.rageT > 0) T.rageT = Math.max(0, T.rageT - dt);
  if (T.immuneT > 0) T.immuneT = Math.max(0, T.immuneT - dt);
  if (T.detectT > 0) T.detectT = Math.max(0, T.detectT - dt);
  if (T.haste > 0) T.haste = Math.max(0, T.haste - dt); else T.hasteK = 0;
  if (T.star > 0) T.star = Math.max(0, T.star - dt); else { T.starK = 0; T.starAdd = 0; T.starBossK = 1; }
  if (T.fatigue > 0) { T.fatT += dt; if (T.fatT >= RULE.fatDecay) { T.fatigue--; T.fatT = 0; } }
  support(s, sl, T, E);
  if (E.kind === 'support') return;
  T.cd -= dt * spdOf(T);
  if (T.cd <= 0) { if (fire(s, sl, T, E)) { T.cd += E.rate; if (T.iceShots > 0) T.iceShots--; } else T.cd = 0; }
}

// ---------- 一步 ----------
export function step(s, dt = DT) {
  if (s.state !== 'play') return;
  s.n++; s.t += dt;
  s.salT += RULE.salary * dt; if (s.salT >= 1 - 1e-6) { const v = Math.floor(s.salT + 1e-6); s.salT -= v; s.coin += v; }      // 月薪
  s.momCd = Math.max(0, s.momCd - dt);
  for (const k in s.cds) s.cds[k] = Math.max(0, s.cds[k] - dt);
  if (s.phase === 'break') { s.waveT -= dt; if (s.waveT <= 0) startWave(s); }
  while (s.spawnQ.length && s.spawnQ[0].at <= s.t) { const q = s.spawnQ.shift(); spawn(s, q.kind, q.mul, q.more); }
  for (const f of s.foes) if (!f.gone) foeStep(s, f, dt);
  // 老鼠往入口方向衝，撞到敵人就造成傷害（看不到的掛名撞不到，除非是查帳鼠）
  for (const m of s.mice) {
    m.t -= dt; m.d -= TOWERS.fairy.miceSpd * dt; if (m.d < 0) m.t = 0;
    const p = posAt(s.lanes[0], Math.max(0, m.d)); m.x = p.x; m.y = p.y;
    if (m.t <= 0) continue;
    const f = s.foes.find(f => alive(f) && !m.hit.has(f.uid) && (m.detect || visible(f)) && Math.hypot(f.x - m.x, f.y - m.y) < 20);
    if (f) { const T = s.slots.find(x => x.tw && x.tw.uid === m.owner)?.tw; m.hit.add(f.uid);
      revealFoe(s, f, m.reveal); if (m.noRegen) f.noRegenT = Math.max(f.noRegenT, m.noRegen);
      hurt(s, f, m.dmg, 'holy', T || null, { src: 'fairy' }); if (alive(f) && !f.boss) f.stun = Math.max(f.stun, m.stun);
      if (m.hit.size >= m.hits) m.t = 0; }
  }
  s.mice = s.mice.filter(m => m.t > 0);
  for (const c of s.cones) c.t -= dt; s.cones = s.cones.filter(c => c.t > 0);
  for (const sl of s.slots) if (sl.tw) towerStep(s, sl, dt);
  s.foes = s.foes.filter(f => !f.gone);
  if (s.lives <= 0) { s.lives = 0; s.state = 'lose'; s.ev.push({ k: 'lose' }); return; }
  if (s.phase === 'fight' && !s.spawnQ.length && !s.foes.length) endWave(s);
}
