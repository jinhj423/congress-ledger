"""공용: HTTP, 시간, JSON 파일, 금액·날짜 읽기."""
import datetime as dt
import json
import os
import re
import time

import requests

KST = dt.timezone(dt.timedelta(hours=9))
# 공시 사이트에 보내는 이름. 연락처가 필요하면 Secret USER_AGENT로 바꾼다.
UA = os.environ.get("USER_AGENT") or "congress-ledger (non-commercial public record viewer)"


def now_kst():
    return dt.datetime.now(KST)


def session():
    s = requests.Session()
    s.headers["User-Agent"] = UA
    return s


def get(s, url, tries=3, **kw):
    """GET. 404면 None. 잠깐 막히면 다시 시도."""
    for i in range(tries):
        try:
            r = s.get(url, timeout=60, **kw)
            if r.status_code == 404:
                return None
            if r.status_code in (403, 429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(4 * (i + 1))
                continue
            r.raise_for_status()
            return r
        except (requests.ConnectionError, requests.Timeout):
            if i < tries - 1:
                time.sleep(4 * (i + 1))
                continue
            raise


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def parse_amount(s):
    """'$1,001 - $15,000' -> (1001, 15000), 'Over $50,000,000' -> (50000001, None). 신고서 금액은 구간이다."""
    s = (s or "").replace(" ", " ")
    nums = [int(x.replace(",", "")) for x in re.findall(r"\$\s*([\d,]+)", s)]
    if not nums:
        return None, None
    if re.search(r"over", s, re.I):
        return nums[0] + 1, None
    if len(nums) == 1:
        return nums[0], nums[0]
    return nums[0], nums[1]


def parse_date(s):
    """'1/15/2026' -> '2026-01-15'."""
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", s or "")
    if not m:
        return None
    try:
        return dt.date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat()
    except ValueError:
        return None


SIDE = {"P": "buy", "PURCHASE": "buy", "S": "sell", "S (PARTIAL)": "sell", "SALE": "sell",
        "SALE (FULL)": "sell", "SALE (PARTIAL)": "sell", "E": "exchange", "EXCHANGE": "exchange"}


def side_of(s):
    return SIDE.get(re.sub(r"\s+", " ", (s or "").strip().upper()))
