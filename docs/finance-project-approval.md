# 請購／請款專案加簽

## 規則

- 請購、請款可選「無專案」或財務組啟用的專案；零用金維持原流程。
- 財務組 D 成員在財務後台「專案項目」維護名稱、單一負責人、啟用狀態。班代／資訊組不因管理權自動取得本項維護權。
- 送出：申請人 → 專案負責人（pending_project）→ 原流程。無專案不加關。
- 負責人就是申請人：跳過專案關。負責人具備緊接組長關之簽核資格：專案簽核一併完成組長關，記錄 project 角色稽核。
- 申請時只接受 projectId；負責人與路由由伺服器取得並留存案件快照，不採信客戶端指定的加簽人／跳關資料。
- 已送出的案件不可整張覆寫，須退回補件；專案設定變更與停用不變更已送出快照。
- 草稿送出、退回重送會重新取得專案設定；已停用或不存在的選項要求重選。
- 原有案件不回填、不加關。新關卡支援核准、退回、首頁待辦與簽核計數、附件唯讀。
- 未新增時間門檻；待辦沿用原流程，僅在輪到該身分時顯示，簽核後清除。

## 驗證

- `cd services/api && npm test`：48 項通過，含加簽、退回、本人／非指派人拒絕、財務組寫入權限。
- `cd services/api && RUN_FINANCE_DB_TEST=1 node scripts/verifyFinanceProjects.js`：21 項真實 PostgreSQL 整合断言，單一外層交易永遠 rollback；驗證沒有留下測試案件。DDL 僅在交易內暫建。
- `cd frontend && npm test`：40 項通過。
- `cd frontend && npm run build`。
- UI fixture smoke：先 `npm run dev --prefix frontend -- --host 127.0.0.1 --port 4178`，再以已安裝的 Playwright 執行 `node tools/verifyFinanceProjectsUi.mjs`。
  - 可用 `PLAYWRIGHT_MODULE` 指定已安裝模組入口、`PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已有 Chromium 執行檔，不必修改共用程式碼。
  - 390px 手機：財務專案編輯／儲存、無水平溢出；一般同學在簽核中心以 project 身分核准。
  - 1280px 桌面：申請人下拉選專案；無 pageerror。
  - 所有非本機網路被 fixture 攔截；這不是正式 Google OAuth 或真實金流案件簽核測試。

## 上線與回復

- 唯一資料庫變更為 `032_finance_projects.sql`：新增設定表與 RLS，不改既有請款／請購資料。
- Render 既有 preDeployCommand 為 `npm run migrate`；前後端各自驗證部署，不能只看 git push。
- 未新增環境變數或付費服務。
- 若已有 pending_project 案件，不可直接回退到不認識新關卡的後端。先停用新專案選用，保留新關卡處理直到案件結清／退回；保留設定表與案件快照，不刪除資料。
