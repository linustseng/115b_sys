# NTU EMBA 115B Online System - Design Doc (v0)

## 1. 背景與目標
- 目的: 建立 NTU EMBA 115B 班級未來各式活動使用的線上系統。
- 初期功能: 活動系統 (活動報名 + 活動簽到)。
- 前台: 以短鏈結與 QRCode 方式給同學連線使用, 可填寫資料或查看報名/簽到狀態。
- 後台: 管理者可修改活動與報名資料, 產生短鏈結/QRCode。
- 部署: 先以 GitHub Pages 上線, 版本控管使用 GitHub。

## 2. 角色與使用情境
- 一般同學: 透過短鏈結/QRCode 進入前台, 進行報名、查詢、簽到。
- 系統管理者(活動承辦): 於後台建立活動、管理名單、產生 QRCode、匯出名單。

## 3. 範圍
### 3.1 MVP (第一階段)
- 活動列表/詳情
- 活動報名 (含欄位驗證)
- 活動簽到 (現場掃碼後填寫)
- 後台活動 CRUD
- 後台同學資料管理 (可匯入/編輯)
- 後台報名/簽到名單檢視與匯出
- 短鏈結/QRCode 產生

### 3.2 後續功能(第二階段)
- 活動費用與繳費狀態
- 通知 (Email/LINE/簡訊)
- 班級通訊錄與權限
- 報名資格條件/候補名單

## 4. 架構與部署策略
### 4.1 GitHub Pages 限制
- GitHub Pages 為靜態網站, 需搭配外部 API/Serverless 才能儲存與修改資料。

### 4.2 建議架構 (MVP)
- 前端: 靜態網站 (React/Vite 或純 HTML)
- 後端: Serverless API (Google Apps Script)
- 資料存放: Google Sheets + Apps Script API
- 短鏈結:
  - 由後端生成短碼 (slug) -> 前端解析
- QRCode:
  - 前端產生 (qrcode library) 或後端產生 base64 圖片

### 4.3 GitHub 版本控管與部署
- Repository 結構:
  - /frontend (GitHub Pages)
  - /backend (如果使用 Apps Script, 可獨立存放)
- GitHub Actions 部署靜態網站到 Pages

## 5. 資料模型 (初版)
### Event
- id, title, description, startAt, endAt, location
- registrationOpenAt, registrationCloseAt
- checkinOpenAt, checkinCloseAt
- capacity, status (draft/open/closed)
- category (gathering/meeting)
- formSchema (fields, presets)

### Registration
- id, eventId, userName, userEmail, userPhone, classYear
- customFields (key/value)
- status (registered/cancelled)
- createdAt, updatedAt

### Checkin
- id, eventId, registrationId
- checkinAt, checkinMethod (qr/link/manual)

### AdminUser
- id, name, email, role

### Student
- id, name, email (unique)
- studentNo (optional)
- phone (optional)
- company, title
- dietaryPreference (optional)
- notes

### ShortLink
- id, eventId, type (register/checkin)
- slug, targetUrl, createdAt

## 6. 功能設計
### 6.0 活動類別與預設欄位 (初版)
- 聚餐 (gathering)
  - 預設欄位: 姓名 (自同學資料帶入), 是否出席, 攜伴人數, 飲食偏好
  - 自訂欄位範例: 座位偏好/同桌需求, 是否需要停車位
- 開會 (meeting)
  - 預設欄位: 姓名 (自同學資料帶入), 是否出席, 代理出席, 備註
  - 自訂欄位範例: 提案/議題, 是否需投影設備

### 6.1 前台
- 首頁
  - 活動列表卡片 (未來/進行中/已結束)
- 活動詳情頁
  - 活動資訊、報名/簽到時間、名額
- 活動報名頁
  - 欄位: 預設欄位 + 自訂欄位 (依活動類別)
  - 既有同學資料可直接帶入 (不需填班級/Email/手機)
  - 成功後顯示「報名成功」與編號
- 活動簽到頁
  - 掃描 QR -> 導至簽到頁
  - 若未報名, 可提示先報名或現場補登

### 6.2 後台
- 活動管理
  - 新增/編輯活動
  - 設定報名/簽到期間
  - 活動類別與報名表單設定
- 同學資料管理
  - 名單匯入/更新 (CSV/Google Sheet)
  - 基本資料維護
  - 作為報名自動帶入來源
- 名單管理
  - 報名名單檢視
  - 簽到名單檢視
  - 匯出 CSV
- 短鏈結/QRCode
  - 產生報名/簽到 QRCode

## 7. 權限與安全
- 管理後台使用 Google OAuth 登入
- API 需加密 token (例如 Bearer token)
- 前台僅可新增資料, 後台具備 CRUD 權限

## 8. 使用流程 (MVP)
1) 管理者建立活動 -> 系統生成報名/簽到短鏈結 & QRCode
2) 同學掃描 QRCode -> 報名/簽到
3) 管理者於後台查看名單, 下載 CSV

## 8.1 同學資料匯入與帶入流程
- 匯入: 管理者上傳 CSV 或貼入 Google Sheet -> 系統以 email 作為唯一鍵寫入/更新
- 欄位: email 必填, 姓名必填, 其他欄位可選 (學號為空可略過)
- 帶入: 報名頁輸入 email 後, 讀取同學資料並帶入姓名與其他欄位

## 9. MVP 里程碑
- M1: 前台頁面 + 靜態資料
- M2: 接上 API (報名/簽到)
- M3: 後台 CRUD + 匯出
- M4: 上線 GitHub Pages

## 10. 建議方案 (資深班級秘書 x 系統架構師觀點)
- 同學資料欄位: 以報名便利與聯繫效率為目標, 建議至少包含姓名、Email(唯一鍵)、公司、職稱, 可選欄位包含手機、飲食偏好、備註; 學號待有資料再補。
- 活動類別: 先固定聚餐與開會兩類, 預設欄位如 6.0, 並允許活動承辦視需求加自訂欄位。
- 繳費: 初期先不納入, 以「是否出席」與「攜伴人數」足夠支援多數聚餐。
- 群組/分類: 先以活動類別與標籤方式處理, 後續再擴充班級群組權限。
