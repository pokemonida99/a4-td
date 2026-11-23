// 塔防的數值與設定（數值只改這裡；改完跑 node tools/sim.mjs）
// 地圖座標＝art/map/office.json 的座標（目前是 1280×590 全畫面）。
// 射程判定是橢圓：dx² + (dy×1.25)² ≤ r²（俯視 3/4，上下比較短）。

export const RULE = {
  lives: 20,                 // 下班底氣
  leak: 1, bossLeak: 5,      // 一般漏一隻扣 1、頭目扣 5；最終頭目（final）沒打倒＝直接輸
  // 錢只有一種：部門預算（s.coin）。開局給一筆，打倒敵人、過波、提早開波都給，另有很小的月薪避免卡死。
  coin0: 100, salary: .25,   // 開局 100（約夠調派 4～5 位）；月薪每秒 0.25（4 秒 1 元）
  sumCost: 20, sumStep: 1, sumMax: 45,   // 緊急調派 20，每調派一次 +1，最多 45
  discardBack: .6,           // 報到中轉派：退回這次調派費用的 60%
  sellBack: [12, 40, 100],   // 場上同事轉派退回（依職級）
  upCost: [45, 110],         // 直接升職：I→II 45、II→III 110（同名合併免費）
  // 調派改成「抽袋」：每袋放出勤 6 人各一張，抽完才重洗（開局前 6 抽一定都不一樣，取代舊的保底與新手保障）
  pickK: 1.5,                // 指定調派：每個波間一次，價錢 = 隨機調派 × 1.5
  rerouteCost: 12,           // 波間改路線的費用（職級不變）
  maxLv: 3, lvK: [1, 1.8, 3.2], lvRange: .06,      // 職級倍率；每升一級射程 +6%
  moveCost: 10,              // 調位（搬／互換）花部門預算；波間第一次免費
  firstDelay: 12, breakT: 8, spawnK: .7,  // spawnK：波次表的時間（gap、at）整體再乘這個 // 開局準備秒數、波間秒數（可提早開波）
  callBonus: 1,              // 提早開波：每省 1 秒給 1 預算
  waveCoin: [20, 3],         // 過波預算 = 20 + 3×波數
  weakK: 1.5, markWeakK: 2,  // 弱點 ×1.5；被學姊標記時 ×2
  fatK: .2, fatMax: 3, fatDecay: 15,   // 疲勞：每層攻速 −20%，最多 3 層，每 15 秒自己消一層
  mom: { kill: 1, boss: 15, wave: 8, merge: 2, cleanse: 2, cleanseCd: 6 }, momMax: 60,   // 氣勢上限 60（只剩合體技用）
  superOn: false, superCost: 100, superT: 12, superDmg: 1.6, superSpd: 1.35,   // 超級化 v0.3 拿掉（由 III 主動技能取代），API 還在但 canSuper 永遠 false
  // 敵人屬性（v0.3，參考 BTD6 機制；見 design/btd6/DESIGN.md）
  magicK: .3,                // 術抗：火冰光暗只吃 30%
  regen: { quiet: 3, per: .06, cap: .4 },   // 再生：3 秒沒挨打 → 每秒回 6% 最大血，一生最多回 40%
  bossCtlK: .25,             // 頭目被定身／凍住時改成減速 25%
  hpK: 3.2, hpGrow: .15, bossHpK: 1,   // 敵人血量 × hpK × (1 + hpGrow×(波數−1)) × 該波 hpK；頭目只乘 bossHpK
};

// kind：single 單體｜splash 範圍｜aura 身邊全打｜line 直線穿刺｜support 只支援不打（或很弱）｜summon 召喚
// target：first 走最前面（預設）｜strong 血最多｜weak 血最少
// note：給玩家看的短說明（15 字內）
export const TOWERS = {
  kui:    { name: '小葵',   job: '劍士',     elem: 'slash', kind: 'single', dmg: 24, rate: .6,  range: 130, combo: 3, comboK: 2.5, note: '連斬三下，第三下重斬' },
  jie:    { name: '阿傑',   job: '黑魔法師', elem: 'dark',  kind: 'splash', dmg: 20, rate: 1.4, range: 170, radius: 60, burn: 5, burnT: 3, note: '暗焰燒一片，壓住疲勞' },
  kevin:  { name: 'Kevin',  job: '坦克',     elem: 'blunt', kind: 'aura',   dmg: 18, rate: 1.1, range: 122, stunEvery: 4, stunN: 3, stunT: .9, note: '近身盾擊，幾下就定身' },
  mi:     { name: '小米',   job: '白魔法師', elem: 'holy',  kind: 'single', dmg: 16, rate: 1.0, range: 170, heal: 5, note: '解除疲勞，沒事就給護盾' },
  vivi:   { name: 'Vivi',   job: '公主',     elem: 'holy',  kind: 'single', dmg: 14, rate: 2.0, range: 180, star: 8, starT: 6, starK: .5, note: '指定本月之星幫他加攻' },
  yan:    { name: '小燕',   job: '控場',     elem: 'ice',   kind: 'splash', dmg: 10, rate: .8,  range: 160, radius: 40, slow: .35, slowT: 1.5, freezeN: 4, freezeT: 1, note: '冰擊減速，連中會凍住' },
  heilun: { name: '黑輪',   job: '業務',     elem: 'blunt', kind: 'single', dmg: 36, rate: 1.3, range: 240, deal: 2, note: '遠投名片，成交多拿預算' },
  cha:    { name: '茶茶',   job: '補給',     elem: 'holy',  kind: 'support', dmg: 0, rate: 4,   range: 150, haste: .5, hasteT: 6, hasteN: 2, note: '送珍奶，讓旁人出手變快' },
  qiang:  { name: '阿強',   job: '重拳',     elem: 'blunt', kind: 'splash', dmg: 40, rate: 1.6, range: 118, radius: 50, pierceArmor: 1.5, note: '近身重擊，專破重甲' },
  senpai: { name: '學姊',   job: '偵探',     elem: 'slash', kind: 'single', dmg: 44, rate: 1.3, range: 250, target: 'strong', markT: 4, note: '遠距狙擊，標記放大弱點' },
  wu:     { name: '小蝶',   job: '舞者',     elem: 'slash', kind: 'aura',   dmg: 14, rate: .7,  range: 115, dance: 4, danceCut: .4, danceR: 130, note: '迴旋斬，跳舞讓旁人加快' },
  you:    { name: '老油條', job: '盜賊',     elem: 'slash', kind: 'single', dmg: 13, rate: .35, range: 140, target: 'weak', execute: .35, executeK: 1.8, note: '專挑殘血，快手補刀' },
  fairy:  { name: '鼠仙女', job: '召喚師',   elem: 'holy',  kind: 'summon', dmg: 70, rate: 2.2, range: 180, mice: 3, miceSpd: 140, miceT: 5, miceStun: .4, note: '放老鼠沿走道衝撞' },
  xu:     { name: '許許',   job: '藥師',     elem: 'ice',   kind: 'single', dmg: 22, rate: 1.2, range: 230, potion: 6, potionShots: 3, potionDmg: 10, note: '冰藥瓶，幫最累的人解乏' },
  zhe:    { name: '阿哲',   job: '槍兵',     elem: 'fire',  kind: 'line',   dmg: 30, rate: 1.3, range: 200, width: 26, pierce: 4, note: '火槍直線穿刺一整排' },
  an:     { name: '小安',   job: '盾衛',     elem: 'ice',   kind: 'single', dmg: 26, rate: .9,  range: 122, cone: 6, coneT: 10, coneSlow: .5, note: '冰盾擊，放三角錐減速' },
};
// ===== 升級路線（v0.3，參考 BTD6：II 選 A／B，III 質變＋主動技能；見 design/btd6/DESIGN.md）=====
// ii：升到 II 起的效果；iii：升到 III 再加的效果（ii 保留）。數字是「取代」，dmgK／rateK／radiusK／dealK 是「乘上」，vs 是對某種敵人的倍率。
// 效果欄位（core.js 會讀）：
//   ignoreArmor 無視重甲｜breakOnHit 打中破甲秒數｜comboIgnoreArmor／comboBreak 第三刀無視重甲／破甲｜stunBreak 定身那一擊順便破甲
//   detect 看得到掛名｜revealOnHit 打中讓掛名現形秒數｜revealAura 每秒揭露射程內掛名（現形秒數）｜grantDetect 被照顧／加速的同事幾秒內看得到掛名｜preferCamo 優先打掛名
//   noRegenOnHit 打中後不能再生的秒數｜burnNoRegen 灼燒中不能再生｜burnSpread 被燒的敵人倒下時傳火給幾人
//   comboSplash {r,n,k} 第三刀變範圍｜splitShock {k,n,r} 打倒轉寄時震一下｜vs { fast, split, mini, regen, boss, camo, half }
//   heal 解疲勞間隔｜healShield｜starK／starBoss／starAdd／starAddIgnore｜hasteN／hasteFatHalf｜potion／potionN／potionHaste
//   mice／miceHits／miceDetect／miceReveal／miceNoRegen｜coneN／coneSlow／coneStun／coneDmg／coneBreak｜danceCut／danceCleanse｜markK／markBreak
// skill.kind：nuke 一圈（at: self 自己身邊｜dense 敵人最密｜split 轉寄車優先）｜single 血最多的一隻｜line 敵人最多的一段走廊｜rage 自己變快
//   global 全場（reveal 現形秒數、noRegen、hitN 隻各受 k×D、cleanse、haste）｜haste 加速（scope range/all）｜cleanse 全隊清疲勞＋免疫
//   slowAll 全場減速｜mice 放老鼠｜coin 拿錢（每波一次）｜star 本月之星｜nearEnd 最接近打卡機的幾隻
//   k＝傷害是這位同事目前一擊（D）的幾倍；aim: true＝可以讓玩家指定位置（不指定就自動挑）
export const ROUTES = {
  kui: {
    a: { name: '拆章組', icon: 'r_seal', note: '第三刀無視重甲', ii: { comboIgnoreArmor: true }, iii: { ignoreArmor: true, comboBreak: 4 },
         skill: { name: '退件重辦', note: '血最多的敵人 6 倍斬＋破甲', cd: 42, kind: 'single', k: 6, breakT: 8 } },
    b: { name: '趕件組', icon: 'r_sweep', note: '第三刀變橫掃', ii: { comboSplash: { r: 55, n: 4, k: .9 } }, iii: { comboSplash: { r: 75, n: 6, k: 1 } },
         skill: { name: '一起簽掉', note: '一圈 4 倍斬，自己變快', cd: 40, kind: 'nuke', at: 'dense', aim: true, r: 110, n: 10, k: 4, rage: { k: 1.3, t: 5 } } },
  },
  jie: {
    a: { name: '燒存檔', icon: 'r_burn', note: '灼燒更久、燒著不能再生', ii: { burnT: 4, burnNoRegen: true }, iii: { burnSpread: 3 },
         skill: { name: '整批銷毀', note: '一圈 3 倍暗焰、封住再生', cd: 48, kind: 'nuke', at: 'dense', aim: true, r: 130, n: 10, k: 3, burn: true, noRegen: 8 } },
    b: { name: '黑名單', icon: 'r_eye', note: '揭露射程內的掛名', ii: { revealAura: 3 }, iii: { noRegenOnHit: 4 },
         skill: { name: '全部攤開', note: '全場掛名現形、封住再生', cd: 52, kind: 'global', reveal: 10, noRegen: 8 } },
  },
  kevin: {
    a: { name: '拆櫃組', icon: 'r_crate', note: '無視重甲', ii: { ignoreArmor: true }, iii: { stunBreak: 3 },
         skill: { name: '整櫃搬走', note: '身邊 5 倍打＋定身', cd: 45, kind: 'nuke', at: 'self', r: 140, n: 8, k: 5, stun: 2 } },
    b: { name: '擋門組', icon: 'r_door', note: '更常定身', ii: { stunEvery: 3, stunT: .6 }, iii: { vs: { fast: 1.35 } },
         skill: { name: '先別走', note: '身邊全部定身再減速', cd: 48, kind: 'nuke', at: 'self', r: 140, n: 8, k: 0, stun: 2, slow: .4, slowT: 4 } },
  },
  mi: {
    a: { name: '輪休表', icon: 'r_bed', note: '更常解疲勞', ii: { heal: 3 }, iii: { healShield: true },
         skill: { name: '強制補休', note: '全隊清疲勞、8 秒不疲勞', cd: 55, kind: 'cleanse', immuneT: 8 } },
    b: { name: '識別證', icon: 'r_badge', note: '揭露射程內的掛名', ii: { revealAura: 3 }, iii: { grantDetect: 8 },
         skill: { name: '全員刷卡', note: '全場掛名現形＋全隊清疲勞', cd: 50, kind: 'global', reveal: 10, cleanse: true } },
  },
  vivi: {
    a: { name: '績效王', icon: 'r_crown', note: '本月之星加更多攻', ii: { starK: .7 }, iii: { starBoss: 1.25 },
         skill: { name: '本月之星', note: '最強的同事 8 秒攻 +60%', cd: 50, kind: 'star', n: 1, k: .6, t: 8 } },
    b: { name: '實績派', icon: 'r_stamp', note: '本月之星多打一下', ii: { starAdd: .25 }, iii: { starAdd: .4, starAddIgnore: true },
         skill: { name: '拿出成果', note: '附近 3 人 8 秒多打一下', cd: 55, kind: 'star', n: 3, k: 0, add: .4, t: 8 } },
  },
  yan: {
    a: { name: '冷處理', icon: 'r_snow', note: '減速更強', ii: { slow: .45, slowT: 2 }, iii: { freezeN: 3 },
         skill: { name: '全場冷靜', note: '全場減速 60%（頭目 25%）', cd: 50, kind: 'slowAll', k: .6, bossK: .25, t: 5 } },
    b: { name: '封存組', icon: 'r_seal2', note: '打中不能再生', ii: { noRegenOnHit: 4 }, iii: { radiusK: 1.5 },
         skill: { name: '整批封存', note: '一圈 3 倍冰、封住再生', cd: 45, kind: 'nuke', at: 'dense', aim: true, r: 130, n: 10, k: 3, noRegen: 10 } },
  },
  heilun: {
    a: { name: '結案獎', icon: 'r_coin', note: '成交多拿更多錢', ii: { dealK: 1.5 }, iii: { dealK: 2.5 },
         skill: { name: '月底結算', note: '立刻拿 40 預算（每波一次）', cd: 70, kind: 'coin', v: 40 } },
    b: { name: '盯哨組', icon: 'r_scope', note: '看得到掛名', ii: { detect: true, revealOnHit: 5 }, iii: { vs: { camo: 1.3 } },
         skill: { name: '別想溜班', note: '最接近打卡機的 5 隻 4 倍打', cd: 42, kind: 'nearEnd', n: 5, k: 4, reveal: 8 } },
  },
  cha: {
    a: { name: '續杯組', icon: 'r_tea', note: '一次給 3 人珍奶', ii: { hasteN: 3 }, iii: { hasteFatHalf: true },
         skill: { name: '最後一杯', note: '射程內同事 8 秒攻速 +40%', cd: 55, kind: 'haste', scope: 'range', k: .4, t: 8 } },
    b: { name: '廣播站', icon: 'r_mic', note: '揭露射程內的掛名', ii: { revealAura: 3 }, iii: { grantDetect: 6 },
         skill: { name: '廣播找人', note: '全場掛名現形＋射程內加速', cd: 55, kind: 'global', reveal: 10, haste: { k: .25, t: 8 } } },
  },
  qiang: {
    a: { name: '搬重物', icon: 'r_box', note: '範圍更大', ii: { radiusK: 1.3 }, iii: { breakOnHit: 4 },
         skill: { name: '清空倉庫', note: '身邊 6 倍打＋定身', cd: 48, kind: 'nuke', at: 'self', r: 150, n: 10, k: 6, stun: 1.5 } },
    b: { name: '拆包組', icon: 'r_cutter', note: '打轉寄 ×1.4', ii: { vs: { split: 1.4 } }, iii: { splitShock: { k: 1.5, n: 6, r: 90 } },
         skill: { name: '現場拆封', note: '轉寄車附近一圈重擊', cd: 48, kind: 'nuke', at: 'split', aim: true, r: 120, n: 8, k: 2, splitK: 3 } },
  },
  senpai: {
    a: { name: '查勤組', icon: 'r_lens', note: '看得到掛名', ii: { detect: true, revealOnHit: 5 }, iii: { preferCamo: true, vs: { camo: 1.15 } },
         skill: { name: '點名時間', note: '全場掛名現形，6 隻 2 倍斬', cd: 50, kind: 'global', reveal: 10, hitN: 6, k: 2 } },
    b: { name: '追責組', icon: 'r_file', note: '標記的人受傷 +15%', ii: { markK: 1.15 }, iii: { vs: { boss: 1.35 }, markBreak: true },
         skill: { name: '請你說明', note: '血最多的敵人 8 倍斬', cd: 55, kind: 'single', k: 8 } },
  },
  wu: {
    a: { name: '巡迴簽核', icon: 'r_spin', note: '迴旋斬更痛', ii: { dmgK: 1.4 }, iii: { vs: { split: 1.4, mini: 1.4 } },
         skill: { name: '原地開轉', note: '身邊 4 倍斬', cd: 42, kind: 'nuke', at: 'self', r: 140, n: 10, k: 4 } },
    b: { name: '帶動唱', icon: 'r_music', note: '跳舞讓旁人更快', ii: { danceCut: .6 }, iii: { danceCleanse: true },
         skill: { name: '起來活動', note: '附近同事清疲勞＋加速', cd: 50, kind: 'haste', scope: 'range', k: .35, t: 8, cleanse: true } },
  },
  you: {
    a: { name: '補尾刀', icon: 'r_knife', note: '半血以下更痛', ii: { vs: { half: 1.25 } }, iii: { rateK: .77 },
         skill: { name: '我來收尾', note: '6 秒攻速 ×1.8', cd: 40, kind: 'rage', k: 1.8, t: 6 } },
    b: { name: '斷後路', icon: 'r_block', note: '打中不能再生', ii: { noRegenOnHit: 4 }, iii: { vs: { regen: 1.4 } },
         skill: { name: '到此為止', note: '血最多的敵人 7 倍斬、封住再生', cd: 42, kind: 'single', k: 7, noRegen: 12 } },
  },
  fairy: {
    a: { name: '跑腿群', icon: 'r_mouse', note: '老鼠更多、撞更多人', ii: { mice: 4, miceHits: 2 }, iii: { miceHits: 4 },
         skill: { name: '全員外勤', note: '一次放 8 隻老鼠', cd: 50, kind: 'mice', n: 8 } },
    b: { name: '查帳鼠', icon: 'r_mouse2', note: '老鼠撞得到掛名', ii: { miceDetect: true, miceReveal: 5 }, iii: { miceNoRegen: 4 },
         skill: { name: '突擊查帳', note: '5 隻老鼠，撞到現形＋封再生', cd: 50, kind: 'mice', n: 5, k: 1.5, reveal: 8, noRegen: 8 } },
  },
  xu: {
    a: { name: '冰封存', icon: 'r_ice', note: '打中不能再生', ii: { noRegenOnHit: 4 }, iii: { noRegenOnHit: 6, slow: .2, slowT: 2 },
         skill: { name: '暫停續約', note: '全場封住再生，8 隻 2 倍冰', cd: 45, kind: 'global', noRegen: 10, hitN: 8, k: 2 } },
    b: { name: '代班組', icon: 'r_hand', note: '更常幫人解乏＋加速', ii: { potion: 3, potionHaste: .15 }, iii: { potionN: 2 },
         skill: { name: '我幫你接', note: '全隊清疲勞＋8 秒加速', cd: 55, kind: 'haste', scope: 'all', k: .35, t: 8, cleanse: true } },
  },
  zhe: {
    a: { name: '燒穿章', icon: 'r_pierce', note: '無視重甲', ii: { ignoreArmor: true }, iii: { pierce: 8, breakOnHit: 3 },
         skill: { name: '急件直送', note: '一段走廊 6 倍火', cd: 45, kind: 'line', aim: true, n: 12, k: 6 } },
    b: { name: '留底火', icon: 'r_flame', note: '打中灼燒、燒著不能再生', ii: { burn: 6, burnT: 3, burnNoRegen: true }, iii: { burnT: 5 },
         skill: { name: '整條重印', note: '一段走廊全部灼燒 6 秒', cd: 48, kind: 'line', aim: true, n: 20, k: 0, burnK: .5, burnT: 6 } },
  },
  an: {
    a: { name: '交通組', icon: 'r_cone', note: '三角錐減速更強', ii: { coneSlow: .6 }, iii: { coneN: 2, coneStun: .5 },
         skill: { name: '此路施工', note: '一段走廊減速 60% 6 秒', cd: 48, kind: 'line', aim: true, n: 30, k: 0, slow: .6, slowT: 6 } },
    b: { name: '拆鎖組', icon: 'r_lock', note: '踩到錐子受傷＋破甲', ii: { coneDmg: 1, coneBreak: 4 }, iii: { coneN: 2 },
         skill: { name: '整排拆掉', note: '一段走廊 4 倍打＋破甲', cd: 45, kind: 'line', aim: true, n: 8, k: 4, elem: 'blunt', breakT: 8 } },
  },
};
for (const id in ROUTES) TOWERS[id].routes = ROUTES[id];
// 「會打」的建議路線（sim 的 smart 用；介面可以拿來當推薦）
export const ROUTE_TIP = { kui: 'b', jie: 'a', kevin: 'a', yan: 'a', zhe: 'a', mi: 'b', vivi: 'a', heilun: 'b', cha: 'b', qiang: 'a', senpai: 'a', wu: 'a', you: 'b', fairy: 'b', xu: 'a', an: 'b' };
export const DEFAULT_TEAM = ['kui', 'jie', 'kevin', 'yan', 'zhe', 'mi'];
export const TEAM_SIZE = 6;

// 合體技：兩位都在場（任何工位）就能用；花氣勢 cost，各自冷卻 cd 秒。尚未現形的掛名打不到。
// 效果強度 = 兩人當中各自最高職級倍率的平均。v0.1 預設隊伍能用前兩組。
export const UNITES = [
  { key: 'kuizhe',  name: '這案今天結',     who: ['kui', 'zhe'],   cost: 60, cd: 25, kind: 'line', dmg: [130, 130], elem: ['slash', 'fire'], note: '一整段走道斬＋火兩段傷害' },
  { key: 'jieyan',  name: '冷處理，燒到你', who: ['jie', 'yan'],   cost: 60, cd: 25, kind: 'area', radius: 150, dmg: 70, elem: 'dark', slow: .6, slowT: 5, burn: 18, burnT: 5, freezeT: 1.5, note: '一圈冰住再燒' },
  { key: 'kevinan', name: '依規定辦理',     who: ['kevin', 'an'],  cost: 60, cd: 25, kind: 'wall', stunT: 3, bossSlow: .7, note: '一段走道小兵全停' },
  { key: 'vivicha', name: '老闆請客',       who: ['vivi', 'cha'],  cost: 60, cd: 25, kind: 'team', haste: .4, hasteT: 8, note: '全隊消一層疲勞並加速' },
];

// 敵人。spd 像素／秒；coin 打倒給的預算；armor 減傷比例；weak 弱點（陣列，但最多一個）
// traits 屬性：camo 掛名（沒現形不能瞄準、範圍也打不到）｜magic 術抗（火冰光暗 ×0.3）｜regen 再生｜split 轉寄（倒下吐小兵）｜fast 快遞
// 重甲＝armor > 0（另外算成屬性 'armor'）
export const FOES = {
  minion:  { name: '加班大隊',     hp: 100,  spd: 60, coin: 3 },
  courier: { name: '催稿信差',     hp: 55,   spd: 115, coin: 2, weak: ['ice'], traits: ['fast'] },
  knight:  { name: '公文櫃重甲兵', hp: 320,  spd: 40, coin: 6, armor: .4, weak: ['blunt'] },
  intern:  { name: '續命實習生',   hp: 90,   spd: 70, coin: 3, weak: ['holy'], revive: .5, reviveT: 1 },
  auntie:  { name: '大媽同事',     hp: 220,  spd: 48, coin: 6, weak: ['dark'], fatigue: { every: 4, r: 150, n: 2 } },
  ghost:   { name: '掛名專員',     hp: 110,  spd: 55, coin: 4, traits: ['camo'] },
  clerk:   { name: '照章辦事員',   hp: 200,  spd: 45, coin: 5, traits: ['magic'] },
  patcher: { name: '反覆補件員',   hp: 190,  spd: 48, coin: 5, weak: ['fire'], traits: ['regen'] },
  cart:    { name: '群組轉寄車',   hp: 650,  spd: 30, coin: 8, leak: 2, weak: ['blunt'], traits: ['split'], split: { kind: 'mini', n: 4, hpK: .12 } },
  mini:    { name: '小公文',       hp: 30,   spd: 52, coin: 1 },
  chief:   { name: '甩鍋課長',     hp: 3200, spd: 32, coin: 60, boss: true, weak: ['fire'],
             pot: { walk: 3, guard: 5, guardK: .25, broken: 4, brokenK: 1.6, throwR: 220 } },
  boss:    { name: '奧客總經理',   hp: 9000, spd: 24, coin: 100, boss: true, final: true, weak: ['slash'],
             scroll: { walk: 8, first: 14, charge: 5, breakK: .06, broken: 5, brokenK: 1.6, hit: 2 } },
};

// 波次：hpK＝這波血量再乘（第 1～4 波放寬：新手開局買完就不再花錢，也要撐過前兩波；錢的壓力從第 3 波開始）
// groups 依序出場；at＝從這波開始算第幾秒出第一隻（不寫就接在上一組後面）；gap＝每隻間隔；more＝這組額外屬性（例如 { armor: .4 }）
// teach＝這波第一次登場的屬性（介面可以跳小圖解）
const G = (kind, n, gap, at, more) => ({ kind, n, gap, ...(at != null ? { at } : {}), ...(more ? { more } : {}) });
const batch = at => [G('ghost', 2, 1.5, at), G('knight', 2, 2, at + 2), G('clerk', 2, 1.5, at + 5), G('courier', 2, .8, at + 8), G('minion', 4, .9, at + 9)];
export const WAVES = [
  { hpK: .65, name: '加班大隊報到', groups: [G('minion', 14, 2.6)] },
  { hpK: .4,  name: '催稿信差來了', teach: ['fast'], groups: [G('minion', 12, 2), G('courier', 2, 10, 10), G('minion', 10, 1.6)] },
  { hpK: .6,  name: '掛名專員',     teach: ['camo'], groups: [G('minion', 14, 1.6), G('courier', 6, 1.2, 10), G('ghost', 2, 6, 24), G('minion', 6, 1.5)] },
  { hpK: .75, name: '公文櫃重甲兵', teach: ['armor'], groups: [G('minion', 12, 1.4), G('knight', 3, 5, 4), G('ghost', 4, 3, 14), G('courier', 8, 1, 24), G('minion', 6, 1.4)] },
  { boss: 'chief', name: '甩鍋課長', groups: [G('minion', 12, 2), G('chief', 1, 1, 6), G('ghost', 4, 4, 10), G('knight', 3, 5, 14), G('auntie', 1, 1, 20), G('courier', 6, 1.2, 30)] },
  { name: '照章辦事與反覆補件', teach: ['magic', 'regen'], groups: [G('minion', 14, 1.4), G('clerk', 3, 3, 4), G('courier', 8, 1, 14), G('patcher', 3, 3, 24), G('minion', 8, 1.2)] },
  { name: '群組轉寄車', teach: ['split'], groups: [G('minion', 12, 1.4), G('clerk', 4, 3, 4), G('patcher', 4, 3, 12), G('cart', 1, 1, 18), G('intern', 4, 1.5, 24), G('cart', 1, 1, 30), G('courier', 6, .8, 34)] },
  { name: '三批混編', groups: [...batch(0), ...batch(14), ...batch(28)] },
  { name: '補件與轉寄', groups: [G('auntie', 2, 8, 2), G('patcher', 4, 3), G('patcher', 2, 4, 8, { armor: .4 }), G('cart', 4, 5, 6), G('courier', 6, 1, 16), G('minion', 10, 1, 24), G('intern', 6, 1, 30)] },
  { boss: 'boss', name: '奧客總經理', groups: [G('knight', 2, 3), G('clerk', 2, 3, 2), G('courier', 4, 1, 6), G('minion', 8, 1.2, 8), G('boss', 1, 1, 6),
    G('knight', 2, 3, 26), G('clerk', 2, 3, 28), G('courier', 4, 1, 32), G('auntie', 2, 6, 30), G('minion', 8, 1.2, 34)] },
];

// 地圖：跟 art/map/office.json 同一份（定案，1280×590 全畫面；起點 [1190,-10] 讓敵人從畫面外走進來）。
// main.js 讀到 json 會用 core.setMap('office', json) 蓋過去；這裡是沒讀到時的備用。
// 三段走廊的 S 形：右上進 → 上走廊往左 → 左轉下 → 中走廊往右 → 右轉下 → 下走廊往左 → 左下打卡機。
// 12 個工位兩排各 6，每格都夾在兩段走廊中間（交會位）；兩端的工位多碰到轉角。
export const MAPS = {
  office: {
    name: '行政部・下班前一小時',
    path: [[1190, -10], [1190, 125], [290, 125], [290, 275], [1060, 275], [1060, 420], [400, 420]],
    slots: [[430, 200], [530, 200], [630, 200], [770, 200], [870, 200], [970, 200], [430, 348], [530, 348], [630, 348], [770, 348], [870, 348], [970, 348]],
    gate: [1190, 20], clock: [330, 425],
  },
};
