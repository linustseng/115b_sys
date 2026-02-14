import React, { useEffect, useState } from "react";
import emblem115b from "../assets/115b_icon.png";
import ApprovalsCenter from "./ApprovalsCenter";

function LandingPage({ shared, GoogleSigninPanel, loadStoredGoogleStudent_ }) {
  const { apiRequest } = shared;
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
        return false;
      }
      return stored === "1";
    } catch (error) {
      return false;
    }
  });
  const [showCalendarDesktop, setShowCalendarDesktop] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const calendarEmbedUrl =
    "https://calendar.google.com/calendar/embed?src=d07db9571997a7592737ae50fc3062ab8a1105d0e3b794ded9672b1e6cd0502a%40group.calendar.google.com&ctz=Asia%2FTaipei";

  useEffect(() => {
    if (!hasGoogleLogin) {
      setLoginCollapsed(false);
    }
  }, [hasGoogleLogin]);

  useEffect(() => {
    if (hasGoogleLogin) {
      setLoginCollapsed(true);
    }
  }, [hasGoogleLogin]);

  useEffect(() => {
    if (!hasGoogleLogin) {
      setMemberships([]);
      setMembershipsLoaded(false);
      return;
    }
    let ignore = false;
    const loadMemberships = async () => {
      try {
        const { result } = await apiRequest({ action: "listGroupMemberships" });
        if (!ignore) {
          setMemberships(result.data && result.data.memberships ? result.data.memberships : []);
          setMembershipsLoaded(true);
        }
      } catch (error) {
        if (!ignore) {
          setMemberships([]);
          setMembershipsLoaded(true);
        }
      }
    };
    loadMemberships();
    return () => {
      ignore = true;
    };
  }, [apiRequest, hasGoogleLogin]);

  useEffect(() => {
    try {
      localStorage.setItem("home_calendar_mobile_open", showCalendarMobile ? "1" : "0");
    } catch (error) {
      // Ignore write errors (private mode, blocked storage, etc.)
    }
  }, [showCalendarMobile]);

  const loadNotifications = async () => {
    setNotificationLoading(true);
    setNotificationError("");
    try {
      const { result } = await apiRequest({
        action: "listNotifications",
        studentId: googleLinkedStudent && googleLinkedStudent.id ? googleLinkedStudent.id : "",
        email: googleLinkedStudent && googleLinkedStudent.email ? googleLinkedStudent.email : "",
      });
      if (!result.ok) {
        throw new Error(result.error || "通知載入失敗");
      }
      const items = result.data && result.data.notifications ? result.data.notifications : [];
      const unreadCount = result.data && result.data.unreadCount ? Number(result.data.unreadCount) : 0;
      setNotifications(items);
      setNotificationUnread(unreadCount);
    } catch (error) {
      setNotificationError(error.message || "通知載入失敗");
      setNotifications([]);
      setNotificationUnread(0);
    } finally {
      setNotificationLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [googleLinkedStudent && googleLinkedStudent.id, googleLinkedStudent && googleLinkedStudent.email]);

  const markNotificationRead = async (notificationId) => {
    if (!notificationId || !hasGoogleLogin) {
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "markNotificationRead",
        notificationId: notificationId,
        studentId: googleLinkedStudent && googleLinkedStudent.id ? googleLinkedStudent.id : "",
        email: googleLinkedStudent && googleLinkedStudent.email ? googleLinkedStudent.email : "",
      });
      if (!result.ok) {
        return;
      }
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
      );
      setNotificationUnread((prev) => (prev > 0 ? prev - 1 : 0));
    } catch (error) {
      // Ignore read sync failures.
    }
  };

  const markAllNotificationsRead = async () => {
    if (!hasGoogleLogin) {
      return;
    }
    const unreadIds = notifications
      .filter((item) => !item.isRead)
      .map((item) => item.id)
      .filter(Boolean);
    if (!unreadIds.length) {
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "markAllNotificationsRead",
        notificationIds: unreadIds,
        studentId: googleLinkedStudent && googleLinkedStudent.id ? googleLinkedStudent.id : "",
        email: googleLinkedStudent && googleLinkedStudent.email ? googleLinkedStudent.email : "",
      });
      if (!result.ok) {
        return;
      }
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setNotificationUnread(0);
    } catch (error) {
      // Ignore read sync failures.
    }
  };

  const normalizedId = String((googleLinkedStudent && googleLinkedStudent.id) || "").trim();
  const userMemberships = memberships.filter((item) => {
    const memberId = String(item.personId || "").trim();
    return normalizedId && memberId && normalizedId === memberId;
  });
  const hasGroupAccess_ = (allowedGroupIds) =>
    userMemberships.some((item) => {
      const groupId = String(item.groupId || "").trim();
      const roleInGroup = String(item.roleInGroup || "").trim();
      if (groupId === "A" && (roleInGroup === "lead" || roleInGroup === "deputy")) {
        return true;
      }
      return allowedGroupIds.includes(groupId);
    });
  const canSeeEventAdmin = membershipsLoaded && hasGroupAccess_(["C", "E"]);
  const canSeeOrderingAdmin = membershipsLoaded && hasGroupAccess_(["I", "E"]);
  const canSeeFinanceAdmin = membershipsLoaded && hasGroupAccess_(["D", "E"]);
  const canSeeSoftballAdmin = membershipsLoaded && hasGroupAccess_(["E", "H"]);

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
                  NTU EMBA 115B 班級系統
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              共學 · 共餐 · 共練 · 2026-2028 and forever
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNotificationOpen(true)}
                className="relative rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                通知
                {notificationUnread > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {notificationUnread > 99 ? "99+" : notificationUnread}
                  </span>
                ) : null}
              </button>
              <a
                href="/profile"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-slate-400"
              >
                個人資訊維護
              </a>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-5 py-4 text-xs text-slate-600 shadow-sm">
              {hasGoogleLogin ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {googleLinkedStudent.photoUrl ? (
                      <img
                        src={googleLinkedStudent.photoUrl}
                        alt="avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                        {displayName ? displayName.slice(0, 2) : "NT"}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {displayName ? `${displayName} 已登入` : "已登入"}
                    </p>
                    <p className="mt-1 text-slate-500">{googleLinkedStudent.email}</p>
                  </div>
                </div>
              ) : (
                <p className="font-semibold text-slate-600">尚未登入 Google</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-32 pt-6 sm:px-12 sm:pb-24">
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
              <h3 className="mt-4 text-xl font-semibold text-slate-900">活動管理</h3>
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
              {canSeeEventAdmin ? (
                <a
                  href="/admin/events"
                  className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--amber">
            <div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">訂餐管理</h3>
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
              {canSeeOrderingAdmin ? (
                <a
                  href="/admin/ordering"
                  className="text-xs font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--sky">
            <div>
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
              {canSeeFinanceAdmin ? (
                <a
                  href="/admin/finance"
                  className="text-xs font-semibold text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-800"
                >
                  管理入口
                </a>
              ) : null}
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between card-system card-system--emerald">
            <div>
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
              {canSeeSoftballAdmin ? (
                <a
                  href="/softball"
                  className="text-xs font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800"
                >
                  管理入口
                </a>
              ) : null}
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
                <span className="text-xs text-slate-500">{googleLinkedStudent.email}</span>
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
                  <div className="alert alert-success text-xs px-4 py-2">已登入 Google</div>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-5 px-2 py-2">
          <a href="/" className="py-1 text-center text-[11px] font-semibold text-slate-700">
            首頁
          </a>
          <a
            href="/events"
            className="py-1 text-center text-[11px] font-semibold text-slate-700"
          >
            活動
          </a>
          <a
            href="/ordering"
            className="py-1 text-center text-[11px] font-semibold text-slate-700"
          >
            訂餐
          </a>
          <a
            href="/finance"
            className="py-1 text-center text-[11px] font-semibold text-slate-700"
          >
            財務
          </a>
          <a href="/profile" className="py-1 text-center text-[11px] font-semibold text-slate-700">
            個人
          </a>
        </div>
      </nav>

      {notificationOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40">
          <div className="absolute inset-0" onClick={() => setNotificationOpen(false)} aria-hidden="true" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl sm:w-[420px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">通知中心</h2>
              <div className="flex items-center gap-2">
                {hasGoogleLogin ? (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                  >
                    全部已讀
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setNotificationOpen(false)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                >
                  關閉
                </button>
              </div>
            </div>

            {notificationLoading ? <p className="mt-4 text-xs text-slate-500">載入通知中...</p> : null}
            {notificationError ? <p className="mt-4 text-xs text-rose-600">{notificationError}</p> : null}

            {!notificationLoading && !notificationError ? (
              <div className="mt-4 space-y-4">
                {!notifications.length ? (
                  <div className="alert alert-info text-xs">目前沒有新的待辦或公告。</div>
                ) : null}
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 ${
                      item.isRead ? "border-slate-200 bg-slate-50/50" : "border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title || "通知"}</p>
                        <p className="mt-1 text-xs text-slate-600">{item.message || ""}</p>
                      </div>
                      {!item.isRead && hasGoogleLogin ? (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(item.id)}
                          className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-slate-300"
                        >
                          已讀
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {item.isRead ? "已讀" : "未讀"}
                        </span>
                      )}
                    </div>
                    {item.ctaUrl ? (
                      <a
                        href={item.ctaUrl}
                        onClick={() => {
                          setNotificationOpen(false);
                          if (!item.isRead && hasGoogleLogin) {
                            markNotificationRead(item.id);
                          }
                        }}
                        className="mt-2 inline-flex items-center text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                      >
                        {item.ctaLabel || "前往處理"}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export default LandingPage;
