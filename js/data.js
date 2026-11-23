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
  pity: 3,                   // 連三次抽不到可合併對象，下一抽保證有
  maxLv: 3, lvK: [1, 1.8, 3.2], lvRange: .06,      // 職級倍率；每升一級射程 +6%
  moveCost: 10,              // 調位（搬／互換）花部門預算；波間第一次免費
  firstDelay: 12, breakT: 8, spawnK: .7,  // spawnK：波次表的時間（gap、at）整體再乘這個 // 開局準備秒數、波間秒數（可提早開波）
  callBonus: 1,              // 提早開波：每省 1 秒給 1 預算
  waveCoin: [20, 3],         // 過波預算 = 20 + 3×波數
  weakK: 1.5, markWeakK: 2,  // 弱點 ×1.5；被學姊標記時 ×2
  fatK: .2, fatMax: 3, fatDecay: 15,   // 疲勞：每層攻速 −20%，最多 3 層，每 15 秒自己消一層
  mom: { kill: 1, boss: 15, wave: 8, merge: 2, cleanse: 2, cleanseCd: 6 }, momMax: 100,
  superCost: 100, superT: 12, superDmg: 1.6, superSpd: 1.35,
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
export const DEFAULT_TEAM = ['kui', 'jie', 'kevin', 'yan', 'zhe', 'mi'];
export const TEAM_SIZE = 6;

// 合體技：兩位都在場（任何工位）就能用；花氣勢 cost，各自冷卻 cd 秒。
// 效果強度 = 兩人當中各自最高職級倍率的平均。v0.1 預設隊伍能用前兩組。
export const UNITES = [
  { key: 'kuizhe',  name: '這案今天結',     who: ['kui', 'zhe'],   cost: 60, cd: 15, kind: 'line', dmg: [130, 130], elem: ['slash', 'fire'], note: '一整段走道斬＋火兩段傷害' },
  { key: 'jieyan',  name: '冷處理，燒到你', who: ['jie', 'yan'],   cost: 60, cd: 15, kind: 'area', radius: 150, dmg: 70, elem: 'dark', slow: .6, slowT: 5, burn: 18, burnT: 5, freezeT: 1.5, note: '一圈冰住再燒' },
  { key: 'kevinan', name: '依規定辦理',     who: ['kevin', 'an'],  cost: 60, cd: 15, kind: 'wall', stunT: 3, bossSlow: .7, note: '一段走道小兵全停' },
  { key: 'vivicha', name: '老闆請客',       who: ['vivi', 'cha'],  cost: 60, cd: 15, kind: 'team', haste: .4, hasteT: 8, note: '全隊消一層疲勞並加速' },
];

// 敵人。spd 像素／秒；coin 打倒給的預算；armor 減傷比例；weak 弱點（陣列，但最多一個）
export const FOES = {
  minion:  { name: '加班大隊',     hp: 100,  spd: 60, coin: 3 },
  courier: { name: '催稿信差',     hp: 55,   spd: 115, coin: 2, weak: ['ice'] },
  knight:  { name: '公文櫃重甲兵', hp: 320,  spd: 40, coin: 6, armor: .4, weak: ['blunt'] },
  intern:  { name: '續命實習生',   hp: 90,   spd: 70, coin: 3, weak: ['holy'], revive: .5, reviveT: 1 },
  auntie:  { name: '大媽同事',     hp: 220,  spd: 48, coin: 6, weak: ['dark'], fatigue: { every: 4, r: 150, n: 2 } },
  chief:   { name: '甩鍋課長',     hp: 3200, spd: 32, coin: 60, boss: true, weak: ['fire'],
             pot: { walk: 3, guard: 5, guardK: .25, broken: 4, brokenK: 1.6, throwR: 220 } },
  boss:    { name: '奧客總經理',   hp: 9000, spd: 24, coin: 100, boss: true, final: true, weak: ['slash'],
             scroll: { walk: 8, first: 14, charge: 5, breakK: .06, broken: 5, brokenK: 1.6, hit: 2 } },
};

// 波次：hpK＝這波血量再乘（前幾波放寬）；groups 依序出場；at＝從這波開始算第幾秒出第一隻（不寫就接在上一組後面）；gap＝每隻間隔
const G = (kind, n, gap, at) => ({ kind, n, gap, ...(at != null ? { at } : {}) });
export const WAVES = [
  { name: '加班大隊報到',     groups: [G('minion', 14, 2.6)] },
  { hpK: .8, name: '催稿信差來了',     groups: [G('minion', 12, 2), G('courier', 10, 1.5, 18), G('minion', 6, 1.6)] },
  { hpK: .8, name: '公文櫃重甲兵',     groups: [G('minion', 14, 1.6), G('knight', 5, 4, 6), G('courier', 8, 1.2, 26), G('minion', 8, 1.5)] },
  { hpK: .8, name: '續命實習生',       groups: [G('intern', 12, 1.6), G('courier', 10, 1, 12), G('minion', 12, 1.3, 22), G('intern', 6, 1.5, 36)] },
  { boss: 'chief', name: '甩鍋課長', groups: [G('minion', 14, 2), G('chief', 1, 1, 6), G('knight', 4, 5, 12), G('courier', 8, 1.2, 30)] },
  { name: '大媽同事',         groups: [G('minion', 16, 1.6), G('auntie', 4, 7, 4), G('knight', 5, 4.5, 10), G('courier', 8, 1, 34)] },
  { name: '信差衝刺',         groups: [G('courier', 24, .8), G('intern', 12, 1.3, 8), G('minion', 14, 1.2, 24), G('courier', 10, .7, 40)] },
  { name: '重甲與大媽',       groups: [G('knight', 7, 5), G('auntie', 4, 8, 6), G('minion', 18, 1.3, 3), G('intern', 10, 1.3, 30)] },
  { name: '三批混編',         groups: [G('minion', 14, .9), G('courier', 10, .7, 6), G('knight', 5, 2, 18), G('intern', 12, .9, 20), G('auntie', 3, 3, 22),
                                       G('courier', 14, .6, 36), G('knight', 3, 2, 38), G('minion', 12, .8, 40)] },
  { boss: 'boss', name: '奧客總經理', groups: [G('intern', 12, 1.4), G('boss', 1, 1, 6), G('knight', 5, 4, 14), G('courier', 12, .8, 26), G('auntie', 3, 6, 32), G('minion', 14, 1, 40)] },
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
