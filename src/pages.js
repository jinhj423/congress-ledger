// 화면 HTML. 모든 동적 문자열은 esc()를 거친다.
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SITE = '의회 거래 기록';
const V = 1; // app.css 캐시 버전: 화면을 고치면 올린다

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
<meta name="theme-color" content="#F2F3F5">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/app.css?v=${V}">
</head>
<body>
<div class="w">
${body}
<footer class="foot">
<p>미국 하원·상원 공시(STOCK Act 거래 보고서)를 그대로 옮긴 기록입니다. 금액은 신고서의 구간이며 정확한 거래액이 아닙니다. 특정 종목을 사거나 팔라고 권하지 않습니다. 중요한 내용은 공시 원문으로 확인해 주세요. 광고·유료 서비스가 없는 비영리 사이트입니다.</p>
<nav><a href="/">홈</a><a href="/recent/">최근 신고</a><a href="/tickers/">종목</a><a href="/about/">안내·출처</a></nav>
</footer>
</div>
</body>
</html>`;
}

function top(env, built, p, c, path) {
  const seg = (items, cur, href) =>
    `<div class="seg">${items.map(([k, l]) => `<a href="${href(k)}"${k === cur ? ' class="on" aria-current="true"' : ''}>${l}</a>`).join('')}</div>`;
  const when = built ? `${md(built.slice(0, 10))} ${built.slice(11, 16)} 갱신` : '';
  return `<header class="top">
<a class="logo" href="/">${SITE}<small>${esc(when)}</small></a>
<form class="find" action="/go/" method="get" role="search"><label class="sr" for="q">종목 기호</label><input id="q" name="q" placeholder="종목 기호 (예: NVDA)" autocomplete="off" maxlength="10"></form>
${seg([['all', '전체'], ['senate', '상원'], ['house', '하원']], c, (k) => `${path}${q(p, k)}`)}
${seg([['2w', '2주'], ['1m', '1달']], p, (k) => `${path}${q(k, c)}`)}
</header>`;
}

function bars(list, max) {
  return list
    .map(
      (t) => `<li><a class="tk" href="/t/${esc(t.t)}/">${esc(t.t)}</a><span class="nm">${esc(t.a)}</span><span class="n"><em class="up">${t.b}</em> / <em class="dn">${t.s}</em></span>
<span class="bar" aria-hidden="true"><i class="b" style="width:${((t.b / max) * 100).toFixed(1)}%"></i><i class="s" style="width:${((t.s / max) * 100).toFixed(1)}%"></i></span><span class="am">${rangeSum(t.lo, t.hi)}</span></li>`,
    )
    .join('');
}

function table(rows, { showTicker = true } = {}) {
  if (!rows.length) return '<p class="empty">이 기간에 신고된 주식 거래가 없습니다.</p>';
  const tr = rows
    .map(
      (r) => `<tr><td><b>${esc(r.name)}</b><small>${CH[r.ch]}${r.st ? ` · ${esc(r.st)}` : ''} · ${OWN[r.own] || '본인'}</small></td>
${showTicker ? `<td class="tk"><a href="/t/${esc(r.t)}/">${esc(r.t)}</a>${r.k === 'option' ? '<small>옵션</small>' : ''}</td>` : ''}
<td class="${r.sd === 'buy' ? 'up' : 'dn'} sd">${SD[r.sd]}</td><td class="n c-am">${range(r.lo, r.hi)}</td><td class="n c-tx">${md(r.tx)}</td><td class="n">${md(r.f)}</td>
<td class="n dl">${r.d == null ? '—' : `${r.d}일`}</td><td class="c-ln"><a href="${esc(r.u)}" rel="noopener nofollow" target="_blank">원문 ↗</a></td></tr>`,
    )
    .join('');
  return `<div class="tw"><table><thead><tr><th>신고자</th>${showTicker ? '<th>종목</th>' : ''}<th>구분</th><th class="c-am">금액 구간</th><th class="c-tx">거래일</th><th>신고일</th><th>지연</th><th class="c-ln"></th></tr></thead><tbody>${tr}</tbody></table></div>`;
}

function pick(sum, p, c) {
  return sum?.[c]?.[p] || null;
}

const noData = (env) =>
  layout(env, { title: '', desc: '', path: '/', body: '<p class="empty big">자료를 준비하고 있습니다. 잠시 뒤 다시 열어 주세요.</p>' });

export function home(env, sum, p, c) {
  const s = pick(sum, p, c);
  if (!s) return noData(env);
  const label = p === '2w' ? '최근 2주' : '최근 1달';
  const max = Math.max(1, ...s.tickers.slice(0, 12).map((t) => t.b + t.s));
  const hmax = Math.max(1, ...s.hist);
  const hl = ['~7일', '~14', '~21', '~30', '~45', '45+'];
  const body = `${top(env, sum.built, p, c, '/')}
<h1 class="sr">${SITE}: ${label} 미국 의원 주식 거래 신고</h1>
<div class="band">
<div class="st"><p>${label} 신고</p><div>${num(s.n)}<small>건</small></div></div>
<div class="st"><p>매수</p><div class="up">${num(s.buy)}<small>건</small></div></div>
<div class="st"><p>매도</p><div class="dn">${num(s.sell)}<small>건</small></div></div>
<div class="st"><p>평균 신고 지연</p><div>${s.delay ?? '—'}<small>일</small></div></div>
</div>
<div class="cols">
<section class="card"><h2>많이 신고된 종목<small>매수 / 매도</small></h2><ul class="tks">${bars(s.tickers.slice(0, 12), max)}</ul>
<a class="more" href="/tickers/${q(p, c)}">종목 ${s.tickers.length}개 모두 보기 →</a></section>
<section class="card"><h2>최근 신고<small>신고일 순</small></h2>${table(s.recent.slice(0, 12))}
<a class="more" href="/recent/${q(p, c)}">최근 신고 ${s.recent.length}건 모두 보기 →</a></section>
<section class="card side"><h2>신고 지연<small>거래일→신고일</small></h2>
<div class="hist">${s.hist.map((v) => `<i style="height:${Math.max(2, (v / hmax) * 100).toFixed(0)}%" title="${v}건"></i>`).join('')}</div>
<div class="hl">${hl.map((x) => `<span>${x}</span>`).join('')}</div>
<div class="kv"><div><span>상원</span><b>${num(s.senate)}건</b></div><div><span>하원</span><b>${num(s.house)}건</b></div>
<div><span>배우자·자녀·공동 명의</span><b>${num(s.family)}건</b></div><div><span>종이 제출(원문만)</span><b>${num(s.paper)}건</b></div>
<div><span>신고자 수</span><b>${num(s.who)}명</b></div></div>
<p class="note">법은 거래 뒤 45일 안에 신고하게 합니다. 그래서 이 화면은 실시간이 아닙니다.</p></section>
</div>`;
  return layout(env, {
    title: '',
    desc: `${label} 미국 상원·하원 의원이 신고한 주식 거래 ${s.n}건(매수 ${s.buy}·매도 ${s.sell})을 공시 그대로 정리했습니다.`,
    path: '/',
    body,
  });
}

export function recent(env, sum, p, c) {
  const s = pick(sum, p, c);
  if (!s) return noData(env);
  const body = `${top(env, sum.built, p, c, '/recent/')}
<section class="card wide"><h1>최근 신고 <small>${p === '2w' ? '최근 2주' : '최근 1달'} · 신고일 순 ${s.recent.length}건</small></h1>${table(s.recent)}</section>`;
  return layout(env, { title: '최근 신고', desc: '미국 의원 주식 거래 신고를 신고일 순으로 봅니다.', path: '/recent/', body });
}

export function tickers(env, sum, p, c) {
  const s = pick(sum, p, c);
  if (!s) return noData(env);
  const max = Math.max(1, ...s.tickers.map((t) => t.b + t.s));
  const body = `${top(env, sum.built, p, c, '/tickers/')}
<section class="card wide"><h1>종목별 신고 <small>${p === '2w' ? '최근 2주' : '최근 1달'} · 많은 순 ${s.tickers.length}개</small></h1><ul class="tks">${bars(s.tickers, max)}</ul></section>`;
  return layout(env, { title: '종목별 신고', desc: '미국 의원이 신고한 주식 거래를 종목별로 모았습니다.', path: '/tickers/', body });
}

export function ticker(env, d) {
  const m = d.m1;
  const tv = `https://www.tradingview.com/symbols/${encodeURIComponent(d.t)}/`;
  const body = `<header class="top"><a class="logo" href="/">${SITE}<small>${esc(md(d.built?.slice(0, 10)))} 갱신</small></a></header>
<section class="card wide"><h1>${esc(d.t)} <small>${esc(d.a)}</small></h1>
<div class="band in"><div class="st"><p>최근 1달 신고</p><div>${num(m.n)}<small>건</small></div></div>
<div class="st"><p>매수</p><div class="up">${num(m.buy)}<small>건</small></div></div>
<div class="st"><p>매도</p><div class="dn">${num(m.sell)}<small>건</small></div></div>
<div class="st"><p>신고자</p><div>${num(m.who)}<small>명</small></div></div></div>
<p class="note">최근 200일 동안 이 종목에 신고된 거래 ${d.rows.length}건입니다. 주가는 <a href="${tv}" rel="noopener nofollow" target="_blank">TradingView에서 보기 ↗</a></p>
${table(d.rows, { showTicker: false })}</section>`;
  return layout(env, { title: `${d.t} 의원 거래 신고`, desc: `${d.t}(${d.a})에 대한 미국 의원 주식 거래 신고 기록입니다.`, path: `/t/${d.t}/`, body });
}

export function about(env) {
  const body = `<header class="top"><a class="logo" href="/">${SITE}</a></header>
<section class="card wide prose"><h1>안내·출처</h1>
<h2>무엇을 보여 주나요</h2>
<p>미국 상원·하원 의원이 STOCK Act에 따라 낸 거래 보고서(Periodic Transaction Report) 가운데 종목 기호가 있는 주식·ETF·옵션의 매수·매도를 신고일 기준으로 모았습니다. 국채·지방채·교환 거래는 숫자에 넣지 않습니다. 정정 보고서는 넣지 않습니다.</p>
<h2>읽을 때 주의할 점</h2>
<p>금액은 신고서에 적힌 구간($1,001–15,000 등)이며 정확한 거래액이 아닙니다. 법은 거래 뒤 최대 45일 안에 신고하게 하므로 이 기록은 실시간이 아닙니다. 종이로 낸 보고서는 스캔 이미지라 표로 옮기지 않고 원문 링크만 셉니다. 배우자·자녀·공동 명의 거래도 의원 이름으로 신고되며, 표에 명의를 함께 적습니다.</p>
<h2>출처</h2>
<p>미국 하원 사무처(Clerk) 공시 <a href="https://disclosures-clerk.house.gov/FinancialDisclosure" rel="noopener">disclosures-clerk.house.gov</a>, 미국 상원 공시 <a href="https://efdsearch.senate.gov/" rel="noopener">efdsearch.senate.gov</a>. 매시간 새 보고서를 받아 옵니다. 주가는 TradingView 링크로만 연결합니다.</p>
<h2>이용 조건</h2>
<p>미국 법(5 U.S.C. §13107)은 이 공시를 상업 목적, 개인 신용 평가, 모금에 쓰는 것을 금지합니다. 이 사이트는 광고·유료 서비스 없이 공개 기록을 그대로 보여 주는 비영리 사이트입니다. 특정 종목이나 의원에 대한 평가·추천을 하지 않습니다.</p></section>`;
  return layout(env, { title: '안내·출처', desc: '자료 출처, 금액 구간과 신고 지연, 이용 조건을 설명합니다.', path: '/about/', body });
}

export function notFound(env) {
  return layout(env, {
    title: '찾을 수 없음',
    desc: '',
    path: '/404',
    body: `<header class="top"><a class="logo" href="/">${SITE}</a></header><p class="empty big">찾는 페이지가 없습니다. 최근 200일 동안 신고되지 않은 종목일 수 있습니다. <a href="/">홈으로</a></p>`,
  });
}
