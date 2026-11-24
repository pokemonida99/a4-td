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
export const RULE = { coin0: 160, lives: 10, upK: [0.8, 1.3], sellBack: 0.6, waveCoin: w => 30 + w * 6, hpGrow: 0.14, maxLv: 3 };

// kind：melee 近身、bolt 飛彈、pierce 直線貫穿、blast 定點爆開、buff 加攻加速、haste 加速、slow 緩速、summon 召喚、cure 解除異常
// 陣列＝一到三級的數值
export const HERO = {
  kui: { name: '小葵', job: '劍士', elem: 'slash', kind: 'melee', cost: 50, range: 2.8, atk: 10, cd: 0.5, n: [1, 1, 2], note: ['快刀連斬', '刀更利', '一次砍兩個'] },
  you: { name: '老油條', job: '盜賊', elem: 'slash', kind: 'melee', cost: 60, range: 3.0, atk: 6, cd: 0.3, pick: 'weak', execute: [1.8, 2.2, 2.8], note: ['專挑殘血補刀', '補刀更痛', '補刀再更痛'] },
  qiang: { name: '阿強', job: '重拳', elem: 'fist', kind: 'melee', cost: 75, range: 2.6, atk: 32, cd: 1.4, stun: [0.5, 0.7, 0.9], armorK: 1.8, note: ['重拳打暈、破重甲', '暈更久', '暈再更久'] },
  jie: { name: '阿傑', job: '火法師', elem: 'fire', kind: 'bolt', cost: 90, range: 4.4, atk: 18, cd: 1.2, splash: [0, 1.3, 1.9], note: ['火球', '火球會炸開一片', '炸得更大'] },
  xu: { name: '許許', job: '藥師', elem: 'fire', kind: 'bolt', cost: 85, range: 4.0, atk: 8, cd: 1.1, splash: [0.9, 0.9, 1.2], burn: [5, 8, 12], note: ['燃燒瓶，持續燒', '燒更痛', '燒更痛、範圍更大'] },
  yan: { name: '小燕', job: '水法師', elem: 'water', kind: 'bolt', cost: 80, range: 4.2, atk: 15, cd: 0.85, wet: [0, 0.2, 0.3], note: ['水彈', '打中會變慢', '變得更慢'] },
  zhe: { name: '阿哲', job: '槍兵', elem: 'wind', kind: 'pierce', cost: 85, range: 5.2, atk: 13, cd: 0.8, n: [1, 2, 3], note: ['風槍', '一槍穿兩個', '一槍穿三個'] },
  heilun: { name: '黑輪', job: '業務', elem: 'wind', kind: 'bolt', cost: 80, range: 5.6, atk: 9, cd: 0.5, bounty: [1, 2, 3], note: ['飛名片，打倒多拿錢', '多拿更多', '再多拿'] },
  mi: { name: '小米', job: '光法師', elem: 'light', kind: 'blast', cost: 110, range: 4.6, atk: 36, cd: 2.3, r: [1.1, 1.6, 2.1], note: ['光爆，出手慢', '範圍變大', '範圍再變大'] },
  kevin: { name: 'Kevin', job: '闇騎士', elem: 'dark', kind: 'blast', cost: 110, range: 4.6, atk: 36, cd: 2.3, r: [1.1, 1.6, 2.1], note: ['闇爆，出手慢', '範圍變大', '範圍再變大'] },
  senpai: { name: '學姊', job: '偵探', elem: 'light', kind: 'bolt', cost: 100, range: 6.6, atk: 62, cd: 2.6, pick: 'strong', note: ['遠距離狙擊最壯的', '更痛', '再更痛'] },
  vivi: { name: 'Vivi', job: '公主', elem: 'sup', kind: 'buff', cost: 100, range: 3.4, atkUp: [0.2, 0.3, 0.4], spdUp: [0.15, 0.22, 0.3], note: ['附近同事加攻、加速', '加更多', '加再更多'] },
  cha: { name: '茶茶', job: '補給', elem: 'sup', kind: 'haste', cost: 70, range: 3.3, spdUp: [0.3, 0.45, 0.6], note: ['送珍奶，附近同事出手變快', '更快', '再更快'] },
  an: { name: '小安', job: '工安', elem: 'sup', kind: 'slow', cost: 70, range: 3.1, slow: [0.25, 0.35, 0.45], note: ['放三角錐，附近敵人變慢', '更慢', '再更慢'] },
  fairy: { name: '鼠仙女', job: '召喚師', elem: 'summon', kind: 'summon', cost: 110, range: 4.0, every: [7, 6, 5], note: ['召喚灰鼠擋路咬人', '多一隻耐打的棕鼠', '一次召兩隻'] },
  wu: { name: '小蝶', job: '舞者', elem: 'cure', kind: 'cure', cost: 60, range: [3.6, 4.6, 5.6], note: ['自動解除附近同事的冰凍、麻痺', '範圍變大', '解除後 4 秒不再中'] },
};
export const HERO_ORDER = ['kui', 'jie', 'yan', 'zhe', 'qiang', 'mi', 'kevin', 'vivi', 'cha', 'an', 'fairy', 'wu', 'you', 'xu', 'heilun', 'senpai'];

// cast：敵人會讓附近同事中異常（para 麻痺＝出手變很慢、freeze 冰凍＝完全不能動）
export const FOE = {
  foe_minion: { name: '雜事', elem: 'none', hp: 46, sp: 1.6, coin: 4 },
  foe_intern: { name: '實習生', elem: 'none', hp: 76, sp: 1.4, coin: 5 },
  foe_courier: { name: '急件', elem: 'wind', hp: 44, sp: 2.8, coin: 5 },
  foe_clerk: { name: '掛名專員', elem: 'water', hp: 135, sp: 1.5, coin: 7 },
  foe_patcher: { name: '補件員', elem: 'light', hp: 120, sp: 1.3, coin: 7, regen: 5 },
  foe_auntie: { name: '碎念阿姨', elem: 'fire', hp: 190, sp: 1.2, coin: 10, cast: { kind: 'para', every: 6, range: 3.4, dur: 6, n: 1 } },
  foe_ghost: { name: '幽靈人口', elem: 'dark', hp: 115, sp: 1.7, coin: 9, ghost: true },
  foe_knight: { name: '照章辦事', elem: 'none', hp: 270, sp: 1.0, coin: 10, armor: true },
  foe_cart: { name: '轉寄車', elem: 'wind', hp: 230, sp: 1.2, coin: 9, split: ['foe_mini', 3] },
  foe_mini: { name: '小公文', elem: 'none', hp: 26, sp: 2.2, coin: 1 },
  foe_chief: { name: '課長', elem: 'fire', hp: 950, sp: 0.9, coin: 40, leak: 3, bite: 30 },
  foe_boss: { name: '大老闆', elem: 'dark', hp: 2300, sp: 0.7, coin: 100, leak: 5, bite: 60, cast: { kind: 'freeze', every: 9, range: 4.6, dur: 5, n: 3 } },
};
// 每一波：[種類, 隻數, 間隔秒, 延後幾秒開始]
export const WAVES = [
  [['foe_minion', 8, 1.3, 0]],
  [['foe_minion', 8, 1.1, 0], ['foe_intern', 4, 1.6, 4]],
  [['foe_courier', 8, 0.9, 0], ['foe_minion', 6, 1.2, 5]],
  [['foe_clerk', 6, 1.7, 0], ['foe_intern', 6, 1.4, 3]],
  [['foe_knight', 3, 3.0, 0], ['foe_auntie', 4, 2.6, 4]],
  [['foe_minion', 10, 0.9, 0], ['foe_chief', 1, 0, 8]],
  [['foe_ghost', 8, 1.4, 0], ['foe_courier', 8, 0.8, 6]],
  [['foe_patcher', 6, 1.8, 0], ['foe_cart', 3, 3.2, 3]],
  [['foe_knight', 5, 2.4, 0], ['foe_auntie', 5, 2.4, 2], ['foe_clerk', 6, 1.5, 6]],
  [['foe_ghost', 10, 1.2, 0], ['foe_patcher', 6, 1.6, 3], ['foe_courier', 10, 0.7, 8]],
  [['foe_cart', 5, 2.4, 0], ['foe_knight', 6, 2.2, 2], ['foe_chief', 2, 7, 6]],
  [['foe_minion', 12, 0.8, 0], ['foe_ghost', 8, 1.3, 3], ['foe_auntie', 4, 2.6, 5], ['foe_boss', 1, 0, 12]],
];
export const RAT = { grey: { hp: 40, sp: 3.2, bite: 7, life: 14 }, brown: { hp: 95, sp: 2.2, bite: 9, life: 16 } };

const at = (v, lv) => (Array.isArray(v) ? v[lv - 1] : v);
// 給介面用：某位同事某一級的數值
export function statsOf(id, lv = 1) {
  const h = HERO[id], o = { id, lv, name: h.name, job: h.job, elem: h.elem, kind: h.kind, cost: h.cost, range: at(h.range, lv), note: h.note[lv - 1] };
  if (h.atk) { o.atk = Math.round(h.atk * LV[lv - 1]); o.cd = h.cd; o.rate = +(1 / h.cd).toFixed(1); }
  for (const k of ['n', 'splash', 'burn', 'wet', 'r', 'stun', 'execute', 'bounty', 'atkUp', 'spdUp', 'slow', 'every']) if (h[k] !== undefined) o[k] = at(h[k], lv);
  if (h.armorK) o.armorK = h.armorK; if (h.pick) o.pick = h.pick;
  return o;
}
export const upgradeCost = (id, lv) => (lv >= RULE.maxLv ? 0 : Math.round(HERO[id].cost * RULE.upK[lv - 1] / 5) * 5);
