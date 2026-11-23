// 數值模擬：node tools/sim.mjs [局數]，自動打法＝能召就召、能合就合
import { newGame, step, summon, canSummon, canMerge, drop, DT } from '../js/core.js';
import { WAVES } from '../js/data.js';
const N = +process.argv[2] || 50; let win = 0; const waveReach = [];
for (let g = 0; g < N; g++) {
  const s = newGame({ seed: g + 1 });
  while (s.state === 'play' && s.t < 3600) {
    if (canSummon(s)) summon(s);
    for (let a = 0; a < s.slots.length; a++) for (let b = 0; b < s.slots.length; b++) if (canMerge(s, a, b)) drop(s, a, b);
    step(s, DT); s.ev.length = 0;
  }
  if (s.state === 'win') win++; waveReach.push(s.wave);
  if (g < 3) console.log(`#${g + 1} ${s.state} 波 ${s.wave}/${WAVES.length} 生命 ${s.lives} 擊倒 ${s.kills} 時間 ${s.t.toFixed(0)}s`);
}
console.log(`通關 ${win}/${N}　平均到第 ${(waveReach.reduce((a, b) => a + b) / N).toFixed(1)} 波`);
