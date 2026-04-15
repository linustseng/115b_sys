# 115b_sys Auth 情境模擬盤點（2026-04-15）

> 這份是**依現有程式碼做的 code-path simulation**，不是完整真人 E2E 瀏覽器驗證。
> 目標是先把「哪些情境可能炸、炸在哪、UX 會不會差」盤出來，再決定實測順序。

## 先講結論

目前 auth 問題不是單點，而是**三層狀態疊在一起**：
- `googleStudent`（localStorage）
- `googleIdToken`（sessionStorage）
- `adminSession`（localStorage, token + refreshToken + memberships）

再加上：
- LandingPage 自己有一套 restore flow
- `apiRequest()` 全域又有一套 auto recovery flow
- 某些頁面又有自己的 auth fallback

所以高風險不是單純「登入失敗」，而是：
1. **頁面對 auth 狀態的理解不一致**
2. **不同頁面處理 Unauthorized 的方式不一致**
3. **storage 殘值 + sessionStorage 清空** 很容易形成半登入狀態
4. **silent login / FedCM / browser policy** 對 Windows 環境影響很大

---

## 風險等級定義

- **OK**：依現有程式碼，預期能正常處理
- **UX**：系統多半能活，但使用者體驗差
- **RISK**：高機率出現錯誤、誤導或卡住
- **BUG**：依目前程式碼看，明顯有機會進入錯誤狀態或不一致

---

## 50 種情境模擬

### A. 初始狀態 / Storage 組合

1. **全新使用者，三個 storage 都空**
   - 頁面：Landing/Home
   - 預期：顯示未登入，可正常看公開內容
   - 判定：**OK**
   - 風險：若後端仍把公開資料鎖住，首頁會退化成空頁或錯誤

2. **只有 `googleStudent`，沒有 `googleIdToken`、沒有 `adminSession`**
   - 頁面：Landing
   - 預期：進入 `needsReauth`，嘗試 silent restore
   - 判定：**UX**
   - 風險：若 silent restore 失敗，使用者會先看到像已登入，再被要求重登

3. **只有 `googleIdToken`，沒有 `googleStudent`、沒有 `adminSession`**
   - 頁面：Landing/其他需登入頁
   - 預期：全域 recovery 可能可救回 session，但首頁本人資訊可能不完整
   - 判定：**RISK**
   - 風險：token 可用但畫面沒有綁定人，UI 容易不一致

4. **只有 `adminSession.token`，沒有 refreshToken，沒有 idToken**
   - 頁面：受保護頁面
   - 預期：短期內可用，token 過期後 recovery 能力弱
   - 判定：**RISK**
   - 風險：過期後容易直接掉 Unauthorized

5. **只有 `adminSession.refreshToken`，沒有 session token，沒有 idToken**
   - 頁面：Landing / 全域 apiRequest
   - 預期：refreshSession 應可救回
   - 判定：**OK**
   - 風險：refresh 失敗時會直接退回 reauth

6. **`googleStudent` + `adminSession.refreshToken`，但 `googleIdToken` 空**
   - 頁面：Landing
   - 預期：應可用 refreshSession 救回，不一定需要 Google silent login
   - 判定：**OK**
   - 風險：若 refresh token 實際失效，UI 先顯示像已登入再跳 reauth

7. **`googleStudent` + `googleIdToken`，但 `adminSession` 空**
   - 頁面：Landing
   - 預期：verifyGoogle 可重建 session
   - 判定：**OK**
   - 風險：verifyGoogle 失敗時會退回登入，還算合理

8. **三者都有，且都有效**
   - 頁面：全部
   - 預期：最理想路徑
   - 判定：**OK**

9. **三者都有，但 studentId / email 彼此不一致**
   - 頁面：Landing / Profile / Home
   - 預期：程式未見明確一致性校驗
   - 判定：**BUG**
   - 風險：可能把 A 的 googleStudent 配上 B 的 session

10. **localStorage 裡的 `adminSession` JSON 壞掉**
    - 頁面：Landing / Home / Registration
    - 預期：部分 helper 有 try/catch，會當無 session
    - 判定：**OK**
    - 風險：不是每頁都保證完整降級

11. **localStorage 裡的 `googleStudent` JSON 壞掉**
    - 頁面：多頁
    - 預期：載入 helper 多半會回 null
    - 判定：**OK**

12. **sessionStorage 被瀏覽器清掉，但 localStorage 還在**
    - 頁面：Landing / Home / Registration
    - 預期：最常見半登入情境，走 reauth/refresh
    - 判定：**UX**
    - 風險：很容易造成「明明顯示 Linus，但功能不能用」

13. **refreshToken 過期，但 session token 尚未過期**
    - 頁面：受保護頁面
    - 預期：短期正常，等 session token 過期後才爆
    - 判定：**RISK**
    - 風險：延後爆炸，更難重現

14. **session token 過期，但 refreshToken 有效**
    - 頁面：受保護頁面
    - 預期：應自動 refresh
    - 判定：**OK**

15. **session token 與 refreshToken 都過期，但 idToken 還有效**
    - 頁面：受保護頁面
    - 預期：verifyGoogle 可救回
    - 判定：**OK**

16. **session token / refreshToken 都過期，idToken 也過期，只剩 googleStudent**
    - 頁面：Landing
    - 預期：走 silent login，失敗則 reauth prompt
    - 判定：**UX**

17. **使用者手動清除 cookie，但沒清除 local/session storage**
    - 頁面：Landing / 受保護頁
    - 預期：storage 還像登入，實際 Google 身分已失效
    - 判定：**RISK**
    - 風險：最容易形成「卡住 / 一直要重登 / 看起來像網站壞了」

18. **多個 tab，同時操作，A tab 登出，B tab 還開著**
    - 頁面：全部
    - 預期：未見完整 cross-tab auth sync
    - 判定：**BUG**
    - 風險：B tab 可能持續以舊 state 操作，直到 API 回 401

19. **A tab refresh 成功換到新 session，B tab 還拿舊 session**
    - 頁面：管理/簽核頁
    - 預期：B tab 應在下次 API 觸發 auto recovery
    - 判定：**UX**
    - 風險：中間會出現一次閃錯或被導回首頁

20. **部署後 bundle 已更新，但 client storage 還殘留舊版結構**
    - 頁面：全部
    - 預期：目前沒有 storage schema versioning
    - 判定：**RISK**
    - 風險：新舊欄位結構不符時很難排查

### B. Google / Browser / FedCM 情境

21. **Windows Chrome，Google 仍在登入，FedCM 正常**
    - 頁面：Landing
    - 預期：silent restore 成功
    - 判定：**OK**

22. **Windows Chrome，Google 沒登入**
    - 頁面：Landing
    - 預期：silent restore 失敗，顯示重登
    - 判定：**OK**

23. **Windows Chrome，Google 已登入，但 FedCM prompt 被瀏覽器略過**
    - 頁面：Landing
    - 預期：現在應會 timeout / fail fast
    - 判定：**UX**
    - 風險：不再卡死，但仍需要人工重登

24. **Windows Edge，Google Identity script 載入慢**
    - 頁面：Landing / SigninPanel
    - 預期：`waitForGoogleIdentity()` 最多等 6 秒
    - 判定：**UX**
    - 風險：弱網路下會被誤判成 Google unavailable

25. **Windows Edge，Google script 被公司政策擋掉**
    - 頁面：Landing
    - 預期：silent login unavailable / script not ready
    - 判定：**RISK**
    - 風險：頁面只能退回手動登入，若連按鈕也受影響會完全卡住登入入口

26. **第三方 cookie / FedCM 被企業政策封鎖**
    - 頁面：Landing / Profile
    - 預期：silent restore 失敗
    - 判定：**UX**
    - 風險：系統可活，但會反覆要使用者重登

27. **Google 帳號切換成別人帳號，但 localStorage 還留原本學生資料**
    - 頁面：Landing / Profile / Registration
    - 預期：verifyGoogle 後可能覆寫 student，也可能出現 mismatch
    - 判定：**BUG**
    - 風險：身份混淆是最高風險之一

28. **Google callback 回來沒有 credential**
    - 頁面：Landing / SigninPanel
    - 預期：直接 reject `No credential`
    - 判定：**OK**

29. **Google callback 根本不回來**
    - 頁面：Landing
    - 預期：現在 8 秒 timeout
    - 判定：**OK**
    - 風險：至少不會再永久卡住

30. **Google 帳號實際登入，但網頁聚焦切換導致 prompt dismissed**
    - 頁面：Landing
    - 預期：現在會 reject，不再懸掛
    - 判定：**OK**

### C. API / 後端 / 網路故障情境

31. **`refreshSession` 回 401**
    - 頁面：全域 recovery
    - 預期：改走 verifyGoogle / silent login
    - 判定：**OK**

32. **`refreshSession` 回 500**
    - 頁面：全域 recovery
    - 預期：catch 後改走下一條 recovery
    - 判定：**OK**
    - 風險：使用者無法理解為什麼忽然要求重登

33. **`verifyGoogle` 回 401**
    - 頁面：Landing / 全域 recovery
    - 預期：進一步走 silent login 或 reauth
    - 判定：**OK**

34. **`verifyGoogle` 回 500 / timeout**
    - 頁面：Landing / 全域 recovery
    - 預期：多半退回 reauth
    - 判定：**UX**

35. **讀 API 第一次回 401，第二次 retry 成功**
    - 頁面：多數受保護頁
    - 預期：使用者多半無感
    - 判定：**OK**

36. **讀 API 第一次回 401，recovery 也失敗**
    - 頁面：多數受保護頁
    - 預期：triggerGlobalReauth_ 導回首頁
    - 判定：**OK**
    - 風險：正在填表單時會直接中斷

37. **公開頁誤打到受保護 API**
    - 頁面：Home / Registration
    - 預期：若未完整降級，會被導 reauth 或顯示錯誤
    - 判定：**RISK**
    - 風險：匿名使用者體驗很差

38. **`/v1/events` 後端仍要求登入**
    - 頁面：Home public flow
    - 預期：若任何地方退回 listEvents 而非更安全的 public bootstrap，匿名會 401
    - 判定：**BUG**

39. **`listHomeBootstrap` 對自己的 email 回 403**
    - 頁面：Home
    - 預期：前端會顯示帳號不符 / 要重登
    - 判定：**UX**
    - 風險：實際可能是資料映射問題，不一定真是使用者錯

40. **API timeout，但不是 auth 問題**
    - 頁面：全站
    - 預期：read retry 會嘗試重試，之後仍可能失敗
    - 判定：**UX**
    - 風險：錯誤訊息可能不夠區分網路慢與登入失效

### D. 首頁 / Landing / 重新導回情境

41. **LandingPage 顯示已登入名字，但 auth material 不足**
    - 頁面：Landing
    - 預期：顯示「恢復中」或「需重新登入」
    - 判定：**UX**
    - 風險：認知上非常混亂，尤其對非技術使用者

42. **LandingPage silent restore 成功，但 memberships 沒同步**
    - 頁面：Landing / admin 入口
    - 預期：可能要等下一輪 bootstrap / listMyMemberships
    - 判定：**UX**
    - 風險：登入成功但權限入口短暫消失

43. **triggerGlobalReauth_ 在首頁本身觸發**
    - 頁面：Landing
    - 預期：若已在 `/?reauth=1`，會 reload 同頁
    - 判定：**RISK**
    - 風險：若底層原因沒解，理論上可形成 reload loop

44. **`reauth_reason` 有值，但實際 auth 已恢復**
    - 頁面：Landing
    - 預期：banner 可能仍顯示一次
    - 判定：**UX**

45. **首頁進入時 `from` 帶著原始頁面，但重登後沒回原頁**
    - 頁面：Landing -> 其他頁
    - 預期：目前見到記錄 `from`，但不保證完整 return-to-origin UX
    - 判定：**UX**

### E. 頁面別情境

46. **HomePage 匿名使用者查看活動**
    - 預期：應該要能看公開活動，不該強迫登入
    - 判定：**RISK**
    - 風險：後端/public 資料邊界若再漂移，這頁最容易壞

47. **RegistrationPage 匿名進入活動報名頁**
    - 預期：可先看活動與填部分資料，不一定要先登入
    - 判定：**OK**
    - 風險：若 lookup / bootstrap 誤走受保護 API，會變差

48. **DirectoryPage 沒權限但有登入**
    - 預期：應顯示沒有權限，而不是叫你重登
    - 判定：**UX**
    - 風險：Unauthorized / Forbidden message mapping 若不一致，容易誤導

49. **ProfilePage 有 `googleStudent` 但 `googleIdToken` 不在**
    - 預期：它會嘗試 silent restore token
    - 判定：**UX**
    - 風險：若失敗，可能呈現半登入 profile state

50. **AdminAccessGuard 保留舊 memberships cache，但真實權限已被撤掉**
    - 頁面：管理頁 / 簽核 / 通知中心
    - 預期：入口可能先顯示，真正 API 才 403/401
    - 判定：**BUG**
    - 風險：這是典型「先給你進去，再把你打回來」的差體驗

---

## 目前最值得優先驗的 12 個高風險情境

### P0，先驗，最可能重現你最近遇到的問題
1. 只有 `googleStudent`，其餘 auth material 不足
2. sessionStorage 被清掉，但 localStorage 還在
3. Windows Chrome / Edge 下 silent login callback 不回來
4. Google 帳號已切換，但 localStorage 還是舊 student
5. 多 tab，一邊登出一邊操作
6. refreshToken 過期，但畫面仍顯示像已登入

### P1，第二批驗
7. LandingPage reauth reload loop
8. Home public flow 誤打受保護 API
9. Registration public flow 誤打受保護 bootstrap
10. memberships cache 與真實權限不一致
11. verifyGoogle timeout / 500
12. API timeout 被誤當成 auth 問題

---

## 從這 50 種情境看出的系統問題

### 1. Auth source of truth 不夠單一
目前至少有三份狀態來源，且分散在：
- storage helper
- LandingPage local flow
- App 全域 flow
- 個別頁面 fallback

這是 auth 問題反覆冒出的核心原因。

### 2. Unauthorized / Forbidden / timeout 的 UX 映射不一致
有些頁面會：
- 直接清 auth
- 有些只顯示錯誤
- 有些會導回首頁
- 有些會保留畫面但不能操作

這會讓使用者覺得「同樣是登入問題，為什麼每頁反應不同」。

### 3. Public / protected data boundary 還不夠穩
Home / Registration 其實很依賴「哪些資料可匿名看」。
只要後端路由保護規則改一下，前端就很容易又退化。

### 4. cache 與 storage schema 缺 versioning
部署或 auth 流程調整後，舊殘值很容易造成半登入與假登入。

---

## 下一步建議

我建議下一輪直接做兩件事：

### A. 變成可執行的測試矩陣
把上面 50 種情境收成：
- 前置 storage
- 瀏覽器條件
- 操作步驟
- 預期 UI
- 預期 API
- 實際結果

這樣就能交給人手測，或我再幫你補自動化。

### B. 先補 3 個系統級防呆
1. **建立 auth state health check**
   - 啟動時集中判斷三份狀態是否一致
2. **統一 Unauthorized / Forbidden / timeout UX**
   - 不同頁不要各自翻譯
3. **替 storage 加 version / issuedAt / owner identity check**
   - 避免殘值誤認成可用登入

---

## 我建議的下一步順序

1. 先把這 50 種情境整理成 **可實測 checklist**
2. 再挑 P0 / P1 共 12 種做真實驗證
3. 驗完後再決定要不要做 auth core refactor

如果直接重構而不先盤測，很可能只是把 bug 換位置而已。
