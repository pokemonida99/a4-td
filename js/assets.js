// 素材載入：圖片、Q 版角色表（art/q/<id>.json）、音效、配樂。
// Q 版圖還沒到的角色，退回用 RPG 的側面小人縮小頂著（fallback），畫面程式不用管差別。
export const IMG = {}, Q = {}, SND = {};
let actx = null, bgmNode = null, bgmGain = null, bgmKey = '', master = null;
export const PREF = { snd: 1, bgm: .55 };
const QS = new URLSearchParams(location.search);
export const STYLE = QS.get('style') || 'c', MAPSTYLE = QS.get('map') || (STYLE === 'b' ? 'paint' : 'pixel');      // 11/23 使用者選定 C 版（精緻像素 3 頭身）＋像素地圖；?style=a|b 還能看其他樣張

const img = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const json = src => fetch(src).then(r => r.ok ? r.json() : null).catch(() => null);

export const UI_ICONS = ['el_slash', 'el_blunt', 'el_fire', 'el_ice', 'el_holy', 'el_dark', 'res', 'coin', 'ko', 'life', 'wave', 'call', 'speed', 'pause', 'snd_on', 'snd_off', 'summon', 'inbox', 'dmg', 'aspd', 'range', 'refund', 'move', 'promote', 'mom', 'super', 'fatigue', 'shield', 'guard', 'charge'];
export const HEROES = ['kui', 'jie', 'kevin', 'mi', 'yan', 'zhe', 'heilun', 'cha', 'qiang', 'senpai', 'you', 'xu', 'wu', 'fairy', 'an', 'vivi'];
export const FOE_ART = { minion: 'minion', courier: 'courier', knight: 'knight', intern: 'intern', auntie: 'auntie', smoker: 'smoker', chief: 'chief', boss: 'boss', parrot: 'parrot', monkey: 'monkey', pig: 'pig', audit: 'audit' };
const DIRS = ['down', 'dside', 'side', 'uside', 'up'];      // 8 方向：畫 5 個（斜前 dside、斜後 uside 都面向右），左邊翻轉

// 一個角色的 Q 版表：{ cell, foot, frames, scale, strips: { 'idle_down': Image, ... } }
async function loadQ(id) {
  let dir = 'art/q', meta = QS.get('style') ? null : await json(`${dir}/${id}.json`);      // 正式圖（美術 session 做的）優先，沒有就用樣張
  if (!meta) { dir = `art/q_${STYLE}`; meta = await json(`${dir}/${id}.json`); } if (!meta) return null;
  const strips = {};
  await Promise.all(Object.keys(meta.frames).flatMap(a => DIRS.map(async d => { const im = await img(`${dir}/${id}_${a}_${d}.png`); if (im) strips[`${a}_${d}`] = im; })));
  return { ...meta, strips };
}

export async function loadAll(onProg) {
  const jobs = [];
  for (const id of HEROES) {
    jobs.push(img(`art/chars/${id}_ready.png`).then(i => IMG[`${id}_ready`] = i));
    jobs.push(img(`art/chars/${id}_act.png`).then(i => IMG[`${id}_act`] = i));
    jobs.push(img(`art/bust/bust_${id}.png`).then(i => IMG[`bust_${id}`] = i));
    jobs.push(loadQ(id).then(q => { if (q) Q[id] = q; }));
  }
  for (const k in FOE_ART) {
    const a = FOE_ART[k];
    jobs.push(img(`art/enemy/${a}_idle.png`).then(i => IMG[`foe_${k}`] = i));
    jobs.push(img(`art/enemy/${a}_${['chief', 'boss', 'parrot', 'monkey', 'pig', 'audit'].includes(a) ? 'hurt' : 'hit'}.png`).then(i => IMG[`foe_${k}_hit`] = i));
    jobs.push(loadQ(`foe_${k}`).then(q => { if (q) Q[`foe_${k}`] = q; }));
  }
  jobs.push(img(`art/map/office_${MAPSTYLE}.jpg`).then(i => IMG.map = i));
  jobs.push(img('art/chars/hui_ready.png').then(i => IMG.mouse = i));
  jobs.push(img('art/map/pad.png').then(i => IMG.pad = i));
  jobs.push(json('art/map/pad.json').then(j => IMG.padMeta = j));
  for (const k of ['clock', 'boss', 'battle', 'shop', 'rest', 'recruit']) jobs.push(img(`art/icons/${k}.png`).then(i => IMG[`ic_${k}`] = i));
  for (const k of UI_ICONS) jobs.push(img(`art/ui/${k}.png`).then(i => { if (i) IMG[`ui_${k}`] = i; }));      // 介面圖示（tools/ui_icons.py 切的）
  let done = 0; const n = jobs.length;
  await Promise.all(jobs.map(p => p.then(() => onProg && onProg(++done / n))));
}

// ---------- 聲音 ----------
const SFX = ['card', 'confirm', 'cursor', 'coin', 'hit', 'hit_alt', 'slash', 'slash_alt', 'dark_blast', 'explosion', 'explosion_big', 'heal', 'holy_cast', 'boss_appear', 'boss_down', 'fanfare', 'defeat', 'break', 'buff', 'unite', 'cutin', 'stun', 'shield_up', 'whoosh', 'poison', 'train', 'encounter', 'weak', 'wok_back', 'paper_storm', 'boss_charge', 'shield_block'];
export async function startAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.connect(actx.destination);
  bgmGain = actx.createGain(); bgmGain.gain.value = PREF.bgm; bgmGain.connect(master);
  const dec = async (k, src) => { try { const b = await (await fetch(src)).arrayBuffer(); SND[k] = await actx.decodeAudioData(b); } catch (e) { } };
  SFX.forEach(k => dec(k, `audio/sfx/${k}.${k === 'whoosh' ? 'wav' : 'mp3'}`));
  for (const k of ['battle', 'boss', 'map', 'victory']) dec('bgm_' + k, `audio/bgm/${k}.mp3`);
}
const lastPlay = {};
export function sfx(k, vol = .7, rate = 1) {
  if (!actx || !PREF.snd || !SND[k]) return;
  const now = actx.currentTime; if (lastPlay[k] && now - lastPlay[k] < .06) return; lastPlay[k] = now;      // 同一個聲音太密就跳過，免得爆音
  const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = SND[k]; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g); g.connect(master); s.start();
}
export function bgm(k) {
  if (!actx || bgmKey === k) return; const buf = SND['bgm_' + k];
  if (!buf) { setTimeout(() => bgm(k), 600); return; }
  if (bgmNode) { const old = bgmNode, og = old._g; og.gain.setTargetAtTime(0, actx.currentTime, .4); setTimeout(() => old.stop(), 2000); }
  const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = buf; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(1, actx.currentTime, .5); s.connect(g); g.connect(bgmGain); s.start(); s._g = g; bgmNode = s; bgmKey = k;
}
export function stopBgm() { if (bgmNode) { bgmNode._g.gain.setTargetAtTime(0, actx.currentTime, .3); const o = bgmNode; setTimeout(() => o.stop(), 1500); bgmNode = null; bgmKey = ''; } }
export function setMute(on) { PREF.snd = on ? 0 : 1; if (master) master.gain.value = on ? 0 : 1; }
