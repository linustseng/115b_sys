import React, { Suspense, lazy, useEffect, useState } from "react";
import emblem115b from "../assets/115b_icon.png";
const ApprovalsCenter = lazy(() => import("./ApprovalsCenter"));

function LandingPage({ shared, GoogleSigninPanel, loadStoredGoogleStudent_ }) {
  const {
    apiRequest,
    getGoogleIdTokenSilently_,
    storeGoogleStudent_,
    storeGoogleIdToken_,
    storeAdminSession_,
    clearStoredAuth_,
  } = shared;
  const membershipsCacheTtlMs = 90 * 1000;
  const membershipsCachePrefix = "landing_memberships_cache_v1";
  const birthdaysCacheTtlMs = 6 * 60 * 60 * 1000;
  const birthdaysCachePrefix = "landing_birthdays_v4";
  const approvalsOverviewCacheTtlMs = 45 * 1000;
  const approvalsOverviewCachePrefix = "landing_approvals_overview_v1";
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() =>
    loadStoredGoogleStudent_()
  );
  const initialMembershipCache = (() => {
    try {
      const studentId =
        googleLinkedStudent && googleLinkedStudent.id
          ? String(googleLinkedStudent.id).trim()
          : "";
      const email =
        googleLinkedStudent && googleLinkedStudent.email
          ? String(googleLinkedStudent.email).trim().toLowerCase()
          : "";
      if (!studentId && !email) {
        return { memberships: [], loaded: false };
      }
      const cacheKey = `${membershipsCachePrefix}:${studentId || email}`;
      const cachedRaw = localStorage.getItem(cacheKey);
      if (!cachedRaw) {
        return { memberships: [], loaded: false };
      }
      const cached = JSON.parse(cachedRaw);
      const ts = Number(cached && cached.ts ? cached.ts : 0);
      const memberships =
        cached && Array.isArray(cached.memberships) ? cached.memberships : [];
      if (!memberships.length || Date.now() - ts > membershipsCacheTtlMs) {
        return { memberships: [], loaded: false };
      }
      return { memberships: memberships, loaded: true };
    } catch (error) {
      return { memberships: [], loaded: false };
    }
  })();
  const displayName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    "";
  const hasGoogleLogin = Boolean(googleLinkedStudent && googleLinkedStudent.email);
  const hasAuthMaterial = (() => {
    try {
      const rawSession = window.localStorage.getItem("emba115b.adminSession");
      const session = rawSession ? JSON.parse(rawSession) : null;
      const hasSession = Boolean(
        session && (String(session.refreshToken || "").trim() || String(session.token || "").trim())
      );
      const hasIdToken = Boolean(
        window.sessionStorage.getItem("emba115b.googleIdToken")
      );
      return hasSession || hasIdToken;
    } catch (error) {
      return false;
    }
  })();
  const needsReauth = hasGoogleLogin && !hasAuthMaterial;
  const formatBirthdayName_ = (item) => {
    const zh = String((item && item.nameZh) || "").trim();
    const displayName = String((item && (item.displayName || item.name)) || "").trim();
    if (zh && displayName && zh !== displayName) {
      return `${zh} (${displayName})`;
    }
    return zh || displayName || "未命名";
  };
  const [loginCollapsed, setLoginCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.innerWidth < 768;
  });
  const [showCalendarMobile, setShowCalendarMobile] = useState(() => {
    try {
      const stored = localStorage.getItem("home_calendar_mobile_open");
      if (stored === null) {
        return false;
      }
      return stored === "1";
    } catch (error) {
      return false;
    }
  });
  const [showCalendarDesktop, setShowCalendarDesktop] = useState(false);
  const [copiedStudentId, setCopiedStudentId] = useState(false);
  const [authRecovering, setAuthRecovering] = useState(false);
  const [memberships, setMemberships] = useState(initialMembershipCache.memberships);
  const [membershipsLoaded, setMembershipsLoaded] = useState(initialMembershipCache.loaded);
  const [softballAdminAllowed, setSoftballAdminAllowed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const initialApprovalsOverview = (() => {
    try {
      const studentId =
        googleLinkedStudent && googleLinkedStudent.id
          ? String(googleLinkedStudent.id).trim()
          : "";
      const email =
        googleLinkedStudent && googleLinkedStudent.email
          ? String(googleLinkedStudent.email).trim().toLowerCase()
          : "";
      if (!studentId && !email) {
        return null;
      }
      const cacheKey = `${approvalsOverviewCachePrefix}:${studentId || email}`;
      const raw = localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      const ts = Number(parsed && parsed.ts ? parsed.ts : 0);
      if (!ts || Date.now() - ts > approvalsOverviewCacheTtlMs) {
        return null;
      }
      return {
        pending: Number(parsed.pending || 0),
        inProgress: Number(parsed.inProgress || 0),
        completed: Number(parsed.completed || 0),
        returned: Number(parsed.returned || 0),
        total: Number(parsed.total || 0),
      };
    } catch (error) {
      return null;
    }
  })();
  const [approvalsOverview, setApprovalsOverview] = useState(
    initialApprovalsOverview || { pending: 0, inProgress: 0, completed: 0, returned: 0, total: 0 }
  );
  const [approvalsOverviewLoaded, setApprovalsOverviewLoaded] = useState(Boolean(initialApprovalsOverview));
  const [approvalsOverviewError, setApprovalsOverviewError] = useState("");
  const [showApprovalsCenter, setShowApprovalsCenter] = useState(false);
  const [mountApprovalsCenter, setMountApprovalsCenter] = useState(false);
  const [approvalsDetailTab, setApprovalsDetailTab] = useState("pending");
  const [birthdaySummary, setBirthdaySummary] = useState(() => ({
    currentMonth: new Date().getMonth() + 1,
    nextMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
    current: [],
    next: [],
  }));
  const [birthdaySummaryLoaded, setBirthdaySummaryLoaded] = useState(false);
  const [birthdaySummaryError, setBirthdaySummaryError] = useState("");
  const downgradeToReauthState_ = () => {
    storeGoogleIdToken_("");
    storeAdminSession_(null);
    setMemberships([]);
    setMembershipsLoaded(false);
    setSoftballAdminAllowed(false);
    setNotifications([]);
    setNotificationUnread(0);
    setNotificationError("");
    setApprovalsOverview({ pending: 0, inProgress: 0, completed: 0, returned: 0, total: 0 });
    setApprovalsOverviewLoaded(false);
    setApprovalsOverviewError("");
    setBirthdaySummaryLoaded(false);
    setBirthdaySummaryError("");
    setShowApprovalsCenter(false);
    setMountApprovalsCenter(false);
    setLoginCollapsed(false);
  };

  const handleLogout_ = () => {
    clearStoredAuth_();
    setGoogleLinkedStudent(null);
    setMemberships([]);
    setMembershipsLoaded(false);
    setSoftballAdminAllowed(false);
    setNotifications([]);
    setNotificationUnread(0);
    setNotificationError("");
    setApprovalsOverview({ pending: 0, inProgress: 0, completed: 0, returned: 0, total: 0 });
    setApprovalsOverviewLoaded(false);
    setApprovalsOverviewError("");
    setBirthdaySummaryLoaded(false);
    setBirthdaySummaryError("");
    setShowApprovalsCenter(false);
    setMountApprovalsCenter(false);
    setLoginCollapsed(false);
  };
  const calendarEmbedUrl =
    "https://calendar.google.com/calendar/embed?src=d07db9571997a7592737ae50fc3062ab8a1105d0e3b794ded9672b1e6cd0502a%40group.calendar.google.com&ctz=Asia%2FTaipei";

  useEffect(() => {
    if (!hasGoogleLogin) {
      setLoginCollapsed(false);
    }
  }, [hasGoogleLogin]);

  useEffect(() => {
    if (hasGoogleLogin && !needsReauth) {
      setLoginCollapsed(true);
    }
  }, [hasGoogleLogin, needsReauth]);

  useEffect(() => {
    if (needsReauth) {
      setLoginCollapsed(false);
    }
  }, [needsReauth]);

  useEffect(() => {
    if (!hasGoogleLogin || !needsReauth || authRecovering) {
      return;
    }
    if (typeof getGoogleIdTokenSilently_ !== "function") {
      return;
    }

    let ignore = false;
    const recoverAuth_ = async () => {
      setAuthRecovering(true);
      try {
        const silentToken = await getGoogleIdTokenSilently_();
        const normalizedToken = String(silentToken || "").trim();
        if (!normalizedToken) {
          return;
        }
        storeGoogleIdToken_(normalizedToken);
        const { result } = await apiRequest({ action: "verifyGoogle", idToken: normalizedToken });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "Google 驗證失敗");
        }
        if (ignore) {
          return;
        }
        const data = result.data || {};
        const student = data.student || googleLinkedStudent || null;
        const linkedStudentId = String((student && student.id) || "").trim();
        const sessionToken = String(data.sessionToken || "").trim();
        const refreshToken = String(data.refreshToken || "").trim();
        const memberships = Array.isArray(data.memberships) ? data.memberships : [];

        if (student) {
          storeGoogleStudent_(student);
          setGoogleLinkedStudent(student);
        }
        if (sessionToken && linkedStudentId) {
          storeAdminSession_({
            token: sessionToken,
            refreshToken,
            studentId: linkedStudentId,
            memberships,
          });
          setMemberships(memberships);
          setMembershipsLoaded(true);
        }
      } catch (error) {
        // Silent recovery is best-effort; keep the explicit re-login UI visible.
      } finally {
        if (!ignore) {
          setAuthRecovering(false);
        }
      }
    };

    recoverAuth_();
    return () => {
      ignore = true;
    };
  }, [
    apiRequest,
    authRecovering,
    getGoogleIdTokenSilently_,
    hasGoogleLogin,
    needsReauth,
    googleLinkedStudent,
    storeAdminSession_,
    storeGoogleIdToken_,
    storeGoogleStudent_,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem("home_calendar_mobile_open", showCalendarMobile ? "1" : "0");
    } catch (error) {
      // Ignore write errors (private mode, blocked storage, etc.)
    }
  }, [showCalendarMobile]);

  useEffect(() => {
    if (!hasGoogleLogin || needsReauth) {
      setMemberships([]);
      setMembershipsLoaded(false);
      setSoftballAdminAllowed(false);
      setNotifications([]);
      setNotificationUnread(0);
      setNotificationError("");
      setNotificationLoading(false);
      setApprovalsOverview({ pending: 0, inProgress: 0, completed: 0, returned: 0, total: 0 });
      setApprovalsOverviewLoaded(false);
      setApprovalsOverviewError("");
      setShowApprovalsCenter(false);
      setMountApprovalsCenter(false);
      setBirthdaySummaryLoaded(false);
      setBirthdaySummaryError("");
      return;
    }
    let ignore = false;
    const loadBootstrap = async () => {
      setNotificationLoading(true);
      setNotificationError("");
      let hasValidCachedMemberships = false;
      const studentId = googleLinkedStudent && googleLinkedStudent.id ? String(googleLinkedStudent.id).trim() : "";
      const email = googleLinkedStudent && googleLinkedStudent.email ? String(googleLinkedStudent.email).trim().toLowerCase() : "";
      const cacheKey = `${membershipsCachePrefix}:${studentId || email}`;
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const ts = Number(cached && cached.ts ? cached.ts : 0);
          const items = cached && Array.isArray(cached.memberships) ? cached.memberships : null;
          if (items && Date.now() - ts <= membershipsCacheTtlMs && !ignore) {
            setMemberships(items);
            setMembershipsLoaded(true);
            hasValidCachedMemberships = true;
          }
        }
      } catch (error) {
        // Ignore cache read errors.
      }

      // Memberships drive admin-entry visibility. If we don't have fresh cache yet,
      // fetch them in parallel so entry links appear before notifications finish.
      if (!hasValidCachedMemberships) {
        apiRequest({ action: "listGroupMemberships" })
          .then(({ result }) => {
            if (ignore) {
              return;
            }
            if (!result || !result.ok) {
              if (String((result && result.error) || "") === "Unauthorized") {
                downgradeToReauthState_();
              }
              return;
            }
            const all = result.data && Array.isArray(result.data.memberships) ? result.data.memberships : [];
            const mine = studentId
              ? all.filter((item) => String(item.personId || "").trim() === studentId)
              : [];
            setMemberships(mine);
            setMembershipsLoaded(true);
            try {
              localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), memberships: mine }));
            } catch (error) {
              // Ignore cache write errors.
            }
          })
          .catch(() => {
            // Ignore parallel fallback errors.
          });
      }
      try {
        const { result } = await apiRequest({
          action: "listLandingBootstrap",
          studentId: studentId,
          email: email,
        });
        if (!result.ok) {
          throw new Error(result.error || "載入失敗");
        }
        if (ignore) {
          return;
        }
        const data = result.data || {};
        const mine = Array.isArray(data.memberships) ? data.memberships : [];
        setMemberships(mine);
        setMembershipsLoaded(true);
        setNotifications(data.notifications || []);
        setNotificationUnread(Number(data.unreadCount || 0));
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), memberships: mine }));
        } catch (error) {
          // Ignore cache write errors.
        }
      } catch (error) {
        if (ignore) {
          return;
        }
        const message = String((error && error.message) || "通知載入失敗");
        if (message === "Unauthorized" || message.includes("登入已過期") || message.includes("重新")) {
          downgradeToReauthState_();
          return;
        }
        setNotificationError(message || "通知載入失敗");
        setNotifications([]);
        setNotificationUnread(0);
        if (!hasValidCachedMemberships) {
          setMemberships([]);
          setMembershipsLoaded(true);
        }
      } finally {
        if (!ignore) {
          setNotificationLoading(false);
        }
      }
    };
    loadBootstrap();
    return () => {
      ignore = true;
    };
  }, [apiRequest, hasGoogleLogin, needsReauth, googleLinkedStudent && googleLinkedStudent.id, googleLinkedStudent && googleLinkedStudent.email]);

  useEffect(() => {
    if (!hasGoogleLogin || needsReauth) {
      setSoftballAdminAllowed(false);
      return;
    }
    let ignore = false;
    apiRequest({ action: "getSoftballAdminAccess" })
      .then(({ result }) => {
        if (ignore) {
          return;
        }
        if (result && result.ok) {
          setSoftballAdminAllowed(Boolean(result.data && result.data.allowed));
        } else {
          if (String((result && result.error) || "") === "Unauthorized") {
            downgradeToReauthState_();
            return;
          }
          setSoftballAdminAllowed(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSoftballAdminAllowed(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [apiRequest, hasGoogleLogin, needsReauth, googleLinkedStudent && googleLinkedStudent.id]);

  useEffect(() => {
    if (!hasGoogleLogin || needsReauth) {
      return;
    }
    let ignore = false;
    setBirthdaySummaryError("");
    try {
      const raw = localStorage.getItem(birthdaysCachePrefix);
      if (raw) {
        const parsed = JSON.parse(raw);
        const ts = Number(parsed && parsed.ts ? parsed.ts : 0);
        const currentMonth = Number(parsed && parsed.currentMonth ? parsed.currentMonth : 0);
        const nextMonth = Number(parsed && parsed.nextMonth ? parsed.nextMonth : 0);
        const months = parsed && parsed.months && typeof parsed.months === "object" ? parsed.months : null;
        if (ts && months && Date.now() - ts <= birthdaysCacheTtlMs) {
          const currentList = Array.isArray(months[String(currentMonth)]) ? months[String(currentMonth)] : [];
          const nextList = Array.isArray(months[String(nextMonth)]) ? months[String(nextMonth)] : [];
          setBirthdaySummary({
            currentMonth: currentMonth || new Date().getMonth() + 1,
            nextMonth: nextMonth || (new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2),
            current: currentList,
            next: nextList,
          });
          setBirthdaySummaryLoaded(true);
        }
      }
    } catch (error) {
      // Ignore cache read errors.
    }

    const loadBirthdays = async () => {
      try {
        const { result } = await apiRequest({ action: "listBirthdays" });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "壽星資料載入失敗");
        }
        if (ignore) {
          return;
        }
        const data = result.data || {};
        const months = data.months && typeof data.months === "object" ? data.months : {};
        const currentMonth = Number(data.currentMonth || 0) || new Date().getMonth() + 1;
        const nextMonth = Number(data.nextMonth || 0) || (currentMonth === 12 ? 1 : currentMonth + 1);
        const currentList = Array.isArray(months[String(currentMonth)]) ? months[String(currentMonth)] : [];
        const nextList = Array.isArray(months[String(nextMonth)]) ? months[String(nextMonth)] : [];
        setBirthdaySummary({
          currentMonth: currentMonth,
          nextMonth: nextMonth,
          current: currentList,
          next: nextList,
        });
        setBirthdaySummaryLoaded(true);
        try {
          localStorage.setItem(
            birthdaysCachePrefix,
            JSON.stringify({
              ts: Date.now(),
              months: months,
              currentMonth: currentMonth,
              nextMonth: nextMonth,
            })
          );
        } catch (error) {
          // Ignore cache write errors.
        }
      } catch (error) {
        if (!ignore) {
          setBirthdaySummaryError(error.message || "壽星資料載入失敗");
          setBirthdaySummaryLoaded(true);
        }
      }
    };

    loadBirthdays();
    return () => {
      ignore = true;
    };
  }, [apiRequest, hasGoogleLogin]);

  useEffect(() => {
    if (!hasGoogleLogin || needsReauth) {
      return;
    }
    let ignore = false;
    setApprovalsOverviewError("");
    const studentId = googleLinkedStudent && googleLinkedStudent.id ? String(googleLinkedStudent.id).trim() : "";
    const email =
      googleLinkedStudent && googleLinkedStudent.email
        ? String(googleLinkedStudent.email).trim().toLowerCase()
        : "";
    const cacheKey = `${approvalsOverviewCachePrefix}:${studentId || email}`;
    let hasValidCache = false;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const ts = Number(parsed && parsed.ts ? parsed.ts : 0);
        if (ts && Date.now() - ts <= approvalsOverviewCacheTtlMs) {
          setApprovalsOverview({
            pending: Number(parsed.pending || 0),
            inProgress: Number(parsed.inProgress || 0),
            completed: Number(parsed.completed || 0),
            returned: Number(parsed.returned || 0),
            total: Number(parsed.total || 0),
          });
          setApprovalsOverviewLoaded(true);
          hasValidCache = true;
        }
      }
    } catch (error) {
      // Ignore cache read errors.
    }
    if (!hasValidCache) {
      setApprovalsOverview({ pending: 0, inProgress: 0, completed: 0, returned: 0, total: 0 });
      setApprovalsOverviewLoaded(false);
    }
    const loadOverview = async () => {
      try {
        const { result } = await apiRequest({
          action: "listApprovalsOverview",
          studentId: studentId,
          email: email,
        });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "簽核總覽載入失敗");
        }
        if (ignore) {
          return;
        }
        const data = result.data || {};
        const payload = {
          pending: Number(data.pending || 0),
          inProgress: Number(data.inProgress || 0),
          completed: Number(data.completed || 0),
          returned: Number(data.returned || 0),
          total: Number(data.total || 0),
        };
        setApprovalsOverview(payload);
        setApprovalsOverviewLoaded(true);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), ...payload }));
        } catch (error) {
          // Ignore cache write errors.
        }
      } catch (error) {
        if (ignore) {
          return;
        }
        setApprovalsOverviewError(error.message || "簽核總覽載入失敗");
        setApprovalsOverviewLoaded(true);
      }
    };
    loadOverview();
    return () => {
      ignore = true;
    };
  }, [apiRequest, hasGoogleLogin, googleLinkedStudent && googleLinkedStudent.id, googleLinkedStudent && googleLinkedStudent.email]);

  const markNotificationRead = async (notificationId) => {
    if (!notificationId || !hasGoogleLogin || needsReauth) {
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "markNotificationRead",
        notificationId: notificationId,
        studentId: googleLinkedStudent && googleLinkedStudent.id ? googleLinkedStudent.id : "",
        email: googleLinkedStudent && googleLinkedStudent.email ? googleLinkedStudent.email : "",
      });
      if (!result.ok) {
        return;
      }
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
      );
      setNotificationUnread((prev) => (prev > 0 ? prev - 1 : 0));
    } catch (error) {
      // Ignore read sync failures.
    }
  };

  const markAllNotificationsRead = async () => {
    if (!hasGoogleLogin) {
      return;
    }
    const unreadIds = notifications
      .filter((item) => !item.isRead)
      .map((item) => item.id)
      .filter(Boolean);
    if (!unreadIds.length) {
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "markAllNotificationsRead",
        notificationIds: unreadIds,
        studentId: googleLinkedStudent && googleLinkedStudent.id ? googleLinkedStudent.id : "",
        email: googleLinkedStudent && googleLinkedStudent.email ? googleLinkedStudent.email : "",
      });
      if (!result.ok) {
        return;
      }
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setNotificationUnread(0);
    } catch (error) {
      // Ignore read sync failures.
    }
  };

  const refreshApprovalsOverviewNow_ = async () => {
    if (!hasGoogleLogin || needsReauth) {
      return;
    }
    const studentId = googleLinkedStudent && googleLinkedStudent.id ? String(googleLinkedStudent.id).trim() : "";
    const email =
      googleLinkedStudent && googleLinkedStudent.email
        ? String(googleLinkedStudent.email).trim().toLowerCase()
        : "";
    if (!studentId && !email) {
      return;
    }
    const cacheKey = `${approvalsOverviewCachePrefix}:${studentId || email}`;
    try {
      const { result } = await apiRequest({
        action: "listApprovalsOverview",
        studentId: studentId,
        email: email,
        // Avoid reusing any short-lived in-memory read cache when the user explicitly opens details.
        cacheBuster: Date.now(),
      });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "簽核總覽載入失敗");
      }
      const data = result.data || {};
      const payload = {
        pending: Number(data.pending || 0),
        inProgress: Number(data.inProgress || 0),
        completed: Number(data.completed || 0),
        returned: Number(data.returned || 0),
        total: Number(data.total || 0),
      };
      setApprovalsOverview(payload);
      setApprovalsOverviewLoaded(true);
      setApprovalsOverviewError("");
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), ...payload }));
      } catch (error) {
        // Ignore cache write errors.
      }
    } catch (error) {
      setApprovalsOverviewError(error.message || "簽核總覽載入失敗");
      setApprovalsOverviewLoaded(true);
    }
  };

  const openApprovalsCenter = (targetTab = "pending") => {
    setApprovalsDetailTab(String(targetTab || "pending").trim().toLowerCase());
    setShowApprovalsCenter(true);
    // If the user is expanding details, refresh the summary to avoid "摘要有數字但明細是 0" confusion.
    refreshApprovalsOverviewNow_();
    if (mountApprovalsCenter) {
      return;
    }
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(
        () => {
          setMountApprovalsCenter(true);
        },
        { timeout: 300 }
      );
      return;
    }
    setTimeout(() => setMountApprovalsCenter(true), 0);
  };

  const normalizedId = String((googleLinkedStudent && googleLinkedStudent.id) || "").trim();
  const userMemberships = memberships.filter((item) => {
    const memberId = String(item.personId || "").trim();
    return normalizedId && memberId && normalizedId === memberId;
  });
  const hasGroupAccess_ = (allowedGroupIds) =>
    userMemberships.some((item) => {
      const groupId = String(item.groupId || "").trim();
      const roleInGroup = String(item.roleInGroup || "").trim();
      if (groupId === "A" && (roleInGroup === "lead" || roleInGroup === "deputy")) {
        return true;
      }
      return allowedGroupIds.includes(groupId);
    });
  const canSeeEventAdmin = membershipsLoaded && hasGroupAccess_(["C", "E"]);
  const canSeeOrderingAdmin = membershipsLoaded && hasGroupAccess_(["I", "E"]);
  const canSeeFinanceAdmin = membershipsLoaded && hasGroupAccess_(["D", "E"]);
  const canSeeAcademicsAdmin = membershipsLoaded && hasGroupAccess_(["E", "F"]);
  const canSeeSoftballAdmin = membershipsLoaded && (hasGroupAccess_(["E", "H"]) || softballAdminAllowed);
  const canSeeAdminPortal = membershipsLoaded && hasGroupAccess_(["E"]);
  const pendingApprovalCount = Number(approvalsOverview.pending || 0);
  const inProgressApprovalCount = Number(approvalsOverview.inProgress || 0);
  const returnedApprovalCount = Number(approvalsOverview.returned || 0);
  const hasApprovalAttention =
    approvalsOverviewLoaded &&
    (pendingApprovalCount > 0 || inProgressApprovalCount > 0 || returnedApprovalCount > 0);
  const prioritizeApprovalsFirst = hasApprovalAttention;
  const urgentNotificationCount = notifications.filter((item) => !item.isRead).length;
  const roleBadges = userMemberships
    .map((item) => {
      const groupId = String(item.groupId || "").trim();
      const roleInGroup = String(item.roleInGroup || "").trim();
      if (groupId === "A" && roleInGroup === "lead") {
        return "班代";
      }
      if (groupId === "A" && roleInGroup === "deputy") {
        return "副班代";
      }
      return groupId || null;
    })
    .filter(Boolean);
  const uniqueRoleBadges = Array.from(new Set(roleBadges)).slice(0, 5);
  const systemCards = [
    {
      title: "活動管理",
      description: "報名、簽到與活動資訊一站完成。",
      href: "/events",
      cta: "同學入口",
      adminHref: canSeeEventAdmin ? "/admin/events" : "",
      adminLabel: "管理入口",
      tone: "slate",
      glow: "from-slate-900/10 via-slate-200/30 to-transparent",
    },
    {
      title: "訂餐管理",
      description: "週末與特別課程訂餐，留意截止時間與領餐節奏。",
      href: "/ordering",
      cta: "同學入口",
      adminHref: canSeeOrderingAdmin ? "/admin/ordering" : "",
      adminLabel: "管理入口",
      tone: "amber",
      glow: "from-amber-300/30 via-amber-100/50 to-transparent",
    },
    {
      title: "財務管理",
      description: "請購、請款、零用金與簽核流程入口。",
      href: "/finance",
      cta: "同學入口",
      adminHref: canSeeFinanceAdmin ? "/admin/finance" : "",
      adminLabel: "管理入口",
      tone: "sky",
      glow: "from-sky-300/30 via-sky-100/50 to-transparent",
    },
    {
      title: "學藝專區",
      description: "補課登記、課程摘要與筆記入口。",
      href: "/academics",
      cta: "同學入口",
      adminHref: canSeeAcademicsAdmin ? "/admin/academics" : "",
      adminLabel: "管理入口",
      tone: "violet",
      glow: "from-violet-300/30 via-violet-100/50 to-transparent",
    },
    {
      title: "壘球隊管理",
      description: "練習排程、點名、出席統計與球員入口。",
      href: "/softball/player",
      cta: "球員入口",
      adminHref: canSeeSoftballAdmin ? "/softball" : "",
      adminLabel: "管理入口",
      tone: "emerald",
      glow: "from-emerald-300/30 via-emerald-100/50 to-transparent",
    },
  ];

  const birthdaySection = (
    <section className="entrance entrance-delay-3 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">壽星專區</h2>
          <p className="mt-1 text-xs text-slate-500">每月初可快速查看壽星名單並複製慶生文案。</p>
        </div>
        <a
          href="/birthdays"
          className="inline-flex h-10 items-center rounded-full border border-pink-200 bg-pink-50 px-4 text-xs font-semibold text-pink-700 hover:border-pink-300"
        >
          前往壽星專區
        </a>
      </div>
      {!hasGoogleLogin ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          請先登入 Google，即可查看每月壽星與複製慶生文案。
        </div>
      ) : !birthdaySummaryLoaded ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="h-20 rounded-2xl bg-slate-100/70" />
          <div className="h-20 rounded-2xl bg-slate-100/70" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-pink-200/80 bg-pink-50/60 px-4 py-3">
            <p className="text-xs font-semibold text-pink-700">
              本月 {birthdaySummary.currentMonth} 月壽星
            </p>
            <p className="mt-1 text-sm font-semibold text-pink-900">
              {birthdaySummary.current.length ? `${birthdaySummary.current.length} 位` : "目前無壽星"}
            </p>
            {birthdaySummary.current.length ? (
              <p className="mt-2 text-xs text-pink-800/90">
                {birthdaySummary.current
                  .slice(0, 5)
                  .map((item) => `${formatBirthdayName_(item)} ${item.month}/${item.day}`)
                  .join("、")}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700">
              下月 {birthdaySummary.nextMonth} 月壽星
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-900">
              {birthdaySummary.next.length ? `${birthdaySummary.next.length} 位` : "目前無壽星"}
            </p>
            {birthdaySummary.next.length ? (
              <p className="mt-2 text-xs text-amber-800/90">
                {birthdaySummary.next
                  .slice(0, 5)
                  .map((item) => `${formatBirthdayName_(item)} ${item.month}/${item.day}`)
                  .join("、")}
              </p>
            ) : null}
          </div>
        </div>
      )}
      {birthdaySummaryError ? (
        <p className="mt-3 text-xs text-rose-600">{birthdaySummaryError}</p>
      ) : null}
    </section>
  );

  const approvalsSection = (
    <section className="entrance entrance-delay-3 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">簽核摘要</h2>
        {!showApprovalsCenter ? (
          <button
            type="button"
            onClick={openApprovalsCenter}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            查看詳細簽核
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowApprovalsCenter(false)}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
          >
            收合詳細簽核
          </button>
        )}
      </div>

      {hasApprovalAttention && pendingApprovalCount > 0 ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
          你目前有 {pendingApprovalCount} 筆待簽核，請優先處理。
        </div>
      ) : null}
      {hasApprovalAttention && pendingApprovalCount === 0 && (inProgressApprovalCount > 0 || returnedApprovalCount > 0) ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
          你有簽核流程進行中或退回補件，建議先查看。
        </div>
      ) : null}

      {!approvalsOverviewLoaded ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="h-20 rounded-2xl bg-slate-100/70" />
          <div className="h-20 rounded-2xl bg-slate-100/70" />
          <div className="h-20 rounded-2xl bg-slate-100/70" />
          <div className="h-20 rounded-2xl bg-slate-100/70" />
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => openApprovalsCenter("pending")}
              className="rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 text-left hover:border-rose-300"
            >
              <p className="text-[11px] font-semibold text-rose-700">待我簽核</p>
              <p className="mt-2 text-xl font-semibold text-rose-900">{approvalsOverview.pending}</p>
            </button>
            <button
              type="button"
              onClick={() => openApprovalsCenter("inprogress")}
              className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-left hover:border-amber-300"
            >
              <p className="text-[11px] font-semibold text-amber-700">處理中</p>
              <p className="mt-2 text-xl font-semibold text-amber-900">{approvalsOverview.inProgress}</p>
            </button>
            <button
              type="button"
              onClick={() => openApprovalsCenter("completed")}
              className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-left hover:border-emerald-300"
            >
              <p className="text-[11px] font-semibold text-emerald-700">已結案</p>
              <p className="mt-2 text-xl font-semibold text-emerald-900">{approvalsOverview.completed}</p>
            </button>
            <button
              type="button"
              onClick={() => openApprovalsCenter("returned")}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-left hover:border-slate-300"
            >
              <p className="text-[11px] font-semibold text-slate-600">退回補件</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{approvalsOverview.returned}</p>
            </button>
          </div>
          {approvalsOverviewError ? (
            <p className="mt-3 text-xs text-rose-600">{approvalsOverviewError}</p>
          ) : null}
        </div>
      )}

      {showApprovalsCenter ? (
        <div className="mt-5 border-t border-slate-200/80 pt-5">
          {mountApprovalsCenter ? (
            <Suspense
              fallback={
                <div className="space-y-3">
                  <div className="h-6 w-28 rounded-full bg-slate-100" />
                  <div className="h-16 rounded-2xl bg-slate-100/70" />
                  <div className="h-16 rounded-2xl bg-slate-100/70" />
                </div>
              }
            >
              <ApprovalsCenter
                shared={shared}
                embedded
                requestId=""
                initialTab={approvalsDetailTab}
              />
            </Suspense>
          ) : (
            <div className="space-y-3">
              <div className="h-6 w-28 rounded-full bg-slate-100" />
              <div className="h-16 rounded-2xl bg-slate-100/70" />
              <div className="h-16 rounded-2xl bg-slate-100/70" />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="relative px-6 pt-8 sm:px-12 entrance">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.82)_0%,_rgba(248,250,252,0)_100%)]" />
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 shadow-sm backdrop-blur">
                NTU EMBA 115B
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 shadow-sm backdrop-blur">
                共學 · 共餐 · 共練
              </span>
              {hasApprovalAttention ? (
                <button
                  type="button"
                  onClick={() => openApprovalsCenter("pending")}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 shadow-sm"
                >
                  {pendingApprovalCount > 0 ? `${pendingApprovalCount} 筆待簽核` : "有簽核待追蹤"}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNotificationOpen(true)}
                className="relative rounded-full border border-slate-300/80 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur hover:border-slate-400"
              >
                通知中心
                {notificationUnread > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {notificationUnread > 99 ? "99+" : notificationUnread}
                  </span>
                ) : null}
              </button>
              <a
                href="/profile"
                className="rounded-full border border-slate-300/80 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur hover:border-slate-400"
              >
                個人資訊維護
              </a>
              {canSeeAdminPortal ? (
                <a
                  href="/admin"
                  className="rounded-full border border-slate-300/80 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  系統後台
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
            <section className="relative overflow-hidden rounded-[2.6rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.97)_0%,rgba(30,41,59,0.92)_48%,rgba(51,65,85,0.9)_100%)] p-6 text-white shadow-[0_45px_120px_-60px_rgba(15,23,42,0.85)] sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.14),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.18),transparent_24%),linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.06)_48%,transparent_72%)]" />
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] border border-white/15 bg-white/10 shadow-[0_25px_60px_-35px_rgba(255,255,255,0.35)] backdrop-blur">
                    <img
                      src={emblem115b}
                      alt="NTU EMBA 115B"
                      className="h-11 w-11 rounded-2xl bg-white/95 p-1"
                    />
                  </div>
                  <div className="max-w-3xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-300">
                      NTU EMBA 115B DIGITAL COMMONS
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-5xl">
                      115B 班級系統
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                      把活動、訂餐、財務、學藝與球隊協作整合成同一個班級入口。
                      手機可快速處理，後台也能穩定管理，是 115B 的日常數位中樞。
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.8rem] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">我的狀態</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {hasGoogleLogin ? (displayName || "已綁定") : "尚未登入"}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {hasGoogleLogin ? (needsReauth ? "需要重新登入以恢復完整功能" : "Google 已連結，可使用完整功能") : "登入後可使用活動、訂餐與通知"}
                    </p>
                  </div>
                  <div className="rounded-[1.8rem] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">待注意事項</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {approvalsOverviewLoaded ? pendingApprovalCount + returnedApprovalCount : "--"}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {approvalsOverviewLoaded ? "待簽核 + 退回補件" : "正在載入簽核摘要"}
                    </p>
                  </div>
                  <div className="rounded-[1.8rem] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">未讀通知</p>
                    <p className="mt-2 text-lg font-semibold text-white">{hasGoogleLogin ? urgentNotificationCount : "--"}</p>
                    <p className="mt-1 text-xs text-slate-300">
                      {hasGoogleLogin ? "通知中心與待辦提醒" : "登入後可查看個人通知"}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a href="/events" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-950/20 hover:-translate-y-0.5">
                    進入班級入口
                  </a>
                  <a href="/ordering" className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15">
                    查看本週訂餐
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowCalendarDesktop((prev) => !prev)}
                    className="hidden rounded-full border border-white/15 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 sm:inline-flex"
                  >
                    {showCalendarDesktop ? "收合班級行事曆" : "展開班級行事曆"}
                  </button>
                </div>
              </div>
            </section>

            <aside className="rounded-[2.2rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_35px_90px_-70px_rgba(15,23,42,0.75)] backdrop-blur sm:p-6">
              {hasGoogleLogin ? (
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-100 shadow-sm">
                    {googleLinkedStudent.photoUrl ? (
                      <img src={googleLinkedStudent.photoUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                        {displayName ? displayName.slice(0, 2) : "NT"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Identity</p>
                    <p className="mt-2 truncate text-xl font-semibold text-slate-900">
                      {displayName ? displayName : "已綁定"}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">{googleLinkedStudent.email}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${needsReauth ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                        {needsReauth ? "需重新登入" : "已登入"}
                      </span>
                      {uniqueRoleBadges.length
                        ? uniqueRoleBadges.map((label) => (
                            <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                              {label}
                            </span>
                          ))
                        : null}
                    </div>
                    {googleLinkedStudent.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(googleLinkedStudent.id);
                          setCopiedStudentId(true);
                          setTimeout(() => {
                            setCopiedStudentId(false);
                          }, 1500);
                        }}
                        className="mt-3 text-xs text-slate-500 transition hover:text-slate-700"
                        title="點擊複製學號"
                      >
                        學號：{googleLinkedStudent.id}
                        {copiedStudentId ? <span className="ml-2 text-emerald-600">已複製</span> : null}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Identity</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">尚未登入 Google</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    登入後即可使用班級功能、查看通知與帶入個人資料。
                  </p>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick status</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>通知未讀</span>
                      <span className="font-semibold text-slate-900">{hasGoogleLogin ? urgentNotificationCount : "--"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>待簽核</span>
                      <span className="font-semibold text-slate-900">{approvalsOverviewLoaded ? pendingApprovalCount : "--"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>進行中</span>
                      <span className="font-semibold text-slate-900">{approvalsOverviewLoaded ? inProgressApprovalCount : "--"}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.85))] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">Recommended next</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {hasApprovalAttention
                      ? "先處理簽核與補件，避免流程卡住。"
                      : hasGoogleLogin
                        ? "今天可先看通知、壽星與近期行事曆。"
                        : "先完成 Google 綁定，之後進各模組會更順。"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => (hasApprovalAttention ? openApprovalsCenter("pending") : setNotificationOpen(true))}
                      className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 shadow-sm hover:border-amber-400"
                    >
                      {hasApprovalAttention ? "查看簽核" : "查看通知"}
                    </button>
                    {!hasGoogleLogin || needsReauth ? (
                      <button
                        type="button"
                        onClick={() => setLoginCollapsed(false)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-slate-300"
                      >
                        前往登入
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {hasGoogleLogin ? (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLogout_}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                  >
                    登出
                  </button>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-32 pt-6 sm:px-12 sm:pb-24">
        {!hasGoogleLogin || needsReauth ? (
          <section className="entrance entrance-delay-1 mb-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_80px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Google 登入</h2>
              <button
                type="button"
                onClick={() => setLoginCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
              >
                {loginCollapsed ? "展開 ▼" : "收合 ▲"}
              </button>
            </div>
            {!loginCollapsed ? (
              <>
                <div className="mt-4">
                  <GoogleSigninPanel
                    title={needsReauth ? "重新登入" : "Google 登入"}
                    helperText={
                      needsReauth
                        ? authRecovering
                          ? "正在嘗試自動恢復登入狀態；若稍後仍未恢復，再手動重新登入。"
                          : "偵測到已綁定同學資料，但登入憑證已過期。請重新登入以恢復壽星、簽核與通知等功能。"
                        : "請先完成綁定，才能使用活動、訂餐與壘球功能。"
                    }
                    onLinkedStudent={(student, _profile, _idToken, authContext) => {
                      setGoogleLinkedStudent(student);
                      const linkedStudentId = String((student && student.id) || "").trim();
                      const sessionToken = String((authContext && authContext.sessionToken) || "").trim();
                      const refreshToken = String((authContext && authContext.refreshToken) || "").trim();
                      const memberships =
                        authContext && Array.isArray(authContext.memberships) ? authContext.memberships : [];
                      if (sessionToken && linkedStudentId) {
                        storeAdminSession_({
                          token: sessionToken,
                          refreshToken,
                          studentId: linkedStudentId,
                          memberships,
                        });
                      }
                    }}
                  />
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  登入後會儲存在本機，後續進入各系統會自動帶入。
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 sm:gap-5 lg:grid-cols-2 xl:grid-cols-5">
          {systemCards.map((card, index) => (
            <div
              key={card.title}
              className={`entrance group relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.75)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_35px_90px_-60px_rgba(15,23,42,0.45)] sm:p-6 ${index === 0 ? "entrance-delay-3" : "entrance-delay-4"}`}
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${card.glow}`} />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                    核心模組
                  </span>
                  {card.adminHref ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      含管理入口
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-6 text-[22px] font-semibold tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
              </div>
              <div className="relative mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={card.href}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
                >
                  {card.cta}
                  <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
                </a>
                {card.adminHref ? (
                  <a
                    href={card.adminHref}
                    className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
                  >
                    {card.adminLabel}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </section>

        {prioritizeApprovalsFirst ? (
          <>
            {approvalsSection}
            {birthdaySection}
          </>
        ) : (
          <>
            {birthdaySection}
            {approvalsSection}
          </>
        )}

        {hasGoogleLogin ? (
          <section className="entrance entrance-delay-2 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Google 登入</h2>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  已登入
                </span>
                <span className="text-xs text-slate-500">{googleLinkedStudent.email}</span>
                <button
                  type="button"
                  onClick={() => setLoginCollapsed((prev) => !prev)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                >
                  {loginCollapsed ? "展開 ▼" : "收合 ▲"}
                </button>
              </div>
            </div>
            {!loginCollapsed ? (
              <>
                <div className="mt-4">
                  <div className="alert alert-success text-xs px-4 py-2">已登入 Google</div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  登入後會儲存在本機，後續進入活動、訂餐與壘球系統會自動帶入。
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="entrance entrance-delay-3 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">班級行李曆</h2>
              <p className="mt-2 text-sm text-slate-500">
                共用行李曆同步最新活動安排，手機可收合或新視窗查看。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCalendarMobile((prev) => !prev)}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 sm:hidden"
              >
                {showCalendarMobile ? "收合行李曆" : "展開行李曆"}
              </button>
              <button
                type="button"
                onClick={() => setShowCalendarDesktop((prev) => !prev)}
                className="btn-chip hidden sm:inline-flex"
              >
                {showCalendarDesktop ? "收合行李曆" : "載入行李曆"}
              </button>
              <a
                href={calendarEmbedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                在新視窗開啟
              </a>
            </div>
          </div>

          {!showCalendarMobile ? (
            <div className="mt-4 alert alert-info text-xs text-slate-500 sm:hidden">
              為了保持手機順暢，可先收合行李曆。
            </div>
          ) : null}

          {showCalendarMobile ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white sm:hidden">
              <iframe
                title="班級行李曆（手機）"
                src={calendarEmbedUrl}
                className="h-[480px] w-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer"
                scrolling="no"
              />
            </div>
          ) : null}

          {showCalendarDesktop ? (
            <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white sm:block">
              <iframe
                title="班級行李曆"
                src={calendarEmbedUrl}
                className="h-[560px] w-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer"
                scrolling="no"
              />
            </div>
          ) : (
            <div className="mt-6 hidden rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:block">
              行李曆為內嵌內容，點選「載入行李曆」可加速首頁載入。
            </div>
          )}
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-6 px-2 py-2">
          <a href="/" className="py-1 text-center text-[11px] font-semibold text-slate-700">
            首頁
          </a>
          <a
            href="/events"
            className="py-1 text-center text-[11px] font-semibold text-slate-700"
          >
            活動
          </a>
          <a
            href="/ordering"
            className="py-1 text-center text-[11px] font-semibold text-slate-700"
          >
            訂餐
          </a>
          <a
            href="/finance"
            className="py-1 text-center text-[11px] font-semibold text-slate-700"
          >
            財務
          </a>
          <a
            href="/birthdays"
            className="py-1 text-center text-[11px] font-semibold text-slate-700"
          >
            壽星
          </a>
          <a href="/profile" className="py-1 text-center text-[11px] font-semibold text-slate-700">
            個人
          </a>
        </div>
      </nav>

      {notificationOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40">
          <div className="absolute inset-0" onClick={() => setNotificationOpen(false)} aria-hidden="true" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl sm:w-[420px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">通知中心</h2>
              <div className="flex items-center gap-2">
                {hasGoogleLogin ? (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                  >
                    全部已讀
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setNotificationOpen(false)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                >
                  關閉
                </button>
              </div>
            </div>

            {notificationLoading ? <p className="mt-4 text-xs text-slate-500">載入通知中...</p> : null}
            {notificationError ? <p className="mt-4 text-xs text-rose-600">{notificationError}</p> : null}

            {!notificationLoading && !notificationError ? (
              <div className="mt-4 space-y-4">
                {!notifications.length ? (
                  <div className="alert alert-info text-xs">目前沒有新的待辦或公告。</div>
                ) : null}
                {notifications.map((item) => {
                  const targetUrl = item.ctaUrl || item.url;
                  const isTodo = item.kind === "todo";
                  const handleNavigate = () => {
                    if (!targetUrl) {
                      return;
                    }
                    setNotificationOpen(false);
                    if (!isTodo && !item.isRead && hasGoogleLogin) {
                      markNotificationRead(item.id);
                    }
                    window.location.href = targetUrl;
                  };

                  return (
                    <div
                      key={item.id}
                      role={targetUrl ? "link" : undefined}
                      tabIndex={targetUrl ? 0 : undefined}
                      onClick={targetUrl ? handleNavigate : undefined}
                      onKeyDown={
                        targetUrl
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleNavigate();
                              }
                            }
                          : undefined
                      }
                      className={`rounded-2xl border p-3 ${
                        item.isRead ? "border-slate-200 bg-slate-50/50" : "border-slate-300 bg-white"
                      } ${targetUrl ? "cursor-pointer hover:border-slate-400 hover:bg-slate-50/70" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title || "通知"}</p>
                          <p className="mt-1 text-xs text-slate-600">{item.message || ""}</p>
                        </div>

                        {isTodo ? (
                          <span className="text-[10px] font-semibold text-amber-700">待處理</span>
                        ) : !item.isRead && hasGoogleLogin ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              markNotificationRead(item.id);
                            }}
                            className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-slate-300"
                          >
                            已讀
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {item.isRead ? "已讀" : "未讀"}
                          </span>
                        )}
                      </div>

                      {targetUrl ? (
                        <a
                          href={targetUrl}
                          onClick={(event) => {
                            event.stopPropagation();
                            setNotificationOpen(false);
                            if (!isTodo && !item.isRead && hasGoogleLogin) {
                              markNotificationRead(item.id);
                            }
                          }}
                          className="mt-2 inline-flex items-center text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                        >
                          {item.ctaLabel || "前往處理"}
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export default LandingPage;
