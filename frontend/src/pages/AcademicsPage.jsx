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

const RESOURCE_KIND_META = {
  course_note: { label: "課程筆記", tone: "emerald", synonyms: "筆記 note notebooklm summary 摘要" },
  homework: { label: "作業 / 報告", tone: "amber", synonyms: "作業 報告 homework hw assignment report 題目 繳交" },
  quiz: { label: "小考 / 考試", tone: "rose", synonyms: "小考 考試 quiz exam 期中 期末 範圍" },
  homework_file: { label: "作業 / 報告題目", tone: "amber", synonyms: "作業 報告 homework hw assignment report 題目 檔案" },
  homework_reference: { label: "作業 / 報告參考", tone: "sky", synonyms: "作業 報告 作業參考 補充 reference solution 解答" },
  past_exam: { label: "考古題", tone: "violet", synonyms: "考古題 past exam old exam 歷屆 試題 期中 期末" },
  answer_key: { label: "參考答案", tone: "emerald", synonyms: "答案 解答 answer key solution reference 參考答案" },
  handout: { label: "講義", tone: "slate", synonyms: "講義 handout 教材 補充資料 slides" },
  other: { label: "其他資料", tone: "slate", synonyms: "其他 資料 file attachment" },
};

const RESOURCE_KIND_FILTERS = [
  { id: "all", label: "全部" },
  { id: "homework", label: "作業/報告" },
  { id: "past_exam", label: "考古題" },
  { id: "answer_key", label: "參考答案" },
  { id: "quiz", label: "小考/考試" },
  { id: "handout", label: "講義" },
  { id: "course_note", label: "筆記" },
];

function getResourceKindMeta_(kind) {
  return RESOURCE_KIND_META[kind] || RESOURCE_KIND_META.other;
}

function getResourceKindLabel_(kind) {
  return getResourceKindMeta_(kind).label;
}

function getResourceToneClasses_(kind) {
  const tone = getResourceKindMeta_(kind).tone;
  switch (tone) {
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function normalizeResourceKind_(value) {
  const kind = String(value || "").trim();
  return RESOURCE_KIND_META[kind] ? kind : "homework_file";
}

function normalizeSearchText_(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getCourseStatus_(course, todayText) {
  const firstDate = String(course && course.firstSessionDate ? course.firstSessionDate : "").trim();
  const lastDate = String(course && course.lastSessionDate ? course.lastSessionDate : "").trim();
  if (lastDate && lastDate < todayText) {
    return "completed";
  }
  if (firstDate && firstDate > todayText) {
    return "upcoming";
  }
  return "active";
}

function getCourseNextSession_(course, todayText) {
  return (course.sessions || []).find((session) => String(session.sessionDate || "") >= todayText) || null;
}

function ResourceKindChip({ kind, count }) {
  if (!kind) {
    return null;
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getResourceToneClasses_(kind)}`}>
      {getResourceKindLabel_(kind)}
      {typeof count === "number" ? <span className="ml-1 text-[10px] opacity-75">{count}</span> : null}
    </span>
  );
}

function ResourceCountButton({ kind, count, onClick }) {
  if (!kind) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${getResourceToneClasses_(kind)}`}
      aria-label={`查看${getResourceKindLabel_(kind)} ${count} 筆`}
    >
      {getResourceKindLabel_(kind)}
      <span className="ml-1 text-[10px] opacity-75">{count}</span>
      <span className="ml-1 text-[10px] opacity-70">查看</span>
    </button>
  );
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

function ResourceAction({ resource, apiRequest, onRevealCourse }) {
  if (resource && resource.attachment) {
    return (
      <button
        type="button"
        onClick={() => resolveAndOpenAttachment_(resource.attachment, apiRequest).catch(() => window.alert("附件暫時無法開啟，請稍後再試"))}
        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
      >
        開啟檔案
      </button>
    );
  }
  if (resource && resource.url) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener"
        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
      >
        開啟連結
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onRevealCourse(resource.courseId)}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
    >
      查看堂次
    </button>
  );
}

function ResourceListItem({ resource, apiRequest, formatSessionSchedule_, onRevealCourse }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ResourceKindChip kind={resource.kind} />
            <p className="text-sm font-semibold text-slate-900">{resource.title}</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {resource.courseTitle}
            {resource.session ? `｜${formatSessionSchedule_(resource.session) || "日期待補"}` : ""}
          </p>
          {resource.preview ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{resource.preview}</p> : null}
        </div>
        <ResourceAction resource={resource} apiRequest={apiRequest} onRevealCourse={onRevealCourse} />
      </div>
    </div>
  );
}

function CourseCatalogCard({ unit, apiRequest, formatSessionSchedule_, expanded, onToggle, resourceCountsByCourseId }) {
  const counts = (resourceCountsByCourseId && resourceCountsByCourseId.get(unit.id)) || {};
  const countItems = [
    ["course_note", counts.course_note || 0],
    ["homework", (counts.homework || 0) + (counts.homework_file || 0)],
    ["past_exam", counts.past_exam || 0],
    ["answer_key", counts.answer_key || 0],
    ["quiz", counts.quiz || 0],
    ["handout", counts.handout || 0],
  ].filter(([, count]) => count > 0);
  const totalResourceCount = countItems.reduce((sum, [, count]) => sum + count, 0);
  const sessionCountLabel = `共 ${unit.sessions.length} 堂`;
  const nextSessionLabel = unit.nextSession
    ? `下一堂 ${formatSessionSchedule_(unit.nextSession)}`
    : unit.lastSessionDate
      ? `最後上課 ${unit.lastSessionDate}`
      : "";

  return (
    <div
      className={`rounded-3xl border bg-white p-5 transition sm:p-6 ${
        expanded ? "border-slate-300 shadow-sm ring-1 ring-slate-100" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <button
          type="button"
          onClick={() => onToggle(unit.id)}
          className="group min-w-0 rounded-2xl px-1 py-1 text-left focus:outline-none focus:ring-2 focus:ring-slate-300"
          aria-expanded={expanded}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-base font-semibold transition ${
                expanded ? "border-slate-300 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-slate-300"
              }`}
              aria-hidden="true"
            >
              {expanded ? "−" : "+"}
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold text-slate-900">{unit.title}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {[sessionCountLabel, nextSessionLabel].filter(Boolean).join("｜")}
              </span>
              <span className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {expanded ? "已展開" : totalResourceCount ? `${totalResourceCount} 筆資料` : "尚無資料"}
              </span>
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onToggle(unit.id)}
          className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
            expanded
              ? "border-slate-300 bg-slate-900 text-white hover:bg-slate-800"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
          }`}
          aria-expanded={expanded}
        >
          <span aria-hidden="true">{expanded ? "▲" : "▼"}</span>
          {expanded ? "收合" : "展開"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {countItems.length ? countItems.map(([kind, count]) => (
          <ResourceCountButton
            key={kind}
            kind={kind}
            count={count}
            onClick={() => {
              if (!expanded) {
                onToggle(unit.id);
              }
            }}
          />
        )) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">尚無資料</span>
        )}
      </div>

      {expanded && unit.note ? (
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
      ) : expanded ? (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
          這門課目前還沒有上架筆記連結。
        </div>
      ) : null}

      {expanded ? <div className="mt-4 grid gap-3">
        {(unit.sessions || []).map((session) => {
          const homeworkItems = Array.isArray(session.task && session.task.homeworkItems) ? session.task.homeworkItems : [];
          const quizItems = Array.isArray(session.task && session.task.quizItems) ? session.task.quizItems : [];
          const attachments = Array.isArray(session.task && session.task.attachments) ? session.task.attachments : [];
          const groupedAttachments = attachments.reduce((groups, item) => {
            const kind = normalizeResourceKind_(item && item.attachmentKind);
            groups[kind] = groups[kind] || [];
            groups[kind].push(item);
            return groups;
          }, {});
          const attachmentKinds = Object.keys(groupedAttachments);
          const sessionBadges = [
            homeworkItems.length ? ["homework", homeworkItems.length] : null,
            quizItems.length ? ["quiz", quizItems.length] : null,
            attachments.length ? ["other", attachments.length] : null,
          ].filter(Boolean);
          return (
            <div key={session.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{formatSessionSchedule_(session) || "日期時間待補"}</p>
                {sessionBadges.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sessionBadges.map(([kind, count]) => <ResourceKindChip key={kind} kind={kind} count={count} />)}
                  </div>
                ) : null}
              </div>
              {session.location ? <p className="mt-1 text-xs text-slate-500">地點：{session.location}</p> : null}
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">作業 / 報告</p>
                  {homeworkItems.length ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{homeworkItems.join("\n")}</p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-500">目前尚無作業 / 報告通知</p>
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
              {attachmentKinds.length ? (
                <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">學習資料</p>
                  <div className="mt-2 grid gap-3">
                    {attachmentKinds.map((kind) => (
                      <div key={kind}>
                        <ResourceKindChip kind={kind} count={groupedAttachments[kind].length} />
                        <div className="mt-2 flex flex-col gap-2">
                          {groupedAttachments[kind].map((item, index) => (
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
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div> : null}
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
  const [courseScope, setCourseScope] = useState("focus");
  const [resourceScope, setResourceScope] = useState("all");
  const [resourceKind, setResourceKind] = useState("all");
  const [resourceQuery, setResourceQuery] = useState("");
  const [expandedCourseId, setExpandedCourseId] = useState("");
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

  const todayText = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const courseDateWindow = useMemo(() => {
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
  }, [regularSessions, todayText]);

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
          nextSession: getCourseNextSession_({ sessions }, todayText),
          status: getCourseStatus_(
            {
              firstSessionDate: sessions[0] ? String(sessions[0].sessionDate || "") : "",
              lastSessionDate: sessions.length ? String(sessions[sessions.length - 1].sessionDate || "") : "",
            },
            todayText
          ),
        };
      })
      .filter((course) => course.sessions.length)
      .sort((a, b) => {
        const aSort = a.nextSession ? String(a.nextSession.sessionDate || "") : String(a.lastSessionDate || a.firstSessionDate || "");
        const bSort = b.nextSession ? String(b.nextSession.sessionDate || "") : String(b.lastSessionDate || b.firstSessionDate || "");
        return aSort.localeCompare(bSort, "zh-Hant", { numeric: true, sensitivity: "base" }) || String(a.title || "").localeCompare(String(b.title || ""), "zh-Hant", { numeric: true, sensitivity: "base" });
      });
  }, [bootstrap.courses, bootstrap.courseSessions, courseNotesByCourseId, sessionsById, sessionTasksBySessionId, todayText]);

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

  const focusCourseCatalog = useMemo(() => {
    return allCourseCatalog.filter((course) => course.status !== "completed");
  }, [allCourseCatalog]);

  const completedCourseCatalog = useMemo(() => {
    return allCourseCatalog
      .filter((course) => course.status === "completed")
      .sort((a, b) => String(b.lastSessionDate || "").localeCompare(String(a.lastSessionDate || ""), "zh-Hant", { numeric: true, sensitivity: "base" }));
  }, [allCourseCatalog]);

  const courseCatalog = courseScope === "all" ? allCourseCatalog : courseScope === "completed" ? completedCourseCatalog : focusCourseCatalog;

  const resourceIndex = useMemo(() => {
    const rows = [];
    allCourseCatalog.forEach((course) => {
      const courseTitle = String(course.title || "").trim() || "未命名課程";
      const courseStatus = course.status || getCourseStatus_(course, todayText);
      const noteItems = Array.isArray(course.note && course.note.linkItems) ? course.note.linkItems : [];
      noteItems.forEach((item, index) => {
        rows.push({
          id: `note-${course.id}-${index}`,
          kind: "course_note",
          title: item.label || (course.note && course.note.title) || `${courseTitle} 筆記`,
          preview: "",
          url: item.url,
          courseId: course.id,
          courseTitle,
          session: null,
          courseStatus,
          searchText: normalizeSearchText_([courseTitle, item.label, item.url, "課程筆記", getResourceKindMeta_("course_note").synonyms].join(" ")),
        });
      });
      (course.sessions || []).forEach((session) => {
        const schedule = String(session.sessionDate || "");
        const task = session.task || {};
        const homeworkItems = Array.isArray(task.homeworkItems) ? task.homeworkItems : [];
        const quizItems = Array.isArray(task.quizItems) ? task.quizItems : [];
        homeworkItems.forEach((text, index) => {
          rows.push({
            id: `homework-${session.id}-${index}`,
            kind: "homework",
            title: `作業 / 報告：${String(text || "").slice(0, 24) || "提醒"}`,
            preview: text,
            courseId: course.id,
            courseTitle,
            session,
            courseStatus,
            searchText: normalizeSearchText_([courseTitle, schedule, text, "作業 報告", getResourceKindMeta_("homework").synonyms].join(" ")),
          });
        });
        quizItems.forEach((text, index) => {
          rows.push({
            id: `quiz-${session.id}-${index}`,
            kind: "quiz",
            title: `小考 / 考試：${String(text || "").slice(0, 22) || "考試提醒"}`,
            preview: text,
            courseId: course.id,
            courseTitle,
            session,
            courseStatus,
            searchText: normalizeSearchText_([courseTitle, schedule, text, "小考 考試", getResourceKindMeta_("quiz").synonyms].join(" ")),
          });
        });
        (Array.isArray(task.attachments) ? task.attachments : []).forEach((attachment, index) => {
          const kind = normalizeResourceKind_(attachment && attachment.attachmentKind);
          const title = String((attachment && (attachment.name || attachment.url)) || "附件").trim();
          rows.push({
            id: `attachment-${session.id}-${attachment.attachmentId || attachment.url || index}`,
            kind,
            title,
            preview: "",
            attachment,
            courseId: course.id,
            courseTitle,
            session,
            courseStatus,
            searchText: normalizeSearchText_([courseTitle, schedule, title, getResourceKindLabel_(kind), getResourceKindMeta_(kind).synonyms].join(" ")),
          });
        });
      });
    });
    return rows.sort((a, b) => {
      const left = `${String((a.session && a.session.sessionDate) || "")} ${a.courseTitle} ${a.title}`;
      const right = `${String((b.session && b.session.sessionDate) || "")} ${b.courseTitle} ${b.title}`;
      return right.localeCompare(left, "zh-Hant", { numeric: true, sensitivity: "base" });
    });
  }, [allCourseCatalog, todayText]);

  const resourceCountsByCourseId = useMemo(() => {
    const map = new Map();
    resourceIndex.forEach((item) => {
      const courseId = String(item.courseId || "");
      if (!courseId) {
        return;
      }
      const counts = map.get(courseId) || {};
      counts[item.kind] = (counts[item.kind] || 0) + 1;
      map.set(courseId, counts);
    });
    return map;
  }, [resourceIndex]);

  const filteredResourceIndex = useMemo(() => {
    const tokens = normalizeSearchText_(resourceQuery).split(" ").filter(Boolean);
    return resourceIndex.filter((item) => {
      if (resourceScope === "focus" && item.courseStatus === "completed") {
        return false;
      }
      if (resourceScope === "completed" && item.courseStatus !== "completed") {
        return false;
      }
      if (resourceKind !== "all") {
        if (resourceKind === "homework" && item.kind !== "homework" && item.kind !== "homework_file" && item.kind !== "homework_reference") {
          return false;
        } else if (resourceKind !== "homework" && item.kind !== resourceKind) {
          return false;
        }
      }
      if (tokens.length && !tokens.every((token) => item.searchText.includes(token))) {
        return false;
      }
      return true;
    });
  }, [resourceIndex, resourceKind, resourceQuery, resourceScope]);

  const handleRevealCourse_ = (courseId) => {
    setActiveTab("courses");
    setCourseScope("all");
    setExpandedCourseId(courseId);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const node = document.getElementById(`course-${courseId}`);
        if (node && node.scrollIntoView) {
          node.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 80);
    }
  };

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
              { id: "resources", label: "找資料" },
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
              <p className="mt-2 text-sm text-slate-500">先看課程，再展開堂次。日期保留當線索，不再當主入口。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCourseScope("focus")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  courseScope === "focus" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                進行中/即將（{focusCourseCatalog.length}）
              </button>
              <button
                type="button"
                onClick={() => setCourseScope("completed")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  courseScope === "completed" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                已上完（{completedCourseCatalog.length}）
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
            {courseCatalog.map((unit) => (
              <div key={unit.id} id={`course-${unit.id}`} className="scroll-mt-6">
                <CourseCatalogCard
                  unit={unit}
                  apiRequest={apiRequest}
                  formatSessionSchedule_={formatSessionSchedule_}
                  expanded={expandedCourseId === unit.id}
                  onToggle={(courseId) => setExpandedCourseId((prev) => (prev === courseId ? "" : courseId))}
                  resourceCountsByCourseId={resourceCountsByCourseId}
                />
              </div>
            ))}
          </div>
          </section>
        ) : null}

        {activeTab === "resources" ? (
          <section className="mt-6 card p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-500">Resources</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">找作業 / 報告 / 考古題</h2>
                <p className="mt-2 text-sm text-slate-500">直接搜尋資料內容，不用先猜是哪一天上課。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {filteredResourceIndex.length} / {resourceIndex.length} 筆
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <input
                value={resourceQuery}
                onChange={(event) => setResourceQuery(event.target.value)}
                placeholder="搜尋課名、檔名、作業、報告、考古題、答案、期中、quiz..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
              />

              <div className="flex flex-wrap gap-2">
                {RESOURCE_KIND_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setResourceKind(item.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      resourceKind === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "全部" },
                  { id: "focus", label: "即將/進行中" },
                  { id: "completed", label: "已上完可複習" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setResourceScope(item.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      resourceScope === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3">
                {!filteredResourceIndex.length ? (
                  <div className="alert alert-info text-xs">目前沒有符合條件的資料。</div>
                ) : null}
                {filteredResourceIndex.slice(0, 80).map((resource) => (
                  <ResourceListItem
                    key={resource.id}
                    resource={resource}
                    apiRequest={apiRequest}
                    formatSessionSchedule_={formatSessionSchedule_}
                    onRevealCourse={handleRevealCourse_}
                  />
                ))}
                {filteredResourceIndex.length > 80 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">只顯示前 80 筆，請用搜尋或類型縮小範圍。</div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
