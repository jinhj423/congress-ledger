"""수집 가능성 점검: 하원 색인 zip·PTR PDF, 상원 eFD 동의·검색·PTR HTML."""
# 재실행: 저장소 공개 전환 뒤
import io, re, sys, zipfile, datetime as dt, requests, os
UA = os.environ.get("UA", "congress-ledger probe (non-commercial)")
S = requests.Session(); S.headers["User-Agent"] = UA
os.makedirs("out", exist_ok=True)
y = dt.date.today().year
print("== HOUSE ==")
r = S.get(f"https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{y}FD.zip", timeout=60)
print("zip", r.status_code, len(r.content))
z = zipfile.ZipFile(io.BytesIO(r.content)); print(z.namelist())
xml = z.read(f"{y}FD.xml").decode("utf-8", "replace"); open("out/house.xml","w").write(xml)
ptr = re.findall(r"<Member>.*?</Member>", xml, re.S)
ptr = [m for m in ptr if "<FilingType>P</FilingType>" in m]
print("PTR count", len(ptr)); print(ptr[-1])
import pdfplumber
ok = scan = 0
for m in ptr[-8:]:
    doc = re.search(r"<DocID>(\d+)</DocID>", m).group(1)
    pr = S.get(f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{y}/{doc}.pdf", timeout=60)
    open(f"out/h_{doc}.pdf","wb").write(pr.content)
    with pdfplumber.open(io.BytesIO(pr.content)) as pdf:
        t = "\n".join((p.extract_text() or "") for p in pdf.pages)
    print("--", doc, pr.status_code, len(pr.content), "textlen", len(t))
    if len(t) > 200: ok += 1; print(t[:1500])
    else: scan += 1
print("house text", ok, "scan", scan)
print("== SENATE ==")
B = "https://efdsearch.senate.gov"
r = S.get(B + "/search/home/", timeout=60); print("home", r.status_code)
tok = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', r.text).group(1)
r = S.post(B + "/search/home/", data={"prohibition_agreement": "1", "csrfmiddlewaretoken": tok}, headers={"Referer": B + "/search/home/"}, timeout=60)
print("agree", r.status_code, r.url)
csrf = S.cookies.get("csrftoken")
end = dt.date.today(); start = end - dt.timedelta(days=30)
r = S.post(B + "/search/report/data/", data={"start": "0", "length": "100", "report_types": "[11]", "filer_types": "[]",
    "submitted_start_date": start.strftime("%m/%d/%Y 00:00:00"), "submitted_end_date": "", "candidate_state": "", "senator_state": "",
    "office_id": "", "first_name": "", "last_name": "", "csrfmiddlewaretoken": csrf}, headers={"Referer": B + "/search/", "X-CSRFToken": csrf}, timeout=60)
print("data", r.status_code, r.text[:300])
j = r.json(); print("total", j.get("recordsTotal")); rows = j["data"]
for row in rows[:3]: print(row)
links = [re.search(r'href="([^"]+)"', row[3]).group(1) for row in rows]
for l in links[:4]:
    pr = S.get(B + l, headers={"Referer": B + "/search/"}, timeout=60)
    name = l.strip("/").split("/")[-1]; open(f"out/s_{name}.html","w").write(pr.text)
    print("--", l, pr.status_code, len(pr.text), "table" if "<table" in pr.text else "no-table")
    m = re.search(r"<table.*?</table>", pr.text, re.S)
    if m: print(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " | ", m.group(0)))[:1500])
