# 把三種畫風的樣張（3 列角色 × 4 欄：正面、側面、背面、出手）切成遊戲用的單張，放 art/q_<風格>/
# 用法：python3 tools/art_cut_styles.py
from PIL import Image
from collections import deque
import json, os
IDS = ['kui', 'jie', 'kevin']; TARGET = 84      # 正面待機在畫面上的高度（邏輯像素）
def bgmask(im):
    W, H = im.size; px = im.load(); seen = bytearray(W * H); q = deque()
    def bgl(p): r, g, b = p[:3]; return max(r, g, b) - min(r, g, b) < 24 and r > 140
    for x in range(W):
        for y in (0, H - 1): q.append((x, y))
    for y in range(H):
        for x in (0, W - 1): q.append((x, y))
    while q:
        x, y = q.popleft(); i = y * W + x
        if seen[i] or not bgl(px[x, y]): continue
        seen[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < W - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < H - 1: q.append((x, y + 1))
    return seen
for st in 'abc':
    src = Image.open(f'design/art/style_{st}.png').convert('RGBA'); W, H = src.size
    m = bgmask(src); px = src.load()
    for y in range(H):
        for x in range(W):
            if m[y * W + x]: px[x, y] = (0, 0, 0, 0)
    out = f'art/q_{st}'; os.makedirs(out, exist_ok=True)
    cw, ch = W / 4, H / 3
    for r, cid in enumerate(IDS):
        cells = []
        for col in range(4):
            cell = src.crop((int(col * cw), int(r * ch), int((col + 1) * cw), int((r + 1) * ch)))
            bb = cell.getbbox(); cells.append(cell.crop(bb) if bb else cell)
        k = TARGET / cells[0].height
        names = ['idle_down', 'idle_side', 'idle_up', 'atk_down']
        cw2 = max(int(c.width * k) for c in cells) + 4; ch2 = max(int(c.height * k) for c in cells) + 4
        for nm, c in zip(names, cells):
            c2 = c.resize((max(1, int(c.width * k)), max(1, int(c.height * k))), Image.LANCZOS)
            cv = Image.new('RGBA', (cw2, ch2)); cv.paste(c2, ((cw2 - c2.width) // 2, ch2 - c2.height - 2), c2); cv.save(f'{out}/{cid}_{nm}.png')
        json.dump({'cell': [cw2, ch2], 'foot': [cw2 // 2, ch2 - 4], 'frames': {'idle': 1, 'atk': 1}, 'scale': 1, 'test': True}, open(f'{out}/{cid}.json', 'w'))
    print(st, 'ok')
