"""隊伍對照圖：python tools/art_team.py out.png kui jie kevin …
上半：每人一列（正面／側面／背面待機＋三方向出手第 5 格），放大 2 倍；下半：站在 office_pixel 地圖工位上的遊戲原尺寸畫面（放大 1.5 倍）。"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out, ids = sys.argv[1], sys.argv[2:]
F = ImageFont.truetype('fonts/NotoSansTC.ttf', 24)
def frame(cid, anim, d, i):
    m = json.load(open(f'art/q/{cid}.json')); cw, ch = m['cell']; s = Image.open(f'art/q/{cid}_{anim}_{d}.png').convert('RGBA')
    return s.crop((i * cw, 0, (i + 1) * cw, ch)), m['foot']
S = 2; COLW = 180 * S // 2 * 2; ROWH = 160 * S // 2 * 2
picks = [('idle', 'down', 0), ('idle', 'side', 0), ('idle', 'up', 0), ('atk', 'down', 4), ('atk', 'side', 4), ('atk', 'up', 4)]
heads = ['待機・正面', '待機・側面', '待機・背面', '出手・正面', '出手・側面', '出手・背面']
mp = Image.open('art/map/office_pixel.jpg').convert('RGB'); mj = json.load(open('art/map/office.json'))
crop = (330, 120, 1070, 400); MK = 1.5
mpc = mp.crop(crop); mpc = mpc.resize((int(mpc.width * MK), int(mpc.height * MK)), Image.NEAREST)
W = max(110 + COLW * len(picks), mpc.width + 20); H = 50 + ROWH * len(ids) + mpc.height + 20
sh = Image.new('RGB', (W, H), (52, 46, 40)); dr = ImageDraw.Draw(sh)
for j, h in enumerate(heads): dr.text((110 + j * COLW + 20, 12), h, font=F, fill=(240, 228, 200))
for r, cid in enumerate(ids):
    y0 = 50 + r * ROWH; dr.text((12, y0 + ROWH // 2 - 14), cid, font=F, fill=(240, 228, 200))
    for j, (a, d, i) in enumerate(picks):
        im, (fx, fy) = frame(cid, a, d, i); big = im.resize((im.width * S, im.height * S), Image.NEAREST)
        cx, by = 110 + j * COLW + COLW // 2, y0 + ROWH - 16
        sh.paste(big, (cx - fx * S, by - fy * S), big)
# 地圖上的實際大小：每人放一個工位，前 6 格
y0 = 50 + ROWH * len(ids); sh.paste(mpc, (10, y0))
dirs = ['down', 'side', 'up', 'down', 'side', 'down']
for k, cid in enumerate(ids[:12]):
    sx, sy = mj['slots'][k % 12]
    a, d = ('idle', dirs[k % len(dirs)])
    im, (fx, fy) = frame(cid, a, d, 0); big = im.resize((int(im.width * MK), int(im.height * MK)), Image.NEAREST)
    px = 10 + (sx - crop[0]) * MK - fx * MK; py = y0 + (sy - crop[1]) * MK - fy * MK
    sh.paste(big, (int(px), int(py)), big)
sh.save(out); print('ok', out, sh.size)
