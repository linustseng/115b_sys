import { describe, expect, it } from "vitest";
import { filterActiveEvents, isEventCompleted, parseEventDateValue } from "./eventVisibility";

describe("event visibility helpers", () => {
  const now = new Date("2026-05-11T12:00:00+08:00").getTime();

  it("parses local datetime strings used by event forms", () => {
    expect(parseEventDateValue("2026/05/12 18:30")?.toISOString()).toBeTruthy();
    expect(parseEventDateValue("")).toBeNull();
  });

  it("treats closed-like statuses as completed", () => {
    expect(isEventCompleted({ status: "closed" }, now)).toBe(true);
    expect(isEventCompleted({ status: "completed" }, now)).toBe(true);
    expect(isEventCompleted({ status: "open" }, now)).toBe(false);
  });

  it("falls back from endAt to checkinCloseAt, registrationCloseAt, then startAt", () => {
    expect(isEventCompleted({ endAt: "2026-05-10T23:00:00+08:00" }, now)).toBe(true);
    expect(isEventCompleted({ checkinCloseAt: "2026-05-10T23:00:00+08:00" }, now)).toBe(true);
    expect(isEventCompleted({ registrationCloseAt: "2026-05-10T23:00:00+08:00" }, now)).toBe(true);
    expect(isEventCompleted({ startAt: "2026-05-10T23:00:00+08:00" }, now)).toBe(true);
    expect(isEventCompleted({ startAt: "2026-05-12T09:00:00+08:00" }, now)).toBe(false);
  });

  it("filters completed events from the public frontend list", () => {
    const events = [
      { id: "past", endAt: "2026-05-10T23:00:00+08:00" },
      { id: "future", startAt: "2026-05-12T09:00:00+08:00" },
      { id: "closed", status: "closed", startAt: "2026-05-12T09:00:00+08:00" },
    ];
    expect(filterActiveEvents(events, now).map((event) => event.id)).toEqual(["future"]);
  });
});
