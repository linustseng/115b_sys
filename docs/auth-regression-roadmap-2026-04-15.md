# 115b_sys Auth Regression Roadmap（2026-04-15）

> 目標不是再補一次 bug，而是把這輪修補收成一條可持續的防再犯路線。

---

## 一句話結論

這輪已經從「分散 patch」推進到「有 auth guardrail + 共用錯誤分類 + 測試骨架」，下一步要做的是：

1. 把 **P0 / P1 高風險情境** 和 **已修 code path** 一一對上
2. 把最重要的情境變成 **固定回歸測試**
3. 後續任何 auth 修改，都要跑這份回歸矩陣

---

## 這輪已完成的防線

### 1. Silent recovery 不再無限卡住
- 修補：`getGoogleIdTokenSilently_()` timeout / dismissed handling
- 目的：避免首頁卡在「登入狀態恢復中」
- 代表 commit：`770c2ca`

### 2. Auth state guardrail
- 檔案：`frontend/src/utils/authState.js`
- 測試：`frontend/src/utils/authState.test.js`
- 目的：在進 UI 前先攔截高風險 storage 不一致
- 代表 commit：`d4495bb`

### 3. 共用錯誤分類與文案映射
- 檔案：`frontend/src/utils/errorMappings.js`
- 測試：`frontend/src/utils/errorMappings.test.js`
- 目的：統一 `reauth / forbidden / network / generic`
- 代表 commit：`a8423af`

### 4. 主要頁面逐步接入
- 第一批：Landing 周邊 + Home / Directory / Birthday / Academics / ApprovalsCenter
- 第二批：Profile / Finance / Admin
- 第三批：FinanceAdmin / SoftballPlayer
- 代表 commit：
  - `a8423af`
  - `b22f727`
  - `b6a8f72`

---

## 高風險情境 → 已修 code path 對照

### R1. 首頁卡在「登入狀態恢復中」
- 風險來源：silent Google login callback 不回來
- 已修：silent login timeout + dismissed handling
- 對應 case：
  - `TC-003`
  - `TC-004`
  - `TC-008`
- 目前狀態：**已補核心機制，需持續做 Windows 回歸**

### R2. 畫面顯示像已登入，但 auth 已半殘
- 風險來源：`googleStudent` 還在，`idToken/session` 不完整
- 已修：auth state guardrail + Landing reauth UX 改善
- 對應 case：
  - `TC-001`
  - `TC-002`
  - `TC-007`
- 目前狀態：**已補 guardrail，仍需做跨頁回歸**

### R3. 身份混淆，A 的 UI 配到 B 的 token/session
- 風險來源：storage 殘值與當前 Google 身份不一致
- 已修：studentId / studentEmail mismatch 清理
- 對應 case：
  - `TC-005`
  - `TC-020`
- 目前狀態：**高風險已攔，但仍需真人測帳號切換**

### R4. 不同頁對 Unauthorized / Forbidden / timeout 反應不一致
- 風險來源：每頁自己寫一套 if/else
- 已修：共用 error mapping + 主要頁面逐步接入
- 對應 case：
  - `TC-012`
  - `TC-035`
  - `TC-036`
  - `TC-037`
  - `TC-038`
  - `TC-040`
- 目前狀態：**主幹頁面已改善，仍有尾端頁面待收乾淨**

### R5. Public 頁誤打到 protected API
- 風險來源：public/protected boundary 漂移
- 已修：Home / Registration 先前已補部分 fallback
- 對應 case：
  - `TC-010`
  - `TC-011`
  - `TC-041`
  - `TC-042`
- 目前狀態：**仍需持續檢查後端路由保護規則**

### R6. 多 tab / stale session / storage 殘值造成 intermittent 問題
- 風險來源：cross-tab sync 弱、舊資料殘留
- 已修：部分 guardrail，尚未完整 cross-tab event sync
- 對應 case：
  - `TC-006`
  - `TC-018`
  - `TC-019`
  - `TC-027`
  - `TC-028`
- 目前狀態：**尚未完全解，屬下一階段**

---

## 建議固定回歸測試集

### Level A，每次 auth 相關修改必跑
1. `TC-002` sessionStorage 清空但 localStorage 還在
2. `TC-003` Windows Chrome silent login callback 不回來
3. `TC-005` Google 帳號切換但 storage 還是舊 student
4. `TC-010` Home 匿名看活動
5. `TC-011` Registration 匿名進報名頁
6. `TC-012` timeout 不可誤判成 auth fail

### Level B，每週或發版前跑
7. `TC-006` 多 tab 登出/繼續操作
8. `TC-007` refreshToken 過期但畫面仍像已登入
9. `TC-008` 首頁恢復中卡住回歸
10. `TC-020` student/session mismatch
11. `TC-040` recovery 失敗後 UX 是否合理
12. `TC-042` `/v1/events` public/protected boundary 回歸

---

## 自動化建議順序

### Phase 1，先補單元測試
擴充：
- `authState.test.js`
- `errorMappings.test.js`

再補這幾類：
- student/session mismatch
- orphaned session
- Unauthorized / Forbidden / timeout mapping
- auth sanitize 後 reauth_reason 是否合理寫入

### Phase 2，補 integration-like 測試
目標：
- mock storage
- mock `apiRequest`
- 驗證頁面初始 render 與錯誤狀態

優先頁：
- LandingPage
- HomePage
- ProfilePage
- FinancePage

### Phase 3，補手動 / 半自動瀏覽器驗證
用現有文件：
- `auth-test-checklist-2026-04-15.md`
- `auth-p0-simulation-playbook-2026-04-15.md`

優先測：Windows Chrome / Edge

### Phase 4，若值得，再上 Playwright
只有在前 3 階段穩了之後再做。
不然太早做 E2E，會一直改測試而不是解根因。

---

## 目前仍未完全解掉的結構性問題

### 1. Cross-tab auth sync 還不完整
- 尚未見完整 `storage` event 同步策略
- 仍可能出現 A tab 登出，B tab 還以為自己活著

### 2. 部分頁面還有舊式錯誤處理殘留
- `SoftballPage`
- `FinanceAdminPage` 深層 CRUD
- `AdminPage` 深層管理操作

### 3. Public / protected boundary 還是容易被後端調整影響
- 特別是 Home / Registration 這種 public-first 頁面

### 4. Auth source of truth 仍未完全單一化
雖然有 guardrail，但根本上仍有：
- googleStudent
- googleIdToken
- adminSession

這三份 state 共存的複雜度。

---

## 我建議的下一步順序

### 立刻做
1. 固定把 **Level A 6 個 case** 當 auth 修改後必跑清單
2. 補 `LandingPage` / `HomePage` / `ProfilePage` / `FinancePage` 的 integration-like 測試

### 接著做
3. 收尾 `SoftballPage` 與 `FinanceAdminPage` 深層操作錯誤處理
4. 補 cross-tab auth sync 策略

### 最後再做
5. 視情況上 Playwright / browser automation regression

---

## 我對這輪的判斷

這輪最有價值的不是某一個 bug fix，而是：

- 開始把 auth 問題從「頁面各自補」
- 拉成「有 guardrail、有共用分類、有 roadmap」

這才是未來不再一直踩同一類坑的起點。
