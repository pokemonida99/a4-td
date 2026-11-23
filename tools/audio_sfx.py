"""音效：全部程式合成，卡通、短、乾淨（多數 < 0.4 秒、不加殘響），峰值 -3 dB。
用法：uv run --with numpy --with scipy python tools/audio_sfx.py [名稱…]
密集的聲音（出手六屬性、pop、coin）各做三版：<名>.mp3、<名>_2.mp3、<名>_3.mp3，遊戲隨機挑。"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_lib import *
from scipy.io import wavfile
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def svf(x, fc, q=1.0, mode='bp'):
    """狀態變數濾波器，截止頻率可逐點變（做掃頻的咻、嘩啦）"""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape); f = 2 * np.sin(np.pi * np.minimum(fc, SR * .2) / SR)
    lo = bd = 0.0; out = np.empty_like(x); d = 1 / q
    for i in range(len(x)):
        lo += f[i] * bd; hi = x[i] - lo - d * bd; bd += f[i] * hi
        out[i] = bd if mode == 'bp' else lo if mode == 'lp' else hi
    return out
def mix(*parts):
    """[(秒, 訊號, 倍率)…] 疊在一起"""
    L = max(int(o * SR) + len(p) for o, p, g in parts); out = np.zeros(L)
    for o, p, g in parts: i = int(o * SR); out[i:i + len(p)] += p * g
    return out
def tri(freq, t):
    """柔和的三角波感（基音＋弱的奇次泛音）"""
    ph = phase(np.broadcast_to(freq, t.shape)); return np.sin(ph) - np.sin(3 * ph) / 9 + np.sin(5 * ph) / 25
def expsweep(f0, f1, t, dur): return f0 * (f1 / f0) ** np.clip(t / dur, 0, 1)

# ---------- 介面 ----------
def cursor():  return mix((0, marimba(hz('G6'), .03, .7), 1), (0, wood(1900, .4), .25))
def confirm(): return mix((0, marimba(hz('C6'), .05, .8), 1), (.06, marimba(hz('G6'), .08, .9), 1), (.06, glock(hz('G6'), .05, .5), .5))
def card():
    t = T(.16); sw = svf(noise(len(t)), expsweep(700, 4200, t, .13), 2.5) * att(t, .03) * np.exp(-np.clip(t - .05, 0, 1) / .04)
    return mix((0, lp(sw, 7000), .8), (.11, marimba(hz('E6'), .03, .6), .5))
def coin(v=0):
    a, b = (('B6', 'E7'), ('A6', 'D7'), ('C7', 'F7'))[v]
    return mix((0, glock(hz(a), .04, .8), .9), (.055, glock(hz(b), .12, .9), 1))
def train():
    notes = ('C6', 'E6', 'G6', 'C7')
    return mix(*[(i * .055, steelpan(hz(n), .06, .8), 1) for i, n in enumerate(notes)], (.24, glock(hz('C7'), .2, .8), .8), (.3, glock(hz('E7'), .25, .7), .6))

# ---------- 出手六屬性 ----------
def slash(v=0):
    """斬：短促的咻＋一點刃光"""
    d = (.12, .1, .14)[v]; t = T(d + .03); f0, f1 = ((1200, 5200), (1600, 6000), (1000, 4200))[v]
    sw = svf(noise(len(t)), expsweep(f0, f1, t, d), 3) * att(t, .018) * np.exp(-np.clip(t - d * .45, 0, 1) / .025)
    shing = np.sin(2 * np.pi * (2600 + 350 * v) * t) * np.exp(-np.clip(t - .03, 0, 1) / .03) * att(t, .03) * .12
    return lp(sw + shing, 8500)
def hit(v=0):
    """打：卡通的咚（低音下滑＋木頭感）"""
    p = (1, .85, 1.18)[v]; t = T(.16)
    thump = np.sin(phase(p * (120 + 160 * np.exp(-t / .02)))) * np.exp(-t / .06)      # 手機喇叭也聽得到的「咚」
    knock = np.sin(2 * np.pi * 520 * p * t) * np.exp(-t / .022) * .55
    return thump + knock + lp(noise(len(t)), 2200) * np.exp(-t / .004) * .3
def explosion(v=0):
    """火：小小的爆啵（不是大爆炸）"""
    p = (1, .9, 1.12)[v]; t = T(.26)
    burst = svf(noise(len(t)), 2600 * np.exp(-t / .05) + 250, 1.2, 'lp') * np.exp(-t / .06)
    boom = np.sin(phase(p * (95 + 160 * np.exp(-t / .025)))) * np.exp(-t / .06) * .7
    pops = np.zeros(len(t))
    for k in range(4):
        i = int((.03 + RNG.random() * .14) * SR); n = int(.006 * SR); pops[i:i + n] += hp(noise(n), 1500) * np.exp(-np.arange(n) / (.0015 * SR)) * .5
    return burst * .9 + boom + pops
def explosion_big():
    t = T(.55); burst = svf(noise(len(t)), 3000 * np.exp(-t / .09) + 200, 1.2, 'lp') * np.exp(-t / .12)
    boom = np.sin(phase(75 + 150 * np.exp(-t / .04))) * np.exp(-t / .12)
    return mix((0, burst, 1), (0, boom, 1), (.05, explosion(1), .5), (.12, explosion(2), .4))
def ice_break(v=0):
    """冰：清脆的叮鈴（幾個不成和聲的高音很快收掉）"""
    r = np.random.default_rng(100 + v); t = T(.3); out = np.zeros(len(t))
    for k in range(7):
        f = r.uniform(1700, 4800); o = int(r.uniform(0, .05) * SR); tau = r.uniform(.03, .11)
        out[o:] += np.sin(2 * np.pi * f * t[:len(t) - o]) * np.exp(-t[:len(t) - o] / tau) * r.uniform(.4, 1)
    click = hp(noise(len(t)), 3000) * np.exp(-t / .003) * .5
    return lp(out * .5 + click, 8000) + glock(hz(('E7', 'D7', 'F#7')[v]), .05, .5)[:len(t)] * .5
def holy_cast(v=0):
    """光：閃亮的快速琶音"""
    notes = (('C6', 'E6', 'G6', 'C7'), ('D6', 'G6', 'B6', 'D7'), ('E6', 'A6', 'C#7', 'E7'))[v]
    t = T(.35); shimmer = lp(hp(noise(len(t)), 5000), 9000) * np.sin(np.pi * np.clip(t / .35, 0, 1)) * .05
    return mix(*[(i * .045, glock(hz(n), .05, .7 + .1 * i), 1) for i, n in enumerate(notes)], (0, shimmer, 1))
def dark_blast(v=0):
    """暗：俏皮的「嗚～啵」（紫色泡泡，不陰森）"""
    p = (1, .9, 1.12)[v]; t = T(.18)
    woo = tri(p * (320 - 120 * np.clip(t / .14, 0, 1)) * (1 + .04 * np.sin(2 * np.pi * 18 * t)), t) * att(t, .02) * np.exp(-np.clip(t - .1, 0, 1) / .04)
    t2 = T(.08); bop = np.sin(phase(p * expsweep(260, 900, t2, .05))) * np.exp(-t2 / .025)
    return mix((0, woo, .6), (.15, bop, 1))

# ---------- 事件 ----------
def encounter():
    """開波：短號角（嗒～噠！）"""
    c = lambda ns, d, v: sum(brass(hz(n), d, v, voices=2) for n in ns) / 2
    return mix((0, c(('G4', 'D5'), .12, .8), 1), (.16, c(('C5', 'E5', 'G5'), .38, .9), 1.1))
def boss_appear():
    """頭目登場：滑稽的低音銅管「登、登、登～」"""
    tuba = lambda n, d, g=None: brass(hz(n), d, .9, voices=2, bright=.55, glide=g)
    t = T(.7); wob = (1 + .02 * np.sin(2 * np.pi * 6 * t) * np.clip(t / .2, 0, 1)) * (1 - .04 * np.clip((t - .3) / .4, 0, 1))
    return mix((0, tuba('D3', .16), 1), (0, tom(90, .8), .5), (.22, tuba('C#3', .16), 1), (.22, tom(85, .8), .5),
               (.44, tuba('C3', .7, wob), 1.2), (.44, tom(75, .9), .6), (.44, tuba('C4', .7, wob), .35))
def boss_down():
    """頭目倒下：彩炮爆開＋派對號角往上滑＋閃亮琶音"""
    t = T(.12); pop = bp(noise(len(t)), 900, 4500) * np.exp(-t / .03)
    t2 = T(.5); slide = brass(hz('C4'), .45, .9, voices=2, glide=expsweep(1, 2, t2, .35))
    chordp = sum(steelpan(hz(n), .5, .8) for n in ('F5', 'A5', 'C6', 'F6')) / 2
    spark = mix(*[(i * .05, glock(hz(n), .05, .7), 1) for i, n in enumerate(('C7', 'F7', 'A7', 'C8'))])
    return mix((0, pop, 1), (0, explosion(0), .5), (.04, slide, .9), (.35, chordp, .8), (.4, spark, .6))
def boss_charge():
    """蓄力：卡通滑哨往上（越來越急的顫音）"""
    t = T(.85); f = expsweep(420, 1300, t, .8) * (1 + .03 * np.sin(2 * np.pi * (6 + 10 * t) * t))
    x = (np.sin(phase(f)) + .15 * np.sin(2 * phase(f))) * att(t, .05) * (.5 + .5 * t / .85) * rel(t, .78, .03)
    return lp(x, 5000)
def defeat():
    """漏怪：兩聲圓潤的嗶嗶"""
    t = T(.08); b = tri(880, t) * att(t, .004) * rel(t, .065, .01)
    return mix((0, b, 1), (.12, b, 1))
def fanfare():
    """勝利短號：嗒嗒嗒～"""
    c = lambda ns, d: sum(brass(hz(n), d, .9, voices=2) for n in ns) / 2
    return mix((0, c(('C5',), .09), 1), (.11, c(('E5',), .09), 1), (.22, c(('C5', 'E5', 'G5'), .45, ), 1.2), (.22, steelpan(hz('C6'), .4, .8), .7), (.22, kick(.7), .4))
def heal():
    """回復：柔和上行鈴聲"""
    t = T(.45); swell = np.sin(np.pi * np.clip(t / .45, 0, 1))
    return mix(*[(i * .07, glock(hz(n), .08, .6), 1) for i, n in enumerate(('C6', 'E6', 'G6', 'C7'))], (0, np.sin(2 * np.pi * 1046 * t) * swell * .15, 1))
def buff():
    """加成：往上掃＋叮"""
    t = T(.15); sw = np.sin(phase(expsweep(400, 1300, t, .15))) * att(t, .02) * .6
    return mix((0, sw, 1), (.13, glock(hz('G6'), .1, .8), 1), (.13, steelpan(hz('G5'), .1, .6), .5))
def shield_up():
    """護盾：金屬「啵～嗡」往上"""
    t = T(.35); p = 1 + .3 * np.clip(t / .15, 0, 1); x = 0
    for k, a, tau in ((1, 1, .18), (2.4, .45, .1), (3.8, .2, .05)): x = x + a * np.sin(phase(560 * k * p)) * np.exp(-t / tau)
    return x * att(t, .005) * .7 + glock(hz('E7'), .05, .4)[:len(t)] * .3
def shield_block():
    """擋下：小小的鏘＋悶響"""
    t = T(.22); x = 0
    for f, a, tau in ((900, 1, .09), (1420, .6, .07), (2150, .35, .05), (3300, .15, .03)): x = x + a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
    return x * .6 + np.sin(phase(80 + 80 * np.exp(-t / .02))) * np.exp(-t / .05) * .6 + hp(noise(len(t)), 2500) * np.exp(-t / .003) * .3
def wok_back():
    """甩鍋：平底鍋「噹～」（帶一點晃動）"""
    t = T(.45); w = 1 + .006 * np.sin(2 * np.pi * 7 * t); x = 0
    for f, a, tau in ((430, 1, .3), (1090, .55, .18), (1830, .3, .1), (2760, .12, .05)): x = x + a * np.sin(phase(f * w)) * np.exp(-t / tau)
    return x * .6 + lp(noise(len(t)), 3000) * np.exp(-t / .004) * .4
def paper_storm():
    """紙張嘩啦啦"""
    L = int(.65 * SR); out = np.zeros(L); r = np.random.default_rng(7)
    for k in range(34):
        n = int(r.uniform(.01, .03) * SR); i = int(r.uniform(0, .55) * SR); tt = np.arange(n) / SR
        out[i:i + n] += bp(noise(n), r.uniform(1500, 2500), r.uniform(4500, 6500)) * np.exp(-tt / r.uniform(.004, .01)) * r.uniform(.3, 1)
    t = T(.65); out *= np.sin(np.pi * np.clip(t / .65, 0, 1)) ** .5
    return out + svf(noise(L), expsweep(600, 2500, t, .5), 2) * np.sin(np.pi * t / .65) * .3
def unite():
    """合體技：大和弦掃弦＋銅管一打＋閃光"""
    s = strum(['F3', 'C4', 'F4', 'A4', 'C5', 'F5'], .7, .9, gap=.012, bright=.7, decay=.997)
    br = sum(brass(hz(n), .35, .9, voices=2) for n in ('F4', 'A4', 'C5', 'F5')) / 2
    return mix((0, s, 1.4), (.02, br, .8), (.02, kick(.8), .5), (.15, holy_cast(0), .4))
def stun():
    """暈眩：三聲小鳥啾啾＋彈簧晃"""
    t = T(.05); chirp = lambda b: np.sin(phase(expsweep(b, b * 1.3, t, .05))) * np.sin(np.pi * t / .05)
    t2 = T(.4); boing = np.sin(phase(300 * (1 + .25 * np.sin(2 * np.pi * 9 * t2) * np.exp(-t2 / .15)))) * np.exp(-t2 / .12)
    return mix((0, boing, .7), (.03, chirp(2000), .35), (.12, chirp(1800), .35), (.21, chirp(1600), .35))
def weak():
    """打到弱點：叮叮往上"""
    return mix((0, glock(hz('E6'), .04, .8), 1), (.07, glock(hz('B6'), .1, .9), 1), (0, wood(1600, .5), .4))
def pop(v=0):
    """敵人倒下：很輕很短的泡泡啵"""
    p = (1, .86, 1.16)[v]; t = T(.055)
    x = np.sin(phase(p * expsweep(380, 1150, t, .035))) * att(t, .002) * np.exp(-t / .018)
    return x + hp(noise(len(t)), 2500) * np.exp(-t / .0015) * .15
def cutin():
    t = T(.3); sw = svf(noise(len(t)), expsweep(500, 3500, t, .25), 2.5) * np.sin(np.pi * t / .3)
    return mix((0, lp(sw, 7000), .8), (.2, holy_cast(1), .6))
def whoosh():
    t = T(.28); return lp(svf(noise(len(t)), expsweep(600, 3000, t, .25), 2.2) * np.sin(np.pi * t / .28), 7000)
def poison():
    """毒：咕嘟咕嘟的小泡泡"""
    return mix(*[(i * .06, pop(i % 3) * .8, 1) for i in range(4)], (0, tri(140 * (1 + .1 * np.sin(2 * np.pi * 12 * T(.3))), T(.3)) * np.exp(-T(.3) / .12) * .3, 1))

ALL = {'cursor': cursor, 'confirm': confirm, 'card': card, 'train': train, 'explosion_big': explosion_big,
       'encounter': encounter, 'boss_appear': boss_appear, 'boss_down': boss_down, 'boss_charge': boss_charge, 'defeat': defeat,
       'fanfare': fanfare, 'heal': heal, 'buff': buff, 'shield_up': shield_up, 'shield_block': shield_block, 'wok_back': wok_back,
       'paper_storm': paper_storm, 'unite': unite, 'stun': stun, 'weak': weak, 'cutin': cutin, 'poison': poison}
VARI = {'slash': slash, 'hit': hit, 'explosion': explosion, 'break': ice_break, 'holy_cast': holy_cast, 'dark_blast': dark_blast, 'pop': pop, 'coin': coin}

def jobs():
    for k, f in ALL.items(): yield k, f
    for k, f in VARI.items():
        for v in range(3): yield (k if v == 0 else f'{k}_{v + 1}'), (lambda f=f, v=v: f(v))
    yield 'hit_alt', lambda: hit(1)
    yield 'slash_alt', lambda: slash(1)

if __name__ == '__main__':
    want = set(sys.argv[1:])
    for name, f in jobs():
        if want and name not in want and name.split('_')[0] not in want: continue
        x = peak_norm(f(), -3.0); d = len(x) / SR
        if name == 'whoosh': wavfile.write('audio/sfx/whoosh.wav', SR, (x * 32767).astype(np.int16))
        else: write_mp3(x, f'audio/sfx/{name}.mp3')
        print(f'{name:14s} {d:.2f}s' + ('  ← 超過 0.4 秒' if d > .4 else ''))
