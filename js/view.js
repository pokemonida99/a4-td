// 畫面：地圖、工位、同事、敵人、特效、介面（左側會議側欄＋上緣資訊＋底部指令帶）。
// 地圖座標（core 用的）是 1096×442，畫到畫面上要加 (MX, MY)。
import * as C from './core.js';
import * as D from './data.js';
import { IMG, Q, sfx, bgm } from './assets.js';
import { W, H, INK, INK2, CREAM, TEAL, RED, BRASS, GOLD, SANS, SERIF, ELEM, rnd, pats, font, text, wood, paper, stamp, button, bar, clip, stud } from './skin.js';

export const MX = 0, MY = 0, MW = 1280, MH = 590;      // 地圖鋪滿全畫面，介面浮在上面（11/23 使用者要照參考圖的豐富度）
export const VIEW = { hover: null, down: null, summonT: 0, talk: null, zones: [], tw: {}, foe: {}, banner: null, shake: 0, flash: 0 };
export const FX = [];
const T = () => D.TOWERS, F = () => D.FOES;
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const KIND_NOTE = { single: '單體攻擊', splash: '範圍攻擊', multi: '同時打好幾個', aura: '身邊全打', buff: '幫旁邊的人加攻', gen: '產生人力額度', line: '直線穿刺', summon: '召喚', heal: '支援' };

export function resetView() { FX.length = 0; VIEW.tw = {}; VIEW.foe = {}; VIEW.banner = null; VIEW.talk = null; VIEW.shake = 0; VIEW.flash = 0; VIEW.bossKind = null; }
export const layout = { MX, MY, MW, MH };

// ---------- Vivi 的台詞（側欄視訊） ----------
const LINES = {
  intro: ['本公司鼓勵準時下班。現在，請各位證明。'],
  wave: ['又來一批，別讓他們碰到打卡機。', '下一波。動作快一點。', '我看著呢，別讓我失望。', '人力夠了就「緊急調派」，別省。'],
  boss_chief: ['甩鍋課長來了。等他把鍋丟出去再打。'], boss_boss: ['總經理親自來了……全力擋下，這是命令。'], boss: ['主管級的來了，集中火力。'],
  leak: ['有工作漏進來了！', '打卡機那邊在叫了，注意！'], merge: ['職級核定，通過。', '升職了？那就拿出升職的樣子。'],
  low: ['底氣快見底了，給我撐住。'], win: ['……做得不錯。今天准你們準時下班。'], lose: ['全員留下加班。明天早會檢討。'],
};
let talkCd = 0;
export function say(k, force) {
  const L = LINES[k]; if (!L) return; if (!force && talkCd > 0 && k !== 'win' && k !== 'lose') return;
  VIEW.talk = { s: L[Math.floor(Math.random() * L.length)], t: 0 }; talkCd = 4;
}

// ---------- 點擊區 ----------
const zone = (x, y, w, h, key) => VIEW.zones.push([x, y, w, h, key]);
export function hudHit(G, x, y) { for (let i = VIEW.zones.length - 1; i >= 0; i--) { const [zx, zy, w, h, k] = VIEW.zones[i]; if (x >= zx && x <= zx + w && y >= zy && y <= zy + h) return k; } return null; }
export function slotAt(s, x, y) {
  if (!s || x < MX || y < MY || y > MY + MH) return -1; let best = -1, bd = 46 * 46;
  s.slots.forEach((sl, i) => { const dx = x - (MX + sl.x), dy = (y - (MY + sl.y - 14)) * 1.1, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } });
  return best;
}

// ---------- 事件 → 特效 ----------
const dirOf = (sx, sy, tx, ty) => { const dx = tx - sx, dy = ty - sy; return Math.abs(dy) > Math.abs(dx) * .9 ? (dy > 0 ? 'down' : 'up') : 'side'; };
export function fxFromEvents(s, G) {
  for (const e of s.ev) {
    if (e.k === 'shot') {
      const sl = s.slots[e.slot], tw = sl && sl.tw; if (!tw) continue;
      const v = VIEW.tw[tw.uid] || (VIEW.tw[tw.uid] = {}); v.dir = e.dir || dirOf(sl.x, sl.y, e.x, e.y); v.flip = e.flip ?? (e.x < sl.x); v.actT = 0; v.acting = true;
      FX.push({ k: 'shot', elem: e.elem, kind: e.kind, x0: sl.x, y0: sl.y - 30, x: e.x, y: e.y - 18, r: e.radius || 0, t: 0, life: e.kind === 'splash' ? .45 : .3, x2: e.x2, y2: e.y2 });
      const snd = { slash: 'slash', blunt: 'hit', fire: 'explosion', ice: 'break', holy: 'holy_cast', dark: 'dark_blast' }[e.elem] || 'hit';
      sfx(snd, e.elem === 'fire' ? .18 : .26, .95 + Math.random() * .15);
    } else if (e.k === 'dmg') FX.push({ k: 'num', x: e.x + (Math.random() * 16 - 8), y: e.y - 40, v: e.v, weak: e.weak, t: 0, life: .7 });
    else if (e.k === 'die') { for (let i = 0; i < (e.boss ? 26 : 7); i++) FX.push({ k: 'paper', x: e.x, y: e.y - 20, vx: (Math.random() - .5) * 160, vy: -60 - Math.random() * 120, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, t: 0, life: .9 + Math.random() * .4 }); if (e.boss) { sfx('boss_down', .8); VIEW.shake = .5; VIEW.bossKind = null; } else sfx('coin', .25, 1.2); }
    else if (e.k === 'leak') { VIEW.flash = .5; VIEW.shake = .25; sfx('defeat', .35, 1.4); say('leak'); if (s.lives <= s.livesMax * .3) say('low', true); }
    else if (e.k === 'summon') { FX.push({ k: 'pop', slot: e.slot, t: 0, life: .5 }); }
    else if (e.k === 'merge') { FX.push({ k: 'merge', slot: e.slot, lv: e.lv, t: 0, life: 1.1 }); sfx('train', .7); say('merge'); }
    else if (e.k === 'move') sfx('cursor', .5);
    else if (e.k === 'wave') { VIEW.banner = { s: `第 ${e.n} 波`, sub: e.name || waveNote(e.n - 1), boss: e.boss, t: 0 }; sfx(e.boss ? 'boss_appear' : 'encounter', .6); if (!e.boss) say('wave'); }
    else if (e.k === 'boss') { VIEW.bossKind = e.kind; say('boss_' + e.kind) ; if (!LINES['boss_' + e.kind]) say('boss'); bgm('boss'); }
    else if (e.k === 'gen') FX.push({ k: 'num', x: s.slots[e.slot].x, y: s.slots[e.slot].y - 70, v: '+' + Math.round(e.v), col: '#9be0c8', t: 0, life: .9 });
    else if (e.k === 'win') { say('win', true); sfx('fanfare', .8); }
    else if (e.k === 'lose') { say('lose', true); sfx('defeat', .8); }
  }
  s.ev.length = 0;
}
function waveNote(i) { const Wv = D.WAVES[i]; if (!Wv) return ''; const ks = [...new Set(Wv.groups.map(g => g.kind))]; return ks.map(k => F()[k]?.name || k).join('、'); }

// ---------- 角色圖 ----------
function drawQ(c, key, anim, dir, flip, fr, x, y, sc = 1, alpha = 1) {
  const q = Q[key]; if (!q) return false;
  let st = q.strips[`${anim}_${dir}`], f = flip; if (!st) { st = q.strips[`${anim}_side`] || q.strips[`idle_${dir}`] || q.strips.idle_down; } if (!st) return false;
  const n = Math.max(1, Math.round(st.width / q.cell[0])), i = Math.min(n - 1, Math.floor(fr * n)) % n, k = (q.scale || 1) * sc;
  c.save(); c.globalAlpha = alpha; c.translate(Math.round(x), Math.round(y)); if (f && dir === 'side') c.scale(-1, 1);
  c.drawImage(st, i * q.cell[0], 0, q.cell[0], q.cell[1], Math.round(-q.foot[0] * k), Math.round(-q.foot[1] * k), Math.round(q.cell[0] * k), Math.round(q.cell[1] * k)); c.restore(); return true;
}
function drawHero(c, id, x, y, o = {}) {
  const v = o.v || {}, t = o.t || 0;
  if (Q[id]) { const acting = v.acting && v.actT < .45; return drawQ(c, id, acting ? 'atk' : 'idle', v.dir || 'down', v.flip, acting ? v.actT / .45 : (t * 1.6) % 1, x, y, o.sc || 1, o.alpha ?? 1); }
  const im = IMG[`${id}_ready`]; if (!im) return;
  const acting = v.acting && v.actT < .3, k = .5 * (o.sc || 1), lunge = acting ? Math.sin(v.actT / .3 * Math.PI) * 6 : 0, sq = acting ? 1 + Math.sin(v.actT / .3 * Math.PI) * .06 : 1 + Math.sin(t * 3) * .015;
  c.save(); c.globalAlpha = o.alpha ?? 1; c.translate(Math.round(x + (v.flip ? -lunge : lunge)), Math.round(y)); if (v.flip) c.scale(-1, 1); c.scale(1 / sq * 1, sq);
  c.drawImage(im, Math.round(-im.width * k / 2), Math.round(-im.height * k), Math.round(im.width * k), Math.round(im.height * k)); c.restore();
}
const FOE_H = { minion: 46, courier: 44, knight: 52, intern: 44, auntie: 46, smoker: 46, chief: 78, boss: 96, parrot: 80, monkey: 70, pig: 84, audit: 80 };
function drawFoe(c, f, x, y, t) {
  const v = VIEW.foe[f.uid] || (VIEW.foe[f.uid] = { px: f.x, py: f.y, dir: 'side', flip: false });
  const dx = f.x - v.px, dy = f.y - v.py; if (Math.abs(dx) + Math.abs(dy) > .3) { v.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : 'side'; v.flip = dx < 0; } v.px = f.x; v.py = f.y;
  const ph = (t * 1.8 + f.ph) % 1;
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y, f.boss ? 30 : 15, f.boss ? 8 : 5, 0, 0, 7); c.fill();
  if (!drawQ(c, 'foe_' + f.kind, f.hitT > 0 && Q['foe_' + f.kind]?.strips['hit_' + v.dir] ? 'hit' : 'walk', v.dir, v.flip, ph, x, y)) {
    const im = (f.hitT > 0 && IMG[`foe_${f.kind}_hit`]) || IMG[`foe_${f.kind}`]; if (!im) { c.fillStyle = RED; c.fillRect(x - 10, y - 30, 20, 30); }
    else { const h = FOE_H[f.kind] || 48, k = h / im.height, bob = Math.abs(Math.sin(ph * Math.PI * 2)) * (f.boss ? 2 : 3);
      c.save(); c.translate(Math.round(x), Math.round(y - bob)); if (v.flip === false && v.dir === 'side') c.scale(-1, 1);      // RPG 的敵人圖面向左；往右走時翻過來
      c.drawImage(im, Math.round(-im.width * k / 2), Math.round(-im.height * k), Math.round(im.width * k), Math.round(im.height * k)); c.restore(); }
  }
  const h = (FOE_H[f.kind] || 48);
  if (f.hitT > 0) { c.globalAlpha = f.hitT / .15 * .5; c.fillStyle = '#fff'; c.fillRect(x - 12, y - h * .8, 24, h * .6); c.globalAlpha = 1; }
  if (f.slow > 0) { c.fillStyle = 'rgba(127,212,240,.85)'; c.fillRect(x - 13, y - 3, 4, 4); c.fillRect(x + 9, y - 5, 4, 4); }
  if (f.burnT > 0 && Math.floor(t * 10) % 2) { c.fillStyle = '#ff7a2e'; c.fillRect(x - 4 + Math.sin(t * 9) * 6, y - h * .6, 4, 6); }
  if (!f.boss && f.hp < f.max) { const bw = 30; bar(x - bw / 2, y - h - 8, bw, 4, f.hp / f.max, '#d24a3a'); }
  const wk = F()[f.kind]?.weak; if (wk && wk[0] && !f.boss) { const [ch, col] = ELEM[wk[0]] || []; if (ch) { c.fillStyle = '#1a0f08'; c.fillRect(x + 10, y - h - 14, 15, 15); c.fillStyle = col; c.fillRect(x + 11, y - h - 13, 13, 13); text(ch, x + 17.5, y - h - 2, { px: 11, align: 'center', col: '#1a0f08', w: 900 }); } }
}

// ---------- 地圖（新美術到之前用程式畫的走廊頂著） ----------
let mapCache = null;
function drawMap(c, s) {
  if (IMG.map) { c.drawImage(IMG.map, MX, MY, MW, MH); return; }
  if (!mapCache || mapCache.s !== s.map) {
    const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH; const x = cv.getContext('2d'); const P = pats();
    x.fillStyle = P.FLOOR; x.fillRect(0, 0, MW, MH);
    for (const L of s.lanes) { const pts = [L.seg[0] && [L.seg[0].ax, L.seg[0].ay], ...L.seg.map(g => [g.bx, g.by])];
      for (const [w, col] of [[64, '#2e2118'], [56, '#b9a47c'], [44, '#cdb98f']]) { x.strokeStyle = col; x.lineWidth = w; x.lineJoin = 'round'; x.lineCap = 'square'; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); }
      x.strokeStyle = 'rgba(90,70,40,.35)'; x.lineWidth = 2; x.setLineDash([10, 14]); x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); x.setLineDash([]); }
    mapCache = { s: s.map, cv };
  }
  c.drawImage(mapCache.cv, MX, MY);
  // 入口與打卡機
  const L = s.lanes[0], a = L.seg[0], z = L.seg[L.seg.length - 1];
  tag(c, MX + a.ax, MY + a.ay + 10, '電梯口', TEAL); tag(c, MX + z.bx, MY + z.by - 6, '打卡機', RED);
}
function tag(c, x, y, s, col) { font(15, 900); const w = c.measureText(s).width + 14; c.fillStyle = '#1a0f08'; c.fillRect(x - w / 2 - 2, y - 13, w + 4, 24); c.fillStyle = col; c.fillRect(x - w / 2, y - 11, w, 20); text(s, x, y + 4, { px: 15, align: 'center', col: CREAM, w: 900 }); }
function drawPad(c, x, y, o = {}) {
  if (IMG.map) { if (o.ring) { c.strokeStyle = o.ring; c.lineWidth = 3; c.setLineDash(o.dash ? [6, 5] : []); c.strokeRect(x - 34, y - 32, 68, 62); c.setLineDash([]); } return; }      // 新地圖已經畫好工位，只畫選取框
  if (IMG.pad) { const m = IMG.padMeta || { foot: [IMG.pad.width / 2, IMG.pad.height / 2] }, k = m.scale || 1; c.drawImage(IMG.pad, Math.round(x - m.foot[0] * k), Math.round(y - m.foot[1] * k), IMG.pad.width * k, IMG.pad.height * k); }
  else { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x - 31, y - 9, 66, 22); c.fillStyle = pats().WOOD; c.fillRect(x - 33, y - 13, 66, 22); c.fillStyle = 'rgba(230,220,194,.85)'; c.fillRect(x - 27, y - 9, 54, 12); c.strokeStyle = '#24130b'; c.lineWidth = 2; c.strokeRect(x - 33, y - 13, 66, 22); stud(x - 28, y + 4); stud(x + 28, y + 4); }
  if (o.ring) { c.strokeStyle = o.ring; c.lineWidth = 3; c.setLineDash(o.dash ? [6, 5] : []); c.strokeRect(x - 37, y - 17, 74, 30); c.setLineDash([]); }
}

// ---------- 世界 ----------
export function drawWorld(c, G, dt) {
  const s = G.s, t = G.t; VIEW.zones = []; talkCd -= dt;
  c.fillStyle = '#140d08'; c.fillRect(0, 0, W, H);
  c.save(); if (VIEW.shake > 0) { VIEW.shake -= dt; c.translate((Math.random() - .5) * 6, (Math.random() - .5) * 4); }
  c.save(); c.beginPath(); c.rect(MX, MY, MW, MH); c.clip();
  drawMap(c, s);
  // 射程（選中時）
  const sel = G.sel >= 0 ? s.slots[G.sel] : null;
  if (sel && sel.tw) { const Dt = T()[sel.tw.id]; if (Dt && Dt.range) { c.fillStyle = 'rgba(242,201,76,.1)'; c.strokeStyle = 'rgba(242,201,76,.6)'; c.lineWidth = 2; c.beginPath(); c.ellipse(MX + sel.x, MY + sel.y, Dt.range * (1 + .06 * (sel.tw.lv - 1)), Dt.range * (1 + .06 * (sel.tw.lv - 1)) / 1.25, 0, 0, 7); c.fill(); c.stroke(); } }
  // 工位
  const pulse = .5 + .5 * Math.sin(t * 6);
  s.slots.forEach((sl, i) => {
    let ring = null, dash = false;
    if (G.sel === i) ring = GOLD;
    else if (G.sel >= 0 && C.canMerge(s, G.sel, i)) ring = `rgba(242,201,76,${.4 + .6 * pulse})`;
    else if ((G.sel >= 0 || s.pending) && !sl.tw) { ring = 'rgba(159,214,196,.7)'; dash = true; }
    else if (s.pending && sl.tw && sl.tw.id === s.pending.id && sl.tw.lv === (s.pending.lv || 1)) ring = `rgba(242,201,76,${.4 + .6 * pulse})`;
    drawPad(c, MX + sl.x, MY + sl.y, { ring, dash });
  });
  // 同事＋敵人依 y 排序
  const ents = [];
  s.slots.forEach((sl, i) => { if (sl.tw && !(G.drag && G.drag.from === i)) ents.push({ y: sl.y, f: () => drawTower(c, s, sl, t, dt) }); });
  for (const f of s.foes) ents.push({ y: f.y, f: () => drawFoe(c, f, MX + f.x, MY + f.y, t) });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
  // 特效
  drawFx(c, dt);
  if (VIEW.flash > 0) { VIEW.flash -= dt; c.fillStyle = `rgba(178,58,48,${VIEW.flash * .5})`; c.fillRect(MX, MY, MW, MH); }
  drawBanner(c, dt);
  c.restore();
  // 拖曳中的人
  if (G.drag) { const tw = s.slots[G.drag.from].tw; if (tw) drawHero(c, tw.id, G.drag.x, G.drag.y + 24, { t, alpha: .85, sc: 1.1 }); }
  c.restore();
}
function drawTower(c, s, sl, t, dt) {
  const tw = sl.tw, v = VIEW.tw[tw.uid] || (VIEW.tw[tw.uid] = { dir: 'down', flip: false }), x = MX + sl.x, y = MY + sl.y;
  if (v.acting) { v.actT += dt; if (v.actT > .5) { v.acting = false; } }
  if (!v.acting && v.actT > 2.5 && v.dir !== 'down') v.dir = 'down'; else if (!v.acting) v.actT = (v.actT || 0) + dt;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y, 16, 5, 0, 0, 7); c.fill();
  if (tw.super > 0) { c.fillStyle = `rgba(255,214,90,${.25 + .15 * Math.sin(t * 12)})`; c.beginPath(); c.ellipse(x, y - 28, 26, 38, 0, 0, 7); c.fill(); }
  drawHero(c, tw.id, x, y, { v, t: t + tw.uid * .37 });
  // 職級牌
  if (tw.lv > 1 || true) { const s2 = ROMAN[tw.lv]; font(13, 900, SERIF); const w = Math.max(18, c.measureText(s2).width + 8); c.fillStyle = '#3a240e'; c.fillRect(x - w / 2 - 1, y + 4, w + 2, 15); c.fillStyle = tw.lv >= 3 ? GOLD : tw.lv === 2 ? '#d9c7a0' : '#a88a5a'; c.fillRect(x - w / 2, y + 5, w, 13); text(s2, x, y + 16, { px: 13, align: 'center', col: '#2b1f18', fam: SERIF, w: 900 }); }
  if (tw.fatigue > 0) for (let k = 0; k < tw.fatigue; k++) { c.fillStyle = '#6b5b9a'; c.fillRect(x + 14 + k * 6, y - 62, 4, 8); }
}
function drawFx(c, dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const e = FX[i]; e.t += dt; const k = e.t / e.life; if (k >= 1) { FX.splice(i, 1); continue; }
    if (e.k === 'shot') {
      const col = (ELEM[e.elem] || ELEM.slash)[1], x0 = MX + e.x0, y0 = MY + e.y0, x1 = MX + e.x, y1 = MY + e.y, fly = Math.min(1, k * 2.4), hx = x0 + (x1 - x0) * fly, hy = y0 + (y1 - y0) * fly;
      if (e.kind === 'line' && e.x2 != null) { c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(MX + e.x2, MY + e.y2); c.stroke(); c.globalAlpha = 1; continue; }
      if (e.elem === 'slash' && fly >= 1) { c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.beginPath(); c.arc(x1, y1, 16, -2.2 + k * 2, -.4 + k * 2); c.stroke(); c.globalAlpha = 1; }
      else if (e.elem === 'holy' && fly >= 1) { c.fillStyle = col; c.globalAlpha = (1 - k) * .8; c.fillRect(x1 - 4, y1 - 90, 8, 96); c.globalAlpha = 1; }
      else if (fly < 1) { c.fillStyle = '#1a0f08'; c.fillRect(hx - 4, hy - 4, 9, 9); c.fillStyle = col; c.fillRect(hx - 3, hy - 3, 7, 7); c.fillStyle = '#fff'; c.fillRect(hx - 1, hy - 2, 2, 2); }
      if (fly >= 1 && (e.r || e.elem === 'blunt')) { const r = (e.r || 22) * Math.min(1, (k - .4) * 2.5 + .2); c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.beginPath(); c.ellipse(x1, y1 + 14, r, r / 1.25, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
    } else if (e.k === 'num') {
      const y = MY + e.y - k * 26; c.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
      text(String(e.v), MX + e.x, y, { px: e.weak ? 19 : 15, align: 'center', col: e.col || (e.weak ? GOLD : '#fff4e0'), stroke: '#1a0f08', sw: 4, w: 900 }); c.globalAlpha = 1;
    } else if (e.k === 'paper') {
      e.vy += 260 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.vr * dt;
      c.save(); c.globalAlpha = 1 - k; c.translate(MX + e.x, MY + e.y); c.rotate(e.rot); c.fillStyle = '#efe6cf'; c.fillRect(-5, -4, 10, 8); c.fillStyle = 'rgba(63,127,114,.5)'; c.fillRect(-3, -1, 6, 1); c.restore(); c.globalAlpha = 1;
    } else if (e.k === 'pop') {
      const sl = window.__game.s.slots[e.slot]; if (!sl) continue; c.strokeStyle = `rgba(242,201,76,${1 - k})`; c.lineWidth = 4; const r = 10 + k * 40; c.beginPath(); c.ellipse(MX + sl.x, MY + sl.y - 20, r, r * .8, 0, 0, 7); c.stroke();
    } else if (e.k === 'merge') {
      const sl = window.__game.s.slots[e.slot]; if (!sl) continue; const x = MX + sl.x, y = MY + sl.y - 72;
      for (let j = 0; j < 8; j++) { const a = j / 8 * 6.28 + k * 3, r = 20 + k * 30; c.fillStyle = `rgba(242,201,76,${1 - k})`; c.fillRect(x + Math.cos(a) * r - 2, MY + sl.y - 26 + Math.sin(a) * r * .6 - 2, 5, 5); }
      if (k > .15) stamp(`職級 ${ROMAN[e.lv]}`, x, y, { px: 16, a: Math.min(1, (1 - k) * 3), rot: -.12 });
    }
  }
}
function drawBanner(c, dt) {
  const b = VIEW.banner; if (!b) return; b.t += dt; if (b.t > 2.6) { VIEW.banner = null; return; }
  const k = b.t < .25 ? b.t / .25 : b.t > 2.2 ? (2.6 - b.t) / .4 : 1, y = 62, w = 420, x = 256 - (1 - k) * 700;
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x + 4, y + 5, w, 50); c.fillStyle = b.boss ? '#5a1712' : pats().WOOD_D; c.fillRect(x, y, w, 50); c.fillStyle = b.boss ? RED : BRASS; c.fillRect(x, y, 6, 50);
  text(b.s, x + 22, y + 34, { px: 26, col: CREAM, fam: SERIF, w: 900 }); font(26, 900, SERIF); const tw = c.measureText(b.s).width;
  text(b.sub || '', x + 38 + tw, y + 32, { px: 17, col: b.boss ? '#ffd0c4' : '#d9c7a0', w: 700 });
}

// ---------- 介面 ----------
export function drawHud(c, G, dt) {
  const s = G.s, t = G.t;
  // 左上：今日議程（波次、下班底氣）
  paper(8, 6, 236, 74, { clip: true });
  text(`第 ${Math.max(1, s.wave)} 波`, 22, 44, { px: 28, fam: SERIF, w: 900 }); text(`／${D.WAVES.length}`, 122, 44, { px: 15, col: INK2, w: 700 });
  const next = s.wave < D.WAVES.length && s.wave > 0 ? Math.ceil(Math.max(0, s.waveT)) : 0;
  if (next) text(`下一波 ${next} 秒`, 232, 40, { px: 13, align: 'right', col: INK2, w: 700 });
  const low = s.lives <= s.livesMax * .3;
  text('下班底氣', 22, 68, { px: 14, col: INK2, w: 900 }); bar(88, 58, 104, 11, s.lives / s.livesMax, low ? '#d24a3a' : '#c8554a'); text(`${s.lives}`, 232, 70, { px: 17, align: 'right', col: low ? RED : INK, w: 900 });
  // 左邊：Vivi 視訊
  const vx = 8, vy = 90, vw = 176, vh = 196;
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(vx + 3, vy + 5, vw, vh); c.fillStyle = pats().WOOD_D; c.fillRect(vx, vy, vw, vh); c.strokeStyle = '#1a0f08'; c.lineWidth = 2; c.strokeRect(vx + 1, vy + 1, vw - 2, vh - 2);
  c.fillStyle = '#3b2d4a'; c.fillRect(vx + 6, vy + 24, vw - 12, 116);
  c.fillStyle = Math.floor(t * 2) % 2 ? '#c8554a' : '#7a2a22'; c.fillRect(vx + 10, vy + 9, 8, 8); text('視訊會議　Vivi', vx + 24, vy + 18, { px: 13, col: '#d9c7a0', w: 700 });
  const bv = IMG.bust_vivi; if (bv) { c.save(); c.beginPath(); c.rect(vx + 6, vy + 24, vw - 12, 116); c.clip(); const k = 230 / bv.height, talk = VIEW.talk && VIEW.talk.t < 2.5; c.drawImage(bv, vx + vw / 2 - bv.width * k / 2, vy + 20 + (talk ? Math.sin(t * 18) * .8 : 0), bv.width * k, bv.height * k); c.restore(); }
  c.fillStyle = 'rgba(255,255,255,.05)'; for (let yy = vy + 24; yy < vy + 140; yy += 3) c.fillRect(vx + 6, yy, vw - 12, 1);
  c.fillStyle = pats().PAPER; c.fillRect(vx + 6, vy + 144, vw - 12, vh - 150);
  if (VIEW.talk) { VIEW.talk.t += dt; wrap(c, VIEW.talk.s.slice(0, Math.floor(VIEW.talk.t * 24)), vx + 12, vy + 162, vw - 24, 18, { px: 14 }); }
  // 左邊：下一波敵情
  const NW = D.WAVES[s.wave];
  if (NW) { const kinds = []; NW.groups.forEach(g => { const o = kinds.find(z => z.k === g.kind); o ? o.n += g.n : kinds.push({ k: g.kind, n: g.n }); });
    const ky = 296, kh = 30 + Math.min(3, kinds.length) * 32; paper(8, ky, 176, kh, { old: true });
    text('下一波敵情', 18, ky + 20, { px: 13, col: INK2, w: 900 }); if (NW.boss) stamp('主管', 150, ky + 16, { px: 12 });
    kinds.slice(0, 3).forEach((o, j) => { const y = ky + 46 + j * 32, im = IMG['foe_' + o.k]; if (im) { const k = 26 / im.height; c.save(); c.translate(30, y + 6); c.scale(-1, 1); c.drawImage(im, -im.width * k / 2, -26, im.width * k, 26); c.restore(); }
      text(F()[o.k]?.name || o.k, 48, y - 2, { px: 14, w: 900 }); text(`×${o.n}`, 176, y - 2, { px: 14, align: 'right', col: INK2, w: 900 });
      const wk = F()[o.k]?.weak?.[0]; if (wk) text(`弱${ELEM[wk][0]}`, 48, y + 13, { px: 11, col: TEAL, w: 900 }); }); }
  // 上緣：資源（木牌）＋右上按鈕
  const rx0 = 256; wood(rx0, 8, 420, 46);
  const resK = Math.min(1, s.res / Math.max(1, s.sumCost));
  text('人力額度', rx0 + 14, 37, { px: 14, col: '#d9c7a0', w: 700 }); text(String(Math.floor(s.res)), rx0 + 86, 40, { px: 25, col: resK >= 1 ? GOLD : CREAM, w: 900, stroke: '#1a0f08', sw: 3 });
  text('部門預算', rx0 + 166, 37, { px: 14, col: '#d9c7a0', w: 700 }); text(String(s.coin ?? 0), rx0 + 238, 40, { px: 21, col: CREAM, w: 900 });
  text('擊倒', rx0 + 300, 37, { px: 14, col: '#d9c7a0', w: 700 }); text(String(s.kills), rx0 + 340, 40, { px: 21, col: CREAM, w: 900 });
  const boss = s.foes.find(f => f.boss);
  if (boss) { const bx0 = 690; wood(bx0, 8, 300, 46); text(F()[boss.kind]?.name || '', bx0 + 12, 30, { px: 14, col: '#ffd0c4', fam: SERIF, w: 900 }); bar(bx0 + 12, 37, 276, 9, boss.hp / boss.max, '#c8554a'); if (boss.guard) stamp('減傷', bx0 + 262, 24, { px: 12, col: '#e8e4d8' }); if (boss.broken) stamp('理虧', bx0 + 262, 24, { px: 12 }); }
  const bx = W - 258; for (const [i, k, lab] of [[0, 'speed', `×${G.speed}`], [1, 'pause', G.paused ? '繼續' : '暫停'], [2, 'mute', G.mute ? '靜音' : '聲音']]) { button(bx + i * 84, 8, 78, 46, lab, { px: 18, down: VIEW.down === k }); zone(bx + i * 84, 4, 78, 54, k); }
  // 底部指令列
  const by = 490, can = C.canSummon(s);
  button(200, by, 160, 92, '緊急調派', { sub: `人力 ${s.sumCost}`, hot: can, off: !can, px: 26, down: VIEW.down === 'summon' }); zone(200, by, 160, 92, 'summon');
  // 報到中
  paper(370, by, 108, 92, { old: !s.pending });
  text('報到中', 424, by + 18, { px: 13, align: 'center', col: INK2, w: 900 });
  if (s.pending) { c.save(); c.beginPath(); c.rect(374, by + 22, 100, 66); c.clip(); drawHero(c, s.pending.id, 424, by + 86, { t, sc: 1 }); c.restore(); text(T()[s.pending.id]?.name || '', 424, by + 86, { px: 14, align: 'center', w: 900, stroke: CREAM, sw: 3 }); if (C.discard) { button(374, by - 40, 100, 36, '轉派', { px: 16 }); zone(374, by - 40, 100, 36, 'discard'); } }
  else text('—', 424, by + 62, { px: 22, align: 'center', col: '#8a7d66' });
  // 選中同事的議程紙
  const ix = 488, iw = 400; paper(ix, by, iw, 92, { lines: true });
  const sel = G.sel >= 0 && s.slots[G.sel] && s.slots[G.sel].tw;
  if (sel) {
    const Dt = T()[sel.id] || {}, el = ELEM[Dt.elem] || ['', '#999'];
    text(`${Dt.name || sel.id}`, ix + 14, by + 30, { px: 22, fam: SERIF, w: 900 }); font(22, 900, SERIF); const nw = c.measureText(Dt.name || '').width;
    text(`${Dt.job || ''}　職級 ${ROMAN[sel.lv]}`, ix + 22 + nw, by + 29, { px: 14, col: INK2, w: 700 });
    c.fillStyle = el[1]; c.fillRect(ix + iw - 44, by + 10, 30, 22); text(el[0], ix + iw - 29, by + 27, { px: 16, align: 'center', col: '#1a0f08', w: 900 });
    text(Dt.note || KIND_NOTE[Dt.kind] || '', ix + 14, by + 56, { px: 14, col: INK, w: 700 });
    text(Dt.dmg ? `傷害 ${Math.round(Dt.dmg * C.lvK(sel.lv))}　每 ${Dt.rate} 秒　射程 ${Dt.range}` : '', ix + 14, by + 80, { px: 13, col: INK2, w: 700 });
    button(ix + iw - 92, by + 44, 82, 42, '轉派', { px: 16 }); zone(ix + iw - 92, by + 44, 82, 42, 'sell');
  } else {
    text(s.pending ? '點一個空工位讓他上工' : '點同事看資料', ix + 14, by + 32, { px: 18, w: 900 });
    text('同名、同職級的兩位拖到一起＝職級核定（升級）', ix + 14, by + 58, { px: 14, col: INK2, w: 700 });
    text('點空地取消選取', ix + 14, by + 80, { px: 13, col: '#8a7d66', w: 700 });
  }
  // 氣勢與主動技
  const rx = 898, rw = W - rx - 8; paper(rx, by, rw, 92, { old: true });
  text('氣勢', rx + 12, by + 22, { px: 14, col: INK2, w: 900 }); bar(rx + 52, by + 11, rw - 66, 12, (s.momentum || 0) / 100, GOLD, { ticks: [.6] });
  const UN = D.UNITES || [], bw = (rw - 30) / 3;
  if (UN.length && C.useUnite) UN.slice(0, 2).forEach((u, j) => { const ok = C.canUnite ? C.canUnite(s, u.key) : (s.momentum >= (u.cost || 60)); button(rx + 8 + j * (bw + 6), by + 34, bw, 52, u.name, { px: 13, off: !ok, hot: ok, sub: (u.who || []).map(w => T()[w]?.name).join('＋') }); zone(rx + 8 + j * (bw + 6), by + 34, bw, 52, 'unite:' + u.key); });
  else text('合體技（規則接好後開放）', rx + 12, by + 62, { px: 13, col: '#8a7d66', w: 700 });
  if (C.useSuper) { const ok = (s.momentum || 0) >= 100 && G.sel >= 0; button(rx + rw - bw - 8, by + 34, bw, 52, '超級化', { px: 15, off: !ok, hot: ok, sub: G.sel >= 0 ? '' : '先選人' }); zone(rx + rw - bw - 8, by + 34, bw, 52, 'super'); }
  if (G.paused) { c.fillStyle = 'rgba(20,13,8,.55)'; c.fillRect(0, 60, W, 425); stamp('暫停中', W / 2, 420, { px: 30, col: CREAM }); }
  G.zones = VIEW.zones;
}
function wrap(c, s, x, y, w, lh, o) { font(o.px, 700); let line = '', yy = y; for (const ch of s) { if (c.measureText(line + ch).width > w) { text(line, x, yy, o); line = ch; yy += lh; } else line += ch; } if (line) text(line, x, yy, o); }

// ---------- 標題 ----------
export function drawTitle(c, G, dt) {
  const t = G.t; VIEW.zones = []; const P = pats();
  c.fillStyle = P.WOOD_D; c.fillRect(0, 0, W, H);
  if (IMG.map) { c.globalAlpha = .55; c.drawImage(IMG.map, 0, 0, W, H); c.globalAlpha = 1; }
  paper(80, 60, 560, 300, { clip: true, tilt: -.015 });
  text('上班旅人外傳', 120, 140, { px: 30, col: INK2, fam: SERIF, w: 900 });
  text('準時下班防衛戰', 116, 210, { px: 60, fam: SERIF, w: 900 });
  text('敵人走到打卡機，就扣「下班底氣」。', 122, 262, { px: 20, w: 700 });
  text('緊急調派同事上工，同名同職級拖在一起就升職。', 122, 292, { px: 20, w: 700 });
  stamp('今日必須準時', 520, 320, { px: 20 });
  const team = D.DEFAULT_TEAM || ['kui', 'jie', 'kevin', 'yan', 'zhe', 'mi'];
  paper(80, 392, 560, 150, { old: true });
  text('今日出勤', 100, 420, { px: 16, col: INK2, fam: SERIF, w: 900 });
  team.forEach((id, i) => { const x = 130 + i * 88; drawHero(c, id, x, 520, { t: t + i * .3, v: { dir: 'down' } }); text(T()[id]?.name || id, x, 538, { px: 14, align: 'center', w: 900 }); });
  const bv = IMG.bust_vivi; if (bv) { const k = 520 / bv.height; c.drawImage(bv, 760, 70 + Math.sin(t) * 3, bv.width * k, bv.height * k); }
  button(880, 470, 300, 84, '開始上班', { px: 32, hot: true, fam: SERIF, down: VIEW.down === 'start' }); zone(880, 470, 300, 84, 'start');
  G.zones = VIEW.zones;
}

// ---------- 結案報告 ----------
export function drawResult(c, G, dt) {
  const r = G.result; VIEW.zones = [];
  c.fillStyle = 'rgba(20,13,8,.6)'; c.fillRect(0, 0, W, H);
  paper(390, 70, 500, 420, { clip: true, lines: true });
  text('結案報告', 640, 130, { px: 34, align: 'center', fam: SERIF, w: 900 });
  stamp(r.win ? '準時下班' : '留下加班', 640, 200, { px: 40, col: r.win ? TEAL : RED, rot: -.1 });
  const rows = [['撐到', `第 ${r.wave} 波／${D.WAVES.length}`], ['擊倒', `${r.kills}`], ['剩下底氣', `${r.lives}`], ['上班時間', `${Math.floor(r.t / 60)} 分 ${Math.floor(r.t % 60)} 秒`]];
  rows.forEach(([a, b], i) => { text(a, 450, 280 + i * 36, { px: 20, col: INK2, w: 700 }); text(b, 830, 280 + i * 36, { px: 22, align: 'right', w: 900 }); });
  button(430, 420, 200, 56, '再來一局', { px: 22, hot: true, down: VIEW.down === 'again' }); zone(430, 420, 200, 56, 'again');
  button(650, 420, 200, 56, '回到標題', { px: 22, down: VIEW.down === 'title' }); zone(650, 420, 200, 56, 'title');
  G.zones = VIEW.zones;
}
