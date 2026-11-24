// 準時下班防衛戰 3D 版｜介面：抬頭資訊、兵種選單、同事資料、波次預告、教學、結算
// 美術方向：值班看板——深藍實色底、直角、硬邊陰影；能用圖示就不用字。
import { HERO, HERO_ORDER, FOE, ELEM, BEATS, WAVES, RULE, statsOf, upgradeCost } from './rules.js';

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

export function makeUI(G) {
  const root = el('div'); root.id = 'ui'; document.body.appendChild(root);
  root.innerHTML = `
    <div class="hud tl plate"><span class="st">${ic('heart')}<b id="uLives"></b></span><span class="st">${ic('coin')}<b id="uCoin"></b></span><span class="st">${ic('wave')}<b id="uWave"></b></span><button id="uChart" class="mini" aria-label="屬性相剋表">${eImg('water')}<i>›</i>${eImg('fire')}<i>›</i>${eImg('wind')}</button></div>
    <div class="hud tr"><button id="uSpd" class="plate btn">${ic('speed')}<b>×1</b></button><button id="uPause" class="plate btn" aria-label="暫停">${ic('pause')}</button></div>
    <div class="next plate" id="uNext"><div class="lbl" id="uNextLbl"></div><div class="chips" id="uChips"></div><button id="uGo" class="go"></button></div>
    <div class="panel plate" id="uPanel" hidden></div>
    <div id="uToast"></div><div id="uFloats"></div>
    <div class="chart plate" id="uChartBox" hidden></div>
    <div id="uTut" hidden></div><img id="uFinger" src="${U('finger')}" alt="" hidden>
    <div id="uEnd" hidden></div>
    <div id="uRot"><div class="plate">請把手機橫著拿</div></div>`;
  const $ = id => root.querySelector('#' + id);
  const P = G.portraits, panel = $('uPanel');
  let mode = null, slot = -1, pickId = null, last = {}, tut = null, cardTap = null;

  const chartHTML = () => `<div class="cyc">${eImg('water')}<b>水</b><i>剋</i>${eImg('fire')}<b>火</b><i>剋</i>${eImg('wind')}<b>風</b><i>剋</i>${eImg('water')}<b>水</b></div>
    <div class="cyc">${eImg('light')}<b>光</b><i>⇄ 互剋</i>${eImg('dark')}<b>闇</b></div>
    <div class="cyc dim">打對 <b class="crit">×2</b>　打錯 <b class="weak">½</b>　${eImg('slash')}斬 ${eImg('fist')}拳 不看屬性</div>`;
  $('uChartBox').innerHTML = chartHTML() + '<button class="x" aria-label="關閉">×</button>';
  $('uChart').onclick = () => { $('uChartBox').hidden = !$('uChartBox').hidden; };
  $('uChartBox').querySelector('.x').onclick = () => { $('uChartBox').hidden = true; };

  // 數值列：攻擊力、攻速、範圍（輔助角色改顯示效果）
  const pct = v => Math.round(v * 100) + '%';
  function statRow(st, short) {
    const a = [];
    if (st.atk) a.push(`${ic('dmg')}<b>${st.atk}</b>`, `${ic('aspd')}<b>${st.rate}</b><small>/秒</small>`);
    if (st.atkUp) a.push(`${ic('dmg')}<b>+${pct(st.atkUp)}</b>`);
    if (st.spdUp) a.push(`${ic('aspd')}<b>+${pct(st.spdUp)}</b>`);
    if (st.slow) a.push(`${ic('speed')}<b>−${pct(st.slow)}</b>`);
    if (st.kind === 'summon') a.push(`${ic('aspd')}<b>${st.every}</b><small>秒一隻</small>`);
    if (!short || a.length < 2) a.push(`${ic('range')}<b>${st.range}</b>`);
    return a.join('');
  }
  const versus = e => { const win = BEATS[e], lose = Object.keys(BEATS).find(k => BEATS[k] === e && k !== win); return (win ? `<span class="vs">剋 ${eImg(win)}</span>` : '') + (lose && e !== 'light' && e !== 'dark' ? `<span class="vs dim">怕 ${eImg(lose)}</span>` : ''); };
  const elemTag = e => `<span class="tag" style="--c:${ELEM[e].hex}">${eImg(e)}${ELEM[e].name}</span>`;

  function openBuild(i) {
    mode = 'build'; slot = i; G.select(i); G.lift = .3; panel.hidden = false; panel.className = 'panel plate build';
    panel.innerHTML = `<div class="detail" id="uDetail"></div><div class="cards" id="uCards"></div>`;
    const cards = panel.querySelector('#uCards');
    for (const id of HERO_ORDER) {
      const st = statsOf(id, 1), b = el('button', 'card'); b.dataset.id = id;
      b.innerHTML = `<img class="por" src="${P[id]}" alt=""><span class="e">${eImg(st.elem)}</span><b class="nm">${st.name}</b><span class="stats">${statRow(st, true)}</span><em>${ic('coin')}${st.cost}</em>`;
      b.onclick = () => { cardTap = id; pick(id); };
      cards.appendChild(b);
    }
    const s = G.s; pick(pickId && !G.C.placed(s, pickId) ? pickId : HERO_ORDER.find(id => G.C.canPlace(s, i, id)) || HERO_ORDER.find(id => !G.C.placed(s, id)) || HERO_ORDER[0]);
    refresh(true);
  }
  function pick(id) {
    pickId = id; const st = statsOf(id, 1), d = panel.querySelector('#uDetail'); if (!d) return;
    d.innerHTML = `<img class="por big" src="${P[id]}" alt=""><div class="info"><div class="nm">${st.name}<small>${st.job}</small>${elemTag(st.elem)}${versus(st.elem)}</div><div class="stats">${statRow(st)}</div><div class="note">${st.note}</div></div><button class="buy" id="uBuy">${ic('coin')}<b>${st.cost}</b><span>派駐</span></button><button class="x" aria-label="關閉">×</button>`;
    d.querySelector('#uBuy').onclick = buy; d.querySelector('.x').onclick = close;
    panel.querySelectorAll('.card').forEach(c => c.classList.toggle('on', c.dataset.id === id));
    G.showRange(slot, st.range, ELEM[st.elem].rgb); refresh(true); tutCheck();
  }
  function buy() { if (G.C.place(G.s, slot, pickId)) { const i = slot; pickId = null; openHero(i); tutCheck(); } else bump($('uCoin')); }
  function openHero(i) {
    const h = G.s.slots[i].h; if (!h) return close(); mode = 'hero'; slot = i; G.select(i); G.lift = .14; panel.hidden = false; panel.className = 'panel plate hero';
    const st = statsOf(h.id, h.lv), nx = h.lv < RULE.maxLv ? statsOf(h.id, h.lv + 1) : null, uc = upgradeCost(h.id, h.lv);
    panel.innerHTML = `<div class="detail"><img class="por big" src="${P[h.id]}" alt=""><div class="info"><div class="nm">${st.name}<small>${st.job}</small><span class="lv">${'◆'.repeat(h.lv)}${'◇'.repeat(RULE.maxLv - h.lv)}</span>${elemTag(st.elem)}${versus(st.elem)}</div><div class="stats">${statRow(st)}</div><div class="note">${st.note}${nx ? `<span class="nx">　升級後：${nx.note}${nx.atk ? `（${ic('dmg')}${st.atk}→${nx.atk}）` : ''}</span>` : ''}</div></div>
      ${nx ? `<button class="buy" id="uUp">${ic('promote')}<span>升級</span><b>${ic('coin')}${uc}</b></button>` : `<div class="max">滿級</div>`}<button class="sell" id="uSell">${ic('refund')}<span>調走</span><b>+${G.C.sellValue(G.s, i)}</b></button><button class="x" aria-label="關閉">×</button></div>`;
    const up = panel.querySelector('#uUp'); if (up) up.onclick = () => { if (G.C.upgrade(G.s, i)) openHero(i); else bump($('uCoin')); };
    panel.querySelector('#uSell').onclick = () => { G.C.sell(G.s, i); close(); };
    panel.querySelector('.x').onclick = close;
    G.showRange(i, st.range, ELEM[st.elem].rgb); refresh(true);
  }
  function close() { mode = null; slot = -1; panel.hidden = true; G.lift = 0; G.select(null); }
  function bump(node) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }

  // 右下：下一波預告＋開始
  function nextBox() {
    const s = G.s, w = s.wave, fight = s.phase === 'fight';
    $('uNextLbl').textContent = fight ? `第 ${w + 1} 波　還有 ${s.foes.length + s.q.length} 個` : w < WAVES.length ? `下一波（第 ${w + 1} 波）` : '';
    const key = (fight ? 'f' : 'p') + w;
    if (last.next !== key) { last.next = key; $('uChips').innerHTML = G.C.waveInfo(Math.min(w, WAVES.length - 1)).map(o => `<span class="chip"><img class="por" src="${P[o.type]}" alt="">${o.elem !== 'none' ? eImg(o.elem) : ''}<b>×${o.n}</b></span>`).join(''); $('uGo').innerHTML = `開始`; }
    $('uGo').hidden = fight; $('uNext').classList.toggle('fight', fight);
  }
  $('uGo').onclick = () => { if (G.C.startWave(G.s)) { if (mode === 'build') close(); tutCheck(); } };
  $('uSpd').onclick = () => { G.speed = G.speed === 1 ? 2 : 1; $('uSpd').querySelector('b').textContent = '×' + G.speed; $('uSpd').classList.toggle('on', G.speed > 1); };
  $('uPause').onclick = () => { G.paused = !G.paused; $('uPause').classList.toggle('on', G.paused); toast(G.paused ? '暫停中' : '繼續'); };

  function refresh(force) {
    const s = G.s;
    if (force || last.coin !== s.coin || last.n !== s.slots.filter(x => x.h).length) {
      last.n = s.slots.filter(x => x.h).length;
      if (mode === 'build') { panel.querySelectorAll('.card').forEach(c => { const id = c.dataset.id, used = G.C.placed(s, id); c.classList.toggle('used', used); c.classList.toggle('poor', !used && s.coin < HERO[id].cost); }); const b = panel.querySelector('#uBuy'); if (b) b.disabled = !G.C.canPlace(s, slot, pickId); }
      if (mode === 'hero') { const b = panel.querySelector('#uUp'); if (b) b.disabled = !G.C.canUpgrade(s, slot); }
    }
    if (last.coin !== s.coin) { if (last.coin != null && s.coin > last.coin) bump($('uCoin')); last.coin = s.coin; $('uCoin').textContent = s.coin; }
    if (last.lives !== s.lives) { last.lives = s.lives; $('uLives').textContent = s.lives; $('uLives').parentNode.classList.toggle('low', s.lives <= 3); }
    const wv = Math.min(s.wave + 1, WAVES.length) + '/' + WAVES.length; if (last.wv !== wv) { last.wv = wv; $('uWave').textContent = wv; }
  }

  // 飄字（傷害、金幣）
  const floats = $('uFloats'); let nFloat = 0;
  function float(x, y, v, cls, elem) {
    if (nFloat > 26 || (!cls && nFloat > 12)) return; nFloat++;
    const d = el('span', 'fl ' + (cls || ''), cls === 'crit' ? `${v}<i>×2</i>` : cls === 'weak' ? `${v}<i>½</i>` : v); d.style.left = x + 'px'; d.style.top = y + 'px'; if (elem && !cls) d.style.color = ELEM[elem].hex;
    floats.appendChild(d); d.addEventListener('animationend', () => { d.remove(); nFloat--; });
  }
  function coinFly(x, y, n) { if (nFloat > 26) return; nFloat++; const d = el('span', 'fl coin', '+' + n); d.style.left = x + 'px'; d.style.top = y + 'px'; floats.appendChild(d); d.addEventListener('animationend', () => { d.remove(); nFloat--; }); }
  let toastT = 0; function toast(msg, sec = 2.2) { const t = $('uToast'); t.innerHTML = `<div class="plate">${msg}</div>`; toastT = sec; }
  const seen = {};
  function status(kind, to) { if (seen[kind]) return; seen[kind] = 1; toast(kind === 'freeze' ? `有同事被<b class="ice">冰凍</b>了！派 <b>小蝶</b> 在旁邊可以自動解除` : `有同事被<b class="para">麻痺</b>了，出手變很慢！派 <b>小蝶</b> 可以自動解除`, 5); }
  function leak(n) { bump($('uLives')); }
  function phase(e) {
    if (e.k === 'wave') { toast(`第 ${e.n} 波`, 1.4); last.next = null; }
    if (e.k === 'clear') { toast(`守住了！${ic('coin')}+${e.bonus}`, 2.2); last.next = null; if (e.n === 1 && !seen.up) { seen.up = 1; setTimeout(() => toast('點一下同事，可以花錢<b>升級</b>', 4), 2400); } }
    if (e.k === 'won' || e.k === 'lost') {
      close(); const s = G.s, b = $('uEnd'); b.hidden = false;
      b.innerHTML = `<div class="plate end ${e.k}"><h2>${e.k === 'won' ? '準時下班！' : '今天又加班了…'}</h2><p>${e.k === 'won' ? `打卡機守住了，還剩 ${ic('heart')}${s.lives}` : `撐到第 ${s.wave + 1} 波`}　處理掉 ${s.kills} 件工作</p><button class="go" id="uAgain">${ic('replay')}再來一次</button></div>`;
      b.querySelector('#uAgain').onclick = () => { b.hidden = true; G.restart(); last = {}; nextBox(); refresh(true); };
    }
  }

  // ── 開場教學：一步一步帶，隨時可以跳過 ──
  const TUT = [
    { text: '工作會從<b>電梯</b>湧出來，沿著走道衝向<b>打卡機</b>。漏掉太多，今天就得加班。', tags: true, next: '下一步' },
    { text: '先點一個發亮的<b>空位</b>。', at: () => G.slotScreen(4), done: () => mode === 'build' || G.s.slots.some(x => x.h) },
    { text: '每位同事的 <b>攻擊力</b>、<b>攻速</b>、<b>屬性</b> 都不一樣。點 <b>小葵</b> 看看。', el: () => panel.querySelector('.card[data-id="kui"]'), done: () => cardTap === 'kui' || G.s.slots.some(x => x.h), need: () => mode === 'build' },
    { text: '白色圓圈是她打得到的範圍。按 <b>派駐</b> 讓她上工。', el: () => panel.querySelector('#uBuy'), done: () => G.s.slots.some(x => x.h), need: () => mode === 'build' },
    { text: '屬性會互剋：打對傷害 <b class="crit">×2</b>，打錯只剩一半。<br>右下角會預告下一波是什麼屬性，照著挑人。', chart: true, next: '知道了' },
    { text: '錢夠就多派幾個人。準備好就按 <b>開始</b>。', el: () => $('uGo'), done: () => G.s.phase === 'fight' },
  ];
  const tutBox = $('uTut'), finger = $('uFinger');
  function tutShow(i) {
    if (i >= TUT.length) { tut = null; tutBox.hidden = true; finger.hidden = true; store.set('a4td3d_tut', '1'); return; }
    tut = i; const t = TUT[i]; tutBox.hidden = false;
    tutBox.innerHTML = `<div class="plate tut"><span class="n">${i + 1}/${TUT.length}</span><p>${t.text}</p>${t.chart ? `<div class="chartIn">${chartHTML()}</div>` : ''}<div class="act">${t.next ? `<button class="go" id="uTutNext">${t.next}</button>` : ''}<button class="skip" id="uTutSkip">跳過教學</button></div></div>${t.tags ? '<span class="tagp" id="uTagA">電梯</span><span class="tagp" id="uTagB">打卡機</span>' : ''}`;
    const n = tutBox.querySelector('#uTutNext'); if (n) n.onclick = () => tutShow(i + 1);
    tutBox.querySelector('#uTutSkip').onclick = () => tutShow(TUT.length);
  }
  function tutCheck() { if (tut == null) return; const t = TUT[tut]; if (t.done && t.done()) tutShow(tut + 1); }
  function tutUpdate() {
    if (tut == null) return; const t = TUT[tut]; tutCheck(); if (tut == null) return;
    if (t.need && !t.need()) { if (!G.s.slots.some(x => x.h)) return tutShow(1); }
    let p = null; if (t.at) p = t.at(); else if (t.el) { const n = t.el(); if (n) { const r = n.getBoundingClientRect(); if (r.width) { if (n.classList.contains('card')) n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); p = [r.left + r.width * .62, r.top + r.height * .55]; } } }
    finger.hidden = !p; if (p) { finger.style.left = p[0] + 'px'; finger.style.top = p[1] + 'px'; }
    if (t.tags) { const a = G.elevScreen(), b = G.clockScreen(), A = tutBox.querySelector('#uTagA'), B = tutBox.querySelector('#uTagB'); A.style.left = a[0] + 'px'; A.style.top = a[1] + 'px'; B.style.left = b[0] + 'px'; B.style.top = b[1] + 'px'; }
  }

  nextBox(); refresh(true);
  const params = new URLSearchParams((location.hash || location.search).slice(1));
  if (!params.has('notut') && (!store.get('a4td3d_tut') || params.has('tut'))) tutShow(0);

  return {
    update(dt) { refresh(false); nextBox(); tutUpdate(); if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('uToast').innerHTML = ''; } },
    tapSlot(i) { if (i < 0) return close(); if (G.s.phase === 'won' || G.s.phase === 'lost') return; if (G.s.slots[i].h) openHero(i); else openBuild(i); tutCheck(); },
    float, coinFly, toast, status, leak, phase, close,
    get mode() { return mode; }, get tut() { return tut; },
  };
}
