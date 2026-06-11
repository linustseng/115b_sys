import React, { useEffect, useMemo, useState } from "react";
import { resolveAndOpenAttachment_ } from "../utils/attachments";

function parseMultilineItems_(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toMultilineText_(items = [], fallbackText = "") {
  if (Array.isArray(items) && items.length) {
    return items
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join("\n");
  }
  return String(fallbackText || "").trim();
}

function parseLinkItemsText_(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^|｜]+)\s*[|｜]\s*(https?:\/\/\S+)$/i);
      if (match) {
        return {
          label: String(match[1] || "").trim(),
          url: String(match[2] || "").trim(),
        };
      }
      return {
        label: "",
        url: line,
      };
    })
    .filter((item) => /^https?:\/\//i.test(String(item.url || "")));
}

function toLinkItemsText_(items = [], fallbackUrl = "", fallbackLabel = "") {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      label: String(item && item.label ? item.label : "").trim(),
      url: String(item && item.url ? item.url : "").trim(),
    }))
    .filter((item) => /^https?:\/\//i.test(item.url));

  if (normalizedItems.length) {
    return normalizedItems
      .map((item) => (item.label ? `${item.label} | ${item.url}` : item.url))
      .join("\n");
  }

  const url = String(fallbackUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return "";
  }
  const label = String(fallbackLabel || "").trim();
  return label ? `${label} | ${url}` : url;
}

function buildCourseNoteForm(note, courseId = "") {
  return {
    courseId: courseId || (note && note.courseId) || "",
    title: (note && note.title) || "",
    linkItemsText: toLinkItemsText_(note && note.linkItems, (note && note.linkUrl) || "", (note && note.linkLabel) || ""),
  };
}

function normalizeAttachmentItems_(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => ({
      attachmentId: String(item && (item.attachmentId || item.id) ? item.attachmentId || item.id : "").trim(),
      id: String(item && (item.attachmentId || item.id) ? item.attachmentId || item.id : "").trim(),
      name: String(item && (item.name || item.originalName || item.url) ? item.name || item.originalName || item.url : "附件").trim(),
      url: String(item && item.url ? item.url : "").trim(),
      mimeType: String(item && item.mimeType ? item.mimeType : "").trim(),
      sizeBytes: Number(item && item.sizeBytes ? item.sizeBytes : 0),
      attachmentKind: String(item && item.attachmentKind ? item.attachmentKind : "homework_file").trim() || "homework_file",
      source: String(item && item.source ? item.source : "attachment").trim() || "attachment",
    }))
    .filter((item) => item.attachmentId || item.url);
}

function buildSessionTaskForm(task, sessionId = "") {
  return {
    sessionId: sessionId || (task && task.sessionId) || "",
    homeworkNotice: toMultilineText_(task && task.homeworkItems, (task && task.homeworkNotice) || ""),
    quizNotice: toMultilineText_(task && task.quizItems, (task && task.quizNotice) || ""),
    attachments: normalizeAttachmentItems_(task && task.attachments),
  };
}

const ACADEMIC_ATTACHMENT_KIND_OPTIONS = [
  { id: "homework_file", label: "報告題目" },
  { id: "homework_reference", label: "報告參考" },
  { id: "past_exam", label: "考古題" },
  { id: "answer_key", label: "參考答案" },
  { id: "handout", label: "講義" },
  { id: "other", label: "其他資料" },
];

function getAcademicAttachmentKindLabel_(value) {
  const item = ACADEMIC_ATTACHMENT_KIND_OPTIONS.find((candidate) => candidate.id === value);
  return item ? item.label : "報告題目";
}

function buildMakeupNoteForm(note, sessionId = "") {
  return {
    sessionId: sessionId || (note && note.sessionId) || "",
    reminderTitle: (note && (note.reminderTitle || note.title)) || "",
    reminderText: (note && (note.reminderText || note.makeupReminder || note.note)) || "",
    reminderLinkUrl: (note && (note.reminderLinkUrl || note.linkUrl)) || "",
    reminderLinkLabel: (note && (note.reminderLinkLabel || note.linkLabel)) || "",
    status: (note && note.status) || "published",
  };
}

const MAKEUP_REMINDER_PRESETS = [
  { title: "本次有小考", text: "前 20 分鐘進行小考，請提前入座。" },
  { title: "請帶講義", text: "請記得攜帶講義 / 指定教材。" },
  { title: "已改教室", text: "本次補課地點有調整，請留意現場公告。" },
  { title: "請先看資料", text: "上課前請先閱讀指定資料 / 影片。" },
];

function toCsvCell_(value) {
  const text = String(value == null ? "" : value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvText_(rows) {
  return `\ufeff${rows.map((row) => row.map((value) => toCsvCell_(value)).join(",")).join("\n")}`;
}

function downloadTextFile_(filename, content, mimeType = "text/plain;charset=utf-8") {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

export default function AcademicsAdminPage({ shared }) {
  const {
    apiRequest,
    API_V2_URL,
    loadStoredGoogleIdToken_,
    loadStoredAdminSession_,
    storeGoogleIdToken_,
    getGoogleIdTokenSilently_,
    formatDisplayDate_,
    formatEventSchedule_,
  } = shared;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [adminTab, setAdminTab] = useState("courses");
  const [bootstrap, setBootstrap] = useState({
    sessions: [],
    regularSessions: [],
    makeupTargets: [],
    requests: [],
    courses: [],
    courseSessions: [],
    courseNotes: [],
    sessionTasks: [],
    makeupNotes: [],
    summaryByTarget: [],
    students: [],
  });
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseNoteForm, setCourseNoteForm] = useState(() => buildCourseNoteForm(null, ""));
  const [sessionTaskDrafts, setSessionTaskDrafts] = useState({});
  const [selectedMakeupSessionId, setSelectedMakeupSessionId] = useState("");
  const [makeupNoteForm, setMakeupNoteForm] = useState(() => buildMakeupNoteForm(null, ""));
  const [requestDrafts, setRequestDrafts] = useState({});
  const [sessionTaskUploadState, setSessionTaskUploadState] = useState({});
  const [sessionTaskAttachmentKinds, setSessionTaskAttachmentKinds] = useState({});
  const [selectedTargetDate, setSelectedTargetDate] = useState("");
  const [manualForm, setManualForm] = useState({
    studentId: "",
    targetSessionId: "",
    needMeal: false,
    needHandout: true,
    note: "",
  });

  const loadBootstrap_ = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listAcademicsAdminBootstrap" });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入失敗");
      }
      const data = result.data || {};
      setBootstrap({
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        regularSessions: Array.isArray(data.regularSessions) ? data.regularSessions : [],
        makeupTargets: Array.isArray(data.makeupTargets) ? data.makeupTargets : [],
        requests: Array.isArray(data.requests) ? data.requests : [],
        courses: Array.isArray(data.courses) ? data.courses : [],
        courseSessions: Array.isArray(data.courseSessions) ? data.courseSessions : [],
        courseNotes: Array.isArray(data.courseNotes) ? data.courseNotes : [],
        sessionTasks: Array.isArray(data.sessionTasks) ? data.sessionTasks : [],
        makeupNotes: Array.isArray(data.makeupNotes) ? data.makeupNotes : [],
        summaryByTarget: Array.isArray(data.summaryByTarget) ? data.summaryByTarget : [],
        students: Array.isArray(data.students) ? data.students : [],
      });
      setRequestDrafts((prev) => {
        const next = { ...prev };
        (Array.isArray(data.requests) ? data.requests : []).forEach((item) => {
          next[item.id] = {
            status: item.status || "submitted",
            adminNote: item.adminNote || "",
          };
        });
        return next;
      });
    } catch (err) {
      setError(String((err && err.message) || "載入失敗"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap_();
  }, []);

  const sessionsById = useMemo(() => {
    const map = new Map();
    (bootstrap.sessions || []).forEach((item) => map.set(item.id, item));
    return map;
  }, [bootstrap.sessions]);

  const makeupNotesBySessionId = useMemo(() => {
    const map = new Map();
    (bootstrap.makeupNotes || []).forEach((item) => map.set(item.sessionId, item));
    return map;
  }, [bootstrap.makeupNotes]);

  const courseNotesByCourseId = useMemo(() => {
    const map = new Map();
    (bootstrap.courseNotes || []).forEach((item) => map.set(item.courseId, item));
    return map;
  }, [bootstrap.courseNotes]);

  const sessionTasksBySessionId = useMemo(() => {
    const map = new Map();
    (bootstrap.sessionTasks || []).forEach((item) => map.set(item.sessionId, item));
    return map;
  }, [bootstrap.sessionTasks]);

  const courseCatalog = useMemo(() => {
    const buckets = new Map();
    (bootstrap.courses || []).forEach((course) => {
      buckets.set(course.id, {
        ...course,
        note: courseNotesByCourseId.get(course.id) || null,
        sessions: [],
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
      .map((course) => ({
        ...course,
        sessions: (course.sessions || []).slice().sort((a, b) => {
          const left = `${String(a.sessionDate || "")} ${String(a.startsAt || "")}`;
          const right = `${String(b.sessionDate || "")} ${String(b.startsAt || "")}`;
          return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
        }),
      }))
      .filter((course) => course.sessions.length)
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "zh-Hant", { numeric: true, sensitivity: "base" }));
  }, [bootstrap.courses, bootstrap.courseSessions, courseNotesByCourseId, sessionTasksBySessionId, sessionsById]);

  const activeRequests = useMemo(
    () => (bootstrap.requests || []).filter((item) => String(item.status || "") !== "cancelled"),
    [bootstrap.requests]
  );

  const requestsByTarget = useMemo(() => {
    const map = new Map();
    activeRequests.forEach((item) => {
      const key = String(item.targetSessionId || "").trim();
      if (!key) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(item);
    });
    return map;
  }, [activeRequests]);

  const availableTargetDates = useMemo(() => {
    const values = new Set();
    (bootstrap.makeupTargets || []).forEach((item) => {
      const date = String(item.sessionDate || "").trim();
      if (date) {
        values.add(date);
      }
    });
    (bootstrap.summaryByTarget || []).forEach((item) => {
      const session = sessionsById.get(item.targetSessionId) || item.targetSession || null;
      const date = String((session && session.sessionDate) || "").trim();
      if (date) {
        values.add(date);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" }));
  }, [bootstrap.makeupTargets, bootstrap.summaryByTarget, sessionsById]);

  const filteredSummaryByTarget = useMemo(() => {
    return (bootstrap.summaryByTarget || []).filter((item) => {
      if (!selectedTargetDate) {
        return true;
      }
      const session = sessionsById.get(item.targetSessionId) || item.targetSession || null;
      return String((session && session.sessionDate) || "") === selectedTargetDate;
    });
  }, [bootstrap.summaryByTarget, sessionsById, selectedTargetDate]);

  const filteredRequests = useMemo(() => {
    return (bootstrap.requests || []).filter((item) => {
      if (!selectedTargetDate) {
        return true;
      }
      const session = item.targetSession || sessionsById.get(item.targetSessionId) || null;
      return String((session && session.sessionDate) || "") === selectedTargetDate;
    });
  }, [bootstrap.requests, sessionsById, selectedTargetDate]);

  useEffect(() => {
    if (!selectedCourseId) {
      const firstCourseId = String(((courseCatalog || [])[0] && (courseCatalog || [])[0].id) || "");
      if (firstCourseId) {
        setSelectedCourseId(firstCourseId);
        setCourseNoteForm(buildCourseNoteForm(courseNotesByCourseId.get(firstCourseId), firstCourseId));
      }
      return;
    }
    setCourseNoteForm(buildCourseNoteForm(courseNotesByCourseId.get(selectedCourseId), selectedCourseId));
  }, [selectedCourseId, courseNotesByCourseId, courseCatalog]);

  useEffect(() => {
      if (!selectedMakeupSessionId) {
        const firstSessionId = String(((bootstrap.makeupTargets || [])[0] && (bootstrap.makeupTargets || [])[0].id) || "");
      if (firstSessionId) {
        setSelectedMakeupSessionId(firstSessionId);
        setMakeupNoteForm(buildMakeupNoteForm(makeupNotesBySessionId.get(firstSessionId), firstSessionId));
      }
      return;
    }
    setMakeupNoteForm(buildMakeupNoteForm(makeupNotesBySessionId.get(selectedMakeupSessionId), selectedMakeupSessionId));
  }, [selectedMakeupSessionId, makeupNotesBySessionId, bootstrap.makeupTargets]);

  useEffect(() => {
    setSessionTaskDrafts((prev) => {
      const next = { ...prev };
      courseCatalog.forEach((course) => {
        (course.sessions || []).forEach((session) => {
          next[session.id] = next[session.id] || buildSessionTaskForm(session.task, session.id);
        });
      });
      return next;
    });
  }, [courseCatalog]);

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

  const getRequestsForTarget_ = (targetSessionId) => requestsByTarget.get(String(targetSessionId || "").trim()) || [];

  const buildStaffSummaryText_ = (summaryItem) => {
    const targetRequests = getRequestsForTarget_(summaryItem && summaryItem.targetSessionId);
    const targetSession = (summaryItem && summaryItem.targetSession) || null;
    const targetLabel = targetSession ? formatSessionSchedule_(targetSession) : String((summaryItem && summaryItem.targetSessionId) || "");
    const lines = [
      "【115B 補課名單】",
      `補課場次：${targetLabel || "-"}`,
      `有效名單：${Number((summaryItem && summaryItem.active) || 0)} 人`,
      `餐食：${Number((summaryItem && summaryItem.needMeal) || 0)} 份`,
      `講義：${Number((summaryItem && summaryItem.needHandout) || 0)} 份`,
      "名單：",
    ];

    if (!targetRequests.length) {
      lines.push("（目前無）");
      return lines.join("\n");
    }

    targetRequests.forEach((item, index) => {
      const bits = [`${index + 1}. ${item.studentName || item.studentEmail || item.studentId || "未命名"}`];
      if (item.missedSession && item.missedSession.title) {
        bits.push(`原課：${item.missedSession.title}`);
      }
      if (item.missedSession && item.missedSession.sessionDate) {
        bits.push(`原課日期：${formatSessionSchedule_(item.missedSession)}`);
      }
      bits.push(`餐食：${item.needMeal ? "要" : "免"}`);
      bits.push(`講義：${item.needHandout ? "要" : "免"}`);
      if (item.reason) {
        bits.push(`原因：${item.reason}`);
      }
      if (item.note) {
        bits.push(`備註：${item.note}`);
      }
      if (item.adminNote) {
        bits.push(`管理備註：${item.adminNote}`);
      }
      lines.push(bits.join("｜"));
    });

    return lines.join("\n");
  };

  const handleCopyStaffSummary_ = async (summaryItem) => {
    const text = buildStaffSummaryText_(summaryItem);
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("此瀏覽器不支援剪貼簿寫入");
      }
      await navigator.clipboard.writeText(text);
      setStatus("已複製給對班幹部的文字。");
      setError("");
    } catch (err) {
      setError(String((err && err.message) || "複製失敗"));
    }
  };

  const handleExportTargetCsv_ = (summaryItem) => {
    const targetRequests = getRequestsForTarget_(summaryItem && summaryItem.targetSessionId);
    const targetSession = (summaryItem && summaryItem.targetSession) || null;
    const targetLabel = targetSession ? formatSessionSchedule_(targetSession) : String((summaryItem && summaryItem.targetSessionId) || "");
    const rows = [
      [
        "補課場次",
        "補課日期",
        "學生姓名",
        "學生Email",
        "原課程",
        "原課日期",
        "餐食",
        "講義",
        "狀態",
        "原因",
        "備註",
        "管理備註",
      ],
      ...targetRequests.map((item) => [
        targetLabel,
        (targetSession && targetSession.sessionDate) || "",
        item.studentName || item.studentId || "",
        item.studentEmail || "",
        (item.missedSession && item.missedSession.title) || item.missedSessionId || "",
        (item.missedSession && item.missedSession.sessionDate) || "",
        item.needMeal ? "是" : "否",
        item.needHandout ? "是" : "否",
        item.status || "",
        item.reason || "",
        item.note || "",
        item.adminNote || "",
      ]),
    ];
    const sessionDate = String((targetSession && targetSession.sessionDate) || "makeup").replace(/[^0-9-]/g, "");
    const ok = downloadTextFile_(`makeup-${sessionDate || 'list'}.csv`, buildCsvText_(rows), "text/csv;charset=utf-8");
    if (ok) {
      setStatus("補課名單 CSV 已下載。");
      setError("");
    } else {
      setError("CSV 匯出失敗");
    }
  };

  const updateRequestDraft_ = (id, patch) => {
    setRequestDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }));
  };

  const handleSaveRequest_ = async (id) => {
    const draft = requestDrafts[id] || {};
    setStatus("");
    setError("");
    try {
      const { result } = await apiRequest({
        action: "updateMakeupRequest",
        data: {
          id,
          status: draft.status,
          adminNote: draft.adminNote,
        },
      });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "更新失敗");
      }
      setStatus("補課狀態已更新。");
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "更新失敗"));
    }
  };

  const handleCreateManualRequest_ = async (event) => {
    event.preventDefault();
    if (!manualForm.studentId || !manualForm.targetSessionId) {
      setError("請先選擇同學與補課日期。");
      return;
    }
    setStatus("");
    setError("");
    try {
      const { result } = await apiRequest({
        action: "adminCreateMakeupRequest",
        data: {
          studentId: manualForm.studentId,
          targetSessionId: manualForm.targetSessionId,
          needMeal: manualForm.needMeal,
          needHandout: manualForm.needHandout,
          note: manualForm.note,
        },
      });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "補資料失敗");
      }
      setManualForm({
        studentId: "",
        targetSessionId: "",
        needMeal: false,
        needHandout: true,
        note: "",
      });
      setStatus("已在後台補登補課資料。");
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "補資料失敗"));
    }
  };

  const handleSaveCourseNote_ = async (event) => {
    event.preventDefault();
    if (!courseNoteForm.courseId) {
      setError("請先選擇課程。");
      return;
    }
    setStatus("");
    setError("");
    try {
      const linkItems = parseLinkItemsText_(courseNoteForm.linkItemsText);
      const firstLink = linkItems[0] || null;

      const payload = {
        ...courseNoteForm,
        summary: "",
        linkUrl: firstLink ? firstLink.url : "",
        linkLabel: firstLink ? firstLink.label : "",
        summaryItems: [],
        linkItems,
      };

      const { result } = await apiRequest({ action: "upsertAcademicCourseNote", data: payload });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "儲存失敗");
      }
      setStatus("課程筆記已儲存。");
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "儲存失敗"));
    }
  };

  const updateSessionTaskDraft_ = (sessionId, patch) => {
    setSessionTaskDrafts((prev) => ({
      ...prev,
      [sessionId]: {
        ...(prev[sessionId] || buildSessionTaskForm(null, sessionId)),
        ...patch,
        sessionId,
      },
    }));
  };

  const handleSaveSessionTask_ = async (sessionId, extraPatch = {}, successMessage = "堂次報告 / 小考已儲存。") => {
    const draft = {
      ...(sessionTaskDrafts[sessionId] || buildSessionTaskForm(null, sessionId)),
      ...(extraPatch && typeof extraPatch === "object" ? extraPatch : {}),
      sessionId,
    };
    if (!sessionId) {
      setError("缺少堂次資料");
      return;
    }
    setStatus("");
    setError("");
    try {
      const homeworkItems = parseMultilineItems_(draft.homeworkNotice);
      const quizItems = parseMultilineItems_(draft.quizNotice);
      const attachments = normalizeAttachmentItems_(draft.attachments);
      const payload = {
        sessionId,
        homeworkNotice: homeworkItems.join("\n"),
        quizNotice: quizItems.join("\n"),
        homeworkItems,
        quizItems,
        attachments,
      };
      const { result } = await apiRequest({ action: "upsertAcademicSessionTask", data: payload });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "儲存失敗");
      }
      setSessionTaskDrafts((prev) => ({
        ...prev,
        [sessionId]: buildSessionTaskForm(result.data && result.data.task, sessionId),
      }));
      setStatus(successMessage);
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "儲存失敗"));
    }
  };

  const handleUploadSessionTaskAttachment_ = async (sessionId, file, attachmentKind = "homework_file") => {
    if (!file || !sessionId) {
      return;
    }
    if (!API_V2_URL) {
      setSessionTaskUploadState((prev) => ({
        ...prev,
        [sessionId]: { uploading: false, error: "目前尚未設定 API v2，附件上傳未啟用" },
      }));
      return;
    }
    const storedSession = (typeof loadStoredAdminSession_ === "function" ? loadStoredAdminSession_() : null) || {};
    let sessionToken = String(storedSession.token || "").trim();
    let idToken = String(loadStoredGoogleIdToken_() || "").trim();
    setSessionTaskUploadState((prev) => ({
      ...prev,
      [sessionId]: { uploading: true, error: "" },
    }));
    try {
      const base = API_V2_URL.endsWith("/") ? API_V2_URL.slice(0, -1) : API_V2_URL;
      const sendUpload_ = async ({ sessionToken: nextSessionToken = "", idToken: nextIdToken = "" } = {}) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("entityType", "academic_session_note");
        formData.append("entityId", sessionId);
        formData.append("attachmentKind", attachmentKind || "homework_file");
        const headers = {};
        if (nextSessionToken) {
          headers.Authorization = `Bearer ${nextSessionToken}`;
        } else if (nextIdToken) {
          headers["x-id-token"] = nextIdToken;
        }
        return fetch(`${base}/v1/attachments/upload`, {
          method: "POST",
          headers,
          body: formData,
        });
      };
      let response = sessionToken ? await sendUpload_({ sessionToken }) : null;
      if ((!response || response.status === 401) && !idToken && typeof getGoogleIdTokenSilently_ === "function") {
        try {
          idToken = String((await getGoogleIdTokenSilently_()) || "").trim();
          if (idToken) {
            storeGoogleIdToken_(idToken);
          }
        } catch {
          // ignore
        }
      }
      if (!response) {
        if (!idToken) {
          throw new Error("請先登入後台，若 session 已過期再重新 Google 登入");
        }
        response = await sendUpload_({ idToken });
      } else if (response.status === 401) {
        if (!idToken && typeof getGoogleIdTokenSilently_ === "function") {
          try {
            idToken = String((await getGoogleIdTokenSilently_()) || "").trim();
            if (idToken) {
              storeGoogleIdToken_(idToken);
            }
          } catch {
            // ignore
          }
        }
        if (!idToken) {
          throw new Error("後台 session 已失效，請重新登入");
        }
        response = await sendUpload_({ idToken });
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || `上傳失敗 (HTTP ${response.status})`);
      }
      const item = normalizeAttachmentItems_([payload.data && (payload.data.item || payload.data)])[0];
      if (!item) {
        throw new Error("上傳成功但缺少附件資料");
      }
      const currentDraft = sessionTaskDrafts[sessionId] || buildSessionTaskForm(sessionTasksBySessionId.get(sessionId), sessionId);
      const nextAttachments = normalizeAttachmentItems_([...(currentDraft.attachments || []), item]).filter(
        (attachment, index, arr) => arr.findIndex((candidate) => String((candidate.attachmentId || candidate.url) || "") === String((attachment.attachmentId || attachment.url) || "")) === index
      );
      setSessionTaskDrafts((prev) => ({
        ...prev,
        [sessionId]: {
          ...currentDraft,
          attachments: nextAttachments,
        },
      }));
      await handleSaveSessionTask_(sessionId, { ...currentDraft, attachments: nextAttachments }, "報告檔案已上傳。");
      setSessionTaskUploadState((prev) => ({
        ...prev,
        [sessionId]: { uploading: false, error: "" },
      }));
    } catch (err) {
      setSessionTaskUploadState((prev) => ({
        ...prev,
        [sessionId]: { uploading: false, error: String((err && err.message) || "上傳失敗") },
      }));
    }
  };

  const handleRemoveSessionTaskAttachment_ = async (sessionId, target) => {
    const currentDraft = sessionTaskDrafts[sessionId] || buildSessionTaskForm(sessionTasksBySessionId.get(sessionId), sessionId);
    const nextAttachments = normalizeAttachmentItems_(currentDraft.attachments).filter((item) => {
      const key = String((item.attachmentId || item.url) || "").trim();
      return key !== target;
    });
    setSessionTaskDrafts((prev) => ({
      ...prev,
      [sessionId]: {
        ...currentDraft,
        attachments: nextAttachments,
      },
    }));
    await handleSaveSessionTask_(sessionId, { ...currentDraft, attachments: nextAttachments }, "報告檔案已移除。");
  };

  const handleSaveMakeupNote_ = async (event) => {
    event.preventDefault();
    if (!makeupNoteForm.sessionId) {
      setError("請先選擇補課場次。");
      return;
    }
    setStatus("");
    setError("");
    try {
      const payload = {
        sessionId: makeupNoteForm.sessionId,
        title: String(makeupNoteForm.reminderTitle || "").trim(),
        summary: "",
        homeworkNotice: "",
        quizNotice: "",
        linkUrl: String(makeupNoteForm.reminderLinkUrl || "").trim(),
        linkLabel: String(makeupNoteForm.reminderLinkLabel || "").trim(),
        reminderTitle: String(makeupNoteForm.reminderTitle || "").trim(),
        reminderText: String(makeupNoteForm.reminderText || "").trim(),
        reminderLinkUrl: String(makeupNoteForm.reminderLinkUrl || "").trim(),
        reminderLinkLabel: String(makeupNoteForm.reminderLinkLabel || "").trim(),
        status: makeupNoteForm.status || "published",
      };

      const { result } = await apiRequest({ action: "upsertSessionNote", data: payload });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "儲存失敗");
      }
      setStatus(makeupNoteForm.status === "published" ? "補課提醒已發布。" : "補課提醒草稿已儲存。");
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "儲存失敗"));
    }
  };

  const applyMakeupPreset_ = (preset) => {
    const safePreset = preset && typeof preset === "object" ? preset : {};
    setMakeupNoteForm((prev) => ({
      ...prev,
      sessionId: selectedMakeupSessionId,
      reminderTitle: String(safePreset.title || "").trim() || prev.reminderTitle,
      reminderText: String(safePreset.text || "").trim() || prev.reminderText,
    }));
  };

  const totalActiveRequests = activeRequests.length;
  const totalPublishedNotes = (bootstrap.courseNotes || []).length;

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">NTU EMBA 115B</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">學藝專區 · 後台</h1>
            <p className="mt-3 text-sm text-slate-500">班代 / 副班代 / 學藝組 / 資訊組可同步課程、彙整補課與發布筆記。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/academics"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              同學入口
            </a>
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
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">載入中...</div>
        ) : null}
        {error ? <div className="mb-4 alert alert-error">{error}</div> : null}
        {status ? <div className="mb-4 alert alert-success">{status}</div> : null}

        <section className="mb-6 card p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "courses", label: "課程管理" },
              { id: "makeup", label: "補課管理" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAdminTab(item.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  adminTab === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Regular</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{(bootstrap.regularSessions || []).length}</p>
            <p className="mt-2 text-sm text-slate-500">正式課程（週末）</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-400">Makeup</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{totalActiveRequests}</p>
            <p className="mt-2 text-sm text-slate-500">有效補課登記</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Notes</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{totalPublishedNotes}</p>
            <p className="mt-2 text-sm text-slate-500">已發布摘要</p>
          </div>
        </section>


        {adminTab === "makeup" ? (
        <section className="mt-6 card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">Manual</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">後台補登補課資料</h2>
              <p className="mt-2 text-sm text-slate-500">若同學未自行填寫，可由後台直接補登補課資料。</p>
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-2 block text-sm font-medium text-slate-700">依日期查詢補課名單</label>
              <select
                value={selectedTargetDate}
                onChange={(event) => {
                  setSelectedTargetDate(event.target.value);
                  setManualForm((prev) => ({ ...prev, targetSessionId: "" }));
                }}
                className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
              >
                <option value="">全部日期</option>
                {availableTargetDates.map((date) => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
          </div>

          <form className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]" onSubmit={handleCreateManualRequest_}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">同學</label>
                <select
                  value={manualForm.studentId}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, studentId: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">請選擇同學</option>
                  {(bootstrap.students || []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.group ? `[${student.group}] ` : ""}{student.name || student.email || student.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">補課場次</label>
                <select
                  value={manualForm.targetSessionId}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, targetSessionId: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">請選擇補課場次</option>
                  {(bootstrap.makeupTargets || []).filter((item) => !selectedTargetDate || item.sessionDate === selectedTargetDate).map((item) => (
                    <option key={item.id} value={item.id}>{formatSessionSchedule_(item)}｜{item.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={manualForm.needMeal}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, needMeal: event.target.checked }))}
                  />
                  需要餐食
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={manualForm.needHandout}
                    onChange={(event) => setManualForm((prev) => ({ ...prev, needHandout: event.target.checked }))}
                  />
                  需要講義
                </label>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">備註</label>
                <input
                  value={manualForm.note}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="例如：學藝組協助代填 / 只領講義"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  補登補課資料
                </button>
              </div>
            </div>
          </form>
        </section>
        ) : null}

        {adminTab === "makeup" ? (
        <section className="mt-6 card p-6 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">Reminder</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">補課提醒設定</h2>
            <p className="mt-2 text-sm text-slate-500">給同學看的短提醒；適合放小考、範圍、帶教材、改教室等資訊。</p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSaveMakeupNote_}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">補課場次</label>
              <select
                value={selectedMakeupSessionId}
                onChange={(event) => setSelectedMakeupSessionId(event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
              >
                <option value="">請選擇補課場次</option>
                {(bootstrap.makeupTargets || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatSessionSchedule_(item)}｜{item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">提醒標題</label>
              <input
                value={makeupNoteForm.reminderTitle}
                onChange={(event) => setMakeupNoteForm((prev) => ({ ...prev, reminderTitle: event.target.value, sessionId: selectedMakeupSessionId }))}
                maxLength={30}
                placeholder="例如：本次有小考"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
              <p className="mt-2 text-xs text-slate-500">建議 15 字內，最多 30 字。</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">快捷填入</label>
              <div className="flex flex-wrap gap-2">
                {MAKEUP_REMINDER_PRESETS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => applyMakeupPreset_(preset)}
                    className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:border-violet-300"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">提醒內容</label>
              <textarea
                value={makeupNoteForm.reminderText}
                onChange={(event) => setMakeupNoteForm((prev) => ({ ...prev, reminderText: event.target.value, sessionId: selectedMakeupSessionId }))}
                maxLength={120}
                rows={3}
                placeholder="例如：前 20 分鐘小考，範圍第 3 章 p.45–68。"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>建議 100 字內，最多 120 字；超過就改放外部連結。</span>
                <span>{String(makeupNoteForm.reminderText || "").length}/120</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">補充連結文字</label>
                <input
                  value={makeupNoteForm.reminderLinkLabel}
                  onChange={(event) => setMakeupNoteForm((prev) => ({ ...prev, reminderLinkLabel: event.target.value, sessionId: selectedMakeupSessionId }))}
                  placeholder="例如：查看完整說明"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">補充連結 URL</label>
                <input
                  value={makeupNoteForm.reminderLinkUrl}
                  onChange={(event) => setMakeupNoteForm((prev) => ({ ...prev, reminderLinkUrl: event.target.value, sessionId: selectedMakeupSessionId }))}
                  placeholder="https://..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">狀態</label>
              <select
                value={makeupNoteForm.status}
                onChange={(event) => setMakeupNoteForm((prev) => ({ ...prev, status: event.target.value, sessionId: selectedMakeupSessionId }))}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
              >
                <option value="draft">草稿</option>
                <option value="published">已發布</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                儲存補課提醒
              </button>
            </div>
          </form>
        </section>
        ) : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-1">
          {adminTab === "makeup" ? (
            <div className="space-y-6">
            <section className="card p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">Summary</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">補課場次彙總</h2>
                </div>
                <span className="text-xs text-slate-400">{filteredSummaryByTarget.length} 場</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">{selectedTargetDate ? `目前篩選：${selectedTargetDate}` : "目前顯示全部日期"}</div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {!filteredSummaryByTarget.length ? (
                  <div className="alert alert-info text-xs">目前還沒有補課登記。</div>
                ) : null}
                {filteredSummaryByTarget.map((item) => {
                  const targetRequests = getRequestsForTarget_(item.targetSessionId);
                  return (
                    <div key={item.targetSessionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.targetSession ? formatSessionSchedule_(item.targetSession) : item.targetSessionId}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-slate-600">
                          <div className="font-semibold text-slate-900">{item.active}</div>
                          <div>有效名單</div>
                        </div>
                        <div className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-700">
                          <div className="font-semibold text-amber-900">{item.needMeal}</div>
                          <div>餐食</div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700">
                          <div className="font-semibold text-emerald-900">{item.needHandout}</div>
                          <div>講義</div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">名單預覽</p>
                        <p className="mt-1 leading-6">
                          {targetRequests.length
                            ? targetRequests.map((request) => request.studentName || request.studentEmail || request.studentId).join("、")
                            : "目前沒有有效補課名單"}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyStaffSummary_(item)}
                          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:border-violet-300"
                        >
                          複製給對班幹部文字
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportTargetCsv_(item)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                        >
                          匯出 CSV
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Requests</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">補課申請管理</h2>
                </div>
                <span className="text-xs text-slate-400">共 {filteredRequests.length} 筆</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">{selectedTargetDate ? `目前篩選：${selectedTargetDate}` : "目前顯示全部日期"}</div>
              <div className="mt-5 space-y-4">
                {!filteredRequests.length ? <div className="alert alert-info text-xs">目前沒有補課申請。</div> : null}
                {filteredRequests.map((item) => {
                  const draft = requestDrafts[item.id] || { status: item.status, adminNote: item.adminNote || "" };
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.studentName || item.studentEmail || item.studentId}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            補課：{item.targetSession ? formatSessionSchedule_(item.targetSession) : item.targetSessionId}
                          </p>
                          {item.missedSession ? (
                            <p className="mt-1 text-xs text-slate-500">原課：{formatSessionSchedule_(item.missedSession)}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">餐食：{item.needMeal ? "需要" : "不需要"}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">講義：{item.needHandout ? "需要" : "不需要"}</span>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-[180px_1fr_auto]">
                        <select
                          value={draft.status || "submitted"}
                          onChange={(event) => updateRequestDraft_(item.id, { status: event.target.value })}
                          className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                        >
                          <option value="submitted">已送出</option>
                          <option value="notified">已通知對班</option>
                          <option value="completed">已完成</option>
                          <option value="cancelled">已取消</option>
                        </select>
                        <input
                          value={draft.adminNote || ""}
                          onChange={(event) => updateRequestDraft_(item.id, { adminNote: event.target.value })}
                          placeholder="管理備註"
                          className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRequest_(item.id)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                        >
                          儲存
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          ) : null}

          {adminTab === "courses" ? (
            <section className="card p-6 sm:p-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">Courses</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">課程共用筆記 / 各堂次報告小考</h2>
                <p className="mt-2 text-sm text-slate-500">筆記改成課程層共用，報告與小考則分堂次儲存。</p>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleSaveCourseNote_}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">選擇課程</label>
                  <select
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                  >
                    <option value="">請選擇課程</option>
                    {courseCatalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}｜{item.sessions.length} 堂
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCourseId ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    {(courseCatalog.find((item) => item.id === selectedCourseId)?.sessions || [])
                      .map((session) => formatSessionSchedule_(session))
                      .filter(Boolean)
                      .join("｜") || "尚未綁定堂次"}
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">筆記標題</label>
                  <input
                    value={courseNoteForm.title}
                    onChange={(event) => setCourseNoteForm((prev) => ({ ...prev, title: event.target.value, courseId: selectedCourseId }))}
                    placeholder="例如：經濟導論 共用筆記"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">外部連結（可多筆）</label>
                  <textarea
                    value={courseNoteForm.linkItemsText}
                    onChange={(event) => setCourseNoteForm((prev) => ({ ...prev, linkItemsText: event.target.value, courseId: selectedCourseId }))}
                    rows={4}
                    placeholder={"每行一筆\n範例：NotebookLM 摘要 | https://notebooklm.google.com/...\n或只填 URL 也可"}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    儲存課程筆記
                  </button>
                </div>
              </form>

              {selectedCourseId ? (
                <div className="mt-8 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Sessions</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">各堂次報告 / 小考</h3>
                  </div>
                  {(courseCatalog.find((item) => item.id === selectedCourseId)?.sessions || []).map((session) => {
                    const draft = sessionTaskDrafts[session.id] || buildSessionTaskForm(session.task, session.id);
                    const uploadState = sessionTaskUploadState[session.id] || { uploading: false, error: "" };
                    const selectedAttachmentKind = sessionTaskAttachmentKinds[session.id] || "homework_file";
                    return (
                      <div key={session.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{formatSessionSchedule_(session)}</p>
                            {session.location ? <p className="mt-1 text-xs text-slate-500">地點：{session.location}</p> : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveSessionTask_(session.id)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                          >
                            儲存本堂內容
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">報告</label>
                            <textarea
                              value={draft.homeworkNotice}
                              onChange={(event) => updateSessionTaskDraft_(session.id, { homeworkNotice: event.target.value })}
                              rows={4}
                              placeholder={"可分行補充說明，同一堂次會視為 1 份報告\n例如：下週前提交個案分析"}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">小考</label>
                            <textarea
                              value={draft.quizNotice}
                              onChange={(event) => updateSessionTaskDraft_(session.id, { quizNotice: event.target.value })}
                              rows={4}
                              placeholder={"每行一筆\n例如：下次上課前 10 分鐘小考"}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-800">學習資料檔案</p>
                              <p className="mt-1 text-xs text-slate-500">可上傳報告題目、考古題、參考答案、講義等，會依類型顯示在同學課程頁與找資料。</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={selectedAttachmentKind}
                                onChange={(event) => setSessionTaskAttachmentKinds((prev) => ({ ...prev, [session.id]: event.target.value }))}
                                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                              >
                                {ACADEMIC_ATTACHMENT_KIND_OPTIONS.map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                              <label
                                className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold ${
                                  uploadState.uploading
                                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                                }`}
                              >
                                <input
                                  type="file"
                                  className="hidden"
                                  disabled={uploadState.uploading}
                                  accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                  onChange={(event) => {
                                    const f = event.target.files && event.target.files[0];
                                    event.target.value = "";
                                    handleUploadSessionTaskAttachment_(session.id, f, selectedAttachmentKind);
                                  }}
                                />
                                {uploadState.uploading ? "上傳中..." : `上傳${getAcademicAttachmentKindLabel_(selectedAttachmentKind)}`}
                              </label>
                            </div>
                          </div>
                          {uploadState.error ? <div className="mt-3 alert alert-error text-xs">{uploadState.error}</div> : null}
                          {Array.isArray(draft.attachments) && draft.attachments.length ? (
                            <div className="mt-3 space-y-2">
                              {draft.attachments.map((item, index) => {
                                const key = String((item && (item.attachmentId || item.url)) || index).trim();
                                return (
                                  <div key={key || index} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => resolveAndOpenAttachment_(item, apiRequest).catch(() => window.alert("附件暫時無法開啟，請稍後再試"))}
                                      className="flex-1 truncate text-left text-xs text-slate-600 underline-offset-2 hover:underline"
                                    >
                                      {getAcademicAttachmentKindLabel_(item.attachmentKind)}｜{item.name || item.url || "附件"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSessionTaskAttachment_(session.id, key)}
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                    >
                                      移除
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-slate-400">目前尚未上傳學習資料檔案。</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}
