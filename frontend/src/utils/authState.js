const AUTH_STORAGE_VERSION = 1;

export function emptyAdminSession() {
  return { token: "", refreshToken: "", studentId: "", memberships: [] };
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

export function normalizeGoogleStudent(student) {
  if (!student || typeof student !== "object") {
    return null;
  }
  const id = normalizeString(student.id);
  const email = normalizeEmail(student.email);
  if (!id && !email) {
    return null;
  }
  return {
    ...student,
    id,
    email,
  };
}

export function normalizeAdminSession(session) {
  if (!session || typeof session !== "object") {
    return emptyAdminSession();
  }
  const token = normalizeString(session.token);
  const refreshToken = normalizeString(session.refreshToken);
  const studentId = normalizeString(session.studentId);
  const studentEmail = normalizeEmail(session.studentEmail);
  const memberships = Array.isArray(session.memberships) ? session.memberships : [];
  if (!token && !refreshToken) {
    return emptyAdminSession();
  }
  return {
    token,
    refreshToken,
    studentId,
    studentEmail,
    memberships,
  };
}

export function evaluateStoredAuthState({ googleStudent, googleIdToken, adminSession }) {
  const normalizedStudent = normalizeGoogleStudent(googleStudent);
  const normalizedSession = normalizeAdminSession(adminSession);
  const normalizedIdToken = normalizeString(googleIdToken);
  const hasStudent = Boolean(normalizedStudent);
  const hasIdToken = Boolean(normalizedIdToken);
  const hasSession = Boolean(normalizedSession.token || normalizedSession.refreshToken);
  const reasons = [];

  const studentIdMismatch = Boolean(
    hasStudent && normalizedSession.studentId && normalizedStudent.id && normalizedSession.studentId !== normalizedStudent.id
  );
  const studentEmailMismatch = Boolean(
    hasStudent &&
      normalizedSession.studentEmail &&
      normalizedStudent.email &&
      normalizedSession.studentEmail !== normalizedStudent.email
  );
  const orphanedSession = Boolean(!hasStudent && hasSession && !hasIdToken);

  if (studentIdMismatch) {
    reasons.push("student_id_mismatch");
  }
  if (studentEmailMismatch) {
    reasons.push("student_email_mismatch");
  }
  if (orphanedSession) {
    reasons.push("orphaned_session_without_student_or_id_token");
  }

  const clearAllAuth = studentIdMismatch || studentEmailMismatch;
  const clearSessionOnly = !clearAllAuth && orphanedSession;

  return {
    version: AUTH_STORAGE_VERSION,
    googleStudent: normalizedStudent,
    googleIdToken: normalizedIdToken,
    adminSession: normalizedSession,
    hasStudent,
    hasIdToken,
    hasSession,
    reasons,
    clearGoogleStudent: clearAllAuth,
    clearGoogleIdToken: clearAllAuth,
    clearAdminSession: clearAllAuth || clearSessionOnly,
    clearAllAuth,
    clearSessionOnly,
  };
}

export function sanitizeBrowserStoredAuthState(storageKeys, win = window) {
  if (!win || !storageKeys) {
    return { changed: false, reasons: [] };
  }

  let googleStudent = null;
  let googleIdToken = "";
  let adminSession = null;

  try {
    const raw = win.localStorage.getItem(storageKeys.googleStudent);
    if (raw) {
      const parsed = JSON.parse(raw);
      googleStudent = parsed && parsed.student ? parsed.student : null;
    }
  } catch (error) {
    googleStudent = null;
  }

  try {
    const raw = win.sessionStorage.getItem(storageKeys.googleIdToken);
    if (raw) {
      const parsed = JSON.parse(raw);
      googleIdToken = parsed && parsed.token ? String(parsed.token) : "";
    }
  } catch (error) {
    googleIdToken = "";
  }

  try {
    const raw = win.localStorage.getItem(storageKeys.adminSession);
    if (raw) {
      adminSession = JSON.parse(raw);
    }
  } catch (error) {
    adminSession = null;
  }

  const evaluation = evaluateStoredAuthState({ googleStudent, googleIdToken, adminSession });
  let changed = false;

  if (evaluation.clearGoogleStudent) {
    try {
      win.localStorage.removeItem(storageKeys.googleStudent);
      changed = true;
    } catch (error) {
      // ignore
    }
  }
  if (evaluation.clearGoogleIdToken) {
    try {
      win.sessionStorage.removeItem(storageKeys.googleIdToken);
      changed = true;
    } catch (error) {
      // ignore
    }
  }
  if (evaluation.clearAdminSession) {
    try {
      win.localStorage.removeItem(storageKeys.adminSession);
      changed = true;
    } catch (error) {
      // ignore
    }
  }

  return { changed, reasons: evaluation.reasons, evaluation };
}
