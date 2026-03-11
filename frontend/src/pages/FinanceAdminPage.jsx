import React, { useEffect, useMemo, useRef, useState } from "react";
import { TW_BANK_CODES, normalizeTwBankName } from "../data/twBankCodes";

function FinanceAdminPage({ shared }) {
  const {
    apiRequest,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    formatDisplayDate_,
    formatDisplayDateNoMidnight_,
    formatFinanceAmount_,
    parseFinanceAmount_,
    parseFinanceAttachments_,
    buildFundEventDraft_,
    buildFundPaymentDraft_,
    buildFinanceDraft_,
    confirmDelete_,
    isFinanceRequestRelevantToRole_,
    normalizeGroupId_,
    FINANCE_TYPES,
    FINANCE_PAYMENT_METHODS,
    FINANCE_STATUS_LABELS,
    FINANCE_ROLE_LABELS,
    FINANCE_ROLE_OPTIONS,
    FUND_EVENT_STATUS,
    FUND_PAYER_TYPES,
    FUND_PAYMENT_METHODS,
    CLASS_GROUPS,
    normalizeId_,
    parseLocalInputDate_,
    toDateInputValue_,
    adminGuardAccess,
  } = shared;

  const [requests, setRequests] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [role, setRole] = useState("accounting");
  const [actorName, setActorName] = useState("");
  const [actorNote, setActorNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [financeRoles, setFinanceRoles] = useState([]);
  const [financeCategories, setFinanceCategories] = useState([]);
  const [adminProfile, setAdminProfile] = useState(null);
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [adminTab, setAdminTab] = useState("requests");
  const [fundEvents, setFundEvents] = useState([]);
  const [fundPayments, setFundPayments] = useState([]);
  const [fundSummary, setFundSummary] = useState(null);
  const [fundEventForm, setFundEventForm] = useState(buildFundEventDraft_());
  const [fundPaymentForm, setFundPaymentForm] = useState(buildFundPaymentDraft_());
  const [completedView, setCompletedView] = useState("relevant");
  const [showFundEventModal, setShowFundEventModal] = useState(false);
  const [showFundPaymentModal, setShowFundPaymentModal] = useState(false);
  const [fundEventEditingLoadingId, setFundEventEditingLoadingId] = useState("");
  const [fundPaymentEditingLoadingId, setFundPaymentEditingLoadingId] = useState("");
  const [batchAccountModalOpen, setBatchAccountModalOpen] = useState(false);
  const [batchAccountDate, setBatchAccountDate] = useState("");
  const [batchAccountLoading, setBatchAccountLoading] = useState(false);
  const [batchAccountMessage, setBatchAccountMessage] = useState("");
  const batchAccountModalRef = useRef(null);
  const [financeRoleForm, setFinanceRoleForm] = useState({
    id: "",
    personId: "",
    personName: "",
    personEmail: "",
    role: "accounting",
    notes: "",
  });
  const [financeCategoryForm, setFinanceCategoryForm] = useState({
    id: "",
    label: "",
    sortOrder: "",
    notes: "",
  });
  const [students, setStudents] = useState([]);
  const [fundPayerQuery, setFundPayerQuery] = useState("");
  const [fundPayerView, setFundPayerView] = useState("all");
  const [copyStatus, setCopyStatus] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [manualRequestForm, setManualRequestForm] = useState(() => ({
    ...buildFinanceDraft_(),
    applicantId: "",
    applicantName: "",
    status: "pending_lead",
  }));
  const [manualRequestAttachmentInput, setManualRequestAttachmentInput] = useState("");
  const [manualBankPickerQuery, setManualBankPickerQuery] = useState("");
  const [manualBankPickerOpen, setManualBankPickerOpen] = useState(false);
  const fundEventModalRef = useRef(null);
  const fundPaymentModalRef = useRef(null);
  const adminDisplayName =
    (googleLinkedStudent &&
      (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    (googleLinkedStudent && googleLinkedStudent.email) ||
    "";

  const bankByCode = useMemo(() => {
    const map = new Map();
    for (const item of TW_BANK_CODES) {
      map.set(String(item.code || "").trim(), item);
    }
    return map;
  }, []);

  const manualBankSuggestions = useMemo(() => {
    const raw = String(manualBankPickerQuery || "").trim();
    if (!raw) {
      return [];
    }
    const normalized = normalizeTwBankName(raw);
    const codeMatch = raw.match(/^\d{1,3}$/);
    if (codeMatch) {
      return TW_BANK_CODES.filter((item) => item.code.startsWith(raw)).slice(0, 10);
    }
    return TW_BANK_CODES.filter((item) => {
      const name = String(item.name || "").trim();
      if (!name) {
        return false;
      }
      return normalizeTwBankName(name).includes(normalized);
    }).slice(0, 10);
  }, [manualBankPickerQuery]);

  const normalizeAmountForCopy_ = (value) => {
    const parsed = Number(parseFinanceAmount_(value));
    if (!Number.isFinite(parsed)) {
      return "";
    }
    return Number.isInteger(parsed) ? String(parsed) : String(parsed);
  };

  const copyText_ = async (text, label) => {
    const value = String(text == null ? "" : text).trim();
    if (!value || value === "-") {
      setCopyStatus(`無可複製的${label}`);
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyStatus(`已複製${label}`);
    } catch (error) {
      setCopyStatus(`複製${label}失敗`);
    }
    setTimeout(() => setCopyStatus(""), 1800);
  };

  const fundPaymentErrorFlags = {
    eventId: !!error && error.includes("班費事件"),
    payerName: !!error && error.includes("繳費人"),
    amount: !!error && error.includes("金額"),
    transferLast5: !!error && error.includes("末 5 碼"),
  };

  useEffect(() => {
    if (adminDisplayName && !actorName) {
      setActorName(adminDisplayName);
    }
  }, [adminDisplayName, actorName]);

  const loadRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listFinanceRequests" });
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

  const handleSubmitManualRequest = async () => {
    setLoading(true);
    setError("");
    setStatusMessage("");
    if (!manualRequestForm.applicantId) {
      setError("請選擇申請人");
      setLoading(false);
      return;
    }
    if (!manualRequestForm.type) {
      setError("請選擇申請類型");
      setLoading(false);
      return;
    }
    if (!manualRequestForm.title) {
      setError("請填寫項目名稱");
      setLoading(false);
      return;
    }
    const amountValue =
      manualRequestForm.type === "purchase"
        ? manualRequestForm.amountEstimated
        : manualRequestForm.amountActual;
    if (!amountValue || parseFinanceAmount_(amountValue) <= 0) {
      setError("請填寫金額");
      setLoading(false);
      return;
    }
    if (!manualRequestForm.applicantDepartment) {
      setError("請選擇申請組別");
      setLoading(false);
      return;
    }

    const isPayment = manualRequestForm.type === "payment";
    if (isPayment && !manualRequestForm.relatedPurchaseId && !manualRequestForm.noPurchaseReason) {
      setError("請填寫對應請購或未經請購原因");
      setLoading(false);
      return;
    }
    if (isPayment && !String(manualRequestForm.payeeName || "").trim()) {
      setError("請填寫廠商/收款人");
      setLoading(false);
      return;
    }
    if (isPayment && !String(manualRequestForm.payeeBankCode || "").trim()) {
      setError("請選擇銀行代碼");
      setLoading(false);
      return;
    }
    if (isPayment && !String(manualRequestForm.payeeAccount || "").trim()) {
      setError("請填寫匯款帳號");
      setLoading(false);
      return;
    }

    try {
      const { result } = await apiRequest({
        action: "adminCreateFinanceRequest",
        applicantId: manualRequestForm.applicantId,
        manualCreatedByName: adminDisplayName,
        data: {
          ...manualRequestForm,
          attachments: JSON.stringify(manualRequestForm.attachments || []),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "建立失敗");
      }
      setStatusMessage("已代為建立申請");
      setManualRequestForm({
        ...buildFinanceDraft_(),
        applicantId: "",
        applicantName: "",
        status: "pending_lead",
      });
      setManualRequestAttachmentInput("");
      setManualBankPickerQuery("");
      setManualBankPickerOpen(false);
      await loadRequests();
    } catch (err) {
      setError(err.message || "建立失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualAttachment = () => {
    const url = String(manualRequestAttachmentInput || "").trim();
    if (!url) {
      return;
    }
    const existing = Array.isArray(manualRequestForm.attachments)
      ? manualRequestForm.attachments
      : [];
    if (existing.includes(url)) {
      setManualRequestAttachmentInput("");
      return;
    }
    setManualRequestForm({
      ...manualRequestForm,
      attachments: [...existing, url],
    });
    setManualRequestAttachmentInput("");
  };

  const handleRemoveManualAttachment = (url) => {
    const existing = Array.isArray(manualRequestForm.attachments)
      ? manualRequestForm.attachments
      : [];
    setManualRequestForm({
      ...manualRequestForm,
      attachments: existing.filter((item) => item !== url),
    });
  };

  const loadStudents = async () => {
    try {
      const { result } = await apiRequest({ action: "listStudents" });
      if (result.ok) {
        setStudents(result.data && result.data.students ? result.data.students : []);
      }
    } catch (err) {
      setStudents([]);
    }
  };

  const loadFundSummary = async () => {
    try {
      const { result } = await apiRequest({ action: "getFundSummary" });
      if (result.ok) {
        setFundSummary(result.data || null);
      }
    } catch (err) {
      setFundSummary(null);
    }
  };

  const loadFundEvents = async () => {
    try {
      const { result } = await apiRequest({ action: "listFundEvents" });
      if (result.ok) {
        setFundEvents(result.data && result.data.events ? result.data.events : []);
      }
    } catch (err) {
      setFundEvents([]);
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

  const normalizeDateInputValue_ = (value) => {
    if (!value) {
      return "";
    }
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    const parsed = typeof parseLocalInputDate_ === "function" ? parseLocalInputDate_(raw) : null;
    if (parsed && typeof toDateInputValue_ === "function") {
      return toDateInputValue_(parsed);
    }
    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return isoMatch ? isoMatch[1] : raw;
  };

  const getTodayDateInputValue_ = () => {
    if (typeof toDateInputValue_ === "function") {
      return toDateInputValue_(new Date());
    }
    // Fallback: YYYY-MM-DD
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  };

  const loadGroupMemberships = async () => {
    try {
      const { result } = await apiRequest({ action: "listGroupMemberships" });
      if (result.ok) {
        setGroupMemberships(
          result.data && result.data.memberships ? result.data.memberships : []
        );
      }
    } catch (err) {
      setGroupMemberships([]);
    }
  };

  const normalizeFinanceRole_ = (item) => {
    const raw = item && typeof item === "object" ? item : {};
    const personId = String(raw.personId || raw.studentId || "").trim();
    const personName = String(raw.personName || raw.studentName || "").trim();
    const personEmail = String(raw.personEmail || raw.studentEmail || raw.email || "").trim();
    return {
      ...raw,
      personId,
      studentId: personId,
      personName,
      studentName: personName,
      personEmail,
    };
  };

  const loadFinanceRoles = async () => {
    try {
      const { result } = await apiRequest({ action: "listFinanceRoles" });
      if (result.ok) {
        const roles = result.data && result.data.roles ? result.data.roles : [];
        setFinanceRoles((roles || []).map(normalizeFinanceRole_));
      }
    } catch (err) {
      setFinanceRoles([]);
    }
  };

  const loadFinanceCategories = async () => {
    try {
      const { result } = await apiRequest({ action: "listFinanceCategoryTypes" });
      if (result.ok) {
        setFinanceCategories(result.data && result.data.categories ? result.data.categories : []);
      }
    } catch (err) {
      setFinanceCategories([]);
    }
  };

  const loadFinanceAdminBootstrap = async (options = {}) => {
    const includeRequests = options.includeRequests === true;
    try {
      const { result } = await apiRequest({
        action: "listFinanceAdminBootstrap",
        includeRequests: includeRequests,
      });
      if (!result.ok) {
        return false;
      }
      const data = result.data || {};
      if (includeRequests && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
      setStudents(data.students || []);
      setGroupMemberships(data.groupMemberships || []);
      setFinanceRoles((data.roles || []).map(normalizeFinanceRole_));
      setFinanceCategories(data.categories || []);
      setFundEvents(data.fundEvents || []);
      setFundSummary(data.fundSummary || null);
      return true;
    } catch (err) {
      return false;
    }
  };

  const loadActions = async (requestId) => {
    if (!requestId) {
      setActions([]);
      return;
    }
    try {
      const { result } = await apiRequest({ action: "listFinanceActions", requestId: requestId });
      if (result.ok) {
        setActions(result.data && result.data.actions ? result.data.actions : []);
      }
    } catch (err) {
      setActions([]);
    }
  };

  useEffect(() => {
    setInitialLoading(true);
    Promise.allSettled([
      loadRequests(),
      loadGroupMemberships(),
      loadFinanceRoles(),
    ])
      .finally(() => {
        setInitialLoading(false);
        setTimeout(() => {
          loadFinanceCategories();
          loadStudents();
          loadFundEvents();
          loadFundSummary();
        }, 0);
      });
  }, []);

  useEffect(() => {
    const personId = String((googleLinkedStudent && googleLinkedStudent.id) || "").trim();
    if (!personId) {
      setAdminProfile(null);
      return;
    }
    const memberships = groupMemberships.filter((item) => {
      if (personId && String(item.personId || "").trim() === personId) {
        return true;
      }
      return false;
    });
    const financeRoleItems = financeRoles.filter((item) => {
      const rolePersonId = String(item.personId || item.studentId || "").trim();
      if (personId && rolePersonId === personId) {
        return true;
      }
      return false;
    });
    setAdminProfile({
      personId: personId,
      email: "",
      memberships: memberships,
      financeRoles: financeRoleItems,
    });
  }, [googleLinkedStudent, groupMemberships, financeRoles]);

  useEffect(() => {
    loadActions(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (adminTab === "funds") {
      if (!fundEvents.length) {
        loadFundEvents();
      }
      if (!fundSummary) {
        loadFundSummary();
      }
      if (!students.length) {
        loadStudents();
      }
      if (!groupMemberships.length) {
        loadGroupMemberships();
      }
      if (!financeRoles.length) {
        loadFinanceRoles();
      }
    }
    if (adminTab === "roles") {
      if (!groupMemberships.length) {
        loadGroupMemberships();
      }
      if (!financeRoles.length) {
        loadFinanceRoles();
      }
      if (!students.length) {
        loadStudents();
      }
    }
    if (adminTab === "categories" && !financeCategories.length) {
      loadFinanceCategories();
    }
  }, [adminTab]);

  useEffect(() => {
    if (fundPaymentForm.eventId) {
      loadFundPayments(fundPaymentForm.eventId);
    }
  }, [fundPaymentForm.eventId]);

  useEffect(() => {
    if (!showFundEventModal) {
      return;
    }
    setFundEventEditingLoadingId("");
    window.requestAnimationFrame(() => {
      if (fundEventModalRef.current) {
        fundEventModalRef.current.scrollTop = 0;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [showFundEventModal]);

  useEffect(() => {
    if (!showFundPaymentModal) {
      return;
    }
    setFundPaymentEditingLoadingId("");
    window.requestAnimationFrame(() => {
      if (fundPaymentModalRef.current) {
        fundPaymentModalRef.current.scrollTop = 0;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [showFundPaymentModal]);

  const roleStatusMap = {
    lead: "pending_lead",
    rep: "pending_rep",
    committee: "pending_committee",
    accounting: "pending_accounting",
    cashier: "pending_cashier",
  };
  const statusRoleMap = Object.entries(roleStatusMap).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {});

  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

  const memberships = adminProfile ? adminProfile.memberships || [] : [];
  const financeRoleItems = adminProfile ? adminProfile.financeRoles || [] : [];
  const adminPersonId = adminProfile ? String(adminProfile.personId || "").trim() : "";
  const adminEmail = String((googleLinkedStudent && googleLinkedStudent.email) || "")
    .trim()
    .toLowerCase();

  const adminLeadGroups = memberships
    .filter((item) => String(item.roleInGroup || "").trim() === "lead")
    .map((item) => String(item.groupId || "").trim())
    .filter(Boolean);
  const adminDeputyGroups = memberships
    .filter((item) => String(item.roleInGroup || "").trim() === "deputy")
    .map((item) => String(item.groupId || "").trim())
    .filter(Boolean);
  const adminRoles = financeRoleItems
    .map((item) => String(item.role || "").trim())
    .filter(Boolean);

  const normalizedStudents = students.map((item) => {
    const name = item.preferredName || item.nameZh || item.name || item.email || "";
    return {
      id: item.id || "",
      name: name,
      email: String(item.email || "").trim().toLowerCase(),
    };
  });
  const studentNameById = normalizedStudents.reduce((acc, item) => {
    if (item.id && !acc[item.id]) {
      acc[item.id] = item.name;
    }
    return acc;
  }, {});
  const resolveStudentNameById_ = (personId) => {
    const key = String(personId || "").trim();
    return key ? studentNameById[key] || "" : "";
  };

  const financeGroupMembers = groupMemberships.filter(
    (item) => String(item.groupId || "").trim() === "D"
  );
  const financeMemberIdSet = new Set(
    financeGroupMembers.map((item) => String(item.personId || "").trim()).filter(Boolean)
  );
  const financeGroupStudents = students.filter(
    (item) =>
      financeMemberIdSet.has(String(item.id || "").trim())
  );
  const financeGroupFallback = financeGroupMembers.filter((member) => {
    const id = String(member.personId || "").trim();
    return !financeMemberIdSet.has(id);
  });
  const financeGroupOptions = financeGroupStudents
    .map((item) => ({
      id: item.id || "",
      name: item.name || "",
      email: item.email || "",
    }))
    .concat(
      financeGroupFallback.map((item) => ({
        id: item.personId || "",
        name: item.personName || "",
        email: "",
      }))
    );

  const normalizePayerKey_ = (value) => String(value || "").trim().toLowerCase();

  const paymentIdSet = new Set(
    fundPayments.map((item) => String(item.payerId || "").trim()).filter(Boolean)
  );

  const getPayerStatus_ = (payer) => {
    if (!payer) {
      return false;
    }
    const idKey = String(payer.id || "").trim();
    return idKey ? paymentIdSet.has(idKey) : false;
  };

  const sponsorMemberships = groupMemberships.filter(
    (item) => String(item.groupId || "").trim() === "J"
  );
  const sponsorIdSet = new Set(
    sponsorMemberships.map((item) => String(item.personId || "").trim()).filter(Boolean)
  );

  const payerRows = normalizedStudents.map((payer) => {
    const isSponsor = sponsorIdSet.has(String(payer.id || "").trim());
    return {
      ...payer,
      payerType: isSponsor ? "sponsor" : "general",
      paid: getPayerStatus_(payer),
    };
  });

  const extraSponsorRows = sponsorMemberships
    .filter((member) => {
      const id = String(member.personId || "").trim();
      return (
        (id && !normalizedStudents.some((payer) => String(payer.id || "").trim() === id))
      );
    })
    .map((member) => ({
      id: member.personId || "",
      name: member.personName || member.personId || "",
      email: "",
      payerType: "sponsor",
      paid: getPayerStatus_({
        email: "",
        name: member.personName || "",
      }),
    }));

  const allPayerRows = payerRows.concat(extraSponsorRows);

  const filteredPayers = allPayerRows.filter((payer) => {
    if (fundPayerView === "paid" && !payer.paid) {
      return false;
    }
    if (fundPayerView === "unpaid" && payer.paid) {
      return false;
    }
    const needle = normalizePayerKey_(fundPayerQuery);
    if (!needle) {
      return true;
    }
    return (
      normalizePayerKey_(payer.name).includes(needle) ||
      normalizePayerKey_(payer.email).includes(needle)
    );
  });

  const generalPayers = filteredPayers.filter((payer) => payer.payerType === "general");
  const sponsorPayers = filteredPayers.filter((payer) => payer.payerType === "sponsor");
  const generalPaid = generalPayers.filter((payer) => payer.paid).length;
  const sponsorPaid = sponsorPayers.filter((payer) => payer.paid).length;

  const hasAccountingPrivilege = adminRoles.includes("accounting");
  const hasCashierPrivilege = adminRoles.includes("cashier");
  const hasAuditorPrivilege = adminRoles.includes("auditor");
  const hasFinanceGroupPrivilege = financeGroupMembers.length > 0;

  const availableRoles = [
    hasAccountingPrivilege ? "accounting" : null,
    hasCashierPrivilege ? "cashier" : null,
    hasAuditorPrivilege ? "auditor" : null,
  ].filter((value) => value);
  const hasFinanceAccess = Boolean(adminGuardAccess) || availableRoles.length > 0 || hasFinanceGroupPrivilege;

  useEffect(() => {
    if (!availableRoles.length) {
      return;
    }
    if (!availableRoles.includes(role)) {
      setRole(availableRoles[0]);
    }
  }, [availableRoles, role]);

  const isPendingStatus = (status) => String(status || "").trim().startsWith("pending_");
  const viewAllForFinanceGroup = hasFinanceGroupPrivilege && availableRoles.length === 0;
  const filteredRequests = requests.filter((item) => {
    if (viewAllForFinanceGroup) {
      return isPendingStatus(item.status);
    }
    if (role === "auditor") {
      return true;
    }
    const targetStatus = roleStatusMap[role];
    if (item.status !== targetStatus) {
      return false;
    }
    if (role === "lead") {
      const group = String(item.applicantDepartment || "").trim();
      return adminLeadGroups.includes(group) || adminDeputyGroups.includes(group);
    }
    return true;
  });
  const pendingRequests = requests.filter((item) => isPendingStatus(item.status));
  const actionableIdSet = new Set(filteredRequests.map((item) => String(item.id || "").trim()));
  const relevantPendingRequests = pendingRequests.filter((item) =>
    availableRoles.some((availableRole) =>
      isFinanceRequestRelevantToRole_(item, availableRole, { adminLeadGroups, adminDeputyGroups })
    )
  );
  const inProgressItems = relevantPendingRequests
    .filter((item) => !actionableIdSet.has(String(item.id || "").trim()))
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const showAllCompleted = completedView === "all";
  const completedRequests = requests.filter(
    (item) => String(item.status || "").trim() === "closed"
  );
  const relevantCompletedRequests = completedRequests.filter((item) =>
    availableRoles.some((availableRole) =>
      isFinanceRequestRelevantToRole_(item, availableRole, { adminLeadGroups, adminDeputyGroups })
    )
  );
  const completedItems = (viewAllForFinanceGroup || showAllCompleted ? completedRequests : relevantCompletedRequests)
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const selectedRequest = requests.find((item) => item.id === selectedId) || null;
  const selectedPayeeBankName = selectedRequest
    ? String(selectedRequest.payeeBankName || selectedRequest.payeeBank || "").trim()
    : "";
  const selectedPayeeBankCode = selectedRequest
    ? String(selectedRequest.payeeBankCode || "").trim()
    : "";

  const sortedActions = actions
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const latestAction = sortedActions[0] || null;
  const currentStatusKey = selectedRequest ? String(selectedRequest.status || "").trim() : "";
  const currentRoleKey = statusRoleMap[currentStatusKey] || "";
  const currentRoleLabel =
    currentStatusKey === "closed"
      ? "已結案"
      : currentRoleKey
      ? FINANCE_ROLE_LABELS[currentRoleKey] || currentRoleKey
      : FINANCE_STATUS_LABELS[currentStatusKey] || "—";
  const isSelfApplicant_ = (item) => {
    if (!item) {
      return false;
    }
    const applicantId = String(item.applicantId || "").trim();
    const applicantEmail = String(item.applicantEmail || "").trim().toLowerCase();
    if (adminPersonId && applicantId && adminPersonId === applicantId) {
      return true;
    }
    if (adminEmail && applicantEmail && adminEmail === applicantEmail) {
      return true;
    }
    return false;
  };
  const canAct =
    selectedRequest &&
    role !== "auditor" &&
    availableRoles.includes(role) &&
    selectedRequest.status === roleStatusMap[role] &&
    !isSelfApplicant_(selectedRequest) &&
    (role !== "lead" ||
      adminLeadGroups.includes(String(selectedRequest.applicantDepartment || "").trim()) ||
      adminDeputyGroups.includes(String(selectedRequest.applicantDepartment || "").trim()));

  const resolvedActorName = adminDisplayName || actorName || "";

  const handleAction = async (actionType) => {
    if (!selectedRequest || !selectedRequest.id) {
      return;
    }
    setLoading(true);
    setError("");
    setStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: "updateFinanceRequest",
        id: selectedRequest.id,
        requestAction: actionType,
        actorRole: role,
        actorName: resolvedActorName,
        actorId: adminPersonId,
        actorEmail: adminEmail,
        actorNote: actorNote,
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      setStatusMessage("已更新狀態");
      setActorNote("");
      await loadRequests();
      await loadActions(selectedRequest.id);
    } catch (err) {
      setError(err.message || "更新失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleFundEventChange = (key, value) => {
    setFundEventForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFundPaymentChange = (key, value) => {
    setFundPaymentForm((prev) => ({ ...prev, [key]: value }));
  };

  const openFundEventModal_ = () => {
    setShowFundEventModal(true);
  };

  const closeFundEventModal_ = () => {
    setShowFundEventModal(false);
    setFundEventEditingLoadingId("");
  };

  const openFundPaymentModal_ = () => {
    setShowFundPaymentModal(true);
  };

  const closeFundPaymentModal_ = () => {
    setShowFundPaymentModal(false);
    setFundPaymentEditingLoadingId("");
  };

  const handleFinanceRoleChange = (key, value) => {
    setFinanceRoleForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetFinanceRoleForm = () => {
    setFinanceRoleForm({
      id: "",
      personId: "",
      personName: "",
      personEmail: "",
      role: "accounting",
      notes: "",
    });
  };

  const handleFinanceCategoryChange = (key, value) => {
    setFinanceCategoryForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetFinanceCategoryForm = () => {
    setFinanceCategoryForm({
      id: "",
      label: "",
      sortOrder: "",
      notes: "",
    });
  };

  const handleSelectFinanceRoleMember_ = (value) => {
    const needle = String(value || "").trim().toLowerCase();
    if (!needle) {
      return;
    }
    const match =
      financeGroupOptions.find((item) => String(item.id || "").trim().toLowerCase() === needle) ||
      financeGroupOptions.find((item) => String(item.email || "").trim().toLowerCase() === needle) ||
      financeGroupOptions.find((item) => String(item.name || "").trim().toLowerCase() === needle) ||
      null;
    if (!match) {
      return;
    }
    setFinanceRoleForm((prev) => ({
      ...prev,
      personId: match.id || prev.personId,
      personName: match.name || prev.personName,
      personEmail: match.email || prev.personEmail,
    }));
  };

  const handleSaveFinanceRole = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    if (!financeRoleForm.personId) {
      setError("請先選擇同學");
      return;
    }
    setLoading(true);
    try {
      const { result } = await apiRequest({
        action: "upsertFinanceRole",
        data: {
          id: financeRoleForm.id,
          personId: financeRoleForm.personId,
          studentId: financeRoleForm.personId,
          personName: financeRoleForm.personName,
          studentName: financeRoleForm.personName,
          personEmail: financeRoleForm.personEmail,
          role: financeRoleForm.role,
          notes: financeRoleForm.notes,
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      resetFinanceRoleForm();
      await loadFinanceRoles();
      setStatusMessage("已更新財務角色");
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleEditFinanceRole = (item) => {
    if (!item) {
      return;
    }
    setFinanceRoleForm({
      id: item.id || "",
      personId: item.personId || "",
      personName: item.personName || "",
      personEmail: item.personEmail || "",
      role: item.role || "accounting",
      notes: item.notes || "",
    });
  };

  const handleDeleteFinanceRole = async (roleId) => {
    if (!roleId) {
      return;
    }
    const roleLabel =
      financeRoles.find((item) => String(item.id || "").trim() === String(roleId).trim())?.personName ||
      roleId;
    if (!confirmDelete_(`確定要刪除財務角色「${roleLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "deleteFinanceRole", id: roleId });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      if (financeRoleForm.id === roleId) {
        resetFinanceRoleForm();
      }
      await loadFinanceRoles();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFinanceCategory = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    if (!financeCategoryForm.label) {
      setError("請填寫班務性質名稱");
      return;
    }
    setLoading(true);
    try {
      const { result } = await apiRequest({
        action: "upsertFinanceCategoryType",
        data: {
          id: financeCategoryForm.id,
          label: financeCategoryForm.label,
          sortOrder: financeCategoryForm.sortOrder,
          notes: financeCategoryForm.notes,
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      resetFinanceCategoryForm();
      await loadFinanceCategories();
      setStatusMessage("已更新班務性質");
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleEditFinanceCategory = (item) => {
    if (!item) {
      return;
    }
    setFinanceCategoryForm({
      id: item.id || "",
      label: item.label || "",
      sortOrder: item.sortOrder || "",
      notes: item.notes || "",
    });
  };

  const handleDeleteFinanceCategory = async (categoryId) => {
    if (!categoryId) {
      return;
    }
    const categoryLabel =
      financeCategories.find((item) => String(item.id || "").trim() === String(categoryId).trim())
        ?.label || categoryId;
    if (!confirmDelete_(`確定要刪除班務性質「${categoryLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "deleteFinanceCategoryType", id: categoryId });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      if (financeCategoryForm.id === categoryId) {
        resetFinanceCategoryForm();
      }
      await loadFinanceCategories();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setLoading(false);
    }
  };

  const matchDirectoryByName_ = (value) => {
    const needle = String(value || "").trim().toLowerCase();
    if (!needle) {
      return null;
    }
    return (
      students.find((item) => String(item.email || "").trim().toLowerCase() === needle) ||
      students.find((item) => String(item.name || "").trim().toLowerCase() === needle) ||
      null
    );
  };

  const resetFundEventForm = () => {
    setFundEventForm(buildFundEventDraft_());
  };

  const resetFundPaymentForm = (eventId) => {
    setFundPaymentForm(buildFundPaymentDraft_(eventId));
  };

  const startNewFundEvent_ = () => {
    setFundEventEditingLoadingId("");
    resetFundEventForm();
    openFundEventModal_();
  };

  const startNewFundPayment_ = () => {
    setFundPaymentEditingLoadingId("");
    resetFundPaymentForm(fundPaymentForm.eventId);
    openFundPaymentModal_();
  };

  const handleSaveFundEvent = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    if (!fundEventForm.title) {
      setError("請填寫班費事件名稱");
      return;
    }
    setLoading(true);
    try {
      const actorId = googleLinkedStudent ? String(googleLinkedStudent.id || "").trim() : "";
      const { result } = await apiRequest({
        action: "upsertFundEvent",
        data: { ...fundEventForm, actorId },
      });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      resetFundEventForm();
      await loadFundEvents();
      setStatusMessage("已儲存班費事件");
      setShowFundEventModal(false);
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleEditFundEvent = (item) => {
    if (!item) {
      return;
    }
    const editingId = String(item.id || "").trim();
    setFundEventEditingLoadingId(editingId);
    try {
      setFundEventForm({
        id: item.id || "",
        title: item.title || "",
        description: item.description || "",
        dueDate: item.dueDate || "",
        amountGeneral: item.amountGeneral || "50000",
        amountSponsor: item.amountSponsor || "200000",
        expectedGeneralCount: item.expectedGeneralCount || "",
        expectedSponsorCount: item.expectedSponsorCount || "",
        status: item.status || "collecting",
        notes: item.notes || "",
      });
      openFundEventModal_();
      window.setTimeout(() => {
        setFundEventEditingLoadingId("");
      }, 150);
    } catch (err) {
      setFundEventEditingLoadingId("");
      setError(err && err.message ? err.message : "班費事件資料載入失敗");
    }
  };

  const handleDeleteFundEvent = async (eventId) => {
    if (!eventId) {
      return;
    }
    const eventLabel =
      fundEvents.find((item) => String(item.id || "").trim() === String(eventId).trim())?.title ||
      eventId;
    if (!confirmDelete_(`確定要刪除班費事件「${eventLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "deleteFundEvent", id: eventId });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      if (fundPaymentForm.eventId === eventId) {
        resetFundPaymentForm("");
      }
      await loadFundEvents();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFundPayment = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    if (!fundPaymentForm.eventId) {
      setError("請選擇班費事件");
      return;
    }
    if (!fundPaymentForm.payerName) {
      setError("請填寫繳費人");
      return;
    }
    if (!fundPaymentForm.amount) {
      setError("請填寫金額");
      return;
    }
    if (fundPaymentForm.method === "transfer" && !fundPaymentForm.transferLast5) {
      setError("請填寫匯款帳號末 5 碼");
      return;
    }
    setLoading(true);
    try {
      const actorId = googleLinkedStudent ? String(googleLinkedStudent.id || "").trim() : "";
      const resolvedMatch =
        fundPaymentForm.payerId
          ? null
          : matchDirectoryByName_(fundPaymentForm.payerEmail || fundPaymentForm.payerName);
      const resolvedPayerId = fundPaymentForm.payerId || (resolvedMatch && resolvedMatch.id) || "";
      const { result } = await apiRequest({
        action: "upsertFundPayment",
        data: { ...fundPaymentForm, payerId: resolvedPayerId, actorId },
      });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      resetFundPaymentForm(fundPaymentForm.eventId);
      await loadFundPayments(fundPaymentForm.eventId);
      await loadFundSummary();
      setStatusMessage("已儲存收款紀錄");
      setShowFundPaymentModal(false);
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleEditFundPayment = (item) => {
    if (!item) {
      return;
    }
    const editingId = String(item.id || "").trim();
    setFundPaymentEditingLoadingId(editingId);
    try {
      setFundPaymentForm({
        id: item.id || "",
        eventId: item.eventId || fundPaymentForm.eventId || "",
        payerId: item.payerId || "",
        payerName: item.payerName || "",
        payerEmail: item.payerEmail || "",
        payerType: item.payerType || "general",
        amount: item.amount || "",
        method: item.method || "transfer",
        transferLast5: item.transferLast5 || "",
        receivedAt: normalizeDateInputValue_(item.receivedAt),
        accountedAt: normalizeDateInputValue_(item.accountedAt),
        confirmedAt: normalizeDateInputValue_(item.confirmedAt),
        notes: item.notes || "",
      });
      openFundPaymentModal_();
      window.setTimeout(() => {
        setFundPaymentEditingLoadingId("");
      }, 150);
    } catch (err) {
      setFundPaymentEditingLoadingId("");
      setError(err && err.message ? err.message : "收款資料載入失敗");
    }
  };

  const handleDeleteFundPayment = async (paymentId) => {
    if (!paymentId) {
      return;
    }
    const payment = fundPayments.find((item) => String(item.id || "").trim() === String(paymentId).trim());
    const paymentLabel = payment
      ? `${payment.payerName || "未命名"} ${formatFinanceAmount_(payment.amount)}`
      : paymentId;
    if (!confirmDelete_(`確定要刪除收款紀錄「${paymentLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "deleteFundPayment", id: paymentId });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadFundPayments(fundPaymentForm.eventId);
      await loadFundSummary();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFundPaymentAccounted_ = async (payment) => {
    if (!payment || !payment.id) {
      return;
    }
    if (!hasAccountingPrivilege) {
      setError("你沒有入帳權限");
      return;
    }
    const actorId = googleLinkedStudent ? String(googleLinkedStudent.id || "").trim() : "";
    if (!actorId) {
      setError("尚未識別登入者");
      return;
    }

    const paymentId = String(payment.id || "").trim();
    const nextAccountedAt = payment.accountedAt ? "" : getTodayDateInputValue_();

    if (payment.accountedAt) {
      if (!confirmDelete_("確定要撤銷入帳嗎？這會清除入帳日期。")) {
        return;
      }
    }

    setFundPaymentEditingLoadingId(paymentId);
    setError("");
    setStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: payment.accountedAt ? "unmarkFundPaymentAccounted" : "markFundPaymentAccounted",
        id: paymentId,
        accountedAt: nextAccountedAt,
        actorId,
      });
      if (!result.ok) {
        throw new Error(result.error || "更新入帳狀態失敗");
      }
      await loadFundPayments(fundPaymentForm.eventId);
      await loadFundSummary();
      setStatusMessage(payment.accountedAt ? "已撤銷入帳" : "已入帳");
    } catch (err) {
      setError(err.message || "更新入帳狀態失敗");
    } finally {
      setFundPaymentEditingLoadingId("");
    }
  };

  const openBatchAccountModal_ = () => {
    if (!hasAccountingPrivilege) {
      setError("你沒有入帳權限");
      return;
    }
    if (!fundPaymentForm.eventId) {
      setError("請先選擇班費事件");
      return;
    }
    setBatchAccountDate(getTodayDateInputValue_());
    setBatchAccountMessage("");
    setBatchAccountModalOpen(true);
    window.setTimeout(() => {
      try {
        batchAccountModalRef.current?.showModal?.();
      } catch {}
    }, 0);
  };

  const closeBatchAccountModal_ = () => {
    setBatchAccountModalOpen(false);
    setBatchAccountLoading(false);
    try {
      batchAccountModalRef.current?.close?.();
    } catch {}
  };

  const handleBatchAccountFundPayments_ = async () => {
    if (!fundPaymentForm.eventId) {
      setError("請先選擇班費事件");
      return;
    }
    const actorId = googleLinkedStudent ? String(googleLinkedStudent.id || "").trim() : "";
    if (!actorId) {
      setError("尚未識別登入者");
      return;
    }
    const dateValue = String(batchAccountDate || "").trim();
    if (!dateValue) {
      setError("請選擇入帳日期");
      return;
    }
    setBatchAccountLoading(true);
    setError("");
    setBatchAccountMessage("");
    try {
      const { result } = await apiRequest({
        action: "batchMarkFundPaymentsAccounted",
        eventId: fundPaymentForm.eventId,
        accountedAt: dateValue,
        actorId,
      });
      if (!result.ok) {
        throw new Error(result.error || "批次入帳失敗");
      }
      const updated = result.data || {};
      await loadFundPayments(fundPaymentForm.eventId);
      await loadFundSummary();
      setBatchAccountMessage(`已批次入帳 ${updated.updated || 0} 筆，略過 ${updated.skipped || 0} 筆`);
      closeBatchAccountModal_();
      setStatusMessage(`已批次入帳 ${updated.updated || 0} 筆`);
    } catch (err) {
      setError(err.message || "批次入帳失敗");
    } finally {
      setBatchAccountLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              財務管理 · 後台
            </h1>
          </div>
          <a
            href="/"
            className="hidden btn-ghost sm:inline-flex"
          >
            回首頁
          </a>
        </div>
        <div className="mx-auto mt-4 flex max-w-6xl items-center sm:hidden">
          <a
            href="/"
            className="btn-chip"
          >
            回首頁
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        {initialLoading ? (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
              <span className="font-medium">後台資料載入中…</span>
            </div>
            <p className="mt-1 text-xs text-sky-700">正在整理請款、簽核與角色資料，通常只要幾秒鐘。</p>
          </div>
        ) : null}
        {!initialLoading && !hasFinanceAccess ? (
          <div className="alert alert-warning">
            目前帳號沒有財務後台權限，請確認是否屬於財會組、資管組或班代/副班代。
          </div>
        ) : null}
        {!initialLoading && hasFinanceAccess ? (
        <>
        <section className="card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-400">
                財會組可檢視；可操作需指派財務角色
              </span>
              {availableRoles.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map((key) => (
                    <button
                      key={key}
                      onClick={() => setRole(key)}
                      className={`rounded-xl px-4 py-2 ${
                        role === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {FINANCE_ROLE_LABELS[key]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "requests", label: "請款/請購" },
                { id: "manual", label: "代為建單" },
                { id: "funds", label: "班費管理" },
                { id: "roles", label: "財務角色" },
                { id: "categories", label: "班務性質" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setAdminTab(item.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    adminTab === item.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
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

        {adminTab === "requests" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="card p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">待處理案件</h2>
                {loading ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    載入中
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {filteredRequests.length ? (
                  filteredRequests.map((item) => {
                    const amount =
                      item.type === "purchase" ? item.amountEstimated : item.amountActual;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          selectedId === item.id
                            ? "border-slate-900 bg-white text-slate-700"
                            : "border-slate-200/70 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.title || "未命名"}</p>
                            <p className="text-xs opacity-70">
                              {FINANCE_TYPES.find((type) => type.value === item.type)?.label || "申請"} ·{" "}
                              {formatFinanceAmount_(amount)}
                            </p>
                          </div>
                          <span className="text-xs opacity-70">{item.id}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">目前沒有待處理案件。</p>
                )}
              </div>
            </div>

            <div className="card p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">簽核中案件</h2>
                <span className="text-xs text-slate-400">非目前角色待處理</span>
              </div>
              <div className="mt-4 space-y-3">
                {inProgressItems.length ? (
                  inProgressItems.map((item) => {
                    const amount =
                      item.type === "purchase" ? item.amountEstimated : item.amountActual;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          selectedId === item.id
                            ? "border-slate-900 bg-white text-slate-700"
                            : "border-slate-200/70 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.title || "未命名"}</p>
                            <p className="text-xs opacity-70">
                              {FINANCE_TYPES.find((type) => type.value === item.type)?.label || "申請"} ·{" "}
                              {formatFinanceAmount_(amount)} ·{" "}
                              {FINANCE_STATUS_LABELS[item.status] || item.status}
                            </p>
                          </div>
                          <span className="text-xs opacity-70">{item.id}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">目前沒有簽核中的案件。</p>
                )}
              </div>
            </div>

            <div className="card p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">已結案</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletedView("relevant")}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      completedView === "relevant"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    與我相關
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletedView("all")}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      completedView === "all"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    全部
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {completedItems.length ? (
                  completedItems.map((item) => {
                    const amount =
                      item.type === "purchase" ? item.amountEstimated : item.amountActual;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          selectedId === item.id
                            ? "border-slate-900 bg-white text-slate-700"
                            : "border-slate-200/70 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.title || "未命名"}</p>
                            <p className="text-xs opacity-70">
                              {FINANCE_TYPES.find((type) => type.value === item.type)?.label || "申請"} ·{" "}
                              {formatFinanceAmount_(amount)}
                            </p>
                          </div>
                          <span className="text-xs opacity-70">{item.id}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">尚未有已結案的案件。</p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">案件細節</h2>
            {selectedRequest ? (
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div>
                  <p className="font-semibold text-slate-900">{selectedRequest.title}</p>
                  <p className="text-xs text-slate-500">
                    {selectedRequest.id} ·{" "}
                    {FINANCE_STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
                  </p>
                </div>
                  <div className="grid gap-2 text-xs text-slate-500">
                    <div>
                      申請人：{selectedRequest.applicantName || "-"} ·{" "}
                      {CLASS_GROUPS.find((item) => item.id === selectedRequest.applicantDepartment)?.label ||
                        selectedRequest.applicantDepartment ||
                        "-"}
                    </div>
                    <div>
                      組別：
                      {CLASS_GROUPS.find((item) => item.id === selectedRequest.applicantDepartment)
                        ?.label || "-"}
                    </div>
                    <div>
                      類型：
                      {FINANCE_TYPES.find((type) => type.value === selectedRequest.type)?.label || "-"}
                    </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      金額：
                      {formatFinanceAmount_(
                        selectedRequest.type === "purchase"
                          ? selectedRequest.amountEstimated
                          : selectedRequest.amountActual
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText_(
                          normalizeAmountForCopy_(
                            selectedRequest.type === "purchase"
                              ? selectedRequest.amountEstimated
                              : selectedRequest.amountActual
                          ),
                          "金額"
                        )
                      }
                      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700"
                      title="複製金額"
                    >
                      📋
                    </button>
                  </div>
                  <div>說明：{selectedRequest.description || "-"}</div>
                  <div>
                    班務性質：
                    {financeCategories.find((item) => item.id === selectedRequest.categoryType)
                      ?.label || "-"}
                  </div>
                  {selectedRequest.type === "payment" ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-slate-700">
                      <p className="text-[11px] font-semibold tracking-wide text-amber-800">匯款重點資訊</p>
                      <div className="mt-2 grid gap-2 text-xs">
                        <div>請款方式：{FINANCE_PAYMENT_METHODS.find((item) => item.value === selectedRequest.paymentMethod)?.label || selectedRequest.paymentMethod || "-"}</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">廠商/收款人：{selectedRequest.payeeName || "-"}</span>
                          <button type="button" onClick={() => copyText_(selectedRequest.payeeName, "廠商/收款人")} className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100" title="複製廠商/收款人">📋</button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">銀行：{selectedPayeeBankName || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">銀行代碼：{selectedPayeeBankCode || "-"}</span>
                          <button
                            type="button"
                            disabled={!selectedPayeeBankCode}
                            onClick={() => copyText_(selectedPayeeBankCode, "銀行代碼")}
                            className={`rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100 ${!selectedPayeeBankCode ? "cursor-not-allowed opacity-50" : ""}`}
                            title="複製銀行代碼"
                          >
                            📋
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">帳號：{selectedRequest.payeeAccount || "-"}</span>
                          <button type="button" onClick={() => copyText_(selectedRequest.payeeAccount, "帳號")} className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100" title="複製帳號">📋</button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {selectedRequest.type === "purchase" ? (
                    <div>廠商/採購來源：{selectedRequest.vendorName || "-"}</div>
                  ) : null}
                </div>
                {copyStatus ? <p className="text-[11px] text-emerald-600">{copyStatus}</p> : null}
                {selectedRequest.attachments ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-600">附件</p>
                    <div className="mt-2 space-y-2">
                      {parseFinanceAttachments_(selectedRequest.attachments).map((item, index) => (
                        <a
                          key={`${item.url}-${index}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-slate-300"
                        >
                          {item.name || item.url}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-slate-600">目前應審核角色</label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700">
                    {currentRoleLabel}
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-slate-600">備註</label>
                  <textarea
                    value={actorNote}
                    onChange={(event) => setActorNote(event.target.value)}
                    rows="2"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700"
                  />
                </div>

                {canAct ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAction("approve")}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      核准
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAction("return")}
                      className="badge-error px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      退回
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {viewAllForFinanceGroup
                      ? "尚未指派財務角色，僅可檢視。"
                      : "此角色目前無可核准案件。"}
                  </p>
                )}

                {actions.length ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">流程紀錄</p>
                    {latestAction ? (
                      <p className="mt-1 text-xs text-slate-500">
                        最近審核人：{latestAction.actorName || "—"} ·{" "}
                        {FINANCE_ROLE_LABELS[latestAction.actorRole] ||
                          latestAction.actorRole ||
                          "-"}
                      </p>
                    ) : null}
                    <div className="mt-2 space-y-2">
                      {sortedActions.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {item.action} · {FINANCE_ROLE_LABELS[item.actorRole] || item.actorRole || "-"}{" "}
                            {item.actorName || ""}
                          </span>
                          <span className="text-slate-400">
                            {formatDisplayDate_(item.createdAt, { withTime: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">請先選擇案件。</p>
            )}
          </div>
        </section>
        ) : null}

        {adminTab === "manual" ? (
          <section className="mt-6 card p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">代為建立財務申請</h2>
            <p className="mt-2 text-sm text-slate-500">
              會計可代為建立申請單並上傳相關憑據（LINE 截圖等）。申請人會在「我的申請」看到這筆紀錄。
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  申請人 <span className="text-rose-600">*</span>
                </label>
                <select
                  value={manualRequestForm.applicantId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const student = students.find((s) => s.id === selectedId);
                    setManualRequestForm({
                      ...manualRequestForm,
                      applicantId: selectedId,
                      applicantName: student ? student.name : "",
                    });
                  }}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">請選擇申請人</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  申請類型 <span className="text-rose-600">*</span>
                </label>
                <select
                  value={manualRequestForm.type}
                  onChange={(e) =>
                    setManualRequestForm({ ...manualRequestForm, type: e.target.value })
                  }
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">請選擇</option>
                  {FINANCE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  項目名稱 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={manualRequestForm.title}
                  onChange={(e) =>
                    setManualRequestForm({ ...manualRequestForm, title: e.target.value })
                  }
                  placeholder="請填寫項目名稱"
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">說明/活動內容</label>
                <textarea
                  value={manualRequestForm.description}
                  onChange={(e) =>
                    setManualRequestForm({ ...manualRequestForm, description: e.target.value })
                  }
                  placeholder="活動內容、費用說明等"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">班務性質</label>
                <select
                  value={manualRequestForm.categoryType}
                  onChange={(e) =>
                    setManualRequestForm({ ...manualRequestForm, categoryType: e.target.value })
                  }
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">請選擇</option>
                  {financeCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  {manualRequestForm.type === "purchase" ? "預估金額" : "實支金額"}{" "}
                  <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={
                    manualRequestForm.type === "purchase"
                      ? manualRequestForm.amountEstimated
                      : manualRequestForm.amountActual
                  }
                  onChange={(e) => {
                    const field =
                      manualRequestForm.type === "purchase" ? "amountEstimated" : "amountActual";
                    setManualRequestForm({ ...manualRequestForm, [field]: e.target.value });
                  }}
                  placeholder="金額"
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  申請組別 <span className="text-rose-600">*</span>
                </label>
                <select
                  value={manualRequestForm.applicantDepartment}
                  onChange={(e) =>
                    setManualRequestForm({
                      ...manualRequestForm,
                      applicantDepartment: e.target.value,
                    })
                  }
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">請選擇</option>
                  {CLASS_GROUPS.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </div>

              {manualRequestForm.type === "payment" ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900">
                      對應請購單號
                    </label>
                    <input
                      type="text"
                      value={manualRequestForm.relatedPurchaseId}
                      onChange={(e) =>
                        setManualRequestForm({
                          ...manualRequestForm,
                          relatedPurchaseId: e.target.value,
                        })
                      }
                      placeholder="例：P20250108001"
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900">
                      未經請購原因
                    </label>
                    <input
                      type="text"
                      value={manualRequestForm.noPurchaseReason}
                      onChange={(e) =>
                        setManualRequestForm({
                          ...manualRequestForm,
                          noPurchaseReason: e.target.value,
                        })
                      }
                      placeholder="若無對應請購單號，請填寫原因"
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900">
                      廠商/收款人 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualRequestForm.payeeName}
                      onChange={(e) =>
                        setManualRequestForm({ ...manualRequestForm, payeeName: e.target.value })
                      }
                      placeholder="廠商或收款人名稱"
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900">
                      銀行代碼 <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative mt-2">
                      <input
                        type="text"
                        value={manualBankPickerQuery}
                        onChange={(e) => {
                          const next = e.target.value;
                          setManualBankPickerQuery(next);
                          setManualBankPickerOpen(true);

                          const trimmed = String(next || "").trim();
                          if (!trimmed) {
                            setManualRequestForm((prev) => ({
                              ...prev,
                              payeeBankCode: "",
                              payeeBankName: "",
                              payeeBank: "",
                            }));
                            return;
                          }

                          const codeMatch =
                            trimmed.match(/^(\d{3})$/) || trimmed.match(/^(\d{3})\b/);
                          if (codeMatch) {
                            const code = codeMatch[1];
                            const hit = bankByCode.get(code);
                            setManualRequestForm((prev) => ({
                              ...prev,
                              payeeBankCode: code,
                              payeeBankName: hit
                                ? hit.name
                                : prev.payeeBankName || prev.payeeBank || "",
                              payeeBank: hit
                                ? hit.name
                                : prev.payeeBankName || prev.payeeBank || "",
                            }));
                            return;
                          }

                          const normalized = normalizeTwBankName(trimmed);
                          const exact = TW_BANK_CODES.find(
                            (item) => normalizeTwBankName(item.name) === normalized
                          );
                          if (exact) {
                            setManualRequestForm((prev) => ({
                              ...prev,
                              payeeBankCode: exact.code,
                              payeeBankName: exact.name,
                              payeeBank: exact.name,
                            }));
                          }
                        }}
                        onFocus={() => {
                          if (!manualBankPickerOpen) {
                            setManualBankPickerOpen(true);
                          }
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setManualBankPickerOpen(false), 150);
                        }}
                        placeholder="輸入銀行名稱或代碼（例：台新 / 812）"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                      />
                      {manualBankPickerOpen && manualBankSuggestions.length ? (
                        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                          {manualBankSuggestions.map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setManualRequestForm((prev) => ({
                                  ...prev,
                                  payeeBankCode: item.code,
                                  payeeBankName: item.name,
                                  payeeBank: item.name,
                                }));
                                setManualBankPickerQuery(`${item.code} ${item.name}`.trim());
                                setManualBankPickerOpen(false);
                              }}
                              className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <span className="font-semibold tabular-nums">{item.code}</span>
                              <span className="ml-2">{item.name}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {manualRequestForm.payeeBankCode ||
                    manualRequestForm.payeeBankName ||
                    manualRequestForm.payeeBank ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        已選：{manualRequestForm.payeeBankCode || "-"}{" "}
                        {manualRequestForm.payeeBankName || manualRequestForm.payeeBank || ""}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        可輸入名稱快速搜尋（送出/匯款時用代碼）。
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900">
                      匯款帳號 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualRequestForm.payeeAccount}
                      onChange={(e) =>
                        setManualRequestForm({
                          ...manualRequestForm,
                          payeeAccount: e.target.value,
                        })
                      }
                      placeholder="轉帳帳號"
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900">付款方式</label>
                    <select
                      value={manualRequestForm.paymentMethod}
                      onChange={(e) =>
                        setManualRequestForm({
                          ...manualRequestForm,
                          paymentMethod: e.target.value,
                        })
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    >
                      <option value="">請選擇</option>
                      {FINANCE_PAYMENT_METHODS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900">
                      預計清款日
                    </label>
                    <input
                      type="date"
                      value={manualRequestForm.expectedClearDate}
                      onChange={(e) =>
                        setManualRequestForm({
                          ...manualRequestForm,
                          expectedClearDate: e.target.value,
                        })
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900">幣別</label>
                    <select
                      value={manualRequestForm.currency}
                      onChange={(e) =>
                        setManualRequestForm({
                          ...manualRequestForm,
                          currency: e.target.value,
                        })
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    >
                      <option value="TWD">TWD 新台幣</option>
                      <option value="USD">USD 美元</option>
                      <option value="EUR">EUR 歐元</option>
                      <option value="JPY">JPY 日圓</option>
                      <option value="CNY">CNY 人民幣</option>
                    </select>
                  </div>
                </>
              ) : null}

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  附件（LINE 截圖等憑據）
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={manualRequestAttachmentInput}
                    onChange={(e) => setManualRequestAttachmentInput(e.target.value)}
                    placeholder="貼上圖片或 PDF 網址"
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddManualAttachment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddManualAttachment}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    新增
                  </button>
                </div>
                {Array.isArray(manualRequestForm.attachments) &&
                manualRequestForm.attachments.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {manualRequestForm.attachments.map((url, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span className="flex-1 truncate text-xs text-slate-600">{url}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveManualAttachment(url)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">初始狀態</label>
                <select
                  value={manualRequestForm.status}
                  onChange={(e) =>
                    setManualRequestForm({ ...manualRequestForm, status: e.target.value })
                  }
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="draft">草稿（申請人可繼續編輯）</option>
                  <option value="pending_lead">送出待審</option>
                  <option value="closed">直接結案（線下已審核）</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSubmitManualRequest}
                  disabled={loading}
                  className="h-10 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? "建立中..." : "建立申請"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualRequestForm({
                      ...buildFinanceDraft_(),
                      applicantId: "",
                      applicantName: "",
                      status: "pending_lead",
                    });
                    setManualRequestAttachmentInput("");
                    setManualBankPickerQuery("");
                    setManualBankPickerOpen(false);
                  }}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  清空
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {adminTab === "funds" ? (
          <section className="mt-6 space-y-6">
            <div className="card p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-slate-900">班費收支概況</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400">收入 (已收)</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatFinanceAmount_(fundSummary?.income?.received || 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400">收入 (已入帳)</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatFinanceAmount_(fundSummary?.income?.accounted || 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400">支出 (已結案)</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatFinanceAmount_(fundSummary?.expense?.total || 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400">結餘 (已入帳)</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatFinanceAmount_(fundSummary?.balance?.accounted || 0)}
                  </p>
                </div>
              </div>
            </div>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="card p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">班費事件</h2>
                  <button
                    type="button"
                    onClick={startNewFundEvent_}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    新增
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {fundEvents.length ? (
                    fundEvents.map((item) => {
                      const expectedGeneral = parseFinanceAmount_(item.amountGeneral) *
                        parseFinanceAmount_(item.expectedGeneralCount);
                      const expectedSponsor = parseFinanceAmount_(item.amountSponsor) *
                        parseFinanceAmount_(item.expectedSponsorCount);
                      const expectedTotal = expectedGeneral + expectedSponsor;
                      const isActive = fundPaymentForm.eventId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            handleFundPaymentChange("eventId", item.id);
                            resetFundPaymentForm(item.id);
                          }}
                          className={`cursor-pointer rounded-2xl border p-4 text-sm text-slate-600 transition ${
                            isActive
                              ? "border-slate-900 bg-white text-slate-700"
                              : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatDisplayDate_(item.dueDate) || "-"} ·
                                {FUND_EVENT_STATUS.find((status) => status.value === item.status)?.label ||
                                  item.status}
                              </p>
                              <p className="text-xs text-slate-500">
                                目標收款 {formatFinanceAmount_(expectedTotal)}
                              </p>
                              {item.createdById ? (
                                <p className="text-[11px] text-slate-400">
                                  建檔者：{item.createdById}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEditFundEvent(item);
                                  resetFundPaymentForm(item.id);
                                }}
                                disabled={
                                  String(item.id || "").trim() &&
                                  fundEventEditingLoadingId === String(item.id || "").trim()
                                }
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
                              >
                                {String(item.id || "").trim() &&
                                fundEventEditingLoadingId === String(item.id || "").trim()
                                  ? "載入中..."
                                  : "編輯"}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteFundEvent(item.id);
                                }}
                                className="badge-error hover:border-rose-300"
                              >
                                刪除
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">尚未建立班費事件。</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="card p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">收款紀錄</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="badge">
                      {fundEvents.find((item) => item.id === fundPaymentForm.eventId)?.title ||
                        "尚未選擇班費事件"}
                    </div>
                    <button
                      type="button"
                      onClick={openBatchAccountModal_}
                      disabled={!fundPayments.length}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50"
                      title="將目前未入帳的收款一次入帳"
                    >
                      批次入帳
                    </button>
                    <button
                      type="button"
                      onClick={startNewFundPayment_}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      新增收款
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {fundPayments.length ? (
                    fundPayments.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {resolveStudentNameById_(item.payerId) || item.payerName} ·{" "}
                              {formatFinanceAmount_(item.amount)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {FUND_PAYER_TYPES.find((type) => type.value === item.payerType)?.label ||
                                item.payerType}{" "}
                              ·{" "}
                              {FUND_PAYMENT_METHODS.find((method) => method.value === item.method)
                                ?.label || item.method}
                              {item.transferLast5 ? ` · 末五碼 ${item.transferLast5}` : ""}
                            </p>
                            <p className="text-xs text-slate-400">
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
                            {item.createdById || item.updatedById ? (
                              <p className="text-[11px] text-slate-400">
                                建檔者：{item.createdById || "-"} · 編輯者：{item.updatedById || "-"}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleFundPaymentAccounted_(item)}
                              disabled={
                                !hasAccountingPrivilege ||
                                (String(item.id || "").trim() &&
                                  fundPaymentEditingLoadingId === String(item.id || "").trim())
                              }
                              className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-60 ${
                                item.accountedAt
                                  ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                              }`}
                              title={item.accountedAt ? "撤銷入帳（清除入帳日期）" : "一鍵入帳：入帳日期=今天"}
                            >
                              {item.accountedAt ? "撤銷入帳" : "入帳"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditFundPayment(item)}
                              disabled={
                                String(item.id || "").trim() &&
                                fundPaymentEditingLoadingId === String(item.id || "").trim()
                              }
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
                            >
                              {String(item.id || "").trim() &&
                              fundPaymentEditingLoadingId === String(item.id || "").trim()
                                ? "載入中..."
                                : "編輯"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFundPayment(item.id)}
                              className="badge-error hover:border-rose-300"
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">尚未建立收款紀錄。</p>
                  )}
                </div>
              </div>
            </section>

            <section className="card p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">收齊狀況</h2>
                  <p className="text-xs text-slate-500">
                    已繳 {generalPaid + sponsorPaid} / {generalPayers.length + sponsorPayers.length}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: "all", label: "全部" },
                    { id: "paid", label: "已繳" },
                    { id: "unpaid", label: "未繳" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFundPayerView(item.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        fundPayerView === item.id
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFundPayerView((prev) => (prev === "collapsed" ? "all" : "collapsed"))}
                    className="btn-chip"
                  >
                    {fundPayerView === "collapsed" ? "展開" : "收合"}
                  </button>
                  <input
                    value={fundPayerQuery}
                    onChange={(event) => setFundPayerQuery(event.target.value)}
                    placeholder="搜尋姓名或 Email"
                    className="h-9 w-40 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
                  />
                </div>
              </div>

              {fundPayerView === "collapsed" ? (
                <p className="mt-4 text-sm text-slate-500">已收合，點「展開」查看名單。</p>
              ) : !fundPaymentForm.eventId ? (
                <p className="mt-4 text-sm text-slate-500">請先選擇班費事件。</p>
              ) : !students.length ? (
                <p className="mt-4 text-sm text-slate-500">尚未載入同學名單。</p>
              ) : (
                <div className="mt-4 space-y-6">
                  <div className="alert alert-warning p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>班董</span>
                      <span>
                        已繳 {sponsorPaid} / {sponsorPayers.length}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sponsorPayers.length ? (
                        sponsorPayers.map((payer) => (
                          <span
                            key={`${payer.email || payer.name}-sponsor`}
                            title={payer.email || ""}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${
                              payer.paid
                                ? "badge-success"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            {payer.name || payer.email || "未命名"}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">沒有符合的名單。</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>一般同學</span>
                      <span>
                        已繳 {generalPaid} / {generalPayers.length}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {generalPayers.length ? (
                        generalPayers.map((payer) => (
                          <span
                            key={`${payer.email || payer.name}-general`}
                            title={payer.email || ""}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${
                              payer.paid
                                ? "badge-success"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            {payer.name || payer.email || "未命名"}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">沒有符合的名單。</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

          </section>
        ) : null}

        {adminTab === "roles" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div
                id="fund-events-anchor"
                className="card p-6 sm:p-8"
              >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">財務角色</h2>
                <button
                  type="button"
                  onClick={resetFinanceRoleForm}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  新增
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {financeRoles.length ? (
                  financeRoles.map((item) => {
                    const isActive = financeRoleForm.id
                      ? financeRoleForm.id === item.id
                      : normalizeId_(financeRoleForm.personId) === normalizeId_(item.personId) &&
                        financeRoleForm.role === item.role;
                    return (
                      <div
                        key={item.id || `${item.personId}-${item.role}`}
                        onClick={() => handleEditFinanceRole(item)}
                        className={`rounded-2xl border p-4 text-sm text-slate-600 transition ${
                          isActive
                            ? "border-slate-900 bg-white text-slate-700"
                            : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
                        } cursor-pointer`}
                      >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.personName || item.personEmail || item.personId}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.personEmail || "-"} ·{" "}
                            {FINANCE_ROLE_OPTIONS.find((role) => role.id === item.role)?.label ||
                              item.role}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteFinanceRole(item.id);
                            }}
                            className="badge-error hover:border-rose-300"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">尚未設定財務角色。</p>
                )}
              </div>
            </div>

            <form
              onSubmit={handleSaveFinanceRole}
              className="card p-6 sm:p-8"
            >
              <h3 className="text-lg font-semibold text-slate-900">設定財務角色</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">選擇同學（財會組）</label>
                  <input
                    list="finance-role-students"
                    onChange={(event) => handleSelectFinanceRoleMember_(event.target.value)}
                    placeholder="輸入姓名/學號/Email"
                    className="input-sm"
                  />
                  <datalist id="finance-role-students">
                    {financeGroupOptions.map((item) => (
                      <option
                        key={item.id || item.email}
                        value={item.name || item.id || item.email || ""}
                      >
                        {item.id || ""} {item.email || ""}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">學號 / ID</label>
                  <input
                    value={financeRoleForm.personId}
                    onChange={(event) => handleFinanceRoleChange("personId", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">姓名</label>
                  <input
                    value={financeRoleForm.personName}
                    onChange={(event) => handleFinanceRoleChange("personName", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">角色</label>
                  <select
                    value={financeRoleForm.role}
                    onChange={(event) => handleFinanceRoleChange("role", event.target.value)}
                    className="input-sm"
                  >
                    {FINANCE_ROLE_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">備註</label>
                  <textarea
                    value={financeRoleForm.notes}
                    onChange={(event) => handleFinanceRoleChange("notes", event.target.value)}
                    rows="3"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? "儲存中..." : "儲存角色"}
                </button>
                <button
                  type="button"
                  onClick={resetFinanceRoleForm}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  清空
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {adminTab === "categories" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="card p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">班務性質</h2>
                <button
                  type="button"
                  onClick={resetFinanceCategoryForm}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  新增
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {financeCategories.length ? (
                  financeCategories.map((item) => {
                    const isActive = financeCategoryForm.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleEditFinanceCategory(item)}
                        className={`rounded-2xl border p-4 text-sm text-slate-600 transition ${
                          isActive
                            ? "border-slate-900 bg-white text-slate-700"
                            : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
                        } cursor-pointer`}
                      >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.label || "未命名"}</p>
                          <p className="text-xs text-slate-500">
                            排序 {item.sortOrder || "-"} · {item.id}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteFinanceCategory(item.id);
                            }}
                            className="badge-error hover:border-rose-300"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">尚未設定班務性質。</p>
                )}
              </div>
            </div>

            <form
              onSubmit={handleSaveFinanceCategory}
              className="card p-6 sm:p-8"
            >
              <h3 className="text-lg font-semibold text-slate-900">設定班務性質</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">名稱</label>
                  <input
                    value={financeCategoryForm.label}
                    onChange={(event) => handleFinanceCategoryChange("label", event.target.value)}
                    placeholder="例如：全班性的聯誼活動"
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">排序</label>
                  <input
                    value={financeCategoryForm.sortOrder}
                    onChange={(event) => handleFinanceCategoryChange("sortOrder", event.target.value)}
                    placeholder="數字越小越前"
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">備註</label>
                  <textarea
                    value={financeCategoryForm.notes}
                    onChange={(event) => handleFinanceCategoryChange("notes", event.target.value)}
                    rows="3"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? "儲存中..." : "儲存性質"}
                </button>
                <button
                  type="button"
                  onClick={resetFinanceCategoryForm}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  清空
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {showFundEventModal ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-6">
            <div ref={fundEventModalRef} className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)] sm:p-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  {fundEventForm.id ? "編輯班費事件" : "新增班費事件"}
                </h3>
                <button
                  type="button"
                  onClick={closeFundEventModal_}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  關閉
                </button>
              </div>
              <form onSubmit={handleSaveFundEvent} className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">事件名稱</label>
                  <input
                    value={fundEventForm.title}
                    onChange={(event) => handleFundEventChange("title", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">截止日期</label>
                  <input
                    type="date"
                    value={fundEventForm.dueDate}
                    onChange={(event) => handleFundEventChange("dueDate", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">狀態</label>
                  <select
                    value={fundEventForm.status}
                    onChange={(event) => handleFundEventChange("status", event.target.value)}
                    className="input-sm"
                  >
                    {FUND_EVENT_STATUS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">一般同學金額</label>
                  <input
                    value={fundEventForm.amountGeneral}
                    onChange={(event) => handleFundEventChange("amountGeneral", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">班董金額</label>
                  <input
                    value={fundEventForm.amountSponsor}
                    onChange={(event) => handleFundEventChange("amountSponsor", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">預計一般人數</label>
                  <input
                    value={fundEventForm.expectedGeneralCount}
                    onChange={(event) =>
                      handleFundEventChange("expectedGeneralCount", event.target.value)
                    }
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">預計班董人數</label>
                  <input
                    value={fundEventForm.expectedSponsorCount}
                    onChange={(event) =>
                      handleFundEventChange("expectedSponsorCount", event.target.value)
                    }
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">說明/備註</label>
                  <textarea
                    value={fundEventForm.description}
                    onChange={(event) => handleFundEventChange("description", event.target.value)}
                    rows="3"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? "儲存中..." : "儲存事件"}
                  </button>
                  <button
                    type="button"
                    onClick={resetFundEventForm}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    清空
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {showFundPaymentModal ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-6">
            <div ref={fundPaymentModalRef} className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)] sm:p-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  {fundPaymentForm.id ? "編輯收款" : "新增收款"}
                </h3>
                <button
                  type="button"
                  onClick={closeFundPaymentModal_}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  關閉
                </button>
              </div>
              <form onSubmit={handleSaveFundPayment} className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">班費事件 *</label>
                  <select
                    value={fundPaymentForm.eventId}
                    onChange={(event) => {
                      handleFundPaymentChange("eventId", event.target.value);
                      resetFundPaymentForm(event.target.value);
                    }}
                    required
                    aria-invalid={fundPaymentErrorFlags.eventId ? "true" : "false"}
                    className={`h-11 rounded-2xl border px-4 text-sm text-slate-900 ${
                      fundPaymentErrorFlags.eventId
                        ? "input-error"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <option value="">請選擇</option>
                    {fundEvents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">繳費人 *</label>
                  <input
                    value={fundPaymentForm.payerName}
                    onChange={(event) => {
                      const value = event.target.value;
                      handleFundPaymentChange("payerName", value);
                      const match = matchDirectoryByName_(value);
                      if (match) {
                        handleFundPaymentChange("payerId", match.id || "");
                        if (match.email) {
                          handleFundPaymentChange("payerEmail", match.email);
                        }
                      }
                    }}
                    list="fund-payer-options"
                    required
                    aria-invalid={fundPaymentErrorFlags.payerName ? "true" : "false"}
                    className={`h-11 rounded-2xl border px-4 text-sm text-slate-900 ${
                      fundPaymentErrorFlags.payerName
                        ? "input-error"
                        : "border-slate-200 bg-white"
                    }`}
                  />
                  <datalist id="fund-payer-options">
                    {students.map((item) => {
                      const name = item.name;
                      const email = item.email;
                      const options = [];
                      if (name) {
                        options.push(
                          <option key={`${item.id || email}-name`} value={name}>
                            {email || ""}
                          </option>
                        );
                      }
                      if (email) {
                        options.push(
                          <option key={`${item.id || email}-email`} value={email}>
                            {name || ""}
                          </option>
                        );
                      }
                      return options;
                    })}
                  </datalist>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input
                    value={fundPaymentForm.payerEmail}
                    onChange={(event) => {
                      const value = event.target.value;
                      handleFundPaymentChange("payerEmail", value);
                      const match = matchDirectoryByName_(value);
                      if (match) {
                        handleFundPaymentChange("payerId", match.id || "");
                        if (match.name) {
                          handleFundPaymentChange("payerName", match.name);
                        }
                      }
                    }}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">繳費身份</label>
                  <select
                    value={fundPaymentForm.payerType}
                    onChange={(event) => {
                      handleFundPaymentChange("payerType", event.target.value);
                      const eventItem = fundEvents.find(
                        (item) => item.id === fundPaymentForm.eventId
                      );
                      if (eventItem) {
                        const amount =
                          event.target.value === "sponsor"
                            ? eventItem.amountSponsor
                            : eventItem.amountGeneral;
                        handleFundPaymentChange("amount", amount || "");
                      }
                    }}
                    className="input-sm"
                  >
                    {FUND_PAYER_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">金額 *</label>
                  <input
                    value={fundPaymentForm.amount}
                    onChange={(event) => handleFundPaymentChange("amount", event.target.value)}
                    list="fund-amount-options"
                    required
                    aria-invalid={fundPaymentErrorFlags.amount ? "true" : "false"}
                    className={`h-11 rounded-2xl border px-4 text-sm text-slate-900 ${
                      fundPaymentErrorFlags.amount
                        ? "input-error"
                        : "border-slate-200 bg-white"
                    }`}
                  />
                  <datalist id="fund-amount-options">
                    <option value="50000">50000</option>
                    <option value="200000">200000</option>
                  </datalist>
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
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">入帳日期</label>
                  <input
                    type="date"
                    value={fundPaymentForm.accountedAt}
                    onChange={(event) =>
                      handleFundPaymentChange("accountedAt", event.target.value)
                    }
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
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? "儲存中..." : "儲存收款"}
                  </button>
                  <button
                    type="button"
                    onClick={() => resetFundPaymentForm(fundPaymentForm.eventId)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    清空
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {batchAccountModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-6">
            <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)] sm:p-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">批次入帳</h3>
                <button
                  type="button"
                  onClick={closeBatchAccountModal_}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  關閉
                </button>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <p>
                  將「目前尚未入帳」的收款紀錄一次入帳（不會覆蓋已入帳的日期）。
                </p>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">入帳日期</label>
                  <input
                    type="date"
                    value={batchAccountDate}
                    onChange={(event) => setBatchAccountDate(event.target.value)}
                    className="input-sm"
                  />
                </div>
                {batchAccountMessage ? (
                  <p className="text-xs font-semibold text-emerald-700">{batchAccountMessage}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBatchAccountFundPayments_}
                    disabled={batchAccountLoading}
                    className="btn-primary"
                  >
                    {batchAccountLoading ? "處理中..." : "確定批次入帳"}
                  </button>
                  <button
                    type="button"
                    onClick={closeBatchAccountModal_}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        </>
        ) : null}
      </main>
    </div>
  );
}

export default FinanceAdminPage;
