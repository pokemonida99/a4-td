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
  low: ['底氣快見底了，給我撐住。'], charge: ['總經理在攤客訴長卷！快打斷他！'], win: ['……做得不錯。今天准你們準時下班。'], lose: ['全員留下加班。明天早會檢討。'],
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
    } else if (e.k === 'dmg') { const near = FX.filter(q => q.k === 'num' && q.t < .25 && Math.abs(q.x - e.x) < 26 && Math.abs((q.y0 ?? -999) - e.y) < 20).length; FX.push({ k: 'num', x: e.x + (Math.random() * 20 - 10), y: e.y - 44 - near * 14, y0: e.y, v: e.v, weak: e.weak, t: 0, life: .7 }); }
    else if (e.k === 'die') { for (let i = 0; i < (e.boss ? 26 : 7); i++) FX.push({ k: 'paper', x: e.x, y: e.y - 20, vx: (Math.random() - .5) * 160, vy: -60 - Math.random() * 120, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, t: 0, life: .9 + Math.random() * .4 }); if (e.boss) { sfx('boss_down', .8); VIEW.shake = .5; VIEW.bossKind = null; } else sfx('coin', .25, 1.2); }
    else if (e.k === 'leak') { VIEW.flash = .5; VIEW.shake = .25; sfx('defeat', .35, 1.4); say('leak'); if (s.lives <= s.livesMax * .3) say('low', true); }
    else if (e.k === 'summon') { FX.push({ k: 'pop', slot: e.slot, t: 0, life: .5 }); sfx('confirm', .5); }
    else if (e.k === 'pending') { VIEW.pendT = 0; }
    else if (e.k === 'clear') { FX.push({ k: 'ico', ic: 'coin', x: 640, y: 440, v: `+${e.coin}`, t: 0, life: 1.6, big: true }); sfx('coin', .7); }
    else if (e.k === 'unite') { FX.push({ k: 'unite', key: e.key, x: e.x, y: e.y, x2: e.x2, y2: e.y2, r: e.r || 150, t: 0, life: 1.2 }); VIEW.cut = { key: e.key, t: 0 }; VIEW.shake = .45; sfx('unite', .9); }
    else if (e.k === 'super') { FX.push({ k: 'merge', slot: e.slot, lv: 0, label: '超級化', t: 0, life: 1.2 }); sfx('buff', .9); }
    else if (e.k === 'stun' || e.k === 'freeze') FX.push({ k: 'ring', x: e.x, y: e.y, col: e.k === 'freeze' ? '#7fd4f0' : '#f2dc96', t: 0, life: .5 });
    else if (e.k === 'fatigue') { const sl = s.slots[e.slot]; if (sl) FX.push({ k: 'ico', ic: 'fatigue', x: sl.x, y: sl.y - 80, t: 0, life: .9 }); }
    else if (e.k === 'cleanse') { (e.to || [e.slot]).forEach(i => { const sl = s.slots[i]; if (sl) FX.push({ k: 'ring', x: sl.x, y: sl.y - 20, col: '#ffe27a', t: 0, life: .6 }); }); sfx('heal', .35); }
    else if (e.k === 'buff') { const sl = s.slots[e.to ?? e.slot]; if (sl) FX.push({ k: 'ico', ic: { haste: 'aspd', star: 'super', potion: 'el_ice', dance: 'aspd' }[e.kind] || 'aspd', x: sl.x, y: sl.y - 84, t: 0, life: .9 }); }
    else if (e.k === 'shield') { const sl = s.slots[e.slot]; if (sl) FX.push({ k: 'ring', x: sl.x, y: sl.y - 24, col: '#cfe8ff', t: 0, life: .5 }); sfx('shield_up', .4); }
    else if (e.k === 'throw') { const sl = s.slots[e.slot]; if (sl) { FX.push({ k: 'ring', x: sl.x, y: sl.y - 10, col: '#d24a3a', t: 0, life: .7 }); VIEW.shake = .2; } sfx('wok_back', .6); }
    else if (e.k === 'guard') sfx('shield_block', .6);
    else if (e.k === 'broken') { sfx('break', .8); FX.push({ k: 'ico', x: (s.foes.find(f => f.uid === e.uid) || {}).x || 640, y: ((s.foes.find(f => f.uid === e.uid) || {}).y || 300) - 100, v: '!!', ic: 'guard', col: '#ff9a8a', t: 0, life: 1.2, big: true, k2: 'ico' }); }
    else if (e.k === 'charge') { sfx('boss_charge', .7); say('charge'); }
    else if (e.k === 'interrupt') { sfx('break', .9); FX.push({ k: 'ico', x: (s.foes.find(f => f.uid === e.uid) || {}).x || 640, y: ((s.foes.find(f => f.uid === e.uid) || {}).y || 300) - 110, v: '✕', ic: 'charge', col: GOLD, t: 0, life: 1.2, big: true, k2: 'ico' }); }
    else if (e.k === 'complain') { VIEW.flash = .6; VIEW.shake = .4; sfx('paper_storm', .8); say('leak', true); }
    else if (e.k === 'down') FX.push({ k: 'ico', ic: 'ko', x: e.x, y: e.y - 50, t: 0, life: .8 });
    else if (e.k === 'revive') { FX.push({ k: 'ico', ic: 'life', x: e.x, y: e.y - 50, t: 0, life: .9 }); }
    else if (e.k === 'merge') { FX.push({ k: 'merge', slot: e.slot, lv: e.lv, t: 0, life: 1.1 }); sfx('train', .7); say('merge'); }
    else if (e.k === 'move') sfx('cursor', .5);
    else if (e.k === 'wave') { VIEW.banner = { n: e.n, boss: e.boss, t: 0 }; sfx(e.boss ? 'boss_appear' : 'encounter', .6); if (!e.boss) say('wave'); }
    else if (e.k === 'boss') { VIEW.bossKind = e.kind; say('boss_' + e.kind) ; if (!LINES['boss_' + e.kind]) say('boss'); bgm('boss'); }
    else if (e.k === 'gen') FX.push({ k: 'ico', ic: 'res', x: s.slots[e.slot].x, y: s.slots[e.slot].y - 80, v: '+' + Math.round(e.v), t: 0, life: .9 });
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
const ATK_MS = [80, 80, 80, 50, 50, 70, 80, 110];      // 出手 8 格的節奏（美術 session 建議；命中在第 5 格）
function drawHero(c, id, x, y, o = {}) {
  const v = o.v || {}, t = o.t || 0;
  if (Q[id]) {
    const q = Q[id], ms = q.atkMs || ATK_MS, tot = ms.reduce((a, b) => a + b, 0) / 1000, acting = v.acting && v.actT < tot;
    let fr; if (acting) { let acc = 0, i = 0; const now = v.actT * 1000; for (; i < ms.length - 1; i++) { acc += ms[i]; if (now < acc) break; } fr = (i + .5) / ms.length; }
    else fr = (t * (q.frames.idle > 1 ? .9 : 0)) % 1;      // 待機 4 格約 1.1 秒一輪
    return drawQ(c, id, acting ? 'atk' : 'idle', v.dir || 'down', v.flip, fr, x, y, o.sc || 1, o.alpha ?? 1);
  }
  const im = IMG[`${id}_ready`]; if (!im) return;
  const acting = v.acting && v.actT < .3, k = .5 * (o.sc || 1), lunge = acting ? Math.sin(v.actT / .3 * Math.PI) * 6 : 0, sq = acting ? 1 + Math.sin(v.actT / .3 * Math.PI) * .06 : 1 + Math.sin(t * 3) * .015;
  c.save(); c.globalAlpha = o.alpha ?? 1; c.translate(Math.round(x + (v.flip ? -lunge : lunge)), Math.round(y)); if (v.flip) c.scale(-1, 1); c.scale(1 / sq * 1, sq);
  c.drawImage(im, Math.round(-im.width * k / 2), Math.round(-im.height * k), Math.round(im.width * k), Math.round(im.height * k)); c.restore();
}
const FOE_H = { minion: 46, courier: 44, knight: 52, intern: 44, auntie: 46, smoker: 46, chief: 78, boss: 96, parrot: 80, monkey: 70, pig: 84, audit: 80 };
function drawFoe(c, f, x, y, t) {
  const v = VIEW.foe[f.uid] || (VIEW.foe[f.uid] = { px: f.x, py: f.y, dir: 'side', flip: false });
  const dx = f.x - v.px, dy = f.y - v.py; if (Math.abs(dx) + Math.abs(dy) > .3) { v.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : 'side'; v.flip = dx < 0; } v.px = f.x; v.py = f.y;
  const ph = (t * 1.8 + (f.ph || f.uid * .37)) % 1; if (f.down > 0) c.globalAlpha = .45;
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y, f.boss ? 30 : 15, f.boss ? 8 : 5, 0, 0, 7); c.fill();
  if (!drawQ(c, 'foe_' + f.kind, f.hitT > 0 && Q['foe_' + f.kind]?.strips['hit_' + v.dir] ? 'hit' : 'walk', v.dir, v.flip, ph, x, y)) {
    const im = (f.hitT > 0 && IMG[`foe_${f.kind}_hit`]) || IMG[`foe_${f.kind}`]; if (!im) { c.fillStyle = RED; c.fillRect(x - 10, y - 30, 20, 30); }
    else { const h = FOE_H[f.kind] || 48, k = h / im.height, bob = Math.abs(Math.sin(ph * Math.PI * 2)) * (f.boss ? 2 : 3);
      c.save(); c.translate(Math.round(x), Math.round(y - bob)); if (v.flip === false && v.dir === 'side') c.scale(-1, 1);      // RPG 的敵人圖面向左；往右走時翻過來
      c.drawImage(im, Math.round(-im.width * k / 2), Math.round(-im.height * k), Math.round(im.width * k), Math.round(im.height * k)); c.restore(); }
  }
  c.globalAlpha = 1; const h = (FOE_H[f.kind] || 48);
  if (f.hitT > 0) { c.globalAlpha = f.hitT / .15 * .5; c.fillStyle = '#fff'; c.fillRect(x - 12, y - h * .8, 24, h * .6); c.globalAlpha = 1; }
  if (f.slow > 0) { c.fillStyle = 'rgba(127,212,240,.85)'; c.fillRect(x - 13, y - 3, 4, 4); c.fillRect(x + 9, y - 5, 4, 4); }
  if (f.burnT > 0 && Math.floor(t * 10) % 2) { c.fillStyle = '#ff7a2e'; c.fillRect(x - 4 + Math.sin(t * 9) * 6, y - h * .6, 4, 6); }
  if (f.down > 0) { text('倒地', x, y - 20, { px: 12, align: 'center', col: '#d9c7a0', stroke: '#1a0f08', sw: 3 }); }
  if (f.boss) { if (f.guard) icon(c, 'guard', x, y - h - 16, 34); else if (f.broken) { for (let j = 0; j < 3; j++) { const a = t * 5 + j * 2.1; text('★', x + Math.cos(a) * 18, y - h - 8 + Math.sin(a) * 5, { px: 14, col: GOLD, stroke: '#1a0f08', sw: 3, align: 'center' }); } } if (f.charge > 0) { icon(c, 'charge', x - 48, y - h - 30, 26); bar(x - 32, y - h - 34, 72, 8, f.charge, '#ff7a2e'); } }
  if (!f.boss && f.hp < f.max) { const bw = 30; bar(x - bw / 2, y - h - 8, bw, 4, f.hp / f.max, '#d24a3a'); }
  const wk = F()[f.kind]?.weak; if (wk && wk[0] && !f.boss) icon(c, ELK[wk[0]], x + 20, y - h - 6, 20, (ELEM[wk[0]] || [''])[0]);
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
  const g = s.map.gate || [a.ax, a.ay], k = s.map.clock || [z.bx, z.by]; tag(c, MX + g[0], MY + g[1] + 10, '電梯口', TEAL); tag(c, MX + k[0], MY + k[1] - 6, '打卡機', RED);
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
  if (sel && sel.tw) { const Dt = T()[sel.tw.id], rr = C.rangeOf ? C.rangeOf(sel.tw) : Dt.range; if (Dt && rr) { c.fillStyle = 'rgba(242,201,76,.1)'; c.strokeStyle = 'rgba(242,201,76,.6)'; c.lineWidth = 2; c.beginPath(); c.ellipse(MX + sel.x, MY + sel.y, rr, rr / 1.25, 0, 0, 7); c.fill(); c.stroke(); } }
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
  for (const m of s.mice || []) ents.push({ y: m.y, f: () => { const im = IMG.mouse; c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(MX + m.x, MY + m.y, 9, 3, 0, 0, 7); c.fill(); if (im) { const k = 26 / im.height; c.drawImage(im, MX + m.x - im.width * k / 2, MY + m.y - 26 - Math.abs(Math.sin(t * 20 + m.uid)) * 3, im.width * k, 26); } else { c.fillStyle = '#8a8580'; c.fillRect(MX + m.x - 7, MY + m.y - 9, 14, 9); } } });
  for (const q of s.cones || []) ents.push({ y: q.y, f: () => { const x = MX + q.x, y = MY + q.y; c.fillStyle = '#1a0f08'; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x - 10, y + 2); c.lineTo(x + 10, y + 2); c.closePath(); c.fill(); c.fillStyle = '#ff8a2e'; c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x - 8, y); c.lineTo(x + 8, y); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 5, y - 9, 10, 3); } });
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
  if (v.acting) { v.actT += dt; if (v.actT > .62) { v.acting = false; } }
  if (!v.acting && v.actT > 2.5 && v.dir !== 'down') v.dir = 'down'; else if (!v.acting) v.actT = (v.actT || 0) + dt;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y, 16, 5, 0, 0, 7); c.fill();
  if (tw.super > 0) { c.fillStyle = `rgba(255,214,90,${.25 + .15 * Math.sin(t * 12)})`; c.beginPath(); c.ellipse(x, y - 28, 26, 38, 0, 0, 7); c.fill(); }
  drawHero(c, tw.id, x, y, { v, t: t + tw.uid * .37 });
  // 職級牌
  if (tw.lv > 1 || true) { const s2 = ROMAN[tw.lv]; font(13, 900, SERIF); const w = Math.max(18, c.measureText(s2).width + 8); c.fillStyle = '#3a240e'; c.fillRect(x - w / 2 - 1, y + 4, w + 2, 15); c.fillStyle = tw.lv >= 3 ? GOLD : tw.lv === 2 ? '#d9c7a0' : '#a88a5a'; c.fillRect(x - w / 2, y + 5, w, 13); text(s2, x, y + 16, { px: 13, align: 'center', col: '#2b1f18', fam: SERIF, w: 900 }); }
  if (tw.shield) { const sx = x + 20, sy = y - 66; c.fillStyle = '#1a0f08'; c.fillRect(sx - 6, sy - 7, 12, 13); c.fillStyle = '#cfe8ff'; c.fillRect(sx - 5, sy - 6, 10, 8); c.fillRect(sx - 3, sy + 2, 6, 3); c.fillStyle = '#7fb4e0'; c.fillRect(sx - 1, sy - 5, 2, 8); }      // 專注護盾：頭旁小盾牌
  if (tw.star > 0) text('★', x - 22, y - 62, { px: 16, col: GOLD, stroke: '#1a0f08', sw: 3 });
  if (tw.haste > 0) { c.fillStyle = '#9be0c8'; c.fillRect(x - 26, y - 50, 4, 4); c.fillRect(x - 22, y - 56, 4, 4); }
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
      text(String(e.v), MX + e.x, y, { px: e.big ? 26 : e.weak ? 19 : 15, align: 'center', col: e.col || (e.weak ? GOLD : '#fff4e0'), stroke: '#1a0f08', sw: 4, w: 900 }); c.globalAlpha = 1;
    } else if (e.k === 'ring') {
      const r = 8 + k * 34; c.strokeStyle = e.col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.beginPath(); c.ellipse(MX + e.x, MY + e.y, r, r * .7, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
    } else if (e.k === 'unite') {
      c.globalAlpha = 1 - k;
      if (e.x2 != null) { const g = 30 * (1 - k) + 8; c.strokeStyle = '#ff7a2e'; c.lineWidth = g; c.beginPath(); c.moveTo(MX + e.x, MY + e.y); c.lineTo(MX + e.x2, MY + e.y2); c.stroke(); c.strokeStyle = '#fff4e0'; c.lineWidth = g / 3; c.stroke(); }
      else { const r = e.r * Math.min(1, k * 3); c.fillStyle = 'rgba(127,212,240,.25)'; c.beginPath(); c.ellipse(MX + e.x, MY + e.y, r, r / 1.25, 0, 0, 7); c.fill(); c.strokeStyle = '#b083f0'; c.lineWidth = 5; c.stroke(); }
      c.globalAlpha = 1;
    } else if (e.k === 'ico') {
      const y = MY + e.y - k * 24, s2 = e.big ? 44 : 30; c.globalAlpha = k > .7 ? (1 - k) / .3 : 1; const pop = k < .15 ? .6 + k / .15 * .4 : 1;
      icon(c, e.ic, MX + e.x - (e.v ? s2 * .4 : 0), y, s2 * pop); if (e.v) text(String(e.v), MX + e.x + s2 * .2, y + s2 * .25, { px: e.big ? 26 : 18, col: e.col || CREAM, stroke: '#1a0f08', sw: 4, w: 900 }); c.globalAlpha = 1;
    } else if (e.k === 'paper') {
      e.vy += 260 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.vr * dt;
      c.save(); c.globalAlpha = 1 - k; c.translate(MX + e.x, MY + e.y); c.rotate(e.rot); c.fillStyle = '#efe6cf'; c.fillRect(-5, -4, 10, 8); c.fillStyle = 'rgba(63,127,114,.5)'; c.fillRect(-3, -1, 6, 1); c.restore(); c.globalAlpha = 1;
    } else if (e.k === 'pop') {
      const sl = window.__game.s.slots[e.slot]; if (!sl) continue; c.strokeStyle = `rgba(242,201,76,${1 - k})`; c.lineWidth = 4; const r = 10 + k * 40; c.beginPath(); c.ellipse(MX + sl.x, MY + sl.y - 20, r, r * .8, 0, 0, 7); c.stroke();
    } else if (e.k === 'merge') {
      const sl = window.__game.s.slots[e.slot]; if (!sl) continue; const x = MX + sl.x, y = MY + sl.y - 72;
      for (let j = 0; j < 8; j++) { const a = j / 8 * 6.28 + k * 3, r = 20 + k * 30; c.fillStyle = `rgba(242,201,76,${1 - k})`; c.fillRect(x + Math.cos(a) * r - 2, MY + sl.y - 26 + Math.sin(a) * r * .6 - 2, 5, 5); }
      if (k > .15) stamp(e.label || `職級 ${ROMAN[e.lv]}`, x, y, { px: 16, a: Math.min(1, (1 - k) * 3), rot: -.12 });
    }
  }
}
function drawBanner(c, dt) {
  const b = VIEW.banner; if (!b) return; b.t += dt; if (b.t > 2.6) { VIEW.banner = null; return; }
  const k = b.t < .25 ? b.t / .25 : b.t > 2.2 ? (2.6 - b.t) / .4 : 1, y = 62, w = 380, x = 256 - (1 - k) * 700, s = window.__game.s, Wv = D.WAVES[(b.n || s.wave) - 1];
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x + 4, y + 5, w, 54); c.fillStyle = b.boss ? '#5a1712' : pats().WOOD_D; c.fillRect(x, y, w, 54); c.fillStyle = b.boss ? RED : BRASS; c.fillRect(x, y, 6, 54);
  icon(c, b.boss ? 'charge' : 'wave', x + 34, y + 27, 40, '▶'); num(b.n || s.wave, x + 58, y + 40, 30, { col: GOLD });
  if (Wv) { const ks = [...new Set(Wv.groups.map(g => g.kind))]; ks.slice(0, 5).forEach((kd, i) => { const im = IMG['foe_' + kd]; if (!im) return; const hh = 40, kk = hh / im.height; c.save(); c.translate(x + 140 + i * 48, y + 50); c.scale(-1, 1); c.drawImage(im, -im.width * kk / 2, -hh, im.width * kk, hh); c.restore(); }); }
}

// ---------- 介面 ----------
// 介面圖示：沒有圖時退回一個小字（fb），不會整個空掉
function icon(c, k, x, y, s, fb) {
  const im = IMG['ui_' + k]; if (im) { c.drawImage(im, Math.round(x - s / 2), Math.round(y - s / 2), s, s); return true; }
  if (fb) text(fb, x, y + s * .18, { px: Math.round(s * .45), align: 'center', col: CREAM, stroke: '#1a0f08', sw: 3, w: 900 }); return false;
}
const ELK = { slash: 'el_slash', blunt: 'el_blunt', fire: 'el_fire', ice: 'el_ice', holy: 'el_holy', dark: 'el_dark' };
function head(c, id, x, y, s) {      // 立繪裁成圓形頭像
  const b = IMG['bust_' + id]; c.save(); c.beginPath(); c.arc(x, y, s / 2, 0, 7); c.clip(); c.fillStyle = '#3b2d4a'; c.fillRect(x - s / 2, y - s / 2, s, s);
  if (b) { const k = s * 1.9 / b.width; c.drawImage(b, x - b.width * k / 2, y - s * .62, b.width * k, b.height * k); } c.restore();
  c.strokeStyle = '#1a0f08'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, s / 2, 0, 7); c.stroke(); c.strokeStyle = BRASS; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, s / 2 - 2, 0, 7); c.stroke();
}
const num = (s, x, y, px, o = {}) => text(String(s), x, y, { px, col: o.col ?? CREAM, stroke: '#1a0f08', sw: 4, w: 900, align: o.align ?? 'left' });
export function drawHud(c, G, dt) {
  const s = G.s, t = G.t;
  // 左上：波次＋下班底氣＋提早開波
  wood(8, 6, 236, 76);
  icon(c, 'wave', 32, 30, 34, '波'); num(Math.max(1, s.wave), 54, 42, 28, { col: GOLD }); text(`/${D.WAVES.length}`, 54 + c.measureText(String(Math.max(1, s.wave))).width + 2, 42, { px: 15, col: '#d9c7a0', w: 900 });
  const low = s.lives <= s.livesMax * .3;
  icon(c, 'life', 32, 62, 26, '♥'); bar(50, 56, 130, 12, s.lives / s.livesMax, low ? '#d24a3a' : '#c8554a'); num(s.lives, 190, 68, 17, { col: low ? '#ff8a7a' : CREAM });
  const brk = s.phase ? s.phase === 'break' : s.waveT > 0, next = brk && s.wave < D.WAVES.length ? Math.ceil(Math.max(0, s.waveT)) : 0;
  if (next) { button(150, 12, 88, 40, '', { hot: true, down: VIEW.down === 'call' }); icon(c, 'call', 178, 32 + (VIEW.down === 'call' ? 3 : 0), 30, '▶▶'); num(next, 208, 40, 18, { col: INK }); zone(150, 8, 88, 48, 'call'); }
  // 左邊：Vivi 視訊
  const vx = 8, vy = 90, vw = 176, vh = 196;
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(vx + 3, vy + 5, vw, vh); c.fillStyle = pats().WOOD_D; c.fillRect(vx, vy, vw, vh); c.strokeStyle = '#1a0f08'; c.lineWidth = 2; c.strokeRect(vx + 1, vy + 1, vw - 2, vh - 2);
  c.fillStyle = '#3b2d4a'; c.fillRect(vx + 6, vy + 24, vw - 12, 116);
  c.fillStyle = Math.floor(t * 2) % 2 ? '#c8554a' : '#7a2a22'; c.fillRect(vx + 10, vy + 9, 8, 8); text('Vivi', vx + 24, vy + 18, { px: 14, col: '#d9c7a0', w: 900 });
  const bv = IMG.bust_vivi; if (bv) { c.save(); c.beginPath(); c.rect(vx + 6, vy + 24, vw - 12, 116); c.clip(); const k = 230 / bv.height, talk = VIEW.talk && VIEW.talk.t < 2.5; c.drawImage(bv, vx + vw / 2 - bv.width * k / 2, vy + 20 + (talk ? Math.sin(t * 18) * .8 : 0), bv.width * k, bv.height * k); c.restore(); }
  c.fillStyle = 'rgba(255,255,255,.05)'; for (let yy = vy + 24; yy < vy + 140; yy += 3) c.fillRect(vx + 6, yy, vw - 12, 1);
  c.fillStyle = pats().PAPER; c.fillRect(vx + 6, vy + 144, vw - 12, vh - 150);
  if (VIEW.talk) { VIEW.talk.t += dt; wrap(c, VIEW.talk.s.slice(0, Math.floor(VIEW.talk.t * 24)), vx + 12, vy + 162, vw - 24, 18, { px: 14 }); }
  // 左邊：下一波敵人（頭像＋數量＋弱點）
  const NW = D.WAVES[s.wave];
  if (NW) { const kinds = []; NW.groups.forEach(g => { const o = kinds.find(z => z.k === g.kind); o ? o.n += g.n : kinds.push({ k: g.kind, n: g.n }); });
    const ky = 296, kh = 40 + Math.min(4, kinds.length) * 34; wood(8, ky, 176, kh);
    icon(c, 'wave', 26, ky + 20, 24); num(s.wave + 1, 42, ky + 28, 18, { col: GOLD }); if (NW.boss) icon(c, 'charge', 160, ky + 20, 24);
    kinds.slice(0, 4).forEach((o, j) => { const y = ky + 54 + j * 34, im = IMG['foe_' + o.k];
      c.fillStyle = 'rgba(239,230,207,.12)'; c.fillRect(14, y - 15, 164, 30);
      if (im) { const k = 28 / im.height; c.save(); c.translate(34, y + 13); c.scale(-1, 1); c.drawImage(im, -im.width * k / 2, -28, im.width * k, 28); c.restore(); }
      num(`×${o.n}`, 58, y + 7, 18); const wk = F()[o.k]?.weak?.[0]; if (wk) icon(c, ELK[wk], 160, y, 26, (ELEM[wk] || [''])[0]); }); }
  // 上緣：資源木牌
  const rx0 = 256; wood(rx0, 8, 380, 46);
  const resK = Math.min(1, s.res / Math.max(1, s.sumCost));
  icon(c, 'res', rx0 + 26, 31, 34, '人'); num(Math.floor(s.res), rx0 + 48, 41, 25, { col: resK >= 1 ? GOLD : CREAM });
  icon(c, 'coin', rx0 + 158, 31, 32, '$'); num(s.coin ?? 0, rx0 + 178, 41, 22);
  icon(c, 'ko', rx0 + 268, 31, 32, 'KO'); num(s.kills, rx0 + 288, 41, 22);
  const boss = s.foes.find(f => f.boss);
  if (boss) { const bx0 = 648; wood(bx0, 8, 330, 46); const im = IMG['foe_' + boss.kind]; if (im) { const k = 40 / im.height; c.save(); c.beginPath(); c.rect(bx0 + 6, 12, 44, 38); c.clip(); c.translate(bx0 + 28, 52); c.scale(-1, 1); c.drawImage(im, -im.width * k / 2, -40, im.width * k, 40); c.restore(); }
    bar(bx0 + 58, 24, 230, 14, boss.hp / boss.max, '#c8554a'); if (boss.guard) icon(c, 'guard', bx0 + 308, 31, 34); else if (boss.charge > 0) icon(c, 'charge', bx0 + 308, 31, 34); else if (boss.broken) { stamp('!!', bx0 + 308, 31, { px: 16 }); } }
  const bx = W - 258; for (const [i, k, ic, fb] of [[0, 'speed', 'speed', `×${G.speed}`], [1, 'pause', 'pause', 'Ⅱ'], [2, 'mute', G.mute ? 'snd_off' : 'snd_on', '♪']]) {
    button(bx + i * 84, 8, 78, 46, '', { down: VIEW.down === k }); const dy = VIEW.down === k ? 3 : 0; icon(c, ic, bx + i * 84 + 39 - (k === 'speed' ? 16 : 0), 31 + dy, k === 'speed' ? 28 : 32, fb); if (k === 'speed') text(`×${G.speed}`, bx + 62, 39 + dy, { px: 17, align: 'center', col: INK, w: 900 }); zone(bx + i * 84, 4, 78, 54, k); }
  // 底部：緊急調派
  const by = 490, can = C.canSummon(s), dn = VIEW.down === 'summon' ? 3 : 0;
  button(200, by, 160, 92, '', { hot: can, off: !can, down: VIEW.down === 'summon' }); icon(c, 'summon', 246, by + 44 + dn, 58, '召'); icon(c, 'res', 296, by + 46 + dn, 26); num(s.sumCost, 312, by + 55 + dn, 22, { col: can ? INK : '#8a7d66' }); zone(200, by, 160, 92, 'summon');
  // 報到中
  wood(370, by, 108, 92); icon(c, 'inbox', 388, by + 18, 26);
  if (s.pending) { c.save(); c.beginPath(); c.rect(374, by + 4, 100, 84); c.clip(); drawHero(c, s.pending.id, 428, by + 88, { t, sc: .9 }); c.restore();
    if (C.discard) { button(374, by - 44, 100, 40, '', {}); icon(c, 'refund', 404, by - 24, 28); num(`+${D.RULE?.discardBack ?? 5}`, 422, by - 15, 17, { col: INK }); zone(374, by - 48, 100, 46, 'discard'); } }
  // 選中同事
  const ix = 488, iw = 400; paper(ix, by, iw, 92, {});
  const sel = G.sel >= 0 && s.slots[G.sel] && s.slots[G.sel].tw;
  if (sel) {
    const Dt = T()[sel.id] || {};
    head(c, sel.id, ix + 42, by + 46, 64);
    text(Dt.name || sel.id, ix + 84, by + 30, { px: 20, fam: SERIF, w: 900 }); font(20, 900, SERIF); const nw = c.measureText(Dt.name || '').width;
    icon(c, ELK[Dt.elem], ix + 98 + nw, by + 23, 26, (ELEM[Dt.elem] || [''])[0]);
    for (let l = 1; l <= (D.RULE?.maxLv || 3); l++) { c.fillStyle = l <= sel.lv ? GOLD : 'rgba(43,31,24,.25)'; c.beginPath(); const sx = ix + 126 + nw + l * 16; c.moveTo(sx, by + 14); c.lineTo(sx + 6, by + 23); c.lineTo(sx, by + 32); c.lineTo(sx - 6, by + 23); c.fill(); }
    const rr = C.rangeOf ? C.rangeOf(sel) : Dt.range;
    if (Dt.dmg) { icon(c, 'dmg', ix + 96, by + 66, 26); text(String(Math.round(Dt.dmg * C.lvK(sel.lv))), ix + 112, by + 74, { px: 18, w: 900 });
      icon(c, 'aspd', ix + 168, by + 66, 26); text(`${Dt.rate}s`, ix + 184, by + 74, { px: 18, w: 900 });
      icon(c, 'range', ix + 240, by + 66, 26); text(String(Math.round(rr)), ix + 256, by + 74, { px: 18, w: 900 }); }
    button(ix + iw - 86, by + 6, 78, 40, '', {}); icon(c, 'refund', ix + iw - 62, by + 26, 26); text(`+${(D.RULE?.sellBack || [5, 10, 20])[sel.lv - 1]}`, ix + iw - 46, by + 33, { px: 16, w: 900 }); zone(ix + iw - 86, by + 2, 78, 48, 'sell');
    if (C.moveCost) { const mc = C.moveCost(s); icon(c, 'move', ix + iw - 62, by + 70, 26); if (mc) { icon(c, 'coin', ix + iw - 36, by + 70, 20); text(String(mc), ix + iw - 24, by + 77, { px: 15, col: mc > (s.coin || 0) ? RED : INK, w: 900 }); } else text('0', ix + iw - 40, by + 77, { px: 15, col: TEAL, w: 900 }); }
  } else {      // 沒選人：圖解「同名同級拖在一起＝升級」
    const demo = s.slots.find(x => x.tw)?.tw.id || 'kui';
    head(c, demo, ix + 50, by + 46, 54); text('+', ix + 92, by + 56, { px: 30, w: 900, col: INK2 }); head(c, demo, ix + 134, by + 46, 54);
    text('=', ix + 172, by + 56, { px: 30, w: 900, col: INK2 }); icon(c, 'promote', ix + 220, by + 46, 54, '↑');
    if (s.pending) { icon(c, 'inbox', ix + 300, by + 46, 36); text('→', ix + 326, by + 56, { px: 26, w: 900, col: INK2 }); c.strokeStyle = TEAL; c.lineWidth = 3; c.setLineDash([5, 4]); c.strokeRect(ix + 354, by + 28, 34, 36); c.setLineDash([]); }
  }
  // 氣勢與主動技
  const rx = 898, rw = W - rx - 8; wood(rx, by, rw, 92);
  icon(c, 'mom', rx + 22, by + 20, 28); bar(rx + 42, by + 14, rw - 56, 12, (s.momentum || 0) / 100, GOLD, { ticks: [.6] });
  const UN = s.unites || D.UNITES || [], bw = (rw - 30) / 3;
  UN.slice(0, 2).forEach((u, j) => { const ok = C.canUnite ? !!C.canUnite(s, u.key) : (s.momentum >= (u.cost || 60)), cd = (s.cds || {})[u.key] || 0, bx1 = rx + 8 + j * (bw + 6);
    button(bx1, by + 34, bw, 52, '', { off: !ok, hot: ok, down: VIEW.down === 'unite:' + u.key }); c.globalAlpha = ok ? 1 : .5; head(c, u.who[0], bx1 + bw / 2 - 16, by + 58, 34); head(c, u.who[1], bx1 + bw / 2 + 16, by + 58, 34); c.globalAlpha = 1;
    if (cd > 0) num(Math.ceil(cd), bx1 + bw / 2, by + 66, 20, { align: 'center' }); zone(bx1, by + 34, bw, 52, 'unite:' + u.key); });
  if (C.useSuper) { const ok = G.sel >= 0 && (C.canSuper ? !!C.canSuper(s, G.sel) : (s.momentum || 0) >= 100), bx2 = rx + rw - bw - 8; button(bx2, by + 34, bw, 52, '', { off: !ok, hot: ok, down: VIEW.down === 'super' }); c.globalAlpha = ok ? 1 : .5; icon(c, 'super', bx2 + bw / 2, by + 60, 40, '★'); c.globalAlpha = 1; zone(bx2, by + 34, bw, 52, 'super'); }
  if (G.paused) { c.fillStyle = 'rgba(20,13,8,.55)'; c.fillRect(0, 60, W, 425); icon(c, 'pause', W / 2, 400, 80, 'Ⅱ'); }
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
  const rows = [['wave', `${r.wave} / ${D.WAVES.length}`], ['ko', `${r.kills}`], ['life', `${r.lives}`], ['speed', `${Math.floor(r.t / 60)}:${String(Math.floor(r.t % 60)).padStart(2, '0')}`]];
  rows.forEach(([ic, b], i) => { icon(c, ic, 470, 272 + i * 36, 30); text(b, 830, 282 + i * 36, { px: 24, align: 'right', w: 900 }); });
  button(430, 420, 200, 56, '', { hot: true, down: VIEW.down === 'again' }); icon(c, 'refund', 530, 448, 40, '↻'); zone(430, 420, 200, 56, 'again');
  button(650, 420, 200, 56, '', { down: VIEW.down === 'title' }); icon(c, 'inbox', 750, 448, 40, '⌂'); zone(650, 420, 200, 56, 'title');
  G.zones = VIEW.zones;
}
