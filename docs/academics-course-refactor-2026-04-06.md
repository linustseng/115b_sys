# Academics course-layer refactor (2026-04-06)

## Goal

學藝專區改成：

- 課程共用一份筆記 / NotebookLM 連結
- 作業與小考按各堂次記錄
- 課程筆記不再有 draft / published 狀態，儲存即生效
- 補課提醒暫時維持既有 session note 流程，避免一次改太大

## Data model

### Keep
- `academic_sessions`: 每次實際課程場次 / 補課場次
- `makeup_requests`: 補課申請
- `session_notes`: 暫時保留給補課提醒與舊資料相容

### Add
- `academic_courses`
  - `id`
  - `course_key` unique
  - `title`
  - `status`
  - `raw`
- `academic_course_sessions`
  - `course_id`
  - `session_id`
  - unique(`session_id`)
- `academic_course_notes`
  - `course_id` unique
  - `title`
  - `summary`
  - `link_url`
  - `link_label`
  - `updated_by`
  - `updated_by_name`
  - `updated_at`
  - `raw`
- `academic_session_tasks`
  - `session_id` unique
  - `homework_notice`
  - `quiz_notice`
  - `updated_by`
  - `updated_by_name`
  - `updated_at`
  - `raw`

## Runtime backfill / migration policy

1. 先依 regular `academic_sessions` 的 `courseGroupKey/courseGroupTitle` 建立 `academic_courses`
2. 建立 `academic_course_sessions` 對應
3. 將舊 `session_notes` 中 regular session 的資料拆成：
   - 共用筆記欄位 → `academic_course_notes`
   - 作業 / 小考欄位 → `academic_session_tasks`
4. 同一門課有多筆舊 note 時：
   - `summaryItems` 去重合併
   - `linkItems` 去重合併
   - `title/summary/linkUrl/linkLabel` 優先採最新一筆非空值
5. 補課 reminder 不搬，繼續留在 `session_notes`

## API impact

### read bootstrap
`listAcademicsBootstrap` / `listAcademicsAdminBootstrap` 額外回傳：

- `courses`
- `courseNotes`
- `sessionTasks`
- `makeupNotes`

### write actions
- `upsertAcademicCourseNote`
- `upsertAcademicSessionTask`
- `upsertSessionNote` 僅保留給補課提醒

## Frontend impact

### Admin
- regular 課程管理改成「選課程」而不是「選 session」
- 一個表單編共用筆記
- 下方列出該課程所有堂次，各自編作業 / 小考
- makeup 管理維持原本流程

### Public
- 課程索引改成課程層卡片
- 卡片上方顯示共用筆記 / 連結
- 卡片內列出各堂次與其作業 / 小考
- 不再顯示課程筆記狀態

## Non-goals for this round

- 不做 course merge/split 後台工具
- 不重構 makeup reminder 模型
- 不改 academic ICS parser 規則
