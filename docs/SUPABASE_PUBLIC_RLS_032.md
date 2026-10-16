# Supabase public tables RLS 修補與部署驗收

盤點基準：main commit `073cd714d0510c399c404c0e10944ab298cdf97a`，2026-09-30。
Supabase 專案：`115b-sys` / `ltqnycnnblasnlpqgnda`。

## 結論與證據邊界

已核對 Supabase 警示信：2026-09-29 寄送，問題快照為 2026-09-27，
critical `rls_disabled_in_public`；信件沒有提供表名、表數或即時 DB catalog。

完整讀取 33 個既有 SQL migration（包含兩個 018、兩個 019），
依 `scripts/migrate.js` 的完整檔名排序盤點 57 張 public tables：
56 張有 RLS 覆蓋，唯一程式碼缺口是 028 的 `cheerleading_config`。
026 只建立世界盃活動資料，沒有新增表。未發現 public tables 的 DROP、
RENAME 或 DISABLE RLS。腳本會建立的 `schema_migrations` 已由 025 覆蓋。

這證明的是 **repo 在 public search_path 且按序成功執行的最終狀態**，
不是 production 實際狀態。未連線 production，未查詢或修改其 DB；
警示不能因此宣告已解除。現場若有手動建表、跳過 migration、非 public
search_path、額外 policy 或後續關閉 RLS，需用 readback 查明。

## 最小修補

新增 `services/api/migrations/032_enable_rls_cheerleading_config.sql`：

```sql
ALTER TABLE public.cheerleading_config ENABLE ROW LEVEL SECURITY;
```

不改已套用的 028、不重跑全 public sweep、不新增允許客戶端的 policy，
不改資料、schema shape、Storage、GRANT、owner 或 FORCE RLS。
省略 IF EXISTS，避免缺表時被 runner 記錄成成功。重跑 ENABLE RLS 安全，
適合 runner「執行 SQL」與「記錄 ledger」分開的重試行為。

此單一語句的安全前提：target 不存在允許存取的 policy；
部署前 policy_count 必須為 0，否則先停止並審查 drift。
ENABLE RLS 不會消除既有允許 policy，也不防止 owner / superuser / BYPASSRLS 存取。
RLS 不涵蓋 TRUNCATE；若客戶端有此 grant，另行收緊，勿誤認已受 RLS 保護。

## 全部 public tables 覆蓋

未限定 schema 的 CREATE TABLE，依專案預期 public search_path 歸類；
現場必須確認實際 schema。017/024 為當時所有 public BASE TABLE 的動態 sweep，
但排除 schema_migrations。029/030/031 的直接 ALTER 均只針對相簿表，
不會補上 cheerleading_config。

| Table | 建立 migration | RLS 覆蓋 |
|---|---|---|
| `sync_runs` | `001_init.sql` | 017 → 024 |
| `events` | `001_init.sql` | 017 → 024 |
| `students` | `001_init.sql` | 017 → 024 |
| `registrations` | `001_init.sql` | 017 → 024 |
| `checkins` | `001_init.sql` | 017 → 024 |
| `directories` | `001_init.sql` | 017 → 024 |
| `group_memberships` | `001_init.sql` | 017 → 024 |
| `schema_migrations` | `002_full_cutover.sql` | 025 |
| `order_plans` | `002_full_cutover.sql` | 017 → 024 |
| `order_responses` | `002_full_cutover.sql` | 017 → 024 |
| `finance_category_types` | `002_full_cutover.sql` | 017 → 024 |
| `finance_roles` | `002_full_cutover.sql` | 017 → 024 |
| `finance_requests` | `002_full_cutover.sql` | 017 → 024 |
| `finance_actions` | `002_full_cutover.sql` | 017 → 024 |
| `fund_events` | `002_full_cutover.sql` | 017 → 024 |
| `fund_payments` | `002_full_cutover.sql` | 017 → 024 |
| `softball_config` | `002_full_cutover.sql` | 017 → 024 |
| `softball_players` | `002_full_cutover.sql` | 017 → 024 |
| `softball_practices` | `002_full_cutover.sql` | 017 → 024 |
| `softball_attendance` | `002_full_cutover.sql` | 017 → 024 |
| `softball_fields` | `002_full_cutover.sql` | 017 → 024 |
| `softball_gear` | `002_full_cutover.sql` | 017 → 024 |
| `notifications` | `002_full_cutover.sql` | 017 → 024 |
| `notification_reads` | `002_full_cutover.sql` | 017 → 024 |
| `directory_logs` | `006_legacy_support_tables.sql` | 017 → 024 |
| `admin_users` | `006_legacy_support_tables.sql` | 017 → 024 |
| `announcements` | `006_legacy_support_tables.sql` | 017 → 024 |
| `line_bindings` | `006_legacy_support_tables.sql` | 017 → 024 |
| `agent_audit` | `006_legacy_support_tables.sql` | 017 → 024 |
| `softball_angel_roster` | `007_softball_supply_management.sql` | 017 → 024 |
| `softball_supply_vendors` | `007_softball_supply_management.sql` | 017 → 024 |
| `softball_supply_cases` | `007_softball_supply_management.sql` | 017 → 024 |
| `academic_sessions` | `012_academics.sql` | 017 → 024 |
| `makeup_requests` | `012_academics.sql` | 017 → 024 |
| `session_notes` | `012_academics.sql` | 017 → 024 |
| `documents` | `013_documents.sql` | 017 → 024 |
| `document_versions` | `013_documents.sql` | 017 → 024 |
| `attachments` | `014_attachments.sql` | 017 → 024 |
| `ordering_public_links` | `015_ordering_public_links.sql` | 017 → 024 |
| `academic_courses` | `016_academics_courses.sql` | 017 → 024 |
| `academic_course_sessions` | `016_academics_courses.sql` | 017 → 024 |
| `academic_course_notes` | `016_academics_courses.sql` | 017 → 024 |
| `academic_session_tasks` | `016_academics_courses.sql` | 017 → 024 |
| `audit_change_batches` | `018_audit_versioning_foundation.sql` | 024 |
| `audit_entity_versions` | `018_audit_versioning_foundation.sql` | 024 |
| `audit_events` | `018_audit_versioning_foundation.sql` | 024 |
| `audit_restores` | `018_audit_versioning_foundation.sql` | 024 |
| `cheerleading_practices` | `018_cheerleading_management.sql` | 024 |
| `cheerleading_attendance` | `018_cheerleading_management.sql` | 024 |
| `cheerleading_fields` | `019_cheerleading_fields.sql` | 024 |
| `drink_queue_entries` | `019_drink_queue.sql` | 024 |
| `quick_links` | `021_quick_links.sql` | 024 |
| `academic_snapshots` | `022_academics_snapshots.sql` | 024 |
| `cheerleading_config` | `028_cheerleading_config.sql` | **缺口：032 補齊** |
| `activity_albums` | `029_activity_albums.sql` | 029 → 030 → 031 |
| `activity_photos` | `029_activity_albums.sql` | 029 → 030 → 031 |
| `activity_album_upload_attempts` | `031_activity_albums_deployment_hardening.sql` | 031 |

除 031 的三張相簿表有 anon/authenticated restrictive deny policy，
既有 migrations 未定義其他 public 表的 policy。
`storage.objects` 及 bucket hardening 是 Storage 範圍，非此 public inventory；
本修補不改它們。RLS enabled 與 policy 正確性是不同檢查。

## 部署前（read-only）

1. 使用 `services/api/verification/032_rls_readback.sql` 的 A–D，
   在正確專案的可信 DB console 執行；檔案全部為 read-only transaction。
   A 列出所有未啟用 RLS 的 public 普通/partitioned tables，含 repo 外的表；
   B 必須列出 57 張都 present；C target 必須有且只有一列、policy_count=0。
   若 A 不是只有 cheerleading_config，先查明其他缺口，勿直接批次 ALTER。
2. 用 **API 實際 DATABASE_URL 的同一連線身份** 執行 E，勿用 dashboard 的
   postgres 結果替代。需 can_bypass_target_rls=true、SELECT/INSERT/UPDATE=true，
   且 app_resolves_public_target=true。直接 Postgres 連線本身不代表可繞過 RLS。
   檢查 anon/authenticated 不具 owner inheritance、superuser、BYPASSRLS；
   若有，停止部署並處理。
3. 檢查 ledger 是否有所有既有 migration；runner 使用完整檔名為 id，
   不以數字前綴去重。若 031 尚未成功，既有 Storage owner/policy 檢查可能
   先讓部署失敗，不屬於 032；先解決原有 blocker。
4. staging 先用既有 runner 執行 migration，再以 owner/superuser 執行
   `032_rls_regression.sql`（psql ON_ERROR_STOP=1）。
   它在單一交易內建立 fixture、暫授 CRUD、驗證 owner upsert/read，
   再以 anon/authenticated 驗證 SELECT 無資料、UPDATE/DELETE 影響 0 列、
   INSERT 被 RLS 拒絕；最後 ROLLBACK。**只用 staging/disposable DB**，
   不是 production readback。暫授 CRUD 是為區分 ACL 拒絕與 RLS 生效。
5. 在 staging 以 API 實際連線身份做以下功能 smoke，確認應用授權仍正確。
   合併前亦遵循 CONTRIBUTING 的前端 build 與既有關鍵流程驗收。

## 部署方式與 production readback

本次交付為 Draft PR；不合併、不執行 production migration。
`render.yaml` 的 preDeployCommand 是 `npm run migrate`：
合併 main 可能觸發實際部署與 DB 修改，需由維運確認後安排。

部署後由維運執行：

1. 確認 log `Migration applied: 032_enable_rls_cheerleading_config.sql`，
   runner ledger 新增完整檔名。
2. 再跑 readback A–D：A **0 rows**；B 57 張 present=true、rls_enabled=true；
   C target RLS=true、policy_count=0，FORCE 狀態及 owner 與部署前一致。
   D 032 有 applied_at。ledger 成功不能取代 catalog readback。
3. 再以實際 API 身份跑 E，結果符合部署前条件。
4. 用非管理員、管理員各自執行應用 smoke：
   - `listCheerleadingBootstrap`：管理員取得配置、場地、練習和影片。
   - `listCheerleadingPlayerBootstrap`：登入球員仍取得原 playlist。
   - `updateCheerleadingConfig`：管理員保存、重載設定持久化成功；
     非管理員被拒絕，未登入的球員 bootstrap 被拒絕。
   - 影片列表/播放、既有報名/簽到與相簿讀取正常。
   設定寫入 smoke 在 staging 完成；production 僅於授權維運窗口修改並復原。
5. 用 publishable/anon key 與一般 Supabase authenticated JWT，直接 Data API
   GET cheerleading_config：應空結果或 ACL 拒絕，不能讀到配置。
   用 Supabase JWT，不要用本應用的 session token 代替。不可用 service key
   當 client negative test。production 不做破壞性寫入探測。
6. Security Advisor 重新掃描後確認 `rls_disabled_in_public` 消失。
   若仍有 warning，依 Advisor 表名和 A 結果處理，不以旧信件推斷已解除。

## 回歸風險與處理

- **後端角色受 RLS 限制**：API 球員頁可能回空 config，管理員 upsert 可能
  回 42501。必須實測 API 身份；app 使用 pg Pool / DATABASE_URL，
  Supabase Storage 的 service-role key 不代表 PG 連線身份具 BYPASSRLS。
  如角色不符合，停止上線，另提只授後端角色所需權限的方案，
  勿新增 `TO public USING(true)` 或放寬 anon/authenticated。
- **直接 Supabase client 故意被阻擋**：repo 的兩個啦啦隊頁呼叫 Node actions，
  沒有依賴直接 table API；外部未納管 client 如存在會受影響。
- **DDL lock / 權限**：ENABLE RLS 需 owner/適當管理權限並取得 table lock；
  忙碌交易可能延遲。排維運窗口、使用連線層短 lock timeout 並在失敗時重試，
  不擴大修補或重新執行其他 migration。
- **policy/schema drift**：本 patch 不會清除 policy；readback 出現額外 policy、
  missing table 或非 public schema，要先調查，不宣告已安全。
- **回滾**：撤回程式碼或重新部署舊版不會取消 DB 的 RLS。
  優先修正後端角色/連線並保留 RLS。緊急關閉 RLS 會重新暴露資料，
  不提供自動 down migration；若迫不得已，先阻斷 target 的 Data API 存取，
  另經明確維運授權，之後用新的 forward migration 恢復，避免 ledger 誤判。

## 已完成與未完成驗證

已執行：
`node --test src/publicTableRlsCoverage.test.js src/activityAlbumMigrations.test.js`，
2/2 通過。新增 inventory guard 依目前 repo 的 SQL 語法及兩個已知 sweep
模擬覆蓋，未來新增表未補 RLS 會失敗；它不是通用 SQL parser 或 DB 執行證據。

另以移除 032 的基準副本執行 inventory guard，確認失敗表名為
cheerleading_config，避免測試無法偵測原缺口。

未執行：真實 PostgreSQL replay / staged role probes、production catalog readback、
API/UI smoke、前端 build、部署及 Advisor 重掃。此工作環境無 PostgreSQL 執行器；
已提供可執行驗證 SQL，不能把靜態測試通過當作 production 問題已解決。

## 官方參考

- [Supabase Advisor 0013](https://supabase.github.io/splinter/0013_rls_disabled_in_public/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL Row Security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
