import { describe, expect, it } from "vitest";
import {
  computeHomeAuthState,
  computeLandingAuthState,
  hasUsableGoogleAuth,
  shouldLoadFinanceBootstrap,
  shouldRunProfileSilentRecovery,
} from "./authPageState";

describe("computeLandingAuthState", () => {
  it("marks restoring when google login exists but auth is not yet resolved", () => {
    expect(
      computeLandingAuthState({
        googleLinkedStudent: { email: "linus@example.com" },
        hasAuthMaterial: false,
        authRestoreResolved: false,
        authRecovering: true,
      })
    ).toEqual({
      hasGoogleLogin: true,
      needsReauth: true,
      authRestoring: true,
      shouldShowReauthPrompt: false,
    });
  });

  it("shows reauth prompt after restore has resolved", () => {
    const result = computeLandingAuthState({
      googleLinkedStudent: { email: "linus@example.com" },
      hasAuthMaterial: false,
      authRestoreResolved: true,
      authRecovering: false,
    });
    expect(result.shouldShowReauthPrompt).toBe(true);
    expect(result.authRestoring).toBe(false);
  });
});

describe("computeHomeAuthState", () => {
  it("drops cached google student when auth is no longer usable", () => {
    const result = computeHomeAuthState({
      googleLinkedStudent: { email: "linus@example.com", name: "Linus" },
      adminSession: { token: "", refreshToken: "" },
      googleIdToken: "",
    });
    expect(result.usableAuth).toBe(false);
    expect(result.effectiveGoogleLinkedStudent).toBeNull();
    expect(result.canLookupRegistrations).toBe(false);
  });

  it("keeps effective student when session or id token is present", () => {
    const result = computeHomeAuthState({
      googleLinkedStudent: { email: "linus@example.com", name: "Linus" },
      adminSession: { refreshToken: "refresh-token" },
      googleIdToken: "",
    });
    expect(result.usableAuth).toBe(true);
    expect(result.effectiveGoogleLinkedStudent).toEqual({ email: "linus@example.com", name: "Linus" });
    expect(result.canLookupRegistrations).toBe(true);
  });
});

describe("hasUsableGoogleAuth", () => {
  it("returns true when either session or id token exists", () => {
    expect(hasUsableGoogleAuth({ adminSession: { token: "session" }, googleIdToken: "" })).toBe(true);
    expect(hasUsableGoogleAuth({ adminSession: {}, googleIdToken: "id-token" })).toBe(true);
  });

  it("returns false when both session and id token are missing", () => {
    expect(hasUsableGoogleAuth({ adminSession: { token: "", refreshToken: "" }, googleIdToken: "" })).toBe(false);
  });
});

describe("profile and finance auth helpers", () => {
  it("runs profile silent recovery only when student exists but id token is absent", () => {
    expect(shouldRunProfileSilentRecovery({ googleLinkedStudent: { email: "linus@example.com" }, idToken: "" })).toBe(true);
    expect(shouldRunProfileSilentRecovery({ googleLinkedStudent: { email: "linus@example.com" }, idToken: "id-token" })).toBe(false);
    expect(shouldRunProfileSilentRecovery({ googleLinkedStudent: null, idToken: "" })).toBe(false);
  });

  it("loads finance bootstrap only once per signed-in state", () => {
    expect(shouldLoadFinanceBootstrap({ googleLinkedStudent: { email: "linus@example.com" }, bootstrapLoaded: false })).toBe(true);
    expect(shouldLoadFinanceBootstrap({ googleLinkedStudent: { email: "linus@example.com" }, bootstrapLoaded: true })).toBe(false);
    expect(shouldLoadFinanceBootstrap({ googleLinkedStudent: null, bootstrapLoaded: false })).toBe(false);
  });
});
