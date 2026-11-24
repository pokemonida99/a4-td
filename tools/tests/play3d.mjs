// 3D 版觸控實測：手機橫向尺寸，用真的觸控點走完教學、派人、開波。用法：node tools/tests/play3d.mjs [前綴]
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out', PRE = process.argv[2] || 'g3d', BASE = process.env.URL || 'http://localhost:4660/';
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: +(process.env.W || 870), height: +(process.env.H || 402), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto(`${BASE}proto3d/index.html?tut&f=${Date.now()}`); await page.waitForFunction('window.__g && window.__g.ready', { timeout: 60000 }); await wait(1200);
const shot = n => page.screenshot({ path: `${OUT}/${PRE}_${n}.png` });
const tap = async (x, y) => { await page.touchscreen.tap(x, y); await wait(350); };
const tapSel = async sel => { const r = await page.evaluate(s => { const n = document.querySelector(s); if (!n) return null; n.scrollIntoView({ block: 'nearest', inline: 'center' }); const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === n || n.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2))]; }, sel); if (!r) { errors.push('找不到 ' + sel); return; } if (!r[2]) errors.push('被蓋住：' + sel); await tap(r[0], r[1]); };
const tapSlot = async i => { const p = await page.evaluate(i => __g.slotScreen(i), i); await tap(p[0], p[1]); };
const st = () => page.evaluate(() => ({ coin: __g.s.coin, lives: __g.s.lives, wave: __g.s.wave, phase: __g.s.phase, heroes: __g.s.slots.map(x => x.h ? x.h.id + x.h.lv : '-').join(' '), foes: __g.s.foes.length, tut: document.querySelector('#uTut').hidden ? 'off' : document.querySelector('#uTut .n')?.textContent }));
await shot('1_tut0'); console.log('開場', await st());
await tapSel('#uTutNext'); await tapSlot(4); await shot('2_menu'); console.log('點空位', await st());
await tapSel('.card[data-id="kui"]'); await shot('3_pick'); await tapSel('#uBuy'); await shot('4_placed'); console.log('派小葵', await st());
await tapSel('#uTutNext'); await tapSel('.panel .x');
for (const [i, id] of [[2, 'jie'], [8, 'yan']]) { await tapSlot(i); await tapSel(`.card[data-id="${id}"]`); await tapSel('#uBuy'); await tapSel('.panel .x'); }
await shot('5_ready'); console.log('派三人', await st());
await tapSel('#uGo'); await tapSel('#uSpd'); await wait(9000); await shot('6_fight'); console.log('第一波', await st());
await page.waitForFunction('__g.s.phase === "prep"', { timeout: 90000 }); await wait(600); await tapSlot(4); await shot('7_hero'); await tapSel('#uUp'); await shot('8_up'); console.log('升級', await st());
// 直接跳到後面幾波看異常狀態與特效
await page.evaluate(() => { const s = __g.s; s.coin = 2000; });
for (const [i, id] of [[9, 'mi'], [3, 'kevin'], [7, 'vivi'], [1, 'zhe'], [10, 'fairy'], [0, 'wu'], [5, 'qiang'], [6, 'an'], [11, 'senpai']]) { await tapSlot(i); await tapSel(`.card[data-id="${id}"]`); await tapSel('#uBuy'); }
await tapSel('.panel .x'); await page.evaluate(() => { __g.s.wave = 4; }); await wait(300); await tapSel('#uGo'); await wait(14000); await shot('9_wave5'); console.log('第五波', await st());
await page.evaluate(() => { __g.s.foes.forEach(f => f.hp = 0); __g.s.q.length = 0; }); await wait(1500); await page.evaluate(() => { __g.s.wave = 11; }); await wait(300); await tapSel('#uGo'); await wait(16000); await shot('10_boss'); console.log('最後一波', await st());
console.log('錯誤：', errors.length ? errors : '無'); await browser.close();
