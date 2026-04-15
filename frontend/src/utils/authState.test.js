import { describe, expect, it } from "vitest";
import { emptyAdminSession, evaluateStoredAuthState, normalizeAdminSession, normalizeGoogleStudent } from "./authState";

describe("authState", () => {
  it("normalizes student and session payloads", () => {
    expect(normalizeGoogleStudent({ id: " B123 ", email: "Linus@Example.com " })).toEqual({
      id: "B123",
      email: "linus@example.com",
    });
    expect(
      normalizeAdminSession({
        token: " t ",
        refreshToken: " r ",
        studentId: " B123 ",
        studentEmail: "Linus@Example.com ",
        memberships: [{}],
      })
    ).toEqual({
      token: "t",
      refreshToken: "r",
      studentId: "B123",
      studentEmail: "linus@example.com",
      memberships: [{}],
    });
  });

  it("keeps valid matching auth state", () => {
    const result = evaluateStoredAuthState({
      googleStudent: { id: "B123", email: "linus@example.com" },
      googleIdToken: "id-token",
      adminSession: { token: "session", refreshToken: "refresh", studentId: "B123", studentEmail: "linus@example.com" },
    });
    expect(result.clearAllAuth).toBe(false);
    expect(result.clearAdminSession).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("clears all auth on student id mismatch", () => {
    const result = evaluateStoredAuthState({
      googleStudent: { id: "B123", email: "linus@example.com" },
      googleIdToken: "id-token",
      adminSession: { token: "session", refreshToken: "refresh", studentId: "B999", studentEmail: "linus@example.com" },
    });
    expect(result.clearAllAuth).toBe(true);
    expect(result.clearGoogleStudent).toBe(true);
    expect(result.clearGoogleIdToken).toBe(true);
    expect(result.clearAdminSession).toBe(true);
    expect(result.reasons).toContain("student_id_mismatch");
  });

  it("clears all auth on student email mismatch", () => {
    const result = evaluateStoredAuthState({
      googleStudent: { id: "B123", email: "linus@example.com" },
      googleIdToken: "id-token",
      adminSession: { token: "session", refreshToken: "refresh", studentId: "B123", studentEmail: "other@example.com" },
    });
    expect(result.clearAllAuth).toBe(true);
    expect(result.reasons).toContain("student_email_mismatch");
  });

  it("clears orphaned session without student or id token", () => {
    const result = evaluateStoredAuthState({
      googleStudent: null,
      googleIdToken: "",
      adminSession: { token: "session", refreshToken: "refresh", studentId: "B123" },
    });
    expect(result.clearAllAuth).toBe(false);
    expect(result.clearSessionOnly).toBe(true);
    expect(result.clearAdminSession).toBe(true);
    expect(result.reasons).toContain("orphaned_session_without_student_or_id_token");
  });

  it("returns empty admin session when missing", () => {
    expect(normalizeAdminSession(null)).toEqual(emptyAdminSession());
  });
});
