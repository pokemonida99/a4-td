// v0.3 介面：路線卡、技能、快捷鍵、指定調派、調派袋、掛名教學。真觸控。用法：node tools/tests/v03.mjs
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out/v03'; const wait = ms => new Promise(r => setTimeout(r, ms));
import { mkdirSync } from 'node:fs'; mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:4660/';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const errors = [], log = [];
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 590, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true }); p.on('pageerror', e => errors.push(e.message));
await p.goto(`${URL}?play&f=${Date.now()}`); await p.waitForFunction('window.__bootDone && window.__game.s');
const tap = async (x, y) => { await p.touchscreen.tap(x, y); await wait(280); };
const zone = k => p.evaluate(k => { const z = (__game.zones || []).find(z => z[4] === k); return z && [z[0] + z[2] / 2, z[1] + z[3] / 2]; }, k);
const tz = async k => { const z = await zone(k); if (!z) { log.push('找不到按鈕 ' + k); return false; } await tap(...z); return true; };
const shot = n => p.screenshot({ path: `${OUT}/${n}.jpg`, type: 'jpeg', quality: 85 });
const st = () => p.evaluate(() => ({ coin: __game.s.coin, wave: __game.s.wave, phase: __game.s.phase, slots: __game.s.slots.map(x => x.tw ? x.tw.id + x.tw.lv + (x.tw.route || '') : '-').join(' '), bag: (__game.s.bag || []).join(','), pend: __game.s.pending && __game.s.pending.id }));
const slots = await p.evaluate(() => __game.s.slots.map(s => [s.x, s.y]));
await p.evaluate(() => { __game.s.coin = 2000; });
await shot('00_bag'); log.push('開局 ' + JSON.stringify(await st()));
// 兩位小葵合併 → II → 路線卡
for (const i of [0, 1]) { await tz('summon'); await p.evaluate(() => { __game.s.pending = { id: 'kui', lv: 1, paid: 20 }; }); await tap(...slots[i]); }
await tap(...slots[1]); await tap(...slots[0]); log.push('合併後 ' + JSON.stringify(await st()));
await tap(...slots[0]); await shot('01_route_cards'); const hadRoute = await tz('route:b'); log.push('選路線 B ' + hadRoute + ' ' + JSON.stringify(await st()));
await tz('upgrade'); await wait(200); log.push('升到 III ' + JSON.stringify(await st())); await shot('02_lv3_select');
// 其他人
for (const [i, id] of [[6, 'jie'], [7, 'mi'], [2, 'zhe']]) { await tz('summon'); await p.evaluate(id => { __game.s.pending = { id, lv: 1, paid: 20 }; }, id); await tap(...slots[i]); }
await tap(640, 470); // 點空地取消選取
// 指定調派
const pk = await tz('pick'); await wait(200); await shot('03_pick_open'); const pk2 = await tz('pick:yan'); log.push('指定調派 ' + pk + pk2 + ' ' + JSON.stringify(await st())); await tap(...slots[8]);
// 開打、用技能（快捷鍵，會先瞄準）
await tz('call'); await p.evaluate(() => { __game.speed = 2; }); await wait(5000);
const qs = await p.evaluate(() => (__game.zones || []).find(z => String(z[4]).startsWith('qs:'))?.[4]); log.push('快捷鍵 ' + qs);
if (qs) { await tz(qs); await wait(200); await shot('04_skill_aim'); const aiming = await p.evaluate(() => __game.aimSkill); await tap(700, 275); await wait(300); await shot('05_skill_fired'); log.push('技能瞄準 ' + aiming + ' 冷卻 ' + await p.evaluate(() => __game.s.slots[0].tw.skillCd)); }
// 跳到第 3 波看掛名＋教學卡
await p.evaluate(() => { const s = __game.s; s.foes.length = 0; s.wave = 2; s.phase = 'break'; s.waveT = .3; }); await wait(2500); await shot('06_teach'); await wait(9000); await shot('07_camo');
log.push('第 3 波 ' + JSON.stringify(await st()));
console.log(log.join('\n')); console.log('錯誤：', errors.length ? [...new Set(errors)].join(' ／ ') : '無'); await b.close();
