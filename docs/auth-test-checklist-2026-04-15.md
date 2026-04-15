# 115b_sys Auth 可執行測試清單（2026-04-15）

> 目的：把前一版 50 種 auth 情境矩陣，轉成**可逐項操作、可記錄結果、可分批驗證**的 checklist。
> 使用方式：每個 case 都填「實測結果 / 是否符合預期 / 備註」，先跑 P0，再跑 P1。

---

## 測試紀錄欄位範本

每個 case 建議記：

- 實測日期：
- 測試人：
- 環境：Windows / macOS / iPhone / Android
- 瀏覽器：Chrome / Edge / Safari / LINE in-app
- 前置 storage：
- 操作步驟：
- 預期結果：
- 實際結果：
- 判定：PASS / FAIL / UX_FAIL / BLOCKED
- 備註：

---

# P0，優先先驗（最像近期真實事故）

## TC-001 只剩 googleStudent
- 目的：驗證半登入狀態是否會正確導向 reauth，而不是假登入卡住
- 前置：
  - localStorage 有 `emba115b.googleStudent`
  - localStorage 無 `emba115b.adminSession`
  - sessionStorage 無 `emba115b.googleIdToken`
- 步驟：
  1. 開啟首頁 LandingPage
  2. 觀察登入卡片狀態
- 預期：
  - 先進入恢復流程
  - 若 silent restore 成功，正常進入已登入
  - 若失敗，應顯示可重新登入，不可永久卡住
- 風險標記：P0

## TC-002 sessionStorage 清空但 localStorage 還在
- 目的：驗證常見瀏覽器重開後半登入情境
- 前置：
  - localStorage 有 `googleStudent`
  - localStorage 有 `adminSession`
  - sessionStorage 無 `googleIdToken`
- 步驟：
  1. 模擬重開瀏覽器或手動清掉 sessionStorage
  2. 開首頁
  3. 進一步點進 Home / Profile / Registration
- 預期：
  - 若 refreshToken 有效，應自動恢復
  - 若失效，應回到重新登入狀態
  - 不應顯示 Linus 恢復中後永久卡住
- 風險標記：P0

## TC-003 Windows Chrome silent login callback 不回來
- 目的：驗證你這次遇到的「恢復中卡死」是否真的被修掉
- 前置：
  - Windows Chrome
  - localStorage 有 `googleStudent`
  - 缺 idToken / 有問題的 session
- 步驟：
  1. 開首頁
  2. 觀察是否進入 silent recovery
  3. 觀察 8 秒內是否結束恢復流程
- 預期：
  - 最晚 8 秒內要結束
  - 失敗也只能落到重登，不可永久卡住
- 風險標記：P0

## TC-004 Windows Edge silent login callback 不回來
- 目的：驗證 Edge 與 Chrome 行為是否一致
- 前置：同 TC-003
- 步驟：同 TC-003
- 預期：同 TC-003
- 風險標記：P0

## TC-005 Google 帳號切換，但 localStorage 還留舊 student
- 目的：驗證是否會出現身份混淆
- 前置：
  - localStorage 的 `googleStudent` 是 A
  - 瀏覽器 Google 目前登入的是 B
- 步驟：
  1. 開首頁
  2. 觸發 restore / verifyGoogle
  3. 檢查 UI 顯示姓名、email、我的報名、個人資料
- 預期：
  - 不應保留 A 的 UI 身份卻拿 B 的 token
  - 若不一致，至少要強制重登或清理舊 state
- 風險標記：P0

## TC-006 多 tab，A 登出、B 繼續操作
- 目的：驗證 cross-tab auth sync
- 前置：已登入，開兩個 tab
- 步驟：
  1. A tab 點登出
  2. B tab 不重整，直接點需要 auth 的功能
- 預期：
  - B tab 不應維持假登入太久
  - 最多在下一次 API 後回到 reauth / login
- 風險標記：P0

## TC-007 refreshToken 過期，但畫面仍像已登入
- 目的：驗證 stale session UX
- 前置：
  - `googleStudent` 在
  - `adminSession.refreshToken` 無效
  - `adminSession.token` 可能也無效
- 步驟：
  1. 開首頁
  2. 點入 Home / Directory / Profile
- 預期：
  - 不應維持「已登入」假象太久
  - 應導向可理解的重新登入狀態
- 風險標記：P0

## TC-008 首頁顯示 Linus恢復中 後不動
- 目的：針對真實 bug 回歸測試
- 前置：重現你先前 Windows 環境
- 步驟：
  1. 開首頁
  2. 觀察是否出現「登入狀態恢復中」
  3. 計時是否在 8 秒內結束
- 預期：
  - 不可永久卡在恢復中
- 風險標記：P0

## TC-009 LandingPage reauth reload loop
- 目的：驗證首頁被導回 `?reauth=1` 後不會一直 reload
- 前置：製造 auth recovery fail
- 步驟：
  1. 直接進首頁帶 `?reauth=1`
  2. 觀察是否無限 reload
- 預期：
  - 最多 reload 一次
  - 然後穩定停在可登入狀態
- 風險標記：P0

## TC-010 HomePage 匿名看活動
- 目的：驗證公開頁對匿名使用者是否穩定
- 前置：三個 storage 都空
- 步驟：
  1. 進 HomePage
  2. 看活動列表是否正常出現
- 預期：
  - 可看公開活動
  - 不應因 auth 問題被導回登入
- 風險標記：P0

## TC-011 RegistrationPage 匿名進活動報名
- 目的：驗證活動報名頁不因 auth fallback 壞掉
- 前置：三個 storage 都空
- 步驟：
  1. 直接開報名頁
  2. 觀察活動資訊是否正常載入
  3. 嘗試填部分欄位
- 預期：
  - 可正常看活動與填寫基本資料
  - 不應先卡在登入恢復流程
- 風險標記：P0

## TC-012 API timeout 被誤判成 auth 問題
- 目的：驗證 timeout / network error UX
- 前置：模擬慢網路 / devtools offline-throttle
- 步驟：
  1. 開首頁或 HomePage
  2. 讓 API 逾時
- 預期：
  - 應顯示網路或載入問題
  - 不應直接導回 reauth，除非真的是 auth error
- 風險標記：P0

---

# P1，第二批驗（權限與頁面一致性）

## TC-013 全新使用者，三個 storage 都空
## TC-014 只有 googleIdToken
## TC-015 只有 adminSession.token
## TC-016 只有 adminSession.refreshToken
## TC-017 googleStudent + refreshToken
## TC-018 googleStudent + idToken
## TC-019 三者都有且都有效
## TC-020 三者都有但 studentId / email 不一致
## TC-021 localStorage 的 adminSession JSON 壞掉
## TC-022 localStorage 的 googleStudent JSON 壞掉
## TC-023 refreshToken 過期，但 session token 尚未過期
## TC-024 session token 過期，但 refreshToken 有效
## TC-025 session / refresh 過期，但 idToken 還有效
## TC-026 只剩 googleStudent，且 cookie 已清掉
## TC-027 多 tab，不同 tab session 版本不一致
## TC-028 部署後 client 還留舊版 storage 結構
## TC-029 Google 沒登入
## TC-030 Google script 載入慢
## TC-031 Google script 被公司政策擋掉
## TC-032 第三方 cookie / FedCM 被企業政策封鎖
## TC-033 callback 回來沒有 credential
## TC-034 prompt dismissed
## TC-035 refreshSession 回 401
## TC-036 refreshSession 回 500
## TC-037 verifyGoogle 回 401
## TC-038 verifyGoogle 回 500
## TC-039 讀 API 第一次 401，retry 後成功
## TC-040 讀 API 第一次 401，recovery 也失敗

> P1 執行格式與 P0 相同，請逐項補：前置、步驟、預期、實際、判定。

---

# P2，第三批驗（頁面細節與 UX 差異）

## TC-041 公開頁誤打到受保護 API
## TC-042 `/v1/events` 後端仍要求登入
## TC-043 `listHomeBootstrap` 對自己的 email 回 403
## TC-044 Landing 顯示已登入名字但 auth material 不足
## TC-045 Landing restore 成功但 memberships 沒同步
## TC-046 `reauth_reason` 殘留但 auth 已恢復
## TC-047 重新登入後沒有回原頁
## TC-048 DirectoryPage 沒權限但有登入
## TC-049 ProfilePage 有 googleStudent 但沒有 googleIdToken
## TC-050 AdminAccessGuard 用到舊 memberships cache

---

## 建議執行順序

### 第 1 輪，先跑這 6 個
- TC-002
- TC-003
- TC-005
- TC-006
- TC-010
- TC-011

### 第 2 輪，再跑這 6 個
- TC-007
- TC-008
- TC-009
- TC-012
- TC-024
- TC-040

### 第 3 輪，補齊權限 / cache / reload 類
- TC-020
- TC-028
- TC-041
- TC-042
- TC-048
- TC-050

---

## 我對這份 checklist 的建議用法

最好的方式不是一次硬跑 50 個，而是：

1. 先跑 P0 的 12 個
2. 把 FAIL / UX_FAIL 的 case 對應到 code path
3. 只修最高頻的 2 到 3 條 auth 主幹
4. 修完後回歸 P0
5. 再進 P1 / P2

不然很容易變成一直補頁面，而不是修 auth core。
