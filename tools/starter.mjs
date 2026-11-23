// 新手第一局壓力測試：node tools/starter.mjs [開局買幾位=4]
// 「開局花完就不再花」：開局買 N 位、隨機放空工位，之後完全不花錢。把預設隊伍所有可能抽到的組合（可重複）都跑一次，
// 每種組合放 3 種隨機位置，看第 1、2 波後剩多少底氣、有幾種組合在第 2 波前全滅。
import { existsSync, readFileSync } from 'node:fs';
import * as C from '../js/core.js';
import { DEFAULT_TEAM, RULE, WAVES } from '../js/data.js';
const mapFile = new URL('../art/map/office.json', import.meta.url);
if (existsSync(mapFile)) C.setMap('office', JSON.parse(readFileSync(mapFile, 'utf8')));
const TU = JSON.parse(process.env.TUNE || '{}'); for (const k in TU) { if (k.startsWith('W')) WAVES[+k.slice(1)].hpK = TU[k]; else RULE[k] = TU[k]; }
const N = +process.argv[2] || 4, T = DEFAULT_TEAM, combos = [];
(function rec(st, a) { if (a.length === N) return combos.push(a); for (let i = st; i < T.length; i++) rec(i, [...a, T[i]]); })(0, []);
const res = [];
for (const team of combos) for (let r = 0; r < 3; r++) {
  const s = C.newGame({ seed: 77 + r }), rnd = C.mulberry(team.join('').length * 31 + r * 7 + 1);
  for (const id of team) { const e = s.slots.filter(x => !x.tw); s.pending = { id, lv: 1, paid: 0 }; C.place(s, e[Math.floor(rnd() * e.length)].i); }
  s.coin = 0; let l1 = null, l2 = null;
  while (s.state === 'play' && s.wave <= 2) { C.step(s); for (const e of s.ev) if (e.k === 'clear') { if (e.n === 1) l1 = s.lives; if (e.n === 2) l2 = s.lives; } s.ev.length = 0; }
  res.push({ team: team.join(','), l1: l1 ?? 0, l2: l2 ?? 0 });
}
res.sort((a, b) => a.l2 - b.l2);
const avg = k => (res.reduce((a, b) => a + b[k], 0) / res.length).toFixed(1);
console.log(`開局買 ${N} 位、之後不花錢：${combos.length} 種組合 × 3 種位置`);
console.log(`第 1 波後平均 ${avg('l1')}、第 2 波後平均 ${avg('l2')}；第 2 波前全滅 ${res.filter(r => r.l2 <= 0).length}/${res.length}、剩 ≤5 的 ${res.filter(r => r.l2 <= 5).length}/${res.length}`);
console.log('最差 6 個：' + res.slice(0, 6).map(r => `${r.team}→${r.l1}/${r.l2}`).join('　'));
