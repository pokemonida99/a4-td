// 3D 版整場實測：在瀏覽器裡用高倍速打完 12 波（自動派人、升級、用技能），抓畫面端的錯誤，順便量每格畫面花多久。
// 用法：node tools/tests/full3d.mjs [normal|hell]
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const diff = process.argv[2] || 'normal', BASE = process.env.URL || 'http://localhost:4660/', wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 600000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto(`${BASE}proto3d/index.html?notut&play=${diff}&f=${Date.now()}`); await page.waitForFunction('window.__g && window.__g.ready', { timeout: 60000 }); await wait(800);
await page.evaluate(() => {
  const ORDER = [['kui', 4], ['jie', 2], ['yan', 8], ['zhe', 9], ['qiang', 3], ['mi', 7], ['wu', 1], ['kevin', 10], ['vivi', 5], ['fairy', 0], ['an', 6], ['senpai', 11]];
  window.__ft = []; let last = performance.now(); const tick = () => { const n = performance.now(); __ft.push(n - last); last = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  __g.speed = 6; window.__seen = {};
  setInterval(() => {
    const s = __g.s, C = __g.C; if (s.phase === 'won' || s.phase === 'lost') return;
    for (const [id, i] of ORDER) if (!C.placed(s, id) && C.canPlace(s, i, id)) { C.place(s, i, id); break; }
    for (let i = 0; i < 12; i++) if (s.coin > 150 && C.canUpgrade(s, i)) { C.upgrade(s, i); break; }
    if (s.phase === 'prep') C.startWave(s); else if (s.foes.length > 5) C.useSkill(s);
    for (const sl of s.slots) if (sl.h) { if (sl.h.fz > 0) __seen.freeze = 1; if (sl.h.pz > 0) __seen.para = 1; } if (s.rats.length) __seen.rat = 1;
  }, 120);
});
for (let k = 0; k < 90; k++) {
  await wait(4000);
  const p = await Promise.race([page.evaluate(() => ({ ph: __g.s.phase, w: __g.s.wave, t: Math.round(__g.s.t), foes: __g.s.foes.length, lives: __g.s.lives, coin: __g.s.coin, fr: __ft.length })), wait(8000).then(() => null)]);
  if (!p) { console.log('頁面沒回應（卡住了）'); break; }
  if (k % 3 === 0) console.log(JSON.stringify(p));
  if (p.ph === 'won' || p.ph === 'lost') break;
}
await wait(1200);
const r = await page.evaluate(() => { const f = __ft.slice(30).sort((a, b) => a - b); return { phase: __g.s.phase, wave: __g.s.wave, lives: __g.s.lives, kills: __g.s.kills, seen: Object.keys(__seen).join(','), frames: f.length, median: f[f.length >> 1].toFixed(1), p95: f[(f.length * .95) | 0].toFixed(1), end: !document.querySelector('#uEnd').hidden }; });
await page.screenshot({ path: `/Users/hermes/Public/0720/a4-td/out/full_${diff}.png` });
console.log(JSON.stringify(await page.evaluate(() => ({ heroes: __g.s.slots.map(x => x.h ? x.h.id + x.h.lv : '-').join(' '), view: __g.view().aspect, cw: document.getElementById('gl').clientWidth, ch: document.getElementById('gl').clientHeight }))));
await page.evaluate(() => { document.querySelector('#uEnd').hidden = true; }); await wait(300); await page.screenshot({ path: `/Users/hermes/Public/0720/a4-td/out/full_${diff}_scene.png` });
console.log(JSON.stringify(r)); console.log('錯誤：', errors.length ? errors : '無'); await browser.close();
