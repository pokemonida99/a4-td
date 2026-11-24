// 3D 版規則模擬。用法：node tools/sim3d.mjs [場數]
// 三種玩法：smart（看下一波屬性挑人、會升級）、plain（照順序買、會升級）、random（亂買不升級）
import { newGame, step, place, upgrade, canPlace, canUpgrade, startWave, waveInfo, useSkill, DT } from '../proto3d/core.js';
import { HERO, HERO_ORDER, MAP, WAVES, elemMul, statsOf, upgradeCost } from '../proto3d/rules.js';
const N = +process.argv[2] || 60, DIFFS = (process.argv[3] || 'normal').split(','), CENTER = [2, 3, 8, 9, 1, 4, 7, 10, 0, 5, 6, 11];
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const dps = (id, lv, foes) => { const st = statsOf(id, lv); if (!st.atk) return 0; let m = 0, n = 0; for (const f of foes) { m += elemMul(st.elem, f.elem) * f.n; n += f.n; } return st.atk / st.cd * (n ? m / n : 1) * (st.splash || st.r ? 1.8 : 1) * (st.n || 1); };
function shop(s, mode, r) {
  const next = waveInfo(s.wave);
  for (let guard = 0; guard < 40; guard++) {
    const free = CENTER.filter(i => !s.slots[i].h), have = s.slots.map((sl, i) => sl.h && i).filter(i => i !== null && i !== false);
    if (mode === 'random') { const ids = HERO_ORDER.filter(id => free.length && canPlace(s, free[0], id)); if (!ids.length) return; place(s, free[(r() * free.length) | 0], ids[(r() * ids.length) | 0]); continue; }
    let best = null;
    if (free.length) for (const id of HERO_ORDER) { if (!canPlace(s, free[0], id)) continue; const H = HERO[id]; let v = dps(id, 1, mode === 'smart' ? next : []) / H.cost; if (!H.atk) v = have.length >= 3 && mode === 'smart' ? (id === 'wu' ? (s.wave >= 4 ? .5 : 0) : .22) : 0; if (!best || v > best.v) best = { v, go: () => place(s, free[0], id) }; }
    for (const i of have) if (canUpgrade(s, i)) { const h = s.slots[i].h, c = upgradeCost(h.id, h.lv); let v = (dps(h.id, h.lv + 1, mode === 'smart' ? next : []) - dps(h.id, h.lv, mode === 'smart' ? next : [])) / c; if (!HERO[h.id].atk) v = .12; if (!best || v > best.v) best = { v, go: () => upgrade(s, i) }; }
    if (!best || best.v <= 0) return; best.go();
  }
}
for (const diff of DIFFS) for (const mode of (process.argv[4] || 'smart,plain,random').split(',')) {
  let win = 0, lives = 0; const died = Array(WAVES.length + 1).fill(0), leak = Array(WAVES.length).fill(0); let time = 0;
  for (let g = 0; g < N; g++) {
    const s = newGame(MAP, g + 1, diff), r = rng(g * 7 + 3);
    for (let guard = 0; guard < 400000 && s.phase !== 'won' && s.phase !== 'lost'; guard++) { if (s.phase === 'prep' && !s.shopped) { shop(s, mode, r); s.shopped = true; if (mode === 'smart' || s.wave === 0) startWave(s); } if (s.phase === 'fight') { s.shopped = false; if (mode === 'smart' && s.foes.length > 4) useSkill(s); } const w0 = s.wave, l0 = s.lives; step(s, DT); if (s.lives < l0) leak[Math.min(w0, WAVES.length - 1)] += l0 - s.lives; s.ev.length = 0; }
    if (s.phase === 'won') { win++; lives += s.lives; } else died[s.wave + 1]++; time += s.t;
  }
  console.log(diff.padEnd(6), mode.padEnd(7), `勝率 ${(win / N * 100).toFixed(0)}%`, `贏的時候平均剩 ${(win ? lives / win : 0).toFixed(1)} 命`, `平均 ${(time / N / 60).toFixed(1)} 分`, '倒在第幾波：', died.map((n, i) => n ? `${i}波×${n}` : '').filter(Boolean).join(' ') || '無', '｜每波平均漏：', leak.map(v => (v / N).toFixed(1)).join(' '));
}
