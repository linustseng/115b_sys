import { describe, expect, it } from "vitest";
import { classifyAppError, getCheckinErrorDisplay, mapAppErrorMessage, mapRegistrationError } from "./errorMappings";

describe("getCheckinErrorDisplay", () => {
  it("returns null on empty error", () => {
    expect(getCheckinErrorDisplay("")).toBeNull();
  });

  it("maps expired window errors", () => {
    const result = getCheckinErrorDisplay("Check-in window closed");
    expect(result.title).toBe("QRCode 已過期");
  });

  it("maps registration not found", () => {
    const result = getCheckinErrorDisplay("registration not found");
    expect(result.title).toBe("尚未完成報名");
  });

  it("maps missing slug", () => {
    const result = getCheckinErrorDisplay("Missing slug");
    expect(result.title).toBe("簽到連結不完整");
  });
});

describe("classifyAppError", () => {
  it("classifies reauth errors", () => {
    expect(classifyAppError("Unauthorized")).toBe("reauth");
    expect(classifyAppError("登入已過期，請重新登入")).toBe("reauth");
  });

  it("classifies forbidden and network errors", () => {
    expect(classifyAppError("Forbidden")).toBe("forbidden");
    expect(classifyAppError("Request timeout")).toBe("network");
    expect(classifyAppError("Network error")).toBe("network");
  });
});

describe("mapAppErrorMessage", () => {
  it("maps app errors with custom messages", () => {
    expect(
      mapAppErrorMessage("Unauthorized", {
        reauthMessage: "請重新登入後再試。",
      })
    ).toBe("請重新登入後再試。");
    expect(
      mapAppErrorMessage("Forbidden", {
        forbiddenMessage: "你沒有權限。",
      })
    ).toBe("你沒有權限。");
    expect(mapAppErrorMessage("Request timeout")).toBe("目前網路或系統回應較慢，請稍後再試。");
  });
});

describe("mapRegistrationError", () => {
  it("maps duplicate registrations", () => {
    expect(mapRegistrationError("Duplicate registration")).toBe("你已完成過報名，無需重複送出。");
  });

  it("maps full capacity", () => {
    expect(mapRegistrationError("Event is full")).toBe("活動名額已滿，請聯繫承辦確認候補。");
  });

  it("maps expired registration link", () => {
    expect(mapRegistrationError("Registration link expired")).toBe("此報名連結已失效，請向承辦索取新的連結。");
  });
});
