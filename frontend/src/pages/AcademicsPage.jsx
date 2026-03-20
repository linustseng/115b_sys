import React, { useEffect, useMemo, useState } from "react";

function defaultForm() {
  return {
    missedSessionId: "",
    targetSessionId: "",
    needMeal: false,
    needHandout: true,
    reason: "",
    note: "",
  };
}

export default function AcademicsPage({ shared }) {
  const {
    apiRequest,
    GoogleSigninPanel,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    loadStoredGoogleIdToken_,
    storeGoogleIdToken_,
    storeAdminSession_,
    getGoogleIdTokenSilently_,
    formatDisplayDate_,
    formatEventSchedule_,
  } = shared;

  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [loading, setLoading] = useState(false);
  const [authRecovering, setAuthRecovering] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(() => defaultForm());
  const [bootstrap, setBootstrap] = useState({
    sessions: [],
    regularSessions: [],
    makeupTargets: [],
    notes: [],
    myRequests: [],
    canManage: false,
  });

  const ensureSession_ = async () => {
    const existingIdToken = String(loadStoredGoogleIdToken_() || "").trim();
    let token = existingIdToken;
    if (!token && typeof getGoogleIdTokenSilently_ === "function") {
      token = String((await getGoogleIdTokenSilently_()) || "").trim();
    }
    if (!token) {
      throw new Error("登入已過期，請重新使用 Google 登入。");
    }
    storeGoogleIdToken_(token);
    const { result } = await apiRequest({ action: "verifyGoogle", idToken: token });
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Google 驗證失敗");
    }
    const data = result.data || {};
    const student = data.student || googleLinkedStudent || null;
    const studentId = String((student && student.id) || "").trim();
    const sessionToken = String(data.sessionToken || "").trim();
    const refreshToken = String(data.refreshToken || "").trim();
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
    if (student) {
      storeGoogleStudent_(student);
      setGoogleLinkedStudent(student);
    }
    if (sessionToken && studentId) {
      storeAdminSession_({
        token: sessionToken,
        refreshToken,
        studentId,
        memberships,
      });
    }
  };

  const loadBootstrap_ = async ({ allowRetry = true } = {}) => {
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
        canManage: Boolean(result.data && result.data.canManage),
      });
    } catch (err) {
      const message = String((err && err.message) || "");
      if (allowRetry && (message === "Unauthorized" || message.includes("登入已過期"))) {
        try {
          setAuthRecovering(true);
          await ensureSession_();
          await loadBootstrap_({ allowRetry: false });
          return;
        } catch (recoverError) {
          setError(String((recoverError && recoverError.message) || "登入已過期，請重新登入。"));
        } finally {
          setAuthRecovering(false);
        }
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
      return right.localeCompare(left, "zh-Hant", { numeric: true, sensitivity: "base" });
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

  const recentNotes = useMemo(() => {
    return (bootstrap.notes || []).map((note) => ({
      ...note,
      session: sessionsById.get(note.sessionId) || null,
    }));
  }, [bootstrap.notes, sessionsById]);

  const updateForm_ = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmitMakeup_ = async (event) => {
    event.preventDefault();
    if (!form.missedSessionId || !form.targetSessionId) {
      setError("請先選擇原課程與補課場次。");
      return;
    }
    setStatus("");
    setError("");
    try {
      const { result } = await apiRequest({
        action: "submitMakeupRequest",
        data: {
          missedSessionId: form.missedSessionId,
          targetSessionId: form.targetSessionId,
          needMeal: form.needMeal,
          needHandout: form.needHandout,
          reason: form.reason,
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
            {authRecovering ? "登入恢復中..." : "載入中..."}
          </div>
        ) : null}
        {error ? <div className="mb-4 alert alert-error">{error}</div> : null}
        {status ? <div className="mb-4 alert alert-success">{status}</div> : null}

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
                <label className="mb-2 block text-sm font-medium text-slate-700">原課程（週六 / 週日）</label>
                <select
                  value={form.missedSessionId}
                  onChange={(event) => updateForm_({ missedSessionId: event.target.value })}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">請選擇原課程</option>
                  {regularSessions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sessionDate}｜{item.title}
                    </option>
                  ))}
                </select>
              </div>

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
                      {item.sessionDate}｜{item.title}
                    </option>
                  ))}
                </select>
              </div>

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
                <label className="mb-2 block text-sm font-medium text-slate-700">補課原因</label>
                <input
                  value={form.reason}
                  onChange={(event) => updateForm_({ reason: event.target.value })}
                  placeholder="可留空，例如：出差 / 家庭行程"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
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
                          {item.missedSession ? item.missedSession.title : "原課程"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          原課：{item.missedSession ? formatSessionSchedule_(item.missedSession) : "-"}
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
                    {item.reason ? <p className="mt-3 text-xs text-slate-600">原因：{item.reason}</p> : null}
                    {item.note ? <p className="mt-1 text-xs text-slate-600">備註：{item.note}</p> : null}
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
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Sessions</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">近期正式課程</h2>
            </div>
            <span className="text-xs text-slate-400">共 {regularSessions.length} 堂</span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {regularSessions.slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{formatSessionSchedule_(item)}</p>
                {item.location ? <p className="mt-1 text-xs text-slate-500">地點：{item.location}</p> : null}
              </div>
            ))}
            {!regularSessions.length ? <div className="alert alert-info text-xs">目前還沒有同步到正式課程。</div> : null}
          </div>
        </section>

        <section className="mt-6 card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">Notes</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">課程摘要 / 筆記</h2>
            </div>
            <span className="text-xs text-slate-400">已發布 {recentNotes.length} 筆</span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {!recentNotes.length ? <div className="alert alert-info text-xs">目前還沒有已發布的課程摘要。</div> : null}
            {recentNotes.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{item.title || (item.session && item.session.title) || "課程摘要"}</p>
                {item.session ? (
                  <p className="mt-1 text-xs text-slate-500">{formatSessionSchedule_(item.session)}</p>
                ) : null}
                {item.summary ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.summary}</p> : null}
                {item.linkUrl ? (
                  <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener"
                    className="mt-4 inline-flex items-center text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                  >
                    {item.linkLabel || "開啟筆記連結"}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
