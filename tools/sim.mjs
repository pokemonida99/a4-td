// 數值模擬：node tools/sim.mjs [局數] [打法...] [--mix]
// 打法：random＝隨便亂放（抽到就丟隨機空格；滿了只在剛好同名同級時合併，其餘轉派；不用技能）
//       basic ＝亂放但會合併（滿了就拖合併空出位置）、會用技能
//       smart ＝挑好工位、會合併、看接下來兩波的弱點、頭目蓄力／理虧時才放合體技
// --mix：每局從 16 人隨機挑 6 人（看每位同事強弱）。有 art/map/office.json 就用那張圖。
// 單局細看：node tools/diag.mjs smart 1001　　規則自我檢查：node tools/test.mjs
//
// ===== 目前結果（2026-11-23，office.json 1280×590 新圖、預設隊伍、各 200 局，1 倍速遊戲時間）=====
//   random 通關 29%　輸多在第 9～10 波（奧客總經理）；通關平均 14.4 分、剩底氣 5.9
//   basic  通關 100%　通關平均 12.8 分、剩底氣 12.7
//   smart  通關 100%　通關平均 12.8 分、剩底氣 13.2（第 1～9 波零漏，第 10 波被客訴平均扣 7）
//   --mix（隨機 6 人，smart）通關 81%；最弱：小安 56%、茶茶 70%、鼠仙女 71%；最強：阿強 96%。
//   目標：亂放 20～40%、會合併看弱點 ≥90%、一局 10～15 分 → 預設隊伍達標。
import { existsSync, readFileSync } from 'node:fs';
import * as C from '../js/core.js';
import { WAVES, TOWERS, FOES, RULE } from '../js/data.js';

const mapFile = new URL('../art/map/office.json', import.meta.url);
if (existsSync(mapFile)) C.setMap('office', JSON.parse(readFileSync(mapFile, 'utf8')));

const N = +process.argv[2] || 100;
const MIX = process.argv.includes('--mix');      // --mix：每局從 16 人隨機挑 6 人，看每位同事的強弱
const args = process.argv.slice(3).filter(a => !a.startsWith('--'));
const BOTS = args.length ? args : ['random', 'basic', 'smart'];
const ALL = Object.keys(TOWERS);
function teamOf(seed) { const r = C.mulberry(seed * 13 + 5), a = ALL.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 6); }
import { bots, setR } from './bots.mjs';

function play(bot, seed) {
  const s = C.newGame({ seed, team: MIX ? teamOf(seed) : undefined }); setR(C.mulberry(seed * 7 + 3));
  while (s.state === 'play' && s.t < 3600) { bots[bot](s); C.step(s); s.ev.length = 0; }
  return s;
}
console.log(`地圖 ${C.newGame().map.name}　局數 ${N}`);
for (const bot of BOTS) {
  let win = 0, wv = 0, tW = 0, lives = 0; const lost = {}, dmg = {}, hero = {};
  for (let g = 0; g < N; g++) {
    const s = play(bot, 1000 + g);
    if (s.state === 'win') { win++; tW += s.t; lives += s.lives; } else lost[s.wave] = (lost[s.wave] || 0) + 1;
    if (MIX) for (const id of s.team) { const h = hero[id] || (hero[id] = { n: 0, w: 0, share: 0 }); const tot = Object.values(s.stat.dmg).reduce((a, b) => a + b, 0); h.n++; h.w += s.state === 'win'; h.share += (s.stat.dmg[id] || 0) / tot; }
    wv += s.wave; for (const k in s.stat.dmg) dmg[k] = (dmg[k] || 0) + s.stat.dmg[k];
  }
  const tot = Object.values(dmg).reduce((a, b) => a + b, 0);
  console.log(`${bot.padEnd(6)} 通關 ${(win / N * 100).toFixed(0).padStart(3)}%　平均到第 ${(wv / N).toFixed(1)} 波　通關平均 ${win ? (tW / win / 60).toFixed(1) : '-'} 分、剩底氣 ${win ? (lives / win).toFixed(1) : '-'}　輸在第幾波 ${JSON.stringify(lost)}`);
  if (MIX) console.log('       有帶他時：' + Object.entries(hero).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n).map(([k, h]) => `${TOWERS[k].name} 勝${(h.w / h.n * 100).toFixed(0)}% 傷${(h.share / h.n * 100).toFixed(0)}%`).join('　'));
  console.log('       傷害占比 ' + Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${TOWERS[k]?.name || k} ${(v / tot * 100).toFixed(0)}%`).join('　'));
}
