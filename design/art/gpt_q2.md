- **1. 比例與站姿：用「正面可讀、身體符合俯視透視」的折衷**
  - **建議固定為 2.5 頭身、角色高 72 邏輯像素**，落在你要的 60～84 像素之間。可以先分成：頭部高 29、軀幹到胯部高 21、腿與鞋高 22 像素。帽子、髮尖與武器另外計算。
  - 頭寬約 **28～32 像素**，肩寬約 24～30 像素。讓職業靠帽子、肩甲、武器辨識，避免把身體壓到只剩一顆頭和兩隻鞋。
  - **down 不是平視證件照，也不是刻意低頭。**角色維持自然站姿，由上方攝影機看見頭頂、肩膀上表面與鞋面。頭頂可占頭部可見高度約 15～25%；眼睛仍清楚，避免下巴壓胸、眼睛往上瞪。
  - 地圖視角約 45 度，角色可以採較輕的俯視程度。這是為了保留 Q 版表情，無須把角色嚴格投影成縮短的俯視人體。
  - **腳底要貼地：**
    - 兩腳左右分開約 12～16 像素，鞋底落在同一條接地線。
    - 看得到鞋面，鞋底厚度只留少量像素；避免把整片鞋底朝鏡頭展示。
    - 腳下放一塊緊貼鞋底的小型橢圓接觸陰影，比漂浮的大光圈更能表現重量。
    - 若工位底座的頂面是圓形，45 度俯視時可先用寬高約 **1.4：1** 的橢圓，再依地圖調整。鞋底應落在頂面內，不要貼著底座最下緣。
  - **三方向共用一張規格卡：**角色高度、頭部尺寸、肩線、胯線、鞋底線、武器尺寸都固定。side 換成側面輪廓，up 換成後腦與背部；不要重新設計一個角色。頭寬以同一顆頭的體積為準，允許側面輪廓稍窄，別硬拉成正面寬度。
  - 固定角色的握武器手與裝備位置。你要用水平翻轉得到左向，因此**名牌文字、單側盾牌、左右不對稱裝備也會一起翻轉**；美術設計最好提前接受這個結果。

- **2. 格子表：建議「一張一方向、一種動作」，攻擊用 4×2**
  - 我會選擇最容易描述與檢查的版型：
    - **atk：4 欄 × 2 列，共 8 格。**
    - **idle：2 欄 × 2 列，共 4 格。**
    - **walk：統一做 8 格、4 欄 × 2 列。**比不同敵人混用 6 格、8 格容易管理。
  - **不要用一張 4×3 同時塞三方向。**每列雖然能分配方向，但容易發生方向串列、裝備變形，以及模型把不同方向當成不同角色的問題。1×8 則太細長，角色和動作細節容易被壓縮。
  - 建議每格使用 **128×128 邏輯像素**。例如攻擊表的邏輯尺寸就是 512×256；實際生成可以用較高解析度，但仍遵守相同分格比例。這是排版目標，**提示詞無法保證生成結果每格精確相等**。
  - 每格統一定位，例如：
    - 接地錨點：`(64, 104)`。
    - 72 像素高角色的頭頂：約 `y=32`。
    - 頭頂、腳底、左右武器揮動都保留空間；特別長的武器應增大所有格子的尺寸，避免單獨縮小某格角色。
  - **成品不要畫格線、格框、編號、定位圓點或底座。**它們容易被誤當成角色內容，也會增加去背與清理負擔。工位底座建議由遊戲另外繪製。
  - 若要給生成工具一張版型參考，可以在參考圖標示格線與錨點，並要求輸出時移除；定位標記留在參考圖即可。
  - 三方向先確認單張角色設定，再各自生成動作表。每次附上同一份角色參考，通常比單靠重複文字描述更能維持一致。
  - 背景依你的規則使用純綠或淺灰；**不要漸層、地板紋理或環境陰影**。接觸陰影也可以交給遊戲統一畫，讓去背更乾淨。

- **3. 8 格攻擊：先固定節奏，再替換職業動作**
  - 共用骨架可以是：
    1. **起勢**：從待機姿勢開始。
    2. **預備**：肩膀、手臂或武器移向蓄力位置。
    3. **蓄力極點**：姿勢最緊，讓玩家看懂即將出手。
    4. **出手**：武器或手臂快速通過攻擊路徑。
    5. **命中／釋放**：最大伸展，搭配短促特效。
    6. **隨勢**：保留少量慣性。
    7. **收招**：武器回到身邊。
    8. **回位**：接近 idle，方便銜接。
  - 不必八格等速。可先試 **80、80、80、50、50、70、80、110 毫秒**，合計 600 毫秒；攻速較慢時延長待機或冷卻，不必把出手瞬間一起拖慢。傷害或投射物事件固定綁在第 4 或第 5 格。

  | 職業 | 第 1～3 格：起勢與蓄力 | 第 4～5 格：出手與命中 | 第 6～8 格：隨勢與回位 |
  |---|---|---|---|
  | 劍士 | 握劍靠身、手肘後收、劍舉至肩側 | 斜劈、刀鋒到達前下方；短弧光只出現一兩格 | 劍順勢下落、收回胸側、恢復站姿 |
  | 法師 | 法杖微抬、另一手聚能、杖頭亮起 | 杖尖前送、能量離開杖頭 | 袖口與杖頭略回彈、手放低、回位 |
  | 坦克 | 盾牌收近、屈膝、肩膀壓低 | 向前盾擊、盾面出現短促衝擊光 | 身體小幅回彈、盾牌收回、站穩 |
  | 弓手 | 抬弓、拉弦、滿弓停留 | 放弦、箭離弓；弓臂保持伸出 | 弓弦回彈、拉弦手收回、弓降低 |
  | 補師 | 雙手或聖物靠胸、光點聚集、聖物抬高 | 向前祝福、柔和符印或光粒送出 | 光粒消散、手臂放低、回位 |

  - **side 全程面向右：**
    - 鼻尖、胸口、膝蓋與攻擊軸都指向右方；通常只清楚看見一隻眼睛。
    - 劍鋒、杖頭、盾面、箭頭伸向右側，避免武器橫在臉前。
    - 遠側手臂可以被軀幹遮住，但手掌仍須接在合理的位置。弓手尤其要先確定「持弓手在前、拉弦手在臉側」，不要讓兩手交換工作。
    - 頭可以隨身體微動，**不可轉回鏡頭露出正面雙眼**。
  - **up 全程背對鏡頭：**
    - 顯示後腦、後領、背甲或披風，不顯示眼睛與嘴巴。
    - 前方武器容易被身體遮住，因此利用肩膀外側或頭頂外側的輪廓保留辨識：例如劍從肩側舉起、杖頭露在頭頂一側、弓身露出一側肩膀。
    - 攻擊往畫面上方延伸，特效主要放在頭肩以上的前方空間；不要為了展示武器而把手臂扭到背後。
  - **命中特效最好和角色分開。**角色表只保留短小刀光、杖頭光等附著效果；箭、飛彈、敵人位置的命中光由遊戲畫，方向與射程會更清楚。

- **4. idle 四格：動上半身，腳底保持穩定**
  - 四格可以做成：**中性 → 微吸氣 → 中性 → 微吐氣**。
  - 以 72 像素高角色來說，頭與肩膀的上下位移控制在 **0～1 邏輯像素**；不要整個人上下跳 3～4 像素。
  - 雙腳固定，透過胸口、肩膀、手肘的小幅變化表現呼吸。髮尾、披風邊與杖飾最多延遲擺動 1 像素。
  - 每格約 180～250 毫秒，整輪約 0.7～1 秒，可從此範圍調整。
  - 眨眼適合另外偶爾觸發；若直接放進四格循環，每秒眨一次容易顯得緊張。
  - 每個職業最多加一種小動作：劍士握劍微調、法師杖頭閃光、坦克肩甲呼吸、弓手弓身微擺、補師聖物微亮。避免同時晃頭、搖手、踏步、閃光。
  - 三方向保持同樣的呼吸節拍；side 不回頭，up 不露臉。

- **5. 可套用的英文提示詞範本**
  - `{方向}` 請替換成下面其中一段，避免只寫模糊的 `side`：
    - down：`DOWN: facing screen-bottom toward the viewer, with a gently elevated camera showing the crown of the head`
    - side：`SIDE: facing screen-right in every frame, head and torso aligned to the right, one visible eye, no gaze toward the viewer`
    - up：`UP: facing screen-top away from the viewer, back of head and back of torso visible, no visible eyes or mouth`
  - `{動作}` 裡同時填入**格數、版型、逐格描述**。例如攻擊寫 `8 frames, 4 columns by 2 rows`，接著描述 Frame 1～8；idle 改成 `4 frames, 2 columns by 2 rows`。
  - 範本如下；背景色那一行依角色配色選擇其一：

```text
Create one clean pixel-art animation sprite sheet for a fantasy-office
tower-defense game.

CHARACTER
{角色描述}

VIEW AND DIRECTION
{方向}

ANIMATION AND LAYOUT
{動作}

Read frames from left to right, then top to bottom.
Use a perfectly regular, edge-to-edge grid of equally sized invisible cells.
Place exactly one complete character pose in each cell.
No additional poses, inset images, portraits, or decorative panels.

CHARACTER PROPORTIONS
A cute chibi office worker wearing a fantasy RPG class outfit.
Approximately 2.5 heads tall, designed to read at 72 logical pixels in height.
Use the same character scale, head volume, costume, colors, and equipment
in every frame.

Use an elevated three-quarter game camera.
Show a modest amount of the crown, shoulder tops, and shoe tops.
Keep the head naturally aligned with the torso.
Preserve the specified facing direction throughout the entire animation.

REGISTRATION
Treat every cell as a 128 by 128 logical-pixel canvas.
Use the same ground anchor at local coordinate (64, 104) in every cell.
For a planted stance, keep both soles on the same ground baseline.
Keep the same nominal standing height across frames;
only the explicitly described action may change the pose height.
Reserve enough empty space for the full weapon motion.
Never resize a character to make a pose fit.
Keep all body parts, weapons, and attached effects inside their own cells.

ANATOMY AND EQUIPMENT
Exactly two arms, two hands, and two legs per character.
Each hand stays attached to its own forearm.
Use simple compact pixel-art mitten hands, without individually drawn fingers.
Keep the same weapon in the same hand throughout.
Keep weapon shape, length, grip, and costume details consistent.
Use clear overlaps to distinguish the near arm from the far arm.
No duplicated limbs, floating hands, extra weapons, or changing equipment.

PIXEL-ART STYLE
Crisp square pixel clusters, controlled outlines, and a compact color palette.
Readable silhouettes and restrained shading.
Character sprites suitable for an HD-2D fantasy-office environment.
No painterly texture, soft airbrushing, depth-of-field blur, or motion blur.
Show fast movement through discrete poses and short, crisp effect shapes.

BACKGROUND
Use one perfectly flat solid background color:
#00FF00 green, with no green reflected light or green edge glow.
[Replace this background instruction with flat light gray if appropriate.]

OUTPUT
Sprite sheet only.
No visible grid lines, borders, labels, numbers, text, markers,
platforms, floor, cast shadows, scenery, or watermark.
```

  - 這段能降低方向、肢體與排格錯誤，但不能保證精確座標。**某格朝向錯誤、增加手臂或武器換手時，優先修那一格或重生該方向；切格與腳底對齊只能處理排版，無法補救錯誤的人體結構。**