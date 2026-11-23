# 塔防聲音：全部程式合成

使用者要求（2026-11-23）：「音效太難聽了 很像鬼」「音樂你自己合成 不要用到其他服務」「參考猴子塔防的氛圍」。
所以**每一個聲音都是 numpy 從零算出來的波形**：沒有用 ElevenLabs、Suno、GPT、取樣包或任何素材庫。

氣氛：明亮、輕快、可愛、熱帶放克。鋼鼓、馬林巴、鐵琴、彈跳貝斯、烏克麗麗反拍刷弦、拍手、輕鼓組、銅管點綴；大調為主、112～140 BPM。
避免：陰森、長殘響、低沉嗡嗡、刺耳高頻（只有 0.4 秒左右的小房間殘響、14 kHz 以上濾掉、貝斯與大鼓不往 50 Hz 以下走）。

## 檔案
- 配樂 `audio/bgm/`（-16 LUFS，峰值 ≤ -1 dBTP）
  | 檔名 | 內容 | 長度 |
  |---|---|---|
  | map.mp3 | 標題：C 大調 112 BPM，馬林巴主旋律→鋼鼓→鐵琴 | 32 小節＝68.57 秒，循環 |
  | battle.mp3 | 一般戰鬥：F 大調 128 BPM，鋼鼓主題、銅管短打、馬林巴分解和弦、反拍刷弦 | 48 小節＝90.00 秒，循環 |
  | boss.mp3 | 頭目：D 小調（跟 F 大調同調號）140 BPM，貝斯 8 分音符推進、銅管、筒鼓 | 48 小節＝82.29 秒，循環 |
  | victory.mp3 | 勝利：三連音起手的號角＋鋼鼓＋馬林巴滾奏 | 6.2 秒 |
  | lose.mp3 | 輸了：「哇哇哇哇～」悶音長號下行＋木魚，滑稽不悲情 | 5 秒 |
- 循環長度寫在 `audio/bgm/loops.json`（秒與取樣數）。mp3 有 LAME 無縫資訊，Chromium 的 decodeAudioData 實測解出來的取樣數跟 loops.json 完全一樣、開頭沒有靜音，所以 `source.loop = true` 就無縫。（Safari 沒實測。）
- 音效 `audio/sfx/`（峰值 -3 dB，單聲道 mp3，開頭沒有靜音）
  - 介面：cursor、confirm、card、coin（×3）、train
  - 出手：slash 斬、hit 打、explosion 火、break 冰、holy_cast 光、dark_blast 暗（各 ×3：`<名>`、`<名>_2`、`<名>_3`）；另有 hit_alt、slash_alt、explosion_big
  - 事件：encounter、boss_appear、boss_charge、boss_down、defeat、fanfare、heal、buff、shield_up、shield_block、wok_back、paper_storm、unite、stun、weak、pop（×3）、cutin、poison、whoosh.wav
  - 出手類、pop、coin 都 ≤ 0.4 秒；超過 0.4 秒的只有事件類（頭目、號角、合體技、升職、紙張）。
  - sfx 資料夾裡其他舊檔（affix、foe_*、shout_*、squeak_* 等）遊戲目前沒載入，沒有動。

## 工具
- `tools/audio_lib.py`：合成引擎
  - 樂器：steelpan（強二次泛音＋起音音高微滑）、marimba（基音＋3.93/9.2 倍泛音）、glock、bass（濾波器包絡的彈跳貝斯）、brass（三層微走音合成銅管，可滑音、可 wah）、pluck/strum（Karplus-Strong 撥弦）
  - 鼓：kick、snare、clap、hat、shaker、tom、wood
  - `Song`：以拍放音符，循環曲把超出結尾的尾巴（含殘響）折回開頭，所以接縫不斷音
  - `master()`：ffmpeg ebur128 量響度→調到 -16 LUFS→峰值限幅（循環曲頭尾當成接在一起處理）
- `tools/audio_bgm.py [map battle boss victory lose]`：編曲都寫在這裡（旋律、和弦進行、各段配器）
- `tools/audio_sfx.py [名稱…]`：每個音效一個函式，註解寫了是什麼聲音
- `tools/audio_check.py`：聽檢短片 `out/audio_check.mp4`（配樂片段、戰鬥曲循環接縫、每個音效依序）
- 執行：`uv run --with numpy --with scipy python tools/audio_bgm.py`（聽檢片多加 `--with pillow`）；全部跑完不到 30 秒。

## 檢查方式（我聽不到，所以用量的）
- 頻譜分布：配樂 2～6 kHz 佔 1～4%、6 kHz 以上 < 0.2%（不刺耳）；音效的「咚」「啵」主體放在 100 Hz～1 kHz（手機喇叭聽得到）。
- 循環接縫：結尾最後一個取樣跟開頭第一個的落差跟一般相鄰取樣差不多；Chromium 解碼長度＝loops.json。
- 想改哪首的旋律或某個音效的質感，改對應函式再跑一次即可。
