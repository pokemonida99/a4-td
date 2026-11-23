# 塔防 Q 版美術：做法與檔案

畫風定案：**C 精緻像素 3 頭身**（使用者 2026-11-23：「三頭身比較好…用精緻度甩開其他人」）。基準圖 `style_c.png`。
同事 **8 方向**（使用者：「角度不只四個 要8個這樣才細緻」）：畫 5 個方向，左邊 3 個由程式水平翻轉。
GPT 討論（格子表、比例、出招分解）：`gpt_q2.txt`（題目）、`gpt_q2.md`（回答）。

## 成品（遊戲讀這些）
- `art/q/<id>.json`：`{cell:[寬,高], foot:[x,y], frames:{…}, scale:1}`。**每個角色 cell 不同，請讀各自 json**；重切時 cell/foot 可能變。
- 同事：`art/q/<id>_idle_<dir>.png`（4 格）、`art/q/<id>_atk_<dir>.png`（8 格）
  - dir：`down` 正面、`dside` 斜前（面向右下）、`side` 側面（面向右）、`uside` 斜後（面向右上）、`up` 背面。
- 敵人：`art/q/foe_<種類>_walk_<dir>.png`（8 格，dir＝down／side／up）、`foe_<種類>_hit_<dir>.png`（受擊 1 格）
  - 特殊姿勢 1 格：`foe_intern_fall_down.png`（倒地）、`foe_chief_guard_down.png`（舉鍋擋）、`foe_boss_charge_down.png`（攤卷蓄力）
  - frames 例：`{"walk":8,"hit":1,"guard":1}`
- 身高（正面、含帽）：同事 84（阿傑巫師帽高，含帽 94 讓身體同大）；一般敵人 76、甩鍋課長 100、奧客總經理 108。
- 出手節奏建議：80,80,80,50,50,70,80,110 毫秒，傷害綁第 5 格（主 session 已採用）。

## 對照圖（給人看）
- `<id>_sheet.png`（每人全部格子放大 3 倍）、`<id>_anim.gif`（小葵）
- `team6_sheet.png`：預設隊伍六人五方向＋站在地圖工位上的實際大小；`team10_sheet.png`：其餘 10 位
- 完成狀態（2026-11-23）：16 位同事（kui jie kevin yan zhe mi heilun cha qiang senpai wu you fairy xu an vivi）五方向、12 種敵人全部完成
- `foes_sheet_3.png/.gif`：配合敵人屬性新增的 foe_ghost 掛名專員、foe_clerk 照章辦事員、foe_patcher 反覆補件員、foe_cart 群組轉寄車（身高 96）、foe_mini 小公文（身高 44）。這五個沒有 RPG 原圖，造型照 `design/btd6/DESIGN.md` 第三節的描述、畫風參考 `ref/foe_newstyle_ref.png`（用已完成的 Q 版敵人拼的）
- `foes_sheet_1.png/.gif`（加班大隊、催稿信差、公文櫃重甲兵）、`foes_sheet_2.png/.gif`（實習生、大媽、課長、總經理）；GIF 右欄是在地圖走道上實際走過去
- `check/<id>.png`：切圖檢查（紅點＝腳底）

## 做法
1. 參考圖 `ref/<id>_ref.png`：上面一條 style_c 的小葵（畫風）＋下面 RPG 原圖放大 4 倍與半身立繪（造型）。敵人 `ref/foe_<種類>_ref.png`。
2. 生圖：`tools/art_gen.sh <id> <sheet…>`，sheet：
   - 同事 `idle`（3 列×4：正／側／背待機，參考 ref）→ `idle_diag`（2 列×4：斜前／斜後待機，參考 idle）→ `atk_down|atk_side|atk_up`（參考 idle）、`atk_dside|atk_uside`（參考 idle_diag）
   - 敵人 `walk_down`（參考 ref）→ `walk_side|walk_up`（參考 walk_down）、`extra`（一排：站姿、受擊正／側／背、特殊姿勢）
   - 排隊：`tools/art_queue.sh kui:idle_diag foe_minion:walk_down …`（全機最多 3 張、等參考圖生好才送、已有的跳過，記錄在 `raw/queue.log`）。**zsh 組清單要寫 `${c}:atk_down`**，`$c:atk_down` 的 `:a` 會被當路徑修飾字（曾因此整批空跑）。
3. 切圖：`uv run --with pillow --with numpy --with scipy python tools/art_q.py <id>` → `art/q/`＋`check/<id>.png`
4. 對照：`uv run --with pillow python tools/art_sheet.py <id>`、`tools/art_team.py <out.png> <id…>`、`tools/art_foes.py <名稱> foe_…`
5. **逐張看**：手指手臂數、側面全部朝右、武器在同一隻手（正面在畫面左＝背面在畫面右）、去背邊緣、黏格／切掉、頭身比跟小葵一樣。

## 切圖細節（tools/art_q.py）
- 淺灰底 #DDDDDD：只把跟底色差 <16 的從四邊灌水當背景（白色刀光比底色亮所以留著）；被包住的灰洞另外挖。
- 灰色毛邊：貼著背景、灰色、比底色稍暗的像素剝 3 圈；縮小後孤立單點拿掉。綠幕底也支援（g 比 r、b 都大 40 → g 壓成 max(r,b)）。
- 不靠格線：膨脹後找連通塊＝人，小碎片（火球、刀光）併到最近的人；依列再依欄排序。
- 腳底：最下面「夠寬」的那一列（劍尖只有幾像素寬不算）＋那一段粗欄（鞋子）的中心。
- 縮放：idle 用正面列平均身高、atk 用第 1／8 格（站姿）、walk 用中位數、extra 用第一個站姿，對到 TARGET。

## 提示詞
共用片段 `tools/art_prompts.sh`（STYLE 含「3 頭身、頭佔身高三分之一」、LAYOUT8、FRONT／DSIDE／SIDE／USIDE／BACK），角色描述 DESC、出招 ACT、敵人 POSE／WALK8／EXTRA 在 `tools/art_gen.sh`，待機版型 `raw/idle_layout.txt`、`raw/diag_layout.txt`。
學到的：
- 不寫頭身比，GPT 會畫成 4 頭身（小燕、阿哲第一版），要寫「big round head about one third of the total height」。
- 斜前要寫「nose, chest and toes point to the lower right, far shoulder partly hidden」，不然會畫成幾乎正面。
- 推車、盾這類大道具要寫「EVERY figure including the back view」（轉寄車第一版背面受擊推車不見）；用 `EXNOTE[id]` 加在 extra 提示詞後面
- 單手持盾／武器的角色要寫明在哪隻手、各方向在畫面哪一邊（Kevin 斜後出手第一版盾換手）。
- 手用「simple compact mitten-like pixel hands」，手指錯誤少很多；側面寫「never turning toward the viewer」避免回眸。

## 舊版
`raw/old_v1/`：小燕、阿哲 4 頭身版，阿哲／小米第一版斜向待機，Kevin 斜後出手第一版。
