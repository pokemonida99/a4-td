"""對照圖與動畫預覽：python tools/art_sheet.py kui → design/art/<id>_sheet.png、design/art/<id>_anim.gif"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT = 'fonts/NotoSansTC.ttf'
NAME = {'idle': '待機', 'atk': '出手', 'walk': '走路', 'down': '正面', 'side': '側面', 'up': '背面'}
def strips(cid):
    m = json.load(open(f'art/q/{cid}.json')); cw, ch = m['cell']; out = []
    for anim in m['frames']:
        for d in ('down', 'side', 'up'):
            p = f'art/q/{cid}_{anim}_{d}.png'
            if os.path.exists(p): s = Image.open(p).convert('RGBA'); out.append((anim, d, [s.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(s.width // cw)]))
    return m, out
for cid in sys.argv[1:]:
    m, rows = strips(cid); cw, ch = m['cell']; S = 3; f = ImageFont.truetype(FONT, 26); fs = ImageFont.truetype(FONT, 20)
    lw = 150; W = lw + 8 * cw * S + 20; H = 70 + len(rows) * (ch * S + 10)
    sh = Image.new('RGB', (W, H), (58, 52, 46)); dr = ImageDraw.Draw(sh)
    dr.text((16, 18), f'{cid}　Q 版樣張（格 {cw}×{ch}、腳底 {tuple(m["foot"])}、畫面上身高 84）', font=f, fill=(240, 228, 200))
    y = 70
    for anim, d, fr in rows:
        dr.text((16, y + ch * S // 2 - 14), f'{NAME[anim]}・{NAME[d]}', font=fs, fill=(240, 228, 200))
        for i, im in enumerate(fr):
            x = lw + i * cw * S; dr.rectangle((x, y, x + cw * S - 2, y + ch * S - 2), fill=(72, 66, 58))
            big = im.resize((cw * S, ch * S), Image.NEAREST); sh.paste(big, (x, y), big)
        y += ch * S + 10
    sh.save(f'design/art/{cid}_sheet.png')
    # 動畫：每個動作排一格、同時播
    S2 = 3; n = len(rows); cols = min(n, 3); rr = (n + cols - 1) // cols; frames = []
    for t in range(16):
        c = Image.new('RGB', (cols * cw * S2, rr * ch * S2), (72, 66, 58))
        for k, (anim, d, fr) in enumerate(rows):
            im = fr[(t // (2 if anim == 'idle' else 1)) % len(fr)].resize((cw * S2, ch * S2), Image.NEAREST)
            c.paste(im, ((k % cols) * cw * S2, (k // cols) * ch * S2), im)
        frames.append(c)
    frames[0].save(f'design/art/{cid}_anim.gif', save_all=True, append_images=frames[1:], duration=90, loop=0)
    print('ok', cid)
