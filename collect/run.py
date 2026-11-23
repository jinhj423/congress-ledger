"""수집 한 번: 하원 + 상원 → data/filings.json, 그다음 data/site 화면 자료.

DATA_DIR 아래
  filings.json   보고서 id → {ch, name, state, filed, url, paper, txs}
  site/          Worker가 읽는 화면 자료
  runs.log       최근 실행 기록
"""
import datetime as dt
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import build  # noqa: E402
import house  # noqa: E402
import senate  # noqa: E402
from common import load_json, now_kst, save_json, session  # noqa: E402

DATA = os.environ.get("DATA_DIR", "data")
KEEP_DAYS = 200
LOG = []


def log(msg):
    line = f"[{now_kst():%m-%d %H:%M:%S}] {msg}"
    LOG.append(line)
    print(line, flush=True)


def main():
    t0 = time.time()
    budget = float(os.environ.get("MAX_SECONDS", "600"))
    path = os.path.join(DATA, "filings.json")
    store = load_json(path, {})
    keep_from = (dt.date.today() - dt.timedelta(days=KEEP_DAYS)).isoformat()
    store = {k: v for k, v in store.items() if (v.get("filed") or "") >= keep_from}
    more = False
    for name, mod, share in (("하원", house, 0.55), ("상원", senate, 1.0)):
        deadline = t0 + budget * share
        try:
            n, cut = mod.collect(session(), store, deadline, log, keep_from)
            more |= cut
            log(f"{name}: 새 보고서 {n}건{' (시간 다 씀, 다음 회차에 이어서)' if cut else ''}")
        except Exception as e:  # 한쪽이 막혀도 나머지는 올린다
            log(f"{name}: 중단 {type(e).__name__}: {e}")
        save_json(path, store)
    flag = os.path.join(DATA, ".more")
    if more:
        open(flag, "w").close()
    elif os.path.exists(flag):
        os.remove(flag)
    now = now_kst()
    n = build.build_site(store, os.path.join(DATA, "site"), now.date().isoformat(), now.isoformat(timespec="minutes"))
    log(f"화면 자료: 보고서 {len(store)}건, 거래 {n}건 ({time.time() - t0:.0f}초)")
    lp = os.path.join(DATA, "runs.log")
    old = open(lp, encoding="utf-8").read().splitlines() if os.path.exists(lp) else []
    with open(lp, "w", encoding="utf-8") as f:
        f.write("\n".join((old + LOG)[-400:]) + "\n")


if __name__ == "__main__":
    main()
