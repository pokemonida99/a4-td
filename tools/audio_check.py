"""聽檢短片：配樂片段（戰鬥曲放循環接縫）＋每個音效依序播放，畫面打字幕標名稱 → out/audio_check.mp4
用法：uv run --with numpy --with scipy --with pillow python tools/audio_check.py
讀的是 audio/ 裡最後輸出的 mp3（解碼後的真實聲音）。"""
import os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_lib import *
from scipy.io import wavfile
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
F = lambda s: ImageFont.truetype('fonts/NotoSansTC.ttf', s)
B = lambda k: read_audio(f'audio/bgm/{k}.mp3')
S = lambda k: read_audio(f'audio/sfx/{k}.mp3') * .7
def seg_cut(x, a, b): return x[int(a * SR):int(b * SR)]
def fade(x, ms=60):
    n = int(ms / 1000 * SR); x = x.copy(); x[:n] *= np.linspace(0, 1, n)[:, None]; x[-n:] *= np.linspace(1, 0, n)[:, None]; return x
def row(names, gap=.32):
    parts = [S(n) for n in names]; L = int(gap * SR * (len(parts) - 1)) + max(len(p) for p in parts) + int(.15 * SR); out = np.zeros((L, 2))
    for i, p in enumerate(parts): o = int(i * gap * SR); out[o:o + len(p)] += p
    return out
def one(n, pad=.22): x = S(n); return np.concatenate([x, np.zeros((int(pad * SR), 2))])

battle = B('battle')
segs = [('配樂', '標題 map', '輕鬆、馬林巴＋鋼鼓　C 大調 112 BPM　循環 68.6 秒', fade(seg_cut(B('map'), 0, 4.5))),
        ('配樂', '一般戰鬥 battle（循環接縫）', '畫面中間就是循環點：結尾接回開頭　F 大調 128 BPM　循環 90 秒', fade(np.concatenate([battle[-int(2.6 * SR):], battle[:int(2.6 * SR)]]))),
        ('配樂', '頭目 boss', '同調號加快、緊張但卡通　D 小調 140 BPM　循環 82.3 秒', fade(seg_cut(B('boss'), 0, 4.5))),
        ('配樂', '勝利 victory', '不循環　6.2 秒', B('victory')),
        ('配樂', '輸了 lose', '滑稽下行、不悲情　5 秒', B('lose'))]
for c, title, names in (('介面', 'cursor 輕點／confirm 確定／card 調派', ['cursor', 'confirm', 'card']),
                        ('介面', 'coin 金幣（3 種）', ['coin', 'coin_2', 'coin_3']),
                        ('介面', 'train 升職', ['train']),
                        ('出手', 'slash 斬（3 種）', ['slash', 'slash_2', 'slash_3']),
                        ('出手', 'hit 打（3 種）', ['hit', 'hit_2', 'hit_3']),
                        ('出手', 'explosion 火（3 種）', ['explosion', 'explosion_2', 'explosion_3']),
                        ('出手', 'break 冰（3 種）', ['break', 'break_2', 'break_3']),
                        ('出手', 'holy_cast 光（3 種）', ['holy_cast', 'holy_cast_2', 'holy_cast_3']),
                        ('出手', 'dark_blast 暗（3 種）', ['dark_blast', 'dark_blast_2', 'dark_blast_3']),
                        ('事件', 'pop 敵人倒下（連續）', ['pop', 'pop_2', 'pop_3', 'pop', 'pop_3', 'pop_2'])):
    segs.append((c, title, '　'.join(names[:3]), row(names, .32 if c != '事件' else .12)))
for n, zh in (('encounter', '開波號角'), ('boss_appear', '頭目登場'), ('boss_charge', '頭目蓄力'), ('boss_down', '頭目倒下'), ('defeat', '漏怪警告'),
              ('fanfare', '勝利短號'), ('heal', '回復'), ('buff', '加成'), ('shield_up', '護盾'), ('shield_block', '擋下'), ('wok_back', '甩鍋 噹'),
              ('paper_storm', '紙張嘩啦'), ('unite', '合體技'), ('stun', '暈眩'), ('weak', '打到弱點'), ('cutin', '大招切入')):
    segs.append(('事件', f'{n} {zh}', f'audio/sfx/{n}.mp3', one(n)))

W, H = 1280, 720; total = sum(len(s[3]) for s in segs) / SR
with tempfile.TemporaryDirectory() as d:
    lst = []; t0 = 0
    for i, (cat, title, sub, x) in enumerate(segs):
        im = Image.new('RGB', (W, H), (34, 30, 27)); dr = ImageDraw.Draw(im)
        dr.rectangle((0, 0, W, 64), fill=(92, 60, 36)); dr.text((32, 12), '上班旅人外傳　聲音聽檢（全部程式合成）', font=F(30), fill=(245, 230, 200))
        dr.text((80, 210), cat, font=F(40), fill=(230, 180, 90)); dr.text((80, 280), title, font=F(64), fill=(255, 248, 232))
        dr.text((80, 400), sub, font=F(30), fill=(200, 190, 175))
        dr.rectangle((0, H - 14, int(W * (t0 + len(x) / SR) / total), H), fill=(230, 180, 90))
        dr.text((W - 260, H - 60), f'{i + 1} / {len(segs)}', font=F(28), fill=(160, 150, 140))
        p = os.path.join(d, f'{i:03d}.png'); im.save(p); lst.append(f"file '{p}'\nduration {len(x) / SR:.4f}"); t0 += len(x) / SR
    lst.append(f"file '{p}'")
    open(os.path.join(d, 'l.txt'), 'w').write('\n'.join(lst))
    a = np.concatenate([s[3] for s in segs]); a = a / max(1, np.abs(a).max() / .95); wavfile.write(os.path.join(d, 'a.wav'), SR, a.astype(np.float32))
    os.makedirs('out', exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(d, 'l.txt'), '-i', os.path.join(d, 'a.wav'),
                    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '24', '-c:a', 'aac', '-b:a', '192k', '-shortest', 'out/audio_check.mp4'], check=True)
print(f'out/audio_check.mp4  {total:.1f} 秒、{len(segs)} 段')
