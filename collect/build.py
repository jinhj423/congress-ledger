"""모은 보고서 → 화면용 JSON(data/site).

화면에 쓰는 것은 종목 기호가 있는 주식·ETF·옵션의 매수·매도뿐이다(채권·국채·교환 제외).
기간은 신고일 기준(최근 14일·30일). 금액은 신고서 구간의 하한·상한 합계다(정확한 거래액 아님).
"""
import datetime as dt
import os
import re
from collections import defaultdict

from common import save_json

TRADED = ("stock", "etf", "option")
BINS = (7, 14, 21, 30, 45)  # 신고 지연 막대: ~7, ~14, ~21, ~30, ~45, 45+


def short(asset, ticker):
    a = re.sub(r"\s*\(" + re.escape(ticker or "") + r"\)", "", asset or "") if ticker else (asset or "")
    a = re.sub(r"\s*-?\s*(Common Stock|Common Shares|Ordinary Shares|Class [A-C] Common Stock).*$", "", a, flags=re.I)
    a = re.sub(r",?\s+(Inc\.?|Corporation|Corp\.?|Incorporated|Co\.|Ltd\.?|plc)$", "", a.strip(), flags=re.I)
    return a.strip(" ,-") or (ticker or "")


def events(store):
    out = []
    for key, f in store.items():
        for i, t in enumerate(f.get("txs", [])):
            out.append({"id": f"{key}-{i}", "ch": f["ch"], "name": f["name"], "state": f.get("state", ""),
                        "filed": f["filed"], "url": f["url"], **t})
    return out


def delay(e):
    try:
        return (dt.date.fromisoformat(e["filed"]) - dt.date.fromisoformat(e["tx"])).days
    except (TypeError, ValueError):
        return None


def counted(e):
    return e.get("ticker") and e.get("kind") in TRADED and e.get("side") in ("buy", "sell")


def row(e):
    return {"name": e["name"], "ch": e["ch"], "st": e.get("state", ""), "own": e["owner"], "t": e["ticker"],
            "a": short(e.get("asset"), e["ticker"]), "k": e["kind"], "sd": e["side"], "lo": e["lo"], "hi": e["hi"],
            "tx": e["tx"], "f": e["filed"], "d": delay(e), "u": e["url"]}


def filings(w, top=12):
    """거래를 신고서(신고자·신고일·원문) 단위로 묶는다. w는 최신순이어야 한다."""
    out = {}
    for e in w:
        f = out.setdefault((e["name"], e["filed"], e["url"]), {
            "name": e["name"], "ch": e["ch"], "st": e.get("state", ""), "f": e["filed"], "u": e["url"],
            "own": [], "tk": [], "n": 0, "b": 0, "s": 0, "d": None})
        f["n"] += 1
        f["b" if e["side"] == "buy" else "s"] += 1
        if e["owner"] not in f["own"]:
            f["own"].append(e["owner"])
        if e["ticker"] not in f["tk"]:
            f["tk"].append(e["ticker"])
        d = delay(e)
        if d is not None and (f["d"] is None or d > f["d"]):
            f["d"] = d
    return list(out.values())[:top]


def summary(evs, today, days, papers=0, top=50, recent=60):
    since = (dt.date.fromisoformat(today) - dt.timedelta(days=days)).isoformat()
    w = [e for e in evs if counted(e) and e["filed"] and e["filed"] > since]
    tk = defaultdict(lambda: {"b": 0, "s": 0, "lo": 0, "hi": 0, "who": set(), "a": ""})
    hist = [0] * (len(BINS) + 1)
    ds = []
    for e in w:
        t = tk[e["ticker"]]
        t["b" if e["side"] == "buy" else "s"] += 1
        t["lo"] += e["lo"] or 0
        t["hi"] += e["hi"] or e["lo"] or 0
        t["who"].add(e["name"])
        t["a"] = t["a"] or short(e.get("asset"), e["ticker"])
        d = delay(e)
        if d is not None and d >= 0:
            ds.append(d)
            hist[next((i for i, b in enumerate(BINS) if d <= b), len(BINS))] += 1
    tickers = sorted(({"t": k, "a": v["a"], "b": v["b"], "s": v["s"], "lo": v["lo"], "hi": v["hi"], "who": len(v["who"])}
                      for k, v in tk.items()), key=lambda x: (-(x["b"] + x["s"]), -x["hi"], x["t"]))
    w.sort(key=lambda e: (e["filed"], e["tx"] or ""), reverse=True)
    return {"days": days, "n": len(w), "buy": sum(e["side"] == "buy" for e in w),
            "sell": sum(e["side"] == "sell" for e in w),
            "senate": sum(e["ch"] == "senate" for e in w), "house": sum(e["ch"] == "house" for e in w),
            "family": sum(e["owner"] != "self" for e in w), "who": len({e["name"] for e in w}),
            "paper": papers, "delay": round(sum(ds) / len(ds)) if ds else None, "hist": hist,
            "tickers": tickers[:top], "recent": [row(e) for e in w[:recent]], "filings": filings(w)}


def papers_in(store, today, days, ch=None):
    since = (dt.date.fromisoformat(today) - dt.timedelta(days=days)).isoformat()
    return sum(1 for f in store.values() if f.get("paper") and (f["filed"] or "") > since and (ch is None or f["ch"] == ch))


def build_site(store, site, today, built):
    evs = events(store)
    out = {"built": built}
    for ch in ("all", "senate", "house"):
        sub = evs if ch == "all" else [e for e in evs if e["ch"] == ch]
        c = None if ch == "all" else ch
        out[ch] = {"1m": summary(sub, today, 30, papers_in(store, today, 30, c)),
                   "2w": summary(sub, today, 14, papers_in(store, today, 14, c))}
    save_json(os.path.join(site, "summary.json"), out)

    by = defaultdict(list)
    for e in evs:
        if counted(e):
            by[e["ticker"]].append(e)
    index = []
    for t, es in by.items():
        es.sort(key=lambda e: (e["filed"], e["tx"] or ""), reverse=True)
        name = short(es[0].get("asset"), t)
        s = summary(es, today, 30, recent=0)
        save_json(os.path.join(site, "t", f"{re.sub(r'[^A-Z0-9.-]', '', t)}.json"),
                  {"t": t, "a": name, "built": built, "m1": {k: s[k] for k in ("n", "buy", "sell", "who", "delay")},
                   "rows": [row(e) for e in es]})
        index.append([t, name, len(es)])
    index.sort(key=lambda x: (-x[2], x[0]))
    save_json(os.path.join(site, "tickers.json"), index)
    return len(evs)
