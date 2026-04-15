# 115b_sys Auth P0 模擬手冊（2026-04-15）

> 目標：把最重要的 6 個 P0 auth 測試案例，轉成**可以直接在瀏覽器 DevTools Console 操作**的模擬手冊。
> 適用：Windows Chrome / Edge 優先。

---

## 使用前注意

1. 先開 `https://115b-sys.vercel.app`
2. 打開 DevTools
3. 進到 Console
4. 每次 case 開始前，先執行「清場腳本」

---

## 清場腳本

```js
localStorage.removeItem('emba115b.googleStudent');
localStorage.removeItem('emba115b.adminSession');
sessionStorage.removeItem('emba115b.googleIdToken');
sessionStorage.removeItem('emba115b.reauth_reason');
location.reload();
```

---

## 範例假資料

### 假學生資料

```js
const mockStudentA = {
  id: 'B123',
  email: 'linus@example.com',
  name: 'Linus Tseng',
  preferredName: 'Linus',
  nameZh: '曾立穎',
  company: 'Test Co',
  title: 'CEO'
};

const mockStudentB = {
  id: 'B999',
  email: 'other@example.com',
  name: 'Other User',
  preferredName: 'Other',
  nameZh: '其他同學',
  company: 'Other Co',
  title: 'Manager'
};
```

### 假 session

```js
const mockSessionGood = {
  token: 'session-token-demo',
  refreshToken: 'refresh-token-demo',
  studentId: 'B123',
  memberships: []
};

const mockSessionExpired = {
  token: 'expired-session-token',
  refreshToken: 'expired-refresh-token',
  studentId: 'B123',
  memberships: []
};
```

### 假 id token

```js
const mockGoogleIdToken = 'mock-google-id-token';
```

---

# P0-1，TC-002
# sessionStorage 清空，但 localStorage 還在

## 目的
模擬瀏覽器重開後最常見的半登入情境。

## 建立情境

```js
localStorage.setItem('emba115b.googleStudent', JSON.stringify(mockStudentA));
localStorage.setItem('emba115b.adminSession', JSON.stringify(mockSessionGood));
sessionStorage.removeItem('emba115b.googleIdToken');
location.href = '/';
```

## 觀察點
- 首頁會不會顯示像已登入但實際不能用
- 會不會自動恢復成功
- 如果恢復失敗，會不會卡在恢復中

## 預期
- refresh token 有效時，應自動恢復
- 失敗時，應退回重新登入，不可卡死

---

# P0-2，TC-003
# Windows Chrome silent login callback 不回來

## 目的
驗證 recent bug: 「登入狀態恢復中」永久卡住是否已解。

## 建立情境

```js
localStorage.setItem('emba115b.googleStudent', JSON.stringify(mockStudentA));
localStorage.removeItem('emba115b.adminSession');
sessionStorage.removeItem('emba115b.googleIdToken');
location.href = '/';
```

## 手動操作
- 在 Windows Chrome 開首頁
- 不要先手動點登入
- 看頁面是否自己進入恢復流程

## 觀察點
- 是否出現「登入狀態恢復中」
- 是否在 8 秒內結束
- 結束後是成功登入，還是回到需重新登入

## 預期
- 最晚 8 秒內一定要離開恢復中

---

# P0-3，TC-005
# Google 帳號切換，但 localStorage 還留舊 student

## 目的
驗證身份混淆風險。

## 建立情境

```js
localStorage.setItem('emba115b.googleStudent', JSON.stringify(mockStudentA));
localStorage.setItem('emba115b.adminSession', JSON.stringify(mockSessionGood));
sessionStorage.removeItem('emba115b.googleIdToken');
location.href = '/';
```

## 手動操作
- 確保瀏覽器 Google 目前登入的不是 A，而是另一個帳號 B
- 開首頁後觸發任何需要 restore / verify 的流程
- 再看首頁、Profile、HomePage 顯示的人是誰

## 觀察點
- UI 顯示姓名與 email
- 我的報名紀錄是不是跟目前 Google 帳號一致
- 是否出現 A 的名字，但實際 token 是 B 的情況

## 預期
- 不可發生身份混淆
- 若不一致，至少要強制重登或清掉舊資料

---

# P0-4，TC-006
# 多 tab，一邊登出，一邊繼續操作

## 目的
驗證 cross-tab state sync 是否夠穩。

## 建立情境
- 正常登入後，開兩個 tab：A 與 B

## 手動操作
1. 在 A tab 點登出
2. 不重整 B tab
3. 在 B tab 點需要 auth 的功能，例如：
   - Home 查我的報名
   - Profile
   - Directory

## 觀察點
- B tab 是否還顯示舊登入狀態
- 是否在第一次 API 後才掉 auth
- 有沒有顯示奇怪的半登入 UI

## 預期
- B tab 不應長時間維持假登入
- 最多在下一次操作時落回合理 reauth / login

---

# P0-5，TC-010
# HomePage 匿名看活動

## 目的
驗證公開首頁流程沒有被 auth 汙染。

## 建立情境

```js
localStorage.removeItem('emba115b.googleStudent');
localStorage.removeItem('emba115b.adminSession');
sessionStorage.removeItem('emba115b.googleIdToken');
location.href = '/home';
```

## 觀察點
- 活動列表是否能載入
- 是否出現要登入才能看活動
- 是否被導向 reauth

## 預期
- 匿名也應能看公開活動

---

# P0-6，TC-011
# RegistrationPage 匿名進活動報名

## 目的
驗證公開報名頁沒有被 auth fallback 拖壞。

## 建立情境

```js
localStorage.removeItem('emba115b.googleStudent');
localStorage.removeItem('emba115b.adminSession');
sessionStorage.removeItem('emba115b.googleIdToken');
location.href = '/registration';
```

> 若實際路徑需要 eventId，請改成實際測試用 URL，例如：

```js
location.href = '/registration?eventId=YOUR_EVENT_ID';
```

## 觀察點
- 活動標題 / 時間 / 地點是否能正常顯示
- 是否可以開始填表
- 是否會莫名進入登入恢復流程

## 預期
- 匿名可進頁並填基本資訊
- 不應先被 auth 卡住

---

## 建議測試紀錄方式

每跑完一個 case，直接記這段：

```md
### TC-xxx
- 日期：
- 環境：Windows Chrome / Windows Edge
- 結果：PASS / FAIL / UX_FAIL / BLOCKED
- 實際現象：
- Console / Network 補充：
- 截圖：
```

---

## 最建議先跑的順序

1. P0-2 `TC-003` Windows Chrome silent login callback 不回來
2. P0-1 `TC-002` sessionStorage 清空但 localStorage 還在
3. P0-5 `TC-010` Home 匿名看活動
4. P0-6 `TC-011` Registration 匿名進活動報名
5. P0-3 `TC-005` Google 帳號切換但 localStorage 還是舊 student
6. P0-4 `TC-006` 多 tab，一邊登出一邊繼續操作

因為這 6 個最接近你最近的真實痛點。
