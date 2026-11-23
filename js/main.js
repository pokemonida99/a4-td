// 畫面主程式：縮放、輸入（觸控點選＋拖曳）、主迴圈、標題／對戰／結案三個畫面。
// 規則全部在 core.js（子 session 維護），這裡只讀狀態、送玩家操作、演 s.ev 事件。
import * as C from './core.js';
import * as D from './data.js';
import { loadAll, startAudio, sfx, bgm, stopBgm, setMute, PREF, IMG } from './assets.js';
import { initSkin, W, H } from './skin.js';
import { drawWorld, drawHud, drawTitle, drawResult, fxFromEvents, FX, layout, slotAt, hudHit, say, resetView, VIEW } from './view.js';

const cv = document.getElementById('c'), c = cv.getContext('2d');
initSkin(c);
let scale = 1, ox = 0, oy = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), vw = innerWidth, vh = innerHeight;
  scale = Math.min(vw / W, vh / H); cv.style.width = `${W * scale}px`; cv.style.height = `${H * scale}px`;
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr); c.imageSmoothingEnabled = false; G.k = scale * dpr;
}
const G = window.__game = { scene: 'boot', s: null, sel: -1, drag: null, speed: 1, paused: false, k: 1, mute: false, t: 0 };
addEventListener('resize', resize); resize();

// ---------- 擋放大、選取、長按選單 ----------
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'selectstart']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
let lastTouch = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 320) e.preventDefault(); lastTouch = n; }, { passive: false });

// ---------- 開局 ----------
function newRun() {
  if (MAPJSON && C.setMap && !G.mapSet) { C.setMap('office', MAPJSON); G.mapSet = true; }
  G.s = C.newGame({ seed: (Date.now() & 0xffffff) }); G.sel = -1; G.drag = null; G.paused = false; G.pickSuper = false; G.aim = null; resetView();
  G.scene = 'play'; bgm('battle'); say('intro');
}
G.newRun = newRun; G.say = say;      // 測試用

// ---------- 輸入 ----------
const toLogic = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
let press = null;
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); startAudio(); const p = toLogic(e); press = { ...p, t: performance.now(), moved: false };
  if (G.scene === 'play') { const i = slotAt(G.s, p.x, p.y); if (i >= 0 && G.s.slots[i].tw) press.slot = i; }
  VIEW.down = hudHit(G, p.x, p.y);
});
cv.addEventListener('pointermove', e => {
  const p = toLogic(e); VIEW.hover = p; if (!press) return;
  if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) > 14) press.moved = true;
  if (press.moved && press.slot != null && G.scene === 'play') { G.drag = { from: press.slot, x: p.x, y: p.y }; G.sel = press.slot; }
});
cv.addEventListener('pointerup', e => {
  const p = toLogic(e), pr = press; press = null; VIEW.down = null; if (!pr) return;
  if (G.drag) { const to = slotAt(G.s, p.x, p.y); if (to >= 0 && to !== G.drag.from) act('drop', G.drag.from, to); G.drag = null; G.sel = -1; return; }
  tap(p.x, p.y);
});
cv.addEventListener('pointercancel', () => { press = null; G.drag = null; VIEW.down = null; });

function tap(x, y) {
  if (G.scene === 'title') { const h = hudHit(G, x, y); if (h === 'start') { sfx('confirm'); newRun(); } return; }
  if (G.scene === 'result') { const h = hudHit(G, x, y); if (h === 'again') { sfx('confirm'); newRun(); } else if (h === 'title') { G.scene = 'title'; bgm('map'); } return; }
  if (G.scene !== 'play') return;
  const s = G.s, h = hudHit(G, x, y);
  if (h) return hud(h);
  if (G.aim) { const key = G.aim; G.aim = null; if (y > 60 && y < 486) act('unite', key, x, y); return; }
  const i = slotAt(s, x, y);
  if (G.pickSuper) { G.pickSuper = false; if (i >= 0 && s.slots[i].tw) act('super', i); return; }
  if (i < 0) { G.sel = -1; return; }
  if (s.pending && !s.slots[i].tw && C.place) return act('place', i);
  if (s.pending && C.place && s.slots[i].tw) return act('place', i);      // 報到中的人點到同名同級＝直接合併（規則那邊判斷）
  if (G.sel >= 0 && G.sel !== i) { if (!act('drop', G.sel, i)) { sfx('cursor', .3); if (s.slots[i].tw) { G.sel = i; return; } } G.sel = -1; return; }
  if (G.sel === i) { G.sel = -1; return; }
  if (s.slots[i].tw) { G.sel = i; sfx('cursor', .5); }
}
function hud(h) {
  const s = G.s;
  if (h === 'summon') return act('summon');
  if (h === 'speed') { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1; sfx('cursor', .5); return; }
  if (h === 'pause') { G.paused = !G.paused; sfx('cursor', .5); return; }
  if (h === 'mute') { G.mute = !G.mute; setMute(G.mute); return; }
  if (h === 'sell' && G.sel >= 0) { act('sell', G.sel); G.sel = -1; return; }
  if (h === 'upgrade' && G.sel >= 0 && C.upgrade) { if (!act('upgrade', G.sel)) sfx('cursor', .3); return; }
  if (h === 'discard' && C.discard) return act('discard');
  if (h.startsWith('unite:') && C.useUnite) { const key = h.slice(6), u = (s.unites || D.UNITES).find(q => q.key === key); if (!C.canUnite(s, key)) { sfx('cursor', .3); return; } if (u && u.kind === 'team') { G.aim = null; return act('unite', key); } G.aim = G.aim === key ? null : key; G.pickSuper = false; sfx('cursor', .6); return; }      // 合體技：先瞄準，點地圖才發動
  if (h === 'super' && C.useSuper) { if (G.sel >= 0) { act('super', G.sel); G.pickSuper = false; return; } const full = (s.momentum || 0) >= ((D.RULE && D.RULE.superCost) || 100); if (!full) { sfx('cursor', .3); return; } G.pickSuper = !G.pickSuper; sfx('cursor', .6); return; }      // 沒選人：進入「選一位同事」模式
  if (h === 'deselect') { G.sel = -1; return; }
  if (h === 'trait' && G.sel >= 0 && s.slots[G.sel].tw) { const id = s.slots[G.sel].tw.id; VIEW.tip = { s: (D.TOWERS[id] && D.TOWERS[id].note) || '', t: 0 }; sfx('cursor', .5); return; }
  if (h === 'call' && C.callWave) { if (C.callWave(s)) sfx('confirm', .7); return; }
}
function act(kind, a, b) {
  const s = G.s; let ok;
  if (kind === 'summon') { ok = C.summon(s); sfx(ok ? 'card' : 'cursor', ok ? .8 : .3); if (ok) VIEW.summonT = .35; }
  else if (kind === 'place') { ok = C.place(s, a); sfx(ok ? 'confirm' : 'cursor', .6); }
  else if (kind === 'drop') { ok = C.drop(s, a, b); }
  else if (kind === 'sell') { ok = C.sell(s, a); sfx('coin', .6); }
  else if (kind === 'upgrade') { ok = C.canUpgrade(s, a) && C.upgrade(s, a); }
  else if (kind === 'discard') { ok = C.discard(s); sfx('coin', .6); }
  else if (kind === 'unite') { ok = C.useUnite(s, a, b, arguments[3]); }
  else if (kind === 'super') { ok = C.useSuper(s, a); }
  return ok;
}

// ---------- 主迴圈 ----------
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now; G.t += dt;
  c.setTransform(G.k, 0, 0, G.k, 0, 0); c.imageSmoothingEnabled = false;
  if (G.scene === 'play') {
    const s = G.s;
    if (!G.paused && s.state === 'play') {
      acc += dt * G.speed; let n = 0;
      while (acc >= C.DT && n++ < 12) { C.step(s, C.DT); acc -= C.DT; fxFromEvents(s, G); }
    } else acc = 0;
    if (s.state !== 'play' && !G.endT) { G.endT = G.t; }
    if (G.endT && G.t - G.endT > 2.2) { G.endT = 0; G.scene = 'result'; G.result = { win: s.state === 'win', wave: s.wave, kills: s.kills, t: s.t, lives: s.lives }; }
    drawWorld(c, G, dt); drawHud(c, G, dt);
  } else if (G.scene === 'title') drawTitle(c, G, dt);
  else if (G.scene === 'result') { drawWorld(c, G, dt); drawResult(c, G, dt); }
  requestAnimationFrame(frame);
}

// ---------- 開機 ----------
const boot = document.getElementById('boot');
let MAPJSON = null; fetch('art/map/office.json').then(r => r.ok ? r.json() : null).then(j => MAPJSON = j).catch(() => {});
loadAll(k => boot.textContent = `載入中 ${Math.round(k * 100)}%`).then(() => {
  boot.remove(); G.scene = 'title'; requestAnimationFrame(frame);
  const q = new URLSearchParams(location.search); if (q.has('play')) newRun();
  window.__bootDone = true;
});
