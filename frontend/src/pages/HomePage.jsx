import React, { useEffect, useState } from "react";

function HomePage({
  apiRequest,
  buildGoogleMapsUrl_,
  formatDisplayDate_,
  formatEventSchedule_,
  getCategoryLabel_,
  loadStoredGoogleStudent_,
  GoogleSigninPanel,
}) {
  const eventsCacheKey = "home_events_cache_v1";
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() =>
    loadStoredGoogleStudent_()
  );
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [checkinStatuses, setCheckinStatuses] = useState({});
  const [checkinTarget, setCheckinTarget] = useState(null);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");
  const [checkinSuccess, setCheckinSuccess] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");

  useEffect(() => {
    try {
      const cached = localStorage.getItem(eventsCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.events)) {
          setEvents(parsed.events);
          setLoading(false);
        }
      }
    } catch (err) {
      // Ignore cache errors
    }
  }, []);

  const normalizeEventId_ = (value) => String(value || "").trim();
  const normalizeOrderId_ = (value) => String(value || "").trim();

  const parseCustomFields_ = (value) => {
    if (!value) {
      return {};
    }
    if (typeof value === "object") {
      return value;
    }
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const parseEventDateValue_ = (value) => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number") {
      const parsedNumber = new Date(value);
      return isNaN(parsedNumber.getTime()) ? null : parsedNumber;
    }
    const raw = String(value || "").trim();
    if (!raw) {
      return null;
    }
    const normalized =
      /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(raw)
        ? raw.replace(/\//g, "-").replace(" ", "T")
        : raw;
    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const getCheckinWindowState_ = (event) => {
    if (!event) {
      return "unknown";
    }
    const openAt = parseEventDateValue_(event.checkinOpenAt);
    const closeAt = parseEventDateValue_(event.checkinCloseAt);
    const now = new Date();
    if (openAt && now < openAt) {
      return "upcoming";
    }
    if (closeAt && now > closeAt) {
      return "closed";
    }
    return "open";
  };

  const isEventClosed_ = (event) => {
    if (!event) {
      return false;
    }
    const status = String(event.status || "").trim().toLowerCase();
    if (status === "closed") {
      return true;
    }
    const endAt = parseEventDateValue_(event.endAt || event.registrationCloseAt);
    return endAt ? endAt.getTime() < Date.now() : false;
  };

  const visibleEvents = events
    .filter((event) => !isEventClosed_(event))
    .sort((a, b) => {
      const aOpen = String(a.status || "").trim().toLowerCase() === "open";
      const bOpen = String(b.status || "").trim().toLowerCase() === "open";
      if (aOpen !== bOpen) {
        return aOpen ? -1 : 1;
      }
      const aDate = parseEventDateValue_(a.startAt || a.endAt);
      const bDate = parseEventDateValue_(b.startAt || b.endAt);
      if (aDate && bDate) {
        return bDate.getTime() - aDate.getTime();
      }
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  const handleStartCheckin = (event) => {
    setCheckinError("");
    setCheckinSuccess("");
    setCheckinTarget(event);
  };

  const handleStartCancelCheckin = (event, checkinId) => {
    setCancelError("");
    setCancelSuccess("");
    setCancelTarget({ event: event, checkinId: checkinId });
  };

  const handleConfirmCheckin = async () => {
    if (!checkinTarget) {
      return;
    }
    const userEmail = googleLinkedStudent && googleLinkedStudent.email;
    if (!userEmail) {
      setCheckinError("請先使用 Google 登入後再簽到。");
      return;
    }
    setCheckinSubmitting(true);
    setCheckinError("");
    try {
      const { result } = await apiRequest({
        action: "checkin",
        data: {
          eventId: checkinTarget.id,
          userEmail: String(userEmail || "").trim().toLowerCase(),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "簽到失敗");
      }
      const nameValue =
        (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
        (googleLinkedStudent && googleLinkedStudent.name) ||
        "";
      if (result.data && result.data.checkinId) {
        setCheckinStatuses((prev) => ({
          ...prev,
          [checkinTarget.id]: {
            status: "checked_in",
            checkinId: result.data.checkinId,
            checkinAt: result.data.checkinAt || "",
          },
        }));
      }
      setCheckinSuccess(nameValue || "簽到成功");
      setCheckinTarget(null);
    } catch (err) {
      setCheckinError(err.message || "簽到失敗");
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const handleConfirmCancelCheckin = async () => {
    if (!cancelTarget || !cancelTarget.checkinId) {
      return;
    }
    setCancelSubmitting(true);
    setCancelError("");
    try {
      const { result } = await apiRequest({ action: "deleteCheckin", id: cancelTarget.checkinId });
      if (!result.ok) {
        throw new Error(result.error || "取消簽到失敗");
      }
      const eventId = normalizeEventId_(cancelTarget.event.id);
      setCheckinStatuses((prev) => ({
        ...prev,
        [eventId]: { status: "not_checked_in" },
      }));
      setCancelSuccess("已取消簽到");
      setCancelTarget(null);
    } catch (err) {
      setCancelError(err.message || "取消簽到失敗");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const displayName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    "";

  const formatCheckinTime_ = (value) => {
    if (!value) {
      return "";
    }
    if (value instanceof Date) {
      return formatDisplayDate_(value, { withTime: true });
    }
    if (typeof value === "number") {
      const parsedNumber = new Date(value);
      return isNaN(parsedNumber.getTime())
        ? ""
        : formatDisplayDate_(parsedNumber, { withTime: true });
    }
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    return formatDisplayDate_(raw, { withTime: true });
  };

  const getRegistrationStatusInfo_ = (registration, checkinStatus) => {
    if (checkinStatus && checkinStatus.status === "not_registered") {
      return {
        label: "尚未報名",
        badgeClass: "badge",
        statusKey: "not_registered",
      };
    }
    if (checkinStatus && checkinStatus.status === "not_attending") {
      return {
        label: "已報名不克出席",
        badgeClass: "badge-error",
        statusKey: "not_attending",
      };
    }
    if (checkinStatus && checkinStatus.status === "attendance_unknown") {
      return {
        label: "已報名還不確定",
        badgeClass: "badge-warning",
        statusKey: "attendance_unknown",
      };
    }
    if (
      checkinStatus &&
      (checkinStatus.status === "checked_in" || checkinStatus.status === "not_checked_in")
    ) {
      return {
        label: "已報名會出席",
        badgeClass: "badge-success",
        statusKey: "attending",
      };
    }
    const fields = parseCustomFields_(registration && registration.customFields);
    const attendance = String(fields.attendance || "").trim();
    if (attendance === "出席") {
      return {
        label: "已報名會出席",
        badgeClass: "badge-success",
        statusKey: "attending",
      };
    }
    if (attendance === "不克出席") {
      return {
        label: "已報名不克出席",
        badgeClass: "badge-error",
        statusKey: "not_attending",
      };
    }
    return {
      label: "已報名還不確定",
      badgeClass: "badge-warning",
      statusKey: "attendance_unknown",
    };
  };

  const registrationsByEventId = myRegistrations.reduce((acc, registration) => {
    const eventId = normalizeEventId_(registration.eventId);
    if (eventId) {
      acc[eventId] = registration;
    }
    return acc;
  }, {});

  const shouldShowRegistrationBadge =
    myRegistrations.length > 0 || lookupError === "查無報名紀錄。";

  const loadCheckinStatuses_ = async (emailValue, registrations) => {
    const normalizedEmail = String(emailValue || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }
    const eventIds = (registrations || [])
      .map((item) => normalizeEventId_(item.eventId))
      .filter((value) => value);
    if (!eventIds.length) {
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "listCheckinStatus",
        email: normalizedEmail,
        eventIds: eventIds,
      });
      if (!result.ok) {
        throw new Error(result.error || "查詢失敗");
      }
      setCheckinStatuses(result.data && result.data.statuses ? result.data.statuses : {});
    } catch (err) {
      setCheckinStatuses({});
    }
  };

  const handleLookup = async (emailValue) => {
    const normalizedEmail = String(emailValue || "").trim().toLowerCase();
    if (!normalizedEmail) {
      setLookupError("請先輸入 Email 以查詢報名紀錄。");
      setMyRegistrations([]);
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    try {
      const { result } = await apiRequest({ action: "listRegistrations" });
      if (!result.ok) {
        throw new Error(result.error || "查詢失敗");
      }
      const registrations = result.data && result.data.registrations ? result.data.registrations : [];
      const matches = registrations.filter((item) => {
        const email = String(item.userEmail || "").trim().toLowerCase();
        const status = String(item.status || "").trim().toLowerCase();
        return email === normalizedEmail && status !== "cancelled";
      });
      if (!matches.length) {
        setMyRegistrations([]);
        setCheckinStatuses({});
        setLookupError("查無報名紀錄。");
      } else {
        setMyRegistrations(matches);
        await loadCheckinStatuses_(normalizedEmail, matches);
      }
    } catch (err) {
      setLookupError(err.message || "查詢失敗");
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    if (googleLinkedStudent && googleLinkedStudent.email) {
      setLookupEmail(googleLinkedStudent.email);
      handleLookup(googleLinkedStudent.email);
    }
  }, [googleLinkedStudent]);

  useEffect(() => {
    let ignore = false;
    const fetchEvents = async () => {
      try {
        const { result, url } = await apiRequest({ action: "listEvents" });
        if (!result.ok) {
          throw new Error(result.error || "載入失敗");
        }
        if (!ignore) {
          setEvents(result.data && result.data.events ? result.data.events : []);
          try {
            localStorage.setItem(
              eventsCacheKey,
              JSON.stringify({ ts: Date.now(), events: result.data && result.data.events ? result.data.events : [] })
            );
          } catch (err) {
            // Ignore cache errors
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message ? `活動列表暫時無法載入：${err.message}` : "活動列表暫時無法載入。");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    fetchEvents();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              班級入口
            </h1>
          </div>
          <span className="hidden badge-muted sm:inline-flex">
            班級活動中心
          </span>
        </div>
      </header>
      <div className="mx-auto mt-4 max-w-6xl px-6 sm:px-12">
        <a
          href="/"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
        >
          回首頁
        </a>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col px-6 pb-28 pt-10 sm:px-12">
        <section className="order-2 mb-8 rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:order-none sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">我的報名</h2>
              <p className="mt-2 text-sm text-slate-500">
                用 Email 查詢報名紀錄，也可以直接從下方活動卡片報名。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                已報名 {myRegistrations.length}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                可報名活動 {visibleEvents.length}
              </span>
            </div>
            {lookupLoading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                查詢中
              </span>
            ) : null}
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              {googleLinkedStudent && googleLinkedStudent.email ? (
                <div className="alert alert-success">
                  已登入 Google：{googleLinkedStudent.email}
                </div>
              ) : (
                <GoogleSigninPanel
                  title="Google 登入"
                  helperText="登入後可自動帶入 Email。"
                  onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
                />
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="lookup-email">
                  Email
                </label>
                <input
                  id="lookup-email"
                  type="email"
                  value={lookupEmail}
                  onChange={(event) => setLookupEmail(event.target.value)}
                  placeholder="you@emba115b.tw"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={Boolean(googleLinkedStudent && googleLinkedStudent.email)}
                  className="input-base"
                />
              </div>
              <button
                onClick={() => handleLookup(lookupEmail)}
                disabled={lookupLoading}
                className="btn-primary"
              >
                {lookupLoading ? "查詢中..." : "查詢我的報名"}
              </button>
              <a
                href="#events"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                直接看可報名活動
              </a>
              {lookupError ? (
                <p className="text-xs font-semibold text-amber-600">{lookupError}</p>
              ) : null}
            </div>
            <div className="card-muted p-5 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">報名小提醒</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-500">
                <li>若已報名，活動卡片會顯示你的報名狀態。</li>
                <li>開放簽到時，系統會顯示簽到按鈕。</li>
                <li>有問題可聯絡活動負責人或班務窗口。</li>
              </ul>
            </div>
          </div>

          {myRegistrations.length ? (
            <div className="mt-6 space-y-4">
              {myRegistrations.map((item) => {
                const eventId = normalizeEventId_(item.eventId);
                const event =
                  events.find((evt) => normalizeEventId_(evt.id) === eventId) || null;
                const checkinUrl = event ? String(event.checkinUrl || "").trim() : "";
                const checkinState = getCheckinWindowState_(event);
                const checkinStatus = checkinStatuses[eventId] || null;
                const isCheckedIn = checkinStatus && checkinStatus.status === "checked_in";
                const isNotAttending = checkinStatus && checkinStatus.status === "not_attending";
                const isAttendanceUnknown =
                  checkinStatus && checkinStatus.status === "attendance_unknown";
                const statusInfo = getRegistrationStatusInfo_(item, checkinStatus);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {(event && event.title) || item.eventId}
                      </p>
                      <span className={`mt-2 inline-flex ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">{eventId}</p>
                    </div>
                    {isCheckedIn ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>
                          已簽到
                          {checkinStatus && checkinStatus.checkinAt
                            ? ` · ${formatCheckinTime_(checkinStatus.checkinAt)}`
                            : ""}
                        </span>
                        <button
                          onClick={() =>
                            handleStartCancelCheckin(event, checkinStatus.checkinId || "")
                          }
                          className="btn-chip"
                        >
                          取消簽到
                        </button>
                      </div>
                    ) : isNotAttending ? (
                      <span className="text-xs text-rose-500">
                        已回覆不克出席，無法簽到，請洽活動負責人
                      </span>
                    ) : isAttendanceUnknown ? (
                      <span className="text-xs text-rose-500">
                        未確認出席，無法簽到，請洽活動負責人
                      </span>
                    ) : checkinUrl && checkinState === "open" ? (
                      <button
                        onClick={() => handleStartCheckin(event)}
                        className="btn-outline"
                      >
                        立即簽到
                      </button>
                    ) : event && checkinState === "upcoming" ? (
                      <span className="text-xs text-slate-400">簽到尚未開放</span>
                    ) : event && checkinState === "closed" ? (
                      <span className="text-xs text-slate-400">簽到已截止</span>
                    ) : event ? (
                      <span className="text-xs text-slate-400">簽到尚未開放</span>
                    ) : (
                      <span className="text-xs text-slate-400">活動資料載入中</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : lookupLoading ? (
            <div className="mt-6 space-y-4">
              {[0, 1].map((item) => (
                <div
                  key={`reg-skeleton-${item}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white p-4"
                >
                  <div className="space-y-2">
                    <div className="h-4 w-40 rounded-full bg-slate-200/70" />
                    <div className="h-3 w-24 rounded-full bg-slate-100" />
                  </div>
                  <div className="h-8 w-20 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          ) : lookupError === "查無報名紀錄。" ? (
            <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">尚未報名任何活動</p>
              <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                尚未報名
              </span>
            </div>
          ) : null}
        </section>

        <div
          id="events"
          className="order-1 rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:order-none sm:p-10"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">近期活動</h2>
            {loading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                載入中
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="mt-6 alert alert-warning">
              <p className="font-semibold">載入失敗</p>
              <p className="mt-1 text-amber-600">{error}</p>
            </div>
          ) : null}

          {!loading && !visibleEvents.length && !error ? (
            <p className="mt-6 text-sm text-slate-500">目前沒有活動，請稍後再查看。</p>
          ) : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {loading
              ? [0, 1, 2, 3].map((item) => (
                  <div
                    key={`event-skeleton-${item}`}
                    className="flex animate-pulse flex-col justify-between rounded-2xl border border-slate-200/70 bg-white p-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-12 rounded-full bg-slate-100" />
                        <div className="h-3 w-16 rounded-full bg-slate-100" />
                      </div>
                      <div className="h-5 w-40 rounded-full bg-slate-200/70" />
                      <div className="h-4 w-28 rounded-full bg-slate-100" />
                      <div className="h-3 w-32 rounded-full bg-slate-100" />
                      <div className="h-3 w-24 rounded-full bg-slate-100" />
                    </div>
                    <div className="mt-6 h-9 rounded-xl bg-slate-100" />
                  </div>
                ))
              : visibleEvents.map((event) => {
                  const statusLabel = event.status === "open" ? "報名進行中" : "報名狀態更新";
                  const schedule = formatEventSchedule_(event.startAt, event.endAt);
                  const eventId = normalizeEventId_(event.id);
                  const registration = registrationsByEventId[eventId];
                  const checkinStatus = checkinStatuses[eventId] || null;
                  const isRegistered = Boolean(registration);
                  const registrationStatus = registration
                    ? getRegistrationStatusInfo_(registration, checkinStatus)
                    : {
                        label: "尚未報名",
                        badgeClass: "badge",
                        statusKey: "not_registered",
                      };
                  const accentClass =
                    registrationStatus.statusKey === "attending"
                      ? "border-l-emerald-400"
                      : registrationStatus.statusKey === "not_attending"
                        ? "border-l-rose-400"
                        : registrationStatus.statusKey === "attendance_unknown"
                          ? "border-l-amber-400"
                          : "border-l-transparent";
                  const badgeClass = isRegistered
                    ? `${registrationStatus.badgeClass} ring-1 ring-slate-200/70 shadow-sm`
                    : registrationStatus.badgeClass;
                  const registeredCtaClass =
                    registrationStatus.statusKey === "attending"
                      ? "badge-success hover:border-emerald-300 hover:bg-emerald-100"
                      : registrationStatus.statusKey === "not_attending"
                        ? "badge-error hover:border-rose-300 hover:bg-rose-100"
                        : registrationStatus.statusKey === "attendance_unknown"
                          ? "badge-warning hover:border-amber-300 hover:bg-amber-100"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white";
                  const ctaLabel = isRegistered ? "查看報名" : "前往報名";
                  const ctaClass = isRegistered
                    ? registeredCtaClass
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white";
                  return (
                    <div
                      key={event.id}
                      className={`flex flex-col justify-between rounded-2xl border border-l-4 border-slate-200/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accentClass}`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{getCategoryLabel_(event.category)}</span>
                          <span>{statusLabel}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">{event.title}</h3>
                        {shouldShowRegistrationBadge ? (
                          <span className={`mt-2 inline-flex ${badgeClass} text-[11px] font-semibold`}>
                            {registrationStatus.label}
                          </span>
                        ) : null}
                        <p className="mt-2 text-sm text-slate-500">{event.location}</p>
                        {event.address ? (
                          <a
                            href={buildGoogleMapsUrl_(event.address)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            {event.address}
                          </a>
                        ) : null}
                        <div className="mt-2 space-y-1 text-xs text-slate-400">
                          <p>{schedule.dateLabel || "-"}</p>
                          {schedule.timeLabel ? <p>{schedule.timeLabel}</p> : null}
                          {event.registrationCloseAt ? (
                            <p>
                              報名截止：
                              {formatDisplayDate_(event.registrationCloseAt, { withTime: true })}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <a
                        href={`/register?eventId=${event.id}`}
                        className={`mt-5 inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${ctaClass}`}
                      >
                        {ctaLabel}
                      </a>
                    </div>
                  );
                })}
          </div>
        </div>

      </main>

      {checkinTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Check-In
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              {checkinTarget.title || checkinTarget.id}
            </h2>
            {displayName ? (
              <p className="mt-2 text-sm text-slate-500">簽到人：{displayName}</p>
            ) : null}
            <p className="mt-4 text-sm text-slate-500">確定要完成簽到嗎？</p>
            {checkinError ? (
              <p className="mt-3 text-xs font-semibold text-rose-600">{checkinError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  setCheckinTarget(null);
                  setCheckinError("");
                }}
                className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                取消簽到
              </button>
              <button
                onClick={handleConfirmCheckin}
                disabled={checkinSubmitting}
                className="rounded-full bg-[#1e293b] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkinSubmitting ? "簽到中..." : "確認簽到"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Cancel Check-In
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              {(cancelTarget.event && (cancelTarget.event.title || cancelTarget.event.id)) || "活動"}
            </h2>
            {displayName ? (
              <p className="mt-2 text-sm text-slate-500">簽到人：{displayName}</p>
            ) : null}
            <p className="mt-4 text-sm text-slate-500">確定要取消簽到嗎？</p>
            {cancelError ? (
              <p className="mt-3 text-xs font-semibold text-rose-600">{cancelError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  setCancelTarget(null);
                  setCancelError("");
                }}
                className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                保留簽到
              </button>
              <button
                onClick={handleConfirmCancelCheckin}
                disabled={cancelSubmitting}
                className="rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelSubmitting ? "取消中..." : "確認取消"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {checkinSuccess ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500">
              Check-In Complete
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">{checkinSuccess}</h2>
            <p className="mt-2 text-sm text-slate-500">歡迎蒞臨，我們已為您完成簽到。</p>
            <button
              onClick={() => setCheckinSuccess("")}
              className="mt-6 rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              回到首頁
            </button>
          </div>
        </div>
      ) : null}

      {cancelSuccess ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-500">
              Check-In Cancelled
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">{cancelSuccess}</h2>
            <p className="mt-2 text-sm text-slate-500">已取消簽到，可重新簽到。</p>
            <button
              onClick={() => setCancelSuccess("")}
              className="mt-6 rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              回到首頁
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;
