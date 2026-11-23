// 數值模擬：node tools/sim.mjs [局數] [打法...] [--mix]
// 打法：random＝只會召喚、隨便亂放（抽到就丟隨機空格；滿了只在剛好同名同級時合併，其餘轉派；不升職、不用技能）
//       basic ＝亂放但會合併（滿了就拖合併空出位置）、會用技能
//       smart ＝挑好工位、會合併、滿場時花錢直接升職、看接下來兩波的弱點、頭目蓄力／理虧時才放合體技
//       smartNoUp＝smart 但不升職（比較升職值不值得）
// --mix：每局從 16 人隨機挑 6 人（看每位同事強弱）。有 art/map/office.json 就用那張圖。
// 單局細看：node tools/diag.mjs smart 1001　　規則自我檢查：node tools/test.mjs
//
// ===== 目前結果（2026-11-23 v0.2 單一貨幣＋前幾波放寬，office.json 新圖、預設隊伍、各 200 局，1 倍速遊戲時間）=====
//   random    通關 31%　輸多在第 9～10 波；通關平均 14.1 分、剩底氣 5.5；結束時戰力 21.6
//   basic     通關 100%　12.4 分、剩底氣 13.1；戰力 33.1
//   smart     通關 100%　12.6 分、剩底氣 14.6；戰力 37.0（升職 9 次）
//   smartNoUp 通關 100%　12.7 分、剩底氣 13.7；戰力 33.1 → 會升職的打法比較強
//   新手只買 3 位不再花錢：第 2 波後平均剩 14.4 底氣（撐得過前兩波）
//   目標：亂放 20～40%、會打的 ≥90%、一局 10～15 分 → 預設隊伍達標。
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
  let win = 0, wv = 0, tW = 0, lives = 0; const lost = {}, dmg = {}, hero = {}, eco = { earned: 0, summon: 0, upgrade: 0, move: 0, sums: 0, ups: 0, merges: 0, discards: 0, lv: 0 };
  for (let g = 0; g < N; g++) {
    const s = play(bot, 1000 + g);
    if (s.state === 'win') { win++; tW += s.t; lives += s.lives; } else lost[s.wave] = (lost[s.wave] || 0) + 1;
    if (MIX) for (const id of s.team) { const h = hero[id] || (hero[id] = { n: 0, w: 0, share: 0 }); const tot = Object.values(s.stat.dmg).reduce((a, b) => a + b, 0); h.n++; h.w += s.state === 'win'; h.share += (s.stat.dmg[id] || 0) / tot; }
    { const S = s.stat; eco.earned += S.earned; eco.summon += S.spent.summon; eco.upgrade += S.spent.upgrade; eco.move += S.spent.move; eco.sums += S.sums; eco.ups += S.upgrades; eco.merges += S.merges; eco.discards += S.discards; eco.lv += s.slots.reduce((a, x) => a + (x.tw ? C.lvK(x.tw.lv) : 0), 0); }
    wv += s.wave; for (const k in s.stat.dmg) dmg[k] = (dmg[k] || 0) + s.stat.dmg[k];
  }
  const tot = Object.values(dmg).reduce((a, b) => a + b, 0);
  console.log(`${bot.padEnd(6)} 通關 ${(win / N * 100).toFixed(0).padStart(3)}%　平均到第 ${(wv / N).toFixed(1)} 波　通關平均 ${win ? (tW / win / 60).toFixed(1) : '-'} 分、剩底氣 ${win ? (lives / win).toFixed(1) : '-'}　輸在第幾波 ${JSON.stringify(lost)}`);
  const e = k => (eco[k] / N).toFixed(0);
  console.log(`       每局：擊倒賺 ${e('earned')}　調派 ${e('sums')} 次花 ${e('summon')}（轉派 ${e('discards')}）　合併 ${e('merges')}　升職 ${e('ups')} 次花 ${e('upgrade')}　調位花 ${e('move')}　結束時戰力 ${(eco.lv / N).toFixed(1)}（12 格全 III＝38.4）`);
  if (MIX) console.log('       有帶他時：' + Object.entries(hero).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n).map(([k, h]) => `${TOWERS[k].name} 勝${(h.w / h.n * 100).toFixed(0)}% 傷${(h.share / h.n * 100).toFixed(0)}%`).join('　'));
  console.log('       傷害占比 ' + Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${TOWERS[k]?.name || k} ${(v / tot * 100).toFixed(0)}%`).join('　'));
}
