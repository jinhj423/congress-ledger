import { about, home, notFound, recent, ticker, tickers } from './pages.js';

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };

// 화면 자료는 data 브랜치(GitHub Actions가 매시간 갱신)에서 읽는다
async function data(env, path) {
  const r = await fetch(`${env.DATA_BASE}/${path}`, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

const page = (html, status = 200) => new Response(html, { status, headers: HTML });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const e = { ...env, ORIGIN: url.origin };
    if (p.length > 1 && !p.endsWith('/') && !p.includes('.')) return Response.redirect(`${url.origin}${p}/${url.search}`, 301);

    const per = url.searchParams.get('p') === '2w' ? '2w' : '1m';
    const c = ['senate', 'house'].includes(url.searchParams.get('c')) ? url.searchParams.get('c') : 'all';
    if (p === '/') return page(home(e, await data(env, 'summary.json'), per, c));
    if (p === '/recent/') return page(recent(e, await data(env, 'summary.json'), per, c));
    if (p === '/tickers/') return page(tickers(e, await data(env, 'summary.json'), per, c));
    if (p === '/about/') return page(about(e));
    if (p === '/go/') {
      const t = (url.searchParams.get('q') || '').toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 10);
      return Response.redirect(t ? `${url.origin}/t/${t}/` : `${url.origin}/`, 302);
    }
    const m = p.match(/^\/t\/([A-Za-z0-9.-]{1,10})\/$/);
    if (m) {
      const t = m[1].toUpperCase();
      if (t !== m[1]) return Response.redirect(`${url.origin}/t/${t}/`, 301);
      const d = await data(env, `t/${t}.json`);
      return d ? page(ticker(e, d)) : page(notFound(e), 404);
    }
    if (p === '/sitemap.xml') {
      const idx = (await data(env, 'tickers.json')) || [];
      const urls = ['/', '/recent/', '/tickers/', '/about/', ...idx.map(([t]) => `/t/${t}/`)];
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${url.origin}${u}</loc></url>`).join('')}</urlset>`,
        { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } },
      );
    }
    if (p === '/robots.txt') {
      return new Response(`User-agent: *\nAllow: /\nDisallow: /go/\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
    }
    return page(notFound(e), 404);
  },
};
