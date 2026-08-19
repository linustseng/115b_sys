# 活動相簿安全修正版｜本地驗收紀錄

日期：2026-08-19。此紀錄對應未提交工作樹；尚未 push、部署或套用 migration。

| 項目 | 本地證據 | 真實限界／待驗證項 |
| --- | --- | --- |
| A. 相簿專用驗證 | 所有 `/v1/activity-albums*`、`/v1/activity-photos*` 與 storage-monitoring route 均以 Authorization `Bearer` 的 session 驗證；每次再查 active lifecycle。測試證明 query/body 的有效 token 與「invalid Bearer + query token」都回 401。其他舊 route 仍保留相容驗證。 | Bearer 本身若被竊取，仍依其 session 到期時間有效；這不是 query-token fallback。 |
| B. 實體圖片解碼 | `sharp`（libvips）完整解碼 JPEG/PNG：先受限 metadata/20M pixels/10,000 px dimension，再 `raw().toBuffer()` 強制完整 decode。單檔上限 15 MB；測試含 Sol 的 18-byte marker-only fake JPEG，必須拒絕。UI/API 都只承諾 JPG、PNG，HEIC/HEIF 明確拒絕。 | 本機未以 production 的實際 Sharp/Render binary 跑檔案；Render build 必須安裝 lockfile 所鎖定的 Sharp optional binary。 |
| C. signed upload capability | Supabase `createSignedUploadUrl` 的真實有效期為 **2 小時（7,200 秒）**，API 回傳相同數字；以 `{ upsert: false }` 建立，不能覆寫既有 path。每張使用 UUID path。 | 已簽出的 upload URL 是不可立即撤銷的短期 capability；撤銷成員後，該 URL 在剩餘期限內可能仍可 PUT，但不能 `complete`、不能取得新的 read URL，也不能讀 pending/deleted。不可宣稱立即撤銷既有 URL。 |
| D. pending/read 與撤銷 | list 只給 ready（管理員可 hidden），download 只給 ready（管理員可 hidden）；pending/deleted 一律 404。complete 依 pending row 的 `uploaded_by` 且先做一次 active lifecycle 查詢。 | 已經送往瀏覽器的 read URL 仍可使用其 60 秒期限；撤銷只會立即阻擋後續 API request/新 read URL。 |
| E. abuse rate limit | 每次已驗證 upload intent 都先寫入 `activity_album_upload_attempts`，無論後續 album、MIME、檔名、size 驗證是否失敗或照片是否 deleted。以 member 60/hour 與 HMAC-IP 120/hour 共同限制；unit test 驗證兩者與不保存 raw IP。 | 這是最小 API/DB 限流，不取代 WAF；同 NAT 的使用者可能較早遇到 IP 上限。 |
| F. orphan cleanup | startup 後與每 15 分鐘全域掃描所有 `activity-albums/` objects：刪除過期 pending row/object，並刪除沒有 live pending/ready/hidden metadata 的 object；測試含不同 member/album 的 raced orphan。 | cleanup 是 eventual，不是 capability revocation；Storage list/delete 必須在正式 Supabase service role 下實測。 |
| G. private bucket/RLS | 新增 **031**（而非假設 029/030 重跑）：重申 bucket private、15 MB、JPEG/PNG allowlist，啟用 activity tables/storage RLS；為 anon/authenticated 新增 bucket-scoped restrictive select/insert/update/delete deny policies，保留其他 bucket policy。migration static test 覆蓋這些不變量。 | 尚未在正式 DB readback `storage.buckets` / `pg_policies`，也未確認現存 broad policy 與 Supabase signed-upload endpoint 的互動；這是部署前必做的真實驗證。 |
| H. 儲存空間監控 | `/v1/admin/storage-monitoring` 重新查 active manager 後只讀 `storage.objects` metadata aggregate；現有 tests 驗證不讀 app attachment tables、70/85/95% 與輸出 allowlist。 | 未設定 `SUPABASE_STORAGE_MONITORING_QUOTA_BYTES` 時刻意回報 quota/remaining/usage percentage **unavailable**，不可猜測 Supabase/organization quota。 |

## 部署前所需的真實檢查（不是「唯一 production E2E blocker」）

1. 在已授權的非正式 Supabase project 套用 031（以及尚未套用的 029/030），readback `storage.buckets`：`activity-albums` 必須 `public=false`、15 MB、只允許 JPEG/PNG。
2. Readback `pg_policies` 並以 anon、authenticated token 驗證該 bucket 不能 direct list/read/write/update/delete，同時確認非 activity-albums bucket 的既有 flow 未受影響。
3. 以 service role 建立 signed upload URL 後，驗證指定 path 可新建、相同 path 不可 overwrite，並確認它實際為 2 小時 capability。
4. 以 active / revoked lifecycle / manager 三帳號驗證：JPG/PNG complete、Sol fake JPEG 被拒、pending/deleted 無 URL、撤銷後 complete/read 都被 API 阻擋；同時接受「既有 upload/read URL 不能立即撤銷」這個限制。
5. 驗證 Render 安裝 Sharp，並以 production-like 壓縮炸彈/超尺寸圖片確認 decoder 的 dimension/pixel protection；驗證 global cleanup 能 list/delete orphan objects。
6. 管理員開啟 storage monitoring；未設定 quota 時顯示 unavailable，設定經核准的 project quota 後才驗證剩餘量與警戒門檻。
