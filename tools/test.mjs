// 規則自我檢查：node tools/test.mjs（全部 ok 才算過）
import { existsSync, readFileSync } from 'node:fs';
import * as C from '../js/core.js';
import { RULE, WAVES, TOWERS, UNITES } from '../js/data.js';
const mapFile = new URL('../art/map/office.json', import.meta.url);
if (existsSync(mapFile)) C.setMap('office', JSON.parse(readFileSync(mapFile, 'utf8')));
let fail = 0; const t = (name, v) => { console.log((v ? 'ok  ' : 'FAIL') + ' ' + name); if (!v) fail++; };
const run = (s, sec) => { for (let i = 0; i < sec / C.DT; i++) { C.step(s); s.ev.length = 0; } };

{ // 調派、報到中、放置、合併、轉派
  const s = C.newGame({ seed: 7 });
  t('開局人力 20、可調派', s.res === RULE.res0 && C.canSummon(s));
  const p = C.summon(s); t('抽到的人進報到中', p && s.pending && TOWERS[p.id]);
  t('報到中時不能再抽', !C.canSummon(s));
  t('放到空工位', C.place(s, 0) && s.slots[0].tw.id === p.id && !s.pending);
  s.pending = { id: p.id, lv: 1 }; t('同名同級點上去＝合併', C.place(s, 0) && s.slots[0].tw.lv === 2);
  s.pending = { id: p.id, lv: 1 }; t('不同級不能合併', !C.canPlace(s, 0));
  const r0 = s.res; t('轉派退回人力', C.discard(s) && s.res === Math.min(s.resMax, r0 + RULE.discardBack));
  s.slots[1].tw = { ...s.slots[0].tw, uid: 999 }; t('場上兩位同名同級可拖合併', C.canMerge(s, 0, 1) && C.drop(s, 1, 0) && s.slots[0].tw.lv === 3 && !s.slots[1].tw);
  t('III 級不能再升', (s.slots[1].tw = { ...s.slots[0].tw, uid: 998 }) && !C.canMerge(s, 1, 0));
  s.slots[1].tw = null;
  t('波間第一次調位免費', C.moveCost(s) === 0 && C.drop(s, 0, 5) && s.slots[5].tw && C.moveCost(s) === RULE.moveCost);
  t('預算不夠不能調位', s.coin < RULE.moveCost && !C.canDrop(s, 5, 6));
  t('場上轉派退回人力', (s.res = 0, C.sell(s, 5)) && s.res === RULE.sellBack[2] && !s.slots[5].tw);
}
{ // 保底：連三次抽不到可合併對象，下一抽保證有
  let okAll = true;
  for (let seed = 1; seed < 200; seed++) {
    const s = C.newGame({ seed }); s.slots[0].tw = { uid: 1, id: 'kui', lv: 1 }; s.miss = RULE.pity; s.res = 99;
    C.summon(s); if (s.pending.id !== 'kui') okAll = false;
  }
  t('保底抽到可合併的人', okAll);
}
{ // 提早開波、波次推進
  const s = C.newGame({ seed: 3 }); const c0 = s.coin;
  t('提早開波給預算', C.callWave(s) && s.phase === 'fight' && s.wave === 1 && s.coin > c0);
  t('戰鬥中不能提早開波', !C.callWave(s));
}
{ // 合體技、超級化
  const s = C.newGame({ seed: 5 }); s.slots[0].tw = { ...C.newGame({ seed: 1 }).slots[0], uid: 50, id: 'kui', lv: 1, cd: 0, skT: 0, fatigue: 0, fatT: 0, super: 0, haste: 0, star: 0, danceT: 0, hitN: 0, comboN: 0, iceShots: 0, kills: 0 };
  t('預設隊伍有兩組合體技', s.unites.length === 2 && s.unites[0].key === 'kuizhe');
  s.momentum = 100; t('只有一人在場不能合體', !C.canUnite(s, 'kuizhe'));
  s.slots[1].tw = { ...s.slots[0].tw, uid: 51, id: 'zhe' }; t('兩人在場可以合體', C.canUnite(s, 'kuizhe') && C.useUnite(s, 'kuizhe') && s.momentum === 40 && s.cds.kuizhe > 0);
  t('氣勢不夠不能超級化', !C.canSuper(s, 0));
  s.momentum = 100; t('超級化 12 秒', C.useSuper(s, 0) && s.slots[0].tw.super === RULE.superT && s.momentum === 0);
}
{ // 重演：同種子同操作同結果
  const s = C.newGame({ seed: 11 });
  while (s.state === 'play' && s.t < 400) { if (C.canSummon(s)) C.summon(s); if (s.pending) { const i = s.slots.findIndex((x, i) => C.canPlace(s, i)); i >= 0 ? C.place(s, i) : C.discard(s); } C.step(s); s.ev.length = 0; }
  const r = C.replay(s.opts, s.log, s.n);
  t('replay 結果一致', r.n === s.n && r.kills === s.kills && r.lives === s.lives && r.coin === s.coin && JSON.stringify(r.slots.map(x => x.tw && x.tw.id + x.tw.lv)) === JSON.stringify(s.slots.map(x => x.tw && x.tw.id + x.tw.lv)));
}
{ // 事件格式
  const s = C.newGame({ seed: 2 }); C.summon(s); C.place(s, 0); C.callWave(s); let shot = null;
  for (let i = 0; i < 2000 && !shot; i++) { C.step(s); shot = s.ev.find(e => e.k === 'shot'); s.ev.length = 0; }
  t('shot 事件帶 dir／flip', shot && ['down', 'side', 'up'].includes(shot.dir) && typeof shot.flip === 'boolean');
}
{ // 最終頭目沒打倒算輸
  const s = C.newGame({ seed: 4 }); s.wave = WAVES.length - 1; s.waveT = 0; C.step(s);
  run(s, 600); t('沒人守，最終波輸掉', s.state === 'lose');
}
{ // 所有同事都能上場出手
  let okAll = true;
  for (const id of Object.keys(TOWERS)) { const s = C.newGame({ seed: 9, team: [id] }); s.res = 99; C.summon(s); C.place(s, 4); s.pool = ['kui']; C.summon(s); C.place(s, 3); C.callWave(s); let any = false; for (let i = 0; i < 3000 && !any; i++) { C.step(s); any = s.ev.some(e => (e.k === 'shot' || e.k === 'buff' || e.k === 'cleanse' || e.k === 'cone') && e.slot === 4 || e.k === 'cone'); s.ev.length = 0; } if (!any) { okAll = false; console.log('   沒出手：', id); } }
  t('16 位同事都會出手', okAll);
}
console.log(fail ? `${fail} 項失敗` : '全部通過'); process.exit(fail ? 1 : 0);
