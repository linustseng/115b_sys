function hasTruthy(value) {
  return Boolean(String(value || "").trim());
}

export function computeLandingAuthState({ googleLinkedStudent, hasAuthMaterial, authRestoreResolved, authRecovering }) {
  const hasGoogleLogin = Boolean(googleLinkedStudent && googleLinkedStudent.email);
  const needsReauth = hasGoogleLogin && !hasAuthMaterial;
  const authRestoring = hasGoogleLogin && needsReauth && (!authRestoreResolved || authRecovering);
  const shouldShowReauthPrompt = hasGoogleLogin && needsReauth && authRestoreResolved && !authRecovering;
  return {
    hasGoogleLogin,
    needsReauth,
    authRestoring,
    shouldShowReauthPrompt,
  };
}

export function hasUsableGoogleAuth({ adminSession, googleIdToken }) {
  const session = adminSession || {};
  const hasSession = hasTruthy(session.refreshToken) || hasTruthy(session.token);
  const hasIdToken = hasTruthy(googleIdToken);
  return hasSession || hasIdToken;
}

export function computeHomeAuthState({ googleLinkedStudent, adminSession, googleIdToken }) {
  const usableAuth = hasUsableGoogleAuth({ adminSession, googleIdToken });
  const effectiveGoogleLinkedStudent =
    googleLinkedStudent && googleLinkedStudent.email && usableAuth ? googleLinkedStudent : null;
  return {
    usableAuth,
    effectiveGoogleLinkedStudent,
    canLookupRegistrations: Boolean(effectiveGoogleLinkedStudent && effectiveGoogleLinkedStudent.email),
  };
}

export function shouldRunProfileSilentRecovery({ googleLinkedStudent, idToken }) {
  return Boolean(!idToken && googleLinkedStudent && googleLinkedStudent.email);
}

export function shouldLoadFinanceBootstrap({ googleLinkedStudent, bootstrapLoaded }) {
  return Boolean(googleLinkedStudent && googleLinkedStudent.email && !bootstrapLoaded);
}
