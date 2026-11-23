"""파서 시험: 실제 공시 표본(tests/fixtures)과 만든 문장으로 확인한다. 네트워크 없음."""
import json
import os
import sys
import unittest

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "collect"))

import build  # noqa: E402
import house  # noqa: E402
import senate  # noqa: E402
from common import parse_amount, parse_date  # noqa: E402

FX = os.path.join(HERE, "fixtures")


def fx(name, mode="r"):
    with open(os.path.join(FX, name), mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f:
        return f.read()


class Common(unittest.TestCase):
    def test_amount(self):
        self.assertEqual(parse_amount("$1,001 - $15,000"), (1001, 15000))
        self.assertEqual(parse_amount("$250,001 - $500,000"), (250001, 500000))
        self.assertEqual(parse_amount("Over $50,000,000"), (50000001, None))
        self.assertEqual(parse_amount("--"), (None, None))

    def test_date(self):
        self.assertEqual(parse_date("1/15/2026"), "2026-01-15")
        self.assertEqual(parse_date(" 11/11/2026 "), "2026-11-11")
        self.assertIsNone(parse_date("--"))


class House(unittest.TestCase):
    def test_index(self):
        rows = house.parse_index(fx("house_index.xml"))
        self.assertEqual([r["doc"] for r in rows], ["9116361", "20033783", "20034298"])  # P만
        w = rows[1]
        self.assertEqual(w["name"], "Roger Williams")
        self.assertEqual(w["state"], "TX")
        self.assertEqual(w["filed"], "2026-01-15")
        self.assertTrue(rows[0]["paper"])  # 9로 시작 = 종이 제출 스캔
        self.assertFalse(w["paper"])
        self.assertEqual(rows[2]["name"], "Rudy C. Yakym III")

    def test_pdf_stocks(self):
        txs = house.parse_pdf(fx("h_20033783.pdf", "rb"))
        self.assertEqual(len(txs), 4)
        cvx = txs[0]
        self.assertEqual((cvx["ticker"], cvx["side"], cvx["tx"], cvx["owner"]), ("CVX", "sell", "2025-12-22", "self"))
        self.assertEqual((cvx["lo"], cvx["hi"]), (15001, 50000))
        self.assertEqual(cvx["kind"], "stock")
        self.assertIn("Chevron", cvx["asset"])
        self.assertEqual(txs[1]["ticker"], "FANG")
        self.assertEqual((txs[2]["ticker"], txs[2]["side"]), ("JPM", "buy"))
        self.assertEqual(txs[3]["ticker"], "RTX")

    def test_pdf_bill_has_no_ticker(self):
        txs = house.parse_pdf(fx("h_20034298.pdf", "rb"))
        self.assertEqual(len(txs), 1)
        self.assertIsNone(txs[0]["ticker"])
        self.assertEqual(txs[0]["kind"], "other")
        self.assertEqual((txs[0]["lo"], txs[0]["hi"]), (15001, 50000))

    def test_scan_gives_nothing(self):
        self.assertEqual(house.parse_pdf(fx("h_9116361.pdf", "rb")), [])

    def test_text_owner_and_over(self):
        text = "\n".join([
            "ID Owner Asset Transaction Date Notification Amount Cap.",
            "SP NVIDIA Corporation - Common Stock P 10/01/2026 10/03/2026 $1,001 - $15,000",
            "(NVDA) [ST]",
            "F S: New",
            "JT Apple Inc. (AAPL) [OP] S 09/30/2026 10/02/2026 Over $50,000,000",
            "DC Microsoft Corporation - Common E 09/29/2026 10/01/2026 $15,001 -",
            "Stock (MSFT) [ST] $50,000",
        ])
        txs = house.parse_text(text)
        self.assertEqual([(t["ticker"], t["owner"], t["side"], t["kind"]) for t in txs],
                         [("NVDA", "spouse", "buy", "stock"), ("AAPL", "joint", "sell", "option"),
                          ("MSFT", "child", "exchange", "stock")])
        self.assertEqual((txs[1]["lo"], txs[1]["hi"]), (50000001, None))
        self.assertEqual((txs[2]["lo"], txs[2]["hi"]), (15001, 50000))

    def test_text_id_column_page_break_and_late_amount(self):
        text = "\n".join([
            "2000159506 SP Atlas Energy Solutions Inc. Common Stock P 05/01/2026 05/02/2026 $1,001 - $15,000",
            "(AESI) [ST]",
            "Vanguard Mega Cap Growth ETF P 05/03/2026 05/04/2026 $15,001 -",
            "Filing ID #20034954",
            "ID Owner Asset Transaction Date Notification Amount Cap.",
            "Type Date Gains >",
            "$200?",
            "(MGK) $50,000",
            "SP Audax Senior Loan Fund ST LP P 07/29/2026 07/30/2026 Spouse/DC Over",
            "$1,000,000",
        ])
        txs = house.parse_text(text)
        self.assertEqual([(t["ticker"], t["owner"], t["kind"]) for t in txs],
                         [("AESI", "spouse", "stock"), ("MGK", "self", "stock"), (None, "spouse", "other")])
        self.assertEqual(txs[0]["asset"], "Atlas Energy Solutions Inc. Common Stock (AESI)")
        self.assertEqual(txs[1]["asset"], "Vanguard Mega Cap Growth ETF (MGK)")
        self.assertEqual((txs[1]["lo"], txs[1]["hi"]), (15001, 50000))
        self.assertEqual((txs[2]["lo"], txs[2]["hi"]), (1000001, None))
        self.assertEqual(txs[2]["asset"], "Audax Senior Loan Fund ST LP")


class Senate(unittest.TestCase):
    def test_search(self):
        rows = senate.parse_search(json.loads(fx("senate_search.json")))
        self.assertEqual(len(rows), 8)
        cruz = [r for r in rows if r["id"] == "f0f7eba0-ca09-4b80-a97b-64b6dafb835e"][0]
        self.assertEqual(cruz["name"], "Ted Cruz")
        self.assertEqual(cruz["filed"], "2026-11-20")
        self.assertFalse(cruz["paper"])

    def test_ptr(self):
        txs = senate.parse_ptr(fx("s_f0f7eba0-ca09-4b80-a97b-64b6dafb835e.html"))
        self.assertEqual(txs, [{"tx": "2026-11-11", "owner": "spouse", "ticker": "GS",
                                "asset": "Goldman Sachs Group, Inc. (The) Common Stock", "kind": "stock",
                                "side": "sell", "lo": 250001, "hi": 500000}])

    def test_ptr_two_rows(self):
        txs = senate.parse_ptr(fx("s_21941188-c04d-4713-8e6f-d954918e93fd.html"))
        self.assertEqual([(t["ticker"], t["owner"], t["side"]) for t in txs],
                         [("CMBS", "joint", "sell"), ("TLH", "joint", "sell")])


class Build(unittest.TestCase):
    def ev(self, **k):
        base = {"id": "x", "ch": "house", "name": "A", "state": "CA", "filed": "2026-11-20", "tx": "2026-11-01",
                "owner": "self", "ticker": "NVDA", "asset": "NVIDIA", "kind": "stock", "side": "buy",
                "lo": 1001, "hi": 15000, "url": "u"}
        base.update(k)
        return base

    def test_window_and_counts(self):
        evs = [self.ev(id="1"), self.ev(id="2", side="sell", name="B"), self.ev(id="3", filed="2026-10-01"),
               self.ev(id="4", ticker=None, kind="other"), self.ev(id="5", ch="senate", ticker="MSFT", filed="2026-11-15")]
        s = build.summary(evs, "2026-11-23", 30, papers=2)
        self.assertEqual((s["n"], s["buy"], s["sell"]), (3, 2, 1))  # 기간 밖·종목 없는 건 뺌
        self.assertEqual((s["senate"], s["house"]), (1, 2))
        self.assertEqual(s["paper"], 2)
        top = s["tickers"][0]
        self.assertEqual((top["t"], top["b"], top["s"], top["who"]), ("NVDA", 1, 1, 2))
        self.assertEqual((top["lo"], top["hi"]), (2002, 30000))
        self.assertEqual(s["delay"], 17)  # 19, 19, 14일 평균 = 17.3 → 17
        self.assertEqual(sum(s["hist"]), 3)

    def test_two_weeks(self):
        evs = [self.ev(id="1"), self.ev(id="2", filed="2026-11-05")]
        self.assertEqual(build.summary(evs, "2026-11-23", 14)["n"], 1)


if __name__ == "__main__":
    unittest.main()
