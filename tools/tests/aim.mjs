// 合體技瞄準＋特色圖示說明：真觸控。用法：node tools/tests/aim.mjs
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out'; const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 590, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:4660/?play&fresh=${Date.now()}`); await page.waitForFunction('window.__bootDone && window.__game.s'); await wait(400);
const tap = async (x, y) => { await page.touchscreen.tap(x, y); await wait(300); };
const zone = k => page.evaluate(k => { const z = (__game.zones || []).find(z => z[4] === k); return z && [z[0] + z[2] / 2, z[1] + z[3] / 2]; }, k);
await page.evaluate(() => { __game.s.coin = 999; });
const slots = await page.evaluate(() => __game.s.slots.map(s => [s.x, s.y]));
for (const [i, id] of [[0, 'kui'], [1, 'zhe'], [6, 'jie'], [7, 'yan']]) { await tap(...await zone('summon')); await page.evaluate(id => { __game.s.pending = { id, lv: 1 }; }, id); await tap(...slots[i]); }
await tap(...await zone('call')); await wait(6000);
await page.evaluate(() => { __game.s.momentum = 100; }); await wait(200);
await tap(...slots[0]); await tap(...await zone('trait')); await wait(300); await page.screenshot({ path: `${OUT}/aim_0_trait.jpg`, type: 'jpeg', quality: 85 });
const tip = await page.evaluate(() => window.__game && document && (window.__tip = 1));
await tap(900, 560 - 600);      // 空點取消選取（點地圖空地）
await tap(30, 30); await page.evaluate(() => { __game.sel = -1; });
const z = await zone('unite:jieyan'); await tap(...z); await wait(300); await page.screenshot({ path: `${OUT}/aim_1_aiming.jpg`, type: 'jpeg', quality: 85 });
const before = await page.evaluate(() => ({ mom: __game.s.momentum, aim: __game.aim }));
await tap(700, 275); await wait(500); await page.screenshot({ path: `${OUT}/aim_2_fired.jpg`, type: 'jpeg', quality: 85 });
const after = await page.evaluate(() => ({ mom: __game.s.momentum, aim: __game.aim, cd: __game.s.cds.jieyan }));
console.log('瞄準前', JSON.stringify(before), '發動後', JSON.stringify(after)); console.log('錯誤：', errors.length ? errors.join(' ／ ') : '無'); await browser.close();
