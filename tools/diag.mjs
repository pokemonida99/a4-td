// 單局細看：node tools/diag.mjs [打法] [種子]　每波結束時的底氣、時間、場上陣容
import * as C from '../js/core.js';
import { FOES } from '../js/data.js';
const bot = process.argv[2] || 'smart', seed = +process.argv[3] || 1000;

const { bots } = await import('./bots.mjs');
const { setR } = await import('./bots.mjs'); setR(C.mulberry(seed * 7 + 3));
const s = C.newGame({ seed }); let lastW = 0, t0 = 0, ev = {};
while (s.state === 'play' && s.t < 3600) {
  bots[bot](s); C.step(s);
  for (const e of s.ev) { if (['complain', 'interrupt', 'leak', 'throw'].includes(e.k)) ev[e.k] = (ev[e.k] || 0) + 1; if (e.k === 'clear' || e.k === 'win' || e.k === 'lose') {
    console.log(`第${s.wave}波 ${(s.t - t0).toFixed(0)}s 累計 ${(s.t / 60).toFixed(1)}分 底氣 ${s.lives} 預算 ${s.coin} 氣勢 ${s.momentum.toFixed(0)} ${JSON.stringify(ev)}　${s.slots.map(x => x.tw ? x.tw.id + x.tw.lv : '--').join(' ')}`); t0 = s.t; ev = {}; } }
  const b = s.foes.find(f => f.boss); if (b && s.n % 300 === 0) console.log(`   頭目 ${b.kind} hp ${b.hp}/${b.max} d ${b.d.toFixed(0)} ${b.bState}`);
  s.ev.length = 0;
}
console.log(s.state, s.stat);
