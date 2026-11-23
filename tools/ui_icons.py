"""介面圖示切圖：design/ui/ui_icons_a.png（GPT 生，6 欄 × 5 列，淺灰底）→ art/ui/<名稱>.png（96×96 透明底）
用法：uv run --with pillow --with numpy --with scipy python tools/ui_icons.py
切完輸出 design/ui/check_icons.png 並排檢查。"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NAMES = ['el_slash', 'el_blunt', 'el_fire', 'el_ice', 'el_holy', 'el_dark',
         'res', 'coin', 'ko', 'life', 'wave', 'call',
         'speed', 'pause', 'snd_on', 'snd_off', 'summon', 'inbox',
         'dmg', 'aspd', 'range', 'refund', 'move', 'promote',
         'mom', 'super', 'fatigue', 'shield', 'guard', 'charge']
src = sys.argv[1] if len(sys.argv) > 1 else 'design/ui/ui_icons_a.png'
a = np.asarray(Image.open(src).convert('RGB')).astype(int)
bgc = np.median(np.concatenate([a[:6, :6].reshape(-1, 3), a[-6:, -6:].reshape(-1, 3), a[:6, -6:].reshape(-1, 3)]), 0)
dist = np.abs(a - bgc).max(-1); bgl = dist < 18
lab, _ = ndi.label(bgl); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
fg = ~np.isin(lab, list(edge)); fg = ndi.binary_opening(fg, iterations=1)
H, W = fg.shape; cw, ch = W / 6, H / 5
os.makedirs('art/ui', exist_ok=True); S = 96
sheet = Image.new('RGBA', (6 * (S + 8), 5 * (S + 8)), (60, 48, 38, 255))
for i, nm in enumerate(NAMES):
    r, c = divmod(i, 6); x0, y0, x1, y1 = int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)
    m = fg[y0:y1, x0:x1]; l2, n2 = ndi.label(ndi.binary_dilation(m, iterations=3))
    if n2 == 0: print('空格', nm); continue
    sizes = ndi.sum(m, l2, range(1, n2 + 1)); keep = [j + 1 for j in range(n2) if sizes[j] > sizes.max() * .04]
    mm = np.isin(l2, keep) & m; ys, xs = np.nonzero(mm)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); rgba[..., :3] = a[y0:y1, x0:x1]; rgba[..., 3] = mm * 255
    im = Image.fromarray(rgba[by0:by1, bx0:bx1], 'RGBA'); im.thumbnail((S - 4, S - 4), Image.LANCZOS)
    out = Image.new('RGBA', (S, S)); out.paste(im, ((S - im.width) // 2, (S - im.height) // 2), im); out.save(f'art/ui/{nm}.png')
    sheet.paste(out, (c * (S + 8) + 4, r * (S + 8) + 4), out)
    ImageDraw.Draw(sheet).text((c * (S + 8) + 4, r * (S + 8) + S - 6), nm, fill=(255, 255, 255, 255))
sheet.save('design/ui/check_icons.png'); print('ok', len(NAMES))
