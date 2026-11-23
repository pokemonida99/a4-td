// 塔防的數值與設定（數值只改這裡；改完跑 node tools/sim.mjs）
// 座標都是邏輯畫面 1280×590 的像素。

export const RULE = {
  lives: 20, startRes: 100, resPerSec: 2, resRampEvery: 5,
  sumCost: 50, sumStep: 10, sellBack: .5, maxLv: 4, lvK: [1, 2.2, 4.6, 9.5],
  firstDelay: 6, waveLen: 26, hpK: 1, hpGrow: .12, atkK: 1, spdK: 1,
  weakK: 1.6, resistK: .6, markK: .3, momKill: 1, momMerge: 6,
};

// kind：single 單體｜splash 範圍｜multi 同時打 n 個｜aura 身邊全打｜buff 加成旁邊的人｜gen 產資源
export const TOWERS = {
  kui:    { name: '小葵',   job: '劍士',     elem: 'slash', kind: 'single', dmg: 30, rate: .55, range: 150 },
  jie:    { name: '阿傑',   job: '黑魔法師', elem: 'dark',  kind: 'splash', dmg: 26, rate: 1.3, range: 190, radius: 70, burn: 6 },
  kevin:  { name: 'Kevin',  job: '坦克',     elem: 'blunt', kind: 'aura',   dmg: 16, rate: 1.0, range: 110, stun: .15 },
  mi:     { name: '小米',   job: '白魔法師', elem: 'holy',  kind: 'single', dmg: 22, rate: .8,  range: 200 },
  yan:    { name: '小燕',   job: '控場',     elem: 'ice',   kind: 'single', dmg: 12, rate: .7,  range: 180, slow: .4, slowT: 1.6 },
  heilun: { name: '黑輪',   job: '業務',     elem: 'blunt', kind: 'gen',    dmg: 0,  rate: 4,   range: 0, gen: 6 },
  cha:    { name: '茶茶',   job: '補給',     elem: 'holy',  kind: 'buff',   dmg: 0,  rate: 1,   range: 130, atkUp: .2 },
  qiang:  { name: '阿強',   job: '重拳',     elem: 'blunt', kind: 'single', dmg: 60, rate: 1.5, range: 120, stun: .25 },
  senpai: { name: '學姊',   job: '偵探',     elem: 'slash', kind: 'single', dmg: 40, rate: 1.1, range: 260, target: 'strong', mark: 4 },
  you:    { name: '老油條', job: '盜賊',     elem: 'slash', kind: 'multi',  dmg: 18, rate: .6,  range: 160, n: 2 },
  zhe:    { name: '阿哲',   job: '槍兵',     elem: 'fire',  kind: 'single', dmg: 20, rate: .4,  range: 210, burn: 4 },
  xu:     { name: '許許',   job: '藥師',     elem: 'ice',   kind: 'splash', dmg: 14, rate: 1.2, range: 170, radius: 60, slow: .25 },
  pool: ['kui', 'jie', 'kevin', 'mi', 'yan', 'heilun', 'cha', 'qiang', 'senpai', 'you', 'zhe', 'xu'],
};

export const FOES = {
  minion:  { name: '加班大隊',   hp: 90,   spd: 60, coin: 1 },
  courier: { name: '催稿信差',   hp: 60,   spd: 105, coin: 1, weak: ['ice'] },
  knight:  { name: '公文櫃重甲兵', hp: 260, spd: 40, armor: .35, coin: 2, weak: ['blunt', 'fire'] },
  intern:  { name: '續命實習生', hp: 110,  spd: 70, coin: 1 },
  chief:   { name: '甩鍋課長',   hp: 2400, spd: 32, coin: 15, boss: true, leak: 5, weak: ['fire', 'blunt'] },
  boss:    { name: '奧客總經理', hp: 9000, spd: 24, coin: 40, boss: true, leak: 20, weak: ['holy', 'slash'] },
};

const G = (kind, n, gap = .9, more = {}) => ({ kind, n, gap, ...more });
export const WAVES = [
  { groups: [G('minion', 8)] },
  { groups: [G('minion', 10), G('courier', 4, .6)] },
  { groups: [G('intern', 10), G('minion', 6)] },
  { groups: [G('knight', 5, 1.4), G('courier', 6, .5)] },
  { boss: true, name: '甩鍋課長', groups: [G('minion', 6), G('chief', 1)] },
  { groups: [G('courier', 14, .45)] },
  { groups: [G('knight', 8, 1.2), G('intern', 8)] },
  { groups: [G('minion', 20, .5)] },
  { groups: [G('knight', 6, 1), G('courier', 12, .4)] },
  { boss: true, name: '奧客總經理', groups: [G('intern', 8), G('boss', 1)] },
];

// 第一張地圖（暫定，等新地圖美術到了照圖重量）：一條 U 形走廊，兩側辦公桌
export const MAPS = {
  office: {
    name: '十二樓開放辦公區',
    lanes: [[[340, 70], [340, 500], [700, 500], [700, 120], [1060, 120], [1060, 520]]],
    slots: [
      [440, 160], [520, 160], [600, 160], [440, 250], [520, 250], [600, 250], [440, 340], [520, 340], [600, 340],
      [800, 230], [880, 230], [960, 230], [800, 320], [880, 320], [960, 320], [800, 410], [880, 410], [960, 410],
    ],
  },
};
