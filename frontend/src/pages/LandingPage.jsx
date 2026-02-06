import React, { useEffect, useState } from "react";
import emblem115b from "../assets/115b_icon.png";
import ApprovalsCenter from "./ApprovalsCenter";

function LandingPage({ shared, GoogleSigninPanel, loadStoredGoogleStudent_ }) {
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() =>
    loadStoredGoogleStudent_()
  );
  const displayName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    "";
  const hasGoogleLogin = Boolean(googleLinkedStudent && googleLinkedStudent.email);
  const [loginCollapsed, setLoginCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.innerWidth < 768;
  });
  const [showCalendarMobile, setShowCalendarMobile] = useState(() => {
    try {
      const stored = localStorage.getItem("home_calendar_mobile_open");
      if (stored === null) {
        return true;
      }
      return stored === "1";
    } catch (error) {
      return true;
    }
  });
  const [showCalendarDesktop, setShowCalendarDesktop] = useState(false);
  const calendarEmbedUrl =
    "https://calendar.google.com/calendar/embed?src=d07db9571997a7592737ae50fc3062ab8a1105d0e3b794ded9672b1e6cd0502a%40group.calendar.google.com&ctz=Asia%2FTaipei";

  useEffect(() => {
    if (!hasGoogleLogin) {
      setLoginCollapsed(false);
    }
  }, [hasGoogleLogin]);

  useEffect(() => {
    try {
      localStorage.setItem("home_calendar_mobile_open", showCalendarMobile ? "1" : "0");
    } catch (error) {
      // Ignore write errors (private mode, blocked storage, etc.)
    }
  }, [showCalendarMobile]);

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12 entrance">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-4">
              <img
                src={emblem115b}
                alt="NTU EMBA 115B"
                className="h-12 w-12 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  NTU EMBA 115B
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                  115B 班務系統
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              共學 · 共餐 · 共練 · 2026-2028 and forever
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-5 py-4 text-xs text-slate-600 shadow-sm">
            {hasGoogleLogin ? (
              <div>
                <p className="font-semibold text-slate-900">
                  {displayName ? `${displayName} 已登入` : "已登入"}
                </p>
                <p className="mt-1 text-slate-500">{googleLinkedStudent.email}</p>
              </div>
            ) : (
              <p className="font-semibold text-slate-600">尚未登入 Google</p>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-6 sm:px-12">
        {!hasGoogleLogin ? (
          <section className="entrance entrance-delay-1 mb-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_80px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Google 登入</h2>
              <button
                type="button"
                onClick={() => setLoginCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
              >
                {loginCollapsed ? "展開 ▼" : "收合 ▲"}
              </button>
            </div>
            {!loginCollapsed ? (
              <>
                <div className="mt-4">
                  <GoogleSigninPanel
                    title="Google 登入"
                    helperText="請先完成綁定，才能使用活動、訂餐與壘球功能。"
                    onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
                  />
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  登入後會儲存在本機，後續進入各系統會自動帶入。
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 sm:gap-5 lg:grid-cols-2 xl:grid-cols-4">
          <div className="entrance entrance-delay-3 group flex h-full flex-col justify-between card-system card-system--slate">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  System 01
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">活動管理系統</h3>
              <p className="mt-3 text-sm text-slate-500">
                報名、簽到與活動資訊一站完成。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/events"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/admin/events"
                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-slate-900/30 hover:bg-slate-800"
              >
                活動管理
              </a>
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--amber">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600/70">
                  System 02
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-amber-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">訂餐系統</h3>
              <p className="mt-3 text-sm text-amber-900/80">
                週末與特別課程訂餐，前一日 23:59 截止。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/ordering"
                className="inline-flex items-center rounded-full border border-amber-300 bg-white px-4 py-1.5 text-sm font-semibold text-amber-700 shadow-sm hover:border-amber-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/admin/ordering"
                className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-amber-500/30 hover:bg-amber-500"
              >
                訂餐管理
              </a>
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--sky">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600/70">
                  System 03
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-sky-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">財務管理</h3>
              <p className="mt-3 text-sm text-sky-900/80">
                班費請購、請款與零用金申請。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/finance"
                className="inline-flex items-center rounded-full border border-sky-300 bg-white px-4 py-1.5 text-sm font-semibold text-sky-700 shadow-sm hover:border-sky-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/admin/finance"
                className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-500"
              >
                財務管理
              </a>
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--emerald">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/70">
                  System 04
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-emerald-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">壘球隊管理</h3>
              <p className="mt-3 text-sm text-emerald-900/80">練習排程、點名與出席統計。</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/softball/player"
                className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm hover:border-emerald-400"
              >
                球員入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/softball"
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-500"
              >
                前往管理
              </a>
            </div>
          </div>
        </section>

        <section className="entrance entrance-delay-3 mt-8 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
          <ApprovalsCenter shared={shared} embedded requestId="" />
        </section>

        {hasGoogleLogin ? (
          <section className="entrance entrance-delay-2 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Google 登入</h2>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  已登入
                </span>
                <button
                  type="button"
                  onClick={() => setLoginCollapsed((prev) => !prev)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                >
                  {loginCollapsed ? "展開 ▼" : "收合 ▲"}
                </button>
              </div>
            </div>
            {!loginCollapsed ? (
              <>
                <div className="mt-4">
                  <div className="alert alert-success text-xs px-4 py-2">
                    已登入 Google：{googleLinkedStudent.email}
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  登入後會儲存在本機，後續進入活動、訂餐與壘球系統會自動帶入。
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="entrance entrance-delay-3 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">班級行李曆</h2>
              <p className="mt-2 text-sm text-slate-500">
                共用行李曆同步最新活動安排，手機可收合或新視窗查看。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCalendarMobile((prev) => !prev)}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 sm:hidden"
              >
                {showCalendarMobile ? "收合行李曆" : "展開行李曆"}
              </button>
              <button
                type="button"
                onClick={() => setShowCalendarDesktop((prev) => !prev)}
                className="btn-chip hidden sm:inline-flex"
              >
                {showCalendarDesktop ? "收合行李曆" : "載入行李曆"}
              </button>
              <a
                href={calendarEmbedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                在新視窗開啟
              </a>
            </div>
          </div>

          {!showCalendarMobile ? (
            <div className="mt-4 alert alert-info text-xs text-slate-500 sm:hidden">
              為了保持手機順暢，可先收合行李曆。
            </div>
          ) : null}

          {showCalendarMobile ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white sm:hidden">
              <iframe
                title="班級行李曆（手機）"
                src={calendarEmbedUrl}
                className="h-[480px] w-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer"
                scrolling="no"
              />
            </div>
          ) : null}

          {showCalendarDesktop ? (
            <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white sm:block">
              <iframe
                title="班級行李曆"
                src={calendarEmbedUrl}
                className="h-[560px] w-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer"
                scrolling="no"
              />
            </div>
          ) : (
            <div className="mt-6 hidden rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:block">
              行李曆為內嵌內容，點選「載入行李曆」可加速首頁載入。
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
