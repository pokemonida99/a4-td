// 準時下班防衛戰 3D 版｜數值表（只放資料，改平衡只動這個檔，改完跑 node tools/sim3d.mjs）
// 屬性：水 → 火 → 風 → 水（剋 ×2、被剋 ×0.5）；光、闇互剋（都是 ×2）；斬、拳是物理，不吃屬性。

export const ELEM = {
  fire: { name: '火', hex: '#ff7a3a', rgb: [1.6, 0.55, 0.2] },
  water: { name: '水', hex: '#4fb0ff', rgb: [0.3, 0.9, 1.7] },
  wind: { name: '風', hex: '#7fe08a', rgb: [0.5, 1.5, 0.6] },
  light: { name: '光', hex: '#ffe27a', rgb: [1.6, 1.4, 0.6] },
  dark: { name: '闇', hex: '#b07aff', rgb: [1.0, 0.45, 1.7] },
  slash: { name: '斬', hex: '#e8edf2', rgb: [1.3, 1.35, 1.5] },
  fist: { name: '拳', hex: '#f2a45a', rgb: [1.5, 0.9, 0.4] },
  sup: { name: '輔助', hex: '#ff9ad0', rgb: [1.6, 0.7, 1.1] },
  summon: { name: '召喚', hex: '#c9a37a', rgb: [1.2, 0.95, 0.7] },
  cure: { name: '解除', hex: '#8ff0e0', rgb: [0.5, 1.5, 1.4] },
  none: { name: '無', hex: '#9aa3ad', rgb: [0.9, 0.95, 1.0] },
};
// 地圖（世界座標：x 往右、z 往鏡頭）。走道從電梯到打卡機，12 個工位。
const W = (x, y) => [(x - 640) / 40, (y - 295) / 40];
export const MAP = {
  path: [[1190, -60], [1190, 125], [290, 125], [290, 275], [1060, 275], [1060, 420], [400, 420]].map(p => W(p[0], p[1])),
  slots: [[430, 200], [530, 200], [630, 200], [770, 200], [870, 200], [970, 200], [430, 348], [530, 348], [630, 348], [770, 348], [870, 348], [970, 348]].map(p => W(p[0], p[1])),
};
export const BEATS = { water: 'fire', fire: 'wind', wind: 'water', light: 'dark', dark: 'light' };
export function elemMul(a, d) {
  if (BEATS[a] === d) return 2;
  if (BEATS[d] === a && a !== 'light' && a !== 'dark') return 0.5;
  return 1;
}
export const PHYS = { slash: 1, fist: 1 };
export const LV = [1, 1.55, 2.3];
export const RULE = {
  lives: 10, upK: [0.8, 1.3], sellBack: 0.6, waveCoin: w => 26 + w * 5, hpK: [1, 1.15, 1.3, 1.65, 2.0, 2.2, 2.5, 2.8, 2.5, 3.2, 2.8, 3.3], maxLv: 3,
  prep: 15, earlyMax: 12,                       // 每波之間倒數 15 秒；提早開，剩幾秒多拿幾元（最多 12）
  skill: { dur: 6, cd: 40, spd: 0.5 },          // 精神喊話：全員攻速 +50%，6 秒，冷卻 40 秒
  immune: 4,                                    // 冰凍／麻痺結束後 4 秒內不會再中
};
// 難度：普通／加班地獄
export const DIFF = { normal: { name: '普通', hpK: 1, coin0: 160 }, hell: { name: '加班地獄', hpK: 1.12, coin0: 150 } };

// kind：melee 近身、bolt 飛彈、pierce 直線貫穿、blast 定點爆開、buff 加攻加速、haste 加速、slow 緩速、summon 召喚、cure 解除異常
// 陣列＝一到三級的數值
export const HERO = {
  kui: { tag: '快刀', name: '小葵', job: '劍士', elem: 'slash', kind: 'melee', cost: 50, range: 2.8, atk: 10, cd: 0.5, n: [1, 1, 2], note: ['快刀連斬', '刀更利', '一次砍兩個'] },
  you: { tag: '補刀', name: '老油條', job: '盜賊', elem: 'slash', kind: 'melee', cost: 60, range: 3.0, atk: 6, cd: 0.3, pick: 'weak', execute: [1.8, 2.2, 2.8], note: ['專挑殘血補刀', '補刀更痛', '補刀再更痛'] },
  qiang: { tag: '打暈破甲', name: '阿強', job: '重拳', elem: 'fist', kind: 'melee', cost: 75, range: 2.6, atk: 32, cd: 1.4, stun: [0.5, 0.7, 0.9], armorK: 1.8, note: ['重拳打暈、破重甲', '暈更久', '暈再更久'] },
  jie: { tag: '火球', name: '阿傑', job: '火法師', elem: 'fire', kind: 'bolt', cost: 90, range: 4.4, atk: 18, cd: 1.2, splash: [0, 1.3, 1.9], note: ['火球', '火球會炸開一片', '炸得更大'] },
  xu: { tag: '持續燃燒', name: '許許', job: '藥師', elem: 'fire', kind: 'bolt', cost: 85, range: 4.0, atk: 8, cd: 1.1, splash: [0.9, 0.9, 1.2], burn: [5, 8, 12], note: ['燃燒瓶，持續燒', '燒更痛', '燒更痛、範圍更大'] },
  yan: { tag: '水彈', name: '小燕', job: '水法師', elem: 'water', kind: 'bolt', cost: 80, range: 4.2, atk: 15, cd: 0.85, wet: [0, 0.2, 0.3], note: ['水彈', '打中會變慢', '變得更慢'] },
  zhe: { tag: '直線貫穿', name: '阿哲', job: '槍兵', elem: 'wind', kind: 'pierce', cost: 85, range: 5.2, atk: 13, cd: 0.8, n: [1, 2, 3], note: ['風槍', '一槍穿兩個', '一槍穿三個'] },
  heilun: { tag: '多賺錢', name: '黑輪', job: '業務', elem: 'wind', kind: 'bolt', cost: 80, range: 5.6, atk: 9, cd: 0.5, bounty: [1, 2, 3], note: ['飛名片，打倒多拿錢', '多拿更多', '再多拿'] },
  mi: { tag: '大範圍', name: '小米', job: '光法師', elem: 'light', kind: 'blast', cost: 110, range: 4.6, atk: 36, cd: 2.3, r: [1.1, 1.6, 2.1], note: ['光爆，出手慢', '範圍變大', '範圍再變大'] },
  kevin: { tag: '大範圍', name: 'Kevin', job: '闇騎士', elem: 'dark', kind: 'blast', cost: 110, range: 4.6, atk: 36, cd: 2.3, r: [1.1, 1.6, 2.1], note: ['闇爆，出手慢', '範圍變大', '範圍再變大'] },
  senpai: { tag: '遠距狙擊', name: '學姊', job: '偵探', elem: 'light', kind: 'bolt', cost: 100, range: 6.6, atk: 62, cd: 2.6, pick: 'strong', note: ['遠距離狙擊最壯的', '更痛', '再更痛'] },
  vivi: { tag: '加攻加速', name: 'Vivi', job: '公主', elem: 'sup', kind: 'buff', cost: 100, range: 3.4, atkUp: [0.2, 0.3, 0.4], spdUp: [0.15, 0.22, 0.3], note: ['附近同事加攻、加速', '加更多', '加再更多'] },
  cha: { tag: '加攻速', name: '茶茶', job: '補給', elem: 'sup', kind: 'haste', cost: 70, range: 3.3, spdUp: [0.3, 0.45, 0.6], note: ['送珍奶，附近同事出手變快', '更快', '再更快'] },
  an: { tag: '敵人變慢', name: '小安', job: '工安', elem: 'sup', kind: 'slow', cost: 70, range: 3.1, slow: [0.25, 0.35, 0.45], note: ['放三角錐，附近敵人變慢', '更慢', '再更慢'] },
  fairy: { tag: '老鼠擋路', name: '鼠仙女', job: '召喚師', elem: 'summon', kind: 'summon', cost: 110, range: 4.0, every: [7, 6, 5], note: ['召喚灰鼠擋路咬人', '多一隻耐打的棕鼠', '一次召兩隻'] },
  wu: { tag: '解冰凍麻痺', name: '小蝶', job: '舞者', elem: 'cure', kind: 'cure', cost: 60, range: [3.6, 4.6, 5.6], note: ['自動解除附近同事的冰凍、麻痺', '範圍變大', '解除後 4 秒不再中'] },
};
export const HERO_ORDER = ['kui', 'jie', 'yan', 'zhe', 'qiang', 'mi', 'kevin', 'vivi', 'cha', 'an', 'fairy', 'wu', 'you', 'xu', 'heilun', 'senpai'];

// cast：敵人會讓附近同事中異常（para 麻痺＝出手變很慢、freeze 冰凍＝完全不能動）
export const FOE = {
  foe_minion: { name: '雜事', elem: 'none', hp: 46, sp: 1.6, coin: 4 },
  foe_intern: { name: '實習生', elem: 'none', hp: 76, sp: 1.4, coin: 5 },
  foe_courier: { trait: '跑很快', name: '急件', elem: 'wind', hp: 44, sp: 2.8, coin: 5 },
  foe_clerk: { name: '掛名專員', elem: 'water', hp: 135, sp: 1.5, coin: 7 },
  foe_patcher: { trait: '沒被打就回血', name: '補件員', elem: 'light', hp: 120, sp: 1.3, coin: 7, regen: 5 },
  foe_auntie: { trait: '碎念讓同事麻痺', name: '碎念阿姨', elem: 'fire', hp: 190, sp: 1.2, coin: 10, cast: { kind: 'para', every: 6, range: 3.4, dur: 6, n: 1 } },
  foe_ghost: { trait: '斬、拳打不到', name: '幽靈人口', elem: 'dark', hp: 115, sp: 1.7, coin: 9, ghost: true },
  foe_knight: { trait: '重甲：拳加倍、斬打折', name: '照章辦事', elem: 'none', hp: 270, sp: 1.0, coin: 10, armor: true },
  foe_cart: { trait: '倒下變 3 個小公文', name: '轉寄車', elem: 'wind', hp: 230, sp: 1.2, coin: 9, split: ['foe_mini', 3] },
  foe_mini: { name: '小公文', elem: 'none', hp: 26, sp: 2.2, coin: 1 },
  foe_chief: { trait: '很硬，漏掉扣 2 命', name: '課長', elem: 'fire', hp: 700, sp: 0.9, coin: 30, leak: 2, bite: 30 },
  foe_boss: { trait: '會冰凍同事，漏掉扣 5 命', name: '大老闆', elem: 'dark', hp: 1900, sp: 0.7, coin: 100, leak: 5, bite: 60, cast: { kind: 'freeze', every: 9, range: 4.6, dur: 5, n: 3 } },
};
// 每一波：[種類, 隻數, 間隔秒, 延後幾秒開始]
export const WAVES = [
  [['foe_minion', 8, 1.3, 0]],
  [['foe_minion', 8, 1.0, 0], ['foe_intern', 5, 1.5, 4]],
  [['foe_courier', 9, 0.85, 0], ['foe_minion', 6, 1.1, 5]],                                             // 風：教屬性
  [['foe_clerk', 6, 1.6, 0], ['foe_courier', 7, 0.9, 5]],                                               // 水＋快
  [['foe_knight', 3, 3.0, 0], ['foe_courier', 9, 0.8, 3], ['foe_ghost', 2, 2, 12]],                      // 重甲擋火力、快的鑽空隙；先看到兩隻幽靈
  [['foe_minion', 10, 0.8, 0], ['foe_auntie', 4, 2.6, 3], ['foe_chief', 1, 0, 10]],                      // 火＋麻痺＋課長
  [['foe_intern', 10, 1.0, 0], ['foe_ghost', 6, 1.6, 4]],                                               // 幽靈：要有魔法
  [['foe_patcher', 6, 1.7, 0], ['foe_cart', 3, 3.0, 3], ['foe_ghost', 5, 1.5, 8]],                       // 回血＋分裂
  [['foe_knight', 5, 2.3, 0], ['foe_auntie', 4, 2.6, 2], ['foe_clerk', 8, 1.3, 6]],
  [['foe_ghost', 10, 1.1, 0], ['foe_patcher', 6, 1.5, 3], ['foe_courier', 12, 0.65, 8]],
  [['foe_cart', 5, 2.3, 0], ['foe_knight', 6, 2.1, 2], ['foe_auntie', 3, 3, 5], ['foe_chief', 2, 7, 6]],
  [['foe_minion', 14, 0.75, 0], ['foe_ghost', 8, 1.3, 3], ['foe_auntie', 4, 2.6, 5], ['foe_knight', 3, 3, 8], ['foe_boss', 1, 0, 12]],
];
export const RAT = { grey: { hp: 40, sp: 3.2, bite: 7, life: 14 }, brown: { hp: 95, sp: 2.2, bite: 9, life: 16 } };

const at = (v, lv) => (Array.isArray(v) ? v[lv - 1] : v);
// 給介面用：某位同事某一級的數值
export function statsOf(id, lv = 1) {
  const h = HERO[id], o = { id, lv, name: h.name, job: h.job, tag: h.tag, elem: h.elem, kind: h.kind, cost: h.cost, range: at(h.range, lv), note: h.note[lv - 1] };
  if (h.atk) { o.atk = Math.round(h.atk * LV[lv - 1]); o.cd = h.cd; o.rate = +(1 / h.cd).toFixed(1); }
  for (const k of ['n', 'splash', 'burn', 'wet', 'r', 'stun', 'execute', 'bounty', 'atkUp', 'spdUp', 'slow', 'every']) if (h[k] !== undefined) o[k] = at(h[k], lv);
  if (h.armorK) o.armorK = h.armorK; if (h.pick) o.pick = h.pick;
  return o;
}
export const upgradeCost = (id, lv) => (lv >= RULE.maxLv ? 0 : Math.round(HERO[id].cost * RULE.upK[lv - 1] / 5) * 5);
