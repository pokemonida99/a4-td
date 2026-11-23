"""塔防的聲音合成引擎：全部用 numpy 算波形，不用任何外部服務、取樣或素材庫。
audio_bgm.py（配樂）、audio_sfx.py（音效）、audio_check.py（聽檢短片）共用。

樂器：steelpan 鋼鼓、marimba 馬林巴、glock 鐵琴、bass 彈跳貝斯、brass 銅管、pluck 撥弦（Karplus-Strong，烏克麗麗刷弦）
鼓組：kick、snare、clap、hat、shaker、tom、wood（木魚）
編曲：Song（以拍為單位放音符；循環曲把超出結尾的尾巴折回開頭，接縫無縫）
輸出：loudness()（ffmpeg ebur128 量 LUFS）、master()（正規化＋限幅）、write_mp3()"""
import os, re, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, minimum_filter1d

SR = 44100
RNG = np.random.default_rng(20261123)
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


# ---------- 音高 ----------
def m(n):
    """'C#5' → MIDI 編號（數字原樣回傳）"""
    if not isinstance(n, str): return n
    i, acc = 1, 0
    while i < len(n) and n[i] in '#b': acc += 1 if n[i] == '#' else -1; i += 1
    return NOTE[n[0]] + acc + 12 * (int(n[i:]) + 1)
def hz(n): return 440.0 * 2 ** ((m(n) - 69) / 12)
def T(sec): return np.arange(max(1, int(sec * SR))) / SR

CHORD = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11],
         'dim': [0, 3, 6], 'sus4': [0, 5, 7], '6': [0, 4, 7, 9], 'add9': [0, 4, 7, 14]}
def chord(name):
    """'Bb' → (根音音級 0～11, 音程表)"""
    i = 2 if len(name) > 1 and name[1] in '#b' else 1
    return m(name[:i] + '0') % 12, CHORD[name[i:]]
def voicing(name, lo, hi):
    """把和弦音排在 [lo, hi] 的 MIDI 範圍內（由低到高）"""
    r, ivs = chord(name); pcs = {(r + v) % 12 for v in ivs}
    return [n for n in range(m(lo), m(hi) + 1) if n % 12 in pcs]


# ---------- 濾波與包絡 ----------
def _sos(kind, fc, order=2): return signal.butter(order, fc, kind, fs=SR, output='sos')
def lp(x, fc, order=2): return signal.sosfilt(_sos('lowpass', min(fc, SR * .45), order), x)
def hp(x, fc, order=2): return signal.sosfilt(_sos('highpass', fc, order), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(_sos('bandpass', [lo, min(hi, SR * .45)], order), x)
def noise(n): return RNG.standard_normal(n)
def att(t, a): return np.clip(t / a, 0, 1) if a > 0 else np.ones_like(t)
def rel(t, gate, r):
    """gate 之前 1，之後以 r 秒指數收掉（讓音尾乾淨、不拖殘響）"""
    return np.where(t < gate, 1.0, np.exp(-(t - gate) / r))
def phase(freq):
    """頻率（可為陣列）→ 相位"""
    f = np.broadcast_to(np.asarray(freq, float), np.shape(freq) if np.ndim(freq) else (1,))
    return 2 * np.pi * np.cumsum(f) / SR


# ---------- 樂器 ----------
def steelpan(f, gate=.3, vel=.8):
    """鋼鼓：強的二次泛音、起音一點點音高下滑、兩層微走音的閃爍感"""
    t = T(gate + .45); bend = 1 + .012 * np.exp(-t / .015); tau = .5 * (440 / f) ** .35; out = np.zeros_like(t)
    for k, a, tk in ((1, 1, 1), (2, .62, .55), (3, .2, .33), (4.03, .09, .18), (5.1, .04, .08)):
        if f * k > 9000: continue
        for det, w in ((1, 1), (1.0018, .32)):
            out += a * w * np.sin(phase(f * k * det * bend)) * np.exp(-t / (tau * tk))
    return out * att(t, .002) * rel(t, gate + .05, .07) * vel * .45

def marimba(f, gate=.3, vel=.8):
    """馬林巴：基音＋3.93 倍、9.2 倍泛音快速衰減＋木槌聲"""
    tau = float(np.clip(.42 * (300 / f) ** .6, .07, .6)); t = T(min(gate + .3, tau * 6) + .05)
    out = np.sin(2 * np.pi * f * t) * np.exp(-t / tau) + .22 * np.sin(2 * np.pi * 3.93 * f * t) * np.exp(-t / (tau * .14))
    if f * 9.2 < 9000: out += .05 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t / .012)
    out += lp(noise(len(t)), 3000) * np.exp(-t / .002) * .12
    return out * att(t, .0008) * rel(t, gate + .08, .05) * vel * .55

def glock(f, gate=.2, vel=.7):
    """鐵琴：清亮的鈴聲（閃光、金幣、升職用）"""
    t = T(gate + .3); out = np.zeros_like(t)
    for k, a, tau in ((1, 1, .3), (2.76, .3, .1), (5.4, .12, .035), (8.93, .05, .015)):
        if f * k < 10000: out += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / tau)
    return out * att(t, .001) * rel(t, gate + .04, .045) * vel * .4

def harm(f, t, fc, nmax=40, pitch=1.0):
    """鋸齒波泛音逐條加，每條乘上隨時間變的低通權重（fc 可為陣列）"""
    ph = phase(f * np.broadcast_to(pitch, t.shape)); out = np.zeros_like(t); fmax = np.max(fc) * 6
    for k in range(1, nmax + 1):
        if f * k > min(12000, fmax): break
        out += np.sin(k * ph) * (1 / np.sqrt(1 + (k * f / fc) ** 4)) / k
    return out

def bass(f, gate=.25, vel=.8):
    """彈跳貝斯：濾波器一下打開再關、起音小小的音高彈跳"""
    t = T(gate + .1); pitch = 1 + .05 * np.exp(-t / .012); fc = 200 + 1300 * vel * np.exp(-t / .05)
    x = harm(f, t, fc, 30, pitch) * .8 + np.sin(phase(f * pitch)) * .7
    return x * att(t, .003) * (.55 + .45 * np.exp(-t / .12)) * rel(t, gate, .03) * vel * .6

def brass(f, gate=.3, vel=.8, voices=3, glide=None, bright=1.0, wah=None):
    """合成銅管：三層微走音、起音濾波器打開、長音加顫音；glide＝音高倍率陣列（滑音），wah＝外加濾波倍率陣列"""
    t = T(gate + .12)
    vib = 1 + .004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - .18) / .2, 0, 1)
    g = np.ones_like(t) if glide is None else np.concatenate([glide, np.full(max(0, len(t) - len(glide)), glide[-1])])[:len(t)]
    pitch = vib * (1 - .02 * np.exp(-t / .03)) * g
    fc = f * (1.2 + 5 * bright * vel * (1 - np.exp(-t / .035)) * (.75 + .25 * np.exp(-t / .25)))
    if wah is not None: fc = fc * np.concatenate([wah, np.full(max(0, len(t) - len(wah)), wah[-1])])[:len(t)]
    x = sum(harm(f * (1 + d), t, fc, 40, pitch) for d in (0, .0035, -.0035)[:voices])
    return x * att(t, .012) * (.8 + .2 * np.exp(-t / .1)) * rel(t, gate, .05) * vel * .22

def pluck(f, gate=.2, vel=.7, bright=.5, decay=.996):
    """Karplus-Strong 撥弦（烏克麗麗、吉他）"""
    n = max(2, int(round(SR / f - .5))); t = T(gate + .06); exc = np.zeros(len(t))
    exc[:n] = lp(noise(n), 800 + 6000 * bright)
    a = np.zeros(n + 2); a[0] = 1; a[n] = a[n + 1] = -decay / 2
    y = hp(signal.lfilter([1], a, exc), 90) * rel(t, gate, .02)
    return y / (np.abs(y).max() + 1e-9) * vel * .35

def strum(notes, gate=.15, vel=.6, gap=.007, **kw):
    """一次刷和弦：音一個個錯開 gap 秒"""
    parts = [pluck(hz(n), gate, vel * (.85 + .15 * RNG.random()), **kw) for n in notes]
    L = max(len(p) for p in parts) + int(gap * SR * len(notes)); out = np.zeros(L)
    for i, p in enumerate(parts): o = int(i * gap * SR); out[o:o + len(p)] += p
    return out / np.sqrt(len(notes))


# ---------- 鼓組（全部短、乾、不刺耳） ----------
def kick(vel=.8):
    t = T(.24); f = 58 + 95 * np.exp(-t / .03)
    return (np.sin(phase(f)) * np.exp(-t / .16) + hp(noise(len(t)), 2000) * np.exp(-t / .002) * .15) * vel * .9
def snare(vel=.7):
    t = T(.22)
    return (np.sin(2 * np.pi * 195 * t) * np.exp(-t / .05) * .5 + bp(noise(len(t)), 1200, 7000) * np.exp(-t / .07) * .6) * vel * .6
def clap(vel=.7):
    t = T(.2); e = sum(np.where(t >= d, np.exp(-(t - d) / .005), 0) for d in (0, .01, .021)) + np.where(t >= .03, np.exp(-(t - .03) / .06), 0) * .7
    return bp(noise(len(t)), 900, 2800) * e * vel * .5
def hat(vel=.5, open_=False):
    t = T(.18 if open_ else .05)
    return lp(hp(noise(len(t)), 6500), 11000) * np.exp(-t / (.09 if open_ else .018)) * vel * .35
def shaker(vel=.4):
    t = T(.07); return bp(noise(len(t)), 4000, 9000) * att(t, .012) * np.exp(-t / .03) * vel * .3
def tom(f=150, vel=.7):
    t = T(.3); return np.sin(phase(f * (1 + .4 * np.exp(-t / .03)))) * np.exp(-t / .14) * vel * .8
def wood(f=1100, vel=.6):
    t = T(.08); return (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.7 * t)) * np.exp(-t / .018) * vel * .5


# ---------- 編曲 ----------
class Song:
    """以拍為單位放聲音；loop=True 時把超出結尾的聲音折回開頭（循環接縫沒有斷音）"""
    def __init__(s, bpm, bars, loop=True, tail=3.0, swing=0.0):
        s.spb = 60 / bpm; s.bars = bars; s.loop = loop; s.swing = swing
        s.N = int(round(bars * 4 * s.spb * SR)); s.L = s.N + int(tail * SR)
        s.bus = {'dry': np.zeros((s.L, 2)), 'room': np.zeros((s.L, 2))}
    def at(s, beat):
        if s.swing and abs(beat % 1 - .5) < 1e-6: beat += s.swing * .5      # 8 分音符反拍往後推
        return int(round(beat * s.spb * SR))
    def add(s, beat, x, pan=0.0, gain=1.0, bus='dry', human=.003):
        i = s.at(beat) + (int(RNG.normal(0, human) * SR) if human else 0)
        if s.loop: i %= s.N
        elif i < 0: x = x[-i:]; i = 0
        L = min(len(x), s.L - i)
        if L <= 0: return
        a = (pan + 1) * np.pi / 4; b = s.bus[bus]
        b[i:i + L, 0] += x[:L] * gain * np.cos(a) * 1.414; b[i:i + L, 1] += x[:L] * gain * np.sin(a) * 1.414
    def note(s, beat, inst, n, dur, vel=.8, **kw):
        """dur 以拍為單位；inst 是上面的樂器函式"""
        s.add(beat, inst(hz(n), dur * s.spb * .92, vel), **kw)
    def render(s, room=.12, presence=.45):
        x = s.bus['dry'] + s.bus['room'] + small_room(s.bus['room']) * room
        x = hp(x.T, 45).T; x = x + presence * hp(x.T, 2800).T; x = lp(x.T, 14000).T      # 一點點亮度（約 +3 dB），上面不刺耳
        if s.loop:
            out = x[:s.N].copy(); out[:s.L - s.N] += x[s.N:]; return out
        nz = np.nonzero(np.abs(x).max(1) > 1e-4)[0]; return x[:nz[-1] + int(.05 * SR)] if len(nz) else x

def small_room(x):
    """很短的小房間殘響（約 0.4 秒就沒了），只給一點空間感"""
    t = T(.45); ir = np.zeros((len(t), 2))
    for c in range(2): ir[:, c] = lp(hp(noise(len(t)), 250), 5500) * np.exp(-t / .065)
    ir[:int(.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0)); return np.stack([signal.oaconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)


# ---------- 響度、限幅、輸出 ----------
def _wav(x, path): wavfile.write(path, SR, np.asarray(x, np.float32))
def loudness(x):
    """回傳 (整合響度 LUFS, 真峰值 dBTP)，用 ffmpeg 的 ebur128 量"""
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'a.wav'); _wav(x, p)
        r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)[-1]); P = float(re.findall(r'Peak:\s+(-?[\d.inf]+) dBFS', r.stderr)[-1])
    return I, P

def limit(x, ceil_db=-1.0, loop=False):
    """峰值限幅：±8 毫秒前看、保持 30 毫秒再平滑；loop=True 時頭尾當成接在一起處理"""
    thr = 10 ** (ceil_db / 20); mono = np.abs(x).max(1) if x.ndim == 2 else np.abs(x); pad = int(.2 * SR)
    if loop: mono = np.concatenate([mono[-pad:], mono, mono[:pad]])
    env = maximum_filter1d(mono, 2 * int(.008 * SR) + 1)
    g = minimum_filter1d(np.minimum(1, thr / np.maximum(env, 1e-9)), int(.03 * SR))
    a = np.exp(-1 / (.006 * SR)); g = signal.filtfilt([1 - a], [1, -a], g)
    if loop: g = g[pad:-pad]
    y = x * (g[:, None] if x.ndim == 2 else g)
    return np.clip(y, -thr * 1.02, thr * 1.02)

def master(x, lufs=-16.0, loop=False):
    """正規化到目標響度，峰值壓在 -1 dBTP 以下"""
    for _ in range(3):
        I, P = loudness(x); x = x * 10 ** ((lufs - I) / 20); x = limit(x, -1.2, loop)
        if abs(loudness(x)[0] - lufs) < .3: break
    return x

def peak_norm(x, db=-3.0):
    """音效：峰值正規化、去掉頭尾靜音、尾巴 6 毫秒淡出"""
    nz = np.nonzero(np.abs(x) > 10 ** (-45 / 20) * np.abs(x).max())[0]; x = x[nz[0]:nz[-1] + 1].copy()
    f = min(len(x), int(.006 * SR)); x[-f:] *= np.linspace(1, 0, f)
    return x / np.abs(x).max() * 10 ** (db / 20)

def write_mp3(x, path, kbps=None):
    """寫 mp3（立體聲 160k，單聲道 96k）"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'a.wav'); _wav(x, p); st = np.ndim(x) == 2
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, '-c:a', 'libmp3lame', '-b:a', f'{kbps or (160 if st else 96)}k', path], check=True)

def read_audio(path):
    """用 ffmpeg 解碼成 44.1k 立體聲 float 陣列（聽檢短片用，順便確認 mp3 解出來的長度）"""
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2).astype(float)
