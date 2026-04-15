import { mapAppErrorMessage } from "./errorMappings";

export function mapSoftballAttendanceError(error) {
  const message = String(error || "載入失敗");
  return `出席資料載入失敗：${mapAppErrorMessage(message, {
    reauthMessage: "請重新登入後再載入出席資料。",
    networkMessage: "目前網路或系統回應較慢，請稍後再試。",
    fallbackMessage: message,
  })}`;
}

export function mapSoftballBootstrapError(error) {
  const message = String(error || "壘球資料載入失敗。");
  return mapAppErrorMessage(message, {
    reauthMessage: "登入狀態已失效，請重新登入後再載入壘球資料。",
    networkMessage: "目前網路或系統回應較慢，壘球資料稍後再試。",
    fallbackMessage: "壘球資料載入失敗。",
  });
}

export function mapFinanceAdminMutationError(rawError, fallbackMessage) {
  const message = String(rawError || "").trim();
  if (/unauthorized/i.test(message)) {
    return "登入狀態已失效或權限不足，請重新登入後再試一次。";
  }
  if (/not found/i.test(message)) {
    return "這筆收款可能已被刪除或資料已更新，請重新整理後再試一次。";
  }
  return message || String(fallbackMessage || "操作失敗");
}
