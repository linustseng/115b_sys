import React, { useEffect, useMemo, useRef, useState } from "react";

function OrderingPage({ shared }) {

  const {
    apiRequest,
    API_URL,
    PUBLIC_SITE_URL,
    GOOGLE_CLIENT_ID,
    EVENT_ID,
    EVENT_CATEGORIES,
    FINANCE_TYPES,
    FINANCE_PAYMENT_METHODS,
    FINANCE_STATUS_LABELS,
    FINANCE_ROLE_LABELS,
    CLASS_GROUPS,
    GROUP_ROLE_OPTIONS,
    GROUP_ROLE_LABELS,
    ROLE_BADGE_STYLES,
    FINANCE_ROLE_OPTIONS,
    FUND_EVENT_STATUS,
    FUND_PAYER_TYPES,
    FUND_PAYMENT_METHODS,
    buildGoogleMapsUrl_,
    formatDisplayDate_,
    formatDisplayDateNoMidnight_,
    formatEventSchedule_,
    formatFinanceAmount_,
    getCategoryLabel_,
    getGroupLabel_,
    addDays_,
    addMinutes_,
    generateEventId_,
    pad2_,
    parseLocalInputDate_,
    toLocalInput_,
    toLocalInputValue_,
    toDateInputValue_,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    normalizePhoneInputValue_,
    GoogleSigninPanel,
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

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState({});
  const [submitMessage, setSubmitMessage] = useState({});
  const [responsesByOrderId, setResponsesByOrderId] = useState({});
  const [choiceDrafts, setChoiceDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [loginExpanded, setLoginExpanded] = useState(false);

  const normalizeOrderId_ = (value) => String(value || "").trim();

  const parseOrderDate_ = (value) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatOrderDateLabel_ = (value) => {
    return formatDisplayDate_(value) || "-";
  };

  const getOrderCutoffAt_ = (plan) => {
    if (plan && plan.cutoffAt) {
      return parseOrderDate_(plan.cutoffAt);
    }
    const baseDate = parseOrderDate_(plan && plan.date);
    if (!baseDate) {
      return null;
    }
    const cutoff = addDays_(baseDate, -1);
    cutoff.setHours(23, 59, 0, 0);
    return cutoff;
  };

  const isPlanClosed_ = (plan) => {
    if (!plan) {
      return true;
    }
    if (String(plan.status || "").trim().toLowerCase() === "closed") {
      return true;
    }
    const cutoff = getOrderCutoffAt_(plan);
    if (cutoff && new Date() > cutoff) {
      return true;
    }
    return false;
  };

  const loadPlans = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listOrderPlans" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setPlans(result.data && result.data.plans ? result.data.plans : []);
    } catch (err) {
      setError("訂餐資料載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const loadResponsesByStudent = async (studentId) => {
    if (!studentId) {
      setResponsesByOrderId({});
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "listOrderResponsesByStudent",
        studentId: studentId,
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const responses = result.data && result.data.responses ? result.data.responses : [];
      const map = responses.reduce((acc, item) => {
        const key = normalizeOrderId_(item.orderId);
        if (key) {
          acc[key] = item;
        }
        return acc;
      }, {});
      setResponsesByOrderId(map);
    } catch (err) {
      setResponsesByOrderId({});
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (googleLinkedStudent && googleLinkedStudent.id) {
      loadResponsesByStudent(googleLinkedStudent.id);
    }
  }, [googleLinkedStudent]);

  useEffect(() => {
    setChoiceDrafts((prev) => {
      const next = { ...prev };
      plans.forEach((plan) => {
        const planId = normalizeOrderId_(plan.id);
        if (!planId || next[planId]) {
          return;
        }
        const existing = responsesByOrderId[planId];
        next[planId] = existing ? String(existing.choice || "").toUpperCase() : "";
      });
      return next;
    });
    setCommentDrafts((prev) => {
      const next = { ...prev };
      plans.forEach((plan) => {
        const planId = normalizeOrderId_(plan.id);
        if (!planId || next[planId] !== undefined) {
          return;
        }
        const existing = responsesByOrderId[planId];
        next[planId] = existing ? String(existing.comment || "") : "";
      });
      return next;
    });
  }, [plans, responsesByOrderId]);

  const handleChoiceChange = (planId, choice) => {
    setChoiceDrafts((prev) => ({ ...prev, [planId]: choice }));
    setSubmitMessage((prev) => ({ ...prev, [planId]: "" }));
  };

  const handleCommentChange = (planId, value) => {
    setCommentDrafts((prev) => ({ ...prev, [planId]: value }));
  };

  const handleSubmitOrder = async (plan) => {
    const planId = normalizeOrderId_(plan.id);
    if (!planId) {
      return;
    }
    if (!googleLinkedStudent || !googleLinkedStudent.id) {
      setSubmitMessage((prev) => ({ ...prev, [planId]: "請先使用 Google 登入。" }));
      return;
    }
    if (isPlanClosed_(plan)) {
      setSubmitMessage((prev) => ({ ...prev, [planId]: "訂餐已截止。" }));
      return;
    }
    const choice = String(choiceDrafts[planId] || "").trim().toUpperCase();
    if (!choice) {
      setSubmitMessage((prev) => ({ ...prev, [planId]: "請先選擇餐點。" }));
      return;
    }
    setSaving((prev) => ({ ...prev, [planId]: true }));
    setSubmitMessage((prev) => ({ ...prev, [planId]: "" }));
    try {
      const { result } = await apiRequest({
        action: "submitOrderResponse",
        data: {
          orderId: planId,
          studentId: googleLinkedStudent.id,
          studentName:
            googleLinkedStudent.preferredName || googleLinkedStudent.nameZh || googleLinkedStudent.name || "",
          studentEmail: googleLinkedStudent.email || "",
          choice: choice,
          comment: String(commentDrafts[planId] || "").trim(),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "送出失敗");
      }
      if (result.data && result.data.response) {
        setResponsesByOrderId((prev) => ({
          ...prev,
          [planId]: result.data.response,
        }));
      }
      setSubmitMessage((prev) => ({ ...prev, [planId]: "已更新訂餐選擇" }));
    } catch (err) {
      setSubmitMessage((prev) => ({ ...prev, [planId]: err.message || "送出失敗" }));
    } finally {
      setSaving((prev) => ({ ...prev, [planId]: false }));
    }
  };

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            NTU EMBA 115B
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">訂餐系統</h1>
          <p className="mt-3 text-sm text-slate-500">週末與特別活動訂餐，前一日 23:59 截止。</p>
        </div>
      </header>
      <div className="mx-auto mt-4 max-w-6xl px-6 sm:px-12">
        <a
          href="/"
          className="btn-chip sm:px-4 sm:text-xs"
        >
          回首頁
        </a>
      </div>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        <section className="mb-6 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_25px_80px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Google 登入</span>
            {googleLinkedStudent && googleLinkedStudent.email ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                {googleLinkedStudent.email}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLoginExpanded((prev) => !prev)}
                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
              >
                {loginExpanded ? "收合" : "登入"}
              </button>
            )}
          </div>
          {!googleLinkedStudent && loginExpanded ? (
            <div className="mt-4">
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後即可選擇訂餐，不需再登入。"
                onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
              />
            </div>
          ) : null}
        </section>

        <section className="card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">本週訂餐</h2>
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

          {!loading && !plans.length && !error ? (
            <p className="mt-6 text-sm text-slate-500">目前沒有開放訂餐的日期。</p>
          ) : null}

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {plans.map((plan) => {
              const planId = normalizeOrderId_(plan.id);
              const cutoff = getOrderCutoffAt_(plan);
              const closed = isPlanClosed_(plan);
              const choice = choiceDrafts[planId] || "";
              const response = responsesByOrderId[planId];
              return (
                <div
                  key={planId}
                  className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{formatOrderDateLabel_(plan.date)}</span>
                    <span>{closed ? "已截止" : "開放中"}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    {plan.title || "午餐訂購"}
                  </h3>
                  <p className="mt-2 text-xs text-slate-400">
                    截止時間：{cutoff ? formatDisplayDate_(cutoff, { withTime: true }) : "前一日 23:59"}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        value: "A",
                        label: plan.optionA || "A 餐",
                        image: plan.optionAImage,
                      },
                      {
                        value: "B",
                        label: plan.optionB || "B 餐",
                        image: plan.optionBImage,
                      },
                      { value: "NONE", label: "不吃", image: "" },
                    ].map((item) => (
                      <button
                        key={`${planId}-${item.value}`}
                        type="button"
                        disabled={closed || !googleLinkedStudent}
                        onClick={() => handleChoiceChange(planId, item.value)}
                        className={`overflow-hidden rounded-2xl border text-left text-xs font-semibold transition ${
                          choice === item.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                        } ${closed || !googleLinkedStudent ? "opacity-60" : ""}`}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.label}
                            className="h-20 w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-20 items-center justify-center bg-slate-100 text-[11px] text-slate-400">
                            無圖片
                          </div>
                        )}
                        <div className="px-3 py-2">
                          <span className="block">{item.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={commentDrafts[planId] || ""}
                    onChange={(event) => handleCommentChange(planId, event.target.value)}
                    placeholder="匿名意見（可選）"
                    rows="2"
                    disabled={closed || !googleLinkedStudent}
                    className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      {response && response.updatedAt
                        ? `已更新：${formatDisplayDate_(response.updatedAt, { withTime: true })}`
                        : "尚未選擇"}
                    </span>
                    <button
                      type="button"
                      disabled={closed || !googleLinkedStudent || saving[planId]}
                      onClick={() => handleSubmitOrder(plan)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving[planId] ? "送出中..." : "更新選擇"}
                    </button>
                  </div>
                  {submitMessage[planId] ? (
                    <p className="mt-3 text-xs font-semibold text-amber-600">
                      {submitMessage[planId]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <a
          href="/"
          className="mt-8 inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
        >
          回首頁
        </a>
      </main>
    </div>
  );
}

export default OrderingPage;
