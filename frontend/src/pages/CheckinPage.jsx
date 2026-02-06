import React, { useEffect, useState } from "react";

function CheckinPage({ shared }) {
  const {
    apiRequest,
    buildGoogleMapsUrl_,
    formatDisplayDate_,
    loadStoredGoogleStudent_,
    GoogleSigninPanel,
    getCheckinErrorDisplay,
    saveCachedEventInfo_,
    buildFinanceDraft_,
    buildFundPaymentDraft_,
    buildFundEventDraft_,
    parseFinanceAmount_,
    parseFinanceAttachments_,
    isFinanceRequestRelevantToRole_,
    normalizeGroupId_,
    confirmDelete_,
    formatEventDate_,
    normalizeId_,
  } = shared;

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId") || "";
  const slug = params.get("slug") || "";
  const [email, setEmail] = useState("");
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [eventTitle, setEventTitle] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [autoCloseAt, setAutoCloseAt] = useState(null);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState("");

  const errorDisplay = getCheckinErrorDisplay(error);

  useEffect(() => {
    if (googleLinkedStudent && googleLinkedStudent.email) {
      setEmail(googleLinkedStudent.email);
    }
  }, [googleLinkedStudent]);

  useEffect(() => {
    if (!email || !eventId) {
      setCheckinStatus(null);
      setAttendanceStatus("");
      return;
    }
    let ignore = false;
    const fetchStatus = async () => {
      try {
        const { result } = await apiRequest({
          action: "listCheckinStatus",
          email: String(email || "").trim().toLowerCase(),
          eventIds: [eventId],
        });
        if (!result.ok) {
          throw new Error(result.error || "Status not available");
        }
        const statusEntry = result.data && result.data.statuses ? result.data.statuses[eventId] : null;
        if (!ignore) {
          setCheckinStatus(statusEntry ? statusEntry.status : null);
          setAttendanceStatus(statusEntry && statusEntry.attendance ? statusEntry.attendance : "");
        }
      } catch (err) {
        if (!ignore) {
          setCheckinStatus(null);
          setAttendanceStatus("");
        }
      }
    };
    fetchStatus();
    return () => {
      ignore = true;
    };
  }, [email, eventId]);

  useEffect(() => {
    if (!eventId) {
      return;
    }
    let ignore = false;
    const fetchEvent = async () => {
      try {
        const { result } = await apiRequest({ action: "getEvent", eventId: eventId });
        if (!result.ok) {
          throw new Error(result.error || "Event not found");
        }
        if (!ignore && result.data && result.data.event) {
          setEventTitle(result.data.event.title || "");
        }
      } catch (err) {
        if (!ignore) {
          setEventTitle("");
        }
      }
    };
    fetchEvent();
    return () => {
      ignore = true;
    };
  }, [eventId]);

  const handleSubmit = async () => {
    if (!String(email || "").trim()) {
      setError("請輸入 Email 以完成簽到。");
      return;
    }
    if (!eventId) {
      setError("Missing eventId");
      return;
    }
    if (checkinStatus === "not_registered") {
      setError("Registration not found");
      return;
    }
    if (checkinStatus === "not_attending" || checkinStatus === "attendance_unknown") {
      setError("Not attending");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "checkin",
        data: {
          eventId: eventId,
          slug: slug,
          userEmail: String(email || "").trim().toLowerCase(),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "簽到失敗");
      }
      setName(result.data && result.data.userName ? result.data.userName : "同學");
      setSuccess(true);
      setAutoCloseAt(Date.now() + 4000);
    } catch (err) {
      setError(err.message || "簽到失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoCloseAt) {
      return;
    }
    const timer = setTimeout(() => {
      setSuccess(false);
      setAutoCloseAt(null);
    }, Math.max(autoCloseAt - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [autoCloseAt]);

  const displayName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    "";

  const isCheckinBlocked =
    checkinStatus === "not_registered" ||
    checkinStatus === "not_attending" ||
    checkinStatus === "attendance_unknown" ||
    checkinStatus === "checked_in";

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              活動簽到
            </h1>
            {eventTitle ? (
              <p className="mt-2 text-sm text-slate-500">活動：{eventTitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="hidden btn-ghost sm:inline-flex"
            >
              回到首頁
            </a>
            <span className="hidden badge-muted sm:inline-flex">
              立即簽到
            </span>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 sm:hidden">
          <a
            href="/"
            className="btn-chip px-3 py-1.5"
          >
            回到首頁
          </a>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-slate-500 shadow-sm">
            立即簽到
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-28 pt-10 sm:px-12">
        <section className="card p-7 sm:p-10">
          <h2 className="text-lg font-semibold text-slate-900">確認簽到</h2>
          <p className="mt-2 text-sm text-slate-500">
            請輸入 Email 以完成簽到。{eventId && `活動：${eventTitle || eventId}`}
          </p>
          {displayName ? (
            <p className="mt-2 text-xs text-slate-500">簽到人：{displayName}</p>
          ) : null}
          <div className="mt-3 text-xs text-slate-500">
            是否出席:{" "}
            {attendanceStatus
              ? attendanceStatus
              : checkinStatus === "attendance_unknown"
              ? "未確認"
              : "-"}
          </div>
          {checkinStatus === "not_attending" ||
          checkinStatus === "attendance_unknown" ||
          checkinStatus === "not_registered" ? (
            <p className="mt-2 help-error-strong">
              無法簽到，請洽活動負責人。
            </p>
          ) : null}

          <div className="mt-6 grid gap-4">
            {googleLinkedStudent && googleLinkedStudent.email ? (
              <div className="alert alert-success">
                已登入 Google：{googleLinkedStudent.email}
              </div>
            ) : (
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後可直接帶入簽到 Email。"
                onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
              />
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="checkin-email">
                Email
              </label>
              <input
                id="checkin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@emba115b.tw"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={Boolean(googleLinkedStudent && googleLinkedStudent.email)}
                className="input-base"
              />
            </div>
            {errorDisplay ? (
              <div className="alert alert-error">
                <p className="font-semibold">{errorDisplay.title}</p>
                <p className="mt-1 text-rose-600">{errorDisplay.message}</p>
                {errorDisplay.action ? (
                  <p className="mt-2 help-error">{errorDisplay.action}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || isCheckinBlocked}
            className="mt-8 hidden w-full items-center justify-center gap-2 btn-primary sm:inline-flex"
          >
            {loading ? "簽到中..." : "確認簽到"}
          </button>
        </section>
      </main>

      <div className="fixed fixed-bottom-cta left-4 right-4 z-20 sm:hidden">
        <button
          onClick={handleSubmit}
          disabled={loading || isCheckinBlocked}
          className="flex w-full items-center justify-center btn-primary text-base shadow-2xl shadow-slate-900/20"
        >
          {loading ? "簽到中..." : "確認簽到"}
        </button>
      </div>

      {success ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-6">
          <div className="relative flex w-full max-w-lg flex-col items-center gap-6 rounded-[2.5rem] bg-white px-8 py-12 text-center shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
            <div className="success-ring" />
            <div className="success-ring success-ring--inner" />
            <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
              ✓
            </div>
            <div className="relative z-10 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-500">
                Check-In Complete
              </p>
              <h2 className="text-3xl font-semibold text-slate-900">{name}</h2>
              <p className="text-sm text-slate-500">歡迎蒞臨，我們已為您完成簽到。</p>
            </div>
            <button
              onClick={() => {
                setSuccess(false);
                setAutoCloseAt(null);
              }}
              className="mt-2 rounded-full border border-slate-200 px-6 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              關閉提示
            </button>
            <p className="text-[11px] text-slate-400">提示會在幾秒後自動關閉。</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CheckinPage;
