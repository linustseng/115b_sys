import React, { useEffect, useMemo, useRef, useState } from "react";

function FinancePage({ shared }) {

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

  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [loginExpanded, setLoginExpanded] = useState(false);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [financeCategories, setFinanceCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState(buildFinanceDraft_());
  const [editingId, setEditingId] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [memberGroups, setMemberGroups] = useState([]);
  const [fundEvents, setFundEvents] = useState([]);
  const [fundEventsLoading, setFundEventsLoading] = useState(false);
  const [fundEventsError, setFundEventsError] = useState("");
  const [fundPaymentForm, setFundPaymentForm] = useState(buildFundPaymentDraft_());
  const [fundPayments, setFundPayments] = useState([]);
  const [fundStatusMessage, setFundStatusMessage] = useState("");
  const [financeTab, setFinanceTab] = useState("requests");
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [requestBootstrapLoaded, setRequestBootstrapLoaded] = useState(false);
  const fundEventsCacheKey = "fund_events_cache_v1";
  const fundEventsCacheTtlMs = 10 * 60 * 1000;
  const fundPaymentErrorActive = financeTab === "fund" && !!error;
  const fundPaymentErrorFlags = {
    eventId: fundPaymentErrorActive && error.includes("班費事件"),
    amount: fundPaymentErrorActive && error.includes("金額"),
    transferLast5: fundPaymentErrorActive && error.includes("末 5 碼"),
  };

  const applicantName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    "";

  const loadRequests = async (email) => {
    if (!email) {
      setRequests([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listFinanceRequests", applicantEmail: email });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setRequests(result.data && result.data.requests ? result.data.requests : []);
    } catch (err) {
      setError(err.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const purchaseOptions = requests
    .filter((item) => String(item.type || "").trim().toLowerCase() === "purchase")
    .map((item) => ({
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      status: String(item.status || "").trim(),
    }))
    .filter((item) => item.id);

  const loadStudents = async () => {
    try {
      const { result } = await apiRequest({ action: "listStudents" });
      if (!result.ok) {
        return;
      }
      setStudents(result.data && result.data.students ? result.data.students : []);
    } catch (err) {
      // Optional list for datalist only.
    }
  };

  const loadFinanceCategories = async () => {
    try {
      const { result } = await apiRequest({ action: "listFinanceCategoryTypes" });
      if (!result.ok) {
        return;
      }
      setFinanceCategories(result.data && result.data.categories ? result.data.categories : []);
    } catch (err) {
      setFinanceCategories([]);
    }
  };

  const resolveMemberGroups_ = (personId, memberships) => {
    if (!personId) {
      return [];
    }
    const normalized = String(personId || "").trim();
    return (memberships || [])
      .filter((item) => String(item.personId || "").trim() === normalized)
      .map((item) => String(item.groupId || "").trim())
      .filter(Boolean);
  };

  const loadMemberGroups = async (personId) => {
    if (!personId) {
      setMemberGroups([]);
      return;
    }
    try {
      const { result } = await apiRequest({ action: "listGroupMemberships" });
      if (!result.ok) {
        return;
      }
      const memberships = result.data && result.data.memberships ? result.data.memberships : [];
      const normalized = String(personId || "").trim();
      const groups = memberships
        .filter((item) => String(item.personId || "").trim() === normalized)
        .map((item) => String(item.groupId || "").trim())
        .filter(Boolean);
      setMemberGroups(groups);
    } catch (err) {
      setMemberGroups([]);
    }
  };

  const loadFinanceBootstrap = async (email) => {
    if (!email) {
      return false;
    }
    try {
      const { result } = await apiRequest({ action: "listFinanceBootstrap" });
      if (!result.ok) {
        return false;
      }
      const data = result.data || {};
      setStudents(data.students || []);
      setFinanceCategories(data.categories || []);
      if (data.fundEvents) {
        setFundEvents(data.fundEvents || []);
        try {
          localStorage.setItem(
            fundEventsCacheKey,
            JSON.stringify({ ts: Date.now(), events: data.fundEvents || [] })
          );
        } catch (error) {
          // Ignore cache write errors.
        }
      }
      const memberships = data.groupMemberships || [];
      setMemberGroups(resolveMemberGroups_(googleLinkedStudent && googleLinkedStudent.id, memberships));
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    if (googleLinkedStudent && googleLinkedStudent.email) {
      setRequestsLoaded(false);
      setRequestBootstrapLoaded(false);
      loadMemberGroups(googleLinkedStudent.id);
      setFundPaymentForm((prev) => ({
        ...prev,
        payerId: String(googleLinkedStudent.id || "").trim(),
        payerName: applicantName,
        payerEmail: googleLinkedStudent.email || "",
      }));
    } else {
      setRequests([]);
      setStudents([]);
      setFinanceCategories([]);
      setMemberGroups([]);
      setRequestsLoaded(false);
      setRequestBootstrapLoaded(false);
    }
  }, [googleLinkedStudent]);

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    if (financeTab !== "requests") {
      return;
    }
    if (!requestsLoaded) {
      loadRequests(googleLinkedStudent.email);
      setRequestsLoaded(true);
    }
    if (!requestBootstrapLoaded) {
      loadFinanceBootstrap(googleLinkedStudent.email).then((ok) => {
        if (!ok) {
          loadStudents();
          loadFinanceCategories();
        }
        setRequestBootstrapLoaded(true);
      });
    }
  }, [financeTab, googleLinkedStudent, requestsLoaded, requestBootstrapLoaded]);

  useEffect(() => {
    if (!form.categoryType && financeCategories.length) {
      setForm((prev) => ({ ...prev, categoryType: financeCategories[0].id || "" }));
    }
  }, [financeCategories, form.categoryType]);

  useEffect(() => {
    if (!editingId && !form.applicantName && applicantName) {
      setForm((prev) => ({ ...prev, applicantName: applicantName }));
    }
  }, [applicantName, editingId, form.applicantName]);

  useEffect(() => {
    if (editingId) {
      return;
    }
    if (googleLinkedStudent && googleLinkedStudent.id) {
      setForm((prev) => ({
        ...prev,
        applicantId: prev.applicantId || String(googleLinkedStudent.id || "").trim(),
      }));
    }
  }, [editingId, googleLinkedStudent]);

  const loadFundEvents = async () => {
    setFundEventsLoading(true);
    setFundEventsError("");
    try {
      const { result } = await apiRequest({ action: "listFundEvents" });
      if (result.ok) {
        const events = result.data && result.data.events ? result.data.events : [];
        setFundEvents(events);
        try {
          localStorage.setItem(
            fundEventsCacheKey,
            JSON.stringify({ ts: Date.now(), events: events })
          );
        } catch (error) {
          // Ignore cache write errors.
        }
      } else {
        setFundEventsError(result.error || "班費事件載入失敗");
      }
    } catch (err) {
      setFundEventsError("班費事件載入失敗");
      setFundEvents((prev) => (prev.length ? prev : []));
    } finally {
      setFundEventsLoading(false);
    }
  };

  const loadFundPayments = async (eventId) => {
    if (!eventId) {
      setFundPayments([]);
      return;
    }
    try {
      const { result } = await apiRequest({ action: "listFundPayments", eventId: eventId });
      if (result.ok) {
        setFundPayments(result.data && result.data.payments ? result.data.payments : []);
      }
    } catch (err) {
      setFundPayments([]);
    }
  };

  useEffect(() => {
    if (financeTab !== "fund") {
      return;
    }
    try {
      const cached = localStorage.getItem(fundEventsCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.events) && Date.now() - parsed.ts < fundEventsCacheTtlMs) {
          setFundEvents(parsed.events);
        }
      }
    } catch (error) {
      // Ignore cache read errors.
    }
    loadFundEvents();
  }, [financeTab]);

  useEffect(() => {
    if (financeTab !== "fund") {
      return;
    }
    if (fundPaymentForm.eventId) {
      loadFundPayments(fundPaymentForm.eventId);
    }
  }, [financeTab, fundPaymentForm.eventId]);

  useEffect(() => {
    if (!fundPaymentForm.eventId) {
      return;
    }
    const eventItem = fundEvents.find((item) => item.id === fundPaymentForm.eventId);
    if (!eventItem) {
      return;
    }
    const isSponsor = memberGroups.includes("J");
    const payerType = isSponsor ? "sponsor" : "general";
    const amount =
      payerType === "sponsor" ? eventItem.amountSponsor : eventItem.amountGeneral;
    setFundPaymentForm((prev) => ({
      ...prev,
      payerType: payerType,
      amount: amount || "",
    }));
  }, [fundPaymentForm.eventId, fundEvents, memberGroups]);

  useEffect(() => {
    if (!memberGroups.length) {
      return;
    }
    if (!form.applicantDepartment) {
      setForm((prev) => ({ ...prev, applicantDepartment: memberGroups[0] }));
    }
  }, [memberGroups, form.applicantDepartment]);

  useEffect(() => {
    if (form.type === "pettycash" && form.paymentMethod !== "pettycash") {
      setForm((prev) => ({ ...prev, paymentMethod: "pettycash" }));
    }
    if (form.type === "purchase" && !form.paymentMethod) {
      setForm((prev) => ({ ...prev, paymentMethod: "reimbursement" }));
    }
  }, [form.type, form.paymentMethod]);

  const resetForm = () => {
    setForm(buildFinanceDraft_());
    setEditingId("");
    setAttachmentUrl("");
  };

  const handleFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFundPaymentChange = (key, value) => {
    setFundPaymentForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddAttachment = () => {
    const trimmed = String(attachmentUrl || "").trim();
    if (!trimmed) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).concat([{ name: trimmed, url: trimmed }]),
    }));
    setAttachmentUrl("");
  };

  const handleRemoveAttachment = (index) => {
    setForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, idx) => idx !== index),
    }));
  };

  const resolveApplicantFromInput_ = (inputValue) => {
    const raw = String(inputValue || "").trim();
    if (!raw || !students.length) {
      return { id: "", name: "" };
    }
    const normalized = raw.toLowerCase();
    const studentOptions = students.map((student) => {
      const id = String(student.id || "").trim();
      const name = String(
        student.preferredName || student.nameZh || student.nameEn || student.name || ""
      ).trim();
      const label = [id, name].filter(Boolean).join(" ").trim();
      return { id, name, label, normalizedLabel: label.toLowerCase() };
    });
    const exact = studentOptions.find((item) => item.normalizedLabel === normalized);
    if (exact && exact.id) {
      return { id: exact.id, name: exact.name };
    }
    const idMatch = studentOptions.find((item) => item.id && item.id.toLowerCase() === normalized);
    if (idMatch) {
      return { id: idMatch.id, name: idMatch.name };
    }
    const nameMatches = studentOptions.filter((item) => item.name.toLowerCase() === normalized);
    if (nameMatches.length === 1) {
      return { id: nameMatches[0].id, name: nameMatches[0].name };
    }
    return { id: "", name: "" };
  };

  const handleApplicantInputChange = (value) => {
    const resolved = resolveApplicantFromInput_(value);
    setForm((prev) => ({
      ...prev,
      applicantName: value,
      applicantId: resolved.id || "",
    }));
  };

  const handleEditRequest = (item) => {
    if (!item) {
      return;
    }
    setEditingId(item.id || "");
    setForm({
      id: item.id || "",
      type: item.type || "purchase",
      title: item.title || "",
      description: item.description || "",
      categoryType: item.categoryType || "general",
      amountEstimated: item.amountEstimated || "",
      amountActual: item.amountActual || "",
      currency: item.currency || "TWD",
      paymentMethod: item.paymentMethod || "reimbursement",
      vendorName: item.vendorName || "",
      payeeName: item.payeeName || "",
      payeeBank: item.payeeBank || "",
      payeeAccount: item.payeeAccount || "",
      relatedPurchaseId: item.relatedPurchaseId || "",
      noPurchaseReason: item.noPurchaseReason || "",
      expectedClearDate: item.expectedClearDate || "",
      attachments: parseFinanceAttachments_(item.attachments),
      status: item.status || "draft",
      applicantId: item.applicantId || "",
      applicantName: item.applicantName || "",
      applicantDepartment: item.applicantDepartment || "",
    });
    setStatusMessage("");
    setError("");
  };

  const handleSaveDraft = async () => {
    setStatusMessage("");
    setError("");
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setError("請先登入 Google");
      return;
    }
    const resolvedApplicant = resolveApplicantFromInput_(form.applicantName);
    const draftApplicantId =
      form.applicantId ||
      resolvedApplicant.id ||
      String((googleLinkedStudent && googleLinkedStudent.id) || "").trim();
    const payload = {
      ...form,
      attachments: JSON.stringify(form.attachments || []),
      status: "draft",
      applicantId: draftApplicantId || "",
      applicantName: String(
        resolvedApplicant.name || form.applicantName || applicantName || ""
      ).trim(),
      applicantEmail: googleLinkedStudent.email || "",
    };
    setLoading(true);
    try {
      const response = editingId
        ? await apiRequest({
            action: "updateFinanceRequest",
            id: editingId,
            data: payload,
            requestAction: "update",
            actorRole: "applicant",
            actorName: applicantName,
          })
        : await apiRequest({ action: "createFinanceRequest", data: payload });
      if (!response.result.ok) {
        throw new Error(response.result.error || "儲存失敗");
      }
      setStatusMessage("已儲存草稿");
      resetForm();
      await loadRequests(googleLinkedStudent.email);
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setError("");
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setError("請先登入 Google");
      return;
    }
    if (!form.type) {
      setError("請選擇申請類型");
      return;
    }
    const resolvedApplicant = resolveApplicantFromInput_(form.applicantName);
    const resolvedApplicantId =
      form.applicantId ||
      resolvedApplicant.id ||
      String((googleLinkedStudent && googleLinkedStudent.id) || "").trim();
    const resolvedApplicantName = String(
      resolvedApplicant.name || form.applicantName || applicantName || ""
    ).trim();
    if (!resolvedApplicantId) {
      setError("請選擇請款人學號");
      return;
    }
    if (!resolvedApplicantName) {
      setError("請填寫請款人");
      return;
    }
    if (!form.title) {
      setError("請填寫項目名稱");
      return;
    }
    if (!form.description) {
      setError("請填寫說明/活動內容");
      return;
    }
    if (!form.categoryType) {
      setError("請選擇班務性質");
      return;
    }
    if (!form.applicantDepartment) {
      setError("請選擇申請組別");
      return;
    }
    const isPurchase = form.type === "purchase";
    const isPayment = form.type === "payment";
    const isPettyCash = form.type === "pettycash";
    const amountValue = isPurchase ? form.amountEstimated : form.amountActual;
    if (!amountValue || parseFinanceAmount_(amountValue) <= 0) {
      setError("請填寫金額");
      return;
    }
    if (isPayment && !form.relatedPurchaseId && !form.noPurchaseReason) {
      setError("請填寫對應請購或未經請購原因");
      return;
    }
    const payload = {
      ...form,
      attachments: JSON.stringify(form.attachments || []),
      status: "pending_lead",
      applicantId: resolvedApplicantId,
      applicantName: resolvedApplicantName,
      applicantEmail: googleLinkedStudent.email || "",
    };
    if (isPettyCash) {
      payload.paymentMethod = "pettycash";
    }
    setLoading(true);
    try {
      const response = editingId
        ? await apiRequest({
            action: "updateFinanceRequest",
            id: editingId,
            data: payload,
            requestAction: "submit",
            actorRole: "applicant",
            actorName: applicantName,
          })
        : await apiRequest({ action: "createFinanceRequest", data: payload });
      if (!response.result.ok) {
        throw new Error(response.result.error || "送出失敗");
      }
      setStatusMessage("已送出申請");
      resetForm();
      await loadRequests(googleLinkedStudent.email);
    } catch (err) {
      setError(err.message || "送出失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (item) => {
    if (!item || !item.id) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "updateFinanceRequest",
        id: item.id,
        requestAction: "withdraw",
        actorRole: "applicant",
        actorName: applicantName,
      });
      if (!result.ok) {
        throw new Error(result.error || "撤回失敗");
      }
      await loadRequests(googleLinkedStudent.email);
    } catch (err) {
      setError(err.message || "撤回失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleFundPaymentSubmit = async (event) => {
    event.preventDefault();
    setFundStatusMessage("");
    setError("");
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setError("請先登入 Google");
      return;
    }
    if (!fundPaymentForm.eventId) {
      setError("請先選擇班費事件");
      return;
    }
    if (!fundPaymentForm.amount) {
      setError("請填寫金額");
      return;
    }
    if (fundPaymentForm.method === "transfer" && !String(fundPaymentForm.transferLast5 || "").trim()) {
      setError("請填寫匯款帳號末 5 碼");
      return;
    }
    setLoading(true);
    try {
      const actorId = String(googleLinkedStudent.id || "").trim();
      const payload = {
        ...fundPaymentForm,
        payerId: String(googleLinkedStudent.id || "").trim(),
        payerName: applicantName,
        payerEmail: googleLinkedStudent.email || "",
        actorId: actorId,
      };
      const { result } = await apiRequest({
        action: "upsertFundPayment",
        data: payload,
      });
      if (!result.ok) {
        throw new Error(result.error || "送出失敗");
      }
      setFundStatusMessage("已送出繳費回報，等待財務確認");
      setFundPaymentForm((prev) => ({
        ...buildFundPaymentDraft_(prev.eventId),
        payerId: String(googleLinkedStudent.id || "").trim(),
        payerName: applicantName,
        payerEmail: googleLinkedStudent.email || "",
        payerType: prev.payerType,
        amount: prev.amount,
      }));
      await loadFundPayments(fundPaymentForm.eventId);
    } catch (err) {
      setError(err.message || "送出失敗");
    } finally {
      setLoading(false);
    }
  };

  const isPurchase = form.type === "purchase";
  const isPayment = form.type === "payment";
  const isPettyCash = form.type === "pettycash";
  const myFundPayments = fundPaymentForm.eventId
    ? fundPayments.filter((item) => {
        const payerId = String(item.payerId || "").trim();
        const myId = googleLinkedStudent ? String(googleLinkedStudent.id || "").trim() : "";
        return payerId && myId && payerId === myId;
      })
    : [];

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            NTU EMBA 115B
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            財務管理 · 同學入口
          </h1>
          <p className="mt-3 text-sm text-slate-500">請購、請款與零用金申請。</p>
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
        <section className="card p-6 sm:p-8">
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
                helperText="登入後可提交財務申請。"
                onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
              />
            </div>
          ) : null}
        </section>

        {statusMessage ? (
          <div className="mt-6 alert alert-success">
            {statusMessage}
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 alert alert-error">
            {error}
          </div>
        ) : null}

        <section className="mt-6 card p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 text-sm font-semibold text-slate-600">
            {[
              { id: "requests", label: "請款/請購" },
              { id: "fund", label: "班費繳交" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFinanceTab(item.id)}
                className={`rounded-xl px-4 py-2 ${
                  financeTab === item.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {financeTab === "fund" ? (
          <>
            {fundStatusMessage ? (
              <div className="mt-4 alert alert-success">
                {fundStatusMessage}
              </div>
            ) : null}
            <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <form
                onSubmit={handleFundPaymentSubmit}
                className="card p-6 sm:p-8"
              >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">班費繳交回報</h2>
                <span className="badge">
                  {memberGroups.includes("J") ? "班董" : "一般同學"}
                </span>
              </div>
              <p className="mt-2 required-note">* 為必填欄位</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700">班費事件 *</label>
                    <select
                      value={fundPaymentForm.eventId}
                      onChange={(event) => handleFundPaymentChange("eventId", event.target.value)}
                      required
                      aria-invalid={fundPaymentErrorFlags.eventId ? "true" : "false"}
                      disabled={fundEventsLoading && !fundEvents.length}
                      className={`h-11 rounded-2xl border px-4 text-sm text-slate-900 ${
                        fundPaymentErrorFlags.eventId
                          ? "input-error"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <option value="" disabled>
                        {fundEventsLoading
                          ? "班費事件載入中..."
                          : fundEvents.length
                          ? "請選擇"
                          : fundEventsError
                          ? "載入失敗，請重試"
                          : "目前沒有班費事件"}
                      </option>
                      {fundEvents.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                    {fundEventsLoading ? (
                      <p className="text-xs text-slate-400">載入中，約 3-5 秒。</p>
                    ) : fundEventsError ? (
                      <div className="flex flex-wrap items-center gap-3 help-error">
                        <span>{fundEventsError}</span>
                        <button
                          type="button"
                          onClick={loadFundEvents}
                          className="badge-error"
                        >
                          重新載入
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {fundPaymentForm.eventId && fundPayments.length ? (
                    <div className="sm:col-span-2 alert alert-warning text-xs">
                      已有 {fundPayments.length} 筆繳交回報紀錄。若是補登或更正可再送出；若非必要可先確認右側紀錄。
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">繳費身份</label>
                    <input
                      value={fundPaymentForm.payerType === "sponsor" ? "班董" : "一般同學"}
                      readOnly
                      className="h-11 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-700"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">金額 *</label>
                    <input
                      value={fundPaymentForm.amount}
                      onChange={(event) => handleFundPaymentChange("amount", event.target.value)}
                      required
                      aria-invalid={fundPaymentErrorFlags.amount ? "true" : "false"}
                      className={`h-11 rounded-2xl border px-4 text-sm text-slate-900 ${
                        fundPaymentErrorFlags.amount
                          ? "input-error"
                          : "border-slate-200 bg-white"
                      }`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">付款方式</label>
                    <select
                      value={fundPaymentForm.method}
                      onChange={(event) => handleFundPaymentChange("method", event.target.value)}
                      className="input-sm"
                    >
                      {FUND_PAYMENT_METHODS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {fundPaymentForm.method === "transfer" ? (
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">匯款帳號末 5 碼 *</label>
                      <input
                        value={fundPaymentForm.transferLast5}
                        onChange={(event) =>
                          handleFundPaymentChange("transferLast5", event.target.value)
                        }
                        required={fundPaymentForm.method === "transfer"}
                        aria-invalid={fundPaymentErrorFlags.transferLast5 ? "true" : "false"}
                        className={`h-11 rounded-2xl border px-4 text-sm text-slate-900 ${
                          fundPaymentErrorFlags.transferLast5
                            ? "input-error"
                            : "border-slate-200 bg-white"
                        }`}
                      />
                      {fundPaymentErrorFlags.transferLast5 ? (
                        <p className="help-error">請填寫匯款帳號末 5 碼。</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">匯款日期</label>
                    <input
                      type="date"
                      value={fundPaymentForm.receivedAt}
                      onChange={(event) => handleFundPaymentChange("receivedAt", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700">備註</label>
                    <textarea
                      value={fundPaymentForm.notes}
                      onChange={(event) => handleFundPaymentChange("notes", event.target.value)}
                      rows="2"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                </div>
                {error ? (
                  <div className="mt-4 alert alert-error text-xs">
                    {error}
                  </div>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? "送出中..." : "送出繳費回報"}
                  </button>
                </div>
              </form>

              <section className="card p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">我的繳費回報</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {fundPaymentForm.eventId ? (
                    myFundPayments.length ? (
                      myFundPayments.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                        >
                          <p className="font-semibold text-slate-900">
                            {formatFinanceAmount_(item.amount)} ·{" "}
                            {FUND_PAYMENT_METHODS.find((method) => method.value === item.method)
                              ?.label || item.method}
                          </p>
                          <p className="text-xs text-slate-500">
                            匯款: {formatDisplayDateNoMidnight_(item.receivedAt) || "-"} · 入帳:{" "}
                            {formatDisplayDateNoMidnight_(item.accountedAt) || "-"}
                          </p>
                          <span
                            className={`mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              item.accountedAt
                                ? "badge-success"
                                : "badge-warning"
                            }`}
                          >
                            {item.accountedAt ? "已入帳" : "待入帳"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">尚未提交繳費回報。</p>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">請先選擇班費事件。</p>
                  )}
                </div>
              </section>
            </section>
          </>
        ) : null}

        {financeTab === "requests" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <form
              onSubmit={handleSubmit}
              className="card p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">新建申請</h2>
                {editingId ? (
                  <span className="badge">
                    編輯中 {editingId}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 required-note">* 為必填欄位</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    申請類型 <span className="required-mark">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(event) => handleFormChange("type", event.target.value)}
                    className="input-sm"
                  >
                    {FINANCE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    請款人 <span className="required-mark">*</span>
                  </label>
                  <input
                    value={form.applicantName}
                    onChange={(event) => handleApplicantInputChange(event.target.value)}
                    list="finance-students"
                    placeholder="請輸入或選擇學號 + 姓名"
                    className="input-sm"
                  />
                  <datalist id="finance-students">
                    {students.map((student) => {
                      const id = String(student.id || "").trim();
                      const name = String(
                        student.preferredName ||
                          student.nameZh ||
                          student.nameEn ||
                          student.name ||
                          ""
                      ).trim();
                      if (!id && !name) {
                        return null;
                      }
                      const label = [id, name].filter(Boolean).join(" ");
                      return <option key={`${id}-${name}`} value={label} />;
                    })}
                  </datalist>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    申請組別 <span className="required-mark">*</span>
                  </label>
                  <select
                    value={form.applicantDepartment}
                    onChange={(event) => handleFormChange("applicantDepartment", event.target.value)}
                    className="input-sm"
                  >
                    <option value="">請選擇</option>
                    {CLASS_GROUPS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  項目名稱 <span className="required-mark">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(event) => handleFormChange("title", event.target.value)}
                  placeholder="例如壘球比賽"
                  className="input-sm"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  說明/活動內容 <span className="required-mark">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) => handleFormChange("description", event.target.value)}
                  rows="3"
                  placeholder="例如教練費、場地租金等"
                  className="input-base"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  班務性質 <span className="required-mark">*</span>
                </label>
                <select
                  value={form.categoryType}
                  onChange={(event) => handleFormChange("categoryType", event.target.value)}
                  className="input-sm"
                >
                  {!financeCategories.length ? (
                    <option value="">尚未設定</option>
                  ) : (
                    financeCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label || item.id}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  {isPurchase ? "預估金額" : "實際金額"} <span className="required-mark">*</span>
                </label>
                <input
                  value={isPurchase ? form.amountEstimated : form.amountActual}
                  onChange={(event) =>
                    handleFormChange(isPurchase ? "amountEstimated" : "amountActual", event.target.value)
                  }
                  placeholder="NT$"
                  className="input-sm"
                />
              </div>
              {isPayment ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">請款方式</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => handleFormChange("paymentMethod", event.target.value)}
                    className="input-sm"
                  >
                    {FINANCE_PAYMENT_METHODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {isPettyCash ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">預計核銷日期</label>
                  <input
                    type="date"
                    value={form.expectedClearDate}
                    onChange={(event) => handleFormChange("expectedClearDate", event.target.value)}
                    className="input-sm"
                  />
                </div>
              ) : null}
              {isPayment ? (
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">對應請購</label>
                  <input
                    value={form.relatedPurchaseId}
                    onChange={(event) => handleFormChange("relatedPurchaseId", event.target.value)}
                    list="purchase-options"
                    placeholder="請購單號 (可選)"
                    className="input-sm"
                  />
                  <datalist id="purchase-options">
                    {purchaseOptions.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        label={`${item.id} · ${item.title || "未命名"}${
                          item.status ? ` · ${FINANCE_STATUS_LABELS[item.status] || item.status}` : ""
                        }`}
                      />
                    ))}
                  </datalist>
                </div>
              ) : null}
              {isPayment ? (
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">未經請購原因</label>
                  <textarea
                    value={form.noPurchaseReason}
                    onChange={(event) => handleFormChange("noPurchaseReason", event.target.value)}
                    rows="2"
                    placeholder="若未事先請購請填寫原因"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              ) : null}
              {isPayment ? (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">廠商/收款人</label>
                    <input
                      value={form.payeeName}
                      onChange={(event) => handleFormChange("payeeName", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">銀行/帳號</label>
                    <input
                      value={form.payeeAccount}
                      onChange={(event) => handleFormChange("payeeAccount", event.target.value)}
                      placeholder="轉帳帳號"
                      className="input-sm"
                    />
                  </div>
                </>
              ) : null}
              {isPurchase ? (
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">廠商/採購來源</label>
                  <input
                    value={form.vendorName}
                    onChange={(event) => handleFormChange("vendorName", event.target.value)}
                    className="input-sm"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700">附件</label>
                <a
                  href="https://drive.google.com/drive/my-drive"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 btn-chip"
                >
                  上傳到 Google Drive
                </a>
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  placeholder="貼上發票/報價單連結"
                  className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
                >
                  加入
                </button>
              </div>
              <p className="text-xs text-slate-400">
                建議上傳到雲端硬碟後分享連結（任何知道連結的人可檢視），再貼回此處。
              </p>
              {form.attachments && form.attachments.length ? (
                <div className="space-y-2">
                  {form.attachments.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-600"
                    >
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-slate-700 hover:text-slate-900"
                      >
                        {item.name || item.url}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                        className="help-error-strong"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">尚未加入附件。</p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "送出中..." : "送出申請"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveDraft}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
              >
                儲存草稿
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
              >
                清空
              </button>
            </div>
          </form>

            <section className="card p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">我的申請</h2>
              {loading ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  載入中
                </span>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {requests.length ? (
                requests.map((item) => {
                  const statusLabel = FINANCE_STATUS_LABELS[item.status] || item.status || "-";
                  const amount =
                    item.type === "purchase" ? item.amountEstimated : item.amountActual;
                  const canEdit = item.status === "draft" || item.status === "returned";
                  const canWithdraw = String(item.status || "").startsWith("pending");
                  const isEditing = editingId && editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (canEdit) {
                          handleEditRequest(item);
                        }
                      }}
                      className={`rounded-2xl border p-4 text-sm transition ${
                        canEdit ? "cursor-pointer hover:border-slate-300" : ""
                      } ${
                        isEditing
                          ? "border-slate-900 bg-white text-slate-700"
                          : "border-slate-200/70 bg-slate-50/60 text-slate-600"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.title || "未命名"}</p>
                          <p className="text-xs text-slate-500">
                            {FINANCE_TYPES.find((type) => type.value === item.type)?.label || "申請"} ·{" "}
                            {formatFinanceAmount_(amount)} · {statusLabel}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canWithdraw ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleWithdraw(item);
                              }}
                              className="badge-error hover:border-rose-300"
                            >
                              撤回
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">尚無申請紀錄。</p>
              )}
            </div>
          </section>
          </section>
        ) : null}

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



export default FinancePage;
