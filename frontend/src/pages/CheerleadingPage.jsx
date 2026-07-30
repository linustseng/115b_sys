import React, { useEffect, useMemo, useState } from "react";

function CheerleadingPage({ shared }) {
  const { apiRequest, authedApiRequest, pad2_, confirmDelete_, API_V2_URL, loadStoredAdminSession_ } = shared;
  const effectiveApiRequest = typeof authedApiRequest === "function" ? authedApiRequest : apiRequest;

  const [activeTab, setActiveTab] = useState("stats");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [students, setStudents] = useState([]);
  const [practices, setPractices] = useState([]);
  const [fields, setFields] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoForm, setVideoForm] = useState({ title: "", category: "", description: "", file: null });
  const [activePracticeId, setActivePracticeId] = useState("");
  const [statsScope, setStatsScope] = useState("recent10");
  const [showAttendanceEditor, setShowAttendanceEditor] = useState(false);
  const [practiceForm, setPracticeForm] = useState({
    id: "",
    date: "",
    startAt: "",
    endAt: "",
    title: "啦啦隊練習",
    fieldId: "",
    location: "",
    focus: "",
    notes: "",
  });
  const [fieldForm, setFieldForm] = useState({ id: "", name: "", address: "", mapUrl: "", notes: "" });
  const [attendanceNoteMap, setAttendanceNoteMap] = useState({});

  const ATTENDANCE_OPTIONS = [
    { value: "attend", label: "出席", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "late", label: "遲到", tone: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "early_leave", label: "早退", tone: "bg-orange-50 text-orange-700 border-orange-200" },
    { value: "excused", label: "請假", tone: "bg-sky-50 text-sky-700 border-sky-200" },
    { value: "absent", label: "未到", tone: "bg-rose-50 text-rose-700 border-rose-200" },
    { value: "unknown", label: "未記錄", tone: "bg-slate-50 text-slate-600 border-slate-200" },
  ];
  const STATUS_LABELS = ATTENDANCE_OPTIONS.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {});
  const PRESENT_STATUSES = new Set(["attend", "late", "early_leave"]);
  const ATTENDANCE_SUMMARY_GROUPS = [
    { id: "available", label: "可以到", statuses: ["attend", "late", "early_leave"], tone: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
    { id: "unavailable", label: "未到／請假", statuses: ["absent", "excused"], tone: "border-rose-200 bg-rose-50 text-rose-800", dot: "bg-rose-500" },
    { id: "pending", label: "還沒有填", statuses: ["unknown"], tone: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400" },
  ];
  const ATTENDANCE_STATISTIC_OPTIONS = [
    ...ATTENDANCE_OPTIONS.filter((item) => item.value !== "absent" && item.value !== "excused"),
    { value: "unavailable", label: "未到／請假", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  ];

  const normalizeId_ = (value) => String(value || "").trim();
  const normalizeStatus_ = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    return ATTENDANCE_OPTIONS.some((item) => item.value === raw) ? raw : "unknown";
  };
  const getStudentName_ = (student) =>
    String(student?.nameZh || student?.preferredName || student?.name || student?.nameEn || student?.email || student?.id || "").trim();
  const getDateParts_ = (value) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  };
  const formatDate_ = (value) => {
    const parts = getDateParts_(value);
    if (!parts) return "未定日期";
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date(parts.year, parts.month - 1, parts.day).getDay()];
    return `${parts.year}/${pad2_(parts.month)}/${pad2_(parts.day)} (週${weekday})`;
  };
  const formatPracticeSchedule_ = (practice) => {
    const dateLabel = formatDate_(practice?.date || practice?.startAt);
    const start = String(practice?.startAt || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
    const end = String(practice?.endAt || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
    return [dateLabel, start || end ? `${start || "-"}–${end || "-"}` : ""].filter(Boolean).join(" ");
  };
  const todayKey_ = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2_ ? pad2_(now.getMonth() + 1) : String(now.getMonth() + 1).padStart(2, "0")}-${pad2_ ? pad2_(now.getDate()) : String(now.getDate()).padStart(2, "0")}`;
  };
  const isPracticePast_ = (practice) => String(practice?.date || practice?.startAt || "").slice(0, 10) <= todayKey_();
  const getDefaultPracticeId_ = (practiceList) => {
    if (!Array.isArray(practiceList) || !practiceList.length) return "";
    const today = todayKey_();
    const nextPractice = practiceList.find((practice) => String(practice?.date || practice?.startAt || "").slice(0, 10) >= today);
    return (nextPractice || practiceList[practiceList.length - 1])?.id || "";
  };

  const loadBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await effectiveApiRequest({ action: "listCheerleadingBootstrap" });
      if (!result.ok) throw new Error(result.error || "啦啦隊資料載入失敗");
      const data = result.data || {};
      setStudents(Array.isArray(data.students) ? data.students : []);
      setPractices(Array.isArray(data.practices) ? data.practices : []);
      setFields(Array.isArray(data.fields) ? data.fields : []);
      setAttendance(Array.isArray(data.attendance) ? data.attendance : []);
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (err) {
      setError(err.message || "啦啦隊資料載入失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedStudents = useMemo(
    () => students.slice().sort((a, b) => getStudentName_(a).localeCompare(getStudentName_(b), "zh-Hant", { numeric: true })),
    [students]
  );
  const getPracticeSortValue_ = (practice) => String(practice?.date || practice?.startAt || "9999-12-31");
  const sortedPractices = useMemo(
    () => practices.slice().sort((a, b) => getPracticeSortValue_(a).localeCompare(getPracticeSortValue_(b))),
    [practices]
  );
  const activePractice = sortedPractices.find((item) => normalizeId_(item.id) === normalizeId_(activePracticeId)) || null;
  const activePracticeIndex = sortedPractices.findIndex((item) => normalizeId_(item.id) === normalizeId_(activePracticeId));
  const canSelectPreviousPractice = activePracticeIndex > 0;
  const canSelectNextPractice = activePracticeIndex >= 0 && activePracticeIndex < sortedPractices.length - 1;
  const selectPracticeByOffset = (offset) => {
    if (activePracticeIndex < 0) return;
    const next = sortedPractices[activePracticeIndex + offset];
    if (next) setActivePracticeId(next.id || "");
  };

  useEffect(() => {
    if (!sortedPractices.length) {
      if (activePracticeId) {
        setActivePracticeId("");
      }
      return;
    }
    const hasSelected = sortedPractices.some(
      (practice) => normalizeId_(practice.id) === normalizeId_(activePracticeId)
    );
    if (!activePracticeId || !hasSelected) {
      setActivePracticeId(getDefaultPracticeId_(sortedPractices));
    }
  }, [activePracticeId, sortedPractices]);

  const attendanceMap = useMemo(() => {
    const map = new Map();
    attendance.forEach((item) => {
      const practiceId = normalizeId_(item.practiceId || item.practice_id);
      const studentId = normalizeId_(item.studentId || item.student_id || item.playerId || item.player_id);
      if (practiceId && studentId) map.set(`${practiceId}:${studentId}`, item);
    });
    return map;
  }, [attendance]);

  const scopedPractices = useMemo(() => {
    if (statsScope === "recent5") return sortedPractices.slice(0, 5);
    if (statsScope === "all") return sortedPractices;
    return sortedPractices.slice(0, 10);
  }, [sortedPractices, statsScope]);

  const stats = useMemo(() => {
    const practiceStats = scopedPractices.map((practice) => {
      const counts = ATTENDANCE_OPTIONS.reduce((acc, item) => ({ ...acc, [item.value]: 0 }), {});
      sortedStudents.forEach((student) => {
        const record = attendanceMap.get(`${normalizeId_(practice.id)}:${normalizeId_(student.id)}`);
        counts[normalizeStatus_(record?.status)] += 1;
      });
      const present = Object.entries(counts).reduce((sum, [status, count]) => sum + (PRESENT_STATUSES.has(status) ? count : 0), 0);
      const total = sortedStudents.length;
      return { practice, counts, present, total, participationRate: total ? Math.round((present / total) * 100) : 0 };
    });
    const pastPractices = scopedPractices.filter(isPracticePast_);
    const studentStats = sortedStudents.map((student) => {
      const counts = ATTENDANCE_OPTIONS.reduce((acc, item) => ({ ...acc, [item.value]: 0 }), {});
      pastPractices.forEach((practice) => {
        const record = attendanceMap.get(`${normalizeId_(practice.id)}:${normalizeId_(student.id)}`);
        counts[normalizeStatus_(record?.status)] += 1;
      });
      const present = Object.entries(counts).reduce((sum, [status, count]) => sum + (PRESENT_STATUSES.has(status) ? count : 0), 0);
      return { student, counts, present, total: pastPractices.length, participationRate: pastPractices.length ? Math.round((present / pastPractices.length) * 100) : 0 };
    }).sort((a, b) => b.present - a.present || a.participationRate - b.participationRate || getStudentName_(a.student).localeCompare(getStudentName_(b.student), "zh-Hant"));
    return { practiceStats, studentStats, pastPracticeCount: pastPractices.length };
  }, [ATTENDANCE_OPTIONS, attendanceMap, scopedPractices, sortedStudents]);

  const activePracticeAttendanceSummary = useMemo(() => {
    const groups = ATTENDANCE_SUMMARY_GROUPS.map((group) => ({ ...group, students: [] }));
    const groupByStatus = new Map();
    groups.forEach((group) => {
      group.statuses.forEach((status) => groupByStatus.set(status, group));
    });

    if (!activePractice) {
      return groups;
    }

    sortedStudents.forEach((student) => {
      const key = `${normalizeId_(activePractice.id)}:${normalizeId_(student.id)}`;
      const record = attendanceMap.get(key);
      const status = normalizeStatus_(record?.status);
      const group = groupByStatus.get(status) || groupByStatus.get("unknown");
      group.students.push({ student, record, status });
    });

    return groups;
  }, [attendanceMap, activePractice, sortedStudents]);

  const savePractice = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...practiceForm, title: practiceForm.title || "啦啦隊練習" };
      const action = payload.id ? "updateCheerleadingPractice" : "createCheerleadingPractice";
      const { result } = await effectiveApiRequest({ action, data: payload });
      if (!result.ok) throw new Error(result.error || "儲存練習失敗");
      setPracticeForm({ id: "", date: "", startAt: "", endAt: "", title: "啦啦隊練習", fieldId: "", location: "", focus: "", notes: "" });
      setStatusMessage("練習已儲存");
      await loadBootstrap();
    } catch (err) {
      setError(err.message || "儲存練習失敗");
    } finally {
      setSaving(false);
    }
  };

  const saveField = async (event) => {
    event.preventDefault();
    if (!fieldForm.name) {
      setError("請先填地點名稱");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const action = fieldForm.id ? "updateCheerleadingField" : "createCheerleadingField";
      const { result } = await effectiveApiRequest({ action, data: fieldForm });
      if (!result.ok) throw new Error(result.error || "儲存地點失敗");
      setFieldForm({ id: "", name: "", address: "", mapUrl: "", notes: "" });
      setStatusMessage("地點已儲存");
      await loadBootstrap();
    } catch (err) {
      setError(err.message || "儲存地點失敗");
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (field) => {
    const ok = typeof confirmDelete_ === "function" ? confirmDelete_(`刪除「${field.name || "地點"}」？`) : window.confirm("確定刪除？");
    if (!ok) return;
    setSaving(true);
    try {
      const { result } = await effectiveApiRequest({ action: "deleteCheerleadingField", id: field.id });
      if (!result.ok) throw new Error(result.error || "刪除地點失敗");
      await loadBootstrap();
    } catch (err) {
      setError(err.message || "刪除地點失敗");
    } finally {
      setSaving(false);
    }
  };

  const deletePractice = async (practice) => {
    const ok = typeof confirmDelete_ === "function" ? confirmDelete_(`刪除「${practice.title || "啦啦隊練習"}」？出席紀錄也會刪除。`) : window.confirm("確定刪除？");
    if (!ok) return;
    setSaving(true);
    try {
      const { result } = await effectiveApiRequest({ action: "deleteCheerleadingPractice", id: practice.id });
      if (!result.ok) throw new Error(result.error || "刪除失敗");
      await loadBootstrap();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const submitAttendance = async (studentId, status) => {
    if (!activePractice) return;
    const key = `${normalizeId_(activePractice.id)}:${normalizeId_(studentId)}`;
    const notes = attendanceNoteMap[key] ?? attendanceMap.get(key)?.notes ?? "";
    setSaving(true);
    try {
      const { result } = await effectiveApiRequest({
        action: "submitCheerleadingAttendance",
        data: { practiceId: activePractice.id, studentId, status, notes },
      });
      if (!result.ok) throw new Error(result.error || "出席儲存失敗");
      const saved = result.data?.attendance;
      setAttendance((current) => current.filter((item) => `${normalizeId_(item.practiceId || item.practice_id)}:${normalizeId_(item.studentId || item.student_id || item.playerId || item.player_id)}` !== key).concat(saved));
    } catch (err) {
      setError(err.message || "出席儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const uploadVideo = async (event) => {
    event.preventDefault();
    if (!videoForm.file) return setError("請選擇影片檔案");
    setSaving(true); setError("");
    try {
      const form = new FormData();
      form.append("file", videoForm.file); form.append("entityType", "cheerleading_video");
      form.append("entityId", globalThis.crypto?.randomUUID?.() || `video-${Date.now()}`);
      form.append("title", videoForm.title); form.append("category", videoForm.category); form.append("description", videoForm.description);
      const sessionToken = loadStoredAdminSession_?.()?.token || "";
      const response = await fetch(`${String(API_V2_URL || "").replace(/\/$/, "")}/v1/attachments/upload`, { method: "POST", headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}, body: form });
      const result = await response.json(); if (!result.ok) throw new Error(result.error || "影片上傳失敗");
      setVideoForm({ title: "", category: "", description: "", file: null }); setStatusMessage("教學影片已上架"); await loadBootstrap();
    } catch (err) { setError(err.message || "影片上傳失敗"); } finally { setSaving(false); }
  };

  const deleteVideo = async (video) => {
    if (!(confirmDelete_ ? confirmDelete_(`下架「${video.title}」？`) : window.confirm("確定下架影片？"))) return;
    setSaving(true); try {
      const token = loadStoredAdminSession_?.()?.token || "";
      const response = await fetch(`${String(API_V2_URL || "").replace(/\/$/, "")}/v1/attachments/${encodeURIComponent(video.id)}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const result = await response.json(); if (!result.ok) throw new Error(result.error || "下架失敗"); await loadBootstrap();
    } catch (err) { setError(err.message || "下架失敗"); } finally { setSaving(false); }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-pink-600 via-rose-500 to-orange-400 p-6 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-pink-100">115B Cheerleading</p>
          <h1 className="mt-3 text-3xl font-bold">啦啦隊比賽管理</h1>
          <p className="mt-2 max-w-2xl text-sm text-pink-50">全員參與；先支援練習、出席紀錄與統計。</p>
        </section>

        <a href="/" className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
          回首頁
        </a>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {statusMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{statusMessage}</div> : null}

        <nav className="flex flex-wrap gap-2">
          {[{ id: "stats", label: "統計" }, { id: "attendance", label: "出席紀錄" }, { id: "practices", label: "練習管理" }, { id: "fields", label: "地點管理" }, { id: "videos", label: "教學影片" }].map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>
              {tab.label}
            </button>
          ))}
        </nav>

        {loading ? <p className="text-sm text-slate-500">載入中…</p> : null}

        {activeTab === "stats" ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">出席統計</h2>
              <select value={statsScope} onChange={(event) => setStatsScope(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="recent5">最近 5 場</option>
                <option value="recent10">最近 10 場</option>
                <option value="all">全部場次</option>
              </select>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {[{ label: "全員人數", value: sortedStudents.length }, { label: "統計場次", value: scopedPractices.length }, { label: "已結束場次", value: stats.pastPracticeCount }, { label: "紀錄筆數", value: attendance.length }].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value}</p></div>
              ))}
            </div>
            <div className="mt-8 space-y-3">
              <h3 className="font-semibold">各次練習概況</h3>
              {stats.practiceStats.map(({ practice, counts, present, total, participationRate }) => (
                <div key={practice.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{formatPracticeSchedule_(practice)} · {practice.title || "啦啦隊練習"}</p><p className="text-sm text-slate-500">參與 {present}/{total} · {participationRate}%</p></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-5 lg:grid-cols-9">
                    {ATTENDANCE_STATISTIC_OPTIONS.map((item) => <div key={item.value} className={`rounded-xl border px-3 py-2 ${item.tone}`}><p>{item.label}</p><p className="mt-1 text-base font-bold">{item.value === "unavailable" ? (counts.absent || 0) + (counts.excused || 0) : counts[item.value] || 0}</p></div>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-3">
              <h3 className="font-semibold">個人參與統計（已結束練習）</h3>
              {stats.studentStats.map(({ student, counts, present, total, participationRate }) => (
                <div key={student.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{getStudentName_(student)}</p><p className="text-sm text-slate-500">參與 {present}/{total} · {participationRate}% · 未記錄 {counts.unknown || 0}</p></div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "attendance" ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">出席紀錄</h2>
                {activePractice ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {formatPracticeSchedule_(activePractice)} · {activePractice.title || "啦啦隊練習"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canSelectPreviousPractice}
                  onClick={() => selectPracticeByOffset(-1)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一次
                </button>
                <select value={activePractice?.id || ""} onChange={(event) => setActivePracticeId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {sortedPractices.map((practice) => <option key={practice.id} value={practice.id}>{formatPracticeSchedule_(practice)} · {practice.title || "啦啦隊練習"}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!canSelectNextPractice}
                  onClick={() => selectPracticeByOffset(1)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一次
                </button>
              </div>
            </div>
            {!activePractice ? <p className="mt-4 text-sm text-slate-500">請先建立練習。</p> : null}

            {activePractice ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {activePracticeAttendanceSummary.map((group) => (
                  <div key={group.id} className={`rounded-2xl border p-4 ${group.tone}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${group.dot}`} />
                        <p className="text-sm font-semibold">{group.label}</p>
                      </div>
                      <p className="text-2xl font-bold leading-none">{group.students.length}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.students.length ? (
                        group.students.map(({ student, status }) => (
                          <span key={student.id} className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs font-semibold shadow-sm">
                            {getStudentName_(student)}
                            {group.id === "available" && status !== "attend" ? ` · ${STATUS_LABELS[status]}` : ""}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs opacity-70">目前沒有人</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activePractice ? (
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAttendanceEditor((value) => !value)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  {showAttendanceEditor ? "收起修改" : "修改紀錄"}
                </button>
              </div>
            ) : null}

            {showAttendanceEditor ? <div className="mt-5 space-y-3">
              {activePractice && sortedStudents.map((student) => {
                const key = `${normalizeId_(activePractice.id)}:${normalizeId_(student.id)}`;
                const record = attendanceMap.get(key);
                const status = normalizeStatus_(record?.status);
                return (
                  <div key={student.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{getStudentName_(student)}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ATTENDANCE_OPTIONS.find((item) => item.value === status)?.tone || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{ATTENDANCE_OPTIONS.map((item) => <button key={item.value} disabled={saving} type="button" onClick={() => submitAttendance(student.id, item.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${status === item.value ? item.tone : "border-slate-200 bg-white text-slate-600"}`}>{item.label}</button>)}</div>
                    <input value={attendanceNoteMap[key] ?? record?.notes ?? ""} onChange={(event) => setAttendanceNoteMap((current) => ({ ...current, [key]: event.target.value }))} onBlur={() => submitAttendance(student.id, status)} placeholder="備註" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                );
              })}
            </div> : null}
          </section>
        ) : null}

        {activeTab === "practices" ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">練習管理</h2>
            <form onSubmit={savePractice} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="date" value={practiceForm.date} onChange={(e) => setPracticeForm({ ...practiceForm, date: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" />
              <input value={practiceForm.title} onChange={(e) => setPracticeForm({ ...practiceForm, title: e.target.value })} placeholder="練習名稱" className="rounded-xl border border-slate-200 px-3 py-2" />
              <input type="time" value={practiceForm.startAt} onChange={(e) => setPracticeForm({ ...practiceForm, startAt: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" />
              <input type="time" value={practiceForm.endAt} onChange={(e) => setPracticeForm({ ...practiceForm, endAt: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" />
              <select value={practiceForm.fieldId} onChange={(e) => {
                const field = fields.find((item) => normalizeId_(item.id) === normalizeId_(e.target.value));
                setPracticeForm({ ...practiceForm, fieldId: e.target.value, location: field?.name || practiceForm.location });
              }} className="rounded-xl border border-slate-200 px-3 py-2">
                <option value="">選擇地點</option>
                {fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
              </select>
              <input value={practiceForm.location} onChange={(e) => setPracticeForm({ ...practiceForm, location: e.target.value })} placeholder="地點補充 / 自訂地點" className="rounded-xl border border-slate-200 px-3 py-2" />
              <input value={practiceForm.focus} onChange={(e) => setPracticeForm({ ...practiceForm, focus: e.target.value })} placeholder="練習重點" className="rounded-xl border border-slate-200 px-3 py-2" />
              <textarea value={practiceForm.notes} onChange={(e) => setPracticeForm({ ...practiceForm, notes: e.target.value })} placeholder="備註" className="rounded-xl border border-slate-200 px-3 py-2 sm:col-span-2" />
              <button disabled={saving} type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">{practiceForm.id ? "更新練習" : "新增練習"}</button>
            </form>
            <div className="mt-6 space-y-3">
              {sortedPractices.map((practice) => <div key={practice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"><div><p className="font-semibold">{formatPracticeSchedule_(practice)} · {practice.title || "啦啦隊練習"}</p><p className="text-sm text-slate-500">{practice.location || "未填地點"}</p></div><div className="flex gap-2"><button type="button" onClick={() => setPracticeForm({ id: practice.id || "", date: practice.date || "", startAt: practice.startAt || "", endAt: practice.endAt || "", title: practice.title || "啦啦隊練習", fieldId: practice.fieldId || "", location: practice.location || "", focus: practice.focus || "", notes: practice.notes || "" })} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold">編輯</button><button type="button" onClick={() => deletePractice(practice)} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600">刪除</button></div></div>)}
            </div>
          </section>
        ) : null}

        {activeTab === "fields" ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">地點管理</h2>
            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                {fields.map((field) => <div key={field.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"><button type="button" onClick={() => setFieldForm({ ...field })} className="text-left"><p className="font-semibold">{field.name}</p><p className="text-sm text-slate-500">{field.address || "未填地址"}</p></button><button type="button" onClick={() => deleteField(field)} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600">刪除</button></div>)}
              </div>
              <form onSubmit={saveField} className="space-y-3">
                <input value={fieldForm.name} onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })} placeholder="地點名稱" className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                <input value={fieldForm.address} onChange={(e) => setFieldForm({ ...fieldForm, address: e.target.value })} placeholder="地址" className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                <input value={fieldForm.mapUrl} onChange={(e) => setFieldForm({ ...fieldForm, mapUrl: e.target.value })} placeholder="地圖連結" className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                <textarea value={fieldForm.notes} onChange={(e) => setFieldForm({ ...fieldForm, notes: e.target.value })} placeholder="備註" className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                <div className="flex gap-2"><button disabled={saving} type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{fieldForm.id ? "更新地點" : "新增地點"}</button><button type="button" onClick={() => setFieldForm({ id: "", name: "", address: "", mapUrl: "", notes: "" })} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">清空</button></div>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === "videos" ? <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">教學影片管理</h2><form onSubmit={uploadVideo} className="mt-4 grid gap-3 sm:grid-cols-2"><input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} placeholder="影片標題" className="rounded-xl border border-slate-200 px-3 py-2" /><input value={videoForm.category} onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })} placeholder="分類" className="rounded-xl border border-slate-200 px-3 py-2" /><textarea value={videoForm.description} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })} placeholder="說明" className="rounded-xl border border-slate-200 px-3 py-2 sm:col-span-2" /><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setVideoForm({ ...videoForm, file: e.target.files?.[0] || null })} className="sm:col-span-2" /><button disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">{saving ? "上傳中…" : "上傳並上架"}</button></form><div className="mt-6 space-y-3">{videos.map((video) => <div key={video.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"><div><p className="font-semibold">{video.title}</p><p className="text-sm text-slate-500">{[video.category, video.description].filter(Boolean).join(" · ")}</p></div><button type="button" onClick={() => deleteVideo(video)} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600">下架</button></div>)}</div></section> : null}
      </div>
    </main>
  );
}

export default CheerleadingPage;
