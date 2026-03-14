# JSON / JSONB Write Rules

這份規範是為了避免再次出現 `invalid input syntax for type json` 這類低級但會直接進正式環境的錯誤。

## 寫入規則

1. **所有 `json/jsonb` 欄位一律顯式 cast**
   - SQL placeholder 一律寫成 `::jsonb`
   - 例：`raw = $3::jsonb`、`vendor_ids = $7::jsonb`

2. **所有 `json/jsonb` param 一律先走 `jsonbParam()`**
   - 不要直接把 JS array 傳給 Postgres `jsonb`
   - 陣列/物件都先轉成合法 JSON text

3. **Array/Object fallback 要明確**
   - array 欄位：`jsonbParam(value, [])`
   - object 欄位：`jsonbParam(value, {})`

4. **讀寫都要有 shape 規範**
   - 例如 `vendor_ids` 應是 string array，不是任意 jsonb

## 新增/修改 jsonb 欄位時的 checklist

- [ ] migration 已定義正確型別與 default
- [ ] SQL placeholder 有 `::jsonb`
- [ ] 寫入 param 使用 `jsonbParam(...)`
- [ ] create / update 都驗過
- [ ] reload / list read-back 正常
- [ ] 有空值與多值情境測試
- [ ] 上線前至少跑一次 smoke test

## 最小 smoke test（以多值欄位為例）

1. 建立一筆資料
2. 寫入單值 array
3. 更新成多值 array
4. 重新整理/重新查詢確認資料仍一致
5. 檢查 server log 無 JSON / SQL error
