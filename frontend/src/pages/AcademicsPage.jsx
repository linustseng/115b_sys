import React, { useEffect, useMemo, useState } from "react";

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
  const summaryItems = Array.isArray(note && note.summaryItems)
    ? note.summaryItems.map((item) => String(item || "").trim()).filter(Boolean)
    : parseMultilineItems_(note && note.summary);
  const homeworkItems = Array.isArray(note && note.homeworkItems)
    ? note.homeworkItems.map((item) => String(item || "").trim()).filter(Boolean)
    : parseMultilineItems_(note && note.homeworkNotice);
  const quizItems = Array.isArray(note && note.quizItems)
    ? note.quizItems.map((item) => String(item || "").trim()).filter(Boolean)
    : parseMultilineItems_(note && note.quizNotice);
  const linkItems = normalizeLinkItems_(note);

  return {
    summaryItems,
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

function CourseCatalogCard({ unit }) {
  const homeworkItems = Array.isArray(unit.note && unit.note.homeworkItems) ? unit.note.homeworkItems : [];
  const quizItems = Array.isArray(unit.note && unit.note.quizItems) ? unit.note.quizItems : [];
  const infoCards = [];

  if (homeworkItems.length || unit.timelineMode === "review") {
    infoCards.push({
      key: "homework",
      title: "作業",
      toneClassName: "text-amber-500",
      items: homeworkItems,
      emptyText: "目前尚無作業通知",
    });
  }

  if (quizItems.length || unit.timelineMode !== "review") {
    infoCards.push({
      key: "quiz",
      title: "小考通知",
      toneClassName: "text-rose-500",
      items: quizItems,
      emptyText: "目前尚無小考通知",
    });
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{unit.courseGroupTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{unit.sessionDate}｜{unit.slotCount} 個時段</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
          {unit.mergedSchedule || "時間待補"}
        </span>
      </div>
      {unit.location ? <p className="mt-2 text-xs text-slate-500">地點：{unit.location}</p> : null}

      {unit.note ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {unit.timelineMode === "review" ? "複習重點" : "課前摘要"}
            </p>
            {Array.isArray(unit.note.summaryItems) && unit.note.summaryItems.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                {unit.note.summaryItems.map((item, index) => (
                  <li key={`summary-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-6 text-slate-700">尚未提供</p>
            )}

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
          <div className="grid gap-3">
            {infoCards.map((card) => (
              <div key={card.key} className="rounded-2xl bg-white px-4 py-3">
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${card.toneClassName}`}>{card.title}</p>
                {card.items.length ? (
                  <div className="mt-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                    <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                      {card.items.join("\n")}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-700">{card.emptyText}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
          這堂課目前還沒有上架課程摘要 / 筆記 / 作業 / 小考通知。
        </div>
      )}
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
    notes: [],
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
        notes: Array.isArray(result.data && result.data.notes) ? result.data.notes : [],
        myRequests: Array.isArray(result.data && result.data.myRequests) ? result.data.myRequests : [],
        publicRequests: Array.isArray(result.data && result.data.publicRequests) ? result.data.publicRequests : [],
        summaryByTarget: Array.isArray(result.data && result.data.summaryByTarget) ? result.data.summaryByTarget : [],
        canManage: Boolean(result.data && result.data.canManage),
      });
    } catch (err) {
      const message = String((err && err.message) || "");
      if (message === "Unauthorized" || message.includes("登入已過期")) {
        setError("目前無法自動恢復登入狀態，請稍後再試；若仍不行再重新登入。");
      } else {
        setError(message || "載入失敗");
      }
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
        notes: [],
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

  const notesBySessionId = useMemo(() => {
    const map = new Map();
    (bootstrap.notes || []).forEach((note) => {
      const items = normalizeNoteItems_(note);
      map.set(note.sessionId, {
        ...note,
        ...items,
        session: sessionsById.get(note.sessionId) || null,
      });
    });
    return map;
  }, [bootstrap.notes, sessionsById]);

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

  const recentCourseSessions = useMemo(() => {
    const selectedDates = new Set([...courseDateWindow.pastDates, ...courseDateWindow.futureDates]);
    return regularSessions.filter((session) => selectedDates.has(String(session.sessionDate || "").trim()));
  }, [regularSessions, courseDateWindow]);

  const buildCourseCatalog_ = (sourceSessions) => {
    const parseMinutes = (value) => {
      const match = String(value || "").match(/(?:T| )(\d{2}):(\d{2})$/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
    };

    const units = new Map();
    (sourceSessions || []).forEach((session) => {
      const courseGroupTitle = String(session.courseGroupTitle || session.title || "").trim() || "未分類課程";
      const courseGroupKey = String(session.courseGroupKey || courseGroupTitle || session.id || "").trim();
      const sessionDate = String(session.sessionDate || "").trim();
      if (!courseGroupKey || !sessionDate) {
        return;
      }
      const unitKey = `${sessionDate}__${courseGroupKey}`;
      if (!units.has(unitKey)) {
        units.set(unitKey, {
          unitKey,
          sessionDate,
          courseGroupKey,
          courseGroupTitle,
          slots: [],
          notes: [],
        });
      }
      const bucket = units.get(unitKey);
      const slot = {
        ...session,
        note: notesBySessionId.get(session.id) || null,
      };
      bucket.slots.push(slot);
      if (slot.note) {
        bucket.notes.push(slot.note);
      }
    });

    return Array.from(units.values())
      .map((unit) => {
        const sortedSlots = unit.slots.slice().sort((a, b) => {
          const left = `${String(a.startsAt || "")} ${String(a.endsAt || "")}`;
          const right = `${String(b.startsAt || "")} ${String(b.endsAt || "")}`;
          return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
        });
        const firstSlot = sortedSlots[0] || null;
        const location = firstSlot ? firstSlot.location : "";
        const minStart = sortedSlots.reduce((acc, slot) => {
          const value = parseMinutes(slot.startsAt);
          return Number.isNaN(value) ? acc : Math.min(acc, value);
        }, Number.POSITIVE_INFINITY);
        const maxEnd = sortedSlots.reduce((acc, slot) => {
          const value = parseMinutes(slot.endsAt);
          return Number.isNaN(value) ? acc : Math.max(acc, value);
        }, Number.NEGATIVE_INFINITY);
        const mergedSchedule =
          Number.isFinite(minStart) && Number.isFinite(maxEnd)
            ? `${String(Math.floor(minStart / 60)).padStart(2, "0")}:${String(minStart % 60).padStart(2, "0")} - ${String(
                Math.floor(maxEnd / 60)
              ).padStart(2, "0")}:${String(maxEnd % 60).padStart(2, "0")}`
            : "";

        const primaryNote = unit.notes[0] || null;
        const todayText = new Date().toISOString().slice(0, 10);
        const timelineMode = unit.sessionDate <= todayText ? "review" : "preview";
        return {
          ...unit,
          slots: sortedSlots,
          slotCount: sortedSlots.length,
          location,
          mergedSchedule,
          note: primaryNote,
          timelineMode,
        };
      })
      .sort((a, b) => {
        const left = `${a.sessionDate} ${a.mergedSchedule || ""} ${a.courseGroupTitle}`;
        const right = `${b.sessionDate} ${b.mergedSchedule || ""} ${b.courseGroupTitle}`;
        return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
      });
  };

  const recentCourseCatalog = useMemo(() => buildCourseCatalog_(recentCourseSessions), [recentCourseSessions, notesBySessionId]);
  const allCourseCatalog = useMemo(() => buildCourseCatalog_(regularSessions), [regularSessions, notesBySessionId]);
  const recentPastCourseCatalogRaw = useMemo(
    () => recentCourseCatalog.filter((unit) => courseDateWindow.pastDates.includes(unit.sessionDate)),
    [recentCourseCatalog, courseDateWindow]
  );
  const recentPastCourseCatalog = useMemo(() => {
    const uniqText = (items = []) => Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
    const uniqLinks = (items = []) => {
      const seen = new Set();
      return items.filter((item) => {
        const key = `${String(item && item.label ? item.label : "").trim()}::${String(item && item.url ? item.url : "").trim()}`;
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    };

    const buckets = new Map();
    recentPastCourseCatalogRaw.forEach((unit) => {
      const key = String(unit.courseGroupKey || unit.courseGroupTitle || unit.unitKey || "").trim();
      if (!key) {
        return;
      }
      if (!buckets.has(key)) {
        buckets.set(key, {
          ...unit,
          unitKey: `review__${key}`,
          reviewDates: [unit.sessionDate],
          sourceUnits: [unit],
        });
        return;
      }
      const bucket = buckets.get(key);
      bucket.reviewDates.push(unit.sessionDate);
      bucket.sourceUnits.push(unit);
      bucket.slotCount += unit.slotCount;
      bucket.mergedSchedule = bucket.mergedSchedule || unit.mergedSchedule;
      bucket.location = bucket.location || unit.location;
      const baseNote = bucket.note || { summaryItems: [], homeworkItems: [], quizItems: [], linkItems: [] };
      const nextNote = unit.note || { summaryItems: [], homeworkItems: [], quizItems: [], linkItems: [] };
      bucket.note = {
        ...baseNote,
        summaryItems: uniqText([...(baseNote.summaryItems || []), ...(nextNote.summaryItems || [])]),
        homeworkItems: uniqText([...(baseNote.homeworkItems || []), ...(nextNote.homeworkItems || [])]),
        quizItems: uniqText([...(baseNote.quizItems || []), ...(nextNote.quizItems || [])]),
        linkItems: uniqLinks([...(baseNote.linkItems || []), ...(nextNote.linkItems || [])]),
      };
    });

    return Array.from(buckets.values())
      .map((unit) => {
        const sortedDates = Array.from(new Set(unit.reviewDates)).sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" }));
        return {
          ...unit,
          sessionDate: sortedDates.length > 1 ? `${sortedDates[0]} ~ ${sortedDates[sortedDates.length - 1]}` : sortedDates[0] || unit.sessionDate,
          reviewDates: sortedDates,
        };
      })
      .sort((a, b) => {
        const leftDate = a.reviewDates && a.reviewDates[0] ? a.reviewDates[0] : "";
        const rightDate = b.reviewDates && b.reviewDates[0] ? b.reviewDates[0] : "";
        const dateCompare = leftDate.localeCompare(rightDate, "zh-Hant", { numeric: true, sensitivity: "base" });
        if (dateCompare !== 0) {
          return dateCompare;
        }
        const scheduleCompare = String(a.mergedSchedule || "").localeCompare(String(b.mergedSchedule || ""), "zh-Hant", {
          numeric: true,
          sensitivity: "base",
        });
        if (scheduleCompare !== 0) {
          return scheduleCompare;
        }
        return String(a.courseGroupTitle || "").localeCompare(String(b.courseGroupTitle || ""), "zh-Hant", {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [recentPastCourseCatalogRaw]);
  const recentFutureCourseCatalog = useMemo(
    () => recentCourseCatalog.filter((unit) => courseDateWindow.futureDates.includes(unit.sessionDate)),
    [recentCourseCatalog, courseDateWindow]
  );
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
      return [schedule && schedule.dateLabel, schedule && schedule.timeLabel].filter(Boolean).join(" · ");
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
        note: notesBySessionId.get(item.targetSessionId) || null,
        requests: (bootstrap.publicRequests || []).filter(
          (request) => request.status !== "cancelled" && request.targetSessionId === item.targetSessionId
        ),
      }));
  }, [bootstrap.summaryByTarget, bootstrap.publicRequests, sessionsById, notesBySessionId]);

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
                      {item.sessionDate}｜{item.title}{normalizeMakeupReminder_(notesBySessionId.get(item.id)) ? "｜有提醒" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {form.targetSessionId ? (
                <MakeupReminderCard reminder={normalizeMakeupReminder_(notesBySessionId.get(form.targetSessionId))} />
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
                全部課程（22）
              </button>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {!courseCatalog.length ? <div className="alert alert-info text-xs">目前還沒有同步到正式課程。</div> : null}
            {courseScope === "all" ? (
              courseCatalog.map((unit) => (
                <CourseCatalogCard key={unit.unitKey} unit={unit} />
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
                      <CourseCatalogCard key={unit.unitKey} unit={unit} />
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
                      <CourseCatalogCard key={unit.unitKey} unit={unit} />
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
