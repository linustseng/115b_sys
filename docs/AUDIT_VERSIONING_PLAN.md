# 115b_sys 異動紀錄 / 版本回復完整方案

> 目標：避免像這次 `order_plans` 被誤改後只能事後猜測，改成「可追、可比、可回、可防呆」。

## 1. 結論

建議採用 **雙層架構**：

1. **版本快照層（可回復）**
   - 針對高風險主資料，保存每次變更前後的完整快照
   - 用來做 restore / compare / forensic

2. **稽核事件層（可追查）**
   - 記錄誰、何時、從哪裡、做了什麼
   - 用來快速回答「誰改的、改了哪幾個欄位」

另外搭配：

3. **一致性控制層（避免互蓋）**
   - optimistic concurrency（revision / expectedRevision）
   - transaction 內同步寫主表 + version + audit
   - parent-child 同批次變更關聯

---

## 2. 為什麼不能只做一般 log

只做一般 log 常見問題：

- 只能知道「有人改過」
- 不一定有完整 before / after
- 不一定能精準 restore
- 多筆一起改時，很難知道哪些屬於同一次操作

這次 4/12 訂餐被蓋成 4/18，真正需要的是：

- 改前 `date`
- 改前 `title`
- 改前 `cutoffAt`
- 改前 `optionA/B/C/vegetarian`

這些都必須靠 **完整快照**，不能只靠文字 log。

---

## 3. 既有表風險分級

## P0，第一批必須納入版本保護

這些表一旦誤改，影響的是實際營運資料，應優先做。

### 訂餐
- `order_plans`
- `ordering_public_links`
- `order_responses`

### 活動 / 出席 / 報名
- `events`
- `registrations`
- `checkins`

### 財務
- `finance_requests`
- `finance_actions`
- `fund_events`
- `fund_payments`

### 文件 / 班務內容
- `documents`
- `document_versions`（已有版本概念，但仍建議接 audit batch / audit events）
- `announcements`
- `session_notes`

### 教務 / 請假補課
- `academic_sessions`
- `academic_session_tasks`
- `makeup_requests`

## P1，第二批納入追蹤即可

這些較偏設定、輔助或可再同步來源，但仍值得記錄。

- `softball_config`
- `softball_fields`
- `softball_gear`
- `softball_supply_cases`
- `softball_supply_vendors`
- `academic_courses`
- `academic_course_sessions`
- `academic_course_notes`

## 不建議納入版本化，僅保留一般系統紀錄

這些是 lookup / membership / sync / read-state 類型，價值較低或有外部真源。

- `students`
- `directories`
- `group_memberships`
- `notification_reads`
- `notifications`
- `sync_runs`
- `line_bindings`
- `admin_users`
- `schema_migrations`

例外：
- `directory_logs` 已存在，可保留，但不要當作通用 version system。
- `agent_audit` 已存在，可保留，但定位應是 agent/integration audit，不是業務資料還原層。

---

## 4. 建議新增的核心表

## 4.1 `audit_change_batches`

代表「一次使用者操作」。

用途：
- 把同一次 UI / API / script 造成的多筆異動綁在一起
- restore / timeline / trace 都以 batch 為中心

```sql
create table audit_change_batches (
  id text primary key,
  request_id text,
  source text not null,                 -- admin_ui / public_api / script / migration / system
  actor_id text,
  actor_name text,
  actor_email text,
  reason text,
  status text not null default 'committed', -- pending / committed / rolled_back / failed
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  raw jsonb not null default '{}'::jsonb
);
```

索引：
- `(created_at desc)`
- `(actor_id, created_at desc)`
- `(request_id)`

---

## 4.2 `audit_entity_versions`

真正的版本快照表。

用途：
- 每次修改保存 `before_data` / `after_data`
- 支援 restore / compare
- 可跨不同 entity type 共用一張表

```sql
create table audit_entity_versions (
  id text primary key,
  batch_id text not null references audit_change_batches(id) on delete restrict,
  entity_type text not null,            -- order_plan / order_response / finance_request / event ...
  entity_id text not null,
  parent_entity_type text,
  parent_entity_id text,
  action text not null,                 -- create / update / delete / restore
  revision_no bigint not null,
  before_data jsonb,
  after_data jsonb,
  changed_fields text[] not null default '{}',
  source_updated_at text,
  actor_id text,
  actor_name text,
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
```

索引：
- `(entity_type, entity_id, revision_no desc)`
- `(batch_id)`
- `(parent_entity_type, parent_entity_id, created_at desc)`
- gin on `changed_fields`

### 備註
- `before_data` / `after_data` 建議存 **canonical JSON**，不要只存 raw patch。
- `revision_no` 是 entity-local version，不是全域流水號。

---

## 4.3 `audit_events`

給人快速看的事件表。

用途：
- 列在後台「異動紀錄」
- 可快速顯示 summary / diff，不必每次從 version snapshot 現算

```sql
create table audit_events (
  id text primary key,
  batch_id text not null references audit_change_batches(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  parent_entity_type text,
  parent_entity_id text,
  action text not null,
  actor_id text,
  actor_name text,
  summary text not null,
  diff jsonb not null default '{}'::jsonb,
  severity text not null default 'info', -- info / warning / critical
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
```

索引：
- `(entity_type, entity_id, created_at desc)`
- `(batch_id)`
- `(severity, created_at desc)`

---

## 4.4 `audit_restores`

restore 也要被當成正式操作記錄，不應直接蓋掉不留痕。

```sql
create table audit_restores (
  id text primary key,
  restore_batch_id text not null references audit_change_batches(id) on delete restrict,
  target_entity_type text not null,
  target_entity_id text not null,
  restored_from_version_id text not null references audit_entity_versions(id) on delete restrict,
  previous_revision_no bigint,
  restored_revision_no bigint,
  actor_id text,
  actor_name text,
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
```

---

## 5. 建議在受保護主表補的欄位

對 P0 主表，建議補下列欄位：

```sql
revision_no bigint not null default 1,
last_change_batch_id text,
last_changed_at timestamptz,
last_changed_by text,
last_changed_by_name text
```

### 要補的表

#### 訂餐
- `order_plans`
- `ordering_public_links`
- `order_responses`

#### 活動 / 報名 / 簽到
- `events`
- `registrations`
- `checkins`

#### 財務
- `finance_requests`
- `finance_actions`
- `fund_events`
- `fund_payments`

#### 文件 / 內容
- `documents`
- `document_versions`
- `announcements`
- `session_notes`

#### 教務 / 補課
- `academic_sessions`
- `academic_session_tasks`
- `makeup_requests`

### 用意
- `revision_no` 用來做 optimistic concurrency
- `last_change_batch_id` 用來回查同一次操作
- `last_changed_*` 可直接顯示在 UI，不用每次 join audit table

---

## 6. 一致性處理原則

## 6.1 所有關鍵寫入都必須同 transaction 完成

對受保護表的每次 create / update / delete / restore，都必須：

1. 鎖定主資料列（`select ... for update`）
2. 讀出 current row 當 `before_data`
3. 算出 `after_data`
4. 更新主表
5. 寫 `audit_entity_versions`
6. 寫 `audit_events`
7. 更新 / 建立 `audit_change_batches`
8. commit

也就是：

**主表更新成功，但 audit 沒寫進去，不允許發生**。

---

## 6.2 optimistic concurrency

前端提交更新時，對受保護實體都要送：

```json
{
  "id": "...",
  "expectedRevision": 7,
  "data": { ... }
}
```

後端流程：
- 讀目前 `revision_no`
- 若 `expectedRevision !== currentRevision`
  - 回 `409 conflict`
  - 帶回最新資料與最新 revision

這樣可以避免：
- A 開著 4/12 編輯頁
- B 已先改過
- A 再把舊畫面整包蓋回去

---

## 6.3 parent-child 同批次一致性

這次訂餐其實不是只有 `order_plans`，還有：
- `ordering_public_links`
- `order_responses`

所以需要明確 parent-child 關係：

- `order_plans` = parent
- `ordering_public_links` = child
- `order_responses` = child

在 `audit_entity_versions` / `audit_events` 裡保留：
- `parent_entity_type`
- `parent_entity_id`

好處：
- 可查「某筆訂餐單的完整異動時間線」
- restore 時可選擇只回主表，或主表＋子表一起回

---

## 6.4 restore 必須是「新增一版」，不能靜默回寫

restore 不應該：
- 直接把主表改回去，卻不留新紀錄

restore 應該：
- 建立新的 `audit_change_batch`
- 建立新的 `audit_entity_versions`，action=`restore`
- 寫 `audit_restores`
- 主表 `revision_no + 1`

也就是：
- 歷史版不變
- restore 是一個新的現在式版本

---

## 6.5 delete 建議先做 soft delete（至少對 P0）

像 `order_plans` / `finance_requests` / `events` 這類，不建議直接 hard delete。

建議：
- 主流程改成 `status = archived/deleted` 或補 `deleted_at`
- 真正 hard delete 只給維運腳本或超高權限

理由：
- restore 成本低很多
- audit 與關聯資料更一致

`documents` 現在已有 `archive` 概念，這個方向是對的。

---

## 7. 模組別建議落地方式

## 7.1 訂餐模組

### 受保護表
- `order_plans`
- `ordering_public_links`
- `order_responses`

### 必做規則
- 已有 `order_responses` 的 `order_plans`，**禁止直接改 date**
- 若要改 date，改成：
  - 複製成新 plan，或
  - 明確走「另存新訂餐」
- 對 `title/date/cutoffAt/optionA/B/C/optionVegetarian` 顯示字段級 diff

### restore 模式
- restore `order_plans` only
- restore `order_plans + ordering_public_links`
- restore full meal package（含 responses，僅必要時）

---

## 7.2 財務模組

### 受保護表
- `finance_requests`
- `finance_actions`
- `fund_events`
- `fund_payments`

### 一致性規則
- `finance_actions` 多半是 append-only，但仍要 audit
- `finance_requests.status` 更新時，若同步新增 `finance_actions`，必須同 batch

---

## 7.3 活動 / 報名 / 簽到

### 受保護表
- `events`
- `registrations`
- `checkins`

### 一致性規則
- 活動基本資料更新與截止時間修改要保留版本
- 批次簽到 / 取消簽到要使用單一 batch 串起多筆 `checkins`

---

## 7.4 文件模組

### 既有狀況
- `documents` + `document_versions` 已有版本概念

### 建議補強
- 文件版本照舊保留
- 同時納入 `audit_change_batches` + `audit_events`
- 文件 metadata（title, slug, visibility, owner_group_id）變更也需可追

也就是：
- `document_versions` 是內容版本
- `audit_*` 是系統稽核與跨模組一致性層

兩者不要互相取代。

---

## 8. API / service 層改法

## 8.1 抽一個共用 helper

建議新增例如：

- `services/api/src/audit.js`
- `services/api/src/versioning.js`

### helper 介面示意

```js
await applyVersionedMutation({
  client,
  entityType: 'order_plan',
  entityId,
  parentEntityType: null,
  parentEntityId: null,
  actor,
  source: 'admin_ui',
  reason: 'update order plan',
  expectedRevision,
  loadCurrent: async () => {...},
  buildNext: async (current) => {...},
  persist: async (next, current) => {...},
  summarizeDiff: (before, after) => ({ summary, diff, changedFields }),
});
```

### helper 要負責
- lock row
- 驗證 revision
- 算 next revision
- 寫主表
- 寫 batch / version / event
- 回傳最新 row + revision

這樣可以避免每個 case 手刻一份 audit 邏輯，最後分裂。

---

## 8.2 request_id / batch_id 傳遞

前端每次重要操作送一個 `requestId`，後端可用來避免重送重複記錄。

來源：
- admin UI button click
- bulk action
- script
- cron

對批次操作，例如：
- 批量簽到
- 批次更新多筆 responses

同一輪應共用同一個 `batch_id`。

---

## 9. UI 防呆建議

## 9.1 明確區分新增 / 編輯模式

尤其是 `order_plans`。

需要清楚顯示：
- 你正在新增訂餐
- 你正在編輯既有訂餐：`訂餐 2026-04-12`

---

## 9.2 高風險欄位變更需二次確認

例如：
- `order_plans.date`
- `events.startAt`
- `finance_requests.amount_actual`
- `documents.slug`

若資料已有下游關聯，confirm 文案要帶數量：

> 你正在把訂餐日期從 2026-04-12 改成 2026-04-18，這筆訂餐目前已有 54 份回覆，確定要修改嗎？

---

## 9.3 後台提供 timeline / diff / restore

每個高風險主實體頁面右上角建議加：
- 查看異動紀錄
- 比較版本
- 回復到此版本

訂餐頁尤其需要。

---

## 10. rollout 建議

## Phase A，先做 foundation

### schema
- `audit_change_batches`
- `audit_entity_versions`
- `audit_events`
- `audit_restores`

### 主表補欄位
- 先補 `order_plans`
- `ordering_public_links`
- `order_responses`
- `finance_requests`
- `events`
- `registrations`
- `checkins`
- `documents`

### service helper
- 建 `applyVersionedMutation()`

---

## Phase B，先把最痛的模組接進去

優先順序：
1. `order_plans`
2. `ordering_public_links`
3. `finance_requests`
4. `events`
5. `registrations`
6. `documents`

原因：
- 這幾塊最容易被手動編輯
- 一旦誤改，影響最大
- restore 價值最高

---

## Phase C，補 UI 與 restore

- entity timeline
- field diff
- restore action
- conflict UI

---

## 11. 我對 table 設計的最終建議

### 新增 table
- `audit_change_batches`
- `audit_entity_versions`
- `audit_events`
- `audit_restores`

### 補欄位的既有 table
- `order_plans`
- `ordering_public_links`
- `order_responses`
- `events`
- `registrations`
- `checkins`
- `finance_requests`
- `finance_actions`
- `fund_events`
- `fund_payments`
- `documents`
- `document_versions`
- `announcements`
- `session_notes`
- `academic_sessions`
- `academic_session_tasks`
- `makeup_requests`

### 既有但不作為主版本系統
- `directory_logs`
- `agent_audit`

---

## 12. 核心原則摘要

1. **可回復靠 version snapshot，不靠文字 log**
2. **主表更新與 audit/version 必須同 transaction**
3. **每次寫入都要帶 revision，避免 stale overwrite**
4. **restore 是新版本，不是偷偷改回去**
5. **parent-child 要能綁成同一 batch**
6. **高風險欄位 UI 要二次確認**
7. **有下游資料的主表，預設禁止直接改關鍵識別欄位**

---

## 13. 針對這次 4/12 訂餐事故的對應

若這套已上線，這次會變成：

- 可直接看到 `order_plan 68bfc...` 被誰在何時改過
- 可直接看到 diff：
  - `date: 2026-04-12 -> 2026-04-18`
  - `title: 訂餐 2026-04-12 -> 訂餐 2026-04-18`
  - `cutoffAt: 2026-04-09T23:59 -> 2026-04-17T23:59`
  - 菜單文案 before/after
- 可直接 restore 到事故前版本
- UI 還會先擋一次，提示這筆已有 54 份訂單

也就是這次本來不該需要人工鑑識。
