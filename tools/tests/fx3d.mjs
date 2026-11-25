// 3D 版特效檢查：擺好一隊三級同事、開一波，連拍幾張。用法：node tools/tests/fx3d.mjs [檔名開頭] [第幾波] [張數]
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const [name = 'fx', wave = '9', shots = '8'] = process.argv.slice(2);
const TEAM = (process.env.TEAM || '2:kui,3:jie,8:mi,9:kevin,1:zhe,4:yan,7:qiang,10:fairy,0:vivi,5:senpai,6:cha,11:an').split(',').map(v => v.split(':')), LV = +(process.env.LV || 3);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: +(process.env.W || 1280), height: +(process.env.H || 590), deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto(`${process.env.URL || 'http://localhost:4660/'}proto3d/index.html?play=normal&notut&f=${Date.now()}`); await page.waitForFunction('window.__g && window.__g.ready', { timeout: 60000 });
await new Promise(r => setTimeout(r, 800));
await page.evaluate((team, lv, wave) => { const g = window.__g, C = g.C, s = g.s; s.coin = 9999; for (const [i, id] of team) { C.place(s, +i, id); for (let k = 1; k < lv; k++) C.upgrade(s, +i); } s.wave = wave - 1; C.startWave(s); }, TEAM, LV, +wave);
await new Promise(r => setTimeout(r, +(process.env.WAIT || 7000)));
let peak = 0;
for (let i = 0; i < +shots; i++) { await page.screenshot({ path: `/Users/hermes/Public/0720/a4-td/out/${name}_${i}.png` }); peak = Math.max(peak, await page.evaluate(() => window.__g.fx.count)); await new Promise(r => setTimeout(r, +(process.env.GAP || 420))); }
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(Math.round(n / 2)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
console.log('錯誤：', errors.length ? errors : '無', '｜同時最多特效形狀', peak, '｜每秒格數', fps);
await browser.close();
