// 화면 HTML. 모든 동적 문자열은 esc()를 거친다.
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SITE = '의회 거래 기록';
const V = 3; // app.css 캐시 버전: 화면을 고치면 올린다

// 화면 모드: 자동(기기 설정)·라이트·다크, 이 기기 localStorage 'cl-theme'. 머리에서 먼저 정해 깜빡임을 막는다.
const THEME_HEAD = `(function(){try{var t=localStorage.getItem('cl-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}})()`;
const THEME_BTN = '<button type="button" class="thm" data-thm aria-label="화면 모드 바꾸기">◐ 자동</button>';
const THEME_BODY = `(function(){var L={auto:'자동',light:'라이트',dark:'다크'},N={auto:'light',light:'dark',dark:'auto'},d=document.documentElement,g=function(){try{return localStorage.getItem('cl-theme')||'auto'}catch(e){return'auto'}};function paint(t){if(t==='auto')delete d.dataset.theme;else d.dataset.theme=t;document.querySelectorAll('[data-thm]').forEach(function(b){b.textContent='◐ '+L[t];b.title='화면 모드: '+L[t]+' (누르면 바뀜)'})}paint(g());document.addEventListener('click',function(e){var b=e.target.closest('[data-thm]');if(!b)return;var t=N[g()];try{localStorage.setItem('cl-theme',t)}catch(x){}paint(t)})})()`;

const CH = { senate: '상원', house: '하원' };
const OWN = { self: '본인', spouse: '배우자', joint: '공동', child: '자녀' };
const SD = { buy: '매수', sell: '매도' };

const md = (iso) => (iso ? `${Number(iso.slice(5, 7))}.${iso.slice(8, 10)}` : '—');
const num = (n) => (n ?? 0).toLocaleString('en-US');

// 달러 금액을 '$28만'·'$1.2억'처럼 줄인다
function usd(v) {
  if (v == null) return '';
  if (v >= 1e8) return `$${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1).replace(/\.0$/, '')}억`;
  if (v >= 1e4) return `$${Math.round(v / 1e4).toLocaleString('en-US')}만`;
  return `$${num(v)}`;
}
const range = (lo, hi) => (lo == null ? '—' : hi == null ? `${usd(lo)} 초과` : `$${num(lo)}–${num(hi)}`);
const rangeSum = (lo, hi) => `${usd(lo)}–${usd(hi).replace('$', '')}`;

function q(p, c) {
  const a = [];
  if (p === '2w') a.push('p=2w');
  if (c !== 'all') a.push(`c=${c}`);
  return a.length ? `?${a.join('&')}` : '';
}

function layout(env, { title, desc, path, body }) {
  const full = title ? `${title} — ${SITE}` : `${SITE} — 미국 의원 주식 거래 신고`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc((env.ORIGIN || '') + path)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(desc)}">
<meta name="theme-color" content="#101114">
<script>${THEME_HEAD}</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap">
<link rel="stylesheet" href="/app.css?v=${V}">
</head>
<body>
${body}
<footer class="foot"><div class="w">
<p>미국 하원·상원 공시(STOCK Act 거래 보고서)를 그대로 옮긴 기록입니다. 금액은 신고서의 구간이며 정확한 거래액이 아닙니다. 특정 종목을 사거나 팔라고 권하지 않습니다. 중요한 내용은 공시 원문으로 확인해 주세요. 광고·유료 서비스가 없는 비영리 사이트입니다.</p>
<nav><a href="/">홈</a><a href="/recent/">최근 신고</a><a href="/tickers/">종목</a><a href="/about/">안내·출처</a>${THEME_BTN}</nav>
</div></footer>
<script>${THEME_BODY}</script>
</body>
</html>`;
}

// 맨 위 줄: 로고, 상원·하원과 기간 알약, 종목 찾기. p가 없으면(종목·안내 화면) 알약 대신 메뉴를 둔다.
function top(p, c, path) {
  const seg = (items, cur, href) =>
    items.map(([k, l]) => `<a class="pill${k === cur ? ' on" aria-current="true' : ''}" href="${href(k)}">${l}</a>`).join('');
  const mid = p
    ? `${seg([['all', '전체'], ['senate', '상원'], ['house', '하원']], c, (k) => `${path}${q(p, k)}`)}<span class="sep"></span>${seg([['2w', '2주'], ['1m', '1달']], p, (k) => `${path}${q(k, c)}`)}`
    : seg([['/recent/', '최근 신고'], ['/tickers/', '종목']], '', (k) => k);
  return `<header class="top">
<a class="logo" href="/">의회<b>거래기록</b></a>
${mid}<span class="sep"></span>
<form class="find" action="/go/" method="get" role="search"><label class="sr" for="q">종목 기호</label><input id="q" name="q" placeholder="종목 찾기 (예: NVDA)" autocomplete="off" maxlength="10"></form>
${THEME_BTN.replace('class="thm"', 'class="pill thm"')}
</header>`;
}

const stamp = (built) => (built ? `${md(built.slice(0, 10))} ${built.slice(11, 16)} 갱신` : '');
const label = (p) => (p === '2w' ? '최근 2주' : '최근 1달');

// 첫 화면 아래 화면들의 공통 틀: 어두운 머리 + 겹쳐 올라온 흰 판
function sub(nav, h1, lead, inner) {
  return `<div class="dark sub"><div class="w">${nav}<div class="ph"><h1>${h1}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div></div></div>
<div class="w lift"><section class="sheet">${inner}</section></div>`;
}

const mb = (b, s, max) =>
  `<span class="mb" aria-hidden="true"><i class="b" style="width:${((b / max) * 100).toFixed(1)}%"></i><i class="s" style="width:${((s / max) * 100).toFixed(1)}%"></i></span>`;

function rows(list, max, amount) {
  return list
    .map(
      (t) => `<a class="tr" href="/t/${esc(t.t)}/"><b>${esc(t.t)}</b><span>${esc(t.a)}${amount ? ` · ${rangeSum(t.lo, t.hi)}` : ''}</span>${mb(t.b, t.s, max)}<em><i class="up">${t.b}</i> · <i class="dn">${t.s}</i></em></a>`,
    )
    .join('');
}

// 거래 줄을 신고서(신고자·신고일·원문) 단위로 묶는다. summary.json에 filings가 없을 때만 쓴다.
export function groupFilings(list) {
  const m = new Map();
  for (const r of list) {
    const k = `${r.name}|${r.f}|${r.u}`;
    let f = m.get(k);
    if (!f) m.set(k, (f = { name: r.name, ch: r.ch, st: r.st, f: r.f, u: r.u, own: [], tk: [], n: 0, b: 0, s: 0, d: null }));
    f.n += 1;
    f[r.sd === 'buy' ? 'b' : 's'] += 1;
    if (!f.own.includes(r.own)) f.own.push(r.own);
    if (!f.tk.includes(r.t)) f.tk.push(r.t);
    if (r.d != null && (f.d == null || r.d > f.d)) f.d = r.d;
  }
  return [...m.values()];
}

function cards(list) {
  return list
    .map(
      (f) => `<article class="fc"><div class="q">${md(f.f)} 신고<a href="${esc(f.u)}" rel="noopener nofollow" target="_blank">원문 ↗</a></div>
<h3>${esc(f.name)}</h3><div class="m">${CH[f.ch]}${f.st ? ` · ${esc(f.st)}` : ''} · ${f.own.map((o) => OWN[o] || '본인').join('·')} 명의</div>
<div class="tk">${f.tk.slice(0, 6).map((t) => `<a href="/t/${esc(t)}/">${esc(t)}</a>`).join(' · ')}${f.tk.length > 6 ? ` 외 ${f.tk.length - 6}` : ''}</div>
<div class="ft"><span>${f.n}건 <i class="up">매수 ${f.b}</i> <i class="dn">매도 ${f.s}</i></span>${f.d == null ? '' : `<i class="dd${f.d > 45 ? ' l' : ''}">${f.d}일</i>`}</div></article>`,
    )
    .join('');
}

function table(rows, { showTicker = true } = {}) {
  if (!rows.length) return '<p class="empty">이 기간에 신고된 주식 거래가 없습니다.</p>';
  const tr = rows
    .map(
      (r) => `<tr><td><b>${esc(r.name)}</b><small>${CH[r.ch]}${r.st ? ` · ${esc(r.st)}` : ''} · ${OWN[r.own] || '본인'}</small></td>
${showTicker ? `<td class="tk"><a href="/t/${esc(r.t)}/">${esc(r.t)}</a>${r.k === 'option' ? '<small>옵션</small>' : ''}</td>` : ''}
<td class="${r.sd === 'buy' ? 'up' : 'dn'} sd">${SD[r.sd]}</td><td class="n c-am">${range(r.lo, r.hi)}</td><td class="n c-tx">${r.tx && r.f && r.tx.slice(0, 4) !== r.f.slice(0, 4) ? `${r.tx.slice(2, 4)}.` : ''}${md(r.tx)}</td><td class="n">${md(r.f)}</td>
<td class="n dl">${r.d == null ? '—' : `${r.d}일`}</td><td class="c-ln"><a href="${esc(r.u)}" rel="noopener nofollow" target="_blank">원문 ↗</a></td></tr>`,
    )
    .join('');
  return `<div class="tw"><table><thead><tr><th>신고자</th>${showTicker ? '<th>종목</th>' : ''}<th>구분</th><th class="c-am">금액 구간</th><th class="c-tx">거래일</th><th>신고일</th><th>신고까지</th><th class="c-ln"></th></tr></thead><tbody>${tr}</tbody></table></div>`;
}

function pick(sum, p, c) {
  return sum?.[c]?.[p] || null;
}

const noData = (env) =>
  layout(env, { title: '', desc: '', path: '/', body: sub(top(null, null, '/'), '자료를 준비하고 있습니다', '잠시 뒤 다시 열어 주세요.', '') });

export function home(env, sum, p, c) {
  const s = pick(sum, p, c);
  if (!s) return noData(env);
  const lb = label(p);
  const who = c === 'all' ? '미국 의원' : `미국 ${CH[c]} 의원`;
  const fl = (s.filings || groupFilings(s.recent)).slice(0, 8);
  const tk = s.tickers.slice(0, 16);
  const max = Math.max(1, ...tk.map((t) => t.b + t.s));
  const hl = ['7일 안', '14일 안', '21일 안', '30일 안', '45일 안', '45일 넘김'];
  const body = `<div class="dark"><div class="w">
${top(p, c, '/')}
<div class="hero"><div>
<h1>${who} ${num(s.who)}명이<br><em>주식 거래 ${num(s.n)}건</em>을<br>신고했습니다</h1>
<p class="lead">하원 Clerk와 상원 eFD에 올라온 STOCK Act 거래 보고서를 그대로 옮긴 기록입니다.</p>
<div class="sl">${lb}</div>
<ul class="pts"><li>매도 ${num(s.sell)}건, 매수 ${num(s.buy)}건</li><li>상원 ${num(s.senate)}건, 하원 ${num(s.house)}건</li><li>가족 명의 거래 ${num(s.family)}건</li></ul>
<a class="btn" href="/recent/${q(p, c)}">최근 신고 모두 보기</a>
</div>
<section class="panel"><h2>많이 신고된 종목</h2>
${s.tickers.length ? `<div class="tiles">${s.tickers.slice(0, 8).map((t) => `<a class="tile" href="/t/${esc(t.t)}/"><b>${esc(t.t)}</b><span>${esc(t.a)}</span>${mb(t.b, t.s, t.b + t.s)}</a>`).join('')}</div>` : '<p class="empty">이 기간에 신고된 주식 거래가 없습니다.</p>'}
<div class="pn"><span>빨강은 매수, 파랑은 매도 건수입니다</span><i>${esc(stamp(sum.built))}</i></div></section>
</div></div>
<div class="stats w">
<div><span>${lb} 신고된 거래</span><b>${num(s.n)}건</b></div>
<div><span>신고한 의원</span><b>${num(s.who)}명</b></div>
<div><span>거래 뒤 신고까지 평균</span><b>${s.delay ?? '—'}일</b></div>
<div><span>45일 기한을 넘긴 신고</span><b>${num(s.hist[5])}건</b></div>
</div></div>
<div class="w lift"><section class="card"><h2>거래부터 신고까지 <em>평균 ${s.delay ?? '—'}일</em></h2>
<p>법은 거래한 뒤 45일 안에 신고하게 합니다. 그래서 이 화면은 실시간이 아닙니다.</p></section>
<section class="band"><h3>신고까지 걸린 기간별 건수</h3>
<div class="chips">${s.hist.map((v, i) => `<div class="chip${i === 5 ? ' late' : ''}"><b>${num(v)}</b><span>${hl[i]}</span></div>`).join('')}</div></section></div>
${fl.length ? `<section class="w sec"><h2>최근 들어온 <em>신고서</em></h2><div class="rail">${cards(fl)}</div>
<a class="btn dk" href="/recent/${q(p, c)}">거래 한 건씩 보기</a></section>` : ''}
${tk.length ? `<div class="w"><section class="gp"><div><h2><em>종목</em>으로<br>모아 보기</h2>
<p>같은 종목이 여러 번 신고되면 한 줄로 묶습니다. 금액은 신고서의 구간이며 정확한 거래액이 아닙니다. 종이로 낸 보고서 ${num(s.paper)}건은 원문만 셉니다.</p>
<a class="btn dk" href="/tickers/${q(p, c)}">종목 ${s.tickers.length}개 모두 보기</a></div>
<div class="tb">${rows(tk, max)}</div></section></div>` : ''}`;
  return layout(env, {
    title: '',
    desc: `${lb} 미국 상원·하원 의원이 신고한 주식 거래 ${s.n}건(매수 ${s.buy}·매도 ${s.sell})을 공시 그대로 정리했습니다.`,
    path: '/',
    body,
  });
}

export function recent(env, sum, p, c) {
  const s = pick(sum, p, c);
  if (!s) return noData(env);
  const body = sub(top(p, c, '/recent/'), '최근 <em>신고</em>', `${label(p)} · 신고일 순 ${s.recent.length}건 · ${esc(stamp(sum.built))}`, table(s.recent));
  return layout(env, { title: '최근 신고', desc: '미국 의원 주식 거래 신고를 신고일 순으로 봅니다.', path: '/recent/', body });
}

export function tickers(env, sum, p, c) {
  const s = pick(sum, p, c);
  if (!s) return noData(env);
  const max = Math.max(1, ...s.tickers.map((t) => t.b + t.s));
  const body = sub(
    top(p, c, '/tickers/'),
    '<em>종목</em>별 신고',
    `${label(p)} · 많은 순 ${s.tickers.length}개 · 빨강은 매수, 파랑은 매도 건수`,
    s.tickers.length ? `<div class="tb">${rows(s.tickers, max, true)}</div>` : '<p class="empty">이 기간에 신고된 주식 거래가 없습니다.</p>',
  );
  return layout(env, { title: '종목별 신고', desc: '미국 의원이 신고한 주식 거래를 종목별로 모았습니다.', path: '/tickers/', body });
}

export function ticker(env, d) {
  const m = d.m1;
  const tv = `https://www.tradingview.com/symbols/${encodeURIComponent(d.t)}/`;
  const body = `<div class="dark sub"><div class="w">${top(null, null, '/')}
<div class="ph"><h1>${esc(d.t)} <em class="nm">${esc(d.a)}</em></h1><p class="lead">최근 200일 동안 이 종목에 신고된 거래 ${d.rows.length}건입니다. ${esc(md(d.built?.slice(0, 10)))} 갱신</p></div></div>
<div class="stats w">
<div><span>최근 1달 신고</span><b>${num(m.n)}건</b></div>
<div><span>매수</span><b>${num(m.buy)}건</b></div>
<div><span>매도</span><b>${num(m.sell)}건</b></div>
<div><span>신고한 의원</span><b>${num(m.who)}명</b></div>
</div></div>
<div class="w lift"><section class="sheet"><p class="note">주가는 <a href="${tv}" rel="noopener nofollow" target="_blank">TradingView에서 보기 ↗</a></p>
${table(d.rows, { showTicker: false })}</section></div>`;
  return layout(env, { title: `${d.t} 의원 거래 신고`, desc: `${d.t}(${d.a})에 대한 미국 의원 주식 거래 신고 기록입니다.`, path: `/t/${d.t}/`, body });
}

export function about(env) {
  const body = sub(top(null, null, '/'), '안내·<em>출처</em>', '무엇을 어떻게 옮겼는지, 읽을 때 주의할 점을 적었습니다.', `<div class="prose">
<h2>무엇을 보여 주나요</h2>
<p>미국 상원·하원 의원이 STOCK Act에 따라 낸 거래 보고서(Periodic Transaction Report) 가운데 종목 기호가 있는 주식·ETF·옵션의 매수·매도를 신고일 기준으로 모았습니다. 국채·지방채·교환 거래는 숫자에 넣지 않습니다. 정정 보고서는 넣지 않습니다.</p>
<h2>읽을 때 주의할 점</h2>
<p>금액은 신고서에 적힌 구간($1,001–15,000 등)이며 정확한 거래액이 아닙니다. 법은 거래 뒤 최대 45일 안에 신고하게 하므로 이 기록은 실시간이 아닙니다. 종이로 낸 보고서는 스캔 이미지라 표로 옮기지 않고 원문 링크만 셉니다. 배우자·자녀·공동 명의 거래도 의원 이름으로 신고되며, 표에 명의를 함께 적습니다.</p>
<h2>출처</h2>
<p>미국 하원 사무처(Clerk) 공시 <a href="https://disclosures-clerk.house.gov/FinancialDisclosure" rel="noopener">disclosures-clerk.house.gov</a>, 미국 상원 공시 <a href="https://efdsearch.senate.gov/" rel="noopener">efdsearch.senate.gov</a>. 매시간 새 보고서를 받아 옵니다. 주가는 TradingView 링크로만 연결합니다.</p>
<h2>이용 조건</h2>
<p>미국 법(5 U.S.C. §13107)은 이 공시를 상업 목적, 개인 신용 평가, 모금에 쓰는 것을 금지합니다. 이 사이트는 광고·유료 서비스 없이 공개 기록을 그대로 보여 주는 비영리 사이트입니다. 특정 종목이나 의원에 대한 평가·추천을 하지 않습니다.</p></div>`);
  return layout(env, { title: '안내·출처', desc: '자료 출처, 금액 구간과 신고 지연, 이용 조건을 설명합니다.', path: '/about/', body });
}

export function notFound(env) {
  return layout(env, {
    title: '찾을 수 없음',
    desc: '',
    path: '/404',
    body: sub(top(null, null, '/'), '찾는 페이지가 <em>없습니다</em>', '최근 200일 동안 신고되지 않은 종목일 수 있습니다.', '<p class="empty"><a class="btn dk" href="/">홈으로</a></p>'),
  });
}
