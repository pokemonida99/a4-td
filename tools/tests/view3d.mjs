// 3D 版視角檢查：各種螢幕比例都不能被壓扁，而且「沒收到 resize 事件」也要自己修正。
// 用法：node tools/tests/view3d.mjs   （截圖在 out/view_*.png）
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const BASE = process.env.URL || 'http://localhost:4660/', wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); let bad = 0;
// 模擬手機：resize 事件一律收不到
await page.evaluateOnNewDocument(() => { const add = window.addEventListener.bind(window); window.addEventListener = (t, f, o) => { if (t !== 'resize') add(t, f, o); }; });
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${BASE}proto3d/index.html?notut&f=${Date.now()}`); await page.waitForFunction('window.__g && window.__g.ready', { timeout: 60000 });
const check = async (name, w, h) => {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await wait(900);
  const r = await page.evaluate(() => { const c = document.getElementById('gl'), v = __g.view(); return { buf: c.width / c.height, css: c.clientWidth / c.clientHeight, cam: v.aspect, slab: v.slab }; });
  const ok = Math.abs(r.buf / r.css - 1) < .02 && Math.abs(r.cam / r.css - 1) < .02 && r.slab.every(p => p[0] >= -2 && p[0] <= w + 2 && p[1] >= -2 && p[1] <= h + 2);
  if (!ok) bad++; console.log(ok ? 'ok ' : 'BAD', name.padEnd(14), `${w}×${h}`, '畫布比例', r.buf.toFixed(3), '版面比例', r.css.toFixed(3), '鏡頭比例', r.cam.toFixed(3), '浮島四角', r.slab.map(p => p.map(v => Math.round(v)).join(',')).join(' '));
  await page.screenshot({ path: `/Users/hermes/Public/0720/a4-td/out/view_${name}.png` });
};
await check('直放', 430, 932); await check('轉成橫放', 932, 430); await check('iPhoneSE', 667, 375); await check('安卓長螢幕', 915, 412); await check('平板', 1024, 768); await check('電腦', 1440, 810);
console.log(bad ? `有 ${bad} 種尺寸不對` : '全部尺寸都對'); await browser.close();
