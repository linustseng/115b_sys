# Migration Safety Template

這份模板是給 **既有正式資料上新增 constraint / 收緊資料 shape** 時使用。

核心原則只有一句：

> **先把舊資料 normalize/backfill 成新規格，再加 constraint。**

不要直接假設 production 內所有舊資料都已經符合你今天剛定的新規則。

---

## 什麼時候要用這份模板

當你要做以下任一種 migration 時，就優先套這份：

- 新增 `check constraint`
- 把欄位從寬鬆規格改成嚴格規格
- 對 `json/jsonb` 欄位要求固定 shape（例如必須是 array / object）
- 對舊欄位補 not-null / unique / foreign-key 之前，需要先清資料
- 對歷史資料做 canonicalization（欄位格式統一）

---

## 標準三段式

### Step 1. 先 normalize / backfill 舊資料

先把所有既有資料整理成你要的 canonical shape。

例如：`vendor_ids` 最終必須是 `jsonb array`，那 migration 先做：

- `null` → `[]` 或 `[vendor_id]`
- `"abc"` → `["abc"]`
- 非 array / 非 string 的怪值 → fallback 成 `[]` 或 `[vendor_id]`

### Step 2. 再加 constraint

等舊資料已經被整理完，再加：

- `check (...)`
- `not null`
- `unique`
- `foreign key`

### Step 3. 最後才讓 application code 依賴這個新保證

也就是說：

- migration 先能在 production 安全落地
- app code 才把這個 shape 當成既成事實

---

## 可直接照抄的 SQL 模板

```sql
-- 0xx_example_safe_constraint.sql

-- 1) Normalize legacy / malformed rows first.
update some_table
set some_jsonb_column = case
  when some_jsonb_column is null then '[]'::jsonb
  when jsonb_typeof(some_jsonb_column) = 'array' then some_jsonb_column
  when jsonb_typeof(some_jsonb_column) = 'string' then jsonb_build_array(some_jsonb_column #>> '{}')
  else '[]'::jsonb
end;

-- 2) Drop old constraint first (idempotent deploy-safe).
alter table if exists some_table
  drop constraint if exists chk_some_table_some_jsonb_column_array;

-- 3) Add the new constraint after data is clean.
alter table if exists some_table
  add constraint chk_some_table_some_jsonb_column_array
  check (jsonb_typeof(some_jsonb_column) = 'array');
```

---

## JSONB 專用模板

如果欄位應該是 object：

```sql
update some_table
set raw = case
  when raw is null then '{}'::jsonb
  when jsonb_typeof(raw) = 'object' then raw
  else '{}'::jsonb
end;

alter table if exists some_table
  drop constraint if exists chk_some_table_raw_object;

alter table if exists some_table
  add constraint chk_some_table_raw_object
  check (jsonb_typeof(raw) = 'object');
```

如果欄位應該是 array：

```sql
update some_table
set items = case
  when items is null then '[]'::jsonb
  when jsonb_typeof(items) = 'array' then items
  else '[]'::jsonb
end;

alter table if exists some_table
  drop constraint if exists chk_some_table_items_array;

alter table if exists some_table
  add constraint chk_some_table_items_array
  check (jsonb_typeof(items) = 'array');
```

---

## Deploy 前 checklist

### A. 寫 migration 前
- [ ] 我知道 production 可能已有舊髒資料
- [ ] 我列出了所有舊資料可能出現的 shape（null / string / object / array / 其他）
- [ ] 我決定了 canonical shape 與 fallback 規則

### B. 寫 migration 時
- [ ] 先 normalize/backfill
- [ ] 再 add constraint
- [ ] `drop constraint if exists` 保持 idempotent
- [ ] 對 jsonb shape 使用 `jsonb_typeof(...)`

### C. Deploy 前
- [ ] 本地 review 過 migration 對舊資料的處理
- [ ] 想過 production 內最髒的一筆資料會怎麼被轉換
- [ ] 確認 pre-deploy migration 失敗時不會讓服務卡死太久

### D. Deploy 後
- [ ] migration log 成功
- [ ] 服務正常啟動
- [ ] 讀取/編輯該功能至少 smoke 一次

---

## 這次事故的教訓（vendor_ids）

這份模板就是從 `softball_supply_cases.vendor_ids` 這次經驗整理出來的：

- app code 已經改對了
- 但 production DB 還留著舊 shape
- 直接加 constraint 會在 deploy 時爆掉

所以正確順序不是：

1. 加 constraint
2. 希望舊資料剛好都合法

而是：

1. 先清舊資料
2. 再加 constraint
3. 最後依賴 constraint
