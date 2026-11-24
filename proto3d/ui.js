// 準時下班防衛戰 3D 版｜介面：標題、抬頭資訊、兵種選單、同事資料、波次預告、技能、教學、結算
// 美術方向：值班看板——深藍實色底、直角、硬邊陰影；能用圖示就不用字。
import { HERO, HERO_ORDER, FOE, ELEM, BEATS, WAVES, RULE, DIFF, PHYS, statsOf, upgradeCost, elemMul } from './rules.js';
import { startAudio, sfx, bgm, setMute, isMuted } from './audio.js';

// 屬性小圖示：11×11 點陣，程式畫
const GLYPH = {
  fire: ['.....#.....', '....##.....', '....###....', '...####.#..', '..#####.##.', '.######.##.', '.#########.', '.###.#####.', '.##...####.', '..#....##..', '...#####...'],
  water: ['.....#.....', '....###....', '....###....', '...#####...', '..#######..', '.#########.', '.#########.', '.##.######.', '.##..#####.', '..###.###..', '...#####...'],
  wind: ['...........', '....###....', '.......#...', '.#######...', '...........', '.#########.', '..........#', '.######..#.', '......#....', '....##.....', '...........'],
  light: ['.....#.....', '.#...#...#.', '..#.....#..', '....###....', '...#####...', '##.#####.##', '...#####...', '....###....', '..#.....#..', '.#...#...#.', '.....#.....'],
  dark: ['....####...', '..###......', '.###.......', '.###.......', '####.......', '####.......', '.###.......', '.####....#.', '..#####.##.', '...######..', '.....###...'],
  slash: ['.........##', '........###', '.......###.', '......###..', '.....###...', '.#..###....', '.#####.....', '..###......', '.#####.....', '##..#......', '#..........'],
  fist: ['...........', '..#.#.#.#..', '.#########.', '.#########.', '.#########.', '.########.#', '.#########.', '.#########.', '..#######..', '..#######..', '...#####...'],
  sup: ['.....#.....', '....###....', '...#####...', '..#######..', '.....#.....', '....###....', '...#####...', '..#######..', '....###....', '....###....', '....###....'],
  summon: ['...##.##...', '...##.##...', '.##.....##.', '.##.....##.', '....###....', '...#####...', '..#######..', '..#######..', '..#######..', '...##.##...', '...........'],
  cure: ['...........', '....###....', '....###....', '.#########.', '.#########.', '.#########.', '....###....', '....###....', '...........', '...........', '...........'],
  none: ['...........', '...#####...', '..#.....#..', '.#.......#.', '.#.......#.', '.#.......#.', '.#.......#.', '.#.......#.', '..#.....#..', '...#####...', '...........'],
};
const ICON = {};
function elemIcon(e) {
  if (ICON[e]) return ICON[e];
  const cv = document.createElement('canvas'); cv.width = cv.height = 13; const c = cv.getContext('2d'), g = GLYPH[e] || GLYPH.none;
  const put = (ox, oy, col) => { c.fillStyle = col; g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.fillRect(x + 1 + ox, y + 1 + oy, 1, 1); })); };
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) put(ox, oy, '#070a12');
  put(0, 0, ELEM[e].hex); return (ICON[e] = cv.toDataURL());
}
const U = n => `../art/ui/${n}.png`;
const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
const eImg = e => `<img class="pix el" src="${elemIcon(e)}" alt="${ELEM[e].name}">`;
const ic = n => `<img class="ic" src="${U(n)}" alt="">`;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 存不了就算了 */ } } };
const weakTo = e => Object.keys(BEATS).filter(k => BEATS[k] === e);          // 什麼屬性打它 ×2
const pct = v => Math.round(v * 100) + '%';

export function makeUI(G) {
  const root = el('div'); root.id = 'ui'; document.body.appendChild(root);
  root.innerHTML = `
    <div class="hud tl plate"><span class="st">${ic('heart')}<b id="uLives"></b></span><span class="st">${ic('coin')}<b id="uCoin"></b></span><span class="st">${ic('wave')}<b id="uWave"></b></span><button id="uChart" class="mini" aria-label="屬性相剋表">${eImg('water')}<i>›</i>${eImg('fire')}<i>›</i>${eImg('wind')}</button></div>
    <div class="hud tr"><button id="uSpd" class="plate btn">${ic('speed')}<b>×1</b></button><button id="uPause" class="plate btn" aria-label="暫停">${ic('pause')}</button><button id="uSnd" class="plate btn" aria-label="聲音"><img class="ic" alt=""></button></div>
    <button id="uSkill" class="plate skill" hidden><img class="ic" src="${U('super')}" alt=""><b>喊話</b><small id="uSkillTx"></small></button>
    <div class="next plate" id="uNext"><div class="lbl" id="uNextLbl"></div><div class="chips" id="uChips"></div><button id="uGo" class="go"></button></div>
    <div class="foeinfo plate" id="uFoe" hidden></div>
    <div class="panel plate" id="uPanel" hidden></div>
    <div id="uToast"></div><div id="uFloats"></div>
    <div class="chart plate" id="uChartBox" hidden></div>
    <div id="uTut" hidden></div><img id="uFinger" src="${U('finger')}" alt="" hidden>
    <div id="uEnd" hidden></div><div id="uTitle"></div>
    <div id="uRot"><div class="plate">請把手機橫著拿</div></div>`;
  const $ = id => root.querySelector('#' + id);
  const P = G.portraits, panel = $('uPanel');
  let mode = null, slot = -1, pickId = null, last = {}, tut = null, cardTap = null, started = false;
  const noTut = new URLSearchParams((location.hash || location.search).slice(1)).has('notut');
  const seen = {};

  const chartHTML = () => `<div class="cyc">${eImg('water')}<b>水</b><i>剋</i>${eImg('fire')}<b>火</b><i>剋</i>${eImg('wind')}<b>風</b><i>剋</i>${eImg('water')}<b>水</b></div>
    <div class="cyc">${eImg('light')}<b>光</b><i>⇄ 互剋</i>${eImg('dark')}<b>闇</b></div>
    <div class="cyc dim">打對 <b class="crit">×2</b>　打錯 <b class="weak">½</b>　${eImg('slash')}斬 ${eImg('fist')}拳 不看屬性</div>`;
  $('uChartBox').innerHTML = chartHTML() + '<button class="x" aria-label="關閉">×</button>';
  $('uChart').onclick = () => { sfx('cursor'); $('uChartBox').hidden = !$('uChartBox').hidden; };
  $('uChartBox').querySelector('.x').onclick = () => { $('uChartBox').hidden = true; };

  // ── 數值列：攻擊力、攻速、範圍（輔助角色改顯示效果）──
  function statRow(st, short) {
    const a = [];
    if (st.atk) a.push(`<span>${ic('dmg')}<b>${st.atk}</b></span>`, short ? `<span>${ic('aspd')}<b>${st.rate}</b></span>` : `<span>${ic('aspd')}<small>每秒打</small><b>${st.rate}</b><small>次</small></span>`);
    if (st.atkUp) a.push(`<span>${ic('dmg')}<b>+${pct(st.atkUp)}</b></span>`);
    if (st.spdUp) a.push(`<span>${ic('aspd')}<b>+${pct(st.spdUp)}</b></span>`);
    if (st.slow) a.push(`<span>${ic('speed')}<b>−${pct(st.slow)}</b></span>`);
    if (st.kind === 'summon') a.push(`<span>${ic('aspd')}<b>${st.every}</b><small>秒一隻</small></span>`);
    if (!short) a.push(`<span>${ic('range')}<b>${st.range}</b><small>範圍</small></span>`);
    return a.join('');
  }
  const elemTag = e => `<span class="tag" style="--c:${ELEM[e].hex}">${eImg(e)}${ELEM[e].name}</span>`;
  const versus = e => { const win = BEATS[e], lose = weakTo(e).find(k => k !== win); return (win ? `<span class="vs">剋 ${eImg(win)}</span>` : '') + (lose && e !== 'light' && e !== 'dark' ? `<span class="vs dim">怕 ${eImg(lose)}</span>` : ''); };
  // 這位同事對下一波：有幾成敵人被剋、幾成打不動
  function matchup(id) {
    const st = statsOf(id, 1), w = G.C.waveInfo(Math.min(G.s.wave + (G.s.phase === 'fight' ? 1 : 0), WAVES.length - 1)); let n = 0, good = 0, bad = 0;
    for (const o of w) { n += o.n; if (!st.atk) continue; const m = elemMul(st.elem, o.elem); if (m > 1) good += o.n; if (m < 1 || (PHYS[st.elem] && FOE[o.type].ghost)) bad += o.n; }
    return { good: good / n, bad: bad / n };
  }

  function openBuild(i) {
    mode = 'build'; slot = i; G.select(i); G.lift = .3; G.hold = true; panel.hidden = false; panel.className = 'panel plate build'; $('uFoe').hidden = true;
    panel.innerHTML = `<div class="detail" id="uDetail"></div><div class="cards" id="uCards"></div><span class="held">時間暫停中</span>`;
    const cards = panel.querySelector('#uCards'), s = G.s;
    const mu = Object.fromEntries(HERO_ORDER.map(id => [id, matchup(id)]));
    const order = [...HERO_ORDER].sort((a, b) => (G.C.placed(s, a) - G.C.placed(s, b)) || ((mu[b].good >= .3) - (mu[a].good >= .3)) || ((mu[a].bad >= .5) - (mu[b].bad >= .5)));
    for (const id of order) {
      const st = statsOf(id, 1), b = el('button', 'card'); b.dataset.id = id;
      b.innerHTML = `<img class="por" src="${P[id]}" alt=""><span class="e">${eImg(st.elem)}</span>${mu[id].good >= .3 ? '<span class="bd good">×2</span>' : mu[id].bad >= .5 ? '<span class="bd bad">½</span>' : ''}<b class="nm">${st.name}</b><span class="tg">${st.tag}</span><span class="stats">${statRow(st, true)}</span><em>${ic('coin')}${st.cost}</em>`;
      b.onclick = () => { cardTap = id; sfx('cursor'); pick(id); };
      cards.appendChild(b);
    }
    pick(pickId && !G.C.placed(s, pickId) ? pickId : order.find(id => G.C.canPlace(s, i, id)) || order[0]); refresh(true);
  }
  function pick(id) {
    pickId = id; const st = statsOf(id, 1), d = panel.querySelector('#uDetail'), mu = matchup(id); if (!d) return;
    const hint = mu.good >= .3 ? `<span class="hint good">對下一波傷害 ×2</span>` : mu.bad >= .5 ? `<span class="hint bad">下一波很難打</span>` : '';
    d.innerHTML = `<img class="por big" src="${P[id]}" alt=""><div class="info"><div class="nm">${st.name}<small>${st.job}</small>${elemTag(st.elem)}${versus(st.elem)}${hint}</div><div class="stats">${statRow(st)}</div><div class="note">${st.note}</div></div><button class="buy" id="uBuy">${ic('coin')}<b>${st.cost}</b><span>派駐</span></button><button class="x" aria-label="關閉">×</button>`;
    d.querySelector('#uBuy').onclick = buy; d.querySelector('.x').onclick = close;
    panel.querySelectorAll('.card').forEach(c => c.classList.toggle('on', c.dataset.id === id));
    G.showRange(slot, st.range, ELEM[st.elem].rgb); refresh(true); tutCheck();
  }
  function buy() { if (G.C.place(G.s, slot, pickId)) { sfx('confirm'); pickId = null; close(); tutCheck(); if (!seen.drag && tut == null && G.s.slots.filter(x => x.h).length === 3) { seen.drag = 1; toast('左右拖曳畫面可以轉動場景', 3); } } else { sfx('weak', .4); bump($('uCoin')); } }
  function openHero(i) {
    const h = G.s.slots[i].h; if (!h) return close(); mode = 'hero'; slot = i; G.select(i); G.lift = .14; G.hold = true; panel.hidden = false; panel.className = 'panel plate hero'; $('uFoe').hidden = true;
    const st = statsOf(h.id, h.lv), nx = h.lv < RULE.maxLv ? statsOf(h.id, h.lv + 1) : null, uc = upgradeCost(h.id, h.lv);
    panel.innerHTML = `<div class="detail"><img class="por big" src="${P[h.id]}" alt=""><div class="info"><div class="nm">${st.name}<small>${st.job}</small><span class="lv">${'◆'.repeat(h.lv)}${'◇'.repeat(RULE.maxLv - h.lv)}</span>${elemTag(st.elem)}${versus(st.elem)}</div><div class="stats">${statRow(st)}${h.bAtk > 0 || h.bSpd > 0 ? `<span class="hint good">被加持${h.bAtk > 0 ? ` 攻+${pct(h.bAtk)}` : ''}${h.bSpd > 0 ? ` 速+${pct(h.bSpd)}` : ''}</span>` : ''}</div><div class="note">${st.note}${nx ? `<span class="nx">　升級後：${nx.note}${nx.atk ? `（${ic('dmg')}${st.atk}→${nx.atk}）` : ''}</span>` : ''}</div></div>
      ${nx ? `<button class="buy" id="uUp">${ic('promote')}<span>升級</span><b>${ic('coin')}${uc}</b></button>` : `<div class="max">滿級</div>`}<button class="sell" id="uSell">${ic('refund')}<span>${h.fresh ? '撤回' : '調走'}</span><b>+${G.C.sellValue(G.s, i)}</b></button><button class="x" aria-label="關閉">×</button></div><span class="held">時間暫停中</span>`;
    const up = panel.querySelector('#uUp'); if (up) up.onclick = () => { if (G.C.upgrade(G.s, i)) { sfx('buff'); openHero(i); tutCheck(); } else { sfx('weak', .4); bump($('uCoin')); } };
    panel.querySelector('#uSell').onclick = () => { sfx('coin'); G.C.sell(G.s, i); close(); };
    panel.querySelector('.x').onclick = close;
    G.showRange(i, st.range, ELEM[st.elem].rgb); refresh(true);
  }
  function close() { mode = null; slot = -1; panel.hidden = true; G.lift = 0; G.hold = false; G.select(null); }
  function bump(node) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }

  // ── 右下：下一波預告＋開始（倒數中提早開有獎勵）──
  function nextBox() {
    const s = G.s, w = s.wave, fight = s.phase === 'fight', left = s.foes.length + s.q.length, eb = G.C.earlyBonus(s);
    $('uNextLbl').innerHTML = fight ? `第 ${w + 1} 波　<b>剩 ${left}</b>` : w === 0 ? '第一波會來：' : `下一波　<b class="cdn">${Math.max(0, Math.ceil(s.prepT))} 秒</b>後自動開始`;
    const key = (fight ? 'f' : 'p') + w;
    if (last.next !== key) {
      last.next = key; $('uFoe').hidden = true;
      $('uChips').innerHTML = G.C.waveInfo(Math.min(w, WAVES.length - 1)).map(o => `<button class="chip" data-t="${o.type}"><img class="por" src="${P[o.type]}" alt="">${o.elem !== 'none' ? eImg(o.elem) : ''}${fight ? '' : `<b>×${o.n}</b>`}${FOE[o.type].trait ? '<i class="tr">!</i>' : ''}</button>`).join('');
      $('uChips').querySelectorAll('.chip').forEach(c => { c.onclick = () => { sfx('cursor'); foeInfo(c.dataset.t); }; });
      if (!fight && started) { const nw = G.C.waveInfo(Math.min(w, WAVES.length - 1)).find(o => FOE[o.type].trait && !seen['t_' + o.type]); if (nw) { seen['t_' + nw.type] = 1; foeInfo(nw.type, true); } }
    }
    const goKey = fight ? '' : w === 0 ? 'start' : 'early' + eb;
    if (last.go !== goKey) { last.go = goKey; $('uGo').innerHTML = w === 0 ? '開始' : `立即開波${eb > 0 ? `<span class="rw">獎勵 ${ic('coin')}+${eb}</span>` : ''}`; }
    $('uGo').hidden = fight; $('uNext').classList.toggle('fight', fight); $('uNext').hidden = !started || s.phase === 'won' || s.phase === 'lost';
  }
  function foeInfo(t, auto) {
    const F = FOE[t], b = $('uFoe'), w = weakTo(F.elem);
    if (!auto && !b.hidden && b.dataset.t === t) { b.hidden = true; return; }
    b.dataset.t = t; b.hidden = false;
    b.innerHTML = `<img class="por big" src="${P[t]}" alt=""><div><div class="nm">${auto ? '<b class="new">新敵人</b>' : ''}${F.name} ${F.elem !== 'none' ? elemTag(F.elem) : ''}</div>${F.trait ? `<div class="note warn">${F.trait}</div>` : ''}<div class="wk">${w.length ? `怕 ${w.map(e => eImg(e) + ELEM[e].name).join('、')} <b class="crit">×2</b>` : F.ghost || F.armor ? '' : '沒有弱點，誰打都一樣'}</div></div>`;
  }
  $('uGo').onclick = () => { const eb = G.C.earlyBonus(G.s); if (G.C.startWave(G.s)) { if (mode) close(); if (eb > 0) toast(`提早開波 ${ic('coin')}+${eb}`, 1.6); tutCheck(); } };
  $('uSpd').onclick = () => { sfx('cursor'); G.speed = G.speed === 1 ? 2 : 1; $('uSpd').querySelector('b').textContent = '×' + G.speed; $('uSpd').classList.toggle('on', G.speed > 1); };
  $('uPause').onclick = () => { sfx('cursor'); G.paused = !G.paused; $('uPause').classList.toggle('on', G.paused); toast(G.paused ? '暫停中' : '繼續'); };
  const sndIcon = () => { $('uSnd').querySelector('img').src = U(isMuted() ? 'snd_off' : 'snd_on'); }; sndIcon();
  $('uSnd').onclick = () => { setMute(!isMuted()); sndIcon(); sfx('cursor'); };
  $('uSkill').onclick = () => { if (G.C.useSkill(G.s)) sfx('fanfare', .5); };

  function refresh(force) {
    const s = G.s, n = s.slots.filter(x => x.h).length;
    if (force || last.coin !== s.coin || last.n !== n) {
      last.n = n;
      if (mode === 'build') { panel.querySelectorAll('.card').forEach(c => { const id = c.dataset.id, used = G.C.placed(s, id); c.classList.toggle('used', used); c.classList.toggle('poor', !used && s.coin < HERO[id].cost); }); const b = panel.querySelector('#uBuy'); if (b) b.disabled = !G.C.canPlace(s, slot, pickId); }
      if (mode === 'hero') { const b = panel.querySelector('#uUp'); if (b) b.disabled = !G.C.canUpgrade(s, slot); }
    }
    if (last.coin !== s.coin) { if (last.coin != null && s.coin > last.coin) bump($('uCoin')); last.coin = s.coin; $('uCoin').textContent = s.coin; }
    if (last.lives !== s.lives) { last.lives = s.lives; $('uLives').textContent = s.lives; $('uLives').parentNode.classList.toggle('low', s.lives <= 3); }
    const wv = Math.min(s.wave + 1, WAVES.length) + '/' + WAVES.length; if (last.wv !== wv) { last.wv = wv; $('uWave').textContent = wv; }
    // 技能鈕：有人上工之後才出現；冷卻用秒數蓋在上面
    const sk = $('uSkill'), show = started && n > 0 && s.wave >= 1 && !mode; if (sk.hidden === show) sk.hidden = !show;
    if (show) { const cd = Math.ceil(s.skillCd), st = s.skillT > 0 ? 'on' : cd > 0 ? 'cd' + cd : s.phase === 'fight' ? 'ok' : 'wait'; if (last.sk !== st) { last.sk = st; sk.className = 'plate skill ' + st.replace(/\d+/, ''); $('uSkillTx').textContent = s.skillT > 0 ? '加速中' : cd > 0 ? `冷卻 ${cd} 秒` : s.phase === 'fight' ? '全員攻速+50%' : '開打後可用'; } }
  }

  // ── 飄字（傷害、金幣）──
  const floats = $('uFloats'); let nFloat = 0;
  function float(x, y, v, cls, elem) {
    if (nFloat > 16 || (!cls && nFloat > 5)) return; nFloat++;
    const d = el('span', 'fl ' + (cls || ''), cls === 'crit' ? `${v}<i>×2</i>` : cls === 'weak' ? `${v}<i>½</i>` : v); d.style.left = x + 'px'; d.style.top = y + 'px'; if (elem && !cls) d.style.color = ELEM[elem].hex;
    floats.appendChild(d); d.addEventListener('animationend', () => { d.remove(); nFloat--; });
  }
  function coinFly(x, y, n) { if (nFloat > 20) return; nFloat++; const d = el('span', 'fl coin', '+' + n); d.style.left = x + 'px'; d.style.top = y + 'px'; floats.appendChild(d); d.addEventListener('animationend', () => { d.remove(); nFloat--; }); }
  let toastT = 0; function toast(msg, sec = 2.2) { $('uToast').innerHTML = `<div class="plate">${msg}</div>`; toastT = sec; }
  function status(kind) { if (seen[kind]) return; seen[kind] = 1; toast(kind === 'freeze' ? `有同事被<b class="ice">冰凍</b>了！派 <b>小蝶</b> 在旁邊會自動解除` : `有同事被<b class="para">麻痺</b>、出手變很慢！派 <b>小蝶</b> 會自動解除`, 5); }
  let leaked = {};
  function leak(n, type) { bump($('uLives')); leaked[type] = (leaked[type] || 0) + 1; }
  function leakTip() {
    const t = Object.keys(leaked).sort((a, b) => leaked[b] - leaked[a])[0]; if (!t) return ''; const F = FOE[t], wk = weakTo(F.elem), n = leaked[t]; leaked = {};
    if (F.ghost) return `漏掉 ${n} 個${F.name}：斬、拳打不到它，要派會魔法的人`;
    if (F.armor) return `漏掉 ${n} 個${F.name}：重甲怕阿強的拳頭`;
    if (wk.length) return `漏掉 ${n} 個${F.name}：它怕${wk.map(e => ELEM[e].name).join('、')}屬性（×2）`;
    return `漏掉 ${n} 個${F.name}：多派一個人，或把現有的人升級`;
  }
  function phase(e) {
    if (e.k === 'wave') { last.next = null; last.go = null; leaked = {}; }
    if (e.k === 'clear') {
      const lt = leakTip(); toast(lt ? `${lt}　${ic('coin')}+${e.bonus}` : `守住了！${ic('coin')}+${e.bonus}`, lt ? 5 : 2); last.next = null; last.go = null;
      if (!noTut && tut == null && !store.get('a4td3d_tut2') && e.n === 1) tutShow('B0'); else if (!noTut && tut == null && !store.get('a4td3d_tut3') && e.n === 2) tutShow('C0');
    }
    if (e.k === 'skill') toast('精神喊話！全員加速', 1.6);
    if (e.k === 'won' || e.k === 'lost') endScreen(e.k);
  }
  function endScreen(k) {
    close(); $('uToast').innerHTML = ''; $('uFoe').hidden = true; const s = G.s, b = $('uEnd'), won = k === 'won', stars = won ? (s.lives >= 8 ? 3 : s.lives >= 4 ? 2 : 1) : 0, key = 'a4td3d_best_' + s.diff, old = +(store.get(key) || 0);
    if (stars > old) store.set(key, String(stars)); b.hidden = false;
    b.innerHTML = `<div class="plate end ${k}"><h2>${won ? '準時下班！' : '今天又加班了…'}</h2>${won ? `<div class="stars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></div>` : ''}<p>${DIFF[s.diff].name}　${won ? `打卡機還剩 ${ic('heart')}${s.lives}` : `撐到第 ${s.wave + 1} 波`}　處理掉 ${s.kills} 件工作</p>${won ? `<p class="tip">${stars < 3 ? '下次挑戰：一條命都不掉，拿三顆星' : s.diff === 'normal' ? '三顆星！下次挑戰：加班地獄' : '加班地獄三顆星，你可以下班了。'}</p>` : `<p class="tip">${tip()}</p>`}<div class="row"><button class="go" id="uAgain">${ic('replay')}再來一次</button><button class="alt" id="uHome">換難度</button></div></div>`;
    b.querySelector('#uAgain').onclick = () => { b.hidden = true; begin(s.diff); };
    b.querySelector('#uHome').onclick = () => { b.hidden = true; title(); };
  }
  // 輸了給一句有用的建議（看是倒在哪種敵人）
  function tip() {
    const w = G.C.waveInfo(Math.min(G.s.wave, WAVES.length - 1)), big = w.slice().sort((a, b) => b.n - a.n)[0], F = FOE[big.type], wk = weakTo(F.elem);
    if (F.ghost) return '幽靈人口斬、拳打不到，要派會魔法的同事（火、水、風、光、闇）。';
    if (F.armor) return '照章辦事是重甲：阿強的拳頭傷害加倍，斬擊會打折。';
    if (wk.length) return `這一波主要是${ELEM[F.elem].name}屬性，派${wk.map(e => ELEM[e].name).join('或')}屬性的同事傷害 ×2。`;
    return '把同事放在走道轉彎的地方，一個人可以打到兩條走道；錢夠就升級。';
  }

  // ── 標題：選難度（順便讓瀏覽器准許出聲）──
  function title() {
    const t = $('uTitle'); t.hidden = false; G.hold = true; started = false;
    const best = d => { const n = +(store.get('a4td3d_best_' + d) || 0); return n ? `<span class="stars sm">${'★'.repeat(n)}<span>${'★'.repeat(3 - n)}</span></span>` : ''; };
    t.innerHTML = `<div class="tbox"><h1>準時下班<em>防衛戰</em></h1><p>工作從電梯湧出來了。<b>點發亮的空位派同事</b>，守住打卡機，撐過 12 波就能下班。</p><div class="row"><button class="go" data-d="normal">普通${best('normal')}</button><button class="go hell" data-d="hell">加班地獄${best('hell')}</button></div></div>`;
    t.querySelectorAll('button').forEach(b => { b.onclick = () => { startAudio(); sfx('confirm'); t.hidden = true; begin(b.dataset.d); }; });
  }
  function begin(diff) {
    G.restart(diff); last = {}; started = true; G.hold = false; G.speed = 1; $('uSpd').querySelector('b').textContent = '×1'; $('uSpd').classList.remove('on'); G.paused = false; $('uPause').classList.remove('on');
    nextBox(); refresh(true); bgm('map'); tut = null; tutBox.hidden = true; finger.hidden = true;
    const q = new URLSearchParams((location.hash || location.search).slice(1));
    if (!q.has('notut') && (!store.get('a4td3d_tut') || q.has('tut'))) tutShow('A0');
  }

  // ── 教學：分三次，每次只教一件事，隨時可以跳過 ──
  const hasHero = () => G.s.slots.some(x => x.h), firstHero = () => G.s.slots.findIndex(x => x.h);
  const TUT = {
    A0: { text: '擋住從<b>電梯</b>來的工作！漏到<b>打卡機</b>會扣生命。', tags: true, next: '下一步', to: 'A1' },
    A1: { text: '點一個發亮的<b>空位</b>。', at: () => G.slotScreen(4), done: () => mode === 'build' || hasHero(), to: 'A2' },
    A2: { text: '卡片上有 <b>攻擊力</b>、<b>攻速</b>、<b>屬性</b>。點 <b>小葵</b>。', el: () => panel.querySelector('.card[data-id="kui"]'), done: () => cardTap === 'kui' || hasHero(), need: () => mode === 'build', back: 'A1', to: 'A3' },
    A3: { text: '圓圈是她打得到的範圍。按 <b>派駐</b>。', el: () => panel.querySelector('#uBuy'), done: hasHero, need: () => mode === 'build', back: 'A1', to: 'A4' },
    A4: { text: '錢夠就再多派一個人，然後按 <b>開始</b>。', el: () => (mode ? null : $('uGo')), done: () => G.s.phase === 'fight', to: null, save: 'a4td3d_tut' },
    B0: { text: '賺到錢了。<b>點一下同事</b>，可以升級變強。', at: () => { const i = firstHero(); return i < 0 ? null : G.slotScreen(i); }, done: () => mode === 'hero' || G.s.phase === 'fight', to: 'B1', save: 'a4td3d_tut2', hold: true },
    B1: { text: '按 <b>升級</b>。錢不夠就先關掉，之後再升。', el: () => panel.querySelector('#uUp'), done: () => mode !== 'hero' || G.s.slots.some(x => x.h && x.h.lv > 1), to: null },
    C0: { text: `下一波是 ${eImg('wind')}<b>風</b> → 派 ${eImg('fire')}<b>火</b>，傷害 <b class="crit">×2</b>。<br>卡片右上有 <b class="crit">×2</b> 的就是剋下一波的人。`, big: true, next: '知道了', to: null, save: 'a4td3d_tut3', hold: true },
  };
  const tutBox = $('uTut'), finger = $('uFinger');
  function tutShow(k) {
    const prev = tut != null ? TUT[tut] : null; if (prev && prev.save && !k) store.set(prev.save, '1');
    if (!k) { tut = null; tutBox.hidden = true; finger.hidden = true; G.tutHold = false; return; }
    tut = k; const t = TUT[k]; if (t.save) store.set(t.save, '1'); tutBox.hidden = false; G.tutHold = !!t.hold;
    tutBox.innerHTML = `<div class="plate tut${t.big ? ' big' : ''}"><p>${t.text}</p>${t.chart ? `<div class="chartIn">${chartHTML()}</div>` : ''}<div class="act">${t.next ? `<button class="go" id="uTutNext">${t.next}</button>` : ''}<button class="skip" id="uTutSkip">跳過教學</button></div></div>${t.tags ? '<span class="tagp" id="uTagA">電梯</span><span class="tagp" id="uTagB">打卡機</span>' : ''}`;
    const n = tutBox.querySelector('#uTutNext'); if (n) n.onclick = () => { sfx('cursor'); tutShow(t.to); };
    tutBox.querySelector('#uTutSkip').onclick = () => { for (const key of ['a4td3d_tut', 'a4td3d_tut2', 'a4td3d_tut3']) store.set(key, '1'); tutShow(null); };
  }
  function tutCheck() { if (tut == null) return; const t = TUT[tut]; if (t.done && t.done()) tutShow(t.to); }
  function tutUpdate() {
    if (tut == null) return; tutCheck(); if (tut == null) return; const t = TUT[tut];
    if ((t.hold || tut === 'B1') && G.s.phase !== 'prep') return tutShow(null);        // 已經開打了，講到一半的教學就收掉，時間不能卡住
    if (t.need && !t.need() && t.back) return tutShow(t.back);
    let p = null; if (t.at) p = t.at(); else if (t.el) { const n = t.el(); if (n) { const r = n.getBoundingClientRect(); if (r.width) { if (n.classList.contains('card')) n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); p = [r.left + r.width * .62, r.top + r.height * .55]; } } }
    finger.hidden = !p; if (p) { finger.style.left = p[0] + 'px'; finger.style.top = p[1] + 'px'; }
    if (t.tags) { const a = G.elevScreen(), b = G.clockScreen(), A = tutBox.querySelector('#uTagA'), B = tutBox.querySelector('#uTagB'); A.style.left = a[0] + 'px'; A.style.top = a[1] + 'px'; B.style.left = b[0] + 'px'; B.style.top = b[1] + 'px'; }
  }

  nextBox(); refresh(true);
  const q0 = new URLSearchParams((location.hash || location.search).slice(1));
  if (q0.has('play')) { $('uTitle').hidden = true; begin(q0.get('play') === 'hell' ? 'hell' : 'normal'); } else title();

  return {
    update(dt) { refresh(false); nextBox(); tutUpdate(); if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('uToast').innerHTML = ''; } if (!seen.skill && started && G.s.phase === 'fight' && G.s.wave >= 3 && G.s.skillCd <= 0 && tut == null) { seen.skill = 1; toast('左下角 <b>喊話</b>：全員加速 6 秒，敵人太多時用', 5); } },
    tapSlot(i) { if (!started) return; $('uFoe').hidden = true; if (i < 0) return close(); if (G.s.phase === 'won' || G.s.phase === 'lost') return; sfx('cursor'); if (G.s.slots[i].h) openHero(i); else openBuild(i); tutCheck(); },
    float, coinFly, toast, status, leak, phase, close,
    get mode() { return mode; }, get tut() { return tut; },
  };
}
