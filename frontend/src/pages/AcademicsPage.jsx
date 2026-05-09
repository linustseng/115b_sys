import React, { useEffect, useMemo, useState } from "react";
import { resolveAndOpenAttachment_ } from "../utils/attachments";
import { mapAppErrorMessage } from "../utils/errorMappings";

function defaultForm() {
  return {
    targetSessionId: "",
    needMeal: false,
    needHandout: true,
    note: "",
  };
}

function parseMultilineItems_(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLinkItems_(note) {
  const rawItems = Array.isArray(note && note.linkItems) ? note.linkItems : [];
  const parsedItems = rawItems
    .map((item) => ({
      label: String(item && item.label ? item.label : "").trim(),
      url: String(item && item.url ? item.url : "").trim(),
    }))
    .filter((item) => /^https?:\/\//i.test(item.url));

  if (parsedItems.length) {
    return parsedItems;
  }

  const fallbackUrl = String(note && note.linkUrl ? note.linkUrl : "").trim();
  if (!/^https?:\/\//i.test(fallbackUrl)) {
    return [];
  }

  return [
    {
      label: String(note && note.linkLabel ? note.linkLabel : "").trim(),
      url: fallbackUrl,
    },
  ];
}

function normalizeNoteItems_(note) {
  const homeworkItems = Array.isArray(note && note.homeworkItems)
    ? note.homeworkItems.map((item) => String(item || "").trim()).filter(Boolean)
    : parseMultilineItems_(note && note.homeworkNotice);
  const quizItems = Array.isArray(note && note.quizItems)
    ? note.quizItems.map((item) => String(item || "").trim()).filter(Boolean)
    : parseMultilineItems_(note && note.quizNotice);
  const linkItems = normalizeLinkItems_(note);

  return {
    homeworkItems,
    quizItems,
    linkItems,
  };
}

function normalizeMakeupReminder_(note) {
  if (!note) {
    return null;
  }
  const reminderTitle = String(note.reminderTitle || note.title || "").trim();
  const reminderText = String(note.reminderText || note.makeupReminder || note.note || "").trim();
  const reminderLinkUrl = String(note.reminderLinkUrl || note.linkUrl || "").trim();
  const reminderLinkLabel = String(note.reminderLinkLabel || note.linkLabel || "").trim();
  if (!reminderTitle && !reminderText && !/^https?:\/\//i.test(reminderLinkUrl)) {
    return null;
  }
  return {
    title: reminderTitle,
    text: reminderText,
    linkUrl: /^https?:\/\//i.test(reminderLinkUrl) ? reminderLinkUrl : "",
    linkLabel: reminderLinkLabel,
  };
}

function MakeupReminderCard({ reminder }) {
  if (!reminder) {
    return null;
  }
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">補課提醒</p>
      {reminder.title ? <p className="mt-2 text-sm font-semibold text-slate-900">{reminder.title}</p> : null}
      {reminder.text ? <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{reminder.text}</p> : null}
      {reminder.linkUrl ? (
        <a
          href={reminder.linkUrl}
          target="_blank"
          rel="noopener"
          className="mt-2 inline-flex items-center text-sm font-semibold text-violet-700 underline decoration-violet-300 underline-offset-4 hover:text-violet-800"
        >
          {reminder.linkLabel || "查看補充說明"}
        </a>
      ) : null}
    </div>
  );
}

function CourseCatalogCard({ unit, apiRequest, formatSessionSchedule_ }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{unit.title}</h3>
          <p className="mt-1 text-xs text-slate-500">共 {unit.sessions.length} 堂</p>
        </div>
      </div>
      {unit.note ? (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">課程筆記連結</p>

          {Array.isArray(unit.note.linkItems) && unit.note.linkItems.length ? (
            <div className="mt-3 flex flex-col gap-2">
              {unit.note.linkItems.map((item, index) => (
                <a
                  key={`link-${index}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                >
                  {item.label || "開啟筆記連結"}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
          這門課目前還沒有上架筆記連結。
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {(unit.sessions || []).map((session) => {
          const homeworkItems = Array.isArray(session.task && session.task.homeworkItems) ? session.task.homeworkItems : [];
          const quizItems = Array.isArray(session.task && session.task.quizItems) ? session.task.quizItems : [];
          const attachments = Array.isArray(session.task && session.task.attachments) ? session.task.attachments : [];
          return (
            <div key={session.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{formatSessionSchedule_(session) || "日期時間待補"}</p>
              </div>
              {session.location ? <p className="mt-1 text-xs text-slate-500">地點：{session.location}</p> : null}
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">作業</p>
                  {homeworkItems.length ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{homeworkItems.join("\n")}</p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-500">目前尚無作業通知</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">小考</p>
                  {quizItems.length ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{quizItems.join("\n")}</p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-500">目前尚無小考通知</p>
                  )}
                </div>
              </div>
              {attachments.length ? (
                <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">作業檔案</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {attachments.map((item, index) => (
                      <button
                        key={`${item.attachmentId || item.url || "attachment"}-${index}`}
                        type="button"
                        onClick={() => resolveAndOpenAttachment_(item, apiRequest).catch(() => window.alert("附件暫時無法開啟，請稍後再試"))}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-white"
                      >
                        {item.name || item.url || "附件"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AcademicsPage({ shared }) {
  const {
    apiRequest,
    GoogleSigninPanel,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    storeGoogleIdToken_,
    storeAdminSession_,
    formatDisplayDate_,
    formatEventSchedule_,
  } = shared;

  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState("courses");
  const [courseScope, setCourseScope] = useState("recent");
  const [form, setForm] = useState(() => defaultForm());
  const [bootstrap, setBootstrap] = useState({
    sessions: [],
    regularSessions: [],
    makeupTargets: [],
    courses: [],
    courseSessions: [],
    courseNotes: [],
    sessionTasks: [],
    makeupNotes: [],
    myRequests: [],
    publicRequests: [],
    summaryByTarget: [],
    canManage: false,
  });

  const loadBootstrap_ = async () => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listAcademicsBootstrap" });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入失敗");
      }
      setBootstrap({
        sessions: Array.isArray(result.data && result.data.sessions) ? result.data.sessions : [],
        regularSessions: Array.isArray(result.data && result.data.regularSessions) ? result.data.regularSessions : [],
        makeupTargets: Array.isArray(result.data && result.data.makeupTargets) ? result.data.makeupTargets : [],
        courses: Array.isArray(result.data && result.data.courses) ? result.data.courses : [],
        courseSessions: Array.isArray(result.data && result.data.courseSessions) ? result.data.courseSessions : [],
        courseNotes: Array.isArray(result.data && result.data.courseNotes) ? result.data.courseNotes : [],
        sessionTasks: Array.isArray(result.data && result.data.sessionTasks) ? result.data.sessionTasks : [],
        makeupNotes: Array.isArray(result.data && result.data.makeupNotes) ? result.data.makeupNotes : [],
        myRequests: Array.isArray(result.data && result.data.myRequests) ? result.data.myRequests : [],
        publicRequests: Array.isArray(result.data && result.data.publicRequests) ? result.data.publicRequests : [],
        summaryByTarget: Array.isArray(result.data && result.data.summaryByTarget) ? result.data.summaryByTarget : [],
        canManage: Boolean(result.data && result.data.canManage),
      });
    } catch (err) {
      const message = String((err && err.message) || "");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "目前無法自動恢復登入狀態，請重新登入後再試。",
          networkMessage: "目前網路或系統回應較慢，課程資料稍後再試。",
          fallbackMessage: message || "載入失敗",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setBootstrap({
        sessions: [],
        regularSessions: [],
        makeupTargets: [],
        courses: [],
        courseSessions: [],
        courseNotes: [],
        sessionTasks: [],
        makeupNotes: [],
        myRequests: [],
        publicRequests: [],
        summaryByTarget: [],
        canManage: false,
      });
      return;
    }
    loadBootstrap_();
  }, [googleLinkedStudent && googleLinkedStudent.email]);

  const regularSessions = useMemo(() => {
    return (bootstrap.regularSessions || []).slice().sort((a, b) => {
      const left = `${String(a.sessionDate || "")} ${String(a.startsAt || "")}`;
      const right = `${String(b.sessionDate || "")} ${String(b.startsAt || "")}`;
      return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
    });
  }, [bootstrap.regularSessions]);

  const makeupTargets = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (bootstrap.makeupTargets || [])
      .filter((item) => String(item.sessionDate || "") >= today)
      .slice()
      .sort((a, b) => {
        const left = `${String(a.sessionDate || "")} ${String(a.id || "")}`;
        const right = `${String(b.sessionDate || "")} ${String(b.id || "")}`;
        return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
      });
  }, [bootstrap.makeupTargets]);

  const sessionsById = useMemo(() => {
    const map = new Map();
    (bootstrap.sessions || []).forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [bootstrap.sessions]);

  const makeupNotesBySessionId = useMemo(() => {
    const map = new Map();
    (bootstrap.makeupNotes || []).forEach((note) => {
      const items = normalizeNoteItems_(note);
      map.set(note.sessionId, {
        ...note,
        ...items,
        session: sessionsById.get(note.sessionId) || null,
      });
    });
    return map;
  }, [bootstrap.makeupNotes, sessionsById]);

  const courseNotesByCourseId = useMemo(() => {
    const map = new Map();
    (bootstrap.courseNotes || []).forEach((note) => {
      map.set(note.courseId, {
        ...note,
        ...normalizeNoteItems_(note),
      });
    });
    return map;
  }, [bootstrap.courseNotes]);

  const sessionTasksBySessionId = useMemo(() => {
    const map = new Map();
    (bootstrap.sessionTasks || []).forEach((task) => {
      map.set(task.sessionId, {
        ...task,
        ...normalizeNoteItems_(task),
      });
    });
    return map;
  }, [bootstrap.sessionTasks]);

  const courseDateWindow = useMemo(() => {
    const todayText = new Date().toISOString().slice(0, 10);
    const uniqueDates = Array.from(
      new Set(
        regularSessions
          .map((session) => String(session.sessionDate || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" }));

    return {
      pastDates: uniqueDates.filter((date) => date <= todayText).slice(-2),
      futureDates: uniqueDates.filter((date) => date > todayText).slice(0, 2),
    };
  }, [regularSessions]);

  const allCourseCatalog = useMemo(() => {
    const buckets = new Map();
    (bootstrap.courses || []).forEach((course) => {
      buckets.set(course.id, {
        ...course,
        title: String(course.title || "").trim() || "未命名課程",
        note: courseNotesByCourseId.get(course.id) || null,
        sessions: [],
        firstSessionDate: "",
        lastSessionDate: "",
      });
    });
    (bootstrap.courseSessions || []).forEach((link) => {
      const bucket = buckets.get(link.courseId);
      const session = sessionsById.get(link.sessionId) || null;
      if (!bucket || !session || String(session.classKind || "") !== "regular") {
        return;
      }
      bucket.sessions.push({
        ...session,
        task: sessionTasksBySessionId.get(session.id) || null,
      });
    });
    return Array.from(buckets.values())
      .map((course) => {
        const sessions = (course.sessions || []).slice().sort((a, b) => {
          const left = `${String(a.sessionDate || "")} ${String(a.startsAt || "")}`;
          const right = `${String(b.sessionDate || "")} ${String(b.startsAt || "")}`;
          return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
        });
        return {
          ...course,
          sessions,
          firstSessionDate: sessions[0] ? String(sessions[0].sessionDate || "") : "",
          lastSessionDate: sessions.length ? String(sessions[sessions.length - 1].sessionDate || "") : "",
        };
      })
      .filter((course) => course.sessions.length)
      .sort((a, b) => String(a.firstSessionDate || "").localeCompare(String(b.firstSessionDate || ""), "zh-Hant", { numeric: true, sensitivity: "base" }) || String(a.title || "").localeCompare(String(b.title || ""), "zh-Hant", { numeric: true, sensitivity: "base" }));
  }, [bootstrap.courses, bootstrap.courseSessions, courseNotesByCourseId, sessionsById, sessionTasksBySessionId]);

  const recentCourseCatalog = useMemo(() => {
    const selectedDates = new Set([...courseDateWindow.pastDates, ...courseDateWindow.futureDates]);
    return allCourseCatalog.filter((course) => (course.sessions || []).some((session) => selectedDates.has(String(session.sessionDate || "").trim())));
  }, [allCourseCatalog, courseDateWindow]);

  const recentPastCourseCatalog = useMemo(() => {
    return recentCourseCatalog
      .map((course) => {
        const sessions = (course.sessions || []).filter((session) =>
          courseDateWindow.pastDates.includes(String(session.sessionDate || "").trim())
        );
        return {
          ...course,
          sessions,
          firstSessionDate: sessions[0] ? String(sessions[0].sessionDate || "") : "",
          lastSessionDate: sessions.length ? String(sessions[sessions.length - 1].sessionDate || "") : "",
        };
      })
      .filter((course) => course.sessions.length)
      .sort((a, b) => {
        const left = `${String((a.sessions[0] && a.sessions[0].sessionDate) || "")} ${String((a.sessions[0] && a.sessions[0].startsAt) || "")}`;
        const right = `${String((b.sessions[0] && b.sessions[0].sessionDate) || "")} ${String((b.sessions[0] && b.sessions[0].startsAt) || "")}`;
        return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
      });
  }, [recentCourseCatalog, courseDateWindow]);

  const recentFutureCourseCatalog = useMemo(() => {
    return recentCourseCatalog
      .map((course) => {
        const sessions = (course.sessions || []).filter((session) =>
          courseDateWindow.futureDates.includes(String(session.sessionDate || "").trim())
        );
        return {
          ...course,
          sessions,
          firstSessionDate: sessions[0] ? String(sessions[0].sessionDate || "") : "",
          lastSessionDate: sessions.length ? String(sessions[sessions.length - 1].sessionDate || "") : "",
        };
      })
      .filter((course) => course.sessions.length)
      .sort((a, b) => {
        const left = `${String((a.sessions[0] && a.sessions[0].sessionDate) || "")} ${String((a.sessions[0] && a.sessions[0].startsAt) || "")}`;
        const right = `${String((b.sessions[0] && b.sessions[0].sessionDate) || "")} ${String((b.sessions[0] && b.sessions[0].startsAt) || "")}`;
        return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
      });
  }, [recentCourseCatalog, courseDateWindow]);

  const courseCatalog = courseScope === "all" ? allCourseCatalog : recentCourseCatalog;

  const updateForm_ = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmitMakeup_ = async (event) => {
    event.preventDefault();
    if (!form.targetSessionId) {
      setError("請先選擇補課場次。");
      return;
    }
    setStatus("");
    setError("");
    try {
      const { result } = await apiRequest({
        action: "submitMakeupRequest",
        data: {
          targetSessionId: form.targetSessionId,
          needMeal: form.needMeal,
          needHandout: form.needHandout,
          note: form.note,
        },
      });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "送出失敗");
      }
      setForm(defaultForm());
      setStatus("補課登記已送出，可在下方自行撤銷。" );
      await loadBootstrap_({ allowRetry: false });
    } catch (err) {
      setError(String((err && err.message) || "送出失敗"));
    }
  };

  const handleCancelRequest_ = async (requestId) => {
    if (!requestId || typeof window === "undefined") {
      return;
    }
    if (!window.confirm("確定要撤銷這筆補課登記嗎？")) {
      return;
    }
    setStatus("");
    setError("");
    try {
      const { result } = await apiRequest({ action: "cancelMakeupRequest", id: requestId });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "撤銷失敗");
      }
      setStatus("補課登記已撤銷。");
      await loadBootstrap_({ allowRetry: false });
    } catch (err) {
      setError(String((err && err.message) || "撤銷失敗"));
    }
  };

  const formatSessionSchedule_ = (session) => {
    if (!session) {
      return "";
    }
    if (session.startsAt || session.endsAt) {
      const schedule = formatEventSchedule_(
        session.startsAt || session.sessionDate,
        session.endsAt || session.startsAt || session.sessionDate
      );
      return [schedule && schedule.dateLabel, schedule && schedule.timeLabel].filter(Boolean).join(" ");
    }
    if (session.sessionDate) {
      return formatDisplayDate_(session.sessionDate, { withTime: false });
    }
    return "";
  };

  const getStatusLabel_ = (value) => {
    switch (String(value || "").trim()) {
      case "submitted":
        return "已送出";
      case "notified":
        return "已通知對班";
      case "completed":
        return "已完成";
      case "cancelled":
        return "已撤銷";
      default:
        return String(value || "-");
    }
  };

  const activeRequests = (bootstrap.myRequests || []).filter((item) => item.status !== "cancelled");
  const publicSummaryByTarget = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (bootstrap.summaryByTarget || [])
      .filter((item) => {
        const targetSession = sessionsById.get(item.targetSessionId) || item.targetSession || null;
        return String((targetSession && targetSession.sessionDate) || "") >= today;
      })
      .map((item) => ({
        ...item,
        targetSession: sessionsById.get(item.targetSessionId) || item.targetSession || null,
        note: makeupNotesBySessionId.get(item.targetSessionId) || null,
        requests: (bootstrap.publicRequests || []).filter(
          (request) => request.status !== "cancelled" && request.targetSessionId === item.targetSessionId
        ),
      }));
  }, [bootstrap.summaryByTarget, bootstrap.publicRequests, sessionsById, makeupNotesBySessionId]);

  if (!googleLinkedStudent || !googleLinkedStudent.email) {
    return (
      <div className="min-h-screen">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">NTU EMBA 115B</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">學藝專區</h1>
              <p className="mt-3 text-sm text-slate-500">補課登記、課程摘要與筆記入口。</p>
            </div>
            <a
              href="/"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              回首頁
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">Google 登入</h2>
            <p className="mt-2 text-sm text-slate-500">登入後即可補課登記，也能查看已發布的課程摘要與筆記。</p>
            <div className="mt-5">
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後會自動帶入你的身分與班級權限。"
                onLinkedStudent={(student, _profile, idToken, authContext) => {
                  const linkedStudent = student || null;
                  const token = String(idToken || "").trim();
                  const sessionToken = String((authContext && authContext.sessionToken) || "").trim();
                  const refreshToken = String((authContext && authContext.refreshToken) || "").trim();
                  const memberships =
                    authContext && Array.isArray(authContext.memberships) ? authContext.memberships : [];
                  const linkedStudentId = String((linkedStudent && linkedStudent.id) || "").trim();

                  setGoogleLinkedStudent(linkedStudent);
                  storeGoogleStudent_(linkedStudent);
                  if (token) {
                    storeGoogleIdToken_(token);
                  }
                  if (sessionToken && linkedStudentId) {
                    storeAdminSession_({
                      token: sessionToken,
                      refreshToken,
                      studentId: linkedStudentId,
                      studentEmail: String((linkedStudent && linkedStudent.email) || "").trim().toLowerCase(),
                      memberships,
                    });
                  }
                }}
              />
            </div>
            {error ? <div className="mt-4 alert alert-error">{error}</div> : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">NTU EMBA 115B</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">學藝專區</h1>
            <p className="mt-3 text-sm text-slate-500">週末正式課程來自 Google Calendar；週四補課場次由系統統一提供。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {bootstrap.canManage ? (
              <a
                href="/admin/academics"
                className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-700 hover:border-violet-300"
              >
                管理入口
              </a>
            ) : null}
            <a
              href="/"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              回首頁
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8 sm:px-12">
        {loading ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            載入中...
          </div>
        ) : null}
        {error ? <div className="mb-4 alert alert-error">{error}</div> : null}
        {status ? <div className="mb-4 alert alert-success">{status}</div> : null}

        <section className="mb-6 card p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "courses", label: "課程索引" },
              { id: "makeup", label: "補課登記" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  activeTab === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "makeup" ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="card p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">Makeup</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">補課登記</h2>
              </div>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">免審核，可自行撤銷</span>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmitMakeup_}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">補課場次（週四）</label>
                <select
                  value={form.targetSessionId}
                  onChange={(event) => updateForm_({ targetSessionId: event.target.value })}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">請選擇補課場次</option>
                  {makeupTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatSessionSchedule_(item)}｜{item.title}{normalizeMakeupReminder_(makeupNotesBySessionId.get(item.id)) ? "｜有提醒" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {form.targetSessionId ? (
                <MakeupReminderCard reminder={normalizeMakeupReminder_(makeupNotesBySessionId.get(form.targetSessionId))} />
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.needMeal}
                    onChange={(event) => updateForm_({ needMeal: event.target.checked })}
                  />
                  需要餐食
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.needHandout}
                    onChange={(event) => updateForm_({ needHandout: event.target.checked })}
                  />
                  需要講義
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">備註</label>
                <textarea
                  value={form.note}
                  onChange={(event) => updateForm_({ note: event.target.value })}
                  rows={3}
                  placeholder="例如：可能晚到 / 只上半天"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">送出後會留在系統中供學藝組彙整餐食與講義。</p>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  送出補課登記
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <section className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900">我的補課</h2>
              <p className="mt-2 text-sm text-slate-500">目前有效 {activeRequests.length} 筆</p>
              <div className="mt-4 space-y-3">
                {!bootstrap.myRequests.length ? (
                  <div className="alert alert-info text-xs">目前還沒有補課登記。</div>
                ) : null}
                {(bootstrap.myRequests || []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.targetSession ? formatSessionSchedule_(item.targetSession) : item.targetSessionId}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          補課：{item.targetSession ? formatSessionSchedule_(item.targetSession) : item.targetSessionId}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                        {getStatusLabel_(item.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">餐食：{item.needMeal ? "需要" : "不需要"}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">講義：{item.needHandout ? "需要" : "不需要"}</span>
                    </div>
                    <div className="mt-3">
                      <MakeupReminderCard reminder={normalizeMakeupReminder_(makeupNotesBySessionId.get(item.targetSessionId))} />
                    </div>
                    {item.note ? <p className="mt-3 text-xs text-slate-600">備註：{item.note}</p> : null}
                    {item.status !== "cancelled" && item.status !== "completed" ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => handleCancelRequest_(item.id)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-300"
                        >
                          撤銷
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="mt-6 card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">Peers</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">已申請補課資訊</h2>
              <p className="mt-2 text-sm text-slate-500">方便同學彼此照應，查看各週四場次目前有哪些同學已申請補課。</p>
            </div>
            <span className="text-xs text-slate-400">共 {publicSummaryByTarget.length} 場</span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {!publicSummaryByTarget.length ? <div className="alert alert-info text-xs">目前還沒有同學申請補課。</div> : null}
            {publicSummaryByTarget.map((item) => (
              <div key={item.targetSessionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {item.targetSession ? formatSessionSchedule_(item.targetSession) : item.targetSessionId}
                </p>
                <p className="mt-2 text-xs text-slate-500">已申請 {item.active} 人</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">餐食 {item.needMeal}</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">講義 {item.needHandout}</span>
                </div>
                <div className="mt-3">
                  <MakeupReminderCard reminder={normalizeMakeupReminder_(item.note)} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {item.requests
                    .map((request) => request.nameZh || request.displayName || request.studentName || request.studentEmail || request.studentId)
                    .join("、")}
                </p>
              </div>
            ))}
          </div>
        </section>
          </>
        ) : null}

        {activeTab === "courses" ? (
          <section className="mt-6 card p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">Courses</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">課程索引</h2>
              <p className="mt-2 text-sm text-slate-500">預設顯示前 2 個上課日與後 2 個上課日；前面看複習 / 作業，後面看小考提醒。</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCourseScope("recent")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  courseScope === "recent" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                前 2 天＋後 2 天
              </button>
              <button
                type="button"
                onClick={() => setCourseScope("all")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  courseScope === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                全部課程（{allCourseCatalog.length}）
              </button>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {!courseCatalog.length ? <div className="alert alert-info text-xs">目前還沒有同步到正式課程。</div> : null}
            {courseScope === "all" ? (
              courseCatalog.map((unit) => (
                <CourseCatalogCard key={unit.id} unit={unit} apiRequest={apiRequest} formatSessionSchedule_={formatSessionSchedule_} />
              ))
            ) : (
              <div className="space-y-6">
                <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">Review</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">剛上完</h3>
                      <p className="mt-1 text-xs text-slate-500">前 2 個上課日，方便回頭看複習重點與作業。</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-amber-700 shadow-sm">
                      {recentPastCourseCatalog.length} 堂
                    </span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {!recentPastCourseCatalog.length ? (
                      <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500">目前沒有可顯示的已上課課程。</div>
                    ) : null}
                    {recentPastCourseCatalog.map((unit) => (
                      <CourseCatalogCard key={unit.id} unit={unit} apiRequest={apiRequest} formatSessionSchedule_={formatSessionSchedule_} />
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-rose-200 bg-rose-50/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">Upcoming</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">即將上課</h3>
                      <p className="mt-1 text-xs text-slate-500">後 2 個上課日，方便課前看摘要與小考提醒。</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 shadow-sm">
                      {recentFutureCourseCatalog.length} 堂
                    </span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {!recentFutureCourseCatalog.length ? (
                      <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500">目前沒有可顯示的即將上課課程。</div>
                    ) : null}
                    {recentFutureCourseCatalog.map((unit) => (
                      <CourseCatalogCard key={unit.id} unit={unit} apiRequest={apiRequest} formatSessionSchedule_={formatSessionSchedule_} />
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
