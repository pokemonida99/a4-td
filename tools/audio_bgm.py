"""配樂：全部程式合成（鋼鼓、馬林巴、彈跳貝斯、拍手、輕鼓組、銅管點綴），氣氛參考猴子塔防：明亮、輕快、熱帶放克。
用法：uv run --with numpy --with scipy python tools/audio_bgm.py [map battle boss victory lose]
輸出 audio/bgm/<名>.mp3；循環曲長度剛好是整數小節，結尾的尾巴已折回開頭，循環點對拍不斷音。
循環長度（秒、取樣數）寫在 audio/bgm/loops.json。"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_lib import *
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def mel(*bars):
    """旋律：每小節一串 (拍, 長度, 音名)"""
    return list(bars)
def put_melody(S, start, bars, inst, gain=.9, pan=.15, oct=0, vel=.85, bus='room'):
    for b, notes in enumerate(bars):
        for beat, dur, n in notes:
            S.note((start + b) * 4 + beat, inst, m(n) + 12 * oct, dur, vel * (.9 + .1 * RNG.random()), pan=pan, gain=gain, bus=bus)

def chords_of(bar):
    """一小節的和弦：'F' 或 ('F','G')（各半小節）→ [(拍, 和弦名, 長度)]"""
    return [(0, bar, 4)] if isinstance(bar, str) else [(i * 4 / len(bar), c, 4 / len(bar)) for i, c in enumerate(bar)]

def put_bass(S, start, prog, pat, gain=.65, approach=True):
    for b, bar in enumerate(prog):
        for c0, name, clen in chords_of(bar):
            r, _ = chord(name); root = 36 + r if r >= 4 else 48 + r      # 貝斯根音放在 E2～D#3
            for beat, iv, dur, vel in pat:
                if c0 <= beat < c0 + clen: S.note((start + b) * 4 + beat, bass, root + iv, dur, vel, gain=gain)
        if approach:      # 每兩小節最後一個 16 分音符用半音接到下一個和弦根音
            nxt = prog[(b + 1) % len(prog)]; nr, _ = chord(chords_of(nxt)[0][1]); nroot = 36 + nr if nr >= 4 else 48 + nr
            if b % 2 == 1: S.note((start + b) * 4 + 3.75, bass, nroot - 1, .2, .5, gain=gain * .8)

def put_skank(S, start, prog, beats=(.5, 1.5, 2.5, 3.5), gain=.32, pan=.35, gate=.12, lo='E4', hi='D5'):
    """烏克麗麗反拍刷弦（悶音短促）"""
    for b, bar in enumerate(prog):
        for c0, name, clen in chords_of(bar):
            v = voicing(name, lo, hi)[:4]
            for beat in beats:
                if c0 <= beat < c0 + clen: S.add((start + b) * 4 + beat, strum(v, gate * S.spb * 2, .7, bright=.45, decay=.99), pan=pan, gain=gain, bus='room')

def put_arp(S, start, prog, inst=marimba, step=.5, lo='F4', hi='C6', gain=.32, pan=-.25, order=(0, 1, 2, 3, 4, 3, 2, 1), vel=.7):
    """分解和弦（馬林巴 8 分或 16 分）"""
    for b, bar in enumerate(prog):
        for c0, name, clen in chords_of(bar):
            v = voicing(name, lo, hi); k = 0; beat = c0
            while beat < c0 + clen - 1e-6:
                n = v[order[k % len(order)] % len(v)]
                S.note((start + b) * 4 + beat, inst, n, step * .9, vel * (1 if k % 2 == 0 else .8), pan=pan, gain=gain, bus='room'); k += 1; beat += step

def put_stabs(S, start, prog, beats=(0, 2.5), gain=.5, dur=.35, lo='F3', hi='D5', vel=.8):
    """銅管和弦短打"""
    for b, bar in enumerate(prog):
        for c0, name, clen in chords_of(bar):
            v = voicing(name, lo, hi)[-4:]
            for beat in beats:
                if c0 <= beat < c0 + clen:
                    x = sum(brass(hz(n), dur * S.spb, vel, voices=2) for n in v) / 2
                    S.add((start + b) * 4 + beat, x, gain=gain, bus='room')

def put_drums(S, start, bars, style, fill=True, gain=1.0, nokick=False):
    for b in range(bars):
        B = (start + b) * 4; last = fill and b == bars - 1
        if style == 'map':
            if not nokick:
                for k in (0, 2.5): S.add(B + k, kick(.55), gain=gain * .7)
            for k in (1, 3): S.add(B + k, clap(.5), gain=gain * .35, pan=-.1, bus='room')
            for k in range(8): S.add(B + k * .5, shaker(.5 if k % 2 else .3), pan=-.3, gain=gain * .5)
            S.add(B + 3.5, wood(1300, .5), pan=.4, gain=gain * .35)
        elif style == 'battle':
            if not nokick:
                for k in (0, 1.75, 2.5): S.add(B + k, kick(.8 if k == 0 else .6), gain=gain * .85)
            for k in (1, 3): S.add(B + k, snare(.6), gain=gain * .45, bus='room'); S.add(B + k, clap(.6), gain=gain * .3, pan=.1, bus='room')
            for k in range(8): S.add(B + k * .5, hat(.55 if k % 2 else .35, open_=(k == 7)), pan=.25, gain=gain * .5)
            for k in range(16): S.add(B + k * .25, shaker(.35), pan=-.3, gain=gain * .25)
        elif style == 'boss':
            if not nokick:
                for k in (0, 1, 2, 3): S.add(B + k, kick(.8), gain=gain * .85)
            for k in (1, 3): S.add(B + k, snare(.7), gain=gain * .5, bus='room'); S.add(B + k, clap(.6), gain=gain * .3, bus='room')
            for k in range(16): S.add(B + k * .25, hat(.5 if k % 2 else .3), pan=.25, gain=gain * .45)
        if last:      # 小節最後兩拍：小鼓＋筒鼓下行過門
            for i, k in enumerate((2, 2.5, 2.75, 3, 3.25, 3.5, 3.75)):
                S.add(B + k, tom(220 - i * 18, .7), pan=-.4 + i * .13, gain=gain * .5, bus='room'); S.add(B + k, snare(.35 + i * .05), gain=gain * .25, bus='room')


# ======================= 標題：map（C 大調 112 BPM，32 小節） =======================
def song_map():
    S = Song(112, 32, swing=.12)
    A = ['C', 'Am', 'F', 'G', 'C', 'Em', ('F', 'G'), ('C', 'G7')]
    B = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'G7']
    M1 = mel([(0, 1, 'E5'), (1, .5, 'G5'), (1.5, 1, 'C6'), (2.5, .5, 'B5'), (3, 1, 'G5')],
             [(0, 1, 'A5'), (1, .5, 'G5'), (1.5, .5, 'E5'), (2, 1.5, 'C5'), (3.5, .5, 'D5')],
             [(0, 1, 'F5'), (1, .5, 'A5'), (1.5, 1, 'C6'), (2.5, .5, 'A5'), (3, 1, 'F5')],
             [(0, 1.5, 'G5'), (1.5, .5, 'A5'), (2, .5, 'G5'), (2.5, .5, 'F5'), (3, 1, 'D5')],
             [(0, 1, 'E5'), (1, .5, 'G5'), (1.5, 1, 'C6'), (2.5, .5, 'B5'), (3, 1, 'G5')],
             [(0, 1, 'B5'), (1, .5, 'G5'), (1.5, .5, 'E5'), (2, 1, 'G5'), (3, 1, 'B5')],
             [(0, .5, 'A5'), (.5, .5, 'C6'), (1, 1, 'A5'), (2, .5, 'B5'), (2.5, .5, 'D6'), (3, 1, 'B5')],
             [(0, 2, 'C6'), (2, .5, 'G5'), (2.5, .5, 'E5'), (3, 1, 'D5')])
    M2 = mel([(0, 1, 'A5'), (1, 1, 'C6'), (2, 1, 'A5'), (3, .5, 'G5'), (3.5, .5, 'F5')],
             [(0, 1, 'G5'), (1, 1, 'B5'), (2, 1.5, 'D6'), (3.5, .5, 'B5')],
             [(0, 1, 'G5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 1, 'B5'), (3, 1, 'G5')],
             [(0, 1, 'C6'), (1, .5, 'B5'), (1.5, .5, 'A5'), (2, 2, 'E5')],
             [(0, 1, 'F5'), (1, .5, 'A5'), (1.5, .5, 'D6'), (2, 1, 'C6'), (3, 1, 'A5')],
             [(0, 1, 'B5'), (1, .5, 'D6'), (1.5, .5, 'B5'), (2, 1, 'G5'), (3, 1, 'D5')],
             [(0, 1, 'E5'), (1, .5, 'G5'), (1.5, .5, 'C6'), (2, 1, 'E6'), (3, 1, 'C6')],
             [(0, 1, 'B5'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F5'), (3, 1, 'D5')])
    pat = [(0, 0, .9, .85), (1.5, 7, .4, .6), (2, 0, .4, .7), (2.5, 12, .4, .55), (3, 7, .9, .7)]
    for sec, prog in ((0, A), (8, A), (16, B), (24, A)):
        put_bass(S, sec, prog, pat, gain=.55); put_skank(S, sec, prog, beats=(.5, 1.5, 2.5, 3.5), gain=.22, gate=.1)
        put_drums(S, sec, 8, 'map', gain=.9, nokick=(sec == 0))
    put_melody(S, 0, M1, marimba, gain=.85, pan=-.1)
    put_melody(S, 8, M1, steelpan, gain=.75, pan=.15); put_arp(S, 8, A, marimba, .5, 'E4', 'G5', gain=.25)
    put_melody(S, 16, M2, marimba, gain=.8, pan=-.15); put_melody(S, 16, M2, glock, gain=.18, pan=.3, oct=1, vel=.5)
    put_melody(S, 24, M1, steelpan, gain=.75, pan=.15); put_melody(S, 24, M1, marimba, gain=.45, pan=-.25, oct=-1)
    for b in (3, 11, 19, 27):      # 每段中間灑一點鐵琴亮點
        for i, n in enumerate(('G6', 'C7', 'E7')): S.note(b * 4 + 3 + i * .25, glock, n, .25, .4, pan=.4, gain=.18, bus='room')
    return S.render(.1)


# ======================= 一般戰鬥：battle（F 大調 128 BPM，48 小節） =======================
THEME = mel([(0, .5, 'C5'), (.5, .5, 'F5'), (1, .5, 'A5'), (1.5, 1, 'C6'), (2.5, .5, 'A5'), (3, 1, 'F5')],
            [(0, .5, 'D5'), (.5, .5, 'F5'), (1, .5, 'Bb5'), (1.5, 1, 'D6'), (2.5, .5, 'C6'), (3, 1, 'Bb5')],
            [(0, .5, 'E5'), (.5, .5, 'G5'), (1, .5, 'C6'), (1.5, .5, 'E6'), (2, .5, 'D6'), (2.5, .5, 'C6'), (3, .5, 'Bb5'), (3.5, .5, 'G5')],
            [(0, 1.5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F5'), (3, .5, 'C5'), (3.5, .5, 'D5')],
            [(0, .5, 'F5'), (.5, .5, 'A5'), (1, 1, 'D6'), (2, .5, 'C6'), (2.5, .5, 'A5'), (3, 1, 'F5')],
            [(0, .5, 'D5'), (.5, .5, 'F5'), (1, 1, 'Bb5'), (2, .5, 'A5'), (2.5, .5, 'Bb5'), (3, 1, 'D6')],
            [(0, .75, 'C6'), (.75, .75, 'Bb5'), (1.5, .5, 'A5'), (2, .5, 'G5'), (2.5, .5, 'E5'), (3, 1, 'G5')],
            [(0, .5, 'E5'), (.5, .5, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'C6'), (2, 1, 'E6'), (3, .5, 'D6'), (3.5, .5, 'Bb5')])
def song_battle():
    S = Song(128, 48, swing=.08)
    A = ['F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'C7']
    B = ['Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'C7']
    C = ['F', 'Am', 'Bb', 'C', 'F', 'Am', 'Gm', 'C']
    D = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'C7']
    MB = mel([(0, 1, 'D6'), (1, .5, 'C6'), (1.5, 1.5, 'Bb5'), (3, .5, 'F5'), (3.5, .5, 'G5')],
             [(0, 1, 'E6'), (1, .5, 'D6'), (1.5, 1.5, 'C6'), (3, .5, 'G5'), (3.5, .5, 'A5')],
             [(0, 1, 'E6'), (1, .5, 'D6'), (1.5, .5, 'C6'), (2, 1, 'A5'), (3, .5, 'C6'), (3.5, .5, 'E6')],
             [(0, 1.5, 'F6'), (1.5, .5, 'E6'), (2, 1, 'D6'), (3, 1, 'A5')],
             [(0, .5, 'Bb5'), (.5, .5, 'D6'), (1, 1, 'G6'), (2, .5, 'F6'), (2.5, .5, 'D6'), (3, 1, 'Bb5')],
             [(0, .5, 'C6'), (.5, .5, 'E6'), (1, 1, 'G6'), (2, .5, 'F6'), (2.5, .5, 'E6'), (3, 1, 'C6')],
             [(0, 1, 'A5'), (1, .5, 'C6'), (1.5, 1, 'F6'), (2.5, .5, 'E6'), (3, 1, 'C6')],
             [(0, .5, 'Bb5'), (.5, .5, 'C6'), (1, .5, 'E6'), (1.5, .5, 'G6'), (2, 2, 'E6')])
    MD = mel([(0, 1, 'D5'), (1, .5, 'F5'), (1.5, .5, 'A5'), (2, 1, 'D6'), (3, .5, 'C6'), (3.5, .5, 'A5')],
             [(0, 1, 'Bb5'), (1, .5, 'A5'), (1.5, .5, 'F5'), (2, 1.5, 'D5'), (3.5, .5, 'F5')],
             [(0, .5, 'A5'), (.5, .5, 'C6'), (1, 1, 'F6'), (2, .5, 'E6'), (2.5, .5, 'C6'), (3, 1, 'A5')],
             [(0, 1.5, 'G5'), (1.5, .5, 'A5'), (2, .5, 'G5'), (2.5, .5, 'E5'), (3, 1, 'C5')],
             [(0, .5, 'D5'), (.5, .5, 'E5'), (1, .5, 'F5'), (1.5, .5, 'A5'), (2, 1, 'D6'), (3, 1, 'C6')],
             [(0, .5, 'Bb5'), (.5, .5, 'A5'), (1, .5, 'Bb5'), (1.5, .5, 'D6'), (2, 1, 'F6'), (3, 1, 'D6')],
             [(0, .5, 'Bb5'), (.5, .5, 'A5'), (1, .5, 'G5'), (1.5, .5, 'F5'), (2, 1, 'G5'), (3, 1, 'Bb5')],
             [(0, .5, 'C6'), (.5, .5, 'Bb5'), (1, .5, 'G5'), (1.5, .5, 'E5'), (2, .5, 'C5'), (2.5, .5, 'E5'), (3, .5, 'G5'), (3.5, .5, 'Bb5')])
    pat = [(0, 0, .45, 1), (.75, 12, .2, .6), (1.5, 7, .4, .8), (2.5, 0, .3, .9), (3, 12, .25, .6), (3.5, 7, .4, .7)]
    for sec, prog in ((0, A), (8, A), (16, B), (24, C), (32, A), (40, D)):
        put_bass(S, sec, prog, pat if sec != 24 else [(0, 0, 1.5, .9), (2.5, 7, .5, .7), (3, 12, .5, .6)])
        put_skank(S, sec, prog, gain=.3 if sec != 24 else .18)
        put_drums(S, sec, 8, 'battle', nokick=False)
    put_melody(S, 0, THEME, steelpan, gain=.95)
    put_melody(S, 8, THEME, steelpan, gain=.9); put_arp(S, 8, A, marimba, .5, 'F4', 'C6', gain=.28)
    put_stabs(S, 8, ['F'] * 3 + ['F'] + ['Dm'] * 3 + ['C7'], beats=(3.5,), gain=.35)
    put_melody(S, 16, MB, marimba, gain=.85, pan=-.15, oct=-1); put_melody(S, 16, MB, glock, gain=.15, pan=.3, vel=.5)
    put_stabs(S, 16, B, beats=(0, 2.5), gain=.4)
    put_arp(S, 24, C, marimba, .25, 'F4', 'F6', gain=.26, order=(0, 2, 1, 3, 2, 4, 3, 5))
    for b in range(8):      # 鋼鼓一問一答
        notes = [(0, .5, 'C6'), (.5, .5, 'A5'), (1, 1, 'F5')] if b % 2 == 0 else [(2, .5, 'G5'), (2.5, .5, 'A5'), (3, 1, 'C6')]
        put_melody(S, 24 + b, [notes], steelpan, gain=.8)
    put_melody(S, 32, THEME, steelpan, gain=.9); put_melody(S, 32, THEME, brass, gain=.45, pan=0, oct=-1, vel=.7)
    put_arp(S, 32, A, marimba, .5, 'F4', 'C6', gain=.22)
    put_melody(S, 40, MD, steelpan, gain=.9); put_arp(S, 40, D, marimba, .5, 'D4', 'A5', gain=.25)
    put_stabs(S, 44, D[4:], beats=(0, 1.5, 3), gain=.38)
    return S.render(.12)


# ======================= 頭目：boss（D 小調＝F 大調同調號，140 BPM，48 小節） =======================
def song_boss():
    S = Song(140, 48)
    A = ['Dm', 'Dm', 'Bb', 'A7', 'Dm', 'Gm', ('Bb', 'A7'), 'Dm']
    B = ['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'E7', 'A7']
    C = ['F', 'C', 'Bb', 'A7', 'F', 'C', 'Bb', 'A7']
    D = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A7']
    M1 = mel([(0, .5, 'D5'), (.5, .5, 'F5'), (1, .5, 'A5'), (1.5, .5, 'D6'), (2, .5, 'C#6'), (2.5, .5, 'D6'), (3, 1, 'A5')],
             [(0, .5, 'Bb5'), (.5, .5, 'A5'), (1, .5, 'G5'), (1.5, .5, 'F5'), (2, 1, 'E5'), (3, .5, 'F5'), (3.5, .5, 'G5')],
             [(0, .5, 'F5'), (.5, .5, 'Bb5'), (1, .5, 'D6'), (1.5, .5, 'F6'), (2, .5, 'E6'), (2.5, .5, 'D6'), (3, 1, 'Bb5')],
             [(0, .5, 'A5'), (.5, .5, 'C#6'), (1, .5, 'E6'), (1.5, .5, 'G6'), (2, 1, 'F6'), (3, 1, 'E6')],
             [(0, .5, 'D6'), (.5, .5, 'A5'), (1, .5, 'F5'), (1.5, .5, 'A5'), (2, .5, 'D6'), (2.5, .5, 'E6'), (3, 1, 'F6')],
             [(0, .5, 'G6'), (.5, .5, 'F6'), (1, .5, 'D6'), (1.5, .5, 'Bb5'), (2, 1, 'G5'), (3, .5, 'A5'), (3.5, .5, 'Bb5')],
             [(0, .5, 'D6'), (.5, .5, 'C6'), (1, 1, 'Bb5'), (2, .5, 'C#6'), (2.5, .5, 'E6'), (3, 1, 'E6')],
             [(0, 1.5, 'D6'), (1.5, .5, 'A5'), (2, 1, 'F5'), (3, 1, 'D5')])
    M2 = mel([(0, 1, 'D5'), (1, .5, 'Bb4'), (1.5, .5, 'G4'), (2, 1, 'D5'), (3, 1, 'G5')],
             [(0, 1.5, 'F5'), (1.5, .5, 'E5'), (2, 1, 'D5'), (3, 1, 'A4')],
             [(0, 1, 'Bb4'), (1, .5, 'D5'), (1.5, .5, 'F5'), (2, 1, 'Bb5'), (3, 1, 'A5')],
             [(0, 2, 'A5'), (2, .5, 'G5'), (2.5, .5, 'F5'), (3, 1, 'E5')],
             [(0, 1, 'D5'), (1, .5, 'G5'), (1.5, .5, 'Bb5'), (2, 1, 'D6'), (3, 1, 'C6')],
             [(0, 1, 'A5'), (1, .5, 'F5'), (1.5, .5, 'D5'), (2, 1, 'F5'), (3, 1, 'A5')],
             [(0, 1, 'G#5'), (1, .5, 'B5'), (1.5, .5, 'D6'), (2, 1, 'E6'), (3, 1, 'D6')],
             [(0, .5, 'C#6'), (.5, .5, 'B5'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'E5'), (3, 1, 'C#5')])
    M3 = mel([(0, 1, 'C6'), (1, .5, 'A5'), (1.5, .5, 'C6'), (2, 1, 'F6'), (3, 1, 'C6')],
             [(0, 1, 'E6'), (1, .5, 'D6'), (1.5, .5, 'C6'), (2, 1.5, 'G5'), (3.5, .5, 'C6')],
             [(0, 1, 'D6'), (1, .5, 'C6'), (1.5, .5, 'Bb5'), (2, 1, 'F5'), (3, .5, 'Bb5'), (3.5, .5, 'C6')],
             [(0, 1, 'C#6'), (1, .5, 'E6'), (1.5, .5, 'C#6'), (2, 1, 'A5'), (3, 1, 'E5')],
             [(0, 1, 'A5'), (1, .5, 'C6'), (1.5, .5, 'F6'), (2, 1, 'A6'), (3, 1, 'F6')],
             [(0, 1, 'G6'), (1, .5, 'E6'), (1.5, .5, 'C6'), (2, 1, 'E6'), (3, 1, 'G5')],
             [(0, 1, 'F6'), (1, .5, 'D6'), (1.5, .5, 'Bb5'), (2, 1, 'D6'), (3, 1, 'F5')],
             [(0, .5, 'E6'), (.5, .5, 'C#6'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'E5'), (3, 1, 'A4')])
    drive = [(k * .5, iv, .22, .95 if k % 2 == 0 else .7) for k, iv in enumerate((0, 0, 12, 0, 7, 0, 12, 10))]
    for sec, prog in ((0, A), (8, A), (16, B), (24, C), (32, A), (40, D)):
        put_bass(S, sec, prog, drive if sec != 40 else [(k * .5, 0, .22, .9) for k in range(8)], gain=.6)
        put_drums(S, sec, 8, 'boss', nokick=(sec == 40))
        put_arp(S, sec, prog, marimba, .25, 'D4', 'D6', gain=.2, order=(0, 2, 4, 2, 1, 3, 5, 3), vel=.6)
    put_melody(S, 0, M1, steelpan, gain=.9); put_stabs(S, 0, A, beats=(0,), gain=.35, dur=.25)
    put_melody(S, 8, M1, steelpan, gain=.85); put_melody(S, 8, M1, brass, gain=.4, oct=-1, vel=.7, pan=0); put_stabs(S, 8, A, beats=(0, 2.5), gain=.35, dur=.25)
    put_melody(S, 16, M2, brass, gain=.6, pan=0, oct=-1, vel=.8); put_melody(S, 16, M2, steelpan, gain=.45, pan=.2)
    put_melody(S, 24, M3, steelpan, gain=.9); put_melody(S, 24, M3, glock, gain=.15, pan=-.3, vel=.5); put_stabs(S, 24, C, beats=(0, 1.5, 3), gain=.35, dur=.3)
    put_melody(S, 32, M1, steelpan, gain=.9); put_melody(S, 32, M1, marimba, gain=.45, oct=-1, pan=-.25); put_stabs(S, 32, A, beats=(0, 2.5), gain=.38, dur=.25)
    for b in range(8):      # 最後一段：銅管越來越密、筒鼓往上推，回到開頭
        beats = (0,) if b < 4 else (0, 1.5, 3) if b < 6 else (0, 1, 2, 2.5, 3, 3.5)
        put_stabs(S, 40 + b, [D[b]], beats=beats, gain=.3 + b * .03, dur=.22)
        if b >= 4:
            for k in range(4): S.add((40 + b) * 4 + k, tom(110 + b * 12 + k * 6, .6), pan=-.3 + k * .2, gain=.45, bus='room')
    for b in range(40, 48):
        for k in (0, 1, 2, 3): S.add(b * 4 + k, kick(.7), gain=.75)
    return S.render(.1)


# ======================= 勝利：victory（F 大調，約 7 秒） =======================
def song_victory():
    S = Song(120, 6, loop=False, tail=3)
    for i, n in enumerate(('C5', 'C5', 'C5')):
        S.note(i / 3, brass, n, .3, .8, gain=.7); S.note(i / 3, steelpan, n, .3, .8, gain=.6, pan=.2)
    line = [(1, 1, 'F5'), (2, .5, 'A5'), (2.5, .5, 'C6'), (3, 1.5, 'F6'), (4.5, .5, 'D6'), (5, .5, 'E6'), (5.5, .5, 'G6'), (6, 4.5, 'F6')]
    for b, d, n in line:
        S.note(b, steelpan, n, d, .9, gain=.9, pan=.15, bus='room'); S.note(b, brass, m(n) - 12, d, .85, gain=.6, bus='room')
    for b, name, d in ((1, 'F', 2), (3, 'F', 1.5), (4.5, 'Bb', .5), (5, 'C', 1), (6, 'F', 4.5)):
        v = voicing(name, 'F3', 'C5')[-4:]
        S.add(b, sum(brass(hz(n), d * S.spb * .9, .75, voices=2) for n in v) / 2, gain=.5, bus='room')
        r, _ = chord(name); S.note(b, bass, 36 + r if r >= 4 else 48 + r, d * .9, .9, gain=.8)
    for k in range(32): S.note(6 + k * .125, marimba, ('F5', 'A5', 'C6', 'F6')[k % 4], .12, .5 + k * .01, gain=.3, pan=-.3, bus='room')
    for i, n in enumerate(('F6', 'A6', 'C7', 'F7')): S.note(10.25 + i * .25, glock, n, .5, .7, gain=.35, pan=.3, bus='room')
    S.add(10.25, wood(1500, .6), gain=.3)
    for b in (1, 3, 6, 10.25): S.add(b, kick(.8), gain=.8)
    for k in range(8): S.add(k * .125, snare(.25 + k * .06), gain=.35, bus='room')
    S.add(6, clap(.8), gain=.4, bus='room'); S.add(6, hat(.6, True), gain=.4)
    return S.render(.12)


# ======================= 輸了：lose（滑稽的「哇哇哇哇～」下行，約 4.5 秒） =======================
def song_lose():
    S = Song(100, 3, loop=False, tail=2)
    steps = [('D4', 0, .9), ('C#4', 1, .9), ('C4', 2, .9), ('B3', 3, 3.2)]
    for i, (n, b, d) in enumerate(steps):
        dur = d * S.spb; t = T(dur + .2)
        wah = .35 + .65 * np.clip(np.sin(np.pi * np.clip(t / (.9 * S.spb), 0, 1)), 0, 1) if i < 3 else .35 + .65 * (.5 + .5 * np.sin(2 * np.pi * 5 * t)) * np.exp(-t / 1.2)
        glide = np.ones_like(t) if i < 3 else (1 + .012 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / .3, 0, 1)) * (1 - .03 * np.clip((t - 1.2) / .6, 0, 1))
        S.add(b, brass(hz(n), dur, .85, voices=2, glide=glide, wah=wah, bright=.8), gain=1.0, bus='room')
        S.note(b, bass, m(n) - 12, d * .8, .6, gain=.3)
    S.add(6.6, wood(700, .8), gain=.6); S.add(6.85, wood(520, .8), gain=.6)
    S.note(7.2, marimba, 'F3', .5, .9, gain=.6)
    return S.render(.08)


SONGS = {'map': (song_map, True), 'battle': (song_battle, True), 'boss': (song_boss, True), 'victory': (song_victory, False), 'lose': (song_lose, False)}
if __name__ == '__main__':
    names = sys.argv[1:] or list(SONGS); meta = {}
    mp = 'audio/bgm/loops.json'
    if os.path.exists(mp): meta = json.load(open(mp))
    for k in names:
        fn, loop = SONGS[k]; x = fn(); x = master(x, -16.0, loop); I, P = loudness(x)
        write_mp3(x, f'audio/bgm/{k}.mp3')
        if loop: meta[k] = {'seconds': round(len(x) / SR, 6), 'samples': len(x), 'sr': SR}
        print(f'{k}: {len(x) / SR:.2f} 秒  {I:.1f} LUFS  峰值 {P:.1f} dB')
    json.dump(meta, open(mp, 'w'), indent=1)
