import React, { Suspense, lazy, useEffect, useState } from "react";
import { computeLandingAuthState, shouldAttemptLandingAuthRecovery } from "../utils/authPageState";
import emblem115b from "../assets/115b_icon.png";
const ApprovalsCenter = lazy(() => import("./ApprovalsCenter"));

function NationalTeamCrest({ team }) {
  const isSpain = team === "spain";
  const label = isSpain ? "西班牙" : "阿根廷";
  const colors = isSpain
    ? { outer: "#A61C2D", inner: "#F6C445", detail: "#A61C2D" }
    : { outer: "#71B8E7", inner: "#FFFFFF", detail: "#F3B63D" };

  return (
    <div
      className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-b-[1.35rem] rounded-t-[1rem] border-2 shadow-lg sm:h-20 sm:w-[4.5rem]"
      style={{ backgroundColor: colors.outer, borderColor: colors.inner }}
      aria-label={`${label} 隊徽`}
      title={`${label} 隊徽`}
    >
      {isSpain ? (
        <>
          <span className="absolute inset-x-0 top-[31%] h-[34%] bg-[#F6C445]" />
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#F6C445] bg-[#A61C2D] text-[10px] font-black text-[#F6C445] sm:h-8 sm:w-8">ES</span>
        </>
      ) : (
        <>
          <span className="absolute inset-x-0 top-0 h-1/3 bg-[#71B8E7]" />
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-[#71B8E7]" />
          <span className="relative text-xl text-[#F3B63D] sm:text-2xl">☀</span>
        </>
      )}
    </div>
  );
}

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
  const [authRestoreResolved, setAuthRestoreResolved] = useState(true);
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
  const [copiedMyEmbaAccount, setCopiedMyEmbaAccount] = useState(false);
  const [authRecovering, setAuthRecovering] = useState(false);
  const [reauthBannerMessage, setReauthBannerMessage] = useState("");
  const { needsReauth, authRestoring, shouldShowReauthPrompt } = computeLandingAuthState({
    googleLinkedStudent,
    hasAuthMaterial,
    authRestoreResolved,
    authRecovering,
  });
  const [memberships, setMemberships] = useState(initialMembershipCache.memberships);
  const [membershipsLoaded, setMembershipsLoaded] = useState(initialMembershipCache.loaded);
  const [softballAdminAllowed, setSoftballAdminAllowed] = useState(false);
  const [cheerleadingAdminAllowed, setCheerleadingAdminAllowed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [worldCupStats] = useState(null);
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
  const shouldDowngradeToReauthState_ = (message) => {
    const normalized = String(message || "").trim();
    const lower = normalized.toLowerCase();
    return Boolean(
      normalized === "Unauthorized" ||
        normalized.includes("登入已過期") ||
        normalized.includes("重新登入") ||
        normalized.includes("請重新") ||
        lower.includes("invalid google token") ||
        lower.includes("google 驗證失敗") ||
        lower.includes("silent login unavailable") ||
        lower.includes("no credential") ||
        lower.includes("fedcm")
    );
  };
  const downgradeToReauthState_ = () => {
    setAuthRestoreResolved(true);
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
    // Google Identity Services no longer supports a truly silent ID-token refresh for this flow.
    // Keep expired cached profiles in the explicit re-login state instead of briefly showing
    // an automatic recovery state that cannot actually complete without user interaction.
    setAuthRestoreResolved(true);
  }, [hasGoogleLogin, hasAuthMaterial]);

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
    if (shouldShowReauthPrompt) {
      setLoginCollapsed(false);
    }
  }, [shouldShowReauthPrompt]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const search = new URLSearchParams(window.location.search || "");
    const hintedReauth = search.get("reauth") === "1";
    let reason = "";
    try {
      const raw = window.sessionStorage.getItem("emba115b.reauth_reason");
      if (raw) {
        const parsed = JSON.parse(raw);
        reason = String((parsed && parsed.reason) || "").trim();
        window.sessionStorage.removeItem("emba115b.reauth_reason");
      }
    } catch (error) {
      // Ignore storage failures.
    }
    if (!hintedReauth && !reason) {
      return;
    }
    setReauthBannerMessage(
      shouldDowngradeToReauthState_(reason)
        ? "登入狀態已失效，請重新登入後再繼續使用。"
        : "目前需要重新登入後才能繼續使用。"
    );
    if (hintedReauth) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("reauth");
      nextUrl.searchParams.delete("from");
      window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  }, []);

  useEffect(() => {
    if (
      !shouldAttemptLandingAuthRecovery({
        hasGoogleLogin,
        needsReauth,
        authRestoreResolved,
        authRecovering,
      })
    ) {
      return;
    }
    if (typeof getGoogleIdTokenSilently_ !== "function") {
      setAuthRestoreResolved(true);
      return;
    }

    let ignore = false;
    const recoverAuth_ = async () => {
      setAuthRestoreResolved(false);
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
            studentEmail: String((student && student.email) || "").trim().toLowerCase(),
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
          setAuthRestoreResolved(true);
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
    authRestoreResolved,
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
              if (shouldDowngradeToReauthState_(String((result && result.error) || ""))) {
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
        if (shouldDowngradeToReauthState_(message)) {
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
          if (shouldDowngradeToReauthState_(String((result && result.error) || ""))) {
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
      setCheerleadingAdminAllowed(false);
      return;
    }
    let ignore = false;
    apiRequest({ action: "getCheerleadingAdminAccess" })
      .then(({ result }) => {
        if (ignore) {
          return;
        }
        if (result && result.ok) {
          setCheerleadingAdminAllowed(Boolean(result.data && result.data.allowed));
        } else {
          if (shouldDowngradeToReauthState_(String((result && result.error) || ""))) {
            downgradeToReauthState_();
            return;
          }
          setCheerleadingAdminAllowed(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCheerleadingAdminAllowed(false);
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
  // The dedicated access check is authoritative.  Do not hide the entrance while
  // the separate membership bootstrap is still loading (or recovering a session).
  const canSeeCheerleadingAdmin =
    cheerleadingAdminAllowed || (membershipsLoaded && hasGroupAccess_(["E", "L"]));
  const canSeeAdminPortal = membershipsLoaded && hasGroupAccess_(["E"]);
  const pendingApprovalCount = Number(approvalsOverview.pending || 0);
  const inProgressApprovalCount = Number(approvalsOverview.inProgress || 0);
  const returnedApprovalCount = Number(approvalsOverview.returned || 0);
  const hasApprovalAttention =
    approvalsOverviewLoaded &&
    (pendingApprovalCount > 0 || inProgressApprovalCount > 0 || returnedApprovalCount > 0);
  const prioritizeApprovalsFirst = hasApprovalAttention;

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
                {birthdaySummary.current.map((item) => `${formatBirthdayName_(item)} ${item.month}/${item.day}`).join("、")}
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
                {birthdaySummary.next.map((item) => `${formatBirthdayName_(item)} ${item.month}/${item.day}`).join("、")}
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
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12 entrance">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-4">
              <img
                src={emblem115b}
                alt="NTU EMBA 115B"
                className="h-12 w-12 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  NTU EMBA 115B
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                  NTU EMBA 115B 班級系統
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              共學 · 共餐 · 共練 · 2026-2028 and forever
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNotificationOpen(true)}
                className="relative rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                通知
                {notificationUnread > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {notificationUnread > 99 ? "99+" : notificationUnread}
                  </span>
                ) : null}
              </button>
              <a
                href="/profile"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-slate-400"
              >
                個人資訊維護
              </a>
              <a
                href="/quick-links"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-slate-400"
              >
                常用鏈結
              </a>
              {canSeeAdminPortal ? (
                <>
                  <a
                    href="/admin/storage-monitoring"
                    className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-800 shadow-sm hover:border-cyan-300"
                  >
                    儲存監控
                  </a>
                  <a
                    href="/admin"
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-400"
                  >
                    系統後台
                  </a>
                </>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-5 py-4 text-xs text-slate-600 shadow-sm">
              {hasGoogleLogin ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {googleLinkedStudent.photoUrl ? (
                      <img
                        src={googleLinkedStudent.photoUrl}
                        alt="avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                        {displayName ? displayName.slice(0, 2) : "NT"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">
                      {displayName ? displayName : "已綁定"}
                      <span className="ml-2 text-xs font-semibold text-slate-500">
                        {authRestoring ? "恢復中" : shouldShowReauthPrompt ? "需重新登入" : "已登入"}
                      </span>
                    </p>
                    <p className="mt-1 text-slate-500">{googleLinkedStudent.email}</p>
                    {googleLinkedStudent.id ? (
                      <>
                        <p className="mt-1 text-slate-400">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(googleLinkedStudent.id);
                              setCopiedStudentId(true);
                              setTimeout(() => {
                                setCopiedStudentId(false);
                              }, 1500);
                            }}
                            className="transition-colors hover:text-slate-600"
                            title="點擊複製學號"
                          >
                            學號：{googleLinkedStudent.id}
                          </button>
                          {copiedStudentId ? (
                            <span className="ml-2 text-xs text-green-600">已複製</span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-slate-400">
                          <button
                            type="button"
                            onClick={() => {
                              const myEmbaAccount = `${googleLinkedStudent.id}@emba.ntu.edu.tw`;
                              navigator.clipboard.writeText(myEmbaAccount);
                              setCopiedMyEmbaAccount(true);
                              setTimeout(() => {
                                setCopiedMyEmbaAccount(false);
                              }, 1500);
                            }}
                            className="transition-colors hover:text-slate-600"
                            title="點擊複製 myEMBA 帳號"
                          >
                            myEMBA：{googleLinkedStudent.id}@emba.ntu.edu.tw
                          </button>
                          {copiedMyEmbaAccount ? (
                            <span className="ml-2 text-xs text-green-600">已複製</span>
                          ) : null}
                        </p>
                      </>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLogout_}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                      >
                        登出
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="font-semibold text-slate-600">尚未登入 Google</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-32 pt-6 sm:px-12 sm:pb-24">
        {!hasGoogleLogin || shouldShowReauthPrompt || authRestoring ? (
          <section className="entrance entrance-delay-1 mb-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_80px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {authRestoring ? "登入狀態恢復中" : "Google 登入"}
              </h2>
              {!authRestoring ? (
                <button
                  type="button"
                  onClick={() => setLoginCollapsed((prev) => !prev)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                >
                  {loginCollapsed ? "展開 ▼" : "收合 ▲"}
                </button>
              ) : null}
            </div>
            {authRestoring ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-4 text-sm text-sky-800">
                正在嘗試自動恢復登入狀態，通常不需要重新登入。
              </div>
            ) : !loginCollapsed ? (
              <>
                {reauthBannerMessage ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-900">
                    {reauthBannerMessage}
                  </div>
                ) : null}
                <div className="mt-4">
                  <GoogleSigninPanel
                    title={shouldShowReauthPrompt ? "重新登入" : "Google 登入"}
                    helperText={
                      shouldShowReauthPrompt
                        ? "系統暫時無法自動恢復登入狀態，請重新登入以恢復壽星、簽核與通知等功能。"
                        : "請先完成綁定，才能使用活動、訂餐與壘球功能。"
                    }
                    onLinkedStudent={(student, _profile, idToken, authContext) => {
                      const linkedStudentId = String((student && student.id) || "").trim();
                      const token = String(idToken || "").trim();
                      const sessionToken = String((authContext && authContext.sessionToken) || "").trim();
                      const refreshToken = String((authContext && authContext.refreshToken) || "").trim();
                      const memberships =
                        authContext && Array.isArray(authContext.memberships) ? authContext.memberships : [];

                      storeGoogleStudent_(student || null);
                      storeGoogleIdToken_(token);
                      if (sessionToken && linkedStudentId) {
                        storeAdminSession_({
                          token: sessionToken,
                          refreshToken,
                          studentId: linkedStudentId,
                          studentEmail: String((student && student.email) || "").trim().toLowerCase(),
                          memberships,
                        });
                      }
                      setAuthRestoreResolved(true);
                      setNotificationError("");
                      setApprovalsOverviewError("");
                      setBirthdaySummaryError("");
                      setGoogleLinkedStudent(student);
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

        {/* 足球預測賽已結束，保留版型程式碼以便日後復用，但不再對外顯示。 */}
        <section hidden className="entrance entrance-delay-2 mb-6 overflow-hidden rounded-[2rem] border border-slate-800 bg-[#101827] text-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.9)] sm:rounded-[2.5rem]">
          <div className="relative isolate overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
            <div className="absolute -left-12 -top-20 h-48 w-48 rounded-full bg-[#F6C445]/20 blur-3xl" />
            <div className="absolute -right-16 -bottom-24 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  115B 限定預測賽 · 無金流，輸的人請吃飯
                </div>
                <p className="mt-4 text-xs font-semibold tracking-[0.22em] text-slate-400">WORLD CUP FINAL</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">猜冠軍，別猜誰會先賴帳。</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  90 分鐘比分、最終冠軍、先進球隊伍一次選好；封盤後才揭曉大家的足球第六感。
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-5">
                <div className="flex flex-col items-center gap-2 text-center">
                  <NationalTeamCrest team="spain" />
                  <span className="text-xs font-bold text-white">西班牙</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-black italic text-[#F6C445]">VS</span>
                  <span className="mt-1 whitespace-nowrap text-[10px] font-medium text-slate-400">誰請晚餐？</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <NationalTeamCrest team="argentina" />
                  <span className="text-xs font-bold text-white">阿根廷</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 lg:min-w-[17rem]">
                {worldCupStats ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-300">目前已有 <span className="text-base font-black text-white">{worldCupStats.participants}</span> 人下好離手</p>
                      <span className="text-[10px] font-semibold text-slate-400">冠軍票向</span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-700" aria-label={`西班牙 ${worldCupStats.spainVotes} 票，阿根廷 ${worldCupStats.argentinaVotes} 票`}>
                      <span className="bg-[#F6C445]" style={{ width: `${worldCupStats.participants ? Math.round((worldCupStats.spainVotes / worldCupStats.participants) * 100) : 0}%` }} />
                      <span className="flex-1 bg-sky-400" />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] font-bold"><span className="text-[#F6C445]">西班牙 {worldCupStats.participants ? Math.round((worldCupStats.spainVotes / worldCupStats.participants) * 100) : 0}%</span><span className="text-sky-300">阿根廷 {worldCupStats.participants ? Math.round((worldCupStats.argentinaVotes / worldCupStats.participants) * 100) : 0}%</span></div>
                    <p className="mt-2 text-[10px] text-slate-500">只顯示整體票向，個人預測封盤前保密。</p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-slate-400">正在統計大家的足球第六感…</p>
                )}
              </div>

              <div className="flex flex-col gap-3 text-center lg:min-w-[12.5rem] lg:text-right">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-slate-400">台灣時間 7/20 03:00 開踢</p>
                  <p className="mt-1 text-sm font-semibold text-[#F6C445]">02:30 自動封盤</p>
                </div>
                <a
                  href="/world-cup"
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#F6C445]"
                >
                  進入預測賽 <span className="ml-2">→</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:gap-5 lg:grid-cols-2 xl:grid-cols-5">
          <div className="entrance entrance-delay-3 group flex h-full flex-col justify-between card-system card-system--slate">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">活動管理</h3>
              <p className="mt-3 text-sm text-slate-500">
                報名、簽到與活動資訊一站完成。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/events"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              {canSeeEventAdmin ? (
                <a
                  href="/admin/events"
                  className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--amber">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">訂餐管理</h3>
              <p className="mt-3 text-sm text-amber-900/80">
                週末與特別課程訂餐，注意有訂餐截止時間。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/ordering"
                className="inline-flex items-center rounded-full border border-amber-300 bg-white px-4 py-1.5 text-sm font-semibold text-amber-700 shadow-sm hover:border-amber-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              {canSeeOrderingAdmin ? (
                <a
                  href="/admin/ordering"
                  className="text-xs font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--sky">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">財務管理</h3>
              <p className="mt-3 text-sm text-sky-900/80">
                請購 / 請款 / 零用金申請。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/finance"
                className="inline-flex items-center rounded-full border border-sky-300 bg-white px-4 py-1.5 text-sm font-semibold text-sky-700 shadow-sm hover:border-sky-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              {canSeeFinanceAdmin ? (
                <a
                  href="/admin/finance"
                  className="text-xs font-semibold text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-800"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--violet">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">學藝專區</h3>
              <p className="mt-3 text-sm text-violet-900/80">補課登記、課程摘要與筆記入口。</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/academics"
                className="inline-flex items-center rounded-full border border-violet-300 bg-white px-4 py-1.5 text-sm font-semibold text-violet-700 shadow-sm hover:border-violet-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              {canSeeAcademicsAdmin ? (
                <a
                  href="/admin/academics"
                  className="text-xs font-semibold text-violet-700 underline decoration-violet-300 underline-offset-4 hover:text-violet-800"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--slate">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">班務文件中心</h3>
              <p className="mt-3 text-sm text-slate-600">查閱班會記錄、組織章程、制度文件與各組交接資料。</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/documents"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                文件入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--emerald">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">壘球隊管理</h3>
              <p className="mt-3 text-sm text-emerald-900/80">練習排程、點名與出席統計。</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/softball/player"
                className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm hover:border-emerald-400"
              >
                球員入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              {canSeeSoftballAdmin ? (
                <a
                  href="/softball"
                  className="text-xs font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between rounded-[2rem] border border-pink-200/80 bg-gradient-to-br from-pink-50 via-rose-50 to-white p-5 shadow-[0_28px_80px_-70px_rgba(190,24,93,0.8)] sm:p-6">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">啦啦隊管理</h3>
              <p className="mt-3 text-sm text-pink-900/80">練習排程、出席紀錄與全員統計。</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/cheerleading/player"
                className="inline-flex items-center rounded-full border border-pink-300 bg-white px-4 py-1.5 text-sm font-semibold text-pink-700 shadow-sm hover:border-pink-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              {canSeeCheerleadingAdmin ? (
                <a
                  href="/cheerleading"
                  className="text-xs font-semibold text-pink-700 underline decoration-pink-300 underline-offset-4 hover:text-pink-800"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between rounded-[2rem] border border-orange-200/80 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-5 shadow-[0_28px_80px_-70px_rgba(180,83,9,0.8)] sm:p-6 xl:col-span-2">
            <div>
              <div className="inline-flex rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-orange-700">
                🔕 Silent or Smoothie
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">飲料請客排隊系統</h3>
              <p className="mt-3 text-sm text-orange-900/80">
                手機沒關靜音？下一堂課請全班喝飲料。人太多沒關係，系統幫大家排隊追蹤。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/drinks"
                className="inline-flex items-center rounded-full border border-orange-300 bg-white px-4 py-1.5 text-sm font-semibold text-orange-700 shadow-sm hover:border-orange-400"
              >
                查看飲料隊列
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>

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
