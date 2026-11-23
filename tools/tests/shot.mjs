// 實機截圖：手機橫向尺寸、真的觸控點。用法：node tools/tests/shot.mjs [秒數]
// 流程：開局 → 用觸控點「緊急調派」→ 點工位放下（放滿 8 個）→ 提早開波 → 等幾秒 → 截圖
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out'; const wait = ms => new Promise(r => setTimeout(r, ms)); const SEC = +process.argv[2] || 10;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] }); const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 590, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('[console] ' + m.text()); });
await page.goto(`http://localhost:4660/?play&fresh=${Date.now()}`); await page.waitForFunction('window.__bootDone && window.__game.s', { timeout: 60000 }); await wait(500);
const tap = async (x, y) => { await page.touchscreen.tap(x, y); await wait(250); };
await page.evaluate(() => { __game.s.res = 400; __game.s.resMax = 999; });
const slots = await page.evaluate(() => __game.s.slots.map(s => [s.x, s.y]));
const ONLY = process.env.ONLY;      // ONLY=kui：全部放同一個人（檢查動畫用）
for (const i of [0, 1, 2, 3, 6, 7, 8, 9]) { await tap(280, 536); if (ONLY) await page.evaluate(id => { __game.s.pending = { id, lv: 1 }; }, ONLY); await tap(slots[i][0], slots[i][1]); }
const placed = await page.evaluate(() => __game.s.slots.filter(x => x.tw).map(x => x.tw.id).join(','));
await page.screenshot({ path: `${OUT}/shot_0_placed.jpg`, type: 'jpeg', quality: 88 });
await tap(194, 36); await page.evaluate(() => { __game.speed = 2; });
await wait(SEC * 1000); await page.screenshot({ path: `${OUT}/shot_1_fight.jpg`, type: 'jpeg', quality: 88 });
for (let k = 0; k < 4; k++) { await wait(170); await page.screenshot({ path: `${OUT}/shot_1_fight_${k}.jpg`, type: 'jpeg', quality: 88 }); }
await tap(slots[1][0], slots[1][1]); await wait(400); await page.screenshot({ path: `${OUT}/shot_2_select.jpg`, type: 'jpeg', quality: 88 });
console.log('放上去：', placed); console.log('狀態：', await page.evaluate(() => JSON.stringify({ wave: __game.s.wave, kills: __game.s.kills, lives: __game.s.lives, phase: __game.s.phase })));
console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 6).join(' ／ ') : '無'); await browser.close();
