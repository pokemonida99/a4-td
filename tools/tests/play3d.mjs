// 3D 版觸控實測：手機橫向尺寸，用真的觸控點走一輪（標題 → 三段教學 → 派人 → 升級 → 提早開波 → 技能 → 結算）。
// 用法：node tools/tests/play3d.mjs [前綴]   截圖在 out/<前綴>_*.png
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out', PRE = process.argv[2] || 'g3d', BASE = process.env.URL || 'http://localhost:4660/';
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: +(process.env.W || 870), height: +(process.env.H || 402), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto(`${BASE}proto3d/index.html?tut&f=${Date.now()}`); await page.waitForFunction('window.__g && window.__g.ready', { timeout: 60000 }); await wait(1200);
const shot = n => page.screenshot({ path: `${OUT}/${PRE}_${n}.png` });
const tap = async (x, y) => { await page.touchscreen.tap(x, y); await wait(380); };
const tapSel = async (sel, quiet) => { const r = await page.evaluate(s => { const n = document.querySelector(s); if (!n || n.hidden || !n.getBoundingClientRect().width) return null; if (n.closest('.cards')) n.scrollIntoView({ block: 'nearest', inline: 'center' }); const b = n.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return [b.left + b.width / 2, b.top + b.height / 2, t === n || n.contains(t), b.width, b.height]; }, sel); if (!r) { if (!quiet) errors.push('找不到 ' + sel); return false; } if (!r[2]) errors.push('被蓋住：' + sel); if (Math.min(r[3], r[4]) < 36) errors.push(`太小（${Math.round(r[3])}×${Math.round(r[4])}）：` + sel); await tap(r[0], r[1]); return true; };
const tapSlot = async i => { const p = await page.evaluate(i => __g.slotScreen(i), i); await tap(p[0], p[1]); };
const st = () => page.evaluate(() => ({ coin: __g.s.coin, lives: __g.s.lives, wave: __g.s.wave, phase: __g.s.phase, heroes: __g.s.slots.map(x => x.h ? x.h.id + x.h.lv : '-').join(' '), foes: __g.s.foes.length, tut: document.querySelector('#uTut').hidden ? 'off' : document.querySelector('#uTut p')?.textContent.slice(0, 14) }));
const say = async t => console.log(t.padEnd(8), JSON.stringify(await st()));
const buyAt = async (i, id) => { await tapSlot(i); await tapSel(`.card[data-id="${id}"]`); await tapSel('#uBuy'); };

await shot('0_title'); await tapSel('#uTitle button[data-d="normal"]'); await wait(400); await shot('1_tutA'); await say('開場');
await tapSel('#uTutNext'); await tapSlot(4); await shot('2_menu'); await tapSel('.card[data-id="kui"]'); await tapSel('#uBuy'); await say('派小葵');
await buyAt(2, 'jie'); await shot('3_ready'); await say('派阿傑');
await tapSel('#uGo'); await tapSel('#uSpd'); await wait(7000); await shot('4_wave1'); await say('第一波');
await page.waitForFunction('__g.s.phase === "prep"', { timeout: 90000 }); await wait(900); await shot('5_tutB'); await say('教學二');
await tapSlot(4); await tapSel('#uUp'); await wait(300); await tapSel('.panel .x', true); await say('升級');
await tapSel('.chip'); await shot('6_foeinfo'); await tapSel('#uGo'); await say('提早開');
await page.waitForFunction('__g.s.phase === "prep"', { timeout: 120000 }); await wait(900); await shot('7_tutC'); await say('教學三'); await tapSel('#uTutNext');
await tapSlot(8); await shot('8_menu_w3'); await tapSel('.panel .x');
await page.evaluate(() => { __g.s.coin = 2000; });
for (const [i, id] of [[8, 'yan'], [9, 'mi'], [3, 'kevin'], [7, 'vivi'], [1, 'zhe'], [10, 'fairy'], [0, 'wu'], [5, 'qiang'], [6, 'an'], [11, 'senpai']]) await buyAt(i, id);
await page.evaluate(() => { __g.s.wave = 5; __g.s.prepT = 15; }); await wait(300); await tapSel('#uGo'); await wait(9000); await tapSel('#uSkill'); await wait(700); await shot('9_wave6_skill'); await say('第六波');
await page.evaluate(() => { __g.s.foes.forEach(f => f.hp = 0); __g.s.q.length = 0; }); await page.waitForFunction('__g.s.phase === "prep"', { timeout: 30000 }); await page.evaluate(() => { __g.s.wave = 11; __g.s.prepT = 15; }); await wait(300); await tapSel('#uGo'); await wait(15000); await shot('10_boss'); await say('最後一波');
await page.evaluate(() => { __g.s.lives = 0; }); await wait(1500); await shot('11_lost'); await tapSel('#uAgain'); await wait(600); await say('再來一次'); await shot('12_again');
console.log('錯誤：', errors.length ? errors : '無'); await browser.close();
