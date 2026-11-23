"""상원 eFD 공시: 이용 조건 동의 → 거래 보고서(PTR) 검색 → 보고서 HTML 표 읽기.

출처: https://efdsearch.senate.gov (미국 정부 공개 자료)
검색 전에 5 U.S.C. §13107 금지 용도(상업 목적 등)를 이해했다는 동의를 받는다. 이 사이트는 비영리 기록용이다.
전자 제출은 /search/view/ptr/<id>/ (HTML 표), 종이 제출은 /search/view/paper/<id>/ (스캔 이미지 → 원문 링크만).
"""
import datetime as dt
import html
import re
import time

from common import get, parse_amount, parse_date, side_of

BASE = "https://efdsearch.senate.gov"
OWNER = {"SELF": "self", "SPOUSE": "spouse", "JOINT": "joint", "CHILD": "child", "DEPENDENT CHILD": "child"}
KIND = {"STOCK": "stock", "STOCK OPTION": "option", "OTHER SECURITIES": "other"}


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def parse_search(j):
    out = []
    for row in j.get("data", []):
        m = re.search(r'href="(/search/view/(ptr|paper)/([^/"]+)/)"', row[3])
        if not m or "Amendment" in row[3]:
            continue  # 정정 보고는 뺀다(큰손일지와 같은 기준)
        nm = re.match(r"([^,]+),\s*([^(]+)", row[2])
        name = f"{nm.group(2).strip()} {nm.group(1).strip()}" if nm else f"{row[0]} {row[1]}"
        out.append({"id": m.group(3), "name": name, "filed": parse_date(row[4]),
                    "paper": m.group(2) == "paper", "url": BASE + m.group(1)})
    return out


def parse_ptr(page):
    m = re.search(r"<tbody>(.*?)</tbody>", page, re.S)
    if not m:
        return []
    out = []
    for tr in re.findall(r"<tr>(.*?)</tr>", m.group(1), re.S):
        td = [clean(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if len(td) < 8:
            continue
        lo, hi = parse_amount(td[7])
        tk = td[3] if re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,9}", td[3]) else None
        out.append({"tx": parse_date(td[1]), "owner": OWNER.get(td[2].upper(), "self"), "ticker": tk,
                    "asset": td[4], "kind": KIND.get(td[5].upper(), "other"), "side": side_of(td[6]),
                    "lo": lo, "hi": hi})
    return out


def login(s):
    r = get(s, BASE + "/search/home/")
    tok = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r.text).group(1)
    s.post(BASE + "/search/home/", data={"prohibition_agreement": "1", "csrfmiddlewaretoken": tok},
           headers={"Referer": BASE + "/search/home/"}, timeout=60).raise_for_status()


def search(s, start):
    csrf = s.cookies.get("csrftoken")
    rows, off = [], 0
    while True:
        r = s.post(BASE + "/search/report/data/", timeout=60, headers={"Referer": BASE + "/search/", "X-CSRFToken": csrf},
                   data={"start": str(off), "length": "100", "report_types": "[11]", "filer_types": "[]",
                         "submitted_start_date": start.strftime("%m/%d/%Y 00:00:00"), "submitted_end_date": "",
                         "candidate_state": "", "senator_state": "", "office_id": "", "first_name": "",
                         "last_name": "", "csrfmiddlewaretoken": csrf})
        r.raise_for_status()
        j = r.json()
        rows += parse_search(j)
        off += 100
        if off >= j.get("recordsFiltered", 0):
            return rows


def collect(s, store, deadline, log, keep_from):
    login(s)
    rows = search(s, dt.date.fromisoformat(keep_from))
    rows.sort(key=lambda f: f["filed"] or "", reverse=True)
    log(f"상원: 기간 안 거래 보고서 {len(rows)}건")
    new = 0
    for f in rows:
        key = "s" + f["id"]
        if key in store:
            continue
        if time.time() > deadline:
            return new, True
        item = {"ch": "senate", "name": f["name"], "state": "", "filed": f["filed"], "url": f["url"],
                "paper": f["paper"], "txs": []}
        if not f["paper"]:
            p = get(s, f["url"], headers={"Referer": BASE + "/search/"})
            if p is None:
                continue
            item["txs"] = parse_ptr(p.text)
            if not item["txs"]:
                item["paper"] = True
            time.sleep(0.4)
        store[key] = item
        new += 1
    return new, False
