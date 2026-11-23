// 畫面：地圖、工位、同事、敵人、特效、介面（左側會議側欄＋上緣資訊＋底部指令帶）。
// 地圖座標（core 用的）是 1096×442，畫到畫面上要加 (MX, MY)。
import * as C from './core.js';
import * as D from './data.js';
import { IMG, Q, sfx, bgm, TRAIT_IC } from './assets.js';
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
  low: ['底氣快見底了，給我撐住。'], complain: ['客訴成立，底氣被扣了！', '又被客訴……下次打斷他。'], charge: ['總經理在攤客訴長卷！快打斷他！'], win: ['……做得不錯。今天准你們準時下班。'], lose: ['全員留下加班。明天早會檢討。'],
};
let talkCd = 0;
export function say(k, force) {
  const L = LINES[k]; if (!L) return; if (!force && talkCd > 0 && k !== 'win' && k !== 'lose') return;
  const IC = { intro: 'clock_ok', wave: 'wave', leak: 'clock_ng', merge: 'promote', boss: 'charge', boss_chief: 'guard', boss_boss: 'charge', low: 'heart', charge: 'reticle', complain: 'charge', win: 'clock_ok', lose: 'clock_ng' };
  VIEW.talk = { s: L[Math.floor(Math.random() * L.length)], t: 0, ic: IC[k] }; talkCd = 4;
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
// 8 方向（11/23 使用者：角度要 8 個才細緻）：依目標的角度分 8 等份，右半邊直接用圖、左半邊翻轉
const DIR8 = ['side', 'dside', 'down', 'dside', 'side', 'uside', 'up', 'uside'];
const dirOf = (sx, sy, tx, ty) => { const a = Math.atan2((ty - sy) * 1.25, tx - sx), i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; return DIR8[i]; };
export function fxFromEvents(s, G) {
  for (const e of s.ev) {
    if (e.k === 'shot') {
      const sl = s.slots[e.slot], tw = sl && sl.tw; if (!tw) continue;
      const v = VIEW.tw[tw.uid] || (VIEW.tw[tw.uid] = {}); v.dir = dirOf(sl.x, sl.y, e.x, e.y); v.flip = e.x < sl.x; v.actT = 0; v.acting = true;
      FX.push({ k: 'shot', elem: e.elem, kind: e.kind, x0: sl.x, y0: sl.y - 30, x: e.x, y: e.y - 18, r: e.radius || 0, t: 0, life: e.kind === 'splash' ? .45 : .3, x2: e.x2, y2: e.y2 });
      const snd = { slash: 'slash', blunt: 'hit', fire: 'explosion', ice: 'break', holy: 'holy_cast', dark: 'dark_blast' }[e.elem] || 'hit';
      sfx(snd, e.elem === 'fire' ? .18 : .26, .95 + Math.random() * .15);
    } else if (e.k === 'dmg') {
      const f = s.foes.find(q => Math.abs(q.x - e.x) < 3 && Math.abs(q.y - e.y) < 3), tone = f && f.guard ? 'guard' : f && f.broken ? 'broken' : e.weak ? 'weak' : '';
      const old = FX.find(q => q.k === 'num' && q.dmg && q.t < .3 && Math.abs(q.x0 - e.x) < 24 && Math.abs(q.y0 - e.y) < 18);      // 同一隻 0.3 秒內合併成一個數字
      if (old) { old.v += e.v; old.t = Math.min(old.t, .08); if (tone) old.tone = tone; }
      else FX.push({ k: 'num', dmg: true, x0: e.x, y0: e.y, x: e.x + (Math.random() * 14 - 7), y: Math.max(84, e.y - 46), v: e.v, tone, t: 0, life: .75 }); }
    else if (e.k === 'die') { for (let i = 0; i < (e.boss ? 26 : 7); i++) FX.push({ k: 'paper', x: e.x, y: e.y - 20, vx: (Math.random() - .5) * 160, vy: -60 - Math.random() * 120, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, t: 0, life: .9 + Math.random() * .4 }); if (e.boss) { sfx('boss_down', .8); VIEW.shake = .5; VIEW.bossKind = null; } else sfx('coin', .25, 1.2); }
    else if (e.k === 'leak') { VIEW.flash = .5; VIEW.shake = .25; sfx('defeat', .35, 1.4); say('leak'); if (s.lives <= s.livesMax * .3) say('low', true); }
    else if (e.k === 'summon') { FX.push({ k: 'pop', slot: e.slot, t: 0, life: .5 }); sfx('confirm', .5); }
    else if (e.k === 'pending') { VIEW.pendT = 0; }
    else if (e.k === 'clear') { FX.push({ k: 'ico', ic: 'coin', x: 640, y: 440, v: `+${e.coin}`, t: 0, life: 1.6, big: true }); sfx('coin', .7); }
    else if (e.k === 'unite') { FX.push({ k: 'unite', key: e.key, x: e.x, y: e.y, x2: e.x2, y2: e.y2, r: e.r || 150, t: 0, life: 1.2 }); VIEW.cut = { key: e.key, t: 0 }; VIEW.shake = .45; sfx('unite', .9); }
    else if (e.k === 'super') { const sl = s.slots[e.slot]; if (sl) { FX.push({ k: 'ico', ic: 'super', x: sl.x, y: sl.y - 90, t: 0, life: 1.2, big: true }); FX.push({ k: 'ring', x: sl.x, y: sl.y - 30, col: GOLD, t: 0, life: .8 }); } sfx('buff', .9); }
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
    else if (e.k === 'complain') { const f = s.foes.find(q => q.uid === e.uid) || { x: 640, y: 300 }; FX.push({ k: 'fly', ic: 'charge', x0: f.x, y0: f.y - 80, x1: 32, y1: 62, v: `−${e.v}`, t: 0, life: 1.1 }); VIEW.shake = .4; sfx('paper_storm', .8); say('complain', true); setTimeout(() => { VIEW.flash = .6; VIEW.heartT = .8; }, 650); }
    else if (e.k === 'down') FX.push({ k: 'ico', ic: 'revive', x: e.x, y: e.y - 50, t: 0, life: .8 });
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
  if (!q.strips[`${anim}_${dir}`] && (dir === 'dside' || dir === 'uside')) dir = 'side';      // 斜向的圖還沒到：先用側面
  let st = q.strips[`${anim}_${dir}`], f = flip; if (!st) { st = q.strips[`${anim}_side`] || q.strips[`idle_${dir}`] || q.strips.idle_down; } if (!st) return false;
  const n = Math.max(1, Math.round(st.width / q.cell[0])), i = Math.min(n - 1, Math.floor(fr * n)) % n, k = (q.scale || 1) * sc;
  c.save(); c.globalAlpha = alpha; c.translate(Math.round(x), Math.round(y)); if (f && (dir === 'side' || dir === 'dside' || dir === 'uside')) c.scale(-1, 1);
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
  const fq0 = Q['foe_' + f.kind];
  const v = VIEW.foe[f.uid] || (VIEW.foe[f.uid] = { px: f.x, py: f.y, dir: 'side', flip: false });
  const dx = f.x - v.px, dy = f.y - v.py; if (Math.abs(dx) + Math.abs(dy) > .3) { v.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : 'side'; v.flip = dx < 0; } v.px = f.x; v.py = f.y;
  const ph = (t * 1.25 * Math.max(.6, (F()[f.kind]?.spd || 46) / 46) * (f.slow > 0 ? 1 - f.slow : 1) + (f.ph || f.uid * .37)) % 1;      // 步伐跟移動速度走（信差快、被冰住會慢）
  if (f.down > 0 && !(fq0 && fq0.strips.fall_down)) c.globalAlpha = .45;
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y, f.boss ? 30 : 15, f.boss ? 8 : 5, 0, 0, 7); c.fill();
  const fq = Q['foe_' + f.kind], pose = fq && (f.down > 0 && fq.strips.fall_down ? 'fall' : f.guard && fq.strips.guard_down ? 'guard' : f.charge > 0 && fq.strips.charge_down ? 'charge' : null);      // 特殊姿勢只有正面一張
  if (!drawQ(c, 'foe_' + f.kind, pose || (f.hitT > 0 && fq?.strips['hit_' + v.dir] ? 'hit' : 'walk'), pose ? 'down' : v.dir, v.flip, ph, x, y)) {
    const im = (f.hitT > 0 && IMG[`foe_${f.kind}_hit`]) || IMG[`foe_${f.kind}`]; if (!im) { c.fillStyle = RED; c.fillRect(x - 10, y - 30, 20, 30); }
    else { const h = FOE_H[f.kind] || 48, k = h / im.height, bob = Math.abs(Math.sin(ph * Math.PI * 2)) * (f.boss ? 2 : 3);
      c.save(); c.translate(Math.round(x), Math.round(y - bob)); if (v.flip === false && v.dir === 'side') c.scale(-1, 1);      // RPG 的敵人圖面向左；往右走時翻過來
      c.drawImage(im, Math.round(-im.width * k / 2), Math.round(-im.height * k), Math.round(im.width * k), Math.round(im.height * k)); c.restore(); }
  }
  c.globalAlpha = 1; const h = (FOE_H[f.kind] || 48);
  if (f.hitT > 0) { c.globalAlpha = f.hitT / .15 * .5; c.fillStyle = '#fff'; c.fillRect(x - 12, y - h * .8, 24, h * .6); c.globalAlpha = 1; }
  if (f.slow > 0) { c.fillStyle = 'rgba(127,212,240,.85)'; c.fillRect(x - 13, y - 3, 4, 4); c.fillRect(x + 9, y - 5, 4, 4); }
  if (f.burnT > 0 && Math.floor(t * 10) % 2) { c.fillStyle = '#ff7a2e'; c.fillRect(x - 4 + Math.sin(t * 9) * 6, y - h * .6, 4, 6); }
  if (f.down > 0) { c.save(); c.translate(x, y - 34); c.rotate(t * 4); icon(c, 'revive', 0, 0, 26, '↻'); c.restore(); }
  if (f.boss) {
    const oy = Math.max(84, y - h - 18); if (f.guard) { icon(c, 'guard', x, oy, 40); c.strokeStyle = `rgba(207,232,255,${.35 + .2 * Math.sin(t * 8)})`; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y - h * .45, h * .45, h * .6, 0, 0, 7); c.stroke(); }
    else if (f.broken) { if (!icon(c, 'dizzy', x, oy + 6, 40)) for (let j = 0; j < 3; j++) { const a = t * 5 + j * 2.1; text('★', x + Math.cos(a) * 18, y - h - 8 + Math.sin(a) * 5, { px: 14, col: GOLD, stroke: '#1a0f08', sw: 3, align: 'center' }); } }
    if (f.charge > 0) {      // 客訴長卷蓄力：橘條＝蓄力時間；金條＝已經打的傷害，到刻度就打斷
      const need = f.max * (F()[f.kind]?.scroll?.breakK || .06), bw = 96, bx = x - bw / 2, by = y - h - 44 < 70 ? y + 14 : y - h - 44;      // 太上面會被介面蓋住，改畫在腳下
      icon(c, 'charge', bx - 18, by + 6, 30); bar(bx, by, bw, 8, f.charge, '#ff7a2e'); bar(bx, by + 12, bw, 8, Math.min(1, (f.chargeDmg || 0) / need), GOLD);
      c.save(); c.translate(x, y - h * .45); c.rotate(t * 2); if (!icon(c, 'reticle', 0, 0, h * 1.1)) { c.strokeStyle = '#ff5a4a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, h * .5, 0, 7); c.stroke(); } c.restore(); }
  }
  if (!f.boss && f.hp < f.max) { const bw = 30, hy = y - h - 8 < 56 ? y + 6 : y - h - 8; bar(x - bw / 2, hy, bw, 4, f.hp / f.max, '#d24a3a'); }      // 上走廊太高會被木牌蓋住，改畫腳下
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
  if (IMG.map) { if (o.ring) { c.strokeStyle = o.ring; c.lineWidth = o.wide ? 5 : 3; c.setLineDash(o.dash ? [6, 5] : []); c.strokeRect(x - 34, y - 32, 68, 62); c.setLineDash([]); if (o.wide) { c.fillStyle = 'rgba(242,201,76,.18)'; c.fillRect(x - 34, y - 32, 68, 62); } } return; }      // 新地圖已經畫好工位，只畫選取框
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
  VIEW.mergeT = [];
  s.slots.forEach((sl, i) => {
    let ring = null, dash = false, wide = false;
    const canM = (G.sel >= 0 && C.canMerge(s, G.sel, i)) || (s.pending && sl.tw && sl.tw.id === s.pending.id && sl.tw.lv === (s.pending.lv || 1) && sl.tw.lv < (D.RULE?.maxLv || 3));
    if (G.sel === i) { ring = GOLD; wide = true; }
    else if (canM) { ring = `rgba(120,230,200,${.45 + .55 * pulse})`; VIEW.mergeT.push(sl); }
    else if ((G.sel >= 0 || s.pending) && !sl.tw) { ring = 'rgba(159,214,196,.7)'; dash = true; }
    drawPad(c, MX + sl.x, MY + sl.y, { ring, dash, wide });
  });
  // 入口：電梯門＋往下的箭頭（波間脈動）
  const gt = s.map.gate; if (gt) { const b = s.phase === 'break' ? Math.abs(Math.sin(t * 4)) * 6 : 0; icon(c, 'entrance', MX + gt[0], MY + gt[1] + 52 + b, 40); }
  // 新手第一波：沿走道跑方向箭頭
  if (s.wave === 0 && s.phase === 'break') { const L = s.lanes[0]; for (let d = (t * 120) % 90; d < L.L; d += 90) { const p = C.posAt(L, d), q = C.posAt(L, d + 6), a = Math.atan2(q.y - p.y, q.x - p.x); c.save(); c.translate(MX + p.x, MY + p.y); c.rotate(a); c.fillStyle = 'rgba(255,246,200,.75)'; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -9); c.lineTo(-2, 0); c.lineTo(-6, 9); c.fill(); c.restore(); } }
  // 同事＋敵人依 y 排序
  const ents = [];
  s.slots.forEach((sl, i) => { if (sl.tw && !(G.drag && G.drag.from === i)) ents.push({ y: sl.y, f: () => drawTower(c, s, sl, t, dt) }); });
  for (const f of s.foes) ents.push({ y: f.boss ? f.y + 2000 : f.y, f: () => drawFoe(c, f, MX + f.x, MY + f.y, t) });      // 頭目永遠畫在最上層
  for (const m of s.mice || []) ents.push({ y: m.y, f: () => { const im = IMG.mouse; c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(MX + m.x, MY + m.y, 9, 3, 0, 0, 7); c.fill(); if (im) { const k = 26 / im.height; c.drawImage(im, MX + m.x - im.width * k / 2, MY + m.y - 26 - Math.abs(Math.sin(t * 20 + m.uid)) * 3, im.width * k, 26); } else { c.fillStyle = '#8a8580'; c.fillRect(MX + m.x - 7, MY + m.y - 9, 14, 9); } } });
  for (const q of s.cones || []) ents.push({ y: q.y, f: () => { const x = MX + q.x, y = MY + q.y; c.fillStyle = '#1a0f08'; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x - 10, y + 2); c.lineTo(x + 10, y + 2); c.closePath(); c.fill(); c.fillStyle = '#ff8a2e'; c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x - 8, y); c.lineTo(x + 8, y); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 5, y - 9, 10, 3); } });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
  for (const sl of VIEW.mergeT || []) icon(c, 'promote', MX + sl.x, MY + sl.y - 104 - Math.abs(Math.sin(t * 5)) * 6, 34, '↑');
  // 合體技瞄準：直線類亮整段走道、範圍類畫圓（跟著手指，沒有就放在敵人最多的地方）
  if (G.aim) { const u = (s.unites || D.UNITES).find(q => q.key === G.aim); if (u) drawAim(c, s, u, t); }
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
  rankGems(c, x, y + 20, tw.lv);      // 職級：工位前緣的菱形（◆◇◇）
  if (tw.super > 0) { c.strokeStyle = GOLD; c.lineWidth = 4; c.beginPath(); c.arc(x, y - 96, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, tw.super / (D.RULE?.superT || 12))); c.stroke(); icon(c, 'super', x, y - 96, 20); }
  if (VIEW.pickSuper) { const b = .5 + .5 * Math.sin(t * 8); icon(c, 'super', x, y - 100 - b * 4, 30); }
  if (tw.shield) { const sx = x + 20, sy = y - 66; c.fillStyle = '#1a0f08'; c.fillRect(sx - 6, sy - 7, 12, 13); c.fillStyle = '#cfe8ff'; c.fillRect(sx - 5, sy - 6, 10, 8); c.fillRect(sx - 3, sy + 2, 6, 3); c.fillStyle = '#7fb4e0'; c.fillRect(sx - 1, sy - 5, 2, 8); }      // 專注護盾：頭旁小盾牌
  if (tw.star > 0) text('★', x - 22, y - 62, { px: 16, col: GOLD, stroke: '#1a0f08', sw: 3 });
  if (tw.haste > 0) { c.fillStyle = '#9be0c8'; c.fillRect(x - 26, y - 50, 4, 4); c.fillRect(x - 22, y - 56, 4, 4); }
  if (tw.fatigue > 0) { icon(c, 'fatigue', x - 24, y - 70, 26, 'z'); if (tw.fatigue > 1) text(String(tw.fatigue), x - 12, y - 58, { px: 15, col: '#d8c8ff', stroke: '#1a0f08', sw: 3, w: 900 }); }
}
function drawAim(c, s, u, t) {
  const L = s.lanes[0], live = s.foes.filter(f => f.hp > 0), hv = VIEW.hover && VIEW.hover.y > 60 && VIEW.hover.y < 486 ? VIEW.hover : null, a = .45 + .3 * Math.sin(t * 7);
  c.fillStyle = 'rgba(20,13,8,.35)'; c.fillRect(0, 60, W, 426);
  if (u.kind === 'line' || u.kind === 'wall') {
    let gi = 0; const near = (g, x, y) => { const vx = g.bx - g.ax, vy = g.by - g.ay, q = Math.max(0, Math.min(1, ((x - g.ax) * vx + (y - g.ay) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(g.ax + vx * q - x, g.ay + vy * q - y); };
    if (hv) { let bd = 1e9; L.seg.forEach((g, i) => { const d = near(g, hv.x - MX, hv.y - MY); if (d < bd) { bd = d; gi = i; } }); }
    else { const w = L.seg.map(() => 0); for (const f of live) { let bi = 0, bd = 1e9; L.seg.forEach((g, i) => { const d = near(g, f.x, f.y); if (d < bd) { bd = d; bi = i; } }); w[bi] += f.hp; } gi = w.indexOf(Math.max(...w)); }
    L.seg.forEach((g, i) => { c.strokeStyle = i === gi ? `rgba(255,122,46,${a + .2})` : 'rgba(255,246,200,.18)'; c.lineWidth = i === gi ? 46 : 30; c.lineCap = 'round'; c.beginPath(); c.moveTo(MX + g.ax, MY + g.ay); c.lineTo(MX + g.bx, MY + g.by); c.stroke(); });
    const g = L.seg[gi]; icon(c, 'reticle', MX + (g.ax + g.bx) / 2, MY + (g.ay + g.by) / 2, 44);
  } else { let cx, cy; if (hv) { cx = hv.x - MX; cy = hv.y - MY; } else { let best = -1; for (const q of live) { let v = 0; for (const f of live) if (Math.hypot(f.x - q.x, (f.y - q.y) * 1.25) <= u.radius) v += f.hp; if (v > best) { best = v; cx = q.x; cy = q.y; } } if (cx == null) { const p = C.posAt(L, L.L / 2); cx = p.x; cy = p.y; } }
    c.fillStyle = `rgba(127,212,240,${a * .4})`; c.strokeStyle = '#b083f0'; c.lineWidth = 4; c.beginPath(); c.ellipse(MX + cx, MY + cy, u.radius, u.radius / 1.25, 0, 0, 7); c.fill(); c.stroke(); icon(c, 'reticle', MX + cx, MY + cy, 44); }
  icon(c, 'finger', 640, 448 - Math.abs(Math.sin(t * 5)) * 8, 40);
}
function rankGems(c, x, y, lv) {
  const n = D.RULE?.maxLv || 3, sz = 8, gap = 19, x0 = x - (n - 1) * gap / 2; c.fillStyle = 'rgba(20,12,6,.75)'; c.fillRect(x0 - 13, y - 11, (n - 1) * gap + 26, 22);
  for (let l = 1; l <= n; l++) { const cx = x0 + (l - 1) * gap; c.fillStyle = '#1a0f08'; c.beginPath(); c.moveTo(cx, y - sz - 2); c.lineTo(cx + sz + 2, y); c.lineTo(cx, y + sz + 2); c.lineTo(cx - sz - 2, y); c.fill();
    c.fillStyle = l <= lv ? (lv >= 3 ? '#ffd860' : GOLD) : '#5a4a3a'; c.beginPath(); c.moveTo(cx, y - sz); c.lineTo(cx + sz, y); c.lineTo(cx, y + sz); c.lineTo(cx - sz, y); c.fill(); if (l <= lv) { c.fillStyle = '#fff6c8'; c.fillRect(cx - 2, y - 5, 3, 3); } }
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
      const px = e.big ? 26 : e.tone === 'weak' || e.tone === 'broken' ? 21 : e.tone === 'guard' ? 12 : 14, col = e.col || (e.tone === 'weak' || e.tone === 'broken' ? GOLD : e.tone === 'guard' ? '#9a9088' : '#fff4e0');
      text(String(Math.round(e.v)), MX + e.x, Math.max(80, y), { px, align: 'center', col, stroke: '#1a0f08', sw: 4, w: 900 }); c.globalAlpha = 1;
    } else if (e.k === 'ring') {
      const r = 8 + k * 34; c.strokeStyle = e.col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.beginPath(); c.ellipse(MX + e.x, MY + e.y, r, r * .7, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
    } else if (e.k === 'unite') {
      c.globalAlpha = 1 - k;
      if (e.x2 != null) { const g = 30 * (1 - k) + 8; c.strokeStyle = '#ff7a2e'; c.lineWidth = g; c.beginPath(); c.moveTo(MX + e.x, MY + e.y); c.lineTo(MX + e.x2, MY + e.y2); c.stroke(); c.strokeStyle = '#fff4e0'; c.lineWidth = g / 3; c.stroke(); }
      else { const r = e.r * Math.min(1, k * 3); c.fillStyle = 'rgba(127,212,240,.25)'; c.beginPath(); c.ellipse(MX + e.x, MY + e.y, r, r / 1.25, 0, 0, 7); c.fill(); c.strokeStyle = '#b083f0'; c.lineWidth = 5; c.stroke(); }
      c.globalAlpha = 1;
    } else if (e.k === 'fly') {      // 圖示從 (x0,y0) 飛到 (x1,y1)，到了跳數字
      const q = Math.min(1, k / .6), ez = q * q * (3 - 2 * q), fx = e.x0 + (e.x1 - e.x0) * ez, fy = e.y0 + (e.y1 - e.y0) * ez - Math.sin(q * Math.PI) * 80;
      if (k < .6) icon(c, e.ic, MX + fx, MY + fy, 40); else { c.globalAlpha = 1 - (k - .6) / .4; text(e.v, e.x1 + 30, e.y1 + 8 - (k - .6) * 30, { px: 26, col: '#ff6a5a', stroke: '#1a0f08', sw: 4, w: 900 }); c.globalAlpha = 1; }
    } else if (e.k === 'ico') {
      const y = Math.max(78, MY + e.y - k * 24), s2 = e.big ? 44 : 30;      // 不要飄進頂部介面 c.globalAlpha = k > .7 ? (1 - k) / .3 : 1; const pop = k < .15 ? .6 + k / .15 * .4 : 1;
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
  if (Wv) { const ks = [...new Set(Wv.groups.map(g => g.kind))]; ks.slice(0, 5).forEach((kd, i) => foeMini(c, kd, x + 140 + i * 48, y + 50, 40)); }
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
  if (b) { const side = b.width * .9; c.drawImage(b, (b.width - side) / 2, 0, side, side, x - s / 2, y - s / 2, s, s); } c.restore();      // 立繪最上面一個正方形＝整顆頭加肩膀（11/23 使用者：大頭貼要整個出來）
  c.strokeStyle = '#1a0f08'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, s / 2, 0, 7); c.stroke(); c.strokeStyle = BRASS; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, s / 2 - 2, 0, 7); c.stroke();
}
const num = (s, x, y, px, o = {}) => text(String(s), x, y, { px, col: o.col ?? CREAM, stroke: '#1a0f08', sw: 4, w: 900, align: o.align ?? 'left' });
// 敵人小圖（介面用）：有新 Q 版就用正面走路第一格，沒有退回舊的 RPG 側面圖；(x, y) 是腳底
function foeMini(c, kind, x, y, h) {
  const q = Q['foe_' + kind], st = q && (q.strips.walk_down || q.strips.walk_side);
  if (st) { const k = h / (q.foot[1] * .92); c.drawImage(st, 0, 0, q.cell[0], q.cell[1], Math.round(x - q.foot[0] * k), Math.round(y - q.foot[1] * k), Math.round(q.cell[0] * k), Math.round(q.cell[1] * k)); return; }
  const im = IMG['foe_' + kind]; if (!im) return; const k = h / im.height; c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(im, -im.width * k / 2, -h, im.width * k, h); c.restore();
}
export function drawHud(c, G, dt) {
  const s = G.s, t = G.t; VIEW.pickSuper = G.pickSuper;
  // 左上：波次＋下班底氣＋開下一波（手機上按鈕至少 64 邏輯像素高）
  wood(8, 6, 236, 76);
  icon(c, 'wave', 30, 28, 32, '波'); num(Math.max(1, s.wave), 50, 40, 26, { col: GOLD }); font(26, 900); text(`/${D.WAVES.length}`, 52 + c.measureText(String(Math.max(1, s.wave))).width, 40, { px: 14, col: '#d9c7a0', w: 900 });
  const low = s.lives <= s.livesMax * .3, hb = VIEW.heartT > 0 ? (VIEW.heartT -= dt, 1 + Math.sin(VIEW.heartT * 30) * .15) : 1;
  icon(c, 'heart', 30, 62, 26 * hb, '♥') || 0; bar(48, 56, 84, 12, s.lives / s.livesMax, low ? '#d24a3a' : '#c8554a'); num(s.lives, 138, 68, 17, { col: low ? '#ff8a7a' : CREAM });
  const brk = s.phase ? s.phase === 'break' : s.waveT > 0, next = brk && s.wave < D.WAVES.length ? Math.ceil(Math.max(0, s.waveT)) : 0;
  if (next) { const dn = VIEW.down === 'call' ? 3 : 0, cx = 204, cy = 44; button(166, 10, 76, 68, '', { hot: true, down: VIEW.down === 'call' });
    const tot = s.wave === 0 ? (D.RULE?.firstDelay || 12) : (D.RULE?.breakT || 8); c.strokeStyle = GOLD; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy + dn, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.waveT / tot)); c.stroke();
    icon(c, 'call2', cx, cy + dn, 36, '▶'); num(next, cx + 18, cy + 26 + dn, 15, { col: CREAM }); zone(160, 4, 88, 80, 'call'); }
  // 左邊：Vivi 視訊（平時縮成小頭像；有事件時展開 3.5 秒，附事件圖示，字 16px）
  const vx = 8, vy = 90, open = VIEW.talk && VIEW.talk.t < 3.5; if (VIEW.talk) VIEW.talk.t += dt;
  const ex = VIEW.vivEx = (VIEW.vivEx || 0) + ((open ? 1 : 0) - (VIEW.vivEx || 0)) * Math.min(1, dt * 10), vw = 176, vh = 80 + 116 * ex;
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(vx + 3, vy + 5, vw, vh); c.fillStyle = pats().WOOD_D; c.fillRect(vx, vy, vw, vh); c.strokeStyle = '#1a0f08'; c.lineWidth = 2; c.strokeRect(vx + 1, vy + 1, vw - 2, vh - 2);
  const ph = 56 + 60 * ex; c.fillStyle = '#3b2d4a'; c.fillRect(vx + 6, vy + 18, vw - 12, ph);
  c.fillStyle = Math.floor(t * 2) % 2 ? '#c8554a' : '#7a2a22'; c.fillRect(vx + 10, vy + 6, 7, 7);
  const bv = IMG.bust_vivi; if (bv) { c.save(); c.beginPath(); c.rect(vx + 6, vy + 18, vw - 12, ph); c.clip(); const k = (150 + 80 * ex) / bv.height, talk = open && VIEW.talk.t < 2.5; c.drawImage(bv, vx + vw / 2 - bv.width * k / 2, vy + 14 + (talk ? Math.sin(t * 18) * .8 : 0), bv.width * k, bv.height * k); c.restore(); }
  c.fillStyle = 'rgba(255,255,255,.05)'; for (let yy = vy + 18; yy < vy + 18 + ph; yy += 3) c.fillRect(vx + 6, yy, vw - 12, 1);
  if (ex > .05 && VIEW.talk) { c.globalAlpha = ex; if (VIEW.talk.ic) { c.fillStyle = 'rgba(26,15,8,.75)'; c.beginPath(); c.arc(vx + vw - 26, vy + 40, 22, 0, 7); c.fill(); icon(c, VIEW.talk.ic, vx + vw - 26, vy + 40, 36); }
    c.fillStyle = pats().PAPER; c.fillRect(vx + 6, vy + 22 + ph, vw - 12, vh - ph - 28); wrap(c, VIEW.talk.s.slice(0, Math.floor(VIEW.talk.t * 24)), vx + 12, vy + 44 + ph, vw - 24, 21, { px: 16 }); c.globalAlpha = 1; }
  // 左邊：下一波敵人（頭像＋數量＋弱點；頭目波放頭目頭像加紅框）
  const NW = D.WAVES[s.wave];
  if (NW) { const kinds = []; NW.groups.forEach(g => { const o = kinds.find(z => z.k === g.kind); o ? o.n += g.n : kinds.push({ k: g.kind, n: g.n }); });
    const ky = 90 + 80 + 116 * (VIEW.vivEx || 0) + 10, kh = 40 + Math.min(4, kinds.length) * 34; wood(8, ky, 176, kh); if (NW.boss) { c.strokeStyle = RED; c.lineWidth = 3; c.strokeRect(10, ky + 2, 172, kh - 4); }
    icon(c, 'wave', 26, ky + 20, 24); num(s.wave + 1, 42, ky + 28, 18, { col: GOLD });
    kinds.slice(0, 4).forEach((o, j) => { const y = ky + 54 + j * 34, im = IMG['foe_' + o.k], bossK = F()[o.k]?.boss;
      c.fillStyle = bossK ? 'rgba(178,58,48,.35)' : 'rgba(239,230,207,.12)'; c.fillRect(14, y - 15, 164, 30);
      foeMini(c, o.k, 34, y + 14, 28);
      num(`×${o.n}`, 58, y + 7, 18); const wk = F()[o.k]?.weak?.[0]; if (wk) icon(c, ELK[wk], 160, y, 26, (ELEM[wk] || [''])[0]); }); }
  // 上緣：資源木牌
  const rx0 = 256; wood(rx0, 4, 380, 44);
  const resK = Math.min(1, s.res / Math.max(1, s.sumCost));
  icon(c, 'res', rx0 + 26, 26, 32, '人'); num(Math.floor(s.res), rx0 + 48, 36, 25, { col: resK >= 1 ? GOLD : CREAM });
  icon(c, 'coin', rx0 + 158, 26, 30, '$'); num(s.coin ?? 0, rx0 + 178, 35, 22);
  icon(c, 'ko2', rx0 + 268, 26, 30, 'KO'); num(s.kills, rx0 + 288, 35, 22);
  // 倍速、暫停：放在資源木牌右邊，不擋右上的入口（聲音收進暫停畫面）
  for (const [i, k] of [[0, 'speed'], [1, 'pause']]) { const bx = 8 + i * 92, byy = 504, dn = VIEW.down === k ? 3 : 0; button(bx, byy, 84, 78, '', { down: VIEW.down === k, hot: k === 'pause' && G.paused });      // 左下角：不擋上走廊的敵人
    if (k === 'speed') text(`×${G.speed}`, bx + 42, byy + 52 + dn, { px: 30, align: 'center', col: INK, w: 900 }); else icon(c, 'pause', bx + 42, byy + 39 + dn, 44, 'Ⅱ'); zone(bx - 2, byy - 2, 88, 82, k); }
  // 頭目血條
  const boss = s.foes.find(f => f.boss);
  if (boss) { const bx0 = 648; wood(bx0, 4, 300, 50); c.save(); c.beginPath(); c.rect(bx0 + 6, 12, 46, 42); c.clip(); foeMini(c, boss.kind, bx0 + 29, 70, 60); c.restore();
    bar(bx0 + 58, 26, 196, 14, boss.hp / boss.max, '#c8554a'); if (boss.guard) icon(c, 'guard', bx0 + 276, 33, 36); else if (boss.charge > 0) icon(c, 'charge', bx0 + 276, 33, 36); else if (boss.broken) icon(c, 'dizzy', bx0 + 276, 33, 36, '!!'); }
  // 底部：緊急調派（報到中有人時蓋收件匣，指向報到中）
  const by = 490, pend = !!s.pending, can = C.canSummon(s), dn = VIEW.down === 'summon' ? 3 : 0;
  button(200, by, 160, 92, '', { hot: can, off: !can, down: VIEW.down === 'summon' }); c.globalAlpha = can ? 1 : .55; icon(c, 'summon', 244, by + 44 + dn, 58, '召'); c.globalAlpha = 1;
  icon(c, 'res', 298, by + 34 + dn, 24); text(`−${s.sumCost}`, 312, by + 42 + dn, { px: 20, col: s.res >= s.sumCost ? INK : RED, w: 900 });
  if (pend) { icon(c, 'inbox', 312, by + 70 + dn, 30); text('→', 334, by + 78 + dn, { px: 20, col: TEAL, w: 900 }); } zone(200, by, 160, 92, 'summon');
  // 新手指引：還沒放過人時，手指點紅電話；報到中有人時，手指點第一個空工位
  if (s.wave === 0 && s.phase === 'break') { const b = Math.abs(Math.sin(t * 5)) * 10; if (pend) { const e = s.slots.find(q => !q.tw); if (e) icon(c, 'finger', MX + e.x, MY + e.y - 90 - b, 44); } else if (!s.slots.some(q => q.tw)) icon(c, 'finger', 244, by - 30 - b, 48); }
  // 報到中
  wood(370, by, 108, 92); icon(c, 'inbox', 388, by + 18, 26);
  if (pend) { c.save(); c.beginPath(); c.rect(374, by + 4, 100, 84); c.clip(); drawHero(c, s.pending.id, 428, by + 88, { t, sc: .9 }); c.restore();
    if (C.discard) { button(374, by - 72, 100, 66, '', { down: VIEW.down === 'discard' }); icon(c, 'refund', 402, by - 39, 34); text(`+${D.RULE?.discardBack ?? 5}`, 422, by - 30, { px: 20, w: 900 }); zone(372, by - 76, 104, 72, 'discard'); } }
  // 選中同事
  const ix = 488, iw = 400; paper(ix, by, iw, 92, {});
  const sel = G.sel >= 0 && s.slots[G.sel] && s.slots[G.sel].tw;
  if (sel) {
    const Dt = T()[sel.id] || {};
    head(c, sel.id, ix + 42, by + 46, 64);
    const tic = IMG['ic_' + TRAIT_IC[sel.id]]; if (tic) { c.fillStyle = '#1a0f08'; c.beginPath(); c.arc(ix + 66, by + 70, 17, 0, 7); c.fill(); c.drawImage(tic, ix + 51, by + 55, 30, 30); zone(ix + 44, by + 48, 44, 44, 'trait'); }      // 特色圖示：點了說明
    text(Dt.name || sel.id, ix + 84, by + 30, { px: 20, fam: SERIF, w: 900 }); font(20, 900, SERIF); const nw = c.measureText(Dt.name || '').width;
    icon(c, ELK[Dt.elem], ix + 98 + nw, by + 23, 26, (ELEM[Dt.elem] || [''])[0]); rankGems(c, ix + 152 + nw, by + 24, sel.lv);
    const rr = C.rangeOf ? C.rangeOf(sel) : Dt.range;
    if (Dt.dmg) { icon(c, 'dmg', ix + 104, by + 66, 26); text(String(Math.round(Dt.dmg * C.lvK(sel.lv))), ix + 120, by + 74, { px: 18, w: 900 });
      icon(c, 'aspd', ix + 174, by + 66, 26); text(`${Dt.rate}s`, ix + 190, by + 74, { px: 18, w: 900 });
      icon(c, 'range', ix + 256, by + 66, 26); text(String(Math.round(rr)), ix + 272, by + 74, { px: 18, w: 900 }); }
    if (C.moveCost) { const mc = C.moveCost(s), mx = ix + 258; icon(c, 'move', mx, by + 22, 24); if (mc) { icon(c, 'coin', mx + 22, by + 22, 18); text(String(mc), mx + 32, by + 29, { px: 15, col: mc > (s.coin || 0) ? RED : INK, w: 900 }); } else text('0', mx + 16, by + 29, { px: 16, col: TEAL, w: 900 }); }
    button(ix + iw - 72, by + 8, 66, 76, '', { down: VIEW.down === 'sell' }); icon(c, 'refund', ix + iw - 39, by + 36, 36); text(`+${(D.RULE?.sellBack || [5, 10, 20])[sel.lv - 1]}`, ix + iw - 39, by + 74, { px: 17, align: 'center', w: 900 }); zone(ix + iw - 74, by + 4, 70, 84, 'sell');
  } else {      // 沒選人：圖解「同名同級拖在一起＝升級」
    const demo = s.slots.find(x => x.tw)?.tw.id || 'kui';
    head(c, demo, ix + 50, by + 46, 54); text('+', ix + 92, by + 56, { px: 30, w: 900, col: INK2 }); head(c, demo, ix + 134, by + 46, 54);
    text('=', ix + 172, by + 56, { px: 30, w: 900, col: INK2 }); icon(c, 'promote', ix + 220, by + 46, 54, '↑');
    if (pend) { icon(c, 'inbox', ix + 300, by + 46, 36); text('→', ix + 326, by + 56, { px: 26, w: 900, col: INK2 }); c.strokeStyle = TEAL; c.lineWidth = 3; c.setLineDash([5, 4]); c.strokeRect(ix + 354, by + 28, 34, 36); c.setLineDash([]); }
  }
  if (VIEW.tip && sel) { VIEW.tip.t += dt; if (VIEW.tip.t > 3) VIEW.tip = null; else { font(17, 700); const tw2 = c.measureText(VIEW.tip.s).width + 28; paper(ix, by - 50, tw2, 42, {}); text(VIEW.tip.s, ix + 14, by - 22, { px: 17, w: 700 }); } } else VIEW.tip = null;
  // 氣勢與主動技（按鈕 64 高；合體技缺誰就把誰變灰；氣勢不夠顯示要多少）
  const rx = 898, rw = W - rx - 8; wood(rx, by, rw, 92);
  icon(c, 'mom', rx + 18, by + 12, 22); bar(rx + 34, by + 7, rw - 46, 10, (s.momentum || 0) / 100, GOLD, { ticks: [.6] });
  const UN = s.unites || D.UNITES || [], bw = (rw - 28) / 3, onField = id => s.slots.some(q => q.tw && q.tw.id === id);
  UN.slice(0, 2).forEach((u, j) => { const ok = C.canUnite ? !!C.canUnite(s, u.key) : (s.momentum >= (u.cost || 60)), cd = (s.cds || {})[u.key] || 0, bx1 = rx + 7 + j * (bw + 7);
    button(bx1, by + 22, bw, 64, '', { off: !ok, hot: ok, down: VIEW.down === 'unite:' + u.key || G.aim === u.key });
    u.who.forEach((w, k) => { const here = onField(w); c.save(); if (!here) c.filter = 'grayscale(1) brightness(.6)'; c.globalAlpha = ok || here ? 1 : .6; head(c, w, bx1 + bw / 2 + (k ? 15 : -15), by + 50, 34); c.restore(); });
    if (cd > 0) num(Math.ceil(cd), bx1 + bw / 2, by + 60, 22, { align: 'center' });
    else if (!ok && u.who.every(onField) && (s.momentum || 0) < (u.cost || 60)) { icon(c, 'mom', bx1 + 16, by + 76, 16); text(String(u.cost || 60), bx1 + 26, by + 81, { px: 13, col: '#8a7d66', w: 900 }); }
    zone(bx1, by + 20, bw, 70, 'unite:' + u.key); });
  if (C.useSuper) { const full = (s.momentum || 0) >= (D.RULE?.superCost || 100), bx2 = rx + rw - bw - 7, on = G.pickSuper; button(bx2, by + 22, bw, 64, '', { off: !full, hot: full, down: VIEW.down === 'super' || on });
    c.globalAlpha = full ? 1 : .5; icon(c, 'super', bx2 + bw / 2, by + 52, on ? 50 : 42, '★'); c.globalAlpha = 1; if (on) icon(c, 'finger', bx2 + bw / 2, by - 10 - Math.abs(Math.sin(t * 5)) * 8, 34); zone(bx2, by + 20, bw, 70, 'super'); }
  // 暫停：地圖變暗，暫停鍵發亮；聲音開關在這裡
  if (G.paused) { c.fillStyle = 'rgba(20,13,8,.55)'; c.fillRect(0, 84, W, 400); const dn = VIEW.down === 'mute' ? 3 : 0; button(W / 2 - 50, 250, 100, 84, '', { down: VIEW.down === 'mute' }); icon(c, G.mute ? 'snd_off' : 'snd_on', W / 2, 292 + dn, 52, '♪'); zone(W / 2 - 54, 246, 108, 92, 'mute'); }
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
  // 三格圖解：①調派→同事→工位 ②同名同級＋＝升職 ③敵人→打卡機＝底氣−1
  const px0 = 116, py = 262; c.fillStyle = 'rgba(43,31,24,.08)'; for (let i = 0; i < 3; i++) c.fillRect(px0 + i * 170, py - 34, 158, 70);
  icon(c, 'summon', px0 + 26, py, 40); text('→', px0 + 52, py + 9, { px: 22, w: 900, col: INK2 }); head(c, 'kui', px0 + 92, py, 40); text('→', px0 + 116, py + 9, { px: 22, w: 900, col: INK2 }); c.strokeStyle = TEAL; c.lineWidth = 3; c.setLineDash([5, 4]); c.strokeRect(px0 + 132, py - 14, 22, 28); c.setLineDash([]);
  head(c, 'jie', px0 + 196, py, 36); text('+', px0 + 218, py + 8, { px: 22, w: 900, col: INK2 }); head(c, 'jie', px0 + 240, py, 36); text('=', px0 + 262, py + 8, { px: 22, w: 900, col: INK2 }); icon(c, 'promote', px0 + 298, py, 40);
  foeMini(c, 'minion', px0 + 362, py + 22, 42);
  text('→', px0 + 380, py + 9, { px: 22, w: 900, col: INK2 }); icon(c, 'clock_ng', px0 + 420, py, 40); icon(c, 'heart', px0 + 456, py - 6, 26); text('−1', px0 + 446, py + 26, { px: 16, col: RED, w: 900 });
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
  stamp(r.win ? '準時下班' : '留下加班', 610, 200, { px: 40, col: r.win ? TEAL : RED, rot: -.1 }); icon(c, r.win ? 'clock_ok' : 'clock_ng', 800, 200, 64);
  const rows = [['wave', `${r.wave} / ${D.WAVES.length}`], ['ko2', `${r.kills}`], ['heart', `${r.lives}`], ['speed', `${Math.floor(r.t / 60)}:${String(Math.floor(r.t % 60)).padStart(2, '0')}`]];
  rows.forEach(([ic, b], i) => { icon(c, ic, 470, 272 + i * 36, 30); text(b, 830, 282 + i * 36, { px: 24, align: 'right', w: 900 }); });
  button(430, 408, 200, 72, '', { hot: true, down: VIEW.down === 'again' }); icon(c, 'replay', 530, 444, 50, '↻'); zone(430, 408, 200, 72, 'again');
  button(650, 408, 200, 72, '', { down: VIEW.down === 'title' }); icon(c, 'home', 750, 444, 50, '⌂'); zone(650, 408, 200, 72, 'title');
  G.zones = VIEW.zones;
}
