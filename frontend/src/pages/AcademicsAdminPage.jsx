import React, { useEffect, useMemo, useState } from "react";

function buildNoteForm(note, sessionId = "") {
  return {
    sessionId: sessionId || (note && note.sessionId) || "",
    title: (note && note.title) || "",
    summary: (note && note.summary) || "",
    linkUrl: (note && note.linkUrl) || "",
    linkLabel: (note && note.linkLabel) || "",
    status: (note && note.status) || "draft",
  };
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
  const [syncing, setSyncing] = useState(false);
  const [icsUrlInput, setIcsUrlInput] = useState("");
  const [bootstrap, setBootstrap] = useState({
    sessions: [],
    regularSessions: [],
    makeupTargets: [],
    requests: [],
    notes: [],
    summaryByTarget: [],
  });
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [noteForm, setNoteForm] = useState(() => buildNoteForm(null, ""));
  const [requestDrafts, setRequestDrafts] = useState({});

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
      return formatEventSchedule_(session.startsAt || session.sessionDate, session.endsAt || session.startsAt || session.sessionDate);
    }
    if (session.sessionDate) {
      return formatDisplayDate_(session.sessionDate, { withTime: false });
    }
    return "";
  };

  const handleSync_ = async () => {
    setSyncing(true);
    setStatus("");
    setError("");
    try {
      const payload = { action: "syncAcademicSessionsFromIcs" };
      if (String(icsUrlInput || "").trim()) {
        payload.icsUrl = String(icsUrlInput || "").trim();
      }
      const { result } = await apiRequest(payload);
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

  const handleSaveNote_ = async (event) => {
    event.preventDefault();
    if (!noteForm.sessionId) {
      setError("請先選擇課程。");
      return;
    }
    setStatus("");
    setError("");
    try {
      const { result } = await apiRequest({ action: "upsertSessionNote", data: noteForm });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "儲存失敗");
      }
      setStatus(noteForm.status === "published" ? "摘要已發布。" : "摘要草稿已儲存。");
      await loadBootstrap_();
    } catch (err) {
      setError(String((err && err.message) || "儲存失敗"));
    }
  };

  const totalActiveRequests = (bootstrap.requests || []).filter((item) => item.status !== "cancelled").length;
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

        <section className="mt-6 card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Calendar Sync</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">同步 Google Calendar 正式課程</h2>
              <p className="mt-2 text-sm text-slate-500">未設定環境變數時，可臨時貼入 ICS URL 進行同步。</p>
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
          <input
            value={icsUrlInput}
            onChange={(event) => setIcsUrlInput(event.target.value)}
            placeholder="可選：臨時 ICS URL（未填則走後端環境變數）"
            className="mt-4 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="card p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">Summary</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">補課場次彙總</h2>
                </div>
                <span className="text-xs text-slate-400">{(bootstrap.summaryByTarget || []).length} 場</span>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {!(bootstrap.summaryByTarget || []).length ? (
                  <div className="alert alert-info text-xs">目前還沒有補課登記。</div>
                ) : null}
                {(bootstrap.summaryByTarget || []).map((item) => (
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
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Requests</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">補課申請管理</h2>
                </div>
                <span className="text-xs text-slate-400">共 {(bootstrap.requests || []).length} 筆</span>
              </div>
              <div className="mt-5 space-y-4">
                {!(bootstrap.requests || []).length ? <div className="alert alert-info text-xs">目前沒有補課申請。</div> : null}
                {(bootstrap.requests || []).map((item) => {
                  const draft = requestDrafts[item.id] || { status: item.status, adminNote: item.adminNote || "" };
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.studentName || item.studentEmail || item.studentId}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            原課：{item.missedSession ? formatSessionSchedule_(item.missedSession) : item.missedSessionId}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            補課：{item.targetSession ? formatSessionSchedule_(item.targetSession) : item.targetSessionId}
                          </p>
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
                <label className="mb-2 block text-sm font-medium text-slate-700">外部連結</label>
                <input
                  value={noteForm.linkUrl}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, linkUrl: event.target.value, sessionId: selectedSessionId }))}
                  placeholder="https://notebooklm.google.com/..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">連結文字</label>
                <input
                  value={noteForm.linkLabel}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, linkLabel: event.target.value, sessionId: selectedSessionId }))}
                  placeholder="NotebookLM / 摘要連結"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">摘要</label>
                <textarea
                  value={noteForm.summary}
                  onChange={(event) => setNoteForm((prev) => ({ ...prev, summary: event.target.value, sessionId: selectedSessionId }))}
                  rows={5}
                  placeholder="課堂重點、提醒事項、講師提到的重要概念..."
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
        </section>
      </main>
    </div>
  );
}
