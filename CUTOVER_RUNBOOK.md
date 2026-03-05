# 115b_sys 一次到位切換 Runbook

目標：前端讀寫 100% 切到 Node API（Render），Apps Script 保留回滾備援。

## 1) 上線前檢查（必做）

```bash
cd /home/linus/.openclaw/workspace/115b_sys/services/api
npm install
npm run migrate
npm run reconcile:snapshot
BENCH_API_V2_URL=https://one15b-sys.onrender.com BENCH_ITERATIONS=20 npm run bench:reads
curl https://one15b-sys.onrender.com/health
```

檢查重點：
- reconcile 無重大差異（或差異可解釋）
- health `ok=true`
- benchmark 顯示 Node 路徑延遲明顯優於 Apps Script

---

## 2) API 切換策略（已實作）

- register / update-registration / checkin：
  - 先寫 Node DB
  - mirror 到 Apps Script 若失敗，僅 `console.warn` 記錄
  - 不阻斷使用者成功回應

說明：Node DB 為主寫入來源，Apps Script 作備援。

---

## 3) 部署 API

```bash
cd /home/linus/.openclaw/workspace/115b_sys
git add services/api/src/server.js CUTOVER_RUNBOOK.md
git commit -m "feat(cutover): non-blocking mirror + one-shot runbook"
git push origin main
```

Render 自動部署後再驗證：

```bash
curl https://one15b-sys.onrender.com/health
```

---

## 4) 前端全量切換（Vercel）

Production 環境變數：

- `VITE_API_V2_URL=https://one15b-sys.onrender.com`
- `VITE_API_V2_READ_ENABLED=1`
- `VITE_API_V2_WRITE_ENABLED=1`

重新部署前端。

---

## 5) 上線驗收（20 分鐘）

手動測 5 項：
- [ ] 新增報名
- [ ] 修改報名
- [ ] 簽到
- [ ] 後台名單查詢
- [ ] 前台報名/簽到狀態查詢

再跑一次：

```bash
cd /home/linus/.openclaw/workspace/115b_sys/services/api
npm run reconcile:snapshot
```

---

## 6) 48 小時觀察

每天至少 2 次：

```bash
curl https://one15b-sys.onrender.com/health
cd /home/linus/.openclaw/workspace/115b_sys/services/api && npm run reconcile:snapshot
```

觀察重點：
- Render logs 無大量 5xx
- mirror warning 不持續暴增
- 使用者無回報資料不一致

---

## 7) 緊急回滾（10 分鐘內）

Vercel Production 變數改回：

- `VITE_API_V2_WRITE_ENABLED=0`
- （必要時）`VITE_API_V2_READ_ENABLED=0`

重新部署前端後，流量回 Apps Script。

---

## 8) 完成條件

滿足以下全部即視為一次到位完成：
- 前端讀寫已全走 Node API
- 連續 48 小時無重大故障
- reconcile 穩定且可接受
- 無需人工頻繁回補資料
