import React, { useEffect, useMemo, useState } from "react";

function CheerleadingPlayerPage({ shared }) {
  const { apiRequest, authedApiRequest } = shared;
  const effectiveApiRequest = typeof authedApiRequest === "function" ? authedApiRequest : apiRequest;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [practices, setPractices] = useState([]);
  const [fields, setFields] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const OPTIONS = [
    { value: "attend", label: "會到", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    { value: "late", label: "會遲到", tone: "border-amber-200 bg-amber-50 text-amber-700" },
    { value: "early_leave", label: "會早退", tone: "border-orange-200 bg-orange-50 text-orange-700" },
    { value: "excused", label: "請假", tone: "border-sky-200 bg-sky-50 text-sky-700" },
    { value: "sick", label: "病假", tone: "border-violet-200 bg-violet-50 text-violet-700" },
    { value: "official_leave", label: "公假", tone: "border-indigo-200 bg-indigo-50 text-indigo-700" },
    { value: "online_makeup", label: "補練", tone: "border-teal-200 bg-teal-50 text-teal-700" },
    { value: "absent", label: "無法到", tone: "border-rose-200 bg-rose-50 text-rose-700" },
    { value: "unknown", label: "未回覆", tone: "border-slate-200 bg-slate-50 text-slate-600" },
  ];
  const PRESENT = new Set(["attend", "late", "early_leave", "online_makeup"]);
  const labelByStatus = OPTIONS.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {});
  const normalizeId = (value) => String(value || "").trim();
  const normalizeStatus = (value) => OPTIONS.some((item) => item.value === String(value || "").trim()) ? String(value || "").trim() : "unknown";
  const formatDate = (value) => String(value || "").slice(0, 10) || "未定日期";
  const getName = (row) => String(row?.nameZh || row?.preferredName || row?.nameEn || row?.email || row?.id || "同學").trim();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await effectiveApiRequest({ action: "listCheerleadingPlayerBootstrap" });
      if (!result.ok) throw new Error(result.error || "拉拉隊資料載入失敗");
      setStudent(result.data?.student || null);
      setPractices(Array.isArray(result.data?.practices) ? result.data.practices : []);
      setFields(Array.isArray(result.data?.fields) ? result.data.fields : []);
      setAttendance(Array.isArray(result.data?.attendance) ? result.data.attendance : []);
    } catch (err) {
      setError(err.message || "拉拉隊資料載入失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const attendanceByPractice = useMemo(() => {
    const map = new Map();
    attendance.forEach((row) => {
      const practiceId = normalizeId(row.practiceId || row.practice_id);
      if (practiceId) map.set(practiceId, row);
    });
    return map;
  }, [attendance]);

  const highlightedPracticeId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return normalizeId(new URLSearchParams(window.location.search).get("practiceId"));
  }, []);
  const sortedPractices = useMemo(() => practices.slice().sort((a, b) => {
    const aHighlighted = highlightedPracticeId && normalizeId(a.id) === highlightedPracticeId;
    const bHighlighted = highlightedPracticeId && normalizeId(b.id) === highlightedPracticeId;
    if (aHighlighted !== bHighlighted) return aHighlighted ? -1 : 1;
    return String(b.date || b.startAt || "").localeCompare(String(a.date || a.startAt || ""));
  }), [highlightedPracticeId, practices]);
  const fieldById = useMemo(() => fields.reduce((acc, field) => ({ ...acc, [normalizeId(field.id)]: field }), {}), [fields]);
  const stats = useMemo(() => {
    const total = sortedPractices.length;
    let present = 0;
    let unknown = 0;
    sortedPractices.forEach((practice) => {
      const status = normalizeStatus(attendanceByPractice.get(normalizeId(practice.id))?.status);
      if (PRESENT.has(status)) present += 1;
      if (status === "unknown") unknown += 1;
    });
    return { total, present, unknown, rate: total ? Math.round((present / total) * 100) : 0 };
  }, [attendanceByPractice, sortedPractices]);

  const submit = async (practice, status) => {
    setSaving(true);
    setError("");
    try {
      const { result } = await effectiveApiRequest({ action: "submitCheerleadingAttendance", data: { practiceId: practice.id, status } });
      if (!result.ok) throw new Error(result.error || "出席回覆失敗");
      const saved = result.data?.attendance;
      const practiceId = normalizeId(practice.id);
      setAttendance((current) => current.filter((row) => normalizeId(row.practiceId || row.practice_id) !== practiceId).concat(saved));
    } catch (err) {
      setError(err.message || "出席回覆失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-pink-50/60 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-pink-600 via-rose-500 to-orange-400 p-6 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-pink-100">115B Cheerleading</p>
          <h1 className="mt-3 text-3xl font-bold">拉拉隊前台</h1>
          <p className="mt-2 text-sm text-pink-50">{student ? `${getName(student)}，這裡可以查看練習並回覆自己的出席狀態。` : "查看練習並回覆自己的出席狀態。"}</p>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {loading ? <p className="text-sm text-slate-500">載入中…</p> : null}

        <section className="grid gap-3 sm:grid-cols-3">
          {[{ label: "練習場次", value: stats.total }, { label: "已參與/可參與", value: stats.present }, { label: "參與率", value: `${stats.rate}%` }].map((item) => (
            <div key={item.label} className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p></div>
          ))}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">練習與出席回覆</h2>
            <button type="button" onClick={load} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">重新整理</button>
          </div>
          <div className="mt-4 space-y-3">
            {sortedPractices.length ? sortedPractices.map((practice) => {
              const record = attendanceByPractice.get(normalizeId(practice.id));
              const status = normalizeStatus(record?.status);
              const field = fieldById[normalizeId(practice.fieldId)] || null;
              const locationLabel = practice.location || field?.name || "未填地點";
              return (
                <div key={practice.id} className={`rounded-2xl border p-4 ${highlightedPracticeId && normalizeId(practice.id) === highlightedPracticeId ? "border-pink-300 bg-pink-50/50" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{formatDate(practice.date || practice.startAt)} · {practice.title || "拉拉隊練習"}</p><p className="mt-1 text-sm text-slate-500">{locationLabel}{field?.address ? ` · ${field.address}` : ""}{practice.focus ? ` · ${practice.focus}` : ""}</p>{field?.mapUrl ? <a href={field.mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-pink-700 underline">查看地圖</a> : null}</div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">目前：{labelByStatus[status]}</span>
                  </div>
                  {practice.notes ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{practice.notes}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {OPTIONS.filter((item) => item.value !== "unknown").map((item) => (
                      <button key={item.value} disabled={saving} type="button" onClick={() => submit(practice, item.value)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === item.value ? item.tone : "border-slate-200 bg-white text-slate-600"}`}>{item.label}</button>
                    ))}
                  </div>
                </div>
              );
            }) : <p className="text-sm text-slate-500">目前尚無練習。</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

export default CheerleadingPlayerPage;
