// UX 巡檢：真的觸控點完整玩一局，每一步截圖，順便量字級與按鈕大小。
// 用法：node tools/ux_audit.mjs [寬] [高]　（預設 1280 590；手機小螢幕用 870 402）
// 需要 localhost:4660 已經開著。截圖放 out/ux/<寬>x<高>/，量測結果寫 out/ux/<寬>x<高>/report.json
// 為了一局內走完所有流程，有幾步用 page.evaluate 直接改狀態（補人力、指定抽到誰、跳波、補氣勢），都會記在 report.cheats。
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const VW = +process.argv[2] || 1280, VH = +process.argv[3] || 590;
const OUT = `/Users/hermes/Public/0720/a4-td/out/ux/${VW}x${VH}`; mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = { size: [VW, VH], steps: [], cheats: [], errors: [], fonts: {}, zones: {}, misses: [] };

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) report.errors.push('[console] ' + m.text()); });
// 記錄每一格畫了哪些字、多大（canvas 邏輯 px）
await page.evaluateOnNewDocument(() => {
  window.__txt = new Map(); const P = CanvasRenderingContext2D.prototype, f = P.fillText;
  P.fillText = function (s, x, y, w) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); if (m && String(s).trim()) { const k = String(s).slice(0, 24); const px = +m[1]; const o = window.__txt.get(k); if (!o || o.px > px) window.__txt.set(k, { px, x: Math.round(x), y: Math.round(y) }); } return f.call(this, s, x, y, w); };
});
await page.goto(`http://localhost:4660/?fresh=${Date.now()}`); await page.waitForFunction('window.__bootDone', { timeout: 60000 }); await wait(800);

const scale = () => page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { k: r.width / 1280, x: r.left, y: r.top }; });
const toClient = async (x, y) => { const S = await scale(); return [S.x + x * S.k, S.y + y * S.k]; };
const zone = key => page.evaluate(k => (window.__game.zones || []).find(z => z[4] === k), key);
async function tapL(x, y, note) { const [cx, cy] = await toClient(x, y); await page.touchscreen.tap(cx, cy); await wait(300); }
async function tapZone(key) {
  const z = await zone(key); if (!z) { report.misses.push(`找不到按鈕 ${key}`); return false; }
  await tapL(z[0] + z[2] / 2, z[1] + z[3] / 2); return true;
}
async function drag(a, b) {
  const [ax, ay] = await toClient(...a), [bx, by] = await toClient(...b);
  const cdp = await page.target().createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ax, y: ay }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ax + (bx - ax) * i / 8, y: ay + (by - ay) * i / 8 }] }); await wait(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(300);
}
const slotXY = async i => page.evaluate(i => { const s = window.__game.s.slots[i]; return [s.x, s.y]; }, i);
const st = () => page.evaluate(() => { const s = window.__game.s, G = window.__game; return s ? { scene: G.scene, wave: s.wave, phase: s.phase, res: Math.floor(s.res), coin: s.coin, mom: Math.round(s.momentum), pending: s.pending && s.pending.id, slots: s.slots.map(x => x.tw ? x.tw.id + x.tw.lv : '-').join(' '), sel: G.sel, lives: s.lives, state: s.state } : { scene: G.scene }; });
let n = 0;
async function shot(name, note) {
  await wait(120); const file = `${String(n++).padStart(2, '0')}_${name}.jpg`;
  await page.screenshot({ path: `${OUT}/${file}`, type: 'jpeg', quality: 85 });
  const zs = await page.evaluate(() => (window.__game.zones || []).map(z => z.slice()));
  for (const z of zs) { const k = z[4]; if (!report.zones[k]) report.zones[k] = z.slice(0, 4); }
  report.steps.push({ file, note, state: await st() });
}
const cheat = async (why, fn, arg) => { report.cheats.push(why); await page.evaluate(fn, arg); };

// 1. 標題
await shot('title', '標題畫面');
await tapZone('start'); await wait(900);
await shot('start', '剛開局（還沒點任何東西）');
// 2. 緊急調派 → 報到中 → 放工位
await tapZone('summon'); await shot('pending', '按了緊急調派，報到中有人');
let p = await st();
await tapL(...await slotXY(0)); await shot('placed', '點空工位放下');
// 3. 再抽一位，指定同名 → 點到場上同一人＝合併
await tapZone('summon');
p = await st(); const first = (await page.evaluate(() => window.__game.s.slots[0].tw.id));
await cheat('指定第二抽跟第一位同名，測報到中直接合併', id => { window.__game.s.pending = { id, lv: 1 }; }, first);
await shot('pending_same', '報到中是同名的人：場上那位應該亮起可合併');
await tapL(...await slotXY(0)); await shot('merge_from_pending', '點場上同名同級＝合併升 II');
// 4. 多放幾位，然後拖曳合併
await cheat('補人力到 200，方便連抽', () => { window.__game.s.res = 200; window.__game.s.resMax = 999; });
for (const i of [1, 2, 6, 7, 3]) { await tapZone('summon'); await tapL(...await slotXY(i)); }
await cheat('把 1、2 號工位改成同名 I 級，測拖曳合併', () => { const s = window.__game.s; const id = s.slots[1].tw.id; s.slots[2].tw.id = id; s.slots[2].tw.lv = 1; s.slots[1].tw.lv = 1; });
await shot('before_drag', '六人上場，1、2 號同名同級');
await tapL(...await slotXY(1)); await shot('select', '點選一位同事（應該看到射程、資料、可合併的位置）');
await drag(await slotXY(1), await slotXY(2)); await shot('drag_merge', '把 1 號拖到 2 號＝合併');
// 5. 調位（波間第一次免費）
await tapL(...await slotXY(6)); await tapL(...await slotXY(10)); await shot('move', '點 6 號再點空的 10 號＝調位');
// 6. 轉派：報到中轉派、場上轉派
await tapZone('summon'); await shot('pending_full_check', '報到中有人時的底部狀態（轉派按鈕）');
await tapZone('discard'); await shot('discard', '報到中轉派');
await tapL(...await slotXY(7)); await tapZone('sell'); await shot('sell', '場上同事轉派');
// 7. 提早開波
const hadCall = await tapZone('call'); await wait(500); await shot('call_wave', hadCall ? '按提早開波' : '找不到提早開波按鈕');
await page.evaluate(() => { window.__game.speed = 3; }); await wait(5000); await shot('fight', '第 1 波戰鬥中（3 倍速）');
// 8. 合體技：確保小葵、阿哲在場，補氣勢 60
await cheat('放小葵、阿哲到 8、9 號並補氣勢 100', () => { const s = window.__game.s; for (const [i, id] of [[8, 'kui'], [9, 'zhe']]) { s.pending = { id, lv: 1 }; } s.momentum = 100; });
await page.evaluate(() => { const s = window.__game.s; s.pending = null; });
for (const [i, id] of [[8, 'kui'], [9, 'zhe']]) { await tapZone('summon'); await page.evaluate(id => { window.__game.s.pending = { id, lv: 1 }; }, id); await tapL(...await slotXY(i)); }
await page.evaluate(() => { window.__game.s.momentum = 100; }); await shot('mom_full', '氣勢 100：合體技、超級化應該亮');
const u = await page.evaluate(() => (window.__game.s.unites || [])[0]?.key);
if (u) { await tapZone('unite:' + u); await wait(150); await shot('unite', '按合體技（這案今天結）'); }
// 9. 超級化
await page.evaluate(() => { window.__game.s.momentum = 100; });
await tapZone('super'); await shot('super_nosel', '沒選人時按超級化（應該提示先選人）');
await tapL(...await slotXY(2)); await tapZone('super'); await wait(300); await shot('super', '選人後按超級化');
// 10. 甩鍋課長
await cheat('跳到第 5 波（頭目甩鍋課長）並補滿人', () => { const s = window.__game.s; s.foes.length = 0; s.spawnQ.length = 0; s.wave = 4; s.phase = 'break'; s.waveT = .5; });
await wait(4500); await shot('boss_chief', '甩鍋課長出場');
await page.waitForFunction(() => window.__game.s.foes.some(f => f.guard), { timeout: 20000 }).catch(() => {}); await shot('boss_guard', '課長舉鍋減傷');
await page.waitForFunction(() => window.__game.s.foes.some(f => f.broken), { timeout: 20000 }).catch(() => {}); await shot('boss_broken', '課長丟鍋理虧');
// 11. 奧客總經理
await cheat('跳到第 10 波（奧客總經理）', () => { const s = window.__game.s; s.foes.length = 0; s.spawnQ.length = 0; s.wave = 9; s.phase = 'break'; s.waveT = .5; });
await page.waitForFunction(() => window.__game.s.foes.some(f => f.charge > 0), { timeout: 40000 }).catch(() => {}); await shot('boss_charge', '奧客蓄力客訴長卷');
await page.waitForFunction(() => window.__game.s.foes.some(f => f.final) === false || window.__game.s.state !== 'play', { timeout: 5000 }).catch(() => {});
await wait(2500); await shot('boss_after', '蓄力之後（打斷或扣底氣）');
// 12. 暫停、漏怪紅閃
await tapZone('pause'); await shot('pause', '暫停'); await tapZone('pause');
// 13. 結案報告
await cheat('底氣歸零，看結案報告', () => { window.__game.s.lives = 0; });
await wait(3200); await shot('result', '結案報告（輸）');
// 字級與按鈕
const S = await scale();
report.scale = S.k;
report.fonts = Object.fromEntries([...(await page.evaluate(() => [...window.__txt.entries()]))].map(([k, v]) => [k, { ...v, css: +(v.px * S.k).toFixed(1) }]));
report.zonesCss = Object.fromEntries(Object.entries(report.zones).map(([k, z]) => [k, [Math.round(z[2] * S.k), Math.round(z[3] * S.k)]]));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(`${VW}x${VH} 縮放 ${S.k.toFixed(2)}　截圖 ${n} 張　錯誤 ${report.errors.length}　找不到 ${report.misses.join('、') || '無'}`);
await browser.close();
