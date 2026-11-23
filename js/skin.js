// 介面材質：沿用《上班旅人》的「董事會」——胡桃木、米白議程紙、氧化銅夾子、紅色印章。
// 材質用程式畫成小張像素圖再放大，顆粒感跟像素角色一致；不用漸層大圓角。
export const W = 1280, H = 590;
export const INK = '#2b1f18', INK2 = '#6a5846', CREAM = '#efe6cf', TEAL = '#3f7f72', RED = '#b23a30', BRASS = '#caa24c', GOLD = '#f2c94c';
export const SANS = '"Noto Sans TC", "PingFang TC", sans-serif', SERIF = '"Songti TC", "Noto Serif TC", serif';
export const ELEM = { slash: ['斬', '#e8e4d8'], blunt: ['打', '#d99a4e'], fire: ['火', '#ff7a2e'], ice: ['冰', '#7fd4f0'], holy: ['光', '#ffe27a'], dark: ['暗', '#b083f0'] };
export const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

let c, WOOD, WOOD_D, PAPER, PAPER2, FLOOR;
const tex = (w, h, paint, k = 3) => { const lo = document.createElement('canvas'); lo.width = w; lo.height = h; paint(lo.getContext('2d'), w, h); const up = document.createElement('canvas'); up.width = w * k; up.height = h * k; const x = up.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(lo, 0, 0, w * k, h * k); return c.createPattern(up, 'repeat'); };
export function initSkin(ctx) {
  c = ctx;
  const wood = dark => (x, w, h) => { for (let j = 0; j < h; j++) { const v = rnd(j * 3.7) * .5 + rnd(Math.floor(j / 3) * 9.1) * .5, m = dark ? .62 : 1, r = (70 + v * 22) * m, g = (43 + v * 14) * m, b = (28 + v * 10) * m; x.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; x.fillRect(0, j, w, 1); }
    for (let i = 0; i < 70; i++) { const y = Math.floor(rnd(i * 5.3) * h), x0 = Math.floor(rnd(i * 2.9) * w), len = 6 + Math.floor(rnd(i * 7.7) * 40); x.fillStyle = rnd(i) < .6 ? 'rgba(30,16,8,.45)' : 'rgba(150,104,66,.3)'; x.fillRect(x0, y, len, 1); if (x0 + len > w) x.fillRect(0, y, x0 + len - w, 1); } };
  WOOD = tex(128, 64, wood(false)); WOOD_D = tex(128, 64, wood(true));
  PAPER = tex(64, 64, (x, w, h) => { x.fillStyle = '#e6dcc2'; x.fillRect(0, 0, w, h); for (let i = 0; i < 520; i++) { const v = rnd(i * 1.7); x.fillStyle = v < .5 ? 'rgba(120,100,70,.14)' : 'rgba(255,250,235,.3)'; x.fillRect(Math.floor(rnd(i * 3.1) * w), Math.floor(rnd(i * 7.3) * h), 1 + (v > .9), 1); } });
  PAPER2 = tex(64, 64, (x, w, h) => { x.fillStyle = '#c9bfa6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(90,76,56,.16)'; x.fillRect(Math.floor(rnd(i * 3.3) * w), Math.floor(rnd(i * 6.1) * h), 1, 1); } });
  FLOOR = tex(32, 32, (x, w, h) => { x.fillStyle = '#5d6b63'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = rnd(i * 2.3) < .5 ? 'rgba(30,40,36,.25)' : 'rgba(150,170,160,.12)'; x.fillRect(Math.floor(rnd(i * 4.1) * w), Math.floor(rnd(i * 8.9) * h), 1, 1); } x.fillStyle = 'rgba(20,28,25,.35)'; x.fillRect(0, 0, w, 1); x.fillRect(0, 0, 1, h); });
}
export const pats = () => ({ WOOD, WOOD_D, PAPER, PAPER2, FLOOR });

export const font = (px, w = 700, fam = SANS) => { c.font = `${w} ${px}px ${fam}`; };
export function text(s, x, y, o = {}) {
  font(o.px ?? 22, o.w ?? 700, o.fam ?? SANS); c.textAlign = o.align ?? 'left'; c.textBaseline = o.base ?? 'alphabetic';
  if (o.stroke) { c.lineWidth = o.sw ?? 4; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  if (o.shadow) { c.fillStyle = o.shadow; c.fillText(s, x + 2, y + 2); }
  c.fillStyle = o.col ?? INK; c.fillText(s, x, y); return c.measureText(s).width;
}
export function wood(x, y, w, h, o = {}) {
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x + 3, y + 4, w, h); c.fillStyle = o.dark ? WOOD_D : WOOD; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(255,214,160,.14)'; c.fillRect(x, y, w, 2); c.fillStyle = 'rgba(20,10,4,.5)'; c.fillRect(x, y + h - 3, w, 3); c.strokeStyle = '#24130b'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (o.studs) for (const [sx, sy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) stud(sx, sy);
}
export function stud(x, y) { c.fillStyle = '#3a240e'; c.fillRect(x - 4, y - 4, 8, 8); c.fillStyle = BRASS; c.fillRect(x - 3, y - 3, 6, 6); c.fillStyle = '#f2dc96'; c.fillRect(x - 2, y - 2, 2, 2); }
export function paper(x, y, w, h, o = {}) {
  c.save(); if (o.tilt) { c.translate(x + w / 2, y + h / 2); c.rotate(o.tilt); c.translate(-x - w / 2, -y - h / 2); }
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 3, y + 4, w, h); c.fillStyle = o.old ? PAPER2 : PAPER; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(120,95,60,.25)'; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h);
  if (o.lines) { c.fillStyle = 'rgba(63,127,114,.18)'; for (let ly = y + 26; ly < y + h - 6; ly += 22) c.fillRect(x + 8, ly, w - 16, 1); }
  if (o.clip) clip(x + w / 2, y);
  c.restore();
}
export function clip(x, y) { c.fillStyle = '#2d3b36'; c.fillRect(x - 15, y - 7, 30, 13); c.fillStyle = '#5f8c80'; c.fillRect(x - 14, y - 6, 28, 10); c.fillStyle = '#9cc4b6'; c.fillRect(x - 12, y - 5, 24, 2); c.fillStyle = '#2d3b36'; c.fillRect(x - 8, y - 2, 16, 2); }
// 印章：紅色方框字，蓋上去會稍微歪
export function stamp(s, x, y, o = {}) {
  c.save(); c.translate(x, y); c.rotate(o.rot ?? -.12); const px = o.px ?? 22; font(px, 900, SERIF); const w = c.measureText(s).width + 16, h = px + 12;
  c.globalAlpha = o.a ?? .9; c.strokeStyle = o.col ?? RED; c.lineWidth = 3; c.strokeRect(-w / 2, -h / 2, w, h); c.lineWidth = 1; c.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
  c.fillStyle = o.col ?? RED; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 2); c.restore();
}
// 按鈕：木牌＋紙面；off＝不能按（舊紙）；hot＝可以按且重要（紅印邊）
export function button(x, y, w, h, label, o = {}) {
  const down = o.down;
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x + 3, y + 5, w, h); const oy = down ? 3 : 0;
  c.fillStyle = WOOD_D; c.fillRect(x, y + oy, w, h); c.fillStyle = o.off ? PAPER2 : PAPER; c.fillRect(x + 4, y + 4 + oy, w - 8, h - 8);
  if (o.hot && !o.off) { c.strokeStyle = RED; c.lineWidth = 3; c.strokeRect(x + 7, y + 7 + oy, w - 14, h - 14); }
  c.strokeStyle = '#24130b'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1 + oy, w - 2, h - 2);
  if (label) text(label, x + w / 2, y + h / 2 + oy + (o.sub ? -6 : 1), { px: o.px ?? 24, align: 'center', base: 'middle', col: o.off ? '#8a7d66' : INK, fam: o.fam ?? SANS, w: 900 });
  if (o.sub) text(o.sub, x + w / 2, y + h / 2 + oy + 16, { px: 15, align: 'center', base: 'middle', col: o.off ? '#8a7d66' : (o.subCol ?? INK2), w: 700 });
}
export function bar(x, y, w, h, k, col, o = {}) {
  c.fillStyle = '#1a0f08'; c.fillRect(x - 2, y - 2, w + 4, h + 4); c.fillStyle = o.bg ?? '#3d2a1c'; c.fillRect(x, y, w, h);
  c.fillStyle = col; c.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), h); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), Math.max(1, h / 4));
  if (o.ticks) { c.fillStyle = 'rgba(0,0,0,.45)'; for (const t of o.ticks) c.fillRect(x + Math.round(w * t) - 1, y - 2, 2, h + 4); }
}
