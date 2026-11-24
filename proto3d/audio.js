// 準時下班防衛戰 3D 版｜聲音：全部是專案自己用程式合成的檔案（audio/，做法見 design/audio/README.md）
// 瀏覽器要等玩家點一下才准出聲，所以由標題畫面的「開始」來啟動。
let actx = null, master = null, bgmGain = null, bgmNode = null, bgmKey = '', muted = false;
const SND = {}, last = {};
const SFX = ['card', 'confirm', 'cursor', 'coin', 'hit', 'slash', 'dark_blast', 'explosion', 'explosion_big', 'heal', 'holy_cast', 'boss_appear', 'boss_down', 'fanfare', 'defeat', 'break', 'buff', 'stun', 'shield_up', 'whoosh', 'encounter', 'weak', 'pop', 'squeak_1', 'squeak_2', 'train'];
const VAR = ['slash', 'hit', 'explosion', 'break', 'holy_cast', 'dark_blast', 'pop', 'coin'];
try { muted = localStorage.getItem('a4td3d_mute') === '1'; } catch (e) { /* 讀不到就當沒靜音 */ }

export function startAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  actx = new AC(); master = actx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(actx.destination);
  bgmGain = actx.createGain(); bgmGain.gain.value = 0.42; bgmGain.connect(master);
  const dec = async (k, src) => { try { const b = await (await fetch(src)).arrayBuffer(); SND[k] = await actx.decodeAudioData(b); } catch (e) { /* 少一個聲音不影響玩 */ } };
  SFX.forEach(k => dec(k, `../audio/sfx/${k}.${k === 'whoosh' ? 'wav' : 'mp3'}`));
  VAR.forEach(k => [2, 3].forEach(n => dec(`${k}_${n}`, `../audio/sfx/${k}_${n}.mp3`)));
  for (const k of ['map', 'battle', 'boss', 'victory', 'lose']) dec('bgm_' + k, `../audio/bgm/${k}.mp3`);
}
export function sfx(k, vol = 0.6, rate = 1, gap = 0.06) {
  if (!actx || muted) return; const key = k, now = actx.currentTime;
  if (last[key] && now - last[key] < gap) return;                       // 同一種聲音太密就跳過，免得糊成一片
  if (VAR.includes(k)) { const vs = [k, k + '_2', k + '_3'].filter(v => SND[v]); if (vs.length) k = vs[(Math.random() * vs.length) | 0]; }
  if (!SND[k]) return; last[key] = now;
  const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = SND[k]; s.playbackRate.value = rate * (0.96 + Math.random() * 0.08); g.gain.value = vol; s.connect(g); g.connect(master); s.start();
}
export function bgm(k) {
  if (!actx || bgmKey === k) return; const buf = SND['bgm_' + k];
  if (!buf) { setTimeout(() => { if (bgmKey !== k) bgm(k); }, 700); return; }
  stopBgm(0.4);
  const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = buf; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(1, actx.currentTime, 0.5); s.connect(g); g.connect(bgmGain); s.start(); s._g = g; bgmNode = s; bgmKey = k;
}
export function jingle(k) { if (!actx) return; const buf = SND['bgm_' + k]; if (!buf) return; stopBgm(0.2); const s = actx.createBufferSource(); s.buffer = buf; s.connect(bgmGain); s.start(); }
export function stopBgm(t = 0.3) { if (!bgmNode) return; const o = bgmNode; o._g.gain.setTargetAtTime(0, actx.currentTime, t); setTimeout(() => { try { o.stop(); } catch (e) { /* 已經停了 */ } }, 1800); bgmNode = null; bgmKey = ''; }
export function setMute(on) { muted = on; if (master) master.gain.value = on ? 0 : 1; try { localStorage.setItem('a4td3d_mute', on ? '1' : '0'); } catch (e) { /* 存不了就算了 */ } }
export const isMuted = () => muted;
// 頁面切到背景就先停，回來再繼續（手機鎖屏不會一直響）
document.addEventListener('visibilitychange', () => { if (!actx) return; if (document.hidden) actx.suspend(); else actx.resume(); });
