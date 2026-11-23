// 前三波難度（node tools/early.mjs）：passive3＝開局買 3 位之後不再花錢；newbie＝有錢就買、亂放、不合併不升職；smart
import { RULE, WAVES } from '../js/data.js';
import * as C from '../js/core.js';
import { bots, setR } from './bots.mjs';
import { readFileSync } from 'node:fs';
C.setMap('office', JSON.parse(readFileSync(new URL('../art/map/office.json', import.meta.url), 'utf8')));
const TU = JSON.parse(process.env.TUNE || '{}'); for (const k in TU) { if (k.startsWith('W')) WAVES[+k.slice(1)].hpK = TU[k]; else RULE[k] = TU[k]; }
const passive = n => s => { if (s.stat.sums < n && C.canSummon(s)) C.summon(s); if (s.pending) { const e = s.slots.filter(x => !x.tw); C.place(s, e[Math.floor(e.length / 2)].i); } };
const P = { passive3: passive(3), passive5: passive(5), newbie: bots.random, smart: bots.smart };
for (const [name, fn] of Object.entries(P)) {
  const L = [0, 0, 0, 0], N = 60; let dead = 0;
  for (let g = 0; g < N; g++) { setR(C.mulberry((1000 + g) * 7 + 3)); const s = C.newGame({ seed: 1000 + g });
    while (s.state === 'play' && s.wave <= 3) { fn(s); C.step(s); for (const e of s.ev) if (e.k === 'clear' && e.n <= 3) L[e.n] += s.lives / N; s.ev.length = 0; }
    if (s.state === 'lose') dead++; }
  console.log(name.padEnd(9), '第1/2/3波後平均底氣', L.slice(1).map(v => v.toFixed(1)).join(' / '), '　前三波就輸', dead + '/' + N);
}
