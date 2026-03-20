import React, { useEffect, useMemo, useState } from "react";

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

function buildNoteForm(note, sessionId = "") {
  return {
    sessionId: sessionId || (note && note.sessionId) || "",
    title: (note && note.title) || "",
    summary: toMultilineText_(note && note.summaryItems, (note && note.summary) || ""),
    linkItemsText: toLinkItemsText_(note && note.linkItems, (note && note.linkUrl) || "", (note && note.linkLabel) || ""),
    homeworkNotice: toMultilineText_(note && note.homeworkItems, (note && note.homeworkNotice) || ""),
    quizNotice: toMultilineText_(note && note.quizItems, (note && note.quizNotice) || ""),
    status: (note && note.status) || "draft",
  };
}

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
    formatDisplayDate_,
    formatEventSchedule_,
  } = shared;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [adminTab, setAdminTab] = useState("courses");
  const [syncing, setSyncing] = useState(false);
  const [bootstrap, setBootstrap] = useState({
    sessions: [],
    regularSessions: [],
    makeupTargets: [],
    requests: [],
    notes: [],
    summaryByTarget: [],
    students: [],
  });
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [noteForm, setNoteForm] = useState(() => buildNoteForm(null, ""));
  const [requestDrafts, setRequestDrafts] = useState({});
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
        notes: Array.isArray(data.notes) ? data.notes : [],
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

  const notesBySessionId = useMemo(() => {
    const map = new Map();
    (bootstrap.notes || []).forEach((item) => map.set(item.sessionId, item));
    return map;
  }, [bootstrap.notes]);

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
    if (!selectedSessionId) {
      const firstSessionId = String(((bootstrap.regularSessions || [])[0] && (bootstrap.regularSessions || [])[0].id) || "");
      if (firstSessionId) {
        setSelectedSessionId(firstSessionId);
        setNoteForm(buildNoteForm(notesBySessionId.get(firstSessionId), firstSessionId));
      }
      return;
    }
    setNoteForm(buildNoteForm(notesBySessionId.get(selectedSessionId), selectedSessionId));
  }, [selectedSessionId, notesBySessionId, bootstrap.regularSessions]);

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
        bits.push(`原課日期：${item.missedSession.sessionDate}`);
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

  const handleSync_ = async () => {
    setSyncing(true);
    setStatus("");
    setError("");
    try {
      const { result } = await apiRequest({ action: "syncAcademicSessionsFromIcs" });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "同步失敗");
      }
      setStatus(`課程同步完成，匯入 ${Number((result.data && result.data.count) || 0)} 筆。`);
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "同步失敗"));
    } finally {
      setSyncing(false);
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

  const handleSaveNote_ = async (event) => {
    event.preventDefault();
    if (!noteForm.sessionId) {
      setError("請先選擇課程。");
      return;
    }
    setStatus("");
    setError("");
    try {
      const summaryItems = parseMultilineItems_(noteForm.summary);
      const homeworkItems = parseMultilineItems_(noteForm.homeworkNotice);
      const quizItems = parseMultilineItems_(noteForm.quizNotice);
      const linkItems = parseLinkItemsText_(noteForm.linkItemsText);
      const firstLink = linkItems[0] || null;

      const payload = {
        ...noteForm,
        summary: summaryItems.join("\n"),
        homeworkNotice: homeworkItems.join("\n"),
        quizNotice: quizItems.join("\n"),
        linkUrl: firstLink ? firstLink.url : "",
        linkLabel: firstLink ? firstLink.label : "",
        summaryItems,
        homeworkItems,
        quizItems,
        linkItems,
      };

      const { result } = await apiRequest({ action: "upsertSessionNote", data: payload });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "儲存失敗");
      }
      setStatus(noteForm.status === "published" ? "摘要已發布。" : "摘要草稿已儲存。");
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "儲存失敗"));
    }
  };

  const totalActiveRequests = activeRequests.length;
  const totalPublishedNotes = (bootstrap.notes || []).filter((item) => item.status === "published").length;

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


        {adminTab === "courses" ? (
          <section className="mt-6 card p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Calendar Sync</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">同步 Google Calendar 正式課程</h2>
                <p className="mt-2 text-sm text-slate-500">直接以系統設定來源同步 Google Calendar 正式課程。</p>
              </div>
              <button
                type="button"
                onClick={handleSync_}
                disabled={syncing}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? "同步中..." : "立即同步"}
              </button>
            </div>

          </section>
        ) : null}

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
                    <option key={item.id} value={item.id}>{item.sessionDate}｜{item.title}</option>
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
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">Notes</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">課程摘要 / 筆記管理</h2>
              <p className="mt-2 text-sm text-slate-500">目前以 NotebookLM / 外部連結為主，系統負責索引與入口。</p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSaveNote_}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">選擇課程</label>
                <select
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">請選擇課程</option>
                  {(bootstrap.regularSessions || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sessionDate}｜{item.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSessionId && sessionsById.get(selectedSessionId) ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  {formatSessionSchedule_(sessionsById.get(selectedSessionId))}
                  {sessionsById.get(selectedSessionId).location ? `｜${sessionsById.get(selectedSessionId).location}` : ""}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">標題</label>
                <input
                  value={noteForm.title}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value, sessionId: selectedSessionId }))}
                  placeholder="例如：經濟導論02 課後摘要"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">外部連結（可多筆）</label>
                <textarea
                  value={noteForm.linkItemsText}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, linkItemsText: event.target.value, sessionId: selectedSessionId }))}
                  rows={4}
                  placeholder={"每行一筆\n範例：NotebookLM 摘要 | https://notebooklm.google.com/...\n或只填 URL 也可"}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">摘要（可多筆）</label>
                <textarea
                  value={noteForm.summary}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, summary: event.target.value, sessionId: selectedSessionId }))}
                  rows={5}
                  placeholder={"每行一筆\n例如：課堂重點、提醒事項、講師提到的重要概念..."}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">作業通知（可多筆）</label>
                <textarea
                  value={noteForm.homeworkNotice}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, homeworkNotice: event.target.value, sessionId: selectedSessionId }))}
                  rows={3}
                  placeholder={"每行一筆\n例如：下週前提交個案分析\n例如：閱讀指定章節"}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">小考通知（可多筆）</label>
                <textarea
                  value={noteForm.quizNotice}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, quizNotice: event.target.value, sessionId: selectedSessionId }))}
                  rows={3}
                  placeholder={"每行一筆\n例如：下次上課前 10 分鐘小考\n例如：範圍第 3-4 章"}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">狀態</label>
                <select
                  value={noteForm.status}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, status: event.target.value, sessionId: selectedSessionId }))}
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
                  儲存摘要
                </button>
              </div>
            </form>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}
