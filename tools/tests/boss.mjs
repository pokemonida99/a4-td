// 直接跳到最後一波，等奧客總經理蓄力時截圖。用法：node tools/tests/boss.mjs
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out'; const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const errors = [];
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 590, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true }); p.on('pageerror', e => errors.push(e.message));
await p.goto(`http://localhost:4660/?play&f=${Date.now()}`); await p.waitForFunction('window.__bootDone && window.__game.s');
const slots = await p.evaluate(() => __game.s.slots.map(s => [s.x, s.y]));
await p.evaluate(() => { __game.s.coin = 999; });
for (const [i, id] of [[0, 'kui'], [1, 'jie'], [2, 'kevin'], [6, 'yan'], [7, 'zhe'], [8, 'mi']]) { await p.touchscreen.tap(280, 536); await wait(200); await p.evaluate(id => { __game.s.pending = { id, lv: 1 }; }, id); await p.touchscreen.tap(...slots[i]); await wait(200); }
await p.evaluate(() => { const s = __game.s; s.wave = 9; s.waveT = .5; __game.speed = 3; });
let shot = 0;
for (let k = 0; k < 120 && shot < 2; k++) { await wait(500); const st = await p.evaluate(() => { const f = __game.s.foes.find(f => f.boss); return f ? { charge: f.charge, x: f.x, y: f.y } : null; });
  if (st && st.charge > .2 && shot === 0) { await p.evaluate(() => { __game.paused = true; }); await wait(200); await p.screenshot({ path: `${OUT}/boss_charge.jpg`, type: 'jpeg', quality: 86 }); await p.evaluate(() => { __game.paused = false; }); shot = 1; }
  if (st && shot === 1 && st.charge === 0) { await wait(400); await p.screenshot({ path: `${OUT}/boss_walk.jpg`, type: 'jpeg', quality: 86 }); shot = 2; } }
console.log('截圖', shot, '錯誤：', errors.length ? errors.join(' ／ ') : '無'); await b.close();
