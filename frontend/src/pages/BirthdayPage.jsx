import React, { useEffect, useMemo, useState } from "react";

function BirthdayPage({ shared }) {
  const { apiRequest, GoogleSigninPanel, loadStoredGoogleStudent_ } = shared;
  const cacheKey = "birthdays_page_cache_v3";
  const cacheTtlMs = 6 * 60 * 60 * 1000;
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [birthdaysByMonth, setBirthdaysByMonth] = useState(() => ({}));
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [nextMonth, setNextMonth] = useState(() => {
    const nowMonth = new Date().getMonth() + 1;
    return nowMonth === 12 ? 1 : nowMonth + 1;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const hasGoogleLogin = Boolean(googleLinkedStudent && googleLinkedStudent.email);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: `${index + 1}月`,
      })),
    []
  );

  useEffect(() => {
    if (!hasGoogleLogin) {
      setLoading(false);
      return;
    }
    let ignore = false;

    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const ts = Number(parsed && parsed.ts ? parsed.ts : 0);
        const months = parsed && parsed.months && typeof parsed.months === "object" ? parsed.months : null;
        if (ts && months && Date.now() - ts <= cacheTtlMs) {
          setBirthdaysByMonth(months);
          setCurrentMonth(Number(parsed.currentMonth || currentMonth) || currentMonth);
          setNextMonth(Number(parsed.nextMonth || nextMonth) || nextMonth);
          setSelectedMonth(Number(parsed.currentMonth || currentMonth) || currentMonth);
          setLoading(false);
        }
      }
    } catch (cacheError) {
      // Ignore cache failures.
    }

    const loadBirthdays = async () => {
      try {
        const { result } = await apiRequest({ action: "listBirthdays" });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "載入壽星資料失敗");
        }
        if (ignore) {
          return;
        }
        const data = result.data || {};
        const months = data.months && typeof data.months === "object" ? data.months : {};
        const monthValue = Number(data.currentMonth || currentMonth) || currentMonth;
        const nextValue = Number(data.nextMonth || nextMonth) || nextMonth;
        setBirthdaysByMonth(months);
        setCurrentMonth(monthValue);
        setNextMonth(nextValue);
        setSelectedMonth((prev) => (prev >= 1 && prev <= 12 ? prev : monthValue));
        setError("");
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              ts: Date.now(),
              months: months,
              currentMonth: monthValue,
              nextMonth: nextValue,
            })
          );
        } catch (writeError) {
          // Ignore cache write failures.
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.message || "載入壽星資料失敗");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadBirthdays();
    return () => {
      ignore = true;
    };
  }, [apiRequest, hasGoogleLogin]);

  const birthdays = Array.isArray(birthdaysByMonth[String(selectedMonth)])
    ? birthdaysByMonth[String(selectedMonth)]
    : [];
  const currentMonthBirthdays = Array.isArray(birthdaysByMonth[String(currentMonth)])
    ? birthdaysByMonth[String(currentMonth)]
    : [];

  const formatBirthdayName_ = (item) => {
    const displayName = String((item && item.name) || "").trim();
    const chineseName = String((item && item.nameZh) || "").trim();
    const hasCjkInDisplayName = /[\u3400-\u9fff]/.test(displayName);
    if (displayName && hasCjkInDisplayName) {
      return displayName;
    }
    if (displayName && chineseName && displayName !== chineseName) {
      return `${displayName} (${chineseName})`;
    }
    return displayName || chineseName || "未命名";
  };

  const buildBirthdayMessage_ = (month, list) => {
    const safeMonth = Number(month || 0) || currentMonth;
    if (!Array.isArray(list) || !list.length) {
      return `${safeMonth}月目前沒有壽星，先預祝下月壽星生日快樂！`;
    }
    const lines = [`${safeMonth}月壽星名單`];
    list.forEach((item, index) => {
      lines.push(`${index + 1}. ${formatBirthdayName_(item)}（${item.month}/${item.day}）`);
    });
    lines.push("祝壽星們生日快樂！");
    return lines.join("\n");
  };

  const copyBirthdayMessage = async () => {
    const text = buildBirthdayMessage_(currentMonth, currentMonthBirthdays);
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyStatus("已複製本月慶生文案");
      setTimeout(() => setCopyStatus(""), 2200);
    } catch (copyError) {
      setCopyStatus("複製失敗，請手動複製");
      setTimeout(() => setCopyStatus(""), 2200);
    }
  };

  if (!hasGoogleLogin) {
    return (
      <div className="min-h-screen">
        <header className="px-4 pt-6 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">壽星專區</h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <p className="text-sm font-medium text-slate-700">請先登入後查看每月壽星名單</p>
            <div className="mt-4">
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後可查看本月、下月與任意月份壽星。"
                onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-16">
      <header className="px-4 pt-6 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                NTU EMBA 115B
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">壽星專區</h1>
              <p className="mt-2 text-sm text-slate-500">每月初可快速查看壽星並複製慶生文案。</p>
            </div>
            <a
              href="/"
              className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              回首頁
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 sm:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonth)}
              className={`h-11 rounded-2xl border text-sm font-semibold ${
                selectedMonth === currentMonth
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              本月 {currentMonth}月
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonth(nextMonth)}
              className={`h-11 rounded-2xl border text-sm font-semibold ${
                selectedMonth === nextMonth
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              下月 {nextMonth}月
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {monthOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSelectedMonth(item.value)}
                className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                  selectedMonth === item.value
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{selectedMonth} 月壽星</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              共 {birthdays.length} 位
            </span>
          </div>

          {loading ? (
            <div className="mt-4 space-y-2">
              <div className="h-14 rounded-2xl bg-slate-100/80" />
              <div className="h-14 rounded-2xl bg-slate-100/80" />
              <div className="h-14 rounded-2xl bg-slate-100/80" />
            </div>
          ) : birthdays.length ? (
            <div className="mt-4 space-y-2">
              {birthdays.map((item) => (
                <div
                  key={`${item.id || item.name}-${item.month}-${item.day}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3"
                >
                  <p className="text-sm font-medium text-slate-900">{formatBirthdayName_(item)}</p>
                  <p className="text-sm font-semibold text-slate-600">
                    {item.month}/{item.day}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {selectedMonth} 月目前沒有壽星
            </div>
          )}

          {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-auto sm:rounded-2xl sm:border sm:pb-3 sm:shadow-lg">
        <button
          type="button"
          onClick={copyBirthdayMessage}
          className="h-11 w-full rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white sm:w-auto sm:min-w-[220px]"
        >
          複製本月慶生文案
        </button>
        {copyStatus ? <p className="mt-2 text-center text-xs text-slate-600">{copyStatus}</p> : null}
      </div>
    </div>
  );
}

export default BirthdayPage;
