// 3D 版招式型錄：把每一種特效各放一次，停在指定的時間點拍下來（檢查形狀、大小、顏色用）
// 用法：node tools/tests/fxdemo3d.mjs [檔名開頭]   →  out/<檔名>_a.png（剛放）、_b.png（中段）、_c.png（快結束）
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const [name = 'fxdemo'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 590, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto(`${process.env.URL || 'http://localhost:4660/'}proto3d/index.html?play=normal&notut&f=${Date.now()}`); await page.waitForFunction('window.__g && window.__g.ready', { timeout: 60000 });
await new Promise(r => setTimeout(r, 600));
await page.evaluate(n => { const g = window.__g, C = g.C, s = g.s; s.coin = 9999; ['vivi', 'zhe', 'kui', 'jie', 'yan', 'senpai', 'cha', 'qiang', 'mi', 'kevin', 'fairy', 'an'].slice(0, n).forEach((id, i) => C.place(s, i, id)); }, +(process.env.N || 12));
await new Promise(r => setTimeout(r, 1500));
for (const [tag, t] of [['a', .07], ['b', .17], ['c', .3]]) {
  await page.evaluate(t => {
    const g = window.__g, fx = g.fx, E = g.ELEM, c = k => E[k].rgb, S = i => [g.s.slots[i].x, g.s.slots[i].z]; fx.clear(); g.fxHold = true;
    const T = -4.25, M = -.5, B = 3.125;
    fx.slash(...S(2), -7, T, c('slash'), 3); fx.stab(-4.5, T, c('slash'), true); fx.punch(...S(7), -2, T, c('fist'), true);
    fx.fireHit(1.5, T, 1.9, c('fire')); fx.waterHit(5.5, T, c('water'), true); fx.snipeHit(8.5, T, c('light')); fx.poolFire(11.5, T, 1.2, c('fire'));
    fx.circle(...S(8), 6.5, M, 2.1, c('light')); fx.lightBlast(-6, M, 2.1, c('light')); fx.darkBlast(-1, M, 2.1, c('dark'), 3); fx.papers(9.5, M, 7);
    fx.lance(...S(6), 0, B, c('wind'), [[-2, 2.4], [-.5, 2.9]]); fx.summon(2.5, B, c('summon')); fx.bite(4.5, B); fx.crit(6, B, c('fire')); fx.papers(8.5, B, 40);
    fx.levelUp(...S(4), 3); fx.pulse(...S(0), 5, c('sup'), [S(1), S(6)]);
    fx.update(t);
  }, t);
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: `/Users/hermes/Public/0720/a4-td/out/${name}_${tag}.png` });
}
console.log('錯誤：', errors.length ? errors : '無');
await browser.close();
