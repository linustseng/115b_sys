# 活動參考檔案上傳修復（2026-10-15 hotfix）

舊活動表單仍將 multipart 送往 `/v1/action` 並等待 iframe `uploadResult`，與 Node JSON API 不相容，且沒有逾時退出。

改接現有 `/v1/attachments/upload`（header 認證），保留 10 MB 和原有文件格式。活動附件的 C／A lead-deputy／E lead-deputy 權限對齊活動維護；不影響其他 entity 權限。新增活動取得 ID 即可上傳，不自動發布活動。上傳後仍須儲存；附件保留 ID，開啟時重新取得短效 URL。失敗與 90 秒逾時清除 busy 狀態，同檔可重試；切換活動不會將前次結果加入另一筆活動。

本次不更動活動時間設定或通知規則、不操作正式活動資料、無資料庫 migration。

驗證：`npm test --prefix services/api`、`npm test --prefix frontend`、`npm run build --prefix frontend`。
手機／桌面 fixture：先在 frontend 啟動 Vite port 4178，再以已安裝的 Playwright/Chromium 執行 `tools/verifyEventUploadUi.mjs`，可用 `PLAYWRIGHT_MODULE` 與 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定路徑。所有非本機請求均攔截；涵蓋認證 multipart、錯誤復原、同檔重試、附件 fresh URL 與儲存附件 ID。並不代表正式 Storage 實際寫入已驗證。

以 hotfix 合併 main；回滾可 revert 本修復 commit（會恢復原有上傳故障）。
