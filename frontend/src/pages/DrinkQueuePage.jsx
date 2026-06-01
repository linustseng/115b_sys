import React, { useEffect, useMemo, useState } from "react";
import { mapAppErrorMessage } from "../utils/errorMappings";

const DRINK_THEMES = [
  "全班醒腦手搖局",
  "黑咖啡重開機小隊",
  "珍奶和平協議",
  "無糖綠集體冷靜",
  "氣泡水假裝很健康",
  "講師也要一杯壓驚",
];

const STATUS_LABELS = {
  queued: "排隊中",
  served: "已請客",
  excused: "免罰/取消",
};

function getToday_() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getNextWeekday_(targetDay) {
  const now = new Date();
  const next = new Date(now);
  const current = next.getDay();
  let delta = (targetDay - current + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }
  next.setDate(next.getDate() + delta);
  const pad = (value) => String(value).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function formatDate_(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "待排下次上課日";
  }
  const parsed = new Date(`${raw}T00:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][parsed.getDay()];
  return `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")} 週${weekday}`;
}

function normalizeText_(value) {
  return String(value || "").trim();
}

function DrinkQueuePage({ shared }) {
  const { apiRequest, GoogleSigninPanel, loadStoredGoogleStudent_, storeGoogleStudent_, storeGoogleIdToken_ } = shared;
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [students, setStudents] = useState([]);
  const [entries, setEntries] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDates, setEditingDates] = useState({});
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState(() => ({
    offenderId: "",
    offenderName: "",
    incidentAt: getToday_(),
    nextClassDate: getNextWeekday_(6),
    reason: "手機沒有關靜音，教室瞬間變演唱會",
    drinkTheme: DRINK_THEMES[0],
    pledgeText: "下次上課我請，全班一起醒著畢業。",
  }));

  const loadBootstrap = async () => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listDrinkQueueBootstrap" });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入失敗");
      }
      const data = result.data || {};
      setStudents(Array.isArray(data.students) ? data.students : []);
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setCanManage(Boolean(data.canManage));
    } catch (err) {
      const message = String((err && err.message) || "載入失敗");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再查看飲料隊列。",
          networkMessage: "目前網路或系統回應較慢，飲料隊列稍後再試。",
          fallbackMessage: message,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, [googleLinkedStudent]);

  const queuedEntries = useMemo(
    () => entries.filter((item) => normalizeText_(item.status || "queued") === "queued"),
    [entries]
  );
  const servedEntries = useMemo(
    () => entries.filter((item) => normalizeText_(item.status) === "served"),
    [entries]
  );
  const excusedEntries = useMemo(
    () => entries.filter((item) => normalizeText_(item.status) === "excused"),
    [entries]
  );
  const nextHost = queuedEntries[0] || null;

  const studentOptions = useMemo(
    () =>
      students.map((item) => {
        const id = normalizeText_(item.id);
        const name = normalizeText_(item.name);
        return { ...item, id, name, label: [id, name].filter(Boolean).join(" ") };
      }),
    [students]
  );

  const handleStudentChange = (value) => {
    const selected = studentOptions.find((item) => item.id === value);
    setForm((prev) => ({
      ...prev,
      offenderId: value,
      offenderName: selected ? selected.name : prev.offenderName,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const selected = studentOptions.find((item) => item.id === form.offenderId);
      const payload = {
        ...form,
        offenderName: selected ? selected.name : form.offenderName,
        offenderEmail: selected ? selected.email : "",
      };
      const { result } = await apiRequest({ action: "createDrinkQueueEntry", data: payload });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "登記失敗");
      }
      setStatusMessage("已加入飲料請客隊列。請大家保持手機安靜，飲料不安靜。");
      setForm((prev) => ({
        ...prev,
        offenderId: "",
        offenderName: "",
        incidentAt: getToday_(),
        nextClassDate: getNextWeekday_(6),
        reason: "手機沒有關靜音，教室瞬間變演唱會",
        drinkTheme: DRINK_THEMES[Math.floor(Math.random() * DRINK_THEMES.length)],
      }));
      await loadBootstrap();
    } catch (err) {
      setError(String((err && err.message) || "登記失敗"));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (entry, status) => {
    if (!entry || !entry.id) {
      return;
    }
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const nextClassDate = normalizeText_(editingDates[entry.id] || entry.nextClassDate);
      const { result } = await apiRequest({
        action: "updateDrinkQueueEntryStatus",
        id: entry.id,
        status,
        nextClassDate,
        servedAt: status === "served" ? getToday_() : "",
        servedNote: status === "served" ? "已完成飲料和平協議" : status === "excused" ? "已由管理員取消本次飲料債" : "",
      });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "更新失敗");
      }
      setStatusMessage(status === "served" ? "已標記為已請客，掌聲鼓勵。" : status === "queued" ? "已還原為排隊中。" : "已標記為免罰/取消。");
      await loadBootstrap();
    } catch (err) {
      setError(String((err && err.message) || "更新失敗"));
    } finally {
      setSaving(false);
    }
  };

  const updateEntrySchedule = async (entry) => {
    if (!entry || !entry.id) {
      return;
    }
    const nextClassDate = normalizeText_(editingDates[entry.id] || entry.nextClassDate);
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const status = normalizeText_(entry.status || "queued") || "queued";
      const { result } = await apiRequest({
        action: "updateDrinkQueueEntryStatus",
        id: entry.id,
        status,
        nextClassDate,
        servedAt: status === "served" ? normalizeText_(entry.servedAt) : "",
        servedNote: status === "served" ? normalizeText_(entry.servedNote || "已完成飲料和平協議") : status === "excused" ? normalizeText_(entry.servedNote || "已由管理員取消本次飲料債") : "",
      });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "更新請客日期失敗");
      }
      setStatusMessage("請客日期已更新。");
      await loadBootstrap();
    } catch (err) {
      setError(String((err && err.message) || "更新請客日期失敗"));
    } finally {
      setSaving(false);
    }
  };

  const renderManageControls = (item) => {
    if (!canManage) {
      return null;
    }
    const status = normalizeText_(item.status || "queued") || "queued";
    const draftDate = editingDates[item.id] != null ? editingDates[item.id] : normalizeText_(item.nextClassDate);
    return (
      <div className="relative mt-3 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-semibold text-slate-500">
            請客日期
            <input
              type="date"
              value={draftDate}
              onChange={(event) => setEditingDates((prev) => ({ ...prev, [item.id]: event.target.value }))}
              className="mt-1 block h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
            />
          </label>
          <button type="button" disabled={saving} onClick={() => updateEntrySchedule(item)} className="h-9 rounded-full border border-orange-200 bg-white px-3 text-xs font-semibold text-orange-700 hover:border-orange-300 disabled:opacity-50">
            更新日期
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {status !== "served" ? (
            <button type="button" disabled={saving} onClick={() => updateStatus(item, "served")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">已請客</button>
          ) : null}
          {status !== "queued" ? (
            <button type="button" disabled={saving} onClick={() => updateStatus(item, "queued")} className="rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50">還原排隊</button>
          ) : null}
          {status !== "excused" ? (
            <button type="button" disabled={saving} onClick={() => updateStatus(item, "excused")} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50">免罰</button>
          ) : null}
          <button type="button" disabled={saving} onClick={() => deleteEntry(item)} className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:opacity-50">刪除</button>
        </div>
      </div>
    );
  };

  const deleteEntry = async (entry) => {
    if (!entry || !entry.id) {
      return;
    }
    if (!window.confirm(`確定刪除 ${entry.offenderName || "這筆紀錄"} 的飲料隊列紀錄嗎？`)) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "deleteDrinkQueueEntry", id: entry.id });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "刪除失敗");
      }
      await loadBootstrap();
    } catch (err) {
      setError(String((err && err.message) || "刪除失敗"));
    } finally {
      setSaving(false);
    }
  };

  if (!googleLinkedStudent || !googleLinkedStudent.email) {
    return (
      <div className="min-h-screen bg-orange-50/30">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">NTU EMBA 115B</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">飲料請客排隊系統</h1>
            <p className="mt-3 text-sm text-slate-500">登入後才能查看與登記手機鈴聲案件。</p>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:px-12">
          <section className="card p-6 sm:p-8">
            <GoogleSigninPanel
              title="Google 登入"
              helperText="登入後即可進入飲料隊列。"
              onLinkedStudent={(student, _profile, idToken) => {
                setGoogleLinkedStudent(student || null);
                storeGoogleStudent_(student || null);
                if (idToken) {
                  storeGoogleIdToken_(idToken);
                }
              }}
            />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.20),_transparent_34%),linear-gradient(180deg,#fff7ed_0%,#f8fafc_42%,#ffffff_100%)]">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">Silent or Smoothie</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-5xl">飲料請客排隊系統</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                上課手機響一次，下一次上課日請全班喝飲料。不是處罰，是讓大家用一杯飲料記得把靜音打開。
              </p>
            </div>
            <a href="/" className="rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-xs font-semibold text-orange-700 shadow-sm hover:border-orange-300">
              回首頁
            </a>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[2rem] border border-orange-200 bg-white/85 p-5 shadow-[0_25px_70px_-60px_rgba(194,65,12,0.8)]">
              <p className="text-xs font-semibold text-orange-600">目前排隊</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{queuedEntries.length}</p>
              <p className="mt-1 text-xs text-slate-500">杯飲料債等著被清償</p>
            </div>
            <div className="rounded-[2rem] border border-emerald-200 bg-white/85 p-5 shadow-[0_25px_70px_-60px_rgba(5,150,105,0.8)]">
              <p className="text-xs font-semibold text-emerald-600">已請客</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{servedEntries.length}</p>
              <p className="mt-1 text-xs text-slate-500">次全班飲料和平協議</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_25px_70px_-60px_rgba(15,23,42,0.8)]">
              <p className="text-xs font-semibold text-slate-500">下一位司令塔</p>
              <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{nextHost ? nextHost.offenderName : "目前安全"}</p>
              <p className="mt-1 text-xs text-slate-500">{nextHost ? formatDate_(nextHost.nextClassDate) : "全班手機暫時安靜"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 pb-28 pt-8 lg:grid-cols-[0.9fr_1.1fr] sm:px-12">
        <section className="rounded-[2.25rem] border border-orange-200/80 bg-white/90 p-5 shadow-[0_35px_100px_-80px_rgba(194,65,12,0.9)] backdrop-blur sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">登記一筆手機響起案</h2>
              <p className="mt-1 text-xs text-slate-500">先登記，飲料債就不會被時間沖淡。</p>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-semibold text-orange-700">🔕 案發現場</span>
          </div>

          {statusMessage ? <div className="mt-4 alert alert-success text-xs">{statusMessage}</div> : null}
          {error ? <div className="mt-4 alert alert-error text-xs">{error}</div> : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">被抓到的同學</label>
              <select value={form.offenderId} onChange={(event) => handleStudentChange(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-orange-200 bg-white px-4 text-sm text-slate-800">
                <option value="">從名單選擇</option>
                {studentOptions.map((item) => (
                  <option key={item.id || item.name} value={item.id}>{item.label || item.name}</option>
                ))}
              </select>
              <input
                value={form.offenderName}
                onChange={(event) => setForm((prev) => ({ ...prev, offenderName: event.target.value, offenderId: "" }))}
                placeholder="或手動輸入姓名"
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800">案發日期</label>
                <input type="date" value={form.incidentAt} onChange={(event) => setForm((prev) => ({ ...prev, incidentAt: event.target.value }))} className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">預計請客上課日</label>
                <input type="date" value={form.nextClassDate} onChange={(event) => setForm((prev) => ({ ...prev, nextClassDate: event.target.value }))} className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, nextClassDate: getNextWeekday_(4) }))} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600">下週四</button>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, nextClassDate: getNextWeekday_(6) }))} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600">下週六</button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">飲料主題</label>
              <select value={form.drinkTheme} onChange={(event) => setForm((prev) => ({ ...prev, drinkTheme: event.target.value }))} className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800">
                {DRINK_THEMES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">罪名/備註</label>
              <textarea value={form.reason} onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))} rows="2" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800" />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">請客宣言</label>
              <textarea value={form.pledgeText} onChange={(event) => setForm((prev) => ({ ...prev, pledgeText: event.target.value }))} rows="2" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800" />
            </div>

            <button type="submit" disabled={saving || (!form.offenderId && !form.offenderName)} className="w-full rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-500/30 hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "登記中..." : "加入飲料隊列"}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-[2.25rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_35px_100px_-80px_rgba(15,23,42,0.9)] backdrop-blur sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">目前請客隊列</h2>
                <p className="mt-1 text-xs text-slate-500">越上面越接近飲料和平日。</p>
              </div>
              {loading ? <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">載入中</span> : null}
            </div>

            <div className="mt-5 space-y-3">
              {queuedEntries.length ? queuedEntries.map((item, index) => (
                <div key={item.id} className="relative overflow-hidden rounded-[1.75rem] border border-orange-200/80 bg-gradient-to-r from-white to-orange-50/60 p-4">
                  <div className="absolute right-4 top-4 text-4xl font-black text-orange-100">#{index + 1}</div>
                  <div className="relative flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">{item.drinkTheme || "飲料局"}</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-950">{item.offenderName || "未命名同學"}</h3>
                      <p className="mt-1 text-xs text-slate-500">案發：{formatDate_(item.incidentAt)} · 請客：{formatDate_(item.nextClassDate)}</p>
                    </div>
                    <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-semibold text-orange-700">{STATUS_LABELS[item.status] || item.status}</span>
                  </div>
                  <p className="relative mt-3 text-sm text-slate-700">{item.reason}</p>
                  <p className="relative mt-2 rounded-2xl border border-orange-100 bg-white/80 px-3 py-2 text-xs font-semibold text-orange-800">「{item.pledgeText || "我請，我負責。"}」</p>
                  {renderManageControls(item)}
                </div>
              )) : (
                <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  目前沒有飲料債。這是好事，也是危險的寧靜。
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[2rem] border border-emerald-200 bg-white/80 p-5">
              <h3 className="text-sm font-semibold text-emerald-800">已完成請客</h3>
              <div className="mt-3 space-y-2">
                {servedEntries.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    <div className="font-semibold">{item.offenderName} · 請客：{formatDate_(item.nextClassDate)}</div>
                    {item.servedAt ? <div className="mt-1 text-[11px] text-emerald-700/80">標記完成：{formatDate_(item.servedAt)}</div> : null}
                    {renderManageControls(item)}
                  </div>
                ))}
                {!servedEntries.length ? <p className="text-xs text-slate-400">尚無紀錄。</p> : null}
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-5">
              <h3 className="text-sm font-semibold text-slate-700">免罰/取消</h3>
              <div className="mt-3 space-y-2">
                {excusedEntries.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <div className="font-semibold">{item.offenderName} · 請客：{formatDate_(item.nextClassDate)}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.servedNote || "已取消"}</div>
                    {renderManageControls(item)}
                  </div>
                ))}
                {!excusedEntries.length ? <p className="text-xs text-slate-400">尚無紀錄。</p> : null}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DrinkQueuePage;
