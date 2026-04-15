import { describe, expect, it } from "vitest";
import {
  mapFinanceAdminMutationError,
  mapSoftballAttendanceError,
  mapSoftballBootstrapError,
} from "./authErrorPaths";

describe("authErrorPaths", () => {
  it("maps softball attendance auth and network errors", () => {
    expect(mapSoftballAttendanceError("Unauthorized")).toBe("出席資料載入失敗：請重新登入後再載入出席資料。");
    expect(mapSoftballAttendanceError("Request timeout")).toBe("出席資料載入失敗：目前網路或系統回應較慢，請稍後再試。");
  });

  it("maps softball bootstrap errors", () => {
    expect(mapSoftballBootstrapError("Unauthorized")).toBe("登入狀態已失效，請重新登入後再載入壘球資料。");
    expect(mapSoftballBootstrapError("Network error")).toBe("目前網路或系統回應較慢，壘球資料稍後再試。");
  });

  it("maps finance admin mutation raw errors", () => {
    expect(mapFinanceAdminMutationError("Unauthorized", "批次入帳失敗")).toBe("登入狀態已失效或權限不足，請重新登入後再試一次。");
    expect(mapFinanceAdminMutationError("Not Found", "更新入帳狀態失敗")).toBe("這筆收款可能已被刪除或資料已更新，請重新整理後再試一次。");
    expect(mapFinanceAdminMutationError("custom failure", "批次入帳失敗")).toBe("custom failure");
    expect(mapFinanceAdminMutationError("", "批次入帳失敗")).toBe("批次入帳失敗");
  });
});
