"""Q 版小人切圖：design/art/raw/<id>_<sheet>.png → art/q/<id>_<anim>_<dir>.png ＋ art/q/<id>.json
用法：python3 tools/art_q.py kui [jie …]   （敵人：python3 tools/art_q.py foe_minion）
raw 圖的約定（GPT 一張圖）：
  同事  <id>_idle.png      3 列 × 4 欄：down／side（面向右）／up 的待機 4 格
        <id>_atk_<dir>.png  2 列 × 4 欄：出手 8 格（第 1、8 格是站姿）
  敵人  <id>_walk_<dir>.png  2 列 × 4 欄：走路 8 格（一個方向一張）
        <id>_extra.png      一排：站姿（量比例）、受擊 正／側／背、特殊姿勢 → <id>_hit_<dir>.png、<id>_<姿勢>_down.png
不靠格線：去背後找「一個個人」（連通塊，特效碎片併到最近的人），依列、再依欄排序。
大小：idle 整張用 down 列的平均身高縮到 TARGET；atk 用第 1、8 格（站姿）身高對齊 idle。
腳底：每格主體最下面一段的中心＝腳底，所有格子對齊同一個 foot。
切完輸出 design/art/check/<id>.png（每格放大 3 倍並排、紅點＝腳底），一定要用眼睛看：
面向（side 全部朝右）、手指手臂數、有沒有被切到或兩格黏在一起。"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TARGET = {'default': 84, 'foe': 76, 'foe_chief': 100, 'foe_boss': 108,   # 正面待機身高（邏輯像素，含帽子）
          'jie': 94}      # 巫師帽很高：含帽 94，身體才跟小葵一樣大
DIRS = ('down', 'side', 'up')
ORDER = ('down', 'dside', 'side', 'uside', 'up')      # 輸出與檢查圖的排列順序

def load_rgba(path):
    """去背（綠幕或淺灰底，從四邊灌水）＋去綠邊，回傳 RGBA ndarray"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    corner = np.concatenate([a[:8, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3)]).mean(0)
    green = corner[1] > corner[0] + 60 and corner[1] > corner[2] + 60
    if green: bgl = (g > 120) & (g > r + 50) & (g > b + 50)
    else:      # 淺灰底：只認「很接近底色」的，白色刀光（比底色亮 20 以上）才不會被當背景
        dist = np.abs(a - np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)]), 0)).max(-1); bgl = dist < 16
    lab, _ = ndi.label(bgl); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    if green: bg |= (g > 150) & (g > r + 70) & (g > b + 70)      # 被包住的綠洞（腋下、手臂間）
    else:      # 被包住的灰洞（劍和身體之間）
        hole, nh = ndi.label(dist < 8); sz = ndi.sum(np.ones_like(dist), hole, range(1, nh + 1))
        bg |= np.isin(hole, [i + 1 for i in range(nh) if sz[i] > 40])
    fg = ndi.binary_opening(~bg, iterations=1)
    if not green:      # 剝掉灰色毛邊：貼著背景、灰色、比底色暗一點的像素（白色刀光比底色亮，不會被剝）
        bgv = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)]), 0).mean()
        v = a.mean(-1); sat = a.max(-1) - a.min(-1); halo = (sat < 22) & (v > bgv - 75) & (v < bgv + 6)
        for _ in range(3): fg &= ~(halo & ~ndi.binary_erosion(fg))
    out = np.zeros(a.shape[:2] + (4,), np.uint8); out[..., :3] = a; out[..., 3] = fg * 255
    m = out[..., 1].astype(int) > np.maximum(out[..., 0], out[..., 2]).astype(int) + 40      # 去綠邊
    out[..., 1] = np.where(m, np.maximum(out[..., 0], out[..., 2]), out[..., 1])
    return out

def people(rgba, n_expect):
    """找出畫面上的每個人：大塊＝人，小碎片（特效、劍光）併到最近的人"""
    fg = rgba[..., 3] > 0; lab, n = ndi.label(ndi.binary_dilation(fg, iterations=4))
    objs = ndi.find_objects(lab); areas = ndi.sum(fg, lab, range(1, n + 1))
    order = np.argsort(-areas); big = [i for i in order[:n_expect] if areas[i] > areas[order[0]] * 0.25]
    groups = {i: [i] for i in big}
    for i in range(n):
        if i in groups or areas[i] < 30: continue
        sl = objs[i]; cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        def dist(j):
            s = objs[j]; dy = max(s[0].start - cy, 0, cy - s[0].stop); dx = max(s[1].start - cx, 0, cx - s[1].stop); return dy * dy + dx * dx
        j = min(big, key=dist)
        if dist(j) < 90 ** 2: groups[j].append(i)
    res = []
    for j, mem in groups.items():
        mask = np.isin(lab, [m + 1 for m in mem]) & fg; main = (lab == j + 1) & fg
        ys, xs = np.nonzero(mask); my, mx = np.nonzero(main)
        # 腳：最下面一段裡「粗」的欄（鞋子），細的劍尖、刀光不算
        top = my.min(); H0 = my.max() - top
        wide = np.nonzero(main.sum(1) >= H0 * 0.10)[0]; foot_y = wide.max()      # 鞋底那一列夠寬；劍尖只有幾像素寬
        band = max(6, int(H0 * 0.12)); sub = main[foot_y - band + 1:foot_y + 1]; cnt = sub.sum(0)
        thick = np.nonzero(cnt >= band * 0.45)[0]
        if len(thick) == 0: thick = np.nonzero(cnt)[0]
        foot_x = (thick.min() + thick.max()) / 2
        body_h = foot_y - top
        res.append(dict(mask=mask, box=(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), foot=(foot_x, foot_y), h=body_h, cy=(my.min() + foot_y) / 2, cx=mx.mean()))
    return res

def grid(ps, rows):
    """依列（y）再依欄（x）排序"""
    ps = sorted(ps, key=lambda p: p['cy']); per = len(ps) // rows
    return [sorted(ps[r * per:(r + 1) * per], key=lambda p: p['cx']) for r in range(rows)]

def crop(rgba, p, k):
    x0, y0, x1, y1 = p['box']; im = rgba[y0:y1, x0:x1].copy(); im[..., 3] = np.where(p['mask'][y0:y1, x0:x1], im[..., 3], 0)
    pil = Image.fromarray(im, 'RGBA'); w, h = max(1, round(pil.width * k)), max(1, round(pil.height * k))
    pil = pil.resize((w, h), Image.LANCZOS)
    al = np.asarray(pil)[..., 3]; arr = np.asarray(pil).copy(); arr[..., 3] = np.where(al > 110, 255, 0)  # 硬邊，像素風
    op = arr[..., 3] > 0; nb = ndi.convolve(op.astype(int), np.ones((3, 3), int), mode='constant') - op      # 孤立的單點（四周 ≤1 個鄰居）拿掉
    arr[..., 3] = np.where(op & (nb <= 1), 0, arr[..., 3])
    return Image.fromarray(arr, 'RGBA'), ((p['foot'][0] - x0) * k, (p['foot'][1] - y0) * k)

def build(cid):
    raw = 'design/art/raw'; foe = cid.startswith('foe_'); T = TARGET.get(cid, TARGET['foe' if foe else 'default'])
    frames = {}      # (anim, dir) → [(img, foot)]
    if foe:      # 每個方向一張：<id>_walk_<dir>.png，8 格（4 欄 × 2 列）
        n = 8
        for d in DIRS:
            src = f'{raw}/{cid}_walk_{d}.png'
            if not os.path.exists(src): print(cid, d, 'walk 還沒生'); continue
            rgba = load_rgba(src); ps = people(rgba, n)
            if len(ps) != n: print(f'{cid} walk_{d}：找到 {len(ps)} 個（應 {n}）'); continue
            g = grid(ps, 2); row = g[0] + g[1]; k = T / np.median([p['h'] for p in row])
            frames[('walk', d)] = [crop(rgba, p, k) for p in row]
        pose = {'foe_intern': 'fall', 'foe_chief': 'guard', 'foe_boss': 'charge'}.get(cid)
        src = f'{raw}/{cid}_extra.png'      # 一排：站姿（量比例）、受擊 正／側／背、特殊姿勢
        nfr = {'walk': n}
        if os.path.exists(src):
            want = 5 if pose else 4; rgba = load_rgba(src); ps = sorted(people(rgba, want), key=lambda p: p['cx'])
            if len(ps) == want:
                kx = T / ps[0]['h']
                for d, p in zip(DIRS, ps[1:4]): frames[('hit', d)] = [crop(rgba, p, kx)]
                nfr['hit'] = 1
                if pose: frames[(pose, 'down')] = [crop(rgba, ps[4], kx)]; nfr[pose] = 1
            else: print(cid, 'extra 找到', len(ps), f'個（應 {want}）')
    else:
        rgba = load_rgba(f'{raw}/{cid}_idle.png'); ps = people(rgba, 12)
        if len(ps) != 12: sys.exit(f'{cid} idle：找到 {len(ps)} 個（應 12）')
        g = grid(ps, 3); k = T / np.mean([p['h'] for p in g[0]])
        for d, row in zip(DIRS, g): frames[('idle', d)] = [crop(rgba, p, k) for p in row]
        src = f'{raw}/{cid}_idle_diag.png'      # 斜向待機：2 列 × 4 欄（dside 斜前、uside 斜後，都朝右）
        if os.path.exists(src):
            rgba = load_rgba(src); ps = people(rgba, 8)
            if len(ps) == 8:
                g = grid(ps, 2); kk = T / np.mean([p['h'] for p in g[0]])
                for d, row in zip(('dside', 'uside'), g): frames[('idle', d)] = [crop(rgba, p, kk) for p in row]
            else: print(f'{cid} idle_diag：找到 {len(ps)} 個（應 8）')
        for d in DIRS + ('dside', 'uside'):
            src = f'{raw}/{cid}_atk_{d}.png'
            if not os.path.exists(src): print(cid, d, 'atk 還沒生'); continue
            rgba = load_rgba(src); ps = people(rgba, 8)
            if len(ps) != 8: print(f'{cid} atk_{d}：找到 {len(ps)} 個（應 8）'); continue
            g = grid(ps, 2); row = g[0] + g[1]
            ref = max(row[0]['h'], row[7]['h']); kd = T / ref
            frames[('atk', d)] = [crop(rgba, p, kd) for p in row]
        nfr = {'idle': 4, 'atk': 8}
    # 統一格子：以腳底為原點，取所有格子往左右上下延伸的最大值
    L = R = U = D = 0
    for fr in frames.values():
        for im, (fx, fy) in fr: L, R, U, D = max(L, fx), max(R, im.width - fx), max(U, fy), max(D, im.height - fy)
    half = int(np.ceil(max(L, R))) + 2; cw, ch = half * 2, int(np.ceil(U)) + int(np.ceil(D)) + 4; foot = (half, int(np.ceil(U)) + 2)
    os.makedirs('art/q', exist_ok=True); rows = []
    for (anim, d), fr in sorted(frames.items(), key=lambda kv: (list(nfr).index(kv[0][0]) if kv[0][0] in nfr else 9, ORDER.index(kv[0][1]))):
        strip = Image.new('RGBA', (cw * len(fr), ch))
        for i, (im, (fx, fy)) in enumerate(fr): strip.paste(im, (i * cw + round(foot[0] - fx), round(foot[1] - fy)), im)
        strip.save(f'art/q/{cid}_{anim}_{d}.png'); rows.append((f'{anim}_{d}', strip))
    json.dump({'cell': [cw, ch], 'foot': list(foot), 'frames': nfr, 'scale': 1}, open(f'art/q/{cid}.json', 'w'))
    # 檢查圖
    S = 3; W = max(s.width for _, s in rows) * S; sheet = Image.new('RGBA', (W, len(rows) * ch * S), (72, 66, 60, 255))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(sheet)
    for r, (name, s) in enumerate(rows):
        big = s.resize((s.width * S, s.height * S), Image.NEAREST); sheet.paste(big, (0, r * ch * S), big)
        for i in range(s.width // cw):
            x = (i * cw + foot[0]) * S; y = (r * ch + foot[1]) * S; dr.rectangle((x - 2, y - 2, x + 2, y + 2), fill=(255, 40, 40, 255))
            dr.rectangle((i * cw * S, r * ch * S, (i + 1) * cw * S - 1, (r + 1) * ch * S - 1), outline=(110, 100, 90, 255))
        dr.text((4, r * ch * S + 2), name, fill=(255, 255, 255, 255))
    os.makedirs('design/art/check', exist_ok=True); sheet.save(f'design/art/check/{cid}.png')
    print(cid, 'cell', cw, ch, 'foot', foot, {k: len(v) for k, v in frames.items()})

for c in sys.argv[1:]: build(c)
