// 準時下班防衛戰 3D 版｜戰鬥核心（純邏輯，不碰畫面；node 也能跑，給 tools/sim3d.mjs 用）
// 畫面只讀狀態 s 和事件 s.ev（每一格畫面讀完自己清掉）。
import { HERO, FOE, WAVES, RULE, DIFF, RAT, LV, PHYS, elemMul, statsOf, upgradeCost } from './rules.js';

export const DT = 1 / 30;
export function newGame(map, seed = 1, diff = 'normal') {
  const pts = map.path, seg = []; let len = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); len += l; }
  const D = DIFF[diff] || DIFF.normal;
  const s = { t: 0, diff, D, coin: D.coin0, lives: RULE.lives, wave: 0, phase: 'prep', prepT: 0, skillCd: 0, skillT: 0, early: 0, slots: map.slots.map(([x, z]) => ({ x, z, h: null })), foes: [], rats: [], shots: [], ev: [], q: [], nid: 1, kills: 0, leaks: 0, pts, seg, len, seed: seed >>> 0 };
  // 每個工位離走道最近的那一點（鼠仙女的老鼠從那裡下場）
  for (const sl of s.slots) { let bd = 1e9; for (let d = 2; d < len; d += .25) { const p = posAt(s, d), dd = (p.x - sl.x) ** 2 + (p.z - sl.z) ** 2; if (dd < bd) { bd = dd; sl.pd = d; } } }
  return s;
}
function rand(s) { s.seed = (s.seed + 0x6d2b79f5) | 0; let t = Math.imul(s.seed ^ (s.seed >>> 15), 1 | s.seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export function posAt(s, d) {
  let i = 0; d = Math.max(0, Math.min(s.len - 1e-4, d));
  while (i < s.seg.length - 1 && d > s.seg[i]) { d -= s.seg[i]; i++; }
  const a = s.pts[i], b = s.pts[i + 1], t = d / s.seg[i];
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / s.seg[i], dz: (b[1] - a[1]) / s.seg[i] };
}

// ── 玩家的操作 ──
export const placed = (s, id) => s.slots.some(sl => sl.h && sl.h.id === id);
export const canPlace = (s, i, id) => !!HERO[id] && !s.slots[i].h && !placed(s, id) && s.coin >= HERO[id].cost && s.phase !== 'won' && s.phase !== 'lost';
export function place(s, i, id) {
  if (!canPlace(s, i, id)) return false;
  s.coin -= HERO[id].cost; s.slots[i].h = { id, lv: 1, cd: 0.3, fz: 0, pz: 0, imm: 0, sum: 2, cure: 0, spent: HERO[id].cost, fresh: s.phase === 'prep', fx: 0, fz2: 1, bAtk: 0, bSpd: 0 };
  s.ev.push({ k: 'place', i, id }); return true;
}
export const canUpgrade = (s, i) => { const h = s.slots[i].h; return !!h && h.lv < RULE.maxLv && s.coin >= upgradeCost(h.id, h.lv); };
export function upgrade(s, i) {
  if (!canUpgrade(s, i)) return false; const h = s.slots[i].h, c = upgradeCost(h.id, h.lv);
  s.coin -= c; h.spent += c; h.lv++; s.ev.push({ k: 'up', i, lv: h.lv }); return true;
}
// 還沒開打就調走＝全額退（放錯可以反悔）；打過一波之後退六成
export const sellValue = (s, i) => { const h = s.slots[i].h; return h ? (h.fresh ? h.spent : Math.round(h.spent * RULE.sellBack)) : 0; };
export function sell(s, i) { const h = s.slots[i].h; if (!h) return false; s.coin += sellValue(s, i); s.slots[i].h = null; s.ev.push({ k: 'sell', i }); return true; }
export const canStart = s => s.phase === 'prep' && s.wave < WAVES.length;
export function startWave(s) {
  if (!canStart(s)) return false;
  for (const [type, n, gap, delay] of WAVES[s.wave]) for (let k = 0; k < n; k++) s.q.push({ t: s.t + 1 + delay + k * gap, type });
  // 倒數還沒走完就提早開：剩幾秒就多拿幾元
  const bonus = s.wave > 0 ? Math.min(RULE.earlyMax, Math.floor(s.prepT)) : 0; if (bonus > 0) { s.coin += bonus; s.early += bonus; }
  for (const sl of s.slots) if (sl.h) sl.h.fresh = false;
  s.q.sort((a, b) => a.t - b.t); s.phase = 'fight'; s.prepT = 0; s.ev.push({ k: 'wave', n: s.wave + 1, bonus, boss: WAVES[s.wave].some(g => FOE[g[0]].leak) }); return true;
}
export const earlyBonus = s => (s.phase === 'prep' && s.wave > 0 ? Math.min(RULE.earlyMax, Math.floor(s.prepT)) : 0);
// 主動技能「精神喊話」：全員出手加快幾秒
export const canSkill = s => s.phase === 'fight' && s.skillCd <= 0 && s.slots.some(sl => sl.h);
export function useSkill(s) { if (!canSkill(s)) return false; s.skillT = RULE.skill.dur; s.skillCd = RULE.skill.cd; s.ev.push({ k: 'skill' }); return true; }
export function waveInfo(w) { const m = {}; for (const [type, n] of WAVES[w] || []) m[type] = (m[type] || 0) + n; return Object.entries(m).map(([type, n]) => ({ type, n, elem: FOE[type].elem })); }

// ── 內部 ──
function spawn(s, type, d = 0) {
  const F = FOE[type], hp = Math.round(F.hp * RULE.hpK[Math.min(s.wave, RULE.hpK.length - 1)] * s.D.hpK), p = posAt(s, d);
  const f = { id: s.nid++, type, d, hp, max: hp, sp: F.sp, elem: F.elem, x: p.x, z: p.z, dx: p.dx, dz: p.dz, slowK: 0, slowT: 0, aura: 0, stun: 0, burn: 0, burnT: 0, last: -9, cast: F.cast ? F.cast.every * (.5 + rand(s) * .4) : 0, block: null };
  s.foes.push(f); s.ev.push({ k: 'spawn', f }); return f;
}
function hurt(s, f, base, elem, src) {
  if (f.hp <= 0) return 0;
  const F = FOE[f.type]; let mul = elemMul(elem, f.elem);
  if (F.armor) mul *= elem === 'fist' ? (src && src.armorK) || 1.5 : elem === 'slash' ? 0.6 : 0.8;
  const v = base * mul; f.hp -= v; f.last = s.t;
  s.ev.push({ k: 'dmg', x: f.x, z: f.z, v: Math.max(1, Math.round(v)), mul: elemMul(elem, f.elem), elem, big: !!F.leak });
  if (f.hp <= 0) f.by = src;
  return v;
}
const inRange = (sl, f, r) => (f.x - sl.x) ** 2 + (f.z - sl.z) ** 2 <= r * r;
function pick(s, sl, r, elem, mode, n = 1) {
  const c = s.foes.filter(f => f.hp > 0 && f.d > 0.6 && inRange(sl, f, r) && !(PHYS[elem] && FOE[f.type].ghost));
  if (mode === 'weak') c.sort((a, b) => a.hp / a.max - b.hp / b.max); else if (mode === 'strong') c.sort((a, b) => b.hp - a.hp); else c.sort((a, b) => b.d - a.d);
  return c.slice(0, n);
}
function splash(s, x, z, r, dmg, elem, st, skip) {
  for (const f of s.foes) if (f !== skip && f.hp > 0 && (f.x - x) ** 2 + (f.z - z) ** 2 <= r * r) { hurt(s, f, dmg, elem, st); effects(s, f, st); }
}
function effects(s, f, st) {
  if (st.burn) { f.burn = Math.max(f.burn, st.burn); f.burnT = 3; }
  if (st.wet) { f.slowK = Math.max(f.slowK, st.wet); f.slowT = 1.6; }
}

export function step(s, dt = DT) {
  if (s.phase === 'won' || s.phase === 'lost') return;
  s.t += dt;
  if (s.skillCd > 0) s.skillCd -= dt; if (s.skillT > 0) s.skillT -= dt;
  if (s.phase === 'prep' && s.wave > 0) { s.prepT -= dt; if (s.prepT <= 0) startWave(s); }
  while (s.q.length && s.q[0].t <= s.t) spawn(s, s.q.shift().type);

  // 輔助光環：先算好每個人吃到多少
  for (const sl of s.slots) { const h = sl.h; if (h) { h.bAtk = 0; h.bSpd = 0; } }
  for (const f of s.foes) f.aura = 0;
  s.slots.forEach((sl, i) => {
    const h = sl.h; if (!h || h.fz > 0) return; const H = HERO[h.id], st = statsOf(h.id, h.lv);
    if (H.kind === 'buff' || H.kind === 'haste') for (const o of s.slots) if (o.h && o !== sl && (o.x - sl.x) ** 2 + (o.z - sl.z) ** 2 <= st.range ** 2) { if (st.atkUp) o.h.bAtk = Math.max(o.h.bAtk, st.atkUp); o.h.bSpd = Math.min(0.9, o.h.bSpd + st.spdUp); }
    if (H.kind === 'slow') for (const f of s.foes) if (inRange(sl, f, st.range)) f.aura = Math.max(f.aura, st.slow);
  });

  // 敵人
  for (const f of s.foes) {
    if (f.hp <= 0) continue; const F = FOE[f.type];
    if (f.burnT > 0) { f.burnT -= dt; const v = f.burn * dt; f.hp -= v * elemMul('fire', f.elem); f.last = s.t; if (f.hp <= 0) { f.by = null; continue; } }
    if (F.regen && s.t - f.last > 2 && f.hp < f.max) f.hp = Math.min(f.max, f.hp + F.regen * dt);
    if (f.slowT > 0) { f.slowT -= dt; if (f.slowT <= 0) f.slowK = 0; }
    if (F.cast) {
      f.cast -= dt;
      if (f.cast <= 0) {
        const c = F.cast, tg = s.slots.map((sl, i) => ({ sl, i, d: (sl.x - f.x) ** 2 + (sl.z - f.z) ** 2 })).filter(o => o.sl.h && o.sl.h.imm <= 0 && o.sl.h.fz <= 0 && o.sl.h.pz <= 0 && o.d <= c.range ** 2).sort((a, b) => a.d - b.d).slice(0, c.n);
        if (tg.length) { for (const o of tg) { if (c.kind === 'freeze') o.sl.h.fz = c.dur; else o.sl.h.pz = c.dur; } s.ev.push({ k: 'cast', f, kind: c.kind, to: tg.map(o => o.i) }); f.cast = c.every; } else f.cast = 0.5;
      }
    }
    if (f.stun > 0) { f.stun -= dt; continue; }
    if (f.block && (f.block.hp <= 0 || f.block.dead)) f.block = null;
    if (f.block) { f.block.hp -= (F.bite || 12) * dt; continue; }
    f.d += f.sp * (1 - Math.min(0.7, Math.max(f.slowK, f.aura))) * dt;
    if (f.d >= s.len) { f.hp = 0; f.leaked = true; const n = F.leak || 1; s.lives = Math.max(0, s.lives - n); s.leaks += n; s.ev.push({ k: 'leak', n, f }); continue; }
    const p = posAt(s, f.d); f.x = p.x; f.z = p.z; f.dx = p.dx; f.dz = p.dz;
  }

  // 老鼠：往電梯方向跑，碰到敵人就擋住咬
  for (const r of s.rats) {
    if (r.dead) continue; const R = RAT[r.kind]; r.life -= dt;
    if (r.hp <= 0 || r.life <= 0 || r.d <= 0.8) { r.dead = true; s.ev.push({ k: 'ratEnd', r }); continue; }
    if (r.tg && (r.tg.hp <= 0 || Math.abs(r.tg.d - r.d) > 1.2)) { if (r.tg.block === r) r.tg.block = null; r.tg = null; }
    if (!r.tg) { let best = null; for (const f of s.foes) if (f.hp > 0 && !FOE[f.type].ghost && f.d <= r.d + 0.3 && f.d >= r.d - 0.8 && (!best || f.d > best.d)) best = f; if (best) { r.tg = best; if (!best.block) best.block = r; } }
    if (r.tg) { r.bite -= dt; if (r.bite <= 0) { r.bite = 0.5; hurt(s, r.tg, R.bite * LV[r.lv - 1], 'none', null); s.ev.push({ k: 'ratBite', r }); } }
    else { r.d -= R.sp * dt; const p = posAt(s, r.d); r.x = p.x; r.z = p.z; r.dx = -p.dx; r.dz = -p.dz; }
  }
  s.rats = s.rats.filter(r => !r.dead);

  // 同事
  s.slots.forEach((sl, i) => {
    const h = sl.h; if (!h) return; const H = HERO[h.id], st = statsOf(h.id, h.lv);
    if (h.imm > 0) h.imm -= dt;
    if (h.fz > 0) { h.fz -= dt; if (h.fz <= 0) h.imm = RULE.immune; return; }
    if (h.pz > 0) { h.pz -= dt; if (h.pz <= 0) h.imm = RULE.immune; }
    const rate = (1 + h.bSpd + (s.skillT > 0 ? RULE.skill.spd : 0)) * (h.pz > 0 ? 0.3 : 1);
    if (H.kind === 'cure') {
      h.cure -= dt; if (h.cure > 0) return; h.cure = 0.8;
      s.slots.forEach((o, j) => { if (o.h && (o.h.fz > 0 || o.h.pz > 0) && (o.x - sl.x) ** 2 + (o.z - sl.z) ** 2 <= st.range ** 2) { o.h.fz = 0; o.h.pz = 0; o.h.imm = h.lv >= 3 ? 8 : RULE.immune; s.ev.push({ k: 'cure', from: i, to: j }); } });
      return;
    }
    if (H.kind === 'summon') {
      h.sum -= dt * rate; if (h.sum > 0 || !s.foes.some(f => f.hp > 0)) return; h.sum = st.every;
      const mine = s.rats.filter(r => r.owner === i).length, n = h.lv >= 3 ? 2 : 1;
      for (let k = 0; k < n && mine + k < 4; k++) { const kind = h.lv >= 2 && (h.alt = !h.alt) ? 'brown' : 'grey', p = posAt(s, sl.pd - k * 0.8), r = { id: s.nid++, kind, lv: h.lv, d: sl.pd - k * 0.8, x: p.x, z: p.z, dx: -p.dx, dz: -p.dz, hp: RAT[kind].hp * LV[h.lv - 1], life: RAT[kind].life, bite: 0.3, owner: i, tg: null }; s.rats.push(r); s.ev.push({ k: 'rat', r, i }); }
      s.ev.push({ k: 'atk', i, kind: 'summon', elem: 'summon', to: [] }); return;
    }
    if (!st.atk) return;
    h.cd -= dt * rate; if (h.cd > 0) return;
    const tg = pick(s, sl, st.range, H.elem, H.pick, H.kind === 'melee' ? st.n || 1 : 1); if (!tg.length) { h.cd = 0.12; return; }
    h.cd = H.cd; const f0 = tg[0], dmg = st.atk * (1 + h.bAtk);
    h.fx = f0.x - sl.x; h.fz2 = f0.z - sl.z;
    if (H.kind === 'melee') {
      for (const f of tg) { let v = dmg; if (st.execute && f.hp / f.max < 0.35) v *= st.execute; hurt(s, f, v, H.elem, st); if (st.stun && rand(s) < 0.4 && !FOE[f.type].leak) f.stun = st.stun; }
      s.ev.push({ k: 'atk', i, kind: 'melee', elem: H.elem, to: tg.map(f => [f.x, f.z]) });
    } else if (H.kind === 'pierce') {
      const L = Math.hypot(h.fx, h.fz2) || 1, ux = h.fx / L, uz = h.fz2 / L, hit = [];
      for (const f of s.foes) { if (f.hp <= 0 || f.d < 0.6) continue; const px = f.x - sl.x, pz = f.z - sl.z, al = px * ux + pz * uz; if (al < 0 || al > st.range) continue; if (Math.abs(px * uz - pz * ux) <= 0.75) hit.push([al, f]); }
      hit.sort((a, b) => a[0] - b[0]); hit.slice(0, st.n).forEach(([, f], k) => hurt(s, f, dmg * [1, .7, .5][k], H.elem, st));   // 穿到後面的傷害遞減
      s.ev.push({ k: 'atk', i, kind: 'pierce', elem: H.elem, to: [[sl.x + ux * st.range, sl.z + uz * st.range]] });
    } else if (H.kind === 'blast') {
      s.shots.push({ kind: 'blast', t: 0.4, x: f0.x, z: f0.z, r: st.r, dmg, elem: H.elem, st });
      s.ev.push({ k: 'atk', i, kind: 'blast', elem: H.elem, to: [[f0.x, f0.z]], r: st.r });
    } else {
      s.shots.push({ kind: 'bolt', x: sl.x, z: sl.z, tg: f0, tx: f0.x, tz: f0.z, dmg, elem: H.elem, st, src: i, id: s.nid++ });
      s.ev.push({ k: 'atk', i, kind: 'bolt', elem: H.elem, shot: s.shots[s.shots.length - 1] });
    }
  });

  // 飛行中的攻擊
  for (const sh of s.shots) {
    if (sh.kind === 'blast') { sh.t -= dt; if (sh.t <= 0) { sh.done = true; splash(s, sh.x, sh.z, sh.r, sh.dmg, sh.elem, sh.st); s.ev.push({ k: 'boom', x: sh.x, z: sh.z, r: sh.r, elem: sh.elem }); } continue; }
    if (sh.tg && sh.tg.hp > 0) { sh.tx = sh.tg.x; sh.tz = sh.tg.z; }
    const dx = sh.tx - sh.x, dz = sh.tz - sh.z, d = Math.hypot(dx, dz), v = 16 * dt;
    if (d > v) { sh.x += dx / d * v; sh.z += dz / d * v; continue; }
    sh.done = true; const st = sh.st, f = sh.tg && sh.tg.hp > 0 ? sh.tg : null;
    if (f) { hurt(s, f, sh.dmg, sh.elem, st); effects(s, f, st); if (f.hp <= 0 && st.bounty) f.bounty = st.bounty; }
    if (st.splash) splash(s, sh.tx, sh.tz, st.splash, sh.dmg, sh.elem, st, f);
    s.ev.push({ k: 'boom', x: sh.tx, z: sh.tz, r: st.splash || 0.5, elem: sh.elem, id: sh.id });
  }
  s.shots = s.shots.filter(sh => !sh.done);

  // 收掉倒下的敵人
  for (const f of s.foes) {
    if (f.hp > 0 || f.gone) continue; f.gone = true; if (f.block) f.block = null;
    if (f.leaked) continue; const F = FOE[f.type], c = F.coin + (f.bounty || 0);
    s.coin += c; s.kills++; s.ev.push({ k: 'die', f, coin: c });
    if (F.split) for (let k = 0; k < F.split[1]; k++) spawn(s, F.split[0], Math.max(0.7, f.d - k * 0.7));
  }
  s.foes = s.foes.filter(f => !f.gone);

  if (s.lives <= 0) { s.phase = 'lost'; s.ev.push({ k: 'lost' }); return; }
  if (s.phase === 'fight' && !s.q.length && !s.foes.length) {
    const bonus = RULE.waveCoin(s.wave); s.coin += bonus; s.wave++; s.prepT = RULE.prep; s.rats.forEach(r => (r.life = Math.min(r.life, 0.5)));
    if (s.wave >= WAVES.length) { s.phase = 'won'; s.ev.push({ k: 'won' }); } else { s.phase = 'prep'; s.ev.push({ k: 'clear', bonus, n: s.wave }); }
  }
}
