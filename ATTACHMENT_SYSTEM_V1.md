# 115b_sys Attachment System v1

## 1. 目的

把目前分散、偏舊的「Google Drive 上傳 + 儲存 URL」模式，升級成 **115b_sys 全系統共用的附件基礎設施**。

這次不是只做 documents 的附件，也不是只修 finance 的上傳；而是建立一套可以被以下模組共用的 attachment service：

- 財務（請購 / 請款 / 入帳 / 匯款證明 / 憑證）
- 文件管理（document versions）
- 學藝 / 課程（session materials，如需）
- 活動 / 公告 / 報名（後續可接）

核心原則：

- **Storage 存檔案，DB 存 metadata 與 path，不存公開鏈結**
- **private bucket + 短效 signed URL**
- **共用 attachments table + 共用 API + 共用前端元件**
- **權限由各模組決定，不在 attachment service 內硬寫死**

---

## 2. 現況盤點（以目前 repo 為準）

### 2.1 現有上傳路徑

目前已有一條舊的上傳 API：

- `POST /v1/finance/attachments/upload`

位置：

- `services/api/src/server.js`

目前行為：

- 使用 multer 收檔
- 驗證登入
- 上傳到 Google Drive
- 回傳 `fileId / name / url / size / mimeType`
- 前端直接把 `{ name, url }` 存進各模組的 `attachments`

### 2.2 目前已使用這條路徑的前端頁面

- `frontend/src/pages/FinancePage.jsx`
- `frontend/src/pages/DocumentsPage.jsx`

也就是 documents 目前其實直接借用 finance 的 attachment upload endpoint。

### 2.3 現有資料結構

目前 repo 內 attachments 主要是 JSON 欄位，不是共用資料表：

- `finance_requests.attachments jsonb`（來自舊 migration）
- `document_versions.attachments jsonb`（`013_documents.sql`）

這代表：

1. 各模組都各自存附件 JSON
2. 不利於後續權限控管 / 查詢 / 統計 / 清理 orphan files
3. 舊資料混有 Google Drive URL
4. 無法做真正的全系統附件管理

### 2.4 學藝模組現況

學藝 / 課程模組目前主要是：

- `academic_sessions`
- `makeup_requests`
- `session_notes`

其中 `session_notes` 現在偏向：

- `summary`
- `link_url`
- `link_label`

而且依近期產品決策，學藝內容目前偏 **連結優先**。

因此學藝模組不一定要在第一波就改成附件必備，但附件系統必須預留可接入能力。

---

## 3. 目標架構

### 3.1 Infra

沿用既有部署：

- Frontend: Vercel
- Backend: Render
- DB: Supabase Postgres
- File Storage: **Supabase Storage**

### 3.2 原則

- bucket 一律 **private**
- 檔案上傳走 **signed upload URL**
- 檔案讀取走 **signed read URL**
- DB 只存：
  - bucket
  - storage path
  - 檔名 / MIME / size
  - entity_type / entity_id
  - uploaded_by
  - status
- 不存公開 URL
- 不把檔案內容中轉留在 Render

### 3.3 流程

1. 前端呼叫 backend `create-upload`
2. backend 驗權、檢查大小 / MIME、建立 attachment row、產 signed upload URL
3. 前端直接把檔案 PUT 到 Supabase Storage
4. 前端呼叫 backend `complete-upload`
5. backend 驗證物件存在，將附件狀態轉為 `ready`
6. 前端列附件時，backend 依權限產短效 signed read URL

---

## 4. 資料模型

## 4.1 attachments（核心表）

```sql
create table if not exists attachments (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  attachment_kind text not null default 'general',
  visibility text not null default 'private',
  uploaded_by text,
  uploaded_by_name text,
  status text not null default 'pending',
  created_at text,
  updated_at text,
  completed_at text,
  deleted_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_attachments_entity
  on attachments (entity_type, entity_id, coalesce(status,''), coalesce(created_at,''), id);

create index if not exists idx_attachments_uploaded_by
  on attachments (coalesce(uploaded_by,''), coalesce(created_at,''), id);

create unique index if not exists uq_attachments_bucket_path
  on attachments (bucket, storage_path);
```

### 4.2 欄位說明

- `entity_type`: 附件掛在哪一種模組實體
- `entity_id`: 具體那一筆資料 id
- `attachment_kind`: 同模組下的附件語意
- `status`:
  - `pending`: 已簽發 upload，但尚未完成
  - `ready`: 已完成可讀取
  - `deleted`: 已刪除
- `raw`: 預留未來 metadata（hash / image width / note / source）

---

## 5. entity_type / attachment_kind 規劃

## 5.1 第一版先保留這些 entity_type

- `document_version`
- `finance_request`
- `finance_payment`
- `finance_fund_event`
- `academic_session_note`
- `announcement`
- `event`
- `registration_submission`

> 註：finance 若目前主實體仍是 `finance_requests`，第一波可先統一掛在 `finance_request`。
> 未來真的拆更細，再擴 entity_type，不必一開始切太碎。

## 5.2 attachment_kind 建議

### documents
- `reference`
- `meeting_material`
- `appendix`

### finance
- `receipt`
- `invoice`
- `quote`
- `proof_of_payment`
- `supporting_document`

### academics
- `slides`
- `handout`
- `recording_link_meta`（如未來真的要混搭）
- `reference`

### generic
- `general`
- `image`
- `attachment`

---

## 6. 權限分層

## 6.1 原則

attachment service **不直接決定業務權限**。

它只提供：

- create-upload
- complete-upload
- list
- delete
- signed read url

真正的權限判斷，應依 `entity_type + entity_id` 回調到各模組規則。

### 6.2 權限檢查介面（概念）

後端可統一做成：

```js
async function resolveAttachmentAccess_(query, auth, entityType, entityId) {
  return {
    canView: boolean,
    canUpload: boolean,
    canDelete: boolean,
    scope: 'self' | 'group' | 'admin' | 'class',
  };
}
```

### 6.3 各模組規則

#### document_version
- 全班登入後可看
- A 組 `lead/deputy` + E 組可全域管理
- 各組 `lead/deputy` 可管理自己組別文件

#### finance_request
- 財務角色 / 財會組 / 指定 admin 才可看完整附件
- 一般申請人可看自己案件附件
- 刪除需更嚴格（申請人僅草稿期；財務 admin 可刪）

#### academic_session_note
- 目前產品走 link-first
- 若接附件，應由學藝管理權限控制 upload/delete
- 公開閱讀仍可視 note 狀態與 session 可見性決定

---

## 7. API 設計

## 7.1 POST `/v1/attachments/create-upload`

用途：建立待上傳附件與 signed upload URL。

request:

```json
{
  "entityType": "document_version",
  "entityId": "docver_xxx",
  "fileName": "meeting-minutes.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456,
  "attachmentKind": "meeting_material"
}
```

response:

```json
{
  "ok": true,
  "data": {
    "attachmentId": "att_xxx",
    "bucket": "attachments",
    "storagePath": "document_version/docver_xxx/att_xxx-meeting-minutes.pdf",
    "uploadUrl": "https://...signed-upload-url...",
    "expiresIn": 600
  },
  "error": null
}
```

backend 要做：

- 驗證登入
- `resolveAttachmentAccess_()` 檢查 `canUpload`
- 驗 MIME / size / entity existence
- 建 attachment row（`pending`）
- 產生 storage path
- 產生 signed upload URL

## 7.2 POST `/v1/attachments/:id/complete`

用途：前端上傳成功後通知 backend finalize。

request:

```json
{
  "entityType": "document_version",
  "entityId": "docver_xxx"
}
```

backend 要做：

- 驗證 attachment 是否存在
- 驗證 attachment 是否屬於該 entity
- 驗證 storage object 是否存在
- 更新 `status = ready`
- 記錄 `completed_at`

## 7.3 GET `/v1/attachments`

query params:

- `entityType`
- `entityId`

response:

```json
{
  "ok": true,
  "data": {
    "attachments": [
      {
        "id": "att_xxx",
        "name": "meeting-minutes.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 123456,
        "attachmentKind": "meeting_material",
        "downloadUrl": "https://...signed-read-url..."
      }
    ]
  },
  "error": null
}
```

backend 要做：

- 驗證 `canView`
- 查出 `status = ready` 的 rows
- 對每筆產生短效 signed read URL

## 7.4 DELETE `/v1/attachments/:id`

backend 要做：

- 驗證 `canDelete`
- 從 Storage 刪 object
- attachment row 改 `deleted`
- 保留 metadata / audit，不建議直接 hard delete

---

## 8. Storage 設計

## 8.1 bucket

第一版只需要一個 private bucket：

- `attachments`

之後若用量很大或要分權限，再考慮拆：

- `finance-files`
- `documents-files`
- `media-files`

目前不建議一開始拆太細。

## 8.2 storage path

格式統一：

```text
{entity_type}/{entity_id}/{attachment_id}-{safe_filename}
```

範例：

```text
document_version/docver_123/att_456-meeting-minutes.pdf
finance_request/fr_789/att_987-receipt.jpg
academic_session_note/note_555/att_777-handout.pdf
```

好處：

- debug 清楚
- migration 容易
- orphan cleanup 容易
- 匯出時較好追

---

## 9. 前端元件設計

## 9.1 共用元件

### `AttachmentUploader`
props：

- `entityType`
- `entityId`
- `attachmentKindOptions`
- `accept`
- `maxFiles`
- `maxSizeMb`
- `canUpload`
- `onUploaded`

責任：

- 選檔
- 顯示上傳中狀態
- 呼叫 `create-upload`
- 直接 PUT 到 signed upload URL
- 呼叫 `complete`
- 回報成功 / 錯誤

### `AttachmentList`
props：

- `entityType`
- `entityId`
- `readonly`
- `canDelete`
- `onChange`

責任：

- 顯示附件列表
- 顯示檔名 / 大小 / 類型
- 預覽 / 下載
- 刪除

## 9.2 手機 / PWA 優先注意

- 上傳按鈕需大而明顯
- 上傳中避免可重複點擊
- 檔名過長要截斷顯示
- 手機拍照圖片建議後續可加 client-side 壓縮（不是第一波必要）

---

## 10. 各模組落地策略

## 10.1 第一波：Documents + Finance

### Documents
目前 `document_versions.attachments` 是 JSON，且已實際使用附件 UI。

第一波做法：

- 新 attachment service 上線後，documents editor 改接共用 attachment API
- 新版本建立 / 更新時，不再把 `{name, url}` 當主資料來源
- `document_versions.attachments` 先保留相容期，可存 snapshot / fallback metadata
- 真正列表改由 `attachments` table 用 `entity_type=document_version` 查

### Finance
目前 finance 是最明確需要附件治理的模組。

要支援：

- 請購報價單
- 請款收據 / 發票
- 匯款證明
- 其他佐證文件

第一波做法：

- 新申請表改接 attachment service
- admin 檢視頁改讀 attachment service
- 舊 Drive URL 附件先維持可顯示，不強制立刻搬遷

## 10.2 第二波：Academics / 學藝

### 原則
學藝目前產品決策偏 **link-first**，所以不是所有學藝資料都要附件化。

建議：

- `session_notes` 仍保留 `link_url / link_label` 為主要外部教材入口
- 若某堂課需要上傳講義 / PDF，再用 attachment service 掛 `entity_type=academic_session_note`

也就是：

- 連結優先不變
- 但基礎設施要允許附件補充

## 10.3 第三波：公告 / 活動 / 報名

有了共用 attachment service 後，後續可以自然接：

- 公告附件
- 活動海報
- 報名證明文件

不需要重做上傳邏輯。

---

## 11. 舊資料相容與 migration 策略

## 11.1 不一次搬舊檔

第一版不建議立刻做大規模資料搬遷。先做：

- 新附件走 attachment service
- 舊資料仍保留原本 `attachments` JSON 讀法
- UI 層可混合顯示：
  - 新 attachment rows
  - 舊 URL attachments

## 11.2 之後再做 migration script

之後若要搬：

1. 掃舊 JSON 內的 Drive URL
2. 建對應 attachment row（標記 `source=legacy_drive`）
3. 若有需要再做檔案複製到 Supabase Storage

這部分不建議和 v1 一次綁在一起。

---

## 12. 安全規則

### 檔案類型白名單
先只開：

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/heic`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`

### 大小限制
第一版建議：

- 圖片：10 MB
- 文件：20 MB
- 單次最多 5 檔

### 檔名規則
- 使用 sanitized filename
- 實際 object key 以 `attachment_id + safe_filename` 為主
- 不信任原始檔名作為唯一識別

### 權限
- private bucket only
- read URL 一律 signed / short-lived
- upload URL 一律 one-time / short-lived

---

## 13. 後端實作切點（對應目前 codebase）

## 13.1 backend

位置：

- `services/api/src/server.js`
- `services/api/src/nativeActions.js`
- `services/api/migrations/`

建議新增：

- migration `014_attachments.sql`
- `services/api/src/attachments.js`（或先放 server.js / nativeActions.js 附近）
- 共用 helper：
  - `createAttachmentUpload_`
  - `completeAttachmentUpload_`
  - `listEntityAttachments_`
  - `deleteAttachment_`
  - `resolveAttachmentAccess_`

## 13.2 frontend

位置：

- `frontend/src/components/AttachmentUploader.jsx`（新增）
- `frontend/src/components/AttachmentList.jsx`（新增）

第一波接入頁面：

- `frontend/src/pages/DocumentsPage.jsx`
- `frontend/src/pages/FinancePage.jsx`
- `frontend/src/pages/FinanceAdminPage.jsx`

第二波接入頁面：

- `frontend/src/pages/AcademicsAdminPage.jsx`
- `frontend/src/pages/AcademicsPage.jsx`（若有前台可看教材附件）

---

## 14. 推進順序（建議）

### Phase A：底層先打通
1. 建 `attachments` table
2. 接 Supabase Storage private bucket
3. 做 4 支 API：
   - `create-upload`
   - `complete`
   - `list`
   - `delete`
4. 做共用前端 uploader/list 元件

### Phase B：先接兩個最高價值模組
1. documents version
2. finance request / admin review

### Phase C：擴展模組
1. academics（保留 link-first，附件做補充）
2. announcement
3. event / registration

### Phase D：舊資料整理
1. legacy Drive URL 相容顯示
2. 規劃 migration script
3. 規劃 orphan cleanup job

---

## 15. 本次結論

115b_sys 的檔案上傳，不應再延續「各模組各自貼連結」或「documents 借 finance upload endpoint」的模式。

v1 正確方向是：

- **Supabase Storage private bucket**
- **Render 驗權 + signed upload / read URL**
- **attachments table 作為全系統共用附件索引**
- **documents / finance 先落地，academics 保留 link-first 但可接入**

這樣可以同時滿足：

- 財務附件治理
- 文件版本附件
- 後續學藝 / 活動 / 公告共用
- 手機 / PWA 優先的 UX
- 後續擴充與清理成本可控
