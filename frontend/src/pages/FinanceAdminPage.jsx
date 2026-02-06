import React, { useEffect, useMemo, useRef, useState } from "react";

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
    FINANCE_STATUS_LABELS,
    FINANCE_ROLE_LABELS,
    FINANCE_ROLE_OPTIONS,
    FUND_EVENT_STATUS,
    FUND_PAYER_TYPES,
    FUND_PAYMENT_METHODS,
    CLASS_GROUPS,
    normalizeId_,
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
  const adminDisplayName =
    (googleLinkedStudent &&
      (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    (googleLinkedStudent && googleLinkedStudent.email) ||
    "";
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
    const parsed = parseLocalInputDate_(raw);
    if (parsed) {
      return toDateInputValue_(parsed);
    }
    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return isoMatch ? isoMatch[1] : raw;
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

  const loadFinanceRoles = async () => {
    try {
      const { result } = await apiRequest({ action: "listFinanceRoles" });
      if (result.ok) {
        setFinanceRoles(result.data && result.data.roles ? result.data.roles : []);
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

  const loadFinanceAdminBootstrap = async () => {
    try {
      const { result } = await apiRequest({ action: "listFinanceAdminBootstrap" });
      if (!result.ok) {
        return false;
      }
      const data = result.data || {};
      setStudents(data.students || []);
      setGroupMemberships(data.groupMemberships || []);
      setFinanceRoles(data.roles || []);
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
    loadRequests();
    loadFinanceAdminBootstrap().then((ok) => {
      if (!ok) {
        loadGroupMemberships();
        loadFinanceRoles();
        loadFinanceCategories();
        loadStudents();
        loadFundEvents();
        loadFundSummary();
      }
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
      if (personId && String(item.personId || "").trim() === personId) {
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
      if (!fundEvents.length || !students.length || !groupMemberships.length || !financeRoles.length) {
        loadFinanceAdminBootstrap();
      }
      if (!fundSummary) {
        loadFundSummary();
      }
    }
    if (adminTab === "roles") {
      if (!groupMemberships.length || !financeRoles.length || !students.length) {
        loadFinanceAdminBootstrap();
      }
    }
    if (adminTab === "categories") {
      if (!financeCategories.length) {
        loadFinanceAdminBootstrap();
      }
    }
  }, [adminTab]);

  useEffect(() => {
    if (fundPaymentForm.eventId) {
      loadFundPayments(fundPaymentForm.eventId);
    }
  }, [fundPaymentForm.eventId]);

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
  const hasFinanceAccess = availableRoles.length > 0 || hasFinanceGroupPrivilege;

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
  const canAct =
    selectedRequest &&
    role !== "auditor" &&
    availableRoles.includes(role) &&
    selectedRequest.status === roleStatusMap[role] &&
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
  };

  const openFundPaymentModal_ = () => {
    setShowFundPaymentModal(true);
  };

  const closeFundPaymentModal_ = () => {
    setShowFundPaymentModal(false);
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
          personName: financeRoleForm.personName,
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
    resetFundEventForm();
    openFundEventModal_();
  };

  const startNewFundPayment_ = () => {
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
    setFundPaymentForm({
      id: item.id || "",
      eventId: item.eventId || "",
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
        {!hasFinanceAccess ? (
          <div className="alert alert-warning">
            目前帳號沒有財務後台權限，請確認是否屬於財會組、資管組或班代/副班代。
          </div>
        ) : null}
        {hasFinanceAccess ? (
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
              <button
                type="button"
                onClick={() => {
                  loadRequests();
                  loadFinanceAdminBootstrap();
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                重新整理
              </button>
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
                  <div>
                    金額：
                    {formatFinanceAmount_(
                      selectedRequest.type === "purchase"
                        ? selectedRequest.amountEstimated
                        : selectedRequest.amountActual
                    )}
                  </div>
                  <div>說明：{selectedRequest.description || "-"}</div>
                  <div>
                    班務性質：
                    {financeCategories.find((item) => item.id === selectedRequest.categoryType)
                      ?.label || "-"}
                  </div>
                </div>
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
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                              >
                                編輯
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
                              onClick={() => handleEditFundPayment(item)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                            >
                              編輯
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
            <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)] sm:p-8">
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
            <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)] sm:p-8">
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
        </>
        ) : null}
      </main>
    </div>
  );
}

export default FinanceAdminPage;
