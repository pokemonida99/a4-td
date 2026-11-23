// 經濟流程：開局的錢調派 → 打怪賺錢 → 花錢升職。全程真觸控、不作弊。用法：node tools/tests/econ.mjs
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-td/out'; const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const errors = [];
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 590, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true }); p.on('pageerror', e => errors.push(e.message));
await p.goto(`http://localhost:4660/?play&f=${Date.now()}`); await p.waitForFunction('window.__bootDone && window.__game.s');
const tap = async (x, y) => { await p.touchscreen.tap(x, y); await wait(250); };
const zone = k => p.evaluate(k => { const z = (__game.zones || []).find(z => z[4] === k); return z && [z[0] + z[2] / 2, z[1] + z[3] / 2]; }, k);
const st = () => p.evaluate(() => ({ coin: __game.s.coin, cost: __game.s.sumCost, kills: __game.s.kills, wave: __game.s.wave, lv: __game.s.slots.map(x => x.tw ? x.tw.id + x.tw.lv : '-').join(' ') }));
const slots = await p.evaluate(() => __game.s.slots.map(s => [s.x, s.y])); const log = [];
log.push('開局 ' + JSON.stringify(await st()));
let i = 0; while (await p.evaluate(() => __game.s.coin >= __game.s.sumCost)) { await tap(...await zone('summon')); await tap(...slots[[0, 1, 6, 7, 2][i++]]); }
log.push('買完 ' + JSON.stringify(await st()));
await tap(...await zone('call')); await p.evaluate(() => { __game.speed = 3; });
for (let k = 0; k < 60; k++) { await wait(1000); if (await p.evaluate(() => __game.s.phase === 'break' && __game.s.wave >= 2)) break; }
log.push('打完兩波 ' + JSON.stringify(await st()));
await tap(...slots[0]); await wait(200); await p.screenshot({ path: `${OUT}/econ_select.jpg`, type: 'jpeg', quality: 86 });
const before = await st(); const uz = await zone('upgrade'); if (uz) await tap(...uz); await wait(400); const after = await st();
await p.screenshot({ path: `${OUT}/econ_upgraded.jpg`, type: 'jpeg', quality: 86 });
log.push('升職前 ' + JSON.stringify(before)); log.push('升職後 ' + JSON.stringify(after));
console.log(log.join('\n')); console.log('錯誤：', errors.length ? errors.join(' ／ ') : '無'); await b.close();
