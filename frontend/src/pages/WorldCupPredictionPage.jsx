import React, { useEffect, useMemo, useState } from "react";

const EVENT_ID = "world-cup-final-2026";
const TEAMS = [
  { id: "西班牙", flag: "🇪🇸", short: "ESP", accent: "#f6c445" },
  { id: "阿根廷", flag: "🇦🇷", short: "ARG", accent: "#76c7e8" },
];

function TeamMark({ team, compact = false }) {
  return (
    <div className={`flex flex-col items-center ${compact ? "gap-1" : "gap-2"}`}>
      <div
        className={`${compact ? "h-11 w-11 text-2xl" : "h-20 w-20 text-4xl sm:h-24 sm:w-24 sm:text-5xl"} grid place-items-center rounded-[28%] border border-white/30 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_14px_35px_-18px_rgba(0,0,0,0.7)]`}
        aria-label={`${team.id}隊徽`}
        role="img"
      >
        {team.flag}
      </div>
      <span className={`${compact ? "text-[10px]" : "text-sm"} font-black tracking-[0.12em] text-white`}>{team.short}</span>
    </div>
  );
}

function ChoiceButton({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        selected
          ? "border-amber-300 bg-amber-300 text-slate-950 shadow-[0_12px_28px_-15px_rgba(251,191,36,0.85)]"
          : "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function WorldCupPredictionPage({ shared }) {
  const { apiRequest, loadStoredGoogleStudent_, storeGoogleStudent_, GoogleSigninPanel, mapRegistrationError } = shared;
  const [linkedStudent, setLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [event, setEvent] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [prediction, setPrediction] = useState({
    predictedChampion: "",
    spainScore: "",
    argentinaScore: "",
    firstScorerTeam: "",
    extraTimeOrPenalties: "",
  });

  const email = String((linkedStudent && linkedStudent.email) || "").trim().toLowerCase();
  const isClosed = Boolean(event && event.registrationCloseAt && new Date(event.registrationCloseAt).getTime() <= Date.now());
  const closeLabel = useMemo(() => {
    if (!event || !event.registrationCloseAt) return "7/20 02:30";
    return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" }).format(new Date(event.registrationCloseAt));
  }, [event]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const request = { action: "getRegistrationBootstrap", eventId: EVENT_ID };
        if (email) request.email = email;
        const { result } = await apiRequest(request);
        if (!result.ok || !result.data || !result.data.event) throw new Error((result && result.error) || "預測賽資料載入失敗");
        if (cancelled) return;
        setEvent(result.data.event);
        const nextRegistration = result.data.registration || null;
        setRegistration(nextRegistration);
        const fields = nextRegistration && nextRegistration.customFields && typeof nextRegistration.customFields === "object"
          ? nextRegistration.customFields
          : (() => { try { return JSON.parse((nextRegistration && nextRegistration.customFields) || "{}"); } catch (_) { return {}; } })();
        if (nextRegistration) {
          setPrediction((previous) => ({ ...previous, ...fields }));
        }
        if (result.data.student && !linkedStudent) {
          setLinkedStudent(result.data.student);
          storeGoogleStudent_(result.data.student);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "預測賽資料載入失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [apiRequest, email]);

  const setField = (name, value) => {
    setSaved(false);
    setPrediction((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async () => {
    setError("");
    setSaved(false);
    if (!linkedStudent || !email) {
      setError("請先以班級帳號登入，再留下你的足球第六感。");
      return;
    }
    if (isClosed) {
      setError("本場已封盤，現在只能等開獎了。");
      return;
    }
    if (!prediction.predictedChampion || prediction.spainScore === "" || prediction.argentinaScore === "" || !prediction.firstScorerTeam || !prediction.extraTimeOrPenalties) {
      setError("冠軍、90 分鐘比分、先進球隊與延長／PK 都要選好。晚餐不能靠直覺省略。 ");
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        eventId: EVENT_ID,
        studentId: String(linkedStudent.id || "").trim(),
        userName: String(linkedStudent.name || "").trim(),
        userEmail: email,
        userPhone: String(linkedStudent.phone || "-").trim() || "-",
        customFields: prediction,
      };
      const { result } = registration && registration.id
        ? await apiRequest({ action: "updateRegistration", data: { ...data, id: registration.id, customFields: JSON.stringify(prediction), status: registration.status || "registered" } })
        : await apiRequest({ action: "register", data });
      if (!result.ok) throw new Error(result.error || "儲存失敗");
      setSaved(true);
      const { result: refreshed } = await apiRequest({ action: "getRegistrationBootstrap", eventId: EVENT_ID, email });
      if (refreshed && refreshed.ok && refreshed.data) setRegistration(refreshed.data.registration || null);
    } catch (submitError) {
      setError(mapRegistrationError(submitError.message || "儲存失敗"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-white">
      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-7 sm:py-10">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">← 回 115B 首頁</a>
        <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_-20%,#284c76_0%,#111d31_43%,#070d18_78%)] px-5 py-8 shadow-[0_30px_100px_-45px_rgba(0,0,0,0.95)] sm:px-10 sm:py-11">
          <div className="absolute -left-16 top-12 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="absolute -right-14 bottom-0 h-52 w-52 rounded-full bg-sky-400/15 blur-3xl" />
          <div className="relative text-center">
            <p className="text-xs font-bold tracking-[0.28em] text-amber-300">115B WORLD CUP PREDICTION</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">冠軍不是用看的，是用晚餐賭的。</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">無金流、無藉口。最後一名請第一名吃飯；封盤後，大家才知道誰是足球先知、誰是行動餐券。</p>
            <div className="mx-auto mt-8 flex max-w-md items-center justify-between gap-4 sm:gap-8">
              <TeamMark team={TEAMS[0]} />
              <div><p className="text-2xl font-black italic text-amber-300">VS</p><p className="mt-1 text-[10px] font-bold tracking-[0.16em] text-slate-400">FINAL · 2026</p></div>
              <TeamMark team={TEAMS[1]} />
            </div>
            <div className="mx-auto mt-8 inline-flex flex-wrap justify-center gap-x-5 gap-y-2 rounded-full border border-white/10 bg-black/20 px-5 py-2.5 text-xs font-semibold text-slate-300"><span>開踢：7/20 03:00</span><span className="text-amber-300">封盤：{closeLabel}</span></div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="rounded-[1.75rem] border border-slate-800 bg-[#101827] p-5 shadow-xl shadow-black/15 sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.18em] text-slate-400">YOUR CALL</p><h2 className="mt-1 text-2xl font-black">留下你的預測</h2></div>{registration ? <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-300">已參加，可修改</span> : null}</div>
            {loading ? <p className="py-16 text-center text-sm text-slate-400">正在把球賽搬進來…</p> : null}
            {!loading && !linkedStudent ? <div className="mt-6"><div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">先登入 115B 班級帳號，系統才知道最後該找誰請晚餐。</div><div className="mt-4"><GoogleSigninPanel title="登入後開始預測" helperText="只限已綁定的 115B 同學。" onLinkedStudent={(student) => { setLinkedStudent(student || null); storeGoogleStudent_(student || null); }} /></div></div> : null}
            {!loading && linkedStudent ? <div className="mt-7 space-y-7">
              <p className="text-sm text-slate-400">{linkedStudent.name || email}，你的選擇會在封盤後鎖定。</p>
              <fieldset><legend className="text-sm font-bold text-white">1. 最終冠軍</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{TEAMS.map((team) => <ChoiceButton key={team.id} selected={prediction.predictedChampion === team.id} onClick={() => setField("predictedChampion", team.id)}>{team.flag}　{team.id}</ChoiceButton>)}</div></fieldset>
              <fieldset><legend className="text-sm font-bold text-white">2. 90 分鐘正規時間比分</legend><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3"><label className="grid gap-2 text-xs font-bold text-slate-400">🇪🇸 西班牙<input aria-label="西班牙比分" type="number" min="0" max="20" inputMode="numeric" value={prediction.spainScore} onChange={(e) => setField("spainScore", e.target.value)} className="h-14 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-center text-xl font-black text-white outline-none focus:border-amber-300" /></label><span className="pb-3 text-2xl font-black text-slate-500">:</span><label className="grid gap-2 text-xs font-bold text-slate-400">🇦🇷 阿根廷<input aria-label="阿根廷比分" type="number" min="0" max="20" inputMode="numeric" value={prediction.argentinaScore} onChange={(e) => setField("argentinaScore", e.target.value)} className="h-14 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-center text-xl font-black text-white outline-none focus:border-amber-300" /></label></div></fieldset>
              <fieldset><legend className="text-sm font-bold text-white">3. 誰先進球？</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{["西班牙", "阿根廷", "90 分鐘無進球"].map((value) => <ChoiceButton key={value} selected={prediction.firstScorerTeam === value} onClick={() => setField("firstScorerTeam", value)}>{value === "西班牙" ? "🇪🇸 " : value === "阿根廷" ? "🇦🇷 " : "🧤 "}{value}</ChoiceButton>)}</div></fieldset>
              <fieldset><legend className="text-sm font-bold text-white">4. 會不會踢到延長／PK？</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{["不會，90 分鐘定生死", "會，延長／PK 見"].map((value) => <ChoiceButton key={value} selected={prediction.extraTimeOrPenalties === value} onClick={() => setField("extraTimeOrPenalties", value)}>{value}</ChoiceButton>)}</div></fieldset>
              {error ? <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">{error}</p> : null}
              {saved ? <p role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">已鎖定在系統裡。祝你不是本屆飯主。</p> : null}
              <button type="button" disabled={submitting || isClosed} onClick={handleSubmit} className="w-full rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{isClosed ? "已封盤" : submitting ? "正在送出預測…" : registration ? "更新我的預測" : "送出我的預測"}</button>
            </div> : null}
          </div>
          <aside className="h-fit rounded-[1.75rem] border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><p className="text-xs font-bold tracking-[0.18em] text-amber-300">THE FINE PRINT</p><h2 className="mt-2 text-lg font-black">晚餐公約</h2><ol className="mt-4 space-y-4 text-sm leading-6 text-slate-300"><li><b className="text-white">01</b>　冠軍以加時／PK 後的正式結果計。</li><li><b className="text-white">02</b>　比分只算 90 分鐘正規時間。</li><li><b className="text-white">03</b>　封盤前可改，封盤後不開後門。</li><li><b className="text-white">04</b>　最後一名請第一名吃飯；同分再依規則判定。</li></ol><div className="mt-6 border-t border-slate-700 pt-5 text-xs leading-5 text-slate-400">猜中有掌聲，猜錯有飯局。這才是 115B 最健康的競爭。</div></aside>
        </section>
      </main>
    </div>
  );
}
