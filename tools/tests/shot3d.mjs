// 3D 樣張截圖。用法：node tools/tests/shot3d.mjs 檔名 "參數（接在 ? 後面）" [倍率]
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const [name = 'p3d', query = '', dpr = '2'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 590, deviceScaleFactor: +dpr });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
const BASE = process.env.URL || 'http://localhost:4660/';
await page.goto(`${BASE}proto3d/index.html?${query}&f=${Date.now()}`); await page.waitForFunction('window.__p && window.__p.ready', { timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: `/Users/hermes/Public/0720/a4-td/out/${name}.png` });
console.log('錯誤：', errors.length ? errors : '無', await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; }));
await browser.close();
