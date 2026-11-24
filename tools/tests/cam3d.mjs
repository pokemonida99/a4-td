// 鏡頭比較：node tools/tests/cam3d.mjs 名稱 "pitch=42&yaw=18&fit=37" [第幾波]
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const [name = 'cam', q = '', wave = '2'] = process.argv.slice(2), wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:4660/proto3d/index.html?notut&${q}&f=${Date.now()}`); await page.waitForFunction('window.__g && window.__g.ready', { timeout: 60000 });
await page.evaluate(w => { const s = __g.s; s.coin = 9999; [[2, 'jie'], [4, 'yan'], [8, 'kui'], [9, 'mi'], [1, 'zhe'], [7, 'vivi'], [10, 'qiang']].forEach(([i, id]) => __g.C.place(s, i, id)); s.coin = 120; s.wave = +w; __g.start ? __g.start() : __g.C.startWave(s); __g.speed = 2; }, wave);
await wait(11000); await page.screenshot({ path: `/Users/hermes/Public/0720/a4-td/out/cam_${name}.png` });
if (errors.length) console.log(errors); await browser.close();
