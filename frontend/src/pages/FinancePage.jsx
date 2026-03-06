import React, { useEffect, useMemo, useRef, useState } from "react";

function FinancePage({ shared }) {

  const {
    apiRequest,
    API_URL,
    API_V2_URL,
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
    loadStoredGoogleIdToken_,
    storeGoogleIdToken_,
    getGoogleIdTokenSilently_,
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
  const financeQueryParams =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const initialFundEventId = financeQueryParams
    ? String(financeQueryParams.get("eventId") || "").trim()
    : "";
  const initialFinanceTab = financeQueryParams
    ? (function () {
        const tab = String(financeQueryParams.get("tab") || "").trim().toLowerCase();
        if (tab === "fund" || tab === "requests") {
          return tab;
        }
        return initialFundEventId ? "fund" : "requests";
      })()
    : "requests";

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
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadAttachmentError, setUploadAttachmentError] = useState("");
  const [memberGroups, setMemberGroups] = useState([]);
  const [fundEvents, setFundEvents] = useState([]);
  const [fundEventsLoading, setFundEventsLoading] = useState(false);
  const [fundEventsError, setFundEventsError] = useState("");
  const [fundPaymentForm, setFundPaymentForm] = useState(() => {
    const draft = buildFundPaymentDraft_(initialFundEventId);
    if (initialFundEventId) {
      draft.eventId = initialFundEventId;
    }
    return draft;
  });
  const [fundPayments, setFundPayments] = useState([]);
  const [fundStatusMessage, setFundStatusMessage] = useState("");
  const [financeTab, setFinanceTab] = useState(initialFinanceTab);
  const [bootstrapLoaded, setBootstrapLoaded] = useState(false);
  const fundPaymentsCacheRef = useRef({});
  const fundEventsCacheKey = "fund_events_cache_v1";
  const fundEventsCacheTtlMs = 10 * 60 * 1000;
  const fundPaymentsCacheTtlMs = 60 * 1000;
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

  const loadApplicantBootstrap = async (email) => {
    if (!email) {
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "listFinanceApplicantBootstrap",
        applicantEmail: email,
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const data = result.data || {};
      setRequests(data.requests || []);
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
      setError(err.message || "載入失敗");
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleLinkedStudent && googleLinkedStudent.email) {
      setBootstrapLoaded(false);
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
      setBootstrapLoaded(false);
    }
  }, [googleLinkedStudent]);

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    if (bootstrapLoaded) {
      return;
    }
    let ignore = false;
    const runBootstrap = async () => {
      const email = googleLinkedStudent.email;
      const ok = await loadApplicantBootstrap(email);
      if (!ok) {
        await Promise.allSettled([loadRequests(email), loadFinanceBootstrap(email)]);
      }
      if (!ignore) {
        setBootstrapLoaded(true);
      }
    };
    runBootstrap();
    return () => {
      ignore = true;
    };
  }, [googleLinkedStudent, bootstrapLoaded]);

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
    const normalizedEventId = String(eventId || "").trim();
    const cached = fundPaymentsCacheRef.current[normalizedEventId];
    if (cached && Date.now() - Number(cached.ts || 0) < fundPaymentsCacheTtlMs) {
      setFundPayments(Array.isArray(cached.payments) ? cached.payments : []);
      return;
    }
    try {
      const { result } = await apiRequest({ action: "listFundPayments", eventId: normalizedEventId });
      if (result.ok) {
        const payments = result.data && result.data.payments ? result.data.payments : [];
        setFundPayments(payments);
        fundPaymentsCacheRef.current[normalizedEventId] = {
          ts: Date.now(),
          payments: payments,
        };
      }
    } catch (err) {
      setFundPayments([]);
    }
  };

  useEffect(() => {
    if (financeTab !== "fund") {
      return;
    }
    let hasFreshCache = false;
    try {
      const cached = localStorage.getItem(fundEventsCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.events) && Date.now() - parsed.ts < fundEventsCacheTtlMs) {
          setFundEvents(parsed.events);
          hasFreshCache = true;
        }
      }
    } catch (error) {
      // Ignore cache read errors.
    }
    if (!hasFreshCache || !fundEvents.length) {
      loadFundEvents();
    }
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

  const handleUploadAttachment = async (file) => {
    if (!file) {
      return;
    }
    if (!API_V2_URL) {
      setUploadAttachmentError("目前尚未設定 API v2，上傳功能未啟用");
      return;
    }
    let idToken = loadStoredGoogleIdToken_();
    if (!idToken) {
      try {
        idToken = await getGoogleIdTokenSilently_();
        if (idToken) {
          storeGoogleIdToken_(idToken);
        }
      } catch (error) {
        // Silent refresh may not be available.
      }
    }
    if (!idToken) {
      setUploadAttachmentError("請先完成 Google 登入（或重新整理後再試一次）");
      return;
    }

    setUploadingAttachment(true);
    setUploadAttachmentError("");
    try {
      const base = API_V2_URL.endsWith("/") ? API_V2_URL.slice(0, -1) : API_V2_URL;
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${base}/v1/finance/attachments/upload`, {
        method: "POST",
        headers: {
          "x-id-token": idToken,
        },
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || `上傳失敗 (HTTP ${response.status})`);
      }
      const data = payload.data || {};
      const url = String(data.url || "").trim();
      const name = String(data.name || file.name || url).trim();
      if (!url) {
        throw new Error("上傳成功但缺少連結");
      }
      setForm((prev) => ({
        ...prev,
        attachments: (prev.attachments || []).concat([{ name, url }]),
      }));
    } catch (error) {
      setUploadAttachmentError(String(error && error.message ? error.message : "上傳失敗"));
    } finally {
      setUploadingAttachment(false);
    }
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
    if (isPayment && !String(form.payeeName || "").trim()) {
      setError("請填寫廠商/收款人");
      return;
    }
    if (isPayment && !String(form.payeeAccount || "").trim()) {
      setError("請填寫匯款帳號");
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
      delete fundPaymentsCacheRef.current[String(fundPaymentForm.eventId || "").trim()];
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

  const CASE_STEPS = [
    { id: "pending_lead", label: "組長" },
    { id: "pending_committee", label: "班代" },
    { id: "pending_accounting", label: "會計" },
    { id: "pending_cashier", label: "出納" },
    { id: "closed", label: "完成" },
  ];

  const getCaseStepState_ = (status, stepId) => {
    const current = String(status || "").trim();
    if (!current) {
      return "todo";
    }
    if (current === "returned") {
      return stepId === "pending_lead" ? "active" : "todo";
    }
    if (current === "withdrawn") {
      return "todo";
    }
    const order = CASE_STEPS.map((item) => item.id);
    const currentIndex = order.indexOf(current);
    const stepIndex = order.indexOf(stepId);
    if (current === "closed") {
      return "done";
    }
    if (currentIndex === -1 || stepIndex === -1) {
      return "todo";
    }
    if (stepIndex < currentIndex) {
      return "done";
    }
    if (stepIndex === currentIndex) {
      return "active";
    }
    return "todo";
  };

  const requestScenarioCounts = {
    draft: requests.filter((item) => String(item.status || "").trim() === "draft").length,
    pending: requests.filter((item) => String(item.status || "").trim().startsWith("pending")).length,
    returned: requests.filter((item) => String(item.status || "").trim() === "returned").length,
    closed: requests.filter((item) => String(item.status || "").trim() === "closed").length,
  };

  const parseRequestCreatedAtMs_ = (item) => {
    if (!item) {
      return 0;
    }
    const raw =
      item.createdAt ||
      item.created_at ||
      item.created ||
      item.submittedAt ||
      item.submitted_at ||
      item.updatedAt ||
      item.updated_at ||
      "";
    if (!raw) {
      return 0;
    }
    if (typeof raw === "number") {
      // Accept both seconds and ms.
      return raw < 10_000_000_000 ? raw * 1000 : raw;
    }
    const parsed = Date.parse(String(raw));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const myLatestRequest = useMemo(() => {
    if (!requests.length) {
      return null;
    }
    const isActiveStatus_ = (status) => {
      const normalized = String(status || "").trim();
      if (!normalized) {
        return false;
      }
      if (normalized === "closed") {
        return false;
      }
      if (normalized === "withdrawn") {
        return false;
      }
      return true;
    };

    const active = requests.filter((item) => isActiveStatus_(item.status));
    const pool = active.length ? active : requests;
    const sorted = pool
      .slice()
      .sort((a, b) => parseRequestCreatedAtMs_(b) - parseRequestCreatedAtMs_(a));
    return sorted[0] || null;
  }, [requests]);

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
            財務管理 · 同學版
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
          <>
          <section className="mt-6 card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">情境導向入口</h2>
            <p className="mt-2 text-xs text-slate-500">
              挑一個最符合你現在情境的入口，我會把表單先切到正確的類型。
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm((prev) => ({ ...buildFinanceDraft_(), applicantName: prev.applicantName || applicantName, type: "purchase" }));
                    const el = document.getElementById("finance-request-form");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
                >
                  <p className="text-xs font-semibold text-slate-500">我還沒花錢，先申請核准</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">建立請購案</p>
                  <p className="mt-2 text-xs text-slate-500">先卡控預算與用途，核准後再支出最順。</p>
                  <p className="mt-3 text-xs font-semibold text-slate-700">
                    開始請購 <span className="ml-1 transition group-hover:translate-x-1 inline-block">→</span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm((prev) => ({ ...buildFinanceDraft_(), applicantName: prev.applicantName || applicantName, type: "payment" }));
                    const el = document.getElementById("finance-request-form");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left hover:border-amber-300"
                >
                  <p className="text-xs font-semibold text-amber-700">我已經花錢，要報帳</p>
                  <p className="mt-1 text-base font-semibold text-amber-900">建立請款案</p>
                  <p className="mt-2 text-xs text-amber-800/90">上傳發票/收據，填寫收款資訊與金額。</p>
                  <p className="mt-3 text-xs font-semibold text-amber-800">
                    開始請款 <span className="ml-1 transition group-hover:translate-x-1 inline-block">→</span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm((prev) => ({
                      ...buildFinanceDraft_(),
                      applicantName: prev.applicantName || applicantName,
                      type: "pettycash",
                      paymentMethod: "pettycash",
                    }));
                    const el = document.getElementById("finance-request-form");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left hover:border-emerald-300"
                >
                  <p className="text-xs font-semibold text-emerald-700">我要先領預支款</p>
                  <p className="mt-1 text-base font-semibold text-emerald-900">零用金申請</p>
                  <p className="mt-2 text-xs text-emerald-800/90">先支領、後核銷；適合臨時支出情境。</p>
                  <p className="mt-3 text-xs font-semibold text-emerald-800">
                    申請零用金 <span className="ml-1 transition group-hover:translate-x-1 inline-block">→</span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("finance-my-requests");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-slate-300"
                >
                  <p className="text-xs font-semibold text-slate-600">我有舊案件要補件/續辦</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">進入我的案件</p>
                  <p className="mt-2 text-xs text-slate-500">查看目前流程狀態，必要時補件或撤回。</p>
                  <p className="mt-3 text-xs font-semibold text-slate-700">
                    看我的案件 <span className="ml-1 transition group-hover:translate-x-1 inline-block">→</span>
                  </p>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">我的案件</h3>
                  <span className="text-xs font-semibold text-slate-500">最新一筆</span>
                </div>

                {myLatestRequest ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {myLatestRequest.title || "未命名"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {FINANCE_TYPES.find((type) => type.value === myLatestRequest.type)?.label ||
                            "申請"}
                          {" · "}
                          {formatFinanceAmount_(
                            myLatestRequest.type === "purchase"
                              ? myLatestRequest.amountEstimated
                              : myLatestRequest.amountActual
                          )}
                          {" · "}
                          {FINANCE_STATUS_LABELS[myLatestRequest.status] || myLatestRequest.status || "-"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                          String(myLatestRequest.status || "") === "returned"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : String(myLatestRequest.status || "").startsWith("pending")
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : String(myLatestRequest.status || "") === "draft"
                            ? "border-slate-200 bg-white text-slate-600"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {FINANCE_STATUS_LABELS[myLatestRequest.status] || myLatestRequest.status || "-"}
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold text-slate-500">Case 時間線</p>
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {CASE_STEPS.map((step) => {
                          const stepState = getCaseStepState_(myLatestRequest.status, step.id);
                          const badgeClass =
                            stepState === "done"
                              ? "bg-emerald-500"
                              : stepState === "active"
                              ? "bg-amber-500"
                              : "bg-slate-300";
                          return (
                            <div key={`latest-${step.id}`} className="text-center">
                              <span className={`mx-auto block h-2.5 w-2.5 rounded-full ${badgeClass}`} />
                              <p className="mt-1 text-[10px] text-slate-500">{step.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {String(myLatestRequest.status || "") === "draft" ||
                      String(myLatestRequest.status || "") === "returned" ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleEditRequest(myLatestRequest);
                            const el = document.getElementById("finance-request-form");
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="btn-primary"
                        >
                          {String(myLatestRequest.status || "") === "returned"
                            ? "補件並重送"
                            : "繼續填寫並送出"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("finance-my-requests");
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
                        >
                          查看進度
                        </button>
                      )}
                      {String(myLatestRequest.status || "").startsWith("pending") ? (
                        <span className="text-xs font-semibold text-slate-500">
                          需要撤回請到下方「我的申請」。
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    你目前還沒有案件。可以從左側情境入口開始建立。
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">草稿待送件</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{requestScenarioCounts.draft}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">流程中</p>
                    <p className="mt-1 text-xl font-semibold text-amber-900">{requestScenarioCounts.pending}</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs text-rose-700">退回補件</p>
                    <p className="mt-1 text-xl font-semibold text-rose-900">{requestScenarioCounts.returned}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">已結案</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-900">{requestScenarioCounts.closed}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                  小提醒：如果你要「補件」或「修改草稿」，請到下方「我的申請」點選該案件。
                </div>
              </div>
            </div>
          </section>
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <form
              id="finance-request-form"
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
                    <label className="text-sm font-medium text-slate-700">
                      廠商/收款人 <span className="required-mark">*</span>
                    </label>
                    <input
                      value={form.payeeName}
                      onChange={(event) => handleFormChange("payeeName", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">銀行</label>
                    <input
                      value={form.payeeBank}
                      onChange={(event) => handleFormChange("payeeBank", event.target.value)}
                      placeholder="銀行名稱（可選）"
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700">
                      帳號 <span className="required-mark">*</span>
                    </label>
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
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className={`inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border px-4 text-sm font-semibold shadow-sm transition ${
                    uploadingAttachment
                      ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingAttachment}
                    accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    onChange={(event) => {
                      const f = event.target.files && event.target.files[0];
                      event.target.value = "";
                      handleUploadAttachment(f);
                    }}
                  />
                  {uploadingAttachment ? "上傳中..." : "上傳附件"}
                </label>

                <div className="flex flex-1 flex-wrap gap-3">
                  <input
                    value={attachmentUrl}
                    onChange={(event) => setAttachmentUrl(event.target.value)}
                    placeholder="（備援）貼上 Drive 連結"
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
              </div>

              {uploadAttachmentError ? (
                <div className="alert alert-error text-xs">
                  {uploadAttachmentError}
                </div>
              ) : null}

              <p className="text-xs text-slate-400">
                支援 pdf/jpg/png/heic/xlsx/docx/pptx；單檔上限 25MB。上傳後會自動產生 Drive 連結並加入附件。
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

            <section id="finance-my-requests" className="card p-6 sm:p-8">
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
                  const status = String(item.status || "").trim();
                  const statusTone = status === "returned"
                    ? { border: "border-rose-200", bg: "bg-rose-50/60", text: "text-rose-800" }
                    : status.startsWith("pending")
                    ? { border: "border-amber-200", bg: "bg-amber-50/60", text: "text-amber-900" }
                    : status === "draft"
                    ? { border: "border-slate-200", bg: "bg-white", text: "text-slate-700" }
                    : status === "closed"
                    ? { border: "border-emerald-200", bg: "bg-emerald-50/40", text: "text-emerald-900" }
                    : { border: "border-slate-200/70", bg: "bg-slate-50/60", text: "text-slate-700" };

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
                          : `${statusTone.border} ${statusTone.bg} ${statusTone.text}`
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
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-slate-500">Case 時間線</p>
                        <div className="mt-2 grid grid-cols-5 gap-2">
                          {CASE_STEPS.map((step) => {
                            const stepState = getCaseStepState_(item.status, step.id);
                            const badgeClass =
                              stepState === "done"
                                ? "bg-emerald-500"
                                : stepState === "active"
                                ? "bg-amber-500"
                                : "bg-slate-300";
                            return (
                              <div key={`${item.id}-${step.id}`} className="text-center">
                                <span className={`mx-auto block h-2.5 w-2.5 rounded-full ${badgeClass}`} />
                                <p className="mt-1 text-[10px] text-slate-500">{step.label}</p>
                              </div>
                            );
                          })}
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
          </>
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
