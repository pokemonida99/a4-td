// 模擬用的自動打法（sim.mjs、diag.mjs 共用）
import * as C from '../js/core.js';
import { WAVES, TOWERS, FOES } from '../js/data.js';
export const setR = r => { R = r; };
let R = Math.random;
const pickR = (s, a) => a[Math.floor(R() * a.length)];

// 工位好壞：射程內走道長度（每 8 px 取樣）
function coverage(s, i, r) { const L = s.lanes[0], sl = s.slots[i]; let n = 0; for (let d = 0; d <= L.L; d += 8) { const p = C.posAt(L, d); if (Math.hypot(p.x - sl.x, (p.y - sl.y) * 1.25) <= r) n++; } return n * 8; }
const covCache = new Map();
function cov(s, i, id) { const k = s.map.name + i + id; if (!covCache.has(k)) covCache.set(k, coverage(s, i, TOWERS[id].range)); return covCache.get(k); }
const SUPPORT = { mi: 1, cha: 1, vivi: 1 };
export const BOTS_NOTE = 'random 只會召喚亂放；basic 亂放＋合併＋技能；smart 挑位置＋合併＋升職＋技能；smartNoUp 同 smart 但不升職';
function slotValue(s, i, id) {
  if (SUPPORT[id]) { let n = 0; for (const o of s.slots) if (o.i !== i && Math.hypot(o.x - s.slots[i].x, (o.y - s.slots[i].y) * 1.25) <= TOWERS[id].range) n++; return n * 60 + cov(s, i, id) * .3; }
  return cov(s, i, id);
}
// 這隊對接下來兩波有沒有弱點優勢
function weakNeed(s) {
  const need = {};
  for (const W of WAVES.slice(s.wave, s.wave + 2)) for (const g of W.groups) { const w = FOES[g.kind].weak?.[0]; if (w) need[w] = (need[w] || 0) + g.n * FOES[g.kind].hp; }
  return need;
}
const power = T => C.lvK(T.lv);

export const bots = {
  random(s) {
    if (C.canSummon(s)) C.summon(s);
    if (s.pending) {
      const empty = s.slots.filter(x => !x.tw).map(x => x.i);
      if (empty.length) C.place(s, pickR(s, empty));
      else { const m = s.slots.filter(x => C.canPlace(s, x.i)).map(x => x.i); if (m.length) C.place(s, pickR(s, m)); else C.discard(s); }
    }
  },
  basic(s) {
    if (C.canSummon(s)) C.summon(s);
    if (s.pending) {
      const empty = s.slots.filter(x => !x.tw).map(x => x.i);
      if (empty.length) C.place(s, pickR(s, empty));
      else {
        const m = s.slots.filter(x => C.canPlace(s, x.i)).map(x => x.i);
        if (m.length) C.place(s, pickR(s, m));
        else { let done = false; for (let a = 0; a < 12 && !done; a++) for (let b = 0; b < 12 && !done; b++) if (C.canMerge(s, a, b)) { C.drop(s, a, b); done = true; } if (!done) C.discard(s); }
      }
    }
    for (const u of s.unites) if (C.canUnite(s, u.key) && s.foes.length >= 6) C.useUnite(s, u.key);
    if (s.momentum >= 100) { const best = s.slots.filter(x => x.tw).sort((a, b) => b.tw.lv - a.tw.lv)[0]; if (best) C.useSuper(s, best.i); }
  },
  smart(s) { return smartPlay(s, true); },
  smartNoUp(s) { return smartPlay(s, false); },      // 跟 smart 一樣但不花錢升職（比較升職值不值得）
};
function smartPlay(s, useUp) {
  {
    const need = weakNeed(s);
    const val = (id, i) => slotValue(s, i, id) * (1 + (need[TOWERS[id].elem] ? .25 : 0));
    const full = !s.slots.some(x => !x.tw);
    if (!full) { if (C.canSummon(s)) C.summon(s); }
    else if (!s.pending) {
      // 滿場：能免費合併就先合併（空出位置），否則看要直接升職還是再抽
      let best = null;
      for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (C.canMerge(s, a, b)) { const T = s.slots[b].tw, sc = -T.lv * 1000 + val(T.id, b) - val(T.id, a); if (!best || sc > best.sc) best = { a, b, sc }; }
      if (best) C.drop(s, best.a, best.b);
      else {
        let up = null;
        if (useUp) for (const x of s.slots) { const c = C.upgradeCost(s, x.i); if (!isFinite(c) || TOWERS[x.tw.id].kind === 'support') continue; const sc = val(x.tw.id, x.i) * (C.lvK(x.tw.lv + 1) - C.lvK(x.tw.lv)) / c; if (!up || sc > up.sc) up = { i: x.i, c, sc }; }
        const lv1 = s.slots.filter(x => x.tw.lv === 1).length;
        if (up && s.coin >= up.c) C.upgrade(s, up.i);
        else if (C.canSummon(s) && lv1 && (!up || s.sumCost * 2 < up.c - s.coin)) C.summon(s);
      }
    }
    if (s.pending) {
      const id = s.pending.id, empty = s.slots.filter(x => !x.tw);
      if (empty.length) { empty.sort((a, b) => val(id, b.i) - val(id, a.i)); C.place(s, empty[0].i); }
      else {
        const m = s.slots.filter(x => C.canPlace(s, x.i)).sort((a, b) => val(id, b.i) - val(id, a.i));
        if (m.length) C.place(s, m[0].i);
        else {
          // 合併一對最低級的，結果放在比較好的位置，空出比較差的格子
          let best = null;
          for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (C.canMerge(s, a, b)) {
            const T = s.slots[b].tw, sc = -T.lv * 1000 + val(T.id, b) - val(T.id, a);
            if (!best || sc > best.sc) best = { a, b, sc };
          }
          if (best) { C.drop(s, best.a, best.b); const e = s.slots.find(x => !x.tw); if (e && C.canPlace(s, e.i)) C.place(s, e.i); }
          else {
            // 沒得合：把場上最弱的 I 級（而且不是同名可湊對的）換掉
            const weakest = s.slots.filter(x => x.tw.lv === 1 && x.tw.id !== id).sort((a, b) => val(a.tw.id, a.i) - val(b.tw.id, b.i))[0];
            if (weakest && s.slots.filter(x => x.tw.id === weakest.tw.id && x.tw.lv === 1).length === 1) { C.sell(s, weakest.i); C.place(s, weakest.i); }
            else C.discard(s);
          }
        }
      }
    }
    // 波間免費調位：把職級最高的人換到最好的位置
    if (s.phase === 'break' && s.freeMove) {
      const tw = s.slots.filter(x => x.tw).sort((a, b) => power(b.tw) - power(a.tw))[0];
      if (tw) { const tgt = s.slots.filter(x => x !== tw && (!x.tw || power(x.tw) < power(tw.tw))).sort((a, b) => val(tw.tw.id, b.i) - val(tw.tw.id, a.i))[0];
        if (tgt && val(tw.tw.id, tgt.i) > val(tw.tw.id, tw.i) * 1.15 && (!tgt.tw || val(tgt.tw.id, tw.i) > 0)) C.drop(s, tw.i, tgt.i); }
    }
    const boss = s.foes.find(f => f.boss), bossWave = !!WAVES[s.wave - 1]?.boss, bossComing = bossWave && s.spawnQ.some(q => FOES[q.kind].boss);
    // 超級化：頭目在場就給最強的輸出；其他時候氣勢滿了、怪多才用
    if (s.momentum >= 100 && (boss || (!bossWave && s.foes.length >= 10))) {
      const best = s.slots.filter(x => x.tw && !SUPPORT[x.tw.id]).sort((a, b) => power(b.tw) * cov(s, b.i, b.tw.id) - power(a.tw) * cov(s, a.i, a.tw.id))[0];
      if (best) C.useSuper(s, best.i);
    }
    // 合體技：奧客蓄力／課長理虧時、或怪很多時；頭目波先存著
    for (const u of s.unites) {
      if (!C.canUnite(s, u.key)) continue;
      const urgent = boss && (boss.charge > 0 || boss.broken);
      if (urgent || (!bossComing && !(bossWave && boss && s.momentum < 100) && s.foes.length >= 8)) C.useUnite(s, u.key);
    }
  }
}

