import { describe, expect, it } from "vitest";
import { buildMeetingMinutesContent, parseMeetingMinutesContent } from "./DocumentsPage";

describe("parseMeetingMinutesContent", () => {
  it("preserves every continuation line in attendance and absence fields", () => {
    const parsed = parseMeetingMinutesContent(`# 會議資訊
- 會議名稱：班委會
- 日期：2026-07-01 19:00-21:00

# 出席情況
- 出席：班代: Isaac
副班代 Chandler/ Marris
活動組: 宗翰
資訊組: Linus, 世玄
- 請假：David
小雞

# 議程
1. 班務報告`);

    expect(parsed.attendees).toBe("班代: Isaac\n副班代 Chandler/ Marris\n活動組: 宗翰\n資訊組: Linus, 世玄");
    expect(parsed.leaveAttendees).toBe("David\n小雞");
    expect(parsed.absentees).toBe("");
    expect(parsed.agenda).toBe("1. 班務報告");
  });

  it("keeps the legacy single-line attendance format unchanged", () => {
    const parsed = parseMeetingMinutesContent(`# 出席情況
- 出席：Isaac、Linus
- 請假：David

# 議程
- 報告事項`);

    expect(parsed.attendees).toBe("Isaac、Linus");
    expect(parsed.leaveAttendees).toBe("David");
    expect(parsed.absentees).toBe("");
  });

  it("preserves separate leave and absence fields through a version round trip", () => {
    const original = `# 會議資訊
- 會議名稱：班委會

# 出席情況
- 出席：Isaac

Linus
- 請假：David
Grace
- 缺席：Money
小雞

# 議程
1. 報告事項`;
    const parsed = parseMeetingMinutesContent(original);

    expect(parsed.attendees).toBe("Isaac\n\nLinus");
    expect(parsed.leaveAttendees).toBe("David\nGrace");
    expect(parsed.absentees).toBe("Money\n小雞");

    const rebuilt = buildMeetingMinutesContent({ meetingForm: parsed });
    const reparsed = parseMeetingMinutesContent(rebuilt);
    expect(reparsed.attendees).toBe(parsed.attendees);
    expect(reparsed.leaveAttendees).toBe(parsed.leaveAttendees);
    expect(reparsed.absentees).toBe(parsed.absentees);
  });

  it("handles empty and consecutive attendance labels without cross-field leakage", () => {
    const parsed = parseMeetingMinutesContent(`# 出席情況
- 出席：
- 請假：David
- 缺席：

# 議程
- 報告事項`);

    expect(parsed.attendees).toBe("");
    expect(parsed.leaveAttendees).toBe("David");
    expect(parsed.absentees).toBe("");
  });
});
