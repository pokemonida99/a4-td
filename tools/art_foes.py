"""敵人對照圖＋走路動畫：python tools/art_foes.py <名稱> foe_minion foe_courier …
→ design/art/<名稱>.png（每隻一列：走路 正／側／背 第 1 格、受擊、特殊姿勢，放大 2 倍）
→ design/art/<名稱>.gif（每隻一列，正／側／背 三格同時走路；最後一欄在地圖走道上由右往左走，側面由程式翻轉）"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
name, ids = sys.argv[1], sys.argv[2:]
F = ImageFont.truetype('fonts/NotoSansTC.ttf', 22)
NAMES = {'foe_minion': '加班大隊', 'foe_courier': '催稿信差', 'foe_knight': '公文櫃重甲兵', 'foe_intern': '續命實習生', 'foe_auntie': '大媽同事', 'foe_chief': '甩鍋課長', 'foe_boss': '奧客總經理'}
def strip(cid, anim, d):
    m = json.load(open(f'art/q/{cid}.json')); cw, ch = m['cell']; p = f'art/q/{cid}_{anim}_{d}.png'
    if not os.path.exists(p): return [], m
    s = Image.open(p).convert('RGBA'); return [s.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(s.width // cw)], m
S = 2; COL = 150 * S // 2 * 2 // 1; ROW = 130 * S
cols = [('walk', 'down', '走路・正面'), ('walk', 'side', '走路・側面'), ('walk', 'up', '走路・背面'), ('hit', 'down', '受擊・正面'), ('hit', 'side', '受擊・側面'), ('hit', 'up', '受擊・背面'), (None, 'down', '特殊姿勢')]
W = 170 + COL * len(cols); H = 50 + ROW * len(ids)
sh = Image.new('RGB', (W, H), (52, 46, 40)); dr = ImageDraw.Draw(sh)
for j, (_, _, t) in enumerate(cols): dr.text((170 + j * COL + 20, 12), t, font=F, fill=(240, 228, 200))
for r, cid in enumerate(ids):
    y0 = 50 + r * ROW; dr.text((12, y0 + ROW // 2 - 14), NAMES.get(cid, cid), font=F, fill=(240, 228, 200))
    m = json.load(open(f'art/q/{cid}.json')); fx, fy = m['foot']
    for j, (a, d, _) in enumerate(cols):
        if a is None: a = next((k for k in m['frames'] if k not in ('walk', 'hit')), None)
        if a is None: continue
        fr, _ = strip(cid, a, d)
        if not fr: continue
        im = fr[0]; big = im.resize((im.width * S, im.height * S), Image.NEAREST)
        sh.paste(big, (170 + j * COL + COL // 2 - fx * S, y0 + ROW - 14 - fy * S), big)
sh.save(f'design/art/{name}.png')
# GIF：正／側／背原地走 + 地圖走道上由右往左（側面翻轉）
mp = Image.open('art/map/office_pixel.jpg').convert('RGB')      # 上走廊（走道中心 y=125）
K = 2; CW = 130 * K; RH = 120 * K; WALKW = 520
frames = []
NF = 24
for t in range(NF):
    c = Image.new('RGB', (3 * CW + WALKW, RH * len(ids)), (58, 52, 46))
    for r, cid in enumerate(ids):
        m = json.load(open(f'art/q/{cid}.json')); fx, fy = m['foot']
        for j, d in enumerate(('down', 'side', 'up')):
            fr, _ = strip(cid, 'walk', d)
            if not fr: continue
            im = fr[t % len(fr)].resize((fr[0].width * K, fr[0].height * K), Image.NEAREST)
            c.paste(im, (j * CW + CW // 2 - fx * K, r * RH + RH - 12 - fy * K), im)
        bg = mp.crop((560, 135 + 8 - RH // K, 560 + WALKW // K, 135 + 8)).resize((WALKW, RH), Image.NEAREST)
        c.paste(bg, (3 * CW, r * RH))
        fr, _ = strip(cid, 'walk', 'side')
        if fr:
            im = fr[t % len(fr)].transpose(Image.FLIP_LEFT_RIGHT).resize((fr[0].width * K, fr[0].height * K), Image.NEAREST)
            x = 3 * CW + WALKW - 40 - int(t * (WALKW + 80) / NF); fxf = fr[0].width - fx
            tmp = c.crop((3 * CW, r * RH, 3 * CW + WALKW, (r + 1) * RH)); tmp.paste(im, (x - 3 * CW - fxf * K, RH - 16 - fy * K), im); c.paste(tmp, (3 * CW, r * RH))
    frames.append(c)
frames = [f.quantize(colors=128, method=Image.Quantize.MEDIANCUT) for f in frames]
frames[0].save(f'design/art/{name}.gif', save_all=True, append_images=frames[1:], duration=110, loop=0, optimize=True)
print('ok', name)
