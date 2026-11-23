"""하원 Clerk 공시: 연도별 색인 zip(XML) → 거래 보고서(PTR) PDF 글자 읽기.

출처: https://disclosures-clerk.house.gov/FinancialDisclosure (미국 정부 공개 자료)
- 색인: public_disc/financial-pdfs/<연도>FD.zip 안 <연도>FD.xml, FilingType P = 거래 보고서
- 보고서: public_disc/ptr-pdfs/<연도>/<DocID>.pdf
- DocID가 2로 시작하면 전자 제출(글자 PDF), 9로 시작하면 종이 제출 스캔(글자 없음 → 원문 링크만)
"""
import datetime as dt
import io
import re
import time
import zipfile

from common import get, parse_amount, parse_date, side_of

BASE = "https://disclosures-clerk.house.gov/public_disc"
OWNER = {"SP": "spouse", "JT": "joint", "DC": "child"}
KIND = {"ST": "stock", "OP": "option", "EF": "etf"}

HEADER = re.compile(r"^(ID Owner Asset|Type Date|\$200\?|Filing ID #|Gains >)")
TX_RE = re.compile(r"^(?:\d{6,}\s+)?(?:(SP|JT|DC)\s+)?(.*?)\s+(S \(partial\)|P|S|E)\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s*(.*)$")


PV = 2  # 파서 버전: 읽는 방법을 고치면 올린다(저장된 보고서를 다시 읽음)


def pdf_url(year, doc):
    return f"{BASE}/ptr-pdfs/{year}/{doc}.pdf"


def parse_index(xml):
    """색인 XML → 거래 보고서 목록(파일에 적힌 순서)."""
    out = []
    for m in re.findall(r"<Member>(.*?)</Member>", xml, re.S):
        f = {k: (re.search(rf"<{k}>(.*?)</{k}>", m, re.S) or [None, ""])[1].strip() for k in
             ("First", "Last", "Suffix", "FilingType", "StateDst", "Year", "FilingDate", "DocID")}
        if f["FilingType"] != "P" or not f["DocID"]:
            continue
        name = " ".join(x for x in (f["First"], f["Last"], f["Suffix"]) if x)
        out.append({"doc": f["DocID"], "year": f["Year"], "name": name, "state": f["StateDst"][:2],
                    "dist": f["StateDst"], "filed": parse_date(f["FilingDate"]), "paper": f["DocID"].startswith("9")})
    return out


def parse_text(text):
    """PDF 글자 → 거래 목록."""
    lines = [re.sub(r"\s+", " ", ln.replace("\x00", "")).strip() for ln in text.splitlines()]
    txs, cur = [], None

    def close():
        if not cur:
            return
        asset = cur.pop("_asset")
        tk = re.findall(r"\(([A-Z][A-Z0-9.\-]{0,9})\)", asset)
        code = re.findall(r"\[([A-Z]{2})\]", asset)
        cur["ticker"] = tk[-1] if tk else None
        # 자산 종류 기호가 없으면(쪽이 바뀌며 빠진 경우) 종목 기호가 있을 때 주식으로 본다
        cur["kind"] = KIND.get(code[-1], "other") if code else ("stock" if tk else "other")
        cur["asset"] = re.sub(r"\s*\[[A-Z]{2}\]", "", asset).strip()
        amt = cur.pop("_amt")
        if parse_amount(amt)[0] is None:  # 금액이 다음 줄로 밀린 경우
            m = re.search(r"((?:over\s+)?\$[\d,]+(?:\s*-\s*\$[\d,]+)?)\s*$", cur["asset"], re.I)
            if m:
                amt += " " + m.group(1)
                cur["asset"] = cur["asset"][: m.start()].strip()
        cur["lo"], cur["hi"] = parse_amount(amt)
        txs.append(cur)

    for ln in lines:
        m = TX_RE.match(ln)
        if m and side_of(m.group(3)):
            close()
            cur = {"tx": parse_date(m.group(4)), "owner": OWNER.get(m.group(1) or "", "self"),
                   "side": side_of(m.group(3)), "_asset": m.group(2), "_amt": m.group(6)}
            continue
        if cur is None or HEADER.match(ln):
            continue  # 쪽마다 반복되는 표 머리는 건너뛴다
        if ":" in ln or ln.startswith("*") or not ln:
            close()
            cur = None
            continue
        tail = re.search(r"\s*(\$[\d,]+)$", ln)
        if tail and cur["_amt"].rstrip().endswith("-"):
            cur["_amt"] += " " + tail.group(1)
            ln = ln[: tail.start()]
        cur["_asset"] += " " + ln
    close()
    return txs


def parse_pdf(data):
    import pdfplumber
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    return parse_text(text)


def collect(s, store, deadline, log, keep_from):
    """새 보고서를 받아 store(filings dict)에 넣는다. deadline(time.time 기준)을 넘기면 멈춘다."""
    today = dt.date.today()
    years = [today.year] + ([today.year - 1] if today.month <= 2 else [])
    new = 0
    for y in years:
        r = get(s, f"{BASE}/financial-pdfs/{y}FD.zip")
        if r is None:
            log(f"하원 {y}: 색인 없음")
            continue
        z = zipfile.ZipFile(io.BytesIO(r.content))
        xml = z.read(f"{y}FD.xml").decode("utf-8-sig", "replace")
        rows = [f for f in parse_index(xml) if f["filed"] and f["filed"] >= keep_from]
        rows.sort(key=lambda f: f["filed"], reverse=True)  # 최근 것부터
        log(f"하원 {y}: 기간 안 거래 보고서 {len(rows)}건")
        for f in rows:
            key = "h" + f["doc"]
            if store.get(key, {}).get("pv") == PV:
                continue
            if time.time() > deadline:
                return new, True
            item = {"ch": "house", "name": f["name"], "state": f["state"], "dist": f["dist"], "filed": f["filed"],
                    "url": pdf_url(f["year"], f["doc"]), "paper": f["paper"], "txs": [], "pv": PV}
            if not f["paper"]:
                p = get(s, item["url"])
                if p is None:
                    continue
                try:
                    item["txs"] = parse_pdf(p.content)
                except Exception as e:  # 읽지 못한 PDF는 원문 링크만 남긴다
                    log(f"하원 {f['doc']}: PDF 읽기 실패 {type(e).__name__}")
                    item["paper"] = True
                if not item["txs"]:
                    item["paper"] = True
                time.sleep(0.4)
            store[key] = item
            new += 1
    return new, False
