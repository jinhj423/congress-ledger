import test from 'node:test';
import assert from 'node:assert/strict';
import { groupFilings, home, recent, tickers, ticker, about, notFound } from '../src/pages.js';

const r = (o) => ({ name: 'A', ch: 'house', st: 'CA', own: 'self', t: 'NVDA', a: 'NVIDIA', k: 'stock', sd: 'buy', lo: 1001, hi: 15000, tx: '2026-11-01', f: '2026-11-20', d: 19, u: 'https://x/u1', ...o });
const rec = [r(), r({ t: 'MSFT', sd: 'sell', own: 'spouse', d: 80 }), r({ name: 'B<', u: 'https://x/u2', f: '2026-11-19' })];
const per = { days: 30, n: 3, buy: 2, sell: 1, senate: 0, house: 3, family: 1, who: 2, paper: 0, delay: 39, hist: [0, 0, 2, 0, 0, 1],
  tickers: [{ t: 'NVDA', a: 'NVIDIA', b: 2, s: 0, lo: 2002, hi: 30000, who: 2 }, { t: 'MSFT', a: 'Microsoft', b: 0, s: 1, lo: 1001, hi: 15000, who: 1 }], recent: rec };
const sum = { built: '2026-11-25T09:50:00Z', all: { '1m': per, '2w': per }, house: { '1m': per, '2w': per }, senate: { '1m': { ...per, n: 0, who: 0, tickers: [], recent: [], delay: null, hist: [0, 0, 0, 0, 0, 0] } } };

test('거래 줄을 신고서 단위로 묶는다', () => {
  const g = groupFilings(rec);
  assert.equal(g.length, 2);
  assert.deepEqual([g[0].n, g[0].b, g[0].s, g[0].d, g[0].tk, g[0].own], [2, 1, 1, 80, ['NVDA', 'MSFT'], ['self', 'spouse']]);
});

test('첫 화면: 숫자 문장, 신고서 묶음, 이스케이프', () => {
  const h = home({}, sum, '1m', 'all');
  assert.match(h, /미국 의원 2명이<br><em>주식 거래 3건<\/em>/);
  assert.equal(h.match(/<article class="fc">/g).length, 2);
  assert.ok(h.includes('B&lt;') && !h.includes('B<<'));
  assert.ok(h.includes('class="dd l">80일'));
  assert.match(home({}, sum, '2w', 'house'), /미국 하원 의원[\s\S]*href="\/recent\/\?p=2w&c=house"/);
});

test('빈 기간과 나머지 화면도 그려진다', () => {
  assert.match(home({}, sum, '1m', 'senate'), /이 기간에 신고된 주식 거래가 없습니다/);
  assert.match(home({}, {}, '1m', 'all'), /자료를 준비하고 있습니다/);
  for (const h of [recent({}, sum, '1m', 'all'), tickers({}, sum, '1m', 'all'), about({}), notFound({}),
    ticker({}, { t: 'NVDA', a: 'NVIDIA', built: '2026-11-25T09:50:00Z', m1: { n: 2, buy: 2, sell: 0, who: 2 }, rows: rec })]) {
    assert.ok(h.startsWith('<!doctype html>') && h.includes('/app.css?v=2') && !h.includes('undefined'));
  }
});

test('금지 표현이 화면에 없다', () => {
  const all = home({}, sum, '1m', 'all') + about({});
  for (const w of ['목표가', '매수 신호', '수익 보장', '랭킹']) assert.ok(!all.includes(w), w);
});
