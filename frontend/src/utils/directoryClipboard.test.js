import { describe, expect, it } from "vitest";
import {
  buildDirectoryClipboardText,
  DIRECTORY_COLUMNS,
  DIRECTORY_PUBLIC_COLUMNS,
} from "./directoryClipboard";

describe("buildDirectoryClipboardText", () => {
  const student = {
    id: "P001",
    nameZh: "王小明",
    group: "A",
    email: "student@example.com",
    company: "範例\t公司",
    title: "執行長\n兼創辦人",
  };

  it("builds tab-separated rows that Excel can paste into cells", () => {
    const text = buildDirectoryClipboardText([student], DIRECTORY_PUBLIC_COLUMNS);
    expect(text).toBe("姓名\t分組\t公司\t職稱\n王小明\tA\t範例 公司\t執行長 兼創辦人");
  });

  it("keeps private columns out of the general-student roster", () => {
    const text = buildDirectoryClipboardText([student], DIRECTORY_PUBLIC_COLUMNS);
    expect(text).not.toContain("student@example.com");
    expect(text).not.toContain("P001");
  });

  it("includes every directory column for the admin roster", () => {
    const text = buildDirectoryClipboardText([], DIRECTORY_COLUMNS);
    expect(text.split("\t")).toHaveLength(15);
    expect(text).toContain("緊急聯絡人電話");
  });
});
