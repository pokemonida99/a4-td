# 素材格式約定（美術 session 交、主 session 讀）

## Q 版角色與敵人：`art/q/`
- 每個「角色 × 動作 × 方向」一張橫條 PNG：`art/q/<id>_<anim>_<dir>.png`
  - `<id>`：同事用 RPG 代號（kui、jie、kevin、yan、zhe、mi…）；敵人用 `foe_<種類>`（foe_minion、foe_courier、foe_knight、foe_chief、foe_boss…）
  - `<anim>`：同事 `idle`（待機，4 格）、`atk`（出手，8 格）；敵人 `walk`（走路，6～8 格）、`hit`（受擊，可 1 格）
  - `<dir>`：`down`（面向鏡頭）、`side`（**一律面向右**，左邊程式翻轉）、`up`（背面）
- 每格大小相同、透明背景、不留格線；腳底基準線在每格同一高度。
- 每個角色一份 `art/q/<id>.json`：`{ "cell": [寬, 高], "foot": [x, y], "frames": { "idle": 4, "atk": 8 }, "scale": 顯示倍率 }`
  - `foot` 是格子裡腳底中心的座標（站在工位上的定位點）。
- 畫面上 Q 版同事目標高度約 56～64 邏輯像素（RPG 小人是 117）；頭身比約 2～2.5 頭身。

> 2026-11-23 更新（8 方向）：使用者要「角度不只四個，要 8 個這樣才細緻」。同事的 `<dir>` 改成 5 個：`down`（正面）、`dside`（斜前，面向右下）、`side`（面向右）、`uside`（斜後，面向右上、看得到背和一點側臉）、`up`（背面）；左邊三個方向程式翻轉，合計 8 方向。斜向的圖沒到時程式退回 side。敵人走的走道只有橫、直兩種，走路維持 down／side／up。
>
> 2026-11-23 更新：使用者選定 **C 版精緻像素 3 頭身**（畫風基準 `design/art/style_c.png`），正面待機高度 84 邏輯像素；地圖改成 **1280×590 全畫面**、用 `art/map/office_pixel.jpg`（工位已畫在地圖上，不需要 pad.png），座標在 `art/map/office.json`。下面地圖一節的 1096×442 作廢。

## 地圖：`art/map/`（舊規格，已作廢）
- `art/map/office.jpg`（或 png）：1096×442（或同比例放大 2 倍 2192×884），俯視 3/4。
- `art/map/office.json`：以 1096×442 為座標系
  - `path`：走道中心線折線 `[[x,y], …]`，從入口（電梯）到終點（打卡機）
  - `slots`：12 個工位中心 `[[x,y], …]`
  - `gate`、`clock`：入口與打卡機座標
- `art/map/pad.png`：工位底座（透明背景），`art/map/pad.json` 寫腳底定位點。
