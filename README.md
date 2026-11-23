# 의회 거래 기록 (congress-ledger)

미국 상원·하원 의원의 주식 거래 보고서(STOCK Act 공시)를 의견 없이 기록만 보여 주는 비영리 사이트.

- 수집: `.github/workflows/collect.yml`이 매시간 `collect/run.py`를 돌려 하원 Clerk(색인 zip + PTR PDF)·상원 eFD(PTR HTML)를 받고, 결과를 `data` 브랜치에 덮어쓴다(1커밋).
- 화면: Cloudflare Worker(`src/worker.js`)가 `data` 브랜치의 `site/*.json`을 읽어 그린다. 화면을 고치면 `src/pages.js`의 `V`(app.css 캐시 버전)를 올린다.
- 시험: `python -m unittest discover -s tests` (네트워크 없음, 실제 공시 표본 사용).
- 지키는 것: 광고·유료 없음(5 U.S.C. §13107 상업 목적 이용 금지), 추천·평가·의원별 순위·정당 색 없음, 운영 중 AI 토큰 0.
