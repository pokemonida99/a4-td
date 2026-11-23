// 新敵人實機檢查：放一隊、跳到指定波次截圖。用法：node tools/tests/foes.mjs [波次...]
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out/v03'; const wait = ms => new Promise(r => setTimeout(r, ms));
const URL = process.env.URL || 'http://localhost:4660/', WAVES = process.argv.slice(2).map(Number); if (!WAVES.length) WAVES.push(3, 6, 7);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const errors = [];
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 590, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true }); p.on('pageerror', e => errors.push(e.message));
p.on('response', r => { if (r.status() === 404 && r.url().includes('/q/foe_')) errors.push('404 ' + r.url().split('/').pop()); });
await p.goto(`${URL}?play&f=${Date.now()}`); await p.waitForFunction('window.__bootDone && window.__game.s');
const slots = await p.evaluate(() => __game.s.slots.map(s => [s.x, s.y])); await p.evaluate(() => { __game.s.coin = 9999; });
for (const [i, id] of [[0, 'kui'], [1, 'jie'], [2, 'kevin'], [6, 'yan'], [7, 'zhe'], [8, 'mi']]) { await p.touchscreen.tap(280, 536); await wait(200); await p.evaluate(id => { __game.s.pending = { id, lv: 1, paid: 20 }; }, id); await p.touchscreen.tap(...slots[i]); await wait(200); }
const art = await p.evaluate(() => ['ghost', 'clerk', 'patcher', 'cart', 'mini'].map(k => k + ':' + (window.__game && true)));
for (const w of WAVES) {
  await p.evaluate(w => { const s = __game.s; s.foes.length = 0; s.spawnQ && (s.spawnQ.length = 0); s.wave = w - 1; s.phase = 'break'; s.waveT = .2; __game.speed = 1; __game.s.lives = 20; }, w);
  let found = ''; for (let k = 0; k < 40; k++) { await wait(500); found = await p.evaluate(() => [...new Set(__game.s.foes.map(f => f.kind))].join(',')); if (k > 24) break; }
  await p.screenshot({ path: `${OUT}/wave${w}.jpg`, type: 'jpeg', quality: 86 }); console.log(`第 ${w} 波：`, found);
}
console.log('錯誤：', errors.length ? [...new Set(errors)].join(' ／ ') : '無'); await b.close();
