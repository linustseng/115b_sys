# 115b_sys Node-only Runbook

目標：前端與 API runtime 100% 走 Node API（Render + PostgreSQL），不再把 Apps Script 當正式 fallback。

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
- benchmark 顯示 Node 路徑延遲穩定

---

## 2) API 切換策略

- register / update-registration / checkin：
  - 直接寫 Node DB
  - 不再 mirror 到 Apps Script

說明：Node DB 為唯一正式寫入來源。

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
- `VITE_API_URL=https://one15b-sys.onrender.com/v1/action`
- `VITE_API_V2_READ_ENABLED=1`
- `VITE_API_V2_WRITE_ENABLED=1`
- `VITE_API_V2_STRICT=1`

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
```

觀察重點：
- Render logs 無大量 5xx
- 前端未出現 legacy transport / Apps Script 相關錯誤
- 使用者無回報資料不一致

---

## 7) 緊急回滾（10 分鐘內）

Vercel Production 如需止血：

- 保留 `VITE_API_V2_URL`
- 視情況暫時把 `VITE_API_V2_READ_ENABLED=0`
- 視情況暫時把 `VITE_API_V2_WRITE_ENABLED=0`

重新部署前端後，流量維持在 Node `/v1/action` 與 `/v1/actions/*`，不回 Google。

---

## 8) 完成條件

滿足以下全部即視為一次到位完成：
- 前端讀寫已全走 Node API
- 連續 48 小時無重大故障
- runtime 不再依賴 Apps Script fallback
- 無需人工頻繁回補資料
