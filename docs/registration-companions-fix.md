# 活動攜伴欄位與報名快取修正（2026-10-15 hotfix）

- 原先 companions input 僅位於一般聚會分支，travel/meeting 即使 allowCompanions=yes 也不渲染。移至共用備註區之前，仍尊重 no；獨立世足預測表單不改。
- notes 原本已存在且可輸入，未找到輸入被 disabled 的證據。新增攜伴姓名／需求提示並和人數放同區。
- 瀏覽器檢查發現更新成功後 loadExistingRegistration 會使用頁面60秒舊快取，將人數／備註覆回舊畫面。成功寫入後清除此頁快取再讀取；共用 apiRequest 原有 write-success 清讀快取不變。
- 人數保留可清空字串、顯示明確0，送出/更新時拒絕負數、小數與非整數。資料仍存既有 customFields.companions/notes，不修改既有報名或資料表。
- 時間、截止、通知與權限無變更。前端限定。

驗證：60 frontend tests/build；tools/verifyRegistrationCompanionsUi.mjs 使用真實 App 路由、本機 Vite 4178、全攔截雲端 API。travel(390)、meeting(320)、gathering(1280) 驗證顯示、clear→逐字20、新增、重載、改0／改備註、更新後即時值與再次重載；travel/no驗證隱藏攜伴但備註可保存。手機截圖檢視與無橫向溢出確認。非實機Safari／正式DB寫入驗證。
